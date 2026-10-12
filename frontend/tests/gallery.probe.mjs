// gallery.probe.mjs —— 图展页「图片 / 动态壁纸两区 + 折叠展示」的探针
//
// 目的（2026-10-12 用户要求）：
//   1) 图展拆成「静态图片」与「动态壁纸」两个区，各自独立渲染；
//   2) 两个区都**不一股脑全铺**：默认只显示 4 行（列数 × 4 张），
//      超出部分要点「查看更多」才出现，展开后按钮变「收起」；
//   3) 动态壁纸渲染成 <video>（静音循环），不是 <img>。
//
// 做法与 favorites.probe.mjs 同款：最小 DOM shim + 真 preact 渲染 + 字符串断言。

import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { writeFileSync, unlinkSync, readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '../src');

// ---------------------------------------------------------------- 最小 DOM

const EVENT_TYPES = ['click', 'input', 'change', 'submit', 'keydown', 'keyup', 'error',
  'load', 'pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup', 'mouseenter', 'mouseleave'];

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr']);

class E {
  constructor(tag) {
    this.localName = tag; this.tagName = String(tag).toUpperCase();
    this.childNodes = []; this.attributes = {}; this.parentNode = null;
    this.style = {}; this.dataset = {}; this._listeners = {}; this.nodeType = 1;
    // preact 靠 `'onclick' in element` 判断事件名是否要小写。
    // 真 DOM 里这些属性始终存在，shim 也必须声明，否则 preact 会注册成
    // 'Click' 键、而派发时去找 'click' 键，导致 click 永远不触发。
    for (const t of EVENT_TYPES) this[`on${t}`] = null;
  }
  get firstChild() { return this.childNodes[0] || null; }
  appendChild(c) { c.parentNode = this; this.childNodes.push(c); return c; }
  insertBefore(c, ref) {
    const i = ref ? this.childNodes.indexOf(ref) : -1;
    if (i < 0) this.childNodes.push(c); else this.childNodes.splice(i, 0, c);
    c.parentNode = this; return c;
  }
  removeChild(c) { const i = this.childNodes.indexOf(c); if (i >= 0) this.childNodes.splice(i, 1); c.parentNode = null; return c; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  replaceChild(n, o) { this.insertBefore(n, o); this.removeChild(o); return o; }
  setAttribute(k, v) { this.attributes[k] = String(v); if (k.startsWith('data-')) this.dataset[k.slice(5)] = String(v); }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; }
  removeAttribute(k) { delete this.attributes[k]; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k); }
  set textContent(v) { this.childNodes = []; if (v != null && v !== '') this.appendChild(new T(String(v))); }
  get textContent() { return this.childNodes.map((c) => c.textContent ?? '').join(''); }
  get innerHTML() { return this.childNodes.map(serialize).join(''); }
  set innerHTML(v) { this.childNodes = []; if (v) this.appendChild(new T(String(v))); }
  addEventListener(t, fn) { (this._listeners[t] || (this._listeners[t] = [])).push(fn); }
  removeEventListener(t, fn) { const a = this._listeners[t]; if (!a) return; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }
  querySelector(sel) { return find(this, sel); }
  querySelectorAll(sel) { const out = []; walkAll(this, sel, out); return out; }
  contains(n) { for (let p = n; p; p = p.parentNode) if (p === this) return true; return false; }
}
class T {
  constructor(d) { this.data = String(d); this.nodeType = 3; this.parentNode = null; }
  get textContent() { return this.data; }
  set textContent(v) { this.data = String(v); }
}
class D extends E {
  constructor() { super('#document'); this.nodeType = 9; this.documentElement = new E('html'); this.head = new E('head'); this.body = new E('body'); }
  createElement(t) { return new E(t); }
  createElementNS(_ns, t) { return new E(t); }
  createTextNode(d) { return new T(d); }
  createComment(d) { return new T(''); void d; }
}

function match(node, sel) {
  const s = sel.trim();
  if (s.includes(',')) return s.split(',').some((x) => match(node, x));
  if (s.startsWith('.')) return (node.attributes?.class || '').split(/\s+/).includes(s.slice(1));
  if (s.startsWith('#')) return node.attributes?.id === s.slice(1);
  if (s.startsWith('[')) { const k = s.slice(1, -1).split('=')[0]; return node.hasAttribute?.(k) ?? false; }
  return node.localName === s.toLowerCase();
}
function find(root, sel) {
  for (const c of root.childNodes) {
    if (c.nodeType === 1) { if (match(c, sel)) return c; const r = find(c, sel); if (r) return r; }
  }
  return null;
}
function walkAll(root, sel, out) {
  for (const c of root.childNodes) {
    if (c.nodeType === 1) { if (match(c, sel)) out.push(c); walkAll(c, sel, out); }
  }
}
function serialize(n) {
  if (n.nodeType === 3) return n.data;
  const attrs = Object.entries(n.attributes || {}).map(([k, v]) => ` ${k}="${String(v).replace(/"/g, '&quot;')}"`).join('');
  if (VOID.has(n.localName)) return `<${n.localName}${attrs}>`;
  return `<${n.localName}${attrs}>${n.childNodes.map(serialize).join('')}</${n.localName}>`;
}

