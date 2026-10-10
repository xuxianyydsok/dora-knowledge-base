// 图片类型嗅探 / 尺寸解析 / 文件名清洗（纯函数，无 IO，便于离线单测）
//
// 设计原则：
//   1. 只认「字节魔数」，不信任客户端声明的 Content-Type 或扩展名；
//   2. 尺寸解析「尽力而为」，任何异常都返回 { width: null, height: null }，
//      绝不抛错导致上传失败（尺寸只是元数据，缺失不影响使用）；
//   3. 允许的格式仅 4 种：JPEG / PNG / WebP / AVIF。
//      SVG / GIF / HTML / 纯文本等一律拒绝（415），避免存储型 XSS 与意外内容。
//
// 注意：AVIF 的尺寸解析未实现（box 结构复杂、出错风险高），恒为 null。
//      详见 docs/storage.md「已知限制」。

// 单张图片最大字节数：10MB
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// 允许的 MIME → 落盘扩展名
const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif'
};

// 合法的落盘扩展名集合（用于 object_key 生成与断言）
export const ALLOWED_EXTENSIONS = new Set(Object.values(MIME_EXT));

// 扩展名长度上限，防止超长文件名
const MAX_FILENAME_LENGTH = 120;

function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  return null;
}

// 大小写无关地匹配 ASCII 字符串
function matchAscii(bytes, offset, text) {
  if (offset + text.length > bytes.length) return false;
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

// 读取大端 / 小端无符号整数（越界返回 null）
function readU16BE(bytes, offset) {
  if (offset + 2 > bytes.length) return null;
  return (bytes[offset] << 8) | bytes[offset + 1];
}
function readU32BE(bytes, offset) {
  if (offset + 4 > bytes.length) return null;
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}
function readU16LE(bytes, offset) {
  if (offset + 2 > bytes.length) return null;
  return bytes[offset] | (bytes[offset + 1] << 8);
}
function readU24LE(bytes, offset) {
  if (offset + 3 > bytes.length) return null;
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

// 按魔数嗅探图片类型；识别不出（含 SVG/GIF/HTML/文本/空）返回 null
export function sniffImageType(input) {
  const bytes = toBytes(input);
  if (!bytes || bytes.length < 12) return null;

  // JPEG：FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }

  // PNG：89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return { mime: 'image/png', ext: 'png' };
  }

  // WebP：前 4 字节 RIFF，第 8-12 字节 WEBP
  if (matchAscii(bytes, 0, 'RIFF') && matchAscii(bytes, 8, 'WEBP')) {
    return { mime: 'image/webp', ext: 'webp' };
  }

  // AVIF：第 4-8 字节 ftyp，brand 需含 avif / avis（保守判定）
  if (matchAscii(bytes, 4, 'ftyp') && isAvifBrand(bytes)) {
    return { mime: 'image/avif', ext: 'avif' };
  }

  return null;
}

// 解析 ftyp box 的 major brand 与 compatible brands，判断是否为 AVIF。
// 保守策略：只有明确出现 avif / avis 才放行（mif1/msf1 等 HEIF 家族不带 avif 的一律拒绝）。
function isAvifBrand(bytes) {
  const major = bytes.slice(8, 12);
  const majorStr = asciiOf(major);
  if (majorStr === 'avif' || majorStr === 'avis') return true;

  const boxSize = readU32BE(bytes, 0);
  if (!boxSize || boxSize < 16) return false;
  // compatible brands 紧跟在 major(4) + minor(4) 之后，从 offset 16 开始，每 4 字节一个
  const end = Math.min(boxSize, bytes.length);
  for (let off = 16; off + 4 <= end; off += 4) {
    const brand = asciiOf(bytes.slice(off, off + 4));
    if (brand === 'avif' || brand === 'avis') return true;
  }
  return false;
}

function asciiOf(bytes) {
  let out = '';
  for (const b of bytes) out += String.fromCharCode(b);
  return out;
}

// 校验「声明 MIME」与「实际魔数」是否一致。
//   - 声明为空时，仅以魔数为准（浏览器个别来源不上报 type）；
//   - 声明存在但与魔数不符 → 返回 null（调用方按 415 拒绝）。
// 返回 { mime, ext } 或 null。
export function resolveImageType(input, declaredMime) {
  const sniffed = sniffImageType(input);
  if (!sniffed) return null;
  const declared = normalizeMime(declaredMime);
  if (declared && declared !== sniffed.mime) return null;
  return sniffed;
}

function normalizeMime(value) {
  if (typeof value !== 'string') return '';
  const base = value.split(';')[0].trim().toLowerCase();
  if (base === 'image/jpg' || base === 'image/pjpeg') return 'image/jpeg';
  return base;
}

// 校验字节长度是否在上限内
export function isWithinLimit(size) {
  return Number.isFinite(size) && size > 0 && size <= MAX_IMAGE_BYTES;
}

// 尽力而为地解析宽高；解析不出返回 { width: null, height: null }，绝不抛错
export function imageDimensions(input, mime) {
  const empty = { width: null, height: null };
  try {
    const bytes = toBytes(input);
    if (!bytes || bytes.length < 16) return empty;
    switch (mime) {
      case 'image/png': return pngDimensions(bytes) || empty;
      case 'image/jpeg': return jpegDimensions(bytes) || empty;
      case 'image/webp': return webpDimensions(bytes) || empty;
      // AVIF 尺寸未解析（box 结构复杂，风险高），明确返回 null
      case 'image/avif': return empty;
      default: return empty;
    }
  } catch {
    return empty;
  }
}

// PNG：IHDR 紧跟在 8 字节签名后（长度 4 + 类型 4），宽高为紧随其后的两个大端 u32
function pngDimensions(bytes) {
  if (!matchAscii(bytes, 12, 'IHDR')) return null;
  const width = readU32BE(bytes, 16);
  const height = readU32BE(bytes, 20);
  if (!width || !height) return null;
  return { width, height };
}

// JPEG：扫描段，命中 SOF0/1/2 等帧头时取高宽（注意 SOF 段内顺序是 精度(1) 高(2) 宽(2)）
function jpegDimensions(bytes) {
  let offset = 2; // 跳过 SOI
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) { offset++; continue; }
    let marker = bytes[offset + 1];
    // 跳过填充的 0xFF
    while (marker === 0xff && offset + 2 < bytes.length) {
      offset++;
      marker = bytes[offset + 1];
    }
    // 无参数的标记（RST/SOI/EOI/TEM）
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const segLen = readU16BE(bytes, offset + 2);
    if (!segLen || segLen < 2) return null;
    // SOF0..SOF15，但 C4(DHT)/C8(JPG)/CC(DAC) 不是帧头
    const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSOF) {
      const height = readU16BE(bytes, offset + 5);
      const width = readU16BE(bytes, offset + 7);
      if (!width || !height) return null;
      return { width, height };
    }
    // SOS 之后是压缩数据，尺寸信息只可能在之前的 SOF 里，故到此为止
    if (marker === 0xda) return null;
    offset += 2 + segLen;
  }
  return null;
}

