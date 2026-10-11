// 电子书封面 / 元数据提取（零依赖，纯 Web API，Workers 与 Node 18+ 双端可跑）
//
// 设计取舍：
//   1. 入参是「随机读取字节源」ByteSource，不是整本书的 bytes。
//      Worker 内存上限 128MB，一本书可能有 80~100MB，整本读进来会直接 OOM；
//      所以本模块只按需 range 读取少量字节（几 KB ~ 几 MB），用完即弃。
//   2. 零依赖：zip 解压只用 DecompressionStream('deflate-raw')，
//      不使用 node:zlib / Buffer / fs，同一份代码在 Workers 与 Node 里都能跑（便于离线单测）。
//   3. 永不抛异常：任何解析失败都退化成 null 字段，由调用方兜底（例如拿文件名当标题）。
//   4. 支持四种格式：
//        - EPUB：最小 zip 中央目录解析 + OPF(container.xml → .opf) 取封面 / 书名 / 作者
//        - PDF ：扫描前两段共 16MB，抽第一张 > 8KB 的 DCTDecode(JPEG) 图当封面
//        - MOBI / AZW3：PalmDB 记录表 + PalmDOC/MOBI header + EXTH（201 封面偏移 / 100 作者 / 503 书名）
//
// ByteSource 约定：
//   { size: number, read(offset, length) => Promise<Uint8Array> }
//   read 越界时按实际可用长度返回（可能短于 length）；offset 合法时至少返回 1 字节；
//   offset >= size 时返回空 Uint8Array。

// 单张封面（压缩后）上限：再大就不要了，避免把 Worker 内存吃满
const MAX_COVER_BYTES = 8 * 1024 * 1024;
// container.xml / OPF 这类小文本的上限
const MAX_XML_BYTES = 4 * 1024 * 1024;
// zip 中央目录上限
const MAX_CD_BYTES = 8 * 1024 * 1024;
// EOCD 从文件尾部回溯的最大窗口
const EOCD_WINDOW = 66000;
// PDF 每段扫描字节数（最多两段 = 16MB）
const PDF_SEGMENT_BYTES = 8 * 1024 * 1024;
// PDF 封面图最小字节数：太小的多半是图标 / 分隔线，不是封面
const PDF_MIN_IMAGE_BYTES = 8 * 1024;

const EMPTY_RESULT = { format: null, title: null, author: null, cover: null, coverMime: null };

function toBytes(input) {
  if (!input) return null;
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  return null;
}

function matchAscii(bytes, offset, text) {
  if (offset < 0 || offset + text.length > bytes.length) return false;
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

function asciiAt(bytes, offset, length) {
  if (offset < 0 || offset + length > bytes.length) return '';
  let out = '';
  for (let i = 0; i < length; i++) out += String.fromCharCode(bytes[offset + i]);
  return out;
}

function u16be(bytes, offset) {
  if (offset + 2 > bytes.length) return 0;
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function u32be(bytes, offset) {
  if (offset + 4 > bytes.length) return 0;
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function u64be(bytes, offset) {
  return u32be(bytes, offset) * 0x100000000 + u32be(bytes, offset + 4);
}

function view(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

// 按开头魔数判断图片类型；识别不出返回 null
function imageMimeFromMagic(bytes) {
  if (!bytes || bytes.length < 4) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && matchAscii(bytes, 1, 'PNG')) return 'image/png';
  if (matchAscii(bytes, 0, 'GIF8')) return 'image/gif';
  if (matchAscii(bytes, 0, 'RIFF') && matchAscii(bytes, 8, 'WEBP')) return 'image/webp';
  return null;
}

// deflate-raw 解压：Workers 与 Node 18+ 都原生支持，不需要任何依赖
async function inflateRaw(data) {
  const ds = new DecompressionStream('deflate-raw');
  const rs = new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    }
  });
  const out = await new Response(rs.pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(out);
}

// latin1 解码（1 字节 = 1 字符，索引与文件偏移一一对应），用于扫描 PDF 这种 ASCII 为主的二进制
function latin1(bytes) {
  let out = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
  }
  return out;
}

