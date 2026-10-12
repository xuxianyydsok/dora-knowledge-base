// 图展页「整齐排版」（justified rows）纯函数模块。
//
// 目标：像 Google Photos 那样，把一堆宽高比各异的图片排成若干行，
// 每一行内所有图片等高、整行铺满容器宽度；行与行之间留 gap。
//
// 设计要点（为什么这么算）：
//   1. 一行的高度 = 该行可用宽度 / 该行所有图片宽高比之和。
//      因为 sum(图片宽度) = 行高 * sum(宽高比)，让它等于可用宽度就能解出行高。
//   2. 逐张往当前行里塞，一旦「现在收行的话这一行会有多高」掉到目标行高以下，
//      说明再塞一张就太挤了，立刻收行 —— 这是 justified 布局的标准贪心做法。
//   3. 「铺满」靠把舍入余数补给最后一个条目来消除误差：每张图各自取整会累积出
//      零点几像素的偏差，把它一次性塞给行尾那一条，整行宽度之和就与容器宽度严格一致。
//   4. 最后一行不足一行，**不拉伸**：行高取「目标行高」与 lastRowMaxHeight 中较小者，
//      再和「铺满容器所需的高度」取小，保证既不溢出、也不把图拉变形，左对齐、右侧留白。
//   5. 任何非法输入（空数组、容器宽度为 0、宽高比非法）都不抛异常、不产生 NaN / Infinity。
//
// 本文件零依赖、无 DOM、无副作用，Node 可直接 import 做单测。

/** 取数值，非有限数（undefined / NaN / Infinity / 字符串垃圾）一律回落到 fallback。 */
function num(value, fallback) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** 保留两位小数，用于压掉浮点尾巴，避免输出 123.45000000000002 这种值。 */
function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * 取一张图的宽高比；w / h 缺失、为 0、为负数或非数字时按 1:1 兜底，
 * 这样后面所有除法都不会出现 NaN / Infinity。
 */
function ratioOf(item) {
  const w = num(item && item.w, 0);
  const h = num(item && item.h, 0);
  if (w > 0 && h > 0) return w / h;
  return 1;
}

function sumRatioOf(entries) {
  let sum = 0;
  for (const entry of entries) sum += entry.ratio;
  return sum;
}

/**
 * 把一行条目按比例铺满 contentWidth，返回每条的宽度。
 * 前 n-1 条各自取两位小数，最后一条直接吃掉剩余宽度 —— 这就是第 3 点说的「余数补给行尾」。
 */
function fillToWidth(entries, height, contentWidth) {
  const n = entries.length;
  if (n === 1) return [round2(contentWidth)];

  const widths = new Array(n);
  let used = 0;
  for (let i = 0; i < n - 1; i += 1) {
    widths[i] = round2(height * entries[i].ratio);
    used += widths[i];
  }
  // 理论上前 n-1 条之和一定小于 contentWidth；这里仍夹一下下限，纯属防御。
  widths[n - 1] = Math.max(0, round2(contentWidth - used));
  return widths;
}

function makeRow(entries, height, widths) {
  const h = round2(height);
  return {
    height: h,
    items: entries.map((entry, i) => ({ ...entry.item, width: widths[i], height: h }))
  };
}

/** 正常收行：行高由「可用宽度 / 宽高比之和」解出，并受 maxRowHeight 限制。 */
function buildFullRow(entries, containerWidth, gap, maxRowHeight) {
  const n = entries.length;
  const contentWidth = Math.max(0, containerWidth - gap * (n - 1));
  const sumRatio = sumRatioOf(entries);
  const natural = sumRatio > 0 ? contentWidth / sumRatio : 0;
  // 先定高（取两位小数），再按这个高度算宽度，这样 row.height 与 items[].height 完全一致。
  const height = round2(Math.min(natural, maxRowHeight));
  const clamped = natural > maxRowHeight;
  const widths = clamped
    // 被最大行高卡住时不再强行拉满，否则会把图横向拉变形，宁可右侧留白。
    ? entries.map((entry) => round2(height * entry.ratio))
    : fillToWidth(entries, height, contentWidth);
  return makeRow(entries, height, widths);
}

