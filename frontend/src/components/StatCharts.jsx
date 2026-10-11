// StatCharts.jsx —— 零依赖统计图表库（图谱页「统计看板」用）
//
// 设计取舍（为什么是现在这个样子）：
//   1) 零依赖：仓库里没有 d3 / chart.js 的封装可用，也不允许 npm install，
//      所以全部用 Preact + 原生 SVG 手写。SVG 清晰、好做 hover、好做
//      「挂载时生长」的 CSS 过渡；数据量不到几百，不需要 Canvas。
//   2) 颜色只从主题变量 / 传入色板取：CHART_COLORS 是高饱和彩虹色板，
//      与主题主色（--primary）刻意区分开，浅色 / 素雅 / 天青三套主题下都够跳，
//      不会跟背景撞色；轴线与文字一律走 --border / --text-muted。
//   3) 计算与绘制分离：所有数据变换（分环、堆叠、分箱、坐标映射、对数刻度）
//      都抽成可单独导出的纯函数，组件只负责画。这样 Node 探针不需要 DOM
//      就能把边界条件（空数组 / 单点 / 全 0 / 负数 / 除零）测干净。
//   4) 动画只用 CSS transition（挂载后由 useReveal 翻一个布尔量触发），
//      不做每帧 rAF 常驻循环，切页不烧电；prefers-reduced-motion 下直接给终态。
//   5) 响应式：用 ResizeObserver 读容器宽度，viewBox 跟着容器走，
//      窄屏（<720px）自动收字号、隐藏次要标签。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ============================================================
   一、常量与基础工具
   ============================================================ */

// 统一色板：16 色，高饱和、彼此区分度高，且与常见主题主色（蓝/青/绿）都拉开
export const CHART_COLORS = [
  '#2f6bff', '#00b894', '#ff7a1a', '#e8397a', '#8b5cf6', '#0fb9b1',
  '#f2b705', '#ef476f', '#3a86ff', '#06d6a0', '#c77dff', '#ff6b35',
  '#118ab2', '#e0a800', '#7c4dff', '#00a8e8'
];

// 图表里用的中性色：跟随主题（浅色 / 素雅都能自动适配）
// 2026-10-11：网格 / 坐标轴改成「发丝线」——用 --text 的极低比例混色，
// 三套主题（纯净 / 素雅 / 天青）下都自然变淡变深，不写死颜色。
const NEUTRAL = {
  grid: 'color-mix(in srgb, var(--text) 14%, transparent)',
  axis: 'color-mix(in srgb, var(--text) 22%, transparent)',
  text: 'var(--text)',
  muted: 'var(--text-muted)'
};

export function seriesColors(n) {
  const out = [];
  const count = Math.max(0, Number(n) || 0);
  for (let i = 0; i < count; i += 1) out.push(CHART_COLORS[i % CHART_COLORS.length]);
  return out;
}

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

// hex → 提亮 / 压暗（用于旭日图二级环的同色系深浅、排名条渐变收尾）
export function shade(hex, amount) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  const amt = clamp(amount, -1, 1);
  const mix = (c) => {
    const target = amt >= 0 ? 255 : 0;
    const k = Math.abs(amt);
    return Math.round(c + (target - c) * k);
  };
  const r = mix((num >> 16) & 255);
  const g = mix((num >> 8) & 255);
  const b = mix(num & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/* ============================================================
   二、几何 / 刻度 / 缩放（纯函数）
   ============================================================ */

// 极坐标 → 直角坐标（角度制，0° 指向右侧，顺时针为正）
export function polarToXY(cx, cy, r, angleDeg) {
  const a = ((Number(angleDeg) || 0) * Math.PI) / 180;
  const radius = Number(r) || 0;
  return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
}

// 圆环扇区路径（内环外环之间的「甜甜圈切片」）
// 注意：SVG 的 A 命令画不出整圆（起终点重合会退化成空），所以夹角上限 359.999°
export function annularSectorPath(cx, cy, rInner, rOuter, a0, a1) {
  const start = Number(a0) || 0;
  let end = Number(a1);
  if (!Number.isFinite(end)) end = start;
  const span = clamp(end - start, -359.999, 359.999);
  end = start + span;
  const ri = Math.max(0, Number(rInner) || 0);
  const ro = Math.max(ri, Number(rOuter) || 0);
  if (ro <= 0 || Math.abs(span) < 0.0001) return '';
  const large = Math.abs(span) > 180 ? 1 : 0;
  const sweep = span >= 0 ? 1 : 0;
  const [x1, y1] = polarToXY(cx, cy, ro, start);
  const [x2, y2] = polarToXY(cx, cy, ro, end);
  const [x3, y3] = polarToXY(cx, cy, ri, end);
  const [x4, y4] = polarToXY(cx, cy, ri, start);
  const n = (v) => (Math.abs(v) < 1e-6 ? 0 : v).toFixed(3);
  if (ri <= 0.0001) {
    return `M ${n(x1)} ${n(y1)} A ${n(ro)} ${n(ro)} 0 ${large} ${sweep} ${n(x2)} ${n(y2)} L ${n(cx)} ${n(cy)} Z`;
  }
  return [
    `M ${n(x1)} ${n(y1)}`,
    `A ${n(ro)} ${n(ro)} 0 ${large} ${sweep} ${n(x2)} ${n(y2)}`,
    `L ${n(x3)} ${n(y3)}`,
    `A ${n(ri)} ${n(ri)} 0 ${large} ${sweep ? 0 : 1} ${n(x4)} ${n(y4)}`,
    'Z'
  ].join(' ');
}

// 线性映射：把 domain 的 v 映射到 range
export function linearScale(v, d0, d1, r0, r1) {
  const a = Number(d0), b = Number(d1);
  const span = b - a;
  if (!Number.isFinite(span) || span === 0) return r0;
  const t = (Number(v) - a) / span;
  const tt = Number.isFinite(t) ? t : 0;
  return r0 + tt * (r1 - r0);
}

// 对数映射：负值按 0 处理，v<=0 时给到最左端（避免 Math.log(0) = -Infinity）
export function logScale(v, d0, d1, r0, r1) {
  const lo = Math.max(Number(d0) || 0, 0);
  const hi = Math.max(Number(d1) || 0, 0);
  const n = Math.max(Number(v) || 0, 0);
  const l0 = Math.log10(lo + 1);
  const l1 = Math.log10(hi + 1);
  if (!Number.isFinite(l0) || !Number.isFinite(l1) || l1 === l0) return r0;
  const t = clamp((Math.log10(n + 1) - l0) / (l1 - l0), 0, 1);
  return r0 + t * (r1 - r0);
}

// 「好看」的刻度值：1 / 2 / 5 / 10 阶梯
export function niceTicks(min, max, count = 5) {
  const lo = Number(min) || 0;
  const hi = Number(max) || 0;
  if (!(hi > lo)) return [lo];
  const n = Math.max(2, Math.min(12, Number(count) || 5));
  const raw = (hi - lo) / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.ceil(lo / step) * step;
  const out = [];
  for (let v = start; v <= hi + step * 1e-6 && out.length < 40; v += step) {
    out.push(Number(v.toFixed(10)));
  }
  return out.length ? out : [lo];
}

// 分箱直方图：返回每箱的上下界与计数（空数组 / 单值 / 全 0 都安全）
export function binValues(nums, bins = 8) {
  const list = (Array.isArray(nums) ? nums : [])
    .filter((v) => v !== null && v !== undefined && v !== '')
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));
  const n = Math.max(1, Math.min(64, Number(bins) || 8));
  if (!list.length) return { bins: [], min: 0, max: 0, total: 0 };
  let min = Math.min(...list);
  let max = Math.max(...list);
  if (min === max) { min -= 0.5; max += 0.5; }
  const step = (max - min) / n;
  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.push({ from: min + i * step, to: min + (i + 1) * step, count: 0 });
  }
  list.forEach((v) => {
    let idx = Math.floor((v - min) / step);
    if (!Number.isFinite(idx)) idx = 0;
    if (idx < 0) idx = 0;
    if (idx >= n) idx = n - 1;
    out[idx].count += 1;
  });
  return { bins: out, min, max, total: list.length };
}

