// RSS 订阅模块
// - 订阅源 CRUD（rss_feeds）
// - 条目列表 / 标记已读（rss_articles）
// - 手动抓取（单源 / 全部）与 OPML 导入导出
// - 新条目写入通知中心（type=rss_new）
// 权限：普通用户仅操作自己名下订阅；管理员可 ?all=true 查看全部。
//       写操作（更新/删除/抓取/已读）始终限定本人。

import { ok, readJson, HttpError, corsHeaders } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { requireString, optionalString, optionalInt, optionalBool, requireUuid } from '../lib/validate.js';
import { parseOpml, buildOpml } from '../lib/rss.js';
import { syncFeed } from '../lib/rssSync.js';

const FEEDS = 'rss_feeds';
const ARTICLES = 'rss_articles';

// 读过滤：管理员可 ?all=true 查看全部，其余仅本人
function userFilter(user, all) {
  return user.isAdmin && all ? {} : { user_id: `eq.${user.id}` };
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
async function findFeed(db, userId, id) {
  requireUuid(id, 'id');
  const rows = await db.select(FEEDS, qs({ select: '*', id: `eq.${id}`, user_id: `eq.${userId}` }));
  if (!rows.length) throw new HttpError(404, '订阅源不存在或无权限');
  return rows[0];
}

// 统计各订阅源的未读条目数
async function unreadCounts(db, userId, feedIds) {
  if (!feedIds.length) return {};
  const rows = await db.select(ARTICLES, qs({
    select: 'feed_id',
    user_id: `eq.${userId}`,
    feed_id: `in.(${feedIds.join(',')})`,
    is_read: 'eq.false'
  }));
  return rows.reduce((acc, r) => {
    acc[r.feed_id] = (acc[r.feed_id] || 0) + 1;
    return acc;
  }, {});
}

// ---------------------------------------------------------------
// 订阅源
// ---------------------------------------------------------------

// GET /api/rss/feeds
export async function listFeeds(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === 'true';

  const filters = { select: '*', ...userFilter(user, all), order: 'created_at.desc' };
  const categoryId = url.searchParams.get('category_id');
  if (categoryId) filters.category_id = `eq.${categoryId}`;

  const feeds = await db.select(FEEDS, qs(filters));
  const counts = await unreadCounts(db, user.id, feeds.filter((f) => f.user_id === user.id).map((f) => f.id));
  return ok(feeds.map((f) => ({ ...f, unread_count: counts[f.id] || 0 })), request, env);
}

// GET /api/rss/feeds/:id
export async function getFeed(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  const feed = await findFeed(db, user.id, id);
  const counts = await unreadCounts(db, user.id, [feed.id]);
  return ok({ ...feed, unread_count: counts[feed.id] || 0 }, request, env);
}

// POST /api/rss/feeds  —— 新增订阅源（best-effort 立即抓取一次）
export async function createFeed(request, env) {
  const { db, user } = await requireAuth(request, env);
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
      fetch_interval: optionalInt(body.fetch_interval, 'fetch_interval', { min: 300, max: 86400 }) ?? 3600,
      is_active: optionalBool(body.is_active, 'is_active') ?? true
    },
    prefer: 'return=representation,resolution=merge-duplicates'
  });
  const feed = rows[0];

  // 立即抓取一次，补全标题并导入条目（失败不影响创建）
  let sync = null;
  if (optionalBool(body.fetch_now, 'fetch_now') !== false) {
    try {
      const fresh = await db.select(FEEDS, qs({ select: '*', id: `eq.${feed.id}` }));
      sync = await syncFeed(db, fresh[0]);
    } catch (err) {
      sync = { error: err.message };
    }
  }

  const latest = await db.select(FEEDS, qs({ select: '*', id: `eq.${feed.id}` }));
  return ok({ ...latest[0], sync }, request, env, 201);
}

