// motionFx.probe.mjs —— 全站通用动效组件的离线探针
//
// 覆盖 2026-10-19 新增的通用组件：
//   22 模糊换词 / 32 点赞爆裂 / 33 均衡器 / 35 播放暂停形变 /
//   36 脉冲徽章 / 54 铃铛 / 86 方块波 / 87 Loading 跳字 /
//   110 3D 玻璃立方体 / 155 金丝流场 / 162 粒子文字
//
// 用最小 DOM + 真 preact 渲染，确认 DOM 结构、类名、无障碍语义都在；
// Canvas 组件额外确认画布尺寸与绘制调用。

import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { writeFileSync, unlinkSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '../src');

class T {
  constructor(d) { this.data = String(d); this.nodeType = 3; this.parentNode = null; }
  get textContent() { return this.data; }
  set textContent(v) { this.data = String(v); }
}
class E {
  constructor(tag) {
    this.localName = String(tag).toLowerCase();
    this.tagName = String(tag).toUpperCase();
    this.nodeType = 1;
    this.childNodes = [];
    this.parentNode = null;
    this.attributes = {};
    this.dataset = {};
    this._listeners = {};
    this.style = { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } };
    this.width = 0;
    this.height = 0;
    this._ctx = null;
    this.className = '';
    Object.defineProperty(this, 'className', {
      configurable: true,
      get: () => this.attributes.class || '',
      set: (v) => { this.attributes.class = String(v); }
    });
  }
  appendChild(c) { c.parentNode = this; this.childNodes.push(c); return c; }
  insertBefore(c, ref) {
    c.parentNode = this;
    const i = ref ? this.childNodes.indexOf(ref) : -1;
    if (i < 0) this.childNodes.push(c); else this.childNodes.splice(i, 0, c);
    return c;
  }
  removeChild(c) {
    const i = this.childNodes.indexOf(c);
    if (i >= 0) this.childNodes.splice(i, 1);
    c.parentNode = null;
    return c;
  }
  replaceChildren(...nodes) {
    this.childNodes.forEach((c) => { c.parentNode = null; });
    this.childNodes = [];
    nodes.forEach((c) => this.appendChild(c));
  }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; }
  removeAttribute(k) { delete this.attributes[k]; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k); }
  addEventListener(t, fn) { (this._listeners[t] || (this._listeners[t] = [])).push(fn); }
  removeEventListener(t, fn) {
    const a = this._listeners[t];
    if (a) this._listeners[t] = a.filter((x) => x !== fn);
  }
  get textContent() { return this.childNodes.map((c) => c.textContent ?? '').join(''); }
  set textContent(v) { this.childNodes = []; if (v != null && v !== '') this.appendChild(new T(String(v))); }
  getBoundingClientRect() { return { width: 360, height: 180, left: 0, top: 0, right: 360, bottom: 180 }; }
  getContext() {
    if (this._ctx) return this._ctx;
    const ops = [];
    const canvas = this;
    this._ctx = {
      ops,
      setTransform(scaleX = 1, _skewY = 0, _skewX = 0, scaleY = 1) {
        canvas.width = Math.round(360 * scaleX);
        canvas.height = Math.round(180 * scaleY);
      },
      clearRect() {},
      fillRect() {},
      fillText() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
      fill() {},
      arc() {},
      createLinearGradient() { return { addColorStop() {} }; },
      measureText() { return { width: 20 }; },
      getImageData() { return { data: new Uint8ClampedArray(360 * 180 * 4) }; }
    };
    return this._ctx;
  }
  querySelector(sel) { return findChild(this, sel); }
  querySelectorAll(sel) { return findChildren(this, sel); }
}
class D extends E {
  constructor() {
    super('#document');
    this.nodeType = 9;
    this.documentElement = new E('html');
    this.head = new E('head');
    this.body = new E('body');
    this.hidden = false;
  }
  createElement(t) { return new E(t); }
  createElementNS(_ns, t) { return new E(t); }
  createTextNode(d) { return new T(d); }
  createComment() { return new T(''); }
  getElementById(id) { return find(this, `#${id}`); }
}
function matches(n, sel) {
  const part = sel.trim().split(/\s+/).slice(-1)[0] || '';
  return part.startsWith('.')
    ? part.slice(1).split('.').every((name) => String(n.getAttribute?.('class') || '').split(/\s+/).includes(name))
    : n.localName === part.toLowerCase();
}
function find(root, sel) {
  for (const c of root.childNodes) {
    if (c.nodeType === 1) {
      if (matches(c, sel)) return c;
      const r = find(c, sel);
      if (r) return r;
    }
  }
  return null;
}
function findChild(root, sel) {
  for (const c of root.childNodes) {
    if (c.nodeType === 1) {
      if (matches(c, sel)) return c;
      const r = findChild(c, sel);
      if (r) return r;
    }
  }
  return null;
}
function findChildren(root, sel) {
  const out = [];
  walkChild(root, sel, out);
  return out;
}
function walkChild(root, sel, out) {
  for (const c of root.childNodes) {
    if (c.nodeType !== 1) continue;
    if (matches(c, sel)) out.push(c);
    walkChild(c, sel, out);
  }
}
function findAll(root, sel) {
  const out = [];
  walk(root, sel, out);
  return out;
}
function walk(root, sel, out) {
  for (const c of root.childNodes) {
    if (c.nodeType !== 1) continue;
    if (matches(c, sel)) out.push(c);
    walk(c, sel, out);
  }
}
function text(n) { return n?.textContent || ''; }

