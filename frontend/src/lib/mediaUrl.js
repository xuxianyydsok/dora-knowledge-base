// 影视播放地址归一（纯函数、无 IO、无依赖，供页面与离线单测共用）
//
// 背景（2026-10-10 回归）：苹果CMS 采集源的 vod_play_url 里混着两类地址——
//   1) 真正可直连播放的 m3u8 / mp4；
//   2) 网页地址（分享页 /share/<hash>、网页播放页 /play/<id>）。
// 把 2) 交给 <video> 必然报「片源无法解析」。后端 normalizeVod 已按同规则过滤，
// 但前端此前在「清洗后为空」时会回退原始线路，并把未校验的 currentEpisode.url
// 直接喂给播放器，导致网页地址再次进入播放链路。
// 因此前端统一走这里：**播放与展示绝不使用非 m3u8/mp4 地址**。

// 与 backend/src/lib/maccms.js 的 isPlayableUrl 同规则
const VIDEO_EXT_RE = /\.(m3u8|mp4)(\?|#|$)/i;

// 是否为可直连播放的影视地址
export function isDirectVideoUrl(url) {
  return typeof url === 'string' && VIDEO_EXT_RE.test(url.trim());
}

// 清洗线路：剔除网页地址剧集，丢掉清洗后为空的线路。
// 清洗后为空就返回空数组——**绝不回退原始线路**（原始线路正是「片源无法解析」的来源）。
export function cleanRoutes(routes) {
  return (Array.isArray(routes) ? routes : [])
    .map((r) => ({
      name: r?.name,
      episodes: (Array.isArray(r?.episodes) ? r.episodes : [])
        .filter((e) => e && isDirectVideoUrl(e.url))
    }))
    .filter((r) => r.episodes.length);
}

// 原始线路里「有线路但一个直链都没有」——用于给出更准确的空态提示，而不是笼统的「暂无播放地址」
export function hasOnlyWebRoutes(routes) {
  const raw = Array.isArray(routes) ? routes : [];
  const total = raw.reduce((n, r) => n + (Array.isArray(r?.episodes) ? r.episodes.length : 0), 0);
  return total > 0 && cleanRoutes(raw).length === 0;
}

// 播放地址归一：只接受直链。
// 优先级：选中剧集 > 保存的播放地址；两者都不是直链时返回 ''（调用方显示空态）。
export function resolvePlayUrl(episodeUrl, movieUrl) {
  if (isDirectVideoUrl(episodeUrl)) return episodeUrl.trim();
  if (isDirectVideoUrl(movieUrl)) return movieUrl.trim();
  return '';
}
