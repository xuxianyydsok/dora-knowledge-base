// heroCarousel.probe.mjs —— 首页轮播「后台可配置」的探针（2026-10-13）
//
// 目的（用户要求）：
//   1) 首页轮播优先用站长在后台配置的内容（/api/hero/slides）；
//   2) 没配置 / 接口失败时**回退内置 18 张图**，首页永远不为空；
//   3) 配置项可以是图片，也可以是视频；视频**静音循环自动播**，
//      并且有静音开关（用户要求「可以静音也可以播放那个音乐」）；
//   4) 管理端能从图展素材里挑选加入 / 移除 / 上下移动 / 开关启用与声音。
//
// 做法与 gallery.probe.mjs 同款：最小 DOM shim + 真 preact 渲染 + 字符串断言。
// 零依赖（只用 Node 内置 + esbuild），可离线重复跑。

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
    // preact 写自定义属性（--ld-interval 这类）走 style.setProperty，
    // 普通属性走 style[key] = …，shim 两样都要支持。
    this.style = { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } };
    this.dataset = {}; this._listeners = {}; this.nodeType = 1;
    for (const t of EVENT_TYPES) this[`on${t}`] = null;
    // <video> 的媒体属性：真 DOM 上始终存在，shim 也要有，
    // 否则 HeroCarousel 里的 el.muted = … 会静默写到一个不存在的字段上。
    // autoPlay 是**驼峰属性**（不是 autoplay）：preact 用 `'autoPlay' in el`
    // 判断该写属性还是写 attribute，shim 少了它就会退化成写 attribute。
    this.muted = false; this.paused = true; this.autoPlay = false;
  }
  get firstChild() { return this.childNodes[0] || null; }
  appendChild(c) { c.parentNode = this; this.childNodes.push(c); return c; }
  insertBefore(c, ref) {
    c.parentNode = this;
    const i = this.childNodes.indexOf(ref);
    if (i >= 0) this.childNodes.splice(i, 0, c); else this.childNodes.push(c);
    return c;
  }
  removeChild(c) { const i = this.childNodes.indexOf(c); if (i >= 0) this.childNodes.splice(i, 1); c.parentNode = null; return c; }
  remove() { this.parentNode?.removeChild(this); }
  getAttribute(k) { return this.attributes[k] ?? null; }
  setAttribute(k, v) { this.attributes[k] = String(v); }
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
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
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
    location: { href: 'http://localhost/', pathname: '/', search: '' },
    addEventListener() {}, removeEventListener() {},
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

// 后台配置的三条：两张图 + 一段视频（视频默认静音）
const HERO_ITEMS = [
  { id: 'h1', source: 'asset', label: '配置图一', media_url: 'http://cdn.test/one.jpg', media_type: 'image', media_public: true, muted: true },
  { id: 'h2', source: 'wallpaper', label: '配置视频', media_url: 'http://cdn.test/mv.mp4', media_type: 'video', media_public: true, muted: true },
  { id: 'h3', source: 'asset', label: '配置图二', media_url: 'http://cdn.test/two.jpg', media_type: 'image', media_public: true, muted: true }
];

// 只构建一次（esbuild 每次构建都要几十秒），场景差异通过 globalThis 开关传给桩。
let modPromise = null;
function loadModule() {
  if (!modPromise) modPromise = buildModule();
  return modPromise;
}

