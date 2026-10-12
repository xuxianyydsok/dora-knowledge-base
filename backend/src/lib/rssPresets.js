// 精选 RSS 订阅源（预置清单）
//
// 动机（2026-10-12 用户原话）：「我到时候想让它自己去帮我订阅，我懒得一个一个的去订阅」。
// 站长在 /rss 页点「导入精选源」，一次把下面这些源全部订阅好，不用手工粘 URL。
//
// 取舍（2026-10-12 用户要求：**只收国内的源**）：
//  - 全部为中文站点；国外源（OpenAI / HN / TechCrunch 等）一律不收。
//  - 每个地址都**实测过**能直接抓（返回 RSS/Atom 且有条目）；抓不到的已剔除：
//    机器之心（/rss 302 跳 data-service）、虎嗅（连接超时）、品玩（返回 HTML 非 feed）、
//    知乎日报（404）、澎湃（302）。这些源要么已停止提供 RSS，要么对爬虫不友好，
//    放进来只会变成一堆红叉，不如不收。
//  - 分三组，站长可以只挑其中一组导入。
//  - 这些只是**默认建议**，不是硬编码；站长导入后可以随时单独删除。
//
// 纯数据模块：无 IO、无依赖，可被单测直接 import。

/** 预置源：[feed_url, title, 分组] —— 全部为国内站点 */
const PRESETS = [
  // —— AI 与前沿科技 ——
  ['https://www.qbitai.com/feed', '量子位', 'ai'],
  ['https://www.leiphone.com/feed', '雷锋网', 'ai'],
  ['https://www.infoq.cn/feed', 'InfoQ 中文站', 'ai'],

  // —— 科技媒体 ——
  ['https://36kr.com/feed', '36氪', 'media'],
  ['https://www.ithome.com/rss/', 'IT之家', 'media'],
  ['https://www.ifanr.com/feed', '爱范儿', 'media'],
  ['https://www.geekpark.net/rss', '极客公园', 'media'],
  ['https://www.tmtpost.com/rss.xml', '钛媒体', 'media'],
  ['https://sspai.com/feed', '少数派', 'media'],
  ['https://www.oschina.net/news/rss', '开源中国', 'media'],
  ['https://www.chinanews.com.cn/rss/scroll-news.xml', '中国新闻网', 'media'],

  // —— 开发者博客 / 社区 ——
  ['https://www.ruanyifeng.com/blog/atom.xml', '阮一峰的网络日志', 'dev'],
  ['https://blog.codingnow.com/atom.xml', '云风的 BLOG', 'dev'],
  ['https://www.solidot.org/index.rss', 'Solidot 奇客资讯', 'dev']
];

export const PRESET_GROUPS = [
  { key: 'ai', label: 'AI 与前沿科技', desc: '人工智能与新技术动态' },
  { key: 'media', label: '科技媒体', desc: '综合科技新闻与产品报道' },
  { key: 'dev', label: '开发者博客', desc: '中文技术博客与社区' },
  { key: 'github', label: 'GitHub 趋势', desc: 'GitHub Trending 日榜 / 周榜 / 月榜' },
  { key: 'mine', label: '我从 Folo 导出的', desc: '站长自己在 Folo 里订的源（只保留国内站点，且实测能抓）' }
];

// -------------------------------------------------------------
// GitHub Trending（2026-10-12 用户要求「订阅那个 GitHub 的 Trending 页面的 RSS」）
//
// 为什么用 mshibanami/GitHubTrendingRSS 这个第三方源，而不是 rsshub.app 的
// /github/trending 路由：后者和 Folo 那批路由一样，公共实例**从 Cloudflare 出口一律 403**
// （见本文件 FOLO_PRESETS 上方的说明）。这个第三方源是 GitHub Pages 静态托管，
// 实测从 CF 出口 200、日/周/月三档都能拿到条目（各 8 / 12 / 22 条），速度也快（<400ms）。
// -------------------------------------------------------------
const GITHUB_PRESETS = [
  ['https://mshibanami.github.io/GitHubTrendingRSS/daily/all.xml', 'GitHub Trending · 日榜', 'github'],
  ['https://mshibanami.github.io/GitHubTrendingRSS/weekly/all.xml', 'GitHub Trending · 周榜', 'github'],
  ['https://mshibanami.github.io/GitHubTrendingRSS/monthly/all.xml', 'GitHub Trending · 月榜', 'github']
];

