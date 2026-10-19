// 全局音乐播放上下文
// 设计取向：参考 Apple Music / Spotify 的常驻播放体验
// - <audio> 元素常驻 Provider，切换路由不中断播放
// - 维护播放队列，支持上一首 / 下一首 / 自动续播
// - 进度记忆（定时上报后端）、音量持久化（localStorage）
// - 备用音源：主地址失败时自动切换下一个（Audius 多节点等）
import { createContext } from 'preact';
import { useContext, useEffect, useRef, useState, useCallback, useMemo } from 'preact/hooks';
import { api } from './api.js';
import { buildOrder, stepIndex, nextRepeat } from './queueOrder.js';

const PlayerContext = createContext(null);
const VOLUME_KEY = 'kb-player-volume';
const SHUFFLE_KEY = 'kb-player-shuffle';
const REPEAT_KEY = 'kb-player-repeat';

// 把列表项转成队列项（列表接口返回的是精简结构）
function toQueueItem(m) {
  const t = m.track || {};
  return {
    id: m.id,
    title: m.title,
    artist: t.artist || '',
    album: t.album || '',
    cover: t.artwork_url || m.cover_path || '',
    duration: t.duration || 0,
    // 访客直接播放的曲目不入库（id 为空），整条数据随队列携带
    inline: m.id ? null : m
  };
}
const keyOf = (q) => q.inline || q.id;

