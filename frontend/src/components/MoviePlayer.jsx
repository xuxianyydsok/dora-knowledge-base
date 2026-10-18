// 影视播放器：影院模式
// - 支持 m3u8（hls.js 动态懒加载，非 Safari）与 mp4（原生播放）
// - 播放时只显示播放器：线路/选集以浮层出现，页面下方不再重复卡片
// - 支持上一集/下一集、线路切换、进度记忆（定时上报后端）
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Icon } from './Icon.jsx';
import { api } from '../lib/api.js';
import { API_BASE_URL } from '../lib/config.js';
import { toPlayableUrl } from '../lib/mediaUrl.js';
import { toastError } from '../lib/toast.jsx';

// 选路策略（2026-10-12 改版）：
//   部分资源站分片放在 999/9999/65 等非常规端口，很多网络（含开着系统代理时）会拦，
//   表现为「播放列表能下、分片下不动」——不报错、一直转圈。旧策略是「先直连、6 秒超时才切代理」，
//   体验很差（白等 6 秒）。现在改为：
//     ① 已知必须走代理的 host（localStorage 记忆）→ 直接走代理；
//     ② 已知能直连的 host → 直接直连；
//     ③ 未知 host → **并行探测**直连与代理（探到首个分片为止），谁先通就用谁；
//     ④ 探测都失败 → 先用直连起播，2.5 秒拿不到画面数据立刻切代理（比旧的 6 秒快一倍多）。
//   两条路都失败时不再静默卡住，给 toastError 明确提示并提示切换线路。
//   结论按 host 记住：dora:vod-proxy-hosts 记「必须代理」，dora:vod-direct-hosts 记「可直连」。
const PROXY_KEY = 'dora:vod-proxy-hosts';
const DIRECT_KEY = 'dora:vod-direct-hosts';
const hostOf = (u) => { try { return new URL(u).host; } catch { return ''; } };
function readHosts(key) {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); }
}
function writeHosts(key, set) {
  // 只留最近 50 条，避免 localStorage 无限增长
  try { localStorage.setItem(key, JSON.stringify([...set].slice(-50))); } catch {}
}
const proxyHosts = () => readHosts(PROXY_KEY);
const directHosts = () => readHosts(DIRECT_KEY);
function rememberProxy(u) {
  const host = hostOf(u);
  if (!host) return;
  const s = proxyHosts(); s.add(host); writeHosts(PROXY_KEY, s);
  const d = directHosts(); d.delete(host); writeHosts(DIRECT_KEY, d);   // 两个记忆互斥，避免自相矛盾
}
function rememberDirect(u) {
  const host = hostOf(u);
  if (!host) return;
  const d = directHosts(); d.add(host); writeHosts(DIRECT_KEY, d);
  const s = proxyHosts(); s.delete(host); writeHosts(PROXY_KEY, s);
}
const proxied = (u) => `${API_BASE_URL}/api/vod/proxy?u=${encodeURIComponent(u)}`;

