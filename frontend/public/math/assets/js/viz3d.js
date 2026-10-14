/* viz3d.js — 三维引擎（three.js）：曲面/曲线/向量/平面/微元盒 + 自研轨道控制 + WebGL 上下文池 */
(function (global) {
  'use strict';
  var THREE = global.THREE;
  var MAX_GL = 6;
  var active = [], loop = null;

  var GL = {
    list: function () { return active; },
    register: function (inst) {
      active.push(inst);
      GL.trim();
      if (!loop) { loop = requestAnimationFrame(tick); }
    },
    unregister: function (inst) {
      var i = active.indexOf(inst);
      if (i >= 0) active.splice(i, 1);
    },
    touch: function (inst) {
      var i = active.indexOf(inst);
      if (i >= 0) { active.splice(i, 1); active.push(inst); }
    },
    trim: function () {
      // 只回收"已经滚出视野"的实例；全都在视野里时宁可多开一两个上下文，
      // 也不能把用户正看着的图变成空白。
      for (var guard = 0; guard < active.length && active.length > MAX_GL; guard++) {
        var victim = null;
        for (var i = 0; i < active.length; i++) {
          if (active[i].el && !active[i].visible) { victim = active[i]; break; }
        }
        if (!victim) break;
        victim.drop();
        GL.unregister(victim);
      }
    }
  };
  function tick() {
    var any = false;
    for (var i = 0; i < active.length; i++) {
      var inst = active[i];
      if (inst.ready && inst.visible && (inst.dirty || inst.spec.autoRotate || inst.anim)) {
        if (inst.spec.autoRotate) inst.yaw += 0.0035;
        inst.render(); inst.dirty = false; any = true;
      }
    }
    loop = requestAnimationFrame(tick);
  }

  function txt(text, color, px) {
    var pad = 6, fs = px || 46;
    var c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = '600 ' + fs + 'px "Segoe UI", "Microsoft YaHei UI", sans-serif';
    var w = Math.ceil(g.measureText(text).width) + pad * 2;
    c.width = w; c.height = fs + pad * 2;
    g = c.getContext('2d');
    g.font = '600 ' + fs + 'px "Segoe UI", "Microsoft YaHei UI", sans-serif';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,255,255,.72)'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = color || '#1b2130'; g.fillText(text, pad, c.height / 2);
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    var mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    var sp = new THREE.Sprite(mat);
    sp.userData.as = c.width / c.height;
    return sp;
  }

  function ramp(t) {
    t = Math.max(0, Math.min(1, t));
    var stops = [[60, 96, 200], [46, 160, 173], [92, 180, 90], [215, 160, 60], [210, 92, 60]];
    var x = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
    var a = stops[i], b = stops[i + 1];
    return [(a[0] + (b[0] - a[0]) * f) / 255, (a[1] + (b[1] - a[1]) * f) / 255, (a[2] + (b[2] - a[2]) * f) / 255];
  }

  function Plot3(el, spec) {
    if (!THREE) throw new Error('three.min.js 未加载');
    this.el = el; this.spec = spec;
    this.yaw = spec.yaw == null ? 0.7 : spec.yaw;
    this.pitch = spec.pitch == null ? 0.42 : spec.pitch;
    this.dist = spec.dist || 1;
    this.target = new THREE.Vector3();
    this.p = {};
    el.style.position = el.style.position || 'relative';
    el.dataset.mounted = '0';
    this.build();
    GL.register(this);
    this.bindIO();
    this.bindInput();
  }

  Plot3.prototype.build = function () {
    var s = this.spec;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.01, 500);
    this.ready = false; this.visible = false; this.dirty = true;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.light = new THREE.DirectionalLight(0xffffff, 1.05); this.light.position.set(4, 8, 5);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.75);
    this.scene.add(this.light, this.hemi);
    this.dom = document.createElement('canvas');
    this.dom.style.cssText = 'display:block;width:100%;height:' + (s.h || 380) + 'px;border-radius:10px';
    this.el.appendChild(this.dom);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.dom, antialias: true, alpha: true });
    this.ready = true;
  };
  Plot3.prototype.drop = function () {
    if (!this.ready) return;
    this.dom.parentNode && this.dom.parentNode.removeChild(this.dom);
    try { this.renderer.dispose(); } catch (e) {}
    if (this.renderer.forceContextLoss) { try { this.renderer.forceContextLoss(); } catch (e) {} }
    this.ready = false;
  };
  Plot3.prototype.ensure = function () {
    if (this.ready) return;
    this.build();
    GL.register(this);
    this.setParams(this.p0 || {});
  };
  Plot3.prototype.bindIO = function () {
    var self = this;
    if (!global.IntersectionObserver) { this.visible = true; return; }
    this.io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        self.visible = e.isIntersecting;
        if (e.isIntersecting) { self.ensure(); self.dirty = true; GL.touch(self); }
      });
    }, { rootMargin: '240px 0px' });
    this.io.observe(this.el);
  };
  Plot3.prototype.bindInput = function () {
    var self = this, cv = this.dom, st = null;
    cv.addEventListener('pointerdown', function (e) {
      cv.setPointerCapture(e.pointerId);
      st = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey, d: Math.hypot(e.clientX - self.cx || 0, e.clientY - self.cy || 0) };
      self.cx = e.clientX; self.cy = e.clientY;
      self.dirty = true;
    });
    cv.addEventListener('pointermove', function (e) {
      if (!st) return;
      var dx = e.clientX - st.x, dy = e.clientY - st.y;
      st.x = e.clientX; st.y = e.clientY;
      if (st.pan) self.pan(dx, dy);
      else { self.yaw -= dx * 0.007; self.pitch = Math.max(-1.45, Math.min(1.45, self.pitch + dy * 0.006)); }
      self.dirty = true;
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      cv.addEventListener(ev, function () { st = null; });
    });
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      self.dist = Math.max(0.35, Math.min(4.5, self.dist * (1 + (e.deltaY > 0 ? 0.09 : -0.09))));
      self.dirty = true;
    }, { passive: false });
    cv.addEventListener('dblclick', function () {
      self.yaw = self.spec.yaw == null ? 0.7 : self.spec.yaw;
      self.pitch = self.spec.pitch == null ? 0.42 : self.spec.pitch;
      self.dist = 1; self.target.set(0, 0, 0); self.dirty = true;
    });
  };
  Plot3.prototype.pan = function (dx, dy) {
    var sc = this.scale || 1, k = sc * 0.0016 * this.dist;
    var right = new THREE.Vector3(Math.cos(this.yaw), 0, Math.sin(this.yaw));
    var up = new THREE.Vector3(0, 1, 0);
    this.target.add(right.multiplyScalar(-dx * k)).add(up.multiplyScalar(dy * k));
  };

  /* ---- 数学术语 → three 坐标：数学 (x,y,z) 映射为 three (x, z, -y)，z 轴朝上 ---- */
  function P(x, y, z) { return new THREE.Vector3(x, z, -y); }

  Plot3.prototype.clear = function () {
    var g = this.group;
    while (g.children.length) {
      var o = g.children.pop();
      o.traverse && o.traverse(function (c) {
        if (c.geometry) c.geometry.dispose();
        if (c.material) { (Array.isArray(c.material) ? c.material : [c.material]).forEach(function (m) { m.map && m.map.dispose(); m.dispose(); }); }
      });
    }
  };

  Plot3.prototype.draw = function (p) {
    this.p = p || {};
    p = this.p;
    this.clear();
    var s = this.spec, sc = this;
    var dom = s.domain || [-1, 1], dom2 = s.domainY || dom;
    this.scale = Math.max(dom[1] - dom[0], dom2[1] - dom2[0], 2) / 2;
    this.zRange = s.zDomain || this.probeZ(dom, dom2, p);
    // 底面网格
    var gN = Math.ceil(Math.max(dom[1] - dom[0], dom2[1] - dom2[0]) * 2);
    var grid = new THREE.GridHelper(Math.max(dom[1] - dom[0], dom2[1] - dom2[0]), Math.max(4, gN), 0x99a4b8, 0xc9d1e0);
    grid.position.set((dom[0] + dom[1]) / 2, 0, -(dom2[0] + dom2[1]) / 2);
    grid.material.opacity = s.grid === false ? 0 : .5; grid.material.transparent = true;
    this.group.add(grid);
    // 坐标轴 + 刻度
    this.axes(dom, dom2, s);
    (s.surfaces || (s.fn ? [s] : [])).forEach(function (sf, i) { sc.surface(sf, i, p); });
    (s.curves || []).forEach(function (c) { sc.curve(c, p); });
    (s.planes || []).forEach(function (pl) { sc.plane(pl); });
    (s.boxes || []).forEach(function (bx) { sc.box(bx); });
    (s.vectors || []).forEach(function (v) { sc.vector(v); });
    (s.points || []).forEach(function (q) { sc.point(q, p); });
    (s.extras || []).forEach(function (fn) { if (typeof fn === 'function') fn(sc, p); });
    this.dirty = true;
  };

  // 预采样 z 范围：画曲面之前就要定好 z 轴刻度
  Plot3.prototype.probeZ = function (dom, dom2, p) {
    var list = this.spec.surfaces || (this.spec.fn ? [this.spec] : []);
    var lo = Infinity, hi = -Infinity;
    list.forEach(function (sf) {
      var fn = sf.fn || this.spec.fn; if (typeof fn !== 'function') return;
      var a = sf.domain || dom, b = sf.domainY || a;
      for (var i = 0; i <= 16; i++) for (var j = 0; j <= 16; j++) {
        var x = a[0] + (a[1] - a[0]) * i / 16, y = b[0] + (b[1] - b[0]) * j / 16, z = fn(x, y, p);
        if (typeof z === 'number' && isFinite(z)) { lo = Math.min(lo, z); hi = Math.max(hi, z); }
      }
    }, this);
    if (!isFinite(lo) || !isFinite(hi)) return [0, 1];
    if (hi - lo < 1e-9) hi = lo + 1;
    return [lo, hi];
  };

  Plot3.prototype.setParams = function (p) {
    this.p0 = p;
    this.draw(p);
    this.resize();
    this.render();
  };

  Plot3.prototype.axes = function (dom, dom2, s) {
    var ext = Math.max(dom[1] - dom[0], dom2[1] - dom2[0]) * 0.62;
    var zx = s.zDomain || this.zRange || [0, 1];
    var mats = [0x3b5bdb, 0xe8590c, 0x2f9e44];
    var dirs = [[ext, 0, 0], [0, ext, 0], [0, 0, ext]];
    var names = [s.xLabel || 'x', s.yLabel || 'y', s.zLabel || 'z'];
    for (var i = 0; i < 3; i++) {
      var line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), P(dirs[i][0], dirs[i][1], dirs[i][2])]),
        new THREE.LineBasicMaterial({ color: mats[i], transparent: true, opacity: .85 }));
      this.group.add(line);
      var lab = txt(names[i], '#' + mats[i].toString(16), 52);
      lab.position.copy(P(dirs[i][0], dirs[i][1], dirs[i][2]).multiplyScalar(1.06));
      lab.scale.setScalar(this.scale * 0.16);
      this.group.add(lab);
    }
    // 刻度数字（沿三轴各取 5 个）
    var ticks = [[dom, 0], [dom2, 1], [zx, 2]];
    ticks.forEach(function (t, axis) {
      var range = t[0], step = (range[1] - range[0]) / 4;
      for (var k = 0; k <= 4; k++) {
        var v = Math.round((range[0] + step * k) * 100) / 100;
        if (axis !== 2 && Math.abs(v) < 1e-9) continue;
        var pt = [0, 0, 0]; pt[axis] = v;
        var sp = txt(String(v), '#7d8698', 34);
        sp.position.copy(P(pt[0], pt[1], pt[2]).add(new THREE.Vector3(0, -this.scale * .06, 0)));
        sp.scale.setScalar(this.scale * 0.11);
        this.group.add(sp);
      }
    }, this);
  };

  Plot3.prototype.surface = function (sf, idx, p) {
    var s = this.spec, fn = sf.fn || s.fn;
    if (typeof fn !== 'function') return;
    var dom = sf.domain || s.domain || [-1, 1], dom2 = sf.domainY || s.domainY || dom;
    var n = sf.n || s.n || 44, m = sf.m || s.m || 44;
    var clip = sf.zClip || s.zClip || null;
    var pos = [], col = [], idxs = [], zs = [], zmin = Infinity, zmax = -Infinity;
    var grid = [];
    for (var i = 0; i <= n; i++) {
      var x = dom[0] + (dom[1] - dom[0]) * i / n, row = [];
      for (var j = 0; j <= m; j++) {
        var y = dom2[0] + (dom2[1] - dom2[0]) * j / m, z = fn(x, y, p);
        var ok = typeof z === 'number' && isFinite(z);
        if (ok && clip) ok = z >= clip[0] && z <= clip[1];
        var zz = ok ? z : NaN;
        if (ok) { zmin = Math.min(zmin, zz); zmax = Math.max(zmax, zz); }
        row.push(ok ? zz : null);
        var v = P(x, y, ok ? zz : 0);
        pos.push(v.x, v.y, v.z); col.push(0, 0, 0);
      }
      grid.push(row);
    }
    if (!isFinite(zmin)) { zmin = 0; zmax = 1; }
    if (zmax - zmin < 1e-9) { zmax = zmin + 1; }
    for (var a = 0; a <= n; a++) for (var b = 0; b <= m; b++) {
      var z = grid[a][b];
      var c = (sf.colorMap === false || s.colorMap === false) ? [0, 0, 0] : ramp((z == null ? 0 : z - zmin) / (zmax - zmin));
      var o = (a * (m + 1) + b) * 3;
      col[o] = c[0]; col[o + 1] = c[1]; col[o + 2] = c[2];
      if (a < n && b < m && grid[a][b] != null && grid[a + 1][b] != null && grid[a][b + 1] != null && grid[a + 1][b + 1] != null) {
        var v00 = a * (m + 1) + b, v10 = (a + 1) * (m + 1) + b, v01 = a * (m + 1) + b + 1, v11 = (a + 1) * (m + 1) + b + 1;
        idxs.push(v00, v10, v01, v10, v11, v01);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idxs); geo.computeVertexNormals();
    var mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: sf.opacity == null ? .92 : sf.opacity });
    var mesh = new THREE.Mesh(geo, mat);
    this.group.add(mesh);
    if (sf.wire !== false && s.wire !== false) {
      var wmat = new THREE.MeshBasicMaterial({ color: 0x2b3446, wireframe: true, transparent: true, opacity: .18 });
      var w = new THREE.Mesh(geo.clone(), wmat); w.geometry.setIndex(idxs); this.group.add(w);
    }
    if (sf.label) {
      var t = txt(sf.label, '#1b2130', 40);
      t.position.copy(P(dom[0] + (dom[1] - dom[0]) * .82, dom2[0] + (dom2[1] - dom2[0]) * .82, fn(dom[1] * .82, dom2[1] * .82, p)));
      t.scale.setScalar(this.scale * 0.15);
      this.group.add(t);
    }
  };

  Plot3.prototype.curve = function (c, p) {
    var pts = [], N = c.n || 260;
    var t0 = c.range[0], t1 = c.range[1];
    for (var i = 0; i <= N; i++) {
      var t = t0 + (t1 - t0) * i / N, r = c.r(t, p || {});
      if (!r || !isFinite(r[0]) || !isFinite(r[1]) || !isFinite(r[2])) continue;
      var v = P(r[0], r[1], r[2]);
      if (pts.length && pts[pts.length - 1].distanceToSquared(v) < 1e-12) continue;
      pts.push(v);
    }
    if (pts.length < 2) return;
    var geo = new THREE.BufferGeometry().setFromPoints(pts);
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(this.hex(c.color)), linewidth: 2 }));
    this.group.add(line);
    if (c.tube) this.group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, c.tube, 8, false), new THREE.MeshLambertMaterial({ color: new THREE.Color(this.hex(c.color)) })));
    if (c.shadow) {
      var sp = pts.map(function (v) { return new THREE.Vector3(v.x, 0, v.z); });
      this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(sp), new THREE.LineBasicMaterial({ color: 0x8892a6 })));
    }
    if (c.label) { var t = txt(c.label, this.hex(c.color), 40); t.position.copy(pts[pts.length - 1]); t.scale.setScalar(this.scale * 0.15); this.group.add(t); }
  };

  Plot3.prototype.plane = function (pl) {
    var size = pl.size || this.scale * 2;
    var geo = new THREE.PlaneGeometry(size, size);
    var mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(this.hex(pl.color == null ? 1 : pl.color)), side: THREE.DoubleSide, transparent: true, opacity: pl.opacity == null ? .28 : pl.opacity });
    var mesh = new THREE.Mesh(geo, mat);
    var nrm = pl.normal;
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), P(nrm[0], nrm[1], nrm[2]).normalize());
    mesh.position.copy(P(pl.point[0], pl.point[1], pl.point[2]));
    this.group.add(mesh);
    if (pl.label) { var t = txt(pl.label, this.hex(pl.color), 40); t.position.copy(mesh.position).add(new THREE.Vector3(0, size * .18, 0)); t.scale.setScalar(this.scale * 0.15); this.group.add(t); }
  };

  Plot3.prototype.box = function (bx) {
    var x = bx.x, y = bx.y, z = bx.z;
    var geo = new THREE.BoxGeometry(x[1] - x[0], z[1] - z[0], y[1] - y[0]);
    var mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(this.hex(bx.color == null ? 3 : bx.color)), transparent: true, opacity: bx.opacity == null ? .42 : bx.opacity });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((x[0] + x[1]) / 2, (z[0] + z[1]) / 2, -(y[0] + y[1]) / 2);
    this.group.add(mesh);
    this.group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x2b3446 })));
    if (bx.label) { var t = txt(bx.label, '#1b2130', 38); t.position.copy(mesh.position).add(new THREE.Vector3(0, (z[1] - z[0]) * .7, 0)); t.scale.setScalar(this.scale * 0.14); this.group.add(t); }
  };

  Plot3.prototype.vector = function (v) {
    var from = v.from || [0, 0, 0], to = typeof v.to === 'function' ? v.to(this.p) : v.to;
    var a = P(from[0], from[1], from[2]), b = P(to[0], to[1], to[2]);
    var dir = b.clone().sub(a); var len = dir.length();
    if (len < 1e-9) return;
    var ah = new THREE.ArrowHelper(dir.normalize(), a, len, new THREE.Color(this.hex(v.color == null ? 0 : v.color)).getHex(), Math.min(.18, len * .2), Math.min(.1, len * .12));
    this.group.add(ah);
    if (v.label) { var t = txt(v.label, this.hex(v.color == null ? 0 : v.color), 44); t.position.copy(b.clone().multiplyScalar(1.06)); t.scale.setScalar(this.scale * 0.15); this.group.add(t); }
  };

  Plot3.prototype.point = function (q, p) {
    var at = typeof q.p === 'function' ? q.p(p) : q.p;
    var col = new THREE.Color(this.hex(q.color == null ? 4 : q.color));
    var dot = new THREE.Mesh(new THREE.SphereGeometry(this.scale * 0.022, 14, 12), new THREE.MeshBasicMaterial({ color: col }));
    dot.position.copy(P(at[0], at[1], at[2]));
    this.group.add(dot);
    if (q.project) {
      var g = new THREE.BufferGeometry().setFromPoints([dot.position.clone(), new THREE.Vector3(dot.position.x, 0, dot.position.z)]);
      var dl = new THREE.Line(g, new THREE.LineDashedMaterial({ color: 0x8892a6, dashSize: .06, gapSize: .04 }));
      dl.computeLineDistances();
      this.group.add(dl);
    }
    if (q.label) { var t = txt(q.label, '#1b2130', 40); t.position.copy(dot.position).add(new THREE.Vector3(0, this.scale * .07, 0)); t.scale.setScalar(this.scale * 0.15); this.group.add(t); }
  };

  Plot3.prototype.hex = function (c) {
    var PAL = global.Viz2D.PAL;
    if (typeof c === 'number') return PAL[c % PAL.length];
    return c || PAL[0];
  };

  Plot3.prototype.resize = function () {
    if (!this.ready) return;
    var w = this.el.clientWidth || 600;
    if (w < 20) return;
    var h = this.spec.h || 380;
    if (this._w === w && this._h === h) return;
    this._w = w; this._h = h;
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.dirty = true;
  };

  Plot3.prototype.render = function () {
    if (!this.ready) return;
    this.resize();
    if (!this._w) return;
    var sc = this.scale || 1;
    var cx = (this.spec.domain ? (this.spec.domain[0] + this.spec.domain[1]) / 2 : 0);
    var cy = (this.spec.domainY ? (this.spec.domainY[0] + this.spec.domainY[1]) / 2 : 0);
    var cz = this.zRange ? (this.zRange[0] + this.zRange[1]) / 2 : 0;
    var c = new THREE.Vector3(cx + this.target.x, cz + this.target.y, -cy + this.target.z);
    var dist = 3.4 * sc * this.dist;
    this.camera.position.set(
      c.x + dist * Math.cos(this.pitch) * Math.cos(this.yaw),
      c.y + dist * Math.sin(this.pitch),
      c.z + dist * Math.cos(this.pitch) * Math.sin(this.yaw));
    this.camera.lookAt(c);
    this.renderer.render(this.scene, this.camera);
  };

  global.Viz3D = { Plot3: Plot3, GL: GL, P: P, txt: txt, MAX_GL: MAX_GL };
})(window);
