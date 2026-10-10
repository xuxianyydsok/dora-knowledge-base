// 博客首页 —— 复刻 halo-theme-cosolar（极简笔记）的外观与交互（2026-10-09）
// cosolar 为 GPL-3.0 的 Halo Thymeleaf 主题，这里不拷贝其代码，只按其设计用 Preact 重新实现：
//   青绿主色 · 精选轮播（无精选时回退到最新文章）· 分类导航 · 最新/最早切换的文章卡片列表 + 分页
//   · 右侧栏：博主卡 / 热门标签 / 专题类别 / 近期更新
// 文章没有封面时，按分类生成渐变封面（旧站文章都是默认占位图）。
import { useEffect, useMemo, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { LoadingState, ErrorState } from '../components/StateView.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { Icon } from '../components/Icon.jsx';

const PAGE_SIZE = 10;
const SLIDES = 5;

function hashHue(s) {
  let h = 0;
  for (const ch of String(s || '')) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}
function coverStyle(seed) {
  const h = (hashHue(seed) + 150) % 360;
  return { backgroundImage: `linear-gradient(135deg, hsl(${h} 62% 46%), hsl(${(h + 40) % 360} 70% 58%))` };
}
function fmtDate(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const dateOf = (p) => p.published_at || p.created_at;

function Cover({ post, category, large }) {
  if (post.cover_path) return <img class="cs-cover-img" src={post.cover_path} alt="" loading="lazy" />;
  const label = category?.name || '随笔';
  return (
    <div class={`cs-cover-gen${large ? ' lg' : ''}`} style={coverStyle(label)}>
      <span class="cs-cover-mark">{label.charAt(0)}</span>
      <span class="cs-cover-label">{label}</span>
    </div>
  );
}

export function Posts() {
  const { isAuthenticated } = useAuth();
  const [posts, setPosts] = useState([]);
  const [cats, setCats] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cat, setCat] = useState('all');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState('new');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [slide, setSlide] = useState(0);

  async function load() {
    setLoading(true); setError('');
    try {
      const [p, c, t] = await Promise.all([api.listPosts('?with_tags=true'), api.listCategories(), api.listTags()]);
      setPosts((p || []).filter((x) => isAuthenticated || x.status === 'published'));
      setCats(c || []); setTags(t || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [isAuthenticated]);

  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);
  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  const byDate = useMemo(
    () => [...posts].sort((a, b) => new Date(dateOf(b)) - new Date(dateOf(a))),
    [posts]
  );
  const catCount = useMemo(() => {
    const m = new Map();
    for (const p of posts) m.set(p.category_id, (m.get(p.category_id) || 0) + 1);
    return m;
  }, [posts]);
  const tagCount = useMemo(() => {
    const m = new Map();
    for (const p of posts) for (const id of p.tag_ids || []) m.set(id, (m.get(id) || 0) + 1);
    return m;
  }, [posts]);
  const usedCats = useMemo(
    () => cats.filter((c) => catCount.get(c.id)).sort((a, b) => catCount.get(b.id) - catCount.get(a.id)),
    [cats, catCount]
  );
  const hotTags = useMemo(
    () => tags.filter((t) => tagCount.get(t.id)).sort((a, b) => tagCount.get(b.id) - tagCount.get(a.id)).slice(0, 20),
    [tags, tagCount]
  );

  const list = useMemo(() => {
    let l = sort === 'new' ? byDate : [...byDate].reverse();
    if (cat !== 'all') l = l.filter((p) => p.category_id === cat);
    if (tag) l = l.filter((p) => (p.tag_ids || []).includes(tag));
    const kw = q.trim().toLowerCase();
    if (kw) l = l.filter((p) => `${p.title} ${p.excerpt || ''}`.toLowerCase().includes(kw));
    return l;
  }, [byDate, sort, cat, tag, q]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const shown = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [cat, tag, sort, q]);

  // 精选轮播：最新 5 篇，6 秒自动切换
  const featured = byDate.slice(0, SLIDES);
  useEffect(() => {
    if (featured.length < 2) return undefined;
    const t = setInterval(() => setSlide((s) => (s + 1) % featured.length), 6000);
    return () => clearInterval(t);
  }, [featured.length]);

  async function remove(id) {
    if (!confirm('确定删除该文章？')) return;
    try { await api.deletePost(id); await load(); } catch (e) { setError(e.message); }
  }

  function goPage(n) {
    setPage(n);
    document.querySelector('.cs-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (loading) return <LoadingState shape="card" />;
  if (error && !posts.length) return <ErrorState title="博客加载失败" message={error} onRetry={load} />;

  const cur = featured[slide] || featured[0];

  return (
    <section class="cs">
      {/* —— 分类导航 —— */}
      <nav class="cs-nav">
        <button class={cat === 'all' && !tag ? 'on' : ''} onClick={() => { setCat('all'); setTag(''); }}>首页</button>
        {usedCats.map((c) => (
          <button key={c.id} class={cat === c.id ? 'on' : ''} onClick={() => { setCat(c.id); setTag(''); }}>{c.name}</button>
        ))}
        <span class="spacer" />
        <label class="cs-search">
          <Icon name="search" size={14} />
          <input placeholder="搜索文章" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
        </label>
        {isAuthenticated && (
          <button class="primary cs-new" onClick={() => route('/posts/new')}><Icon name="plus" size={14} /> 写文章</button>
        )}
      </nav>

      {/* —— 精选轮播 —— */}
      {cur && cat === 'all' && !tag && !q && (
        <div class="cs-hero">
          <article class="cs-hero-card" onClick={() => route(`/posts/${cur.id}`)} role="button" tabindex={0}>
            <div class="cs-hero-cover"><Cover post={cur} category={catMap.get(cur.category_id)} large /></div>
            <div class="cs-hero-body">
              <span class="cs-badge">最新发布</span>
              <h2>{cur.title}</h2>
              {cur.excerpt && <p>{cur.excerpt}</p>}
              <div class="cs-tags">
                {(cur.tag_ids || []).slice(0, 4).map((id) => tagMap.get(id) && <span key={id} class="cs-tag"># {tagMap.get(id).name}</span>)}
              </div>
              <div class="cs-meta">
                <span><Icon name="layers" size={13} /> {catMap.get(cur.category_id)?.name || '未分类'}</span>
                <span><Icon name="calendar" size={13} /> {fmtDate(dateOf(cur))}</span>
                <span class="cs-more">阅读全文 <Icon name="arrowRight" size={13} /></span>
              </div>
            </div>
          </article>
          <div class="cs-dots">
            {featured.map((p, i) => (
              <button key={p.id} class={i === slide ? 'on' : ''} aria-label={`第 ${i + 1} 篇`} onClick={() => setSlide(i)} />
            ))}
          </div>
        </div>
      )}

      <div class="cs-layout">
        {/* —— 文章列表 —— */}
        <div class="cs-main">
          <div class="cs-list-head">
            <h3>
              {tag ? `# ${tagMap.get(tag)?.name}` : cat !== 'all' ? catMap.get(cat)?.name : '最新文章'}
              <small>{list.length} 篇</small>
            </h3>
            <div class="cs-seg">
              <button class={sort === 'new' ? 'on' : ''} onClick={() => setSort('new')}>最新</button>
              <button class={sort === 'old' ? 'on' : ''} onClick={() => setSort('old')}>最早</button>
            </div>
          </div>

          {shown.length === 0 ? (
            <EmptyState icon="blog" title="没有符合条件的文章" hint="换个分类、标签或关键词试试。" />
          ) : shown.map((p) => {
            const c = catMap.get(p.category_id);
            return (
              <article key={p.id} class="cs-card" role="button" tabindex={0}
                onClick={() => route(`/posts/${p.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter') route(`/posts/${p.id}`); }}>
                <div class="cs-card-cover"><Cover post={p} category={c} /></div>
                <div class="cs-card-body">
                  <h4>{p.status !== 'published' && <span class="cs-draft">草稿</span>}{p.title}</h4>
                  {p.excerpt && <p>{p.excerpt}</p>}
                  <div class="cs-tags">
                    {(p.tag_ids || []).slice(0, 3).map((id) => tagMap.get(id) && (
                      <button key={id} class="cs-tag" onClick={(e) => { e.stopPropagation(); setTag(id); setCat('all'); }}>
                        # {tagMap.get(id).name}
                      </button>
                    ))}
                  </div>
                  <div class="cs-meta">
                    {c && (
                      <button class="cs-meta-link" onClick={(e) => { e.stopPropagation(); setCat(c.id); setTag(''); }}>
                        <Icon name="layers" size={13} /> {c.name}
                      </button>
                    )}
                    <span><Icon name="calendar" size={13} /> {fmtDate(dateOf(p))}</span>
                    {isAuthenticated && (
                      <span class="cs-admin">
                        <button onClick={(e) => { e.stopPropagation(); route(`/posts/${p.id}/edit`); }}>编辑</button>
                        <button class="danger" onClick={(e) => { e.stopPropagation(); remove(p.id); }}>删除</button>
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {pages > 1 && (
            <div class="cs-pager">
              <button disabled={page <= 1} onClick={() => goPage(page - 1)}>上一页</button>
              <span>{page} / {pages}</span>
              <button disabled={page >= pages} onClick={() => goPage(page + 1)}>下一页</button>
            </div>
          )}
        </div>

        {/* —— 侧边栏 —— */}
        <aside class="cs-side">
          <div class="cs-box cs-owner">
            <div class="cs-avatar">D</div>
            <h4>Dora</h4>
            <p>记录技术成长，分享解决方案</p>
            <div class="cs-stats">
              <span><b>{posts.length}</b>文章</span>
              <span><b>{usedCats.length}</b>分类</span>
              <span><b>{tags.filter((t) => tagCount.get(t.id)).length}</b>标签</span>
            </div>
          </div>

          <div class="cs-box">
            <div class="cs-box-head"><Icon name="tag" size={14} /> 热门标签</div>
            <div class="cs-cloud">
              {hotTags.map((t) => (
                <button key={t.id} class={tag === t.id ? 'on' : ''} onClick={() => { setTag(tag === t.id ? '' : t.id); setCat('all'); }}>
                  {t.name}<small>{tagCount.get(t.id)}</small>
                </button>
              ))}
            </div>
          </div>

          <div class="cs-box">
            <div class="cs-box-head"><Icon name="layers" size={14} /> 专题类别</div>
            <div class="cs-catlist">
              {usedCats.map((c) => (
                <button key={c.id} class={cat === c.id ? 'on' : ''} onClick={() => { setCat(c.id); setTag(''); }}>
                  <span>{c.name}</span><small>{catCount.get(c.id)} 篇</small>
                </button>
              ))}
            </div>
          </div>

          <div class="cs-box">
            <div class="cs-box-head"><Icon name="clock" size={14} /> 近期更新</div>
            <div class="cs-recent">
              {byDate.slice(0, 5).map((p) => (
                <button key={p.id} onClick={() => route(`/posts/${p.id}`)}>
                  <span class="cs-new-badge">NEW</span>
                  <span class="cs-recent-title">{p.title}</span>
                  <small>{fmtDate(dateOf(p))}</small>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
