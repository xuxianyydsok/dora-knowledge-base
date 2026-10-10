// Meting API 公共实例适配器
//
// Meting（https://github.com/metowolf/Meting）是开源的音乐 API 聚合器，同时暴露多个上游平台：
//   ?server=<平台>&type=search&id=<关键词>   搜索
//   ?server=<平台>&type=url&id=<歌曲ID>      取流地址
//   ?server=<平台>&type=pic&id=<封面ID>      封面
//   ?server=<平台>&type=lrc&id=<歌词ID>      歌词（LRC 纯文本）
//
// 与 GD音乐台的关键差异：**Meting 的搜索结果每条都自带可用地址**，
// 不需要再逐条调用解析接口，因此不受 GD「5 分钟 50 次解析额度」的限制 ——
// 这是把搜索结果从个位数扩到几十条的关键。
//
// 实测（2026-10-07，本机直连 api.qijieya.cn）：
//   search 返回结构极简，只有 5 个字段，且**没有独立的 id / 时长字段**：
//     { "name": "布拉格广场", "artist": "蔡依林/周杰伦",
//       "url": "https://api.qijieya.cn/meting/?server=netease&type=url&id=210049",
//       "pic": "https://api.qijieya.cn/meting/?server=netease&type=pic&id=109951...",
//       "lrc": "https://api.qijieya.cn/meting/?server=netease&type=lrc&id=210049" }
//   → 歌曲 ID 只能从 url / lrc 的查询串里反解（见 idFromUrl）。
//   → url 与 pic 都是 **302 跳转端点**（响应体为空、Location 指向真实资源），
//      可直接作为 <audio src> / <img src> 交给浏览器跟随；实测跟随跳转后返回
//      200 audio/mpeg（migu / netease 均通过）。
//   → lrc 返回的是 **LRC 纯文本**（不是 JSON），需按文本读取。
//   → url 是**稳定地址**（不像 GD 那样是带时间戳的签名链接），因此无需「过期重解析」。
//   server=netease → 30 条；server=migu → 30 条；server=tencent → 30 条但 url 不可播；server=kuwo → 0 条。
//   其余公共实例（mysqil / injahow / ohmy.cool / hzchu.top / moeyao / 7cu / byfog / qjqq / i-meto / dujin / amjun）
//   实测全部不可用（SSL 握手失败 / 404 / 522 / 返回非 JSON）→ 不纳入默认池。
//
// ⚠ 公共实例无 SLA 且**音频流经由实例转发**，是单点依赖；因此：
//   ① 全部调用走时间预算 + allSettled，单实例失败不影响其它音源；
//   ② 实例列表可用环境变量 METING_INSTANCES 覆盖（JSON 数组，元素形如
//      {"key":"qijieya","base":"https://api.qijieya.cn/meting/","servers":["netease","migu"]}）；
//   ③ Meting 与 GD 并行使用，任一不可用仍能出结果。

import { HttpError } from './response.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// 默认实例池：只保留实测「搜索有结果 且 结果自带可播地址」的实例与平台
//
// 2026-10-07 二次实测（21 个公共实例 + 20 个上游平台）补充结论：
//   ① 实例：只有 qijieya 可用。inj0 / mysqil / cenguigui / ohmy / moeyao / 7cu /
//      vkeys / wolf / kokodayo / sakura / toubie / maou / hfi / chinayang / wuenci /
//      alcy / nanari / hina / sunyz / qjqq / imeto / dujin / amjun / bytemd / bugpk /
//      tonk / rainss / xyh / imsyy / nanahira / mgeko / lvmao / zhheo / lcx
//      全部不可用（连不上 / 404 / 522 / 非 JSON）→ 仍是单实例依赖，
//      换实例请用环境变量 METING_INSTANCES。
//   ② 上游平台：migu / ximalaya / joox / spotify / deezer / tidal / qobuz /
//      soundcloud / fivesing / lizhi / qingting / yinyuetai / apple 在同一关键词下
//      返回的**曲目集合与 netease 基本一致**（仅排序不同）→ 它们是 netease 的别名，
//      多挂只会多花一次请求、结果还会被去重吃掉。故只保留 netease + migu
//      （migu 实测每个关键词能多带 0~6 条 netease 没有的条目，代价约 300ms）。
//   ③ kugou / tencent 返回的是**真正的独立片库**（搜「周杰伦」给的是晴天/稻香/青花瓷，
//      比 netease 的合唱与 Live 版本更贴近用户预期），但它们的 type=url 端点返回
//      空 HTML（200 text/html），拿不到可播地址 —— 且按「歌名+歌手」回查 netease 会
//      命中翻唱（「晴天(深情版)|Lucky小爱」），会把翻唱冒充原唱，因此**不纳入**。
//      目录排序上的优势改由 fetchers.js 的 musicScore 重排来补。
export const DEFAULT_METING_INSTANCES = [
  { key: 'qijieya', base: 'https://api.qijieya.cn/meting/', servers: ['netease', 'migu'] }
];

// 读取配置的 Meting 实例：优先 env.METING_INSTANCES，否则用默认池
export function getMetingInstances(env = {}) {
  const raw = env.METING_INSTANCES;
  if (raw) {
    try {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const parsed = list
          .filter((i) => i && i.base)
          .map((i) => ({
            key: String(i.key || i.base),
            base: String(i.base),
            servers: Array.isArray(i.servers) && i.servers.length
              ? i.servers.map(String)
              : ['netease']
          }));
        if (parsed.length) return parsed;
      }
    } catch {
      // 解析失败回退默认池
    }
  }
  return DEFAULT_METING_INSTANCES;
}