// WebP：三种子格式 VP8（有损）/ VP8L（无损）/ VP8X（扩展）
function webpDimensions(bytes) {
  if (matchAscii(bytes, 12, 'VP8 ')) {
    // 帧头：3 字节 frame tag + 3 字节起始码 9D 01 2A，随后 14 位宽 / 14 位高（小端）
    if (!(bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a)) return null;
    const width = readU16LE(bytes, 26) & 0x3fff;
    const height = readU16LE(bytes, 28) & 0x3fff;
    if (!width || !height) return null;
    return { width, height };
  }
  if (matchAscii(bytes, 12, 'VP8L')) {
    // 签名 0x2F，随后 14 位宽 + 14 位高（小端位流）
    if (bytes[20] !== 0x2f) return null;
    const width = 1 + (bytes[21] | ((bytes[22] & 0x3f) << 8));
    const height = 1 + (((bytes[22] & 0xc0) >> 6) | (bytes[23] << 2) | ((bytes[24] & 0x0f) << 10));
    if (!width || !height) return null;
    return { width, height };
  }
  if (matchAscii(bytes, 12, 'VP8X')) {
    // 1 字节 flags + 3 字节 reserved，随后 24 位「画布宽-1」「画布高-1」
    const width = readU24LE(bytes, 24);
    const height = readU24LE(bytes, 27);
    if (width === null || height === null) return null;
    return { width: width + 1, height: height + 1 };
  }
  return null;
}

