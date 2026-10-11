// 全站点击 / 指针特效层（2026-10-11 新增）
// ------------------------------------------------------------------
// 参考站长给的《blog-home-v2》模板，把它的三层指针特效搬到本站在线运行：
//   ① 点击爆散（burst）：一圈扩散描边 + 一撮带重力的粒子
//   ② 指针拖尾（trail）：快速移动时留下一串淡色小点
//   ③ 自定义光标（cursor）：普通链接变空心环、带 data-cursor 的元素变实心大圆并显示文字
// 另外提供两个「挂载即生效」的交互增强：
//   ④ 磁吸（data-magnetic）：元素朝指针方向轻微位移
//   ⑤ 倾斜 + 高光（data-tilt）：卡片按指针位置做 3D 倾斜，并跟出一团柔光
//
// 设计取舍：
//   · 单个 canvas 承载全部粒子（而不是每个粒子一个 DOM），几十个粒子也只有一次合成。
//   · 只在「有真实指针 + 未开启减少动态效果」时启动；触屏和 reduced-motion 下
//     连 canvas 都不创建，不占内存。
//   · 光标是**增强**而非替代：不改任何元素的 cursor 样式，原来的手型/文本光标照常，
//     自绘光标只是叠在最上层的一个视觉提示。
import { useEffect, useRef } from 'preact/hooks';

// 读主题色：三套主题（纯净 / 素雅 / 天青）切换后颜色会变，所以定期重读。
function readTheme() {
  if (typeof document === 'undefined') return { accent: '#4a6cf7', ink: '#10131a' };
  const cs = getComputedStyle(document.documentElement);
  return {
    accent: (cs.getPropertyValue('--primary') || '').trim() || '#4a6cf7',
    ink: (cs.getPropertyValue('--text') || '').trim() || '#10131a',
    paper: (cs.getPropertyValue('--bg') || '').trim() || '#ffffff'
  };
}

