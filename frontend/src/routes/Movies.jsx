// 影视库
//
// 重构要点（2026-10-07 体验重构）：
// 1) 页头统一走 PageHeader v2：标题 + 读数条 + 主标签栏，取代原来的 vod-head +
//    另起一行的切换器 + 上下堆叠的「搜索结果 / 我的收藏」。
// 2) 浏览模式互斥成 Tab（精选推荐 / 最新入库 / 我的收藏），搜索结果作为第四个 Tab
//    出现 —— 主区一次只呈现一件事，层级不再打架。
// 3) 推荐片单由首屏大面板降级为 Tab 内的一行 chips，不再把正文推到两屏之后。
// 4) 工具条常驻：搜索 + 类型/年份/排序筛选 + 源状态。筛选全部在本地完成，不额外打接口。
// 5) 源状态抽屉：把 /api/movies/sources/health 的实测结果摊开，正面回答
//    「为什么这部片搜不到」——这是采集型产品最容易被用户质疑的地方。
// 6) 继续观看：把已有进度（user_progress）提到「我的收藏」Tab 顶部，一眼可续。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { Card } from '../components/Card.jsx';
import { GalleryView } from '../components/GalleryView.jsx';
import { TimelineView } from '../components/TimelineView.jsx';
import { ViewSwitch } from '../components/ViewSwitch.jsx';
import { VodPoster } from '../components/VodPoster.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { LoadingState, ErrorState } from '../components/StateView.jsx';
import { Icon } from '../components/Icon.jsx';
import { useViewMode } from '../lib/viewMode.jsx';
import { toastError, toastSuccess } from '../lib/toast.jsx';

// 推荐片单：按国家/地区分组，点击即按片名聚合搜索。
// 仅作为检索入口，不代表只能搜这些——搜索框仍可自由检索全部采集源。
const RECOMMEND = [
  {
    key: 'cn', label: '中国',
    groups: [
      { label: '电视剧', items: ['觉醒年代', '历史转折中的邓小平', '老九门', '九门', '终极笔记', '三体'] },
      { label: '动漫', items: ['完美世界', '画江湖之不良人', '一人之下', '诛仙', '遮天', '剑来', '斗破苍穹', '全职高手', '诡秘之主', '西行纪', '凡人修仙传', '仙逆'] },
      { label: '电影', items: ['战狼', '流浪地球', '唐人街探案', '哪吒之魔童降世', '哪吒之魔童闹海'] }
    ]
  },
  {
    key: 'us', label: '美国',
    groups: [{ label: '', items: ['复仇者联盟', '蜘蛛侠', '变形金刚', '美国队长', '毒液'] }]
  },
  {
    key: 'jp', label: '日本',
    groups: [{ label: '', items: ['迪迦奥特曼', '戴拿奥特曼', '奥特银河格斗', '赛罗奥特曼'] }]
  }
];

const ANIME_RE = /动漫|动画|番剧|国漫|日漫|剧场版/;

const MEDIA_TABS = [
  { key: 'all', label: '全部' },
  { key: 'movie', label: '电影' },
  { key: 'tv', label: '剧集' },
  { key: 'anime', label: '动漫' }
];

const SORTS = [
  { key: 'relevance', label: '相关度' },
  { key: 'year', label: '年份最新' },
  { key: 'rating', label: '评分最高' }
];

function mediaKind(c) {
  if (ANIME_RE.test(String(c.type_name || ''))) return 'anime';
  return c.media_type === 'tv' ? 'tv' : 'movie';
}

function yearOf(c) {
  const y = c.release_date ? String(c.release_date).slice(0, 4) : '';
  return /^\d{4}$/.test(y) ? Number(y) : null;
}

