// 苹果CMS（maccms v10）采集接口适配器
// 网上绝大多数免费影视站基于苹果CMS搭建，统一提供 /api.php/provide/vod/ 接口：
//   ac=videolist  列表/搜索（wd=关键词、pg=页码、h=最近N小时、t=类型ID）
//   ac=detail     详情（ids=资源ID），返回 vod_play_from / vod_play_url 多线路多集
// 仅抓取元信息与播放地址字符串，不下载视频文件、后端不转发视频流。

import { HttpError } from './response.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// 采集接口请求默认 Referer 需为源站自身，否则易被防盗链拒绝
function buildUrl(api, params) {
  const sep = api.includes('?') ? '&' : '?';
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${api}${sep}${qs}`;
}

async function fetchJson(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, Referer: url.split('/api.php')[0] + '/', Accept: 'application/json' }
    });
    if (!res.ok) throw new HttpError(502, `采集接口请求失败 (${res.status})`);
    return await res.json();
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err.name === 'AbortError') throw new HttpError(504, `采集接口请求超时（${timeoutMs}ms）`);
    throw new HttpError(502, `采集接口请求失败：${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

// 清理简介中的 HTML 标签
function stripHtml(html = '') {
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// —— 内容过滤：只要「电影 / 电视剧」正片 ——
// 苹果CMS 的 type_id_1 是可靠的顶层分类：
//   1=电影片 2=连续剧 3=综艺片 4=动漫片 35=电影解说 36=体育 42=新闻资讯 45=预告片 46=短剧 52=AI漫剧
// 用 type_id_1 判断可避免「喜剧片 / 剧情片」因含「剧」字被误判为剧集。
const FEATURE_ROOT_TYPES = new Set([1, 2]);
const ANIME_ROOT_TYPES = new Set([4]);
const EXCLUDE_TITLE_RE = /(\[电影解说\]|\[解说\]|\[预告片\]|电影解说|预告片|片花|花絮|动态漫画|动态漫|短剧|微短剧|爽剧|AI漫剧|有声)/;
// 类型名同样要过滤：部分源把短剧/AI漫剧挂在「连续剧」根类目下，只靠 type_id_1 分不出来
const EXCLUDE_TYPE_RE = /(短剧|微短剧|爽剧|漫剧|综艺|体育|新闻|资讯|解说|预告|片花|花絮|有声)/;

export function isFeatureContent(raw = {}, { allowAnime = false } = {}) {
  const title = String(raw.vod_name || '').trim();
  if (EXCLUDE_TITLE_RE.test(title)) return false;
  const typeLabel = String(raw.type_name || '').trim();
  if (typeLabel && EXCLUDE_TYPE_RE.test(typeLabel)) return false;
  const root = Number(raw.type_id_1);
  if (Number.isFinite(root) && root > 0) {
    if (FEATURE_ROOT_TYPES.has(root)) return true;
    if (allowAnime && ANIME_ROOT_TYPES.has(root)) return true;
    return false;
  }
  // 缺 type_id_1 时退回名称判断
  const typeName = String(raw.type_name || '').trim();
  if (!typeName) return true;
  return /(电影|片|剧)/.test(typeName) || (allowAnime && /(动漫|动画)/.test(typeName));
}

// 标题相关度：0 最好，数字越大越靠后。
// 只按「是否以关键词开头」排是不够的：搜「庆余年」时，正片「庆余年第二季」和
// 衍生短剧「庆余年之风起沧州」都算「以关键词开头」，同分之下源站顺序会把短剧排在正片前面。
// 这里把「关键词 + 第N季/部/集」单列一档，再由调用方按标题长度升序（正片名更短）兜底，
// 正片就能稳定排在衍生剧 / 外传之前。
export function titleRelevance(title, keyword) {
  const t = String(title || '').replace(/\s/g, '');
  const k = String(keyword || '').replace(/\s/g, '');
  if (!k) return 5;
  if (t === k) return 0;
  if (t.startsWith(k)) {
    const rest = t.slice(k.length);
    if (/^第[一二三四五六七八九十0-9]{1,3}[季部集]/.test(rest)) return 1;  // 庆余年第二季
    if (/^[（(]?\d{4}/.test(rest)) return 2;                              // 庆余年(2024)
    return 3;
  }
  if (t.includes(k)) return 4;
  return 5;
}

// 解析 vod_play_url："线路内 集名$地址#集名$地址"，多线路以 $$$ 分隔
export function parsePlayUrls(raw = '') {
  const groups = String(raw).split('$$$');
  return groups
    .map((g) => g.split('#').map((seg) => {
      const idx = seg.lastIndexOf('$');
      if (idx < 0) return null;
      const name = seg.slice(0, idx).trim() || '正片';
      const url = seg.slice(idx + 1).trim();
      return url ? { name, url } : null;
    }).filter(Boolean))
    .filter((eps) => eps.length);
}

// —— 电影 / 剧集分类 ——
// 顶层分类 id 各源不统一：多数源 2=剧集 4=动漫，但 jyzy/hhzy 是 1=电视剧 2=电影 17=动漫、
// subo 是 3=动漫（2026-10-07 逐源实测 ac=list）。按 [2,4] 一刀切会把这些源的
// 剧集错标成电影、电影错标成剧集。因此先看叶子类目名（各源命名趋同：
//「内地剧 / 中国动漫 / 剧情片」），名字看不出来再回退 type_id_1。
const TV_NAME_RE = /(剧$|电视剧|连续剧|短剧|动漫|动画)/;
const ANIME_MOVIE_NAME_RE = /(动漫电影|动画电影|剧场版)/;
const MOVIE_NAME_RE = /(电影|片$)/;
export function mediaTypeOf(raw) {
  const n = String(raw.type_name || '');
  if (n) {
    if (ANIME_MOVIE_NAME_RE.test(n)) return 'movie';   // 动漫电影 / 剧场版是电影
    if (TV_NAME_RE.test(n)) return 'tv';
    if (MOVIE_NAME_RE.test(n)) return 'movie';
  }
  return [2, 4].includes(Number(raw.type_id_1)) ? 'tv' : 'movie';
}

// 判断是否为可直连播放的媒体地址
export function isPlayableUrl(url = '') {
  return /\.(m3u8|mp4)(\?|#|$)/i.test(url);
}

// —— 网页播放页 → 直链（2026-10-11 修复「只有 360 能播」）——
//
// 背景：光速 / 速播 / 豪华 三个源在 vod_play_url 里给的不是 m3u8，而是**网页播放页**
// （形如 https://v.gsuus.com/play/kazVzrma）。旧逻辑按 isPlayableUrl 把它们当「非直链」过滤掉，
// 结果这三个源在详情页永远显示「暂无播放地址」，用户只看到 360 / 魔都（它们直接给 m3u8）。
//
// 实测规律（2026-10-11，三个源 × 多部片）：这些网页播放页的 HLS 播放列表固定在
// `<播放页>/index.m3u8`，而且返回的是标准 master playlist（含变体地址），
// 变体地址再解析就能拿到真正的 .ts 分片（分片在 999 / 9999 / 65 等非标准端口，必须走 /api/vod/proxy）。
// 因此这里把「无后缀的播放页」归一成 `<原地址>/index.m3u8`，让它重新变成可播直链。
// 不做网络探测：归一化是**纯字符串操作**，真正能否播仍由播放器（先直连、失败切代理）决定。
//
// 只认两类形态，避免误伤：
//   1) 路径含 /play/<id>（各源通用形态）；
//   2) 完全无后缀的 http(s) 地址（如 https://host/abc123，且不含 query）。
// 已经带 .m3u8 / .mp4 的地址原样返回；明显是其它网页（.html / .php / 分享页 /share/）不动。
const WEB_PLAY_PATH_RE = /\/play\/[A-Za-z0-9_-]+\/?$/;
// 明显是网页/分享页的路径段：即使无后缀也**不能**当成播放页归一（否则 /share/xxx 会变成假直链）
const NON_PLAY_PATH_RE = /\/(share|vodplay|voddetail|detail|download|subject|vodlist)\//i;
export function toPlayableUrl(url = '') {
  const raw = String(url).trim();
  if (!raw) return '';
  if (isPlayableUrl(raw)) return raw;
  let u;
  try { u = new URL(raw); } catch { return ''; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
  const path = u.pathname.replace(/\/+$/, '');
  // 网页播放页：/<...>/play/<id>（末尾可有斜杠）
  if (WEB_PLAY_PATH_RE.test(path)) return `${u.origin}${path}/index.m3u8`;
  // 无后缀、无 query 的裸路径：按播放页处理（这类地址交给 <video> 也没意义，归一化只有好处）
  if (!NON_PLAY_PATH_RE.test(path) && !/\.[a-z0-9]{2,5}$/i.test(path) && !u.search) {
    return `${u.origin}${path}/index.m3u8`;
  }
  return '';
}

// 把一条采集记录整理为统一候选结构
//
// 2026-10-10：**过滤非直链线路与剧集**。
// 采集源的 vod_play_url 里同时混着可直接播放的 m3u8/mp4 和网页地址
// （分享页 /share/<hash>、网页播放页 /play/<id>、云播页）。后者交给 <video> 必然
// 报「片源无法解析」，此前它们被原样写进 routes 并在详情页列出来，用户点到就是失败。
// 因此这里按 isPlayableUrl 只保留真正能播的剧集；若某条线路一个直链都没有就整条丢弃。
// 兜底：万一全部线路都没有直链（源站格式异常），保留原始线路**仅作诊断**，
// 并打上 diagnostic 标记。此时 playable_url 必为 null，前端按标记/直链判定后
// 只会显示空态与「重新匹配片源」，**绝不把网页地址当播放地址**。
export function normalizeVod(raw, source) {
  // 先做「网页播放页 → 直链」归一（见 toPlayableUrl 注释）：光速 / 速播 / 豪华 给的是
  // 播放页地址，不归一就会被下面的 isPlayableUrl 过滤掉，导致这三个源详情页永远空。
  // 保留 original_url 便于排查上游到底给的是什么。
  const parsedRoutes = parsePlayUrls(raw.vod_play_url).map((eps) => eps.map((e) => {
    const direct = toPlayableUrl(e.url);
    return direct && direct !== e.url
      ? { name: e.name, url: direct, original_url: e.url }
      : e;
  }));

  const rawRoutes = parsedRoutes.map((eps, i) => ({
    name: String(raw.vod_play_from || '').split('$$$')[i]?.trim() || `线路${i + 1}`,
    episodes: eps
  }));

  const directRoutes = rawRoutes
    .map((r) => ({ name: r.name, episodes: r.episodes.filter((e) => isPlayableUrl(e.url)) }))
    .filter((r) => r.episodes.length);
  // 有直链就只用直链；一条都没有时保留原始线路作诊断（打标记，前端不得展示为可播）。
  const hasDirect = directRoutes.length > 0;
  const routes = hasDirect
    ? directRoutes
    : rawRoutes.map((r) => ({ ...r, diagnostic: true }));

  // 含直链 m3u8/mp4 的线路排前面
  routes.sort((a, b) => Number(b.episodes.some((e) => isPlayableUrl(e.url)))
    - Number(a.episodes.some((e) => isPlayableUrl(e.url))));

  const first = routes[0];
  // playable_url 只认直链：兜底保留的原始线路里可能全是网页地址，
  // 这时必须给 null（前端据此提示「暂无播放地址」），绝不能把网页地址当播放地址。
  const playable = first?.episodes.find((e) => isPlayableUrl(e.url)) || null;
  // 集数只统计真正的直链剧集：兜底线路里混着网页地址，不能算作「集」。
  const directEpisodeCount = routes.reduce(
    (n, r) => n + r.episodes.filter((e) => isPlayableUrl(e.url)).length, 0);
  const year = String(raw.vod_year || '').trim();

  return {
    source: source.key,
    source_name: source.name,
    platform: 'maccms',
    external_id: String(raw.vod_id ?? ''),
    type_name: raw.type_name || null,
    media_type: mediaTypeOf(raw),
    title: raw.vod_name || '(无标题)',
    original_title: null,
    overview: stripHtml(raw.vod_content) || null,
    poster_url: raw.vod_pic || null,
    backdrop_url: null,
    release_date: /^\d{4}$/.test(year) ? `${year}-01-01` : null,
    runtime: null,
    rating: raw.vod_score ? Number(raw.vod_score) || null : null,
    genres: raw.type_name || null,
    area: raw.vod_area || null,
    remarks: raw.vod_remarks || null,
    director: raw.vod_director || null,
    cast_list: raw.vod_actor || null,
    episode_count: directEpisodeCount,
    // 外部详情页：源站无稳定详情页，统一指向采集接口
    page_url: null,
    // 可直接播放的地址（m3u8/mp4），以及全部线路供详情页选集
    playable_url: playable?.url || null,
    routes
  };
}

// 只保留电影/剧集正片的候选
function filterFeature(list, opts) {
  return list.filter((c) => isFeatureContent({ type_name: c.type_name, vod_name: c.title }, opts));
}

// 搜索：返回候选列表（不落库）
// type 为可选的分类 ID（如 29=国产动漫、30=日韩动漫）：
// 动漫类资源在全局搜索里几乎被淹没，限定分类后命中率显著提高。
export async function searchMaccms(source, keyword, limit = 20, type = null, timeoutMs = 10000) {
  const params = { ac: 'videolist', wd: keyword, pg: 1 };
  if (type) params.t = type;
  const url = buildUrl(source.api, params);
  // timeoutMs 由调用方按阶段给：动漫类目搜索是一次「锦上添花」的补充，
  // 个别源（实测量子资源）会挂满 10s，给它 2.5s 就够 —— 超时即放弃，不拖累整批。
  const body = await fetchJson(url, timeoutMs);
  const list = Array.isArray(body.list) ? body.list : [];
  const items = list.map((raw) => normalizeVod(raw, source));
  return filterFeature(items, { allowAnime: !!type }).slice(0, limit);
}

// 精选片单：按「电影片/连续剧」下的子类型取各分类热门条目，过滤非影视内容与老片。
// 采集源普遍不提供播放量，故以「评分 + 年份」排序，并限制近十年，保证首页有质量。
const CURATED_TYPES = [
  { t: 6, media: 'movie' },   // 动作片
  { t: 9, media: 'movie' },   // 科幻片
  { t: 11, media: 'movie' },  // 剧情片
  { t: 7, media: 'movie' },   // 喜剧片
  { t: 13, media: 'tv' },     // 国产剧
  { t: 16, media: 'tv' }      // 欧美剧
];

export async function curatedMaccms(source, limit = 12, minYear = 2023) {
  const settled = await Promise.allSettled(
    CURATED_TYPES.map((c) => fetchJson(buildUrl(source.api, { ac: 'videolist', t: c.t, pg: 1 })))
  );
  const out = [];
  const seen = new Set();
  for (let i = 0; i < settled.length; i++) {
    const res = settled[i];
    if (res.status !== 'fulfilled') continue;
    const list = Array.isArray(res.value.list) ? res.value.list : [];
    for (const raw of list) {
      const c = normalizeVod(raw, source);
      if (!isFeatureContent(raw)) continue;
      const year = Number(String(raw.vod_year || '').slice(0, 4)) || 0;
      if (year && year < minYear) continue;
      if (!c.playable_url) continue;
      const key = c.title.replace(/\s/g, '');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...c, _year: year, _score: Number(c.rating) || 0 });
    }
  }
  out.sort((a, b) => (b._score - a._score) || (b._year - a._year));
  return out.slice(0, limit).map(({ _year, _score, ...c }) => c);
}

// 详情：按资源 ID 取完整线路与剧集
export async function detailMaccms(source, id) {
  const url = buildUrl(source.api, { ac: 'detail', ids: id });
  const body = await fetchJson(url);
  const raw = (Array.isArray(body.list) ? body.list : [])[0];
  if (!raw) throw new HttpError(404, '未找到该资源');
  return normalizeVod(raw, source);
}

// 健康检查：用于设置页展示各采集源可用性
export async function checkMaccms(source) {
  const start = Date.now();
  try {
    const url = buildUrl(source.api, { ac: 'videolist', wd: '测试', pg: 1 });
    await fetchJson(url, 6000);
    return { key: source.key, name: source.name, ok: true, latency_ms: Date.now() - start };
  } catch (err) {
    return { key: source.key, name: source.name, ok: false, latency_ms: Date.now() - start, error: err.message };
  }
}

// —— 动漫类目发现 ——
// 动漫条目在各源的**关键词搜索**里命中很差（片名带季数后缀，或被同名真人剧/短剧挤掉），
// 但按动漫类目搜索（ac=videolist&wd=关键词&t=类目ID）就能正常命中。
// 各源的类目 ID 并不统一（lzi/ffzy/dytt/zuid 是 29=国产动漫，zy360 是 38=国产动漫、40=日韩动漫），
// 因此通过 ac=list 返回的 class 列表按**名称**发现，并做进程内缓存（源站类目极少变动）。
const ANIME_CLASS_RE = /^(国产|日韩|欧美)动漫$/;
const CLASS_CACHE_TTL = 60 * 60 * 1000;
const classCache = new Map(); // source.key -> { ids: number[], at: number }

// —— 动漫类目 ID 硬编码表（2026-10-07 实测，由 ac=list 返回的类目名称反查得到）——
// 为什么硬编码：ac=list 是一次「只为拿类目 ID」的额外往返，12 个源要 0.2~2.0s，
// 且换 isolate 冷启动时必然重来一遍。这些 ID 极少变动，实测一次固化下来之后，
// 动漫类目搜索就能与关键词搜索**同时**发起，整段串行等待消失。
// 表里没有的源（例如用 VOD_SOURCES 自定义的源）仍走下面的 ac=list 动态发现。
//   ikun 固定为空数组：它没有以「国产/日韩/欧美动漫」命名的类目（实测 ac=list 无匹配），
//   记录成空数组是为了与「表里没这个源」区分开，避免每次都去网络上白跑一趟。
const ANIME_CLASS_IDS = {
  dytt: [29, 30, 31],
  hongniu: [38],
  jszy: [26],
  guangsu: [43],
  ikun: [],
  lzi: [29, 30, 31],
  ffzy: [29, 30, 31],
  zuid: [29, 30, 31],
  jyzy: [24, 25, 26],   // 实测：24=中国动漫 25=日本动漫 26=欧美动漫（2026-10-07 ac=list）
  hhzy: [24, 25, 26],   // 同上（hhzy 与 jyzy 同族分类树）
  subo: [24, 25, 26],   // 同上
  zy360new: [38, 39, 40],
  // 2026-10-10 实测 ac=list：360zy.com 的 38=国产动漫 39=欧美动漫 40=日韩动漫（与 zy360new 同族）
  '360zy': [38, 39, 40]
};

// 同步取类目 ID：命中硬编码表返回数组（可能为空数组），未知源返回 null。
// 调用方据此判断是否需要发起网络发现 —— 默认 12 个源全部命中，零往返。
export function getAnimeClassIdsSync(source) {
  if (!Object.prototype.hasOwnProperty.call(ANIME_CLASS_IDS, source.key)) return null;
  return ANIME_CLASS_IDS[source.key];
}

export async function getAnimeClassIds(source) {
  const hard = getAnimeClassIdsSync(source);
  if (hard) return hard;
  const hit = classCache.get(source.key);
  if (hit && Date.now() - hit.at < CLASS_CACHE_TTL) return hit.ids;
  let ids = [];
  try {
    const body = await fetchJson(buildUrl(source.api, { ac: 'list' }), 8000);
    ids = (Array.isArray(body?.class) ? body.class : [])
      .filter((c) => ANIME_CLASS_RE.test(String(c.type_name || '').trim()))
      .map((c) => Number(c.type_id))
      .filter(Number.isFinite);
  } catch {
    ids = []; // 源站不可用时按「无动漫类目」处理，不影响普通搜索
  }
  classCache.set(source.key, { ids, at: Date.now() });
  return ids;
}

// 默认采集源（可用环境变量 VOD_SOURCES 覆盖，格式为 JSON 数组）
// 多源并发检索，命中率显著高于单源；代价是单次搜索耗时变长（多源均无结果时才等超时）。
//
// ⚠ 排序口径（2026-10-12 用户明确要求）：
//   「先选有效的，再选低延迟的 —— 直接没效果的（点了播不了的）就不要放进来。」
//   因此下面的顺序 = **实测能端到端播通** 为前提，组内再按响应快慢排。
//   验证口径（每一步都真的拉一次网络，任一步失败即判不可用）：
//     搜索接口 → 首条结果的 m3u8 主清单 → 变体清单 → 首个 .ts 分片返回 206/200。
//   「搜索能用但片源 403/404」的源一律不收 —— 用户懒得看「因为某某原因播不了」。
export const DEFAULT_VOD_SOURCES = [
  // —— 第一档：2026-10-12 复测「搜索 + 取流都可用，且响应快」——
  { key: 'subo', name: '速播资源', api: 'https://subocaiji.com/api.php/provide/vod/' },           // 搜索~3.2s 片源~0.5s
  { key: 'hhzy', name: '豪华资源', api: 'https://hhzyapi.com/api.php/provide/vod/' },             // 搜索~3.8s 片源~0.5s
  // 旧项目（E:\AI Agent测试\...\项目开发\影音助手）里当时可用的三条源，
  // 2026-10-12 复测：搜索 + m3u8 + 首个 ts 分片全部 206，且搜索明显比现用源快。
  { key: 'ffzy', name: '非凡资源', api: 'https://api.ffzyapi.com/api.php/provide/vod/' },          // 搜索~0.9s 片源可用
  { key: 'dytt', name: '电影天堂', api: 'https://caiji.dyttzyapi.com/api.php/provide/vod/' },      // 搜索~0.7s 片源可用
  { key: 'lzi', name: '量子资源', api: 'https://cj.lziapi.com/api.php/provide/vod/' },             // 搜索~1.1s 片源可用
  { key: '360zy', name: '360资源', api: 'https://360zy.com/api.php/provide/vod/' },               // 搜索~1.7s 片源可用
  { key: 'zy360new', name: '360资源(备用)', api: 'https://360zyzz.com/api.php/provide/vod/' },     // 搜索~3.6s 片源可用
  // —— 第二档：可用但明显偏慢，排在后面（用户要「低延迟优先」）——
  { key: 'guangsu', name: '光速资源', api: 'https://api.guangsuapi.com/api.php/provide/vod/' },    // 搜索~10s，压线
];
// 2026-10-12 移除（用户要求「直接没效果的不要测、不要放」）：
//   片源 403/404（防盗链/链接失效，点进去播不了）：jszy 极速、zuid 最大、wujin、bfzy、
//     hongniu 红牛、jyzy 金鹰、kuyun、tiankong、tyyszy、heimuer、mahua、cjtv、ffzy5
//   实测连不上 / 超时：ikun 艾坤（fetch failed）、mdzy 魔都（超时）
//   —— 上面这些都不再放进默认源列表，避免「搜索有结果但点了播不了」。
//
// 2026-10-09 历史记录（详见 docs/removed-features.md）：
//   片源 403（防盗链/地区限制，点进去播不了）：dytt 电影天堂、jszy 极速、ffzy 非凡、zuid 最大
//   片源 404（链接失效）：lzi 量子
//   能播但太慢：hongniu 红牛（片源 2.6s，且 1/5 超时）、jyzy 金鹰（片源 6.2s）
//   文档候选未采用：wujin/bdzy（403）、bfzy（404）、heimuer/tyyszy/wolong/yinghua（搜索接口坏）
//   ⚠ dytt / ffzy / lzi 这三条在 2026-10-09 判为不可用，2026-10-12 复测已恢复并重新收录。
//
// 2026-10-10 复测（5 部片 × 端到端：搜索 → 详情 → master → 变体 → 首个 ts 分片）：
//   ruyi 如意资源（https://cj.rycjapi.com/api.php/provide/vod/）——**不采用**。
//     搜索与详情均可用，但 5 部片里有 2 部（复仇者联盟4 / 流浪地球2）**首条结果无 m3u8 直链**，
//     命中率只有 3/5，不满足「5/5 才收录」的标准；等后续复测稳定再评估。
//   仍不可用（保持移除）：lzi/ffzy/dytt/zuid/wujin/bfzy/jszy/hongniu/jyzy/dbzy/wolong/kuyun/
//     tiankong/tyyszy/heimuer/mahua/cjtv/ffzy5 —— 搜索多数能用，但片源 403/404，点进去播不了。

// 已移除的源（保留记录，便于以后复查是否恢复）：
//   zy360 360资源 https://360zy.com/api.php/provide/vod/
//     2026-10-07 三次实测均不可用（超时 → HTTP 5xx → 10s 超时），
//     且其单源耗时（13.3s）超过其余 8 个源之和，会把搜索阶段预算直接顶满、
//     把典型搜索耗时从 ~3s 拖到 ~11s。移除后其余源实测均在 2.1s 内返回。
//     2026-10-10 复测已恢复（见上方 360zy 条目）：搜索/详情/片源均正常，耗时回到 ~1.3s。

// ---------------------------------------------------------------
// 读取采集源（2026-10-12 起改为「动态源优先」）
// ---------------------------------------------------------------
//
// 优先级：env.VOD_SOURCES（管理员手动指定）> 动态源（R2，每日定时刷新）
//         > DEFAULT_VOD_SOURCES（内置兜底）
//
// 动态源由 lib/dynamicSources.js 从 LunaTV-config 订阅拉取 + 四步探测筛选后写入 R2。
// 这里做**isolate 级内存缓存**：同一个 Worker 实例内 5 分钟内只读一次 R2，
// 避免每次搜索都打一次 R2（R2 读虽便宜，但没必要）。
//
// 兼容性：getVodSources 保持同步（6 处老调用点不用改签名）；
// 异步路径请改用 ensureVodSources(env)，它会在需要时把动态源装进缓存。
let dynamicSourceCache = null;   // { sources, at }
const DYNAMIC_SOURCE_TTL_MS = 5 * 60 * 1000;

function normalizeSourceList(list) {
  return (Array.isArray(list) ? list : [])
    .filter((s) => s && s.key && s.api)
    .map((s) => ({
      key: String(s.key),
      name: String(s.name || s.key),
      api: String(s.api),
      ...(s.detail ? { detail: String(s.detail) } : {})
    }));
}

function sourcesFromEnv(env) {
  const raw = env?.VOD_SOURCES;
  if (!raw) return null;
  try {
    const list = JSON.parse(raw);
    const normalized = normalizeSourceList(list);
    return normalized.length ? normalized : null;
  } catch {
    return null;   // 解析失败时回退
  }
}

/**
 * 取当前生效的采集源（异步，会按需装载动态源）。
 * 所有异步调用点都应该用这个。
 */
export async function ensureVodSources(env = {}) {
  // 1) 管理员手动指定优先
  const fromEnv = sourcesFromEnv(env);
  if (fromEnv) return fromEnv;

  // 2) 内存缓存命中
  if (dynamicSourceCache && Date.now() - dynamicSourceCache.at < DYNAMIC_SOURCE_TTL_MS) {
    return dynamicSourceCache.sources;
  }

  // 3) 读 R2 里的动态源
  try {
    const { getDynamicSources } = await import('./dynamicSources.js');
    const dyn = await getDynamicSources(env);
    const normalized = normalizeSourceList(dyn);
    if (normalized.length) {
      dynamicSourceCache = { sources: normalized, at: Date.now() };
      return normalized;
    }
  } catch (err) {
    console.error('[maccms] 装载动态源失败，回退内置源:', err?.message || err);
  }

  // 4) 兜底：内置源（动态源尚未探测出结果时，站点仍可用）
  return DEFAULT_VOD_SOURCES;
}

/** 清空动态源缓存（管理员手动刷新后用）。 */
export function resetVodSourceCache() {
  dynamicSourceCache = null;
}

/**
 * 同步取源（兼容老调用点）。只读内存缓存 / env / 内置默认，
 * **不会**触发 R2 读取；首次请求若缓存为空会先返回内置源，
 * 由并行的 ensureVodSources 在后续请求补上动态源。
 */
export function getVodSources(env = {}) {
  const fromEnv = sourcesFromEnv(env);
  if (fromEnv) return fromEnv;
  if (dynamicSourceCache) return dynamicSourceCache.sources;
  return DEFAULT_VOD_SOURCES;
}