// 组装取流地址。Meting 的 type=url 返回 302，浏览器跟随跳转即可播放，
// 因此这个地址可以直接塞进 <audio src>。
export function metingStreamUrl(base, server, id) {
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${new URLSearchParams({ server, type: 'url', id })}`;
}

// 从 Meting 给的子地址里反解歌曲 ID（搜索结果没有独立 id 字段）
function idFromUrl(u) {
  if (!u) return '';
  try {
    return new URL(u).searchParams.get('id') || '';
  } catch {
    const m = String(u).match(/[?&]id=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }
}

async function metingFetchJson(base, params, timeoutMs = 12000) {
  const sep = base.includes('?') ? '&' : '?';
  const url = base + sep + new URLSearchParams(params).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: 'application/json' }
    });
    if (!res.ok) throw new HttpError(502, `Meting 请求失败 (${res.status})`);
    const text = await res.text();
    // 公共实例异常时会返回 HTML 错误页或空响应，统一按失败处理
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : (data && typeof data === 'object' ? [data] : []);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err.name === 'AbortError') throw new HttpError(504, `Meting 请求超时（${timeoutMs}ms）`);
    throw new HttpError(502, `Meting 请求失败：${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

// Meting 的 length 形如 "00:04:21"（部分实例提供）或直接是秒数，统一转秒。
// 当前默认实例不返回时长，此处保持兼容以备换实例。
function parseLength(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  const s = String(v || '').trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  const parts = s.split(':').map((x) => Number(x));
  if (parts.some((n) => !Number.isFinite(n))) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0) || null;
}

// Meting 结果 → 统一候选结构（audio_url 为可直接播放的取流地址）
function metingCandidate(t, instance, server) {
  const audio = t.url || null;
  return {
    platform: 'meting',
    // 记录实例与上游平台：便于前端展示来源，也便于将来换实例
    meting_base: instance.base,
    meting_instance: instance.key,
    gd_source: server,
    external_id: String(t.id ?? '') || idFromUrl(audio) || idFromUrl(t.lrc),
    title: t.name || t.title || null,
    artist: t.artist || null,
    artist_avatar: null,
    album: t.album || null,
    // pic 同样是 302 端点，可直接作为 <img src>
    artwork_url: t.pic || null,
    audio_url: audio,
    audio_fallbacks: [],
    preview_url: null,
    // 该端点流式返回完整曲目（与 iTunes/Deezer 的 30 秒试听区分）
    quality: audio ? 'full' : 'preview',
    bitrate: null,
    format: null,
    file_size: 0,
    duration: parseLength(t.length ?? t.duration),
    genre: null,
    release_year: null,
    page_url: null
  };
}

// 搜索：单个实例的单个上游平台。
// 一次性多取条目（Meting 默认上限 30），前端再做分页 / 筛选。
// timeoutMs 由调用方按阶段给（见 fetchers.js 的 METING_TIMEOUT_MS）：
// 单路挂住时不该拖住其余 6 路音源。
export async function searchMetingMusic(instance, server, keyword, limit = 30, timeoutMs = 5000) {
  // 实测：qijieya 的 limit 参数是**真的生效**的 —— limit=30/50/100 分别返回 30/50/100 条
  // （2026-10-07，耗时 358/429/500ms）。此前固定只取 30 条，等于把 70% 的结果留在上游。
  const list = await metingFetchJson(instance.base, {
    server,
    type: 'search',
    id: keyword,
    limit: Math.min(Math.max(limit, 30), 100)
  }, timeoutMs);
  const candidates = list
    .filter((t) => t && (t.name || t.title))
    .map((t) => metingCandidate(t, instance, server));
  return { source: `meting@${instance.key}:${server}`, candidates };
}

// 歌词：lrc 字段本身就是 LRC 纯文本地址（不是 JSON），直接按文本读取。
// 兼容两种调用：传 lrc 地址（正常路径），或传 id 时自己拼 type=lrc。
export async function fetchMetingLyrics(lrcOrBase, serverOrUndefined, idOrUndefined) {
  let url = lrcOrBase;
  if (idOrUndefined !== undefined) {
    url = metingStreamUrl(lrcOrBase, serverOrUndefined, idOrUndefined).replace('type=url', 'type=lrc');
  }
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: 'text/plain,*/*' }
    });
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    // 只认「含 [mm:ss] 时间轴的 LRC 文本」：实例异常时可能返回 JSON 错误体或 HTML，
    // 这类内容不该当作歌词塞给播放器。
    if (!/\[\d{1,2}:\d{2}/.test(text)) return null;
    return {
      source: 'meting',
      instrumental: false,
      synced: text,
      plain: text
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// 歌单 / 排行榜（2026-10-09，音乐首页「排行榜」用）：type=playlist 返回与搜索相同的结构
export async function fetchMetingPlaylist(instance, server, id, limit = 50, timeoutMs = 12000) {
  const list = await metingFetchJson(instance.base, { server, type: 'playlist', id }, timeoutMs);
  return list.slice(0, limit).map((t) => metingCandidate(t, instance, server)).filter((c) => c.title);
}
