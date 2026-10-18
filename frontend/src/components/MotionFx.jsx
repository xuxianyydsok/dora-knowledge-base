// 动效组件（2026-10-15 起，2026-10-19 扩展）
//
// 来源：E:\documents\网站开发\ 下十份动效图鉴里用户挑中的组件，逐个改写成
// Preact 组件（图鉴是自包含 HTML，内联 <style>/<script> 会被本站 CSP
// `script-src 'self'` 拦掉，所以必须改写而不是粘贴）。
//
// 本文件是**全局小点缀**（图鉴编号 → 组件）：
//   30 填充箭头按钮   → ArrowButton
//   31 弹性开关       → Switch
//   37 三款加载器     → Loader（variant: dots | ring | bars）
//   39 条纹流动进度条 → ProgressBar
//   41 弹出气泡提示   → Tip
//   43 搜索框展开     → ExpandingSearch
//   15 慢速大字跑马灯 → Marquee
//   62 轮播指示点     → DotsNav
//   22 模糊交叉换词   → CrossFadeWords
//   32 点赞爆裂       → BurstLike
//   33 音频均衡器     → Equalizer
//   35 播放/暂停形变  → PlayPauseMorph
//   36 RSS 脉冲       → PulseIcon
//   54 铃铛摇晃       → BellPulse
//   86 方块波         → SquareWave
//   87 Loading 跳字   → LoadingLetters
//   110 3D 玻璃立方体 → GlassCube
//   155 金线丝绸流场  → SilkField
//   162 粒子文字      → ParticleText
//   124 曲风排行      → GenreRank
//   171 媒体占比环    → DonutShare
//   175 实时指标卡    → KpiCard
//   148 彩带礼炮      → ConfettiBurst
//
// 样式在 styles/motion.css，全部走站点主题变量（三套主题自动适配）。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

// 30 填充 + 箭头穿梭按钮：悬停时底色自下而上填满，箭头「穿出去再进来」。
export function ArrowButton({ children, onClick, type = 'button', ...rest }) {
  return (
    <button type={type} class="mfx-arrow-btn" onClick={onClick} {...rest}>
      <span>{children}</span>
      <i class="mfx-arrow-btn-icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M2 8h12M9 3l5 5-5 5" />
        </svg>
      </i>
    </button>
  );
}

// 31 弹性开关：按住时滑块拉长（纯 CSS 实现，这里只负责受控状态）。
// 用 <label> + 隐藏 checkbox，键盘也能操作（保留原生语义，不用 div 冒充）。
export function Switch({ checked, onChange, label, ...rest }) {
  return (
    <label class="mfx-switch" title={label} aria-label={label}>
      <input type="checkbox" checked={!!checked} onChange={onChange} {...rest} />
      <s />
    </label>
  );
}

// 37 三款加载器。variant 决定形态：
//   dots 三点跳动（适合「正在加载列表」）
//   ring 圆环旋转（适合「正在请求」）
//   bars 柱状起伏（适合「正在播放 / 处理中」）
export function Loader({ variant = 'dots' }) {
  if (variant === 'ring') return <span class="mfx-ring" role="status" aria-label="加载中" />;
  if (variant === 'bars') {
    return <span class="mfx-bars" role="status" aria-label="加载中"><i /><i /><i /><i /></span>;
  }
  return <span class="mfx-dots" role="status" aria-label="加载中"><i /><i /><i /></span>;
}

// 39 条纹流动进度条。value 是 0~100；不传则展示「不确定进度」（自动来回）。
export function ProgressBar({ value, label }) {
  const v = typeof value === 'number' ? Math.max(0, Math.min(100, value)) : null;
  return (
    <div class="mfx-progress">
      <div
        class="mfx-progress-track"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        {...(v === null ? {} : { 'aria-valuenow': Math.round(v) })}
        aria-label={label || '进度'}
      >
        <div class="mfx-progress-bar" style={{ width: `${v === null ? 100 : v}%` }} />
      </div>
      {label && (
        <p>
          <span>{label}</span>
          <span>{v === null ? '' : `${Math.round(v)}%`}</span>
        </p>
      )}
    </div>
  );
}

// 41 弹出气泡提示：悬停（或键盘聚焦）时从上方弹出一个带箭头的气泡。
// 用 CSS ::after + attr(data-tip) 实现，不占 DOM 节点，也不需要 JS。
// 触屏设备没有 hover —— 那里退化成普通文字（加 tabindex 让键盘可达）。
export function Tip({ text, children }) {
  return <span class="mfx-tip" data-tip={text} tabindex={0}>{children}</span>;
}