export function ClickFx() {
  const canvasRef = useRef(null);
  const cursorRef = useRef(null);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    if (reduce || !fine) return undefined;

    const cv = canvasRef.current;
    const cur = cursorRef.current;
    if (!cv) return undefined;
    const ctx = cv.getContext('2d');
    if (!ctx) return undefined;

    let colors = readTheme();
    let W = 0;
    let H = 0;
    let dpr = 1;

    const parts = [];   // 粒子（点 / 纸屑）
    const rings = [];   // 扩散描边圈
    const PAL = () => [colors.accent, colors.ink, '#e4572e', '#e9b44c', '#3fa796'];

    const size = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = W * dpr;
      cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();

    // ---- ① 点击爆散 ----
    const burst = (x, y, n = 14) => {
      rings.push({ x, y, t: 0, m: 44 }, { x, y, t: -7, m: 78 });
      for (let i = 0; i < n; i += 1) {
        const a = Math.random() * 6.283;
        const s = 2 + Math.random() * 4.2;
        parts.push({
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: 0, max: 34 + Math.random() * 22, r: 1.4 + Math.random() * 2.4,
          c: Math.random() < 0.6 ? colors.accent : colors.ink,
          g: 0.02, drag: 0.955, k: 0
        });
      }
    };

    // ---- ② 指针拖尾 ----
    const trail = (x, y) => {
      parts.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.7 + 0.15,
        life: 0, max: 28 + Math.random() * 20, r: 1 + Math.random() * 2.2,
        c: Math.random() < 0.5 ? colors.accent : colors.ink,
        g: 0, drag: 0.98, k: 0, a0: 0.55
      });
    };

    // 供别处触发（比如表单提交成功时撒彩带）
    const confetti = (x, y) => {
      const P = PAL();
      for (let i = 0; i < 110; i += 1) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
        const s = 6 + Math.random() * 13;
        parts.push({
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: 0, max: 100 + Math.random() * 70,
          w: 5 + Math.random() * 6, h: 3 + Math.random() * 4,
          rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.45,
          c: P[(Math.random() * P.length) | 0], g: 0.28, drag: 0.985, k: 1
        });
      }
    };
    window.__doraFx = { burst, confetti };

    // ---- 主循环 ----
    let raf = 0;
    let drawn = false;
    const frame = () => {
      raf = 0;
      if (!parts.length && !rings.length) {
        if (drawn) { ctx.clearRect(0, 0, W, H); drawn = false; }
        return;
      }
      drawn = true;
      ctx.clearRect(0, 0, W, H);

      for (let i = rings.length - 1; i >= 0; i -= 1) {
        const r = rings[i];
        r.t += 1;
        if (r.t < 0) continue;
        const p = r.t / r.m;
        if (p >= 1) { rings.splice(i, 1); continue; }
        ctx.globalAlpha = (1 - p) * 0.7;
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 1.5 * (1 - p) + 0.5;
        ctx.beginPath();
        ctx.arc(r.x, r.y, (1 - Math.pow(1 - p, 3)) * (r.m * 1.1), 0, 6.283);
        ctx.stroke();
      }

      for (let i = parts.length - 1; i >= 0; i -= 1) {
        const p = parts[i];
        p.life += 1;
        if (p.life > p.max) { parts.splice(i, 1); continue; }
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.g;
        p.x += p.vx;
        p.y += p.vy;
        ctx.globalAlpha = (1 - p.life / p.max) * (p.a0 || 1);
        ctx.fillStyle = p.c;
        if (p.k) {
          p.rot += p.vr;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, 6.283);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      schedule();
    };

    const schedule = () => { if (!raf) raf = requestAnimationFrame(frame); };

    // ---- ③ 自定义光标 ----
    let cx = -100;
    let cy = -100;
    let tx = -100;
    let ty = -100;
    let lastTrail = { x: 0, y: 0 };
    let curRaf = 0;

    const paintCursor = () => {
      curRaf = 0;
      cx += (tx - cx) * 0.22;
      cy += (ty - cy) * 0.22;
      if (cur) cur.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      if (Math.abs(cx - tx) > 0.4 || Math.abs(cy - ty) > 0.4) curRaf = requestAnimationFrame(paintCursor);
    };

    const onMove = (e) => {
      tx = e.clientX;
      ty = e.clientY;
      if (cur) cur.classList.add('on');
      if (Math.hypot(e.clientX - lastTrail.x, e.clientY - lastTrail.y) > 16) {
        trail(e.clientX, e.clientY);
        lastTrail = { x: e.clientX, y: e.clientY };
        schedule();
      }
      if (!curRaf) curRaf = requestAnimationFrame(paintCursor);
    };

    const onOver = (e) => {
      if (!cur) return;
      const v = e.target.closest?.('[data-cursor]');
      const l = e.target.closest?.('a, button, input, .tab, [role="button"]');
      const label = v && v.getAttribute('data-cursor');
      cur.classList.toggle('view', !!label);
      cur.classList.toggle('link', !label && !!l);
      const t = cur.querySelector('.fx-cur-text');
      if (t) t.textContent = label || '';
    };

    const onLeaveDoc = () => cur?.classList.remove('on');
    const onDown = () => cur?.classList.add('down');
    const onUp = () => cur?.classList.remove('down');

    const onPointerDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
      burst(e.clientX, e.clientY);
      schedule();
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerleave', onLeaveDoc);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', size);

    // ---- ④ 磁吸 ----
    const magnetics = [];
    const bindMagnetic = (el) => {
      if (el.__fxMag) return;
      el.__fxMag = true;
      const move = (e) => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.32}px, ${(e.clientY - r.top - r.height / 2) * 0.32}px)`;
      };
      const leave = () => { el.style.transform = ''; };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
      magnetics.push({ el, move, leave });
    };

    // ---- ⑤ 倾斜 + 高光 ----
    const tilts = [];
    const bindTilt = (el) => {
      if (el.__fxTilt) return;
      el.__fxTilt = true;
      if (!el.querySelector(':scope > .fx-glare')) {
        const g = document.createElement('i');
        g.className = 'fx-glare';
        el.appendChild(g);
      }
      const move = (e) => {
        const max = Number(el.getAttribute('data-tilt')) || 5;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        el.style.transform = `perspective(1100px) rotateX(${((0.5 - y) * max * 2).toFixed(2)}deg) rotateY(${((x - 0.5) * max * 2).toFixed(2)}deg) scale3d(1.012,1.012,1)`;
        el.style.setProperty('--fx-gx', `${x * 100}%`);
        el.style.setProperty('--fx-gy', `${y * 100}%`);
      };
      const leave = () => { el.style.transform = ''; };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
      tilts.push({ el, move, leave });
    };

    // 新出现的元素（路由切换 / 懒加载）也要能拿到磁吸与倾斜：
    // 用 MutationObserver 扫一遍新增节点，成本远低于每帧查询。
    const scan = (root = document) => {
      root.querySelectorAll?.('[data-magnetic]').forEach(bindMagnetic);
      root.querySelectorAll?.('[data-tilt]').forEach(bindTilt);
    };
    scan();
    const mo = new MutationObserver((records) => {
      records.forEach((rec) => rec.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.matches?.('[data-magnetic]')) bindMagnetic(n);
        if (n.matches?.('[data-tilt]')) bindTilt(n);
        scan(n);
      }));
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // 主题切换后重读颜色（否则切到素雅 / 天青后粒子还是旧色）
    let themeTicks = 0;
    const themeTimer = setInterval(() => {
      themeTicks += 1;
      if (themeTicks % 20 === 0) colors = readTheme();
    }, 500);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (curRaf) cancelAnimationFrame(curRaf);
      clearInterval(themeTimer);
      mo.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerleave', onLeaveDoc);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', size);
      magnetics.forEach(({ el, move, leave }) => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerleave', leave);
      });
      tilts.forEach(({ el, move, leave }) => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerleave', leave);
      });
      if (window.__doraFx) delete window.__doraFx;
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} class="fx-canvas" aria-hidden="true" />
      <div ref={cursorRef} class="fx-cursor" aria-hidden="true">
        <span class="fx-cur-b"><span class="fx-cur-text" /></span>
      </div>
    </>
  );
}
