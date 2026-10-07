// 音乐库
//
// 重构要点（2026-10-07 体验重构）：
// 1) 页头统一走 PageHeader v2，音乐库**回到本页**（不再散落各处的「货架 + 专辑网格」混杂）。
// 2) 三个 Tab 互斥：音乐库 / 搜索结果 / 播放队列 —— 主区一次只呈现一件事。
//    播放队列此前只存在于 lib/player.jsx 的内存里、没有任何 UI，现在补上（跳播 / 清空）。
// 3) 音乐库支持分组（最近添加 / 按歌手 / 按专辑）、音质筛选、排序；批量播放 / 随机播放入口。
// 4) 搜索结果保留「一行一首」的列表形态，新增音源筛选，并如实标注「待解析」态。
// 5) 所有失败反馈走轻提示（toast），不再往页面里塞红字。
import { useEffect, useMemo, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { Icon } from '../components/Icon.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { LoadingState, ErrorState } from '../components/StateView.jsx';
import { usePlayer } from '../lib/player.jsx';
import { toastError, toastSuccess, toastInfo } from '../lib/toast.jsx';

// 推荐搜索：给没有明确目标的场景一个起点
const RECOMMEND = ['周杰伦', '林俊杰', '陈奕迅', '五月天', 'Beyond', '邓紫棋', 'Taylor Swift', 'Coldplay'];

const PLATFORM_LABEL = {
  gdstudio: 'GD音乐台', meting: 'Meting', audius: 'Audius', itunes: 'iTunes', deezer: 'Deezer'
};

const QUALITY_FILTERS = [
  { key: 'all', label: '全部音质' },
  { key: 'lossless', label: '无损' },
  { key: 'full', label: '完整音轨' },
  { key: 'preview', label: '试听' }
];

const GROUPS = [
  { key: 'recent', label: '最近添加' },
  { key: 'artist', label: '按歌手' },
  { key: 'album', label: '按专辑' }
];

function fmtDuration(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function isLossless(t) {
  return t.format === 'flac' || (t.bitrate || 0) >= 900;
}

function qualityOf(t) {
  if ((t.quality || 'full') === 'preview') return 'preview';
  return isLossless(t) ? 'lossless' : 'full';
}

// 专辑封面卡：音乐库货架用（搜索结果用横向列表 SearchRow）
function AlbumCard({ item, onPlay, onOpen, onRemove }) {
  const t = item.track || {};
  const cover = t.artwork_url || item.cover_path;
  const q = qualityOf(t);

  return (
    <article class="album-card" onClick={onOpen} role="button" tabindex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}>
      <div class="album-art">
        {cover
          ? <img src={cover} alt={item.title} loading="lazy" referrerpolicy="no-referrer" />
          : <span class="album-art-empty"><Icon name="music" size={30} /></span>}
        <button
          class="album-play"
          title="播放"
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
        >
          <Icon name="play" size={20} />
        </button>
        {q !== 'full' && <span class="album-flag">{q === 'lossless' ? '无损' : '试听'}</span>}
        {onRemove && (
          <button
            class="album-remove"
            title="从音乐库移除"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
          >
            <Icon name="trash" size={13} />
          </button>
        )}
      </div>
      <div class="album-meta">
        <h3 title={item.title}>{item.title}</h3>
        <p title={t.artist}>{t.artist || '未知歌手'}</p>
        {t.album && <span class="album-name" title={t.album}>{t.album}</span>}
      </div>
    </article>
  );
}

// 搜索结果行：封面 + 曲目信息 + 音源/音质 + 时长 + 收藏
function SearchRow({ item, busy, resolving, onPlay, onCollect }) {
  // needs_resolve：GD 源命中但直链尚未解析（点播时才现取），必须如实标出来，
  // 否则用户点下去没反应会以为坏了。已拿到直链的一律按实际音质标注。
  const pending = !item.audio_url && !!item.needs_resolve;
  const isPreview = !pending && item.quality === 'preview';
  const isLoss = item.format === 'flac' || (item.bitrate || 0) >= 900;
  const qualityLabel = resolving
    ? '解析中…'
    : (pending ? '待解析' : (isPreview ? '试听' : (isLoss ? '无损' : '完整音轨')));
  const rate = item.bitrate
    ? `${item.format === 'flac' ? 'FLAC · ' : ''}${item.bitrate}kbps`
    : (item.format === 'flac' ? 'FLAC' : '');

  return (
    <div
      class="result-row"
      role="button"
      tabindex={0}
      title="播放并加入音乐库"
      onClick={onPlay}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPlay(); } }}
    >
      <button class="result-art" type="button" title="播放" onClick={(e) => { e.stopPropagation(); onPlay(); }}>
        {item.artwork_url
          ? <img src={item.artwork_url} alt={item.title} loading="lazy" referrerpolicy="no-referrer" />
          : <span class="result-art-empty"><Icon name="music" size={20} /></span>}
        <span class="result-art-play"><Icon name="play" size={16} /></span>
      </button>

      <div class="result-main">
        <h3 title={item.title}>{item.title}</h3>
        <p title={`${item.artist || ''} ${item.album || ''}`}>
          {[item.artist || '未知歌手', item.album].filter(Boolean).join(' · ')}
        </p>
      </div>

      <span class="result-src">{PLATFORM_LABEL[item.platform] || item.platform}</span>
      {rate && <span class="result-rate">{rate}</span>}
      <span class={`result-quality${isPreview ? ' preview' : ''}${pending && !resolving ? ' pending' : ''}`}>
        {qualityLabel}
      </span>
      <span class="result-time">{fmtDuration(item.duration)}</span>

      <button
        class="result-collect"
        type="button"
        disabled={busy}
        title="仅加入音乐库"
        onClick={(e) => { e.stopPropagation(); onCollect(); }}
      >
        <Icon name="plus" size={15} />
      </button>
    </div>
  );
}

