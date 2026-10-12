// queueOrder.probe.mjs —— 播放顺序（随机 / 循环）纯函数探针
//
// 用户要求（2026-10-12，参考 Nacre 模板的播放条）：
//   播放条上要有随机、顺序播放 / 列表循环 / 单曲循环。
// 这些规则全在 lib/queueOrder.js 里，用 Node 直接跑表驱动断言。

import { buildOrder, stepIndex, nextRepeat, REPEAT_LABEL } from '../src/lib/queueOrder.js';

let pass = 0; const fails = [];
function eq(name, actual, expected) {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected);
  if (a === e) { pass += 1; return; }
  fails.push(`${name}：期望 ${e}，实际 ${a}`);
}
function ok(name, cond, extra = '') {
  if (cond) { pass += 1; return; }
  fails.push(`${name}${extra ? ` —— ${extra}` : ''}`);
}

// ---------------- buildOrder ----------------
console.log('=== 1. buildOrder：顺序 / 随机 ===');
eq('顺序播放就是自然序', buildOrder(4), [0, 1, 2, 3]);
eq('空队列返回空数组', buildOrder(0), []);
eq('非法长度返回空数组', buildOrder(-3), []);
eq('非数字返回空数组', buildOrder('x'), []);

{
  const order = buildOrder(5, { shuffle: true, current: 2 });
  eq('随机：当前曲目排在最前', order[0], 2);
  eq('随机：长度不变', order.length, 5);
  eq('随机：不重不漏', [...order].sort((a, b) => a - b), [0, 1, 2, 3, 4]);
}
{
  // 注入随机源，结果可复现
  const order = buildOrder(4, { shuffle: true, current: 0, random: () => 0 });
  eq('注入随机源：结果确定', order, [0, 2, 3, 1]);
}
{
  const order = buildOrder(3, { shuffle: true, current: -1 });
  eq('无当前曲目：仍然是全排列', [...order].sort((a, b) => a - b), [0, 1, 2]);
}

// ---------------- stepIndex ----------------
console.log('\n=== 2. stepIndex：顺序播放 ===');
const seq = [0, 1, 2, 3];
eq('顺序：0 → 1', stepIndex(seq, 0, 1, 'off'), 1);
eq('顺序：2 → 3', stepIndex(seq, 2, 1, 'off'), 3);
eq('顺序：最后一首没有下一首', stepIndex(seq, 3, 1, 'off'), -1);
eq('顺序：第一首没有上一首', stepIndex(seq, 0, -1, 'off'), -1);
eq('顺序：3 → 2', stepIndex(seq, 3, -1, 'off'), 2);

console.log('\n=== 3. stepIndex：列表循环 ===');
eq('循环：最后一首 → 第一首', stepIndex(seq, 3, 1, 'all'), 0);
eq('循环：第一首 → 最后一首', stepIndex(seq, 0, -1, 'all'), 3);

console.log('\n=== 4. stepIndex：随机顺序里也要按洗牌序走 ===');
const shuffled = [2, 0, 3, 1];
eq('随机：2 → 0', stepIndex(shuffled, 2, 1, 'all'), 0);
eq('随机：0 → 3', stepIndex(shuffled, 0, 1, 'all'), 3);
eq('随机：3 → 1', stepIndex(shuffled, 3, 1, 'all'), 1);
eq('随机：1 → 回到 2', stepIndex(shuffled, 1, 1, 'all'), 2);
eq('随机：往回走', stepIndex(shuffled, 1, -1, 'all'), 3);
eq('随机 + 顺序播放：最后一首停下', stepIndex(shuffled, 1, 1, 'off'), -1);

console.log('\n=== 5. 边界 ===');
eq('空顺序返回 -1', stepIndex([], 0, 1, 'off'), -1);
eq('非数组返回 -1', stepIndex(null, 0, 1, 'off'), -1);
eq('当前不在顺序里（向前）：从头开始', stepIndex(seq, 99, 1, 'off'), 0);
eq('当前不在顺序里（向后）：从尾开始', stepIndex(seq, 99, -1, 'off'), 3);
eq('单曲队列 + 列表循环：还是自己', stepIndex([0], 0, 1, 'all'), 0);
eq('单曲队列 + 顺序播放：没有下一首', stepIndex([0], 0, 1, 'off'), -1);

console.log('\n=== 6. 模式轮转 ===');
eq('off → all', nextRepeat('off'), 'all');
eq('all → one', nextRepeat('all'), 'one');
eq('one → off', nextRepeat('one'), 'off');
eq('未知值 → off（回落到默认的顺序播放）', nextRepeat('bogus'), 'off');
eq('空值 → off', nextRepeat(''), 'off');
ok('三种模式都有中文说明',
  REPEAT_LABEL.off && REPEAT_LABEL.all && REPEAT_LABEL.one,
  JSON.stringify(REPEAT_LABEL));

console.log(`\n播放顺序探针：${pass} 过 / ${fails.length} 失败`);
if (fails.length) { fails.forEach((f) => console.log(`  ❌ ${f}`)); process.exitCode = 1; }
else console.log('  ✅ 全部通过');
