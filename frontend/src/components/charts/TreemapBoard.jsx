// TreemapBoard —— 矩形树图（squarified treemap）：图谱页统计看板的新增图表之一
//
// 站长要求「在现有的图之外再多画很多新图，动画特效尽可能多」，所以这是**纯新增**组件。
//
// 它画什么：把「分类 → 该分类下标签的体量」画成一片大小不一的矩形 ——
//   矩形面积 ∝ 数值，同一父分类的矩形相邻并共享一个底色；
//   比旭日图更容易比较「谁最大」，因为人眼对矩形面积比对扇区角度更敏感。
//
// 用的是 squarified treemap 算法（Bruls et al.）：优先让每个矩形接近正方形，
//   这样长宽比不会失控，小块也点得到。
//
// 动效：
//   ① 每个矩形按面积从大到小错峰「从中心放大」出现
//   ② 悬停某块：该块轻微放大 + 提亮 + 描边，并显示跟随鼠标的 tooltip
//   ③ 悬停某个父分类：该分类下所有块一起提亮，其余变暗
//   ④ 每块上叠一层缓慢移动的高光（linear-gradient + background-position）
//   ⑤ prefers-reduced-motion 全部关掉
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

// 与 StatCharts 同源色板（复制自 StatCharts.jsx，保证两处一致）
const CHART_COLORS = [
  '#2f6bff', '#00b894', '#ff7a1a', '#e8397a', '#8b5cf6', '#0fb9b1',
  '#f2b705', '#ef476f', '#3a86ff', '#06d6a0', '#c77dff', '#ff6b35',
  '#118ab2', '#e0a800', '#7c4dff', '#00a8e8'
];

export function fmtNum(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  const abs = Math.abs(v);
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

// hex → 提亮/压暗（用于同色系深浅），从 StatCharts 复制
export function shade(hex, amount) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  const amt = Math.max(-1, Math.min(1, Number(amount) || 0));
  const mix = (c) => {
    const target = amt >= 0 ? 255 : 0;
    return Math.round(c + (target - c) * Math.abs(amt));
  };
  const r = mix((num >> 16) & 255);
  const g = mix((num >> 8) & 255);
  const b = mix(num & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * 纯函数：squarified treemap 布局。
 *
 * @param {Array} items  [{ id?, label, value, color? }]（value ≤ 0 的会被丢掉）
 * @param {Object} rect { x, y, w, h }
 * @returns {Array} [{ item, x, y, w, h }]
 *
 * 边界：空数组 / 全 0 / 负值 / 只有一个元素 / 容器宽高为 0，都返回结构完整、无 NaN 的结果。
 */
export function squarify(items, rect) {
  const list = (Array.isArray(items) ? items : [])
    .filter((it) => it && Number(it.value) > 0)
    .map((it) => ({ ...it, value: Number(it.value) }))
    .sort((a, b) => b.value - a.value);
  const x0 = Number(rect && rect.x) || 0;
  const y0 = Number(rect && rect.y) || 0;
  const W = Math.max(0, Number(rect && rect.w) || 0);
  const H = Math.max(0, Number(rect && rect.h) || 0);
  if (!list.length || W <= 0 || H <= 0) return [];

  const total = list.reduce((s, it) => s + it.value, 0);
  if (!(total > 0)) return [];
  // 面积按「数值占比 × 容器面积」分配
  const area = W * H;
  const scaled = list.map((it) => ({ it, a: (it.value / total) * area }));

  const out = [];
  let x = x0;
  let y = y0;
  let w = W;
  let h = H;

  // 最差长宽比：用于决定「当前行要不要收尾」
  const worst = (row, side) => {
    const s = row.reduce((acc, r) => acc + r.a, 0);
    if (!(s > 0) || !(side > 0)) return Infinity;
    let max = 0;
    let min = Infinity;
    row.forEach((r) => { max = Math.max(max, r.a); min = Math.min(min, r.a); });
    return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
  };

  let i = 0;
  while (i < scaled.length) {
    const side = Math.min(w, h);
    const row = [];
    // 贪心：只要加入下一块能让最差长宽比变好，就继续加
    while (i < scaled.length) {
      const next = scaled[i];
      if (row.length && worst([...row, next], side) > worst(row, side)) break;
      row.push(next);
      i += 1;
    }
    const rowSum = row.reduce((acc, r) => acc + r.a, 0);
    const thick = side > 0 ? rowSum / side : 0;
    let cursor = 0;
    row.forEach((r) => {
      const len = thick > 0 ? r.a / thick : 0;
      if (w >= h) {
        // 竖着切：行占据左侧一条竖带
        out.push({ item: r.it, x, y: y + cursor, w: thick, h: len });
      } else {
        // 横着切：行占据上方一条横带
        out.push({ item: r.it, x: x + cursor, y, w: len, h: thick });
      }
      cursor += len;
    });
    if (w >= h) { x += thick; w -= thick; } else { y += thick; h -= thick; }
    if (w <= 0.5 || h <= 0.5) break;
  }
  return out;
}

function useReduced() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return reduce;
}

function useMeasure(fallback = 640) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => { const w = el.clientWidth || 0; if (w > 0) setWidth(Math.round(w)); };
    read();
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(read);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);
  return [ref, width];
}

