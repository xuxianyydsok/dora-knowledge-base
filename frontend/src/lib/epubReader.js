// EPUB 站内阅读器（零依赖，只用标准 Web API）
//
// 设计取舍：
//   1. 不引入第三方库（仓库禁止 npm install）。zip 只实现「中央目录 + 按需解压单个条目」，
//      绝不做全量解压，避免把几十 MB 的图集一次性读进内存。
//   2. 输入优先用 Blob / File：读取时按 Range 调 blob.slice()，由运行时负责分页，
//      JS 堆里只留中央目录和当前解压出的条目。
//   3. 章节 XHTML 必须清洗后再交给宿主渲染。EPUB 等同于用户上传的 HTML，
//      不清洗就是存储型 XSS（思路同 lib/sanitizeHtml.js，但这里还要把 zip 内资源重写成 blob URL）。
//   4. 图片 / CSS 等 zip 内资源解压后转 blob: URL 并缓存，dispose() 时统一 revoke。
//
// 环境要求：DecompressionStream('deflate-raw')
//   Chrome / Edge 103+，Firefox 113+，Safari 16.4+，Node 18+。

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const ZIP64 = 0xffffffff;

// ---------------------------------------------------------------- 基础读取

function u16(b, o) {
  return b[o] | (b[o + 1] << 8);
}

function u32(b, o) {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
}

function u64(b, o) {
  return u32(b, o) + u32(b, o + 4) * 0x100000000;
}

const UTF8 = new TextDecoder('utf-8');

function decodeText(bytes) {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) {
    return UTF8.decode(b.subarray(3));
  }
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) {
    try { return new TextDecoder('utf-16le').decode(b.subarray(2)); } catch { /* 退回 utf-8 */ }
  }
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) {
    try { return new TextDecoder('utf-16be').decode(b.subarray(2)); } catch { /* 退回 utf-8 */ }
  }
  return UTF8.decode(b);
}

// ---------------------------------------------------------------- 路径工具

// zip 内路径归一化：反斜杠转正斜杠、去 query/fragment、逐段 URL 解码、消解 ".."
function normZipPath(input) {
  let s = String(input == null ? '' : input).replace(/\\/g, '/');
  const hash = s.indexOf('#');
  if (hash >= 0) s = s.slice(0, hash);
  const q = s.indexOf('?');
  if (q >= 0) s = s.slice(0, q);

  const out = [];
  for (const raw of s.split('/')) {
    if (raw === '' || raw === '.') continue;
    if (raw === '..') { out.pop(); continue; }
    let seg = raw;
    try { seg = decodeURIComponent(raw); } catch { /* 非法百分号编码：保留原样 */ }
    out.push(seg);
  }
  return out.join('/');
}

function dirOf(p) {
  const s = String(p || '');
  const i = s.lastIndexOf('/');
  return i < 0 ? '' : s.slice(0, i);
}

// 相对路径拼接；外部地址（带协议或 //）返回空串
function joinPath(baseDir, rel) {
  const r = String(rel == null ? '' : rel).trim();
  if (!r) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(r) || r.startsWith('//')) return '';
  if (r.startsWith('/')) return r.slice(1);
  return (baseDir ? `${baseDir}/` : '') + r;
}

// ---------------------------------------------------------------- XML 小工具

function decodeEntities(s) {
  return String(s == null ? '' : s).replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos|nbsp);/g, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (Number.isFinite(code) && code > 0) {
        try { return String.fromCodePoint(code); } catch { return m; }
      }
      return m;
    }
    if (e === 'nbsp') return '\u00a0';
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e] ?? m;
  });
}

