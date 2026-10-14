// 博客阅读页（Halo / cosolar 分区）
//
// 排版本体已抽到 components/ArticleReader.jsx（2026-10-14）—— Notion 博客分区
// 复用的就是同一个骨架。这里只负责「按 id 取文章 + 分类」，再把数据交给骨架渲染。
// 可见行为与抽出前完全一致（封面头图 / 滚动进度条 / 悬浮目录 / 图片放大 / 底部工具栏）。
import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { ArticleReader, countWords } from '../components/ArticleReader.jsx';
import { fmtDate } from '../lib/dates.js';
import { Icon } from '../components/Icon.jsx';
import { LoadingState, ErrorState } from '../components/StateView.jsx';
import { BlogDock } from '../components/BlogDock.jsx';

export function PostView({ id }) {
  const { isAuthenticated } = useAuth();
  const [post, setPost] = useState(null);
  const [cats, setCats] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    setPost(null); setError('');
    (async () => {
      try {
        const [p, c] = await Promise.all([api.getPost(id), api.listCategories().catch(() => [])]);
        setPost(p); setCats(c || []);
      } catch (e) { setError(e.message); }
    })();
    window.scrollTo(0, 0);
  }, [id]);

  if (error) return <ErrorState title="文章加载失败" message={error} />;
  if (!post) return <LoadingState shape="text" count={6} />;

  const cat = cats.find((c) => c.id === post.category_id);
  const words = countWords(post.content);

  return (
    <ArticleReader
      title={post.title}
      content={post.content}
      cover={post.cover_path}
      badge={cat ? <span class="cs-badge pv-cat">{cat.name}</span> : null}
      backTo="/posts"
      backLabel="博客"
      meta={(
        <>
          <span><Icon name="calendar" size={13} /> {fmtDate(post.published_at || post.created_at)}</span>
          <span><Icon name="pencil" size={13} /> {words.toLocaleString()} 字</span>
          <span><Icon name="clock" size={13} /> 约 {Math.max(1, Math.round(words / 400))} 分钟</span>
          {post.status !== 'published' && <span>草稿</span>}
          {isAuthenticated && <button class="pv-edit" onClick={() => route(`/posts/${post.id}/edit`)}>编辑</button>}
        </>
      )}
      tags={post.tags || []}
      linkedResources={post.linked_resources || []}
      dock={<BlogDock />}
    />
  );
}