// ---------------------------------------------------------------------------
// 格式嗅探
// ---------------------------------------------------------------------------

// 只凭头部字节做初步判断。注意：PalmDB 容器可能是 MOBI 也可能是 AZW3，
// 真正的版本要读记录 0 里的 MOBI header 才能确定，这里先统一返回 'mobi'。
export function sniffBookFormat(head) {
  const bytes = toBytes(head);
  if (!bytes || bytes.length < 4) return null;
  if (matchAscii(bytes, 0, '%PDF-')) return 'pdf';
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return 'epub';
  if (bytes.length >= 78) {
    const type = asciiAt(bytes, 60, 4);
    if (type === 'BOOK' || type === 'TEXt') return 'mobi';
  }
  return null;
}

// ---------------------------------------------------------------------------
// ZIP（EPUB 用）
// ---------------------------------------------------------------------------

// 找 EOCD（End Of Central Directory）：从尾部往前回溯
function findEocd(tail, tailStart, fileSize) {
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail[i] !== 0x50 || tail[i + 1] !== 0x4b || tail[i + 2] !== 0x05 || tail[i + 3] !== 0x06) continue;
    const dv = view(tail);
    const entryCount = dv.getUint16(i + 10, true);
    const cdSize = dv.getUint32(i + 12, true);
    const cdOffset = dv.getUint32(i + 16, true);
    const commentLen = dv.getUint16(i + 20, true);
    const abs = tailStart + i;
    // 注释长度必须能对上（允许尾部有少量脏字节的情况则退化为偏移合法性校验）
    const commentOk = abs + 22 + commentLen <= fileSize && (abs + 22 + commentLen === fileSize || commentLen === 0);
    const rangeOk = cdOffset + cdSize <= fileSize;
    if (!rangeOk) continue;
    if (commentOk || cdOffset > 0) return { entryCount, cdSize, cdOffset, eocdAbs: abs };
  }
  return null;
}

// 解析 zip64 扩展字段（只有 0xffffffff 的字段才在 zip64 extra 里按序出现）
function applyZip64Extra(extra, entry) {
  let p = 0;
  while (p + 4 <= extra.length) {
    const id = extra[p] | (extra[p + 1] << 8);
    const size = extra[p + 2] | (extra[p + 3] << 8);
    if (id === 0x0001) {
      let q = p + 4;
      if (entry.uncompSize === 0xffffffff && q + 8 <= extra.length) { entry.uncompSize = u64be(extra, q); q += 8; }
      if (entry.compSize === 0xffffffff && q + 8 <= extra.length) { entry.compSize = u64be(extra, q); q += 8; }
      if (entry.localOff === 0xffffffff && q + 8 <= extra.length) { entry.localOff = u64be(extra, q); q += 8; }
      return;
    }
    p += 4 + size;
  }
}

// 读中央目录，返回 { list, byName, ordered }
async function readCentralDirectory(source, eocd) {
  let { entryCount, cdSize, cdOffset } = eocd;
  // zip64：EOCD 里字段被写成 0xffff/0xffffffff 时，去找 zip64 EOCD locator
  if (cdOffset === 0xffffffff || entryCount === 0xffff) {
    const loc = await source.read(Math.max(0, eocd.eocdAbs - 20), 20);
    if (loc.length >= 20 && u32be(loc, 0) === 0x07064b50) {
      const z64Off = u64be(loc, 8);
      const z64 = await source.read(z64Off, 56);
      if (z64.length >= 56 && u32be(z64, 0) === 0x06064b50) {
        entryCount = u64be(z64, 32);
        cdSize = u64be(z64, 40);
        cdOffset = u64be(z64, 48);
      }
    }
  }
  if (!Number.isFinite(cdSize) || cdSize <= 0 || cdSize > MAX_CD_BYTES) return null;
  const cd = await source.read(cdOffset, cdSize);
  if (cd.length < 46) return null;

  const dv = view(cd);
  const list = [];
  const byName = new Map();
  let p = 0;
  while (p + 46 <= cd.length && list.length < entryCount + 8) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const entry = {
      method: dv.getUint16(p + 10, true),
      compSize: dv.getUint32(p + 20, true),
      uncompSize: dv.getUint32(p + 24, true),
      nameLen: dv.getUint16(p + 28, true),
      extraLen: dv.getUint16(p + 30, true),
      commentLen: dv.getUint16(p + 32, true),
      localOff: dv.getUint32(p + 42, true),
      name: ''
    };
    if (p + 46 + entry.nameLen > cd.length) break;
    entry.name = new TextDecoder('utf-8').decode(cd.subarray(p + 46, p + 46 + entry.nameLen));
    if (entry.extraLen > 0 && (entry.compSize === 0xffffffff || entry.uncompSize === 0xffffffff || entry.localOff === 0xffffffff)) {
      const exStart = p + 46 + entry.nameLen;
      applyZip64Extra(cd.subarray(exStart, Math.min(exStart + entry.extraLen, cd.length)), entry);
    }
    list.push(entry);
    byName.set(entry.name, entry);
    p += 46 + entry.nameLen + entry.extraLen + entry.commentLen;
  }
  return { list, byName };
}