// 43 搜索框展开：收起时是个圆形按钮，悬停 / 聚焦后展开成输入框。
// onSearch 在回车时调用（值非空才触发）。
export function ExpandingSearch({ placeholder = '搜索…', onSearch, value: initial = '' }) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef(null);

  const submit = () => {
    const q = value.trim();
    if (q && onSearch) onSearch(q);
  };

  return (
    <div
      class="mfx-search"
      onClick={() => inputRef.current && inputRef.current.focus()}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onInput={(e) => setValue(e.currentTarget.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
      />
    </div>
  );
}

// 15 慢速大字跑马灯（页脚 / 分隔用）。
// 内容重复两遍是**必需的**：动画从 0 位移到 -50%，正好走完一遍，
// 视觉上无缝衔接；只放一遍会在末尾露出空白。
export function Marquee({ text, duration = 60, font, color }) {
  const style = { '--mfx-t': `${duration}s` };
  if (font) style.font = font;
  if (color) style.color = color;
  return (
    <div class="mfx-marquee" style={style} aria-hidden="true">
      <div>
        <span>{text}</span>
        <span>{text}</span>
      </div>
    </div>
  );
}

// 62 轮播指示点（当前点拉长 + 倒计时进度）。
// count 是点的个数，index 是当前项，interval 是每张停留毫秒数
// （与进度条动画时长一致，切换时靠 key 变化重启动画）。
export function DotsNav({ count, index, interval = 3000, onSelect }) {
  return (
    <div class="mfx-dots-nav" role="tablist" aria-label="切换">
      {Array.from({ length: count }, (_, i) => (
        <i
          key={i}
          role="tab"
          aria-selected={i === index ? 'true' : 'false'}
          class={i === index ? 'on' : ''}
          style={{ '--mfx-t': `${interval}ms` }}
          onClick={() => onSelect && onSelect(i)}
        />
      ))}
    </div>
  );
}

// 127 液态变形球（纯 CSS，无 JS）：
// 两层错位旋转的渐变叠在一起，边缘持续变形，像一颗流动的液态球。
// 图鉴原版是彩虹色，这里改成站点主色系（见 motion.css 的说明）。
// 尺寸由 size 控制；文字居中。
export function LiquidBlob({ text = 'FLOW', size = 200 }) {
  return (
    <div
      class="mfx-blob"
      style={{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.12)}px` }}
      aria-hidden={text ? undefined : 'true'}
    >
      <span>{text}</span>
    </div>
  );
}

// 22 模糊交叉换词：同一位置轮流显示几个词，旧词模糊淡出、新词从模糊中聚焦。
// 不随机、不依赖数据；用于标题或页头的一处小强调。
export function CrossFadeWords({ words = [], interval = 2800, class: cls = '' }) {
  const list = Array.isArray(words) && words.length ? words : [''];
  const [i, setI] = useState(0);
  const [out, setOut] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (list.length < 2) return undefined;
    const id = setInterval(() => {
      setOut(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setI((v) => (v + 1) % list.length);
        setOut(false);
      }, 420);
    }, interval);
    return () => {
      clearInterval(id);
      clearTimeout(timerRef.current);
    };
  }, [interval, list.length]);

  return (
    <span class={`mfx-cf${out ? ' out' : ''}${cls ? ` ${cls}` : ''}`} aria-live="polite">
      {list[i]}
    </span>
  );
}

// 32 点赞爆裂：点击后心形放大、8 个方向弹出小粒子。
// 只负责动画；是否已收藏由调用方的 onToggle 决定。
export function BurstLike({ active = false, onToggle, label = '喜欢', children, class: cls = '', ...rest }) {
  const [burst, setBurst] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function click(e) {
    setBurst(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setBurst(false), 650);
    onToggle?.(e);
  }

  return (
    <button
      type="button"
      class={`mfx-like${children ? ' mfx-like-labeled' : ''}${active ? ' on' : ''}${burst ? ' burst' : ''}${cls ? ` ${cls}` : ''}`}
      onClick={click}
      aria-pressed={!!active}
      aria-label={label}
      title={label}
      {...rest}
    >
      {children || (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" />
        </svg>
      )}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((r) => (
        <i key={r} style={{ '--r': `${r}deg` }} aria-hidden="true" />
      ))}
    </button>
  );
}

// 33 音频均衡器：播放时持续跳动，暂停时静止。纯 CSS。
export function Equalizer({ playing = true, bars = 7, class: cls = '' }) {
  return (
    <span class={`mfx-eq${playing ? ' on' : ''}${cls ? ` ${cls}` : ''}`} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <i key={i} style={{ '--d': `${0.38 + ((i * 7) % 11) * 0.055}s`, '--h': `${38 + ((i * 23) % 58)}%` }} />
      ))}
    </span>
  );
}

// 35 播放 ⇄ 暂停形变：两段竖条与一个三角形之间平滑切换。
export function PlayPauseMorph({ playing = false, onClick, label, ...rest }) {
  return (
    <button
      type="button"
      class={`mfx-pp${playing ? ' playing' : ''}`}
      onClick={onClick}
      aria-label={label || (playing ? '暂停' : '播放')}
      title={label || (playing ? '暂停' : '播放')}
      {...rest}
    >
      <i /><i />
    </button>
  );
}

// 36 RSS 脉冲 + 未读徽章：用于有未读数量的订阅 / 通知入口。
export function PulseIcon({ count = 0, children, class: cls = '', ...rest }) {
  return (
    <span class={`mfx-pulse${count > 0 ? ' has' : ''}${cls ? ` ${cls}` : ''}`} {...rest}>
      {children}
      {count > 0 && <b class="mfx-pulse-dot">{count > 99 ? '99+' : count}</b>}
    </span>
  );
}

// 54 铃铛摇晃 + 红点弹出：有新通知时摇一下，然后回到静止。
export function BellPulse({ count = 0, shaking = false, children }) {
  return (
    <span class={`mfx-bell${shaking ? ' shake' : ''}`}>
      {children}
      {count > 0 && <i class="mfx-bell-dot" aria-hidden="true" />}
    </span>
  );
}

// 86 方块波：3×3 方块错峰缩放，适合小尺寸「处理中」。
export function SquareWave({ class: cls = '' }) {
  return (
    <span class={`mfx-square${cls ? ` ${cls}` : ''}`} aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} style={{ '--d': `${(i % 3 + Math.floor(i / 3)) * 0.1}s` }} />
      ))}
    </span>
  );
}

// 87 Loading 跳字：逐字母跳起，适合比三点更明确的「正在加载」。
export function LoadingLetters({ text = 'Loading', class: cls = '' }) {
  return (
    <span class={`mfx-loading-letters${cls ? ` ${cls}` : ''}`} role="status" aria-label={text}>
      {[...text].map((ch, i) => <i key={i} style={{ '--i': i }}>{ch}</i>)}
    </span>
  );
}

// 110 3D 玻璃立方体：六个面轮流展示，悬停暂停。
export function GlassCube({ faces = [], size = 130, class: cls = '' }) {
  const list = faces.length ? faces.slice(0, 6) : ['Dora', 'Studio', '博客', '音乐', '影视', '图书'];
  return (
    <div class={`mfx-cube-wrap${cls ? ` ${cls}` : ''}`} style={{ '--cube': `${size}px` }} aria-hidden="true">
      <div class="mfx-cube">
        {list.map((f, i) => <span key={i}>{f}</span>)}
      </div>
    </div>
  );
}

// 155 金线丝绸流场：Canvas 生成艺术，金色细线随主题主色变化。
// 只在进入视口时跑；离开或页面隐藏时停。
export function SilkField({ height = 220, label = '金线丝绸流场' }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    let raf = 0;
    let running = true;
    let visible = true;
    let width = 0;
    let heightPx = 0;
    let dpr = 1;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      width = Math.max(1, r.width);
      heightPx = Math.max(1, r.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(heightPx * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '100px' });
    io.observe(canvas);

    const draw = (ms) => {
      if (!running) return;
      if (visible && !document.hidden) {
        const t = ms / 1000;
        const primary = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#4a6cf7';
        ctx.clearRect(0, 0, width, heightPx);
        const g = ctx.createLinearGradient(0, 0, width, heightPx);
        g.addColorStop(0, primary);
        g.addColorStop(0.55, '#d4af37');
        g.addColorStop(1, primary);
        for (let k = 0; k < 18; k++) {
          ctx.beginPath();
          const y0 = (k / 18) * heightPx + 12;
          for (let x = -20; x <= width + 20; x += 8) {
            const y = y0 + Math.sin(x * 0.012 + t * 0.7 + k * 0.45) * (10 + k * 0.7)
              + Math.sin(x * 0.027 - t * 0.45 + k) * 4;
            if (x === -20) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = g;
          ctx.globalAlpha = 0.1 + (k % 5) * 0.035;
          ctx.lineWidth = 0.8 + (k % 3) * 0.35;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return <canvas ref={ref} class="mfx-silk" style={{ height: `${height}px` }} role="img" aria-label={label} />;
}

// 162 粒子文字：把短文字采样成粒子，鼠标经过会冲散，点击会炸开再回位。
export function ParticleText({ text = 'Dora', height = 180, label, burstOnClick = true }) {
  const ref = useRef(null);
  const stateRef = useRef({ mouse: null, burst: 0 });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    let raf = 0;
    let running = true;
    let visible = true;
    let width = 0;
    let heightPx = 0;
    let dpr = 1;
    let points = [];

    const build = () => {
      const r = canvas.getBoundingClientRect();
      width = Math.max(1, r.width);
      heightPx = Math.max(1, r.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(heightPx * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const off = document.createElement('canvas');
      off.width = Math.max(1, Math.round(width));
      off.height = Math.max(1, Math.round(heightPx));
      const o = off.getContext('2d', { willReadFrequently: true });
      if (!o) return;
      const fs = Math.min(heightPx * 0.56, (width * 0.82) / Math.max(1, text.length * 0.62));
      o.fillStyle = '#fff';
      o.textAlign = 'center';
      o.textBaseline = 'middle';
      o.font = `800 ${fs}px "Satoshi", "PingFang SC", sans-serif`;
      o.fillText(text, width / 2, heightPx / 2);
      const data = o.getImageData(0, 0, off.width, off.height).data;
      const next = [];
      const gap = Math.max(2, Math.round(width / 180));
      for (let y = 0; y < off.height; y += gap) {
        for (let x = 0; x < off.width; x += gap) {
          if (data[(y * off.width + x) * 4 + 3] > 100) {
            next.push({
              hx: x, hy: y, x, y,
              vx: 0, vy: 0,
              ph: (x * 0.13 + y * 0.17) % 6.28
            });
          }
        }
      }
      points = next;
    };
    build();
    const ro = new ResizeObserver(build);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '100px' });
    io.observe(canvas);

    const move = (e) => {
      const r = canvas.getBoundingClientRect();
      stateRef.current.mouse = [e.clientX - r.left, e.clientY - r.top];
    };
    const leave = () => { stateRef.current.mouse = null; };
    const click = () => { if (burstOnClick) stateRef.current.burst = 1; };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('pointerdown', click);

    const draw = (ms) => {
      if (!running) return;
      if (visible && !document.hidden) {
        const t = ms / 1000;
        const primary = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#4a6cf7';
        ctx.clearRect(0, 0, width, heightPx);
        const m = stateRef.current.mouse;
        const burst = stateRef.current.burst;
        stateRef.current.burst = Math.max(0, burst - 0.025);
        for (const p of points) {
          let tx = p.hx;
          let ty = p.hy;
          if (m) {
            const dx = p.x - m[0];
            const dy = p.y - m[1];
            const d = Math.hypot(dx, dy);
            if (d < 70 && d > 0.01) {
              tx += (dx / d) * (70 - d) * 0.8;
              ty += (dy / d) * (70 - d) * 0.8;
            }
          }
          if (burst > 0) {
            tx += Math.cos(p.ph) * 60 * burst;
            ty += Math.sin(p.ph) * 60 * burst;
          }
          p.x += (tx - p.x) * 0.12;
          p.y += (ty - p.y) * 0.12;
          ctx.fillStyle = primary;
          ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 1.5 + p.ph);
          ctx.fillRect(p.x, p.y, 1.8, 1.8);
        }
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('pointerdown', click);
    };
  }, [text]);

  return <canvas ref={ref} class="mfx-particles" style={{ height: `${height}px` }} role="img" aria-label={label || `${text} 粒子文字`} />;
}

// 124 曲风排行：按真实计数降序，条宽随数据变化，换位时用 CSS 过渡。
export function GenreRank({ items = [], limit = 6, class: cls = '' }) {
  const rows = useMemo(() => {
    const list = (Array.isArray(items) ? items : [])
      .filter((it) => it && Number(it.value) > 0)
      .sort((a, b) => Number(b.value) - Number(a.value))
      .slice(0, limit);
    const max = Math.max(1, ...list.map((it) => Number(it.value) || 0));
    return list.map((it, i) => ({
      label: String(it.label ?? ''),
      value: Number(it.value) || 0,
      pct: Math.max(3, Math.round(((Number(it.value) || 0) / max) * 100)),
      color: it.color || `var(--mfx-rank-${(i % 6) + 1})`
    }));
  }, [items, limit]);

  if (!rows.length) return null;
  return (
    <div class={`mfx-rank${cls ? ` ${cls}` : ''}`} role="list" aria-label="曲风排行">
      {rows.map((it, i) => (
        <div class="mfx-rank-row" role="listitem" key={`${it.label}-${i}`}>
          <span class="mfx-rank-no">{String(i + 1).padStart(2, '0')}</span>
          <span class="mfx-rank-label" title={it.label}>{it.label}</span>
          <span class="mfx-rank-track" aria-hidden="true">
            <i style={{ width: `${it.pct}%`, background: it.color }} />
          </span>
          <b class="mfx-rank-val">{it.value}</b>
        </div>
      ))}
    </div>
  );
}

// 171 媒体占比环形图：用 SVG 画真实占比，中心显示总数。
export function DonutShare({ items = [], size = 180, label = '内容占比', class: cls = '' }) {
  const total = items.reduce((s, it) => s + (Number(it.value) || 0), 0);
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div class={`mfx-donut${cls ? ` ${cls}` : ''}`} style={{ '--donut': `${size}px` }} role="img" aria-label={label}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle class="mfx-donut-bg" cx="50" cy="50" r={r} />
        {total > 0 && items.map((it, i) => {
          const value = Number(it.value) || 0;
          if (value <= 0) return null;
          const len = (value / total) * c;
          const dash = `${Math.max(0, len - 1.5)} ${Math.max(0, c - len + 1.5)}`;
          const el = (
            <circle
              key={`${it.label}-${i}`}
              class="mfx-donut-seg"
              cx="50" cy="50" r={r}
              stroke={it.color || `var(--mfx-rank-${(i % 6) + 1})`}
              stroke-dasharray={dash}
              stroke-dashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <span class="mfx-donut-center"><b>{total}</b><small>{label}</small></span>
      <span class="mfx-donut-legend">
        {items.map((it, i) => (
          <i key={`${it.label}-${i}`} style={{ background: it.color || `var(--mfx-rank-${(i % 6) + 1})` }} title={`${it.label}：${it.value}`} />
        ))}
      </span>
    </div>
  );
}

// 175 实时指标卡：数字滚动 + 迷你流线；数值本身来自真实数据，不做假增长。
export function KpiCard({ label, value = 0, suffix = '', items = [], class: cls = '' }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const target = Number(value) || 0;
    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 700);
      setShown(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const points = useMemo(() => {
    const list = (Array.isArray(items) ? items : []).slice(-12).map((n) => Number(n) || 0);
    if (list.length < 2) return '';
    const max = Math.max(1, ...list);
    return list.map((n, i) => `${(i / (list.length - 1)) * 100},${28 - (n / max) * 24}`).join(' ');
  }, [items]);

  return (
    <div class={`mfx-kpi${cls ? ` ${cls}` : ''}`}>
      <span class="mfx-kpi-label">{label}</span>
      <strong>{shown.toLocaleString('en-US')}{suffix}</strong>
      {points && (
        <svg class="mfx-kpi-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={points} />
        </svg>
      )}
    </div>
  );
}

// 148 彩带礼炮：只在明确成功的时刻触发，避免页面一加载就放。
export function ConfettiBurst({ active = false, count = 36, class: cls = '' }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    x: ((i * 37) % 100) - 50,
    y: -20 - ((i * 53) % 80),
    r: (i * 47) % 360,
    d: 0.55 + ((i * 29) % 40) / 100,
    delay: ((i * 17) % 16) / 100
  })), [count]);
  return (
    <span class={`mfx-confetti${active ? ' on' : ''}${cls ? ` ${cls}` : ''}`} aria-hidden="true">
      {pieces.map((p) => (
        <i
          key={p.id}
          style={{
            '--x': `${p.x}px`,
            '--y': `${p.y}px`,
            '--r': `${p.r}deg`,
            '--d': `${p.d}s`,
            '--delay': `${p.delay}s`
          }}
        />
      ))}
    </span>
  );
}
