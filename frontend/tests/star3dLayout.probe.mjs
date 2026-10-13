// star3dLayout.probe.mjs —— 3D 星图布局纯函数探针
//
// 用户要求（2026-10-13）：「图谱最开始的那两张改成三维效果」「二弟的话还是保留，
// 只是说要添加一个 3D 的按钮」。
//
// 三维布局的坐标计算全在 lib/star3dLayout.js（零依赖纯函数），这里用 Node 直接跑断言。
// 为什么要专门测它：这段代码出错时表现为「画面全黑」「点全挤在中心」，
// 只能靠截图才发现；把关键性质（数组长度、坐标有限、中心留空、尺度合理、
// 连线索引合法）钉死之后，改布局参数不会悄悄把画面搞坏。

import {
  layout3D, validateLayout, bounds3D, hexToRgb01, CAMERA_TILT, LEAF_SIZE, HUB_SIZE,
  flowTargetCount, stepFlow, flowGeometry
} from '../src/lib/star3dLayout.js';

let pass = 0; const fails = [];
function ok(name, cond, extra = '') {
  if (cond) { pass += 1; return; }
  fails.push(`${name}${extra ? ` —— ${extra}` : ''}`);
}
function eq(name, actual, expected) {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected);
  if (a === e) { pass += 1; return; }
  fails.push(`${name}：期望 ${e}，实际 ${a}`);
}

// 造一份与真实接口同形状的场景（字段与 StarMap.buildScene 的输出一致）
function fakeScene(nLeaves = 40, nHubs = 6, nLinks = 60) {
  const all = [];
  for (let i = 0; i < nHubs; i++) {
    all.push({ id: `h${i}`, kind: 'hub', label: `分类${i}`, color: '#3ee6a8', angle: (i / nHubs) * Math.PI * 2, r: 1.05, si: i });
  }
  for (let i = 0; i < nLeaves; i++) {
    all.push({
      id: `p${i}`, kind: 'leaf', label: `文章${i}`, color: '#4cc9ff',
      angle: (i / nLeaves) * Math.PI * 2, r: 0.66 + (i % 7) * 0.04, si: i % nHubs
    });
  }
  const links = [];
  for (let i = 0; i < nLinks; i++) {
    links.push({ ia: i % all.length, ib: (i * 3 + 1) % all.length, ci: 0, color: '#4cc9ff' });
  }
  return { all, links, sectors: [], hubs: [], leaves: [] };
}

console.log('\n3D 星图布局探针\n' + '='.repeat(60));

// ---------------- 1. hexToRgb01 ----------------
console.log('=== 1. 颜色转换 ===');
eq('#ff0000 转红', hexToRgb01('#ff0000'), [1, 0, 0]);
eq('#00ff00 转绿', hexToRgb01('#00ff00'), [0, 1, 0]);
eq('三位简写 #0f0 等价 #00ff00', hexToRgb01('#0f0'), hexToRgb01('#00ff00'));
eq('空值给灰而不是 NaN', hexToRgb01(null).every((v) => Number.isFinite(v)), true);
eq('非法值也给灰', hexToRgb01('zzz').every((v) => Number.isFinite(v)), true);
ok('分量都在 0~1', hexToRgb01('#3ee6a8').every((v) => v >= 0 && v <= 1));

// ---------------- 2. layout3D 基本性质 ----------------
console.log('=== 2. layout3D 数组长度与类型 ===');
const scene = fakeScene();
const geo = layout3D(scene, 10);
const n = scene.all.length;
eq('position 长度 = 点数 * 3', geo.positions.length, n * 3);
eq('color 长度 = 点数 * 3', geo.colors.length, n * 3);
eq('size 长度 = 点数', geo.sizes.length, n);
eq('linkPositions 长度 = 边数 * 6', geo.linkPositions.length, scene.links.length * 6);
eq('linkColors 长度 = 边数 * 6', geo.linkColors.length, scene.links.length * 6);
ok('positions 是 Float32Array', geo.positions instanceof Float32Array);
ok('points 原样带出（供拾取取 label）', geo.points.length === n && geo.points[0].id === 'h0');
ok('自检通过（空错误数组）', validateLayout(geo, scene).length === 0, validateLayout(geo, scene).join('; '));

// ---------------- 3. 中心留空（这是 3D 观感的关键） ----------------
console.log('=== 3. 中心留空 ===');
let minRadius = Infinity;
for (let i = 0; i < n; i++) {
  minRadius = Math.min(minRadius, Math.hypot(geo.positions[i * 3], geo.positions[i * 3 + 2]));
}
// 半径 = spread * (0.35 + r01 * 0.65)，r01 最小 0.66 → 最小半径 ≈ 10 * 0.779 = 7.79
ok('最近的点也离中心足够远（星云中间是空的）', minRadius > 7, `最小半径 ${minRadius.toFixed(2)}`);

