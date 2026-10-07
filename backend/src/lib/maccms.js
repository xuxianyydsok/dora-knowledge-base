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
  jyzy: [26],
  hhzy: [26],
  subo: [26],
  zy360new: [38, 39, 40]
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
  // —— 2026-10-07 二次扩容：候选源实测后新增 4 个（均通过 m3u8 拉流探活）——
  //   jyzy  金鹰资源  关键词搜索 65~177ms，是全部源里最快的；探活 HTTP 206
  //   hhzy  豪华资源  139~232ms；探活 HTTP 200 application/vnd.apple.mpegurl
  //   subo  速播资源  179~267ms；探活 HTTP 200
  //   zy360new 360资源 1.1~1.5s，但目录最深：「凡人修仙传」11 条，其余源多为 3~5 条
  // 说明：guangsu / hhzy / subo / jyzy 的上游片库高度重合（同一部剧的片名列表一致），
  // 但它们各自挂不同 CDN（gsm3u8 / hhm3u8 / subm3u8 / jinyingm3u8），
  // 多一条线路就多一次「这条播不了换下一条」的机会，因此保留。
  // 已剔除的候选：wolong / sdzy / aosika（返回非 JSON）、tianwei（3.6~5.4s 过慢）、
  //   jkun（仅 2 条）、hn2（与 hongniu 同库）、bdzy / wujin（直链 403）、
  //   mozhua / tyys / p210 / ky / xpzy / mtzy / sszy / tiankong / yhm3u8 / hhzy2 /
  //   libvio / heimuer（域名不可达或返回空）。
  { key: 'jyzy', name: '金鹰资源', api: 'http://jyzyapi.com/provide/vod/' },
  { key: 'hhzy', name: '豪华资源', api: 'https://hhzyapi.com/api.php/provide/vod/' },
  { key: 'subo', name: '速播资源', api: 'https://subocaiji.com/api.php/provide/vod/' },
  { key: 'zy360new', name: '360资源', api: 'https://360zyzz.com/api.php/provide/vod/' },
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
