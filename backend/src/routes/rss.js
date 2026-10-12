// RSS 订阅模块（2026-10-12 恢复，形态改为「站长订阅一次、访客只读」）
//
// 与 2026-10-09 删掉的那版最大的区别 —— 权限模型：
//   · 读（GET feeds / articles / opml 导出）：**访客也能读**，读的是站长的订阅，
//     路由层显式叠加 user_id = 站长 且 is_public = true（见 lib/publicScope.js）。
//     用户原话：「我懒得一个一个去点订阅」—— 站长订一次，所有人打开 /rss 就能看。
//   · 写（增 / 改 / 删 / 抓取 / 标已读 / OPML 导入）：**仅站长（requireAdmin）**。
//     访客与普通登录用户一律只读，避免每个访客各自建一套订阅源。
//
// 其余与旧版一致：
//   - 抓取落库 + 条件请求（etag / last-modified）+ guid 幂等去重（lib/rssSync.js）
//   - 新条目写通知中心（type=rss_new，只写给站长本人）
//   - OPML 导入导出

import { ok, readJson, HttpError, corsHeaders } from '../lib/response.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { requireString, optionalString, optionalInt, optionalBool, requireUuid } from '../lib/validate.js';
import { parseOpml, buildOpml } from '../lib/rss.js';
import { syncFeed } from '../lib/rssSync.js';
import { guestRssFeedFilters } from '../lib/publicScope.js';
import { listPresets, PRESET_GROUPS } from '../lib/rssPresets.js';
import { backfillTrending, isGithubTrendingFeed } from '../lib/rssTranslate.js';

const FEEDS = 'rss_feeds';
const ARTICLES = 'rss_articles';

// 抓取网页做「自动发现订阅源」时用的 UA（与 lib/rss.js 保持一致）
const UA = 'knowledge-base-rss/0.1 (+https://github.com/)';

// 对外字段白名单：**绝不回传 user_id**（与 moments / books 同一约定）。
const FEED_SELECT = 'id,title,feed_url,site_url,description,category_id,fetch_interval,last_fetched_at,last_error,error_count,is_active,is_public,created_at,updated_at';
// 列表不带 content_html：正文 HTML 可能很大，列表页只显示摘要，正文在详情接口按需取。
const ARTICLE_SELECT = 'id,feed_id,guid,title,link,author,summary,cover_path,published_at,is_read,created_at';
const ARTICLE_DETAIL_SELECT = `${ARTICLE_SELECT},content_html`;

// 读过滤：访客只看站长的公开源；站长本人看自己全部。
// 注意：访客上下文里 user.id 就是站长 id，所以 user_id 过滤天然成立，
// 但 is_public 必须显式叠上（Worker 用 service_role，RLS 不替它过滤）。
function feedReadFilter(user) {
  const filters = { user_id: `eq.${user.id}` };
  if (user.isGuest) Object.assign(filters, guestRssFeedFilters());
  return filters;
}

// 校验订阅链接为 http(s)
function validateFeedUrl(value) {
  const raw = requireString(value, 'feed_url', { max: 1000 });
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(422, 'feed_url 必须为合法链接');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new HttpError(422, 'feed_url 仅支持 http/https 协议');
  }
  return url.toString();
}

// 读取本人（或指定）订阅源，不存在则 404
async function findFeed(db, user, id) {
  requireUuid(id, 'id');
  const filters = { select: FEED_SELECT, id: `eq.${id}`, user_id: `eq.${user.id}` };
  // 访客看不到站长标为私人的源 —— 一律按「不存在」处理，不泄露存在性
  if (user.isGuest) filters.is_public = 'eq.true';
  const rows = await db.select(FEEDS, qs(filters));
  if (!rows.length) throw new HttpError(404, '订阅源不存在或无权限');
  return rows[0];
}

// 统计各订阅源的条目数 / 未读数。
// 访客没有「已读」这个概念（已读是站长的个人状态，且访客不能写），
// 因此访客只返回 total_count，unread_count 给 null，前端据此切换显示口径。
async function countsByFeed(db, user, feedIds) {
  if (!feedIds.length) return {};
  const filters = {
    select: 'feed_id,is_read',
    user_id: `eq.${user.id}`,
    feed_id: `in.(${feedIds.join(',')})`,
    limit: '10000'
  };
  const rows = await db.select(ARTICLES, qs(filters));
  const acc = {};
  for (const r of rows) {
    const slot = acc[r.feed_id] || (acc[r.feed_id] = { total: 0, unread: 0 });
    slot.total += 1;
    if (r.is_read === false) slot.unread += 1;
  }
  return acc;
}