// -------------------------------------------------------------
// 「我从 Folo 导出的」分组（2026-10-12）
//
// 用户从 Folo 导出了 follow.opml（41 条），要求「筛选出国内的，然后导进去」。
// 筛选分两步，缺一不可：
//   ① 站点本身是**国内的**（不只是「中文内容」—— 用户明确要求「只抓国内的网站」，
//      因此 YouTube 频道即便讲中文也一律不要）；
//   ② **从 Cloudflare 出口实测能抓**。
// 第 ② 步是硬门槛 —— 41 条里有 26 条抓不到：
//   · rsshub.app 的公共实例（B站动态 / YouTube / Twitter 那批）现在**一律返回 403**，
//     官方公告原文「Due to cost considerations, we will gradually restrict access to
//     rsshub.app for some feed readers」—— 这些路由从 CF 出口全部拿不到，加进来只会是红叉；
//   · reddit.com（不是 feed 地址）、r55hub.zeabur.app（503）、
//     其他几个公共 RSSHub 镜像（rssforever / feeded / slarker / ktachibana / pseudoyu /
//     henry.wang / shab.fun）实测 503 / 530，也全部剔除。
// 用户后来明确：**不要国外的**。YouTube 频道（零度解说、凤凰AI七社）虽然内容是中文，
// 但平台在国外，已从本组与线上库中一并移除。
// 因此本组只保留**国内的、实测通过**的 11 个源。
// -------------------------------------------------------------
const FOLO_PRESETS = [
  // LINUX DO 中文社区（第三方 RSS 服务 linuxdorss.longpink.com，实测稳定、速度快）
  ['https://linuxdorss.longpink.com/latest.xml', 'LINUX DO · 最新话题', 'mine'],
  ['https://linuxdorss.longpink.com/top.xml', 'LINUX DO · 热门话题', 'mine'],
  ['https://linuxdorss.longpink.com/develop.xml', 'LINUX DO · 开发调优', 'mine'],
  ['https://linuxdorss.longpink.com/resource.xml', 'LINUX DO · 资源荟萃', 'mine'],
  ['https://linuxdorss.longpink.com/wiki.xml', 'LINUX DO · 文档共建', 'mine'],
  ['https://linuxdorss.longpink.com/gossip.xml', 'LINUX DO · 搞七捻三', 'mine'],
  ['https://linuxdorss.longpink.com/welfare.xml', 'LINUX DO · 福利羊毛', 'mine'],
  ['https://linuxdorss.longpink.com/news.xml', 'LINUX DO · 前沿快讯', 'mine'],

  // 中文播客 / 内容源
  ['https://ai.linbintalk.com/rss/feed.xml', '小林的博客 · AI 学长', 'mine'],
  ['https://plink.anyfeeder.com/weixin/shudanlaile', '书单来了（微信公众号）', 'mine'],
  ['https://hots.zeabur.app/weread?limit=10?rss=true', '微信读书 · 热门划线', 'mine']
];

// 返回预置源（可按分组过滤）。结构刻意与 OPML 导入的 feeds 数组一致，
// 前端拿到后直接交给 POST /api/rss/opml 即可复用同一条导入逻辑。
export function listPresets(group) {
  const want = group && group !== 'all' ? String(group) : null;
  return [...PRESETS, ...GITHUB_PRESETS, ...FOLO_PRESETS]
    .filter(([, , g]) => !want || g === want)
    .map(([feed_url, title, g]) => ({ feed_url, title, group: g }));
}

export function presetCount() {
  return PRESETS.length + GITHUB_PRESETS.length + FOLO_PRESETS.length;
}
