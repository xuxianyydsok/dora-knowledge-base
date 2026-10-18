// Canvas 装饰动画（2026-10-18，来自图鉴 #194 谐波绘图 / #198 呼吸三环）
//
// 为什么单独一个文件：这两个都是「纯装饰」的 canvas 动画，与业务无关，
// 但都需要同一套样板代码 —— 高分屏适配、ResizeObserver、rAF 生命周期、
// 页面不可见时暂停、组件卸载时清理。抽出来避免写两遍。
//
// 与图鉴原版的差异：
//   · 颜色全部走站点主题变量（图鉴用的是写死的金/橙/米白）；
//   · 原版用 IntersectionObserver 判断可见性，这里用 document.hidden +
//     IntersectionObserver 双重判断（滚出视口也暂停，省电）。
import { useEffect, useRef } from 'preact/hooks';

// 通用 canvas 初始化：处理 devicePixelRatio（高分屏不发虚）+ 尺寸变化
function setupCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const size = { w: 0, h: 0 };
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    size.w = rect.width;
    size.h = rect.height;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  return { ctx, size, cleanup: () => ro.disconnect() };
}

// 从站点 CSS 变量里读颜色（这样三套主题切换时会跟着变）
function themeColor(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch { return fallback; }
}

// 通用动画循环：页面隐藏 / 滚出视口时暂停，卸载时彻底清理
function useLoop(canvasRef, draw) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const { ctx, size, cleanup } = setupCanvas(canvas);

    let raf = 0;
    let visible = true;
    let running = true;
    let last = 0;

    const frame = (ms) => {
      if (!running) return;
      const t = ms / 1000;
      const dt = last ? Math.min(t - last, 0.05) : 0.016;
      last = t;
      if (visible && !document.hidden) draw(ctx, size, t, dt);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '120px' });
    io.observe(canvas);
    const onVis = () => { if (!document.hidden) last = 0; };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      cleanup();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [draw]);
}

// 194 谐波绘图：两组不同频率的正弦叠加，画出持续变形的金线。
// 用 'lighter' 混合模式让两条线交叠处发亮（与图鉴一致）。
export function Harmonograph({ height = 240, label = '谐波绘图' }) {
  const ref = useRef(null);
  const draw = useRef((ctx, size, t) => {
    const { w, h } = size;
    if (!w || !h) return;
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.23;
    const p = t * 0.22;
    const primary = themeColor('--primary', '#4a6cf7');
    const text = themeColor('--text-muted', '#5b6472');

    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    // 两条线：主色（粗、明显）+ 弱化的文字色（细、做层次）
    [[primary, 0.6, 1.1, 1], [text, 0.22, 0.6, 1.3]].forEach(([color, alpha, lw, k]) => {
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = lw;
      ctx.beginPath();
      for (let i = 0; i <= 2600; i++) {
        const u = (i / 2600) * Math.PI * 6;
        const a = Math.sin(3 * u + p * k) + 0.65 * Math.sin(5.003 * u + p * 2.1 * k);
        const b = Math.sin(4 * u + p * 1.3 * k + k) + 0.65 * Math.sin(2.004 * u + p * 3.1 * k);
        const X = cx + a * R;
        const Y = cy + b * R;
        if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
      }
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }).current;

  useLoop(ref, draw);
  return <canvas ref={ref} class="mfx-canvas" style={{ height: `${height}px` }} role="img" aria-label={label} />;
}

// 198 呼吸三环：三个同心环的进度弧持续起伏，中间显示同步率。
export function BreathingRings({ height = 240, label = '呼吸三环' }) {
  const ref = useRef(null);
  const draw = useRef((ctx, size, t) => {
    const { w, h } = size;
    if (!w || !h) return;
    const cx = w / 2;
    const cy = h / 2;
    const r0 = Math.min(w, h) * 0.34;
    const primary = themeColor('--primary', '#4a6cf7');
    const text = themeColor('--text', '#10131a');
    const muted = themeColor('--text-muted', '#5b6472');
    const border = themeColor('--border', '#d9dfea');

    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round';

    // 外圈刻度（72 根细线，缓慢旋转）
    ctx.strokeStyle = border;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2 + t * 0.06;
      const r1 = r0 + 22;
      const r2 = r1 + (i % 6 ? 4 : 9);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 三个环：不同速度 / 相位，叠出「呼吸」感
    let sum = 0;
    [[text, 0.7, 0], [primary, 0.9, 2.2], [muted, 1.1, 4.1]].forEach(([color, speed, phase], k) => {
      const r = r0 - k * 28;
      const v = 0.5 + 0.44 * Math.sin(t * speed * 0.9 + phase);
      sum += v;
      ctx.strokeStyle = border;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + v * Math.PI * 2);
      ctx.stroke();
    });

    // 中心百分比 + 说明
    ctx.fillStyle = text;
    ctx.textAlign = 'center';
    // canvas 的 font 不解析 CSS 变量，只能写具体字体栈（与站点 --font-display 一致）
    ctx.font = `600 ${Math.round(Math.min(w, h) * 0.145)}px Georgia, "Songti SC", serif`;
    ctx.fillText(`${Math.round((sum / 3) * 100)}%`, cx, cy + 8);
    ctx.font = '10px ui-monospace, Menlo, Consolas, monospace';
    ctx.fillStyle = muted;
    ctx.fillText('同步率', cx, cy + 28);
  }).current;

  useLoop(ref, draw);
  return <canvas ref={ref} class="mfx-canvas" style={{ height: `${height}px` }} role="img" aria-label={label} />;
}
