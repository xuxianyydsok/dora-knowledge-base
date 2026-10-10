// 底部常驻迷你播放条（参考 Apple Music / Spotify 的 now-playing bar）
// 全局唯一，路由切换不中断；点击左侧展开为沉浸式播放页。
import { route } from 'preact-router';
import { usePlayer } from '../lib/player.jsx';
import { Icon } from './Icon.jsx';

function fmt(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function MiniPlayer() {
  const {
    music, track, playing, position, duration, volume, notice,
    hasPrev, hasNext, toggle, next, prev, seek, setVolume, stop
  } = usePlayer();

  if (!music) return null;

  const pct = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <div class="mini-player" role="region" aria-label="正在播放">
      {/* 进度细线：贴在播放条顶部 */}
      <input
        class="mini-seek"
        type="range"
        min={0}
        max={duration || 0}
        step={1}
        value={position}
        onInput={(e) => seek(Number(e.currentTarget.value))}
        style={`--pct:${pct}%`}
        aria-label="播放进度"
      />

      <button class="mini-meta" onClick={() => music.id && route(`/music/${music.id}`)} title="展开播放页">
        <span class="mini-cover">
          {track.artwork_url
            ? <img src={track.artwork_url} alt="" />
            : <Icon name="music" size={18} />}
          {playing && <span class="mini-eq" aria-hidden="true"><i /><i /><i /></span>}
        </span>
        <span class="mini-text">
          <strong>{music.title}</strong>
          <span>{track.artist || '未知歌手'}</span>
        </span>
      </button>

      <span class="mini-time">{fmt(position)} / {fmt(duration)}</span>

      <div class="mini-controls">
        <button onClick={prev} disabled={!hasPrev} title="上一首"><Icon name="skipBack" size={17} /></button>
        <button class="mini-play" onClick={toggle} title={playing ? '暂停' : '播放'}>
          <Icon name={playing ? 'pause' : 'play'} size={18} />
        </button>
        <button onClick={next} disabled={!hasNext} title="下一首"><Icon name="skipForward" size={17} /></button>
      </div>

      <div class="mini-volume">
        <Icon name="volume" size={15} />
        <input
          type="range" min={0} max={1} step={0.05} value={volume}
          onInput={(e) => setVolume(Number(e.currentTarget.value))}
          aria-label="音量"
        />
      </div>

      {notice && <span class="mini-notice">{notice}</span>}

      <button class="mini-close" onClick={stop} title="关闭播放器" aria-label="关闭播放器">
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