async function buildModule() {
  const esbuild = await import('esbuild');

  const apiStub = `
export const api = {
  listHeroSlides: async () => {
    if (globalThis.__HERO_FAIL__) throw new Error('接口挂了');
    const items = globalThis.__HERO_ITEMS__ || [];
    return { items, count: items.length };
  },
  getSiteSettings: async () => {
    if (globalThis.__SITE_SETTINGS_FAIL__) throw new Error('摘要接口挂了');
    return { hero_subtitle: { text: globalThis.__HERO_SUBTITLE__ || '' } };
  },
  listGallery: async () => ({ items: [
    { id: 'g1', asset_id: 'a1', title: '图展图一', image: { url: 'http://cdn.test/g1.jpg' } }
  ] }),
  listWallpapers: async () => ({ items: [
    { id: 'w1', title: '图展视频', file_url: 'http://cdn.test/w1.mp4', is_public: true }
  ] }),
  addHeroSlide: async () => ({}),
  updateHeroSlide: async () => ({}),
  deleteHeroSlide: async () => ({}),
  reorderHeroSlides: async () => ({ updated: 1 }),
  wallpaperFileUrl: (id) => 'http://cdn.test/' + id + '.mp4'
};
// Gallery.jsx 还 import 了这两个上传函数（本探针不测上传，给个空实现即可）
export const uploadAsset = async () => ({ id: 'a1', public_url: 'http://cdn.test/a1.jpg' });
export const uploadWallpaper = async () => ({ id: 'w1' });
export default api;
`;

  // Gallery.jsx 还依赖 useAuth（管理端判断），这里给个恒为管理员的桩
  const authStub = `
export function useAuth() {
  return { session: null, user: null, profile: null, loading: false,
    isAuthenticated: true, isAdmin: true,
    signIn: async () => {}, signUp: async () => {}, signOut: async () => {} };
}
export function AuthProvider({ children }) { return children; }
`;

  const stubPlugin = {
    name: 'stubs',
    setup(b) {
      b.onResolve({ filter: /lib\/api\.js$/ }, () => ({ path: 'api-stub', namespace: 'stub' }));
      b.onResolve({ filter: /lib\/auth\.jsx$/ }, () => ({ path: 'auth-stub', namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, (args) => ({
        contents: args.path === 'auth-stub' ? authStub : apiStub, loader: 'js'
      }));
    }
  };

  const source = `
import { h, render } from 'preact';
import { HeroCarousel } from './components/HeroCarousel.jsx';
import { HeroDrawer } from './routes/Gallery.jsx';
export { h, render, HeroCarousel, HeroDrawer };
`;
  const built = await build({
    stdin: { contents: source, loader: 'js', resolveDir: SRC, sourcefile: 'hero-entry.js' },
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
  const out = resolve(tmpdir(), `hero-probe-${process.pid}.mjs`);
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

// —— ① 有后台配置：用配置内容，不用内置图
{
  const M = await loadModule();
  globalThis.__HERO_ITEMS__ = HERO_ITEMS;
  globalThis.__HERO_FAIL__ = false;
  globalThis.__SITE_SETTINGS_FAIL__ = false;
  globalThis.__HERO_SUBTITLE__ = '首页大图下方的新摘要';
  const host = doc.createElement('div');
  doc.body.appendChild(host);
  M.render(M.h(M.HeroCarousel, {}), host);
  await new Promise((r) => setTimeout(r, 300));
  const html = serialize(host);

  ok('用后台配置的图（配置图一）', html.includes('http://cdn.test/one.jpg'));
  ok('用后台配置的视频', html.includes('http://cdn.test/mv.mp4'));
  ok('不再出现内置图 /hero/hero-01.webp', !html.includes('/hero/hero-01.webp'), html.slice(0, 200));
  ok('后台摘要显示在轮播下方', html.includes('首页大图下方的新摘要'), html.slice(0, 500));
  // 只数进度点本体，别把 `ld-hero-dot-fill` 也算进来（\b 在 `-` 前也成立）
  const dotRe = /class="ld-hero-dot(?: on)?"/g;
  ok('轮播张数按配置（3 张，不是内置 18）', count(html, dotRe) === 3, `实际 ${count(html, dotRe)}`);

  // 第一张是图片：不该有静音按钮（图片没声音）
  ok('当前是图片时不显示静音开关', !html.includes('ld-hero-sound'), '第一张是图片，不应出现静音按钮');

  // 视频静音循环：muted / autoPlay 是 DOM **属性**（不是 attribute），
  // 序列化里看不到，必须查元素本身（真实浏览器同样如此）。
  const videoEl = find(host, 'video');
  ok('配置的视频是 <video> 元素', !!videoEl);
  ok('视频静音（muted 属性为 true）', videoEl?.muted === true, `muted=${videoEl?.muted}`);
  ok('视频循环播放', videoEl?.hasAttribute('loop'), '缺 loop');
  // 初始停在第一张（图片），视频在「前一张 / 后一张」窗口里但**不是当前张**，
  // 此时不该自动播 —— 只有轮到它才 autoplay。
  ok('非当前张的视频不自动播', videoEl?.autoPlay !== true, `autoPlay=${videoEl?.autoPlay}`);
  ok('配置的图片仍按 <img> 渲染', /<img [^>]*one\.jpg/.test(html));

  // 切到视频那一张：应出现静音开关，且该视频开始自动播放。
  const dots = [];
  walkAll(host, 'button', dots);
  const videoDot = dots.find((b) => b.getAttribute('aria-label') === '第 2 张：配置视频');
  ok('找到第 2 张（视频）的进度点', !!videoDot);
  if (videoDot) {
    const ev = { type: 'click', currentTarget: videoDot, target: videoDot, stopPropagation() {}, preventDefault() {} };
    for (const fn of Object.values(videoDot._listeners).flat()) fn.call(videoDot, ev);
    await new Promise((r) => setTimeout(r, 200));
    const after = serialize(host);
    ok('切到视频后出现静音开关', after.includes('ld-hero-sound'));
    ok('切到视频后静音开关是「打开声音」态', /aria-label="打开声音"/.test(after), after.slice(0, 0) || '');
    const curVideo = find(host, 'video');
    ok('当前张的视频开始自动播放', curVideo?.autoPlay === true, `autoPlay=${curVideo?.autoPlay}`);
    // 关键：视频元素在「±1 窗口」里切换时 key 不变、不重建，
    // 光改 autoPlay 属性不会真的开始播 —— 必须显式 play()（本轮踩到的坑）。
    ok('切到视频后真的调用了 play()（不只是设了 autoPlay 属性）', curVideo?.paused === false,
      `paused=${curVideo?.paused}`);
  }

  // 卸载：HeroCarousel 的自动轮播是 setInterval，不卸载会一直挂在事件循环上，
  // 探针要跑两分钟才被 timeout 掐掉（其他探针都在 1 秒内）。
  M.render(null, host);
}

// —— ② 接口失败：回退内置 18 张
{
  const M = await loadModule();
  globalThis.__HERO_FAIL__ = true;
  globalThis.__SITE_SETTINGS_FAIL__ = true;
  const host = doc.createElement('div');
  doc.body.appendChild(host);
  M.render(M.h(M.HeroCarousel, {}), host);
  await new Promise((r) => setTimeout(r, 300));
  const html = serialize(host);
  ok('接口失败时回退内置图（/hero/hero-01.webp 在）', html.includes('/hero/hero-01.webp'));
  ok('摘要接口失败时保留内置文案', html.includes('一个可以慢慢逛的个人知识库'));
  const dotRe = /class="ld-hero-dot(?: on)?"/g;
  ok('回退时仍是 18 张', count(html, dotRe) === 18, `实际 ${count(html, dotRe)}`);
  M.render(null, host);
}

// —— ③ 空配置：同样回退内置图
{
  const M = await loadModule();
  globalThis.__HERO_FAIL__ = false;
  globalThis.__HERO_ITEMS__ = [];
  const host = doc.createElement('div');
  doc.body.appendChild(host);
  M.render(M.h(M.HeroCarousel, {}), host);
  await new Promise((r) => setTimeout(r, 300));
  const html = serialize(host);
  ok('配置为空时回退内置图', html.includes('/hero/hero-01.webp'));
  M.render(null, host);
}

// —— ④ 静态契约：防止以后被改回「写死图片」
{
  const src = readFileSync(resolve(SRC, 'components/HeroCarousel.jsx'), 'utf8');
  ok('HeroCarousel 调 listHeroSlides', /api\.listHeroSlides\(/.test(src));
  ok('HeroCarousel 保留 HERO_SLIDES 作为回退', /export const HERO_SLIDES = \[/.test(src));
  ok('HeroCarousel 支持视频类型判断', /type === 'video'/.test(src));
  ok('HeroCarousel 有静音开关按钮', /ld-hero-sound/.test(src));
  // 静音必须直接写 DOM：Preact 对 muted 属性的更新不可靠
  ok('静音状态直接写 DOM（el.muted = …）', /\.muted\s*=/.test(src));

  const gallerySrc = readFileSync(resolve(SRC, 'routes/Gallery.jsx'), 'utf8');
  ok('管理端有「首页轮播」入口', /setEditingHero\(true\)/.test(gallerySrc));
  ok('管理端 HeroDrawer 用 add/update/delete/reorder 四个接口',
    ['addHeroSlide', 'updateHeroSlide', 'deleteHeroSlide', 'reorderHeroSlides'].every((m) => gallerySrc.includes(`api.${m}(`)));
  ok('管理端能标记「素材还没公开」', /media_public/.test(gallerySrc));
}

console.log(`\n首页轮播探针：${pass} 过 / ${fails.length} 失败`);
if (fails.length) { fails.forEach((f) => console.log(`  ❌ ${f}`)); process.exitCode = 1; }
else console.log('  ✅ 全部通过');
