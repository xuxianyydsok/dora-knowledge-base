// epubReader.js 的真实文件探针（Node 24）
//
// 目的：
//   1. 用 /mnt/d/books/books2 下的真实 EPUB 验证 openEpub 的解析结果；
//   2. 验证 loadChapter 产出的 HTML 里没有 script / on* 事件属性 / 外部资源引用；
//   3. 验证「只 open 不 loadChapter」时 JS 堆增量远小于文件体积（没有整本解压）。
//
// Node 没有 DOMParser，这里内置一个最小 DOM 实现（只覆盖 epubReader.js 用到的 API：
// querySelector(All) 的「标签名 / 逗号列表 / [attr]」选择器、attributes、textContent、
// remove / replaceWith、innerHTML、createElement）。它只是测试替身，不参与产品运行。

import { readFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';

// ------------------------------------------------------------------ 最小 DOM

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW_TEXT_TAGS = new Set(['script', 'style']);

function decodeEntitiesMin(s) {
  return String(s == null ? '' : s).replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (Number.isFinite(code) && code > 0) { try { return String.fromCodePoint(code); } catch { return m; } }
      return m;
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }[e] ?? m;
  });
}

class DomNode {
  constructor() { this.parentNode = null; }
}

class DomText extends DomNode {
  constructor(data) { super(); this.nodeType = 3; this.data = String(data); }
  get textContent() { return this.data; }
  set textContent(v) { this.data = String(v == null ? '' : v); }
}

class DomElement extends DomNode {
  constructor(tag) {
    super();
    this.nodeType = 1;
    this.tagName = String(tag).toUpperCase();
    this.attributes = [];
    this.childNodes = [];
  }

  get localName() { return this.tagName.toLowerCase(); }
  getAttribute(name) { const n = String(name).toLowerCase(); const a = this.attributes.find((x) => x.name === n); return a ? a.value : null; }
  hasAttribute(name) { const n = String(name).toLowerCase(); return this.attributes.some((x) => x.name === n); }
  setAttribute(name, value) {
    const n = String(name).toLowerCase();
    const a = this.attributes.find((x) => x.name === n);
    if (a) a.value = String(value); else this.attributes.push({ name: n, value: String(value) });
  }
  removeAttribute(name) { const n = String(name).toLowerCase(); this.attributes = this.attributes.filter((x) => x.name !== n); }

  get textContent() { let out = ''; for (const c of this.childNodes) out += c.textContent; return out; }
  set textContent(v) {
    this.childNodes = [];
    const s = String(v == null ? '' : v);
    if (s) this.childNodes.push(new DomText(s));
  }

  get innerHTML() { return serializeChildren(this); }
  set innerHTML(html) {
    this.childNodes = [];
    for (const c of parseHtmlDocument(String(html)).childNodes) this.appendChild(c);
  }

  appendChild(node) { node.parentNode = this; this.childNodes.push(node); return node; }

  remove() {
    if (!this.parentNode) return;
    const p = this.parentNode;
    const i = p.childNodes.indexOf(this);
    if (i >= 0) p.childNodes.splice(i, 1);
    this.parentNode = null;
  }

  replaceWith(...nodes) {
    if (!this.parentNode) return;
    const p = this.parentNode;
    const i = p.childNodes.indexOf(this);
    if (i < 0) return;
    const list = [];
    for (const n of nodes) {
      if (typeof n === 'string') list.push(new DomText(n));
      else if (n) list.push(n);
    }
    for (const n of list) n.parentNode = p;
    p.childNodes.splice(i, 1, ...list);
    this.parentNode = null;
  }
}

class DomDocument extends DomNode {
  constructor() { super(); this.nodeType = 9; this.childNodes = []; }

  createElement(tag) { return new DomElement(tag); }
  createTextNode(s) { return new DomText(s); }
  appendChild(node) { node.parentNode = this; this.childNodes.push(node); return node; }

  get body() {
    let body = this.querySelector('body');
    if (!body) {
      body = new DomElement('body');
      const rest = this.childNodes.slice();
      this.childNodes = [];
      this.appendChild(body);
      for (const c of rest) body.appendChild(c);
    }
    return body;
  }

  querySelector(sel) { return this.walk(sel, true); }
  querySelectorAll(sel) { return this.walk(sel, false); }

