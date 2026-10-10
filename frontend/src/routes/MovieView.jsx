// 影视详情页：影院级质感（模糊海报背景 + 大海报 + 元信息 + 线路/剧集选择 + 播放）
// 播放时切换到全屏播放器视图，只显示播放器，下方不再重复卡片。
import { useEffect, useMemo, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { MoviePlayer } from '../components/MoviePlayer.jsx';
import { TagChip } from '../components/TagChip.jsx';
import { Icon } from '../components/Icon.jsx';
import { useAuth } from '../lib/auth.jsx';
import { toastSuccess, toastError } from '../lib/toast.jsx';

import { LoadingState, ErrorState } from '../components/StateView.jsx';

// 只展示可直连播放的剧集（与后端 isPlayableUrl 同规则）：
// 采集源返回的 vod_play_url 里混着分享页 /share/xxx、网页播放页 /play/123 这类**非直链**，
// 之前它们也会出现在线路/剧集列表里，用户点到必然报「片源无法解析」。
const isPlayable = (url = '') => /\.(m3u8|mp4)(\?|#|$)/i.test(String(url));
// 采集源的线路标识（vod_play_from）是站点内部代号，展示时换成人能读的源名
const ROUTE_LABELS = [
  [/lzm3u8|lzi/i, '量子资源'],
  [/ffm3u8|ffzy/i, '非凡资源'],
  [/dytt/i, '电影天堂'],
  [/zuid/i, '最大资源'],
  [/360|zy360/i, '360资源'],
  [/heimuer|hmy/i, '黑木耳'],
  [/wolong|wlm3u8/i, '卧龙资源'],
  [/cjhw|hwba/i, '新华为'],
  [/^gs/i, '光速资源'],
  [/^sub/i, '速播资源'],
  [/^hh/i, '豪华资源'],
  [/^ik/i, '艾坤资源'],
  [/modu/i, '魔都资源']
];
function routeLabel(name) {
  const raw = String(name || '').trim();
  if (!raw) return '默认线路';
  const hit = ROUTE_LABELS.find(([re]) => re.test(raw));
  const base = hit ? hit[1] : raw;
  const proto = /m3u8/i.test(raw) ? 'm3u8' : (/mp4/i.test(raw) ? 'mp4' : '');
  return proto ? `${base} · ${proto}` : base;
}

// 主演名单常常 20+ 位，详情页只展示前 8 位
function trimCast(cast, max = 8) {
  const list = String(cast || '').split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
  if (list.length <= max) return list.join('、');
  return `${list.slice(0, max).join('、')} 等 ${list.length} 位`;
}

// 访客直接播放（2026-10-09）：/movies/watch/:source/:vid 不入库，直接按采集源详情播放。
// 片单页点击时会把候选条目放进 sessionStorage，命中则免一次请求。
export const WATCH_KEY = 'dora:watch';
function candidateToMovie(c, source, vid) {
  return {
    id: null,
    title: c.title,
    url: c.playable_url || '',
    cover_path: c.poster_url || '',
    title_info: { ...c, source_key: source, source_vod_id: vid }
  };
}

export function MovieView({ id, source, vid }) {
  const preview = !!(source && vid);
  const { isAdmin } = useAuth();
  const [movie, setMovie] = useState(null);
  const [error, setError] = useState('');
  const [routeIndex, setRouteIndex] = useState(0);
  const [epIndex, setEpIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [liveRoutes, setLiveRoutes] = useState(null);   // 回源获取的最新线路
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // 站长专用：原采集源下线 / 存库直链已死时，用标题去在用源重新匹配并回填。
  // 访客与普通用户不显示此入口；后端也只允许本人写。
  async function rematch() {
    const targetId = movie?.id || id;
    if (!targetId) return;
    setRematching(true);
    try {
      const res = await api.refreshMovieSource(targetId);
      setError('');
      setLiveRoutes(null);
      setReloadKey((k) => k + 1);   // 触发下面 effect 重新拉取最新数据
      toastSuccess(`已重新匹配到「${res?.source_name || res?.source_key || '新片源'}」`);
      return res;
    } catch (e) {
      setError(`重新匹配失败：${e.message}`);
      toastError(`重新匹配失败：${e.message}`);
    } finally {
      setRematching(false);
    }
    return null;
  }

  useEffect(() => {
    (async () => {
      try {
        if (!preview) { setMovie(await api.getMovie(id)); return; }
        let cached = null;
        try { cached = JSON.parse(sessionStorage.getItem(WATCH_KEY) || 'null'); } catch { /* ignore */ }
        const hit = cached && String(cached.source) === source && String(cached.external_id) === String(vid) ? cached : null;
        const c = hit || await api.getMovieSourceDetail({ source, external_id: vid });
        if (!c || !c.title) throw new Error('该片源已失效，换一个结果试试');
        setMovie(candidateToMovie(c, source, vid));
      } catch (e) { setError(e.message); }
    })();
  }, [id, source, vid, reloadKey]);

  const t = movie?.title_info || {};
  const poster = t.poster_url || movie?.cover_path;

  // 已保存的线路；若无则尝试回源拉取完整线路（采集源资源）。
  // 只保留「至少含一个可直连剧集」的线路，并剔除其中的非直链剧集
  //（分享页 /share/xxx、网页播放页 /play/123 等交给播放器只会报「片源无法解析」）。
  const routes = useMemo(() => {
    const saved = Array.isArray(t.routes) ? t.routes : [];
    const raw = saved.length ? saved : (Array.isArray(liveRoutes) ? liveRoutes : []);
    const cleaned = raw
      .map((r) => ({ name: r.name, episodes: (r.episodes || []).filter((e) => isPlayable(e.url)) }))
      .filter((r) => r.episodes.length);
    // 兜底：清洗后为空（源站格式异常）时保留原始线路，避免整页无内容
    return cleaned.length ? cleaned : raw;
  }, [t.routes, liveRoutes]);

  // 线路标签去重：同一采集源可能出现多条线路（m3u8 / mp4），加序号区分
  const routeLabels = useMemo(() => {
    const seen = new Map();
    return routes.map((r) => {
      const base = routeLabel(r.name);
      const n = (seen.get(base) || 0) + 1;
      seen.set(base, n);
      return n > 1 ? `${base} (${n})` : base;
    });
  }, [routes]);

  // 回源：采集源资源且未保存线路时，按 source_key + source_vod_id 拉取详情
  useEffect(() => {
    if (!movie || routes.length) return;
    if (preview && movie.title_info?.routes?.length) return;
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
  // 播放地址优先级：选中剧集 > 保存的播放直链（保存的地址必须是直链才用）
  const playUrl = currentEpisode?.url || (isPlayable(movie?.url) ? movie.url : '') || '';
  // 存库地址不是直链（历史数据里的分享页/网页地址）→ 视为「失效」，供站长看到重匹配入口
  const urlStale = !!movie?.url && !isPlayable(movie.url) && !episodes.length;

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

  // 详情加载失败：管理员可点「重新匹配片源」自愈（原采集源可能已下线，如 dytt/jszy/lzi）
  if (error && !movie) {
    return (
      <div class="stack">
        <ErrorState title="影视详情加载失败" message={error} />
        {isAdmin && id && (
          <button class="primary" disabled={rematching} onClick={rematch}>
            <Icon name="refresh" size={15} /> {rematching ? '正在重新匹配…' : '重新匹配片源'}
          </button>
        )}
      </div>
    );
  }
  if (!movie) return <LoadingState shape="poster" count={6} />;

  const year = t.release_date ? String(t.release_date).slice(0, 4) : null;
  const isSeries = t.media_type === 'tv' || episodes.length > 1;

  return (
    <article class="detail-page">
      <div class="page-bar">
        <button onClick={() => (preview && history.length > 1 ? history.back() : route('/movies'))}><Icon name="arrowLeft" size={15} /> 返回影视库</button>
        <span class="spacer" />
        {movie.id && <button onClick={() => route(`/movies/${movie.id}/edit`)}>编辑</button>}
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
            {t.cast_list && <p class="detail-line"><b>主演</b><span title={t.cast_list}>{trimCast(t.cast_list)}</span></p>}
            {t.overview && <p class="detail-content">{t.overview}</p>}

            <div class="detail-actions">
              {playUrl
                ? <button class="primary" onClick={() => setPlaying(true)}>
                    <Icon name="play" size={15} /> 立即播放
                  </button>
                : <span class="muted" style="font-size:13px">
                    暂无播放地址{loadingRoutes ? '（正在获取线路…）' : '，请在编辑页补充或换一个采集源'}
                  </span>}
              {/* 站长专用：原采集源下线/直链失效时重新匹配（后端只允许本人写） */}
              {isAdmin && movie.id && (!playUrl || urlStale) && (
                <button disabled={rematching} onClick={rematch}>
                  <Icon name="refresh" size={15} /> {rematching ? '正在重新匹配…' : '重新匹配片源'}
                </button>
              )}
              {movie.tags?.map((tag) => <TagChip key={tag.id} name={tag.name} color={tag.color} />)}
            </div>
          </div>
        </div>
      </section>

      {/* 线路与剧集选择 */}
      {routes.length > 0 && (
        <>
          <div class="grid-head">
            <h2><span class="bar" />{isSeries ? '剧集列表' : '播放线路'}</h2>
            <span class="count">
              {routes.length > 1 ? `${routes.length} 条线路` : '1 条线路'}
              {isSeries && episodes.length ? ` · ${episodes.length} 集` : ''}
            </span>
          </div>

          {routes.length > 1 && (
            <div class="route-chips">
              {routes.map((r, i) => {
                const label = routeLabels[i];
                return (
                  <button
                    key={`${r.name}-${i}`}
                    class={`chip${i === routeIndex ? ' active' : ''}`}
                    title={`源标识：${r.name}`}
                    onClick={() => { setRouteIndex(i); setEpIndex(0); }}
                  >
                    {label}
                    <span class="chip-n">{r.episodes?.length || 0}</span>
                  </button>
                );
              })}
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

      {error && <div class="notice danger">{error}</div>}

      {t.notes && (
        <section class="stack">
          <h3 style="margin:0">备注</h3>
          <p class="muted" style="white-space:pre-wrap">{t.notes}</p>
        </section>
      )}
    </article>
  );
}
