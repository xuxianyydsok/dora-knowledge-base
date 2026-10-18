// contentCharts.probe.mjs —— 真实数据图表探针（零外部测试框架）
//
// A. 纯函数：验证 contentStats 的时间窗口、排序、交叉计数和月度聚合。
// B. 组件：用最小 DOM + 假 canvas 渲染 ContentChartsPanel，确认四张图都挂载、
//    canvas 真的执行了绘制，并且 props 更新后不会继续画旧分类/旧标签。
//
// 运行：node tests/contentCharts.probe.mjs

import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { writeFileSync, unlinkSync } from 'node:fs';
import {
  dailyCounts, categoryCounts, categoryTagMatrix, monthlyByCategory, publishedPosts
} from '../src/lib/contentStats.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '../src');
const DAY = 86400000;

let pass = 0;
const failures = [];
function ok(name, cond, extra = '') {
  if (cond) { pass += 1; console.log(`  ✅ ${name}`); }
  else { failures.push(`${name}${extra ? ` —— ${extra}` : ''}`); console.log(`  ❌ ${name}${extra ? ` —— ${extra}` : ''}`); }
}
function eq(name, got, want) {
  ok(name, JSON.stringify(got) === JSON.stringify(want), `实际 ${JSON.stringify(got)}，期望 ${JSON.stringify(want)}`);
}
function dumpTexts(canvas, limit = 30) {
  return canvas.__ctx.ops
    .filter((o) => o.name === 'fillText')
    .map((o) => o.args[0])
    .slice(0, limit);
}

// ---------------------------------------------------------------- DOM shim

class TextNode {
  constructor(data) { this.nodeType = 3; this.data = String(data); this.parentNode = null; }
  get textContent() { return this.data; }
  set textContent(v) { this.data = String(v); }
}

class Element {
  constructor(tag) {
    this.nodeType = 1;
    this.localName = String(tag).toLowerCase();
    this.tagName = String(tag).toUpperCase();
    this.className = '';
    this.childNodes = [];
    this.parentNode = null;
    this.attributes = {};
    this.style = {
      setProperty(k, v) { this[k] = v; },
      removeProperty(k) { delete this[k]; }
    };
    this.width = 800;
    this.height = 300;
  }
  get firstChild() { return this.childNodes[0] || null; }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }
  appendChild(c) { c.parentNode = this; this.childNodes.push(c); return c; }
  insertBefore(c, ref) {
    c.parentNode = this;
    const i = this.childNodes.indexOf(ref);
    if (i < 0) this.childNodes.push(c); else this.childNodes.splice(i, 0, c);
    return c;
  }
  removeChild(c) {
    const i = this.childNodes.indexOf(c);
    if (i >= 0) this.childNodes.splice(i, 1);
    c.parentNode = null;
    return c;
  }
  getAttribute(k) { return this.attributes[k] ?? null; }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  removeAttribute(k) { delete this.attributes[k]; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k); }
  addEventListener() {}
  removeEventListener() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 300, right: 800, bottom: 300 }; }
  getContext() { return this.__ctx || (this.__ctx = new FakeContext(this)); }
  querySelectorAll(sel) {
    const out = [];
    const matches = (n) => {
      const classes = String(n.className || '').split(/\s+/);
      return sel.split(',').some((part) => {
        const s = part.trim();
        return s.startsWith('.') ? classes.includes(s.slice(1)) : n.localName === s;
      });
    };
    const walk = (n) => {
      for (const c of n.childNodes) {
        if (c.nodeType !== 1) continue;
        if (matches(c)) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
}

class FakeContext {
  constructor(canvas) {
    this.canvas = canvas;
    this.ops = [];
    this.globalAlpha = 1;
    this.fillStyle = '';
    this.strokeStyle = '';
    this.lineWidth = 1;
    this.lineJoin = 'miter';
    this.textAlign = 'start';
    this.font = '';
  }
  record(name, args) { this.ops.push({ name, args }); }
  clearRect(...a) { this.record('clearRect', a); }
  beginPath() { this.record('beginPath', []); }
  moveTo(...a) { this.record('moveTo', a); }
  lineTo(...a) { this.record('lineTo', a); }
  closePath() { this.record('closePath', []); }
  stroke() { this.record('stroke', []); }
  fill() { this.record('fill', []); }
  arc(...a) { this.record('arc', a); }
  fillRect(...a) { this.record('fillRect', a); }
  fillText(text, ...a) { this.record('fillText', [text, ...a]); }
  measureText(text) { return { width: String(text).length * 6 }; }
  createLinearGradient() { return { addColorStop() {} }; }
  setTransform(...a) { this.record('setTransform', a); }
  getImageData() { return { data: [0, 0, 0, 0] }; }
}

class DocumentShim {
  constructor() {
    this.documentElement = new Element('html');
    this.head = new Element('head');
    this.body = new Element('body');
    this.hidden = false;
  }
  createElement(tag) { return new Element(tag); }
  createElementNS(_ns, tag) { return new Element(tag); }
  createTextNode(data) { return new TextNode(data); }
}

function installDom() {
  const doc = new DocumentShim();
  globalThis.document = doc;
  globalThis.window = {
    document: doc,
    devicePixelRatio: 1,
    addEventListener() {},
    removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
  };
  globalThis.getComputedStyle = () => ({
    getPropertyValue(name) {
      return ({
        '--primary': '#4a6cf7',
        '--text': '#10131a',
        '--text-muted': '#5b6472',
        '--border': '#d9dfea',
        '--bg-elevated': '#ffffff'
      })[name] || '';
    }
  });
  globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  globalThis.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; }
    observe() { this.cb([{ isIntersecting: true }]); }
    disconnect() {}
  };
  return doc;
}