/* ============================================================
   三、旭日图布局
   ============================================================ */

// data: [{ label, value, color?, children?: [{ label, value, color? }] }]
// 返回扁平化的弧段列表（内环 = 一级，外环 = 二级），角度从 12 点方向顺时针铺开
export function sunburstLayout(data, opts = {}) {
  const cx = Number(opts.cx) || 0;
  const cy = Number(opts.cy) || 0;
  const R = Number(opts.r) || 1;
  const rInner = (Number.isFinite(opts.rInner) ? opts.rInner : 0.30) * R;
  const rMid = (Number.isFinite(opts.rMid) ? opts.rMid : 0.60) * R;
  const rOuter = (Number.isFinite(opts.rOuter) ? opts.rOuter : 1) * R;
  const gapDeg = Number.isFinite(opts.gapDeg) ? opts.gapDeg : 0.6;

  const list = (Array.isArray(data) ? data : []).filter((d) => d && Number(d.value) > 0);
  const total = list.reduce((s, d) => s + Number(d.value), 0);
  if (!list.length || !(total > 0)) return { arcs: [], total: 0, legend: [] };

  const arcs = [];
  let angle = -90; // 从 12 点方向开始
  list.forEach((d, i) => {
    const value = Number(d.value);
    const color = d.color || CHART_COLORS[i % CHART_COLORS.length];
    const span = (value / total) * 360;
    const a0 = angle + gapDeg / 2;
    const a1 = angle + span - gapDeg / 2;
    if (a1 > a0) {
      arcs.push({
        key: `l1-${i}`, depth: 1, label: d.label, value, color,
        a0, a1, r0: rInner, r1: rMid, share: value / total, parentLabel: null, index: i
      });
    }

    const kids = (Array.isArray(d.children) ? d.children : []).filter((k) => k && Number(k.value) > 0);
    const kidSum = kids.reduce((s, k) => s + Number(k.value), 0);
    if (kids.length && span > 1.2) {
      let cursor = angle;
      kids.forEach((k, j) => {
        const kv = Number(k.value);
        const ks = kidSum > 0 ? (kv / kidSum) * span : span / kids.length;
        const b0 = cursor + gapDeg / 2;
        const b1 = cursor + ks - gapDeg / 2;
        if (b1 > b0) {
          arcs.push({
            key: `l1-${i}-l2-${j}`, depth: 2, label: k.label, value: kv,
            color: k.color || shade(color, 0.16 + 0.14 * (j % 3)),
            a0: b0, a1: b1, r0: rMid + R * 0.012, r1: rOuter,
            share: kidSum > 0 ? kv / total : 0, parentLabel: d.label, index: i
          });
        }
        cursor += ks;
      });
    }
    angle += span;
  });

  return {
    arcs,
    total,
    legend: list.map((d, i) => ({
      label: d.label, value: Number(d.value), color: d.color || CHART_COLORS[i % CHART_COLORS.length]
    }))
  };
}

/* ============================================================
   四、热力矩阵 / 堆叠河流 / 雷达 / 气泡（纯函数）
   ============================================================ */

export function matrixDomain(values) {
  const flat = [];
  (Array.isArray(values) ? values : []).forEach((row) => {
    (Array.isArray(row) ? row : []).forEach((v) => {
      const n = Number(v);
      if (Number.isFinite(n)) flat.push(n);
    });
  });
  if (!flat.length) return { min: 0, max: 0, span: 0 };
  const min = Math.min(...flat);
  const max = Math.max(...flat);
  return { min, max, span: max - min };
}

// 归一化到 0..1；全等值 / 全 0 / 空表都安全（不会 NaN）
export function matrixNorm(values) {
  const rows = Array.isArray(values) ? values : [];
  const { min, max, span } = matrixDomain(rows);
  return rows.map((row) => (Array.isArray(row) ? row : []).map((v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    if (!(span > 0)) return max > 0 ? 1 : 0;
    return clamp((n - min) / span, 0, 1);
  }));
}

// series: [{ label, color?, points: [{ x, y }] }]
// 把所有 series 的 x 取并集对齐（缺失补 0），再算累积堆叠基线
export function stackSeries(series) {
  const list = (Array.isArray(series) ? series : []).filter(Boolean);
  const set = new Set();
  list.forEach((s) => (Array.isArray(s.points) ? s.points : []).forEach((p) => {
    if (p && p.x != null) set.add(String(p.x));
  }));
  const xs = [...set].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const idx = new Map(xs.map((x, i) => [x, i]));
  const norm = list.map((s, i) => {
    const values = new Array(xs.length).fill(0);
    (Array.isArray(s.points) ? s.points : []).forEach((p) => {
      if (!p || p.x == null) return;
      const j = idx.get(String(p.x));
      if (j == null) return;
      const y = Number(p.y);
      values[j] = Number.isFinite(y) ? y : 0;
    });
    return {
      label: s.label, color: s.color || CHART_COLORS[i % CHART_COLORS.length],
      values, cum0: values.slice(), cum1: values.slice()
    };
  });
  // 累积：第 k 条的上界 = 前 k 条（含自己）之和，下界 = 前 k-1 条之和
  const running = new Array(xs.length).fill(0);
  norm.forEach((s) => {
    const lower = running.slice();
    for (let j = 0; j < xs.length; j += 1) running[j] += s.values[j];
    s.cum0 = lower;
    s.cum1 = running.slice();
  });
  const max = running.length ? Math.max(...running) : 0;
  return { xs, series: norm, max: Number.isFinite(max) ? max : 0 };
}

// Catmull-Rom → 三次贝塞尔，得到平滑折线（河流图的柔和边缘）
export function smoothPath(points) {
  const pts = (Array.isArray(points) ? points : [])
    .filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (!pts.length) return '';
  const n = (v) => (Math.abs(v) < 1e-6 ? 0 : v).toFixed(2);
  if (pts.length === 1) return `M ${n(pts[0][0])} ${n(pts[0][1])}`;
  if (pts.length === 2) return `M ${n(pts[0][0])} ${n(pts[0][1])} L ${n(pts[1][0])} ${n(pts[1][1])}`;
  let d = `M ${n(pts[0][0])} ${n(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${n(c1x)} ${n(c1y)} ${n(c2x)} ${n(c2y)} ${n(p2[0])} ${n(p2[1])}`;
  }
  return d;
}

