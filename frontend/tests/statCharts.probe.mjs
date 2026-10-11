// statCharts.probe.mjs —— StatCharts.jsx 的探针（Node 24，零外部测试框架）
//
// 做两件事：
//   A) 纯函数测试：把布局 / 分箱 / 堆叠 / 刻度 / 归一化这些计算逻辑，
//      在**空数组 / 单点 / 全 0 / 负数 / 除零 / NaN** 上跑一遍，确认不抛异常、不产出 NaN。
//   B) 真实渲染测试：手写一个最小 DOM shim，用真 preact 把组件 render 进去，
//      再序列化成字符串，确认标题 / 标签 / 空态文案都真的出现在输出里。
//
// 说明：StatCharts.jsx 是 JSX，Node 不能直接 import，所以这里用仓库里已有的 esbuild
// 把它打成一份内存 ESM（bundle 后连 preact 一起打包），再以 data: URL 动态 import。
// 没有任何文件落盘，也没有任何第三方测试库。

import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '../src/components/StatCharts.jsx');

// ============================================================ 最小 DOM shim

function makeStyle() {
  const store = new Map();
  const target = {
    setProperty(k, v) { store.set(String(k), String(v)); },
    removeProperty(k) { store.delete(String(k)); return ''; },
    getPropertyValue(k) { return store.get(String(k)) || ''; }
  };
  const serialize = () => [...store.entries()]
    .map(([k, v]) => (k.includes('-') ? `${k}:${v}` : `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${v}`))
    .join(';');
  return new Proxy(target, {
    set(t, k, v) {
      if (k === 'cssText') { store.set('__cssText', String(v)); return true; }
      store.set(String(k), String(v));
      return true;
    },
    get(t, k) {
      if (k === 'cssText') return store.get('__cssText') || serialize();
      if (k in t) return t[k];
      const v = store.get(String(k));
      return v === undefined ? '' : v;
    }
  });
}

const ALL_ELEMENTS = [];

class DomNode {
  constructor() {
    this.parentNode = null;
    this.__listeners = Object.create(null);
  }
  get ownerSVGElement() {
    let p = this.parentNode;
    while (p) { if (p.localName === 'svg') return p; p = p.parentNode; }
    return null;
  }
  addEventListener(type, fn) { (this.__listeners[type] || (this.__listeners[type] = [])).push(fn); }
  removeEventListener(type, fn) {
    const l = this.__listeners[type];
    if (l) this.__listeners[type] = l.filter((x) => x !== fn);
  }
}

class DomText extends DomNode {
  constructor(data) { super(); this.nodeType = 3; this.data = String(data == null ? '' : data); }
  get textContent() { return this.data; }
  set textContent(v) { this.data = String(v == null ? '' : v); }
}

class DomElement extends DomNode {
  constructor(tag, ns) {
    super();
    this.nodeType = 1;
    this.localName = String(tag).toLowerCase();
    this.tagName = String(tag).toUpperCase();
    this.namespaceURI = ns || 'http://www.w3.org/1999/xhtml';
    this.childNodes = [];
    this.style = makeStyle();
    this.clientWidth = 800;
    this.__attrs = new Map();
    ALL_ELEMENTS.push(this);
  }

  get attributes() { return [...this.__attrs.entries()].map(([name, value]) => ({ name, value: String(value) })); }
  getAttribute(name) { const v = this.__attrs.get(String(name).toLowerCase()); return v === undefined ? null : v; }
  // id / className 在真实 DOM 里是反射属性，这里也同步到 attributes，便于断言
  get id() { return this.getAttribute('id') || ''; }
  set id(v) { this.setAttribute('id', v); }
  hasAttribute(name) { return this.__attrs.has(String(name).toLowerCase()); }
  setAttribute(name, value) { this.__attrs.set(String(name).toLowerCase(), String(value)); }
  removeAttribute(name) { this.__attrs.delete(String(name).toLowerCase()); }