// ---------------------------------------------------------------- module load

async function loadPanel() {
  const esbuild = await import('esbuild');
  const built = await esbuild.build({
    stdin: {
      contents: `
export { ContentChartsPanel } from './components/ContentChartsPanel.jsx';
export { h, render } from 'preact';
`,
      loader: 'js',
      resolveDir: SRC,
      sourcefile: 'content-charts-entry.js'
    },
    bundle: true,
    write: false,
    format: 'esm',
    target: 'es2020',
    jsx: 'automatic',
    jsxImportSource: 'preact',
    logLevel: 'silent'
  });
  const out = resolve(tmpdir(), `content-charts-probe-${process.pid}.mjs`);
  writeFileSync(out, built.outputFiles[0].text, 'utf8');
  try { return await import(`${pathToFileURL(out).href}?t=${Date.now()}`); }
  finally { try { unlinkSync(out); } catch { /* 忽略 */ } }
}

const now = new Date();
const ago = (days) => new Date(now.getTime() - days * DAY).toISOString();
const cats = [
  { id: 'c1', name: '软件工程' },
  { id: 'c2', name: '数学' },
  { id: 'c3', name: '读书' },
  { id: 'c4', name: '生活' }
];
const tags = [
  { id: 't1', name: 'JavaScript' },
  { id: 't2', name: '算法' },
  { id: 't3', name: '随笔' }
];
const posts = [
  { status: 'published', published_at: ago(0), category_id: 'c1', tag_ids: ['t1', 't2'] },
  { status: 'published', published_at: ago(0), category_id: 'c1', tag_ids: ['t1'] },
  { status: 'published', published_at: ago(1), category_id: 'c2', tag_ids: ['t2'] },
  { status: 'published', published_at: ago(2), category_id: 'c3', tag_ids: ['t3'] },
  { status: 'published', published_at: ago(35), category_id: 'c4', tag_ids: ['t3'] },
  { status: 'draft', created_at: ago(0), category_id: 'c4', tag_ids: ['t3'] }
];

console.log('\n真实数据图表探针\n' + '='.repeat(56));
console.log('\n— A. 纯函数 —');