// 雷达：axes: [{ label, value }]，max 为归一化上限（缺省取最大值，全 0 时取 1）
export function radarPoints(axes, max, cx, cy, r) {
  const list = (Array.isArray(axes) ? axes : []).filter(Boolean);
  const values = list.map((a) => (Number.isFinite(Number(a.value)) ? Number(a.value) : 0));
  const autoMax = Math.max(...values, 0);
  const top = Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : (autoMax > 0 ? autoMax : 1);
  const n = list.length;
  if (!n) return { points: [], top, coords: [] };
  const coords = list.map((a, i) => {
    const angle = -90 + (360 * i) / n;
    const ratio = clamp((Number(a.value) || 0) / top, 0, 1);
    const [x, y] = polarToXY(cx, cy, r * ratio, angle);
    const [ax, ay] = polarToXY(cx, cy, r, angle);
    return { x, y, ax, ay, ratio, label: a.label, value: Number(a.value) || 0 };
  });
  return { points: coords.map((c) => [c.x, c.y]), top, coords };
}

// 对数轴刻度：按 10 的幂铺；跨度太小时退回线性刻度，保证不是空轴
export function logTicks(min, max) {
  const lo = Math.max(0, Number(min) || 0);
  const hi = Math.max(lo, Number(max) || 0);
  if (hi <= 0) return [0];
  const out = [];
  const start = Math.floor(Math.log10(Math.max(lo, 1)));
  const end = Math.ceil(Math.log10(hi + 1));
  for (let e = start; e <= end && out.length < 12; e += 1) {
    const v = Math.pow(10, e);
    if (v >= lo * 0.9 && v <= hi * 1.1) out.push(v);
  }
  return out.length >= 2 ? out : niceTicks(lo, hi, 4);
}

// 气泡图布局：x / y 两个数值维度 + size 体量维度；logX / logY 控制是否对数轴
export function bubbleLayout(points, opts = {}) {
  const width = Number(opts.width) || 600;
  const height = Number(opts.height) || 340;
  const padL = Number.isFinite(opts.padL) ? opts.padL : 54;
  const padR = Number.isFinite(opts.padR) ? opts.padR : 22;
  const padT = Number.isFinite(opts.padT) ? opts.padT : 22;
  const padB = Number.isFinite(opts.padB) ? opts.padB : 42;
  const logX = !!opts.logX;
  const logY = !!opts.logY;
  const list = (Array.isArray(points) ? points : [])
    .filter((p) => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)));

  const xs = list.map((p) => Number(p.x));
  const ys = list.map((p) => Number(p.y));
  const sizes = list.map((p) => Math.max(0, Number(p.size) || 0));
  const xMin = xs.length ? Math.min(...xs) : 0;
  const xMax = xs.length ? Math.max(...xs) : 1;
  const yMin = ys.length ? Math.min(...ys) : 0;
  const yMax = ys.length ? Math.max(...ys) : 1;
  const sMax = sizes.length ? Math.max(...sizes, 0) : 0;

  const plotW = Math.max(10, width - padL - padR);
  const plotH = Math.max(10, height - padT - padB);
  const xLo = xMin === xMax ? xMin - 1 : xMin;
  const xHi = xMin === xMax ? xMax + 1 : xMax;
  const yLo = yMin === yMax ? yMin - 1 : yMin;
  const yHi = yMin === yMax ? yMax + 1 : yMax;

  const px = (v) => (logX ? logScale(v, xLo, xHi, padL, padL + plotW) : linearScale(v, xLo, xHi, padL, padL + plotW));
  const py = (v) => (logY ? logScale(v, yLo, yHi, padT + plotH, padT) : linearScale(v, yLo, yHi, padT + plotH, padT));

  const rMin = Number.isFinite(opts.rMin) ? opts.rMin : 3.5;
  const rMax = Number.isFinite(opts.rMax) ? opts.rMax : 22;
  const radius = (s) => {
    if (!(sMax > 0)) return rMin;
    const t = Math.sqrt(clamp((Number(s) || 0) / sMax, 0, 1));
    return rMin + t * (rMax - rMin);
  };

  const bubbles = list.map((p, i) => ({
    ...p,
    index: i,
    cx: px(Number(p.x)),
    cy: py(Number(p.y)),
    r: radius(Number(p.size) || 0)
  }));

  const xTicks = logX ? logTicks(xLo, xHi) : niceTicks(xLo, xHi, 5);
  const yTicks = logY ? logTicks(yLo, yHi) : niceTicks(yLo, yHi, 4);

  return {
    bubbles, px, py, plotW, plotH, padL, padT, padR, padB,
    xTicks, yTicks, xMin, xMax, yMin, yMax, sizeMax: sMax,
    xAt: (t) => px(t), yAt: (t) => py(t)
  };
}

/* ============================================================
   五、组件内部的小工具（测量 / 入场动画 / tooltip）
   ============================================================ */

function prefersReduced() {
  try {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// 入场动画：挂载后翻一次布尔量，由 CSS transition 完成生长；减弱动效时直接给终态
function useReveal() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (prefersReduced()) { setShown(true); return undefined; }
    let raf = 0;
    raf = requestAnimationFrame(() => { raf = requestAnimationFrame(() => setShown(true)); });
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, []);
  return shown;
}

// 读容器宽度（响应式 viewBox）；不支持 ResizeObserver 时退回窗口 resize
function useMeasure(fallback = 720) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
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
  }, []);
  return [ref, width];
}

// 悬停 tooltip：bind(html) 生成鼠标事件，el 是要渲染的浮层
function useTooltip() {
  const [tip, setTip] = useState(null);
  const show = (e, html) => {
    const target = e && e.currentTarget;
    const host = target && (target.ownerSVGElement ? target.ownerSVGElement.parentNode : target.parentNode);
    const box = host && host.getBoundingClientRect ? host.getBoundingClientRect() : null;
    const clientX = (e && e.clientX) || 0;
    const clientY = (e && e.clientY) || 0;
    setTip({
      html,
      x: box ? clientX - box.left : clientX,
      y: box ? clientY - box.top : clientY
    });
  };
  const hide = () => setTip(null);
  // extra 用来追加自定义处理器（例如悬停高亮）；注意必须合并，不能靠后面的展开覆盖
  const bind = (html, extra) => ({
    onMouseEnter: (e) => { show(e, html); if (extra && extra.onMouseEnter) extra.onMouseEnter(e); },
    onMouseMove: (e) => show(e, html),
    onMouseLeave: (e) => { hide(); if (extra && extra.onMouseLeave) extra.onMouseLeave(e); }
  });
  const el = tip ? (
    <div class="sc-tip" style={{ left: `${tip.x}px`, top: `${tip.y}px` }}>{tip.html}</div>
  ) : null;
  return { tip, bind, el, hide };
}

function Empty({ height, text }) {
  return (
    <div class="sc-empty" style={{ minHeight: `${Math.max(90, (Number(height) || 200) - 60)}px` }}>
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 19V9m5 10V5m5 14v-7m5 7V8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="0.55" />
      </svg>
      <span>{text || '暂无数据'}</span>
    </div>
  );
}

function Legend({ items, limit = 12 }) {
  const list = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!list.length) return null;
  const shown = list.slice(0, limit);
  return (
    <ul class="sc-legend">
      {shown.map((it, i) => (
        <li key={`${it.label}-${i}`}>
          <i style={{ background: it.color || CHART_COLORS[i % CHART_COLORS.length] }} />
          <span>{it.label}</span>
          {it.value != null && <b>{fmtNum(it.value)}</b>}
        </li>
      ))}
      {list.length > shown.length && <li class="sc-legend-more">+{list.length - shown.length}</li>}
    </ul>
  );
}