const CSS = `
.tm-box { position: relative; width: 100%; }
.tm-svg { display: block; width: 100%; }
.tm-cell {
  cursor: pointer;
  transform-box: fill-box;
  transform-origin: center;
  transition: transform .28s var(--ease-out, ease), opacity .25s var(--ease-out, ease), filter .25s var(--ease-out, ease);
}
.tm-cell.dim { opacity: .22; }
.tm-cell.hot { filter: brightness(1.12) drop-shadow(0 2px 10px rgba(16,19,26,.22)); }
.tm-cell-in { animation: tm-in .6s var(--ease-out, ease) backwards; animation-delay: calc(var(--i, 0) * 42ms); }
@keyframes tm-in { from { opacity: 0; transform: scale(.55); } to { opacity: 1; transform: scale(1); } }
.tm-sheen {
  pointer-events: none;
  background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,.42) 48%, transparent 66%);
  background-size: 260% 100%;
  animation: tm-sheen 6.5s linear infinite;
  animation-delay: calc(var(--i, 0) * -0.7s);
}
@keyframes tm-sheen { from { background-position: 130% 0; } to { background-position: -130% 0; } }
.tm-label { font-family: var(--font-ui, sans-serif); fill: #fff; pointer-events: none; }
.tm-val { font-family: var(--font-mono, monospace); fill: rgba(255,255,255,.86); pointer-events: none; font-variant-numeric: tabular-nums; }
.tm-tip {
  position: absolute; z-index: 5; pointer-events: none;
  padding: 6px 10px; border-radius: 7px;
  background: var(--bg-elevated, #fff);
  border: 1px solid var(--border, rgba(0,0,0,.12));
  box-shadow: 0 6px 20px rgba(16,19,26,.16);
  font-family: var(--font-ui, sans-serif); font-size: 11.5px; color: var(--text);
  white-space: nowrap; transform: translate(-50%, -130%);
}
.tm-tip b { font-family: var(--font-mono, monospace); font-variant-numeric: tabular-nums; }
.tm-empty { display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-family: var(--font-ui, sans-serif); font-size: 12.5px; }
@media (prefers-reduced-motion: reduce) {
  .tm-cell, .tm-cell-in { animation: none !important; transition: none !important; }
  .tm-sheen { animation: none !important; opacity: 0; }
}
`;

