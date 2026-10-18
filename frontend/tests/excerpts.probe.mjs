// excerpts.probe.mjs —— 首页摘抄版式 + 后台管理页探针
//
// A. 首页：摘抄必须占整行、正文卡内滚动；Dora Studio 与写作日历在下一行并排。
// B. 后台：新增、编辑、启停、排序、删除都必须真的调用接口。
//
// 做法与 gallery.probe.mjs / heroCarousel.probe.mjs 相同：
// 最小 DOM shim + 真 preact + esbuild 打包，不依赖浏览器与第三方测试库。

import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { writeFileSync, unlinkSync, readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '../src');
const EVENT_TYPES = ['click', 'input', 'change', 'submit', 'keydown', 'keyup'];
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

class E {
  constructor(tag) {
    this.localName = String(tag).toLowerCase();
    this.tagName = String(tag).toUpperCase();
    this.childNodes = [];
    this.attributes = {};
    this.parentNode = null;
    this.style = { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } };
    this.dataset = {};
    this._listeners = {};
    this._events = {};
    this.nodeType = 1;
    this.className = '';
    Object.defineProperty(this, 'className', {
      configurable: true,
      get: () => this.attributes.class || '',
      set: (v) => { this.attributes.class = String(v); }
    });
    for (const t of EVENT_TYPES) {
      Object.defineProperty(this, `on${t}`, {
        configurable: true,
        get: () => this._events[t] || null,
        set: (v) => { this._events[t] = v; }
      });
    }
  }
  get firstChild() { return this.childNodes[0] || null; }
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
  remove() { this.parentNode?.removeChild(this); }
  setAttribute(k, v) {
    this.attributes[k] = String(v);
    if (k === 'class') this.className = String(v);
    if (k.startsWith('data-')) this.dataset[k.slice(5)] = String(v);
  }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; }
  removeAttribute(k) { delete this.attributes[k]; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k); }
  get textContent() { return this.childNodes.map((c) => c.textContent ?? '').join(''); }
  set textContent(v) { this.childNodes = []; if (v != null && v !== '') this.appendChild(new T(String(v))); }
  get innerHTML() { return this.childNodes.map(serialize).join(''); }
  set innerHTML(v) { this.childNodes = []; if (v) this.appendChild(new T(String(v))); }
  addEventListener(t, fn) { (this._listeners[t] || (this._listeners[t] = [])).push(fn); }
  removeEventListener(t, fn) { const a = this._listeners[t]; if (!a) return; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }
  querySelector(sel) { return find(this, sel); }
  querySelectorAll(sel) { const out = []; walkAll(this, sel, out); return out; }
  contains(n) { for (let p = n; p; p = p.parentNode) if (p === this) return true; return false; }
  getBoundingClientRect() { return { width: 800, height: 400, left: 0, top: 0, right: 800, bottom: 400 }; }
  getContext() { return null; }
  focus() {}
}

