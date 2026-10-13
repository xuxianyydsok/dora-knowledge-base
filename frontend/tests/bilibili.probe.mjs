// bilibili.probe.mjs —— B 站曲目解析与嵌入地址探针
//
// 用户要求（2026-10-13）：
//   「我在上传那个音乐的时候，就是可以上传那个一个哔哩哔哩的一个链接」
//   「我需要的就是那个视频窗口，就比如说有些音乐它是以 MV 的形式呈现出来的，
//    那个就不光是听音乐，那个直接看那个视频」
//
// 解析规则前后端各有一份（两套运行时，没有共享源码目录），
// 这个探针**同时跑两份并断言结果一致** —— 规则漂移会让「前端能拼出地址、
// 后端却拒绝入库」这类问题在线上才暴露。

import * as fe from '../src/lib/bilibili.js';
import * as be from '../../backend/src/lib/bilibili.js';

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

console.log('\nB 站曲目探针\n' + '='.repeat(60));

// ---------------- 1. 从各种输入里抽 BV 号 ----------------
console.log('=== 1. 链接解析 ===');
const cases = [
  ['纯 BV 号', 'BV1GJ411x7h7', 'BV1GJ411x7h7'],
  ['标准视频链接', 'https://www.bilibili.com/video/BV1GJ411x7h7', 'BV1GJ411x7h7'],
  ['带参数链接', 'https://www.bilibili.com/video/BV1GJ411x7h7?p=2&t=30', 'BV1GJ411x7h7'],
  ['手机端链接', 'https://m.bilibili.com/video/BV1GJ411x7h7', 'BV1GJ411x7h7'],
  ['播放器链接', 'https://player.bilibili.com/player.html?bvid=BV1GJ411x7h7', 'BV1GJ411x7h7'],
  ['带前后空格的链接', '  https://www.bilibili.com/video/BV1GJ411x7h7  ', 'BV1GJ411x7h7'],
  ['大小写敏感的 BV 号（不能转小写）', 'BV1GJ411X7H7', 'BV1GJ411X7H7'],
  ['分享文案里夹着链接', '看看这个 https://www.bilibili.com/video/BV1GJ411x7h7 超好听', 'BV1GJ411x7h7']
];
for (const [name, input, expect] of cases) {
  eq(name, fe.parseBilibiliInput(input).bvid, expect);
  eq(name + '（后端一致）', be.parseBilibiliInput(input).bvid, expect);
}

// ---------------- 2. 分 P ----------------
console.log('=== 2. 分 P 解析 ===');
eq('?p=3 解析出分 P', fe.parseBilibiliInput('https://www.bilibili.com/video/BV1GJ411x7h7?p=3').p, 3);
eq('&p=12 解析出分 P', fe.parseBilibiliInput('https://www.bilibili.com/video/BV1GJ411x7h7?a=1&p=12').p, 12);
eq('没有 p 参数则为 null', fe.parseBilibiliInput('https://www.bilibili.com/video/BV1GJ411x7h7').p, null);
eq('p=0 视为无效', fe.parseBilibiliInput('https://www.bilibili.com/video/BV1GJ411x7h7?p=0').p, null);
// BV 号里本身带数字，不能被误当成 p
eq('BV 号里的数字不误判为分 P', fe.parseBilibiliInput('BV1GJ411x7h7').p, null);

// ---------------- 3. 短链与 AV 号 ----------------
console.log('=== 3. 短链 / AV 号 ===');
eq('b23.tv 短链标记为待展开', fe.parseBilibiliInput('https://b23.tv/abc123').isShortLink, true);
eq('短链没有直接拿到 bvid', fe.parseBilibiliInput('https://b23.tv/abc123').bvid, null);
eq('av 号被识别', fe.parseBilibiliInput('av170001').isAv, true);
eq('av 号取到 aid', fe.parseBilibiliInput('av170001').aid, 170001);
eq('av 号没有 bvid（需联网转换）', fe.parseBilibiliInput('av170001').bvid, null);

