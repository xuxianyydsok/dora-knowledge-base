// 博客阅读页 —— 复刻 halo-theme-cosolar 的阅读体验（自行实现，2026-10-09）
// 顶部渐变阅读进度条 · 封面头图 · 桌面端右侧悬浮目录（滚动高亮）· 移动端目录抽屉
// · 图片点击放大（滚轮/按钮缩放、拖动、ESC 关闭）· 长文排版
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { PostRenderer } from '../components/PostRenderer.jsx';
import { Icon } from '../components/Icon.jsx';
import { LoadingState, ErrorState } from '../components/StateView.jsx';
import { DEFAULT_COVER } from './Posts.jsx';

function fmtDate(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// —— 图片查看器 ——
function ImageViewer({ src, onClose }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setScale((s) => Math.min(6, s * 1.25));
      if (e.key === '-') setScale((s) => Math.max(0.3, s / 1.25));
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, []);
  const zoom = (f) => setScale((s) => Math.min(6, Math.max(0.3, s * f)));
  return (
    <div class="pv-viewer" onClick={onClose}
      onWheel={(e) => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15); }}>
      <img src={src} alt="" draggable={false}
        style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, cursor: drag.current ? 'grabbing' : 'grab' }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }; }}
        onPointerMove={(e) => { if (drag.current) setPos({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }); }}
        onPointerUp={() => { drag.current = null; }} />
      <div class="pv-viewer-bar" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => zoom(1 / 1.25)} aria-label="缩小">−</button>
        <span>{Math.round(scale * 100)}%</span>
        <button onClick={() => zoom(1.25)} aria-label="放大">+</button>
        <button onClick={() => { setScale(1); setPos({ x: 0, y: 0 }); }}>还原</button>
        <button onClick={onClose} aria-label="关闭"><Icon name="close" size={15} /></button>
      </div>
    </div>
  );
}

export function PostView({ id }) {
  const { isAuthenticated } = useAuth();
  const [post, setPost] = useState(null);
  const [cats, setCats] = useState([]);
  const [error, setError] = useState('');
  const [toc, setToc] = useState([]);
  const [active, setActive] = useState('');
  const [progress, setProgress] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const [viewer, setViewer] = useState('');
  const bodyRef = useRef(null);

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

  // 正文渲染后：生成目录、给图片挂查看器
  useEffect(() => {
    const root = bodyRef.current?.querySelector('.post-content');
    if (!root) return undefined;
    const hs = [...root.querySelectorAll('h1, h2, h3')];
    hs.forEach((h, i) => { if (!h.id) h.id = `h-${i}`; });
    setToc(hs.map((h) => ({ id: h.id, text: h.textContent.trim(), level: h.tagName === 'H3' ? 2 : 1 })).filter((x) => x.text));
    const onClick = (e) => {
      const img = e.target.closest('img');
      if (img && root.contains(img)) setViewer(img.currentSrc || img.src);
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [post]);

  // 阅读进度 + 当前章节高亮
  useEffect(() => {
    const onScroll = () => {
      const el = bodyRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      setProgress(Math.min(100, Math.max(0, total > 0 ? (-rect.top / total) * 100 : 100)));
      let cur = '';
      for (const t of toc) {
        const h = document.getElementById(t.id);
        if (h && h.getBoundingClientRect().top < 110) cur = t.id;
      }
      setActive(cur);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [toc, post]);

  const words = useMemo(() => {
    if (!post?.content) return 0;
    return post.content.replace(/<[^>]+>/g, '').replace(/\s+/g, '').length;
  }, [post]);

  function jump(tid) {
    const h = document.getElementById(tid);
    if (h) window.scrollTo({ top: h.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
    setTocOpen(false);
  }

  if (error) return <ErrorState title="文章加载失败" message={error} />;
  if (!post) return <LoadingState shape="text" count={6} />;

  const cat = cats.find((c) => c.id === post.category_id);
  const tocList = (
    <nav class="pv-toc-list">
      {toc.map((t) => (
        <button key={t.id} class={`lv${t.level}${active === t.id ? ' on' : ''}`} onClick={() => jump(t.id)}>{t.text}</button>
      ))}
    </nav>
  );

  return (
    <article class="cs pv">
      <div class="pv-progress" style={{ width: `${progress}%` }} />

      <header class="pv-hero">
        <img src={post.cover_path || DEFAULT_COVER} alt="" />
        <div class="pv-hero-mask" />
        <div class="pv-hero-inner">
          <button class="pv-back" onClick={() => route('/posts')}><Icon name="arrowLeft" size={14} /> 博客</button>
          {cat && <span class="cs-badge pv-cat">{cat.name}</span>}
          <h1>{post.title}</h1>
          <div class="pv-meta">
            <span><Icon name="calendar" size={13} /> {fmtDate(post.published_at || post.created_at)}</span>
            <span><Icon name="pencil" size={13} /> {words.toLocaleString()} 字</span>
            <span><Icon name="clock" size={13} /> 约 {Math.max(1, Math.round(words / 400))} 分钟</span>
            {post.status !== 'published' && <span>草稿</span>}
            {isAuthenticated && <button class="pv-edit" onClick={() => route(`/posts/${post.id}/edit`)}>编辑</button>}
          </div>
        </div>
      </header>

      <div class={`pv-layout${toc.length ? '' : ' no-toc'}`}>
        <div class="pv-body" ref={bodyRef}>
          <PostRenderer content={post.content} />

          {post.tags?.length > 0 && (
            <div class="cs-tags pv-tags">
              {post.tags.map((t) => <span key={t.id} class="cs-tag"># {t.name}</span>)}
            </div>
          )}

          {post.linked_resources?.length > 0 && (
            <section class="pv-linked">
              <h3>关联资源</h3>
              {post.linked_resources.map((r) => (
                <a key={r.id} href={r.url} target="_blank" rel="noreferrer">
                  <small>{r.type}</small><strong>{r.title}</strong>
                  {r.summary && <span>{r.summary}</span>}
                </a>
              ))}
            </section>
          )}
        </div>

        {toc.length > 0 && (
          <aside class="pv-toc">
            <div class="cs-box">
              <div class="cs-box-head"><Icon name="list" size={14} /> 文章目录</div>
              {tocList}
            </div>
          </aside>
        )}
      </div>

      {toc.length > 0 && (
        <button class="pv-toc-fab" onClick={() => setTocOpen(true)} aria-label="目录"><Icon name="list" size={18} /></button>
      )}
      {tocOpen && (
        <div class="pv-drawer" onClick={() => setTocOpen(false)}>
          <div class="pv-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div class="cs-box-head"><Icon name="list" size={14} /> 文章目录</div>
            {tocList}
          </div>
        </div>
      )}
      <button class="pv-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="回到顶部"
        style={{ opacity: progress > 3 ? 1 : 0, pointerEvents: progress > 3 ? 'auto' : 'none' }}>
        <Icon name="chevronDown" size={18} />
      </button>

      {viewer && <ImageViewer src={viewer} onClose={() => setViewer('')} />}
    </article>
  );
}
