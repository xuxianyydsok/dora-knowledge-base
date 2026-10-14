/* mindmap.js — SVG 思维导图（左→右树形，自动换行、层级配色走 CSS 变量） */
(function (global) {
  'use strict';
  var meas = document.createElement('canvas').getContext('2d');

  function fontFor(d) { return (d === 0 ? '600 15px ' : d === 1 ? '600 13.5px ' : '400 12.5px ') + '"Segoe UI","Microsoft YaHei UI",sans-serif'; }
  function tw(s, d) { meas.font = fontFor(d); return meas.measureText(s).width; }
  function wrap(text, maxW, d) {
    meas.font = fontFor(d);
    var lines = [], cur = '';
    String(text).split('').forEach(function (ch) {
      if (ch === '\n') { lines.push(cur); cur = ''; return; }
      if (meas.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; }
      else cur += ch;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  function build(node, depth, out) {
    var maxW = depth === 0 ? 150 : depth === 1 ? 168 : 190;
    var lines = wrap(node.label, maxW, depth);
    var w = Math.min(Math.max.apply(null, lines.map(function (l) { return tw(l, depth); })) + 22, maxW + 22);
    var n = { node: node, depth: depth, lines: lines, w: w, h: lines.length * (depth === 0 ? 20 : 17) + 12, children: [] };
    out.push(n);
    (node.children || []).forEach(function (c) { n.children.push(build(c, depth + 1, out)); });
    return n;
  }
  function layout(root, x0, colGap) {
    var y = 20;
    (function place(n, depth) {
      n.x = x0 + depth * colGap;
      if (!n.children.length) { n.y = y; y += n.h + 9; }
      else {
        n.children.forEach(function (c) { place(c, depth + 1); });
        n.y = (n.children[0].y + n.children[n.children.length - 1].y) / 2;
      }
    })(root, 0);
    return y;
  }
  function E(tag, at) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in at) e.setAttribute(k, at[k]);
    return e;
  }

  global.MindMap = {
    render: function (host, tree, opt) {
      opt = opt || {};
      host.innerHTML = '';
      var root = Array.isArray(tree) ? { label: opt.title || '本章框架', children: tree } : tree;
      var all = [], rt = build(root, 0, all);
      var depthMax = Math.max.apply(null, all.map(function (n) { return n.depth; }));
      var colGap = opt.colGap || 240;
      var bottom = layout(rt, 14, colGap);
      var W = 14 + (depthMax + 1) * colGap + 150, H = bottom + 12;
      var svg = E('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, class: 'mm', 'aria-label': opt.title || '思维导图' });

      (function links(n) {
        n.children.forEach(function (c) {
          var x1 = n.x + n.w, y1 = n.y + n.h / 2, x2 = c.x, y2 = c.y + c.h / 2, mx = (x1 + x2) / 2;
          svg.appendChild(E('path', { class: 'mm-l' + Math.min(c.depth, 4),
            d: 'M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2 }));
          links(c);
        });
      })(rt);

      all.forEach(function (n) {
        var d = Math.min(n.depth, 4);
        svg.appendChild(E('rect', { class: 'mm-box mm-d' + d, x: n.x, y: n.y, width: n.w, height: n.h, rx: 9 }));
        n.lines.forEach(function (l, i) {
          var t = E('text', { class: 'mm-t mm-d' + d, x: n.x + n.w / 2, y: n.y + 14 + i * (n.depth === 0 ? 20 : 17) });
          t.textContent = l;
          svg.appendChild(t);
        });
        if (n.node.tip) {
          var tp = E('text', { class: 'mm-tip', x: n.x + n.w + 9, y: n.y + n.h / 2 + 4 });
          tp.textContent = n.node.tip;
          svg.appendChild(tp);
        }
      });
      host.appendChild(svg);
    }
  };
})(window);