let pass = 0;
const fails = [];
function ok(name, cond, extra = '') {
  if (cond) { pass += 1; console.log(`  ✅ ${name}`); }
  else { fails.push(`${name}${extra ? ` —— ${extra}` : ''}`); console.log(`  ❌ ${name}${extra ? ` —— ${extra}` : ''}`); }
}

function installDom() {
  const doc = new D();
  globalThis.document = doc;
  globalThis.window = {
    document: doc,
    devicePixelRatio: 1,
    addEventListener() {},
    removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
  };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#4a6cf7' });
  globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; }
    observe() { this.cb([{ isIntersecting: true }]); }
    disconnect() {}
  };
  return doc;
}

async function load() {
  const esbuild = await import('esbuild');
  const built = await esbuild.build({
    stdin: {
      contents: `
export {
  CrossFadeWords, BurstLike, Equalizer, PlayPauseMorph, PulseIcon,
  BellPulse, SquareWave, LoadingLetters, GlassCube, SilkField, ParticleText,
  GenreRank, DonutShare, KpiCard, ConfettiBurst
} from './components/MotionFx.jsx';
export { h, render } from 'preact';
`,
      loader: 'js',
      resolveDir: SRC,
      sourcefile: 'motion-entry.js'
    },
    bundle: true,
    write: false,
    format: 'esm',
    target: 'es2020',
    jsx: 'automatic',
    jsxImportSource: 'preact',
    logLevel: 'silent'
  });
  const out = resolve(tmpdir(), `motion-fx-probe-${process.pid}.mjs`);
  writeFileSync(out, built.outputFiles[0].text, 'utf8');
  try { return await import(`${pathToFileURL(out).href}?t=${Date.now()}`); }
  finally { try { unlinkSync(out); } catch { /* 忽略 */ } }
}

// 保持一条可执行的「组件 → 使用位置」清单，防止组件库越加越多却没人接。
const WIRING = [
  ['frontend/src/routes/Home.jsx', ['GlassCube', 'SilkField', 'ParticleText']],
  ['frontend/src/routes/Posts.jsx', ['CrossFadeWords']],
  ['frontend/src/routes/Music.jsx', ['Equalizer', 'GenreRank']],
  ['frontend/src/routes/MusicPlayer.jsx', ['Equalizer', 'PlayPauseMorph']],
  ['frontend/src/components/MiniPlayer.jsx', ['BurstLike', 'Equalizer', 'PlayPauseMorph']],
  ['frontend/src/components/NotificationBell.jsx', ['BellPulse']],
  ['frontend/src/components/StateView.jsx', ['LoadingLetters', 'SquareWave']],
  ['frontend/src/components/FavoriteButton.jsx', ['BurstLike']],
  ['frontend/src/routes/Timeline.jsx', ['tl-live-line']],
  ['frontend/src/routes/GraphHub.jsx', ['DonutShare', 'KpiCard', 'LiveFeed']],
  ['frontend/src/routes/Coop.jsx', ['ConfettiBurst']]
];

async function checkWiring() {
  const { readFileSync } = await import('node:fs');
  const root = resolve(HERE, '../..');
  for (const [file, names] of WIRING) {
    const text = readFileSync(resolve(root, file), 'utf8');
    ok(`接入 ${file.split('/').pop()}`, names.every((n) => text.includes(n)), names.filter((n) => !text.includes(n)).join(', '));
  }
}