let cssInjected = false;
function useCss() {
  useEffect(() => {
    if (cssInjected || typeof document === 'undefined') return;
    cssInjected = true;
    if (document.getElementById('charts-treemap-css')) return;
    const el = document.createElement('style');
    el.id = 'charts-treemap-css';
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}

/**
 * 矩形树图。
 *
 * @param {Object} props
 * @param {Array}  props.groups [{ label, color?, children: [{ label, value, color? }] }]
 *   也接受扁平的 [{ label, value, color }]（此时按单一父分类处理）
 * @param {number} props.height
 * @param {string} props.ariaLabel
 * @param {Function} props.valueFormat
 */
export function TreemapBoard({ groups = [], height = 380, ariaLabel = '矩形树图', valueFormat = fmtNum }) {
  useCss();
  const reduce = useReduced();
  const [boxRef, width] = useMeasure(640);
  const [hot, setHot] = useState(null);       // { group, cell }
  const [tip, setTip] = useState(null);

  const h = Math.max(180, Number(height) || 380);
  const w = Math.max(240, width);

  // 统一成「父分类 → 子块」：扁平数组时包一层
  const norm = useMemo(() => {
    const list = Array.isArray(groups) ? groups.filter(Boolean) : [];
    if (!list.length) return [];
    const isFlat = list.every((g) => !Array.isArray(g.children));
    if (isFlat) return [{ label: '', color: CHART_COLORS[0], children: list }];
    return list.map((g, gi) => ({
      label: String(g.label == null ? '' : g.label),
      color: g.color || CHART_COLORS[gi % CHART_COLORS.length],
      children: (g.children || []).filter(Boolean)
    }));
  }, [groups]);

  // 布局：每个父分类分到一条带（面积 ∝ 该分类总量），带内再 squarify 子块
  const layout = useMemo(() => {
    if (!norm.length || w <= 0 || h <= 0) return [];
    const totals = norm.map((g) => g.children.reduce((s, c) => s + Math.max(0, Number(c.value) || 0), 0));
    const grand = totals.reduce((a, b) => a + b, 0);
    if (!(grand > 0)) return [];

    const out = [];
    let x = 0;
    norm.forEach((g, gi) => {
      const share = totals[gi] / grand;
      const gw = share * w;
      const cellRect = { x, y: 0, w: gw, h };
      squarify(
        g.children.map((c, ci) => ({
          ...c,
          color: c.color || (g.children.length > 1 ? shade(g.color, -0.16 + (ci % 4) * 0.1) : g.color)
        })),
        cellRect
      ).forEach((box) => out.push({ ...box, group: gi }));
      x += gw;
    });
    return out;
  }, [norm, w, h]);

  if (!layout.length) {
    return (
      <div class="tm-box" ref={boxRef} style={{ height: `${h}px` }}>
        <div class="tm-empty" style={{ height: `${h}px` }}>暂时没有数据</div>
      </div>
    );
  }

  const onEnter = (e, gi, ci, cell) => {
    setHot({ group: gi, cell: ci });
    showTip(e, cell);
  };
  const showTip = (e, cell) => {
    const box = e.currentTarget.ownerSVGElement.parentNode.getBoundingClientRect();
    setTip({
      x: e.clientX - box.left,
      y: e.clientY - box.top,
      html: `${norm[cell.group] && norm[cell.group].label ? `${norm[cell.group].label} · ` : ''}${cell.item.label}：${valueFormat(cell.item.value)}`
    });
  };
  const moveTip = (e, cell) => showTip(e, cell);
  const clear = () => { setHot(null); setTip(null); };

  const isDim = (gi) => hot && hot.group !== gi;

  return (
    <div class="tm-box" ref={boxRef} style={{ height: `${h}px` }} onMouseLeave={clear}>
      <svg class="tm-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={ariaLabel}>
        {layout.map((cell, i) => {
          const cw = Math.max(0, cell.w - 1.5);
          const ch = Math.max(0, cell.h - 1.5);
          const showLabel = cw > 54 && ch > 26;
          const showVal = cw > 54 && ch > 42;
          return (
            <g
              key={`c-${i}`}
              class={`tm-cell${isDim(cell.group) ? ' dim' : ''}${hot && hot.group === cell.group && hot.cell === i ? ' hot' : ''}`}
              onMouseEnter={(e) => onEnter(e, cell.group, i, cell)}
              onMouseMove={(e) => moveTip(e, cell)}
              onMouseLeave={clear}
            >
              <rect
                class="tm-cell-in"
                style={{ '--i': i }}
                x={cell.x}
                y={cell.y}
                width={cw}
                height={ch}
                rx="3"
                fill={cell.item.color}
              />
              {/* 高光层：一块缓慢扫过的斜向白光，让整片树图「活」起来 */}
              {!reduce && (
                <foreignObject x={cell.x} y={cell.y} width={cw} height={ch} pointer-events="none">
                  <div class="tm-sheen" style={{ '--i': i, width: '100%', height: '100%' }} />
                </foreignObject>
              )}
              {showLabel && (
                <text class="tm-label" x={cell.x + 7} y={cell.y + 17} font-size={ch > 60 ? 12.5 : 11}>
                  {String(cell.item.label || '').length > Math.floor(cw / 13)
                    ? `${String(cell.item.label).slice(0, Math.max(2, Math.floor(cw / 13) - 1))}…`
                    : cell.item.label}
                </text>
              )}
              {showVal && (
                <text class="tm-val" x={cell.x + 7} y={cell.y + 33} font-size="10.5">
                  {valueFormat(cell.item.value)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {tip && (
        <div class="tm-tip" style={{ left: `${tip.x}px`, top: `${tip.y}px` }}>{tip.html}</div>
      )}
    </div>
  );
}

export default TreemapBoard;
