// 图展页「整齐排版」纯函数探针（零依赖，Node 直接跑）：
//   cd frontend && node tests/justified.probe.mjs
//
// 只验证 lib/justified.js 的纯函数，不碰 DOM、不需要浏览器或第三方库。
// 断言用手写的 ok()，失败即 process.exit(1)。
import { justifyRows } from '../src/lib/justified.js';

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${extra ? ` → ${extra}` : ''}`);
  }
}

function eq(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  ok(name, a === e, `实际 ${a}，期望 ${e}`);
}

/** 行内宽度之和（含行内 gap）。 */
function rowSpan(row, gap) {
  return row.items.reduce((sum, it) => sum + it.width, 0) + gap * (row.items.length - 1);
}

/** 递归扫描结果里有没有 NaN / Infinity / 负数宽度。 */
function scanBad(rows) {
  const bad = [];
  for (const [ri, row] of rows.entries()) {
    if (!Number.isFinite(row.height) || row.height <= 0) bad.push(`row${ri}.height=${row.height}`);
    for (const [ii, it] of row.items.entries()) {
      if (!Number.isFinite(it.width) || it.width <= 0) bad.push(`row${ri}.item${ii}.width=${it.width}`);
      if (!Number.isFinite(it.height) || it.height <= 0) bad.push(`row${ri}.item${ii}.height=${it.height}`);
    }
  }
  return bad;
}

const GAP = 12;

console.log('=== 1. 边界输入：空 / 非数组 / 容器宽度非法 ===');
{
  eq('空数组 → []', justifyRows([], { containerWidth: 1440 }), []);
  eq('undefined → []', justifyRows(undefined, { containerWidth: 1440 }), []);
  eq('null → []', justifyRows(null, { containerWidth: 1440 }), []);
  eq('字符串 → []', justifyRows('nope', { containerWidth: 1440 }), []);
  eq('containerWidth=0 → []', justifyRows([{ w: 100, h: 100 }], { containerWidth: 0 }), []);
  eq('containerWidth 为负 → []', justifyRows([{ w: 100, h: 100 }], { containerWidth: -500 }), []);
  eq('containerWidth 缺失 → []', justifyRows([{ w: 100, h: 100 }], {}), []);
  eq('containerWidth=NaN → []', justifyRows([{ w: 100, h: 100 }], { containerWidth: NaN }), []);
  eq('opts 整体缺失 → []（宽度默认 0）', justifyRows([{ w: 100, h: 100 }]), []);
  ok('调用不抛异常', true);
}

console.log('\n=== 2. 单条目 + 很小的容器：不炸、行高受 maxRowHeight 限制 ===');
{
  // 极端竖图（10×1000，比例 0.01）：若不受限，行高会被算成 100/0.01 = 10000。
  const rows = justifyRows([{ w: 10, h: 1000 }], {
    containerWidth: 100, gap: GAP, targetRowHeight: 240, maxRowHeight: 380
  });
  eq('只有一行', rows.length, 1);
  ok('行高被 maxRowHeight 卡住', rows[0].height <= 380 + 1e-9, `height=${rows[0].height}`);
  ok('行高 > 0', rows[0].height > 0, `height=${rows[0].height}`);
  ok('宽度为正且不溢出容器', rows[0].items[0].width > 0 && rows[0].items[0].width <= 100 + 0.5,
    `width=${rows[0].items[0].width}`);
  eq('无 NaN / Infinity / 负宽', scanBad(rows), []);

  // 极宽图（4000×100）：会被直接压到目标行高以下，整行铺满。
  const wide = justifyRows([{ w: 4000, h: 100 }], { containerWidth: 1440, gap: GAP, targetRowHeight: 240 });
  eq('超宽单图仍是一行', wide.length, 1);
  ok('超宽单图行高 = 1440/40 = 36', Math.abs(wide[0].height - 36) < 0.5, `height=${wide[0].height}`);
  ok('超宽单图铺满容器', Math.abs(rowSpan(wide[0], GAP) - 1440) < 0.5,
    `span=${rowSpan(wide[0], GAP)}`);
}

console.log('\n=== 3. 每行等高 & 非最后一行铺满容器（容差 0.5px） ===');
{
  const items = [];
  const ratios = [1280 / 720, 2560 / 2560, 6144 / 3321, 800 / 1200, 1920 / 1080, 1024 / 768];
  for (let i = 0; i < 18; i += 1) {
    const r = ratios[i % ratios.length];
    items.push({ id: i, w: Math.round(1000 * r), h: 1000 });
  }
  const rows = justifyRows(items, { containerWidth: 1440, gap: GAP, targetRowHeight: 240, maxRowHeight: 380 });
  ok('产生了多行', rows.length >= 3, `rows=${rows.length}`);

  let equalOk = true;
  let fillOk = true;
  const problems = [];
  rows.forEach((row, ri) => {
    const h = row.items[0].height;
    for (const it of row.items) {
      if (it.height !== row.height || it.height !== h) {
        equalOk = false;
        problems.push(`row${ri} 高度不一致 ${row.height}/${h}/${it.height}`);
      }
    }
    // 只有「最后一行」允许不满；其余行必须正好铺满容器宽度。
    if (ri < rows.length - 1) {
      const span = rowSpan(row, GAP);
      if (Math.abs(span - 1440) > 0.5) {
        fillOk = false;
        problems.push(`row${ri} 跨度 ${span} ≠ 1440`);
      }
    }
  });
  ok('同一行内所有条目高度相同', equalOk, problems.join('; '));
  ok('非最后一行宽度之和 == containerWidth（±0.5px）', fillOk, problems.join('; '));

  // 逐行核对：最后一行必须不铺满（或恰好等于），且不会横向溢出。
  const last = rows[rows.length - 1];
  const lastSpan = rowSpan(last, GAP);
  ok('最后一行不拉伸（跨度 <= 容器宽 + 0.5）', lastSpan <= 1440 + 0.5, `span=${lastSpan}`);
  ok('最后一行通常留白（< 容器宽）或恰好铺满',
    lastSpan < 1440 - 0.5 || Math.abs(lastSpan - 1440) <= 0.5, `span=${lastSpan}`);
  eq('全部行无 NaN / Infinity / 负宽', scanBad(rows), []);
}

console.log('\n=== 4. 非法比例兜底为 1:1 ===');
{
  const rows = justifyRows([
    { id: 'w0', w: 0, h: 500 },
    { id: 'h0', w: 500, h: 0 },
    { id: 'missing', w: undefined, h: undefined },
    { id: 'nan', w: NaN, h: NaN },
    { id: 'str', w: 'abc', h: 'abc' },
    { id: 'neg', w: -100, h: -100 },
    { id: 'inf', w: Infinity, h: Infinity }
  ], { containerWidth: 1440, gap: GAP, targetRowHeight: 240, maxRowHeight: 380 });

  eq('全部兜底 1:1 → 全部条目仍被排进去',
    rows.flatMap((r) => r.items).length, 7);
  eq('无 NaN / Infinity / 负宽', scanBad(rows), []);
  // 兜底成 1:1 后，同一行内宽度应当彼此相等（因为比例相同）。
  const firstRow = rows[0];
  const widths = firstRow.items.map((it) => it.width);
  const allEqual = widths.every((w) => Math.abs(w - widths[0]) < 0.5);
  ok('同一行内 1:1 条目宽度近似相等', allEqual, widths.join(','));
}

console.log('\n=== 5. 真实比例混合：1440 容器下 12 张图的行数合理 ===');
{
  const items = [
    { id: 1, w: 1280, h: 720 },
    { id: 2, w: 2560, h: 2560 },
    { id: 3, w: 6144, h: 3321 },
    { id: 4, w: 1920, h: 1080 },
    { id: 5, w: 1080, h: 1920 },
    { id: 6, w: 3840, h: 2160 },
    { id: 7, w: 3024, h: 4032 },
    { id: 8, w: 1600, h: 1200 },
    { id: 9, w: 2048, h: 1536 },
    { id: 10, w: 1200, h: 1600 },
    { id: 11, w: 4000, h: 2250 },
    { id: 12, w: 1500, h: 1500 }
  ];
  // 桌面端图展常用「目标行高 320 / 上限 460」这一档；12 张混合画幅应当落在 4~7 行。
  const rows = justifyRows(items, { containerWidth: 1440, gap: GAP, targetRowHeight: 320, maxRowHeight: 460 });
  ok(`12 张图落在 4~7 行（实际 ${rows.length} 行）`, rows.length >= 4 && rows.length <= 7,
    `rows=${rows.length}`);
  eq('条目总数守恒', rows.flatMap((r) => r.items).length, 12);
  eq('无 NaN / Infinity / 负宽', scanBad(rows), []);

  // 非最后一行都要铺满。
  const badSpans = rows.slice(0, -1)
    .map((row, i) => ({ i, span: rowSpan(row, GAP) }))
    .filter((x) => Math.abs(x.span - 1440) > 0.5);
  eq('非最后一行全部铺满 1440', badSpans, []);

  console.log('  行高：' + rows.map((r) => `${r.items.length}张/${r.height}`).join('  '));
}

console.log('\n=== 6. 原数据不被改动、字段原样保留 ===');
{
  const items = [
    { id: 'a', w: 1280, h: 720, url: 'https://x/a.jpg', title: '甲' },
    { id: 'b', w: 800, h: 1200, url: 'https://x/b.jpg', title: '乙' }
  ];
  const snapshot = JSON.stringify(items);
  const rows = justifyRows(items, { containerWidth: 900, gap: GAP, targetRowHeight: 240 });
  ok('原数组未被改动', JSON.stringify(items) === snapshot);

  const flat = rows.flatMap((r) => r.items);
  eq('顺序保持不变', flat.map((it) => it.id), ['a', 'b']);
  eq('自定义字段原样保留', flat.map((it) => it.title), ['甲', '乙']);
  eq('url 原样保留', flat.map((it) => it.url), ['https://x/a.jpg', 'https://x/b.jpg']);
  ok('结果条目是新对象（不是原引用）', flat[0] !== items[0]);
  ok('结果条目含 width / height', Number.isFinite(flat[0].width) && Number.isFinite(flat[0].height));
}

console.log('\n=== 7. 参数缺省与异常值 ===');
{
  const items = Array.from({ length: 4 }, () => ({ w: 1280, h: 720 }));

  const def = justifyRows(items, { containerWidth: 1440 });
  eq('默认 gap=12：4 张 16:9 恰好一行', def.length, 1);
  ok('默认目标行高 240 生效（行高 <= 240）', def[0].height <= 240 + 1e-9, `height=${def[0].height}`);
  ok('默认整行铺满', Math.abs(rowSpan(def[0], 12) - 1440) < 0.5, `span=${rowSpan(def[0], 12)}`);

  const negGap = justifyRows(items, { containerWidth: 1440, gap: -50 });
  eq('负 gap 兜底为 0（不炸）', scanBad(negGap), []);
  ok('负 gap 时行跨度 = 容器宽',
    Math.abs(negGap[0].items.reduce((s, it) => s + it.width, 0) - 1440) < 0.5,
    `span=${negGap[0].items.reduce((s, it) => s + it.width, 0)}`);

  const weird = justifyRows(items, {
    containerWidth: 1440, gap: 'x', targetRowHeight: -1, maxRowHeight: 0, lastRowMaxHeight: NaN
  });
  eq('非法 targetRowHeight / maxRowHeight / gap 全部兜底且无坏值', scanBad(weird), []);
  ok('非法参数下行数仍为正', weird.length > 0);

  // lastRowMaxHeight 确实生效：给一个比 target 更小的上限，最后一行必须更矮。
  const longTail = justifyRows(
    [{ w: 1280, h: 720 }, { w: 1280, h: 720 }, { w: 1280, h: 720 }, { w: 1280, h: 720 }, { w: 100, h: 100 }],
    { containerWidth: 1440, gap: GAP, targetRowHeight: 240, lastRowMaxHeight: 120 }
  );
  const tail = longTail[longTail.length - 1];
  ok('lastRowMaxHeight 生效（最后一行 <= 120）', tail.height <= 120 + 1e-9, `height=${tail.height}`);
}

console.log('\n=== 8. 行数不可能超过条目数 ===');
{
  const items = Array.from({ length: 30 }, (_, i) => ({ id: i, w: 3000 + i, h: 2000 }));
  const rows = justifyRows(items, { containerWidth: 375, gap: 8, targetRowHeight: 140, maxRowHeight: 220 });
  ok('窄屏下多行', rows.length > 1, `rows=${rows.length}`);
  ok('行数 <= 条目数', rows.length <= items.length);
  eq('条目总数守恒', rows.flatMap((r) => r.items).length, 30);
  eq('无坏值', scanBad(rows), []);
  // 窄屏不能出现任何一行横向溢出。
  const overflow = rows.filter((r) => rowSpan(r, 8) > 375 + 0.5).length;
  eq('没有任何一行横向溢出', overflow, 0);
}

console.log(`\n结果：${passed} 过 / ${failed} 失败`);
if (failed > 0) process.exit(1);