// ---------------- 4. 尺度合理（决定相机能不能框住） ----------------
console.log('=== 4. 包围盒与相机视野 ===');
const b = bounds3D(geo);
ok('最大水平半径有限且 > 0', Number.isFinite(b.maxRadiusXZ) && b.maxRadiusXZ > 0, `maxRadiusXZ=${b.maxRadiusXZ.toFixed(2)}`);
// 相机距离 24、fov 45 度 → 可视半高约 9.94。星云半径应落在同一量级，
// 太小说明整体缩成一点，太大说明飞出视野。
ok('星云半径与相机视野同量级（9~13）', b.maxRadiusXZ > 9 && b.maxRadiusXZ < 13, `maxRadiusXZ=${b.maxRadiusXZ.toFixed(2)}`);
const halfH = Math.tan((45 / 2) * Math.PI / 180) * 24;
ok('星云半径 < 可视半高 * 1.4（不会整体飞出画面）', b.maxRadiusXZ < halfH * 1.4, `${b.maxRadiusXZ.toFixed(2)} vs ${halfH.toFixed(2)}`);
ok('有纵向厚度（不是一张平板）', b.maxY - b.minY > 1, `y 跨度 ${(b.maxY - b.minY).toFixed(2)}`);
ok('纵向厚度又不过分（不至于变成球）', b.maxY - b.minY < b.maxRadiusXZ, `y 跨度 ${(b.maxY - b.minY).toFixed(2)}`);

// ---------------- 5. 稳定性（刷新不该换一团星云） ----------------
console.log('=== 5. 布局稳定性 ===');
const geo2 = layout3D(fakeScene(), 10);
let same = true;
for (let i = 0; i < geo.positions.length; i++) {
  if (Math.abs(geo.positions[i] - geo2.positions[i]) > 1e-9) { same = false; break; }
}
ok('同一份数据两次布局结果完全一致（不会每次刷新都跳）', same);

// ---------------- 6. 边界输入 ----------------
console.log('=== 6. 边界输入 ===');
const empty = layout3D({ all: [], links: [] }, 10);
eq('空场景 position 为空', empty.positions.length, 0);
eq('空场景自检通过', validateLayout(empty, { all: [], links: [] }).length, 0);
const noArg = layout3D(null, 10);
eq('null 输入不抛错', noArg.positions.length, 0);
// 缺字段的节点应被兜底成有限值，而不是 NaN（NaN 会让 WebGL 丢弃该点）
const weird = layout3D({ all: [{ id: 'x', kind: 'leaf' }, { id: 'y', kind: 'hub', angle: NaN, r: NaN, color: 'bad' }], links: [] }, 10);
eq('缺字段节点仍产出有限坐标', validateLayout(weird, { all: [{ id: 'x', kind: 'leaf' }, { id: 'y', kind: 'hub' }], links: [] }).length, 0);

// ---------------- 7. 连线索引越界防护 ----------------
console.log('=== 7. 越界连线防护 ===');
const badLinks = {
  all: [{ id: 'a', kind: 'leaf', angle: 0, r: 1, color: '#fff', si: 0 }],
  links: [{ ia: 0, ib: 99, color: '#fff' }, { ia: 0, ib: 0, color: '#fff' }]
};
const g3 = layout3D(badLinks, 10);
let allFinite = true;
for (let i = 0; i < g3.linkPositions.length; i++) if (!Number.isFinite(g3.linkPositions[i])) allFinite = false;
ok('越界连线不会产生 NaN 坐标（只是画到 0,0,0）', allFinite);

// ---------------- 8. 常量合理 ----------------
console.log('=== 8. 常量 ===');
ok('俯仰角在 0.3~0.7 弧度（既有立体感又能看清分布）', CAMERA_TILT > 0.3 && CAMERA_TILT < 0.7, `${CAMERA_TILT}`);
ok('枢纽点比星点大（视觉层级）', HUB_SIZE > LEAF_SIZE, `${HUB_SIZE} vs ${LEAF_SIZE}`);

// ---------------- 9. 流动光点 ----------------
console.log('=== 9. 流动光点（与 2D 同观感） ===');
// 数量口径：连线数的 5%，夹在 60~260
eq('连线数 0 → 0 个光点', flowTargetCount(0), 0);
eq('连线数很少时至少 60 个（不然看不出流动）', flowTargetCount(100), 60);
eq('连线数很多时封顶 260 个（性能）', flowTargetCount(100000), 260);
ok('典型连线数落在区间内', flowTargetCount(1022) === 60, `1022 条边 → ${flowTargetCount(1022)} 个`);
ok('负数连线数返回 0', flowTargetCount(-5) === 0);
ok('非数字返回 0', flowTargetCount('x') === 0);