export function PlayerProvider({ children }) {
  const audioRef = useRef(null);
  const wantPlayRef = useRef(false);
  const lastSavedRef = useRef(0);

  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(-1);
  const [music, setMusic] = useState(null);      // 完整曲目数据（含 track / progress）
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [srcIndex, setSrcIndex] = useState(0);
  const [extraSrc, setExtraSrc] = useState('');   // 重新解析得到的新直链（第三方直链会过期）
  const [reResolved, setReResolved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [volume, setVolumeState] = useState(() => {
    const v = Number(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 1;
  });
  // 随机 / 循环：与音量一样是「本机使用习惯」，存 localStorage。
  // 2026-10-12 用户要求（参考 Nacre 模板的播放条）：这两个开关直接做在底部播放条上，
  // 点开就生效，不另开页面。
  const [shuffle, setShuffleState] = useState(() => localStorage.getItem(SHUFFLE_KEY) === '1');
  const [repeat, setRepeatState] = useState(() => {
    const v = localStorage.getItem(REPEAT_KEY);
    return v === 'all' || v === 'one' ? v : 'off';
  });
  // 播放顺序：随机开时是洗牌后的下标序列（当前曲目排在最前）。
  // 队列或随机开关变化时重算 —— 这就是「上一首能回到刚才那首」的依据。
  const [order, setOrder] = useState([]);

  const t = music?.track || {};
  // 候选音源：重新解析的新直链 → 主地址 → 备用节点 → 试听片段
  const sources = useMemo(
    () => [extraSrc, t.audio_url, ...(t.audio_fallbacks || []), t.preview_url].filter(Boolean),
    [extraSrc, t.audio_url, t.audio_fallbacks, t.preview_url]
  );
  const activeSrc = sources[srcIndex] || '';

  const flash = useCallback((msg, ms = 2000) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), ms);
  }, []);

  // —— 加载曲目 ——
  const load = useCallback(async (id, { autoplay = true } = {}) => {
    setLoading(true);
    setError('');
    setPosition(0);
    setSrcIndex(0);
    setExtraSrc('');
    setReResolved(false);
    try {
      const data = typeof id === 'object' && id ? id : await api.getMusic(id);
      setMusic(data);
      setDuration(data.track?.duration || 0);
      wantPlayRef.current = autoplay;
      return data;
    } catch (e) {
      setError(e.message);
      wantPlayRef.current = false;
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // —— 以某个列表为队列开始播放 ——
  const playQueue = useCallback(async (items, startIndex = 0) => {
    if (!items?.length) return;
    setQueue(items.map(toQueueItem));
    setIndex(startIndex);
    await load(items[startIndex].id || items[startIndex]);
  }, [load]);

  // —— 播放单曲（不改变队列）——
  const playOne = useCallback(async (item) => {
    setQueue([toQueueItem(item)]);
    setIndex(0);
    await load(item.id || item);
  }, [load]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { wantPlayRef.current = true; el.play().catch(() => setPlaying(false)); }
  }, [playing]);

  const goTo = useCallback(async (nextIndex) => {
    if (nextIndex < 0 || nextIndex >= queue.length) return;
    setIndex(nextIndex);
    await load(keyOf(queue[nextIndex]));
  }, [queue, load]);

  // 顺序表随「队列 / 随机开关」重算：随机时把当前曲目固定在最前，
  // 开着随机点「下一首」不会立刻跳走。
  // 依赖里**故意不放 index**：换歌不重排，否则「随机」会退化成
  // 「每次点下一首随机抽一首」，「上一首」也回不到刚才那首。
  // 但当前曲目又要用最新的值，所以从 ref 读。
  const indexRef = useRef(index);
  indexRef.current = index;
  useEffect(() => {
    setOrder(buildOrder(queue.length, { shuffle, current: indexRef.current }));
  }, [queue, shuffle]);

  const next = useCallback(() => {
    const target = stepIndex(order, index, 1, repeat);
    if (target < 0) { flash('已经是最后一首了'); return; }
    goTo(target);
  }, [order, index, repeat, goTo, flash]);

  const prev = useCallback(() => {
    // 播放超过 3 秒时，上一首先回到开头（与主流播放器一致）
    const el = audioRef.current;
    if (el && el.currentTime > 3) { el.currentTime = 0; setPosition(0); return; }
    const target = stepIndex(order, index, -1, repeat);
    if (target < 0) { flash('已经是第一首了'); return; }
    goTo(target);
  }, [goTo, index, order, repeat, flash]);

  const toggleShuffle = useCallback(() => {
    setShuffleState((v) => {
      const next_ = !v;
      localStorage.setItem(SHUFFLE_KEY, next_ ? '1' : '0');
      flash(next_ ? '随机播放已开启' : '随机播放已关闭', 1400);
      return next_;
    });
  }, [flash]);

  const cycleRepeat = useCallback(() => {
    setRepeatState((v) => {
      const next_ = nextRepeat(v);
      localStorage.setItem(REPEAT_KEY, next_);
      flash(next_ === 'off' ? '顺序播放' : next_ === 'all' ? '列表循环' : '单曲循环', 1400);
      return next_;
    });
  }, [flash]);

  const seek = useCallback((sec) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = sec;
    setPosition(sec);
  }, []);

  const setVolume = useCallback((v) => {
    const val = Math.min(1, Math.max(0, v));
    setVolumeState(val);
    localStorage.setItem(VOLUME_KEY, String(val));
    if (audioRef.current) audioRef.current.volume = val;
  }, []);

  const stop = useCallback(() => {
    const el = audioRef.current;
    if (el) { el.pause(); el.currentTime = 0; }
    setPlaying(false);
    setPosition(0);
    setMusic(null);
    setQueue([]);
    setIndex(-1);
  }, []);

  // —— 进度上报 ——
  const saveProgress = useCallback(async (completed = false) => {
    const el = audioRef.current;
    if (!el || !music?.id) return;
    const pos = Math.round(el.currentTime);
    if (!completed && pos === lastSavedRef.current) return;
    try {
      await api.saveMusicProgress(music.id, {
        position: pos,
        duration: Math.round(el.duration || duration || 0) || undefined,
        completed
      });
      lastSavedRef.current = pos;
      flash('已保存进度', 1200);
    } catch (e) {
      flash(`保存失败：${e.message}`, 2600);
    }
  }, [music?.id, duration, flash]);

  useEffect(() => {
    if (!playing || !music?.id) return;
    const timer = setInterval(() => saveProgress(), 5000);
    return () => clearInterval(timer);
  }, [playing, music?.id, saveProgress]);

  // —— 音源就绪后按需起播 ——
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !activeSrc) return;
    el.volume = volume;
    if (wantPlayRef.current) {
      wantPlayRef.current = false;
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }, [activeSrc, volume]);

  // —— 元数据就绪：恢复上次进度 ——
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onLoaded = () => {
      setDuration(el.duration || t.duration || 0);
      const resume = Number(music?.progress?.position) || 0;
      if (resume > 0 && resume < (el.duration || Infinity) - 3) {
        el.currentTime = resume;
        setPosition(resume);
      }
    };
    el.addEventListener('loadedmetadata', onLoaded);
    return () => el.removeEventListener('loadedmetadata', onLoaded);
  }, [music?.id, music?.progress?.position, t.duration, activeSrc]);

  // —— 主音源失败时切换备用；全部失败且是可重新解析的音源时再解析一次 ——
  async function onError() {
    const shouldResume = playing;
    if (srcIndex < sources.length - 1) {
      setSrcIndex((i) => i + 1);
      flash('切换备用音源…');
      return;
    }
    // 第三方直链是带时间戳的签名地址，会过期；凭收藏时保存的 external_id 换一条新的
    const meta = music?.metadata || {};
    if (!reResolved && meta.platform === 'gdstudio' && meta.external_id) {
      setReResolved(true);
      flash('正在重新解析音源…', 1600);
      try {
        const fresh = await api.resolveMusicStream({
          platform: meta.platform,
          external_id: meta.external_id,
          source: meta.gd_source
        });
        if (fresh?.audio_url) {
          if (shouldResume) wantPlayRef.current = true;
          setExtraSrc(fresh.audio_url);
          setSrcIndex(0);
          return;
        }
      } catch {
        // 解析失败：落到下面的统一失败分支
      }
    }
    setPlaying(false);
    setError('该曲目暂无可用的播放地址');
  }

  function onEnded() {
    saveProgress(true);
    // 单曲循环：直接重播当前这首（不换曲目，也就不会重新解析音源）
    if (repeat === 'one') {
      const el = audioRef.current;
      if (el) { el.currentTime = 0; el.play().catch(() => setPlaying(false)); }
      return;
    }
    const target = stepIndex(order, index, 1, repeat);
    if (target < 0) { setPlaying(false); return; }   // 顺序播放走到头：停下
    goTo(target);
  }

  // 歌词逐字填充需要比 timeupdate（约 250ms）更细的时间粒度。
  // 只在播放时运行，暂停即停；100ms 的 state 更新足以让填充看起来连续，
  // 又不会让整个 App 每帧重渲染。
  useEffect(() => {
    if (!playing) return undefined;
    let raf = 0;
    let lastPaint = 0;
    const tick = (now) => {
      const el = audioRef.current;
      if (el && now - lastPaint >= 100) {
        lastPaint = now;
        setPosition(el.currentTime);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const value = {
    audioRef, music, track: t, queue, index, playing, position, duration,
    loading, error, notice, volume, activeSrc,
    // 顺序播放（repeat='off'）走到头时没有下一首，按钮要置灰；
    // 列表循环 / 单曲循环则始终可点。
    hasPrev: index >= 0 && (repeat !== 'off' || stepIndex(order, index, -1, repeat) >= 0),
    hasNext: index >= 0 && (repeat !== 'off' || stepIndex(order, index, 1, repeat) >= 0),
    shuffle, repeat, order,
    playQueue, playOne, toggle, next, prev, seek, setVolume, stop, flash,
    toggleShuffle, cycleRepeat
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        src={activeSrc || undefined}
        preload="metadata"
        onError={onError}
        onEnded={onEnded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
      />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer 必须在 PlayerProvider 内使用');
  return ctx;
}