/** 收尾行：不足一行时不拉伸，按目标行高左对齐排，右侧留白。 */
function buildLastRow(entries, containerWidth, gap, targetRowHeight, lastRowMaxHeight) {
  const n = entries.length;
  const contentWidth = Math.max(0, containerWidth - gap * (n - 1));
  const sumRatio = sumRatioOf(entries);
  const natural = sumRatio > 0 ? contentWidth / sumRatio : 0;
  const desired = Math.min(targetRowHeight, lastRowMaxHeight);
  // 与 natural 取小：条目本身很宽时也不能超出容器，否则最后一行会横向溢出。
  const height = round2(Math.min(desired, natural));
  const widths = entries.map((entry) => round2(height * entry.ratio));
  return makeRow(entries, height, widths);
}

/**
 * 把 items 排成「每行等高、整行铺满」的行列表。
 *
 * @param {Array<{w:number,h:number}>} items 至少含 w / h（像素宽高），其余字段原样带进结果。
 * @param {object} [opts]
 * @param {number} opts.containerWidth  容器可用宽度（必须 > 0，否则返回 []）。
 * @param {number} [opts.gap=12]        行内水平间隙；行与行之间的垂直间隙由调用方用同一个值排布。
 * @param {number} [opts.targetRowHeight=240] 目标行高，行高掉到它以下就收行。
 * @param {number} [opts.maxRowHeight=380]   单行最大高度（防止个别超宽图把行撑得过高）。
 * @param {number} [opts.lastRowMaxHeight]   最后一行的高度上限，缺省等于 targetRowHeight。
 * @returns {Array<{height:number, items:Array<object>}>} 每行给出统一 height，条目带实际渲染 width / height。
 */
export function justifyRows(items, opts = {}) {
  const list = Array.isArray(items) ? items : [];
  const options = opts && typeof opts === 'object' ? opts : {};

  const containerWidth = num(options.containerWidth, 0);
  const gap = Math.max(0, num(options.gap, 12));

  const targetRaw = num(options.targetRowHeight, 240);
  const targetRowHeight = targetRaw > 0 ? targetRaw : 240;
  const maxRaw = num(options.maxRowHeight, 380);
  const maxRowHeight = maxRaw > 0 ? maxRaw : targetRowHeight;

  let lastRowMaxHeight = targetRowHeight;
  if (options.lastRowMaxHeight != null) {
    const lastRaw = num(options.lastRowMaxHeight, targetRowHeight);
    lastRowMaxHeight = lastRaw > 0 ? lastRaw : targetRowHeight;
  }

  // 没有内容、或容器还没量出宽度（<= 0）时给空结果，调用方量到宽度后重新调用即可。
  if (!list.length || !(containerWidth > 0)) return [];

  const rows = [];
  let current = [];
  let sumRatio = 0;

  const flush = () => {
    if (!current.length) return;
    rows.push(buildFullRow(current, containerWidth, gap, maxRowHeight));
    current = [];
    sumRatio = 0;
  };

  for (const item of list) {
    // 再塞一张图后，光行内间隙就撑满容器了 —— 先把当前行收掉，让它另起一行。
    if (current.length && containerWidth - gap * current.length <= 0) flush();

    current.push({ item, ratio: ratioOf(item) });
    sumRatio += current[current.length - 1].ratio;

    const contentWidth = Math.max(0, containerWidth - gap * (current.length - 1));
    const heightIfClosed = sumRatio > 0 ? contentWidth / sumRatio : 0;
    if (heightIfClosed <= targetRowHeight) flush();
  }

  // 剩下的条目不足一整行，按「不拉伸」规则收尾。
  if (current.length) {
    rows.push(buildLastRow(current, containerWidth, gap, targetRowHeight, lastRowMaxHeight));
  }

  return rows;
}

export default justifyRows;
