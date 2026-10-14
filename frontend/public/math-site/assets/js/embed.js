/* embed.js —— 被 Dora 主站以 /math-site/…?embed=1 内嵌时的适配层（2026-10-14 新增；
   2026-10-14 目录由 math/ 改名为 math-site/，避免与本站 /math 路由冲突）
 *
 * 目的：让讲义子站在主站 <iframe> 里看起来像「主站自己的一页」，
 *       而不是一个外挂的独立站点。
 *
 * 只做三件事：
 *   1. 识别 ?embed=1：给 <html> 挂 .is-embed（交给 embed.css 收掉冗余 UI），
 *      并把主题钉成浅色 —— 主站只有 纯净/素雅/天青 三套**浅色**主题，
 *      2026-10-09 起深色已下线，嵌入态跟随深色会跟主站打架。
 *   2. 站内互跳（*.html）自动带上 embed=1：否则从总览点进「微积分讲义」
 *      会掉出嵌入态，子页把自己的整条顶栏又渲一遍，变成「双顶栏」。
 *   3. 提供「返回主站」按钮（#app-back）：在 iframe 里用 postMessage 请主站
 *      路由回首页；独立打开时退化成直接跳 /。
 *
 * 约定沿用本站契约：不引第三方库、不用 ES module、不用 fetch
 * （页面要能被 file:// 双击打开）。
 *
 * 本文件是**新增**文件：index.js / shell.js 只做「嵌入态下不再自管主题」
 * 与「☰ 按钮已移除」两处最小改动，其余逻辑一律未动。
 */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var EMBED = /(?:^|[?&])embed=1(?:&|$)/.test(location.search || '');

  /* 暴露给 index.js / shell.js 判断，避免它们重复解析 query */
  window.__LEC_EMBED__ = EMBED;

  if (!EMBED) return;

  /* —— 1. 嵌入标记 + 主题钉浅色 —— */
  root.classList.add('is-embed');
  root.setAttribute('data-theme', 'light');

  /* —— 2. 站内链接保住 embed=1 —— */
  function withEmbed(href) {
    if (!href) return href;
    // 外链 / 协议相对 / 纯锚点 一律不动
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href)) return href;
    // 只处理真实存在的 .html 页面互跳
    if (!/\.html(?:[?#]|$)/i.test(href)) return href;
    if (/(?:^|[?&])embed=1(?:&|$)/.test(href)) return href;
    return href + (href.indexOf('?') === -1 ? '?embed=1' : '&embed=1');
  }

  // 捕获阶段改写 href，抢在浏览器默认跳转之前；只改不同值的链接，避免无谓重写
  doc.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // 新窗口/新标签照常
    var el = e.target;
    while (el && el !== doc && !(el.tagName === 'A')) el = el.parentNode;
    if (!el || el.tagName !== 'A') return;
    if (el.target && el.target !== '_self') return;
    var raw = el.getAttribute('href');
    var next = withEmbed(raw);
    if (next && next !== raw) el.setAttribute('href', next);
  }, true);

  /* —— 3. 「返回主站」按钮 —— */
  function bindBack() {
    var btn = doc.getElementById('app-back');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var inFrame = true;
      try { inFrame = window.parent && window.parent !== window; } catch (err) { inFrame = true; }
      if (inFrame) {
        // 交给主站处理（MathFrame.jsx 监听此消息后 route('/')）
        try { window.parent.postMessage({ type: 'dora:leave-math' }, '*'); return; } catch (err2) { /* 落到下面 */ }
      }
      location.href = '/';
    });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', bindBack);
  else bindBack();
})();
