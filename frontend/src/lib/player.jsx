// 全局音乐播放上下文
// 设计取向：参考 Apple Music / Spotify 的常驻播放体验
// - <audio> 元素常驻 Provider，切换路由不中断播放
// - 维护播放队列，支持上一首 / 下一首 / 自动续播
// - 进度记忆（定时上报后端）、音量持久化（localStorage）
// - 备用音源：主地址失败时自动切换下一个（Audius 多节点等）
import { createContext } from 'preact';
import { useContext, useEffect, useRef, useState, useCallback, useMemo } from 'preact/hooks';
import { api } from './api.js';

const PlayerContext = createContext(null);
const VOLUME_KEY = 'kb-player-volume';

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

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => {
    // 播放超过 3 秒时，上一首先回到开头（与主流播放器一致）
    const el = audioRef.current;
    if (el && el.currentTime > 3) { el.currentTime = 0; setPosition(0); return; }
    goTo(index - 1);
  }, [goTo, index]);

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
    setPlaying(false);
    saveProgress(true);
    if (index >= 0 && index + 1 < queue.length) goTo(index + 1);
  }

  const value = {
    audioRef, music, track: t, queue, index, playing, position, duration,
    loading, error, notice, volume, activeSrc,
    hasPrev: index > 0, hasNext: index >= 0 && index + 1 < queue.length,
    playQueue, playOne, toggle, next, prev, seek, setVolume, stop, flash
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
