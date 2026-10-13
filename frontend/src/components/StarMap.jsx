// 星图（StarMap）：博客图谱 / 开源项目图谱共用的画布。
//
// 设计取舍（2026-10-11 第二轮，按用户要求改）：
//   1) **不追求「连线=真实关系」**。上千个仓库靠标签去精准匹配，既慢又看不出名堂；
//      这里改成「板块清楚 + 连线随机 + 光点流动」，要的是**炫酷的观感**，不是可查询的关系图。
//   2) 板块感来自布局本身：每个分类 / 语言 / 应用分类占一块扇形「星区」，星区内的点同色，
//      一眼就能看出「这一片是 Python、那一片是 Web 应用」。
//   3) 连线随机但**稳定**（用节点下标做种子），每次刷新同一个点连的还是同几条线，
//      不会像随机抖动那样看着眼晕。
//   4) 配色跟随站点主题：画布底色是半透明的主题色，节点用高饱和色系，
//      明暗两套主题下都能看清（不再固定暗色）。
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';

const TAU = Math.PI * 2;
const LEAF_R = 2.3;           // 卫星点基准半径（CSS 像素）
export const MAX_SECTORS = 14;   // 最多画几个外圈星区（分类 / 编程语言）
export const MAX_INNER = 8;      // 最多画几个内圈星区（标签 / AI 应用分类）
const LINKS_PER_NODE = 2.4;   // 平均每个点连几条线（随机连线，只为好看）

// 高饱和配色：在浅色和深色背景上都能看清（避免和主题色撞）
export const SECTOR_COLORS = [
  '#2f6bff', '#00b894', '#ff7a1a', '#e8397a', '#8b5cf6', '#0fb9b1',
  '#f2b705', '#ef476f', '#3a86ff', '#06d6a0', '#c77dff', '#ff6b35',
  '#118ab2', '#e0a800'
];

// 星区配色：外圈第 i 个用第 i 色，内圈第 i 个错开 5 色（与画布内一致，侧栏色点也用它）
export function sectorColor(i, inner = false) {
  return SECTOR_COLORS[(inner ? i + 5 : i) % SECTOR_COLORS.length];
}

