// 首页「流场画布」：装饰性的多彩墨迹流场（由两色素流场升级，参考 04.html 第 05 个特效）。
//
// 设计取舍（为什么这么做）：
//   1) 粒子分 3 个色相组，三色交织成墨迹；三套配色全部从主题变量派生，
//      只有「琥珀日落」里保留一个固定暖色 #e08a3c 做点缀 —— 换主题、换自定义配色
//      都不会和背景撞色，也就不用写死一堆高饱和品牌色。
//   2) 拖尾继续用 destination-out 低 alpha 覆盖，而不是模板那种「用底色覆盖」：
//      画布必须保持透明，才能让 .ld-about-flow 的径向遮罩和页面主题背景透出来；
//      用底色覆盖等于在装饰层上再糊一层不透明底，会把页面背景和遮罩一起盖掉。
//   3) 方向场用模块内私有实现的 Perlin 梯度噪声（固定种子置换表），图案稳定不跳；
//      时间只体现在第三个维度（t 偏移）上。
//   4) 鼠标扰动 = 径向推开 + 切向涡旋（半径 160px，切向 3.2 > 径向 0.8，参照模板 05）。
//      监听挂在 window 上：画布所在的装饰层是 pointer-events:none，挂在它身上收不到事件。
//   5) 线宽 / 透明度随速度变化，但按 3 档量化：3 组 × 3 档 = 9 次 stroke，
//      而不是模板那样每条线段一次 stroke，低端机更稳。
//   6) 配色按钮用 createPortal 挂到装饰层的上一层（Home.jsx 里是 .ld-about-sec）：
//      装饰层上有 opacity:.5 + 径向遮罩 + pointer-events:none，
//      按钮放在里面会被压暗、在角落被遮没、还点不到。
//   7) 不可见时用 running 标志位暂停 rAF（而不是 cancel 后无法恢复）；
//      prefers-reduced-motion 下同步画若干帧出静态图后不启动 rAF。
import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';

// ---------- 常量 ----------

// 粒子数按面积自适应：上限 1100，低端机上 1000 条出头的短线仍然稳
const MAX_PARTICLES = 1100;
const MIN_PARTICLES = 320;
const AREA_PER_PARTICLE = 2100;

// 噪声方向场的基础速度（px/帧）
const BASE_SPEED = 1.6;
// 鼠标扰动：半径 160px，切向涡旋 3.2 > 径向推开 0.8（参照模板 05，旋涡感更强）
const MOUSE_R = 160;
const MOUSE_R2 = MOUSE_R * MOUSE_R;
const MOUSE_SWIRL = 3.2;
const MOUSE_PUSH = 0.8;

// 速度分 3 档：同一档共用一个线宽 / 透明度，减少 stroke 次数
const SPEED_STEPS = [2.0, 3.4];
const SPEED_WIDTH = [0.9, 1.5, 2.4];
const SPEED_ALPHA = [0.3, 0.44, 0.62];

// 每 60 帧重读一次主题色（约 1 秒），避免每帧 getComputedStyle 的重排开销
const COLOR_EVERY = 60;

// 「琥珀日落」里唯一写死的暖色点缀（其余颜色一律从主题变量取）
const WARM = [224, 138, 60];   // #e08a3c

// ---------- 颜色：解析 + 数值混合 ----------

// getComputedStyle 拿到的颜色统一是 rgb()/rgba()，这里认这一种，再用 hex 兜底
function parseColor(str) {
  const text = String(str || '').trim();
  const fn = text.match(/^rgba?\(([^)]+)\)$/i);
  if (fn) {
    const n = fn[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (n.length >= 3 && n.slice(0, 3).every((v) => Number.isFinite(v))) return [n[0], n[1], n[2]];
  }
  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const s = hex[1].length === 3 ? hex[1].replace(/./g, (ch) => ch + ch) : hex[1];
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }
  return null;
}

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
const toCss = (rgb) => `rgb(${Math.round(clamp255(rgb[0]))}, ${Math.round(clamp255(rgb[1]))}, ${Math.round(clamp255(rgb[2]))})`;