// 访客可见的源 id 列表（用于条目查询的 feed_id 过滤）
async function publicFeedIds(db, user) {
  const rows = await db.select(FEEDS, qs({
    select: 'id',
    user_id: `eq.${user.id}`,
    is_public: 'eq.true',
    limit: '500'
  }));
  return rows.map((r) => r.id);
}

// ---------------------------------------------------------------
// 订阅源
// ---------------------------------------------------------------

// GET /api/rss/feeds
export async function listFeeds(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);

  const filters = { select: FEED_SELECT, ...feedReadFilter(user), order: 'created_at.desc' };
  const categoryId = url.searchParams.get('category_id');
  if (categoryId) filters.category_id = `eq.${categoryId}`;

  const feeds = await db.select(FEEDS, qs(filters));
  const counts = await countsByFeed(db, user, feeds.map((f) => f.id));
  return ok(feeds.map((f) => {
    const c = counts[f.id] || { total: 0, unread: 0 };
    return {
      ...f,
      total_count: c.total,
      // 访客没有「已读」状态，明确给 null，前端显示总数而不是假的未读数
      unread_count: user.isGuest ? null : c.unread
    };
  }), request, env);
}

// GET /api/rss/feeds/:id
export async function getFeed(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  const feed = await findFeed(db, user, id);
  const c = (await countsByFeed(db, user, [feed.id]))[feed.id] || { total: 0, unread: 0 };
  return ok({ ...feed, total_count: c.total, unread_count: user.isGuest ? null : c.unread }, request, env);
}

// POST /api/rss/feeds  —— 新增订阅源（best-effort 立即抓取一次）
export async function createFeed(request, env) {
  const { db, user } = await requireAdmin(request, env);
  const body = await readJson(request);

  const feedUrl = validateFeedUrl(body.feed_url);
  let categoryId = null;
  if (body.category_id !== undefined && body.category_id !== null) {
    categoryId = requireUuid(body.category_id, 'category_id');
    const cats = await db.select('categories', qs({
      select: 'id', id: `eq.${categoryId}`,
      ...(user.isAdmin ? {} : { user_id: `eq.${user.id}` })
    }));
    if (!cats.length) throw new HttpError(422, '分类不存在或无权限');
  }

  const rows = await db.request(FEEDS, {
    method: 'POST',
    body: {
      user_id: user.id,
      title: optionalString(body.title, 'title', { max: 300 }) ?? null,
      feed_url: feedUrl,
      site_url: optionalString(body.site_url, 'site_url', { max: 1000 }) ?? null,
      category_id: categoryId,
      fetch_interval: optionalInt(body.fetch_interval, 'fetch_interval', { min: 300, max: 86400 }) ?? 14400,
      is_active: optionalBool(body.is_active, 'is_active') ?? true,
      is_public: optionalBool(body.is_public, 'is_public') ?? true
    },
    prefer: 'return=representation,resolution=merge-duplicates'
  });
  const feed = rows[0];

  // 立即抓取一次，补全标题并导入条目（失败不影响创建）
  let sync = null;
  if (optionalBool(body.fetch_now, 'fetch_now') !== false) {
    try {
      const fresh = await db.select(FEEDS, qs({ select: FEED_SELECT, id: `eq.${feed.id}` }));
      sync = await syncFeed(db, fresh[0], { env });
    } catch (err) {
      sync = { error: err.message };
    }
  }

  const latest = await db.select(FEEDS, qs({ select: FEED_SELECT, id: `eq.${feed.id}` }));
  return ok({ ...latest[0], sync }, request, env, 201);
}

