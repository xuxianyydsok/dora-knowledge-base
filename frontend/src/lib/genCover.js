// 生成文章封面用的几何 SVG 内部标记（不含 <svg> 外层标签）。
// 纯函数 + 确定性随机（同一 seed 结果永远一致），零依赖、无 DOM，
// 可直接在 Node 中 import 做单元测试；坐标按 viewBox="0 0 400 300" 设计。
// 颜色一律不写死，交给外层 CSS 继承（描边 / 填充 / 动画）。

// 可选的封面图案种类
export const COVER_KINDS = ['waves', 'rings', 'arcs', 'dots'];

// mulberry32：小巧的确定性伪随机数发生器，同一 seed 产出同一序列
function rng(s) {
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// 统一保留 1 位小数，避免 SVG 字符串过长
const n = (v) => Number(v).toFixed(1);

// 波浪：16 条水平波浪线，中部包络最强（两侧渐弱）
function waves(seed) {
  const r = rng(seed);
  const c = 0.3 + r() * 0.4;
  const w = 0.12 + r() * 0.1;
  const amp = 26 + r() * 18;
  const fr = 2 + r() * 2.5;
  const out = [];
  for (let i = 0; i < 16; i++) {
    const y0 = 34 + i * (232 / 15);
    let d = '';
    for (let j = 0; j < 70; j++) {
      const u = j / 69;
      const env = Math.exp(-((u - c) ** 2) / (2 * w * w));
      const y = y0 - env * amp * Math.sin(u * fr * Math.PI * 2 + i * 0.35);
      d += `${j === 0 ? 'M' : 'L'}${n(u * 400)} ${n(y)}`;
    }
    out.push(`<path pathLength="1" d="${d}" style="--i:${i}"/>`);
  }
  return out.join('\n');
}

// 圆环：11 个同心圆，圆心逐环轻微漂移，形成松弛的套环
function rings(seed) {
  const r = rng(seed);
  const dx = (r() - 0.5) * 16;
  const dy = (r() - 0.5) * 10;
  const out = [];
  for (let i = 0; i < 11; i++) {
    out.push(
      `<circle pathLength="1" cx="${n(200 + dx * i)}" cy="${n(150 + dy * i)}" r="${n(16 + i * 13.5)}" style="--i:${i}"/>`
    );
  }
  return out.join('\n');
}

// 拱形：8 列 × 6 行的半圆拱阵列，每格随机取两种朝向之一
function arcs(seed) {
  const r = rng(seed);
  const s = 50;
  const h = 25;
  const out = [];
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 8; x++) {
      const X = x * 50;
      const Y = y * 50;
      const d = r() > 0.5
        ? `M${n(X + h)} ${n(Y)}A${n(h)} ${n(h)} 0 0 0 ${n(X + s)} ${n(Y + h)}M${n(X)} ${n(Y + h)}A${n(h)} ${n(h)} 0 0 1 ${n(X + h)} ${n(Y + s)}`
        : `M${n(X)} ${n(Y + h)}A${n(h)} ${n(h)} 0 0 0 ${n(X + h)} ${n(Y)}M${n(X + h)} ${n(Y + s)}A${n(h)} ${n(h)} 0 0 1 ${n(X + s)} ${n(Y + h)}`;
      out.push(`<path pathLength="1" d="${d}" style="--i:${x + y}"/>`);
    }
  }
  return out.join('\n');
}

// 圆点：17 列 × 13 行的点阵，随机焦点附近点更大（径向渐隐）
function dots(seed) {
  const r = rng(seed);
  const cx = 100 + r() * 200;
  const cy = 60 + r() * 180;
  const out = [];
  for (let y = 0; y < 13; y++) {
    for (let x = 0; x < 17; x++) {
      const px = 12 + x * 24.5;
      const py = 12 + y * 23.8;
      const d = Math.hypot(px - cx, py - cy);
      const rr = Math.max(0.6, 9.5 - d / 22);
      out.push(
        `<circle class="dot" cx="${n(px)}" cy="${n(py)}" r="${n(rr)}" style="--i:${Math.round(d / 14)}"/>`
      );
    }
  }
  return out.join('\n');
}

// 生成指定图案的 SVG 内部标记；kind 非法或未知时回退到 waves
export function genCover(kind, seed) {
  const k = String(kind || '');
  const s = typeof seed === 'number' ? seed : hashSeed(seed);
  if (k === 'rings') return rings(s);
  if (k === 'arcs') return arcs(s);
  if (k === 'dots') return dots(s);
  return waves(s);
}

// 字符串 → 32 位整数种子（FNV-1a 变体，保证确定性）
function hashSeed(str) {
  const t = String(str == null ? '' : str);
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

// 用文章 id / slug 等任意字符串确定性地挑一种封面图案
export function pickCover(seedStr) {
  const h = hashSeed(seedStr);
  const idx = Math.abs(h) % COVER_KINDS.length;
  return COVER_KINDS[idx];
}
