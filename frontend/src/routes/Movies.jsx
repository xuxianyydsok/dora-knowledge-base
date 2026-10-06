// 影视库列表页：元数据搜索新增 + 列表（画廊/时间流）+ 快速播放
import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { Card } from '../components/Card.jsx';
import { GalleryView } from '../components/GalleryView.jsx';
import { TimelineView } from '../components/TimelineView.jsx';
import { ViewSwitch } from '../components/ViewSwitch.jsx';
import { useViewMode } from '../lib/viewMode.jsx';

export function Movies() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { viewMode } = useViewMode();

  async function load() {
    setLoading(true);
    try { setItems(await api.listMovies()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function search(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true); setError(''); setCandidates(null);
    try {
      const res = await api.searchMovieMeta(query, 6);
      setCandidates(res.candidates || []);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
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
        external_id: candidate.external_id,
        source: candidate.source,
        url: candidate.page_url
      });
      setCandidates(null);
      setQuery('');
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function remove(id) {
    if (!confirm('确定删除该影视收藏？')) return;
    try { await api.deleteMovie(id); await load(); }
    catch (e) { setError(e.message); }
  }

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
            <span class="tag-chip">{t.media_type === 'tv' ? '📺 剧集' : '🎬 电影'}</span>
            {t.release_date && <span class="muted">{String(t.release_date).slice(0, 4)}</span>}
            {t.rating != null && <span class="muted">⭐ {t.rating}</span>}
            {m.progress?.progress > 0 && <span class="muted">已看 {m.progress.progress}%</span>}
          </span>
        }
        onClick={() => route(`/movies/${m.id}`)}
        footer={
          <span class="row">
            <button class="primary" onClick={(e) => { e.stopPropagation(); route(`/movies/${m.id}`); }}>详情</button>
            <button onClick={(e) => { e.stopPropagation(); route(`/movies/${m.id}/edit`); }}>编辑</button>
            <button class="danger" onClick={(e) => { e.stopPropagation(); remove(m.id); }}>删除</button>
          </span>
        }
      />
    );
  };

  return (
    <section>
      <div class="toolbar">
        <h2 style="margin:0">影视库</h2>
        <span class="spacer" />
        <button class="primary" onClick={() => route('/movies/new')}>手动添加</button>
        <ViewSwitch />
      </div>

      <form class="toolbar" onSubmit={search}>
        <input
          placeholder="搜索影视名称，抓取元数据（TVmaze）"
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
                {c.poster_url && <img src={c.poster_url} alt="" style="width:44px;height:64px;border-radius:6px;object-fit:cover" />}
                <span class="stack" style="gap:2px">
                  <strong style="font-size:14px">{c.title}</strong>
                  <span class="muted" style="font-size:12px">
                    {c.media_type === 'tv' ? '剧集' : '电影'}
                    {c.release_date ? ` · ${String(c.release_date).slice(0, 4)}` : ''}
                    {c.rating != null ? ` · ⭐ ${c.rating}` : ''}
                  </span>
                </span>
                <span class="spacer" />
                <button class="primary" onClick={() => addFrom(c)} disabled={busy}>收藏</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? <div class="center-box">加载中…</div> :
        viewMode === 'gallery'
          ? <GalleryView items={items} renderCard={renderCard} />
          : <TimelineView items={items} renderCard={renderCard} />}
    </section>
  );
}
