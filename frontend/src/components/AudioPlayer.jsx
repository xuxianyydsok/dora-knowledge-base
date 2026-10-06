// HTML5 音频播放器组件（黑胶唱片风格）
// 支持：播放/暂停、进度条、音量、进度记忆（加载时定位、定时上报后端）
// 视觉：唱片随播放旋转；封面 = 专辑图（内圈）+ 歌手头像（外圈标签）
// 点击封面或「歌词」按钮 → 进入同步歌词页（逐句高亮、自动滚动）
import { useEffect, useRef, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { Icon } from './Icon.jsx';

function fmt(sec) {
  if (!Number.isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function AudioPlayer({ music, onProgress }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(music?.track?.duration || 0);
  const [volume, setVolume] = useState(1);
  const [saved, setSaved] = useState('');
  const lastSavedRef = useRef(0);

  const t = music?.track || {};
  const src = t.audio_url || t.preview_url || music?.url;
  const cover = t.artwork_url || music?.cover_path;
  const avatar = t.artist_avatar;
  const isPreview = (t.quality || 'full') === 'preview';
  // 备用播放地址：Audius 单个节点可能拉黑某条音轨，失败时依次尝试
  const fallbacks = Array.isArray(t.audio_fallbacks) ? t.audio_fallbacks : [];
  const [srcIndex, setSrcIndex] = useState(0);
  const activeSrc = [src, ...fallbacks].filter(Boolean)[srcIndex] || src;

  // 主地址播放失败（如 403）时切换到下一个备用节点
  function onAudioError() {
    if (srcIndex < fallbacks.length) {
      setSrcIndex((i) => i + 1);
      setSaved('切换备用音源…');
      setTimeout(() => setSaved(''), 2000);
    } else if (srcIndex > 0) {
      setSaved('所有音源均不可用');
    }
  }

  // 加载时恢复上次进度
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !activeSrc) return;
    setPlaying(false);
    setCurrent(0);

    const resume = music?.progress?.position || 0;
    const onLoaded = () => {
      setDuration(el.duration || t.duration || 0);
      if (resume > 0 && resume < (el.duration || Infinity) - 3) {
        el.currentTime = resume;
        setCurrent(resume);
      }
    };
    el.addEventListener('loadedmetadata', onLoaded);
    return () => el.removeEventListener('loadedmetadata', onLoaded);
  }, [music?.id, activeSrc]);

  // 每 5 秒上报一次进度
  useEffect(() => {
    if (!playing || !music?.id) return;
    const timer = setInterval(() => saveProgress(), 5000);
    return () => clearInterval(timer);
  }, [playing, music?.id]);

  async function saveProgress(completed = false) {
    const el = audioRef.current;
    if (!el || !music?.id) return;
    const position = Math.round(el.currentTime);
    if (!completed && position === lastSavedRef.current) return;
    try {
      await api.saveMusicProgress(music.id, {
        position,
        duration: Math.round(el.duration || duration || 0) || undefined,
        completed
      });
      lastSavedRef.current = position;
      setSaved('已保存');
      setTimeout(() => setSaved(''), 1500);
      // 歌词页需要实时进度，向上层同步
      onProgress?.(position);
    } catch (e) {
      setSaved(`保存失败: ${e.message}`);
    }
  }

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); saveProgress(); }
    else { el.play().then(() => setPlaying(true)).catch(() => {}); }
  }

  function seek(e) {
    const el = audioRef.current;
    if (!el) return;
    const val = Number(e.currentTarget.value);
    el.currentTime = val;
    setCurrent(val);
  }

  function changeVolume(e) {
    const val = Number(e.currentTarget.value);
    setVolume(val);
    if (audioRef.current) audioRef.current.volume = val;
  }

  if (!activeSrc) {
    return (
      <div class="stack">
        <p class="muted">该音乐暂无播放地址，请在编辑页补充「播放地址」。</p>
      </div>
    );
  }

  return (
    <div class="player">
      {/* 黑胶唱片：播放时旋转，点击进入歌词页 */}
      <button
        class="vinyl"
        onClick={() => route(`/music/${music.id}/lyrics`)}
        title="查看歌词"
        aria-label="查看歌词"
      >
        <span class={`vinyl-disc${playing ? ' spinning' : ''}`}>
          <span class="vinyl-grooves" />
          {cover
            ? <img class="vinyl-cover" src={cover} alt={music.title} />
            : <span class="vinyl-cover vinyl-cover-empty"><Icon name="music" size={26} /></span>}
        </span>
        {avatar && <img class="vinyl-avatar" src={avatar} alt={t.artist || '歌手'} />}
        <span class="vinyl-hint">歌词</span>
      </button>

      <div class="stack" style="gap:10px;flex:1;min-width:240px">
        <div class="stack" style="gap:2px">
          <strong style="font-size:16px">{music.title}</strong>
          <span class="muted" style="font-size:13px">
            {t.artist}{t.album ? ` · ${t.album}` : ''}
          </span>
          <span class={`quality-tag${isPreview ? ' quality-preview' : ' quality-full'}`}>
            <Icon name={isPreview ? 'preview' : 'sparkles'} size={12} />
            {isPreview ? '试听片段' : '完整音轨'}
          </span>
        </div>

        <audio
          ref={audioRef}
          src={activeSrc}
          preload="metadata"
          onError={onAudioError}
          onTimeUpdate={(e) => { setCurrent(e.currentTarget.currentTime); onProgress?.(e.currentTarget.currentTime); }}
          onEnded={() => { setPlaying(false); saveProgress(true); }}
        />

        <div class="row" style="gap:12px">
          <button class="primary play-btn" onClick={toggle} aria-label={playing ? '暂停' : '播放'}>
            <Icon name={playing ? 'pause' : 'play'} size={16} />
          </button>
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
          <Icon name="volume" size={15} />
          <input type="range" min={0} max={1} step={0.05} value={volume} onInput={changeVolume} style="width:110px;padding:0" />
          <span class="spacer" />
          {saved && <span class="muted" style="font-size:12px">{saved}</span>}
          <button onClick={() => route(`/music/${music.id}/lyrics`)}>
            <Icon name="lyrics" size={14} /> 歌词
          </button>
          <button onClick={() => saveProgress(true)}>标记听完</button>
        </div>
      </div>
    </div>
  );
}