  get firstChild() { return this.childNodes[0] || null; }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }
  get nextSibling() {
    const p = this.parentNode;
    if (!p) return null;
    const i = p.childNodes.indexOf(this);
    return i < 0 ? null : (p.childNodes[i + 1] || null);
  }

  insertBefore(child, ref) {
    if (child.parentNode) child.parentNode.removeChild(child);
    const i = ref ? this.childNodes.indexOf(ref) : -1;
    if (i < 0) this.childNodes.push(child); else this.childNodes.splice(i, 0, child);
    child.parentNode = this;
    return child;
  }
  appendChild(child) { return this.insertBefore(child, null); }
  removeChild(child) {
    const i = this.childNodes.indexOf(child);
    if (i >= 0) { this.childNodes.splice(i, 1); child.parentNode = null; }
    return child;
  }

  get textContent() { return this.childNodes.map((c) => c.textContent).join(''); }
  set textContent(v) {
    this.childNodes.forEach((c) => { c.parentNode = null; });
    this.childNodes = [];
    const t = new DomText(v);
    t.parentNode = this;
    this.childNodes.push(t);
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: 400, right: this.clientWidth, bottom: 400 }; }
}

const documentShim = {
  documentElement: new DomElement('html'),
  head: new DomElement('head'),
  createElement(tag) { return new DomElement(tag); },
  createElementNS(ns, tag) { return new DomElement(tag, ns); },
  createTextNode(data) { return new DomText(data); },
  getElementById(id) { return ALL_ELEMENTS.find((e) => e.getAttribute('id') === String(id)) || null; }
};

globalThis.document = documentShim;
globalThis.window = {
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  addEventListener() {},
  removeEventListener() {}
};
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

// ============================================================ 序列化

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function serialize(node) {
  if (!node) return '';
  if (node.nodeType === 3) return esc(node.data);
  const attrs = [...node.__attrs.entries()].map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
  const st = node.style && node.style.cssText;
  const styleAttr = st ? ` style="${esc(st)}"` : '';
  const open = `<${node.localName}${attrs}${styleAttr}>`;
  if (VOID.has(node.localName)) return open;
  return `${open}${node.childNodes.map(serialize).join('')}</${node.localName}>`;
}

// ============================================================ 加载 StatCharts.jsx

async function loadCharts() {
  const esbuild = await import('esbuild');
  // 关键：把 preact 和 StatCharts 打进**同一份** bundle，否则 hooks 的状态
  // 挂在 bundle 内的 preact 上，而 render 用的是另一份 preact，会直接崩。
  const source = [
    "export * from './StatCharts.jsx';",
    "export { h, render } from 'preact';"
  ].join('\n');
  const built = await esbuild.build({
    stdin: { contents: source, loader: 'js', resolveDir: dirname(SRC), sourcefile: 'stat-charts-entry.js' },
    bundle: true, write: false, format: 'esm', target: 'es2020',
    jsx: 'automatic', jsxImportSource: 'preact',
    logLevel: 'silent'
  });
  const code = built.outputFiles[0].text;
  // 写到临时目录再 import：比 data: URL 更容易看到真实的报错行号
  const out = resolve(tmpdir(), `stat-charts-probe-${process.pid}.mjs`);
  writeFileSync(out, code, 'utf8');
  try {
    return await import(`${pathToFileURL(out).href}?t=${Date.now()}`);
  } finally {
    try { unlinkSync(out); } catch { /* 忽略清理失败 */ }
  }
}

// ============================================================ 断言小工具

let pass = 0; const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass += 1; return; }
  failures.push(`${name}${extra ? ` —— ${extra}` : ''}`);
}
function eq(name, got, want) {
  ok(name, Object.is(got, want), `期望 ${JSON.stringify(want)}，实际 ${JSON.stringify(got)}`);
}
function noNaN(name, value, depth = 0) {
  if (depth > 4) return;
  if (typeof value === 'number') { ok(`${name} 不是 NaN/Infinity`, Number.isFinite(value), `实际 ${value}`); return; }
  if (Array.isArray(value)) { value.forEach((v, i) => noNaN(`${name}[${i}]`, v, depth + 1)); return; }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([k, v]) => {
      if (typeof v === 'function') return;
      noNaN(`${name}.${k}`, v, depth + 1);
    });
  }
}

