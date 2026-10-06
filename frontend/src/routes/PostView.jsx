// 博客阅读页：渲染正文，展示关联资源与分类标签
import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { PostRenderer } from '../components/PostRenderer.jsx';
import { TagChip } from '../components/TagChip.jsx';

export function PostView({ id }) {
  const [post, setPost] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try { setPost(await api.getPost(id)); }
      catch (e) { setError(e.message); }
    })();
  }, [id]);

  if (error) return <div class="center-box" style="color:var(--danger)">{error}</div>;
  if (!post) return <div class="center-box">加载中…</div>;

  return (
    <article class="stack">
      <div class="toolbar">
        <button onClick={() => route('/posts')}>← 返回列表</button>
        <span class="spacer" />
        <button onClick={() => route(`/posts/${post.id}/edit`)}>编辑</button>
      </div>

      <header class="stack" style="gap:6px">
        <h1 style="margin:0">{post.title}</h1>
        <div class="row" style="gap:10px">
          <span class="muted">{post.status === 'published' ? '已发布' : '草稿'}</span>
          {post.published_at && <span class="muted">{new Date(post.published_at).toLocaleString('zh-CN')}</span>}
        </div>
        {post.heavy_tags?.length > 0 && (
          <div class="row" style="gap:6px;flex-wrap:wrap">
            <span class="muted" style="font-size:12px">含组件：</span>
            {post.heavy_tags.map((t) => <span class="tag-chip" key={t}>{t}</span>)}
          </div>
        )}
      </header>

      {post.cover_path && <img src={post.cover_path} alt={post.title} style="max-width:100%;border-radius:var(--radius)" />}

      <PostRenderer content={post.content} />

      {post.linked_resources?.length > 0 && (
        <section class="stack">
          <h3 style="margin:0">关联资源</h3>
          <div class="gallery-grid">
            {post.linked_resources.map((r) => (
              <div class="card" key={r.id}>
                <div class="card-body">
                  <span class="muted" style="font-size:12px">{r.type}</span>
                  <a href={r.url} target="_blank" rel="noreferrer"><strong>{r.title}</strong></a>
                  {r.summary && <p class="card-desc">{r.summary}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