// PATCH /api/rss/feeds/:id
export async function updateFeed(request, env, id) {
  const { db, user } = await requireAdmin(request, env);
  await findFeed(db, user, id);
  const body = await readJson(request);

  const patch = {};
  if (body.title !== undefined) patch.title = optionalString(body.title, 'title', { max: 300 }) ?? null;
  if (body.site_url !== undefined) patch.site_url = optionalString(body.site_url, 'site_url', { max: 1000 }) ?? null;
  if (body.fetch_interval !== undefined) {
    patch.fetch_interval = optionalInt(body.fetch_interval, 'fetch_interval', { min: 300, max: 86400 });
  }
  if (body.is_active !== undefined) patch.is_active = optionalBool(body.is_active, 'is_active');
  if (body.is_public !== undefined) patch.is_public = optionalBool(body.is_public, 'is_public');
  if (body.description !== undefined) patch.description = optionalString(body.description, 'description', { max: 1000 }) ?? null;
  if (body.category_id !== undefined) {
    patch.category_id = body.category_id === null ? null : requireUuid(body.category_id, 'category_id');
  }
  if (body.feed_url !== undefined) {
    patch.feed_url = validateFeedUrl(body.feed_url);
    patch.etag = null;              // 链接变更后重置条件请求缓存
    patch.last_modified = null;
  }

  const rows = Object.keys(patch).length
    ? await db.update(FEEDS, qs({ id: `eq.${id}`, user_id: `eq.${user.id}` }), patch)
    : await db.select(FEEDS, qs({ select: FEED_SELECT, id: `eq.${id}`, user_id: `eq.${user.id}` }));
  return ok(rows[0], request, env);
}

// DELETE /api/rss/feeds/:id  —— 级联删除条目
export async function deleteFeed(request, env, id) {
  const { db, user } = await requireAdmin(request, env);
  await findFeed(db, user, id);
  await db.remove(FEEDS, qs({ id: `eq.${id}`, user_id: `eq.${user.id}` }));
  return ok({ id }, request, env);
}

// POST /api/rss/feeds/:id/fetch  —— 手动抓取单个订阅源
export async function fetchFeedNow(request, env, id) {
  const { db, user } = await requireAdmin(request, env);
  const feed = await findFeed(db, user, id);
  const result = await syncFeed(db, feed, { env });
  return ok({ feed_id: feed.id, ...result }, request, env);
}

// 判定「僵尸源」的默认天数：源下最新一条文章的发布时间早于这个天数，
// 且源本身也不是 GitHub Trending（那三条天生是「日榜/周榜/月榜」，不能按更新时间删）。
const STALE_DAYS = 30;
// 永远豁免清理的源：GitHub Trending 三榜（用户明确要求「除了 GitHub 的月榜、周榜之外」）。
function isExemptFromStale(feedUrl) {
  return /mshibanami\.github\.io\/GitHubTrendingRSS/i.test(String(feedUrl || ''));
}

// GET /api/rss/stale?days=30 —— 列出「很久没更新」的订阅源（站长用来决定退订）
// POST /api/rss/translate-trending —— 给已存的 GitHub Trending 条目补中文（摘要 + README 正文）
// 用于「历史存量」：新抓取的条目会在 syncFeed 里自动翻译，这个接口处理之前抓下来的英文条目。
export async function translateTrendingNow(request, env) {
  const { db, user } = await requireAdmin(request, env);
  const feeds = await db.select(FEEDS, qs({
    select: 'id,title,feed_url', user_id: `eq.${user.id}`, is_active: 'eq.true'
  }));
  const trending = feeds.filter((f) => isGithubTrendingFeed(f.feed_url));
  let translated = 0;
  let readmeFilled = 0;
  for (const f of trending) {
    try {
      const r = await backfillTrending(env, db, f, 30);
      translated += r.translated || 0;
      readmeFilled += r.readmeFilled || 0;
    } catch { /* 单个源失败不影响其他 */ }
  }
  return ok({ feeds: trending.length, translated, readme_filled: readmeFilled }, request, env);
}

