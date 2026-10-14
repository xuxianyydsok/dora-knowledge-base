// 博客公共数据（文章 + 分类 + 标签），首页 / 归档 / 分类 / 标签页共用一份缓存（2026-10-09）
import { useEffect, useState } from 'preact/hooks';
import { api } from './api.js';

let cache = null;      // { key, data, at }
const TTL = 60 * 1000;

export function invalidateBlogData() { cache = null; }

// 日期口径统一放在 lib/dates.js（2026-10-14 抽出，Notion 博客分区也用它）；
// 这里原样再导出一次，原先从本文件 import { dateOf, fmtDate } 的地方全部照旧。
//
// ⚠️ 必须先 import 再 export，不能写成 `export { ... } from './dates.js'`：
// 那种「再导出」语法**不会在本模块作用域里创建绑定**，于是下面 useBlogData
// 里用到的 dateOf 会抛 `ReferenceError: dateOf is not defined` —— 博客页整页白屏。
// （2026-10-14 线上事故的根因，用户报「博客加载失败 dateOf is not defined」。）
import { dateOf, fmtDate } from './dates.js';
export { dateOf, fmtDate };

export function useBlogData(isAuthenticated) {
  const key = isAuthenticated ? 'auth' : 'guest';
  const fresh = cache && cache.key === key && Date.now() - cache.at < TTL ? cache.data : null;
  const [data, setData] = useState(fresh);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!fresh);

  async function load(force = false) {
    if (!force && cache && cache.key === key && Date.now() - cache.at < TTL) { setData(cache.data); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      // 三个请求**各自降级**（2026-10-14 修「博客页一直转圈」）：
      //   原来用 Promise.all —— 只要有一个失败（或慢到超时），整页就永远
      //   停在「正在载入…」，用户看不到任何内容。
      //   现在文章是必需的（拿不到才算失败），分类/标签是辅助的（挂了就退化成空数组，
      //   页面照样能读文章，只是侧栏没有分类/标签）。
      const [p, c, t] = await Promise.all([
        api.listPosts('?with_tags=true'),                 // 必需
        api.listCategories().catch(() => []),             // 可选：失败不影响正文
        api.listTags().catch(() => [])                    // 可选
      ]);
      const posts = (p || [])
        .filter((x) => isAuthenticated || x.status === 'published')
        .sort((a, b) => new Date(dateOf(b)) - new Date(dateOf(a)));
      const d = { posts, cats: c || [], tags: t || [] };
      cache = { key, data: d, at: Date.now() };
      setData(d);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [key]);

  return { data, error, loading, reload: () => load(true) };
}
