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

// 音乐库的「播放地址」归一：只接受直链，网页地址一律不用。
// 返回 { url, quality, trialOnly }；没有任何直链时 url 为 null（调用方据此 422 或标记）。
// 优先级：完整音轨 audio_url > 显式直链 url > 试听片段 preview_url。
export function resolveAudioPlayback({ url, audio_url, preview_url } = {}) {
  if (isDirectAudioUrl(audio_url)) return { url: audio_url.trim(), quality: 'full', trialOnly: false };
  if (isDirectAudioUrl(url)) return { url: url.trim(), quality: 'full', trialOnly: false };
  if (isDirectAudioUrl(preview_url)) return { url: preview_url.trim(), quality: 'preview', trialOnly: true };
  return { url: null, quality: null, trialOnly: false };
}

// 流式端点：部分平台（如 Audius）给的是无后缀的 `/stream` 端点，
// 浏览器会自动跟随 302 拿到签名音频，属于**可播**地址，不能因为没有后缀就判为网页。
const STREAM_PATH_RE = /\/(stream|audio|media|play)\b/i;

// 该地址是否「看起来能播」：直链后缀，或无后缀的流式端点。
export function looksLikeAudioStream(url) {
  if (isDirectAudioUrl(url)) return true;
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url.trim());
    return STREAM_PATH_RE.test(u.pathname);
  } catch {
    return false;
  }
}

// 存库地址是否「疑似失效」：有地址但既不是直链也不是流式端点（多半是网页地址）。
// 仅用于**只读体检标记**（url_stale），绝不据此自动改库。
export function isStaleAudioUrl(url) {
  return !!url && !looksLikeAudioStream(url);
}
