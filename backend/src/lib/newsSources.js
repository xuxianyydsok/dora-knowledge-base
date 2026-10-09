// NewsNow 热榜源清单（由 newsnext/newsnow shared/sources.json 生成，MIT）
// 只保留启用中、非重定向、带栏目的源；新增源时同步这里即可
export const NEWS_COLUMNS = [
  { key: "hot", label: "精选" },
  { key: "china", label: "国内" },
  { key: "world", label: "国际" },
  { key: "tech", label: "科技" },
  { key: "finance", label: "财经" },
  { key: "sports", label: "体育" }
];

// 「精选」栏默认展示的源
export const NEWS_FEATURED = [
  "zhihu", "weibo", "baidu", "bilibili-hot-search", "douyin", "toutiao",
  "thepaper", "ithome", "hackernews", "github-trending-today", "wallstreetcn-hot", "cls-hot"
];

export const NEWS_SOURCES = [
  {
    "id": "v2ex-share",
    "name": "V2EX",
    "title": "最新分享",
    "column": "tech",
    "color": "slate",
    "home": "https://v2ex.com/"
  },
  {
    "id": "zhihu",
    "name": "知乎",
    "title": "",
    "column": "china",
    "color": "blue",
    "home": "https://www.zhihu.com"
  },
  {
    "id": "weibo",
    "name": "微博",
    "title": "实时热搜",
    "column": "china",
    "color": "red",
    "home": "https://weibo.com"
  },
  {
    "id": "zaobao",
    "name": "联合早报",
    "title": "",
    "column": "world",
    "color": "red",
    "home": "https://www.zaobao.com"
  },
  {
    "id": "coolapk",
    "name": "酷安",
    "title": "今日最热",
    "column": "tech",
    "color": "green",
    "home": "https://coolapk.com"
  },
  {
    "id": "mktnews-flash",
    "name": "MKTNews",
    "title": "快讯",
    "column": "finance",
    "color": "indigo",
    "home": "https://mktnews.net"
  },
  {
    "id": "wallstreetcn-quick",
    "name": "华尔街见闻",
    "title": "快讯",
    "column": "finance",
    "color": "blue",
    "home": "https://wallstreetcn.com/"
  },
  {
    "id": "wallstreetcn-news",
    "name": "华尔街见闻",
    "title": "最新",
    "column": "finance",
    "color": "blue",
    "home": "https://wallstreetcn.com/"
  },
  {
    "id": "wallstreetcn-hot",
    "name": "华尔街见闻",
    "title": "最热",
    "column": "finance",
    "color": "blue",
    "home": "https://wallstreetcn.com/"
  },
  {
    "id": "douyin",
    "name": "抖音",
    "title": "",
    "column": "china",
    "color": "gray",
    "home": "https://www.douyin.com"
  },
  {
    "id": "hupu",
    "name": "虎扑",
    "title": "主干道热帖",
    "column": "sports",
    "color": "red",
    "home": "https://hupu.com"
  },
  {
    "id": "dongqiudi",
    "name": "懂球帝",
    "title": "头条",
    "column": "sports",
    "color": "green",
    "home": "https://www.dongqiudi.com"
  },
  {
    "id": "aihot",
    "name": "AIHOT",
    "title": "",
    "column": "tech",
    "color": "blue",
    "home": "https://aihot.virxact.com/all"
  },
  {
    "id": "tieba",
    "name": "百度贴吧",
    "title": "热议",
    "column": "china",
    "color": "blue",
    "home": "https://tieba.baidu.com"
  },
  {
    "id": "toutiao",
    "name": "今日头条",
    "title": "",
    "column": "china",
    "color": "red",
    "home": "https://www.toutiao.com"
  },
  {
    "id": "ithome",
    "name": "IT之家",
    "title": "",
    "column": "tech",
    "color": "red",
    "home": "https://www.ithome.com"
  },
  {
    "id": "thepaper",
    "name": "澎湃新闻",
    "title": "热榜",
    "column": "china",
    "color": "gray",
    "home": "https://www.thepaper.cn"
  },
  {
    "id": "sputniknewscn",
    "name": "卫星通讯社",
    "title": "",
    "column": "world",
    "color": "orange",
    "home": "https://sputniknews.cn"
  },
  {
    "id": "cankaoxiaoxi",
    "name": "参考消息",
    "title": "",
    "column": "world",
    "color": "red",
    "home": "https://china.cankaoxiaoxi.com"
  },
  {
    "id": "pcbeta-windows11",
    "name": "远景论坛",
    "title": "Win11",
    "column": "tech",
    "color": "blue",
    "home": "https://bbs.pcbeta.com"
  },
  {
    "id": "cls-telegraph",
    "name": "财联社",
    "title": "电报",
    "column": "finance",
    "color": "red",
    "home": "https://www.cls.cn"
  },
  {
    "id": "cls-depth",
    "name": "财联社",
    "title": "深度",
    "column": "finance",
    "color": "red",
    "home": "https://www.cls.cn"
  },
  {
    "id": "cls-hot",
    "name": "财联社",
    "title": "热门",
    "column": "finance",
    "color": "red",
    "home": "https://www.cls.cn"
  },
  {
    "id": "xueqiu-hotstock",
    "name": "雪球",
    "title": "热门股票",
    "column": "finance",
    "color": "blue",
    "home": "https://xueqiu.com"
  },
  {
    "id": "gelonghui",
    "name": "格隆汇",
    "title": "事件",
    "column": "finance",
    "color": "blue",
    "home": "https://www.gelonghui.com"
  },
  {
    "id": "fastbull-express",
    "name": "法布财经",
    "title": "快讯",
    "column": "finance",
    "color": "emerald",
    "home": "https://www.fastbull.cn"
  },
  {
    "id": "fastbull-news",
    "name": "法布财经",
    "title": "头条",
    "column": "finance",
    "color": "emerald",
    "home": "https://www.fastbull.cn"
  },
  {
    "id": "solidot",
    "name": "Solidot",
    "title": "",
    "column": "tech",
    "color": "teal",
    "home": "https://solidot.org"
  },
  {
    "id": "hackernews",
    "name": "Hacker News",
    "title": "",
    "column": "tech",
    "color": "orange",
    "home": "https://news.ycombinator.com/"
  },
  {
    "id": "producthunt",
    "name": "Product Hunt",
    "title": "",
    "column": "tech",
    "color": "red",
    "home": "https://www.producthunt.com/"
  },
  {
    "id": "github-trending-today",
    "name": "Github",
    "title": "Today",
    "column": "tech",
    "color": "gray",
    "home": "https://github.com/"
  },
  {
    "id": "bilibili-hot-search",
    "name": "哔哩哔哩",
    "title": "热搜",
    "column": "china",
    "color": "blue",
    "home": "https://www.bilibili.com"
  },
  {
    "id": "kaopu",
    "name": "靠谱新闻",
    "title": "",
    "column": "world",
    "color": "gray",
    "home": "https://kaopu.news/"
  },
  {
    "id": "jin10",
    "name": "金十数据",
    "title": "",
    "column": "finance",
    "color": "blue",
    "home": "https://www.jin10.com"
  },
  {
    "id": "baidu",
    "name": "百度热搜",
    "title": "",
    "column": "china",
    "color": "blue",
    "home": "https://www.baidu.com"
  },
  {
    "id": "nowcoder",
    "name": "牛客",
    "title": "",
    "column": "china",
    "color": "blue",
    "home": "https://www.nowcoder.com"
  },
  {
    "id": "sspai",
    "name": "少数派",
    "title": "",
    "column": "tech",
    "color": "red",
    "home": "https://sspai.com"
  },
  {
    "id": "juejin",
    "name": "稀土掘金",
    "title": "",
    "column": "tech",
    "color": "blue",
    "home": "https://juejin.cn"
  },
  {
    "id": "ifeng",
    "name": "凤凰网",
    "title": "热点资讯",
    "column": "china",
    "color": "red",
    "home": "https://www.ifeng.com"
  },
  {
    "id": "chongbuluo-latest",
    "name": "虫部落",
    "title": "最新",
    "column": "china",
    "color": "green",
    "home": "https://www.chongbuluo.com/forum.php?mod=guide&view=newthread"
  },
  {
    "id": "chongbuluo-hot",
    "name": "虫部落",
    "title": "最热",
    "column": "china",
    "color": "green",
    "home": "https://www.chongbuluo.com/forum.php?mod=guide&view=hot"
  },
  {
    "id": "douban",
    "name": "豆瓣",
    "title": "热门电影",
    "column": "china",
    "color": "green",
    "home": "https://www.douban.com"
  },
  {
    "id": "steam",
    "name": "Steam",
    "title": "在线人数",
    "column": "world",
    "color": "blue",
    "home": "https://store.steampowered.com"
  },
  {
    "id": "tencent-hot",
    "name": "腾讯新闻",
    "title": "综合早报",
    "column": "china",
    "color": "blue",
    "home": "https://news.qq.com/tag/aEWqxLtdgmQ="
  },
  {
    "id": "freebuf",
    "name": "Freebuf",
    "title": "网络安全",
    "column": "china",
    "color": "green",
    "home": "https://www.freebuf.com/"
  },
  {
    "id": "qqvideo-tv-hotsearch",
    "name": "腾讯视频",
    "title": "热搜榜",
    "column": "china",
    "color": "blue",
    "home": "https://v.qq.com/channel/tv"
  },
  {
    "id": "iqiyi-hot-ranklist",
    "name": "爱奇艺",
    "title": "热播榜",
    "column": "china",
    "color": "green",
    "home": "https://www.iqiyi.com"
  }
];