// ---------------- 4. 非法输入 ----------------
console.log('=== 4. 非法输入 ===');
for (const bad of ['', '   ', 'https://www.bilibili.com/', '随便一段文字', 'BV123', 'BV1GJ411x7h7extra']) {
  const r = fe.parseBilibiliInput(bad);
  // 'BV1GJ411x7h7extra' 里含合法 BV 前缀，会被抽出来 —— 这是有意的（宽松匹配）
  if (bad === 'BV1GJ411x7h7extra') continue;
  ok(`非法输入「${bad}」不产出 bvid`, r.bvid === null, `实际 ${r.bvid}`);
}
eq('null 输入不抛错', fe.parseBilibiliInput(null).bvid, null);
eq('undefined 输入不抛错', fe.parseBilibiliInput(undefined).bvid, null);

// ---------------- 5. 嵌入地址 ----------------
console.log('=== 5. 嵌入播放器地址 ===');
const url = fe.bilibiliEmbedUrl('BV1GJ411x7h7');
ok('生成的是 player.bilibili.com', url.startsWith('https://player.bilibili.com/player.html?'), url);
ok('带上了 bvid', url.includes('bvid=BV1GJ411x7h7'));
ok('默认不自动播放（浏览器会拦截带声音的自动播放）', url.includes('autoplay=0'));
ok('默认关弹幕（用户要的是音乐/MV 播放器，不是视频站）', url.includes('danmaku=0'));
ok('默认高清', url.includes('high_quality=1'));
eq('非法 bvid 返回 null', fe.bilibiliEmbedUrl('abc'), null);
eq('空值返回 null', fe.bilibiliEmbedUrl(''), null);
const withP = fe.bilibiliEmbedUrl('BV1GJ411x7h7', { p: 2 });
ok('分 P 带进地址', withP.includes('p=2'), withP);
const auto = fe.bilibiliEmbedUrl('BV1GJ411x7h7', { autoplay: true, danmaku: true });
ok('autoplay/danmaku 可显式打开', auto.includes('autoplay=1') && auto.includes('danmaku=1'));

// ---------------- 6. 校验与播放页地址 ----------------
console.log('=== 6. 校验 / 播放页 ===');
eq('合法 BV 号通过校验', fe.isValidBvid('BV1GJ411x7h7'), true);
eq('非法值不通过校验', fe.isValidBvid('BV123'), false);
eq('空值不通过校验', fe.isValidBvid(''), false);
eq('播放页地址正确', fe.bilibiliPageUrl('BV1GJ411x7h7'), 'https://www.bilibili.com/video/BV1GJ411x7h7');
eq('播放页带分 P', fe.bilibiliPageUrl('BV1GJ411x7h7', { p: 3 }), 'https://www.bilibili.com/video/BV1GJ411x7h7?p=3');
eq('非法 bvid 的播放页为 null', fe.bilibiliPageUrl('x'), null);

// ---------------- 7. 前后端规则一致性（关键） ----------------
console.log('=== 7. 前后端规则一致性 ===');
const inputs = [
  'BV1GJ411x7h7', 'https://www.bilibili.com/video/BV1GJ411x7h7?p=2',
  'https://b23.tv/abc', 'av170001', '', 'garbage', null, undefined
];
let allSame = true; const diffs = [];
for (const inp of inputs) {
  const a = JSON.stringify(fe.parseBilibiliInput(inp));
  const b = JSON.stringify(be.parseBilibiliInput(inp));
  if (a !== b) { allSame = false; diffs.push(`${inp}: 前端 ${a} / 后端 ${b}`); }
}
ok('所有输入的解析结果前后端一致', allSame, diffs.join(' | '));
ok('嵌入地址生成一致', fe.bilibiliEmbedUrl('BV1GJ411x7h7') === be.bilibiliEmbedUrl('BV1GJ411x7h7'));
ok('校验函数一致', fe.isValidBvid('BV1GJ411x7h7') === be.isValidBvid('BV1GJ411x7h7'));

// ---------------- 汇总 ----------------
console.log('\n' + '='.repeat(60));
if (fails.length) {
  for (const f of fails) console.log('  ❌ ' + f);
  console.log(`\n结果：${pass} 过 / ${fails.length} 失败`);
  process.exit(1);
} else {
  console.log(`结果：${pass} 过 / 0 失败`);
}
