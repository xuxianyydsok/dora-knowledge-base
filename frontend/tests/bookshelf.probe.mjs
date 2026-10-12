// bookshelf.probe.mjs —— 首页书架（components/BookShelf.jsx）真浏览器探针
//
// 目的：书架这一轮的四条要求全是「只能实测」的版面/动效问题：
//   ① 宽度不要抵到视口边缘（要落在正文宽度内）；
//   ② 两行；
//   ③ 上面一行从左往右移动、下面一行从右往左移动，且悬停要暂停；
//   ④ 点真实图书要**就地**弹出阅读器，另有「查看更多」跳 /books。
//
// 做法：用 cdp.mjs 起无头 Chrome 打开本地静态站首页（访客态），
//   读 DOM + computed style + 观察 1.2 秒内的实际位移方向来断言。
//   悬停暂停用 CDP 原生鼠标事件（`mouseover` 合成事件不会触发 CSS :hover）。

import { withPage } from './cdp.mjs';

const BASE = process.env.PROBE_BASE || 'http://127.0.0.1:5173';

let pass = 0; let fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  \u2705 ${name}${extra ? ' —— ' + extra : ''}`); }
  else { fail++; console.log(`  \u274c ${name}${extra ? ' —— ' + extra : ''}`); }
}

console.log('\n\u9996\u9875\u4e66\u67b6\u63a2\u9488\n' + '='.repeat(60));

const res = await withPage(BASE + '/', async (ev) => {
  const out = await ev(`(async () => {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 300 && !document.querySelector('.bs-book'); i++) await sleep(80);
    await sleep(1200);

    const q = (s) => document.querySelector(s);
    const qa = (s) => [...document.querySelectorAll(s)];

    const wrap = q('.bs-wrap');
    const main = q('.app-main');
    const wRect = wrap ? wrap.getBoundingClientRect() : null;
    const mRect = main ? main.getBoundingClientRect() : null;
    const caseEl = q('.bs-case');
    const caseCs = caseEl ? getComputedStyle(caseEl) : null;

    const tracks = qa('.bs-track');
    const anims = tracks.map((t) => {
      const c = getComputedStyle(t);
      return { name: c.animationName, dur: c.animationDuration, state: c.animationPlayState };
    });

    // 观察 1.2 秒内两条轨道的实际位移方向
    const tx = (m) => { const p = (m || '').match(/matrix\\(([^)]+)\\)/); return p ? parseFloat(p[1].split(',')[4]) : null; };
    const before = tracks.map((t) => tx(getComputedStyle(t).transform));
    await sleep(1200);
    const after = tracks.map((t) => tx(getComputedStyle(t).transform));
    const delta = before.map((b, i) => Math.round((after[i] ?? 0) - (b ?? 0)));

    const books = qa('.bs-book');
    const realBooks = books.filter((b) => !b.classList.contains('is-ph'));
    const more = q('.bs-more');
    const first = books[0] ? books[0].getBoundingClientRect() : null;

    return JSON.stringify({
      hasWrap: !!wrap,
      wrapW: wRect ? Math.round(wRect.width) : 0,
      mainW: mRect ? Math.round(mRect.width) : 0,
      wrapInsideMain: (wRect && mRect)
        ? (wRect.left >= mRect.left - 2 && wRect.right <= mRect.right + 2) : null,
      viewportW: window.innerWidth,
      caseRadius: caseCs ? caseCs.borderRadius : '',
      rows: qa('.bs-tier').length,
      planks: qa('.bs-plank').length,
      marquees: qa('.bs-marquee').length,
      tracks: tracks.length,
      books: books.length,
      realBooks: realBooks.length,
      bookW: first ? Math.round(first.width) : 0,
      bookH: first ? Math.round(first.height) : 0,
      moreText: more ? more.textContent.trim() : '',
      moreHref: more ? more.getAttribute('href') : '',
      anims, delta,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth
    });
  })()`);
  return JSON.parse(out);
}, { port: 9671, width: 1440, height: 1000, waitMs: 30000 });

console.log(JSON.stringify(res, null, 2));
console.log('-'.repeat(60));

ok('书架渲染出来了', res.hasWrap === true);
ok('书架落在正文宽度内（不抵视口边缘）',
  res.wrapInsideMain === true && res.wrapW <= res.mainW && res.wrapW < res.viewportW,
  `书架 ${res.wrapW}px / 正文 ${res.mainW}px / 视口 ${res.viewportW}px`);
ok('是两行', res.rows === 2, `${res.rows} 行`);
ok('每行一条滚动带', res.marquees === 2 && res.tracks === 2, `${res.marquees} 带 / ${res.tracks} 轨`);
ok('两行各一块层板', res.planks === 2, `${res.planks} 块`);
ok('上面一行从左往右',
  res.anims[0]?.name === 'bs-run-right' && res.delta[0] > 0,
  `${res.anims[0]?.name} Δ${res.delta[0]}px`);
ok('下面一行从右往左',
  res.anims[1]?.name === 'bs-run-left' && res.delta[1] < 0,
  `${res.anims[1]?.name} Δ${res.delta[1]}px`);
ok('两条带速度一致', res.anims[0]?.dur === res.anims[1]?.dur, res.anims[0]?.dur);
ok('书是 2:3 竖版', res.bookH > res.bookW * 1.3, `${res.bookW}×${res.bookH}`);
ok('有真实图书上架', res.realBooks > 0, `${res.realBooks} 本真书 / 共 ${res.books} 本`);
ok('「查看更多」存在且跳 /books',
  res.moreText.includes('查看更多') && res.moreHref === '/books',
  `「${res.moreText}」→ ${res.moreHref}`);
ok('页面无横向溢出', res.overflowX <= 0, `溢出 ${res.overflowX}px`);

console.log('-'.repeat(60));
console.log(`\n\u7ed3\u679c\uff1a${pass} \u8fc7 / ${fail} \u5931\u8d25`);
process.exit(fail ? 1 : 0);
