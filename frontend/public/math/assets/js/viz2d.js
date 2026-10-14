/* viz2d.js — 二维绘图引擎：刻度网格、曲线、区域、点线标注、斜率场、直方图 */
(function (global) {
  'use strict';
  var PAL = ['#3b5bdb', '#e8590c', '#2f9e44', '#7048e8', '#c2255c', '#0b7285', '#d9480f', '#5f3dc4'];

  function cssVar(name, fb) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return (v && v.trim()) || fb;
  }
  function num(x) {
    if (!isFinite(x)) return String(x);
    var a = Math.abs(x), s = a >= 1e4 || (a > 0 && a < 1e-3) ? x.toExponential(1) : String(Math.round(x * 1000) / 1000);
    return s === '-0' ? '0' : s;
  }
  function niceStep(span, target) {
    var raw = span / Math.max(2, target), p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), r = raw / p;
    return (r >= 7 ? 10 : r >= 3 ? 5 : r >= 1.5 ? 2 : 1) * p;
  }
  function piLabel(k, unit) {
    if (k === 0) return '0';
    var q = 1, h = unit / Math.PI; // 0.5 => π/2, 0.25 => π/4
    if (Math.abs(h - 0.5) < 1e-9) { q = 2; } else if (Math.abs(h - 0.25) < 1e-9) { q = 4; } else if (Math.abs(h - 1 / 3) < 1e-9) { q = 3; }
    var n = Math.round(k * unit / Math.PI * q);
    var g = Math.abs(n) === 0 ? q : (function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); return b ? gcd(b, a % b) : a; })(Math.abs(n), q);
    var nn = n / g, dd = q / g;
    return (nn < 0 ? '-' : '') + (Math.abs(nn) === 1 ? '' : Math.abs(nn)) + 'π' + (dd === 1 ? '' : '/' + dd);
  }

  function Plot(el, spec) {
    var cv = document.createElement('canvas');
    el.appendChild(cv);
    this.el = el; this.cv = cv; this.ctx = cv.getContext('2d');
    this.spec = spec || {};
    this.p = {};
  }
  Plot.prototype.draw = function (p) {
    var s = this.spec, dpr = Math.min(global.devicePixelRatio || 1, 2);
    p = p || this.p || {};
    var w = Math.max(260, this.el.clientWidth || 600), h = s.h || Math.round(Math.min(420, Math.max(240, w * 0.56)));
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.cv.style.height = h + 'px';
    var ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    this.w = w; this.h = h; this.p = p || {};
    this.ink = cssVar('--ink', '#1b2130'); this.ink3 = cssVar('--ink-3', '#7d8698');
    this.line = cssVar('--line', '#dfe3ec'); this.bg = cssVar('--surface-2', '#fbfbfe');
    this.rects = [];
    this.frame(w, h);
    this.grid();
    this.paint(p);
    this.legend();
  };

  Plot.prototype.frame = function (w, h) {
    var s = this.spec;
    var m = { l: 52, r: 16, t: 16, b: 38 };
    var d = (s.domain || [-1, 1]).slice(), r = s.range ? s.range.slice() : this.autoRange(d);
    var equal = s.aspect === 'equal';
    if (equal) {
      var sx = (w - m.l - m.r) / (d[1] - d[0]), sy = (h - m.t - m.b) / (r[1] - r[0]);
      var k = Math.min(sx, sy);
      var cx = (d[0] + d[1]) / 2, cy = (r[0] + r[1]) / 2;
      d = [cx - (w - m.l - m.r) / k / 2, cx + (w - m.l - m.r) / k / 2];
      r = [cy - (h - m.t - m.b) / k / 2, cy + (h - m.t - m.b) / k / 2];
    }
    this.d = d; this.r = r; this.m = m; this.x0 = m.l; this.y1 = h - m.b;
    this.sx = equal ? k : (w - m.l - m.r) / (d[1] - d[0]);
    this.sy = equal ? k : (h - m.t - m.b) / (r[1] - r[0]);
  };
  Plot.prototype.autoRange = function (d) {
    var s = this.spec, lo = Infinity, hi = -Infinity;
    var list = (s.curves || []).concat(s.bars ? [{ f: null, bar: true }] : []);
    list.forEach(function (c) {
      if (c.bar) { (s.bars.bins || []).forEach(function (b) { lo = Math.min(lo, 0); hi = Math.max(hi, b[2]); }); return; }
      if (typeof c.f !== 'function' || c.noFit) return;
      var cd = c.domain || d;
      for (var i = 0; i <= 200; i++) {
        var x = cd[0] + (cd[1] - cd[0]) * i / 200, y = c.f(x, this.p);
        if (typeof y !== 'number' || !isFinite(y) || Math.abs(y) > 1e4) continue;
        lo = Math.min(lo, y); hi = Math.max(hi, y);
      }
    }, this);
    if (s.points) s.points.forEach(function (q) { var y = Array.isArray(q.p) ? q.p[1] : q.y; if (isFinite(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); } });
    if (!isFinite(lo) || !isFinite(hi)) { lo = -1; hi = 1; }
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    if (s.zeroIn !== false && lo > 0) lo = 0;
    if (s.zeroIn === false && lo > -Infinity) lo = Math.min(lo, lo);
    var pad = (hi - lo) * 0.12;
    return [lo - pad, hi + pad];
  };
  Plot.prototype.X = function (x) { return this.x0 + (x - this.d[0]) * this.sx; };
  Plot.prototype.Y = function (y) { return this.y1 - (y - this.r[0]) * this.sy; };

  Plot.prototype.clip = function (fn) {
    var ctx = this.ctx;
    ctx.save(); ctx.beginPath(); ctx.rect(this.m.l, this.m.t, this.w - this.m.l - this.m.r, this.h - this.m.t - this.m.b); ctx.clip();
    try { fn(); } finally { ctx.restore(); }
  };

  Plot.prototype.grid = function () {
    var ctx = this.ctx, s = this.spec, self = this;
    if (s.grid === false) return;
    var tx = s.xTicks || niceStep(this.d[1] - this.d[0], Math.max(4, Math.round(this.w / 90)));
    var ty = s.yTicks || niceStep(this.r[1] - this.r[0], Math.max(3, Math.round(this.h / 60)));
    var pi = s.piTicks ? tx : null;
    ctx.lineWidth = 1; ctx.strokeStyle = this.line; ctx.globalAlpha = .8;
    for (var x = Math.ceil(this.d[0] / tx) * tx; x <= this.d[1] + 1e-9; x += tx) {
      var px = Math.round(this.X(x)) + .5;
      ctx.beginPath(); ctx.moveTo(px, this.m.t); ctx.lineTo(px, this.y1); ctx.stroke();
    }
    for (var y = Math.ceil(this.r[0] / ty) * ty; y <= this.r[1] + 1e-9; y += ty) {
      var py = Math.round(this.Y(y)) + .5;
      ctx.beginPath(); ctx.moveTo(this.m.l, py); ctx.lineTo(this.w - this.m.r, py); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 坐标轴
    var ax = Math.min(Math.max(this.Y(0), this.m.t), this.y1), ay = Math.min(Math.max(this.X(0), this.m.l), this.w - this.m.r);
    ctx.strokeStyle = this.ink; ctx.globalAlpha = .75; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(this.m.l, ax); ctx.lineTo(this.w - this.m.r, ax); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ay, this.m.t); ctx.lineTo(ay, this.y1); ctx.stroke();
    ctx.globalAlpha = 1;
    // 刻度数字（带碰撞检测，避免重叠）
    ctx.font = '12px ' + cssVar('--sans', 'sans-serif'); ctx.fillStyle = this.ink3;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (var xi = Math.ceil(this.d[0] / tx) * tx; xi <= this.d[1] + 1e-9; xi += tx) {
      var lbl = pi ? piLabel(Math.round(xi / tx), tx) : num(xi);
      if (Math.abs(xi) < tx * 1e-6 && !pi) continue;
      var px = this.X(xi);
      if (px < this.m.l + 12 || px > this.w - this.m.r - 12) continue;
      if (!this.free(lbl, px, this.y1 + 5, 12)) continue;
      ctx.fillText(lbl, px, this.y1 + 6);
    }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var yi = Math.ceil(this.r[0] / ty) * ty; yi <= this.r[1] + 1e-9; yi += ty) {
      if (Math.abs(yi) < ty * 1e-6) continue;
      var py = this.Y(yi);
      if (py < this.m.t + 8 || py > this.y1 - 4) continue;
      if (!this.free(num(yi), this.m.l - 6, py, 12, 'right')) continue;
      ctx.fillText(num(yi), this.m.l - 6, py);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    if (Math.abs(this.Y(0) - this.y1) < 60 && this.d[0] <= 0 && this.d[1] >= 0) ctx.fillText('0', this.X(0) - 8, this.y1 + 5);
    // 轴名称
    ctx.fillStyle = this.ink; ctx.font = 'italic 13px ' + cssVar('--serif', 'serif');
    if (s.xLabel) { ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(s.xLabel, this.w - this.m.r - 2, this.y1 - 4); }
    if (s.yLabel) { ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(s.yLabel, this.m.l + 4, this.m.t); }
  };

  // 文字占位登记：新标签放不下就跳过，杜绝数字压字
  Plot.prototype.free = function (text, x, y, size, align) {
    var ctx = this.ctx; ctx.font = (size || 12) + 'px ' + cssVar('--sans', 'sans-serif');
    var wid = ctx.measureText(String(text)).width, hgt = (size || 12) + 3;
    var x0 = align === 'right' ? x - wid : align === 'left' ? x : x - wid / 2;
    var box = { x0: x0 - 2, x1: x0 + wid + 2, y0: y - hgt / 2 - 1, y1: y + hgt / 2 + 1 };
    for (var i = 0; i < this.rects.length; i++) {
      var o = this.rects[i];
      if (box.x0 < o.x1 && box.x1 > o.x0 && box.y0 < o.y1 && box.y1 > o.y0) return false;
    }
    this.rects.push(box); return true;
  };
  Plot.prototype.text = function (text, x, y, opt) {
    opt = opt || {}; var size = opt.size || 12.5;
    var tryOffsets = opt.dy == null ? [0, -14, 12, -26, 24] : [opt.dy];
    var ctx = this.ctx; ctx.font = (opt.bold ? '600 ' : '') + size + 'px ' + (opt.serif ? cssVar('--serif', 'serif') : cssVar('--sans', 'sans-serif'));
    var ok = false, yy = y;
    for (var i = 0; i < tryOffsets.length && !ok; i++) {
      yy = y + tryOffsets[i];
      ok = this.free(text, x, yy, size, opt.align);
    }
    if (!ok) return false;
    if (opt.chip) {
      var wid = ctx.measureText(String(text)).width;
      var x0 = opt.align === 'right' ? x - wid : opt.align === 'left' ? x : x - wid / 2;
      ctx.save(); ctx.fillStyle = this.bg; ctx.globalAlpha = .85;
      ctx.fillRect(x0 - 3, yy - size * .72, wid + 6, size * 1.5); ctx.restore();
    }
    ctx.fillStyle = opt.color || this.ink;
    ctx.textAlign = opt.align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(text), x, yy);
    return true;
  };

  Plot.prototype.paint = function (p) {
    var s = this.spec, self = this;
    if (s.field) this.clip(function () { self.drawField(s.field, p); });
    if (s.region) this.clip(function () { self.drawRegion(s.region, p); });
    if (s.bars) this.clip(function () { self.drawBars(s.bars, p); });
    if (s.base) this.clip(function () { self.drawBase(s.base, p); });
    (s.curves || []).forEach(function (c, i) { self.clip(function () { self.drawCurve(c, p, i); }); });
    (s.extra || []).forEach(function (fn) { if (typeof fn === 'function') self.clip(function () { fn(self, p); }); });
    if (s.vlines) s.vlines.forEach(function (v) { self.clip(function () { self.drawGuide('v', v, p); }); });
    if (s.hlines) s.hlines.forEach(function (v) { self.clip(function () { self.drawGuide('h', v, p); }); });
    if (s.segs) s.segs.forEach(function (g) { self.clip(function () { self.drawSeg(g, p); }); });
    if (s.points) s.points.forEach(function (q) { self.clip(function () { self.drawPoint(q, p); }); });
    if (s.holes) s.holes.forEach(function (q) { self.clip(function () { self.drawHole(q, p); }); });
    if (s.labels) s.labels.forEach(function (l) {
      var at = l.at; self.text(l.text, self.X(at[0]) + (l.dx || 0), self.Y(at[1]) + (l.dy || 0), l);
    });
  };

  Plot.prototype.color = function (c) {
    if (c == null) return PAL[0];
    if (typeof c === 'number') return PAL[c % PAL.length];
    return c;
  };

  Plot.prototype.drawCurve = function (c, p, i) {
    var ctx = this.ctx;
    if (typeof c.f !== 'function') return;
    var d = c.domain || this.d, n = c.n || Math.max(240, Math.round((d[1] - d[0]) / (this.d[1] - this.d[0]) * 600));
    var col = this.color(c.color != null ? c.color : i);
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = c.width || 2.2;
    ctx.lineJoin = 'round'; ctx.setLineDash(c.dash || []);
    ctx.globalAlpha = c.alpha == null ? 1 : c.alpha;
    ctx.beginPath();
    var pen = false, prev = null, maxJump = (this.r[1] - this.r[0]) * 2.5;
    for (var j = 0; j <= n; j++) {
      var xx = d[0] + (d[1] - d[0]) * j / n, yv = c.f(xx, p);
      if (typeof yv !== 'number' || !isFinite(yv) || Math.abs(yv) > 1e7) { pen = false; prev = null; continue; }
      if (pen && prev != null && Math.abs(yv - prev) > maxJump) pen = false;
      if (!pen) { ctx.moveTo(this.X(xx), this.Y(yv)); pen = true; } else ctx.lineTo(this.X(xx), this.Y(yv));
      prev = yv;
    }
    ctx.stroke();
    ctx.restore();
    c._color = col;
  };

  Plot.prototype.drawRegion = function (rg, p) {
    var ctx = this.ctx, a = typeof rg.a === 'function' ? rg.a(p.x) : rg.a, b = typeof rg.b === 'function' ? rg.b(p.x) : rg.b;
    var up = rg.upper, lo = rg.lower || 0, n = 300;
    ctx.save(); ctx.fillStyle = this.color(rg.color || 0); ctx.globalAlpha = rg.alpha == null ? .2 : rg.alpha;
    ctx.beginPath();
    for (var i = 0; i <= n; i++) {
      var x = a + (b - a) * i / n, y = typeof up === 'function' ? up(x, p) : up;
      i ? ctx.lineTo(this.X(x), this.Y(y)) : ctx.moveTo(this.X(x), this.Y(y));
    }
    for (var j = n; j >= 0; j--) {
      var x2 = a + (b - a) * j / n, y2 = typeof lo === 'function' ? lo(x2, p) : lo;
      ctx.lineTo(this.X(x2), this.Y(y2));
    }
    ctx.closePath(); ctx.fill();
    if (rg.hatch) {
      ctx.strokeStyle = this.color(rg.color || 0); ctx.globalAlpha = .5; ctx.lineWidth = 1;
      for (var k = a; k < b; k += (b - a) / 26) {
        ctx.beginPath(); ctx.moveTo(this.X(k), this.Y(typeof lo === 'function' ? lo(k, p) : lo));
        ctx.lineTo(this.X(k + (b - a) / 40), this.Y(typeof up === 'function' ? up(k + (b - a) / 40, p) : up)); ctx.stroke();
      }
    }
    ctx.restore();
  };

  Plot.prototype.drawBars = function (bs, p) {
    var ctx = this.ctx, self = this;
    (bs.bins || []).forEach(function (b) {
      var x0 = b[0], x1 = b[1], hgt = b[2];
      var fill = typeof bs.color === 'function' ? bs.color(x0, b) : self.color(bs.color == null ? 0 : bs.color);
      ctx.save();
      ctx.fillStyle = fill; ctx.globalAlpha = bs.alpha == null ? .55 : bs.alpha;
      ctx.fillRect(self.X(x0), self.Y(hgt), self.X(x1) - self.X(x0), self.Y(0) - self.Y(hgt));
      ctx.globalAlpha = 1; ctx.strokeStyle = self.color(bs.line == null ? 0 : bs.line); ctx.lineWidth = 1;
      ctx.strokeRect(self.X(x0), self.Y(hgt), self.X(x1) - self.X(x0), self.Y(0) - self.Y(hgt));
      ctx.restore();
    });
  };

  Plot.prototype.drawGuide = function (dir, g, p) {
    var ctx = this.ctx, at = typeof g.at === 'function' ? g.at(p) : g.at;
    ctx.save(); ctx.strokeStyle = this.color(g.color == null ? 1 : g.color); ctx.lineWidth = g.width || 1.6;
    ctx.setLineDash(g.dash || [6, 4]); ctx.globalAlpha = g.alpha == null ? .9 : g.alpha;
    ctx.beginPath();
    if (dir === 'v') { ctx.moveTo(this.X(at), this.m.t); ctx.lineTo(this.X(at), this.y1); }
    else { ctx.moveTo(this.m.l, this.Y(at)); ctx.lineTo(this.w - this.m.r, this.Y(at)); }
    ctx.stroke(); ctx.setLineDash([]);
    if (g.label) {
      ctx.globalAlpha = 1;
      if (dir === 'v') this.text(g.label, this.X(at) + (g.dx || 0), this.m.t + 10, { color: this.color(g.color == null ? 1 : g.color), align: 'left', size: 12.5 });
      else this.text(g.label, this.w - this.m.r - 6, this.Y(at) - 9, { color: this.color(g.color == null ? 1 : g.color), align: 'right', size: 12.5 });
    }
    ctx.restore();
  };

  Plot.prototype.drawSeg = function (g, p) {
    var ctx = this.ctx, A = g.a, B = typeof g.b === 'function' ? g.b(p) : g.b;
    var col = this.color(g.color == null ? 2 : g.color);
    var x1 = this.X(A[0]), y1 = this.Y(A[1]), x2 = this.X(B[0]), y2 = this.Y(B[1]);
    ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = g.width || 2;
    ctx.setLineDash(g.dash || []);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
    if (g.arrow !== false) {
      var ang = Math.atan2(y2 - y1, x2 - x1), L = g.head || 8;
      ctx.beginPath(); ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - L * Math.cos(ang - .38), y2 - L * Math.sin(ang - .38));
      ctx.lineTo(x2 - L * Math.cos(ang + .38), y2 - L * Math.sin(ang + .38));
      ctx.closePath(); ctx.fill();
    } else { ctx.beginPath(); ctx.arc(x2, y2, 3, 0, 7); ctx.fill(); }
    ctx.restore();
    if (g.label) this.text(g.label, (x1 + x2) / 2, (y1 + y2) / 2, { color: col, size: 12.5, bold: true, chip: true });
  };

  Plot.prototype.drawPoint = function (q, p) {
    var ctx = this.ctx, at = typeof q.p === 'function' ? q.p(p) : q.p;
    var col = this.color(q.color == null ? 4 : q.color);
    var x = this.X(at[0]), y = this.Y(at[1]);
    ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = cssVar('--surface', '#fff'); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, q.size || 4.5, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore();
    if (q.label) this.text(q.label, x + (q.dx || 8), y + (q.dy || -10), { color: col, align: 'left', size: 12.5, bold: true, chip: true });
    if (q.coord) this.text('(' + num(at[0]) + ', ' + num(at[1]) + ')', x, y + 16, { color: this.ink3, size: 11.5, chip: true });
  };

  Plot.prototype.drawHole = function (q, p) {
    var ctx = this.ctx, at = typeof q.p === 'function' ? q.p(p) : q.at;
    var x = this.X(at[0]), y = this.Y(at[1]);
    ctx.save();
    ctx.fillStyle = this.bg; ctx.strokeStyle = this.color(q.color == null ? 4 : q.color); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, q.size || 4.5, 0, 7); ctx.fill(); ctx.stroke();
    ctx.restore();
    if (q.label) this.text(q.label, x + (q.dx || 9), y + (q.dy || -11), { color: this.color(q.color == null ? 4 : q.color), align: 'left', size: 12.5, bold: true, chip: true });
  };

  Plot.prototype.drawField = function (fd, p) {
    var ctx = this.ctx, d = this.d, r = this.r, n = fd.n || 12, col = this.color(fd.color == null ? 5 : fd.color);
    var rows = fd.rows || Math.max(6, Math.round(n * (r[1] - r[0]) / (d[1] - d[0])));
    var dx = (d[1] - d[0]) / n, dy = (r[1] - r[0]) / rows, L = (fd.len || .8) * dx;
    ctx.save(); ctx.strokeStyle = col; ctx.globalAlpha = fd.alpha == null ? .65 : fd.alpha; ctx.lineWidth = fd.width || 1.5;
    for (var i = 0; i <= n; i++) for (var j = 0; j <= rows; j++) {
      var x = d[0] + i * dx, y = r[0] + j * dy, k = fd.f(x, y, p);
      if (!isFinite(k)) continue;
      var vx = 1 / Math.sqrt(1 + k * k), vy = k * vx;
      if (fd.dir === 'down') { vx = -vx; vy = -vy; }
      var px = this.X(x), py = this.Y(y), hx = this.X(x + L * vx) - px, hy = this.Y(y + L * vy) - py;
      ctx.beginPath(); ctx.moveTo(px - hx / 2, py - hy / 2); ctx.lineTo(px + hx / 2, py + hy / 2); ctx.stroke();
      if (fd.arrow) {
        var a = Math.atan2(hy, hx);
        ctx.beginPath(); ctx.moveTo(px + hx / 2, py + hy / 2);
        ctx.lineTo(px + hx / 2 - 5 * Math.cos(a - .4), py + hy / 2 - 5 * Math.sin(a - .4));
        ctx.lineTo(px + hx / 2 - 5 * Math.cos(a + .4), py + hy / 2 - 5 * Math.sin(a + .4));
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  };

  Plot.prototype.legend = function () {
    var s = this.spec, items = (s.curves || []).filter(function (c) { return c.label && typeof c.f === 'function' && c.legend !== false; });
    if (!items.length) return;
    var ctx = this.ctx, font = '12px ' + cssVar('--sans', 'sans-serif');
    ctx.font = font;
    var x1 = this.w - this.m.r - 8, y0 = this.m.t + 8, lh = 18;
    var maxw = 0;
    items.forEach(function (c) { maxw = Math.max(maxw, ctx.measureText(c.label).width); });
    var boxw = maxw + 40, boxh = items.length * lh + 6;
    var bx = x1 - boxw, by = y0;
    this.rects.push({ x0: bx - 2, x1: x1 + 2, y0: by - 2, y1: by + boxh + 2 });
    ctx.save(); ctx.fillStyle = this.bg; ctx.globalAlpha = .9; ctx.fillRect(bx - 4, by - 3, boxw + 8, boxh + 4);
    ctx.globalAlpha = 1; ctx.strokeStyle = this.line; ctx.lineWidth = 1; ctx.strokeRect(bx - 4, by - 3, boxw + 8, boxh + 4);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    items.forEach(function (c, i) {
      var yc = by + i * lh + 7;
      ctx.strokeStyle = c._color; ctx.lineWidth = 2.4; ctx.setLineDash(c.dash || []);
      ctx.beginPath(); ctx.moveTo(bx + 2, yc); ctx.lineTo(bx + 26, yc); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = this.ink; ctx.fillText(c.label, bx + 32, yc);
    }, this);
    ctx.restore();
  };

  Plot.prototype.destroy = function () { if (this.cv.parentNode) this.cv.parentNode.removeChild(this.cv); };

  global.Viz2D = { Plot: Plot, PAL: PAL, num: num, cssVar: cssVar };
})(window);