/* ============================================================
   六、样式（模块内注入一次，避免改 starmap.css）
   ============================================================ */

const CSS = `
.sc-board{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--card-gap,20px);width:100%}
.sc-card{position:relative;display:flex;flex-direction:column;gap:var(--sp-5,16px);
  padding:var(--sp-6,20px) var(--sp-6,20px) var(--sp-5,16px);
  border-radius:var(--radius,16px);border:1px solid var(--glass-border,var(--border));
  background:var(--glass-bg-strong,var(--bg-elevated));backdrop-filter:blur(var(--glass-blur,22px));
  box-shadow:var(--shadow-sm);overflow:hidden}
.sc-card::before{content:'';position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(120% 80% at 100% 0%,color-mix(in srgb,var(--primary) 9%,transparent),transparent 60%)}
.sc-card-wide{grid-column:span 2}
.sc-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--sp-5,16px);flex-wrap:wrap}
.sc-card-title{margin:0;font-family:var(--font-display);font-weight:500;letter-spacing:var(--track-display);
  font-size:var(--fs-h3,20px);color:var(--text);line-height:1.25}
.sc-card-sub{margin:4px 0 0;font-size:var(--fs-sm,13px);color:var(--text-muted);line-height:1.5;max-width:70ch}
.sc-card-body{position:relative;min-width:0}
.sc-note{margin:0;font-size:var(--fs-caption,12px);color:var(--text-muted);font-family:var(--font-mono);
  letter-spacing:var(--track-mono,.06em);opacity:.85}
.sc-legend{display:flex;flex-wrap:wrap;gap:6px 14px;margin:0;padding:0;list-style:none;max-width:100%}
.sc-legend li{display:inline-flex;align-items:center;gap:6px;font-size:var(--fs-caption,12px);
  color:var(--text-muted);white-space:nowrap}
.sc-legend li i{width:9px;height:9px;border-radius:3px;flex:none;box-shadow:0 0 0 1px rgba(0,0,0,.06) inset}
.sc-legend li b{font-family:var(--font-mono);font-weight:500;color:var(--text);opacity:.75}
.sc-legend-more{font-family:var(--font-mono);opacity:.7}
.sc-svg{display:block;width:100%;height:auto;overflow:visible}
.sc-tip{position:absolute;z-index:5;transform:translate(-50%,-118%);pointer-events:none;
  padding:7px 10px;border-radius:var(--radius-sm,10px);font-size:var(--fs-caption,12px);line-height:1.45;
  background:color-mix(in srgb,var(--bg-elevated) 94%,transparent);color:var(--text);
  border:1px solid var(--glass-border,var(--border));box-shadow:var(--shadow-md);white-space:nowrap;max-width:300px}
.sc-tip b{font-family:var(--font-mono);font-weight:600}
.sc-tip i{font-style:normal;opacity:.72}
.sc-inline-legend{margin-top:10px}
.sc-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
  color:var(--text-muted);font-size:var(--fs-sm,13px);border-radius:var(--radius-sm,10px);
  background:color-mix(in srgb,var(--bg-subtle) 55%,transparent);border:1px dashed var(--border)}
.sc-axis-t{font-family:var(--font-mono);font-size:10.5px;fill:var(--text-muted);letter-spacing:.04em}
.sc-axis-l{font-family:var(--font-ui);font-size:11.5px;fill:var(--text-muted)}
.sc-arc{transition:opacity .5s var(--ease-out),transform .45s var(--ease-out);cursor:default}
.sc-bar-fill,.sc-reveal{transition:opacity .6s var(--ease-out),transform .85s var(--ease-out)}

/* —— 统计图质感升级（2026-10-11，用户要求：除星空图外的统计图都要「高级感」）——
   ① 错峰入场：图形元素带 .sc-anim / .sc-line，用 --i 算出 animation-delay。
   ② 悬停：轻微放大 + 提亮 + cursor:pointer；数值提示优先用组件自带 tooltip，
      没有的用 <title> 原生提示兜底。
   ③ 质感：网格 / 坐标轴走「发丝线」，数值走等宽 + tabular-nums，
      图表容器加一层极淡的内阴影 / 渐变底。
   颜色一律来自主题变量或组件已有色板，不写死新颜色（三套主题才协调）。
   关键点：入场动画用 animation + backwards 填充，动画结束后属性交还给内联样式 /
   :hover —— 不能用 forwards，否则动画会锁死 transform，:hover 的 scale 失效。 */
.sc-grid{stroke-width:1;vector-effect:non-scaling-stroke}
/* 统一用 transform-box: fill-box（以元素自身包围盒为参照），
   这样柱从底部、扇形 / 气泡 / 点从中心长出，不需要逐个手算 px 原点。 */
.sc-anim{transform-box:fill-box;transform-origin:bottom;
  animation:sc-grow-y .62s var(--ease-out) backwards;animation-delay:calc(var(--i,0) * 60ms)}
.sc-anim.sc-bar{transform-origin:left center;animation-name:sc-grow-x}
.sc-anim.sc-arc,.sc-anim.sc-bub,.sc-anim.sc-pt,.sc-anim.sc-cell{transform-origin:center;animation-name:sc-grow-c}
.sc-line{stroke-dasharray:1;animation:sc-draw .95s var(--ease-out) backwards;
  animation-delay:calc(var(--i,0) * 60ms)}
@keyframes sc-grow-y{from{opacity:0;transform:scaleY(.02)}to{opacity:1;transform:scaleY(1)}}
@keyframes sc-grow-x{from{opacity:0;transform:scaleX(.02)}to{opacity:1;transform:scaleX(1)}}
@keyframes sc-grow-c{from{opacity:0;transform:scale(.2)}to{opacity:1;transform:scale(1)}}
@keyframes sc-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
.sc-arc,.sc-bar,.sc-cell,.sc-bub,.sc-pt,.sc-gauge,.sc-row{transition:transform .25s var(--ease-out),filter .25s var(--ease-out),opacity .25s var(--ease-out)}
.sc-arc,.sc-cell,.sc-bub,.sc-pt,.sc-gauge,.sc-row{cursor:pointer}
.sc-arc:hover,.sc-cell:hover,.sc-bub:hover,.sc-pt:hover{transform:scale(1.05);filter:brightness(1.14)}
.sc-bar:hover{transform:scale(1.015);filter:brightness(1.12)}
.sc-gauge:hover,.sc-row:hover{transform:scale(1.03)}
.sc-cell,.sc-row,.sc-gauge{transform-box:fill-box}
.sc-cell{transform-origin:center}
.sc-row{transform-origin:left center}
.sc-gauge{transform-origin:center}
.sc-card-body{border-radius:var(--radius-sm,10px);
  background:linear-gradient(180deg,color-mix(in srgb,var(--bg-subtle) 60%,transparent),transparent 70%);
  box-shadow:inset 0 1px 0 color-mix(in srgb,var(--text) 5%,transparent)}
.sc-axis-t,.sc-tip b,.sc-tip i{font-variant-numeric:tabular-nums}
@media (max-width:900px){.sc-board{grid-template-columns:minmax(0,1fr)}.sc-card-wide{grid-column:span 1}}
@media (prefers-reduced-motion:reduce){
  .sc-arc,.sc-bar-fill,.sc-reveal,.sc-bar,.sc-cell,.sc-bub,.sc-pt,.sc-gauge,.sc-row{transition:none !important}
  .sc-anim,.sc-line{animation:none !important}
}
`;