// 解压 / 读取单个 zip 条目；超过上限或方法不支持返回 null
async function readZipEntry(source, entry) {
  if (!entry) return null;
  if (entry.compSize > MAX_COVER_BYTES || entry.uncompSize > MAX_COVER_BYTES) return null;
  if (entry.localOff < 0 || entry.localOff + 30 > source.size) return null;
  const lh = await source.read(entry.localOff, 30);
  if (lh.length < 30) return null;
  const dv = view(lh);
  if (dv.getUint32(0, true) !== 0x04034b50) return null;
  const nameLen = dv.getUint16(26, true);
  const extraLen = dv.getUint16(28, true);
  const dataStart = entry.localOff + 30 + nameLen + extraLen;
  const raw = await source.read(dataStart, entry.compSize);
  if (entry.method === 0) return raw;
  if (entry.method === 8) {
    try {
      return await inflateRaw(raw);
    } catch {
      return null;
    }
  }
  return null; // 其他压缩方法（bzip2/lzma…）罕见，放弃
}

function decodeXmlEntities(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body) => {
    if (body[0] === '#') {
      const hex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return whole;
      try { return String.fromCodePoint(code); } catch { return whole; }
    }
    return named[body] !== undefined ? named[body] : whole;
  });
}

function stripTags(xml) {
  return xml.replace(/<[^>]*>/g, '');
}

// 取某个标签的文本内容（宽松匹配命名空间前缀，如 <dc:title> / <title>）
function tagText(xml, localName) {
  const re = new RegExp('<([\\w.-]+:)?' + localName + '\\b[^>]*>([\\s\\S]*?)<\\/([\\w.-]+:)?' + localName + '\\s*>', 'i');
  const m = xml.match(re);
  if (!m) return null;
  const text = decodeXmlEntities(stripTags(m[2])).replace(/\s+/g, ' ').trim();
  return text || null;
}

function attrValue(tag, name) {
  const re = new RegExp('(?:^|\\s)' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')', 'i');
  const m = tag.match(re);
  if (!m) return null;
  return decodeXmlEntities(m[1] !== undefined ? m[1] : m[2]);
}