// t=0 取 a，t=1 取 b；用来把主题色往背景色（调浅）或往墨色（调深）方向推
function mixRgb(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// 三套配色：每套从主题变量派生 3 个颜色，对应粒子的 h = 0 / 1 / 2
const PALETTES = [
  {
    name: '靛紫霞光',
    // 主色 + 次要文字色 + 主色往背景方向调浅的变体：同一色系里的深浅层次
    build: (c) => [c.primary, c.textMuted, mixRgb(c.primary, c.bg, 0.5)],
  },
  {
    name: '水墨留白',
    // 正文墨色 + 次要文字 + 一点主色：宣纸上的墨，外加一点主色做「朱砂」
    build: (c) => [c.text, c.textMuted, c.primary],
  },
  {
    name: '琥珀日落',
    // 唯一的固定暖色点缀 + 主色 + 次要文字：其余颜色仍跟着主题走
    build: (c) => [WARM, c.primary, c.textMuted],
  },
];

// ---------- 2D 梯度噪声（Perlin），模块内私有 ----------

// 固定种子（xorshift32）打乱 0..255，再拼成 512 长度置换表，保证图案稳定
const PERM = (() => {
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;

  let seed = 20261011 >>> 0;
  const rand = () => {
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5; seed >>>= 0;
    return seed / 4294967296;
  };

  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = base[i];
    base[i] = base[j];
    base[j] = tmp;
  }

  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];
  return perm;
})();

// 经典 8 方向梯度
const GRAD = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [-1, 1], [1, -1], [-1, -1],
];

