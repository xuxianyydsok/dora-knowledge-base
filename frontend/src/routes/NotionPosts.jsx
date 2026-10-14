// Notion 博客（/notion）—— Notion（NotionNext + Vercel）迁过来的文章分区
//
// 用户要求（2026-10-14）：
//   · 「单独的拿一个接口出来，用来存放它的 Notion 里面的博客内容，避免和前面的这个博客产生冲突」
//     → 数据层完全独立：独立表 notion_posts + 独立接口 /api/notion-posts（见 backend/src/routes/notion.js）
//   · 「也同样需要像这个博客的内容一样，也要做好分类，然后做好排布」
//     → 按 Notion 原始目录（notion_category）自动分组，子页面单独标注
//   · 「主要的排版的话，就可以参照现在的这样的一个 HALO 的一个排版来进行」
//     → 排版不另造：卡片直接用 components/PostCard.jsx（与 /posts 是同一个组件、同一套 .cs-card 样式），
//       阅读页用 components/ArticleReader.jsx（同一个骨架）。
//
// 与 /posts 的差别只有一个：这里的分类是**行内字段聚合出来的**（Notion 侧没有分类表），
// 所以页面上不显示「标签云 / 近期更新」那些需要关联表的侧栏块。
import { Fragment } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { fmtDate, dateOf } from '../lib/dates.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { PostCard } from '../components/PostCard.jsx';
import { BlogDock } from '../components/BlogDock.jsx';
import { LoadingState, ErrorState, EmptyState } from '../components/StateView.jsx';
import { Icon } from '../components/Icon.jsx';

// Notion 里没填分类的页面统一归到这一组（本轮 207 篇里有 151 篇没有分类）
const UNCATEGORIZED = '未分类';

// 移动端底部工具栏：这一区只与「本区首页」和「回到 Halo 博客」两处互跳
const DOCK = [
  { key: 'notion', label: 'Notion', icon: 'blog', to: '/notion' },
  { key: 'halo', label: '博客', icon: 'layers', to: '/posts' }
];

