// PixelFlip.jsx —— 像素翻牌图（首页「站点构成」用）
//
// 来源：站长给的模板 /mnt/e/documents/111/LUMEN · 光之工作室112.html 里的「A5 像素翻牌」。
// 模板原版是纯装饰：固定 90 个方块，颜色写死 hsl()，鼠标扫过时方块先缩小旋转 90° 再弹回。
//
// 这里把它改造成**数据驱动**：
//   · 方块总数 = 列数 × 9 行（列数按容器宽度自适应，宽屏 12 列、窄屏 6 列）；
//   · 「一个方块 = 一份」，按各分组 value 的占比用**最大余数法**分配方块，
//     保证「各方块数之和 == 总格数」——不会出现加起来差一个的观感 bug；
//   · 方块颜色来自 group.color（与主题背景做一点 color-mix，避免和背景撞色）；
//   · 图例在图下方一行，悬停方块时对应分组高亮。
//
// 为什么不用 gsap：
//   模板用 gsap 的 keyframes 做「缩小旋转 → elastic 弹回」。仓库不允许装依赖，
//   所以这里用 CSS @keyframes 手写等价两段（每段各自的 timing-function 近似 elastic.out）。
//
// 动效策略：
//   · 整块进入视口后才播一次对角线错峰入场（IntersectionObserver，只播一次）；
//   · 指针设备：指针移动时，距离 < 120px 的方块触发一次翻牌，延迟 = 距离 × 0.003s，
//     形成由近及远的波纹；用 dataset.busy 防止同一个方块在动画期间被重复触发；
//   · 触屏（无 hover）：只播入场动画，不做指针交互；
//   · prefers-reduced-motion：全部动画关闭，直接终态。
//
// 性能取舍：
//   指针移动时**不 setState**（90~108 个方块，每帧重渲染 VDOM 不划算），
//   全部走事件监听 + 直接改 class；方块中心点在容器尺寸变化时缓存一次，
//   避免每次 pointermove 都读上百次布局。
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ============================================================
   一、纯函数（可在 Node 里单独 import 测边界）
   ============================================================ */

// 缺省色板：分组没给 color 时依次取用。刻意避开纯灰，保证在浅色主题上也能看清。
export const PXF_COLORS = [
  '#2f6bff', '#00b894', '#ff7a1a', '#e8397a', '#8b5cf6', '#0fb9b1',
  '#f2b705', '#ef476f', '#3a86ff', '#06d6a0', '#c77dff', '#ff6b35'
];