export function Movies() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('hot');            // hot | new | mine | search
  const [candidates, setCandidates] = useState([]);
  const [candNote, setCandNote] = useState('');
  const [candSources, setCandSources] = useState([]);
  const [candSourceNames, setCandSourceNames] = useState([]);
  const [candLoading, setCandLoading] = useState(false);
  const [candError, setCandError] = useState('');
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [busy, setBusy] = useState(false);
  const [media, setMedia] = useState('all');
  const [year, setYear] = useState('all');
  const [sort, setSort] = useState('relevance');
  const [drawer, setDrawer] = useState('');           // '' | 'health'
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const { viewMode } = useViewMode();

  // localStorage 记住上次停留的 Tab 之外，不做额外持久化：候选数据每次都要重新拉
  const lastQuery = useRef('');

  async function load() {
    setListLoading(true); setListError('');
    try {
      const list = await api.listMovies();
      setItems(list || []);
      return list || [];
    } catch (e) {
      setListError(e.message);
      return [];
    } finally { setListLoading(false); }
  }

  async function loadCandidates(nextMode, q = '') {
    setCandLoading(true); setCandError('');
    try {
      // 一次要满一屏：30 条检索候选，经跨源按片名去重后仍能剩下十几个不同条目
      // （此前只取 18 条、且被各层二次截断，是「一部剧只搜出两三条」的主因）
      const res = nextMode === 'search'
        ? await api.searchMovieMeta(q, 30)
        : await api.listMovieLatest(`?limit=30&sort=${nextMode === 'new' ? 'new' : 'hot'}`);
      setCandidates(res?.candidates || []);
      setCandNote(res?.note || '');
      setCandSources(res?.sources || []);
      setCandSourceNames(res?.source_names || []);
    } catch (e) {
      setCandError(e.message);
      setCandidates([]); setCandNote(''); setCandSources([]); setCandSourceNames([]);
    } finally { setCandLoading(false); }
  }

  useEffect(() => { load(); loadCandidates('hot'); }, []);

  // 抽屉打开时锁住背景滚动 + Esc 关闭
  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDrawer(''); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer]);

  function switchMode(next, q = '') {
    setMode(next);
    if (next === 'mine') return;
    loadCandidates(next, q);
  }

  function search(e) {
    e?.preventDefault?.();
    const q = query.trim();
    if (!q) return;
    lastQuery.current = q;
    setMedia('all'); setYear('all');
    switchMode('search', q);
  }

  async function openHealth() {
    setDrawer('health');
    if (health || healthLoading) return;
    setHealthLoading(true);
    try { const res = await api.getVodSourceHealth(); setHealth(res?.sources || []); }
    catch (e) { toastError(`源状态获取失败：${e.message}`); setHealth([]); }
    finally { setHealthLoading(false); }
  }

  async function addFrom(candidate) {
    setBusy(true);
    try {
      await api.createMovie({
        title: candidate.title,
        media_type: candidate.media_type,
        original_title: candidate.original_title,
        overview: candidate.overview,
        poster_url: candidate.poster_url,
        backdrop_url: candidate.backdrop_url,
        release_date: candidate.release_date,
        runtime: candidate.runtime,
        rating: candidate.rating,
        genres: candidate.genres,
        director: candidate.director,
        cast_list: candidate.cast_list,
        external_id: candidate.external_id,
        source: candidate.source,
        source_key: candidate.source,
        source_vod_id: candidate.external_id,
        routes: candidate.routes,
        area: candidate.area,
        remarks: candidate.remarks,
        url: candidate.playable_url || null,
        external_url: candidate.page_url || null
      });
      const list = await load();
      const created = (list || []).find((m) => m.title === candidate.title);
      toastSuccess(`《${candidate.title}》已加入影视库`);
      if (created) route(`/movies/${created.id}`);
    } catch (e) {
      toastError(`加入失败：${e.message}`);
    } finally { setBusy(false); }
  }

  async function remove(m) {
    if (!confirm(`确定把《${m.title}》从收藏中删除？`)) return;
    try {
      await api.deleteMovie(m.id);
      toastSuccess('已删除');
      await load();
    } catch (e) { toastError(`删除失败：${e.message}`); }
  }

  // —— 本地筛选与排序：采集候选一次性取回，切筛选不再打接口 ——
  const years = useMemo(() => {
    const set = new Set();
    for (const c of candidates) { const y = yearOf(c); if (y) set.add(y); }
    return [...set].sort((a, b) => b - a).slice(0, 12);
  }, [candidates]);

  const shown = useMemo(() => {
    let list = candidates;
    if (media !== 'all') list = list.filter((c) => mediaKind(c) === media);
    if (year !== 'all') list = list.filter((c) => String(yearOf(c)) === String(year));
    if (sort === 'year') {
      list = [...list].sort((a, b) => (yearOf(b) || 0) - (yearOf(a) || 0));
    } else if (sort === 'rating') {
      list = [...list].sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    }
    return list;
  }, [candidates, media, year, sort]);

  const continueWatching = useMemo(
    () => items.filter((m) => (m.progress?.progress || 0) > 0 && m.progress.progress < 100),
    [items]
  );

  const tabs = useMemo(() => {
    const base = [
      { key: 'hot', label: '精选推荐' },
      { key: 'new', label: '最新入库' },
      { key: 'mine', label: '我的收藏', count: items.length }
    ];
    if (mode === 'search') {
      base.push({ key: 'search', label: `「${lastQuery.current}」`, count: shown.length });
    }
    return base;
  }, [items.length, mode, shown.length]);

  const stats = useMemo(() => {
    if (mode === 'mine') {
      return [
        { label: '收藏条目', value: items.length },
        { label: '观看中', value: continueWatching.length }
      ];
    }
    return [
      { label: '命中来源', value: candSources.length || '—' },
      { label: '候选条目', value: candLoading ? '…' : shown.length }
    ];
  }, [mode, items.length, continueWatching.length, candSources.length, candLoading, shown.length]);

  const renderCollected = (m) => {
    const t = m.title_info || {};
    const kind = t.media_type === 'tv' ? '剧集' : '电影';
    return (
      <Card
        key={m.id}
        title={m.title}
        description={t.overview || m.summary}
        coverUrl={t.poster_url || m.cover_path}
        tags={m.tags}
        meta={
          <span class="meta-row">
            <span class="meta-item"><Icon name={t.media_type === 'tv' ? 'tv' : 'movie'} size={13} />{kind}</span>
            {t.release_date && <span class="meta-item">{String(t.release_date).slice(0, 4)}</span>}
            {t.rating != null && <span class="meta-item"><Icon name="star" size={13} />{t.rating}</span>}
            {m.progress?.progress > 0 && <span class="meta-item">已看 {m.progress.progress}%</span>}
          </span>
        }
        onClick={() => route(`/movies/${m.id}`)}
        footer={
          <span class="row">
            <button class="primary" onClick={(e) => { e.stopPropagation(); route(`/movies/${m.id}`); }}>播放</button>
            <button onClick={(e) => { e.stopPropagation(); route(`/movies/${m.id}/edit`); }}>编辑</button>
            <button class="danger" onClick={(e) => { e.stopPropagation(); remove(m); }}>删除</button>
          </span>
        }
      />
    );
  };

  const isBrowse = mode !== 'mine';

  return (
    <section class="movies-page page-col">
      <PageHeader
        kicker="Movie Library"
        title="影视库"
        sub="12 个公开采集源并发检索，同一部片的线路会跨源合并（实测「奥本海默」11 源合并出 19 条线路）。"
        stats={stats}
        tabs={tabs}
        activeTab={mode}
        onTab={(k) => { if (k === 'search') return; switchMode(k); }}
      >
        <button class="primary" onClick={() => route('/movies/new')}>
          <Icon name="plus" size={14} /> 手动添加
        </button>
      </PageHeader>

      {/* —— 常驻工具条：搜索 + 筛选 + 源状态 —— */}
      <div class="toolbar sticky">
        <form class="toolbar-field" onSubmit={search}>
          <Icon name="search" size={15} />
          <input
            placeholder="搜索电影 / 剧集 / 动漫，如：蜘蛛侠、庆余年、凡人修仙传"
            value={query}
            onInput={(e) => setQuery(e.currentTarget.value)}
          />
          {query && (
            <button type="button" class="field-clear" title="清空" onClick={() => setQuery('')}>
              <Icon name="close" size={12} />
            </button>
          )}
        </form>

        {isBrowse ? (
          <>
            <div class="seg">
              {MEDIA_TABS.map((t) => (
                <button key={t.key} class={media === t.key ? 'on' : ''} onClick={() => setMedia(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>
            {years.length > 1 && (
              <select class="toolbar-select" value={year} onChange={(e) => setYear(e.currentTarget.value)} aria-label="年份">
                <option value="all">全部年份</option>
                {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
              </select>
            )}
            <select class="toolbar-select" value={sort} onChange={(e) => setSort(e.currentTarget.value)} aria-label="排序">
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </>
        ) : (
          <>
            <ViewSwitch />
          </>
        )}

        <span class="spacer" />
        <button type="button" onClick={openHealth} title="查看各采集源实测可用性">
          <Icon name="wave" size={14} /> 源状态
        </button>
      </div>

      {/* —— 浏览模式主区 —— */}
      {isBrowse && (
        <>
          {candError ? (
            <ErrorState
              title="采集源没返回数据"
              message={candError}
              onRetry={() => loadCandidates(mode === 'search' ? 'search' : mode, lastQuery.current)}
            />
          ) : candLoading ? (
            <LoadingState shape="poster" count={12} />
          ) : shown.length === 0 ? (
            <div class="stack">
              <EmptyState
                icon="movie"
                title={mode === 'search' ? `没有找到「${lastQuery.current}」` : '暂时没有拿到数据'}
                hint={candNote || '换个更短的关键词，或直接点下方推荐的片名试试。'}
              />
              <RecoChips compact onPick={(name) => { setQuery(name); lastQuery.current = name; switchMode('search', name); }} />
            </div>
          ) : (
            <>
              <div class="grid-head">
                <h2>
                  <span class="bar" />
                  {mode === 'search' ? '搜索结果' : (mode === 'new' ? '最新入库' : '精选推荐')}
                </h2>
                <span class="count">{shown.length} 条</span>
                {candSources.length > 0 && (
                  <span class="src-count">{candSources.length} 个源命中</span>
                )}
                <span class="spacer" />
                {media !== 'all' && <FilterChip label={MEDIA_TABS.find((t) => t.key === media)?.label} onClear={() => setMedia('all')} />}
                {year !== 'all' && <FilterChip label={`${year} 年`} onClear={() => setYear('all')} />}
              </div>

              {/* 把「命中了哪些源」直接列出来：用户要的就是「源多」，
                  只给一个数字等于让他自己去猜。后端补了 source_names 之后不必在前端再维护一份映射表。 */}
              {candSourceNames.length > 0 && (
                <div class="src-hits">
                  {candSourceNames.map((n) => <span key={n} class="src-hit">{n}</span>)}
                </div>
              )}

              <div class="vod-grid">
                {shown.map((c) => (
                  <VodPoster
                    key={`${c.source}-${c.external_id}`}
                    item={c}
                    hot={mode === 'hot'}
                    busy={busy}
                    onOpen={() => addFrom(c)}
                    onCollect={() => addFrom(c)}
                  />
                ))}
              </div>

              {mode === 'hot' && <RecoChips onPick={(name) => { setQuery(name); lastQuery.current = name; switchMode('search', name); }} />}
            </>
          )}
        </>
      )}

      {/* —— 我的收藏 —— */}
      {mode === 'mine' && (
        <>
          {listError ? (
            <ErrorState title="收藏列表加载失败" message={listError} onRetry={load} />
          ) : listLoading ? (
            <LoadingState shape="card" count={8} />
          ) : items.length === 0 ? (
            <EmptyState
              icon="layers"
              title="还没有收藏影视"
              hint="切到「精选推荐」或「最新入库」，点任意海报即可加入。"
              action={
                <button class="primary empty-action" onClick={() => switchMode('hot')}>
                  <Icon name="sparkles" size={14} /> 去看看推荐
                </button>
              }
            />
          ) : (
            <>
              {continueWatching.length > 0 && (
                <section class="shelf">
                  <div class="grid-head">
                    <h2><span class="bar" />继续观看</h2>
                    <span class="count">{continueWatching.length} 部</span>
                  </div>
                  <div class="watch-row">
                    {continueWatching.map((m) => {
                      const t = m.title_info || {};
                      return (
                        <button key={m.id} type="button" class="watch-card" onClick={() => route(`/movies/${m.id}`)}>
                          <span class="watch-frame">
                            {t.poster_url || m.cover_path
                              ? <img src={t.poster_url || m.cover_path} alt={m.title} loading="lazy" referrerpolicy="no-referrer" />
                              : <span class="watch-empty"><Icon name="film" size={22} /></span>}
                            <span class="watch-play"><Icon name="play" size={16} /></span>
                            <span class="watch-bar"><i style={`width:${Math.min(100, m.progress.progress)}%`} /></span>
                          </span>
                          <span class="watch-title" title={m.title}>{m.title}</span>
                          <span class="watch-sub">已看 {m.progress.progress}%</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
              {viewMode === 'gallery'
                ? <GalleryView items={items} renderCard={renderCollected} />
                : <TimelineView items={items} renderCard={renderCollected} />}
            </>
          )}
        </>
      )}

      {/* —— 源状态抽屉 —— */}
      {drawer === 'health' && (
        <>
          <div class="drawer-veil" onClick={() => setDrawer('')} />
          <aside class="drawer" role="dialog" aria-label="采集源状态">
            <header class="drawer-head">
              <div>
                <h2>采集源状态</h2>
                <p class="muted">实时探测各源的 <code>ac=videolist</code> 接口，失败即降级到其它源。</p>
              </div>
              <button type="button" class="icon-btn" aria-label="关闭" onClick={() => setDrawer('')}>
                <Icon name="close" size={18} />
              </button>
            </header>
            <div class="drawer-body">
              {healthLoading ? (
                <LoadingState shape="list" count={6} />
              ) : (health || []).length === 0 ? (
                <EmptyState icon="linkBroken" title="没有取到源状态" hint="稍后重试；这不影响正常搜索。" />
              ) : (
                <>
                  <div class="health-summary">
                    <div class="stat"><b>{health.filter((h) => h.ok).length}</b><span>可用</span></div>
                    <div class="stat"><b>{health.filter((h) => !h.ok).length}</b><span>不可用</span></div>
                    <div class="stat">
                      <b>{Math.round(health.reduce((a, h) => a + (h.latency_ms || 0), 0) / health.length)}</b>
                      <span>平均耗时 ms</span>
                    </div>
                  </div>
                  <ul class="health-list">
                    {health.map((h) => (
                      <li key={h.key} class={h.ok ? 'ok' : 'bad'}>
                        <span class={`health-dot ${h.ok ? 'on' : 'off'}`} />
                        <span class="health-name">{h.name}</span>
                        <span class="health-meta">{h.latency_ms} ms</span>
                        {!h.ok && <span class="health-err" title={h.error}>{h.error || '不可用'}</span>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <footer class="drawer-foot muted">
              解析结果来自后端实时探测；「源不可用」只会让该源本轮不参与合并，不影响其它源。
            </footer>
          </aside>
        </>
      )}
    </section>
  );
}

// 当前生效的筛选：给一个可点掉的 chip，避免用户忘了自己筛过什么
function FilterChip({ label, onClear }) {
  return (
    <button type="button" class="filter-chip" onClick={onClear} title="取消该筛选">
      {label}<Icon name="close" size={11} />
    </button>
  );
}

// 推荐片单 chips：横向可滚，不占首屏
function RecoChips({ onPick, compact }) {
  const all = RECOMMEND.flatMap((r) => r.groups.flatMap((g) => g.items));
  return (
    <div class={`reco-chips${compact ? ' compact' : ''}`}>
      <span class="reco-chips-label">
        <Icon name="sparkles" size={13} /> 试试
      </span>
      <div class="reco-chips-track">
        {all.map((name) => (
          <button key={name} type="button" class="reco-chip" onClick={() => onPick(name)}>{name}</button>
        ))}
      </div>
    </div>
  );
}
