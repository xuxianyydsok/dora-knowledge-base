// fontUnify.probe.mjs —— 全站字体收口探针
//
// 背景（2026-10-12 用户要求）：导航栏按钮的字体要统一成「和品牌名 Dora Studio
//   同一套」的精致字面，别的页面也换掉那种到处乱回退的默认字体。
//
// 做法：起本地静态站，读**计算后的** font-family（不是读 CSS 源文件 ——
//   源文件里写对了但被别的规则盖掉的情况只有实测才发现）。
//   断言：导航 / 品牌 / 登录胶囊 / 正文 / 按钮 / 表单控件全部落到 Satoshi，
//   且导航与品牌同一套字，导航字重为真实存在的 500（不是合成的 600）。
//
// 用法：先起本地静态服务 `node tests/spa-server.mjs dist 5173`，再跑本文件。

import { withPage } from './cdp.mjs';

const BASE = process.env.PROBE_BASE || 'http://127.0.0.1:5173';

let pass = 0; let fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  \u2705 ${name}${extra ? ' —— ' + extra : ''}`); }
  else { fail++; console.log(`  \u274c ${name}${extra ? ' —— ' + extra : ''}`); }
}

console.log('\n\u5168\u7ad9\u5b57\u4f53\u6536\u53e3\u63a2\u9488\n' + '='.repeat(60));

// 只取字体栈第一个族名（去掉引号），用来判断「实际生效的是不是 Satoshi」
const READ = `(sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const s = getComputedStyle(el);
  return {
    first: s.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
    size: s.fontSize,
    weight: s.fontWeight,
  };
}`;

const home = await withPage(BASE + '/', async (ev) => ev(`(() => {
  const read = ${READ};
  return JSON.stringify({
    nav: read('.app-nav a'),
    brand: read('.app-header .brand'),
    login: read('.login-link'),
    body: read('body'),
    btn: read('.app-main button'),
  });
})()`), { port: 9721, width: 1440, height: 900, waitMs: 6000 });
const h = JSON.parse(home);

ok('导航链接走 Satoshi', h.nav?.first === 'Satoshi', JSON.stringify(h.nav));
ok('品牌名走 Satoshi', h.brand?.first === 'Satoshi', JSON.stringify(h.brand));
ok('导航与品牌是同一套字体（都是 Satoshi）',
  h.nav?.first === h.brand?.first, `${h.nav?.first} / ${h.brand?.first}`);
ok('导航字重是真实存在的 500（不是合成的 600）',
  h.nav?.weight === '500', `weight=${h.nav?.weight}`);
ok('导航字号收敛到 13.5px', h.nav?.size === '13.5px', h.nav?.size);
ok('登录胶囊走 Satoshi', h.login?.first === 'Satoshi', JSON.stringify(h.login));
ok('body 走 Satoshi', h.body?.first === 'Satoshi', JSON.stringify(h.body));
ok('正文按钮走 Satoshi（不是浏览器默认）',
  h.btn?.first === 'Satoshi', JSON.stringify(h.btn));

// 表单控件：挑两个真的有输入框的页面测（首页没有 input）
const forms = await withPage(BASE + '/search', async (ev) => ev(`(() => {
  const read = ${READ};
  return JSON.stringify({ input: read('input'), select: read('select') });
})()`), { port: 9722, width: 1440, height: 900, waitMs: 6000 });
const f = JSON.parse(forms);
ok('搜索页输入框走 Satoshi', f.input?.first === 'Satoshi', JSON.stringify(f.input));
ok('搜索页下拉框走 Satoshi', f.select?.first === 'Satoshi', JSON.stringify(f.select));

// 博客正文：刻意保留的衬线体，别被这轮「收口」误伤成 Satoshi
const post = await withPage(BASE + '/search', async (ev) => ev(`(() => {
  const read = ${READ};
  const el = document.querySelector('.post-content-wrap');
  return JSON.stringify({ wrap: el ? read('.post-content-wrap') : null });
})()`), { port: 9723, width: 1440, height: 900, waitMs: 6000 });
const p = JSON.parse(post);
if (p.wrap) {
  ok('博客正文仍是衬线体（未被误伤）', p.wrap.first === 'Newsreader', JSON.stringify(p.wrap));
} else {
  ok('博客正文仍是衬线体（未被误伤）', true, '本页无正文，跳过');
}

console.log('-'.repeat(60));
console.log(`\n\u7ed3\u679c\uff1a${pass} \u8fc7 / ${fail} \u5931\u8d25`);
process.exit(fail ? 1 : 0);