  walk(sel, first) {
    const sels = String(sel).split(',').map((s) => s.trim()).filter(Boolean);
    const out = [];
    const visit = (node) => {
      for (const c of node.childNodes) {
        if (c.nodeType !== 1) continue;
        if (sels.some((s) => matchesSel(c, s))) {
          if (first) { out.push(c); return true; }
          out.push(c);
        }
        if (visit(c)) return true;
      }
      return false;
    };
    visit(this);
    return first ? (out[0] || null) : out;
  }
}

function matchesSel(el, sel) {
  if (sel === '*') return true;
  if (sel.startsWith('[') && sel.endsWith(']')) return el.hasAttribute(sel.slice(1, -1).trim());
  return el.tagName.toLowerCase() === sel.toLowerCase();
}

function parseAttrs(str) {
  const out = [];
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(str))) {
    out.push({ name: m[1].toLowerCase(), value: decodeEntitiesMin(m[3] ?? m[4] ?? m[5] ?? '') });
  }
  return out;
}

function parseHtmlDocument(html) {
  const doc = new DomDocument();
  const stack = [doc];
  const src = String(html);
  let i = 0;

  // 普通文本按浏览器行为先做实体解码（序列化时会再转义回 &amp;）；
  // <style>/<script> 走 RAW_TEXT 分支，不做解码。
  const addText = (text) => { if (text) stack[stack.length - 1].childNodes.push(new DomText(decodeEntitiesMin(text))); };

  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt < 0) { addText(src.slice(i)); break; }
    if (lt > i) addText(src.slice(i, lt));

    if (src.startsWith('<!--', lt)) { const e = src.indexOf('-->', lt + 4); i = e < 0 ? src.length : e + 3; continue; }
    if (src.startsWith('<!', lt) || src.startsWith('<?', lt)) { const e = src.indexOf('>', lt); i = e < 0 ? src.length : e + 1; continue; }

    if (src.startsWith('</', lt)) {
      const e = src.indexOf('>', lt);
      if (e < 0) { i = src.length; break; }
      const name = src.slice(lt + 2, e).trim().toLowerCase().split(/[\s/]/)[0];
      for (let k = stack.length - 1; k >= 1; k--) {
        if (stack[k].tagName.toLowerCase() === name) { stack.length = k; break; }
      }
      i = e + 1;
      continue;
    }

    const m = /^<([a-zA-Z][a-zA-Z0-9:-]*)/.exec(src.slice(lt));
    if (!m) { addText('<'); i = lt + 1; continue; }
    const tag = m[1].toLowerCase();

    let j = lt + m[0].length;
    let attrStr = '';
    while (j < src.length) {
      const ch = src[j];
      if (ch === '"' || ch === "'") {
        const k = src.indexOf(ch, j + 1);
        if (k < 0) { j = src.length; break; }
        attrStr += src.slice(j, k + 1);
        j = k + 1;
        continue;
      }
      if (ch === '>') break;
      attrStr += ch;
      j++;
    }
    let selfClose = false;
    if (j > lt && src[j - 1] === '/') { selfClose = true; attrStr = attrStr.slice(0, -1); }

    const el = new DomElement(tag);
    for (const a of parseAttrs(attrStr)) el.attributes.push(a);
    stack[stack.length - 1].appendChild(el);
    i = j + 1;

    if (RAW_TEXT_TAGS.has(tag) && !selfClose) {
      const cm = new RegExp(`</${tag}\\s*>`, 'i').exec(src.slice(i));
      const content = cm ? src.slice(i, i + cm.index) : src.slice(i);
      if (content) el.childNodes.push(new DomText(content));
      i = cm ? i + cm.index + cm[0].length : src.length;
      continue;
    }
    if (!VOID_TAGS.has(tag) && !selfClose) stack.push(el);
  }
  return doc;
}

function escapeText(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escapeAttr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }

function serializeChildren(el) {
  let out = '';
  for (const c of el.childNodes) out += serializeNode(c, el);
  return out;
}

