// WaffleGrid.jsx —— 华夫格 / 点阵占比图（多维占比一览）
//
// 为什么用华夫格而不是再画一个饼：
//   饼图 / 旭日只能表达「占比」，看不出「绝对量」，而且角度很难比较；华夫格把
//   一整组拆成 N 个同样大小的方块，**每个方块就是一份**，占比靠「数方块」就能读出来，
//   同时方块总数又直接是体量。多组并排时（分类 / 标签 / 语言），一眼就能横向比结构。
//
// 设计取舍：
//   1) 用 SVG <rect> 而不是 canvas：方块数量在几百的量级，SVG 的 hover / 圆角 / 阴影
//      都更省事，还能跟着容器宽度自适应。
//   2) 动画全部交给 CSS（`--i` 算延迟），但**只有整块进入视口后才挂上动画类**
//      —— 否则页面刚加载时动画已经在屏幕外放完了，滚下来看到的是静止画面。
//   3) 悬停高亮**不走 setState**：一个组可能有 400 个方块，每次 hover 都重渲染整棵
//      VDOM 不划算。改成事件委托 + 直接改 class（见 paintHot），Preact 全程不参与。
//   4) 分块（谁占几个方块）用**最大余数法**，保证「各方块数之和 == 总方块数」，
//      不会出现「加起来差一个」的观感 bug。所有计算抽成纯函数，可在 Node 里测边界。
//   5) 颜色优先用传入的 segment.color，缺省才回落到 CHART_COLORS；
//      中文一律 var(--font-ui)，数值 var(--font-mono) + tabular-nums。
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ============================================================
   一、基础工具
   （复制自 frontend/src/components/StatCharts.jsx —— 那些工具没有 export，
     这里按需抄一份，不改动 StatCharts.jsx 本身）
   ============================================================ */

// 与 StatCharts.jsx 完全一致的 16 色板
export const CHART_COLORS = [
  '#2f6bff', '#00b894', '#ff7a1a', '#e8397a', '#8b5cf6', '#0fb9b1',
  '#f2b705', '#ef476f', '#3a86ff', '#06d6a0', '#c77dff', '#ff6b35',
  '#118ab2', '#e0a800', '#7c4dff', '#00a8e8'
];

export function clamp(v, lo, hi) {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return n < lo ? lo : n > hi ? hi : n;
}

// 大数缩写：1234 → 1.2K，3456789 → 3.5M
export function fmtNum(n, opts = {}) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  const digits = Number.isFinite(opts.digits) ? opts.digits : 1;
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  if (abs < 1000) {
    if (Number.isInteger(abs)) return sign + String(abs);
    return sign + abs.toFixed(digits).replace(/\.0+$/, '');
  }
  const units = [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [base, suffix] of units) {
    if (abs >= base) {
      const s = (abs / base).toFixed(digits);
      return sign + s.replace(/\.0+$/, '') + suffix;
    }
  }
  return sign + String(abs);
}

export function truncate(s, max) {
  const str = String(s == null ? '' : s);
  const n = Number(max) || 0;
  if (str.length <= n) return str;
  return n <= 1 ? str.slice(0, n) : `${str.slice(0, n - 1)}…`;
}

// 任何非有限数值一律当 0 —— 保证下游永远不会算出 NaN
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* ============================================================
   二、布局纯函数（可在 Node 里单独 import 测边界）
   ============================================================ */

// 单组方块总数上限：再多就画成一团糊，也没人真的去数。
export const MAX_CELLS = 400;
export const DEFAULT_PER_ROW = 20;

// 占比：分母 <= 0 时返回 0（而不是 NaN / Infinity）
export function waffleShare(value, total) {
  const v = num(value);
  const t = num(total);
  if (!(t > 0)) return 0;
  const s = v / t;
  return Number.isFinite(s) ? clamp(s, 0, 1) : 0;
}