// 返回每个源最新一条文章的发布时间，以及距今天数。前端按天数倒序展示，一键退订。
// 只读、不改库；真正的删除由站长点「退订」走 DELETE /api/rss/feeds/:id。
export async function listStaleFeeds(request, env) {
  const { db, user } = await requireAdmin(request, env);
  const url = new URL(request.url);
  const days = Math.min(Math.max(Number(url.searchParams.get('days')) || STALE_DAYS, 7), 365);
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();

  const feeds = await db.select(FEEDS, qs({
    select: FEED_SELECT, user_id: `eq.${user.id}`, is_active: 'eq.true'
  }));

  // 每个源取最新一条文章的发布时间。逐个源查最新一条（源数量不多，够用且简单）。
  const out = [];
  for (const f of feeds) {
    if (isExemptFromStale(f.feed_url)) continue;   // Trending 三榜豁免
    const latest = await db.select(ARTICLES, qs({
      select: 'published_at,created_at',
      feed_id: `eq.${f.id}`,
      order: 'published_at.desc.nullslast',
      limit: '1'
    }));
    const at = latest[0]?.published_at || latest[0]?.created_at || null;
    // 从没抓到过任何文章的源：以「最后一次抓取时间」为准，同样算僵尸。
    const ref = at || f.last_fetched_at || null;
    if (!ref || ref < cutoff) {
      const ageDays = ref ? Math.floor((Date.now() - new Date(ref).getTime()) / 86400000) : null;
      out.push({
        id: f.id,
        title: f.title,
        feed_url: f.feed_url,
        last_article_at: at,
        last_fetched_at: f.last_fetched_at,
        age_days: ageDays,
        never_fetched: !at
      });
    }
  }
  // 越久没更新越靠前；从没抓到过的排最前。
  out.sort((a, b) => (b.age_days ?? 99999) - (a.age_days ?? 99999));
  return ok({ days, cutoff, count: out.length, feeds: out }, request, env);
}

// POST /api/rss/fetch-all  —— 抓取本人全部活跃订阅源（分批，规避超时）
export async function fetchAllFeeds(request, env) {
  const { db, user } = await requireAdmin(request, env);
  const body = await readJson(request).catch(() => ({}));
  // 一次最多 30 个源，每个 8s 超时、整体 45s 截止（前端给这个接口单独放宽超时）
  const batchSize = Math.min(Number(body?.batch_size) || 10, 30);

  const feeds = await db.select(FEEDS, qs({
    select: 'id,user_id,title,feed_url,site_url,fetch_interval,last_fetched_at,etag,last_modified',
    user_id: `eq.${user.id}`,
    is_active: 'eq.true',
    order: 'last_fetched_at.asc.nullsfirst',
    limit: String(batchSize)
  }));

  const started = Date.now();
  const results = [];
  let newItems = 0;
  for (const feed of feeds) {
    if (Date.now() - started > 45000) break;   // 单次请求 45s 上限
    try {
      const res = await syncFeed(db, feed, { timeoutMs: 8000, env });
      newItems += res.newCount;
      results.push({ feed_id: feed.id, title: feed.title, ...res });
    } catch (err) {
      results.push({ feed_id: feed.id, title: feed.title, error: err.message });
    }
  }
  return ok({ fetched: results.length, new_items: newItems, results }, request, env);
}

// ---------------------------------------------------------------
// 条目
// ---------------------------------------------------------------

// GET /api/rss/articles?feed_id=&unread=true&limit=&offset=
export async function listArticles(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);

  const filters = {
    select: ARTICLE_SELECT,
    user_id: `eq.${user.id}`,
    order: 'published_at.desc.nullslast,created_at.desc'
  };

  // 访客只读「站长公开的源」下的条目：先把公开源 id 查出来再按 feed_id 限定。
  // 这一步不能省 —— 否则站长设为私人的源，其条目仍会出现在访客的列表里。
  let guestFeedIds = null;
  if (user.isGuest) {
    guestFeedIds = await publicFeedIds(db, user);
    if (!guestFeedIds.length) return ok([], request, env);
  }

  const feedId = url.searchParams.get('feed_id');
  if (feedId) {
    const wanted = requireUuid(feedId, 'feed_id');
    // 访客请求一个非公开的源 → 返回空列表（不报 403，避免暴露「这个源存在」）
    if (guestFeedIds && !guestFeedIds.includes(wanted)) return ok([], request, env);
    filters.feed_id = `eq.${wanted}`;
  } else if (guestFeedIds) {
    filters.feed_id = `in.(${guestFeedIds.join(',')})`;
  }

  // 未读是站长的个人状态，访客传 unread 不生效（前端访客改用本机已读记录）
  if (!user.isGuest && url.searchParams.get('unread') === 'true') filters.is_read = 'eq.false';
  filters.limit = String(Math.min(Number(url.searchParams.get('limit')) || 50, 200));
  const offset = Number(url.searchParams.get('offset')) || 0;
  if (offset > 0) filters.offset = String(offset);

  const rows = await db.select(ARTICLES, qs(filters));

  // 附带订阅源标题，便于列表展示
  const feedIds = [...new Set(rows.map((r) => r.feed_id))];
  const feeds = feedIds.length
    ? await db.select(FEEDS, qs({ select: 'id,title,site_url', user_id: `eq.${user.id}`, id: `in.(${feedIds.join(',')})` }))
    : [];
  const feedMap = Object.fromEntries(feeds.map((f) => [f.id, f]));

  return ok(rows.map((r) => ({
    ...r,
    feed_title: feedMap[r.feed_id]?.title || null,
    feed_site_url: feedMap[r.feed_id]?.site_url || null,
    // 访客的「已读」只存在本机（localStorage），后端不返回站长的已读状态
    is_read: user.isGuest ? null : r.is_read
  })), request, env);
}