let cssInjected = false;
function useChartCss() {
  useEffect(() => {
    if (cssInjected || typeof document === 'undefined') return;
    if (document.getElementById('stat-charts-css')) { cssInjected = true; return; }
    cssInjected = true;
    const el = document.createElement('style');
    el.id = 'stat-charts-css';
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}

/* ============================================================
   七、卡片容器与看板
   ============================================================ */

export function StatCard({ title, sub, legend, wide, children, note }) {
  useChartCss();
  const legendItems = useMemo(() => {
    if (!Array.isArray(legend) || !legend.length) return null;
    return legend.map((it, i) => (typeof it === 'string'
      ? { label: it, color: CHART_COLORS[i % CHART_COLORS.length] }
      : { label: it && it.label, color: (it && it.color) || CHART_COLORS[i % CHART_COLORS.length], value: it && it.value }));
  }, [legend]);

  return (
    <section class={`sc-card${wide ? ' sc-card-wide' : ''}`}>
      {(title || sub || legendItems) && (
        <header class="sc-card-head">
          <div>
            {title && <h3 class="sc-card-title">{title}</h3>}
            {sub && <p class="sc-card-sub">{sub}</p>}
          </div>
          <Legend items={legendItems} />
        </header>
      )}
      <div class="sc-card-body">{children}</div>
      {note && <p class="sc-note">{note}</p>}
    </section>
  );
}

export function StatBoard({ children, ariaLabel }) {
  useChartCss();
  return <div class="sc-board" role="group" aria-label={ariaLabel || '统计看板'}>{children}</div>;
}

/* ============================================================
   八、旭日 / 玫瑰图（多维层级）
   ============================================================ */

export function SunburstChart({ data, height = 300, ariaLabel }) {
  useChartCss();
  const [ref, width] = useMeasure(560);
  const shown = useReveal();
  const { bind, el, hide } = useTooltip();
  const [hot, setHot] = useState(null);

  const size = Math.max(200, Number(height) || 300);
  const w = Math.max(240, width);
  const cx = w / 2;
  const cy = size / 2;
  const R = Math.max(40, Math.min(w, size) / 2 - 26);
  const layout = useMemo(() => sunburstLayout(data, {
    cx, cy, r: R, rInner: 0.30, rMid: 0.60, rOuter: 1
  }), [data, cx, cy, R]);

  useEffect(() => { hide(); }, [data]);

  if (!layout.arcs.length) {
    return <div ref={ref}><Empty height={size} text="暂无可统计的数据" /></div>;
  }

  const labelOf = (a) => (a.depth === 1 ? a.label : `${a.parentLabel} › ${a.label}`);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg class="sc-svg" viewBox={`0 0 ${w} ${size}`} role="img" aria-label={ariaLabel || '旭日图'}>
        <g class="sc-reveal" style={{
          transformOrigin: `${cx}px ${cy}px`,
          transform: shown ? 'scale(1)' : 'scale(0.72)',
          opacity: shown ? 1 : 0
        }}>
          {layout.arcs.map((a, i) => {
            const d = annularSectorPath(cx, cy, a.r0, a.r1, a.a0, a.a1);
            if (!d) return null;
            const dim = hot != null && hot !== a.key;
            return (
              <path
                key={a.key}
                class="sc-arc sc-anim"
                d={d}
                fill={a.color}
                fill-opacity={a.depth === 1 ? 0.9 : 0.72}
                stroke="color-mix(in srgb, var(--bg-elevated) 70%, transparent)"
                stroke-width="1"
                style={{
                  '--i': i,
                  opacity: dim ? 0.34 : 1
                }}
                {...bind(
                  <><b>{labelOf(a)}</b><br /><i>数量 {fmtNum(a.value)} · 占比 {(a.share * 100).toFixed(1)}%</i></>,
                  { onMouseEnter: () => setHot(a.key), onMouseLeave: () => setHot(null) }
                )}
              >
                {/* 原生提示兜底：鼠标悬停（含触摸设备长按）时显示，零依赖 */}
                <title>{`${labelOf(a)}: ${fmtNum(a.value)}（${(a.share * 100).toFixed(1)}%）`}</title>
              </path>
            );
          })}
          {layout.arcs.filter((a) => a.depth === 1 && (a.a1 - a.a0) > 16).map((a) => {
            const mid = (a.a0 + a.a1) / 2;
            const [lx, ly] = polarToXY(cx, cy, (a.r0 + a.r1) / 2, mid);
            return (
              <text key={`t-${a.key}`} x={lx} y={ly} text-anchor="middle" dominant-baseline="middle"
                class="sc-axis-l" style="pointer-events:none;fill:var(--bg-elevated);font-weight:600">
                {truncate(a.label, (a.a1 - a.a0) > 60 ? 10 : 5)}
              </text>
            );
          })}
        </g>
        <circle cx={cx} cy={cy} r={Math.max(24, R * 0.26)} fill="var(--bg-elevated)" fill-opacity="0.92" />
        <text x={cx} y={cy - 5} text-anchor="middle" class="sc-axis-t" style="font-size:15px;fill:var(--text)">
          {fmtNum(layout.total)}
        </text>
        <text x={cx} y={cy + 12} text-anchor="middle" class="sc-axis-t" style="font-size:10px">合计</text>
      </svg>
      {el}
    </div>
  );
}

/* ============================================================
   九、二维热力矩阵
   ============================================================ */

export function MatrixHeat({ rows, cols, values, rowLabel, colLabel, height = 320, ariaLabel }) {
  useChartCss();
  const [ref, width] = useMeasure(560);
  const { bind, el } = useTooltip();

  const rowList = useMemo(() => (Array.isArray(rows) ? rows.map(String) : []), [rows]);
  const colList = useMemo(() => (Array.isArray(cols) ? cols.map(String) : []), [cols]);
  const norm = useMemo(() => matrixNorm(values), [values]);
  const w = Math.max(300, width);
  const h = Math.max(180, Number(height) || 320);
  const compact = w < 720;

  if (!rowList.length || !colList.length) {
    return <div ref={ref}><Empty height={h} text="暂无交叉统计" /></div>;
  }

  const padL = compact ? 74 : 104;
  const padR = 16;
  const padT = 30;
  const padB = 40;
  const gridW = Math.max(40, w - padL - padR);
  const gridH = Math.max(40, h - padT - padB);
  const cw = gridW / colList.length;
  const ch = gridH / rowList.length;
  const cellGap = Math.min(6, Math.max(1.5, cw * 0.08));
  const showValue = cw > 34 && ch > 18;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg class="sc-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={ariaLabel || '热力矩阵'}>
        {colLabel && <text x={padL} y={12} class="sc-axis-t">{colLabel}</text>}
        {rowLabel && <text x={padL - 8} y={padT - 14} text-anchor="end" class="sc-axis-t">{rowLabel}</text>}
        {colList.map((c, ci) => (
          <text key={`c-${ci}`} x={padL + ci * cw + cw / 2} y={padT - 8}
            text-anchor="middle" class="sc-axis-l">{truncate(c, compact ? 4 : 8)}</text>
        ))}
        {rowList.map((r, ri) => (
          <text key={`r-${ri}`} x={padL - 8} y={padT + ri * ch + ch / 2 + 4}
            text-anchor="end" class="sc-axis-l">{truncate(r, compact ? 5 : 9)}</text>
        ))}
        {rowList.map((r, ri) => colList.map((c, ci) => {
          const v = Number(values && values[ri] ? values[ri][ci] : 0) || 0;
          const t = norm[ri] ? (norm[ri][ci] || 0) : 0;
          const color = CHART_COLORS[ci % CHART_COLORS.length];
          const x = padL + ci * cw + cellGap / 2;
          const y = padT + ri * ch + cellGap / 2;
          const bw = Math.max(2, cw - cellGap);
          const bh = Math.max(2, ch - cellGap);
          return (
            <g key={`cell-${ri}-${ci}`}
              class="sc-cell sc-anim"
              style={{
                '--i': ri * colList.length + ci
              }}
              {...bind(<><b>{r}</b> × <b>{c}</b><br /><i>{rowLabel || '数量'} {fmtNum(v)}</i></>)}>
              <rect x={x} y={y} width={bw} height={bh} rx={Math.min(6, bw / 3)}
                fill={color} fill-opacity={v > 0 ? 0.16 + 0.74 * t : 0.05}
                stroke="color-mix(in srgb, var(--border) 60%, transparent)" stroke-width="0.6">
                <title>{`${r} × ${c}: ${fmtNum(v)}`}</title>
              </rect>
              {showValue && v > 0 && (
                <text x={x + bw / 2} y={y + bh / 2 + 3.5} text-anchor="middle" class="sc-axis-t"
                  style={`font-size:10px;fill:${t > 0.55 ? '#fff' : 'var(--text)'}`}>{fmtNum(v)}</text>
              )}
            </g>
          );
        }))}
      </svg>
      {el}
    </div>
  );
}

