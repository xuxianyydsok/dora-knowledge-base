// 博客公共数据（文章 + 分类 + 标签），首页 / 归档 / 分类 / 标签页共用一份缓存（2026-10-09）
import { useEffect, useState } from 'preact/hooks';
import { api } from './api.js';

let cache = null;      // { key, data, at }
const TTL = 60 * 1000;

export function invalidateBlogData() { cache = null; }

export const dateOf = (p) => p.published_at || p.created_at;
export function fmtDate(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
      const [p, c, t] = await Promise.all([api.listPosts('?with_tags=true'), api.listCategories(), api.listTags()]);
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