// —— 可播性探测 ——
// 只探播放列表不够：分片常在被拦掉的非常规端口上，列表能下、分片下不动才是「一直转圈」的根因，
// 因此这里一路探到首个分片（只取 1 字节，开销极小）。相对 / // / 绝对 URI 都由 new URL 归一。
const PROBE_MS = 2500;
function timedFetch(url, ms, headers) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal, cache: 'no-store', headers })
    .finally(() => clearTimeout(timer));
}
function firstMediaUri(text, base) {
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    try { return new URL(t, base).toString(); } catch { return ''; }
  }
  return '';
}
function keyUri(text, base) {
  const m = text.match(/URI="([^"]+)"/);
  if (!m) return '';
  try { return new URL(m[1], base).toString(); } catch { return ''; }
}
async function probePlayable(url, deadline) {
  const left = () => Math.max(400, deadline - Date.now());
  const res = await timedFetch(url, left());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  let base = url;
  let body = await res.text();
  if (!body.trimStart().startsWith('#EXTM3U')) throw new Error('不是 m3u8');
  if (/#EXT-X-STREAM-INF/i.test(body)) {         // master：再取一个变体
    const variant = firstMediaUri(body, url);
    if (!variant) throw new Error('无变体地址');
    const vr = await timedFetch(variant, left());
    if (!vr.ok) throw new Error(`HTTP ${vr.status}`);
    base = variant;
    body = await vr.text();
  }
  const seg = firstMediaUri(body, base);
  if (!seg) throw new Error('无分片地址');
  // 只取首字节：能拿到说明这条链路（含非常规端口）真的通
  const sr = await timedFetch(seg, left(), { Range: 'bytes=0-0' });
  if (!sr.ok && sr.status !== 206) throw new Error(`HTTP ${sr.status}`);
  try { await sr.body?.cancel(); } catch {}
  const key = keyUri(body, base);
  if (key) { try { const kr = await timedFetch(key, left()); try { await kr.body?.cancel(); } catch {} } catch {} }
  return true;
}
// 谁先成功用谁：返回首个成功的下标，全部失败返回 -1
function firstSuccess(promises) {
  return new Promise((resolve) => {
    let pending = promises.length;
    let settled = false;
    promises.forEach((p, i) => {
      p.then(() => { if (!settled) { settled = true; resolve(i); } })
        .catch(() => {})
        .finally(() => { if (--pending === 0 && !settled) { settled = true; resolve(-1); } });
    });
  });
}

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
  const touchRef = useRef(null);
  const lastSavedRef = useRef(0);
  const saveRef = useRef(null);
  const failedToastRef = useRef(false);   // 同一片源只弹一次失败提示，避免 stall/error 双触发刷屏

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  const [loadingSrc, setLoadingSrc] = useState(true);
  const [saved, setSaved] = useState('');
  const [panel, setPanel] = useState('');       // '' | 'routes' | 'episodes' | 'speed'
  const [chromeVisible, setChromeVisible] = useState(true);
  const [rate, setRate] = useState(() => Number(localStorage.getItem('dora:rate')) || 1);

  const rawSrc = movie?.url || '';
  // 最后一道防线：只有 m3u8/mp4 直链才允许进入播放器。
  // 网页地址（分享页 / 播放页）交给 <video> 只会报「片源无法解析」，
  // 但**网页播放页可以归一成直链**（toPlayableUrl，光速/速播/豪华给的就是这种），
  // 归一不了才明确报错，绝不把分享页之类的非直链喂进去。
  const directSrc = toPlayableUrl(rawSrc);
  // 选路：'direct' | 'proxy'。
  // routeOverride 是「本次片源」的显式决定（探测结果 / 兜底切换），null 表示还没决定、
  // 此时按 localStorage 记忆同步推导 —— 这样命中记忆的 host 首帧就走对路，不会先白请求一次直连。
  const [routeOverride, setRouteOverride] = useState(null);
  const route = useMemo(() => {
    if (routeOverride) return routeOverride;
    if (!directSrc || !isHls(directSrc)) return 'direct';
    return proxyHosts().has(hostOf(directSrc)) ? 'proxy' : 'direct';
  }, [routeOverride, directSrc]);
  const viaProxy = route === 'proxy';
  const src = directSrc ? (viaProxy ? proxied(directSrc) : directSrc) : '';

  // 选路决策（见顶部策略说明）：已知记忆直接用；未知 host 先用直连起播，
  // 同时并行探测直连 / 代理，谁先通就用谁，并把结论写进 localStorage。
  useEffect(() => {
    setRouteOverride(null);   // 换片源 / 换线路后重新选路
    if (!directSrc || !isHls(directSrc)) return undefined;
    const host = hostOf(directSrc);
    // 已有记忆（必须代理 / 可以直连）就不再探测，直接用结论。
    if (proxyHosts().has(host) || directHosts().has(host)) return undefined;
    let cancelled = false;
    const deadline = Date.now() + PROBE_MS;
    firstSuccess([
      probePlayable(directSrc, deadline),
      probePlayable(proxied(directSrc), deadline)
    ]).then((idx) => {
      if (cancelled) return;
      if (idx === 0) rememberDirect(directSrc);
      else if (idx === 1) { rememberProxy(directSrc); setRouteOverride('proxy'); }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [directSrc]);

  // 直连失败 → 切代理；已经是代理还失败 → 换下一条线路
  function fallback(reason) {
    // 用 directSrc 而非 rawSrc：rawSrc 可能是网页播放页（不含 .m3u8），
    // 记错域名会让「记住直连失败过的域名」失效，代理兜底也就不会触发。
    if (!viaProxy && isHls(directSrc)) {
      rememberProxy(directSrc);
      autoPlayRef.current = true;
      setSaved('直连较慢或被拦截，已切换代理线路');
      setRouteOverride('proxy');
      return true;
    }
    const next = tryNextRoute(reason);
    // 两条路都失败、也没有下一条线路可换时，给明确提示，不要静默卡在转圈上。
    if (!next && !failedToastRef.current) {
      failedToastRef.current = true;
      toastError(`播放失败：${reason}。已尝试直连与代理，请切换其他线路或用「原站」打开。`);
    }
    return next;
  }
  const rateRef = useRef(rate);
  function changeRate(r) {
    setRate(r); rateRef.current = r;
    try { localStorage.setItem('dora:rate', String(r)); } catch {}
    if (videoRef.current) videoRef.current.playbackRate = r;
  }

  // 线路自动回退：一部片常有 5~8 条线路，其中只有部分真的能播；失败时自动试下一条（每条最多试一次）
  const triedRef = useRef(new Set());
  const autoPlayRef = useRef(false);
  function tryNextRoute(reason) {
    if (!onSelectRoute || routes.length < 2) return false;
    const next = routes.findIndex((_, i) => i !== routeIndex && !triedRef.current.has(i));
    if (next < 0) return false;
    triedRef.current.add(next);
    autoPlayRef.current = true;   // 换线成功就自动续播（此前用户已与该 video 交互过，浏览器一般放行）
    setSaved(`线路不可用（${reason}），自动尝试下一条…`);
    onSelectRoute(next);
    return true;
  }

  // 换线成功、开始播放后清掉「线路不可用」提示，避免误以为仍在失败
  useEffect(() => {
    if (playing && saved.startsWith('线路不可用')) setSaved('');
    if (playing && saved.startsWith('直连')) { const t = setTimeout(() => setSaved(''), 3000); return () => clearTimeout(t); }
    return undefined;
  }, [playing, saved]);

  // —— 加载片源：m3u8 走 hls.js（动态 import，符合重型库懒加载规范）——
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    // 没有可播直链（例如只拿到网页地址）：不要停在「加载中」转圈，直接给出明确提示。
    if (!src) {
      setLoadingSrc(false);
      setPlaying(false);
      setError('该线路没有可播放的视频直链，请切换其他线路');
      return undefined;
    }
    let disposed = false;
    failedToastRef.current = false;   // 换片源 / 换线路后允许再提示一次
    setError(''); setPlaying(false); setCurrent(0); setDuration(0); setLoadingSrc(true);
    setPanel('');

    const resume = Number(movie?.progress?.position) || 0;
    const onLoaded = () => {
      if (disposed) return;
      setDuration(el.duration || 0);
      setLoadingSrc(false);
      // 直连真的出画面了 → 记住这个 host 可以直连，下次不用再探测
      if (!viaProxy && isHls(directSrc)) rememberDirect(directSrc);
      el.playbackRate = rateRef.current;
      if (resume > 0 && resume < (el.duration || Infinity) - 3) {
        el.currentTime = resume;
        setCurrent(resume);
      }
    };
    el.addEventListener('loadedmetadata', onLoaded);
    // 自动回退换线后：等有足够数据就续播，不让用户停在暂停画面
    const onCanPlay = () => {
      if (!autoPlayRef.current) return;
      autoPlayRef.current = false;
      el.play().then(() => setPlaying(true)).catch(() => {});
    };
    el.addEventListener('canplay', onCanPlay);
    // 首帧超时（旧版 6 秒太慢）：分片端口被拦时常见「不报错、一直转圈」，
    // 2.5 秒还没有画面数据就立刻切代理，用户几乎无感；探测阶段已通的那条路不会触发。
    const stall = isHls(src) && !viaProxy ? setTimeout(() => {
      if (!disposed && el.readyState < 2) fallback('直连超时');
    }, 2500) : null;
    const onData = () => { if (stall) clearTimeout(stall); };
    el.addEventListener('loadeddata', onData);

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
            setLoadingSrc(false);
            if (!fallback('线路加载失败')) {
              setError('该线路播放失败：多为 CDN 防盗链拦截或链接已失效，请切换其他线路或用「原站」打开');
            }
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
      if (stall) clearTimeout(stall);
      el.removeEventListener('loadeddata', onData);
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('canplay', onCanPlay);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [movie?.id, src]);

  // —— 每 5 秒上报一次进度 ——
  useEffect(() => {
    if (!playing || !movie?.id) return;
    const timer = setInterval(() => saveProgress(), 5000);
    return () => clearInterval(timer);
  }, [playing, movie?.id]);

  // 关闭页面 / 切到后台时补一次进度。
  // 只靠 5 秒定时器会漏掉「看到一半直接关页」这种最常见的场景。
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden') saveRef.current?.(false);
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
      saveRef.current?.(false);
    };
  }, []);

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
  saveRef.current = saveProgress;

  function toggle() {
    const el = videoRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); saveProgress(); }
    else {
      el.play().then(() => setPlaying(true)).catch((err) => {
        // 不要把「片源不可用」误报成「自动播放被拦」——两者给用户的下一步完全不同
        if (err?.name === 'NotAllowedError') {
          setError('浏览器阻止了自动播放：再点一下播放按钮即可开始');
        } else if (tryNextRoute('该线路没有可用片源')) {
          setSaved('正在自动尝试下一条线路…');
        } else {
          setError('该线路没有可用片源：多为 CDN 防盗链拦截或链接已失效，请换一条线路，或用「原站」打开');
        }
      });
    }
  }

  function seek(e) {
    const el = videoRef.current;
    if (!el) return;
    const val = Number(e.currentTarget.value);
    el.currentTime = val;
    setCurrent(val);
  }

  // 移动端手势：左右滑动快退/快进 10 秒，上下滑动调音量，双击画面全屏。
  // 用 pointer 事件而不是 touch：桌面触控板 / 手写笔也能用，且不需要额外监听。
  function onPointerDown(e) {
    if (e.pointerType === 'mouse') return;
    touchRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  }

  function onPointerUp(e) {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start || e.pointerType === 'mouse') return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const el = videoRef.current;
    if (!el) return;
    if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy)) {
      el.currentTime = Math.max(0, Math.min(el.duration || Infinity, el.currentTime + (dx > 0 ? 10 : -10)));
      setCurrent(el.currentTime);
      setSaved(dx > 0 ? '快进 10 秒' : '快退 10 秒');
      setTimeout(() => setSaved(''), 900);
    } else if (Math.abs(dy) > 42 && Math.abs(dy) > Math.abs(dx)) {
      const next = Math.min(1, Math.max(0, (muted ? 0 : volume) + (dy < 0 ? 0.1 : -0.1)));
      changeVolume({ currentTarget: { value: String(next) } });
      setSaved(`音量 ${Math.round(next * 100)}%`);
      setTimeout(() => setSaved(''), 900);
    }
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
          onDoubleClick={toggleFullscreen}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onError={() => {
            // 原生 src 路径（含 hls.js 不可用时的回退）也要能自动换线：
            // 采集源给的 m3u8 常被 CDN 防盗链拦掉，浏览器拿到的其实是 404/403 的 HTML
            setLoadingSrc(false);
            if (!fallback('片源无法解析')) {
              setError('该线路片源无法播放：多为 CDN 防盗链拦截或链接已失效，请换一条线路或用「原站」打开');
            }
          }}
          onEnded={() => { setPlaying(false); saveProgress(true); onEnded?.(); }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
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
          style={`--watch-p:${duration ? Math.min(100, (current / duration) * 100) : 0}%`}
        />
        <div class="watch-controls">
          <button
            class="watch-icon"
            disabled={!hasPrev}
            onClick={() => onSelectEpisode?.(episodeIndex - 1)}
            title="上一集"
          ><Icon name="skipBack" size={16} /></button>
          <button class="watch-icon" onClick={toggle} title={playing ? '暂停' : '播放'}>
            <Icon name={playing ? 'pause' : 'play'} size={17} />
          </button>
          <button
            class="watch-icon"
            disabled={!hasNext}
            onClick={() => onSelectEpisode?.(episodeIndex + 1)}
            title="下一集"
          ><Icon name="skipForward" size={16} /></button>

          <span class="watch-time">{fmt(current)} / {fmt(duration)}</span>
          <span class="spacer" />

          <button class={`watch-icon watch-speed${panel === 'speed' ? ' active' : ''}`} onClick={() => setPanel(panel === 'speed' ? '' : 'speed')} title="倍速">
            {rate === 1 ? '倍速' : `${rate}x`}
          </button>
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
      {panel === 'speed' && (
        <div class="watch-panel">
          <div class="watch-panel-head"><strong>播放速度</strong><button class="watch-icon" onClick={() => setPanel('')}><Icon name="close" size={15} /></button></div>
          <div class="watch-panel-body speeds">
            {[0.5, 0.75, 1, 1.25, 1.5, 2, 3].map((r) => (
              <button key={r} class={`speed-opt${r === rate ? ' active' : ''}`} onClick={() => { changeRate(r); setPanel(''); }}>{r}x</button>
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