// ============================================================ 主流程

const M = await loadCharts();
const { h, render } = M;

function renderToString(vnode) {
  const host = documentShim.createElement('div');
  render(vnode, host);
  return serialize(host);
}

console.log('StatCharts 探针\n');

// ---------- A. 纯函数 ----------
console.log('— A. 纯函数边界 —');

// binValues
const bEmpty = M.binValues([], 8);
eq('binValues([]) total', bEmpty.total, 0);
eq('binValues([]) bins 长度', bEmpty.bins.length, 0);
noNaN('binValues([])', bEmpty);

const bSingle = M.binValues([5], 4);
eq('binValues([5]) total', bSingle.total, 1);
eq('binValues([5]) 落箱计数合计', bSingle.bins.reduce((s, b) => s + b.count, 0), 1);
noNaN('binValues([5])', bSingle);

const bZero = M.binValues([0, 0, 0, 0], 4);
eq('binValues(全 0) total', bZero.total, 4);
eq('binValues(全 0) 计数合计', bZero.bins.reduce((s, b) => s + b.count, 0), 4);
noNaN('binValues(全 0)', bZero);

const bNeg = M.binValues([-3, -1, 0, 2, 9], 5);
eq('binValues(含负数) total', bNeg.total, 5);
noNaN('binValues(含负数)', bNeg);

const bNaN = M.binValues([1, NaN, 'x', null, 3], 3);
eq('binValues(含 NaN/非法值) 只留有效数', bNaN.total, 2);
noNaN('binValues(含 NaN)', bNaN);
eq('binValues 非数组', M.binValues(null, 4).total, 0);

// niceTicks
noNaN('niceTicks(0,0)', M.niceTicks(0, 0));
eq('niceTicks(0,0) 退化为单值', M.niceTicks(0, 0).length, 1);
eq('niceTicks(0,0) 值', M.niceTicks(0, 0)[0], 0);
const tk = M.niceTicks(0, 100, 5);
ok('niceTicks(0,100) 有刻度', tk.length >= 3, `实际 ${JSON.stringify(tk)}`);
ok('niceTicks(0,100) 单调递增', tk.every((v, i) => i === 0 || v > tk[i - 1]));
noNaN('niceTicks(0,100)', tk);
eq('niceTicks 倒置区间不炸', Array.isArray(M.niceTicks(10, 2)), true);

// logScale
eq('logScale(0,0,0,0,100) 不产生 -Infinity', M.logScale(0, 0, 0, 0, 100), 0);
ok('logScale(0,0,100,0,100) 落在起点', M.logScale(0, 0, 100, 0, 100) === 0);
ok('logScale(100,0,100,0,100) 落在终点', Math.abs(M.logScale(100, 0, 100, 0, 100) - 100) < 1e-9);
ok('logScale(-5,...) 负数被压到 0', M.logScale(-5, 0, 100, 0, 100) === 0);
ok('logScale 空区间不炸', Number.isFinite(M.logScale(3, 5, 5, 0, 10)));
noNaN('logScale(NaN)', M.logScale(NaN, 0, 10, 0, 10));

// linearScale
eq('linearScale 零跨度返回 r0', M.linearScale(3, 5, 5, 0, 10), 0);
eq('linearScale 空 domain 返回 r0', M.linearScale(3, 0, 0, 7, 10), 7);
ok('linearScale 正常映射', M.linearScale(5, 0, 10, 0, 100) === 50);
noNaN('linearScale(NaN)', M.linearScale(NaN, 0, 10, 0, 100));