// 行数固定 9（对齐模板的「10 列 × 9 行 = 90 格」观感），列数按宽度自适应。
export const PXF_ROWS = 9;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clamp(v, lo, hi) {
  const n = num(v);
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

// 数值缩写：1234 → 1.2K。图例里不占地方。
export function fmtNum(v) {
  const n = num(v);
  const abs = Math.abs(n);
  if (abs >= 1e8) return `${(n / 1e8).toFixed(1)}亿`;
  if (abs >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
  if (abs >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * 最大余数法：把 total 个方块按 groups[].value 的占比切成整数份。
 *
 * 返回数组与**入参 groups 下标一一对应**（value 为 0 / null / NaN 的分组得 0），
 * 并且保证「返回值之和 == total」（只要 total > 0 且 groups 非空）。
 *
 * 边界处理（这些情况都不能抛异常、不能产出 NaN）：
 *   · groups 非数组 / 空数组 / total <= 0      → 全 0
 *   · value 为 null / undefined / NaN / 负数   → 当 0 处理
 *   · 所有 value 都为 0                        → 按「均分」分配（仍保证和 == total），
 *     这样调用方拿到的永远是一份合法布局；要不要显示空态由组件自己判断。
 *   · 浮点误差导致名额算多了（理论上极罕见）   → 从当前最多的分组里扣回来
 */
export function apportion(total, groups) {
  const list = Array.isArray(groups) ? groups : [];
  const n = list.length;
  const out = new Array(n).fill(0);
  const target = Math.max(0, Math.floor(num(total)));
  if (!n || target <= 0) return out;

  const raw = list.map((g) => Math.max(0, num(g && g.value)));
  const sum = raw.reduce((a, b) => a + b, 0);
  // 全 0 时退化成均分：权重全给 1，避免出现「除数为 0」而算出 NaN。
  const weights = sum > 0 ? raw : list.map(() => 1);
  const wsum = weights.reduce((a, b) => a + b, 0);
  if (!(wsum > 0)) return out;

  const exact = weights.map((w) => (w / wsum) * target);
  let used = 0;
  for (let i = 0; i < n; i += 1) {
    out[i] = Math.floor(exact[i]);
    used += out[i];
  }

  let rest = target - used;
  if (rest > 0) {
    // 余下名额按小数部分从大到小补给；同分按原顺序，保证结果稳定可复现。
    const order = exact
      .map((v, i) => ({ frac: v - Math.floor(v), i }))
      .sort((a, b) => b.frac - a.frac || a.i - b.i);
    for (let k = 0; k < order.length && rest > 0; k += 1) {
      out[order[k].i] += 1;
      rest -= 1;
    }
  } else if (rest < 0) {
    // 浮点误差导致的溢出：从最多的分组里扣，绝不留下「和 != target」的结果。
    while (rest < 0) {
      let maxI = 0;
      for (let i = 1; i < n; i += 1) if (out[i] > out[maxI]) maxI = i;
      if (out[maxI] <= 0) break;
      out[maxI] -= 1;
      rest += 1;
    }
  }
  return out;
}

// 归一化分组：label / color / value 都补齐，value 保证是 >= 0 的有限数。
export function normalizeGroups(groups) {
  const list = Array.isArray(groups) ? groups : [];
  return list
    .filter(Boolean)
    .map((g, i) => ({
      label: String(g.label == null || g.label === '' ? '未命名' : g.label),
      value: Math.max(0, num(g.value)),
      color: g.color || PXF_COLORS[i % PXF_COLORS.length]
    }));
}

// 列数自适应：宽屏 12 列、桌面 10 列、平板 8 列、手机 6 列。
// 对齐模板的 10 列观感，同时保证窄屏不会把方块压成一条线。
export function columnsFor(width) {
  const w = num(width);
  if (w >= 900) return 12;
  if (w >= 640) return 10;
  if (w >= 440) return 8;
  return 6;
}

/* ============================================================
   二、样式（自注入，固定 id，避免和已有 #px / .px 冲突）
   ============================================================ */

const CSS = `
.pxf-box{position:relative;width:100%;display:flex;flex-direction:column;gap:10px}
.pxf-stage{position:relative;width:100%;border-radius:var(--radius-sm,10px);overflow:hidden;
  background:color-mix(in srgb,var(--bg-subtle) 60%,transparent);border:1px solid var(--border)}
.pxf-grid{position:absolute;inset:0;display:grid;gap:4px;padding:12px;
  grid-template-columns:repeat(var(--pxf-cols,10),1fr);
  grid-template-rows:repeat(var(--pxf-rows,9),1fr)}
.pxf-cell{position:relative;border-radius:6px;transform-origin:50% 50%;will-change:transform;
  background:var(--pxf-fill,color-mix(in srgb,var(--text) 14%,transparent))}

/* 入场：对角线错峰弹入。--pxf-d 由 (col+row)*0.02 算出 */
.pxf-grid.is-live .pxf-cell{animation:pxf-in .5s cubic-bezier(.2,1.4,.35,1) both;
  animation-delay:calc(var(--pxf-d,0) * 1s)}
/* 入场播完后锁死动画名，否则翻牌结束会重放一次入场波纹 */
.pxf-grid.is-settled .pxf-cell:not(.is-flip){animation:none}

/* 翻牌：0→24% 缩小旋转 90°（.25s），24→100% 弹性放大回位（.8s），合计约 1.05s */
.pxf-grid .pxf-cell.is-flip{animation:pxf-flip 1.05s both;animation-delay:var(--pxf-delay,0s)}

@keyframes pxf-in{
  0%{opacity:0;transform:scale(.1) rotate(90deg)}
  100%{opacity:1;transform:none}
}
@keyframes pxf-flip{
  0%{transform:scale(1) rotate(0deg);animation-timing-function:cubic-bezier(.4,0,.2,1)}
  24%{transform:scale(.1) rotate(90deg);animation-timing-function:cubic-bezier(.2,1.6,.35,1)}
  100%{transform:scale(1) rotate(0deg)}
}

.pxf-legend{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px 16px;
  font-family:var(--font-ui);font-size:var(--fs-sm,13px);color:var(--text-muted)}
.pxf-legend li{display:inline-flex;align-items:center;gap:6px;padding:2px 6px;border-radius:var(--radius-pill,999px);
  transition:background-color .18s ease,color .18s ease}
.pxf-legend li.on{background:color-mix(in srgb,var(--text) 8%,transparent);color:var(--text)}
.pxf-legend li.is-zero{opacity:.55}
.pxf-dot{width:9px;height:9px;border-radius:3px;flex:none;
  box-shadow:0 0 0 1px color-mix(in srgb,var(--text) 12%,transparent)}
.pxf-label{font-family:var(--font-ui);white-space:nowrap;max-width:12em;overflow:hidden;text-overflow:ellipsis}
.pxf-val{font-family:var(--font-mono);font-variant-numeric:tabular-nums;font-weight:600;
  color:var(--text);font-style:normal}
.pxf-share{font-family:var(--font-mono);font-variant-numeric:tabular-nums;font-style:normal;opacity:.7}

.pxf-empty{display:flex;align-items:center;justify-content:center;text-align:center;
  color:var(--text-muted);font-family:var(--font-ui);font-size:var(--fs-sm,13px);
  border-radius:var(--radius-sm,10px);border:1px dashed var(--border);
  background:color-mix(in srgb,var(--bg-subtle) 55%,transparent)}

@media (prefers-reduced-motion:reduce){
  .pxf-cell{animation:none !important;transform:none !important;opacity:1 !important}
}
`;

let cssInjected = false;
function usePixelFlipCss() {
  useEffect(() => {
    if (cssInjected || typeof document === 'undefined') return;
    if (document.getElementById('pixel-flip-css')) { cssInjected = true; return; }
    cssInjected = true;
    const el = document.createElement('style');
    el.id = 'pixel-flip-css';
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}

/* ============================================================
   三、组件内部小工具
   ============================================================ */

// 读容器宽度（ResizeObserver 优先，退化成 window resize）。首帧同步读一次，避免闪空态。
function useMeasureWidth(ref) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => {
      const w = el.clientWidth || (el.getBoundingClientRect ? el.getBoundingClientRect().width : 0);
      if (w > 0) setWidth(Math.round(w));
    };
    read();
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(read);
      ro.observe(el);
      return () => ro.disconnect();
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', read);
      return () => window.removeEventListener('resize', read);
    }
    return undefined;
  }, [ref]);
  return width;
}

// 是否支持 hover（指针设备）。触屏走「只播入场动画」的分支。
function useHoverCapable() {
  const [hover, setHover] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const sync = () => setHover(!!mq.matches);
    sync();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', sync);
      return () => mq.removeEventListener('change', sync);
    }
    return undefined;
  }, []);
  return hover;
}

