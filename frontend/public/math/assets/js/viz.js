/* viz.js — 对外统一入口：Viz.plot2 / Viz.plot3 / Viz.transform + 参数滑块 + 重绘调度 */
(function (global) {
  'use strict';
  var Viz = global.Viz = {};
  var items = [];
  var HINT3 = '拖动旋转 · 滚轮缩放 · 右键（或 Shift+拖动）平移 · 双击复位';

  function fmtVal(v) {
    var a = Math.abs(v);
    if (a >= 1000 || (a > 0 && a < 0.01)) return v.toExponential(2);
    return (Math.round(v * 100) / 100).toFixed(a < 10 ? 2 : 1);
  }

  Viz.controls = function (host, params, onChange) {
    var box = document.createElement('div');
    box.className = 'ctrls';
    var state = {};
    Object.keys(params).forEach(function (key) {
      var cfg = params[key] === null ? {} : params[key];
      var min = cfg.min == null ? 0 : cfg.min, max = cfg.max == null ? 1 : cfg.max;
      var step = cfg.step == null ? (max - min) / 100 : cfg.step;
      var val = cfg.value == null ? (min + max) / 2 : cfg.value;
      state[key] = val;
      var row = document.createElement('div');
      row.className = 'ctrl';
      var lab = document.createElement('label');
      lab.textContent = (cfg.label || key);
      var input = document.createElement('input');
      input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = val;
      input.setAttribute('aria-label', cfg.label || key);
      var out = document.createElement('output');
      out.textContent = fmtVal(val);
      var btn = document.createElement('button');
      btn.type = 'button'; btn.textContent = '复位';
      input.addEventListener('input', function () {
        state[key] = parseFloat(input.value);
        out.textContent = fmtVal(state[key]);
        onChange(copy(state));
      });
      btn.addEventListener('click', function () {
        input.value = val; state[key] = val; out.textContent = fmtVal(val); onChange(copy(state));
      });
      var mini = document.createElement('span'); mini.className = 'mini'; mini.appendChild(btn);
      row.appendChild(lab); row.appendChild(input); row.appendChild(out); row.appendChild(mini);
      box.appendChild(row);
    });
    host.appendChild(box);
    return copy(state);

    function copy(s) { var o = {}; Object.keys(s).forEach(function (k) { o[k] = s[k]; }); return o; }
  };

  Viz.plot2 = function (el, spec) {
    var inst = new global.Viz2D.Plot(el, spec);
    var host = (el.closest && el.closest('.fig')) || el.parentNode;
    var params = {};
    if (spec.params) params = Viz.controls(host, spec.params, function (p) { inst.draw(p); });
    inst.draw(params);
    items.push({ el: el, inst: inst, redraw: function () { inst.draw(params); } });
    return inst;
  };

  Viz.plot3 = function (el, spec) {
    var host = (el.closest && el.closest('.fig')) || el.parentNode;
    if (!el.dataset.hint) {
      var hint = document.createElement('div');
      hint.className = 'hint'; hint.textContent = HINT3;
      host.appendChild(hint);
      el.dataset.hint = '1';
    }
    var inst = new global.Viz3D.Plot3(el, spec);
    var params = spec.params ? Viz.controls(host, spec.params, function (p) { inst.setParams(p); }) : {};
    items.push({ el: el, inst: inst, redraw: function () { inst.setParams(params); } });
    inst.setParams(params);
    return inst;
  };

  // 线代专用：平面格点在 A 作用下的形变（行列式=面积缩放、特征方向不变）
  Viz.transform = function (el, spec) {
    var A = spec.A;
    function mul(M, v) { return [M[0][0] * v[0] + M[0][1] * v[1], M[1][0] * v[0] + M[1][1] * v[1]]; }
    var ex = spec.extent == null ? 4 : spec.extent;
    var pts = [], segs = [];
    for (var i = -ex; i <= ex; i++) for (var j = -ex; j <= ex; j++) pts.push([i, j]);
    function drawBase(sc, p) {
      var ctx = sc.ctx, t = p && p.t != null ? p.t : 1;
      var M = [[1 + (A[0][0] - 1) * t, A[0][1] * t], [A[1][0] * t, 1 + (A[1][1] - 1) * t]];
      ctx.save();
      ctx.strokeStyle = sc.color(spec.gridColor == null ? 5 : spec.gridColor); ctx.globalAlpha = .5; ctx.lineWidth = 1.1;
      for (var i = -ex; i <= ex; i++) for (var j = -ex; j <= ex; j++) {
        var v = mul(M, [i, j]);
        ctx.beginPath(); ctx.arc(sc.X(v[0]), sc.Y(v[1]), 1.7, 0, 7); ctx.stroke();
      }
      // 单位正方形→平行四边形（行列式的几何意义）
      var o = [0, 0], e1 = mul(M, [1, 0]), e2 = mul(M, [0, 1]), e12 = mul(M, [1, 1]);
      ctx.globalAlpha = 1; ctx.lineWidth = 2; ctx.strokeStyle = sc.color(spec.cellColor == null ? 0 : spec.cellColor);
      ctx.beginPath();
      ctx.moveTo(sc.X(o[0]), sc.Y(o[1])); ctx.lineTo(sc.X(e1[0]), sc.Y(e1[1]));
      ctx.lineTo(sc.X(e12[0]), sc.Y(e12[1])); ctx.lineTo(sc.X(e2[0]), sc.Y(e2[1])); ctx.closePath();
      ctx.globalAlpha = .18; ctx.fillStyle = sc.color(spec.cellColor == null ? 0 : spec.cellColor); ctx.fill();
      ctx.globalAlpha = 1; ctx.stroke();
      if (spec.eigen) {
        ctx.strokeStyle = sc.color(1); ctx.lineWidth = 2.2;
        spec.eigen.forEach(function (ev) {
          var d = ev.dir, L = ex * 1.4;
          [-1, 1].forEach(function (sgn) {
            var a1 = [-d[0] * L * sgn, -d[1] * L * sgn], a2 = [d[0] * L * sgn, d[1] * L * sgn];
            var b1 = mul(M, a1), b2 = mul(M, a2);
            ctx.beginPath(); ctx.moveTo(sc.X(b1[0]), sc.Y(b1[1])); ctx.lineTo(sc.X(b2[0]), sc.Y(b2[1])); ctx.stroke();
          });
        });
      }
      if (spec.vectors) {
        spec.vectors.forEach(function (v) {
          var x = mul(M, v.at), col = sc.color(v.color == null ? 4 : v.color);
          ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.6;
          ctx.beginPath(); ctx.moveTo(sc.X(0), sc.Y(0)); ctx.lineTo(sc.X(x[0]), sc.Y(x[1])); ctx.stroke();
          var ang = Math.atan2(sc.Y(x[1]) - sc.Y(0), sc.X(x[0]) - sc.X(0));
          ctx.beginPath(); ctx.moveTo(sc.X(x[0]), sc.Y(x[1]));
          ctx.lineTo(sc.X(x[0]) - 9 * Math.cos(ang - .4), sc.Y(x[1]) - 9 * Math.sin(ang - .4));
          ctx.lineTo(sc.X(x[0]) - 9 * Math.cos(ang + .4), sc.Y(x[1]) - 9 * Math.sin(ang + .4));
          ctx.closePath(); ctx.fill();
          if (v.label) sc.text(v.label, sc.X(x[0]) + 8, sc.Y(x[1]) - 8, { color: col, align: 'left', bold: true, chip: true });
        });
      }
      var det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
      sc.text('t=' + (Math.round(((p && p.t) || 1) * 100) / 100) + '　det A=' + (Math.round(det * 100) / 100),
        sc.m.l + 8, sc.h - sc.m.b - 12, { align: 'left', size: 12.5, color: sc.ink, chip: true });
      ctx.restore();
    }
    var base = { domain: spec.domain || [-ex - 1, ex + 1], aspect: 'equal', grid: true, h: spec.h || 360 };
    var spec2 = { domain: base.domain, aspect: 'equal', grid: base.grid, h: base.h, xLabel: 'x', yLabel: 'y',
      extra: [drawBase], params: spec.params || { t: { min: 0, max: 1, step: 0.02, value: 1, label: '形变进度 t' } } };
    return Viz.plot2(el, spec2);
  };

  var rid = null;
  function redrawAll() {
    items.forEach(function (it) {
      try { it.redraw(); } catch (e) { console.error('[redraw]', e); }
    });
  }
  global.addEventListener('resize', function () {
    clearTimeout(rid);
    rid = setTimeout(redrawAll, 180);
  });
  Viz.onThemeChange = redrawAll;
  Viz.PAL = global.Viz2D ? global.Viz2D.PAL : ['#3b5bdb', '#e8590c', '#2f9e44', '#7048e8', '#c2255c', '#0b7285'];
  Viz.items = items;
})(window);
