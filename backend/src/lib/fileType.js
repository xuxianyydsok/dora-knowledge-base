// 文档附件类型嗅探 / 文件名清洗（纯函数，无 IO，便于离线单测）
//
// 与 imageType.js 同一套原则：
//   1. 只认「字节魔数」，不信任客户端声明的 Content-Type 或扩展名；
//   2. 只允许**文档类**：PDF / DOC / DOCX / XLS / XLSX / PPT / PPTX / TXT / CSV / Markdown；
//      **绝不**允许 HTML / SVG / JS 等可执行或可脚本内容（存储型 XSS 风险）；
//   3. 单文件上限 20MB（比图片宽，但仍有界，避免把 R2 当网盘用）。

// 单个附件最大字节数：20MB
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

// 允许的 MIME → 落盘扩展名（白名单，其余一律拒绝）
const MIME_EXT = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'text/markdown': 'md'
};

export const ALLOWED_FILE_EXTENSIONS = new Set(Object.values(MIME_EXT));

const MAX_FILENAME_LENGTH = 120;

function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  return null;
}

function matchAscii(bytes, offset, text) {
  if (offset + text.length > bytes.length) return false;
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

// 按魔数嗅探文档类型；识别不出返回 null。
// OOXML（docx/xlsx/pptx）本质是 zip（PK\x03\x04），无法只靠魔数区分三者，
// 因此这里统一识别为「OOXML」，具体是哪种由**声明 MIME** 决定（见 resolveFileType）。
function sniffContainer(bytes) {
  if (matchAscii(bytes, 0, '%PDF-')) return { kind: 'pdf' };
  // 老版 Office 复合文档：D0 CF 11 E0 A1 B1 1A E1
  if (bytes.length >= 8 &&
      bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0 &&
      bytes[4] === 0xa1 && bytes[5] === 0xb1 && bytes[6] === 0x1a && bytes[7] === 0xe1) {
    return { kind: 'ole' };
  }
  // OOXML：PK\x03\x04（zip）
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return { kind: 'zip' };
  }
  return null;
}

function normalizeMime(value) {
  if (typeof value !== 'string') return '';
  return value.split(';')[0].trim().toLowerCase();
}

// 判断内容是否像纯文本（无 NUL 字节、可打印比例高）。用于 txt / csv / md 的兜底校验，
// 避免把伪装成 text/plain 的二进制塞进来。
function looksLikeText(bytes) {
  if (!bytes.length) return false;
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
  let bad = 0;
  for (const b of sample) {
    if (b === 0) return false;                       // NUL 直接判定为二进制
    if (b < 9 || (b > 13 && b < 32)) bad += 1;       // 允许 \t \n \r，其余控制字符计为可疑
  }
  return bad / sample.length < 0.02;
}

// 校验「声明 MIME + 实际魔数」是否构成允许的文档类型。
// 返回 { mime, ext } 或 null。
export function resolveFileType(input, declaredMime) {
  const bytes = toBytes(input);
  if (!bytes || bytes.length < 4) return null;
  const declared = normalizeMime(declaredMime);
  const container = sniffContainer(bytes);

  // 1) PDF：必须真的是 PDF
  if (container?.kind === 'pdf') {
    if (declared && declared !== 'application/pdf') return null;
    return { mime: 'application/pdf', ext: 'pdf' };
  }

  // 2) 老版 Office（doc/xls/ppt）：复合文档容器 + 声明三者之一
  if (container?.kind === 'ole') {
    if (declared === 'application/msword') return { mime: declared, ext: 'doc' };
    if (declared === 'application/vnd.ms-excel') return { mime: declared, ext: 'xls' };
    if (declared === 'application/vnd.ms-powerpoint') return { mime: declared, ext: 'ppt' };
    return null;
  }

  // 3) OOXML（docx/xlsx/pptx）：zip 容器 + 声明三者之一
  if (container?.kind === 'zip') {
    if (declared === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return { mime: declared, ext: 'docx' };
    }
    if (declared === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      return { mime: declared, ext: 'xlsx' };
    }
    if (declared === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      return { mime: declared, ext: 'pptx' };
    }
    return null;
  }

  // 4) 纯文本类：必须内容真的像文本，且声明是 txt / csv / md（或空）
  const textMimes = { 'text/plain': 'txt', 'text/csv': 'csv', 'text/markdown': 'md' };
  if (looksLikeText(bytes)) {
    if (declared && !textMimes[declared]) return null;
    const mime = declared || 'text/plain';
    return { mime, ext: textMimes[mime] };
  }

  return null;
}

export function isWithinFileLimit(size) {
  return Number.isFinite(size) && size > 0 && size <= MAX_FILE_BYTES;
}

// 清洗原始文件名（与 imageType.sanitizeFilename 同款规则，只作展示 / 下载名）
export function sanitizeFilename(rawName, ext = 'bin') {
  let name = typeof rawName === 'string' ? rawName : '';
  try { name = decodeURIComponent(name); } catch { /* 非法编码则原样处理 */ }
  name = name.replace(/\\/g, '/');
  name = name.slice(name.lastIndexOf('/') + 1);
  // eslint-disable-next-line no-control-regex
  name = name.replace(/[\u0000-\u001f\u007f]/g, '');
  name = name.replace(/\.\./g, '').replace(/[/\\]/g, '').trim();
  if (name.length > MAX_FILENAME_LENGTH) {
    const dot = name.lastIndexOf('.');
    const extPart = dot > 0 ? name.slice(dot) : '';
    const base = dot > 0 ? name.slice(0, dot) : name;
    name = base.slice(0, Math.max(1, MAX_FILENAME_LENGTH - extPart.length)) + extPart;
  }
  if (!name || name === '.' || name === '..') return `file.${ext}`;
  return name;
}

// 生成 R2 object key：files/<user_id>/<YYYY>/<uuid>.<ext>
export function buildFileKey(userId, ext, date = new Date()) {
  const safeExt = ALLOWED_FILE_EXTENSIONS.has(ext) ? ext : 'bin';
  return `files/${userId}/${date.getUTCFullYear()}/${crypto.randomUUID()}.${safeExt}`;
}

export async function sha256Hex(input) {
  const bytes = toBytes(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
