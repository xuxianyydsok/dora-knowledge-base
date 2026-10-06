// 影视库
// 上半部分：精选推荐 / 最新入库 / 搜索结果（来自苹果CMS 采集源，海报网格，点击即入库并可播放）
// 下半部分：已收藏影视（画廊 / 时间流双视图）
import { useEffect, useMemo, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { Card } from '../components/Card.jsx';
import { GalleryView } from '../components/GalleryView.jsx';
import { TimelineView } from '../components/TimelineView.jsx';
import { ViewSwitch } from '../components/ViewSwitch.jsx';
import { VodPoster } from '../components/VodPoster.jsx';
import { Icon } from '../components/Icon.jsx';
import { useViewMode } from '../lib/viewMode.jsx';

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

export function Movies() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('hot');          // hot | new | search
  const [recoOpen, setRecoOpen] = useState(false);  // 手机端推荐片单默认收起
  const [candidates, setCandidates] = useState([]);
  const [error, setError] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingCand, setLoadingCand] = useState(false);
  const [busy, setBusy] = useState(false);
  const { viewMode } = useViewMode();

  async function load() {
    setLoadingList(true);
    try { const list = await api.listMovies(); setItems(list); return list; }
    catch (e) { setError(e.message); }
    finally { setLoadingList(false); }
  }

  async function loadCandidates(nextMode, q = '') {
    setLoadingCand(true); setError('');
    try {
      const res = nextMode === 'search'
        ? await api.searchMovieMeta(q, 18)
        : await api.listMovieLatest(`?limit=24&sort=${nextMode === 'new' ? 'new' : 'hot'}`);
      setCandidates(res.candidates || []);
    } catch (e) { setError(e.message); setCandidates([]); }
    finally { setLoadingCand(false); }
  }

  useEffect(() => { load(); loadCandidates('hot'); }, []);

  function switchMode(next, q = '') {
    setMode(next);
    loadCandidates(next, q);
  }

  function search(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    switchMode('search', q);
  }

  async function addFrom(candidate) {
    setBusy(true); setError('');
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
      if (created) route(`/movies/${created.id}`);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function remove(id) {
    if (!confirm('确定删除该影视收藏？')) return;
    try { await api.deleteMovie(id); await load(); }
    catch (e) { setError(e.message); }
  }

  const heading = useMemo(() => {
    if (mode === 'search') return `「${query.trim()}」的搜索结果`;
    if (mode === 'new') return '最新入库';
    return '精选推荐';
  }, [mode, query]);

  const renderCard = (m) => {
    const t = m.title_info || {};
    return (
      <Card
        key={m.id}
        title={m.title}
        description={t.overview || m.summary}
        coverUrl={t.poster_url || m.cover_path}
        tags={m.tags}
        meta={
          <span class="row" style="gap:10px">
            <span class="tag-chip chip-icon"><Icon name={t.media_type === 'tv' ? 'video' : 'movie'} size={12} />{t.media_type === 'tv' ? '剧集' : '电影'}</span>
            {t.release_date && <span class="muted">{String(t.release_date).slice(0, 4)}</span>}
            {t.rating != null && <span class="muted meta-item"><Icon name="star" size={13} /> {t.rating}</span>}
            {m.progress?.progress > 0 && <span class="muted">已看 {m.progress.progress}%</span>}
          </span>
        }
        onClick={() => route(`/movies/${m.id}`)}
        footer={
          <span class="row">
            <button class="primary" onClick={(e) => { e.stopPropagation(); route(`/movies/${m.id}`); }}>播放</button>
            <button onClick={(e) => { e.stopPropagation(); route(`/movies/${m.id}/edit`); }}>编辑</button>
            <button class="danger" onClick={(e) => { e.stopPropagation(); remove(m.id); }}>删除</button>
          </span>
        }
      />
    );
  };

  return (
    <section class="movies-page">
      {/* —— 库头部：标题 + 搜索 —— */}
      <div class="vod-head">
        <div class="vod-head-title">
          <span class="page-kicker">Movie Library</span>
          <h1>影视库</h1>
          <p>聚合 5 个公开采集源，一次检索、多源比对，即点即播。</p>
        </div>
        <form class="vod-search" onSubmit={search}>
          <span class="vod-search-icon"><Icon name="search" size={16} /></span>
          <input
            placeholder="搜索电影 / 电视剧，如：蜘蛛侠、觉醒年代"
            value={query}
            onInput={(e) => setQuery(e.currentTarget.value)}
          />
          <button class="primary" type="submit" disabled={loadingCand}>
            {loadingCand && mode === 'search' ? '搜索中…' : '搜索'}
          </button>
        </form>
      </div>

      {/* —— 推荐片单：搜索框下方，点击即聚合搜索（手机默认收起，避免把正文推到两屏之后） —— */}
      <div class="reco-panel">
        <div class="reco-head">
          <Icon name="sparkles" size={15} />
          <span>推荐搜索</span>
          <span class="reco-hint">点击任意片名，自动聚合多源搜索</span>
          <button class="reco-toggle" type="button" onClick={() => setRecoOpen((v) => !v)}>
            {recoOpen ? '收起' : '展开'}
            <Icon name={recoOpen ? 'chevronDown' : 'chevronRight'} size={13} />
          </button>
        </div>
        <div class={`reco-body${recoOpen ? ' open' : ''}`}>
        {RECOMMEND.map((region) => (
          <div key={region.key} class="reco-region">
            <span class="reco-region-label">{region.label}</span>
            <div class="reco-groups">
              {region.groups.map((g) => (
                <div key={g.label || region.key} class="reco-group">
                  {g.label && <span class="reco-group-label">{g.label}</span>}
                  <div class="reco-items">
                    {g.items.map((name) => (
                      <button
                        key={name}
                        class={`reco-item${query.trim() === name && mode === 'search' ? ' active' : ''}`}
                        onClick={() => { setQuery(name); switchMode('search', name); }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        </div>
      </div>

      {/* —— 视图切换 —— */}
      <div class="toolbar">
        <div class="seg">
          <button class={mode === 'hot' ? 'on' : ''} onClick={() => switchMode('hot')}>精选推荐</button>
          <button class={mode === 'new' ? 'on' : ''} onClick={() => switchMode('new')}>最新入库</button>
          {mode === 'search' && <button class="on">搜索结果</button>}
        </div>
      </div>

      {error && <p style="color:var(--danger)">{error}</p>}

      <div class="m-head">
        <h2><span class="bar" />{heading}</h2>
        {!loadingCand && <span class="count">{candidates.length} 条</span>}
      </div>

      {loadingCand ? (
        <div class="vod-grid">
          {Array.from({ length: 12 }).map((_, i) => <div key={i} class="vod-card skeleton-card" />)}
        </div>
      ) : candidates.length === 0 ? (
        <div class="empty-state">
          <Icon name="movie" size={26} />
          <p>{mode === 'search' ? `没有找到「${query.trim()}」相关的电影或剧集` : '暂时没有拿到数据'}</p>
          <span>换个关键词试试，或稍后重试。</span>
        </div>
      ) : (
        <div class="vod-grid">
          {candidates.map((c) => (
            <VodPoster
              key={`${c.source}-${c.external_id}`}
              item={c}
              hot={(c.alt_sources || []).length > 0}
              busy={busy}
              onOpen={() => addFrom(c)}
              onCollect={() => addFrom(c)}
            />
          ))}
        </div>
      )}

      {/* —— 已收藏影视 —— */}
      <div class="m-head" style="margin-top:38px">
        <h2><span class="bar" />我的影视收藏</h2>
        <span class="spacer" />
        <ViewSwitch />
        <button class="primary" onClick={() => route('/movies/new')}><Icon name="plus" size={14} /> 手动添加</button>
      </div>

      {loadingList ? <div class="center-box">加载中…</div> :
        items.length === 0
          ? <div class="empty-state"><Icon name="layers" size={26} /><p>还没有收藏影视</p><span>在上方点击任意海报即可加入。</span></div>
          : viewMode === 'gallery'
            ? <GalleryView items={items} renderCard={renderCard} />
            : <TimelineView items={items} renderCard={renderCard} />}
    </section>
  );
}
