// 博客首页 —— 复刻 halo-theme-cosolar（极简笔记）的外观与交互（2026-10-09）
// cosolar 为 GPL-3.0 的 Halo Thymeleaf 主题，这里不拷贝其代码，只按其设计用 Preact 重新实现：
//   青绿主色 · 精选轮播（无精选时回退到最新文章）· 分类导航 · 最新/最早切换的文章卡片列表 + 分页
//   · 右侧栏：博主卡 / 热门标签 / 专题类别 / 近期更新
// 文章没有封面时，统一使用旧站 cosolar 的默认封面图（用户要求，2026-10-09）。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { useBlogData, invalidateBlogData, dateOf, fmtDate } from '../lib/blogData.js';
import { BlogDock, BlogLinks } from '../components/BlogDock.jsx';
// 卡片与封面在 2026-10-14 抽到 components/PostCard.jsx：
// Notion 博客分区（/notion）复用的就是同一个卡片，见该文件顶部说明。
import { PostCard, PostCover } from '../components/PostCard.jsx';
import { PostHeatmap } from '../components/PostHeatmap.jsx';
import { ContentChartsPanel } from '../components/ContentChartsPanel.jsx';
// 横幅与默认封面的地址统一放在 lib/blogMedia.js（原先写在本文件里）
import { BANNERS } from '../lib/blogMedia.js';
import { useAuth } from '../lib/auth.jsx';
import { LoadingState, ErrorState } from '../components/StateView.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { Icon } from '../components/Icon.jsx';

const PAGE_SIZE = 10;
const SLIDES = 5;

