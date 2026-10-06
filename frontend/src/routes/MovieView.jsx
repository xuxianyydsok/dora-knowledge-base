// 影视详情页：影院级质感（模糊海报背景 + 大海报 + 元信息 + 线路/剧集选择 + 播放）
// 播放时切换到全屏播放器视图，只显示播放器，下方不再重复卡片。
import { useEffect, useMemo, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { MoviePlayer } from '../components/MoviePlayer.jsx';
import { TagChip } from '../components/TagChip.jsx';
import { Icon } from '../components/Icon.jsx';

export function MovieView({ id }) {
  const [movie, setMovie] = useState(null);
  const [error, setError] = useState('');
  const [routeIndex, setRouteIndex] = useState(0);
  const [epIndex, setEpIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [liveRoutes, setLiveRoutes] = useState(null);   // 回源获取的最新线路
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  useEffect(() => {
    (async () => {
      try { setMovie(await api.getMovie(id)); }
      catch (e) { setError(e.message); }
    })();
  }, [id]);

  const t = movie?.title_info || {};
  const poster = t.poster_url || movie?.cover_path;

  // 已保存的线路；若无则尝试回源拉取完整线路（采集源资源）
  const routes = useMemo(() => {
    const saved = Array.isArray(t.routes) ? t.routes : [];
    if (saved.length) return saved;
    return Array.isArray(liveRoutes) ? liveRoutes : [];
  }, [t.routes, liveRoutes]);

  // 回源：采集源资源且未保存线路时，按 source_key + source_vod_id 拉取详情
  useEffect(() => {
    if (!movie || routes.length) return;
    const sk = t.source_key;
    const sid = t.source_vod_id || t.external_id;
    if (!sk || !sid) return;
    setLoadingRoutes(true);
    (async () => {
      try {
        const d = await api.getMovieSourceDetail({ source: sk, external_id: sid });
        setLiveRoutes(d.routes || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoadingRoutes(false);
      }
    })();
  }, [movie?.id, t.source_key, t.source_vod_id, routes.length]);

  const episodes = routes[routeIndex]?.episodes || [];
  const currentEpisode = episodes[epIndex] || null;
  // 播放地址优先级：选中剧集 > 保存的播放直链
  const playUrl = currentEpisode?.url || movie?.url || '';

  // 进入播放时隐藏全局顶栏，营造影院模式；离开时恢复
  useEffect(() => {
    if (playing && playUrl) document.body.classList.add('watch-mode');
    else document.body.classList.remove('watch-mode');
    return () => document.body.classList.remove('watch-mode');
  }, [playing, playUrl]);

  // 播放中：只显示播放器（返回列表 / 剧集选择都在播放器控制区）
  if (playing && playUrl) {
    return (
      <MoviePlayer
        movie={{ ...movie, url: playUrl }}
        title={movie.title}
        episodeName={currentEpisode?.name || ''}
        episodeIndex={epIndex}
        episodeCount={episodes.length}
        routes={routes.map((r) => ({ name: r.name, count: r.episodes?.length || 0 }))}
        routeIndex={routeIndex}
        episodes={episodes.map((e) => ({ name: e.name }))}
        onSelectEpisode={setEpIndex}
        onSelectRoute={(i) => { setRouteIndex(i); setEpIndex(0); }}
        onEnded={() => {
          if (epIndex + 1 < episodes.length) setEpIndex(epIndex + 1);
        }}
        onClose={() => setPlaying(false)}
      />
    );
  }

  if (error && !movie) return <div class="center-box" style="color:var(--danger)">{error}</div>;
  if (!movie) return <div class="center-box">加载中…</div>;

  const year = t.release_date ? String(t.release_date).slice(0, 4) : null;
  const isSeries = t.media_type === 'tv' || episodes.length > 1;

  return (
    <article class="detail-page">
      <div class="page-bar">
        <button onClick={() => route('/movies')}><Icon name="arrowLeft" size={15} /> 返回影视库</button>
        <span class="spacer" />
        <button onClick={() => route(`/movies/${movie.id}/edit`)}>编辑</button>
      </div>

      {/* 详情头：海报模糊铺底 + 大海报 + 信息 */}
      <section class="detail-hero">
        {poster && <div class="detail-backdrop" style={`background-image:url(${poster})`} />}
        <div class="detail-body">
          <div class="poster-lg">
            {poster
              ? <img src={poster} alt={movie.title} />
              : <span class="poster-initial">{(movie.title || '影').charAt(0)}</span>}
          </div>

          <div class="detail-info">
            <h1>{movie.title}</h1>
            {t.original_title && <div class="detail-sub">{t.original_title}</div>}

            <div class="meta-row">
              {year && <span>{year}</span>}
              {t.area && <span>{t.area}</span>}
              {t.genres && <span>{t.genres}</span>}
              {t.runtime ? <span>{t.runtime} 分钟</span> : null}
              {t.rating != null && <span class="score">{t.rating} 分</span>}
              {episodes.length > 1 && <span class="ep-count">共 {episodes.length} 集</span>}
              {t.remarks && <span class="remark-chip">{t.remarks}</span>}
              {t.source_name && <span class="src-chip">{t.source_name}</span>}
            </div>

            {t.director && <p class="detail-line"><b>导演</b>{t.director}</p>}
            {t.cast_list && <p class="detail-line"><b>主演</b>{t.cast_list}</p>}
            {t.overview && <p class="detail-content">{t.overview}</p>}

            <div class="detail-actions">
              {playUrl
                ? <button class="primary" onClick={() => setPlaying(true)}>
                    <Icon name="play" size={15} /> 立即播放
                  </button>
                : <span class="muted" style="font-size:13px">
                    暂无播放地址{loadingRoutes ? '（正在获取线路…）' : '，请在编辑页补充或换一个采集源'}
                  </span>}
              {movie.tags?.map((tag) => <TagChip key={tag.id} name={tag.name} color={tag.color} />)}
            </div>
          </div>
        </div>
      </section>

      {/* 线路与剧集选择 */}
      {routes.length > 0 && (
        <>
          <div class="section-head">
            <h2><span class="bar" />{isSeries ? '剧集列表' : '播放线路'}</h2>
            <span class="count">{episodes.length} 个</span>
          </div>

          {routes.length > 1 && (
            <div class="route-chips">
              {routes.map((r, i) => (
                <button
                  key={`${r.name}-${i}`}
                  class={`chip${i === routeIndex ? ' active' : ''}`}
                  onClick={() => { setRouteIndex(i); setEpIndex(0); }}
                >
                  {r.name}
                  <span class="chip-n">{r.episodes?.length || 0}</span>
                </button>
              ))}
            </div>
          )}

          <div class="episodes">
            {episodes.map((ep, i) => (
              <button
                key={`${ep.name}-${i}`}
                class={`ep${i === epIndex ? ' active' : ''}`}
                onClick={() => { setEpIndex(i); setPlaying(true); }}
                title={ep.name}
              >
                {ep.name}
              </button>
            ))}
          </div>
        </>
      )}

      {error && <p style="color:var(--danger)">{error}</p>}

      {t.notes && (
        <section class="stack">
          <h3 style="margin:0">备注</h3>
          <p class="muted" style="white-space:pre-wrap">{t.notes}</p>
        </section>
      )}
    </article>
  );
}