// 相对 href 解析成 zip 内路径（相对 OPF 所在目录），并做 URL 解码
function resolveHref(baseDir, href) {
  let h = String(href || '').split('#')[0].split('?')[0];
  try { h = decodeURIComponent(h); } catch { /* 编码非法则按原样处理 */ }
  if (h.startsWith('/')) h = h.slice(1);
  const parts = (baseDir ? baseDir.split('/') : []).concat(h.split('/'));
  const out = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

function dirName(path) {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

// zip 里查条目：先精确匹配，再大小写不敏感匹配，最后后缀匹配
function lookupEntry(byName, name) {
  if (!name) return null;
  const exact = byName.get(name);
  if (exact) return exact;
  const lower = name.toLowerCase();
  for (const [key, entry] of byName) {
    if (key.toLowerCase() === lower) return entry;
  }
  for (const [key, entry] of byName) {
    const k = key.toLowerCase();
    if (k.endsWith('/' + lower) || k.endsWith(lower)) return entry;
  }
  return null;
}

function decodeText(bytes) {
  return new TextDecoder('utf-8').decode(bytes);
}

// EPUB：走 zip 中央目录 → container.xml → OPF → 封面条目
async function extractEpub(source, head) {
  const tailStart = Math.max(0, source.size - EOCD_WINDOW);
  const tail = await source.read(tailStart, source.size - tailStart);
  const eocd = findEocd(tail, tailStart, source.size);
  if (!eocd) return EMPTY_RESULT;
  const cd = await readCentralDirectory(source, eocd);
  if (!cd) return EMPTY_RESULT;

  // 确认真的是 EPUB：头部含 application/epub+zip 或存在 mimetype 条目
  const hasMimetype = !!lookupEntry(cd.byName, 'mimetype') || latin1(head).includes('application/epub+zip');

  const containerEntry = lookupEntry(cd.byName, 'META-INF/container.xml');
  if (!containerEntry) {
    // 只是普通 zip（例如 docx），不算电子书
    return EMPTY_RESULT;
  }
  const containerBytes = await readZipEntry(source, containerEntry);
  if (!containerBytes || containerBytes.length > MAX_XML_BYTES) return EMPTY_RESULT;
  const container = decodeText(containerBytes);

  // container.xml → <rootfile full-path="OEBPS/content.opf" .../>
  const rootfileTag = container.match(/<rootfile\b[^>]*>/i);
  const opfPath = rootfileTag ? attrValue(rootfileTag[0], 'full-path') : null;
  if (!opfPath) return EMPTY_RESULT;

  const opfEntry = lookupEntry(cd.byName, opfPath);
  if (!opfEntry) return EMPTY_RESULT;
  const opfBytes = await readZipEntry(source, opfEntry);
  if (!opfBytes || opfBytes.length > MAX_XML_BYTES) return EMPTY_RESULT;
  const opf = decodeText(opfBytes);
  const opfDir = dirName(opfEntry.name);

  const result = {
    format: 'epub',
    title: tagText(opf, 'title'),
    author: tagText(opf, 'creator'),
    cover: null,
    coverMime: null
  };
  if (!hasMimetype && !result.title) return EMPTY_RESULT;

  // 收集 manifest 里的 item
  const items = [];
  const itemRe = /<item\b[^>]*>/gi;
  let m;
  while ((m = itemRe.exec(opf))) {
    items.push({
      id: attrValue(m[0], 'id'),
      href: attrValue(m[0], 'href'),
      mediaType: attrValue(m[0], 'media-type'),
      properties: attrValue(m[0], 'properties')
    });
  }

  // 封面优先级：① <meta name="cover" content="ID"> ② properties 含 cover-image ③ 文件名含 cover 的图片
  const candidates = [];
  const metaCover = opf.match(/<meta\b[^>]*name\s*=\s*["']cover["'][^>]*>/i);
  if (metaCover) {
    const coverId = attrValue(metaCover[0], 'content');
    const hit = items.find((it) => it.id && coverId && it.id === coverId);
    if (hit && hit.href) candidates.push(hit.href);
  }
  for (const it of items) {
    if (it.properties && /cover-image/i.test(it.properties) && it.href) candidates.push(it.href);
  }
  for (const it of items) {
    if (!it.href) continue;
    if (it.mediaType && !/^image\//i.test(it.mediaType)) continue;
    if (/cover/i.test(it.href) && /\.(jpe?g|png|gif|webp)$/i.test(it.href)) candidates.push(it.href);
  }
  // 兜底：第一张图片
  for (const it of items) {
    if (it.href && it.mediaType && /^image\//i.test(it.mediaType)) candidates.push(it.href);
  }

  for (const href of candidates) {
    const path = resolveHref(opfDir, href);
    const entry = lookupEntry(cd.byName, path);
    if (!entry) continue;
    const bytes = await readZipEntry(source, entry);
    if (!bytes || bytes.length < 64) continue;
    const mime = imageMimeFromMagic(bytes);
    if (!mime) continue;
    result.cover = bytes;
    result.coverMime = mime;
    break;
  }
  return result;
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

// PDF 字面量字符串里的转义还原（\n \t \( \) \\ \ddd 等）
function decodePdfLiteral(raw) {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch !== '\\') { out += ch; continue; }
    const next = raw[++i];
    if (next === undefined) break;
    if (next === 'n') out += '\n';
    else if (next === 'r') out += '\r';
    else if (next === 't') out += '\t';
    else if (next === 'b') out += '\b';
    else if (next === 'f') out += '\f';
    else if (next === '\n') { /* 续行 */ }
    else if (next >= '0' && next <= '7') {
      let oct = next;
      while (oct.length < 3 && raw[i + 1] >= '0' && raw[i + 1] <= '7') oct += raw[++i];
      out += String.fromCharCode(parseInt(oct, 8) & 0xff);
    } else out += next;
  }
  return out;
}

function decodeUtf16BeBytes(bytes) {
  let out = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = (bytes[i] << 8) | bytes[i + 1];
    if (code === 0) break;
    out += String.fromCharCode(code);
  }
  return out;
}

// 从 PDF 片段里抓 /Title（Info 字典）。尽力而为，抓不到就 null。
function extractPdfTitle(text) {
  const m = text.match(/\/Title\s*(?:\(((?:\\.|[^\\()])*)\)|<([0-9A-Fa-f\s]+)>)/);
  if (!m) return null;
  let value = null;
  if (m[2] !== undefined) {
    const hex = m[2].replace(/\s+/g, '');
    const bytes = new Uint8Array(Math.floor(hex.length / 2));
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16) || 0;
    value = bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff
      ? decodeUtf16BeBytes(bytes.subarray(2))
      : latin1(bytes);
  } else {
    value = decodePdfLiteral(m[1]);
    if (value.charCodeAt(0) === 0xfe && value.charCodeAt(1) === 0xff) {
      const raw = new Uint8Array(value.length);
      for (let i = 0; i < value.length; i++) raw[i] = value.charCodeAt(i) & 0xff;
      value = decodeUtf16BeBytes(raw.subarray(2));
    }
  }
  const cleaned = value.replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || null;
}

// 在一段 latin1 文本里找 /Subtype /Image + /Filter /DCTDecode 的流，
// 返回 { start, end, width, height, cmyk } 列表（偏移是文件绝对偏移）
function findPdfJpegStreams(text, segmentStart) {
  const found = [];
  const re = /\/Subtype\s*\/Image/g;
  let m;
  while ((m = re.exec(text))) {
    // 字典起点在 /Subtype 之前（<< ... /Subtype/Image ... >>），必须向前找
    const dictStart = text.lastIndexOf('<<', m.index);
    const dictEnd = text.indexOf('>>', m.index);
    if (dictStart < 0 || dictEnd < 0 || dictEnd - dictStart > 8192) continue;
    const dict = text.slice(dictStart, dictEnd);
    if (!/\/Filter\s*(\[[^\]]*)?[\s\S]{0,120}?DCTDecode/.test(dict)) continue;
    const sIdx = text.indexOf('stream', dictEnd);
    if (sIdx < 0) continue;
    let dataStart = sIdx + 6;
    if (text[dataStart] === '\r') dataStart++;
    if (text[dataStart] === '\n') dataStart++;

    // /Length 可能是间接引用（/Length 12 0 R），此时用最近的 endstream 兜底
    const lm = dict.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/);
    let dataEnd = -1;
    if (lm) {
      const len = parseInt(lm[1], 10);
      if (len > 0 && dataStart + len <= text.length) dataEnd = dataStart + len;
    }
    if (dataEnd < 0) {
      const e = text.indexOf('endstream', dataStart);
      if (e < 0) continue;
      dataEnd = e;
      while (dataEnd > dataStart && (text[dataEnd - 1] === '\n' || text[dataEnd - 1] === '\r')) dataEnd--;
    }
    const size = dataEnd - dataStart;
    if (size < PDF_MIN_IMAGE_BYTES) continue;
    found.push({
      start: segmentStart + dataStart,
      end: segmentStart + dataEnd,
      width: parseInt(dict.match(/\/Width\s+(\d+)/)?.[1] || '0', 10),
      height: parseInt(dict.match(/\/Height\s+(\d+)/)?.[1] || '0', 10),
      cmyk: /DeviceCMYK/i.test(dict)
    });
    re.lastIndex = dataEnd;
  }
  return found;
}

// 从候选图里挑封面：按文件偏移升序，取第一个「够大」的图。
// 电子书 PDF 的封面通常就是第一页那张大图，而它一般在文件里出现得很早。
// 注意：不因 /DeviceCMYK 而跳过——很多正式出版物的封面正是 CMYK JPEG，
// 跳过反而会挑到后面的插图；CMYK 偏色是查看器问题，不是取错图。
function pickPdfCover(candidates) {
  if (!candidates.length) return null;
  const byOffset = [...candidates].sort((a, b) => a.start - b.start);
  const big = byOffset.filter((c) => c.width >= 500 && c.height >= 500);
  if (big.length) return big[0];
  const mid = byOffset.filter((c) => c.width >= 300 && c.height >= 300);
  if (mid.length) return mid[0];
  return byOffset[0];
}

async function extractPdf(source) {
  const result = { format: 'pdf', title: null, author: null, cover: null, coverMime: null };
  const segments = Math.min(2, Math.max(1, Math.ceil(source.size / PDF_SEGMENT_BYTES)));
  const candidates = [];
  for (let i = 0; i < segments; i++) {
    const start = i * PDF_SEGMENT_BYTES;
    if (start >= source.size) break;
    const seg = await source.read(start, PDF_SEGMENT_BYTES);
    if (!seg.length) break;
    const text = latin1(seg);
    if (!result.title) result.title = extractPdfTitle(text);
    candidates.push(...findPdfJpegStreams(text, start));
    // 第一段就找到够大的封面就不必再读第二段（省内存）
    if (candidates.some((c) => c.width >= 500 && c.height >= 500)) break;
  }
  const pick = pickPdfCover(candidates);
  if (pick) {
    const bytes = await source.read(pick.start, pick.end - pick.start);
    if (bytes.length >= PDF_MIN_IMAGE_BYTES && bytes[0] === 0xff && bytes[1] === 0xd8) {
      result.cover = bytes;
      result.coverMime = 'image/jpeg';
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// MOBI / AZW3（PalmDB）
// ---------------------------------------------------------------------------

function decodeMobiString(bytes, encoding) {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end--;
  const slice = bytes.subarray(0, end);
  if (encoding === 1252) return latin1(slice).trim();
  return decodeText(slice).replace(/\u0000/g, '').trim();
}

async function extractMobi(source, head) {
  const recordCount = u16be(head, 76);
  if (!recordCount || recordCount > 0xffff) return EMPTY_RESULT;
  // PalmDB 头 78 字节 + 每条记录 8 字节
  const tableBytes = await source.read(0, Math.min(78 + recordCount * 8, 128 * 1024));
  if (tableBytes.length < 78 + recordCount * 8) return EMPTY_RESULT;

  const offsets = [];
  for (let i = 0; i < recordCount; i++) offsets.push(u32be(tableBytes, 78 + i * 8));
  const recordSize = (i) => {
    const start = offsets[i];
    const end = i + 1 < recordCount ? offsets[i + 1] : source.size;
    const size = end - start;
    return Number.isFinite(size) && size > 0 ? size : 0;
  };

  const rec0Size = recordSize(0);
  if (!rec0Size) return EMPTY_RESULT;
  const rec0 = await source.read(offsets[0], Math.min(rec0Size, 1024 * 1024));
  if (rec0.length < 32 || !matchAscii(rec0, 16, 'MOBI')) return EMPTY_RESULT;

  // 记录 0 = PalmDOC header(16B) + MOBI header("MOBI" 签名在记录 0 偏移 16 处)。
  // 注意：这些「文档里的 MOBI header 偏移」实际都是**相对记录 0 起点**的绝对偏移
  // （已用真实 MOBI 文件核对），不要再加 16。只有 EXTH 的位置例外，
  // 它是紧跟 MOBI header 之后，即记录 0 偏移 16 + headerLength。
  const headerLength = u32be(rec0, 0x14);   // MOBI header 长度（相对 MOBI 签名）
  const textEncoding = u32be(rec0, 0x1c);
  const version = u32be(rec0, 0x24);
  const fullNameOffset = u32be(rec0, 0x54); // 相对记录 0 起点
  const fullNameLength = u32be(rec0, 0x58);
  const firstImageIndex = u32be(rec0, 0x6c);
  const exthFlags = u32be(rec0, 0x80);

  const result = {
    format: version === 8 ? 'azw3' : 'mobi',
    title: null,
    author: null,
    cover: null,
    coverMime: null
  };

  // 书名：MOBI full name
  if (fullNameOffset > 0 && fullNameOffset + fullNameLength <= rec0.length) {
    result.title = decodeMobiString(rec0.subarray(fullNameOffset, fullNameOffset + fullNameLength), textEncoding);
  }

  // EXTH：紧跟在 MOBI header 之后（记录 0 偏移 16 + headerLength）
  const exthStart = 16 + headerLength;
  if ((exthFlags & 0x40) && exthStart + 12 <= rec0.length && matchAscii(rec0, exthStart, 'EXTH')) {
    const exthLength = u32be(rec0, exthStart + 4);
    const exthCount = u32be(rec0, exthStart + 8);
    let coverOffset = -1;
    let p = exthStart + 12;
    const limit = Math.min(rec0.length, exthStart + Math.max(exthLength, 12));
    for (let i = 0; i < exthCount && p + 8 <= limit; i++) {
      const type = u32be(rec0, p);
      const len = u32be(rec0, p + 4);
      if (len < 8 || p + len > limit) break;
      const data = rec0.subarray(p + 8, p + len);
      if (type === 201 && data.length >= 4) coverOffset = u32be(data, 0);
      else if (type === 202 && coverOffset < 0 && data.length >= 4) coverOffset = u32be(data, 0);
      else if (type === 100 && !result.author) result.author = decodeMobiString(data, textEncoding);
      else if (type === 503 && !result.title) result.title = decodeMobiString(data, textEncoding);
      p += len;
    }

    if (coverOffset >= 0 && firstImageIndex > 0 && firstImageIndex < recordCount) {
      const idx = firstImageIndex + coverOffset;
      if (idx < recordCount) {
        const size = recordSize(idx);
        if (size > 0 && size <= MAX_COVER_BYTES) {
          const bytes = await source.read(offsets[idx], size);
          const mime = imageMimeFromMagic(bytes);
          if (mime) {
            result.cover = bytes;
            result.coverMime = mime;
          }
        }
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

/**
 * 从电子书字节源里提取元数据与封面。永不抛异常（失败就返回 null 字段）。
 *
 * @param {{ size: number, read: (offset: number, length: number) => Promise<Uint8Array> }} source
 * @returns {Promise<{ format: 'pdf'|'epub'|'mobi'|'azw3'|null, title: string|null, author: string|null,
 *                     cover: Uint8Array|null, coverMime: 'image/jpeg'|'image/png'|'image/gif'|'image/webp'|null }>}
 */
export async function extractBookMeta(source) {
  if (!source || typeof source.read !== 'function' || !Number.isFinite(source.size) || source.size <= 0) {
    return { ...EMPTY_RESULT };
  }
  try {
    const head = await source.read(0, 4096);
    if (!head || !head.length) return { ...EMPTY_RESULT };
    const format = sniffBookFormat(head);
    if (format === 'epub') return await extractEpub(source, head);
    if (format === 'pdf') return await extractPdf(source);
    if (format === 'mobi') return await extractMobi(source, head);
    return { ...EMPTY_RESULT };
  } catch {
    // 任何意外都退化成「没拿到元数据」，绝不让上传流程因为解析失败而崩掉
    return { ...EMPTY_RESULT };
  }
}
