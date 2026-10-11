// BrandFilings.jsx —— 「DoraStudio」铁屑字样（2026-10-12 新增）
// ------------------------------------------------------------------
// 来源：站长给的模板 /mnt/e/documents/111/LUMEN · 光之工作室112.html 里的「A4 磁场铁屑」。
//
// 模板原版是**铺满整个方框**的：在 20px 的网格上每个点画一根朝向磁极的小线段，
// 越近越长越亮，指针离开后磁极自己绕圈游走。
// 用户对这一块的明确要求是：「不要打满，里面就还是要描绘出 DoraStudio 的这个品牌」。
//
// 所以这里做了一处关键改造：**先用离屏 canvas 把品牌字画出来取字形遮罩**，
// 只保留落在字形上（以及字形外 1~2 格毛边）的网格点：
//   · 字形内部的点 —— 线段长、亮，这是「字」的主体；
//   · 字形边缘外的点 —— 线段短、暗，形成一圈毛边，让字有体积感；
//   · 其余位置**一个点都不画**，留白。
// 整体观感就是「一团铁屑拼出的 DoraStudio」。
//
// 为什么铁屑不会把字打散（这是最容易翻车的地方）：
//   每个点除了「朝向磁极」还带一个**回正方向**（字形法线：内部点朝外、毛边点朝内），
//   线段朝向 = 法线方向 与 磁极方向 的插值，权重随「离磁极的距离」衰减；
//   再给权重封顶（内部 0.85 / 毛边 0.5），指针再近也不会把整根线拧成磁极方向。
//   指针不在时磁极自己游走，但幅度只有模板的一半，且权重再乘 0.85。
//
// 颜色：模板写死 hsla(190+k*140,…)，这里改成从主题变量 --primary / --text 派生 ——
//   三套主题（纯净 / 素雅 / 天青）切换后铁屑跟着变色；每 10 秒重读一次兜底。
//   远处偏 --text（压住轮廓、浅色主题下也看得清），近磁极处偏 --primary（磁性发光感）。
//
// 性能：单个 rAF、命令式画 canvas、每帧零 setState；
//   IntersectionObserver 离屏暂停、document.hidden 暂停、devicePixelRatio 上限 2；
//   prefers-reduced-motion 只画一帧静止的（磁极在中心），不开 rAF。
//
// 依赖：零依赖（Preact + 原生 canvas），不引任何动画库 —— 模板用的 gsap 在本仓库不允许安装。
import { useEffect, useRef } from 'preact/hooks';

const STYLE_ID = 'brand-filings-css';

const CSS = `
.bf {
  position: relative;
  width: 100%;
  overflow: hidden;
  /* 容器本身透明：它会被放进首页的 bento 卡片里，卡片自带底色 */
  background: transparent;
}
.bf-cv {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
`;

let cssInjected = false;
function useBrandCss() {
  useEffect(() => {
    if (cssInjected || typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) { cssInjected = true; return; }
    cssInjected = true;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}

/* ============================================================
   一、纯函数（不碰 DOM，可单独 import 做边界断言）
   ============================================================ */

// 把 CSS 颜色（#rgb / #rrggbb / rgb() / rgba()）解析成 [r,g,b]；认不出来返回 null。
export function parseColor(value) {
  const v = String(value || '').trim();
  if (!v) return null;
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const s = hex[1];
    if (s.length === 3) {
      return [0, 1, 2].map((i) => parseInt(s[i] + s[i], 16));
    }
    return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(v);
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3)
      .map((x) => Math.max(0, Math.min(255, Math.round(parseFloat(x)))));
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) return parts;
  }
  return null;
}

// 两个 rgb 之间线性插值，t=0 取 a、t=1 取 b
export function mixRgb(a, b, t) {
  const k = Math.max(0, Math.min(1, Number(t) || 0));
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * k));
}