// matrixNorm / matrixDomain
const mEmpty = M.matrixNorm([]);
eq('matrixNorm([]) 长度', mEmpty.length, 0);
noNaN('matrixNorm([])', mEmpty);
const mZero = M.matrixNorm([[0, 0], [0, 0]]);
ok('matrixNorm(全 0) 全为 0', mZero.flat().every((v) => v === 0));
noNaN('matrixNorm(全 0)', mZero);
const mSame = M.matrixNorm([[4, 4], [4, 4]]);
ok('matrixNorm(全等值) 不 NaN', mSame.flat().every((v) => Number.isFinite(v)));
const mNorm = M.matrixNorm([[0, 5], [10, 2]]);
eq('matrixNorm 最小值 → 0', mNorm[0][0], 0);
eq('matrixNorm 最大值 → 1', mNorm[1][0], 1);
eq('matrixNorm 中间值', mNorm[0][1], 0.5);
noNaN('matrixNorm 正常', mNorm);
eq('matrixDomain([]) span', M.matrixDomain([]).span, 0);
eq('matrixNorm 非数组', M.matrixNorm(null).length, 0);

// stackSeries
const sEmpty = M.stackSeries([]);
eq('stackSeries([]) xs 长度', sEmpty.xs.length, 0);
eq('stackSeries([]) max', sEmpty.max, 0);
noNaN('stackSeries([])', sEmpty);
const sOne = M.stackSeries([{ label: 'A', points: [{ x: '2026-01', y: 3 }] }]);
eq('stackSeries 单点 xs', sOne.xs.length, 1);
eq('stackSeries 单点 cum1', sOne.series[0].cum1[0], 3);
eq('stackSeries 单点 max', sOne.max, 3);
noNaN('stackSeries 单点', sOne);
const sAlign = M.stackSeries([
  { label: 'A', points: [{ x: '2026-02', y: 2 }, { x: '2026-01', y: 1 }] },
  { label: 'B', points: [{ x: '2026-01', y: 5 }, { x: '2026-03', y: 7 }] }
]);
eq('stackSeries x 并集排序', JSON.stringify(sAlign.xs), JSON.stringify(['2026-01', '2026-02', '2026-03']));
eq('stackSeries 缺失补 0', sAlign.series[0].values[2], 0);
eq('stackSeries 累积下界', sAlign.series[1].cum0[0], 1);
eq('stackSeries 累积上界', sAlign.series[1].cum1[0], 6);
eq('stackSeries max 取峰值', sAlign.max, 7);
noNaN('stackSeries 对齐', sAlign);
const sZero = M.stackSeries([{ label: 'A', points: [{ x: 'a', y: 0 }, { x: 'b', y: 0 }] }]);
eq('stackSeries(全 0) max', sZero.max, 0);
noNaN('stackSeries(全 0)', sZero);
const sBad = M.stackSeries([{ label: 'A', points: [{ x: 'a', y: NaN }, { x: 'b', y: -2 }] }]);
ok('stackSeries 非法 y 归 0', sBad.series[0].values[0] === 0);
ok('stackSeries 负值原样保留', sBad.series[0].values[1] === -2);
noNaN('stackSeries 非法值', { xs: sBad.xs, max: sBad.max });

// smoothPath
eq('smoothPath([])', M.smoothPath([]), '');
ok('smoothPath 单点以 M 开头', M.smoothPath([[1, 2]]).startsWith('M'));
ok('smoothPath 两点用直线', M.smoothPath([[0, 0], [10, 10]]).includes('L'));
ok('smoothPath 多点用三次贝塞尔', M.smoothPath([[0, 0], [10, 5], [20, 0]]).includes('C'));
ok('smoothPath 过滤非法点后等价于两点直线',
  M.smoothPath([[0, 0], [NaN, 1], [20, 0]]) === M.smoothPath([[0, 0], [20, 0]]),
  M.smoothPath([[0, 0], [NaN, 1], [20, 0]]));
ok('smoothPath 全非法点返回空串', M.smoothPath([[NaN, NaN], null]) === '');