export function NotionPosts() {
  const { isAuthenticated } = useAuth();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [cat, setCat] = useState('all');   // 'all' | 分类名
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('new');

  async function load() {
    setError('');
    try {
      const data = await api.listNotionPosts();
      // 访客理论上只会拿到已发布（后端已按 published 过滤），这里再兜一次底
      setRows((data || []).filter((p) => isAuthenticated || p.status === 'published'));
    } catch (e) { setError(e.message); }
  }

  useEffect(() => { window.scrollTo(0, 0); load(); }, []);

  const all = useMemo(() => rows || [], [rows]);

  const byDate = useMemo(
    () => [...all].sort((a, b) => new Date(dateOf(b)) - new Date(dateOf(a))),
    [all]
  );

  // 分类聚合（Notion 分类是行内字段，没有分类表可查，直接从列表算）
  const catCount = useMemo(() => {
    const m = new Map();
    for (const p of all) {
      const k = p.notion_category || UNCATEGORIZED;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  }, [all]);

  // 分类顺序：篇数多的在前；「未分类」永远垫底 —— 它不是一个真分类，只是一堆散页
  const cats = useMemo(() => [...catCount.keys()].sort((a, b) => {
    if (a === UNCATEGORIZED) return 1;
    if (b === UNCATEGORIZED) return -1;
    return catCount.get(b) - catCount.get(a) || a.localeCompare(b, 'zh');
  }), [catCount]);

  // 每篇文章带几个子页面（卡片上标「含 N 页」，阅读页里有完整列表）
  const childCount = useMemo(() => {
    const m = new Map();
    for (const p of all) {
      if (p.is_subpage && p.parent_slug) m.set(p.parent_slug, (m.get(p.parent_slug) || 0) + 1);
    }
    return m;
  }, [all]);

  const list = useMemo(() => {
    let l = [...byDate];
    if (cat !== 'all') l = l.filter((p) => (p.notion_category || UNCATEGORIZED) === cat);
    const kw = q.trim().toLowerCase();
    if (kw) {
      l = l.filter((p) => `${p.title} ${p.excerpt || ''} ${p.notion_summary || ''} ${(p.tags || []).join(' ')}`
        .toLowerCase().includes(kw));
    }
    if (sort === 'old') l.reverse();
    return l;
  }, [byDate, cat, q, sort]);

  // 有筛条件时平铺成一列；没有筛条件时按 Notion 原目录分组
  const groups = useMemo(() => {
    if (cat !== 'all' || q.trim()) return [{ name: '', items: list }];
    const m = new Map();
    for (const p of list) {
      const k = p.notion_category || UNCATEGORIZED;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(p);
    }
    return cats.filter((c) => m.has(c)).map((c) => ({ name: c, items: m.get(c) }));
  }, [list, cat, q, cats]);

  function card(p) {
    const kids = childCount.get(p.slug) || 0;
    return (
      <PostCard
        key={p.id}
        post={p}
        cover={p.cover_url}
        category={p.notion_category ? { id: p.notion_category, name: p.notion_category } : null}
        tags={(p.tags || []).map((name) => ({ name }))}
        meta={(
          <>
            {p.is_subpage && <span class="nt-flag"><Icon name="layers" size={12} /> 子页</span>}
            {kids > 0 && <span class="nt-flag"><Icon name="list" size={12} /> 含 {kids} 页</span>}
            {p.is_blank && <span class="nt-flag">空白页</span>}
            <span><Icon name="calendar" size={13} /> {fmtDate(dateOf(p))}</span>
          </>
        )}
        onOpen={() => route(`/notion/${encodeURIComponent(p.slug)}`)}
        onTag={(t) => { setCat('all'); setQ(t.name); }}
        onCategory={(c) => setCat(c.name)}
      />
    );
  }

  if (error && !rows) return <ErrorState title="Notion 博客加载失败" message={error} onRetry={load} />;
  if (!rows) return <LoadingState shape="card" count={6} />;

  const stats = [
    { label: '文章', value: all.length },
    { label: '分类', value: cats.filter((c) => c !== UNCATEGORIZED).length },
    { label: '子页面', value: all.filter((p) => p.is_subpage).length }
  ];

  return (
    <section class="cs nt">
      <PageHeader
        kicker="Notion Archive"
        title="Notion 博客"
        sub="站长在 Notion 里写的原稿，单独放在这一区 —— 与「博客」（早年 Halo 迁移的那批）互相独立，只是排版沿用同一套。"
        stats={stats}
      >
        <a class="btn" href="/posts" onClick={(e) => { e.preventDefault(); route('/posts'); }}>
          <Icon name="arrowLeft" size={14} /> 回到博客
        </a>
      </PageHeader>

      {/* —— 工具条：搜索 + 分类芯片 + 时间排序 —— */}
      <div class="nt-tools">
        <label class="cs-search nt-search">
          <Icon name="search" size={15} />
          <input type="search" placeholder="搜索标题、摘要或标签…" value={q}
            onInput={(e) => setQ(e.currentTarget.value)} />
        </label>

        <div class="nt-chips">
          <button class={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}>
            全部<small>{all.length}</small>
          </button>
          {cats.map((c) => (
            <button key={c} class={cat === c ? 'on' : ''} onClick={() => setCat(cat === c ? 'all' : c)}>
              {c}<small>{catCount.get(c)}</small>
            </button>
          ))}
        </div>

        <div class="cs-seg nt-sort">
          <button class={sort === 'new' ? 'on' : ''} onClick={() => setSort('new')}>最新</button>
          <button class={sort === 'old' ? 'on' : ''} onClick={() => setSort('old')}>最早</button>
        </div>
      </div>

      <div class="cs-layout">
        <div class="cs-main">
          {list.length === 0 ? (
            <EmptyState icon="blog" title="没有符合条件的文章" hint="换个分类或关键词试试。" />
          ) : groups.map((g) => (
            <Fragment key={g.name || 'flat'}>
              {g.name && (
                <div class="cs-list-head">
                  <h3>{g.name}<small>{g.items.length} 篇</small></h3>
                </div>
              )}
              {g.items.map(card)}
            </Fragment>
          ))}
        </div>

        <aside class="cs-side">
          <div class="cs-box">
            <div class="cs-box-head"><Icon name="layers" size={14} /> Notion 目录</div>
            <div class="cs-catlist">
              <button class={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}>
                <span>全部文章</span><small>{all.length} 篇</small>
              </button>
              {cats.map((c) => (
                <button key={c} class={cat === c ? 'on' : ''} onClick={() => setCat(cat === c ? 'all' : c)}>
                  <span>{c}</span><small>{catCount.get(c)} 篇</small>
                </button>
              ))}
            </div>
          </div>

          <div class="cs-box">
            <div class="cs-box-head"><Icon name="info" size={14} /> 关于这一区</div>
            <p class="nt-note">
              这里的文章来自站长自己的 Notion 工作区，与「博客」那一区（早年从 Halo 迁移的 300 多篇）
              存在两张不同的表里，分类和链接互不相通 —— 有意分开，方便各自演进。
            </p>
            <a class="btn nt-golink" href="/posts" onClick={(e) => { e.preventDefault(); route('/posts'); }}>
              <Icon name="arrowRight" size={14} /> 去 Halo 博客
            </a>
          </div>
        </aside>
      </div>

      {error && <div class="notice danger">{error}</div>}
      <BlogDock items={DOCK} active="notion" />
    </section>
  );
}
