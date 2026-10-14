// 日期小工具（2026-10-14 从 lib/blogData.js 抽出）
//
// 抽出的理由：Notion 博客分区（/notion）也要用同一套日期口径，但它不该去 import
// 一个「Halo 博客数据模块」。这里是纯函数、零依赖，谁都能引。
// blogData.js 仍然把它们原样再导出一次，所以原先的 import 路径全部照旧可用。

// 取文章的「展示日期」：优先发布时间，草稿等没有发布时间的回落到创建时间
export const dateOf = (p) => p.published_at || p.created_at;

// 统一成 YYYY-MM-DD（无法解析时返回空串，不显示 Invalid Date）
export function fmtDate(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