// radarPoints
const rEmpty = M.radarPoints([], undefined, 100, 100, 50);
eq('radarPoints([]) coords 长度', rEmpty.coords.length, 0);
eq('radarPoints([]) top 兜底为 1', rEmpty.top, 1);
noNaN('radarPoints([])', { top: rEmpty.top, points: rEmpty.points });
const rZero = M.radarPoints([{ label: 'a', value: 0 }, { label: 'b', value: 0 }], undefined, 100, 100, 50);
eq('radarPoints(全 0) top 兜底', rZero.top, 1);
ok('radarPoints(全 0) 半径全 0', rZero.coords.every((c) => c.ratio === 0));
noNaN('radarPoints(全 0)', { top: rZero.top, points: rZero.points });
const rNeg = M.radarPoints([{ label: 'a', value: -5 }, { label: 'b', value: 10 }], undefined, 0, 0, 40);
ok('radarPoints 负值被夹到 0', rNeg.coords[0].ratio === 0);
ok('radarPoints 最大值 → 半径 40', Math.abs(Math.hypot(rNeg.coords[1].x, rNeg.coords[1].y) - 40) < 1e-9);
noNaN('radarPoints 含负数', { top: rNeg.top, points: rNeg.points });
const rClamp = M.radarPoints([{ label: 'a', value: 999 }], 10, 0, 0, 40);
ok('radarPoints 超上限被夹到 1', rClamp.coords[0].ratio === 1);

// bubbleLayout
const blEmpty = M.bubbleLayout([], { width: 400, height: 300 });
eq('bubbleLayout([]) bubbles 长度', blEmpty.bubbles.length, 0);
ok('bubbleLayout([]) 仍有刻度', blEmpty.xTicks.length >= 1);
noNaN('bubbleLayout([]) 刻度', { x: blEmpty.xTicks, y: blEmpty.yTicks });
const blOne = M.bubbleLayout([{ x: 5, y: 5, size: 5, label: 'P' }], { width: 400, height: 300 });
eq('bubbleLayout 单点数量', blOne.bubbles.length, 1);
noNaN('bubbleLayout 单点坐标', [blOne.bubbles[0].cx, blOne.bubbles[0].cy, blOne.bubbles[0].r]);
const blLog = M.bubbleLayout([{ x: 0, y: 0, size: 0 }, { x: 1e6, y: 1e5, size: 1e4 }], { width: 500, height: 300, logX: true, logY: true });
noNaN('bubbleLayout 对数轴含 0', blLog.bubbles.flatMap((b) => [b.cx, b.cy, b.r]));
ok('bubbleLayout 对数轴坐标有限', blLog.bubbles.every((b) => Number.isFinite(b.cx) && Number.isFinite(b.cy)));
const blBad = M.bubbleLayout([{ x: 'a', y: 1 }, null, { x: 1, y: 2, size: -3 }], { width: 400, height: 300 });
eq('bubbleLayout 过滤非法点', blBad.bubbles.length, 1);
ok('bubbleLayout 负 size 至少给最小半径', blBad.bubbles[0].r > 0);
noNaN('bubbleLayout 非法输入', [blBad.bubbles[0].cx, blBad.bubbles[0].r]);
eq('bubbleLayout 非数组', M.bubbleLayout(null, {}).bubbles.length, 0);

// sunburstLayout
const sbEmpty = M.sunburstLayout([]);
eq('sunburstLayout([]) arcs 长度', sbEmpty.arcs.length, 0);
eq('sunburstLayout([]) total', sbEmpty.total, 0);
const sbZero = M.sunburstLayout([{ label: 'A', value: 0 }]);
eq('sunburstLayout(全 0) arcs 长度', sbZero.arcs.length, 0);
noNaN('sunburstLayout(全 0)', { total: sbZero.total });
const sbOne = M.sunburstLayout([{ label: '唯一', value: 7 }], { r: 100 });
eq('sunburstLayout 单环 arcs 数量', sbOne.arcs.length, 1);
ok('sunburstLayout 单环角度闭合（≈360°）', Math.abs((sbOne.arcs[0].a1 - sbOne.arcs[0].a0) - 360) < 1.2);
ok('sunburstLayout 单环路径可画', M.annularSectorPath(0, 0, 30, 60, sbOne.arcs[0].a0, sbOne.arcs[0].a1).startsWith('M'));
const sbTree = M.sunburstLayout([
  { label: '分类A', value: 6, children: [{ label: '标签x', value: 4 }, { label: '标签y', value: 2 }] },
  { label: '分类B', value: 3, children: [{ label: '标签z', value: 3 }] }
], { r: 100 });
eq('sunburstLayout 双层 arcs 数量', sbTree.arcs.length, 5);
eq('sunburstLayout 内环数量', sbTree.arcs.filter((a) => a.depth === 1).length, 2);
eq('sunburstLayout 外环数量', sbTree.arcs.filter((a) => a.depth === 2).length, 3);
eq('sunburstLayout total', sbTree.total, 9);
ok('sunburstLayout 外环不超出父级角度',
  sbTree.arcs.filter((a) => a.depth === 2).every((k) => {
    const p = sbTree.arcs.find((a) => a.depth === 1 && a.index === k.index);
    return k.a0 >= p.a0 - 1e-6 && k.a1 <= p.a1 + 1e-6;
  }));
