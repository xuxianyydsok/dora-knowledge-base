// 音乐库
// 设计取向：参考 Apple Music 的「搜索 + 货架」结构 ——
// 顶部大标题与检索、搜索结果直接铺成专辑网格、下方是「最近添加」货架。
// 点击任意专辑立即开始播放（全局播放器接管，路由切换不断播）。
import { useEffect, useMemo, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { Icon } from '../components/Icon.jsx';
import { usePlayer } from '../lib/player.jsx';

// 推荐搜索：给没有明确目标的场景一个起点
const RECOMMEND = ['周杰伦', '林俊杰', '陈奕迅', '五月天', 'Beyond', '邓紫棋', 'Taylor Swift', 'Coldplay'];

function fmtDuration(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// 专辑封面卡：列表页与搜索结果共用
function AlbumCard({ item, onPlay, onOpen, onCollect, busy, candidate }) {
  const t = item.track || {};
  const cover = candidate ? item.artwork_url : (t.artwork_url || item.cover_path);
  const title = item.title;
  const artist = candidate ? item.artist : t.artist;
  const album = candidate ? item.album : t.album;
  const isPreview = (candidate ? item.quality : t.quality) === 'preview';

  return (
    <article class="album-card" onClick={onOpen} role="button" tabindex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}>
      <div class="album-art">
        {cover
          ? <img src={cover} alt={title} loading="lazy" referrerpolicy="no-referrer" />
          : <span class="album-art-empty"><Icon name="music" size={30} /></span>}
        <button
          class="album-play"
          title="播放"
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
        >
          <Icon name="play" size={20} />
        </button>
        {isPreview && <span class="album-flag">试听</span>}
      </div>
      <div class="album-meta">
        <h3 title={title}>{title}</h3>
        <p title={artist}>{artist || '未知歌手'}</p>
        {album && <span class="album-name" title={album}>{album}</span>}
      </div>
      {candidate && (
        <button class="album-collect" disabled={busy} title="加入音乐库"
          onClick={(e) => { e.stopPropagation(); onCollect(); }}>
          <Icon name="plus" size={14} />
        </button>
      )}
    </article>
  );
}

export function Music() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [searchedFor, setSearchedFor] = useState('');
  const [candidates, setCandidates] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { playQueue, playOne } = usePlayer();

  async function load() {
    setLoading(true);
    try { setItems(await api.listMusic()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function runSearch(kw) {
    const q = (kw ?? query).trim();
    if (!q) return;
    setQuery(q);
    setBusy(true); setError('');
    try {
      const res = await api.searchMusicMeta(q, 18);
      setCandidates(res.candidates || []);
      setSearchedFor(q);
    } catch (e) { setError(e.message); setCandidates([]); }
    finally { setBusy(false); }
  }

  async function addFrom(candidate) {
    setBusy(true); setError('');
    try {
      const created = await api.createMusic({
        title: candidate.title,
        artist: candidate.artist,
        album: candidate.album,
        artwork_url: candidate.artwork_url,
        artist_avatar: candidate.artist_avatar,
        audio_url: candidate.audio_url,
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
      // 收藏后立即播放，并把它接到当前队列末尾
      if (created?.id) {
        const merged = [...(list || [])];
        const idx = merged.findIndex((m) => m.id === created.id);
        await playQueue(merged, idx >= 0 ? idx : 0);
        route(`/music/${created.id}/play`);
      }
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function remove(id) {
    if (!confirm('确定删除该音乐收藏？')) return;
    try { await api.deleteMusic(id); await load(); }
    catch (e) { setError(e.message); }
  }

  // 货架：按加入时间（列表已按 created_at 倒序）
  const shelves = useMemo(() => ([
    { key: 'recent', title: '最近添加', items: items.slice(0, 18) }
  ]), [items]);

  return (
    <section class="music-page">
      {/* —— 头部：大标题 + 检索 —— */}
      <div class="music-head">
        <h1>音乐</h1>
        <form class="music-search" onSubmit={(e) => { e.preventDefault(); runSearch(); }}>
          <span class="music-search-icon"><Icon name="search" size={16} /></span>
          <input
            placeholder="搜索歌曲、歌手或专辑"
            value={query}
            onInput={(e) => setQuery(e.currentTarget.value)}
          />
          <button class="primary" type="submit" disabled={busy}>{busy ? '搜索中…' : '搜索'}</button>
        </form>
        <div class="music-reco">
          {RECOMMEND.map((k) => (
            <button key={k} class="music-reco-item" onClick={() => runSearch(k)}>{k}</button>
          ))}
        </div>
      </div>

      {error && <p style="color:var(--danger)">{error}</p>}

      {/* —— 搜索结果 —— */}
      {candidates && (
        <section class="shelf">
          <div class="shelf-head">
            <h2>「{searchedFor}」的搜索结果</h2>
            <span class="count">{candidates.length} 首</span>
            <span class="spacer" />
            <button onClick={() => { setCandidates(null); setSearchedFor(''); }}>关闭</button>
          </div>
          {candidates.length === 0
            ? <div class="empty-state"><Icon name="music" size={24} /><p>没有找到相关曲目</p><span>换个关键词试试。</span></div>
            : (
              <div class="album-grid">
                {candidates.map((c) => (
                  <AlbumCard
                    key={`${c.platform}-${c.external_id}-${c.title}`}
                    item={c}
                    candidate
                    busy={busy}
                    onOpen={() => addFrom(c)}
                    onCollect={() => addFrom(c)}
                    onPlay={() => addFrom(c)}
                  />
                ))}
              </div>
            )}
        </section>
      )}

      {/* —— 我的音乐库 —— */}
      {loading ? (
        <div class="album-grid">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} class="album-card skeleton-card" />)}
        </div>
      ) : items.length === 0 ? (
        <div class="empty-state" style="margin-top:22px">
          <Icon name="music" size={26} />
          <p>音乐库还是空的</p>
          <span>在上方搜索歌曲或歌手，点一下就能收藏并播放。</span>
        </div>
      ) : shelves.map((shelf) => (
        <section key={shelf.key} class="shelf">
          <div class="shelf-head">
            <h2>{shelf.title}</h2>
            <span class="count">{items.length} 首</span>
            <span class="spacer" />
            <button onClick={() => playQueue(items, 0)}><Icon name="play" size={14} /> 全部播放</button>
          </div>
          <div class="album-grid">
            {shelf.items.map((m, i) => (
              <AlbumCard
                key={m.id}
                item={m}
                onPlay={() => playQueue(items, i)}
                onOpen={() => route(`/music/${m.id}`)}
              />
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}