// 把 [-π, π] 之外的夹角折回来（否则跨过 ±π 会算出一整圈的假跳变）
function shortestAngle(d) {
  let x = d;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

/**
 * 按网格采样字形遮罩，挑出「该画铁屑」的点。
 *
 * inside(x, y) 由调用方给出（落在字形像素上返回 true）。
 * 返回：
 *   inside —— 字形内部的点（铁屑主体）
 *   edge   —— 字形外、但离内部点不超过 edgeCells 格的点（毛边）
 *   all    —— 全部网格点（用于兜底 / 统计）
 *
 * 边界：width / height ≤ 0、step ≤ 0 时返回空数组，不抛异常。
 */
export function buildFilings({ width, height, step = 20, edgeCells = 2, inside = () => false }) {
  const W = Number(width) || 0;
  const H = Number(height) || 0;
  const s = Number(step) > 0 ? Number(step) : 20;
  if (W <= 0 || H <= 0) return { inside: [], edge: [], all: [] };

  const all = [];
  for (let y = s / 2; y < H; y += s) {
    for (let x = s / 2; x < W; x += s) {
      all.push({ x, y, inside: !!inside(x, y) });
    }
  }
  const inPts = all.filter((p) => p.inside);
  if (!inPts.length) return { inside: [], edge: [], all };

  const R = s * Math.max(1, Number(edgeCells) || 1);
  const edge = [];
  for (const p of all) {
    if (p.inside) continue;
    // 只要「周围 R 格内有内部点」就算毛边。用方形邻域而不是欧氏距离：
    // 20px 的格子上两者观感没有差别，但省掉了每次 sqrt。
    let near = false;
    for (const q of inPts) {
      if (Math.abs(q.x - p.x) <= R && Math.abs(q.y - p.y) <= R) { near = true; break; }
    }
    if (near) edge.push(p);
  }
  return { inside: inPts, edge, all };
}

/**
 * 覆盖率分类（组件实际走的那条路，比 buildFilings 的布尔采样准得多）。
 *
 * 为什么不能只用一个布尔 inside(x,y)：网格间距（十几像素）和笔画宽度（也才十几像素）
 * 是同一量级，单个像素的采样经常**正好落在笔画外面**，于是「字」只剩零星几个点，
 * 而毛边条件（离字形 1~2 格）又几乎把整块都算进去 —— 实测画出来就是一片均匀的铁屑，
 * 完全读不出字形。
 *
 * 正确做法是先做一次盒式降采样，得到每个网格单元的**字形覆盖率** cov(0~1)，再分档：
 *   cov ≥ insideMin  → 主体（笔画中心，长而亮）
 *   cov ≥ edgeMin    → 毛边（笔画边缘，短而暗）
 *   其余             → 不画（留白）
 * 覆盖率天然带一点抗锯齿，笔画的粗细、拐角、字母的闭合腔都能保住。
 *
 * 返回的每个点带 cov 字段（0~1），组件用它决定线段长度。
 */
export function classifyCells({
  cols, rows, step, cov, insideMin = 0.34, edgeMin = 0.08
}) {
  const C = Math.max(0, Math.floor(Number(cols) || 0));
  const R = Math.max(0, Math.floor(Number(rows) || 0));
  const s = Number(step) > 0 ? Number(step) : 20;
  const data = cov && cov.length >= C * R ? cov : null;
  if (!C || !R || !data) return { inside: [], edge: [], all: [], cols: C, rows: R, step: s };

  const at = (c, r) => (c < 0 || r < 0 || c >= C || r >= R ? 0 : data[r * C + c]);
  const inside = [];
  const edge = [];
  const all = [];

  for (let r = 0; r < R; r += 1) {
    for (let c = 0; c < C; c += 1) {
      const v = at(c, r);
      if (v < edgeMin) continue;
      const p = { x: c * s + s / 2, y: r * s + s / 2, cov: v, inside: v >= insideMin };
      all.push(p);
      if (p.inside) inside.push(p); else edge.push(p);
    }
  }

  // 笔画特别细时可能一个格子都到不了 insideMin，那就退而求其次：
  // 取覆盖率最高的那批格子当主体，至少保证「有字」而不是一片毛边。
  if (!inside.length && all.length) {
    const sorted = [...all].sort((a, b) => b.cov - a.cov);
    const keep = Math.max(1, Math.round(sorted.length * 0.45));
    const top = new Set(sorted.slice(0, keep));
    for (const p of all) {
      if (top.has(p)) { p.inside = true; inside.push(p); }
    }
    for (let i = edge.length - 1; i >= 0; i -= 1) {
      if (edge[i].inside) edge.splice(i, 1);
    }
  }
  return { inside, edge, all, cols: C, rows: R, step: s };
}

/**
 * 给每个点算「回正方向」——**笔画的切向**，就地写 p.nx / p.ny / p.hasN。
 *
 * 为什么是切向而不是法线（这是本组件最关键的取舍，实测改过三版）：
 *   · 法线版（线段垂直于笔画）：横笔画上的铁屑全是竖线，一根根并排扎在笔画上，
 *     远看像一排毛刷，笔画的「横」完全读不出来 —— 字是散的。
 *   · 切向版（线段顺着笔画）：横笔画上的铁屑是横线、竖笔画上是竖线，
 *     相邻格子的线自然接成一条，**笔画本身就是铁屑连成的**，字形一眼可辨。
 *   铁屑在磁场里本来就是顺着场线排的，切向也更符合这个意象。
 *
 * 怎么求切向：对每个格子取 5×5 邻域的覆盖率做**结构张量**（局部 PCA），
 * 最小特征值对应的特征向量就是笔画走向。这个方法对「粗笔画正中」同样有效 ——
 * 而梯度法在笔画正中梯度恒为 0，只能退化成指向磁极的放射状（字会看着是空的）。
 *
 * 梯度为 0 且邻域退化的格子（例如整块都是 1）标记 hasN=false，
 * 由调用方退回「指向磁极」。
 */
export function restDirectionsFromCoverage(points = [], { cols, rows, cov, step, radius = 2 }) {
  const C = Math.max(0, Math.floor(Number(cols) || 0));
  const R = Math.max(0, Math.floor(Number(rows) || 0));
  const data = cov && cov.length >= C * R ? cov : null;
  const at = (c, r) => (c < 0 || r < 0 || c >= C || r >= R ? 0 : data[r * C + c]);
  const rad = Math.max(1, Math.floor(Number(radius) || 2));

  for (const p of points) {
    if (!data) { p.nx = 0; p.ny = 0; p.hasN = false; continue; }
    // ⚠ 步长必须显式传进来：不能读 p.step —— classifyCells 产出的点还没写这个字段，
    //    退回 1 会让 x/1 直接越界，整片法线全变 0（这是实测踩过的坑）。
    const s = Number(step) > 0 ? Number(step) : (Number(p.step) > 0 ? Number(p.step) : 1);
    const c = Math.floor(p.x / s);
    const r = Math.floor(p.y / s);

    // 结构张量：对邻域内每个有覆盖的格子，累加它的偏移方向的外积。
    //   J = Σ w · [dx², dxdy; dxdy, dy²]
    // 沿笔画方向铺开的点最多，所以笔画方向是 J 的主特征向量；
    // 切向 = 主特征向量，法向 = 次特征向量。
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    for (let dr = -rad; dr <= rad; dr += 1) {
      for (let dc = -rad; dc <= rad; dc += 1) {
        if (!dc && !dr) continue;
        const w = at(c + dc, r + dr);
        if (w <= 0) continue;
        sxx += w * dc * dc;
        sxy += w * dc * dr;
        syy += w * dr * dr;
      }
    }
    if (sxx + sxy + syy < 1e-9) { p.nx = 0; p.ny = 0; p.hasN = false; continue; }

    // 2×2 对称阵的主方向（最大特征值对应的特征向量）有闭式解：
    //   θ = ½·atan2(2·sxy, sxx − syy)，主方向 = (cosθ, sinθ)
    // 邻域沿笔画铺开时 sxx 最大（横笔画）或 syy 最大（竖笔画），主方向恰好就是笔画切向。
    // ⚠ 这里**不能**再转 90° —— 转过就变成法线了，铁屑会一根根垂直于笔画并排扎着，
    //   远看像一排毛刷，笔画的走向完全读不出来（第一版就是这个错，字是散的）。
    //
    // 退化情形：粗笔画**正中**的邻域被笔画填满，各方向一样多 → 张量各向同性
    // （sxx≈syy 且 sxy≈0），主方向会随机落到水平或竖直。这时改用梯度求法线再转 90°：
    // 张量各向同性的地方梯度往往也接近 0，所以再往外扩一圈窗口找梯度。
    // 不处理这个退化，笔画正中会取到错误方向、整根笔画只剩两侧描边 ——
    // 画出来是一圈圈「等高线」，笔画是空心的（实测就是这个观感）。
    const iso = Math.abs(sxx - syy) < 1e-6 && Math.abs(sxy) < 1e-6;
    if (iso) {
      let gx = 0;
      let gy = 0;
      for (let k = 1; k <= rad + 2; k += 1) {
        gx = at(c - k, r) - at(c + k, r);
        gy = at(c, r - k) - at(c, r + k);
        if (Math.hypot(gx, gy) > 1e-6) break;
      }
      const gl = Math.hypot(gx, gy);
      if (gl < 1e-6) { p.nx = 0; p.ny = 0; p.hasN = false; continue; }
      // 梯度是法线方向，转 90° 得到切向
      const nx = gx / gl;
      const ny = gy / gl;
      p.nx = -ny;
      p.ny = nx;
      p.hasN = true;
      continue;
    }
    const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const tx = Math.cos(theta);
    const ty = Math.sin(theta);
    const len = Math.hypot(tx, ty);
    if (len < 1e-9) { p.nx = 0; p.ny = 0; p.hasN = false; continue; }
    // 统一下朝向：让切向的 y 分量非负（笔画走向不区分正反），避免相邻格子
    // 各指一头、连不成线。
    const sign = ty < 0 ? -1 : 1;
    p.nx = (tx / len) * sign;
    p.ny = (ty / len) * sign;
    p.hasN = true;
  }
  return points;
}

// 兼容旧名字（本组件内部只调用上面这个）
export const normalsFromCoverage = restDirectionsFromCoverage;

/**
 * 给每个铁屑点算「回正方向」（单位向量），就地写在 p.nx / p.ny / p.hasN 上。
 *
 *   · 字形内部的点 → 指向**最近的毛边点**（近似朝外的法线）；
 *   · 毛边点       → 指向**最近的内部点**（朝内的法线，让毛边贴住轮廓）。
 *
 * 没有毛边点（例如遮罩把整块铺满）时全部标记 hasN=false，调用方退化成纯磁性朝向。
 */
export function computeNormals(insidePts = [], edgePts = []) {
  const near = (from, list) => {
    let best = null;
    let bestD = Infinity;
    for (const q of list) {
      const dx = q.x - from.x;
      const dy = q.y - from.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = q; }
    }
    return best;
  };

  for (const p of insidePts) {
    const q = edgePts.length ? near(p, edgePts) : null;
    if (q) {
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      p.nx = dx / len; p.ny = dy / len; p.hasN = true;
    } else {
      p.nx = 0; p.ny = 0; p.hasN = false;
    }
  }
  for (const p of edgePts) {
    const q = insidePts.length ? near(p, insidePts) : null;
    if (q) {
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      p.nx = dx / len; p.ny = dy / len; p.hasN = true;
    } else {
      p.nx = 0; p.ny = 0; p.hasN = false;
    }
  }
  return { insidePts, edgePts };
}

