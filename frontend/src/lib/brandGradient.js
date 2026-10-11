// 品牌渐变（Dora Studio）的取色工具。
//
// 背景：站名原本是首页首屏那个巨型标题上的青→紫→粉渐变。2026-10-12 用户要求
// 把首屏标题改回「把散落的知识 / 收进一张星图」，而把那串渐变色的 Dora Studio
// 挪到「此刻」区那张铁屑卡片上。两处都要用同一套渐变，所以抽到这里共用。
//
// ⚠ 为什么必须**逐字切片**、而不是在父元素上用一次 background-clip:text：
//   每个字都要做 transform 动画（错峰升起 / 悬停上浮），而 transform 会让这个字
//   自成一层合成层；父元素的 background-clip:text 裁不到别的合成层里的字形，
//   整行会直接变透明看不见。所以按字在整串文字里的位置算出它该分到的那一小段
//   渐变，拼起来仍是一条连续的渐变，且与 transform 动画互不干扰。

// 品牌渐变（取自 112 模板的 --c / --v / --p：青 → 紫 → 粉）
export const TITLE_GRADIENT = ['#3de6ff', '#8b5cff', '#ff5fd2'];

// 在渐变条上按 0~1 取色（分段线性插值）
export function sampleGradient(stops, t) {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const hex = (s) => [1, 3, 5].map((k) => parseInt(s.slice(k, k + 2), 16));
  const [r1, g1, b1] = hex(stops[i]);
  const [r2, g2, b2] = hex(stops[i + 1]);
  const mix = (a, b) => Math.round(a + (b - a) * f);
  return `rgb(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)})`;
}

// 把整条渐变按字数切成 n 份，第 i 份给第 i 个字（跨行连续）
export function charGradients(lines, stops = TITLE_GRADIENT) {
  const total = lines.join('').length;
  const step = total > 1 ? 1 / (total - 1) : 0;
  const out = [];
  let k = 0;
  for (const line of lines) {
    for (let i = 0; i < line.length; i += 1) {
      const t = k * step;
      out.push(`linear-gradient(135deg, ${sampleGradient(stops, t)}, ${sampleGradient(stops, Math.min(1, t + step))})`);
      k += 1;
    }
  }
  return out;
}
