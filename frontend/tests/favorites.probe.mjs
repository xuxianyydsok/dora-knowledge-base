// favorites.probe.mjs —— 收藏页「站长登录后不重复」的角色矩阵探针
//
// 目的：Favorites.jsx 用 useAuth().isAdmin 决定是否渲染「站长收藏」分区。
//   访客 / 普通用户 → 应渲染（他们的个人收藏通常是空的，这是内容来源）；
//   站长本人       → 不应渲染（那批内容就是站长自己的收藏，再显示一遍是重复）。
//
// 做法：把 Favorites.jsx 连同 preact 打成一个内存 ESM，注入 AuthContext 替身，
// 用真实 preact 渲染成 HTML 字符串再断言。DOM shim 与 statCharts.probe.mjs 同款。

import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { writeFileSync, unlinkSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '../src');

// ---------------------------------------------------------------- 最小 DOM

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr']);

class E {
  constructor(tag) {
    this.localName = tag; this.tagName = String(tag).toUpperCase();
    this.childNodes = []; this.attributes = {}; this.parentNode = null;
    this.style = {}; this.dataset = {}; this._listeners = {}; this.nodeType = 1;
  }
  get firstChild() { return this.childNodes[0] || null; }
  get nextSibling() {
    if (!this.parentNode) return null;
    const i = this.parentNode.childNodes.indexOf(this);
    return this.parentNode.childNodes[i + 1] || null;
  }
  appendChild(c) { c.parentNode = this; this.childNodes.push(c); return c; }
  insertBefore(c, ref) {
    const i = ref ? this.childNodes.indexOf(ref) : -1;
    if (i < 0) this.childNodes.push(c); else this.childNodes.splice(i, 0, c);
    c.parentNode = this; return c;
  }
  removeChild(c) {
    const i = this.childNodes.indexOf(c);
    if (i >= 0) this.childNodes.splice(i, 1);
    c.parentNode = null; return c;
  }
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
  removeEventListener(t, fn) {
    const a = this._listeners[t]; if (!a) return;
    const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
  }
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
    location: { href: 'http://localhost/favorites', pathname: '/favorites', search: '' },
    addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: (fn) => setTimeout(fn, 0), cancelAnimationFrame: clearTimeout,
    setTimeout, clearTimeout, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    URL, fetch: () => Promise.reject(new Error('offline'))
  };
  globalThis.window = win;
  globalThis.document = doc;
  // Node 24 的 globalThis.navigator 是只读 getter，用 defineProperty 覆盖
  try { Object.defineProperty(globalThis, 'navigator', { value: win.navigator, configurable: true, writable: true }); }
  catch { /* 覆盖不了就沿用 Node 自带的，探针不依赖它 */ }
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

async function loadModule() {
  const esbuild = await import('esbuild');
  // 把 Favorites、preact 打进同一份 bundle（hooks 与 render 必须共用同一份 preact）。
  // 关键：用插件把 lib/auth.jsx 换成可控替身，让 useAuth() 返回我们指定的角色，
  // 这样能对「站长 / 访客」两种身份各真渲染一次，而不是只做静态断言。
  const authStub = `
export function useAuth() {
  const role = globalThis.__FAV_PROBE_ROLE__ || 'guest';
  return {
    session: null,
    user: role === 'admin' ? { id: 'u-admin', email: 'admin@example.com' } : null,
    profile: { id: 'u-admin', role },
    loading: false,
    isAuthenticated: role === 'admin',
    isAdmin: role === 'admin',
    signIn: async () => {}, signUp: async () => {}, signOut: async () => {}
  };
}
export function AuthProvider({ children }) { return children; }
`;
  // api 替身：给站长收藏返回两条真实形状的数据，让「站长收藏」分区有内容可渲染。
  // 个人收藏（listFavorites）按角色区分：访客抛 401（走「请先登录」空态），
  // 站长返回自己的两条 —— 这正是用户反馈「重复两份」的场景。
  const apiStub = `
const FAV_MUSIC = {
  id: 'f-music-1', created_at: '2026-10-11T00:00:00Z',
  target: { kind: 'resource', type: 'music', id: 'm1', title: 'We Never', cover_path: '', summary: '' }
};
const FAV_MOVIE = {
  id: 'f-movie-1', created_at: '2026-10-11T00:00:00Z',
  target: { kind: 'resource', type: 'movie', id: 'v1', title: '测试电影', cover_path: '', summary: '' }
};
const ADMIN_ITEMS = [FAV_MUSIC, FAV_MOVIE];
export const api = {
  listAdminFavorites: async () => ADMIN_ITEMS,
  listFavorites: async () => {
    const role = globalThis.__FAV_PROBE_ROLE__ || 'guest';
    if (role !== 'admin') { const e = new Error('未登录'); e.status = 401; throw e; }
    return ADMIN_ITEMS;
  },
  deleteFavorite: async () => ({ deleted: true }),
  deleteFavoriteByTarget: async () => ({ deleted: true })
};
export default api;
`;

  const stubPlugin = {
    name: 'auth-stub',
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
import { Favorites } from './routes/Favorites.jsx';
export { h, render, Favorites };
`;
  const built = await esbuild.build({
    stdin: { contents: source, loader: 'js', resolveDir: SRC, sourcefile: 'fav-entry.js' },
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
  const out = resolve(tmpdir(), `fav-probe-${process.pid}.mjs`);
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

// ---------------------------------------------------------------- 主流程

const doc = installDom();
const M = await loadModule();
const { h, render, Favorites } = M;

function renderAs(role) {
  globalThis.__FAV_PROBE_ROLE__ = role;
  const host = doc.createElement('div');
  doc.body.appendChild(host);
  render(h(Favorites, {}), host);
  return host;
}

// 两次渲染之间要让 preact 真正卸载：换一个干净的挂载点即可，
// 组件内部的状态是新建的，不受上一次影响。
const adminHost = renderAs('admin');
await new Promise((r) => setTimeout(r, 400));
const adminHtml = serialize(adminHost);

const guestHost = renderAs('guest');
await new Promise((r) => setTimeout(r, 400));
const guestHtml = serialize(guestHost);

// ---------------------------------------------------------------- 断言

ok('两次渲染都产出了非空 HTML', adminHtml.length > 0 && guestHtml.length > 0,
  `admin=${adminHtml.length} guest=${guestHtml.length}`);

ok('站长本人：不渲染「站长收藏」分区（内容与个人收藏重复）',
  !adminHtml.includes('fav-admin'),
  '站长态仍出现了 .fav-admin');

ok('访客：仍渲染「站长收藏」分区（这是他们的内容来源）',
  guestHtml.includes('fav-admin'),
  '访客态没有 .fav-admin');

// 静态断言：条件表达式必须带 !isAdmin，防止以后被误改回去
const { readFileSync } = await import('node:fs');
const src = readFileSync(resolve(SRC, 'routes/Favorites.jsx'), 'utf8');
ok('Favorites.jsx 使用 useAuth().isAdmin', /const\s*\{\s*isAdmin\s*\}\s*=\s*useAuth\(\)/.test(src));
ok('adminSection 条件带 !isAdmin',
  /const adminSection = !isAdmin && adminItems\.length \?/.test(src),
  '条件表达式未按预期写成 !isAdmin && adminItems.length');

console.log(`\n收藏页角色探针：${pass} 过 / ${fails.length} 失败`);
if (fails.length) { fails.forEach((f) => console.log(`  ❌ ${f}`)); process.exitCode = 1; }
else console.log('  ✅ 全部通过');