class T {
  constructor(d) { this.data = String(d); this.nodeType = 3; this.parentNode = null; }
  get textContent() { return this.data; }
  set textContent(v) { this.data = String(v); }
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

function classes(n) { return String(n.getAttribute?.('class') || n.className || '').split(/\s+/).filter(Boolean); }
function match(n, sel) {
  return sel.split(',').some((part) => {
    const s = part.trim();
    if (!s) return false;
    if (s.startsWith('.')) return classes(n).includes(s.slice(1));
    if (s.startsWith('#')) return n.getAttribute?.('id') === s.slice(1);
    if (s.startsWith('[')) return n.hasAttribute?.(s.slice(1, -1).split('=')[0]);
    return n.localName === s.toLowerCase();
  });
}
function find(root, sel) {
  for (const c of root.childNodes) {
    if (c.nodeType === 1) {
      if (match(c, sel)) return c;
      const r = find(c, sel);
      if (r) return r;
    }
  }
  return null;
}
function walkAll(root, sel, out) {
  for (const c of root.childNodes) {
    if (c.nodeType !== 1) continue;
    if (match(c, sel)) out.push(c);
    walkAll(c, sel, out);
  }
}
function serialize(n) {
  if (!n) return '';
  if (n.nodeType === 3) return n.data;
  const attrs = Object.entries(n.attributes || {}).map(([k, v]) => ` ${k}="${String(v).replace(/"/g, '&quot;')}"`).join('');
  if (VOID.has(n.localName)) return `<${n.localName}${attrs}>`;
  return `<${n.localName}${attrs}>${n.childNodes.map(serialize).join('')}</${n.localName}>`;
}

function installDom() {
  const doc = new D();
  const win = {
    document: doc,
    navigator: { userAgent: 'node' },
    innerWidth: 1440,
    innerHeight: 900,
    location: { href: 'http://localhost/', pathname: '/', search: '' },
    addEventListener() {},
    removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: (fn) => setTimeout(() => fn(Date.now()), 0),
    cancelAnimationFrame: clearTimeout,
    setTimeout,
    clearTimeout,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    scrollTo() {},
    scrollY: 0
  };
  globalThis.window = win;
  globalThis.document = doc;
  try { Object.defineProperty(globalThis, 'navigator', { value: win.navigator, configurable: true, writable: true }); }
  catch { /* 忽略 */ }
  globalThis.HTMLElement = E;
  globalThis.Element = E;
  globalThis.Node = E;
  globalThis.Event = class { constructor(t) { this.type = t; this.bubbles = false; this.target = null; } };
  globalThis.CustomEvent = globalThis.Event;
  globalThis.requestAnimationFrame = win.requestAnimationFrame;
  globalThis.cancelAnimationFrame = win.cancelAnimationFrame;
  globalThis.localStorage = win.localStorage;
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  return doc;
}

let pass = 0;
const fails = [];
function ok(name, cond, extra = '') {
  if (cond) { pass += 1; console.log(`  ✅ ${name}`); }
  else { fails.push(`${name}${extra ? ` —— ${extra}` : ''}`); console.log(`  ❌ ${name}${extra ? ` —— ${extra}` : ''}`); }
}

async function buildModule() {
  const esbuild = await import('esbuild');
  const apiStub = `
export const api = {
  listExcerpts: async () => ({ items: globalThis.__EX_ITEMS__ || [], count: (globalThis.__EX_ITEMS__ || []).length }),
  createExcerpt: async (body) => { (globalThis.__EX_CALLS__ ||= []).push(['POST', body]); const x = { id: 'new', ...body, sort_order: 99 }; (globalThis.__EX_ITEMS__ ||= []).push(x); return x; },
  updateExcerpt: async (id, body) => { (globalThis.__EX_CALLS__ ||= []).push(['PATCH', id, body]); return { ...(globalThis.__EX_ITEMS__ || []).find(x => x.id === id), ...body }; },
  reorderExcerpts: async (ids) => { (globalThis.__EX_CALLS__ ||= []).push(['ORDER', ids]); return { updated: ids.length, failed: 0 }; },
  deleteExcerpt: async (id) => { (globalThis.__EX_CALLS__ ||= []).push(['DELETE', id]); return { id, removed: true }; }
};
export default api;
`;
  const authStub = `
export function useAuth() {
  return { session: null, user: { id: 'u1' }, profile: { role: 'admin' }, loading: false,
    isAuthenticated: true, isAdmin: true,
    signIn: async () => {}, signUp: async () => {}, signOut: async () => {} };
}
export function AuthProvider({ children }) { return children; }
`;
  const toastStub = `
export const toast = () => null;
export const toastSuccess = () => null;
export const toastError = () => null;
`;
  const stubPlugin = {
    name: 'stubs',
    setup(b) {
      b.onResolve({ filter: /lib\/api\.js$/ }, () => ({ path: 'api-stub', namespace: 'stub' }));
      b.onResolve({ filter: /lib\/auth\.jsx$/ }, () => ({ path: 'auth-stub', namespace: 'stub' }));
      b.onResolve({ filter: /lib\/toast\.jsx$/ }, () => ({ path: 'toast-stub', namespace: 'stub' }));
      // HomeNow 间接依赖的阅读器链会带入 pdfjs；本探针不测阅读器，用空模块切断。
      b.onResolve({ filter: /pdfjs-dist|\.mjs\?url$|\.wasm\?url$/ }, () => ({ path: 'empty-stub', namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, (args) => ({
        contents: args.path === 'auth-stub' ? authStub
          : args.path === 'toast-stub' ? toastStub
          : args.path === 'empty-stub' ? 'export default {};'
          : apiStub,
        loader: 'js'
      }));
    }
  };
  const source = `
import { h, render } from 'preact';
import { HomeNow } from './components/HomeNow.jsx';
import { AdminExcerpts } from './routes/AdminExcerpts.jsx';
export { h, render, HomeNow, AdminExcerpts };
`;
  const built = await build({
    stdin: { contents: source, loader: 'js', resolveDir: SRC, sourcefile: 'excerpt-entry.js' },
    bundle: true,
    write: false,
    format: 'esm',
    target: 'es2020',
    jsx: 'automatic',
    jsxImportSource: 'preact',
    loader: { '.css': 'empty', '.js': 'jsx', '.jsx': 'jsx' },
    plugins: [stubPlugin],
    define: {
      'import.meta.env.VITE_API_BASE_URL': '"http://127.0.0.1:9"',
      'import.meta.env.VITE_SUPABASE_URL': '""',
      'import.meta.env.VITE_SUPABASE_ANON_KEY': '""'
    },
    logLevel: 'silent'
  });
  const out = resolve(tmpdir(), `excerpt-probe-${process.pid}.mjs`);
  writeFileSync(out, built.outputFiles[0].text, 'utf8');
  try { return await import(`${pathToFileURL(out).href}?t=${Date.now()}`); }
  finally { try { unlinkSync(out); } catch { /* 忽略 */ } }
}

function fire(node, type = 'click') {
  if (!node) return;
  const ev = { type, currentTarget: node, target: node, stopPropagation() {}, preventDefault() {} };
  const handlers = [...Object.values(node._listeners || {}).flat()];
  if (typeof node._events?.[type] === 'function') handlers.push(node._events[type]);
  for (const fn of handlers) fn.call(node, ev);
}

const doc = installDom();
const M = await buildModule();

console.log('\n首页摘抄探针\n' + '='.repeat(56));

// —— A. 首页：真实条目优先，整行大卡、长文可滚动
{
  const host = doc.createElement('div');
  doc.body.appendChild(host);
  M.render(M.h(M.HomeNow, {
    posts: [{ published_at: new Date().toISOString() }],
    books: [],
    excerpts: [
      { id: 'e1', content: '第一段'.repeat(120), source: '出处一', is_active: true },
      { id: 'e2', content: '第二段', source: '出处二', is_active: true }
    ]
  }), host);
  await new Promise((r) => setTimeout(r, 120));
  const html = serialize(host);
  ok('首页摘抄优先使用后台内容', html.includes('第一段') && !html.includes('一个人真正的成长'));
  ok('摘抄卡是整行类', classes(find(host, '.now-excerpt')).includes('now-excerpt'));
  ok('显示序号 1 / 2', html.includes('1 / 2'));
  ok('显示后台出处', html.includes('出处一'));
  ok('提供「换一段」按钮', !!find(host, '.now-ex-next'));
  const next = find(host, '.now-ex-next');
  if (next) {
    fire(next);
    await new Promise((r) => setTimeout(r, 500));
    ok('点击换一段后切到第二条', serialize(host).includes('第二段'));
  }
  M.render(null, host);
}

// —— B. 首页：接口为空时用内置文案兜底，不能出现空白大卡
{
  const host = doc.createElement('div');
  doc.body.appendChild(host);
  M.render(M.h(M.HomeNow, { posts: [], books: [], excerpts: [] }), host);
  await new Promise((r) => setTimeout(r, 100));
  const html = serialize(host);
  ok('空配置时使用内置摘抄兜底', html.includes('一个人真正的成长'));
  M.render(null, host);
}

// —— C. 后台：新增 / 编辑 / 启停 / 排序 / 删除
{
  globalThis.__EX_CALLS__ = [];
  globalThis.__EX_ITEMS__ = [
    { id: '11111111-1111-1111-1111-111111111111', content: '第一条后台摘抄', source: '出处一', sort_order: 0, is_active: true },
    { id: '22222222-2222-2222-2222-222222222222', content: '第二条后台摘抄', source: '', sort_order: 1, is_active: false }
  ];
  const host = doc.createElement('div');
  doc.body.appendChild(host);
  M.render(M.h(M.AdminExcerpts), host);
  await new Promise((r) => setTimeout(r, 160));

  ok('后台页有标题', serialize(host).includes('首页摘抄'));
  ok('后台列出两条', host.querySelectorAll('.ex-card').length === 2, `${host.querySelectorAll('.ex-card').length}`);

  const addBtn = [...host.querySelectorAll('button')].find((b) => b.textContent.includes('写一条摘抄'));
  ok('有「写一条摘抄」按钮', !!addBtn);
  if (addBtn) {
    fire(addBtn);
    await new Promise((r) => setTimeout(r, 100));
    const ta = host.querySelector('.ex-editor-text');
    const src = host.querySelector('.ex-editor-source');
    ok('新增表单出现', !!ta && !!src);
    if (ta) {
      ta.value = '新增的一条长摘抄';
      const ev = { type: 'input', currentTarget: ta, target: ta, stopPropagation() {}, preventDefault() {} };
      for (const fn of Object.values(ta._listeners).flat()) fn.call(ta, ev);
      src.value = '新增出处';
      const ev2 = { type: 'input', currentTarget: src, target: src, stopPropagation() {}, preventDefault() {} };
      for (const fn of Object.values(src._listeners).flat()) fn.call(src, ev2);
      await new Promise((r) => setTimeout(r, 50));
      const submit = [...host.querySelectorAll('button')].find((b) => b.textContent.includes('添加到首页'));
      ok('提交按钮存在', !!submit, `buttons=${host.querySelectorAll('button').map((b) => b.textContent.trim()).join('|')}`);
      ok('新增提交按钮已启用', submit?.disabled !== true, `disabled=${submit?.disabled}`);
      const form = host.querySelector('.ex-editor');
      ok('表单节点存在', !!form);
      ok('表单有 submit 监听', !!form?._listeners?.submit || typeof form?.onSubmit === 'function', JSON.stringify(Object.keys(form?._listeners || {})));
      fire(form, 'submit');
      await new Promise((r) => setTimeout(r, 400));
      ok('新增后调用记录', (globalThis.__EX_CALLS__ || []).length > 0, JSON.stringify(globalThis.__EX_CALLS__));
    }
  }

  const calls = globalThis.__EX_CALLS__ || [];
  ok('新增调用 createExcerpt', calls.some((c) => c[0] === 'POST' && c[1].content === '新增的一条长摘抄'));

  // 编辑第一条
  await new Promise((r) => setTimeout(r, 100));
  const editBtn = [...host.querySelectorAll('button')].find((b) => b.textContent.includes('编辑'));
  ok('有编辑按钮', !!editBtn);
  if (editBtn) {
    fire(editBtn);
    await new Promise((r) => setTimeout(r, 100));
    const ta = host.querySelector('.ex-editor-text');
    ta.value = '编辑后的摘抄';
    const ev = { type: 'input', currentTarget: ta, target: ta, stopPropagation() {}, preventDefault() {} };
    for (const fn of Object.values(ta._listeners).flat()) fn.call(ta, ev);
    await new Promise((r) => setTimeout(r, 60));
    ok('编辑输入已写入', ta.value === '编辑后的摘抄', ta.value);
    fire(host.querySelector('.ex-editor'), 'submit');
    await new Promise((r) => setTimeout(r, 500));
    ok('编辑请求记录', (globalThis.__EX_CALLS__ || []).some((c) => c[0] === 'PATCH'), JSON.stringify(globalThis.__EX_CALLS__));
  }
  ok('编辑调用 updateExcerpt', (globalThis.__EX_CALLS__ || []).some((c) => c[0] === 'PATCH' && (c[2]?.content === '编辑后的摘抄' || c[2]?.content === '编辑后的摘抄')), JSON.stringify((globalThis.__EX_CALLS__ || []).filter(c=>c[0]==='PATCH')));

  // 启停 / 排序
  const toggle = [...host.querySelectorAll('button')].find((b) => /启用|停用/.test(b.textContent));
  if (toggle) { fire(toggle); await new Promise((r) => setTimeout(r, 150)); }
  ok('启停调用 updateExcerpt(is_active)', (globalThis.__EX_CALLS__ || []).some((c) => c[0] === 'PATCH' && typeof c[2].is_active === 'boolean'));

  const down = [...host.querySelectorAll('button')].find((b) => b.textContent.includes('下移'));
  if (down) { fire(down); await new Promise((r) => setTimeout(r, 150)); }
  ok('排序调用 reorderExcerpts', (globalThis.__EX_CALLS__ || []).some((c) => c[0] === 'ORDER'));

  // 删除（探针里把 confirm 固定为 true）
  const oldConfirm = globalThis.confirm;
  globalThis.confirm = () => true;
  const del = [...host.querySelectorAll('button')].find((b) => b.textContent.includes('删除'));
  if (del) { fire(del); await new Promise((r) => setTimeout(r, 150)); }
  globalThis.confirm = oldConfirm;
  ok('删除调用 deleteExcerpt', (globalThis.__EX_CALLS__ || []).some((c) => c[0] === 'DELETE'));

  M.render(null, host);
}

// —— D. 静态契约：首页不能把摘抄写死、后台必须走管理员路由
{
  const home = readFileSync(resolve(SRC, 'components/HomeNow.jsx'), 'utf8');
  ok('首页组件接收 excerpts 数据', /function HomeNow\(\{[^}]*excerpts/.test(home));
  ok('首页组件调用后台条目', /items\.length \? items\.map/.test(home));
  ok('摘抄正文区有滚动容器类', /now-ex-q/.test(home));

  const app = readFileSync(resolve(SRC, 'app.jsx'), 'utf8');
  ok('后台路由仅管理员', /admin path="\/admin\/excerpts"/.test(app));
  const layout = readFileSync(resolve(SRC, 'components/Layout.jsx'), 'utf8');
  ok('管理员菜单有首页摘抄入口', /href="\/admin\/excerpts"/.test(layout));
}

console.log('\n' + '='.repeat(56));
console.log(`结果：${pass} 过 / ${fails.length} 失败`);
if (fails.length) {
  console.log(fails.map((f) => `  - ${f}`).join('\n'));
  process.exitCode = 1;
}
process.exit(fails.length ? 1 : 0);
