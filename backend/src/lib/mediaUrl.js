// 媒体直链判定（纯函数、无 IO，供路由与离线单测共用）
//
// 背景：采集源与音乐源返回的「地址」里混着两类东西：
//   1) 真正可直接播放的媒体直链（.m3u8 / .mp4 / .mp3 / .flac ...）；
//   2) 网页地址（分享页 /share/xxx、播放页 /play/123、平台落地页 audius.co/...）。
// 把 2) 当播放地址写进库或交给 <video>/<audio>，用户看到的就是「片源无法解析」。
// 因此统一在这里判定，避免各路由各写一份正则而漂移。

// 音频直链后缀（音乐库用；含无损 flac 与常见有损格式）
const AUDIO_EXT_RE = /\.(m3u8|mp4|mp3|flac|m4a|aac|ogg|oga|opus|wav|wma|ape)(\?|#|$)/i;
// 影视直链后缀（苹果CMS 采集源只用 m3u8 / mp4）
const VIDEO_EXT_RE = /\.(m3u8|mp4)(\?|#|$)/i;

// 是否为可直接播放的音频地址（音乐库保存 / 播放判定）
export function isDirectAudioUrl(url) {
  return typeof url === 'string' && AUDIO_EXT_RE.test(url.trim());
}

// 是否为可直接播放的影视地址（m3u8 / mp4）
export function isDirectVideoUrl(url) {
  return typeof url === 'string' && VIDEO_EXT_RE.test(url.trim());
}

// 流式端点：部分平台（如 Audius）给的是无后缀的 `/stream` 端点，
// 浏览器会自动跟随 302 拿到签名音频，属于**可播**地址，不能因为没有后缀就判为网页。
// 刻意不含 `play`：`/play/123` 是影视/分享的**网页播放页**，放进这里会把它误判成可播。
const STREAM_PATH_RE = /\/(stream|audio|media)\b/i;

// Meting 取流端点（2026-10-11 回归修复）：
//   https://api.qijieya.cn/meting/?server=netease&type=url&id=210049
// 它**没有文件后缀**，但响应是 302 → Location 指向真实音频（实测 200 audio/mpeg）。
// 之前 resolveAudioPlayback 只认后缀，导致「搜得到、加不进收藏」，
// 前端看到的就是「该曲目暂无可播放的音频直链（只收到网页地址或空地址）」。
// 判定条件收紧为「路径以 /meting 结尾 且 查询串 type=url」，避免把普通网页放进来。
const METING_PATH_RE = /\/meting\/?$/i;

export function isMetingStreamUrl(url) {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url.trim());
    return METING_PATH_RE.test(u.pathname) && u.searchParams.get('type') === 'url';
  } catch {
    return false;
  }
}

// 该地址是否「看起来能播」：直链后缀，或 Meting 取流端点，或无后缀的流式端点。
export function looksLikeAudioStream(url) {
  if (isDirectAudioUrl(url)) return true;
  if (typeof url !== 'string') return false;
  if (isMetingStreamUrl(url)) return true;
  try {
    const u = new URL(url.trim());
    return STREAM_PATH_RE.test(u.pathname);
  } catch {
    return false;
  }
}

// 音乐库的「播放地址」归一：只接受可直接播的地址，网页地址一律不用。
// 返回 { url, quality, trialOnly }；没有任何可播地址时 url 为 null（调用方据此 422 或标记）。
// 优先级：完整音轨 audio_url > 显式直链 url > 试听片段 preview_url。
export function resolveAudioPlayback({ url, audio_url, preview_url } = {}) {
  const pick = (candidate, quality, trialOnly) => (
    looksLikeAudioStream(candidate) ? { url: candidate.trim(), quality, trialOnly } : null
  );
  return pick(audio_url, 'full', false)
    || pick(url, 'full', false)
    || pick(preview_url, 'preview', true)
    || { url: null, quality: null, trialOnly: false };
}

// 存库地址是否「疑似失效」：有地址但既不是直链也不是流式端点（多半是网页地址）。
// 仅用于**只读体检标记**（url_stale），绝不据此自动改库。
export function isStaleAudioUrl(url) {
  return !!url && !looksLikeAudioStream(url);
}