const doc = installDom();
await checkWiring();
const M = await load();
const host = doc.createElement('div');
doc.body.appendChild(host);
const render = (vnode) => M.render(vnode, host);

console.log('\n通用动效组件探针\n' + '='.repeat(52));

render(M.h(M.CrossFadeWords, { words: ['读书', '听歌'] }));
ok('22 模糊换词渲染首词', text(find(host, '.mfx-cf')) === '读书');

render(M.h(M.BurstLike, { active: true }));
ok('32 点赞有 on 状态', !!host.querySelector('.mfx-like.on'));
ok('32 点赞有 8 个爆裂粒子', host.querySelectorAll('.mfx-like i').length === 8);

render(M.h(M.Equalizer, { playing: true, bars: 7 }));
ok('33 均衡器 7 根柱', host.querySelectorAll('.mfx-eq i').length === 7);
ok('33 播放时带 on 状态', !!host.querySelector('.mfx-eq.on'));

render(M.h(M.PlayPauseMorph, { playing: true }));
ok('35 播放暂停形变按钮', !!host.querySelector('.mfx-pp.playing'));

render(M.h(M.PulseIcon, { count: 12 }, 'RSS'));
ok('36 脉冲徽章显示数量', text(find(host, '.mfx-pulse-dot')) === '12');

render(M.h(M.BellPulse, { count: 1, shaking: true }, 'bell'));
ok('54 铃铛有摇晃类', !!host.querySelector('.mfx-bell.shake'));
ok('54 铃铛有红点', !!host.querySelector('.mfx-bell-dot'));

render(M.h(M.SquareWave));
ok('86 方块波 9 格', host.querySelectorAll('.mfx-square i').length === 9);

render(M.h(M.LoadingLetters, { text: 'Loading' }));
ok('87 Loading 跳字 7 字母', host.querySelectorAll('.mfx-loading-letters i').length === 7);

render(M.h(M.GlassCube, { faces: ['一', '二', '三', '四', '五', '六'] }));
ok('110 玻璃立方体 6 面', findAll(host, '.mfx-cube span').length === 6);

render(M.h(M.SilkField, { height: 180 }));
const silk = find(host, '.mfx-silk');
ok('155 金丝流场挂载 canvas', !!silk);
await new Promise((r) => setTimeout(r, 80));
ok('155 canvas 尺寸有效', silk?.width > 0 && silk?.height > 0, `${silk?.width}x${silk?.height}`);

render(M.h(M.ParticleText, { text: 'Dora', height: 180 }));
const particles = find(host, '.mfx-particles');
ok('162 粒子文字挂载 canvas', !!particles);
await new Promise((r) => setTimeout(r, 80));
ok('162 canvas 尺寸有效', particles?.width > 0 && particles?.height > 0, `${particles?.width}x${particles?.height}`);

render(M.h(M.GenreRank, {
  items: [
    { label: '流行', value: 12 },
    { label: '摇滚', value: 7 },
    { label: '爵士', value: 3 }
  ]
}));
ok('124 曲风排行按真实计数排序', text(host.querySelector('.mfx-rank-label')) === '流行');
ok('124 曲风排行有 3 行', host.querySelectorAll('.mfx-rank-row').length === 3);

render(M.h(M.DonutShare, {
  items: [
    { label: '博客', value: 60 },
    { label: '音乐', value: 40 }
  ]
}));
ok('171 媒体占比环形图有两段', host.querySelectorAll('.mfx-donut-seg').length === 2);
ok('171 环形图中心总数正确', text(host.querySelector('.mfx-donut-center b')) === '100');

render(M.h(M.KpiCard, { label: '文章', value: 321, suffix: '' }));
await new Promise((r) => setTimeout(r, 80));
ok('175 指标卡渲染标签', text(host.querySelector('.mfx-kpi-label')) === '文章');
ok('175 指标卡数字滚动到真实值', text(host.querySelector('.mfx-kpi strong')) === '321');

render(M.h(M.ConfettiBurst, { active: true, count: 12 }));
ok('148 礼炮有 12 片彩带', host.querySelectorAll('.mfx-confetti i').length === 12);
ok('148 礼炮只在 active 时播放', !!host.querySelector('.mfx-confetti.on'));

M.render(null, host);
console.log('\n' + '='.repeat(52));
console.log(`结果：${pass} 过 / ${fails.length} 失败`);
if (fails.length) {
  console.log(fails.map((f) => `  - ${f}`).join('\n'));
  process.exitCode = 1;
}
process.exit(fails.length ? 1 : 0);
