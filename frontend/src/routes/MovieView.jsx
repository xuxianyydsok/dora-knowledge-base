// 影视详情页：海报、元信息、播放器、标签、简介、备注
import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { MoviePlayer } from '../components/MoviePlayer.jsx';
import { TagChip } from '../components/TagChip.jsx';

export function MovieView({ id }) {
  const [movie, setMovie] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try { setMovie(await api.getMovie(id)); }
      catch (e) { setError(e.message); }
    })();
  }, [id]);

  if (error) return <div class="center-box" style="color:var(--danger)">{error}</div>;
  if (!movie) return <div class="center-box">加载中…</div>;

  const t = movie.title_info || {};
  const poster = t.poster_url || movie.cover_path;

  return (
    <article class="stack">
      <div class="toolbar">
        <button onClick={() => route('/movies')}>← 返回列表</button>
        <span class="spacer" />
        <button onClick={() => route(`/movies/${movie.id}/edit`)}>编辑</button>
      </div>

      <div class="row" style="gap:20px;align-items:flex-start;flex-wrap:wrap">
        {poster
          ? <img src={poster} alt={movie.title} style="width:200px;border-radius:var(--radius)" />
          : <div class="card-cover-placeholder" style="width:200px;height:300px;border-radius:var(--radius)">🎬</div>}
        <div class="stack" style="flex:1;min-width:260px">
          <h1 style="margin:0">{movie.title}</h1>
          {t.original_title && <div class="muted">{t.original_title}</div>}
          <div class="row" style="gap:10px;flex-wrap:wrap">
            <span class="tag-chip">{t.media_type === 'tv' ? '📺 剧集' : '🎬 电影'}</span>
            {t.release_date && <span class="tag-chip">📅 {t.release_date}</span>}
            {t.runtime && <span class="tag-chip">⏱ {t.runtime} 分钟</span>}
            {t.rating != null && <span class="tag-chip">⭐ {t.rating}</span>}
            {t.genres && <span class="tag-chip">🏷 {t.genres}</span>}
            {movie.tags?.map((tag) => <TagChip key={tag.id} name={tag.name} color={tag.color} />)}
          </div>
          {(t.director || t.cast_list) && (
            <div class="muted" style="font-size:13px">
              {t.director && <div>导演：{t.director}</div>}
              {t.cast_list && <div>主演：{t.cast_list}</div>}
            </div>
          )}
          {movie.url && (
            <a href={movie.url} target="_blank" rel="noreferrer">前往外部详情页 ↗</a>
          )}
        </div>
      </div>

      <div class="card" style="padding:16px">
        <MoviePlayer movie={movie} />
      </div>

      {t.overview && (
        <section class="stack">
          <h3 style="margin:0">简介</h3>
          <p class="muted" style="white-space:pre-wrap">{t.overview}</p>
        </section>
      )}

      {t.notes && (
        <section class="stack">
          <h3 style="margin:0">备注</h3>
          <p class="muted" style="white-space:pre-wrap">{t.notes}</p>
        </section>
      )}
    </article>
  );
}