// 稳定伪随机：同一个种子每次结果一样，保证画面不「跳」
function rnd(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// 把接口数据摊成「星区 + 星点 + 连线」。
// 布局：所有星区均匀排在圆周上，星区内的点落在该扇区里（半径有厚度的星带），
// 这样每个板块天然分开，又都朝中心聚拢。
// 导出给 StarMap3D 复用：3D 版用同一份「星区 / 星点 / 连线 / 邻居表」，
// 只把坐标从二维圆盘映射到三维空间，保证 2D 与 3D 的分类配色和交互语义一致。
export function buildScene(data, mode) {
  const nodes = data?.nodes || [];
  const hubs = nodes.filter((n) => n.kind === 'hub');
  const leaves = nodes.filter((n) => n.kind === 'leaf');

  const outerGroup = mode === 'repos' ? '编程语言' : '分类';
  const innerGroup = mode === 'repos' ? '应用分类' : '标签';

  const byCount = (a, b) => b.count - a.count;
  // 星区：外圈（分类 / 语言）+ 内圈（标签 / 应用分类），各取前 N 个，其余归入「其他」
  const outer = hubs.filter((h) => h.group === outerGroup).sort(byCount).slice(0, MAX_SECTORS);
  const inner = hubs.filter((h) => h.group === innerGroup).sort(byCount).slice(0, MAX_INNER);

  const sectorOf = new Map();     // 枢纽 id -> 星区下标
  const sectors = [];             // 每个星区：{ label, group, color, angle, count }
  const addSector = (h, color) => {
    sectorOf.set(h.id, sectors.length);
    sectors.push({ id: h.id, label: h.label, group: h.group, color, count: h.count || 0 });
  };
  outer.forEach((h, i) => addSector(h, sectorColor(i, false)));
  inner.forEach((h, i) => addSector(h, sectorColor(i, true)));

  // 星区间隔：外圈星区占大角度，内圈星区错开半个扇区，避免挤在一起
  const nOut = Math.max(1, outer.length);
  const nIn = Math.max(1, inner.length);
  sectors.forEach((s, i) => {
    const isOuter = i < outer.length;
    const k = isOuter ? i : i - outer.length;
    const n = isOuter ? nOut : nIn;
    s.angle = -Math.PI / 2 + (TAU * k) / n + (isOuter ? 0 : Math.PI / n);
    s.span = TAU / n * 0.9;
    s.ring = isOuter ? 0 : 1;
  });

  // 星点：落在所属星区的扇区里；「其他」星区收留没上榜的点
  const otherIdx = (() => {
    const need = leaves.some((l) => !sectorOf.has(l.parent));
    if (!need) return -1;
    sectorOf.set('__other__', sectors.length);
    sectors.push({ id: '__other__', label: '其他', group: '其他', color: '#7c8798', count: 0, angle: 0, span: TAU, ring: 1 });
    return sectors.length - 1;
  })();

  const leavesScene = leaves.map((l, i) => {
    let si = sectorOf.has(l.parent) ? sectorOf.get(l.parent) : otherIdx;
    if (si < 0) si = 0;
    const s = sectors[si];
    // 半径：外圈星区 0.62~0.98，内圈星区 0.24~0.56；再叠一点随机让星带更自然
    // 外圈星区：0.66~1.0；内圈星区：0.44~0.66（与内圈枢纽 0.4 相接，两层分开不打架）
    const [r0, r1] = s.ring === 0 ? [0.66, 1] : [0.46, 0.66];
    const r = r0 + rnd(i + 3.7) * (r1 - r0);
    const angle = s.angle + (rnd(i + 11.3) - 0.5) * (s.span || TAU);
    return { ...l, si, angle, r, size: LEAF_R };
  });
  sectors.forEach((s) => { s.n = leavesScene.filter((l) => l.si === sectors.indexOf(s)).length; });

  // 枢纽位置：星区中心
  const hubScene = sectors.map((s, i) => ({
    id: s.id, label: s.label, group: s.group, kind: 'hub', color: s.color,
    angle: s.angle, r: s.ring === 0 ? 1.05 : 0.4, si: i,
    size: Math.min(9.5, 4.6 + Math.sqrt(s.count || 1) * 1.05)
  }));

  const all = [...hubScene, ...leavesScene];
  all.forEach((n, i) => { n.idx = i; });
  const leavesAll = leavesScene;

  // 随机连线（稳定）：每个星点连到「同星区或相邻星区」的随机点 —— 板块内密、板块间疏，
  // 既有流动感又不至于糊成一张网。
  const links = [];
  const bySector = new Map();
  leavesAll.forEach((l) => {
    if (!bySector.has(l.si)) bySector.set(l.si, []);
    bySector.get(l.si).push(l);
  });
  const nLeaf = leavesAll.length;
  for (let i = 0; i < nLeaf; i++) {
    const a = leavesAll[i];
    const times = LINKS_PER_NODE + rnd(i + 51.7) * 1.6;
    for (let t = 0; t < times; t++) {
      const roll = rnd(i * 7.1 + t * 13.3 + 2.9);
      let b;
      if (roll < 0.62) {                       // 同星区
        const pool = bySector.get(a.si) || [];
        b = pool[(rnd(i * 3.3 + t * 5.5) * pool.length) | 0];
      } else if (roll < 0.88) {                // 相邻星区
        const s2 = (a.si + (rnd(i + t) < 0.5 ? 1 : -1) + sectors.length) % sectors.length;
        const pool = bySector.get(s2) || [];
        b = pool[(rnd(i * 4.7 + t * 9.1) * pool.length) | 0];
      } else {                                 // 远距离：制造几条贯穿全图的「长弧」
        b = leavesAll[(rnd(i * 17.3 + t * 23.1) * nLeaf) | 0];
      }
      if (!b || b === a) continue;
      const ia = Math.min(a.idx, b.idx); const ib = Math.max(a.idx, b.idx);
      links.push({ ia, ib, ci: a.si, color: sectors[a.si].color });
    }
  }
  // 每个星区都连一条到它的枢纽，让板块中心「有根」
  leavesAll.forEach((l) => {
    if (rnd(l.idx * 2.7) > 0.18) return;
    const h = hubScene[l.si];
    if (h) links.push({ ia: Math.min(h.idx, l.idx), ib: Math.max(h.idx, l.idx), ci: l.si, color: h.color, hub: true });
  });

  // 邻居表：悬停时高亮「我 + 我连着的点」
  const neigh = new Map();
  links.forEach((l) => {
    if (!neigh.has(l.ia)) neigh.set(l.ia, new Set());
    if (!neigh.has(l.ib)) neigh.set(l.ib, new Set());
    neigh.get(l.ia).add(l.ib);
    neigh.get(l.ib).add(l.ia);
  });

  // 分色桶：渲染时每种颜色一条路径，一次描边 / 填充
  const byColor = (list, getCi) => {
    const m = new Map();
    list.forEach((x) => {
      const c = getCi(x);
      if (!m.has(c)) m.set(c, []);
      m.get(c).push(x);
    });
    return [...m.entries()].map(([color, items]) => ({ color, items }));
  };

  return {
    all, hubs: hubScene, leaves: leavesAll, links, neigh, sectors,
    linkBuckets: byColor(links, (l) => l.color),
    leafBuckets: byColor(leavesAll, (l) => sectors[l.si].color),
    stats: data?.stats || {}
  };
}

export function StarMap({ data, mode = 'blog', onPick, label }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const scene = useRef(null);
  const size = useRef({ w: 0, h: 0, base: 0, cx: 0, cy: 0, dpr: 1 });
  const view = useRef({ zoom: 1, panX: 0, panY: 0, phase: 0 });
  const posX = useRef(null);
  const posY = useRef(null);
  const pointer = useRef({ down: false, moved: false, lastX: 0, lastY: 0 });
  const hoverIdx = useRef(null);
  const particles = useRef([]);
  const [hover, setHover] = useState(null);
  const [tip, setTip] = useState(null);
  const tipAt = useRef({ x: -99, y: -99, id: null });

  // 画布上的文字颜色跟随站点主题（浅色主题用深字 + 浅描边，素雅/暗底用浅字 + 深描边）
  const themeInk = useRef({
    text: 'rgba(240,244,255,0.95)', halo: 'rgba(0,0,0,0.55)',
    pill: 'rgba(12,18,30,0.72)', pillEdge: 'rgba(255,255,255,0.14)'
  });
  const readThemeInk = () => {
    try {
      const cs = getComputedStyle(document.documentElement);
      const text = (cs.getPropertyValue('--text') || '').trim();
      const bg = (cs.getPropertyValue('--bg-subtle') || cs.getPropertyValue('--bg') || '').trim();
      const elevated = (cs.getPropertyValue('--bg-elevated') || bg || '').trim();
      if (text && bg) {
        // 主题是浅色还是深色，用 --text 的亮度判断（<128 视为浅色主题 → 用深字 + 白药丸）
        const hex = text.replace('#', '');
        let lum = 128;
        if (/^[0-9a-fA-F]{6}$/.test(hex)) {
          const r = parseInt(hex.slice(0, 2), 16);
          const g = parseInt(hex.slice(2, 4), 16);
          const b = parseInt(hex.slice(4, 6), 16);
          lum = 0.299 * r + 0.587 * g + 0.114 * b;
        }
        const light = lum < 128;
        themeInk.current = light
          ? { text, halo: bg, pill: elevated || '#ffffff', pillEdge: 'rgba(16,19,26,0.14)' }
          : { text, halo: bg, pill: 'rgba(12,18,30,0.74)', pillEdge: 'rgba(255,255,255,0.16)' };
      }
    } catch { /* 读不到就用默认值 */ }
  };

  const measure = () => {
    const w = wrap.current; const c = canvas.current;
    if (!w || !c) return;
    const box = w.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(320, box.width);
    const height = Math.max(320, box.height);
    c.width = Math.round(width * dpr); c.height = Math.round(height * dpr);
    c.style.width = `${width}px`; c.style.height = `${height}px`;
    size.current = {
      w: width, h: height, dpr, cx: width / 2, cy: height / 2,
      base: Math.max(80, Math.min(width / 2 - 34, height / 2 - 26))
    };
  };

  useLayoutEffect(() => {
    readThemeInk();
    scene.current = buildScene(data, mode);
    posX.current = new Float32Array(scene.current.all.length);
    posY.current = new Float32Array(scene.current.all.length);
    particles.current = [];
    hoverIdx.current = null;
    setHover(null); setTip(null);
    measure();
    const ro = new ResizeObserver(() => measure());
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [data, mode]);

  // 主循环：自转 + 连线 + 星点 + 光点；标签页隐藏时停手
  useEffect(() => {
    let raf; let last = 0;
    const frame = (ts) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) { last = ts; return; }
      const sc = scene.current; const c = canvas.current;
      if (!sc || !c) return;
      const dt = Math.min(60, ts - last || 16); last = ts;
      const s = size.current; const v = view.current;
      const hk = hoverIdx.current;
      if (hk === null) v.phase += dt * 0.00006;   // 悬停时暂停自转，方便点中

      const ctx = c.getContext('2d');
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      ctx.clearRect(0, 0, s.w, s.h);

      // 1) 坐标（一次算完，后面全部复用）
      const xs = posX.current; const ys = posY.current;
      const cosP = Math.cos(v.phase); const sinP = Math.sin(v.phase);
      for (let i = 0; i < sc.all.length; i++) {
        const n = sc.all[i];
        const ca = Math.cos(n.angle); const sa = Math.sin(n.angle);
        const ux = ca * cosP - sa * sinP; const uy = ca * sinP + sa * cosP;
        xs[i] = s.cx + ux * n.r * s.base * v.zoom + v.panX;
        ys[i] = s.cy + uy * n.r * s.base * v.zoom + v.panY;
        if (n.kind === 'hub') { n._ux = ux; n._uy = uy; }   // 供标签沿半径向外摆放
      }

      const lit = hk === null ? null : sc.neigh.get(hk);
      const hkColor = hk === null ? '#fff' : (sc.all[hk]?.color || '#fff');

      // 2) 连线：按颜色分桶（一色一次描边），远看是彩色星云
      if (hk === null) {
        ctx.lineWidth = 0.7;
        for (const bucket of sc.linkBuckets) {
          ctx.globalAlpha = 0.16;
          ctx.strokeStyle = bucket.color;
          ctx.beginPath();
          for (const l of bucket.items) {
            ctx.moveTo(xs[l.ia], ys[l.ia]); ctx.lineTo(xs[l.ib], ys[l.ib]);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else {
        ctx.lineWidth = 0.7;
        ctx.strokeStyle = 'rgba(140,150,170,0.07)';
        ctx.beginPath();
        for (const l of sc.links) { ctx.moveTo(xs[l.ia], ys[l.ia]); ctx.lineTo(xs[l.ib], ys[l.ib]); }
        ctx.stroke();
        // 当前节点的邻居连线高亮
        ctx.lineWidth = 1.25; ctx.strokeStyle = hkColor; ctx.globalAlpha = 0.5;
        ctx.beginPath();
        for (const l of sc.links) {
          if (l.ia !== hk && l.ib !== hk) continue;
          ctx.moveTo(xs[l.ia], ys[l.ia]); ctx.lineTo(xs[l.ib], ys[l.ib]);
        }
        ctx.stroke(); ctx.globalAlpha = 1;
      }

      // 3) 星点：按星区颜色分桶填充；悬停时把非邻居压暗
      const rBase = Math.max(1.7, LEAF_R * Math.min(2, Math.max(0.95, v.zoom)));
      for (const bucket of sc.leafBuckets) {
        ctx.beginPath();
        let any = false;
        for (const n of bucket.items) {
          if (hk !== null && n.idx !== hk && !lit?.has(n.idx)) continue;
          const x = xs[n.idx]; const y = ys[n.idx];
          if (x < -12 || y < -12 || x > s.w + 12 || y > s.h + 12) continue;
          ctx.moveTo(x + rBase, y); ctx.arc(x, y, rBase, 0, TAU); any = true;
        }
        if (!any) continue;
        ctx.globalAlpha = hk === null ? 0.92 : 1;
        ctx.fillStyle = bucket.color;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (hk !== null) {
        const hx = xs[hk]; const hy = ys[hk];
        ctx.beginPath(); ctx.arc(hx, hy, rBase + 1.6, 0, TAU);
        ctx.fillStyle = '#fff'; ctx.fill();
      }

      // 4) 星区枢纽：光晕圆 + 名称药丸
      //    药丸位置需要**先全部算好再避让**：星区多的时候标签会互相压住（用户反馈「糊在一起」），
      //    因此这里两趟走：先算矩形，再按同侧分组做纵向推开，最后统一绘制。
      const PILL_H = 18; const PAD_X = 7; const BAR_W = 3;
      const pills = [];
      for (const h of sc.hubs) {
        const x = xs[h.idx]; const y = ys[h.idx];
        const on = hk === null || h.idx === hk || lit?.has(h.idx);
        const r = h.size * Math.max(1, Math.min(1.6, v.zoom));
        const txt = h.count ? `${h.label} ${h.count}` : h.label;
        // 画布字体必须带中文字形兜底：等宽栈没有汉字，会回退到 Windows 的 NSimSun（新宋体），
        // 药丸上的中文星区名（「学科知识」等）会发虚。补系统无衬线后中文干净、数字仍等宽。
        ctx.font = `${on ? 600 : 400} 11.5px ui-monospace, 'JetBrains Mono', Menlo, Consolas, 'PingFang SC', 'Microsoft YaHei', system-ui, monospace`;
        const ux = h._ux || 1; const uy = h._uy || 0;
        const right = ux >= 0;
        const gap = r + 9;
        const w = ctx.measureText(txt).width + PAD_X * 2 + BAR_W + 4;
        const cx = right ? x + ux * gap : x + ux * gap - w;   // 药丸左边界
        const cy = y + uy * gap + (Math.abs(uy) > 0.6 ? (uy > 0 ? 7 : -7) : 0) - PILL_H / 2;
        pills.push({ h, on, r, x, y, txt, right, bx: cx, by: cy, w });
      }
      // 纵向避让：按左右两侧分别处理，重叠时把靠后的那颗往外推
      for (const side of [true, false]) {
        const group = pills.filter((p) => p.right === side).sort((a, b) => a.by - b.by);
        for (let i = 1; i < group.length; i++) {
          const prev = group[i - 1]; const cur = group[i];
          const overlapX = cur.bx < prev.bx + prev.w + 6 && prev.bx < cur.bx + cur.w + 6;
          if (overlapX && cur.by < prev.by + PILL_H + 3) cur.by = prev.by + PILL_H + 3;
        }
      }
      ctx.textBaseline = 'middle';
      for (const p of pills) {
        const { h } = p;
        ctx.globalAlpha = p.on ? 1 : 0.25;
        ctx.shadowColor = h.color; ctx.shadowBlur = h.idx === hk ? 24 : 14;
        ctx.fillStyle = h.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
        if (h.idx === hk) {
          const t = (ts % 1600) / 1600;
          ctx.globalAlpha = (1 - t) * 0.65;
          ctx.strokeStyle = h.color; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 4 + t * 14, 0, TAU); ctx.stroke();
          ctx.globalAlpha = p.on ? 1 : 0.25;
        }
        // 实底药丸 + 左侧色条：底色不透明、字色取主题正文色，密集星点上也读得清。
        // 药丸不随悬停变淡（它是「读数」不是「装饰」），所以这里把 alpha 复位为 1。
        ctx.globalAlpha = 1;
        const rad = PILL_H / 2;
        ctx.beginPath();
        ctx.moveTo(p.bx + rad, p.by);
        ctx.arcTo(p.bx + p.w, p.by, p.bx + p.w, p.by + PILL_H, rad);
        ctx.arcTo(p.bx + p.w, p.by + PILL_H, p.bx, p.by + PILL_H, rad);
        ctx.arcTo(p.bx, p.by + PILL_H, p.bx, p.by, rad);
        ctx.arcTo(p.bx, p.by, p.bx + p.w, p.by, rad);
        ctx.closePath();
        ctx.fillStyle = themeInk.current.pill;
        ctx.fill();
        ctx.strokeStyle = themeInk.current.pillEdge; ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.bx + PAD_X, p.by + 4.5);
        ctx.lineTo(p.bx + PAD_X, p.by + PILL_H - 4.5);
        ctx.strokeStyle = h.color; ctx.lineWidth = BAR_W; ctx.lineCap = 'round';
        ctx.stroke();
        ctx.lineCap = 'butt';
        ctx.textAlign = 'left';
        ctx.fillStyle = themeInk.current.text;
        ctx.fillText(p.txt, p.bx + PAD_X + BAR_W + 4, p.by + PILL_H / 2);
        ctx.globalAlpha = 1;
      }
      ctx.textAlign = 'left';

      // 5) 光点：沿随机连线流动（悬停时只留邻居的）
      if (sc.links.length) {
        const target = Math.min(260, Math.max(60, Math.round(sc.links.length * 0.05)));
        let add = target - particles.current.length;
        while (add > 0) {
          const l = sc.links[(Math.random() * sc.links.length) | 0];
          particles.current.push({ l, t: Math.random(), sp: 0.00009 + Math.random() * 0.0002 });
          add--;
        }
        ctx.globalCompositeOperation = 'lighter';
        particles.current = particles.current.filter((p) => {
          p.t += p.sp * dt;
          if (p.t >= 1) return false;
          if (hk !== null && p.l.ia !== hk && p.l.ib !== hk) return false;
          const ax = xs[p.l.ia]; const ay = ys[p.l.ia];
          const bx = xs[p.l.ib]; const by = ys[p.l.ib];
          const x = ax + (bx - ax) * p.t; const y = ay + (by - ay) * p.t;
          const tp = Math.max(0, p.t - 0.07);
          const px = ax + (bx - ax) * tp; const py = ay + (by - ay) * tp;
          const grd = ctx.createLinearGradient(px, py, x, y);
          grd.addColorStop(0, 'rgba(0,0,0,0)');
          grd.addColorStop(1, p.l.color);
          ctx.strokeStyle = grd; ctx.lineWidth = hk === null ? 1.35 : 1.9;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(x, y, hk === null ? 1.25 : 1.9, 0, TAU); ctx.fill();
          return true;
        });
        ctx.globalCompositeOperation = 'source-over';
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const hit = (mx, my) => {
    const sc = scene.current; if (!sc) return null;
    const xs = posX.current; const ys = posY.current;
    let best = null; let bestD = Infinity;
    const check = (n, pad) => {
      const x = xs[n.idx]; const y = ys[n.idx];
      const limit = n.kind === 'hub' ? n.size + pad : 7;
      const d = (x - mx) ** 2 + (y - my) ** 2;
      if (d <= limit * limit && d < bestD) { bestD = d; best = n; }
    };
    sc.hubs.forEach((n) => check(n, 10));
    if (!best) sc.leaves.forEach((n) => check(n, 4));
    return best;
  };

  const localPoint = (e) => {
    const box = wrap.current.getBoundingClientRect();
    return [e.clientX - box.left, e.clientY - box.top];
  };

  const onMove = (e) => {
    const [mx, my] = localPoint(e);
    if (pointer.current.down) {
      const dx = mx - pointer.current.lastX; const dy = my - pointer.current.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) pointer.current.moved = true;
      view.current.panX += dx; view.current.panY += dy;
      pointer.current.lastX = mx; pointer.current.lastY = my;
      return;
    }
    const n = hit(mx, my);
    const id = n ? n.idx : null;
    if (id !== hoverIdx.current) {
      hoverIdx.current = id;
      setHover(n);
      if (canvas.current) canvas.current.style.cursor = n ? 'pointer' : 'default';
    }
    const t = tipAt.current;
    if (n ? (t.id !== n.idx || Math.abs(t.x - mx) > 10 || Math.abs(t.y - my) > 10) : t.id !== null) {
      tipAt.current = { x: mx, y: my, id: n ? n.idx : null };
      setTip(n ? { x: mx, y: my, node: n } : null);
    }
  };

  const onDown = (e) => {
    const [mx, my] = localPoint(e);
    pointer.current.down = true; pointer.current.moved = false;
    pointer.current.lastX = mx; pointer.current.lastY = my;
    if (wrap.current?.setPointerCapture && e.pointerId != null) {
      try { wrap.current.setPointerCapture(e.pointerId); } catch { /* 无按键时部分浏览器不允许捕获，忽略 */ }
    }
  };

  const onUp = (e) => {
    const wasDrag = pointer.current.moved;
    pointer.current.down = false;
    if (wasDrag) return;
    const [mx, my] = localPoint(e);
    const n = hit(mx, my);
    if (n && onPick) onPick(n);
  };

  const onLeave = () => {
    pointer.current.down = false;
    hoverIdx.current = null; tipAt.current = { x: -99, y: -99, id: null };
    setHover(null); setTip(null);
    if (canvas.current) canvas.current.style.cursor = 'default';
  };

  const onWheel = (e) => {
    e.preventDefault();
    const [mx, my] = localPoint(e);
    const v = view.current;
    const next = Math.max(0.55, Math.min(6, v.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
    v.panX = mx - (mx - v.panX) * (next / v.zoom);
    v.panY = my - (my - v.panY) * (next / v.zoom);
    v.zoom = next;
  };

  const reset = () => {
    view.current = { zoom: 1, panX: 0, panY: 0, phase: view.current.phase };
    setTip(null); tipAt.current = { x: -99, y: -99, id: null };
  };

  return (
    <div class="sm-wrap" ref={wrap}
      onPointerMove={onMove} onPointerDown={onDown} onPointerUp={onUp}
      onPointerLeave={onLeave} onPointerCancel={onLeave}
      onWheel={onWheel} onDblClick={reset}
      role="application" aria-label={label || '星图'}>
      <canvas ref={canvas} class="sm-canvas" />
      {tip && (
        <div class={`sm-tip${tip.x > size.current.w - 270 ? ' flip' : ''}`} style={`left:${tip.x}px;top:${tip.y}px`}>
          <b>{tip.node.label}</b>
          {tip.node.kind === 'hub'
            ? <span>{tip.node.group} · {tip.node.count} 个</span>
            : <span>{tip.node.group}{tip.node.owner ? ` · ${tip.node.owner}` : ''}{tip.node.date ? ` · ${tip.node.date}` : ''}</span>}
          {tip.node.one && <em>{tip.node.one}</em>}
          <i>{tip.node.kind === 'hub' ? '点击筛选' : '点击打开'}</i>
        </div>
      )}
      <div class="sm-hint">
        <span>滚轮缩放 · 拖拽平移 · 双击复位</span>
        {hover && <b style={`color:${hover.color || '#fff'}`}>当前：{hover.label}</b>}
      </div>
    </div>
  );
}