// PATCH /api/rss/articles/:id  —— 标记已读/未读
// GET /api/rss/articles/:id —— 单条详情（含正文 HTML）
// 列表接口刻意不带 content_html（体积大），阅读器点开时才取这一条。
export async function getArticle(request, env, id) {
  requireUuid(id, 'id');
  const { db, user } = await requireAuth(request, env);
  const rows = await db.select(ARTICLES, qs({
    select: ARTICLE_DETAIL_SELECT, id: `eq.${id}`, user_id: `eq.${user.id}`, limit: '1'
  }));
  const row = rows[0];
  if (!row) throw new HttpError(404, '条目不存在或无权限');

  // 访客：条目所属的源必须是公开源，否则按「不存在」处理
  if (user.isGuest) {
    const feeds = await db.select(FEEDS, qs({
      select: 'id,title,site_url', id: `eq.${row.feed_id}`, user_id: `eq.${user.id}`, is_public: 'eq.true', limit: '1'
    }));
    if (!feeds.length) throw new HttpError(404, '条目不存在或无权限');
    row.feed_title = feeds[0].title || null;
    row.feed_site_url = feeds[0].site_url || null;
    row.is_read = null;   // 访客的已读状态在本机
  }
  return ok(row, request, env);
}

export async function updateArticle(request, env, id) {
  const { db, user } = await requireAdmin(request, env);
  requireUuid(id, 'id');
  const body = await readJson(request);
  if (typeof body.is_read !== 'boolean') throw new HttpError(422, 'is_read 必须为布尔值');

  const rows = await db.update(ARTICLES, qs({ id: `eq.${id}`, user_id: `eq.${user.id}` }), { is_read: body.is_read });
  if (!rows.length) throw new HttpError(404, '条目不存在或无权限');
  return ok(rows[0], request, env);
}

// POST /api/rss/articles/read-all  —— 全部标记已读（可按 feed_id 限定）
export async function markArticlesRead(request, env) {
  const { db, user } = await requireAdmin(request, env);
  const body = await readJson(request).catch(() => ({}));
  const filters = { user_id: `eq.${user.id}`, is_read: 'eq.false' };
  if (body?.feed_id) filters.feed_id = `eq.${requireUuid(body.feed_id, 'feed_id')}`;

  const rows = await db.update(ARTICLES, qs(filters), { is_read: true });
  return ok({ updated: rows.length }, request, env);
}

// ---------------------------------------------------------------
// OPML 导入导出
// ---------------------------------------------------------------

// ---------------------------------------------------------------
// 精选源 / 自动发现（「我懒得一个一个去点订阅」）
// ---------------------------------------------------------------

// GET /api/rss/presets?group=ai —— 预置精选源清单（供前端「导入精选源」用）
export async function getPresets(request, env) {
  const url = new URL(request.url);
  const group = url.searchParams.get('group') || 'all';
  return ok({ groups: PRESET_GROUPS, feeds: listPresets(group) }, request, env);
}

// 从一个普通网页里找 RSS：先看 <link rel="alternate" type="application/rss+xml">，
// 找不到再试几个常见路径（/feed、/rss、/atom.xml…）。
// 站长只要粘站点首页，就能「自己订上」，不用去找 feed 地址。
const COMMON_PATHS = ['/feed', '/rss', '/feed.xml', '/rss.xml', '/atom.xml', '/index.xml', '/feed/'];