function installDom() {
  const doc = new D();
  const win = {
    document: doc, navigator: { userAgent: 'node' }, innerWidth: 1440, innerHeight: 900,
    location: { href: 'http://localhost/gallery', pathname: '/gallery', search: '' },
    addEventListener() {}, removeEventListener() {},
    // 桌面 3 列：三个断点查询都不命中
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: (fn) => setTimeout(fn, 0), cancelAnimationFrame: clearTimeout,
    setTimeout, clearTimeout, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    URL, fetch: () => Promise.reject(new Error('offline')),
    scrollTo() {}, scrollY: 0
  };
  globalThis.window = win;
  globalThis.document = doc;
  try { Object.defineProperty(globalThis, 'navigator', { value: win.navigator, configurable: true, writable: true }); }
  catch { /* 忽略 */ }
  globalThis.HTMLElement = E;
  globalThis.Element = E;
  globalThis.Node = E;
  globalThis.Event = class { constructor(t) { this.type = t; } };
  globalThis.CustomEvent = globalThis.Event;
  globalThis.requestAnimationFrame = win.requestAnimationFrame;
  globalThis.cancelAnimationFrame = win.cancelAnimationFrame;
  globalThis.localStorage = win.localStorage;
  return doc;
}

// ---------------------------------------------------------------- 构建

const IMAGE_COUNT = 30;      // 图片给 30 张：远超 3 列 × 4 行 = 12，必然触发折叠
const WALL_COUNT = 9;        // 壁纸给 9 个：超过 12 吗？不超过，所以壁纸区不该出现「查看更多」