// 从标签的属性串里取某个属性值
function attrOf(attrStr, name) {
  const re = new RegExp(`(?:^|[\\s"'/])${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i');
  const m = String(attrStr || '').match(re);
  return m ? decodeEntities(m[2] ?? m[3] ?? '') : '';
}

function stripTags(s) {
  return decodeEntities(String(s || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function firstTagText(xml, local) {
  const re = new RegExp(`<(?:[\\w.-]+:)?${local}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${local}\\s*>`, 'i');
  const m = String(xml || '').match(re);
  return m ? stripTags(m[1]) : '';
}

// ---------------------------------------------------------------- 压缩

async function inflateRaw(bytes) {
  if (!bytes || bytes.length === 0) return new Uint8Array(0);
  if (typeof DecompressionStream !== 'function') {
    throw new Error('当前环境不支持 DecompressionStream，无法解压 EPUB');
  }
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Response(bytes).body.pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ---------------------------------------------------------------- MIME

const MIME_BY_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', jpe: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp',
  svg: 'image/svg+xml', ico: 'image/x-icon',
  css: 'text/css', xhtml: 'application/xhtml+xml', html: 'text/html', htm: 'text/html',
  xml: 'application/xml', ncx: 'application/x-dtbncx+xml', js: 'text/javascript',
  ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg',
  mp4: 'video/mp4', webm: 'video/webm'
};

function mimeOf(path, mediaType) {
  if (mediaType && /^[\w.+-]+\/[\w.+-]+$/.test(mediaType)) return mediaType;
  const ext = String(path || '').split('.').pop().toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

// ---------------------------------------------------------------- 阅读器

/**
 * 打开一本 EPUB。
 * @param {File|Blob|ArrayBuffer|Uint8Array} input
 * @returns {Promise<{
 *   metadata: { title: string, author: string, language: string, publisher: string },
 *   chapters: Array<{ id: string, href: string, title: string }>,
 *   coverUrl: string|null,
 *   loadChapter: (index: number) => Promise<{ html: string }>,
 *   dispose: () => void
 * }>}
 */
export async function openEpub(input) {
  const source = makeSource(input);
  const entries = await readCentralDirectory(source);

  // 查找索引：原样名 / 归一化名 / 小写名 都能命中
  const index = new Map();
  for (const e of entries) {
    if (!index.has(e.name)) index.set(e.name, e);
    const key = normZipPath(e.name);
    if (key && !index.has(key)) index.set(key, e);
    const lower = key.toLowerCase();
    if (lower && !index.has(lower)) index.set(lower, e);
  }

  function findEntry(path) {
    const key = normZipPath(path);
    if (!key) return null;
    return index.get(key) || index.get(key.toLowerCase()) || null;
  }

  // ---- 单条目解压（读 local header 拿数据起点）----
  async function readEntry(entry) {
    if (!entry) throw new Error('zip 条目不存在');
    const lh = await source.read(entry.localOff, entry.localOff + 30);
    if (lh.length < 30 || u32(lh, 0) !== SIG_LOCAL) {
      throw new Error(`zip 局部头损坏：${entry.name}`);
    }
    const nameLen = u16(lh, 26);
    const extraLen = u16(lh, 28);
    const dataStart = entry.localOff + 30 + nameLen + extraLen;
    const raw = await source.read(dataStart, dataStart + entry.compSize);
    if (entry.method === 0) return raw;
    if (entry.method === 8) return inflateRaw(raw);
    throw new Error(`不支持的 zip 压缩算法 method=${entry.method}`);
  }

  // ---- zip 内资源 → blob URL（带缓存 + 统一回收）----
  const blobUrls = new Map();
  const createdUrls = new Set();

  async function blobUrlFor(path) {
    const key = normZipPath(path);
    if (!key) return '';
    if (blobUrls.has(key)) return blobUrls.get(key);
    const entry = findEntry(key);
    if (!entry) return '';
    let bytes;
    try {
      bytes = await readEntry(entry);
    } catch {
      return '';
    }
    const url = URL.createObjectURL(new Blob([bytes], { type: mimeOf(key, entry.mediaType) }));
    blobUrls.set(key, url);
    createdUrls.add(url);
    return url;
  }

  // 把 EPUB 里的相对引用解析成 blob URL；外部 http(s) 一律返回空串（不加载）
  async function resolveResourceUrl(raw, basePath) {
    const u = String(raw == null ? '' : raw).trim();
    if (!u) return '';
    if (/^blob:/i.test(u)) return u;
    if (/^data:/i.test(u)) return /^data:image\//i.test(u) ? u : '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith('//')) return '';
    if (u.startsWith('#')) return u;
    return blobUrlFor(normZipPath(joinPath(dirOf(basePath), u)));
  }

  // <a> 的 href 分类：
  //   external → 原样保留（新窗口打开）
  //   fragment → 保留（章节内锚点）
  //   internal → 去掉 href，改写为 data-epub-href（zip 内路径）。
  //     单章渲染无法直接跳转，交给宿主读 data-epub-href 自行翻章，避免点出 404。
  function classifyLink(raw, basePath) {
    const u = String(raw == null ? '' : raw).trim();
    if (!u) return { kind: 'none', href: '', fragment: '' };
    if (u.startsWith('#')) return { kind: 'fragment', href: u, fragment: u.slice(1) };
    if (/^https?:/i.test(u) || /^mailto:/i.test(u)) return { kind: 'external', href: u, fragment: '' };
    if (/^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith('//')) return { kind: 'none', href: '', fragment: '' };
    const hash = u.indexOf('#');
    const fragment = hash >= 0 ? u.slice(hash + 1) : '';
    const path = normZipPath(joinPath(dirOf(basePath), hash >= 0 ? u.slice(0, hash) : u));
    if (!path) return { kind: 'none', href: '', fragment: '' };
    return { kind: 'internal', href: path, fragment };
  }

  // ---- 定位 OPF ----
  let opfPath = '';
  const containerEntry = findEntry('META-INF/container.xml');
  if (containerEntry) {
    const xml = decodeText(await readEntry(containerEntry));
    const m = xml.match(/<rootfile\b[^>]*\bfull-path\s*=\s*("([^"]*)"|'([^']*)')/i);
    if (m) opfPath = normZipPath(m[2] ?? m[3] ?? '');
  }
  if (!opfPath || !findEntry(opfPath)) {
    const cand = entries.find((e) => /\.opf$/i.test(e.name));
    if (cand) opfPath = normZipPath(cand.name);
  }
  if (!opfPath) throw new Error('不是有效的 EPUB：找不到 OPF 文件');

  const opfEntry = findEntry(opfPath);
  const opf = decodeText(await readEntry(opfEntry));
  const opfDir = dirOf(opfPath);

  const metadata = {
    title: firstTagText(opf, 'title'),
    author: firstTagText(opf, 'creator'),
    language: firstTagText(opf, 'language'),
    publisher: firstTagText(opf, 'publisher')
  };

  // ---- manifest ----
  const manifest = new Map();
  for (const m of opf.matchAll(/<(?:\w+:)?item\b([^>]*?)\/?>/gi)) {
    const attrs = m[1];
    const id = attrOf(attrs, 'id');
    const href = attrOf(attrs, 'href');
    if (!id || !href) continue;
    manifest.set(id, {
      id,
      href,
      mediaType: attrOf(attrs, 'media-type'),
      properties: attrOf(attrs, 'properties')
    });
  }

  // ---- spine ----
  const spineIds = [];
  const spineTag = opf.match(/<(?:\w+:)?spine\b([^>]*)>/i);
  const spineTocId = spineTag ? attrOf(spineTag[1], 'toc') : '';
  const spineBlock = opf.match(/<(?:\w+:)?spine\b[^>]*>([\s\S]*?)<\/(?:\w+:)?spine\s*>/i);
  if (spineBlock) {
    for (const m of spineBlock[1].matchAll(/<(?:\w+:)?itemref\b([^>]*?)\/?>/gi)) {
      const idref = attrOf(m[1], 'idref');
      if (idref) spineIds.push(idref);
    }
  }

  // ---- 目录（EPUB3 nav 优先，退回 EPUB2 NCX）----
  const tocMap = new Map();
  let navItem = null;
  let ncxItem = null;
  for (const it of manifest.values()) {
    if (/\bnav\b/.test(it.properties) && /xhtml/i.test(it.mediaType || '')) navItem = it;
    if (/dtbncx/i.test(it.mediaType || '')) ncxItem = it;
  }
  if (spineTocId && manifest.has(spineTocId)) ncxItem = manifest.get(spineTocId);

  if (navItem) {
    const navPath = normZipPath(joinPath(opfDir, navItem.href));
    const navEntry = findEntry(navPath);
    if (navEntry) {
      const xml = decodeText(await readEntry(navEntry));
      const navs = [...xml.matchAll(/<nav\b([^>]*)>([\s\S]*?)<\/nav\s*>/gi)];
      let block = '';
      for (const n of navs) {
        if (/type\s*=\s*["'][^"']*\btoc\b/i.test(n[1])) { block = n[2]; break; }
      }
      if (!block && navs.length) block = navs[0][2];
      for (const a of block.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
        const href = attrOf(a[1], 'href');
        const text = stripTags(a[2]);
        if (!href || !text) continue;
        const key = normZipPath(joinPath(dirOf(navPath), href));
        if (key && !tocMap.has(key)) tocMap.set(key, text);
      }
    }
  }

  if (tocMap.size === 0 && ncxItem) {
    const ncxPath = normZipPath(joinPath(opfDir, ncxItem.href));
    const ncxEntry = findEntry(ncxPath);
    if (ncxEntry) {
      const xml = decodeText(await readEntry(ncxEntry));
      // 逐个 navPoint 取「本点的 navLabel 文本 + 本点的 content src」。
      // 不能把全部 <text> 和全部 <content> 分别拉平按索引配对：文件头部的
      // <docTitle> 也是 <text>，会让整份目录标题错位一格。
      for (const np of xml.matchAll(/<navPoint\b[^>]*>([\s\S]*?)<\/navPoint\s*>/gi)) {
        const block = np[1];
        const label = block.match(/<navLabel\b[^>]*>([\s\S]*?)<\/navLabel\s*>/i);
        const text = label ? stripTags(label[1]) : '';
        const content = block.match(/<content\b[^>]*\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i);
        const src = content ? (content[2] ?? content[3] ?? '') : '';
        if (!text || !src) continue;
        const key = normZipPath(joinPath(dirOf(ncxPath), src));
        if (key && !tocMap.has(key)) tocMap.set(key, text);
      }
    }
  }

  // ---- 章节列表（按 spine 顺序）----
  const chapters = [];
  for (const idref of spineIds) {
    const item = manifest.get(idref);
    if (!item) continue;
    const path = normZipPath(joinPath(opfDir, item.href));
    const isHtml = /xhtml|html/i.test(item.mediaType || '') || /\.x?html?$/i.test(path);
    if (!isHtml && !findEntry(path)) continue;
    chapters.push({
      id: item.id,
      href: path,
      title: tocMap.get(path) || `第 ${chapters.length + 1} 章`
    });
  }

  // ---- 封面 ----
  let coverUrl = null;
  const coverPath = await findCoverPath();
  if (coverPath) {
    const url = await blobUrlFor(coverPath);
    coverUrl = url || null;
  }

  async function findCoverPath() {
    let href = '';
    // EPUB2：<meta name="cover" content="ID" />
    const meta = opf.match(/<(?:\w+:)?meta\b[^>]*\bname\s*=\s*["']cover["'][^>]*>/i);
    if (meta) {
      const cid = attrOf(meta[0], 'content');
      if (cid && manifest.has(cid)) href = manifest.get(cid).href;
    }
    // EPUB3：properties="cover-image"
    if (!href) {
      for (const it of manifest.values()) {
        if (/\bcover-image\b/.test(it.properties)) { href = it.href; break; }
      }
    }
    // 兜底：id / 文件名里含 cover 的图片
    if (!href) {
      for (const it of manifest.values()) {
        if (!/cover/i.test(it.id) && !/cover/i.test(it.href)) continue;
        if (/image/i.test(it.mediaType || '') || /\.(jpe?g|png|gif|webp|svg|avif)$/i.test(it.href)) { href = it.href; break; }
      }
    }
    if (!href) return '';

    const path = normZipPath(joinPath(opfDir, href));
    const entry = findEntry(path);
    if (!entry) return '';
    // 封面本身是 XHTML 页面时，取出里面第一张图
    if (/xhtml|html/i.test(entry.mediaType || '') || /\.x?html?$/i.test(path)) {
      const doc = new DOMParser().parseFromString(decodeText(await readEntry(entry)), 'text/html');
      const img = doc.querySelector('img, image');
      if (img) {
        const raw = img.getAttribute('src') || img.getAttribute('xlink:href') || img.getAttribute('href') || '';
        const inner = normZipPath(joinPath(dirOf(path), raw));
        if (inner && findEntry(inner)) return inner;
      }
      return '';
    }
    return path;
  }

  // ---------------------------------------------------------- 章节清洗 / 渲染

  // 连同内容一起删除的容器
  const DROP_TAGS = new Set([
    'script', 'iframe', 'object', 'embed', 'link', 'base', 'form', 'meta',
    'input', 'button', 'select', 'textarea', 'template', 'applet',
    'frame', 'frameset', 'source', 'track'
  ]);

  const DANGEROUS_PROTO = /^\s*(?:javascript|vbscript|livescript)\s*:|^\s*data:text\/html/i;

  function sanitize(doc) {
    // 逆序：先处理最深节点，父节点被删时子节点引用已用完
    for (const node of [...doc.querySelectorAll('*')].reverse()) {
      const tag = node.tagName.toLowerCase();
      if (DROP_TAGS.has(tag)) { node.remove(); continue; }
      for (const attr of [...node.attributes]) {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on')) { node.removeAttribute(attr.name); continue; }
        if (name === 'xmlns' || name.startsWith('xmlns:')) { node.removeAttribute(attr.name); continue; }
        if (name === 'srcset' || name === 'imagesrcset') { node.removeAttribute(attr.name); continue; }
      }
      for (const an of ['href', 'xlink:href', 'src', 'poster', 'action', 'formaction']) {
        const v = node.getAttribute(an);
        if (v != null && DANGEROUS_PROTO.test(v)) node.removeAttribute(an);
      }
    }
  }

  // CSS 里的 url(...) 重写为 blob URL；@import 直接剥掉（不发起外部请求）
  async function rewriteCssUrls(css, basePath) {
    let src = String(css || '').replace(/@import[^;]*;?/gi, '');
    const found = [];
    src = src.replace(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi, (full, _q, raw) => {
      const u = String(raw || '').trim();
      if (!u) return full;
      if (/^(?:data:|blob:|https?:|ftp:|#|\/\/)/i.test(u)) return full;
      found.push(u);
      return `\u0000${found.length - 1}\u0000`;
    });
    if (!found.length) return src;
    const resolved = await Promise.all(found.map(async (u) => {
      const url = await resolveResourceUrl(u, basePath);
      return url ? `url("${url}")` : 'none';
    }));
    return src.replace(/\u0000(\d+)\u0000/g, (m, i) => resolved[Number(i)] || 'none');
  }

  async function rewriteResources(doc, basePath) {
    // 章节自带的 <style>
    for (const st of [...doc.querySelectorAll('style')]) {
      st.textContent = await rewriteCssUrls(st.textContent || '', basePath);
    }
    // 内联 style="..."
    for (const el of [...doc.querySelectorAll('[style]')]) {
      const css = el.getAttribute('style') || '';
      if (/url\(/i.test(css)) el.setAttribute('style', await rewriteCssUrls(css, basePath));
    }
    // 图片 / 媒体资源
    for (const el of [...doc.querySelectorAll('img, image, video, audio')]) {
      const tag = el.tagName.toLowerCase();
      if (tag === 'image') {
        const an = el.hasAttribute('xlink:href') ? 'xlink:href' : (el.hasAttribute('href') ? 'href' : null);
        if (an) {
          const url = await resolveResourceUrl(el.getAttribute(an), basePath);
          if (url) el.setAttribute(an, url); else el.removeAttribute(an);
        }
        continue;
      }
      const rawSrc = el.getAttribute('src');
      if (rawSrc != null) {
        const url = await resolveResourceUrl(rawSrc, basePath);
        if (url) el.setAttribute('src', url); else el.removeAttribute('src');
      }
      const rawPoster = el.getAttribute('poster');
      if (rawPoster != null) {
        const url = await resolveResourceUrl(rawPoster, basePath);
        if (url) el.setAttribute('poster', url); else el.removeAttribute('poster');
      }
    }
    // 链接：外链新窗口 + noopener；站内章节链接改成 data-epub-href 交给宿主翻章
    for (const a of [...doc.querySelectorAll('a')]) {
      const { kind, href, fragment } = classifyLink(a.getAttribute('href'), basePath);
      a.removeAttribute('target');
      if (kind === 'external') {
        a.setAttribute('href', href);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      } else if (kind === 'fragment') {
        a.setAttribute('href', href);
      } else if (kind === 'internal') {
        a.removeAttribute('href');
        a.setAttribute('data-epub-href', href);
        if (fragment) a.setAttribute('data-epub-fragment', fragment);
      } else {
        a.removeAttribute('href');
      }
    }
  }

  // 基础排版：中文正文字体栈 + 1.8 行高 + 42em 栏宽；
  // 所有可调项都走 CSS 变量（--epub-font / --epub-size / --epub-lh / --epub-maxw /
  // --epub-columns / --epub-bg / --epub-fg），宿主注入的样式表可以整体覆盖，
  // 这样改字号 / 字体 / 背景 / 双页都不用重新解压章节（滚动位置也不会丢）。
  const BASE_CSS = `
:root {
  --epub-bg:#ffffff;
  --epub-fg:#1c1e21;
  --epub-link:#1a6fd4;
  --epub-font:"Noto Serif SC","Source Han Serif SC","Songti SC","SimSun",Georgia,serif;
  --epub-size:17px;
  --epub-lh:1.8;
  --epub-maxw:42em;
  --epub-columns:1;
  --epub-gap:2.4rem;
  --epub-pad:1.25rem 1.1rem 3.5rem;
}
html { box-sizing: border-box; }
*, *::before, *::after { box-sizing: inherit; }
html, body { margin:0; padding:0; }
body {
  background: var(--epub-bg);
  color: var(--epub-fg);
  font-family: var(--epub-font);
  font-size: var(--epub-size);
  line-height: var(--epub-lh);
  max-width: var(--epub-maxw);
  margin: 0 auto;
  padding: var(--epub-pad);
  word-wrap: break-word;
  overflow-wrap: break-word;
  -webkit-text-size-adjust: 100%;
}
/* 双页模式：正文按 CSS 多栏排版（两栏并排，像摊开的书）。
   滚动方向仍然是纵向，所以触屏 / 滚轮 / 方向键的行为和单栏完全一致。
   单栏时 --epub-columns:1，下面这些声明等价于没写。 */
body {
  column-count: var(--epub-columns);
  column-gap: var(--epub-gap);
}
body.bk-cols-2 {
  max-width: none;
  column-fill: balance;
  column-rule: 1px solid color-mix(in srgb, var(--epub-fg) 14%, transparent);
}
body.bk-cols-2 > * { break-inside: auto; }
body.bk-cols-2 img { break-inside: avoid; }
img, image, svg, video, canvas { max-width: 100%; height: auto; }
h1, h2, h3, h4, h5, h6 { line-height: 1.35; }
a { color: var(--epub-link); }
pre { overflow-x: auto; }
table { max-width: 100%; }
`;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function buildDoc({ title, lang, bodyHtml, css, extraCss }) {
    // 顺序：先书自带的 CSS，再基础排版。基础排版放最后，
    // 保证「中文字体栈 / 行高 1.8 / 42em 栏宽」不会被书里的 body 规则覆盖。
    // extraCss 是宿主（阅读器设置面板）注入的，必须排在最后才能覆盖上面两层。
    return '<!doctype html>\n'
      + `<html lang="${esc(lang || 'zh')}">\n<head>\n`
      + '<meta charset="utf-8">\n'
      + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
      + `<title>${esc(title)}</title>\n`
      + (css ? `<style>${css}</style>\n` : '')
      + `<style>${BASE_CSS}</style>\n`
      + (extraCss ? `<style>${extraCss}</style>\n` : '')
      + '</head>\n<body>\n'
      + (bodyHtml || '')
      + '\n</body>\n</html>';
  }

  async function loadChapter(index, opts) {
    const extraCss = (opts && opts.extraCss) || '';
    const ch = chapters[index];
    if (!ch) {
      return { html: buildDoc({ title: '', lang: metadata.language, bodyHtml: '<p>章节不存在</p>', extraCss }) };
    }

    const entry = findEntry(ch.href);
    if (!entry) {
      return { html: buildDoc({ title: ch.title, lang: metadata.language, bodyHtml: '<p>本章内容缺失</p>', extraCss }) };
    }

    const doc = new DOMParser().parseFromString(decodeText(await readEntry(entry)), 'text/html');

    // 先把 <link rel=stylesheet> 换成内联 <style>（CSS 也在 zip 里）
    for (const link of [...doc.querySelectorAll('link')]) {
      const rel = (link.getAttribute('rel') || '').toLowerCase();
      const href = link.getAttribute('href') || '';
      if (rel.includes('stylesheet') && href && !/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith('//')) {
        const cssPath = normZipPath(joinPath(dirOf(ch.href), href));
        const cssEntry = findEntry(cssPath);
        if (cssEntry) {
          const cssText = await rewriteCssUrls(decodeText(await readEntry(cssEntry)), cssPath);
          const style = doc.createElement('style');
          style.textContent = cssText;
          link.replaceWith(style);
          continue;
        }
      }
      link.remove();
    }

    sanitize(doc);
    await rewriteResources(doc, ch.href);

    const headCss = [...doc.querySelectorAll('style')].map((s) => s.textContent || '').join('\n');
    for (const st of [...doc.querySelectorAll('style')]) st.remove();

    const titleEl = doc.querySelector('title');
    const bodyHtml = doc.body ? doc.body.innerHTML : '';
    return {
      html: buildDoc({
        title: (titleEl && titleEl.textContent || ch.title || metadata.title || '').trim(),
        lang: metadata.language,
        bodyHtml,
        css: headCss,
        extraCss
      })
    };
  }

  function dispose() {
    for (const url of createdUrls) {
      try { URL.revokeObjectURL(url); } catch { /* 忽略 */ }
    }
    createdUrls.clear();
    blobUrls.clear();
  }

  return { metadata, chapters, coverUrl, loadChapter, dispose };
}

// ---------------------------------------------------------------- zip 解析

// 统一输入为「可随机读取的字节源」，Blob / File 走 slice，其余走内存视图
function makeSource(input) {
  if (input && typeof input.slice === 'function' && typeof input.arrayBuffer === 'function' && typeof input.size === 'number') {
    return {
      size: input.size,
      read: async (start, end) => new Uint8Array(await input.slice(start, end).arrayBuffer())
    };
  }
  let view;
  if (input instanceof ArrayBuffer) view = new Uint8Array(input);
  else if (ArrayBuffer.isView(input)) view = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  else throw new Error('openEpub：输入必须是 File / Blob / ArrayBuffer / Uint8Array');

  return {
    size: view.byteLength,
    read: async (start, end) => view.subarray(start, end)
  };
}

// 从尾部找 EOCD，再读中央目录
async function readCentralDirectory(source) {
  const tailLen = Math.min(source.size, 66000);
  if (source.size < 22) throw new Error('不是有效的 EPUB/ZIP：文件过小');
  const tailStart = source.size - tailLen;
  const tail = await source.read(tailStart, source.size);

  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (u32(tail, i) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('不是有效的 EPUB/ZIP：找不到中央目录结尾记录');

  const entryCount = u16(tail, eocd + 10);
  const cdSize = u32(tail, eocd + 12);
  const cdOff = u32(tail, eocd + 16);
  if (cdSize === ZIP64 || cdOff === ZIP64) {
    throw new Error('暂不支持 ZIP64 格式的 EPUB');
  }

  const cd = await source.read(cdOff, cdOff + cdSize);
  const entries = [];
  let p = 0;
  while (p + 46 <= cd.length && u32(cd, p) === SIG_CENTRAL) {
    const flags = u16(cd, p + 8);
    const method = u16(cd, p + 10);
    let compSize = u32(cd, p + 20);
    let uncompSize = u32(cd, p + 24);
    const nameLen = u16(cd, p + 28);
    const extraLen = u16(cd, p + 30);
    const commentLen = u16(cd, p + 32);
    let localOff = u32(cd, p + 42);
    const name = decodeText(cd.subarray(p + 46, p + 46 + nameLen));

    if (compSize === ZIP64 || uncompSize === ZIP64 || localOff === ZIP64) {
      const extra = cd.subarray(p + 46 + nameLen, p + 46 + nameLen + extraLen);
      let q = 0;
      while (q + 4 <= extra.length) {
        const id = u16(extra, q);
        const len = u16(extra, q + 2);
        if (id === 0x0001) {
          let r = q + 4;
          if (uncompSize === ZIP64 && r + 8 <= extra.length) { uncompSize = u64(extra, r); r += 8; }
          if (compSize === ZIP64 && r + 8 <= extra.length) { compSize = u64(extra, r); r += 8; }
          if (localOff === ZIP64 && r + 8 <= extra.length) { localOff = u64(extra, r); r += 8; }
          break;
        }
        q += 4 + len;
      }
    }

    if (!name.endsWith('/')) {
      entries.push({ name, method, compSize, uncompSize, localOff, flags });
    }
    p += 46 + nameLen + extraLen + commentLen;
    if (entries.length >= entryCount && entryCount > 0) break;
  }

  if (!entries.length) throw new Error('不是有效的 EPUB/ZIP：中央目录为空');
  return entries;
}