async function fetchText(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml,*/*' },
      signal: controller.signal,
      redirect: 'follow'
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function absolutize(href, base) {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

// POST /api/rss/discover  body: { url }  —— 只做发现，不落库
export async function discoverFeed(request, env) {
  await requireAdmin(request, env);
  const body = await readJson(request);
  const raw = requireString(body.url, 'url', { max: 1000 });
  const base = validateFeedUrl(raw);

  const html = await fetchText(base);
  const found = [];

  if (html) {
    // <link rel="alternate" type="application/rss+xml" href="…">
    for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
      const tag = m[0];
      if (!/rel=["']?alternate/i.test(tag)) continue;
      if (!/(application\/(rss|atom)\+xml|application\/xml|text\/xml)/i.test(tag)) continue;
      const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
      const title = tag.match(/title=["']([^"']*)["']/i)?.[1] || null;
      const abs = href ? absolutize(href, base) : null;
      if (abs && !found.some((f) => f.feed_url === abs)) {
        found.push({ feed_url: abs, title: title ? decodeEntitiesLite(title) : null, source: 'html-link' });
      }
    }
    // 有的站把 feed 地址写在 <a href="...rss...">
    if (found.length < 5) {
      for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
        const href = m[1];
        if (!/(\.rss|\.xml|\/feed\/?$|\/rss\/?$|feed\.xml|rss\.xml|atom\.xml)/i.test(href)) continue;
        const abs = absolutize(href, base);
        if (abs && !found.some((f) => f.feed_url === abs)) {
          found.push({ feed_url: abs, title: null, source: 'html-anchor' });
        }
        if (found.length >= 5) break;
      }
    }
  }

  // 兜底：常见路径逐个试（只验头部，不下载整份 feed）
  if (!found.length) {
    for (const path of COMMON_PATHS) {
      const abs = absolutize(path, base);
      if (!abs) continue;
      const head = await fetchText(abs, 6000);
      if (head && /<(rss|feed|rdf:RDF)[\s>]/i.test(head.slice(0, 2000))) {
        found.push({ feed_url: abs, title: null, source: 'common-path' });
        break;
      }
    }
  }

  return ok({ url: base, candidates: found.slice(0, 5) }, request, env);
}

// HTML 实体的小范围解码（发现 feed 标题用，标题里常见 &amp; &#39;）
function decodeEntitiesLite(str = '') {
  return String(str)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

// GET /api/rss/opml  —— 导出订阅源为 OPML
// GET /api/rss/opml  —— 导出订阅源为 OPML
export async function exportOpml(request, env) {
  const { db, user } = await requireAuth(request, env);
  const feeds = await db.select(FEEDS, qs({
    select: 'title,feed_url,site_url', user_id: `eq.${user.id}`, order: 'created_at.asc'
  }));
  const xml = buildOpml(feeds);
  return new Response(xml, {
    status: 200,
    headers: {
      'content-type': 'text/xml; charset=utf-8',
      'content-disposition': 'attachment; filename="knowledge-base-rss.opml"',
      ...corsHeaders(request, env)
    }
  });
}

// POST /api/rss/opml  —— 导入 OPML（body: { opml } 或 { feeds: [{ feed_url, title }] }）
export async function importOpml(request, env) {
  const { db, user } = await requireAdmin(request, env);
  const body = await readJson(request);

  let incoming;
  if (typeof body.opml === 'string') {
    incoming = parseOpml(body.opml);
  } else if (Array.isArray(body.feeds)) {
    incoming = body.feeds
      .map((f) => ({ feedUrl: validateFeedUrl(f.feed_url), title: f.title || '', siteUrl: f.site_url || null }));
  } else {
    throw new HttpError(422, '需提供 opml 字符串或 feeds 数组');
  }
  if (!incoming.length) throw new HttpError(422, '未从 OPML 中解析到任何订阅源');

  // 已存在的订阅源跳过
  const existing = await db.select(FEEDS, qs({ select: 'feed_url', user_id: `eq.${user.id}` }));
  const known = new Set(existing.map((f) => f.feed_url));
  const toCreate = incoming.filter((f) => !known.has(f.feedUrl));

  const imported = [];
  const createdIds = [];
  for (const f of toCreate) {
    const rows = await db.request(FEEDS, {
      method: 'POST',
      body: {
        user_id: user.id,
        title: f.title || null,
        feed_url: f.feedUrl,
        site_url: f.siteUrl || null,
        fetch_interval: 14400,
        is_active: true,
        is_public: true
      },
      prefer: 'return=representation,resolution=ignore-duplicates'
    });
    if (rows[0]) {
      createdIds.push(rows[0].id);
      imported.push({ id: rows[0].id, feed_url: rows[0].feed_url, title: rows[0].title });
    }
  }

  return ok({
    parsed: incoming.length,
    imported: imported.length,
    skipped: incoming.length - imported.length,
    feeds: imported,
    created_ids: createdIds
  }, request, env, 201);
}