/**
 * 生成「颜色 × 透明度」查表。
 * 颜色从远处（偏 --text，压住轮廓）渐变到磁极处（--primary）。
 * 每帧要给几百根线设 strokeStyle，直接拼字符串会产生大量临时对象，
 * 所以预先拼好 COLORS × ALPHAS 个字符串，画的时候只做两次数组下标。
 */
export const PALETTE_STEPS = 16;
export const ALPHA_STEPS = 16;

export function buildPalette(primary, ink) {
  const p = primary || [74, 108, 247];
  const t = ink || [16, 19, 26];
  const base = mixRgb(t, p, 0.5);   // 远端：字色与主色对半，暗一点、贴轮廓
  const out = [];
  for (let i = 0; i < PALETTE_STEPS; i += 1) {
    const rgb = mixRgb(base, p, i / (PALETTE_STEPS - 1));
    const row = [];
    for (let j = 0; j < ALPHA_STEPS; j += 1) {
      row.push(`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(j / (ALPHA_STEPS - 1)).toFixed(3)})`);
    }
    out.push(row);
  }
  return out;
}

// 0~1 的权重 → 颜色查表下标
function colorIndex(k) {
  return Math.max(0, Math.min(PALETTE_STEPS - 1, Math.round(k * (PALETTE_STEPS - 1))));
}