// 插值曲线：v^3 * (v * (6v - 15) + 10)
const fadeCurve = (v) => v * v * v * (v * (v * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
const grad = (hash, x, y) => {
  const g = GRAD[hash & 7];
  return g[0] * x + g[1] * y;
};

// 二维梯度噪声，返回值大致落在 [-1, 1]
function noise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const X = xi & 255;
  const Y = yi & 255;
  const xf = x - xi;
  const yf = y - yi;
  const u = fadeCurve(xf);
  const v = fadeCurve(yf);

  const aa = PERM[PERM[X] + Y];
  const ab = PERM[PERM[X] + Y + 1];
  const ba = PERM[PERM[X + 1] + Y];
  const bb = PERM[PERM[X + 1] + Y + 1];

  const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
  const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
  return lerp(x1, x2, v) * 1.4;
}

// ---------- 组件内注入的样式 ----------
// 不改 home-landing.css（那个文件另一个人在改），按钮样式走主题变量，跟着主题自动变
const CSS = `
.ld-flow-btn{position:absolute;right:clamp(10px,2vw,24px);bottom:clamp(10px,2vw,20px);z-index:2;
  display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 13px;white-space:nowrap;
  border-radius:var(--radius-pill,999px);border:1px solid var(--border);
  background:color-mix(in srgb,var(--bg-elevated) 80%,transparent);
  -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);
  color:var(--text-muted);font:inherit;font-size:12px;line-height:1;letter-spacing:.02em;
  cursor:pointer;pointer-events:auto;
  transition:color .2s cubic-bezier(.22,1,.36,1),border-color .2s cubic-bezier(.22,1,.36,1),transform .2s cubic-bezier(.22,1,.36,1);}
.ld-flow-btn:hover{color:var(--text);border-color:color-mix(in srgb,var(--primary) 42%,var(--border));transform:translateY(-1px);}
.ld-flow-btn:active{transform:none;}
.ld-flow-btn:focus-visible{outline:2px solid color-mix(in srgb,var(--primary) 60%,transparent);outline-offset:2px;}
.ld-flow-btn i{width:8px;height:8px;border-radius:50%;background:var(--primary);flex:none;}
`;

let cssInjected = false;
function useFlowCss() {
  useEffect(() => {
    if (cssInjected || typeof document === 'undefined') return;
    if (document.getElementById('ld-flow-css')) { cssInjected = true; return; }
    cssInjected = true;
    const el = document.createElement('style');
    el.id = 'ld-flow-css';
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}

// ---------- 组件 ----------

export function HomeFlow({ class: cls = '' }) {
  const ref = useRef(null);
  const apiRef = useRef(null);
  // 按钮的挂载点 / 当前配色（画布那堆状态都放在 effect 里，这里只放要渲染的东西）
  const [anchor, setAnchor] = useState(null);
  const [palette, setPalette] = useState({ name: PALETTES[0].name, dot: '' });

  useFlowCss();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const parent = canvas.parentElement;
    if (!ctx || !parent) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let W = 0;
    let H = 0;
    let t = 0;                       // 帧计数，驱动噪声场流动
    let frameNo = 0;                 // 用于每 60 帧重读一次颜色
    let rafId = 0;
    let running = false;             // 可见时才继续排下一帧
    let particles = [];

    // 鼠标位置（canvas 逻辑坐标），初始放到很远处表示「没有鼠标」
    let mx = -1e4;
    let my = -1e4;

    let paletteIdx = 0;              // 当前配色下标
    let dirShift = 0;                // 切配色时顺带平移噪声场，换一次流向
    let paletteColors = ['rgb(74,108,247)', 'rgb(91,100,114)', 'rgb(156,174,251)'];

    // 隐藏探针：把任意格式的 CSS 变量（hex / rgb / color-mix / oklch…）交给浏览器
    // 解析成 rgb 再读回来，比自己在 JS 里猜格式稳。
    // 挂在 body 上（position:fixed）：既不参与装饰层布局，也不受祖先 transform 影响。
    const probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;left:-9999px;top:0;width:0;height:0;visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);

    const readVar = (name, fallback) => {
      probe.style.color = `var(${name})`;
      return parseColor(getComputedStyle(probe).color) || fallback;
    };

    // 从 CSS 变量重算当前配色的 3 个颜色（只在 resize 和每 60 帧时调用）
    const readColors = () => {
      const c = {
        primary: readVar('--primary', [74, 108, 247]),
        text: readVar('--text', [16, 19, 26]),
        textMuted: readVar('--text-muted', [91, 100, 114]),
        bg: readVar('--bg', [238, 241, 248]),
      };
      paletteColors = PALETTES[paletteIdx].build(c).map(toCss);
      // 按钮上的小圆点跟着配色走；只有真的变了才 setState，避免每 60 帧白渲染一次
      const dot = paletteColors[0];
      setPalette((prev) => (prev.dot === dot ? prev : { ...prev, dot }));
    };

    // 新粒子：位置随机撒满画布，寿命 / 速度随机，色相分组随机（三色交织的关键）
    const spawn = () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      life: 140 + Math.random() * 240,
      age: 0,
      s: 0.7 + Math.random() * 0.7,
      h: Math.floor(Math.random() * 3),
    });

    // 按画布面积决定粒子数
    const buildParticles = () => {
      const n = Math.min(MAX_PARTICLES, Math.max(MIN_PARTICLES, Math.round((W * H) / AREA_PER_PARTICLE)));
      particles = new Array(n);
      for (let i = 0; i < n; i++) particles[i] = spawn();
    };

    // 尺寸同步：观察的是父元素，画布按 dpr 放大后再把变换设回去
    const resize = () => {
      const rect = parent.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width;
      H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildParticles();
      readColors();
      rectCache = canvas.getBoundingClientRect();
    };

    // destination-out 低 alpha 覆盖：既是每帧的拖尾淡出，也是切配色时的快速擦除
    const fadeOut = (alpha, passes) => {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      for (let i = 0; i < passes; i++) ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    };

    // 分桶缓冲：3 个色相组 × 3 个速度档 = 9 个线段数组，每帧复用（只把 length 归零）
    const buckets = new Array(9);
    for (let i = 0; i < 9; i++) buckets[i] = [];

    const draw = () => {
      // 每 60 帧重读一次主题色
      if (frameNo % COLOR_EVERY === 0) readColors();
      frameNo++;

      fadeOut(0.055, 1);
      ctx.lineCap = 'round';

      // 一帧里先把所有粒子推进一次，线段按「色相组 × 速度档」分桶
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const x0 = p.x;
        const y0 = p.y;

        // 噪声场决定方向（第三个维度用 t 偏移，让场缓慢流动；dirShift 用来换向）
        const a = noise(x0 * 0.0016 + t * 0.0016 + dirShift, y0 * 0.0016 - t * 0.0011 + dirShift) * Math.PI * 2.4;
        let vx = Math.cos(a) * BASE_SPEED;
        let vy = Math.sin(a) * BASE_SPEED;

        // 鼠标：径向推开 + 切向涡旋（切向更强，所以是「搅」而不是「吹」）
        const dx = x0 - mx;
        const dy = y0 - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < MOUSE_R2) {
          const d = Math.sqrt(d2) + 0.001;
          const f = 1 - d / MOUSE_R;
          vx += (-dy / d * MOUSE_SWIRL + dx / d * MOUSE_PUSH) * f;
          vy += (dx / d * MOUSE_SWIRL + dy / d * MOUSE_PUSH) * f;
        }

        const nx = x0 + vx * p.s;
        const ny = y0 + vy * p.s;

        // 实际速度决定线宽 / 透明度档位
        const sp = Math.sqrt(vx * vx + vy * vy) * p.s;
        const b = sp < SPEED_STEPS[0] ? 0 : sp < SPEED_STEPS[1] ? 1 : 2;
        buckets[p.h * 3 + b].push(x0, y0, nx, ny);

        p.x = nx;
        p.y = ny;
        p.age++;
        // 寿命耗尽或飘出画布外就重生
        if (p.age > p.life || nx < -20 || nx > W + 20 || ny < -20 || ny > H + 20) {
          particles[i] = spawn();
        }
      }

      // 再按桶批量描边：9 次 stroke 就画完一帧
      for (let g = 0; g < 3; g++) {
        ctx.strokeStyle = paletteColors[g] || paletteColors[0];
        for (let b = 0; b < 3; b++) {
          const seg = buckets[g * 3 + b];
          if (!seg.length) continue;
          ctx.globalAlpha = SPEED_ALPHA[b];
          ctx.lineWidth = SPEED_WIDTH[b];
          ctx.beginPath();
          for (let i = 0; i < seg.length; i += 4) {
            ctx.moveTo(seg[i], seg[i + 1]);
            ctx.lineTo(seg[i + 2], seg[i + 3]);
          }
          ctx.stroke();
          seg.length = 0;
        }
      }
      ctx.globalAlpha = 1;

      t++;
    };

    const frame = () => {
      if (!running) return;
      draw();
      rafId = requestAnimationFrame(frame);
    };

    const start = () => {
      // 减少动态时永远不启动 rAF（IntersectionObserver 首次可见时也会走到这里）
      if (reduced || running) return;
      running = true;
      rafId = requestAnimationFrame(frame);
    };
    const stop = () => { running = false; };

    // 点按钮：换下一套配色 + 换一次流向，并把旧墨迹快速擦掉
    const switchPalette = () => {
      paletteIdx = (paletteIdx + 1) % PALETTES.length;
      dirShift += 2.7;
      readColors();                 // 立刻按新配色重算，不用等下一次 60 帧
      setPalette((prev) => ({ ...prev, name: PALETTES[paletteIdx].name }));
      if (!W || !H) return;
      fadeOut(0.32, 6);
      // 减少动态时没有 rAF，切配色后要把静态图重画一遍
      if (reduced) for (let i = 0; i < 200; i++) draw();
    };
    apiRef.current = { next: switchPalette };

    // 装饰层是 pointer-events:none，事件落不到画布 / 父容器上，所以监听挂在 window 上，
    // 再把坐标换算到画布坐标系；离画布太远就当作「没有鼠标」。
    // 画布几何缓存到 rectCache，避免每次 pointermove 都 getBoundingClientRect（强制布局）。
    let rectCache = canvas.getBoundingClientRect();
    const onPointerMove = (e) => {
      const x = e.clientX - rectCache.left;
      const y = e.clientY - rectCache.top;
      if (x < -40 || y < -40 || x > rectCache.width + 40 || y > rectCache.height + 40) {
        mx = -1e4;
        my = -1e4;
        return;
      }
      mx = x;
      my = y;
    };
    const onPointerLeave = () => {
      mx = -1e4;
      my = -1e4;
    };

    resize();

    // 按钮挂到装饰层的上一层（Home.jsx 里是 .ld-about-sec，position:relative），
    // 这样按钮不受装饰层 opacity / mask / pointer-events 的影响；异常情况下退回父容器。
    let host = parent;
    for (let el = parent.parentElement; el && el !== document.body; el = el.parentElement) {
      if (getComputedStyle(el).position !== 'static') { host = el; break; }
    }
    setAnchor(host);

    // 父元素尺寸变化 -> 重算画布与粒子
    const ro = new ResizeObserver(() => resize());
    ro.observe(parent);

    // 可见性：不可见时只停掉 running，重新可见时恢复
    let io = null;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver((entries) => {
        for (let i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) start();
          else stop();
        }
      });
      io.observe(parent);
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onPointerLeave);

    // 主题 / 自定义配色改的是 documentElement 上的 data-theme 与内联变量，
    // 这里顺手盯一下：正常模式下一帧内就换色（不用等满 60 帧），
    // 减少动态模式下没有 rAF，靠它把静态图重画一遍。
    let mo = null;
    if (typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver(() => {
        readColors();
        if (reduced && W && H) for (let i = 0; i < 200; i++) draw();
      });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });
    }

    if (reduced) {
      // 减少动态：同步画 200 帧出一张静态图，然后完全不启动 rAF
      for (let i = 0; i < 200; i++) draw();
    } else if (!io) {
      // 没有 IntersectionObserver 时退化为一直运行
      start();
    }

    return () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
      if (io) io.disconnect();
      if (mo) mo.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('mouseleave', onPointerLeave);
      probe.remove();
      apiRef.current = null;
    };
  }, []);

  return (
    <>
      <canvas ref={ref} class={`ld-flow ${cls}`} aria-hidden="true" />
      {anchor && createPortal(
        <button
          type="button"
          class="ld-flow-btn"
          title="切换流场配色"
          aria-label={`流场配色：${palette.name}，点击切换下一套`}
          onClick={() => apiRef.current?.next()}
        >
          <i style={palette.dot ? `background:${palette.dot}` : undefined} />
          {palette.name}
        </button>,
        anchor
      )}
    </>
  );
}
