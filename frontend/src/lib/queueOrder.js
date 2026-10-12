// 播放顺序（随机 / 循环）的纯函数。
//
// 用户要求（2026-10-12，参考模板《Nacre 音乐》底部播放条）：
//   播放条上要有**随机**、**顺序播放 / 列表循环 / 单曲循环**，而且这些逻辑
//   要落在播放条里，不要为它们另开页面。
//
// 为什么要单独抽一个「播放顺序」概念，而不是直接 `index ± 1`：
//   · 随机播放时，「下一首」不是队列里的下一首，而是**洗牌后顺序**的下一首；
//   · 「上一首」要能回到刚才听过的那一首（所以要记住洗牌后的顺序，不能临时随机）；
//   · 列表循环时，走到末尾要绕回开头；单曲循环时，播完要重播同一首。
// 这三件事都需要一个显式的顺序数组，所以把它做成纯函数，便于离线单测。
//
// 本文件零依赖、无 DOM、无副作用，Node 可直接 import。

/** 播放模式：顺序（不循环）/ 列表循环 / 单曲循环 */
export const REPEATS = ['off', 'all', 'one'];

/**
 * 生成播放顺序（队列下标数组）。
 *
 * @param {number} length 队列长度
 * @param {object} [opts]
 * @param {boolean} [opts.shuffle=false] 是否随机
 * @param {number}  [opts.current=-1]    当前曲目下标；随机时它会被放在最前，
 *                                       这样「开着随机再点下一首」不会立刻跳走
 * @param {() => number} [opts.random=Math.random] 注入随机源，便于单测
 * @returns {number[]}
 */
export function buildOrder(length, opts = {}) {
  const n = Number.isFinite(length) && length > 0 ? Math.floor(length) : 0;
  if (!n) return [];
  const shuffle = !!opts.shuffle;
  const current = Number.isFinite(opts.current) ? Math.floor(opts.current) : -1;
  const random = typeof opts.random === 'function' ? opts.random : Math.random;

  const base = Array.from({ length: n }, (_, i) => i);
  if (!shuffle) return base;

  // Fisher–Yates 洗牌（原地打乱副本）
  const rest = base.filter((i) => i !== current);
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = rest[i];
    rest[i] = rest[j];
    rest[j] = tmp;
  }
  if (current >= 0 && current < n) rest.unshift(current);
  return rest;
}

/**
 * 沿播放顺序走一步。
 *
 * @param {number[]} order 播放顺序（buildOrder 的结果）
 * @param {number} current 当前曲目下标（队列下标，不是顺序下标）
 * @param {number} delta   +1 下一首 / -1 上一首
 * @param {string} repeat  'off' | 'all' | 'one'
 * @returns {number} 目标曲目的队列下标；**-1 表示没有下一首**（顺序播放走到头了）
 */
export function stepIndex(order, current, delta, repeat = 'off') {
  const list = Array.isArray(order) ? order : [];
  if (!list.length) return -1;
  const dir = delta >= 0 ? 1 : -1;
  let pos = list.indexOf(current);
  // 当前曲目不在顺序里（例如刚换过队列）：从头 / 从尾起步
  if (pos < 0) pos = dir > 0 ? -1 : list.length;
  const next = pos + dir;
  if (next < 0) return repeat === 'all' ? list[list.length - 1] : -1;
  if (next >= list.length) return repeat === 'all' ? list[0] : -1;
  return list[next];
}

/** 下一个播放模式（顺序 → 列表循环 → 单曲循环 → 顺序） */
export function nextRepeat(repeat) {
  const i = REPEATS.indexOf(repeat);
  return REPEATS[(i < 0 ? 0 : i + 1) % REPEATS.length];
}

/** 播放模式的中文说明（给按钮的 title / aria-label 用） */
export const REPEAT_LABEL = {
  off: '顺序播放（放完最后一首停下）',
  all: '列表循环（放完回到第一首）',
  one: '单曲循环（一直重播这一首）'
};

export default buildOrder;