// 弹出延迟序号：越靠左上越先弹。
// 用「对角线序号 + 同对角线内的列序」拼成一个单调递增的浮点数，
// 乘上毫秒数就是 animation-delay —— 于是方块会像水波一样从左上角斜着铺开。
export function diagonalOrder(col, row, perRow = DEFAULT_PER_ROW) {
  const p = Math.max(1, Math.floor(num(perRow) || DEFAULT_PER_ROW));
  const c = Math.max(0, Math.floor(num(col)));
  const r = Math.max(0, Math.floor(num(row)));
  return (c + r) + c / (p + 1);
}

// 最大余数法：把 filled 个方块按 segments 的占比切成整数份，且**和恰好等于 filled**。
// 先按 floor 取整，再把余下的名额按「小数部分从大到小」补给各方块（同分按原顺序，保证结果稳定）。
export function apportionSegments(segments, filled) {
  const segs = (Array.isArray(segments) ? segments : []).filter((s) => s && num(s.value) > 0);
  const n = segs.length;
  const out = new Array(n).fill(0);
  const target = Math.max(0, Math.floor(num(filled)));
  if (!n || target <= 0) return out;
  const sum = segs.reduce((a, s) => a + num(s.value), 0);
  if (!(sum > 0)) return out;

  const exact = segs.map((s) => (num(s.value) / sum) * target);
  let used = 0;
  for (let i = 0; i < n; i += 1) {
    out[i] = Math.floor(exact[i]);
    used += out[i];
  }
  let rest = target - used;
  if (rest > 0) {
    const order = exact
      .map((v, i) => ({ frac: v - Math.floor(v), i }))
      .sort((a, b) => b.frac - a.frac || a.i - b.i);
    for (let k = 0; k < order.length && rest > 0; k += 1) {
      out[order[k].i] += 1;
      rest -= 1;
    }
  }
  return out;
}

// 单组：把 total 个「份」摊成 rows × perRow 的方格，并算出每格的段归属。
// 返回的 cells 是**行优先**的一维数组（按顺序铺就是从左到右、从上到下）。
export function waffleBlocks(total, segments, perRow = DEFAULT_PER_ROW) {
  const p = clamp(Math.floor(num(perRow) || DEFAULT_PER_ROW), 4, 60);
  const segs = (Array.isArray(segments) ? segments : [])
    .filter((s) => s && num(s.value) > 0)
    .map((s, i) => ({
      label: String(s.label == null || s.label === '' ? '未命名' : s.label),
      value: num(s.value),
      color: s.color || CHART_COLORS[i % CHART_COLORS.length]
    }));
  const segSum = segs.reduce((a, s) => a + s.value, 0);
  const t = Math.max(0, num(total) || segSum);

  // 空组：给一行空白格，保证卡片高度不为 0（也不画 NaN 尺寸）
  if (!(t > 0) || !segs.length) {
    return { rows: 1, perRow: p, cells: [], legend: [], filled: 0, empty: true, segSum };
  }

  const rowsWanted = Math.max(1, Math.ceil(t / p));
  const rows = Math.min(rowsWanted, Math.max(1, Math.floor(MAX_CELLS / p)));
  const cellCount = rows * p;
  const filled = Math.min(cellCount, Math.round(t));   // 只画整块，不画半个方块
  const counts = apportionSegments(segs, filled);

  // 展开成「第 k 个方块属于第几段」；块数不足 cellCount 的部分留空（-1）
  const flat = [];
  counts.forEach((c, i) => { for (let k = 0; k < c; k += 1) flat.push(i); });
  while (flat.length > cellCount) flat.pop();

  const base = Math.max(t, segSum);   // 占比分母：段和大于 total 时以段和为准，避免算出 >100%
  const cells = [];
  for (let idx = 0; idx < cellCount; idx += 1) {
    const col = idx % p;
    const row = Math.floor(idx / p);
    const si = idx < flat.length ? flat[idx] : -1;
    const seg = si >= 0 ? segs[si] : null;
    cells.push({
      key: `${row}-${col}`,
      row,
      col,
      segIndex: si,
      color: seg ? seg.color : null,
      label: seg ? seg.label : '',
      delay: diagonalOrder(col, row, p)
    });
  }

  return {
    rows,
    perRow: p,
    cells,
    filled,
    empty: false,
    segSum,
    legend: segs.map((s, i) => ({
      label: s.label,
      value: s.value,
      color: s.color,
      count: counts[i],
      share: waffleShare(s.value, base)
    }))
  };
}