// 用固定随机源，保证结果可复现
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// 推进：粒子应随时间向 t=1 移动
let flow = [];
flow = stepFlow(flow, 0.016, 20, 10, seeded(1));
eq('空列表推进后补到目标数量', flow.length, 10);
ok('新粒子 t 不全为 0（否则会整体同相位闪烁）',
  new Set(flow.map((p) => p.t)).size > 1, `不同 t 值 ${new Set(flow.map((p) => p.t)).size} 个`);
ok('粒子都带合法 speed', flow.every((p) => p.speed > 0 && p.speed < 1));
ok('粒子索引都在连线范围内', flow.every((p) => Number.isInteger(p.linkIndex) && p.linkIndex >= 0 && p.linkIndex < 20));

// 推进一段时间后，t 应单调增大
const before = flow.map((p) => p.t);
flow = stepFlow(flow, 0.5, 20, 10, seeded(2));
const moved = flow.filter((p, i) => before[i] !== undefined && p.t > before[i]).length;
ok('推进后多数粒子 t 增大', moved >= 7, `${moved}/10 增大`);

// 到达终点应被回收（t >= 1 不再保留）
const almost = [{ linkIndex: 0, t: 0.99, speed: 1 }];
const after = stepFlow(almost, 0.1, 0, 0, seeded(3));
ok('t 超过 1 的粒子被回收', after.length === 0, `剩余 ${after.length}`);

// 长时间运行不应无限增长（这是最容易出的 bug）
let long = [];
for (let i = 0; i < 600; i++) long = stepFlow(long, 0.016, 500, 100, seeded(100 + i));
ok('长时间运行数量稳定在目标值', long.length === 100, `实际 ${long.length}`);

// ---------------- 10. 光点几何 ----------------
console.log('=== 10. 光点几何（拖尾 + 头部） ===');
const pos = new Float32Array([0, 0, 0, 10, 0, 0]);   // 两点：原点 → (10,0,0)
const ends = [[0, 1]];
const fg = flowGeometry([{ linkIndex: 0, t: 0.5, speed: 0.1 }], pos, ends, 0.1);
eq('拖尾坐标长度 = 光点数 * 6', fg.tailPositions.length, 6);
eq('头部坐标长度 = 光点数 * 3', fg.headPositions.length, 3);
eq('透明度数组长度 = 光点数 * 2', fg.tailAlphas.length, 2);
eq('头部落在 t=0.5 处（x=5）', Math.round(fg.headPositions[0]), 5);
eq('拖尾起点落在 t=0.4 处（x=4）', Math.round(fg.tailPositions[0]), 4);
eq('拖尾终点与头部重合', Math.round(fg.tailPositions[3]), 5);
eq('拖尾起点透明', fg.tailAlphas[0], 0);
eq('拖尾终点不透明', fg.tailAlphas[1], 1);

// 越界连线不应崩，也不应产生 NaN
const badFg = flowGeometry([{ linkIndex: 99, t: 0.5, speed: 0.1 }], pos, ends, 0.1);
let fgFinite = true;
for (let i = 0; i < badFg.tailPositions.length; i++) if (!Number.isFinite(badFg.tailPositions[i])) fgFinite = false;
ok('越界连线的光点不产生 NaN', fgFinite);

// t 越界应被 clamp，不会跑到线外
const clampFg = flowGeometry([{ linkIndex: 0, t: 5, speed: 0.1 }], pos, ends, 0.1);
eq('t>1 被夹到终点（x=10）', Math.round(clampFg.headPositions[0]), 10);
const clampFg2 = flowGeometry([{ linkIndex: 0, t: -3, speed: 0.1 }], pos, ends, 0.1);
eq('t<0 被夹到起点（x=0）', Math.round(clampFg2.headPositions[0]), 0);

// 空输入
const emptyFg = flowGeometry([], pos, ends, 0.1);
eq('空光点列表产出空数组', emptyFg.headPositions.length, 0);

// ---------------- 汇总 ----------------
console.log('\n' + '='.repeat(60));
if (fails.length) {
  for (const f of fails) console.log('  ❌ ' + f);
  console.log(`\n结果：${pass} 过 / ${fails.length} 失败`);
  process.exit(1);
} else {
  console.log(`结果：${pass} 过 / 0 失败`);
}
