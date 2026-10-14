/* shell.js — 渲染管线收尾：懒挂载图、侧边目录、滚动高亮、主题、进度条 */
(function (global) {
  'use strict';
  var LEC = global.LEC;
  var byId = {}, mapById = {};

  function indexAll() {
    byId = {}; mapById = {};
    LEC.figures.forEach(function (f) { byId[f.id] = f; });
    LEC.maps.forEach(function (m) { mapById[m.id] = m; });
  }

  function mount(el) {
    if (el.dataset.mounted === '1') return;
    var id = el.id;
    if (byId[id]) LEC.mountFigure(id, byId[id].spec);
    else if (mapById[id]) LEC.mountMap(mapById[id]);
    else { el.innerHTML = '<div class="err">找不到图规格 ' + id + '</div>'; el.dataset.mounted = '1'; return; }
    el.dataset.mounted = '1';
  }

  function lazyMount() {
    indexAll();
    var targets = document.querySelectorAll('.stage, .map');
    if (!global.IntersectionObserver) {
      Array.prototype.forEach.call(targets, mount);
      return;
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        mount(e.target);
        io.unobserve(e.target);
      });
    }, { rootMargin: '500px 0px' });
    Array.prototype.forEach.call(targets, function (el) { io.observe(el); });
  }

  function buildTOC() {
    var host = document.getElementById('toc');
    if (!host) return;
    var html = '<h4>目录</h4><ol>';
    document.querySelectorAll('.chapter').forEach(function (ch) {
      html += '<li><a href="#' + ch.id + '">' + ch.querySelector('h2').textContent + '</a></li>';
      ch.querySelectorAll('.sub').forEach(function (sb) {
        html += '<li><a class="lv2" href="#' + sb.id + '">' + sb.querySelector('h3').textContent + '</a></li>';
      });
    });
    host.insertAdjacentHTML('beforeend', html + '</ol>');
  }

  function scrollspy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
    if (!links.length) return;
    var targets = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    function onScroll() {
      var best = 0, bestY = -Infinity, top = global.scrollY + 96;
      targets.forEach(function (t, i) {
        if (!t) return;
        var y = t.offsetTop;
        if (y <= top && y > bestY) { bestY = y; best = i; }
      });
      links.forEach(function (a, i) { a.classList.toggle('on', i === best); });
      var doc = document.documentElement;
      var p = (global.scrollY) / Math.max(1, doc.scrollHeight - global.innerHeight);
      var bar = document.getElementById('bar');
      if (bar) bar.style.width = Math.min(100, p * 100) + '%';
    }
    global.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function theme() {
    // 嵌入主站时主题由 assets/js/embed.js 决定（主站已无深色），这里不再自管
    if (global.__LEC_EMBED__) return;
    var btn = document.getElementById('theme');
    if (!btn) return;
    function apply(t) {
      document.documentElement.dataset.theme = t;
      btn.textContent = t === 'dark' ? '☀' : '☾';
      if (global.Viz && global.Viz.onThemeChange) setTimeout(global.Viz.onThemeChange, 30);
    }
    var saved = null;
    try { saved = localStorage.getItem('lec-theme'); } catch (e) {}
    apply(saved || (global.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
    btn.addEventListener('click', function () {
      var next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('lec-theme', next); } catch (e) {}
      apply(next);
    });
  }

  function drawer() {
    var t = document.getElementById('toc-btn');
    if (!t) return;
    t.addEventListener('click', function () { document.body.classList.toggle('toc-open'); });
    document.querySelector('.toc').addEventListener('click', function (e) {
      if (e.target.tagName === 'A' && global.innerWidth < 1080) document.body.classList.remove('toc-open');
    });
  }

  /* KaTeX 逐章渲染：整站 1.5 万条公式一次性排完要十几秒，改成滚到哪章排哪章，
   * 空闲时补齐剩余的，打印前全部排完（Ctrl-P 不能看到没渲染的 $ 源码）。 */
  function lazyMath() {
    var chs = Array.prototype.slice.call(document.querySelectorAll('.chapter'));
    if (!global.IntersectionObserver) { LEC.renderMath(document.body); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        LEC.renderMath(e.target);
        io.unobserve(e.target);
      });
    }, { rootMargin: '700px 0px' });
    chs.forEach(function (c) { io.observe(c); });
    var queue = chs.slice();
    function drainAll() { queue.splice(0).forEach(function (c) { LEC.renderMath(c); }); }
    function drain(deadline) {
      while (queue.length && deadline && deadline.timeRemaining() > 3) {
        LEC.renderMath(queue.shift());
      }
      if (queue.length) requestIdleCallback(drain, { timeout: 8000 });
    }
    global.addEventListener('beforeprint', drainAll);
    if (global.requestIdleCallback) requestIdleCallback(drain, { timeout: 8000 });
    else setTimeout(drainAll, 5000);
  }

  global.addEventListener('DOMContentLoaded', function () {
    LEC.render();
    lazyMath();
    buildTOC();
    theme();
    drawer();
    lazyMount();
    scrollspy();
    document.body.dataset.ready = '1';
  });
})(window);