/* ============================================================
   十、流式面积图 / 河流图
   ============================================================ */

export function StreamArea({ series, height = 300, ariaLabel }) {
  useChartCss();
  const [ref, width] = useMeasure(720);
  const shown = useReveal();
  const { bind, el } = useTooltip();
  const [hot, setHot] = useState(null);
  const stacked = useMemo(() => stackSeries(series), [series]);

  const h = Math.max(160, Number(height) || 300);
  const w = Math.max(320, width);
  const padL = 46;
  const padR = 18;
  const padT = 18;
  const padB = 34;
  const plotW = Math.max(40, w - padL - padR);
  const plotH = Math.max(40, h - padT - padB);
  const xs = stacked.xs;
  const list = stacked.series;
  const max = stacked.max;

  if (!xs.length || !list.length) {
    return <div ref={ref}><Empty height={h} text="暂无时间序列数据" /></div>;
  }

  const top = max > 0 ? max : 1;
  const X = (i) => (xs.length === 1 ? padL + plotW / 2 : padL + (i / (xs.length - 1)) * plotW);
  const Y = (v) => padT + plotH - (clamp(v, 0, top) / top) * plotH;
  const ticks = niceTicks(0, top, 4);
  const step = Math.max(1, Math.ceil(xs.length / (w < 720 ? 5 : 9)));
  const bandW = Math.max(6, plotW / Math.max(1, xs.length));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg class="sc-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={ariaLabel || '流式面积图'}>
        <defs>
          {list.map((s, i) => (
            <linearGradient key={`g-${i}`} id={`sc-stream-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color={s.color} stop-opacity="0.85" />
              <stop offset="100%" stop-color={s.color} stop-opacity="0.35" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t) => (
          <g key={`tk-${t}`}>
            <line class="sc-grid" x1={padL} x2={padL + plotW} y1={Y(t)} y2={Y(t)} stroke={NEUTRAL.grid} stroke-width="1" />
            <text x={padL - 8} y={Y(t) + 3.5} text-anchor="end" class="sc-axis-t">{fmtNum(t)}</text>
          </g>
        ))}
        {xs.map((x, i) => (i % step === 0 ? (
          <text key={`x-${i}`} x={X(i)} y={h - 12} text-anchor="middle" class="sc-axis-t">{truncate(x, 8)}</text>
        ) : null))}
        {list.slice().reverse().map((s, ri) => {
          const idx = list.length - 1 - ri;
          const upper = s.cum1.map((v, i) => [X(i), Y(v)]);
          const lower = s.cum0.map((v, i) => [X(i), Y(v)]).reverse();
          const tail = lower.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' L ');
          const d = `${smoothPath(upper)} L ${tail} Z`;
          return (
            <g key={`a-${idx}`}>
              {/* 面积块：轻微上浮淡入 */}
              <path d={d} fill={`url(#sc-stream-${idx})`}
                stroke={s.color} stroke-opacity="0.5" stroke-width="1"
                class="sc-reveal"
                style={{
                  opacity: shown ? 1 : 0,
                  transform: shown ? 'translateY(0)' : 'translateY(14px)',
                  transitionDelay: `${idx * 90}ms`
                }}>
                <title>{`${s.label}：峰值 ${fmtNum(Math.max(...s.values, 0))}`}</title>
              </path>
              {/* 顶缘折线：stroke-dasharray + stroke-dashoffset 从 0 画出 */}
              <path class="sc-line" d={smoothPath(upper)} fill="none" pathLength="1"
                stroke={s.color} stroke-width="1.6" stroke-linecap="round"
                style={{ '--i': idx }} />
            </g>
          );
        })}
        {xs.map((x, i) => (
          <rect key={`hit-${i}`} class="sc-band" x={X(i) - bandW / 2} y={padT}
            width={bandW} height={plotH} fill="transparent"
            {...bind(
              <>
                <b>{x}</b><br />
                {list.map((s, si) => (
                  <span key={`tt-${si}`}>
                    <i style={`display:inline-block;width:7px;height:7px;border-radius:2px;background:${s.color};margin-right:5px`} />
                    {s.label} <b>{fmtNum(s.values[i])}</b><br />
                  </span>
                ))}
              </>
            , { onMouseEnter: () => setHot(i), onMouseLeave: () => setHot(null) })}>
            <title>{`${x}：${list.map((s) => `${s.label} ${fmtNum(s.values[i])}`).join(' · ')}`}</title>
          </rect>
        ))}
        {/* 悬停时的竖直参考线 + 各系列数值点（比原生 title 更直观） */}
        {hot != null && xs[hot] != null && (
          <g class="sc-hover-guide" style="pointer-events:none">
            <line x1={X(hot)} x2={X(hot)} y1={padT} y2={padT + plotH}
              stroke="color-mix(in srgb, var(--text) 26%, transparent)" stroke-width="1" stroke-dasharray="3 3" />
            {list.map((s, si) => (
              <circle key={`hp-${si}`} cx={X(hot)} cy={Y(s.cum1[hot] || 0)} r="3.5"
                fill={s.color} stroke="var(--bg-elevated)" stroke-width="1.2" />
            ))}
          </g>
        )}
      </svg>
      <div class="sc-inline-legend">
        <Legend items={list.map((s) => ({ label: s.label, color: s.color }))} />
      </div>
      {el}
    </div>
  );
}

/* ============================================================
   十一、气泡矩阵（两数值维度 + 体量维度）
   ============================================================ */

