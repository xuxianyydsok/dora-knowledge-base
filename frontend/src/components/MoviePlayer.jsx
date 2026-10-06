// HTML5 影视播放器组件
// 播放地址为外部直链，后端不转发视频流
// 支持：播放/暂停、进度条、音量、全屏、进度记忆（加载时定位、定时上报后端）
import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../lib/api.js';

function fmt(sec) {
  if (!Number.isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function MoviePlayer({ movie }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(movie?.title_info?.runtime ? movie.title_info.runtime * 60 : 0);
  const [volume, setVolume] = useState(1);
  const [saved, setSaved] = useState('');
  const lastSavedRef = useRef(0);

  const src = movie?.url;

  // 加载时恢复上次进度
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !src) return;
    setPlaying(false);
    setCurrent(0);

    const resume = movie?.progress?.position || 0;
    const onLoaded = () => {
      setDuration(el.duration || 0);
      if (resume > 0 && resume < (el.duration || Infinity) - 3) {
        el.currentTime = resume;
        setCurrent(resume);
      }
    };
    el.addEventListener('loadedmetadata', onLoaded);
    return () => el.removeEventListener('loadedmetadata', onLoaded);
  }, [movie?.id, src]);

  // 每 5 秒上报一次进度
  useEffect(() => {
    if (!playing || !movie?.id) return;
    const timer = setInterval(() => saveProgress(), 5000);
    return () => clearInterval(timer);
  }, [playing, movie?.id]);

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
    else { el.play().then(() => setPlaying(true)).catch(() => {}); }
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
    if (videoRef.current) videoRef.current.volume = val;
  }

  if (!src) {
    return (
      <div class="stack">
        <p class="muted">该影视暂无播放地址，请在编辑页补充「播放地址」。</p>
      </div>
    );
  }

  return (
    <div class="stack" style="gap:10px">
      <video
        ref={videoRef}
        src={src}
        controls
        preload="metadata"
        style="width:100%;max-height:70vh;background:#000;border-radius:var(--radius)"
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onEnded={() => { setPlaying(false); saveProgress(true); }}
      />
      <div class="row" style="gap:12px">
        <button class="primary" onClick={toggle} style="min-width:72px">{playing ? '⏸ 暂停' : '▶ 播放'}</button>
        <span class="muted" style="font-variant-numeric:tabular-nums">{fmt(current)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={1}
          value={current}
          onInput={seek}
          style="flex:1;padding:0"
        />
        <span class="muted" style="font-variant-numeric:tabular-nums">{fmt(duration)}</span>
      </div>
      <div class="row" style="gap:10px">
        <span class="muted" style="font-size:12px">音量</span>
        <input type="range" min={0} max={1} step={0.05} value={volume} onInput={changeVolume} style="width:120px;padding:0" />
        <span class="spacer" />
        {saved && <span class="muted" style="font-size:12px">{saved}</span>}
        <button onClick={() => saveProgress()}>保存进度</button>
        <button onClick={() => saveProgress(true)}>标记看完</button>
      </div>
    </div>
  );
}