function serializeNode(node, parent) {
  if (node.nodeType === 3) {
    const p = parent && parent.tagName.toLowerCase();
    if (p === 'style' || p === 'script') return node.data;
    return escapeText(node.data);
  }
  const tag = node.tagName.toLowerCase();
  let out = '<' + tag;
  for (const a of node.attributes) out += ' ' + a.name + '="' + escapeAttr(a.value) + '"';
  out += '>';
  if (VOID_TAGS.has(tag)) return out;
  return out + serializeChildren(node) + '</' + tag + '>';
}

export class ProbeDOMParser {
  parseFromString(html) { return parseHtmlDocument(html); }
}

globalThis.DOMParser = ProbeDOMParser;

// 被其它脚本 import 时只提供 DOM shim，不跑下面的探针
const isMain = process.argv[1] && process.argv[1].endsWith('epubReader.probe.mjs');
if (!isMain) {
  // 作为模块导入：到此为止
} else {

// ------------------------------------------------------------------ 探针

const BOOKS = [
  '/mnt/d/books/books2/盗墓笔记（全集）.epub',
  '/mnt/d/books/books2/三体 （典藏版·三册）.epub'
];

const { openEpub } = await import('../src/lib/epubReader.js');

function line(label, value) { console.log(label + ': ' + value); }
function section(t) { console.log('\n' + '='.repeat(60) + '\n' + t + '\n' + '='.repeat(60)); }

// 独立读一遍中央目录，统计「若全部解压」的总大小，作为内存对照基线
function zipStats(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) { if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  const cdOff = buf.readUInt32LE(eocd + 16);
  let p = cdOff;
  let totalUncompressed = 0;
  for (let k = 0; k < count; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    totalUncompressed += buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { count, totalUncompressed };
}

async function probeBook(path) {
  section('EPUB 探针  ' + basename(path));
  if (!existsSync(path)) { console.log('文件不存在，跳过'); return; }

  const buf = readFileSync(path);
  line('文件大小', (buf.byteLength / 1024 / 1024).toFixed(1) + ' MB');
  const zs = zipStats(buf);
  if (zs) {
    line('zip 条目数', zs.count);
    line('若全部解压的总大小', (zs.totalUncompressed / 1024 / 1024).toFixed(1) + ' MB（对照基线）');
  }

  const book = await openEpub(new Blob([buf]));
  line('metadata', JSON.stringify(book.metadata));
  line('chapters.length', book.chapters.length);
  line('前 5 章标题', JSON.stringify(book.chapters.slice(0, 5).map((c) => c.title)));
  line('coverUrl', book.coverUrl ? book.coverUrl.slice(0, 48) + '...' : 'null（未找到封面）');

  if (book.chapters.length) {
    const first = await book.loadChapter(0);
    const html = first.html;
    line('第 1 章 html 长度', html.length);
    line('  含 script 标签', /<script/i.test(html));
    line('  含 on* 事件属性', /\son[a-z]+\s*=/i.test(html));
    const httpAll = (html.match(/https?:\/\//gi) || []).length;
    const httpSrc = (html.match(/(?:src|poster)\s*=\s*["']https?:\/\//gi) || []).length
      + (html.match(/url\(\s*["']?https?:\/\//gi) || []).length;
    line('  含 http(s) 引用总数', httpAll);
    line('  其中位于 src/poster/url()（应为 0）', httpSrc);
    line('  含 blob: 资源', (html.match(/blob:/g) || []).length);
  }

  if (global.gc) global.gc();
  const before = process.memoryUsage().heapUsed;
  const light = await openEpub(new Blob([buf]));
  const after = process.memoryUsage().heapUsed;
  line('仅 open 的 heapUsed 增量', ((after - before) / 1024 / 1024).toFixed(2) + ' MB（章节 ' + light.chapters.length + '，封面 ' + (light.coverUrl ? '有' : '无') + '）');
  line('增量 / 文件大小', ((after - before) / buf.byteLength * 100).toFixed(3) + ' %');
  if (zs) line('增量 / 全部解压后总大小', ((after - before) / zs.totalUncompressed * 100).toFixed(3) + ' %');
  light.dispose();
  book.dispose();
}

for (const p of BOOKS) {
  try {
    await probeBook(p);
  } catch (err) {
    console.error('探针失败 ' + basename(p) + '：', err && err.message ? err.message : err);
  }
}
console.log('\n探针结束。');
}
