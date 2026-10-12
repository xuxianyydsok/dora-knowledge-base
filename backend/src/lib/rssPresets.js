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
  { key: 'dev', label: '开发者博客', desc: '中文技术博客与社区' }
];

// 返回预置源（可按分组过滤）。结构刻意与 OPML 导入的 feeds 数组一致，
// 前端拿到后直接交给 POST /api/rss/opml 即可复用同一条导入逻辑。
export function listPresets(group) {
  const want = group && group !== 'all' ? String(group) : null;
  return PRESETS
    .filter(([, , g]) => !want || g === want)
    .map(([feed_url, title, g]) => ({ feed_url, title, group: g }));
}

export function presetCount() {
  return PRESETS.length;
}