// 清洗原始文件名：仅作展示/下载名，绝不参与 object_key。
// 目标：去掉目录分隔符、控制字符、`..` 穿越片段，并做长度截断。
export function sanitizeFilename(rawName, ext = 'bin') {
  let name = typeof rawName === 'string' ? rawName : '';

  // 先做一次安全的百分号解码，防止 %2e%2e%2f 之类的编码穿越
  try { name = decodeURIComponent(name); } catch { /* 非法编码则原样处理 */ }

  // 统一分隔符后只取最后一段（剥离任何目录部分）
  name = name.replace(/\\/g, '/');
  name = name.slice(name.lastIndexOf('/') + 1);

  // 去掉控制字符与 DEL
  // eslint-disable-next-line no-control-regex
  name = name.replace(/[\u0000-\u001f\u007f]/g, '');

  // 去掉残留的穿越片段与分隔符
  name = name.replace(/\.\./g, '').replace(/[/\\]/g, '');

  name = name.trim();
  if (name.length > MAX_FILENAME_LENGTH) {
    // 保留扩展名，优先截断主名
    const dot = name.lastIndexOf('.');
    const extPart = dot > 0 ? name.slice(dot) : '';
    const base = dot > 0 ? name.slice(0, dot) : name;
    name = base.slice(0, Math.max(1, MAX_FILENAME_LENGTH - extPart.length)) + extPart;
  }

  if (!name || name === '.' || name === '..') return `image.${ext}`;
  return name;
}

// 生成 R2 object key：assets/<user_id>/<YYYY>/<uuid>.<ext>
// 完全由服务端决定，不含任何用户提供的字符串（防注入/穿越）。
export function buildObjectKey(userId, ext, date = new Date()) {
  const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : 'bin';
  const year = date.getUTCFullYear();
  return `assets/${userId}/${year}/${crypto.randomUUID()}.${safeExt}`;
}

// 计算 sha256（小写 hex）；Worker 与 Node 均提供 crypto.subtle
export async function sha256Hex(input) {
  const bytes = toBytes(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 解码 base64（Worker 与 Node 通用，纯 Web API，不依赖 Node 专有全局）。
// 用 atob 解码；先剥离 data:<mime>;base64, 前缀，去掉空白字符，校验字符集与长度。
// 任何异常或非法输入一律返回 null（不抛错）。
export function decodeBase64(input) {
  try {
    if (typeof input !== 'string') return null;
    let raw = input.trim();
    if (!raw) return null;

    // 剥离 data URL 前缀：data:<mime>;base64,<payload>
    if (raw.startsWith('data:')) {
      const comma = raw.indexOf(',');
      if (comma === -1) return null;
      const meta = raw.slice(5, comma);
      if (!/;base64$/i.test(meta)) return null;
      raw = raw.slice(comma + 1);
    }

    // 去掉所有空白字符（换行/空格/制表符）
    raw = raw.replace(/\s+/g, '');
    if (!raw) return null;

    // 字符集校验：只允许 A-Za-z0-9+/=，其余一律拒绝
    if (!/^[A-Za-z0-9+/=]+$/.test(raw)) return null;

    // '=' 只能出现在末尾，且最多两个
    const firstEq = raw.indexOf('=');
    if (firstEq !== -1) {
      if (!/^=+$/.test(raw.slice(firstEq))) return null;
      if (raw.length - firstEq > 2) return null;
    }

    // 长度校验：标准 base64（含填充）长度必为 4 的倍数，残缺串（如 'abc'）一律拒绝
    if (raw.length % 4 !== 0) return null;

    // atob 返回「每字符一字节」的二进制字符串，必须逐字符取 charCodeAt，
    // 不能用 TextEncoder（那会按 UTF-8 重新编码，破坏二进制）。
    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
    return bytes;
  } catch {
    return null;
  }
}
