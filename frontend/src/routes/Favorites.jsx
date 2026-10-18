// 收藏页（/favorites）
//
// 2026-10-11 改版（用户要求）：收藏页的**主要功能是收藏音乐与影视** ——
//   读者把喜欢的歌 / 电影 / 电视剧收进来，方便以后回来听 / 看。
//
// 2026-10-11 二次改版（用户要求）：
//   ① **音乐与影视分区展示** —— 「全部」视图不再把两种卡片混在一张网格里，
//      而是「音乐」一段、「影视」一段，各带标题与数量；博客等其它资源再单列一段。
//   ② 新增「站长收藏」分区：站长收藏的音乐 / 影视对所有访客可见可播，标「站长」角标、
//      没有「移除」按钮（只能由站长本人管理）。它同样按音乐 / 影视分开。
//
// 2026-10-12 三次改版（用户要求）：
//   **站长本人登录后不再重复渲染「站长收藏」分区** —— 那个分区的内容就是站长自己的
//   收藏，站长看到「个人收藏 + 站长收藏」两份重复内容没有意义。现在：
//     · 访客 / 普通用户 → 看到「站长收藏」分区（他们的个人收藏通常是空的）；
//     · 站长本人       → 只看到自己那一份收藏（可移除），不再出现「站长收藏」。
//   判据用 useAuth().isAdmin，与全站其它管理入口保持同一套鉴权口径。
//
// 数据来源：GET /api/favorites（个人数据，访客 403）+ GET /api/favorites/public（公开）。
// 收藏按钮在音乐 / 影视详情页（components/FavoriteButton.jsx），点卡片进对应详情页。
import { useEffect, useMemo, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { Icon } from '../components/Icon.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { EmptyState, LoadingState, ErrorState } from '../components/StateView.jsx';
import { toastError, toastSuccess } from '../lib/toast.jsx';
import { useAuth } from '../lib/auth.jsx';
import '../styles/now-settings.css';

// 音乐 / 影视（含剧集）是收藏页的主角；其余类型归入「其它」
const SECTIONS = [
  { key: 'music', title: '音乐', icon: 'music', hint: '喜欢的歌与专辑' },
  { key: 'movie', title: '影视', icon: 'movie', hint: '想看的电影与剧集' },
  { key: 'other', title: '其它', icon: 'layers', hint: '博客与其它资源' }
];

function kindOf(fav) {
  const t = fav.target || {};
  if (t.kind === 'post') return 'other';
  if (t.type === 'music') return 'music';
  if (t.type === 'movie') return 'movie';
  return 'other';
}

function fmtDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 音乐专辑封面是 1:1，影视海报是 2:3；按类型给不同比例，避免封面被拉变形
function coverRatio(kind) {
  return kind === 'music' ? '1 / 1' : '2 / 3';
}

export function Favorites() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  // 站长收藏（公开只读）：未登录也能看到，点击即可听 / 看
  const [adminItems, setAdminItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [needLogin, setNeedLogin] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    // 站长收藏是公开接口，未登录也能拿到；个人收藏未登录会 401/403（走「请先登录」空态）。
    const [mine, theirs] = await Promise.allSettled([
      api.listFavorites(),
      api.listAdminFavorites()
    ]);
    if (theirs.status === 'fulfilled') setAdminItems(theirs.value || []);
    if (mine.status === 'fulfilled') {
      setItems(mine.value || []);
      setNeedLogin(false);
      setError('');
    } else {
      // 收藏是个人数据：未登录时后端可能回 401（不在访客白名单）或 403（访客上下文里显式拒绝）。
      // 两种都当作「请先登录」的友好空态，不再把 401 当成加载失败。
      const e = mine.reason || {};
      if (e.status === 401 || e.status === 403) { setNeedLogin(true); setError(''); }
      else setError(e.message || '收藏加载失败');
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function remove(fav) {
    if (!confirm('从收藏里移除这一项？')) return;
    try {
      await api.deleteFavorite(fav.id);
      toastSuccess('已移除');
      await load();
    } catch (e) { toastError(e.message); }
  }

  function open(fav) {
    const t = fav.target || {};
    if (t.kind === 'post') route(`/posts/${t.id}`);
    else if (t.type === 'movie') route(`/movies/${t.id}`);
    else if (t.type === 'music') route(`/music/${t.id}`);
    else if (t.url) window.open(t.url, '_blank', 'noopener');
  }

  // 按音乐 / 影视 / 其它分组；「全部」视图里也按这个顺序排，音乐影视在前
  const grouped = useMemo(() => {
    const g = { music: [], movie: [], other: [] };
    for (const f of items) g[kindOf(f)].push(f);
    return g;
  }, [items]);

  const counts = { all: items.length, music: grouped.music.length, movie: grouped.movie.length, other: grouped.other.length };
  // 当前筛选下实际有多少条（决定是显示空态还是分区网格）
  const shownCount = filter === 'all' ? items.length : grouped[filter].length;

  // 分区标题（音乐 / 影视 / 其它）：每段各自一个标题行 + 网格，不再混在一张网格里
  const SECTION_META = {
    music: { title: '音乐', icon: 'music', hint: '喜欢的歌与专辑' },
    movie: { title: '影视', icon: 'movie', hint: '想看的电影与剧集' },
    other: { title: '其它', icon: 'layers', hint: '博客与其它资源' }
  };

  // 把一组收藏按类型切成 音乐 / 影视 / 其它 三段（空段不渲染）
  function groupList(list) {
    const g = { music: [], movie: [], other: [] };
    for (const f of list) g[kindOf(f)].push(f);
    return g;
  }

  // 单张收藏卡：readOnly=true 时不渲染「移除」（站长收藏只能由站长自己管理）
  function renderCard(fav, { readOnly = false, badge = '' } = {}) {
    const t = fav.target || {};
    const kind = kindOf(fav);
    const cover = t.cover_path || '';
    const sub = t.summary || t.excerpt || '';
    return (
      <article key={fav.id} class={`fav-card fav-${kind}`}>
        <button type="button" class="fav-cover" style={`aspect-ratio:${coverRatio(kind)}`} onClick={() => open(fav)}>
          {cover
            ? <img src={cover} alt="" loading="lazy" decoding="async" />
            : <span class="fav-cover-empty"><Icon name={kind === 'music' ? 'music' : kind === 'movie' ? 'movie' : 'layers'} size={26} /></span>}
          <span class="fav-kind">
            <Icon name={kind === 'music' ? 'music' : kind === 'movie' ? 'movie' : 'layers'} size={11} />
            {kind === 'music' ? '音乐' : kind === 'movie' ? '影视' : (t.kind === 'post' ? '博客' : '资源')}
          </span>
          {badge && <span class="fav-owner">{badge}</span>}
        </button>
        <div class="fav-info">
          <button type="button" class="fav-title" onClick={() => open(fav)} title={t.title || ''}>
            {t.title || '(已删除)'}
          </button>
          {sub && <p class="fav-sub">{sub}</p>}
          <div class="fav-foot">
            <time>{fmtDate(fav.created_at)}</time>
            <div class="fav-ops">
              <button type="button" class="primary" onClick={() => open(fav)}>
                {kind === 'music' ? '去听' : kind === 'movie' ? '去看' : '打开'}
              </button>
              {!readOnly && <button type="button" onClick={() => remove(fav)} title="移除收藏">移除</button>}
            </div>
          </div>
        </div>
      </article>
    );
  }

  // 渲染「音乐 / 影视 / 其它」三段（只渲染非空段）。
  // filter 为 'all' 时三段都出；否则只出对应那一段。
  function renderSections(list, { readOnly = false, badge = '' } = {}) {
    const g = groupList(list);
    const keys = filter === 'all' ? ['music', 'movie', 'other'] : [filter];
    return keys
      .filter((k) => g[k]?.length)
      .map((k) => {
        const meta = SECTION_META[k];
        return (
          <section key={k} class={`fav-sec fav-sec-${k}`}>
            <div class="fav-sec-head">
              <h2><Icon name={meta.icon} size={16} />{meta.title}<b>{g[k].length}</b></h2>
              <span>{meta.hint}</span>
            </div>
            <div class="fav-grid">{g[k].map((f) => renderCard(f, { readOnly, badge }))}</div>
          </section>
        );
      });
  }

  // 「站长收藏」分区：给**访客与普通用户**看（他们的个人收藏通常是空的）。
  // 站长本人登录后不渲染 —— 这里的内容就是站长自己的收藏，再显示一遍是重复的
  // （2026-10-12 用户要求：站长登录后收藏页只保留一份）。
  const adminSection = !isAdmin && adminItems.length ? (
    <section class="fav-admin">
      <div class="fav-admin-head">
        <span class="fav-admin-badge"><Icon name="crown" size={13} />站长收藏</span>
        <p>站长收藏的音乐与影视，所有人登录与否都能直接听 / 看。</p>
      </div>
      {renderSections(adminItems, { readOnly: true, badge: '站长' })}
    </section>
  ) : null;

  if (loading && !items.length && !adminItems.length) return <LoadingState shape="card" count={6} />;
  // 未登录时也渲染成「收藏」页本身（不再跳登录页）：标题 + 站长收藏 + 友好空态。
  if (needLogin) {
    return (
      <section class="fav-page">
        <PageHeader
          kicker="Saved"
          title="收藏"
          sub="把喜欢的音乐和影视收进来，随时回来听 / 看。"
          stats={[{ label: '音乐', value: 0 }, { label: '影视', value: 0 }]}
        />
        {adminSection}
        <EmptyState
          icon="heart"
          title="登录后可收藏自己的音乐与影视"
          hint="站长收藏的内容无需登录即可播放；登录后还能把喜欢的音乐与影视收进自己的收藏夹。"
          decoration="gooey"
          action={<a class="btn primary" href="/login">去登录</a>}
        />
      </section>
    );
  }
  if (error && !items.length) {
    return (
      <section class="fav-page">
        <PageHeader kicker="Saved" title="收藏" sub="你喜欢的音乐与影视都收在这里。" />
        {adminSection}
        <ErrorState title="个人收藏加载失败" message={error} onRetry={load} />
      </section>
    );
  }

  return (
    <section class="fav-page">
      <PageHeader
        kicker="Saved"
        title="收藏"
        sub="你喜欢的音乐与影视都收在这里。"
        stats={[
          { label: '音乐', value: counts.music },
          { label: '影视', value: counts.movie }
        ]}
      >
        <div class="fav-tabs" role="tablist">
          {[{ key: 'all', title: '全部' }, ...SECTIONS].map((s) => (
            <button
              key={s.key} type="button" role="tab"
              aria-selected={filter === s.key ? 'true' : 'false'}
              class={`fav-tab${filter === s.key ? ' on' : ''}`}
              onClick={() => setFilter(s.key)}
            >
              {s.title}<b>{counts[s.key] ?? 0}</b>
            </button>
          ))}
        </div>
      </PageHeader>

      {adminSection}

      {shownCount === 0 ? (
        <EmptyState
          icon="heart"
          title={filter === 'all' ? '还没有收藏' : `还没有收藏${SECTIONS.find((s) => s.key === filter)?.title || ''}`}
          hint="去音乐或影视详情页点「收藏」，就会出现在这里。"
          decoration="gooey"
          action={<div class="fav-empty-actions">
            <a class="btn" href="/music">逛音乐</a>
            <a class="btn" href="/movies">逛影视</a>
          </div>}
        />
      ) : (
        /* 音乐 / 影视 / 其它 分区展示（用户要求：不要把音乐和影视混在一起） */
        <div class="fav-sections">{renderSections(items)}</div>
      )}
    </section>
  );
}
