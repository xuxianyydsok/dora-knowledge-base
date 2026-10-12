// 音乐官方接口音源（网易云官方 + 酷狗官方）
//
// 2026-10-11 新增，用户要求「再补更多能用的音源，有些歌根本搜不出来」。
//
// 为什么需要它们：接入源健康统计后发现，原先的 6 路音源里
//   · GD音乐台（网易云/joox）—— 实测 14~23s 才响应，在 9s 预算下大概率被丢弃；
//   · Deezer —— 同样 23s，基本必丢；
//   · Audius / iTunes —— 小众片库 / 30 秒试听；
//   · Meting 公共实例 —— **唯一**稳定出完整曲目的一路，且是单实例（挂了就全空）。
// 结果是「看起来挂了 6 路，实际只有 1 路在干活」。
//
// 新增两路官方接口（都不需要 API Key，直连 <1s）：
//   ① 网易云官方 cloudsearch + 官方外链取流 —— 与 Meting 同一个片库，但**独立链路**，
//      单实例故障时仍能出结果；
//   ② 酷狗官方 song_search_v2 + trackercdn 取流 —— **完全不同的片库**
//      （酷狗有周杰伦原唱「晴天 / 稻香」，而网易云搜索被「深情版」翻唱刷屏）。
//
// 本模块只依赖全局 fetch / crypto，不 import 其它业务模块，便于离线单测。

// 浏览器 UA：两个官方接口都会拦截自定义 UA（返回 404 页或空 JSON）
export const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const NETEASE_TIMEOUT_MS = 6000;
const KUGOU_TIMEOUT_MS = 6000;
const KUGOU_URL_TIMEOUT_MS = 4000;
// 每次搜索最多为多少条酷狗结果去取直链。
// 取直链是**每首一次请求**，全量取（100 条）会把整次搜索拖到十几秒 ——
// 因此只解析最靠前的这些，其余标 needs_resolve（播放失败时前端会按需重解析）。
// 子请求预算见 NETEASE_PROBE_LIMIT 处的说明（统一收敛到 8）。
const KUGOU_RESOLVE_LIMIT = 8;

