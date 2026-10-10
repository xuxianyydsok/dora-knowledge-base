// 博客归档：按年 / 月时间线（cosolar 风格，自行实现，2026-10-09）
import { useMemo } from 'preact/hooks';
import { route } from 'preact-router';
import { useAuth } from '../lib/auth.jsx';
import { useBlogData, dateOf, fmtDate } from '../lib/blogData.js';
import { BlogDock, BlogLinks } from '../components/BlogDock.jsx';
import { LoadingState, ErrorState } from '../components/StateView.jsx';
import { Icon } from '../components/Icon.jsx';

export function BlogArchive() {
  const { isAuthenticated } = useAuth();
  const { data, error, loading, reload } = useBlogData(isAuthenticated);

  const years = useMemo(() => {
    const out = [];
    for (const p of data?.posts || []) {
      const d = new Date(dateOf(p));
      const y = d.getFullYear(); const m = d.getMonth() + 1;
      let yr = out.find((x) => x.y === y);
      if (!yr) { yr = { y, months: [], count: 0 }; out.push(yr); }
      let mo = yr.months.find((x) => x.m === m);
      if (!mo) { mo = { m, posts: [] }; yr.months.push(mo); }
      mo.posts.push(p); yr.count += 1;
    }
    return out;
  }, [data]);
  const catMap = useMemo(() => new Map((data?.cats || []).map((c) => [c.id, c])), [data]);

  if (loading && !data) return <LoadingState shape="list" count={8} />;
  if (error && !data) return <ErrorState title="归档加载失败" message={error} onRetry={reload} />;

  return (
    <section class="cs cs-page">
      <header class="cs-page-head">
        <button class="cs-back" onClick={() => route('/posts')}><Icon name="arrowLeft" size={14} /> 博客</button>
        <h1>文章归档</h1>
        <p>共 {data.posts.length} 篇，按时间倒序</p>
        <BlogLinks active="archive" />
      </header>

      <div class="cs-timeline">
        {years.map((yr) => (
          <div key={yr.y} class="cs-year">
            <h2>{yr.y}<small>{yr.count} 篇</small></h2>
            {yr.months.map((mo) => (
              <div key={mo.m} class="cs-month">
                <h3>{mo.m} 月<small>{mo.posts.length} 篇</small></h3>
                <ul>
                  {mo.posts.map((p) => (
                    <li key={p.id}>
                      <a href={`/posts/${p.id}`} onClick={(e) => { e.preventDefault(); route(`/posts/${p.id}`); }}>
                        <time>{fmtDate(dateOf(p)).slice(5)}</time>
                        <span class="cs-tl-title">{p.title}</span>
                        {catMap.get(p.category_id) && <span class="cs-tl-cat">{catMap.get(p.category_id).name}</span>}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>
      <BlogDock active="archive" />
    </section>
  );
}
