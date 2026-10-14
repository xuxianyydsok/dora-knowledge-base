/* 特效图鉴总览页的交互（外提成文件：主站 CSP 是 script-src 'self'，禁内联脚本）。
   只做三件事：折叠展开预览、新标签打开、按编号/名称过滤。 */
(function () {
  'use strict';

  var secs = Array.prototype.slice.call(document.querySelectorAll('.lab-sec'));
  var cnt = document.getElementById('cnt');
  var q = document.getElementById('q');

  // 统计组件总数（从各组的编号范围求和，便于一眼看到规模）
  // 总数用各组 data-count 的真实卡片数（编号有断号，用范围相减会算多）。
  var total = 0;
  secs.forEach(function (s) { total += Number(s.dataset.count || 0); });
  if (cnt) cnt.textContent = '共 ' + (total || '—') + ' 个组件 · ' + secs.length + ' 组';

  secs.forEach(function (sec) {
    var frame = sec.querySelector('.lab-frame');
    var openBtn = sec.querySelector('.open');
    var newBtn = sec.querySelector('.newtab');

    // 惰性加载：第一次展开才真正把 iframe 指过去。
    // 186 个组件里有一堆 WebGL / canvas 常驻渲染，10 个 iframe 同时挂上会卡。
    function ensureSrc() {
      if (frame && !frame.src) frame.src = frame.dataset.src;
    }

    if (openBtn) {
      openBtn.addEventListener('click', function () {
        var on = frame.classList.toggle('on');
        if (on) ensureSrc();
        openBtn.textContent = on ? '收起预览' : '打开预览';
        openBtn.classList.toggle('on', on);
        if (on) sec.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    }
    if (newBtn) {
      newBtn.addEventListener('click', function () {
        window.open(newBtn.dataset.src, '_blank', 'noopener');
      });
    }
  });

  // 过滤：按编号（如 174）或名称（如 热力图）筛出对应的一组。
  if (q) {
    q.addEventListener('input', function () {
      var v = q.value.trim();
      secs.forEach(function (sec) {
        if (!v) { sec.hidden = false; return; }
        var hay = (sec.dataset.name || '') + ' ' + (sec.dataset.range || '');
        var hit = hay.indexOf(v) >= 0;
        // 也支持直接输编号：落在该组的范围内就命中
        var n = Number(v);
        if (!hit && !isNaN(n)) {
          var m = String(sec.dataset.range || '').match(/(\d+)\D+(\d+)/);
          if (m && n >= Number(m[1]) && n <= Number(m[2])) hit = true;
        }
        sec.hidden = !hit;
      });
    });
  }
})();
