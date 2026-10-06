// 音乐收藏库页面：元数据搜索新增 + 列表（画廊/时间流）+ 内置播放
import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { Card } from '../components/Card.jsx';
import { GalleryView } from '../components/GalleryView.jsx';
import { TimelineView } from '../components/TimelineView.jsx';
import { ViewSwitch } from '../components/ViewSwitch.jsx';
import { AudioPlayer } from '../components/AudioPlayer.jsx';
import { Icon } from '../components/Icon.jsx';
import { useViewMode } from '../lib/viewMode.jsx';

export function Music() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(null);
  const { viewMode } = useViewMode();

  async function load() {
    setLoading(true);
    try { setItems(await api.listMusic()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function search(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true); setError(''); setCandidates(null);
    try {
      const res = await api.searchMusicMeta(query, 6);
      setCandidates(res.candidates || []);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function addFrom(candidate) {
    setBusy(true); setError('');
    try {
      await api.createMusic({
        title: candidate.title,
        artist: candidate.artist,
        album: candidate.album,
        artwork_url: candidate.artwork_url,
        preview_url: candidate.preview_url,
        duration: candidate.duration,
        genre: candidate.genre,
        release_year: candidate.release_year,
        url: candidate.page_url,
        source: candidate.platform
      });
      setCandidates(null);
      setQuery('');
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function play(item) {
    try { setPlaying(await api.getMusic(item.id)); }
    catch (e) { setError(e.message); }
  }

  async function remove(id) {
    if (!confirm('确定删除该音乐收藏？')) return;
    try { await api.deleteMusic(id); await load(); }
    catch (e) { setError(e.message); }
  }

  const renderCard = (m) => (
    <Card
      key={m.id}
      title={m.title}
      description={m.track?.artist ? `${m.track.artist}${m.track.album ? ' · ' + m.track.album : ''}` : m.summary}
      coverUrl={m.track?.artwork_url || m.cover_path}
      tags={m.tags}
      meta={
        <span class="row" style="gap:10px">
          {m.track?.duration && <span class="muted meta-item"><Icon name="clock" size={13} /> {Math.floor(m.track.duration / 60)}:{String(m.track.duration % 60).padStart(2, '0')}</span>}
          {m.track?.genre && <span class="muted meta-item"><Icon name="music" size={13} /> {m.track.genre}</span>}
          {m.progress?.progress > 0 && <span class="muted">已听 {m.progress.progress}%</span>}
        </span>
      }
      onClick={() => route(`/music/${m.id}`)}
      footer={
        <span class="row">
          <button class="primary" onClick={(e) => { e.stopPropagation(); play(m); }}>播放</button>
          <button onClick={(e) => { e.stopPropagation(); route(`/music/${m.id}`); }}>详情</button>
          <button onClick={(e) => { e.stopPropagation(); route(`/music/${m.id}/edit`); }}>编辑</button>
          <button class="danger" onClick={(e) => { e.stopPropagation(); remove(m.id); }}>删除</button>
        </span>
      }
    />
  );

  return (
    <section>
      <div class="toolbar">
        <h2 style="margin:0">音乐库</h2>
        <span class="spacer" />
        <button class="primary" onClick={() => route('/music/new')}>手动添加</button>
        <ViewSwitch />
      </div>

      <form class="toolbar" onSubmit={search}>
        <input
          placeholder="搜索歌曲名 / 歌手 / 专辑，抓取元数据"
          value={query}
          onInput={(e) => setQuery(e.currentTarget.value)}
          style="max-width:420px"
        />
        <button class="primary" type="submit" disabled={busy}>{busy ? '搜索中…' : '搜索元数据'}</button>
      </form>

      {error && <p style="color:var(--danger)">{error}</p>}

      {candidates && (
        <div class="card" style="padding:14px;margin-bottom:18px">
          <div class="row" style="margin-bottom:8px">
            <strong>搜索结果</strong>
            <span class="spacer" />
            <button onClick={() => setCandidates(null)}>关闭</button>
          </div>
          {candidates.length === 0 && <div class="muted">无匹配结果</div>}
          <div class="stack">
            {candidates.map((c) => (
              <div class="row" key={c.external_id || c.title} style="gap:10px;border-bottom:1px solid var(--border);padding-bottom:8px">
                {c.artwork_url && <img src={c.artwork_url} alt="" style="width:44px;height:44px;border-radius:6px;object-fit:cover" />}
                <span class="stack" style="gap:2px">
                  <strong style="font-size:14px">{c.title}</strong>
                  <span class="muted" style="font-size:12px">{c.artist} · {c.album} {c.release_year ? `· ${c.release_year}` : ''}</span>
                </span>
                <span class="spacer" />
                <button class="primary" onClick={() => addFrom(c)} disabled={busy}>收藏</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {playing && (
        <div class="card" style="padding:16px;margin-bottom:20px">
          <div class="row" style="margin-bottom:8px">
            <strong>{playing.title}</strong>
            <span class="muted">{playing.track?.artist}</span>
            <span class="spacer" />
            <button onClick={() => setPlaying(null)}>收起</button>
          </div>
          <AudioPlayer music={playing} />
        </div>
      )}

      {loading ? <div class="center-box">加载中…</div> :
        viewMode === 'gallery'
          ? <GalleryView items={items} renderCard={renderCard} />
          : <TimelineView items={items} renderCard={renderCard} />}
    </section>
  );
}