eq('publishedPosts 排除草稿', publishedPosts(posts).length, 5);
const daily = dailyCounts(posts, 30);
eq('dailyCounts 返回 30 天', daily.days.length, 30);
eq('dailyCounts 只统计窗口内文章', daily.total, 4);
eq('dailyCounts 最后一天 2 篇', daily.days[29].n, 2);
ok('dailyCounts 无 NaN', daily.days.every((d) => Number.isFinite(d.n)));

const rank = categoryCounts(posts, cats, 3);
eq('categoryCounts 按数量降序并限流', rank.map((x) => [x.name, x.value]), [
  ['软件工程', 2], ['数学', 1], ['读书', 1]
]);

const matrix = categoryTagMatrix(posts, cats, tags, 3, 3);
eq('矩阵行数等于分类数', matrix.matrix.length, matrix.cats.length);
eq('矩阵列数等于标签数', matrix.matrix[0]?.length, matrix.tags.length);
eq('软件工程 × JavaScript = 2', matrix.matrix[matrix.cats.indexOf('软件工程')][matrix.tags.indexOf('JavaScript')], 2);

const monthly = monthlyByCategory(posts, cats, 12, 4);
eq('monthly 返回 12 个月', monthly.months.length, 12);
ok('monthly 至少有一条序列', monthly.series.length >= 1, JSON.stringify(monthly.series));
ok('monthly 每条序列长度正确', monthly.series.every((s) => s.values.length === 12));

console.log('\n— B. 组件渲染与数据更新 —');
const doc = installDom();
const M = await loadPanel();
const host = doc.createElement('div');
doc.body.appendChild(host);

M.render(M.h(M.ContentChartsPanel, { posts, cats, tags }), host);
await new Promise((r) => setTimeout(r, 120));

const canvases = host.querySelectorAll('canvas');
ok('四张图表卡片对应 4 个 canvas', canvases.length === 4, `实际 ${canvases.length}`);
ok('每个 canvas 都有绘制调用', canvases.every((c) => c.__ctx.ops.length > 0),
  JSON.stringify(canvases.map((c) => c.__ctx.ops.length)));
ok('canvas 绘制了真实分类名', canvases.some((c) => c.__ctx.ops.some((o) => o.name === 'fillText' && o.args[0] === '软件工程')));
// 轴标签超过 5 字会截断（避免 7×7 柱阵文字重叠），断言真实截断结果。
ok('canvas 绘制了真实标签名（按设计截断）',
  canvases[2].__ctx.ops.some((o) => o.name === 'fillText' && o.args[0] === 'JavaS…'),
  JSON.stringify(canvases.map(dumpTexts)));

// 用完全不同的数据重渲染同一个组件实例，确认 drawRef 没有把旧闭包锁死。
const newCats = [{ id: 'n1', name: '新分类' }, { id: 'n2', name: '另一个分类' }, { id: 'n3', name: '第三分类' }];
const newTags = [{ id: 'n4', name: '新标签' }];
const newPosts = [{ status: 'published', published_at: ago(0), category_id: 'n1', tag_ids: ['n4'] }];
M.render(M.h(M.ContentChartsPanel, { posts: newPosts, cats: newCats, tags: newTags }), host);
await new Promise((r) => setTimeout(r, 120));
const refreshed = host.querySelectorAll('canvas');
ok('props 更新后重绘新分类', refreshed.some((c) => c.__ctx.ops.some((o) => o.name === 'fillText' && o.args[0] === '新分类')));
ok('props 更新后不再只画旧分类', refreshed.some((c) => c.__ctx.ops.some((o) => o.name === 'fillText' && o.args[0] === '新标签')));

M.render(null, host);
console.log('\n' + '='.repeat(56));
console.log(`结果：${pass} 过 / ${failures.length} 失败`);
if (failures.length) {
  console.log(failures.map((f) => `  - ${f}`).join('\n'));
  process.exitCode = 1;
}
// rAF 循环仍在后台等待；探针结束后显式退出，避免拖住事件循环。
process.exit(failures.length ? 1 : 0);
