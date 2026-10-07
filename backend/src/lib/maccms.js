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

// 判断是否为可直连播放的媒体地址
export function isPlayableUrl(url = '') {
  return /\.(m3u8|mp4)(\?|#|$)/i.test(url);
}

// 把一条采集记录整理为统一候选结构
export function normalizeVod(raw, source) {
  const routes = parsePlayUrls(raw.vod_play_url).map((eps, i) => ({
    name: String(raw.vod_play_from || '').split('$$$')[i]?.trim() || `线路${i + 1}`,
    episodes: eps
  }));
  // 含直链 m3u8/mp4 的线路排前面
  routes.sort((a, b) => Number(b.episodes.some((e) => isPlayableUrl(e.url)))
    - Number(a.episodes.some((e) => isPlayableUrl(e.url))));

  const first = routes[0];
  const playable = first?.episodes.find((e) => isPlayableUrl(e.url)) || first?.episodes[0] || null;
  const year = String(raw.vod_year || '').trim();

  return {
    source: source.key,
    source_name: source.name,
    platform: 'maccms',
    external_id: String(raw.vod_id ?? ''),
    type_name: raw.type_name || null,
    // 顶层分类 2=连续剧、4=动漫片 视为剧集，其余为电影
    media_type: [2, 4].includes(Number(raw.type_id_1)) ? 'tv' : 'movie',
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
    episode_count: first?.episodes.length || 0,
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
export async function searchMaccms(source, keyword, limit = 20, type = null) {
  const params = { ac: 'videolist', wd: keyword, pg: 1 };
  if (type) params.t = type;
  const url = buildUrl(source.api, params);
  const body = await fetchJson(url);
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

export async function getAnimeClassIds(source) {
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
// 5 个源并发检索，命中率显著高于单源；代价是单次搜索耗时变长（多源均无结果时才等超时）。
export const DEFAULT_VOD_SOURCES = [
  // —— 第一梯队：无防盗链，前端可直接播放（实测 m3u8 探活返回 200）——
  // 顺序即优先级：靠前的源其线路会先进入候选，跨源合并时更容易被保留。
  { key: 'dytt', name: '电影天堂', api: 'https://caiji.dyttzyapi.com/api.php/provide/vod/' },
  { key: 'hongniu', name: '红牛资源', api: 'https://www.hongniuzy2.com/api.php/provide/vod/' },
  // 2026-10-07 实测新增：三个源均命中且直链可播（「庆余年」8/8/3 条，「流浪地球」5/5/3 条）
  { key: 'jszy', name: '极速资源', api: 'https://jszyapi.com/api.php/provide/vod/' },
  { key: 'guangsu', name: '光速资源', api: 'https://api.guangsuapi.com/api.php/provide/vod/' },
  { key: 'ikun', name: '艾坤资源', api: 'https://ikunzyapi.com/api.php/provide/vod/' },
  // —— 第二梯队：有 Referer 白名单防盗链，仅作资源池补充 ——
  // 命中率不低，但直链需后端注入 Referer 才能播（见方案 §7），当前用于「多线路」与元信息补全。
  { key: 'lzi', name: '量子资源', api: 'https://cj.lziapi.com/api.php/provide/vod/' },
  { key: 'ffzy', name: '非凡资源', api: 'https://api.ffzyapi.com/api.php/provide/vod/' },
  // 最大资源：补动漫条目；偶发返回非 JSON，由 fetchJson 容错
  { key: 'zuid', name: '最大资源', api: 'https://api.zuidapi.com/api.php/provide/vod' },
];

// 已移除的源（保留记录，便于以后复查是否恢复）：
//   zy360 360资源 https://360zy.com/api.php/provide/vod/
//     2026-10-07 三次实测均不可用（超时 → HTTP 5xx → 10s 超时），
//     且其单源耗时（13.3s）超过其余 8 个源之和，会把搜索阶段预算直接顶满、
//     把典型搜索耗时从 ~3s 拖到 ~11s。移除后其余源实测均在 2.1s 内返回。

// 读取配置的采集源：优先 env.VOD_SOURCES，否则用默认列表
export function getVodSources(env = {}) {
  const raw = env.VOD_SOURCES;
  if (raw) {
    try {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        return list
          .filter((s) => s && s.key && s.api)
          .map((s) => ({ key: String(s.key), name: String(s.name || s.key), api: String(s.api) }));
      }
    } catch {
      // 解析失败时回退默认源
    }
  }
  return DEFAULT_VOD_SOURCES;
}