export function Music() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('library');       // library | search | queue
  const [searchedFor, setSearchedFor] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [searchNote, setSearchNote] = useState('');
  const [searchSources, setSearchSources] = useState([]);
  const [pendingKey, setPendingKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [group, setGroup] = useState('recent');
  const [quality, setQuality] = useState('all');
  const [pf, setPf] = useState('all');               // 搜索结果的音源筛选
  const { playQueue, queue, index, goTo, stop, playing, toggle } = usePlayer();

  async function load() {
    setLoading(true); setLoadError('');
    try {
      const list = await api.listMusic();
      setItems(list || []);
      return list || [];
    } catch (e) { setLoadError(e.message); return []; }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function runSearch(kw) {
    const q = (kw ?? query).trim();
    if (!q) return;
    setQuery(q);
    setSearching(true); setMode('search');
    try {
      // 一次要满一屏：30 条与后端上限对齐（此前 18 条还会被后端各层再截断）
      const res = await api.searchMusicMeta(q, 30);
      setCandidates(res?.candidates || []);
      setSearchNote(res?.note || '');
      setSearchSources(res?.sources || []);
      setSearchedFor(q);
      setPf('all');
    } catch (e) {
      toastError(`搜索失败：${e.message}`);
      setCandidates([]); setSearchNote(''); setSearchSources([]);
    } finally { setSearching(false); }
  }

  async function addFrom(candidate, { play = true } = {}) {
    const rowKey = `${candidate.platform}-${candidate.external_id}-${candidate.title}`;
    setBusy(true); setPendingKey(rowKey);
    try {
      // 「待解析」条目（GD 源命中但未取直链）：点播这一下才去取。
      // 好处是搜索本身不消耗 GD「5 分钟 50 次」的解析额度，结果条数才上得去。
      let audioUrl = candidate.audio_url || null;
      if (!audioUrl && candidate.needs_resolve) {
        const fresh = await api.resolveMusicStream({
          platform: candidate.platform,
          external_id: candidate.external_id,
          source: candidate.gd_source,
          meting_base: candidate.meting_base
        });
        audioUrl = fresh?.audio_url || null;
      }
      if (play && !audioUrl && !candidate.preview_url) {
        toastError(`「${candidate.title}」暂时拿不到播放地址，换一首或稍后重试`);
        return;
      }
      const created = await api.createMusic({
        title: candidate.title,
        artist: candidate.artist,
        album: candidate.album,
        artwork_url: candidate.artwork_url,
        artist_avatar: candidate.artist_avatar,
        audio_url: audioUrl,
        audio_fallbacks: candidate.audio_fallbacks,
        preview_url: candidate.preview_url,
        quality: candidate.quality,
        duration: candidate.duration,
        genre: candidate.genre,
        release_year: candidate.release_year,
        url: candidate.page_url,
        source: candidate.platform,
        // 音源身份 + 音质信息：直链会过期，播放失败时凭这些字段重新解析（见 lib/player.jsx）
        platform: candidate.platform,
        external_id: candidate.external_id,
        gd_source: candidate.gd_source,
        bitrate: candidate.bitrate,
        format: candidate.format,
        file_size: candidate.file_size
      });
      const list = await load();
      if (play && created?.id) {
        const merged = [...(list || [])];
        const idx = merged.findIndex((m) => m.id === created.id);
        await playQueue(merged, idx >= 0 ? idx : 0);
        toastSuccess(`正在播放《${candidate.title}》`);
        route(`/music/${created.id}/play`);
      } else {
        toastSuccess(`《${candidate.title}》已加入音乐库`);
      }
    } catch (e) { toastError(`加入失败：${e.message}`); }
    finally { setBusy(false); setPendingKey(''); }
  }

  async function remove(item) {
    if (!confirm(`确定把《${item.title}》从音乐库移除？`)) return;
    try {
      await api.deleteMusic(item.id);
      toastSuccess('已移除');
      await load();
    } catch (e) { toastError(`移除失败：${e.message}`); }
  }

  // —— 音乐库：筛选 + 分组 ——
  const filtered = useMemo(
    () => (quality === 'all' ? items : items.filter((m) => qualityOf(m.track || {}) === quality)),
    [items, quality]
  );

  const shelves = useMemo(() => {
    if (group === 'recent') return [{ key: 'recent', title: '最近添加', items: filtered.slice(0, 60) }];
    const keyOf = (m) => {
      const t = m.track || {};
      const v = group === 'artist' ? (t.artist || '未知歌手') : (t.album || '未知专辑');
      return String(v).split(/[\/,&]/)[0].trim() || '未知';
    };
    const buckets = new Map();
    for (const m of filtered) {
      const k = keyOf(m);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(m);
    }
    return [...buckets.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 24)
      .map(([k, v]) => ({ key: k, title: k, items: v }));
  }, [filtered, group]);

  // —— 搜索结果的音源筛选 ——
  const platforms = useMemo(() => {
    const set = new Set();
    for (const c of candidates) if (c.platform) set.add(c.platform);
    return [...set];
  }, [candidates]);

  const shownResults = useMemo(
    () => (pf === 'all' ? candidates : candidates.filter((c) => c.platform === pf)),
    [candidates, pf]
  );

  const playable = useMemo(
    () => candidates.filter((c) => c.audio_url || c.preview_url).length,
    [candidates]
  );

  const tabs = useMemo(() => [
    { key: 'library', label: '音乐库', count: items.length },
    { key: 'search', label: searchedFor ? `「${searchedFor}」` : '搜索结果', count: candidates.length },
    { key: 'queue', label: '播放队列', count: queue.length }
  ], [items.length, searchedFor, candidates.length, queue.length]);

  const stats = useMemo(() => {
    if (mode === 'search') {
      return [
        { label: '命中音源', value: searchSources.length || '—' },
        { label: '结果', value: candidates.length },
        { label: '可直接播', value: playable }
      ];
    }
    if (mode === 'queue') {
      return [
        { label: '队列', value: queue.length },
        { label: '当前', value: index >= 0 ? index + 1 : '—' }
      ];
    }
    const lossless = items.filter((m) => qualityOf(m.track || {}) === 'lossless').length;
    return [
      { label: '库内曲目', value: items.length },
      { label: '无损', value: lossless }
    ];
  }, [mode, searchSources.length, candidates.length, playable, queue.length, index, items]);

  return (
    <section class="music-page page-col">
      <PageHeader
        kicker="Music Library"
        title="音乐"
        sub="五个音源并发检索，一次搜索拿到整页结果；跨页面续播，点封面进入同步歌词页。"
        stats={stats}
        tabs={tabs}
        activeTab={mode}
        onTab={setMode}
      >
        <button onClick={() => route('/music/new')}><Icon name="plus" size={14} /> 手动录入</button>
      </PageHeader>

      {/* —— 常驻工具条：搜索 + 分组/音质 —— */}
      <div class="toolbar sticky">
        <form class="toolbar-field" onSubmit={(e) => { e.preventDefault(); runSearch(); }}>
          <Icon name="search" size={15} />
          <input
            placeholder="搜索歌曲、歌手或专辑"
            value={query}
            onInput={(e) => setQuery(e.currentTarget.value)}
          />
          {query && (
            <button type="button" class="field-clear" title="清空" onClick={() => setQuery('')}>
              <Icon name="close" size={12} />
            </button>
          )}
          <button class="primary" type="submit" disabled={searching}>
            {searching ? '搜索中…' : '搜索'}
          </button>
        </form>

        {mode === 'library' && (
          <>
            <div class="seg">
              {GROUPS.map((g) => (
                <button key={g.key} class={group === g.key ? 'on' : ''} onClick={() => setGroup(g.key)}>{g.label}</button>
              ))}
            </div>
            <select class="toolbar-select" value={quality} onChange={(e) => setQuality(e.currentTarget.value)} aria-label="音质">
              {QUALITY_FILTERS.map((q) => <option key={q.key} value={q.key}>{q.label}</option>)}
            </select>
          </>
        )}

        {mode === 'search' && platforms.length > 1 && (
          <div class="seg">
            <button class={pf === 'all' ? 'on' : ''} onClick={() => setPf('all')}>全部音源</button>
            {platforms.map((p) => (
              <button key={p} class={pf === p ? 'on' : ''} onClick={() => setPf(p)}>
                {PLATFORM_LABEL[p] || p}
              </button>
            ))}
          </div>
        )}

        <span class="spacer" />

        {mode === 'library' && filtered.length > 1 && (
          <>
            <button onClick={() => playQueue(filtered, 0)}><Icon name="play" size={14} /> 全部播放</button>
            <button onClick={() => playQueue([...filtered].sort(() => Math.random() - 0.5), 0)}>
              <Icon name="shuffle" size={14} /> 随机
            </button>
          </>
        )}
        {mode === 'queue' && queue.length > 0 && (
          <button class="danger" onClick={() => { stop(); toastInfo('已清空播放队列'); }}>
            <Icon name="trash" size={14} /> 清空队列
          </button>
        )}
      </div>

      {/* —— 推荐搜索 chips —— */}
      {mode !== 'queue' && (
        <div class="reco-chips">
          <span class="reco-chips-label"><Icon name="sparkles" size={13} /> 试试</span>
          <div class="reco-chips-track">
            {RECOMMEND.map((k) => (
              <button key={k} type="button" class="reco-chip" onClick={() => runSearch(k)}>{k}</button>
            ))}
          </div>
        </div>
      )}

      {/* —— 音乐库 —— */}
      {mode === 'library' && (
        loadError ? <ErrorState title="音乐库加载失败" message={loadError} onRetry={load} />
          : loading ? <LoadingState shape="album" count={12} />
            : items.length === 0 ? (
              <EmptyState
                icon="music"
                title="音乐库还是空的"
                hint="在上方搜索歌曲或歌手，点一下就能收藏并播放；也可以直接点下面的推荐词。"
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon="sliders"
                title="没有符合当前音质筛选的曲目"
                hint="换一个音质条件，或把筛选切回「全部音质」。"
                action={
                  <button class="primary empty-action" onClick={() => setQuality('all')}>显示全部音质</button>
                }
              />
            ) : shelves.map((shelf) => (
              <section key={shelf.key} class="shelf">
                <div class="grid-head">
                  <h2><span class="bar" />{shelf.title}</h2>
                  <span class="count">{shelf.items.length} 首</span>
                  <span class="spacer" />
                  <button onClick={() => playQueue(shelf.items, 0)}><Icon name="play" size={13} /> 播放本组</button>
                </div>
                <div class="album-grid">
                  {shelf.items.map((m) => (
                    <AlbumCard
                      key={m.id}
                      item={m}
                      onPlay={() => playQueue(shelf.items, shelf.items.indexOf(m))}
                      onOpen={() => route(`/music/${m.id}`)}
                      onRemove={() => remove(m)}
                    />
                  ))}
                </div>
              </section>
            ))
      )}

      {/* —— 搜索结果 —— */}
      {mode === 'search' && (
        searching ? <LoadingState shape="list" count={8} />
          : candidates.length === 0 ? (
            <EmptyState
              icon="music"
              title={searchedFor ? `没有找到「${searchedFor}」` : '还没有搜索'}
              hint={searchNote || '换个关键词试试，或只输入歌名；也可以点上面的推荐词。'}
            />
          ) : (
            <section class="shelf">
              <div class="grid-head">
                <h2><span class="bar" />{searchedFor} · 搜索结果</h2>
                <span class="count">{shownResults.length} 首</span>
                {searchSources.length > 0 && (
                  <span class="src-count" title={searchSources.join(' · ')}>{searchSources.length} 个音源</span>
                )}
              </div>
              <div class="result-list">
                {shownResults.map((c) => {
                  const rowKey = `${c.platform}-${c.external_id}-${c.title}`;
                  return (
                    <SearchRow
                      key={rowKey}
                      item={c}
                      busy={busy}
                      resolving={pendingKey === rowKey}
                      onPlay={() => addFrom(c)}
                      onCollect={() => addFrom(c, { play: false })}
                    />
                  );
                })}
              </div>
            </section>
          )
      )}

      {/* —— 播放队列 —— */}
      {mode === 'queue' && (
        queue.length === 0 ? (
          <EmptyState
            icon="list"
            title="播放队列是空的"
            hint="在音乐库里点「全部播放」，或从搜索结果里点一首歌，队列就会出现在这里。"
            action={
              <button class="primary empty-action" onClick={() => setMode('library')}>
                <Icon name="music" size={14} /> 去音乐库
              </button>
            }
          />
        ) : (
          <section class="shelf">
            <div class="grid-head">
              <h2><span class="bar" />播放队列</h2>
              <span class="count">{queue.length} 首</span>
              <span class="spacer" />
              <button onClick={toggle}>{playing ? <Icon name="pause" size={13} /> : <Icon name="play" size={13} />} {playing ? '暂停' : '继续'}</button>
            </div>
            <div class="queue-list">
              {queue.map((q, i) => (
                <button
                  key={`${q.id}-${i}`}
                  type="button"
                  class={`queue-row${i === index ? ' on' : ''}`}
                  onClick={() => goTo(i)}
                >
                  <span class="queue-n">{i === index && playing ? <span class="queue-eq"><i /><i /><i /></span> : i + 1}</span>
                  <span class="queue-art">
                    {q.cover
                      ? <img src={q.cover} alt="" loading="lazy" referrerpolicy="no-referrer" />
                      : <span class="queue-art-empty"><Icon name="music" size={14} /></span>}
                  </span>
                  <span class="queue-main">
                    <span class="queue-title" title={q.title}>{q.title}</span>
                    <span class="queue-sub">{[q.artist, q.album].filter(Boolean).join(' · ') || '未知歌手'}</span>
                  </span>
                  <span class="queue-time">{fmtDuration(q.duration)}</span>
                </button>
              ))}
            </div>
          </section>
        )
      )}

    </section>
  );
}