export function BubbleMatrix({ points, xLabel, yLabel, sizeLabel, logX = false, logY = false, height = 340, ariaLabel }) {
  useChartCss();
  const [ref, width] = useMeasure(720);
  const shown = useReveal();
  const { bind, el } = useTooltip();
  const [hot, setHot] = useState(null);

  const h = Math.max(200, Number(height) || 340);
  const w = Math.max(320, width);
  const compact = w < 720;
  const layout = useMemo(() => bubbleLayout(points, {
    width: w, height: h, logX, logY,
    padL: compact ? 44 : 56, padR: 20, padT: 22, padB: compact ? 38 : 46,
    rMin: 4, rMax: compact ? 16 : 24
  }), [points, w, h, logX, logY, compact]);

  const list = layout.bubbles;
  if (!list.length) {
    return <div ref={ref}><Empty height={h} text="暂无可绘制的数据点" /></div>;
  }
  // 只给体量最大的若干个点画标签，避免糊成一团
  const labeled = new Set(list.slice()
    .sort((a, b) => (Number(b.size) || 0) - (Number(a.size) || 0))
    .slice(0, compact ? 4 : 8)
    .map((b) => b.index));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg class="sc-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={ariaLabel || '气泡矩阵'}>
        {xLabel && <text x={w - 10} y={h - 6} text-anchor="end" class="sc-axis-t">{xLabel}</text>}
        {yLabel && <text x={8} y={13} class="sc-axis-t">{yLabel}</text>}
        {layout.yTicks.map((t) => (
          <g key={`yt-${t}`}>
            <line class="sc-grid" x1={layout.padL} x2={w - layout.padR} y1={layout.yAt(t)} y2={layout.yAt(t)}
              stroke={NEUTRAL.grid} stroke-width="1" />
            <text x={layout.padL - 8} y={layout.yAt(t) + 3.5} text-anchor="end" class="sc-axis-t">{fmtNum(t)}</text>
          </g>
        ))}
        {layout.xTicks.map((t) => (
          <g key={`xt-${t}`}>
            <line class="sc-grid" x1={layout.xAt(t)} x2={layout.xAt(t)} y1={layout.padT} y2={h - layout.padB}
              stroke={NEUTRAL.grid} stroke-width="1" stroke-dasharray="2 4" />
            <text x={layout.xAt(t)} y={h - layout.padB + 16} text-anchor="middle" class="sc-axis-t">{fmtNum(t)}</text>
          </g>
        ))}
        <line class="sc-grid" x1={layout.padL} x2={w - layout.padR} y1={h - layout.padB} y2={h - layout.padB} stroke={NEUTRAL.axis} />
        <line class="sc-grid" x1={layout.padL} x2={layout.padL} y1={layout.padT} y2={h - layout.padB} stroke={NEUTRAL.axis} />

        {list.map((b, i) => {
          const color = b.color || CHART_COLORS[i % CHART_COLORS.length];
          const dim = hot != null && hot !== b.index;
          return (
            <g key={`b-${b.index}`}
              class="sc-bub sc-anim"
              style={{
                '--i': i,
                opacity: shown ? (dim ? 0.3 : 1) : 0
              }}
              {...bind(
                <>
                  <b>{truncate(b.label, 34)}</b><br />
                  <i>{xLabel || 'x'} {fmtNum(b.x)} · {yLabel || 'y'} {fmtNum(b.y)}<br />
                    {sizeLabel || '体量'} {fmtNum(b.size)}{b.meta ? ` · ${b.meta}` : ''}</i>
                </>,
                { onMouseEnter: () => setHot(b.index), onMouseLeave: () => setHot(null) }
              )}>
              <circle cx={b.cx} cy={b.cy} r={b.r} fill={color} fill-opacity="0.5"
                stroke={color} stroke-width="1.6">
                <title>{`${b.label}: ${xLabel || 'x'} ${fmtNum(b.x)} · ${yLabel || 'y'} ${fmtNum(b.y)} · ${sizeLabel || '体量'} ${fmtNum(b.size)}`}</title>
              </circle>
              {labeled.has(b.index) && (
                <text x={b.cx} y={b.cy - b.r - 5} text-anchor="middle" class="sc-axis-l"
                  style="pointer-events:none;fill:var(--text)">{truncate(b.label, compact ? 8 : 14)}</text>
              )}
            </g>
          );
        })}
      </svg>
      {el}
    </div>
  );
}

/* ============================================================
   十二、排名横条（带渐变与背景轨道）
   ============================================================ */

