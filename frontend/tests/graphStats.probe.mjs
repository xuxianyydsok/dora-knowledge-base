// 图谱统计纯函数探针（零依赖，Node 直接跑）
//
// 为什么单独测：
//   图表组件（StatCharts.jsx）只能靠浏览器验证，但「分箱 / 交叉计数 / 时间轴补齐 / 除零」
//   这些最容易出错的逻辑全在 lib/graphStats.js 里。把它们抽成纯函数离线测，
//   就能在不打开浏览器的情况下锁住统计口径（也是回归的第一道闸门）。
//
// 用法：node frontend/tests/graphStats.probe.mjs

import {
  blogStats, repoStats, monthOf, monthRange, colorAt, PALETTE
} from '../src/lib/graphStats.js';

let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond, detail = '') {
  if (cond) {
    pass += 1;
    console.log(`  ✅ ${name}${detail ? ' —— ' + detail : ''}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  ❌ ${name}${detail ? ' —— ' + detail : ''}`);
  }
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

// ---------------------------------------------------------------- 工具函数
section('工具函数');

check('monthOf 解析 YYYY-MM-DD', monthOf('2026-10-11') === '2026-10');
check('monthOf 解析 ISO 时间戳', monthOf('2026-10-11T08:00:00Z') === '2026-10');
check('monthOf 空值返回 null', monthOf('') === null && monthOf(null) === null);
check('monthOf 垃圾输入返回 null', monthOf('not-a-date') === null);

check('monthRange 跨年连续', monthRange('2025-11', '2026-02').join(',') === '2025-11,2025-12,2026-01,2026-02');
check('monthRange 单月', monthRange('2026-03', '2026-03').join(',') === '2026-03');
check('monthRange 非法输入返回空数组', monthRange('', '').length === 0 && monthRange('x', 'y').length === 0);
check('monthRange 逆序返回空数组（防御脏数据）', monthRange('2026-05', '2026-01').length === 0);

check('colorAt 轮转且越界不崩', colorAt(0) === PALETTE[0] && colorAt(PALETTE.length) === PALETTE[0] && colorAt(-1) === PALETTE[PALETTE.length - 1]);

// ---------------------------------------------------------------- 博客统计
section('博客统计（blogStats）');

// 造一份带 3 个分类、3 个标签、跨 3 个月、含「未分类」与「空月」的数据
const blogData = {
  nodes: [
    { id: 'c:1', kind: 'hub', group: '分类', label: '前端' },
    { id: 'c:2', kind: 'hub', group: '分类', label: '后端' },
    { id: 'c:3', kind: 'hub', group: '分类', label: '算法' },
    { id: 't:1', kind: 'hub', group: '标签', label: 'React' },
    { id: 't:2', kind: 'hub', group: '标签', label: '性能' },
    { id: 't:3', kind: 'hub', group: '标签', label: 'SQL' },
    { id: 'p:a', kind: 'leaf', label: 'A', parent: 'c:1', date: '2026-01-05' },
    { id: 'p:b', kind: 'leaf', label: 'B', parent: 'c:1', date: '2026-01-20' },
    { id: 'p:c', kind: 'leaf', label: 'C', parent: 'c:2', date: '2026-03-02' },
    { id: 'p:d', kind: 'leaf', label: 'D', parent: 'c:999', date: '2026-03-08' },
    { id: 'p:e', kind: 'leaf', label: 'E', parent: 'c:3', date: '' }
  ],
  links: [
    { source: 'p:a', target: 't:1', kind: 'tag' },
    { source: 'p:a', target: 't:2', kind: 'tag' },
    { source: 'p:b', target: 't:1', kind: 'tag' },
    { source: 'p:c', target: 't:3', kind: 'tag' },
    { source: 'p:c', target: 't:2', kind: 'tag' },
    { source: 'p:a', target: 'c:1', kind: 'category' }
  ]
};

const bs = blogStats(blogData);

check('文章总数正确（含无日期 / 未分类）', bs.totals.posts === 5, `posts=${bs.totals.posts}`);
check('分类数包含「未分类」兜底', bs.totals.categories === 4, `categories=${bs.totals.categories}（前端/后端/算法/未分类）`);
check('标签数正确', bs.totals.tags === 3, `tags=${bs.totals.tags}`);
check('篇均标签计算正确', Math.abs(bs.totals.avgTags - 5 / 5) < 1e-9, `avgTags=${bs.totals.avgTags}`);

check('分类排行降序且带颜色', bs.catRank[0].value >= bs.catRank[bs.catRank.length - 1].value && !!bs.catRank[0].color);
check('分类排行里「未分类」被算到', bs.catRank.some((r) => r.label === '未分类' && r.value === 1));

check('标签排行降序', bs.tagRank[0].label === 'React' && bs.tagRank[0].value === 2, JSON.stringify(bs.tagRank));

check('旭日图有内环分类与外环标签', bs.sunburst.length > 0 && bs.sunburst.every((s) => Array.isArray(s.children)));

// 交叉矩阵：前端 × React 应为 2（A、B 两篇）
const m = bs.catTagMatrix;
const ri = m.rows.indexOf('前端');
const ci = m.cols.indexOf('React');
check('分类×标签交叉矩阵命中（前端 × React = 2）', ri >= 0 && ci >= 0 && m.values[ri][ci] === 2,
  `rows=${m.rows.join('/')} cols=${m.cols.join('/')}`);
check('矩阵维度自洽（行×列）', m.values.length === m.rows.length && m.values.every((r) => r.length === m.cols.length));

check('每月系列补齐空月（1→2→3 月都在）', (() => {
  const all = bs.monthlyByCat.flatMap((s) => s.points.map((p) => p.x));
  return all.includes('2026-01') && all.includes('2026-02') && all.includes('2026-03');
})(), `月份=${[...new Set(bs.monthlyByCat.flatMap((s) => s.points.map((p) => p.x)))].join(',')}`);
check('空月计 0（2 月没有文章）', (() => {
  const feb = bs.monthlyByCat.flatMap((s) => s.points.filter((p) => p.x === '2026-02').map((p) => p.y));
  return feb.length > 0 && feb.every((y) => y === 0);
})());
check('每月系列每条都有 label/color/points', bs.monthlyByCat.every((s) => s.label && s.color && Array.isArray(s.points)));

check('雷达 6 个维度且数值非 NaN', bs.radar.length === 6 && bs.radar.every((a) => Number.isFinite(a.value)));
check('进度环 3 个且值域 0..1', bs.gauges.length === 3 && bs.gauges.every((g) => g.value >= 0 && g.value <= 1));

// 边界：空数据 / 全无日期
section('博客统计 · 边界');

const emptyBlog = blogStats({ nodes: [], links: [] });
check('空数据不抛异常', !!emptyBlog && emptyBlog.totals.posts === 0);
check('空数据雷达/环/系列都为空或安全', emptyBlog.monthlyByCat.length === 0 && emptyBlog.gauges.every((g) => Number.isFinite(g.value)));
check('空数据分类排行为空', emptyBlog.catRank.length === 0);

const noDate = blogStats({ nodes: [{ id: 'p:x', kind: 'leaf', label: 'X', parent: 'c:1' }], links: [] });
check('全部无日期时每月系列为空（不生成空图）', noDate.monthlyByCat.length === 0);
check('全部无日期时不产生 NaN', noDate.radar.every((a) => Number.isFinite(a.value)));

const undef = blogStats(undefined);
check('data 为 undefined 不抛异常', undef.totals.posts === 0);

// ---------------------------------------------------------------- 开源统计
section('开源项目统计（repoStats）');

const repoData = {
  nodes: [
    { id: 'L:TypeScript', kind: 'hub', group: '编程语言', label: 'TypeScript', count: 2 },
    { id: 'L:Go', kind: 'hub', group: '编程语言', label: 'Go', count: 1 },
    { id: 'A:开发工具', kind: 'hub', group: '应用分类', label: '开发工具', count: 2 },
    { id: 'r:1', kind: 'leaf', label: 'a/one', owner: 'a', lang: 'TypeScript', cat: '开发工具', stars: 100, date: '2026-01-10', one: '简介' },
    { id: 'r:2', kind: 'leaf', label: 'b/two', owner: 'b', lang: 'TypeScript', cat: '开发工具', stars: 300, date: '2026-02-15', one: '简介' },
    { id: 'r:3', kind: 'leaf', label: 'c/three', owner: 'c', lang: 'Go', cat: '', stars: 50, date: '2026-04-01' },
    { id: 'r:4', kind: 'leaf', label: 'd/four', owner: 'd', lang: '', cat: '', stars: 0, date: '' }
  ],
  links: []
};

const rs = repoStats(repoData);
check('仓库总数正确', rs.totals.repos === 4, `repos=${rs.totals.repos}`);
check('语言数含「其他」兜底', rs.totals.languages === 3, `languages=${rs.totals.languages}（TS/Go/其他）`);
check('star 总数汇总正确', rs.totals.stars === 450, `stars=${rs.totals.stars}`);

check('语言排行降序', rs.langRank[0].label === 'TypeScript' && rs.langRank[0].value === 2);
check('语言×分类矩阵命中（TS × 开发工具 = 2）', (() => {
  const mm = rs.langCatMatrix;
  const r = mm.rows.indexOf('TypeScript');
  const c = mm.cols.indexOf('开发工具');
  return r >= 0 && c >= 0 && mm.values[r][c] === 2;
})());

check('气泡图坐标为有限数（无 log(0) / NaN）', rs.bubbles.length > 0 && rs.bubbles.every((b) => Number.isFinite(b.x) && Number.isFinite(b.y) && b.size > 0),
  JSON.stringify(rs.bubbles.map((b) => [b.label, b.x, b.y])));
check('平均 star 计算正确（TypeScript = 200）', (() => {
  const b = rs.bubbles.find((x) => x.label === 'TypeScript');
  return b && b.y === 200;
})());

check('每月系列补齐空月（1,2,3,4 月）', (() => {
  const ms = [...new Set(rs.monthlyByLang.flatMap((s) => s.points.map((p) => p.x)))];
  return ms.join(',') === '2026-01,2026-02,2026-03,2026-04';
})(), `月份=${[...new Set(rs.monthlyByLang.flatMap((s) => s.points.map((p) => p.x)))].join(',')}`);

// r:1 / r:2 有 one_line（AI 解读），r:3 / r:4 没有 → 2/4
check('AI 覆盖率计算正确（2/4）', Math.abs(rs.totals.aiCoverage - 0.5) < 1e-9, `aiCoverage=${rs.totals.aiCoverage}`);
check('进度环 3 个且值域 0..1', rs.gauges.length === 3 && rs.gauges.every((g) => g.value >= 0 && g.value <= 1));

const emptyRepo = repoStats({ nodes: [], links: [] });
check('空数据不抛异常且不产生 NaN', emptyRepo.totals.repos === 0
  && emptyRepo.gauges.every((g) => Number.isFinite(g.value))
  && emptyRepo.bubbles.length === 0);
check('空数据 AI 覆盖率不除零', emptyRepo.totals.aiCoverage === 0);

// ---------------------------------------------------------------- 汇总
console.log(`\n${'='.repeat(60)}`);
console.log(`graphStats 探针：${pass} 过 / ${fail} 失败`);
if (fail) {
  console.log('\n失败清单：');
  for (const f of failures) console.log(`  ❌ ${f}`);
}
process.exit(fail ? 1 : 0);