async function loadModule() {
  const esbuild = await import('esbuild');

  const authStub = `
export function useAuth() {
  const role = globalThis.__GL_PROBE_ROLE__ || 'guest';
  return {
    session: null, user: null, profile: null, loading: false,
    isAuthenticated: role === 'admin', isAdmin: role === 'admin',
    signIn: async () => {}, signUp: async () => {}, signOut: async () => {}
  };
}
export function AuthProvider({ children }) { return children; }
`;

  const apiStub = `
const images = Array.from({ length: ${IMAGE_COUNT} }, (_, i) => ({
  id: 'img-' + i,
  title: '图片' + i,
  description: '',
  captured_at: '2026-10-0' + ((i % 9) + 1),
  sort_order: 0,
  is_public: true,
  image: { url: 'http://img.test/' + i + '.jpg', width: 1200, height: 800, alt: '图片' + i }
}));
const walls = Array.from({ length: ${WALL_COUNT} }, (_, i) => ({
  id: 'wall-' + i,
  title: '壁纸' + i,
  description: '',
  format: 'mp4',
  mime_type: 'video/mp4',
  size: 20000000,
  duration: 15,
  width: 3840,
  height: 2160,
  file_url: 'http://wall.test/' + i + '.mp4',
  is_public: true,
  sort_order: 0
}));
export const api = {
  listGallery: async () => ({ items: images, count: images.length }),
  listWallpapers: async () => ({ items: walls, count: walls.length }),
  listAssets: async () => ({ items: [] }),
  // 动态壁纸的 <video src> 走这个：视频标签带不了 Authorization 头，
  // 所以真实实现会拼上 ?token=（withMediaToken）。探针里只要给个稳定 URL 即可。
  wallpaperFileUrl: (id) => 'http://wall.test/' + id + '.mp4',
  createGalleryItem: async () => ({}),
  updateGalleryItem: async () => ({}),
  deleteGalleryItem: async () => ({ deleted: true }),
  updateWallpaper: async () => ({}),
  deleteWallpaper: async () => ({ deleted: true })
};
export const uploadAsset = async () => ({ id: 'a1', public_url: 'http://img.test/a1.jpg' });
export const uploadWallpaper = async () => ({ id: 'w1' });
export default api;
`;

  const stubPlugin = {
    name: 'stubs',
    setup(b) {
      b.onResolve({ filter: /lib\/auth\.jsx$/ }, () => ({ path: 'auth-stub', namespace: 'stub' }));
      b.onResolve({ filter: /lib\/api\.js$/ }, () => ({ path: 'api-stub', namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, (args) => ({
        contents: args.path === 'auth-stub' ? authStub : apiStub, loader: 'js'
      }));
    }
  };

  const source = `
import { h, render } from 'preact';
import { Gallery } from './routes/Gallery.jsx';
export { h, render, Gallery };
`;
  const built = await esbuild.build({
    stdin: { contents: source, loader: 'js', resolveDir: SRC, sourcefile: 'gl-entry.js' },
    bundle: true, write: false, format: 'esm', target: 'es2020',
    jsx: 'automatic', jsxImportSource: 'preact',
    loader: { '.css': 'empty', '.js': 'jsx', '.jsx': 'jsx' },
    plugins: [stubPlugin],
    define: {
      'import.meta.env.VITE_API_BASE_URL': '"http://127.0.0.1:9"',
      'import.meta.env.VITE_SUPABASE_URL': '""',
      'import.meta.env.VITE_SUPABASE_ANON_KEY': '""'
    },
    logLevel: 'silent'
  });
  const out = resolve(tmpdir(), `gl-probe-${process.pid}.mjs`);
  writeFileSync(out, built.outputFiles[0].text, 'utf8');
  try { return await import(`${pathToFileURL(out).href}?t=${Date.now()}`); }
  finally { try { unlinkSync(out); } catch { /* 忽略 */ } }
}

// ---------------------------------------------------------------- 断言

let pass = 0; const fails = [];
function ok(name, cond, extra) {
  if (cond) { pass += 1; return; }
  fails.push(`${name}${extra ? ` —— ${extra}` : ''}`);
}
const count = (html, re) => (html.match(re) || []).length;

// ---------------------------------------------------------------- 主流程

const doc = installDom();
const M = await loadModule();
const { h, render, Gallery } = M;

globalThis.__GL_PROBE_ROLE__ = 'guest';
const host = doc.createElement('div');
doc.body.appendChild(host);
render(h(Gallery, {}), host);
await new Promise((r) => setTimeout(r, 600));
const html = serialize(host);

// --- 两个分区
ok('渲染出「静态图片」分区', html.includes('静态图片'), html.slice(0, 300));
ok('渲染出「动态壁纸」分区', html.includes('动态壁纸'));
ok('两个分区用各自的数量角标', html.includes(`${IMAGE_COUNT} 张`) && html.includes(`${WALL_COUNT} 个`));

// --- 折叠：整齐等高行（justified rows）按**行**折叠，默认最多 4 行。
// 每行放几张由图片宽高比与目标行高决定，所以这里断言「行数」而不是「张数」。
const imgTags = count(html, /<img /g);
const rowTags = count(html, /class="gl-row"/g);
ok('静态图片默认最多渲染 4 行', rowTags === 4, `实际 ${rowTags} 行`);
ok('4 行没有铺满全部 30 张（有折叠）', imgTags > 0 && imgTags < IMAGE_COUNT, `实际 ${imgTags} 张`);
ok('图片超出部分有「查看更多」按钮',
  new RegExp(`查看更多（还有 ${IMAGE_COUNT - imgTags} 张）`).test(html),
  `没有找到「查看更多（还有 ${IMAGE_COUNT - imgTags} 张）」`);
ok('未展开时不该出现最后一张图片的 URL', !html.includes(`http://img.test/${IMAGE_COUNT - 1}.jpg`),
  `第 ${IMAGE_COUNT} 张（索引 ${IMAGE_COUNT - 1}）不该被渲染`);

// --- 壁纸：9 个 < 12，不该出现折叠按钮
const videoTags = count(html, /<video /g);
ok('动态壁纸渲染成 <video>（不是 <img>）', videoTags === WALL_COUNT, `实际 ${videoTags} 个 video`);
ok('壁纸数量未超过一行阈值时没有「查看更多」', !/查看更多（还有 \d+ 个）/.test(html));
ok('视频卡片带静音循环属性', /<video [^>]*muted/.test(html) && /<video [^>]*loop/.test(html));

// --- 点击「查看更多」后应展开全部
const moreBtn = find(host, '.gl-more-btn');
ok('找到「查看更多」按钮元素', !!moreBtn);
if (moreBtn) {
  // preact 的监听器是它自己的包装函数，必须 .call(元素) 调用（内部依赖 this.l）。
  const clickFns = Object.values(moreBtn._listeners).flat();
  const ev = { type: 'click', currentTarget: moreBtn, target: moreBtn, stopPropagation() {}, preventDefault() {} };
  for (const fn of clickFns) fn.call(moreBtn, ev);
  await new Promise((r) => setTimeout(r, 400));
  const expanded = serialize(host);
  const imgAfter = count(expanded, /<img /g);
  ok('展开后渲染出全部 30 张图片', imgAfter === IMAGE_COUNT, `实际 ${imgAfter} 张`);
  ok('展开后按钮文字变成「收起」', /收起/.test(expanded));
}

// --- 静态断言：防止以后被改回「一股脑全铺」
const src = readFileSync(resolve(SRC, 'routes/Gallery.jsx'), 'utf8');
ok('Gallery.jsx 保留折叠常量 COLLAPSE_ROWS', /const COLLAPSE_ROWS = \d+/.test(src));
ok('Gallery.jsx 用 justified rows 排版（import justifyRows）', /import \{ justifyRows \}/.test(src));
ok('Gallery.jsx 同时请求 listGallery 与 listWallpapers',
  src.includes('api.listGallery(') && src.includes('api.listWallpapers('));
ok('Gallery.jsx 用 uploadWallpaper 上传视频', /import \{[^}]*uploadWallpaper[^}]*\}/.test(src));

console.log(`\n图展探针：${pass} 过 / ${fails.length} 失败`);
if (fails.length) { fails.forEach((f) => console.log(`  ❌ ${f}`)); process.exitCode = 1; }
else console.log('  ✅ 全部通过');
