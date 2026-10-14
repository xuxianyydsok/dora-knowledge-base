// 博客 / Notion 博客共用的静态媒体常量（2026-10-14 从 routes/Posts.jsx 抽出）
//
// 为什么抽出来：Notion 博客分区要复用同一套排版，而下面这两个常量原本住在 Posts.jsx 里；
// 阅读页（PostView）与新的 Notion 阅读页都要用，放在这里两边都能取，
// 也避免出现「Notion 页面去 import 一个 Halo 页面模块」这种反向依赖。
// 值本身一个都没改。

// 文章没有封面时统一使用的旧站 cosolar 默认封面（1129×678，见 public/blog/NOTICE.md）
export const DEFAULT_COVER = '/blog/default-cover.webp';

// 高清横幅（旧站 featured-default.png 3360×1152 → 2560 宽 WebP）：
// 首页顶部横幅背景 + 无封面文章的阅读页头图
export const BANNER_HD = '/blog/banner-hd.webp';

// 首页横幅背景：多于 1 张时每 8 秒淡入淡出轮换。
// 用户以后提供自己的高清图 / 视频时加到这里（待办见 docs/progress.md 第 3 节）。
export const BANNERS = [BANNER_HD];