// PATCH /api/rss/feeds/:id
export async function updateFeed(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  await findFeed(db, user.id, id);
  const body = await readJson(request);

  const patch = {};
  if (body.title !== undefined) patch.title = optionalString(body.title, 'title', { max: 300 }) ?? null;
  if (body.site_url !== undefined) patch.site_url = optionalString(body.site_url, 'site_url', { max: 1000 }) ?? null;
  if (body.fetch_interval !== undefined) {
    patch.fetch_interval = optionalInt(body.fetch_interval, 'fetch_interval', { min: 300, max: 86400 });
  }
  if (body.is_active !== undefined) patch.is_active = optionalBool(body.is_active, 'is_active');
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
    : await db.select(FEEDS, qs({ select: '*', id: `eq.${id}`, user_id: `eq.${user.id}` }));
  return ok(rows[0], request, env);
}

// DELETE /api/rss/feeds/:id  —— 级联删除条目
export async function deleteFeed(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  await findFeed(db, user.id, id);
  await db.remove(FEEDS, qs({ id: `eq.${id}`, user_id: `eq.${user.id}` }));
  return ok({ id }, request, env);
}

// POST /api/rss/feeds/:id/fetch  —— 手动抓取单个订阅源
export async function fetchFeedNow(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  const feed = await findFeed(db, user.id, id);
  const result = await syncFeed(db, feed);
  return ok({ feed_id: feed.id, ...result }, request, env);
}

// POST /api/rss/fetch-all  —— 抓取本人全部活跃订阅源（分批，规避超时）
export async function fetchAllFeeds(request, env) {
  const { db, user } = await requireAuth(request, env);
  const body = await readJson(request).catch(() => ({}));
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
    if (Date.now() - started > 20000) break;   // 单次请求 20s 上限
    try {
      const res = await syncFeed(db, feed, { timeoutMs: 8000 });
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
  const all = url.searchParams.get('all') === 'true';

  const filters = { select: '*', ...userFilter(user, all), order: 'published_at.desc.nullslast,created_at.desc' };
  const feedId = url.searchParams.get('feed_id');
  if (feedId) filters.feed_id = `eq.${requireUuid(feedId, 'feed_id')}`;
  if (url.searchParams.get('unread') === 'true') filters.is_read = 'eq.false';
  filters.limit = String(Math.min(Number(url.searchParams.get('limit')) || 50, 200));
  const offset = Number(url.searchParams.get('offset')) || 0;
  if (offset > 0) filters.offset = String(offset);

  const rows = await db.select(ARTICLES, qs(filters));

  // 附带订阅源标题，便于列表展示
  const feedIds = [...new Set(rows.map((r) => r.feed_id))];
  const feeds = feedIds.length
    ? await db.select(FEEDS, qs({ select: 'id,title,site_url', id: `in.(${feedIds.join(',')})` }))
    : [];
  const feedMap = Object.fromEntries(feeds.map((f) => [f.id, f]));

  return ok(rows.map((r) => ({
    ...r,
    feed_title: feedMap[r.feed_id]?.title || null,
    feed_site_url: feedMap[r.feed_id]?.site_url || null
  })), request, env);
}

// PATCH /api/rss/articles/:id  —— 标记已读/未读
export async function updateArticle(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');
  const body = await readJson(request);
  if (typeof body.is_read !== 'boolean') throw new HttpError(422, 'is_read 必须为布尔值');

  const rows = await db.update(ARTICLES, qs({ id: `eq.${id}`, user_id: `eq.${user.id}` }), { is_read: body.is_read });
  if (!rows.length) throw new HttpError(404, '条目不存在或无权限');
  return ok(rows[0], request, env);
}

// POST /api/rss/articles/read-all  —— 全部标记已读（可按 feed_id 限定）
export async function markArticlesRead(request, env) {
  const { db, user } = await requireAuth(request, env);
  const body = await readJson(request).catch(() => ({}));
  const filters = { user_id: `eq.${user.id}`, is_read: 'eq.false' };
  if (body?.feed_id) filters.feed_id = `eq.${requireUuid(body.feed_id, 'feed_id')}`;

  const rows = await db.update(ARTICLES, qs(filters), { is_read: true });
  return ok({ updated: rows.length }, request, env);
}

// ---------------------------------------------------------------
// OPML 导入导出
// ---------------------------------------------------------------

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
  const { db, user } = await requireAuth(request, env);
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
        fetch_interval: 3600,
        is_active: true
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