export function Posts({ cat: catParam, tag: tagParam, focus }) {
  const { isAuthenticated } = useAuth();
  const { data, error: loadError, loading, reload } = useBlogData(isAuthenticated);
  const posts = data?.posts || [];
  const cats = data?.cats || [];
  const tags = data?.tags || [];
  const [error, setError] = useState('');
  const [sort, setSort] = useState('new');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [slide, setSlide] = useState(0);
  const [bannerIdx, setBannerIdx] = useState(0);
  const searchRef = useRef(null);

  // 分类 / 标签筛选放在 URL 上（/posts?cat=slug、/posts?tag=slug），方便分享和从聚合页跳回
  const findBy = (list, v) => (v ? list.find((x) => x.slug === v || x.id === v) : null);
  const cat = findBy(cats, catParam)?.id || 'all';
  const tag = findBy(tags, tagParam)?.id || '';
  const slugOf = (list, id) => { const x = list.find((y) => y.id === id); return encodeURIComponent(x?.slug || id); };
  const setCat = (id) => route(id === 'all' ? '/posts' : `/posts?cat=${slugOf(cats, id)}`);
  const setTag = (id) => route(id ? `/posts?tag=${slugOf(tags, id)}` : '/posts');
  const load = reload;

  useEffect(() => {
    if (focus === 'search' && searchRef.current) { searchRef.current.focus(); searchRef.current.scrollIntoView({ block: 'center' }); }
  }, [focus, loading]);

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

  useEffect(() => {
    if (BANNERS.length < 2) return undefined;
    const t = setInterval(() => setBannerIdx((i) => (i + 1) % BANNERS.length), 8000);
    return () => clearInterval(t);
  }, []);

  async function remove(id) {
    if (!confirm('确定删除该文章？')) return;
    try { await api.deletePost(id); invalidateBlogData(); await load(); } catch (e) { setError(e.message); }
  }

  function goPage(n) {
    setPage(n);
    document.querySelector('.cs-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (loading && !data) return <LoadingState shape="card" />;
  if (loadError && !data) return <ErrorState title="博客加载失败" message={loadError} onRetry={load} />;

  const cur = featured[slide] || featured[0];

  return (
    <section class="cs">
      {/* —— 顶部横幅：博客名 + 大搜索框 + 分类/标签/归档入口 —— */}
      <header class="cs-banner">
        <div class="cs-banner-bg" aria-hidden="true">
          {BANNERS.map((src, i) => <img key={src} src={src} alt="" class={i === bannerIdx ? 'on' : ''} />)}
        </div>
        <div class="cs-banner-inner">
          {/* 横幅站名（2026-10-12 用户要求）：由「Dora 的博客」改成英文
              「The Blog of Dora」——该大写的大写（标题大小写）。 */}
          <h1>The Blog of Dora</h1>
          <p>记录学习、技术与生活 · 共 {posts.length} 篇文章</p>
          <label class="cs-search cs-search-lg">
            <Icon name="search" size={18} />
            <input ref={searchRef} type="search" placeholder="搜索文章标题或摘要…" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
          </label>
          <div class="cs-banner-links">
            <BlogLinks />
            {/* Notion 博客入口（2026-10-14）：Notion（NotionNext）迁来的那批文章单独一区，
                与本站 Halo 博客**数据层完全隔离**，但排版复用同一套。按钮放在「写文章」旁边，
                走站内 SPA 路由 /notion（不是外链，参照影视页「增强版影视库」的按钮形态）。 */}
            <a class="btn cs-notion" href="/notion" onClick={(e) => { e.preventDefault(); route('/notion'); }}
              title="打开 Notion 迁移过来的文章（独立分区）">
              <Icon name="sparkles" size={14} /> Notion 博客
            </a>
            {isAuthenticated && (
              <button class="primary cs-new" onClick={() => route('/posts/new')}><Icon name="plus" size={14} /> 写文章</button>
            )}
          </div>
        </div>
      </header>


      {/* —— 精选轮播 —— */}
      {cur && cat === 'all' && !tag && !q && (
        <div class="cs-hero">
          <article class="cs-hero-card" onClick={() => route(`/posts/${cur.id}`)} role="button" tabindex={0}>
            <div class="cs-hero-cover"><PostCover src={cur.cover_path} /></div>
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
              {(cat !== 'all' || tag) && <button class="cs-clear" onClick={() => setCat('all')}>× 查看全部</button>}
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
              <PostCard
                key={p.id}
                post={p}
                cover={p.cover_path}
                category={c || null}
                tags={(p.tag_ids || []).map((id) => tagMap.get(id)).filter(Boolean)}
                meta={<span><Icon name="calendar" size={13} /> {fmtDate(dateOf(p))}</span>}
                onOpen={() => route(`/posts/${p.id}`)}
                onTag={(t) => setTag(t.id)}
                onCategory={() => setCat(c.id)}
                admin={isAuthenticated ? {
                  onEdit: () => route(`/posts/${p.id}/edit`),
                  onDelete: () => remove(p.id)
                } : null}
              />
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
                <button key={t.id} class={tag === t.id ? 'on' : ''} onClick={() => setTag(tag === t.id ? '' : t.id)}>
                  {t.name}<small>{tagCount.get(t.id)}</small>
                </button>
              ))}
            </div>
          </div>

          <div class="cs-box">
            <div class="cs-box-head"><Icon name="layers" size={14} /> 专题类别</div>
            <div class="cs-catlist">
              {usedCats.map((c) => (
                <button key={c.id} class={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>
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
      {/* 发文热力图（2026-10-18，图鉴 #102）：用**真实**文章发布日期统计，
          不是装饰性假数据。
          为什么放主内容区底部而不是侧栏：它宽 53 周 ≈ 848px，塞进 300px 的
          侧栏只能横向滚动，体验很差；放在整宽区域才能一屏看完。 */}
      <div class="cs-box cs-box-heat">
        <PostHeatmap posts={posts} />
      </div>

      {/* 真实数据图表（2026-10-18，图鉴 #170/#172/#176/#197）：
          全部用站内真实文章聚合，不是演示数据。放在热力图下面、同一片区域 ——
          它们是「回顾性」信息，不该打断阅读流。 */}
      <ContentChartsPanel posts={posts} cats={cats} tags={tags} />

      {error && <div class="notice danger">{error}</div>}
      <BlogDock active={focus === 'search' ? 'search' : 'home'} />
    </section>
  );
}