function prefersReduced() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return !!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ============================================================
   四、组件
   ============================================================ */

export function PixelFlip({ groups = [], height = 340, ariaLabel = '站点构成像素翻牌' }) {
  usePixelFlipCss();
  const boxRef = useRef(null);
  const gridRef = useRef(null);
  const width = useMeasureWidth(boxRef);
  const hover = useHoverCapable();
  const [live, setLive] = useState(false);     // 进入视口后才挂入场动画
  const [settled, setSettled] = useState(false); // 入场播完，锁死入场动画

  const list = useMemo(() => normalizeGroups(groups), [groups]);
  const sum = useMemo(() => list.reduce((a, g) => a + g.value, 0), [list]);

  const cols = columnsFor(width || 1000);
  const rows = PXF_ROWS;
  const cellCount = cols * rows;

  // 一个方块 = 一份：把 cellCount 个方块按占比分给各分组（下标与 list 对齐）
  const counts = useMemo(() => apportion(cellCount, list), [cellCount, list]);

  const stageH = Math.max(140, Math.round(num(height) || 340));

  // 展开成「第 k 个方块属于哪个分组」；顺序铺 = 从左到右、从上到下，同一分组连成一片。
  const cells = useMemo(() => {
    const flat = [];
    counts.forEach((c, gi) => {
      for (let k = 0; k < c; k += 1) flat.push(gi);
    });
    while (flat.length > cellCount) flat.pop();
    const out = [];
    for (let idx = 0; idx < cellCount; idx += 1) {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const gi = idx < flat.length ? flat[idx] : -1;
      const g = gi >= 0 ? list[gi] : null;
      out.push({
        key: `${row}-${col}`,
        gi,
        row,
        col,
        label: g ? g.label : '',
        // 和主题背景混合一点：既是模板的渐变观感，也避免纯色块和背景撞色看不清。
        fill: g ? `color-mix(in srgb, ${g.color} 82%, var(--bg))` : null,
        d: (col + row) * 0.02
      });
    }
    return out;
  }, [counts, cellCount, cols, list]);

  // ---- 进入视口才播入场动画（只播一次）----
  useEffect(() => {
    if (live) return undefined;
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver !== 'function') { setLive(true); return undefined; }
    const io = new IntersectionObserver((entries) => {
      if (entries[0] && entries[0].isIntersecting) { setLive(true); io.disconnect(); }
    }, { rootMargin: '120px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [live]);

  // 入场动画总时长 = 最大延迟 + 0.5s；播完后加 is-settled，避免翻牌结束重放入场。
  useEffect(() => {
    if (!live || settled || typeof window === 'undefined') return undefined;
    if (prefersReduced()) { setSettled(true); return undefined; }
    const maxDelay = ((cols - 1) + (rows - 1)) * 0.02 + 0.5;
    const t = window.setTimeout(() => setSettled(true), (maxDelay + 0.05) * 1000);
    return () => window.clearTimeout(t);
  }, [live, settled, cols, rows]);

  // ---- 指针交互：缓存方块中心，pointermove 时算距离触发翻牌 ----
  useEffect(() => {
    if (!hover) return undefined;
    const grid = gridRef.current;
    if (!grid) return undefined;

    // 方块中心（相对 grid 内容盒左上角）。transform 不影响 offsetLeft/Width，动画期间也准。
    let centers = [];
    const measure = () => {
      const nodes = grid.querySelectorAll('.pxf-cell');
      centers = Array.from(nodes).map((el) => ({
        el,
        x: el.offsetLeft + el.offsetWidth / 2,
        y: el.offsetTop + el.offsetHeight / 2
      }));
    };
    measure();

    let ro = null;
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(measure);
      ro.observe(grid);
    }

    const RADIUS = 120;
    const reduced = prefersReduced();
    let raf = 0;
    let last = null;

    const run = () => {
      raf = 0;
      if (!last) return;
      const { x, y } = last;
      last = null;
      for (let i = 0; i < centers.length; i += 1) {
        const c = centers[i];
        const el = c.el;
        if (el.dataset.busy === '1') continue;
        const d = Math.hypot(c.x - x, c.y - y);
        if (d >= RADIUS) continue;
        el.dataset.busy = '1';
        el.style.setProperty('--pxf-delay', `${(d * 0.003).toFixed(3)}s`);
        el.classList.add('is-flip');
      }
    };

    const onMove = (ev) => {
      if (reduced) return;
      const rect = grid.getBoundingClientRect();
      last = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
      if (!raf) raf = window.requestAnimationFrame(run);
    };

    // 动画结束：解锁，允许下一轮再次触发（先移除 class 才会重新播放同名动画）
    const onEnd = (ev) => {
      const el = ev.target;
      if (!el || !el.classList || !el.classList.contains('pxf-cell')) return;
      if (!el.classList.contains('is-flip')) return;
      el.classList.remove('is-flip');
      el.dataset.busy = '0';
    };

    grid.addEventListener('pointermove', onMove);
    grid.addEventListener('animationend', onEnd);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      grid.removeEventListener('pointermove', onMove);
      grid.removeEventListener('animationend', onEnd);
      if (ro) ro.disconnect();
    };
  }, [hover, cells]);

  // ---- 悬停高亮图例：事件委托 + 直接改 class，Preact 不参与 ----
  useEffect(() => {
    if (!hover) return undefined;
    const grid = gridRef.current;
    if (!grid) return undefined;
    let lastGi = -1;
    const paint = (gi) => {
      if (gi === lastGi) return;
      lastGi = gi;
      const box = boxRef.current;
      if (!box) return;
      box.querySelectorAll('.pxf-legend li').forEach((li) => {
        li.classList.toggle('on', gi >= 0 && Number(li.dataset.gi) === gi);
      });
    };
    const onOver = (ev) => {
      const t = ev.target;
      const cell = t && typeof t.closest === 'function' ? t.closest('.pxf-cell') : null;
      paint(cell ? Number(cell.dataset.gi) : -1);
    };
    const onLeave = () => paint(-1);
    grid.addEventListener('pointermove', onOver);
    grid.addEventListener('pointerleave', onLeave);
    return () => {
      grid.removeEventListener('pointermove', onOver);
      grid.removeEventListener('pointerleave', onLeave);
    };
  }, [hover, cells]);

  // ---- 空态：没有分组，或者所有 value 都是 0 / null ----
  if (!list.length || !(sum > 0)) {
    return (
      <div class="pxf-box" ref={boxRef}>
        <div class="pxf-empty" style={{ height: `${stageH}px` }}>
          暂时没有可展示的站点构成数据
        </div>
      </div>
    );
  }

  const desc = list
    .filter((g) => g.value > 0)
    .map((g) => `${g.label} ${fmtNum(g.value)}`)
    .join('，');

  return (
    <div class="pxf-box" ref={boxRef}>
      <div class="pxf-stage" style={{ height: `${stageH}px` }}>
        <div
          class={`pxf-grid${live ? ' is-live' : ''}${settled ? ' is-settled' : ''}`}
          ref={gridRef}
          style={{ '--pxf-cols': cols, '--pxf-rows': rows }}
          role="img"
          aria-label={`${ariaLabel}：${desc}`}
        >
          {cells.map((c) => (
            <i
              key={c.key}
              class="pxf-cell"
              data-gi={c.gi}
              title={c.label || undefined}
              style={{ '--pxf-fill': c.fill || 'transparent', '--pxf-d': c.d }}
            />
          ))}
        </div>
      </div>
      <ul class="pxf-legend">
        {list.map((g, gi) => (
          <li key={`lg-${gi}`} data-gi={gi} class={g.value > 0 ? '' : 'is-zero'}>
            <i class="pxf-dot" style={{ background: g.color }} />
            <span class="pxf-label" title={g.label}>{g.label}</span>
            <b class="pxf-val">{g.value > 0 ? fmtNum(g.value) : '—'}</b>
            {g.value > 0 ? <em class="pxf-share">{(g.value / sum * 100).toFixed(1)}%</em> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PixelFlip;