ok('sunburstLayout 外环占比合计 ≈ 总占比', Math.abs(
  sbTree.arcs.filter((a) => a.depth === 2).reduce((s, a) => s + a.share, 0) - 1) < 1e-6);
noNaN('sunburstLayout 正常', sbTree.arcs.flatMap((a) => [a.a0, a.a1, a.share, a.r0, a.r1]));
eq('sunburstLayout 非数组', M.sunburstLayout(null).arcs.length, 0);
eq('annularSectorPath 零跨度', M.annularSectorPath(0, 0, 10, 20, 30, 30), '');
eq('annularSectorPath 外径小于内径不炸', typeof M.annularSectorPath(0, 0, 20, 10, 0, 90), 'string');

// 工具函数
eq('fmtNum(0)', M.fmtNum(0), '0');
eq('fmtNum(999)', M.fmtNum(999), '999');
eq('fmtNum(1234)', M.fmtNum(1234), '1.2K');
eq('fmtNum(3456789)', M.fmtNum(3456789), '3.5M');
eq('fmtNum(2e9)', M.fmtNum(2e9), '2B');
eq('fmtNum(NaN)', M.fmtNum(NaN), '0');
eq('fmtNum(undefined)', M.fmtNum(undefined), '0');
eq('fmtNum(-1500)', M.fmtNum(-1500), '-1.5K');
eq('truncate 短串', M.truncate('abc', 5), 'abc');
eq('truncate 长串加省略号', M.truncate('abcdefgh', 5), 'abcd…');
eq('truncate null', M.truncate(null, 5), '');
ok('shade 提亮变浅', M.shade('#2f6bff', 0.3) !== '#2f6bff');
ok('shade 非法输入原样返回', M.shade('rgb(1,2,3)', 0.3) === 'rgb(1,2,3)');
ok('seriesColors(20) 循环取色', M.seriesColors(20).length === 20 && M.seriesColors(20)[16] === M.CHART_COLORS[0]);
eq('clamp 非法值回落', M.clamp(NaN, 3, 9), 3);
eq('CHART_COLORS 至少 16 色', M.CHART_COLORS.length >= 16, true);
ok('CHART_COLORS 全是 hex', M.CHART_COLORS.every((c) => /^#[0-9a-f]{6}$/i.test(c)));

console.log(`  纯函数断言通过 ${pass} 项`);

// ---------- B. 真实渲染 ----------
console.log('\n— B. Preact 真实渲染 —');
const before = pass;

// 1) 正常数据：旭日 + 卡片标题
const sbHtml = renderToString(
  h(M.StatCard, { title: '文章分类构成', sub: '内环为分类，外环为标签', legend: ['分类A', '分类B'] },
    h(M.SunburstChart, {
      data: [
        { label: '分类A', value: 6, children: [{ label: '标签x', value: 4 }, { label: '标签y', value: 2 }] },
        { label: '分类B', value: 3, children: [{ label: '标签z', value: 3 }] }
      ],
      ariaLabel: '分类构成旭日图'
    }))
);
ok('渲染：卡片标题出现', sbHtml.includes('文章分类构成'));
ok('渲染：卡片副标题出现', sbHtml.includes('内环为分类，外环为标签'));
ok('渲染：图例出现', sbHtml.includes('分类A') && sbHtml.includes('分类B'));
ok('渲染：旭日图 aria-label 出现', sbHtml.includes('分类构成旭日图'));
ok('渲染：圆心合计出现', sbHtml.includes('合计'));
ok('渲染：产出 svg 路径', sbHtml.includes('<path'));
ok('渲染：class 前缀为 sc-', sbHtml.includes('class="sc-card"'));

// 2) 空数据：每个组件都要给优雅空态
const cases = [
  ['SunburstChart', M.SunburstChart, { data: [] }, '暂无可统计的数据'],
  ['MatrixHeat', M.MatrixHeat, { rows: [], cols: [], values: [] }, '暂无交叉统计'],
  ['StreamArea', M.StreamArea, { series: [] }, '暂无时间序列数据'],
  ['BubbleMatrix', M.BubbleMatrix, { points: [] }, '暂无可绘制的数据点'],
  ['RankBars', M.RankBars, { items: [] }, '暂无排名数据'],
  ['RadarChart', M.RadarChart, { axes: [] }, '暂无维度数据'],
  ['GaugeRings', M.GaugeRings, { items: [] }, '暂无进度数据']
];
for (const [name, Comp, props, expect] of cases) {
  const html = renderToString(h(Comp, props));
  ok(`空数据：${name} 显示空态文案`, html.includes(expect), html.slice(0, 120));
  ok(`空数据：${name} 不抛异常且渲染出容器`, html.includes('sc-empty'));
}

// 3) 单点数据
const oneHtml = renderToString(h('div', null,
  h(M.StreamArea, { series: [{ label: '唯一系列', points: [{ x: '2026-10', y: 3 }] }], height: 200 }),
  h(M.BubbleMatrix, { points: [{ x: 5, y: 5, size: 5, label: '唯一项目' }], xLabel: 'X轴', yLabel: 'Y轴', sizeLabel: '体量', height: 240 }),
  h(M.RankBars, { items: [{ label: '唯一条目', value: 9 }] }),
  h(M.RadarChart, { axes: [{ label: '唯一维度', value: 4 }], height: 240 }),
  h(M.GaugeRings, { items: [{ label: '唯一指标', value: 1, max: 2 }], height: 160 }),
  h(M.MatrixHeat, { rows: ['行一'], cols: ['列一'], values: [[3]], rowLabel: '纵轴', colLabel: '横轴', height: 200 })
));
ok('单点：StreamArea 渲染出系列名', oneHtml.includes('唯一系列'));
ok('单点：BubbleMatrix 渲染出轴标题', oneHtml.includes('X轴') && oneHtml.includes('Y轴'));
ok('单点：BubbleMatrix 渲染出标签', oneHtml.includes('唯一项目'));
ok('单点：RankBars 渲染出条目', oneHtml.includes('唯一条目'));
ok('单点：RadarChart 渲染出维度', oneHtml.includes('唯一维度'));
ok('单点：GaugeRings 渲染出百分比', oneHtml.includes('50%'));
ok('单点：MatrixHeat 渲染出交叉标签', oneHtml.includes('行一') && oneHtml.includes('列一'));

// 4) 全 0 数据
const zeroHtml = renderToString(h('div', null,
  h(M.SunburstChart, { data: [{ label: '零分类', value: 0 }] }),
  h(M.StreamArea, { series: [{ label: '零系列', points: [{ x: 'a', y: 0 }, { x: 'b', y: 0 }] }] }),
  h(M.MatrixHeat, { rows: ['r'], cols: ['c'], values: [[0]] }),
  h(M.RadarChart, { axes: [{ label: '零维度', value: 0 }, { label: '零维度2', value: 0 }] }),
  h(M.GaugeRings, { items: [{ label: '零指标', value: 0, max: 0 }] }),
  h(M.RankBars, { items: [{ label: '零条目', value: 0 }] }),
  h(M.BubbleMatrix, { points: [{ x: 0, y: 0, size: 0, label: '零点' }] })
));
ok('全 0：不抛异常', zeroHtml.length > 500);
ok('全 0：旭日图走空态', zeroHtml.includes('暂无可统计的数据'));
ok('全 0：RankBars 仍然画出轨道', zeroHtml.includes('零条目'));
ok('全 0：GaugeRings 显示 0%', zeroHtml.includes('0%'));
ok('全 0：RadarChart 不产生 NaN', !zeroHtml.includes('NaN'));
ok('全 0：BubbleMatrix 不产生 NaN', !zeroHtml.includes('NaN'));

// 5) 看板布局 + 多维组合
const boardHtml = renderToString(h(M.StatBoard, { ariaLabel: '内容统计看板' },
  h(M.StatCard, { title: '发文趋势', sub: '按月堆叠', wide: true, note: '数据来源：posts' },
    h(M.StreamArea, { series: [
      { label: '技术', points: [{ x: '2026-08', y: 3 }, { x: '2026-09', y: 5 }] },
      { label: '生活', points: [{ x: '2026-09', y: 2 }, { x: '2026-10', y: 4 }] }
    ] })),
  h(M.StatCard, { title: '语言 × 星标', legend: [{ label: 'JS', value: 10 }] },
    h(M.MatrixHeat, { rows: ['JS', 'Py'], cols: ['<100', '100+'], values: [[4, 2], [1, 6]], rowLabel: '语言', colLabel: '星标区间' })),
  h(M.StatCard, { title: '维度雷达' }, h(M.RadarChart, { axes: [{ label: '前端', value: 8 }, { label: '后端', value: 5 }, { label: 'AI', value: 9 }] }))
));
ok('看板：aria-label 出现', boardHtml.includes('内容统计看板'));
ok('看板：三个卡片都渲染', (boardHtml.match(/class="sc-card/g) || []).length >= 3);
ok('看板：wide 卡片带 sc-card-wide', boardHtml.includes('sc-card-wide'));
ok('看板：note 出现', boardHtml.includes('数据来源：posts'));
ok('看板：图例数值出现', boardHtml.includes('JS'));
ok('看板：热力矩阵轴标题出现', boardHtml.includes('语言') && boardHtml.includes('星标区间'));
ok('看板：输出中无 NaN', !boardHtml.includes('NaN'));

// 6) 样式注入（useChartCss 的副作用）
//    Preact 的 useEffect 走 debounceRendering（Promise.then）异步执行，
//    所以这里必须等一个宏任务，才能看到注入结果。
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
await tick(30);
ok('样式：<style id="stat-charts-css"> 已注入 head',
  documentShim.head.childNodes.some((n) => n.getAttribute('id') === 'stat-charts-css'));
ok('样式：注入了 .sc-board 规则',
  documentShim.head.textContent.includes('.sc-board'));
ok('样式：注入了 prefers-reduced-motion 兜底',
  documentShim.head.textContent.includes('prefers-reduced-motion'));

// 7) 入场动画：同一个已挂载的组件，等待 rAF 后应从初始态长到终态（scale(1)）
//    （每次都重新 render 会重新挂载，永远停在初始态，所以这里只挂一次再重复序列化）
const animHost = documentShim.createElement('div');
render(h(M.StatCard, { title: '入场动画' },
  h(M.SunburstChart, { data: [{ label: 'A', value: 3 }, { label: 'B', value: 2 }] })), animHost);
const animBefore = serialize(animHost);
ok('动画：初次渲染处于初始态', animBefore.includes('scale(0.72)'));
await tick(60);
const animAfter = serialize(animHost);
ok('动画：等待后进入终态 scale(1)', animAfter.includes('scale(1)'),
  animAfter.includes('scale(0.72)') ? '仍停在初始态' : animAfter.slice(0, 200));
ok('动画：终态不再出现初始 scale', !animAfter.includes('scale(0.72)'));

const renderPass = pass - before;
console.log(`  渲染断言通过 ${renderPass} 项`);

// ---------- 汇总 ----------
console.log('');
if (failures.length) {
  console.log(`失败 ${failures.length} 项：`);
  failures.forEach((f) => console.log(`  ✗ ${f}`));
  process.exitCode = 1;
} else {
  console.log(`全部通过：${pass} 项断言（纯函数 ${before} + 渲染 ${renderPass}）`);
}
if (!existsSync(SRC)) console.log('（警告：源文件不存在）');
