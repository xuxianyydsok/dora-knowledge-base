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
// 网页播放页形态：/<...>/play/<id>（末尾可有斜杠）
const WEB_PLAY_PATH_RE = /\/play\/[A-Za-z0-9_-]+\/?$/;
// 明显是网页/分享页的路径段：即使无后缀也不能当播放页归一（否则 /share/xxx 会变成假直链）
const NON_PLAY_PATH_RE = /\/(share|vodplay|voddetail|detail|download|subject|vodlist)\//i;

// 是否为可直连播放的影视地址
export function isDirectVideoUrl(url) {
  return typeof url === 'string' && VIDEO_EXT_RE.test(url.trim());
}

// 网页播放页 → 直链归一（与后端 toPlayableUrl 同规则）。
// 光速 / 速播 / 豪华 三个源在 vod_play_url 里给的是网页播放页（https://v.gsuus.com/play/<id>），
// 其 HLS 列表固定在 `<播放页>/index.m3u8`。不归一就会被下面的直链校验过滤掉，
// 用户看到的就是「只有 360 能用」。
export function toPlayableUrl(url) {
  const raw = typeof url === 'string' ? url.trim() : '';
  if (!raw) return '';
  if (isDirectVideoUrl(raw)) return raw;
  let u;
  try { u = new URL(raw); } catch { return ''; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
  const path = u.pathname.replace(/\/+$/, '');
  if (WEB_PLAY_PATH_RE.test(path)) return `${u.origin}${path}/index.m3u8`;
  // 无后缀、无 query 的裸路径同样按播放页处理
  if (!NON_PLAY_PATH_RE.test(path) && !/\.[a-z0-9]{2,5}$/i.test(path) && !u.search) {
    return `${u.origin}${path}/index.m3u8`;
  }
  return '';
}

// 清洗线路：剔除网页地址剧集，丢掉清洗后为空的线路。
// 清洗后为空就返回空数组——**绝不回退原始线路**（原始线路正是「片源无法解析」的来源）。
export function cleanRoutes(routes) {
  return (Array.isArray(routes) ? routes : [])
    .map((r) => ({
      name: r?.name,
      episodes: (Array.isArray(r?.episodes) ? r.episodes : [])
        // 播放页先归一成直链，归一失败的（分享页 / 其它网页）再丢掉
        .map((e) => {
          if (!e) return null;
          const direct = toPlayableUrl(e.url);
          return direct ? { ...e, url: direct } : null;
        })
        .filter(Boolean)
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
  const ep = toPlayableUrl(episodeUrl);
  if (ep) return ep;
  const mv = toPlayableUrl(movieUrl);
  if (mv) return mv;
  return '';
}
