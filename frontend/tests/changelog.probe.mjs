// 更新日志纯函数探针（零依赖，Node 直接跑）：
//   node frontend/tests/changelog.probe.mjs
//
// 只验证 lib/changelog.js 的纯函数，不碰 DOM，也不需要浏览器或第三方库。
// 断言用最简单的 assert 手写，失败即 process.exit(1)。
import {
  CHANGELOG, CHANGE_TYPES, CHANGE_TYPE_ORDER,
  sortVersions, changelogStats, filterChanges, formatDate
} from '../src/lib/changelog.js';

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

console.log('=== 1. sortVersions：按日期倒序，且不改原数组 ===');
{
  const raw = [
    { version: 'a', date: '2026-10-07', changes: [] },
    { version: 'b', date: '2026-10-11', changes: [] },
    { version: 'c', date: '2026-10-06', changes: [] }
  ];
  const snapshot = JSON.stringify(raw);
  const sorted = sortVersions(raw);
  eq('倒序结果', sorted.map((v) => v.version), ['b', 'a', 'c']);
  ok('原数组未被改动', JSON.stringify(raw) === snapshot);
  ok('返回的是新数组', sorted !== raw);

  // 同一天的多条：稳定排序，保持传入顺序
  const sameDay = [
    { version: 'x', date: '2026-10-11', changes: [] },
    { version: 'y', date: '2026-10-11', changes: [] },
    { version: 'z', date: '2026-10-11', changes: [] }
  ];
  eq('同日期保持原顺序（稳定排序）', sortVersions(sameDay).map((v) => v.version), ['x', 'y', 'z']);

  eq('非数组输入返回空数组', sortVersions(null), []);
}

console.log('\n=== 2. changelogStats：真实数据统计 ===');
{
  const stats = changelogStats(CHANGELOG);
  const manualTotal = CHANGELOG.reduce((n, v) => n + v.changes.length, 0);
  const manualByType = { feat: 0, improve: 0, fix: 0, remove: 0 };
  for (const v of CHANGELOG) {
    for (const c of v.changes) manualByType[c.type] = (manualByType[c.type] || 0) + 1;
  }
  const dates = CHANGELOG.map((v) => v.date).sort();

  eq('versions = 版本条数', stats.versions, CHANGELOG.length);
  eq('totalChanges = 条目总数', stats.totalChanges, manualTotal);
  eq('byType 四类计数', stats.byType, manualByType);
  eq('firstDate = 最早日期', stats.firstDate, dates[0]);
  eq('lastDate = 最新日期', stats.lastDate, dates[dates.length - 1]);
  ok('firstDate <= lastDate', stats.firstDate <= stats.lastDate);
  ok('四类计数之和 = 总条目数',
    stats.byType.feat + stats.byType.improve + stats.byType.fix + stats.byType.remove === stats.totalChanges);

  eq('空列表统计', changelogStats([]), {
    versions: 0, firstDate: '', lastDate: '', totalChanges: 0,
    byType: { feat: 0, improve: 0, fix: 0, remove: 0 }
  });
}

console.log('\n=== 3. filterChanges：按类型与关键词过滤 ===');
{
  const sample = [
    { version: 'v1', date: '2026-10-11', changes: [
      { type: 'feat', text: '新增图书库' },
      { type: 'fix', text: '修复登录按钮' }
    ] },
    { version: 'v2', date: '2026-10-10', changes: [
      { type: 'improve', text: '改进搜索' }
    ] }
  ];

  eq('空 query + all → 原样返回全部版本',
    filterChanges(sample, { type: 'all', query: '' }).map((v) => v.version), ['v1', 'v2']);
  eq('不带参数 → 返回全部', filterChanges(sample).map((v) => v.version), ['v1', 'v2']);
  eq('type=feat → 只剩含 feat 的版本', filterChanges(sample, { type: 'feat' }).map((v) => v.version), ['v1']);
  eq('type=feat 时该版只剩 feat 条目',
    filterChanges(sample, { type: 'feat' })[0].changes.map((c) => c.text), ['新增图书库']);
  eq('type=remove（无命中）→ 空数组', filterChanges(sample, { type: 'remove' }), []);
  eq('query 命中标题外的文本（大小写不敏感）',
    filterChanges(sample, { query: '图书' }).map((v) => v.version), ['v1']);
  eq('query 无命中 → 空数组', filterChanges(sample, { query: '不存在的关键词xyz' }), []);
  eq('type + query 同时生效',
    filterChanges(sample, { type: 'fix', query: '登录' }).map((v) => v.version), ['v1']);
  ok('过滤结果不改原数组', JSON.stringify(sample[0].changes.length) === '2');
  ok('过滤后的版本对象是新对象', filterChanges(sample, { type: 'feat' })[0] !== sample[0]);
}

console.log('\n=== 4. formatDate ===');
{
  eq("'2026-10-11' 原样返回", formatDate('2026-10-11'), '2026-10-11');
  eq('带时间的 ISO 串截到日', formatDate('2026-10-11T08:30:00Z'), '2026-10-11');
  eq('空值返回空串', formatDate(''), '');
  eq('null 返回空串', formatDate(null), '');
  eq('非法串返回空串', formatDate('not-a-date'), '');
  const d = new Date(2026, 9, 11);
  eq('Date 对象转 YYYY-MM-DD', formatDate(d), '2026-10-11');
  eq('非法 Date 返回空串', formatDate(new Date('x')), '');
}

console.log('\n=== 5. CHANGE_TYPES 与真实数据的类型必须对得上 ===');
{
  const keys = Object.keys(CHANGE_TYPES);
  eq('类型键就是四类', keys.sort(), ['feat', 'fix', 'improve', 'remove']);
  ok('CHANGE_TYPE_ORDER 覆盖全部类型',
    CHANGE_TYPE_ORDER.slice().sort().join(',') === keys.slice().sort().join(','));
  for (const k of keys) {
    ok(`CHANGE_TYPES.${k} 有 label / icon / color`,
      Boolean(CHANGE_TYPES[k].label && CHANGE_TYPES[k].icon && CHANGE_TYPES[k].color));
  }
  const unknown = [];
  for (const v of CHANGELOG) {
    for (const c of v.changes) if (!CHANGE_TYPES[c.type]) unknown.push(`${v.version}:${c.type}`);
  }
  eq('真实数据里没有未知类型', unknown, []);

  const badVersion = CHANGELOG.filter((v) => !/^v\d+\.\d+\.\d+$/.test(v.version));
  eq('版本号格式全部合法', badVersion.map((v) => v.version), []);
  const badDate = CHANGELOG.filter((v) => !/^\d{4}-\d{2}-\d{2}$/.test(v.date));
  eq('日期格式全部合法', badDate.map((v) => v.version), []);
}

console.log('\n=== 真实数据概览 ===');
{
  const stats = changelogStats(CHANGELOG);
  console.log(`共 ${stats.versions} 版，覆盖 ${stats.firstDate} ~ ${stats.lastDate}，合计 ${stats.totalChanges} 条变更`);
  console.log(`  新增 ${stats.byType.feat} / 改进 ${stats.byType.improve} / 修复 ${stats.byType.fix} / 移除 ${stats.byType.remove}`);
  console.log('  每版标题：');
  for (const v of sortVersions(CHANGELOG)) {
    console.log(`    ${v.version}  ${v.date}  ${v.title}  （${v.changes.length} 条）`);
  }
}

console.log(`\n结果：${passed} 过 / ${failed} 失败`);
if (failed > 0) process.exit(1);
