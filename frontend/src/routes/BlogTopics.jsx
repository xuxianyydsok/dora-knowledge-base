// 博客分类聚合 / 标签聚合页（cosolar 风格，自行实现，2026-10-09）
// mode="categories"：每个分类一张卡（篇数 + 最新 3 篇）；mode="tags"：按文章数排序的标签云
import { useMemo } from 'preact/hooks';
import { route } from 'preact-router';
import { useAuth } from '../lib/auth.jsx';
import { useBlogData, dateOf, fmtDate } from '../lib/blogData.js';
import { BlogDock, BlogLinks } from '../components/BlogDock.jsx';
import { LoadingState, ErrorState } from '../components/StateView.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { Icon } from '../components/Icon.jsx';

export function BlogTopics({ mode = 'categories' }) {
  const { isAuthenticated } = useAuth();
  const { data, error, loading, reload } = useBlogData(isAuthenticated);
  const isCat = mode === 'categories';

  const groups = useMemo(() => {
    if (!data) return [];
    const src = isCat ? data.cats : data.tags;
    return src.map((x) => ({
      ...x,
      posts: data.posts.filter((p) => (isCat ? p.category_id === x.id : (p.tag_ids || []).includes(x.id)))
    })).filter((g) => g.posts.length).sort((a, b) => b.posts.length - a.posts.length);
  }, [data, isCat]);

  if (loading && !data) return <LoadingState shape="card" />;
  if (error && !data) return <ErrorState title="加载失败" message={error} onRetry={reload} />;

  const open = (g) => route(`/posts?${isCat ? 'cat' : 'tag'}=${encodeURIComponent(g.slug || g.id)}`);
  const max = groups[0]?.posts.length || 1;

  return (
    <section class="cs cs-page">
      <header class="cs-page-head">
        <button class="cs-back" onClick={() => route('/posts')}><Icon name="arrowLeft" size={14} /> 博客</button>
        <h1>{isCat ? '专题分类' : '标签'}</h1>
        <p>{groups.length} 个{isCat ? '分类' : '标签'} · {data.posts.length} 篇文章</p>
        <BlogLinks active={mode} />
      </header>

      {groups.length === 0 ? <EmptyState icon="blog" title="暂无内容" /> : isCat ? (
        <div class="cs-topic-grid">
          {groups.map((g) => (
            <article key={g.id} class="cs-topic" role="button" tabindex={0} onClick={() => open(g)}
              onKeyDown={(e) => { if (e.key === 'Enter') open(g); }}>
              <div class="cs-topic-head">
                <span class="cs-topic-icon">{g.name.charAt(0)}</span>
                <div><h3>{g.name}</h3><small>{g.posts.length} 篇文章</small></div>
                <Icon name="chevronRight" size={16} />
              </div>
              {g.description && <p class="cs-topic-desc">{g.description}</p>}
              <ul>
                {g.posts.slice(0, 3).map((p) => (
                  <li key={p.id}>
                    <a href={`/posts/${p.id}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); route(`/posts/${p.id}`); }}>{p.title}</a>
                    <time>{fmtDate(dateOf(p))}</time>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      ) : (
        <div class="cs-box cs-tagwall">
          {groups.map((g) => (
            <button key={g.id} onClick={() => open(g)} style={{ fontSize: `${13 + Math.round((g.posts.length / max) * 9)}px` }}>
              # {g.name}<small>{g.posts.length}</small>
            </button>
          ))}
        </div>
      )}
      <BlogDock active={mode} />
    </section>
  );
}
