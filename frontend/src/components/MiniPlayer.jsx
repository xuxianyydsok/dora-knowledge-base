// 底部常驻播放条。
//
// 2026-10-12 用户要求（参考模板《Nacre 音乐》的底部播放条）：
//   不要再为播放相关功能另开页面 —— 就在这一条里把该有的都集成齐：
//     · 点封面（歌手头像）**立即**跳到歌词页；
//     · 收藏按钮；
//     · 随机播放开关；
//     · 顺序播放 / 列表循环 / 单曲循环（一个按钮循环切换）；
//     · 「下一曲」右边加一个播放队列按钮，点了**就地弹出**队列浮层（不跳页）。
//   所以这一条现在从左到右是：
//     封面(→歌词) + 曲目信息 + 收藏 | 随机 上一首 播放 下一首 循环 | 队列 | 音量 | 关闭
//
// 全局唯一，路由切换不中断。
import { useEffect, useRef, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { usePlayer } from '../lib/player.jsx';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { REPEAT_LABEL } from '../lib/queueOrder.js';
import { Icon } from './Icon.jsx';
import { BurstLike, Equalizer, PlayPauseMorph } from './MotionFx.jsx';
import { toastError, toastSuccess } from '../lib/toast.jsx';

function fmt(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function MiniPlayer() {
  const {
    music, track, playing, position, duration, volume, notice,
    queue, index, goTo, shuffle, repeat,
    hasPrev, hasNext, toggle, next, prev, seek, setVolume, stop,
    toggleShuffle, cycleRepeat
  } = usePlayer();
  const { isAuthenticated } = useAuth();
  const [queueOpen, setQueueOpen] = useState(false);
  const [favOn, setFavOn] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const queueRef = useRef(null);

  const musicId = music?.id;

  // 收藏状态：切歌时重查一次（收藏属个人数据，访客不渲染这个按钮）
  useEffect(() => {
    if (!isAuthenticated || !musicId) { setFavOn(false); return undefined; }
    let alive = true;
    api.listFavorites()
      .then((list) => { if (alive) setFavOn((list || []).some((f) => f.resource_id === musicId)); })
      .catch(() => { /* 拉不到就按未收藏处理 */ });
    return () => { alive = false; };
  }, [isAuthenticated, musicId]);

  // 队列浮层：点外部 / Esc 关闭
  useEffect(() => {
    if (!queueOpen) return undefined;
    const onDown = (e) => { if (queueRef.current && !queueRef.current.contains(e.target)) setQueueOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setQueueOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [queueOpen]);

  // 关闭播放器时顺手收起队列浮层
  useEffect(() => { if (!music) setQueueOpen(false); }, [music]);

  if (!music) return null;

  const pct = duration > 0 ? (position / duration) * 100 : 0;

  async function toggleFav() {
    if (!musicId) return;
    setFavBusy(true);
    try {
      if (favOn) {
        await api.deleteFavoriteByTarget(`resource_id=${encodeURIComponent(musicId)}`);
        setFavOn(false);
        toastSuccess('已取消收藏');
      } else {
        await api.createFavorite({ resource_id: musicId });
        setFavOn(true);
        toastSuccess('已加入收藏');
      }
    } catch (err) {
      toastError(err.message);
    } finally {
      setFavBusy(false);
    }
  }

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

      {/* 封面单独成键：点封面**立即**进歌词页（用户要求） */}
      <button
        class="mini-cover-btn"
        onClick={() => music.id && route(`/music/${music.id}/lyrics`)}
        title="打开歌词"
        aria-label={`打开 ${music.title} 的歌词`}
      >
        <span class="mini-cover">
          {track.artwork_url
            ? <img src={track.artwork_url} alt="" referrerpolicy="no-referrer" />
            : <Icon name="music" size={18} />}
          {playing && <Equalizer playing bars={3} class="mini-eq-mfx" />}
        </span>
      </button>

      <button
        class="mini-meta"
        onClick={() => music.id && route(`/music/${music.id}`)}
        title="查看歌曲详情"
      >
        <span class="mini-text">
          <strong>{music.title}</strong>
          <span>{track.artist || '未知歌手'}</span>
        </span>
      </button>

      {/* 收藏：与详情页 / 歌词页同一个接口，登出后自动隐藏 */}
      {isAuthenticated && (
        <BurstLike
          active={favOn}
          onToggle={toggleFav}
          label={favOn ? '取消收藏' : '收藏'}
          class={`mini-icon mini-fav${favOn ? ' on' : ''}`}
          disabled={favBusy}
        >
          <Icon name="heart" size={16} />
        </BurstLike>
      )}

      <span class="mini-time">{fmt(position)} / {fmt(duration)}</span>

      <div class="mini-controls">
        <button
          class={`mini-icon${shuffle ? ' on' : ''}`}
          onClick={toggleShuffle}
          aria-pressed={shuffle}
          title={shuffle ? '随机播放已开启' : '随机播放'}
        >
          <Icon name="shuffle" size={16} />
        </button>
        <button onClick={prev} disabled={!hasPrev} title="上一首"><Icon name="skipBack" size={17} /></button>
        <PlayPauseMorph playing={playing} onClick={toggle} class="mini-play-mfx" />
        <button onClick={next} disabled={!hasNext} title="下一首"><Icon name="skipForward" size={17} /></button>
        <button
          class={`mini-icon${repeat !== 'off' ? ' on' : ''}`}
          onClick={cycleRepeat}
          title={REPEAT_LABEL[repeat]}
          aria-label={REPEAT_LABEL[repeat]}
        >
          <Icon name="repeat" size={16} />
          {repeat === 'one' && <span class="mini-badge">1</span>}
        </button>

        {/* 播放队列：就地弹出，不跳页（用户要求） */}
        <span class="mini-queue-wrap" ref={queueRef}>
          <button
            class={`mini-icon${queueOpen ? ' on' : ''}`}
            onClick={() => setQueueOpen((v) => !v)}
            aria-expanded={queueOpen}
            title="播放队列"
          >
            <Icon name="list" size={16} />
            {queue.length > 1 && <span class="mini-badge">{queue.length}</span>}
          </button>
          {queueOpen && (
            <div class="mini-queue" role="dialog" aria-label="播放队列">
              <div class="mini-queue-head">
                <strong>播放队列</strong>
                <span>{queue.length} 首</span>
              </div>
              <div class="mini-queue-list">
                {queue.map((q, i) => (
                  <button
                    key={`${q.id || 'inline'}-${i}`}
                    type="button"
                    class={`mini-queue-row${i === index ? ' on' : ''}`}
                    onClick={() => { goTo(i); }}
                  >
                    <span class="mini-queue-n">
                      {i === index && playing
                        ? <span class="mini-queue-eq" aria-hidden="true"><i /><i /><i /></span>
                        : i + 1}
                    </span>
                    <span class="mini-queue-art">
                      {q.cover
                        ? <img src={q.cover} alt="" loading="lazy" referrerpolicy="no-referrer" />
                        : <Icon name="music" size={13} />}
                    </span>
                    <span class="mini-queue-text">
                      <strong>{q.title}</strong>
                      <span>{[q.artist, q.album].filter(Boolean).join(' · ') || '未知歌手'}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </span>
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
