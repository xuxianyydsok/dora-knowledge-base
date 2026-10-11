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
const KUGOU_RESOLVE_LIMIT = 12;

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