// 0~1 的透明度 → 透明度查表下标（真正用到的区间是 0.12~0.95）
function alphaIndex(a) {
  const v = Math.max(0, Math.min(1, a));
  return Math.max(0, Math.min(ALPHA_STEPS - 1, Math.round(v * (ALPHA_STEPS - 1))));
}

/* ============================================================
   二、组件
   ============================================================ */

// 取字体栈：站点的 --font-ui（Satoshi + 中文兜底）。
// ⚠ 中文绝不能落到等宽字体栈上（会回退成点阵宋体），所以这里只读 --font-ui。
function readFontStack() {
  if (typeof document === 'undefined') return 'system-ui, sans-serif';
  const v = getComputedStyle(document.documentElement).getPropertyValue('--font-ui');
  return (v || '').trim() || 'system-ui, sans-serif';
}

// 「100px 时这行字有多宽 / 100」——用来反推「正好铺满容器」的字号。
//
// 为什么用隐藏 span 而不是 canvas.measureText：canvas 的 font 只有等它自己去解析
// 字体栈时才生效，字体没加载完量到的是兜底字体的宽度，反推出来的字号会明显偏差。
// 走 DOM 量的是**真正要用的那套字体栈**，和后面 fillText 的结果一致。
// 量完立刻移除，不会在页面上留下节点，也不会触发可见的重排（position:absolute + hidden）。
function measureRatio(text, stack) {
  const fallback = () => {
    const cv = document.createElement('canvas');
    const c = cv.getContext('2d');
    if (!c) return 5.4;   // 「DoraStudio」10 字符的粗略比例，只用于兜底
    c.font = `700 100px ${stack}`;
    const w = c.measureText(text).width;
    return w > 0 ? w / 100 : 5.4;
  };
  try {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;'
      + `font:700 100px ${stack};white-space:nowrap`;
    probe.textContent = text;
    document.body.appendChild(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    if (w > 0) return w / 100;
  } catch (e) { /* 落到 canvas 兜底 */ }
  return fallback();
}

function prefersReduced() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return !!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function BrandFilings({ text = 'DoraStudio', height = 400, ariaLabel = 'DoraStudio 铁屑字样' }) {
  useBrandCss();
  const boxRef = useRef(null);
  const cvRef = useRef(null);

  useEffect(() => {
    const box = boxRef.current;
    const cv = cvRef.current;
    if (!box || !cv || typeof document === 'undefined') return undefined;
    const ctx = cv.getContext('2d');
    if (!ctx) return undefined;

    let alive = true;
    let raf = 0;
    let running = false;
    let visible = true;
    let palette = buildPalette(null, null);
    let scene = null;          // 每次重建的几何数据（网格点 + 尺寸）
    let lastW = 0;
    let lastH = 0;
    let resizeTimer = 0;

    // 磁极：指针不在时自己游走；用 sx/sy 做一次缓动，避免指针事件稀疏时抖动
    const pole = { x: 0, y: 0, sx: 0, sy: 0, on: false };

    const reduce = prefersReduced();

    // ---- 主题色：初始化 + 10s 兜底轮询 + 主题属性变化立刻重读 ----
    const refreshPalette = () => {
      const cs = getComputedStyle(document.documentElement);
      const primary = parseColor(cs.getPropertyValue('--primary')) || [74, 108, 247];
      const ink = parseColor(cs.getPropertyValue('--text')) || [16, 19, 26];
      palette = buildPalette(primary, ink);
    };
    refreshPalette();
    const themeTimer = window.setInterval(refreshPalette, 10000);
    let themeObserver = null;
    if (typeof MutationObserver === 'function') {
      themeObserver = new MutationObserver(refreshPalette);
      themeObserver.observe(document.documentElement, {
        attributes: true, attributeFilter: ['class', 'data-theme', 'style']
      });
    }

    // ---- 重建几何：读尺寸 → 渲染字形遮罩 → 覆盖率分档 → 算梯度法线 ----
    const build = () => {
      const W = Math.round(box.clientWidth || 0);
      const H = Math.round(box.clientHeight || 0);
      if (W <= 0 || H <= 0) { scene = null; return false; }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      // 用 CSS 像素坐标系作画：setTransform 把 dpr 折进去，后面所有坐标都是 CSS px
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      lastW = W; lastH = H;

      // 先用 100px 量一次字宽，反推字号（铺满 90% 宽、不超过 70% 高）。
      // 为什么要先算字号：网格步长必须**相对笔画宽度**定，而不是相对容器大小 ——
      // 笔画只有一格宽时铁屑连不成线，字就读不出来（这是实测踩过的坑）。
      const stack = readFontStack();
      const ratio = measureRatio(text, stack);
      let fs = Math.min((W * 0.9) / ratio, H * 0.7);
      fs = Math.max(20, fs);

      // 粗体无衬线的笔画宽度约为字号的 0.13。
      // 让一个笔画横跨约 3 格（step = 笔画宽/3）：2 格时笔画正中只剩一列格子，
      // 结构张量的 3×3 邻域会跨到笔画外面，主方向变成「沿轮廓」，
      // 画出来是一圈圈等高线而不是实心笔画（实测过 2 格，字是空心的）。
      const strokeW = fs * 0.13;
      const step = Math.max(6, Math.min(20, Math.round(strokeW / 3)));
      const cols = Math.max(1, Math.floor(W / step));
      const rows = Math.max(1, Math.floor(H / step));

      // 字形遮罩：离屏 canvas 只用于采样，**不挂到 DOM 上**。
      // 先把字画成纯白像素，再按网格做盒式降采样得到覆盖率场。
      let cov = null;
      try {
        const off = document.createElement('canvas');
        off.width = W;
        off.height = H;
        const octx = off.getContext('2d', { willReadFrequently: true });
        if (octx) {
          octx.font = `700 ${fs}px ${stack}`;
          octx.textAlign = 'center';
          octx.textBaseline = 'middle';
          octx.fillStyle = '#fff';
          octx.fillText(text, W / 2, H / 2);

          const img = octx.getImageData(0, 0, W, H).data;
          cov = new Float32Array(cols * rows);
          for (let r = 0; r < rows; r += 1) {
            for (let c = 0; c < cols; c += 1) {
              const x0 = c * step;
              const y0 = r * step;
              let sum = 0;
              let n = 0;
              // 单元内按 3×3 采样覆盖率；步长至少 1px，避免小格重复取同一像素
              const dx = Math.max(1, Math.floor(step / 3));
              for (let yy = y0; yy < Math.min(y0 + step, H); yy += dx) {
                for (let xx = x0; xx < Math.min(x0 + step, W); xx += dx) {
                  sum += img[(yy * W + xx) * 4 + 3] > 110 ? 1 : 0;
                  n += 1;
                }
              }
              cov[r * cols + c] = n ? sum / n : 0;
            }
          }
        }
      } catch (e) {
        // 某些环境下 getImageData 会被跨域 / 隐私设置挡住；不抛异常，走几何兜底
        cov = null;
      }

      let picked;
      if (cov) {
        picked = classifyCells({ cols, rows, step, cov });
        restDirectionsFromCoverage(picked.all, { cols, rows, cov, step, radius: 1 });
      } else {
        // 兜底：采样失败时用一个椭圆当字形，退化成「一团纯几何的铁屑场」（不拼字）
        const inside = (x, y) => {
          const dx = (x - W / 2) / (W * 0.46);
          const dy = (y - H / 2) / (H * 0.46);
          return dx * dx + dy * dy <= 1;
        };
        picked = buildFilings({ width: W, height: H, step, edgeCells: 1, inside });
        computeNormals(picked.inside, picked.edge);
      }

      const list = picked.all && picked.all.length
        ? [...picked.all]
        : [...picked.inside, ...picked.edge];
      for (const p of list) { if (p.step === undefined) p.step = step; }
      // 每根线一个固定相位，让抖动不同步；否则整片铁屑会像一块板子一起晃
      // 同时给每根线一个**固定的**角度/位置扰动（用确定性伪随机，同一根线每帧一致）：
      // 不加这个，同一笔画里几列格子的线会平行得像等高线；加上之后才像「一把铁屑」。
      for (let i = 0; i < list.length; i += 1) {
        const p = list[i];
        p.ph = i * 0.37;
        // 两个独立的确定性伪随机数（不用 Math.random，保证重绘/尺寸不变时观感稳定）
        // frac() 而不是 `% 1`：JS 对负数取模仍是负数，直接用会得到偏到一边的分布。
        const frac = (v) => v - Math.floor(v);
        p.jit = (frac(Math.sin(i * 12.9898) * 43758.5453) - 0.5) * 0.44;  // 角度 ±0.22 rad
        p.ox = (frac(Math.sin(i * 78.233) * 12345.6789) - 0.5) * 0.5;    // 横向 ±0.25 格
        p.oy = (frac(Math.sin(i * 39.425) * 24634.6345) - 0.5) * 0.5;    // 纵向 ±0.25 格
      }

      scene = { W, H, step, list, insideCount: picked.inside.length, edgeCount: picked.edge.length };
      pole.x = pole.sx = W / 2;
      pole.y = pole.sy = H * 0.46;
      return true;
    };

    // ---- 画一帧 ----
    const draw = (t) => {
      if (!scene) return;
      const { W, H, list } = scene;
      ctx.clearRect(0, 0, W, H);
      if (!list.length) return;

      const hover = pole.on && !reduce;
      // 磁极目标：指针在就跟着指针，不在就沿一条缓慢轨迹自己走
      // （幅度只有模板的一半：太大会把字打散）
      const tx = pole.on ? pole.x : W / 2 + Math.cos(t * 0.55) * W * 0.15;
      const ty = pole.on ? pole.y : H * 0.46 + Math.sin(t * 0.78) * H * 0.11;
      // 缓动系数 0.12：指针停下后磁极还会「滑」一小段，比硬跟手更有机
      pole.sx += (tx - pole.sx) * 0.12;
      pole.sy += (ty - pole.sy) * 0.12;

      // 影响半径：对角线的一半，保证四个角也能被磁极拉到一点
      const D = Math.hypot(W, H) * 0.5;
      const boost = hover ? 1.3 : 1;

      ctx.lineCap = 'round';
      ctx.lineWidth = 1.6;
      for (const p of list) {
        const dx = pole.sx - p.x;
        const dy = pole.sy - p.y;
        const d = Math.hypot(dx, dy) || 1e-6;
        const k = Math.max(0, 1 - d / D);
        // 磁极影响用平方衰减：只有磁极近旁的一小撮铁屑被明显拧动，
        // 整片远处的铁屑保持笔画切向 —— 字形因此始终清晰，
        // 同时近处仍有「磁场正在拨动铁屑」的放射感（线性衰减时整屏都会跟着歪）。
        const kk = k * k;
        const poleA = Math.atan2(dy, dx);
        const restA = p.hasN ? Math.atan2(p.ny, p.nx) : poleA;

        // restA 现在是**笔画切向**。铁屑默认顺着笔画躺，磁极把附近的一小撮拧过来。
        // 权重上限压得很低：主体 0.30 / 毛边 0.22 —— 铁屑的意义是「被磁力轻轻拨动」，
        // 一旦磁极方向占主导，笔画就被拧成放射状、字立刻散掉（实测 0.85 时最明显）。
        let w = kk * (p.inside ? 0.62 : 0.42);
        // 自动游走（指针不在）时再收敛一档：这时没人互动，唯一任务是把字摆稳
        if (!hover) w *= 0.4;
        const a = restA + p.jit + shortestAngle(poleA - restA) * w
          + Math.sin(t * 1.2 + p.ph) * (hover ? 0.07 : 0.035);

        // 长度按网格间距算：主体略长于一格，让相邻格子的线首尾搭上、连成笔画；
        // 毛边只有半格左右，保持「一颗一颗铁屑」的颗粒感。
        const step = scene.step;
        const covK = p.cov === undefined ? (p.inside ? 1 : 0.4) : Math.max(0.35, Math.min(1, p.cov));
        const len = (p.inside ? step * (1.0 + k * 0.5) : step * (0.36 + k * 0.36))
          * boost * covK;
        const half = len / 2;
        // 位置扰动：整根线沿固定偏移量挪一点（仍然是确定的，不会每帧乱跳）
        const px = p.x + p.ox * step;
        const py = p.y + p.oy * step;
        const cx = Math.cos(a) * half;
        const cy = Math.sin(a) * half;

        const alpha = (p.inside ? 0.42 + k * 0.55 : 0.2 + k * 0.4) * (hover ? 1.1 : 1);
        ctx.strokeStyle = palette[colorIndex(k)][alphaIndex(alpha)];
        ctx.beginPath();
        ctx.moveTo(px - cx, py - cy);
        ctx.lineTo(px + cx, py + cy);
        ctx.stroke();
      }
    };

    // ---- 主循环（单个 rAF；离屏 / 后台标签页都不跑）----
    const t0 = performance.now();
    const loop = () => {
      raf = 0;
      if (!running) return;
      draw((performance.now() - t0) / 1000);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running || reduce) return;
      running = true;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    };

    // ---- 指针 ----
    const onMove = (e) => {
      const r = box.getBoundingClientRect();
      if (!r.width || !r.height) return;
      pole.x = e.clientX - r.left;
      pole.y = e.clientY - r.top;
      pole.on = true;
    };
    const onLeave = () => { pole.on = false; };
    box.addEventListener('pointermove', onMove, { passive: true });
    box.addEventListener('pointerleave', onLeave);
    box.addEventListener('pointercancel', onLeave);

    // ---- 可见性 / 尺寸 ----
    let io = null;
    if (typeof IntersectionObserver === 'function') {
      io = new IntersectionObserver((es) => {
        visible = !!es[0].isIntersecting;
        if (visible && !document.hidden) start(); else stop();
      }, { threshold: 0.05 });
      io.observe(box);
    }

    const onVisibility = () => {
      if (document.hidden) stop();
      else if (visible) start();
    };
    document.addEventListener('visibilitychange', onVisibility);

    let ro = null;
    const onResize = () => {
      // 尺寸变化要重采样字形 + 重算最近邻，代价不小，所以防抖 160ms；
      // 抖动小于 8px 直接忽略（滚动条出现/消失常引起 1~2px 抖动）。
      if (Math.abs((box.clientWidth || 0) - lastW) < 8
        && Math.abs((box.clientHeight || 0) - lastH) < 8) return;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = 0;
        if (!alive) return;
        if (build()) {
          if (reduce) draw(0); else if (visible && !document.hidden) start();
        }
      }, 160);
    };
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(onResize);
      ro.observe(box);
    } else {
      window.addEventListener('resize', onResize);
    }

    // ---- 启动：等字体就绪再采样，否则量到的是兜底字体的字宽 ----
    let started = false;
    const begin = () => {
      if (!alive || started) return;
      started = true;
      if (!build()) return;
      if (reduce) { draw(0); return; }   // 减少动态效果：只画一帧静止的
      start();
    };
    if (typeof document.fonts !== 'undefined' && document.fonts && document.fonts.ready) {
      Promise.resolve(document.fonts.ready).then(begin).catch(begin);
    } else {
      begin();
    }

    return () => {
      alive = false;
      stop();
      if (resizeTimer) clearTimeout(resizeTimer);
      clearInterval(themeTimer);
      if (themeObserver) themeObserver.disconnect();
      if (io) io.disconnect();
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      box.removeEventListener('pointermove', onMove);
      box.removeEventListener('pointerleave', onLeave);
      box.removeEventListener('pointercancel', onLeave);
      scene = null;
    };
  }, [text, height]);

  return (
    <div
      class="bf"
      ref={boxRef}
      role="img"
      aria-label={ariaLabel}
      style={{ height: `${Math.max(120, Number(height) || 400)}px` }}
    >
      <canvas class="bf-cv" ref={cvRef} aria-hidden="true" />
    </div>
  );
}

export default BrandFilings;