async function fetchJson(url, { headers, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// 取纯文本（酷我搜索返回的是伪 JSON 文本、取流返回的是裸 URL，
// 两者都不该走 res.json()）。
async function fetchText(url, { headers, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------
// 网易云官方
// ---------------------------------------------------------------

// 官方外链端点：稳定 302 到 CDN 的 **https** 直链（m701/m801.music.126.net/.../*.mp3），
// 浏览器 <audio> 可跨域直接播放，且**不带 expi、不会过期**。
// ⚠ 不要改用 enhance/player/url 返回的地址：那是 http + 带 expi 的签名链接，
//   在 https 页面里会被混合内容策略拦掉，几分钟后还会失效。
// 版权受限的曲目该端点会 302 到 /404（返回 HTML），播放器会失败并自动切下一条，
// 因此这里不做预筛（预筛每首要多一次请求，得不偿失）。
export function neteaseOuterUrl(id) {
  return `https://music.163.com/song/media/outer/url?id=${encodeURIComponent(id)}.mp3`;
}

// 网易云官方外链端点对**版权受限**曲目会 302 到 /404（返回 HTML，不是音频）。
// 2026-10-12 实测 10 个热门关键词各取首条正片：**只有 6/10 返回真音频**，
// 其余 4 首（孤勇者 / 海阔天空 / 平凡之路 / 夜曲）返回 text/html ——
// 这就是用户说的「搜出来点进去放不了」。
//
// 因此搜索阶段对外链做一次轻量探测（Range 取 1 字节即可判定 content-type），
// 探测不通过的条目降权排到后面，让「能播的」先出现。
// 探测是并发的，且只对最靠前的若干条做，不显著增加搜索耗时。
// 子请求预算（Cloudflare 免费版单次请求上限 50 个）很紧：音乐搜索一次要并发
// 十来个上游，每个上游还会为「探活/取直链」再发若干子请求。此前 12/12/12 的配置
// 加上新增的 QQ 路会直接顶到上限（实测探针报 error 1101）。
// 因此统一收敛到 8：仍然足够覆盖展示的前若干条，且留出余量给封面/歌词等后续请求。
const NETEASE_PROBE_LIMIT = 8;
const NETEASE_PROBE_TIMEOUT_MS = 3500;

/** 探测一条网易云外链是否真的是音频；失败（含超时）一律当不可播。 */
export async function neteaseOuterPlayable(id) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NETEASE_PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(neteaseOuterUrl(id), {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': BROWSER_UA, Referer: 'https://music.163.com/', Range: 'bytes=0-1' },
      signal: controller.signal
    });
    const type = res.headers.get('content-type') || '';
    return type.startsWith('audio/');
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchNeteaseMusic(q, limit = 40) {
  const url = 'https://music.163.com/api/cloudsearch/pc?'
    + new URLSearchParams({ s: q, type: '1', limit: String(limit), offset: '0' }).toString();
  const body = await fetchJson(url, {
    headers: {
      'User-Agent': BROWSER_UA,
      Referer: 'https://music.163.com/',
      Accept: 'application/json'
    },
    timeoutMs: NETEASE_TIMEOUT_MS
  });
  const songs = body?.result?.songs || [];

  const candidates = songs
    .filter((s) => s && s.id && s.name)
    .map((s) => {
      const album = s.al || {};
      return {
        platform: 'netease',
        external_id: String(s.id),
        title: s.name,
        artist: (s.ar || []).map((a) => a.name).filter(Boolean).join('/') || null,
        artist_avatar: null,
        album: album.name || null,
        artwork_url: album.picUrl || null,
        audio_url: neteaseOuterUrl(s.id),
        audio_fallbacks: [],
        preview_url: null,
        // 完整曲目（非 30 秒试听）；版权受限的曲目由播放器在失败时切下一条
        quality: 'full',
        bitrate: null,
        format: null,
        file_size: 0,
        duration: s.dt ? Math.round(s.dt / 1000) : null,
        genre: null,
        release_year: null,
        page_url: `https://music.163.com/song?id=${s.id}`
      };
    });

  // 版权受限的曲目外链会返回 HTML（点了放不了）。并发探测最靠前的若干条，
  // 不通过的标 `playable_probe_failed`，由 fetchers 的排序把它们沉到能播的后面。
  // 只探测不剔除：个别探测受网络抖动影响时，用户仍能手动点到（只是排在后面）。
  const head = candidates.slice(0, NETEASE_PROBE_LIMIT);
  const probed = await Promise.all(head.map((c) => neteaseOuterPlayable(c.external_id)));
  probed.forEach((ok, i) => { if (!ok) head[i].playable_probe_failed = true; });

  return { source: 'netease', candidates };
}

// ---------------------------------------------------------------
// 酷狗官方
// ---------------------------------------------------------------

// 取单曲直链。
//
// 踩过的坑（2026-10-11）：
//   · trackercdn.kugou.com/i/v2 需要 key=md5(hash + "kgcloudv2")，而 **Workers 的
//     WebCrypto 不支持 MD5**（`crypto.subtle.digest('MD5')` 直接抛 "Unrecognized algorithm name"），
//     自己实现 MD5 又要多写 60 行 —— 因此改用下面这个**不需要任何签名**的移动端端点。
//   · m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=<hash>
//     直接返回 { url, extName, fileSize, timeLength, bitRate, ... }。
//     版权受限的曲目返回 status=0 + error（无 url）—— 属酷狗本身的分级策略，
//     这类条目仍会出现在搜索列表里，播放失败时前端提示并切下一条。
//   · 返回的 url 是 https://sharefs.kugou.com/... （已是 https，无需改写）。
export async function kugouStreamUrl(hash) {
  const h = String(hash || '').trim();
  if (!h) return null;
  try {
    const url = `https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${encodeURIComponent(h)}`;
    const d = await fetchJson(url, { headers: { 'User-Agent': BROWSER_UA }, timeoutMs: KUGOU_URL_TIMEOUT_MS });
    if (!d?.url) return null;
    // 兜底：万一上游给的是 http，升到 https（https 页面里 http 会被混合内容策略拦掉）
    return String(d.url).replace(/^http:\/\//i, 'https://');
  } catch {
    return null;
  }
}

// 去掉酷狗搜索结果里的 <em> 高亮标签
export function stripEm(s) {
  return String(s || '').replace(/<\/?em>/g, '').trim();
}

export async function searchKugouMusic(q, limit = 40) {
  const url = 'https://songsearch.kugou.com/song_search_v2?'
    + new URLSearchParams({
      keyword: q,
      page: '1',
      pagesize: String(Math.min(Math.max(limit, 30), 100)),
      platform: 'WebFilter',
      tag: 'em',
      filter: '2',
      iscorrection: '1',
      privilege_filter: '0'
    }).toString();
  const body = await fetchJson(url, {
    headers: {
      'User-Agent': BROWSER_UA,
      Referer: 'https://www.kugou.com/',
      Accept: 'application/json'
    },
    timeoutMs: KUGOU_TIMEOUT_MS
  });
  const list = body?.data?.lists || [];
  const rows = list
    .filter((x) => x && x.FileHash && (x.SongName || x.OriSongName))
    .slice(0, limit);

  // 并发取直链（只取前 N 条，见 KUGOU_RESOLVE_LIMIT；拿不到的留空并标 needs_resolve）
  const settled = await Promise.allSettled(
    rows.slice(0, KUGOU_RESOLVE_LIMIT).map((x) => kugouStreamUrl(x.FileHash))
  );

  const candidates = rows.map((x, i) => {
    const audio = i < KUGOU_RESOLVE_LIMIT && settled[i].status === 'fulfilled' ? settled[i].value : null;
    const c = {
      platform: 'kugou',
      external_id: String(x.FileHash).toLowerCase(),
      title: stripEm(x.SongName || x.OriSongName),
      artist: stripEm(x.SingerName) || null,
      artist_avatar: null,
      album: stripEm(x.AlbumName) || null,
      artwork_url: null,
      audio_url: audio,
      audio_fallbacks: [],
      preview_url: null,
      quality: 'full',
      bitrate: Number(x.HQBitrate) > 0 ? Number(x.HQBitrate) : null,
      format: 'mp3',
      file_size: Number(x.HQFileSize) > 0 ? Number(x.HQFileSize) : 0,
      duration: Number(x.Duration) > 0 ? Number(x.Duration) : null,
      genre: null,
      release_year: null,
      page_url: null
    };
    if (!audio) c.needs_resolve = true;
    return c;
  });

  return { source: 'kugou', candidates };
}

// ---------------------------------------------------------------
// 酷我音乐（2026-10-12 新增）
// ---------------------------------------------------------------
// 为什么加这一路：用户反馈「很多歌搜不出来，搜出来也放不了」。
// 酷我是**完全独立于网易云 / 酷狗的第三个片库**，且搜索与取流都是自有接口，
// 不依赖任何第三方中转、不需要 Key、直链是普通 CDN 地址（非签名，不会过期）。
//
// 实测（2026-10-12，本机直连，8 个关键词：晴天/稻香/青花瓷/孤勇者/海阔天空/平凡之路/
//   see you again/hello）：搜索 8/8 有结果、取流 8/8 返回可用地址、
//   拉取首个 1KB 分片 8/8 返回 206 audio/mpeg。可用性是目前所有音源里最好的一路。
//
// 音质策略（用户要求「尽量先是音质高的」）：FLAC(2000kflac) → 320K → 128K → 通用 mp3，
//   逐档尝试，拿到哪个就用哪个；实测多数曲目 320K 能拿到，
//   带音质后缀的 format 对部分曲目会返回 "res not found"，所以必须逐档兜底。
//
// 注意：搜索接口返回的是**单引号伪 JSON**（值里可能带引号，直接 JSON.parse 会炸），
// 因此按条目切块后逐字段正则提取，比整体转换稳。

const KUWO_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) '
  + 'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';
const KUWO_TIMEOUT_MS = 6000;
const KUWO_URL_TIMEOUT_MS = 5000;
// 取直链是「每首一次请求」，全量取会把搜索拖到十几秒 —— 只解析最靠前的这些，
// 其余标 needs_resolve（播放时按需重解析）。
// 子请求预算见 NETEASE_PROBE_LIMIT 处的说明（统一收敛到 8）。
const KUWO_RESOLVE_LIMIT = 8;

/** 音质档位：数字越大越好。999 = 无损 FLAC。 */
const KUWO_FORMATS = [
  { format: '2000kflac', br: 999 },
  { format: '320kmp3', br: 320 },
  { format: '128kmp3', br: 128 },
  { format: 'mp3', br: 128 }
];

function kuwoUnescape(s) {
  return String(s || '')
    // ⚠ 上游把值做了**两层**转义：真实的分隔符 & 在响应里长成 `\\u0026`，
    // 甚至 `\\\\u0026`（实测「因为爱情」的 ARTIST 就是 4 个反斜杠 + u0026）。
    // 只做一次 \uXXXX 替换会残留若干反斜杠，多歌手就显示成
    // 「陈奕迅\\\/王菲」这种鬼样子。所以先把连续反斜杠收敛成一个，再解码。
    .replace(/\\+/g, '\\')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\\//g, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/** 解析酷我搜索返回的伪 JSON（单引号 + &nbsp; 实体 + 转义 unicode）。 */
export function parseKuwoSearch(text) {
  const chunks = String(text || '').split("{'AARTIST'").slice(1);
  const field = (chunk, key) => {
    const m = chunk.match(new RegExp(`'${key}':'([^']*)'`));
    return m ? kuwoUnescape(m[1]) : '';
  };
  return chunks
    .map((chunk) => {
      const rid = field(chunk, 'MUSICRID');
      if (!rid) return null;
      const formats = field(chunk, 'FORMATS');
      const pic = field(chunk, 'web_albumpic_short');
      const artist = field(chunk, 'ARTIST');
      return {
        platform: 'kuwo',
        external_id: rid.replace('MUSIC_', ''),
        title: field(chunk, 'NAME'),
        artist: artist ? artist.split(/[&、]/).map((s) => s.trim()).filter(Boolean).join('/') : null,
        artist_avatar: null,
        album: field(chunk, 'ALBUM') || null,
        artwork_url: pic ? `https://img1.kuwo.cn/star/albumcover/${pic}` : null,
        audio_url: null,
        audio_fallbacks: [],
        preview_url: null,
        quality: 'full',
        // ⚠ 不按 FORMATS 标称 320K：2026-10-12 实测「标了 MP3H 的曲目逐档取流
        // 时 320kmp3 也拿不到，实际只能拿到 mp3（≈128K）」——标称会虚高。
        // 音质一律以**取流实测结果**为准（见下方 searchKuwoMusic 的回填）。
        bitrate: 0,
        max_bitrate_hint: formats.includes('MP3H') ? 320 : 128,
        format: 'mp3',
        file_size: 0,
        duration: Number(field(chunk, 'DURATION')) || null,
        genre: null,
        release_year: null,
        page_url: null,
        needs_resolve: true
      };
    })
    .filter((c) => c && c.title);
}

/** 按 rid 取一条播放直链；逐档降级，拿到就返回。返回 null 表示这一首拿不到。 */
export async function kuwoStreamUrl(id, wantBr = 999) {
  const order = wantBr >= 999
    ? KUWO_FORMATS
    : KUWO_FORMATS.filter((f) => f.br <= wantBr);
  const list = order.length ? order : KUWO_FORMATS;
  for (const { format, br } of list) {
    try {
      const url = 'http://antiserver.kuwo.cn/anti.s?'
        + new URLSearchParams({ type: 'convert_url', rid: `MUSIC_${id}`, format, response: 'url' }).toString();
      const body = await fetchText(url, {
        headers: { 'User-Agent': KUWO_UA, Referer: 'http://www.kuwo.cn/' },
        timeoutMs: KUWO_URL_TIMEOUT_MS
      });
      const clean = String(body || '').trim();
      if (/^https?:\/\//.test(clean)) return { url: clean, bitrate: br, format: format.includes('flac') ? 'flac' : 'mp3' };
    } catch {
      // 换下一档
    }
  }
  return null;
}

/** 搜索酷我：返回候选；靠前的若干条顺带解析出直链（其余标 needs_resolve）。 */
export async function searchKuwoMusic(q, limit = 40) {
  const url = 'http://search.kuwo.cn/r.s?'
    + new URLSearchParams({
      all: q,
      ft: 'music',
      itemset: 'web_2013',
      client: 'kt',
      pn: '0',
      rn: String(Math.min(Math.max(limit, 20), 60)),
      rformat: 'json',
      encoding: 'utf8'
    }).toString();
  const text = await fetchText(url, {
    headers: { 'User-Agent': KUWO_UA },
    timeoutMs: KUWO_TIMEOUT_MS
  });
  const candidates = parseKuwoSearch(text);
  const head = candidates.slice(0, KUWO_RESOLVE_LIMIT);
  const settled = await Promise.allSettled(head.map((c) => kuwoStreamUrl(c.external_id)));
  settled.forEach((res, i) => {
    if (res.status !== 'fulfilled' || !res.value) return;
    const c = head[i];
    c.audio_url = res.value.url;
    c.bitrate = res.value.bitrate;
    c.format = res.value.format;
    // 只有真的拿到无损才标 lossless（用户要求「尽量先是音质高的」，
    // 所以无损要能排到最前；但绝不能虚标 —— 实测拿不到就不能说自己是无损）。
    c.quality = res.value.bitrate >= 999 ? 'lossless' : 'full';
    delete c.max_bitrate_hint;
    delete c.needs_resolve;
  });
  return { source: 'kuwo', candidates };
}

// ---------------------------------------------------------------
// QQ 音乐（经「落月 API」vkeys 中转，2026-10-13 新增）
// ---------------------------------------------------------------
// 为什么加这一路：网易云对**原唱正版**收录很差 —— 搜「陈奕迅」给的多是翻唱/合唱，
// 《富士山下》《葡萄成熟时》这些原唱根本搜不出来。QQ 音乐片库对这些歌手覆盖完整，
// 但 QQ 官方搜索接口（c.y.qq.com / u.y.qq.com）从 Cloudflare 出口一律返回空。
//
// vkeys（落月 API）是开源社区维护的 QQ 音乐解析中转，实测从 **Cloudflare 出口**：
//   · 搜索 6/6 成功、单次 ~0.33s、无限流、无 Key、无签名；
//   · 返回体带 `pay` 字段（"付费" / "免费"），正好用来给结果标注「需会员」；
//   · 取流接口 `geturl` 对**免费曲**能返回可播直链，对**VIP 曲**返回
//     「当前歌曲无音质或付费专辑」或 28kbps 试听 —— 属 QQ 侧版权限制，非接口故障。
// 因此这里把它当**搜索源**接入（补齐片库），取流按需（点播时再取，失败则前端提示）。
//
// 许可提醒：vkeys 是第三方中转，稳定性依赖对方；本站只做个人自用，保留来源说明。
const VKEYS_BASE = 'https://api.vkeys.cn/v2/music';
const VKEYS_TIMEOUT_MS = 5000;
const VKEYS_URL_TIMEOUT_MS = 5000;
// 取直链是「每首一次请求」，全量取会把搜索拖长；只解析最靠前的这些，
// 其余标 needs_resolve（点播时按需调 /api/music/stream）。
// 取到直链的意义不止「能播」——它同时证明这首**不是**会员专享，
// 前端据此把「能放的」排前面、「要会员的」标出来（用户要求：点了放不了的懒得看）。
const VKEYS_RESOLVE_LIMIT = 8;

/** 解析 vkeys 返回的时长文本（"4分29秒"）为秒数。 */
function vkeysDuration(text) {
  const m = String(text || '').match(/(?:(\d+)\s*分)?\s*(\d+)\s*秒/);
  if (!m) return null;
  return (Number(m[1]) || 0) * 60 + Number(m[2]);
}

/**
 * 搜索 QQ 音乐（经 vkeys）。返回候选；`pay` 字段转成 `needs_member` 供前端标注，
 * 并并发解析最靠前的若干条直链 —— 解析成功的即「确定可播」，失败的标 needs_member。
 */
export async function searchVkeysMusic(q, limit = 40) {
  const url = `${VKEYS_BASE}/tencent?` + new URLSearchParams({ word: q }).toString();
  const body = await fetchJson(url, {
    headers: { Accept: 'application/json' },
    timeoutMs: VKEYS_TIMEOUT_MS
  });
  const rows = Array.isArray(body?.data) ? body.data : [];
  const candidates = rows.slice(0, Math.max(limit, 10)).map((s) => {
    if (!s || !s.mid || !s.song) return null;
    const paid = String(s.pay || '').includes('付费');
    const c = {
      platform: 'qq',
      external_id: String(s.mid),
      title: String(s.song),
      artist: s.singer || (s.singer_list || []).map((x) => x.name).filter(Boolean).join('/') || null,
      artist_avatar: null,
      album: s.album || null,
      artwork_url: s.cover || null,
      audio_url: null,
      audio_fallbacks: [],
      preview_url: null,
      quality: 'full',
      bitrate: null,
      format: 'mp3',
      file_size: 0,
      duration: vkeysDuration(s.interval),
      genre: null,
      release_year: s.time ? Number(String(s.time).slice(0, 4)) || null : null,
      page_url: s.mid ? `https://y.qq.com/n/ryqq/songDetail/${s.mid}` : null,
      // 直链未取（点播时按需调 /api/music/stream），前端据此显示「待解析」。
      needs_resolve: true,
      // VIP 曲：QQ 侧只给试听/不给流，提前标出来，避免用户点了才发现放不了。
      needs_member: paid
    };
    return c;
  }).filter(Boolean);

  // 并发解析最靠前的若干条：取到直链的改成「确定可播」，取不到且标了付费的维持 needs_member。
  const head = candidates.slice(0, VKEYS_RESOLVE_LIMIT);
  const settled = await Promise.allSettled(head.map((c) => vkeysStreamUrl(c.external_id)));
  settled.forEach((res, i) => {
    const c = head[i];
    if (res.status === 'fulfilled' && res.value?.url) {
      c.audio_url = res.value.url;
      c.bitrate = res.value.bitrate;
      c.format = res.value.format;
      c.quality = res.value.quality;
      delete c.needs_resolve;
      delete c.needs_member;      // 已取到直链 → 不是会员专享，去掉误标
    } else {
      // 取不到流：VIP 曲只给试听/不给流。标成 needs_member，让前端如实提示。
      c.needs_member = true;
    }
  });

  return { source: 'qq', candidates };
}

/**
 * 按 QQ 音乐 mid 取一条可播直链（经 vkeys 中转）。
 * 返回 `{ url, bitrate, format, quality }`；拿不到（VIP 曲/接口异常）返回 null。
 */
export async function vkeysStreamUrl(mid, wantBr = 320) {
  const id = String(mid || '').trim();
  if (!id) return null;
  // quality: 8=128k 9=320k 10=flac 16=flac24bit。实测多数曲目只给 9，故直接要 320k。
  const q = wantBr >= 999 ? 10 : 9;
  try {
    const url = `${VKEYS_BASE}/tencent/geturl?` + new URLSearchParams({ mid: id, quality: String(q) }).toString();
    const body = await fetchJson(url, {
      headers: { Accept: 'application/json' },
      timeoutMs: VKEYS_URL_TIMEOUT_MS
    });
    const d = body?.data;
    if (!d || typeof d !== 'object' || !d.url) return null;
    const kbps = Number(String(d.kbps || '').replace(/[^\d]/g, '')) || 0;
    const qualityText = String(d.quality || '');
    // 「音乐试听」= 只有试听片段，如实标注，别冒充完整曲目。
    const preview = qualityText.includes('试听') || (kbps > 0 && kbps < 96);
    return {
      url: String(d.url).replace(/^http:\/\//i, 'https://'),
      bitrate: kbps || null,
      format: 'mp3',
      quality: preview ? 'preview' : (kbps >= 900 ? 'lossless' : 'full')
    };
  } catch {
    return null;
  }
}
