// 迷你星体（2026-10-12 用户要求）
//
// 来源：站长给的模板《LUMEN · 光之工作室112》里的「A8 一个宇宙」——
// 360 个粒子按 Fibonacci 球面均匀铺开，缓慢自转，近处更亮更大，邻近粒子之间连线。
//
// 用户要求：「把它缩小，在共创页当点缀，里面可以写文字，比如欢迎加入共创。」
// 因此这里做三件事：
//   1) 从「占满整屏」缩成一个方形小件（默认 300px，窄屏 200px），当装饰用；
//   2) 中间叠一行文字（由调用方通过 children 传入），指针事件穿透，不挡交互；
//   3) 从模板的固定配色改为**跟随站点主题**：连线取 --primary，
//      粒子色相仍在青→紫→粉的区间里流转（这是模板的观感，且与三套主题都不冲突）。
//
// 与模板的工程差异（都是刻意的）：
//   · 模板用 gsap.ticker；本仓库的动效一律用原生 rAF（见 LiquidMetal / PixelFlip），
//     不引入新依赖。
//   · 模板写死 devicePixelRatio 缩放并在坐标里手动乘；这里用 ctx.setTransform，
//     坐标全部按 CSS 像素算，代码更好读也不容易漏乘。
//   · 离开视口时停 rAF、页面隐藏时停 rAF（省电），回来再续上。
//   · prefers-reduced-motion 下不建 canvas，只留静态文字。
import { useEffect, useRef, useState } from 'preact/hooks';

const PARTICLES = 360;
// 黄金角：让点在球面上分布得最均匀（模板用的就是 2.39996 ≈ π(3-√5)）
const GOLDEN_ANGLE = 2.39996;

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// 从主题变量读主色，拼成 rgba。连线用它，保证跟随「纯净 / 素雅 / 天青」三套主题。
function readPrimary() {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    if (!v) return { r: 74, g: 108, b: 247 };
    // 支持 #rgb / #rrggbb；其余（如 color-mix 计算后的 rgb()）交给浏览器再解析一次
    if (v.startsWith('#')) {
      const hex = v.length === 4
        ? v.slice(1).split('').map((c) => c + c).join('')
        : v.slice(1);
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16)
      };
    }
    const m = v.match(/(\d+)\D+(\d+)\D+(\d+)/);
    if (m) return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  } catch { /* 读不到就用兜底色 */ }
  return { r: 74, g: 108, b: 247 };
}

export function MiniUniverse({ children, class: cls = '' }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  // 静态渲染（reduced motion）时直接不建 canvas
  const [animated, setAnimated] = useState(() => !prefersReducedMotion());

  useEffect(() => {
    if (!animated) return undefined;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    // 预生成球面点（与模板同一套公式），只算一次
    const points = [];
    for (let i = 0; i < PARTICLES; i++) {
      const y = 1 - (2 * (i + 0.5)) / PARTICLES;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const a = i * GOLDEN_ANGLE;
      points.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }

    let width = 0;
    let height = 0;
    let dpr = 1;
    let primary = readPrimary();
    let raf = 0;
    let running = false;
    let inView = true;
    let ry = 0;
    let rx = 0;
    let targetX = 0;   // 指针影响（-1~1），平滑跟随
    let targetY = 0;
    let smoothX = 0;
    let smoothY = 0;

    function resize() {
      const rect = wrap.getBoundingClientRect();
      const size = Math.max(1, Math.min(rect.width, rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = size;
      height = size;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      // 坐标一律按 CSS 像素算，缩放交给 transform
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(t) {
      if (!running) return;
      smoothX += (targetX - smoothX) * 0.06;
      smoothY += (targetY - smoothY) * 0.06;

      // 自转：基础速度 + 指针横向影响；纵向做阻尼回正（与模板一致）
      ry += 0.004 + smoothX * 0.03;
      rx += smoothY * 0.02 - rx * 0.02;

      const cy = Math.cos(ry); const sy = Math.sin(ry);
      const cx = Math.cos(rx * 3); const sx = Math.sin(rx * 3);
      const R = Math.min(width, height) * 0.34;
      const breathe = 1 + Math.sin(t * 0.0012) * 0.04;   // 轻微呼吸
      const half = { x: width / 2, y: height / 2 };

      ctx.clearRect(0, 0, width, height);

      // 投影：绕 Y 再绕 X 旋转，透视缩放 s 让近处更大
      const q = points.map((p) => {
        const [a, b, c] = p;
        const X = a * cy + c * sy;
        const Z0 = -a * sy + c * cy;
        const Y = b * cx - Z0 * sx;
        const Z = b * sx + Z0 * cx;
        const s = 2.6 / (2.6 - Z * 0.8);
        return [half.x + X * R * breathe * s, half.y + Y * R * breathe * s, Z, s];
      });

      // 连线：只连「相邻序号的近邻」，距离过远不连（避免糊成一团）
      const maxLine = R * 0.22;
      ctx.lineWidth = 1;
      for (let i = 0; i < PARTICLES; i++) {
        const a = q[i];
        for (let j = i + 1; j < Math.min(PARTICLES, i + 14); j++) {
          const b = q[j];
          const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
          if (d >= maxLine) continue;
          const alpha = (1 - d / maxLine) * 0.5 * ((a[2] + 1.2) / 2.2);
          ctx.strokeStyle = `rgba(${primary.r},${primary.g},${primary.b},${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.stroke();
        }
      }

      // 粒子：色相在青(190)→紫→粉(330) 区间随深度流转，近处更亮更大
      for (const p of q) {
        const k = (p[2] + 1) / 2;
        ctx.fillStyle = `hsla(${190 + k * 140}, 80%, ${52 - k * 14}%, ${0.3 + k * 0.7})`;
        ctx.beginPath();
        ctx.arc(p[0], p[1], (1.2 + k * 3.2) * p[3] * 0.8, 0, 6.283);
        ctx.fill();
      }

      raf = window.requestAnimationFrame(draw);
    }

    function start() {
      if (running || !inView || document.hidden) return;
      running = true;
      raf = window.requestAnimationFrame(draw);
    }
    function stop() {
      running = false;
      window.cancelAnimationFrame(raf);
    }

    // 指针在星体上移动时轻微改变旋转（触屏没有 hover，自然就不会触发）
    function onPointerMove(e) {
      const rect = wrap.getBoundingClientRect();
      targetX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      targetY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    }
    function onPointerLeave() { targetX = 0; targetY = 0; }

    const onVisibility = () => { if (document.hidden) stop(); else start(); };
    // 切主题时重读主色，连线颜色跟着变
    const themeObserver = new MutationObserver(() => { primary = readPrimary(); });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });

    const io = new IntersectionObserver((entries) => {
      inView = entries[0]?.isIntersecting ?? true;
      if (inView) start(); else stop();
    });
    io.observe(wrap);

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    resize();
    start();
    document.addEventListener('visibilitychange', onVisibility);
    wrap.addEventListener('pointermove', onPointerMove);
    wrap.addEventListener('pointerleave', onPointerLeave);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      themeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      wrap.removeEventListener('pointermove', onPointerMove);
      wrap.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [animated]);

  return (
    <div class={`muni${cls ? ` ${cls}` : ''}`} ref={wrapRef}>
      {animated && <canvas class="muni-canvas" ref={canvasRef} aria-hidden="true" />}
      <div class="muni-center">{children}</div>
    </div>
  );
}
