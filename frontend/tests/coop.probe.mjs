// coop.probe.mjs —— 共创页（/coop）真浏览器探针
//
// 目的：共创页是公开可写的留言表单，逻辑上容易出错的地方是
//   「匿名 / 实名的切换」与「提交按钮的可用条件」，
//   以及结尾字标、迷你星体是否真的渲染出来。这些只能实测。
//
// 做法：用 cdp.mjs 起无头 Chrome 打开本地静态站 /coop（访客态），
//   读 DOM + 触发真实点击 + 读 computed style 后断言。
//   **不真的提交表单**（线上还没有 feedback 表，且不该往生产库写测试数据）。

import { withPage } from './cdp.mjs';

const BASE = process.env.PROBE_BASE || 'http://127.0.0.1:5173';

let pass = 0; let fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  \u2705 ${name}${extra ? ' —— ' + extra : ''}`); }
  else { fail++; console.log(`  \u274c ${name}${extra ? ' —— ' + extra : ''}`); }
}

console.log('\n\u5171\u521b\u9875\u63a2\u9488\n' + '='.repeat(60));

const res = await withPage(BASE + '/coop', async (ev) => {
  const out = await ev(`(async () => {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    // 等页面骨架出来
    for (let i = 0; i < 250 && !document.querySelector('.coop-page'); i++) await sleep(60);
    await sleep(600);

    const q = (s) => document.querySelector(s);
    const qa = (s) => [...document.querySelectorAll(s)];

    // ---- 区块顺序 ----
    const order = qa('.coop-intro, .coop-orb, .coop-form, .coop-done, .coop-mark')
      .map(e => e.className.split(' ')[0]);

    // ---- 分类 chip ----
    const cats = qa('.coop-cats button').map(b => b.textContent.trim());

    // ---- 署名方式：默认匿名 ----
    const ident = qa('.coop-ident button');
    const anonBtn = ident[0], realBtn = ident[1];
    const anonOnByDefault = anonBtn ? anonBtn.classList.contains('on') : false;
    const nameFieldHiddenWhenAnon = !q('.coop-name');

    // ---- 空内容时提交按钮应禁用 ----
    const submit = q('.coop-submit');
    const disabledWhenEmpty = submit ? submit.disabled === true : null;
    const submitLabel = submit ? submit.textContent.trim() : '';

    // ---- 输入内容后按钮应可用 ----
    const ta = q('.coop-textarea');
    let enabledAfterTyping = null;
    if (ta) {
      ta.value = '测试一下提交按钮';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(200);
      enabledAfterTyping = q('.coop-submit') ? q('.coop-submit').disabled === false : null;
    }

    // ---- 计数器 ----
    const counter = q('.coop-counter');
    const counterText = counter ? counter.textContent.replace(/\\s+/g, ' ').trim() : '';

    // ---- 切到实名：应出现称呼输入框 ----
    let nameFieldAfterReal = false;
    let realBtnDisabledAsGuest = null;
    if (realBtn) {
      realBtnDisabledAsGuest = realBtn.disabled === true;
      realBtn.click();
      await sleep(250);
      nameFieldAfterReal = !!q('.coop-name');
    }
    // 切回匿名
    if (anonBtn) { anonBtn.click(); await sleep(200); }

    // ---- 结尾字标 ----
    const glyphs = qa('.coop-mark-glyph').map(g => g.textContent);
    const gaps = qa('.coop-mark-gap').length;
    const rule = q('.coop-mark-rule');
    const mark = q('.coop-mark');
    const markCs = mark ? getComputedStyle(mark) : null;
    // 第一个字与最后一个字的 animation-delay 应有明显错峰
    const g0 = qa('.coop-mark-glyph')[0];
    const gLast = qa('.coop-mark-glyph').slice(-1)[0];
    const delay0 = g0 ? getComputedStyle(g0).animationDelay : '';
    const delayLast = gLast ? getComputedStyle(gLast).animationDelay : '';

    // ---- 迷你星体 ----
    const orb = q('.muni');
    const orbCanvas = q('.muni-canvas');
    const orbText = q('.coop-orb-text');
    const orbRect = orb ? orb.getBoundingClientRect() : null;
    const orbTextCs = orbText ? getComputedStyle(orbText) : null;
    // 2026-10-12 用户要求：星体要贴在介绍文字的**右侧**，高度和那段文字齐平，
    // 不是排在段落下面。这里量两者的位置关系。
    const introRect = q('.coop-intro') ? q('.coop-intro').getBoundingClientRect() : null;
    const orbLeftOfIntro = (orbRect && introRect) ? (orbRect.left >= introRect.right - 2) : null;
    const orbSameRow = (orbRect && introRect)
      ? (orbRect.top < introRect.bottom && orbRect.bottom > introRect.top) : null;
    const orbHeightRatio = (orbRect && introRect && introRect.height > 0)
      ? orbRect.height / introRect.height : null;

    // ---- 页面是否有横向溢出（表单不应撑破） ----
    const overflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth;

    return JSON.stringify({
      order,
      cats,
      anonOnByDefault, nameFieldHiddenWhenAnon,
      disabledWhenEmpty, submitLabel, enabledAfterTyping,
      counterText,
      nameFieldAfterReal, realBtnDisabledAsGuest,
      glyphs: glyphs.join(''), glyphCount: glyphs.length, gaps,
      hasRule: !!rule,
      delay0, delayLast,
      markFont: markCs ? markCs.fontFamily : '',
      orbSize: orbRect ? Math.round(orbRect.width) + 'x' + Math.round(orbRect.height) : '',
      hasOrbCanvas: !!orbCanvas,
      orbText: orbText ? orbText.textContent : '',
      orbTextClip: orbTextCs ? (orbTextCs.webkitBackgroundClip || orbTextCs.backgroundClip) : '',
      orbLeftOfIntro, orbSameRow, orbHeightRatio,
      overflowX
    });
  })()`);
  return JSON.parse(out);
}, { port: 9561, width: 1440, height: 1000, waitMs: 30000 });

console.log(JSON.stringify(res, null, 2));
console.log('-'.repeat(60));

ok('区块顺序 intro→orb→form→done→mark',
  JSON.stringify(res.order) === JSON.stringify(['coop-intro', 'coop-orb', 'coop-form', 'coop-done', 'coop-mark']),
  JSON.stringify(res.order));
ok('四类反馈分类齐全', res.cats.length === 4, res.cats.join(' / '));
ok('署名默认匿名', res.anonOnByDefault === true);
ok('匿名时不出称呼输入框', res.nameFieldHiddenWhenAnon === true);
ok('空内容时提交按钮禁用', res.disabledWhenEmpty === true);
ok('输入内容后提交按钮可用', res.enabledAfterTyping === true);
ok('计数器随输入更新', res.counterText.includes('8'), res.counterText);
// 访客态：不能实名（按钮禁用），点不动也不该冒出称呼框
ok('访客态实名按钮禁用', res.realBtnDisabledAsGuest === true);
ok('访客态点实名不出称呼框', res.nameFieldAfterReal === false);
ok('结尾字标是 Dora Studio（10 字母 + 1 空格）',
  res.glyphCount === 10 && res.glyphs.replace(/\s/g, '') === 'DoraStudio' && res.gaps === 1,
  `glyphs=${JSON.stringify(res.glyphs)} count=${res.glyphCount} gaps=${res.gaps}`);
ok('字标有渐变细线', res.hasRule === true);
ok('字标逐字错峰延迟', res.delay0 !== res.delayLast && res.delay0 !== '', `${res.delay0} → ${res.delayLast}`);
// 尺寸是 clamp(220px, 26vw, 340px)：桌面宽屏取上限 340px。
// 关键不是某个固定值，而是「方形 + 与右侧那段文字高度接近」（下面单独断言）。
ok('迷你星体是 220~340px 的方形',
  /^(\d+)x\1$/.test(res.orbSize) && Number(res.orbSize.split('x')[0]) >= 220
  && Number(res.orbSize.split('x')[0]) <= 340, res.orbSize);
ok('迷你星体有 canvas', res.hasOrbCanvas === true);
ok('星体在介绍文字右侧（不是下方）', res.orbLeftOfIntro === true,
  `orbLeftOfIntro=${res.orbLeftOfIntro}`);
ok('星体与介绍文字同一行', res.orbSameRow === true, `orbSameRow=${res.orbSameRow}`);
ok('星体高度与介绍文字相近（0.6~1.6 倍）',
  res.orbHeightRatio > 0.6 && res.orbHeightRatio < 1.6,
  `高度比 ${res.orbHeightRatio ? res.orbHeightRatio.toFixed(2) : 'null'}`);
ok('星体文字是「欢迎加入共创」', res.orbText === '欢迎加入共创', res.orbText);
ok('星体文字用渐变裁切', res.orbTextClip === 'text', res.orbTextClip);
ok('页面无横向溢出', res.overflowX <= 0, `溢出 ${res.overflowX}px`);

console.log('-'.repeat(60));
console.log(`\n\u7ed3\u679c\uff1a${pass} \u8fc7 / ${fail} \u5931\u8d25`);
process.exit(fail ? 1 : 0);