// 多组：groups: [{ label, total, segments: [{ label, value, color }] }]
export function waffleLayout(groups, opts = {}) {
  const perRow = clamp(Math.floor(num(opts.perRow) || DEFAULT_PER_ROW), 4, 60);
  const list = (Array.isArray(groups) ? groups : []).filter(Boolean);
  return list.map((g, i) => {
    const segs = Array.isArray(g.segments) ? g.segments : [];
    const segSum = segs.reduce((a, s) => a + num(s && s.value), 0);
    const total = Math.max(0, num(g.total) || segSum);
    const blocks = waffleBlocks(total, segs, perRow);
    return {
      index: i,
      label: String(g.label == null || g.label === '' ? `第 ${i + 1} 组` : g.label),
      total,
      segSum,
      ...blocks
    };
  });
}

/* ============================================================
   三、组件内部小工具
   （useMeasureWidth 的思路来自 StatCharts.jsx 的 useMeasure；
      useTipEl 的思路来自它的 useTooltip，但改成完全命令式 —— 见注释）
   ============================================================ */

// 读容器宽度。与 StatCharts 的 useMeasure 差别：
//   ① 宽度存在外面传进来的 ref 上（同一个容器还要给 tooltip 定位用，一个 ref 两用）；
//   ② useLayoutEffect 首次同步读一次 —— 首帧就知道真实宽度，不会先闪「暂无数据」。
function useMeasureWidth(ref, fallback = 0) {
  const [width, setWidth] = useState(fallback);
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

// 跟随鼠标的 tooltip（命令式，不 setState）。
// 文本用 textContent 写入而不是 innerHTML —— 分类名里出现 < > 也不会被当成标签解析。
function useTipEl() {
  const tipRef = useRef(null);
  const show = (e, title, meta) => {
    const el = tipRef.current;
    const host = el && el.parentNode;
    if (!el || !host || !host.getBoundingClientRect) return;
    const b = el.querySelector('b');
    const i = el.querySelector('i');
    if (b) b.textContent = title || '';
    if (i) i.textContent = meta || '';
    const box = host.getBoundingClientRect();
    const x = (e && e.clientX ? e.clientX : 0) - box.left;
    const y = (e && e.clientY ? e.clientY : 0) - box.top;
    const flipX = x > box.width - 190;
    const flipY = y > box.height - 60;
    el.style.transform = `translate(${flipX ? x - 14 : x + 14}px, ${flipY ? y - 14 : y + 16}px)`
      + (flipX ? ' translateX(-100%)' : '') + (flipY ? ' translateY(-100%)' : '');
    el.classList.add('on');
  };
  const hide = () => {
    const el = tipRef.current;
    if (el) el.classList.remove('on');
  };
  return { tipRef, show, hide };
}

function Empty({ height, text }) {
  return (
    <div class="wfg-empty" style={{ minHeight: `${Math.max(90, (Number(height) || 200) - 60)}px` }}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 19V9m5 10V5m5 14v-7m5 7V8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="0.55" />
      </svg>
      <span>{text || '暂时没有数据'}</span>
    </div>
  );
}

/* ============================================================
   四、样式（模块内注入一次，不碰任何 .css 文件）
   ============================================================ */

const CSS = `
.wfg-box{position:relative;width:100%}
.wfg-grid{display:grid;grid-template-columns:repeat(var(--wfg-cols,1),minmax(0,1fr));
  gap:var(--sp-5,16px);align-items:start}
.wfg-card{position:relative;display:flex;flex-direction:column;gap:8px;padding:var(--sp-4,12px);
  border-radius:var(--radius-sm,10px);border:1px solid var(--border);
  background:linear-gradient(180deg,color-mix(in srgb,var(--bg-subtle) 55%,transparent),transparent 72%)}
.wfg-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.wfg-name{font-family:var(--font-ui);font-size:var(--fs-sm,13px);font-weight:600;color:var(--text);
  line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wfg-total{font-family:var(--font-mono);font-variant-numeric:tabular-nums;font-size:11px;
  color:var(--text-muted);white-space:nowrap;letter-spacing:var(--track-mono,.06em)}
.wfg-legend{display:flex;flex-wrap:wrap;gap:4px 12px;margin:0;padding:0;list-style:none}
.wfg-legend li{display:inline-flex;align-items:center;gap:5px;font-size:var(--fs-caption,12px);
  color:var(--text-muted);white-space:nowrap;transition:opacity .2s var(--ease-out)}
.wfg-legend li i{width:9px;height:9px;border-radius:3px;flex:none;
  box-shadow:0 0 0 1px color-mix(in srgb,var(--text) 12%,transparent) inset}
.wfg-legend li b{font-family:var(--font-mono);font-variant-numeric:tabular-nums;font-weight:500;
  color:var(--text);opacity:.78}
.wfg-legend li em{font-style:normal;font-family:var(--font-mono);font-variant-numeric:tabular-nums;opacity:.62}
.wfg-legend li.on{color:var(--text)}
.wfg-canvas{position:relative;border-radius:var(--radius-sm,10px);overflow:hidden}
.wfg-svg{display:block;width:100%;height:auto;overflow:visible}

/* 方块：默认缩到 0 隐藏，等整块进入视口（.wfg-live）再按 --i 对角线错峰弹出。
   动画用 backwards 填充而不是 forwards —— 结束后属性交还给元素自身样式，
   否则动画会把 transform 锁死，:hover 的放大就永远不生效。 */
.wfg-cell{transform-box:fill-box;transform-origin:center;transform:scale(0);opacity:0;
  transition:transform .2s var(--ease-out),filter .2s var(--ease-out),opacity .2s var(--ease-out)}
.wfg-live .wfg-cell{transform:scale(1);opacity:1;
  animation:wfg-pop .5s var(--ease-spring,cubic-bezier(.34,1.56,.64,1)) backwards;
  animation-delay:calc(var(--i,0) * 13ms)}
.wfg-live .wfg-cell.wfg-hot{transform:scale(1.55);filter:brightness(1.3) saturate(1.2)}
.wfg-live .wfg-cell.wfg-lit{filter:brightness(1.15) saturate(1.08)}
.wfg-live .wfg-cell.wfg-dim{opacity:.24}
.wfg-cell.wfg-blank{cursor:default}

/* 整组「扫过一遍」的高光：一条斜向渐变横穿点阵。
   用 background-position 动画而不是 transform —— 后者会把方块也一起搬走。 */
.wfg-sweep{position:absolute;inset:0;pointer-events:none;opacity:0;
  background-image:linear-gradient(105deg,transparent 34%,color-mix(in srgb,var(--primary) 20%,transparent) 50%,transparent 66%);
  background-size:260% 100%;background-repeat:no-repeat}
.wfg-live .wfg-sweep{animation:wfg-sweep 1.8s var(--ease-out) .45s 1 both}

.wfg-tip{position:absolute;left:0;top:0;z-index:6;opacity:0;pointer-events:none;
  transition:opacity .16s var(--ease-out);
  padding:7px 10px;border-radius:var(--radius-sm,10px);font-size:var(--fs-caption,12px);line-height:1.45;
  background:color-mix(in srgb,var(--bg-elevated) 94%,transparent);color:var(--text);
  border:1px solid var(--glass-border,var(--border));box-shadow:var(--shadow-md);
  white-space:nowrap;max-width:320px}
.wfg-tip.on{opacity:1}
.wfg-tip b{display:block;font-family:var(--font-ui);font-weight:600}
.wfg-tip i{font-style:normal;opacity:.75;font-family:var(--font-mono);font-variant-numeric:tabular-nums}
.wfg-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
  color:var(--text-muted);font-size:var(--fs-sm,13px);border-radius:var(--radius-sm,10px);
  background:color-mix(in srgb,var(--bg-subtle) 55%,transparent);border:1px dashed var(--border)}
@keyframes wfg-pop{from{opacity:0;transform:scale(0)}to{opacity:1;transform:scale(1)}}
@keyframes wfg-sweep{0%{opacity:0;background-position:190% 0}18%{opacity:.85}100%{opacity:0;background-position:-90% 0}}
@media (prefers-reduced-motion:reduce){
  .wfg-cell{transform:none;opacity:1;transition:none !important}
  .wfg-live .wfg-cell{animation:none !important}
  .wfg-sweep{display:none}
}
`;

let cssInjected = false;
function useWaffleCss() {
  useEffect(() => {
    if (cssInjected || typeof document === 'undefined') return;
    if (document.getElementById('charts-waffle-grid-css')) { cssInjected = true; return; }
    cssInjected = true;
    const el = document.createElement('style');
    el.id = 'charts-waffle-grid-css';
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}

/* ============================================================
   五、组件
   ============================================================ */

const PAD_X = 12;        // 点阵在卡片内的左右留白
const PAD_Y = 10;
const GAP_CELL = 2;      // 方块之间的小缝隙
const MAX_COLS = 3;      // 一组卡片最多并排几列

export function WaffleGrid({
  groups = [],
  height = 320,
  ariaLabel = '华夫格占比图',
  perRow = DEFAULT_PER_ROW
}) {
  useWaffleCss();
  const boxRef = useRef(null);
  const { tipRef, show, hide } = useTipEl();
  const width = useMeasureWidth(boxRef, 0);
  const [live, setLive] = useState(false);       // 进入视口后才挂动画类
  const lastKeyRef = useRef('');                 // 上一次悬停的方块（避免同一格重复算高亮）

  const rowCount = clamp(Math.floor(num(perRow) || DEFAULT_PER_ROW), 4, 60);
  const layout = useMemo(() => waffleLayout(groups, { perRow: rowCount }), [groups, rowCount]);
  const w = Math.max(280, Math.round(width));

  // 分列 + 单格边长（全部按容器宽度算，窄屏自动变成一列）
  const cols = w >= 1080 ? MAX_COLS : w >= 700 ? 2 : 1;
  const gapX = 16;
  const cardW = Math.max(120, (w - gapX * (cols - 1)) / cols);
  const rawCell = (cardW - PAD_X * 2 - GAP_CELL * (rowCount - 1)) / rowCount;
  const cell = Math.max(4, Number.isFinite(rawCell) ? rawCell : 4);
  const gap = cell < 7 ? 1 : GAP_CELL;
  const rx = Math.min(3, cell * 0.3);

  // 首次进入视口才放动画；IntersectionObserver 不可用时立刻放
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

  // 数据变了：清掉残留高亮与 tooltip
  useEffect(() => { lastKeyRef.current = ''; hide(); }, [layout]);

  // ---- 悬停高亮：事件委托 + 直接改 class，Preact 不参与（见文件头注释 ③）----
  const paintHot = (hv) => {
    const box = boxRef.current;
    if (!box) return;
    box.querySelectorAll('rect.wfg-cell').forEach((el) => {
      // 三种态互斥：
      //   hot = 鼠标底下这一格（放大 + 提亮）
      //   lit = 同组、同段、但不是这一格（只轻微提亮，让人看出它属于哪一段）
      //   dim = 同组、其它段（压暗）
      const isHot = !!hv && hv.cellId === el.getAttribute('data-id');
      const same = !!hv && hv.gi === Number(el.dataset.gi);
      const isLit = same && hv.si >= 0 && Number(el.dataset.si) === hv.si && !isHot;
      el.classList.toggle('wfg-hot', isHot);
      el.classList.toggle('wfg-lit', isLit);
      el.classList.toggle('wfg-dim', same && !isHot && !isLit);
    });
    // 图例跟着亮：悬停哪一段，哪一段的图例项加粗
    box.querySelectorAll('.wfg-legend li').forEach((el) => {
      const on = !!hv && Number(el.dataset.gi) === hv.gi && Number(el.dataset.si) === hv.si;
      el.classList.toggle('on', on);
    });
  };

  const pickCell = (ev) => {
    const t = ev && ev.target;
    if (!t || typeof t.closest !== 'function') return null;
    return t.closest('rect.wfg-cell');
  };

  const onPointer = (ev) => {
    const rectEl = pickCell(ev);
    if (!rectEl) {
      if (lastKeyRef.current) { lastKeyRef.current = ''; paintHot(null); hide(); }
      return;
    }
    const gi = Number(rectEl.dataset.gi);
    const si = Number(rectEl.dataset.si);
    const cellId = rectEl.getAttribute('data-id');
    const key = cellId;
    const g = layout[gi];
    if (!g) return;
    const seg = si >= 0 ? (g.legend[si] || null) : null;
    const title = seg ? seg.label : '未占用';
    const meta = seg
      ? `${g.label} · ${fmtNum(seg.value)} · ${(seg.share * 100).toFixed(1)}%`
      : `${g.label} · 空位`;
    if (key !== lastKeyRef.current) {
      lastKeyRef.current = key;
      paintHot({ gi, si, cellId });
    }
    show(ev, title, meta);
  };

  const clear = () => {
    lastKeyRef.current = '';
    paintHot(null);
    hide();
  };

  if (!layout.length || width <= 0) {
    return (
      <div class="wfg-box" ref={boxRef} style={{ minHeight: `${Math.max(90, num(height) || 320)}px` }}>
        <Empty height={height} text="暂时没有数据" />
      </div>
    );
  }

  return (
    <div
      class={`wfg-box${live ? ' wfg-live' : ''}`}
      ref={boxRef}
      style={{ minHeight: `${Math.max(90, num(height) || 320)}px` }}
      onPointerOver={onPointer}
      onPointerMove={onPointer}
      onPointerLeave={clear}
    >
      <div class="wfg-grid" style={{ '--wfg-cols': cols }}>
        {layout.map((g) => {
          const gridH = g.cells.length
            ? g.rows * cell + (g.rows - 1) * gap + PAD_Y * 2
            : PAD_Y * 2 + cell;
          const svgW = cardW;
          const desc = g.legend.length
            ? g.legend.map((s) => `${s.label} ${fmtNum(s.value)}（${(s.share * 100).toFixed(1)}%）`).join('，')
            : '暂无分段数据';
          return (
            <section class="wfg-card" key={`${g.label}-${g.index}`}>
              <header class="wfg-head">
                <span class="wfg-name" title={g.label}>{truncate(g.label, 24)}</span>
                <span class="wfg-total">总计 {fmtNum(g.total)}</span>
              </header>
              <ul class="wfg-legend">
                {g.legend.map((s, si) => (
                  <li key={`lg-${si}`} data-gi={g.index} data-si={si}>
                    <i style={{ background: s.color }} />
                    <span>{truncate(s.label, 10)}</span>
                    <b>{fmtNum(s.value)}</b>
                    <em>{(s.share * 100).toFixed(0)}%</em>
                  </li>
                ))}
              </ul>
              <div class="wfg-canvas">
                <svg
                  class="wfg-svg"
                  viewBox={`0 0 ${svgW.toFixed(2)} ${gridH.toFixed(2)}`}
                  role="img"
                  aria-label={`${ariaLabel}：${g.label}，共 ${fmtNum(g.total)}，${desc}`}
                >
                  {g.cells.map((c) => {
                    const x = PAD_X + c.col * (cell + gap);
                    const y = PAD_Y + c.row * (cell + gap);
                    const blank = c.segIndex < 0;
                    return (
                      <rect
                        key={c.key}
                        class={`wfg-cell${blank ? ' wfg-blank' : ''}`}
                        data-id={`${g.index}:${c.row}:${c.col}`}
                        data-gi={g.index}
                        data-si={c.segIndex}
                        x={x.toFixed(2)}
                        y={y.toFixed(2)}
                        width={cell.toFixed(2)}
                        height={cell.toFixed(2)}
                        rx={rx.toFixed(2)}
                        fill={blank ? 'color-mix(in srgb, var(--text) 8%, transparent)' : c.color}
                        style={{ '--i': Number(c.delay.toFixed(3)) }}
                      />
                    );
                  })}
                </svg>
                <div class="wfg-sweep" aria-hidden="true" />
              </div>
            </section>
          );
        })}
      </div>
      <div class="wfg-tip" ref={tipRef} aria-hidden="true"><b /><i /></div>
    </div>
  );
}

export default WaffleGrid;