export function RankBars({ items, max, height, ariaLabel, valueFormat }) {
  useChartCss();
  const [ref, width] = useMeasure(560);
  const shown = useReveal();
  const { bind, el } = useTooltip();

  const list = useMemo(() => (Array.isArray(items) ? items.filter(Boolean) : []), [items]);
  const w = Math.max(280, width);
  const compact = w < 720;
  const rowH = compact ? 28 : 30;
  const gap = 10;
  const padL = compact ? 84 : 132;
  const padR = compact ? 48 : 62;
  const padT = 6;
  const h = Number(height) || (padT * 2 + list.length * (rowH + gap) + 8);

  if (!list.length) {
    return <div ref={ref}><Empty height={h} text="暂无排名数据" /></div>;
  }

  const top = Number.isFinite(Number(max)) && Number(max) > 0
    ? Number(max)
    : Math.max(...list.map((it) => Number(it.value) || 0), 1);
  const barW = Math.max(20, w - padL - padR);
  const fmt = typeof valueFormat === 'function' ? valueFormat : (v) => fmtNum(v);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg class="sc-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={ariaLabel || '排名横条'}>
        <defs>
          {list.map((it, i) => {
            const c = it.color || CHART_COLORS[i % CHART_COLORS.length];
            return (
              <linearGradient key={`rb-${i}`} id={`sc-rank-${i}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color={c} stop-opacity="0.95" />
                <stop offset="100%" stop-color={shade(c, 0.34)} stop-opacity="0.85" />
              </linearGradient>
            );
          })}
        </defs>
        {list.map((it, i) => {
          const y = padT + i * (rowH + gap);
          const ratio = clamp((Number(it.value) || 0) / top, 0, 1);
          const label = truncate(it.label, 40);
          return (
            <g key={`r-${i}`} class="sc-row"
              style={{ '--i': i }}
              {...bind(<><b>{label}</b><br /><i>{fmt(it.value)}</i></>)}>
              <text x={padL - 10} y={y + rowH / 2 + 4} text-anchor="end" class="sc-axis-l">
                {truncate(it.label, compact ? 9 : 18)}
              </text>
              {/* 背景轨道 */}
              <rect class="sc-grid" x={padL} y={y + rowH * 0.24} width={barW} height={rowH * 0.52}
                rx={rowH * 0.26} fill={NEUTRAL.grid} />
              {/* 柱体从底部长出来：transform-origin 在左侧起点，scaleX 0 → 1 */}
              <g class="sc-bar sc-anim"
                style={{ '--i': i }}>
                <rect x={padL} y={y + rowH * 0.24} width={Math.max(3, barW * ratio)} height={rowH * 0.52}
                  rx={rowH * 0.26} fill={`url(#sc-rank-${i})`}>
                  <title>{`${label}: ${fmt(it.value)}`}</title>
                </rect>
                <rect x={padL} y={y + rowH * 0.24} width={Math.max(3, barW * ratio)} height={rowH * 0.2}
                  rx={rowH * 0.12} fill="#fff" fill-opacity="0.16" />
              </g>
              <text x={w - 8} y={y + rowH / 2 + 4} text-anchor="end" class="sc-axis-t"
                style="fill:var(--text);font-size:11.5px">{fmt(it.value)}</text>
            </g>
          );
        })}
      </svg>
      {el}
    </div>
  );
}

/* ============================================================
   十三、多维雷达
   ============================================================ */

export function RadarChart({ axes, max, height = 300, ariaLabel }) {
  useChartCss();
  const [ref, width] = useMeasure(420);
  const shown = useReveal();
  const { bind, el } = useTooltip();

  const list = useMemo(() => (Array.isArray(axes) ? axes.filter(Boolean) : []), [axes]);
  const size = Math.max(200, Number(height) || 300);
  const w = Math.max(240, width);
  const cx = w / 2;
  const cy = size / 2;
  const R = Math.max(40, Math.min(w, size) / 2 - (w < 720 ? 46 : 60));
  const { top, coords } = useMemo(() => radarPoints(list, max, cx, cy, R), [list, max, cx, cy, R]);

  if (!list.length) {
    return <div ref={ref}><Empty height={size} text="暂无维度数据" /></div>;
  }

  const poly = coords.map((c) => `${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(' ');
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg class="sc-svg" viewBox={`0 0 ${w} ${size}`} role="img" aria-label={ariaLabel || '雷达图'}>
        <defs>
          <linearGradient id="sc-radar-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color={CHART_COLORS[0]} stop-opacity="0.55" />
            <stop offset="60%" stop-color={CHART_COLORS[4]} stop-opacity="0.4" />
            <stop offset="100%" stop-color={CHART_COLORS[1]} stop-opacity="0.45" />
          </linearGradient>
        </defs>
        {rings.map((t) => (
          <polygon key={`ring-${t}`} class="sc-grid"
            points={coords.map((_, i) => {
              const [x, y] = polarToXY(cx, cy, R * t, -90 + (360 * i) / coords.length);
              return `${x.toFixed(2)},${y.toFixed(2)}`;
            }).join(' ')}
            fill="none" stroke={NEUTRAL.grid} stroke-width="1" />
        ))}
        {coords.map((c, i) => (
          <line key={`spoke-${i}`} class="sc-grid" x1={cx} y1={cy} x2={c.ax} y2={c.ay} stroke={NEUTRAL.grid} stroke-width="1" />
        ))}
        <g class="sc-reveal" style={{
          transformOrigin: `${cx}px ${cy}px`,
          transform: shown ? 'scale(1)' : 'scale(0.2)',
          opacity: shown ? 1 : 0
        }}>
          {/* 填充块：随容器一起放大淡入 */}
          <polygon points={poly} fill="url(#sc-radar-fill)" />
          {/* 轮廓线：stroke-dasharray + stroke-dashoffset 从 0 画出 */}
          <polygon class="sc-line" points={poly} fill="none" pathLength="1"
            stroke={CHART_COLORS[0]} stroke-width="2" stroke-linejoin="round"
            style={{ '--i': 0 }} />
          {coords.map((c, i) => (
            <circle key={`pt-${i}`} class="sc-pt sc-anim" style={{ '--i': i }}
              cx={c.x} cy={c.y} r="4" fill={CHART_COLORS[i % CHART_COLORS.length]}
              stroke="var(--bg-elevated)" stroke-width="1.5"
              {...bind(<><b>{c.label}</b><br /><i>{fmtNum(c.value)} / {fmtNum(top)}（{(c.ratio * 100).toFixed(0)}%）</i></>)}>
              <title>{`${c.label}: ${fmtNum(c.value)} / ${fmtNum(top)}（${(c.ratio * 100).toFixed(0)}%）`}</title>
            </circle>
          ))}
        </g>
        {coords.map((c, i) => {
          const [lx, ly] = polarToXY(cx, cy, R + (w < 720 ? 20 : 26), -90 + (360 * i) / coords.length);
          const anchor = Math.abs(lx - cx) < 6 ? 'middle' : lx > cx ? 'start' : 'end';
          return (
            <text key={`lb-${i}`} x={lx} y={ly + 4} text-anchor={anchor} class="sc-axis-l">
              {truncate(c.label, w < 720 ? 6 : 10)}
            </text>
          );
        })}
      </svg>
      {el}
    </div>
  );
}

/* ============================================================
   十四、环形仪表组
   ============================================================ */

export function GaugeRings({ items, height = 180, ariaLabel }) {
  useChartCss();
  const [ref, width] = useMeasure(420);
  const shown = useReveal();
  const { bind, el } = useTooltip();

  const list = useMemo(() => (Array.isArray(items) ? items.filter(Boolean) : []), [items]);
  const h = Math.max(120, Number(height) || 180);
  const w = Math.max(240, width);

  if (!list.length) {
    return <div ref={ref}><Empty height={h} text="暂无进度数据" /></div>;
  }

  const cellW = w / list.length;
  const R = Math.max(22, Math.min(cellW / 2 - 12, h / 2 - 34));
  const stroke = Math.max(6, R * 0.28);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg class="sc-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={ariaLabel || '环形仪表组'}>
        {list.map((it, i) => {
          const cx = cellW * i + cellW / 2;
          const cy = h / 2 - 8;
          const top = Number.isFinite(Number(it.max)) && Number(it.max) > 0 ? Number(it.max) : 1;
          const ratio = clamp((Number(it.value) || 0) / top, 0, 1);
          const color = it.color || CHART_COLORS[i % CHART_COLORS.length];
          const circumference = 2 * Math.PI * R;
          return (
            <g key={`g-${i}`} class="sc-gauge"
              style={{ '--i': i }} {...bind(
              <><b>{it.label}</b><br /><i>{fmtNum(it.value)} / {fmtNum(top)}（{(ratio * 100).toFixed(1)}%）</i></>
            )}>
              <title>{`${it.label}: ${fmtNum(it.value)} / ${fmtNum(top)}（${(ratio * 100).toFixed(1)}%）`}</title>
              <circle class="sc-grid" cx={cx} cy={cy} r={R} fill="none" stroke={NEUTRAL.grid} stroke-width={stroke} />
              <circle class="sc-gauge-fill" cx={cx} cy={cy} r={R} fill="none" stroke={color} stroke-width={stroke}
                stroke-linecap="round" stroke-dasharray={`${circumference} ${circumference}`}
                stroke-dashoffset={shown ? circumference * (1 - ratio) : circumference}
                transform={`rotate(-90 ${cx} ${cy})`}
                style={{
                  transition: 'stroke-dashoffset .95s var(--ease-out)',
                  transitionDelay: `${i * 90}ms`
                }}>
                <title>{`${it.label}: ${fmtNum(it.value)} / ${fmtNum(top)}（${(ratio * 100).toFixed(1)}%）`}</title>
              </circle>
              <text x={cx} y={cy + 5} text-anchor="middle" class="sc-axis-t"
                style="font-size:16px;fill:var(--text);font-weight:600">{(ratio * 100).toFixed(0)}%</text>
              <text x={cx} y={cy + R + 24} text-anchor="middle" class="sc-axis-l">
                {truncate(it.label, Math.max(4, Math.floor(cellW / 13)))}
              </text>
              <text x={cx} y={cy + R + 38} text-anchor="middle" class="sc-axis-t">
                {fmtNum(it.value)} / {fmtNum(top)}
              </text>
            </g>
          );
        })}
      </svg>
      {el}
    </div>
  );
}

export default {
  CHART_COLORS, StatCard, StatBoard, SunburstChart, MatrixHeat,
  StreamArea, BubbleMatrix, RankBars, RadarChart, GaugeRings
};
