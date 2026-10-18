// miniPlayer.probe.mjs —— 底部播放条（components/MiniPlayer.jsx）离线探针
//
// 用户要求（2026-10-12，参考模板《Nacre 音乐》的底部播放条）：
//   把播放相关功能都集成进这一条，不再另开页面：
//     · 点封面**立即**进歌词页；
//     · 收藏按钮（登录后）；
//     · 随机播放开关；
//     · 顺序 / 列表循环 / 单曲循环；
//     · 「下一曲」右边的队列按钮，点了**就地弹出**队列浮层，不跳页。
//
// 做法与 gallery.probe.mjs 同款：最小 DOM shim + 真 preact 渲染 + 字符串 / 行为断言。
// 播放器状态用一个可控的 stub 注入，这样「随机 / 循环 / 队列」都能直接验。

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
    this.style = {
      setProperty(k, v) { this[k] = v; },
      removeProperty(k) { delete this[k]; }
    };
    this.dataset = {}; this._listeners = {}; this.nodeType = 1;
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

async function loadModule(over) {
  const esbuild = await import('esbuild');

  // 播放器 stub：状态可由 globalThis.__MP__ 控制，动作记录到 __MP_CALLS__
  const playerStub = `
export function usePlayer() {
  const s = globalThis.__MP__ || {};
  const calls = globalThis.__MP_CALLS__ || (globalThis.__MP_CALLS__ = []);
  // 只记「调了哪个动作」与可序列化的标量参数：
  // 事件对象里带 currentTarget 会形成循环引用，JSON.stringify 会炸。
  const rec = (name) => (...args) => {
    calls.push([name, ...args.map((a) => (typeof a === 'object' && a !== null ? '<obj>' : a))]);
  };
  return {
    music: s.music || null,
    track: s.track || {},
    playing: !!s.playing,
    position: s.position || 0,
    duration: s.duration || 0,
    volume: 1,
    notice: s.notice || '',
    queue: s.queue || [],
    index: s.index ?? -1,
    goTo: rec('goTo'),
    shuffle: !!s.shuffle,
    repeat: s.repeat || 'off',
    hasPrev: s.hasPrev !== false,
    hasNext: s.hasNext !== false,
    toggle: rec('toggle'),
    next: rec('next'),
    prev: rec('prev'),
    seek: rec('seek'),
    setVolume: rec('setVolume'),
    stop: rec('stop'),
    flash: rec('flash'),
    toggleShuffle: rec('toggleShuffle'),
    cycleRepeat: rec('cycleRepeat')
  };
}
export function PlayerProvider({ children }) { return children; }
`;

  const authStub = `
export function useAuth() {
  const role = globalThis.__MP_ROLE__ || 'guest';
  return {
    session: null, user: null, profile: null, loading: false,
    isAuthenticated: role === 'user' || role === 'admin',
    isAdmin: role === 'admin',
    signIn: async () => {}, signUp: async () => {}, signOut: async () => {}
  };
}
export function AuthProvider({ children }) { return children; }
`;

  const apiStub = `
const favs = [];
export const api = {
  listFavorites: async () => favs.slice(),
  createFavorite: async (b) => { favs.push({ resource_id: b.resource_id }); return {}; },
  deleteFavoriteByTarget: async (qs) => {
    const id = decodeURIComponent(String(qs).replace(/^resource_id=/, ''));
    const i = favs.findIndex((f) => f.resource_id === id);
    if (i >= 0) favs.splice(i, 1);
    return { deleted: true };
  }
};
export default api;
`;

  const routerStub = `
export const ROUTES = [];
export function route(path, replace) {
  (globalThis.__MP_ROUTES__ || (globalThis.__MP_ROUTES__ = [])).push([path, !!replace]);
}
export function useRouter() { return [{}]; }
export default { route };
`;

  const toastStub = `
export const TOASTS = [];
export function toastSuccess(m) { TOASTS.push(['ok', m]); }
export function toastError(m) { TOASTS.push(['err', m]); }
export function toastInfo(m) { TOASTS.push(['info', m]); }
export function Toaster() { return null; }
`;

  const stubPlugin = {
    name: 'stubs',
    setup(b) {
      b.onResolve({ filter: /lib\/player\.jsx$/ }, () => ({ path: 'player-stub', namespace: 'stub' }));
      b.onResolve({ filter: /lib\/auth\.jsx$/ }, () => ({ path: 'auth-stub', namespace: 'stub' }));
      b.onResolve({ filter: /lib\/api\.js$/ }, () => ({ path: 'api-stub', namespace: 'stub' }));
      b.onResolve({ filter: /preact-router$/ }, () => ({ path: 'router-stub', namespace: 'stub' }));
      b.onResolve({ filter: /lib\/toast\.jsx$/ }, () => ({ path: 'toast-stub', namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, (args) => {
        const map = {
          'player-stub': playerStub, 'auth-stub': authStub, 'api-stub': apiStub,
          'router-stub': routerStub, 'toast-stub': toastStub
        };
        return { contents: map[args.path], loader: 'js' };
      });
    }
  };

  const source = `
import { h, render } from 'preact';
import { MiniPlayer } from './components/MiniPlayer.jsx';
export { h, render, MiniPlayer };
`;
  const built = await esbuild.build({
    stdin: { contents: source, loader: 'js', resolveDir: SRC, sourcefile: 'mp-entry.js' },
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
  const out = resolve(tmpdir(), `mp-probe-${process.pid}.mjs`);
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

function click(host, sel) {
  const el = find(host, sel);
  if (!el) return null;
  const fns = Object.values(el._listeners || {}).flat();
  const ev = { type: 'click', currentTarget: el, target: el, stopPropagation() {}, preventDefault() {} };
  for (const fn of fns) fn.call(el, ev);
  return el;
}

// ---------------------------------------------------------------- 主流程

const doc = installDom();
const M = await loadModule();
const { h, render, MiniPlayer } = M;

const TRACKS = [
  { id: 'm1', title: '测试曲一', artist: '甲歌手', album: '专辑A', cover: '', duration: 200 },
  { id: 'm2', title: '测试曲二', artist: '乙歌手', album: '专辑B', cover: '', duration: 210 },
  { id: 'm3', title: '测试曲三', artist: '丙歌手', album: '专辑C', cover: '', duration: 220 }
];

function setState(patch) {
  globalThis.__MP__ = {
    music: { id: 'm1', title: '测试曲一', track: { artist: '甲歌手', artwork_url: '' } },
    track: { artist: '甲歌手', artwork_url: '', duration: 200 },
    playing: true, position: 42, duration: 200,
    queue: TRACKS, index: 0, repeat: 'off', shuffle: false,
    ...patch
  };
  globalThis.__MP_CALLS__ = [];
}

// ---- 1) 没在播放时整条不渲染 ----
setState({ music: null });
{
  const host = doc.createElement('div');
  doc.body.appendChild(host);
  render(h(MiniPlayer, {}), host);
  await new Promise((r) => setTimeout(r, 60));
  ok('没有正在播放的曲目时不渲染播放条', !find(host, '.mini-player'));
  render(null, host);
}

// ---- 2) 访客态：基本结构 ----
setState({});
globalThis.__MP_ROLE__ = 'guest';
{
  const host = doc.createElement('div');
  doc.body.appendChild(host);
  render(h(MiniPlayer, {}), host);
  await new Promise((r) => setTimeout(r, 80));
  const html = serialize(host);

  ok('渲染出底部播放条', !!find(host, '.mini-player'));
  ok('封面是独立按钮（点击进歌词）', !!find(host, '.mini-cover-btn'));
  ok('曲目信息可点（进详情）', !!find(host, '.mini-meta'));
  ok('显示曲名与歌手', html.includes('测试曲一') && html.includes('甲歌手'));
  ok('有随机播放按钮', html.includes('随机播放'));
  ok('有上一首 / 下一首', html.includes('上一首') && html.includes('下一首'));
  ok('有循环模式按钮（顺序播放）', html.includes('顺序播放'));
  ok('有播放队列按钮', html.includes('播放队列'));
  ok('访客不渲染收藏按钮', !find(host, '.mini-fav'));

  // 点封面 → 进歌词页
  globalThis.__MP_ROUTES__ = [];
  click(host, '.mini-cover-btn');
  const coverRoutes = globalThis.__MP_ROUTES__.map((r) => r[0]);
  ok('点封面立即跳到歌词页', coverRoutes.includes('/music/m1/lyrics'), coverRoutes.join(' | '));

  // 点曲目信息 → 进详情
  globalThis.__MP_ROUTES__ = [];
  click(host, '.mini-meta');
  const metaRoutes = globalThis.__MP_ROUTES__.map((r) => r[0]);
  ok('点曲目信息进歌曲详情', metaRoutes.includes('/music/m1'), metaRoutes.join(' | '));

  render(null, host);
}

// ---- 3) 随机 / 循环按钮 ----
setState({ shuffle: true, repeat: 'all' });
globalThis.__MP_ROLE__ = 'guest';
{
  const host = doc.createElement('div');
  doc.body.appendChild(host);
  render(h(MiniPlayer, {}), host);
  await new Promise((r) => setTimeout(r, 80));
  const html = serialize(host);
  const shuffleBtn = find(host, '.mini-icon');
  ok('随机开启时按钮带 on 态', html.includes('随机播放已开启'), html.slice(0, 200));
  ok('列表循环的 title 正确', html.includes('列表循环'), '');

  // 点随机 → toggleShuffle
  click(host, '.mini-icon');
  ok('点随机调用 toggleShuffle', globalThis.__MP_CALLS__.some((c) => c[0] === 'toggleShuffle'),
    JSON.stringify(globalThis.__MP_CALLS__));

  // 循环按钮：单曲循环时显示角标 1
  render(null, host);
}
setState({ repeat: 'one' });
{
  const host = doc.createElement('div');
  doc.body.appendChild(host);
  render(h(MiniPlayer, {}), host);
  await new Promise((r) => setTimeout(r, 80));
  const html = serialize(host);
  ok('单曲循环时按钮显示角标 1', /class="mini-badge">1</.test(html), html.slice(0, 120));
  ok('单曲循环的 title 正确', html.includes('单曲循环'), '');
  render(null, host);
}

// ---- 4) 队列浮层：点了就地弹出，不跳页 ----
setState({});
globalThis.__MP_ROLE__ = 'guest';
{
  const host = doc.createElement('div');
  doc.body.appendChild(host);
  render(h(MiniPlayer, {}), host);
  await new Promise((r) => setTimeout(r, 80));
  ok('默认不显示队列浮层', !find(host, '.mini-queue'));

  globalThis.__MP_ROUTES__ = [];
  // 队列按钮是 controls 里的最后一个 .mini-icon
  const icons = [];
  (function walk(n) {
    for (const c of n.childNodes) {
      if (c.nodeType === 1) {
        if (String(c.attributes?.class || '').split(/\s+/).includes('mini-icon')) icons.push(c);
        walk(c);
      }
    }
  })(host);
  const queueBtn = icons[icons.length - 1];
  ok('找到队列按钮', !!queueBtn);
  if (queueBtn) {
    const fns = Object.values(queueBtn._listeners || {}).flat();
    const ev = { type: 'click', currentTarget: queueBtn, target: queueBtn, stopPropagation() {}, preventDefault() {} };
    for (const fn of fns) fn.call(queueBtn, ev);
    await new Promise((r) => setTimeout(r, 120));
    const open = serialize(host);
    ok('点队列按钮就地弹出队列浮层', /class="mini-queue"/.test(open));
    ok('队列浮层列出全部 3 首', count(open, /class="mini-queue-row/g) === 3, `实际 ${count(open, /class="mini-queue-row/g)} 行`);
    ok('队列浮层显示首数', open.includes('3 首'));
    ok('打开队列没有跳页', globalThis.__MP_ROUTES__.length === 0, JSON.stringify(globalThis.__MP_ROUTES__));

    // 点队列里第 3 首 → goTo(2)
    const rows = [];
    (function walk(n) {
      for (const c of n.childNodes) {
        if (c.nodeType === 1) {
          if (String(c.attributes?.class || '').split(/\s+/).includes('mini-queue-row')) rows.push(c);
          walk(c);
        }
      }
    })(host);
    ok('队列行可点', rows.length === 3);
    if (rows[2]) {
      const rf = Object.values(rows[2]._listeners || {}).flat();
      const rowEv = { type: 'click', currentTarget: rows[2], target: rows[2], stopPropagation() {}, preventDefault() {} };
      for (const fn of rf) fn.call(rows[2], rowEv);
      const got = globalThis.__MP_CALLS__.filter((c) => c[0] === 'goTo');
      ok('点队列第 3 首调用 goTo(2)', got.length === 1 && got[0][1] === 2, JSON.stringify(got));
    }
  }
  render(null, host);
}

// ---- 5) 登录后：收藏按钮 ----
setState({});
globalThis.__MP_ROLE__ = 'user';
{
  const host = doc.createElement('div');
  doc.body.appendChild(host);
  render(h(MiniPlayer, {}), host);
  await new Promise((r) => setTimeout(r, 120));
  ok('登录后渲染收藏按钮', !!find(host, '.mini-fav'));
  const html = serialize(host);
  ok('未收藏时 title 是「收藏」', html.includes('title="收藏"'), '');

  // 点收藏 → 调 createFavorite，按钮变已收藏
  click(host, '.mini-fav');
  await new Promise((r) => setTimeout(r, 150));
  const after = serialize(host);
  ok('点收藏后变成已收藏态', /mini-fav on/.test(after), after.slice(0, 200));
  ok('已收藏时 title 是「取消收藏」', after.includes('title="取消收藏"'), '');

  // 再点一次 → 取消收藏
  click(host, '.mini-fav');
  await new Promise((r) => setTimeout(r, 150));
  const back = serialize(host);
  ok('再点一次取消收藏', !/mini-fav on/.test(back));
  render(null, host);
}

// ---- 6) 静态断言：播放条不再另开页面 ----
{
  const src = readFileSync(resolve(SRC, 'components/MiniPlayer.jsx'), 'utf8');
  ok('播放条用 REPEAT_LABEL 描述循环模式', /REPEAT_LABEL/.test(src));
  ok('播放条集成随机（toggleShuffle）', src.includes('toggleShuffle'));
  ok('播放条集成循环（cycleRepeat）', src.includes('cycleRepeat'));
  ok('播放条集成收藏（createFavorite）', src.includes('createFavorite'));
  ok('播放条有队列浮层（mini-queue）', src.includes('mini-queue'));
  ok('点封面跳歌词页', /music\/\$\{music\.id\}\/lyrics/.test(src));
}

console.log(`\n底部播放条探针：${pass} 过 / ${fails.length} 失败`);
if (fails.length) { fails.forEach((f) => console.log(`  ❌ ${f}`)); process.exitCode = 1; }
else console.log('  ✅ 全部通过');
