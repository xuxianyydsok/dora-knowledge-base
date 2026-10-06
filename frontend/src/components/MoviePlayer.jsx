// 影视播放器：影院模式
// - 支持 m3u8（hls.js 动态懒加载，非 Safari）与 mp4（原生播放）
// - 播放时只显示播放器：线路/选集以浮层出现，页面下方不再重复卡片
// - 支持上一集/下一集、线路切换、进度记忆（定时上报后端）
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './Icon.jsx';
import { api } from '../lib/api.js';

function fmt(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

function isHls(url = '') {
  return /\.m3u8(\?|#|$)/i.test(url);
}

export function MoviePlayer({
  movie,
  title,
  episodeName,
  episodeIndex = 0,
  episodeCount = 0,
  routes = [],
  routeIndex = 0,
  episodes = [],
  onSelectEpisode,
  onSelectRoute,
  onEnded,
  onClose
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const wrapRef = useRef(null);
  const lastSavedRef = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  const [loadingSrc, setLoadingSrc] = useState(true);
  const [saved, setSaved] = useState('');
  const [panel, setPanel] = useState('');       // '' | 'routes' | 'episodes'
  const [chromeVisible, setChromeVisible] = useState(true);

  const src = movie?.url || '';

  // —— 加载片源：m3u8 走 hls.js（动态 import，符合重型库懒加载规范）——
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !src) return;
    let disposed = false;
    setError(''); setPlaying(false); setCurrent(0); setDuration(0); setLoadingSrc(true);
    setPanel('');

    const resume = Number(movie?.progress?.position) || 0;
    const onLoaded = () => {
      if (disposed) return;
      setDuration(el.duration || 0);
      setLoadingSrc(false);
      if (resume > 0 && resume < (el.duration || Infinity) - 3) {
        el.currentTime = resume;
        setCurrent(resume);
      }
    };
    el.addEventListener('loadedmetadata', onLoaded);

    if (isHls(src) && !el.canPlayType('application/vnd.apple.mpegurl')) {
      (async () => {
        try {
          const { default: Hls } = await import('hls.js');
          if (disposed) return;
          if (!Hls.isSupported()) { el.src = src; return; }
          const hls = new Hls({ lowLatencyMode: false, maxBufferLength: 30 });
          hlsRef.current = hls;
          hls.loadSource(src);
          hls.attachMedia(el);
          hls.on(Hls.Events.ERROR, (_e, data) => {
            if (!data?.fatal) return;
            setError('该线路播放失败，请切换到其他线路重试');
            setLoadingSrc(false);
          });
        } catch {
          if (!disposed) { el.src = src; }
        }
      })();
    } else {
      el.src = src;
    }

    return () => {
      disposed = true;
      el.removeEventListener('loadedmetadata', onLoaded);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [movie?.id, src]);

  // —— 每 5 秒上报一次进度 ——
  useEffect(() => {
    if (!playing || !movie?.id) return;
    const timer = setInterval(() => saveProgress(), 5000);
    return () => clearInterval(timer);
  }, [playing, movie?.id]);

  // —— 空闲 2.8s 后自动隐藏控制层（移动端交互由触摸唤出）——
  useEffect(() => {
    if (!playing) { setChromeVisible(true); return; }
    let timer = setTimeout(() => setChromeVisible(false), 2800);
    const wake = () => {
      setChromeVisible(true);
      clearTimeout(timer);
      timer = setTimeout(() => setChromeVisible(false), 2800);
    };
    const el = wrapRef.current;
    el?.addEventListener('mousemove', wake);
    el?.addEventListener('touchstart', wake);
    return () => {
      clearTimeout(timer);
      el?.removeEventListener('mousemove', wake);
      el?.removeEventListener('touchstart', wake);
    };
  }, [playing]);

  async function saveProgress(completed = false) {
    const el = videoRef.current;
    if (!el || !movie?.id) return;
    const position = Math.round(el.currentTime);
    if (!completed && position === lastSavedRef.current) return;
    try {
      await api.saveMovieProgress(movie.id, {
        position,
        duration: Math.round(el.duration || duration || 0) || undefined,
        completed
      });
      lastSavedRef.current = position;
      setSaved('已保存');
      setTimeout(() => setSaved(''), 1500);
    } catch (e) {
      setSaved(`保存失败: ${e.message}`);
    }
  }

  function toggle() {
    const el = videoRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); saveProgress(); }
    else { el.play().then(() => setPlaying(true)).catch(() => setError('浏览器阻止了自动播放，请再次点击播放')); }
  }

  function seek(e) {
    const el = videoRef.current;
    if (!el) return;
    const val = Number(e.currentTarget.value);
    el.currentTime = val;
    setCurrent(val);
  }

  function changeVolume(e) {
    const val = Number(e.currentTarget.value);
    setVolume(val);
    setMuted(val === 0);
    if (videoRef.current) { videoRef.current.volume = val; videoRef.current.muted = val === 0; }
  }

  function toggleMute() {
    const el = videoRef.current;
    if (!el) return;
    const next = !muted;
    setMuted(next);
    el.muted = next;
  }

  function toggleFullscreen() {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }

  const hasPrev = episodeIndex > 0;
  const hasNext = episodeCount > 0 && episodeIndex + 1 < episodeCount;

  return (
    <div ref={wrapRef} class={`watch${chromeVisible ? '' : ' hide-chrome'}`}>
      <div class="watch-stage">
        <video
          ref={videoRef}
          playsinline
          preload="metadata"
          poster={movie?.title_info?.poster_url || movie?.cover_path || undefined}
          onClick={toggle}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onEnded={() => { setPlaying(false); saveProgress(true); onEnded?.(); }}
        />

        {loadingSrc && !error && (
          <div class="watch-overlay center"><span class="orb"><i /><i /></span></div>
        )}
        {error && (
          <div class="watch-overlay center">
            <div class="watch-error">
              <Icon name="linkBroken" size={22} />
              <p>{error}</p>
              {routes.length > 1 && <button onClick={() => setPanel('routes')}>切换线路</button>}
            </div>
          </div>
        )}
        {!playing && !error && !loadingSrc && (
          <button class="watch-bigplay" onClick={toggle} aria-label="播放">
            <Icon name="play" size={30} />
          </button>
        )}
      </div>

      {/* —— 顶部：返回 + 标题 —— */}
      <div class="watch-top">
        <button class="watch-icon" onClick={onClose} title="返回详情">
          <Icon name="arrowLeft" size={17} />
        </button>
        <div class="watch-title">
          <strong>{title}</strong>
          {episodeName && <span>{episodeName}</span>}
        </div>
        <span class="spacer" />
        {saved && <span class="watch-saved">{saved}</span>}
      </div>

      {/* —— 底部控制条 —— */}
      <div class="watch-bar">
        <input
          class="watch-seek"
          type="range"
          min={0}
          max={duration || 0}
          step={1}
          value={current}
          onInput={seek}
          aria-label="播放进度"
        />
        <div class="watch-controls">
          <button
            class="watch-icon"
            disabled={!hasPrev}
            onClick={() => onSelectEpisode?.(episodeIndex - 1)}
            title="上一集"
          >⏮</button>
          <button class="watch-icon" onClick={toggle} title={playing ? '暂停' : '播放'}>
            <Icon name={playing ? 'pause' : 'play'} size={17} />
          </button>
          <button
            class="watch-icon"
            disabled={!hasNext}
            onClick={() => onSelectEpisode?.(episodeIndex + 1)}
            title="下一集"
          >⏭</button>

          <span class="watch-time">{fmt(current)} / {fmt(duration)}</span>
          <span class="spacer" />

          {episodeCount > 1 && (
            <button class={`watch-icon${panel === 'episodes' ? ' active' : ''}`} onClick={() => setPanel(panel === 'episodes' ? '' : 'episodes')} title="选集">
              <Icon name="layers" size={16} />
            </button>
          )}
          {routes.length > 1 && (
            <button class={`watch-icon${panel === 'routes' ? ' active' : ''}`} onClick={() => setPanel(panel === 'routes' ? '' : 'routes')} title="线路">
              <Icon name="globe" size={16} />
            </button>
          )}

          <button class="watch-icon" onClick={toggleMute} title={muted ? '取消静音' : '静音'}>
            <Icon name="volume" size={16} />
          </button>
          <input
            class="watch-vol"
            type="range" min={0} max={1} step={0.05}
            value={muted ? 0 : volume}
            onInput={changeVolume}
            aria-label="音量"
          />
          <button class="watch-icon" onClick={toggleFullscreen} title="全屏">
            <Icon name="preview" size={16} />
          </button>
        </div>
      </div>

      {/* —— 浮层：线路 / 选集 —— */}
      {panel === 'routes' && (
        <div class="watch-panel">
          <div class="watch-panel-head"><strong>播放线路</strong><button class="watch-icon" onClick={() => setPanel('')}><Icon name="close" size={15} /></button></div>
          <div class="watch-panel-body chips">
            {routes.map((r, i) => (
              <button key={`${r.name}-${i}`} class={`chip${i === routeIndex ? ' active' : ''}`}
                onClick={() => { onSelectRoute?.(i); setPanel(''); }}>
                {r.name}<span class="chip-n">{r.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {panel === 'episodes' && (
        <div class="watch-panel">
          <div class="watch-panel-head"><strong>选集</strong><button class="watch-icon" onClick={() => setPanel('')}><Icon name="close" size={15} /></button></div>
          <div class="watch-panel-body episodes-grid">
            {episodes.map((ep, i) => (
              <button key={`${ep.name}-${i}`} class={`ep${i === episodeIndex ? ' active' : ''}`}
                onClick={() => { onSelectEpisode?.(i); setPanel(''); }} title={ep.name}>
                {ep.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
