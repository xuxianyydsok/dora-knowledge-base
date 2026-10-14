// Notion 博客阅读页（/notion/:slug）
//
// 排版本体与 Halo 博客阅读页**共用同一个骨架** components/ArticleReader.jsx
// （封面头图 / 顶部滚动进度条 / 桌面悬浮目录 / 移动端目录抽屉 / 图片点击放大）。
// 这里只负责两件 Notion 侧独有的事：
//   1) 用独立接口按 slug 取正文（/api/notion-posts/slug/:slug，与 posts 的接口不相干）；
//   2) 把 Notion 原文的层级补回来 —— 顶部父页面面包屑、正文末尾的子页面 / 同目录其它页。
import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { fmtDate } from '../lib/dates.js';
import { ArticleReader, countWords } from '../components/ArticleReader.jsx';
import { BlogDock } from '../components/BlogDock.jsx';
import { Icon } from '../components/Icon.jsx';
import { LoadingState, ErrorState } from '../components/StateView.jsx';

const DOCK = [
  { key: 'notion', label: 'Notion', icon: 'blog', to: '/notion' },
  { key: 'halo', label: '博客', icon: 'layers', to: '/posts' }
];

// Notion 页面的 emoji 图标（有就前置到标题里，原稿的样子能保留一点）
const withIcon = (p) => (p.notion_icon ? `${p.notion_icon} ` : '');

export function NotionPostView({ slug }) {
  const { isAuthenticated } = useAuth();
  const [post, setPost] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setPost(null); setError('');
    (async () => {
      try { setPost(await api.getNotionPostBySlug(slug)); }
      catch (e) { setError(e.message); }
    })();
    window.scrollTo(0, 0);
  }, [slug]);

  if (error) return <ErrorState title="文章加载失败" message={error} />;
  if (!post) return <LoadingState shape="text" count={6} />;

  const words = countWords(post.content);
  const kids = post.children || [];
  const sibs = post.siblings || [];

  // 正文之前的说明：Notion 空白页 / 原稿自带的备注
  const notice = (post.is_blank || post.notion_summary) ? (
    <div class="nt-notice">
      <Icon name="info" size={15} />
      <span>{post.is_blank ? '这一页在 Notion 里没有正文（是一张空白页），只作为目录占位。' : post.notion_summary}</span>
    </div>
  ) : null;

  // 正文之后：把 Notion 的两层目录结构补回来
  const afterContent = (kids.length > 0 || sibs.length > 0) ? (
    <section class="nt-tree">
      {kids.length > 0 && (
        <>
          <h3><Icon name="list" size={15} /> 本页包含 <small>{kids.length}</small></h3>
          <div class="nt-tree-list">
            {kids.map((k) => (
              <button key={k.id} class="nt-tree-item" onClick={() => route(`/notion/${encodeURIComponent(k.slug)}`)}>
                <span class="nt-tree-title">{withIcon(k)}{k.title}</span>
                {k.is_blank && <small>空白页</small>}
                {!k.is_blank && k.excerpt && <small>{k.excerpt}</small>}
              </button>
            ))}
          </div>
        </>
      )}
      {sibs.length > 0 && (
        <>
          <h3><Icon name="layers" size={15} /> 同目录其它页 <small>{sibs.length}</small></h3>
          <div class="nt-tree-list">
            {sibs.map((s) => (
              <button key={s.id} class="nt-tree-item" onClick={() => route(`/notion/${encodeURIComponent(s.slug)}`)}>
                <span class="nt-tree-title">{withIcon(s)}{s.title}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  ) : null;

  return (
    <ArticleReader
      title={post.title}
      content={post.content}
      cover={post.cover_path}
      badge={post.notion_category ? <span class="cs-badge pv-cat">{post.notion_category}</span> : null}
      backTo="/notion"
      backLabel="Notion 博客"
      meta={(
        <>
          {post.parent && (
            <button class="pv-parent" title="回到父页面"
              onClick={() => route(`/notion/${encodeURIComponent(post.parent.slug)}`)}>
              <Icon name="arrowLeft" size={13} /> {post.parent.title}
            </button>
          )}
          <span><Icon name="calendar" size={13} /> {fmtDate(post.published_at || post.created_at)}</span>
          <span><Icon name="pencil" size={13} /> {words.toLocaleString()} 字</span>
          <span><Icon name="clock" size={13} /> 约 {Math.max(1, Math.round(words / 400))} 分钟</span>
          {post.is_subpage && <span class="nt-flag">子页</span>}
          {post.status !== 'published' && <span>草稿</span>}
          {isAuthenticated && <span class="nt-flag">Notion 分区</span>}
        </>
      )}
      tags={(post.tags || []).map((name) => ({ name }))}
      notice={notice}
      afterContent={afterContent}
      dock={<BlogDock items={DOCK} active="notion" />}
    />
  );
}
