// 电子书类型嗅探 / 文件名清洗 / R2 key 生成 / 分片上传凭据（纯函数，无 IO，便于离线单测）
//
// 与 fileType.js / imageType.js 同一套原则：
//   1. 只认「字节魔数」，不信任客户端声明的 Content-Type 或扩展名；
//   2. 只允许**可站内阅读**的两类：EPUB / PDF；
//      （MOBI / AZW3 曾经收进来过，但浏览器无法渲染，只能下载；2026-10-12 用户决定
//        本站只保留 EPUB 与 PDF，这两种格式连上传都直接拒绝，前端也不再出现。）
//   3. 单本**不设业务上限**：大文件走 R2 分片上传（见 routes/books.js），
//      前端把文件切成 8MiB 一片逐片 PUT，每片都是一个独立的小请求，
//      因此不再受「Cloudflare Workers 单请求体约 100MB」这条平台硬上限的约束。
//      这里只保留两个**保护性**上限（内存 / 超时 / 防呆），不是产品限制：
//        · 直传（一次性 POST 整本）      → 400MB，见 MAX_BOOK_BYTES
//        · 分片上传（整本累计）          → 5GB，见 MAX_MULTIPART_BOOK_BYTES
//      （2026-10-11 上一版图书下线，是因为当时只能一次性直传：24 本 / 2.4GB、
//       最大单本 772MB，单个请求体必然被平台 413。改成分片后，整本大小不再是风险点，
//       风险点只剩下「单个请求体大小」，而那已经被 8MiB 的片长摁死了。）
//
// 为什么单独一个文件而不是复用 fileType.js：
//   fileType.js 面向「碎念附件」，白名单与上限都不同（PDF/Office/文本，20MB）；
//   电子书需要认 ZIP 容器里的 EPUB 结构（fileType.js 只把 zip 当 OOXML），
//   两者混在一起会让两边的白名单互相污染，因此刻意分开。

// 一次性直传（POST /api/books，整个文件就是请求体）的保护上限：400MB。
// 不是业务限制：Cloudflare Workers 免费版单请求体约 100MB 就 413，
// 400MB 只是给「付费额度 / 未来放宽」留的护栏，超过就要求走分片。
export const MAX_BOOK_BYTES = 400 * 1024 * 1024;

// 分片上传整本累计的保护上限：5GB。同样不是业务限制，只是防呆。
// R2 单次 multipart 最多 10000 片，8MiB 片长理论可到 ~78GB，这里取更保守的值。
export const MAX_MULTIPART_BOOK_BYTES = 5 * 1024 * 1024 * 1024;

// 分片大小：8MiB。
//   · R2/S3 硬要求「除最后一片外，每片 ≥ 5MiB」——8MiB 留出余量；
//   · Worker 内存 128MB，一次只流过一片，8MiB 非常安全；
//   · 片数上限 10000，8MiB × 10000 ≈ 78GB，远高于保护上限。
export const MULTIPART_PART_BYTES = 8 * 1024 * 1024;
export const MULTIPART_MIN_PART_BYTES = 5 * 1024 * 1024;
export const MULTIPART_MAX_PARTS = 10000;

// 分片上传凭据（ticket）有效期：6 小时。
// 够慢网络把一本大书传完，又能把「凭据泄漏」的窗口压住。
export const MULTIPART_TICKET_TTL_MS = 6 * 60 * 60 * 1000;

// 封面图上限：8MB（超过就放弃封面，不让一本书的封面把内存吃掉）
export const MAX_COVER_BYTES = 8 * 1024 * 1024;

// 格式 → 落盘扩展名 + MIME（白名单，其余一律拒绝）。
// 只有 EPUB 与 PDF：这两种浏览器能直接渲染，是本站在线阅读支持的格式。
export const BOOK_FORMATS = {
  pdf: { ext: 'pdf', mime: 'application/pdf' },
  epub: { ext: 'epub', mime: 'application/epub+zip' }
};

export const ALLOWED_BOOK_EXTENSIONS = new Set(Object.values(BOOK_FORMATS).map((f) => f.ext));

const MAX_FILENAME_LENGTH = 160;

function toBytes(input) {
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

// 在 [from, to) 里找 ASCII 子串，返回首次出现的偏移（找不到返回 -1）。
// 只用于「头部 4KB 里找线索」这种小范围扫描，不做通用搜索。
function indexOfAscii(bytes, text, from = 0, to = bytes.length) {
  const end = Math.min(to, bytes.length) - text.length;
  for (let i = Math.max(0, from); i <= end; i++) {
    if (matchAscii(bytes, i, text)) return i;
  }
  return -1;
}

function readUInt32BE(bytes, offset) {
  if (offset < 0 || offset + 4 > bytes.length) return -1;
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

// 按魔数嗅探电子书格式；识别不出返回 null。
// 只需要文件**头部**（4KB 足够）即可判定，因此上传时可以先读一小段再决定落盘扩展名。
// 只认 EPUB 与 PDF；MOBI / AZW3（PalmDB 容器）明确不接受，返回 null 由路由给出提示。
export function sniffBookFormat(input) {
  const bytes = toBytes(input);
  if (!bytes || bytes.length < 8) return null;

  // 1) PDF
  if (matchAscii(bytes, 0, '%PDF-')) return { format: 'pdf' };

  // 2) EPUB（本质是 zip，PK\x03\x04）
  //    规范要求第一个条目是**不压缩**的 mimetype，内容是 application/epub+zip，
  //    所以头部 200 字节内一般能直接看到这个字符串。
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    const head = Math.min(bytes.length, 4096);
    const hasEpubMarker = indexOfAscii(bytes, 'application/epub+zip', 0, head) >= 0
      || indexOfAscii(bytes, 'mimetype', 0, head) >= 0
      || indexOfAscii(bytes, 'epub', 0, head) >= 0;
    // 只接受「看得出是 epub」的 zip；看不出就拒绝，避免把 docx 之类当电子书收进来
    if (hasEpubMarker) return { format: 'epub' };
    return null;
  }

  // 3) 其余（含 MOBI / AZW3 的 PalmDB 容器）一律不接受
  return null;
}

// 一次性直传的保护上限（见 MAX_BOOK_BYTES 注释）。
export function isWithinBookLimit(size) {
  return Number.isFinite(size) && size > 0 && size <= MAX_BOOK_BYTES;
}

// 分片上传整本累计的保护上限（见 MAX_MULTIPART_BOOK_BYTES 注释）。
export function isWithinMultipartBookLimit(size) {
  return Number.isFinite(size) && size > 0 && size <= MAX_MULTIPART_BOOK_BYTES;
}

// ---------------------------------------------------------------
// 分片上传 · 片数与片长校验（纯函数，便于离线单测）
//
// R2/S3 的硬规则：
//   · partNumber 从 1 开始、连续、升序；
//   · 除最后一片外，每片必须 ≥ 5MiB；
//   · 片数 ≤ 10000。
// 这里把「片长是否合法」独立成纯函数，路由层只负责把 content-length 喂进来。
// ---------------------------------------------------------------

// 片长校验：partNumber 是「本次上传的片序号」，totalParts 是总片数。
// 返回 null 表示合法，否则返回中文错误信息（路由直接转 422）。
export function checkPartSize(bytes, partNumber, totalParts) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '分片内容为空';
  if (!Number.isInteger(partNumber) || partNumber < 1) return '分片序号非法';
  if (!Number.isInteger(totalParts) || totalParts < 1) return '分片总数非法';
  if (partNumber > totalParts) return '分片序号超出总片数';
  // 最后一片可以任意小（甚至 1 字节），其余每片必须 ≥ 5MiB
  if (partNumber < totalParts && bytes < MULTIPART_MIN_PART_BYTES) {
    return `除最后一片外，每片不得小于 ${Math.round(MULTIPART_MIN_PART_BYTES / 1024 / 1024)}MB`;
  }
  return null;
}

// 由总字节数推导片数（向上取整）；非法输入返回 0。
export function planPartCount(size, partBytes = MULTIPART_PART_BYTES) {
  if (!Number.isFinite(size) || size <= 0 || !Number.isFinite(partBytes) || partBytes <= 0) return 0;
  return Math.ceil(size / partBytes);
}

// 把完成请求里的 parts 规整为 R2 需要的形态：按 partNumber 升序、去掉重复、校验范围。
// 返回 { parts } 或抛出带 message 的错误（调用方转 422）。
export function normalizeCompletedParts(rawParts, totalParts) {
  if (!Array.isArray(rawParts) || !rawParts.length) throw new Error('缺少分片清单');
  if (Number.isInteger(totalParts) && rawParts.length !== totalParts) {
    throw new Error('分片数量与创建时不一致');
  }
  const seen = new Map();
  for (const p of rawParts) {
    const n = Number(p?.part_number ?? p?.partNumber);
    const etag = p?.etag;
    if (!Number.isInteger(n) || n < 1) throw new Error('分片序号非法');
    if (typeof etag !== 'string' || !etag.trim()) throw new Error(`第 ${n} 片缺少 etag`);
    seen.set(n, { partNumber: n, etag: etag.trim() });
  }
  const parts = [...seen.values()].sort((a, b) => a.partNumber - b.partNumber);
  if (parts.length !== rawParts.length) throw new Error('分片序号重复');
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].partNumber !== i + 1) throw new Error('分片序号必须从 1 开始且连续');
  }
  return parts;
}

// ---------------------------------------------------------------
// 分片上传凭据（ticket）：把 object key 签成一个不透明串，避免把明文 key 暴露给客户端。
//
// 形态：base64url(JSON{key,uid,exp}) + '.' + base64url(HMAC-SHA256(payload))
// 校验：签名一致 + uid 是当前用户 + 未过期。
// 密钥：env.SUPABASE_SERVICE_ROLE_KEY（Worker 侧已有、不入库不下发），派生一次后缓存。
// ---------------------------------------------------------------

const TICKET_PREFIX = 'bkm1';   // 版本前缀，便于以后换算法时兼容旧串
const KEY_CACHE = new Map();    // secret -> CryptoKey（避免每个请求重算派生）

function b64urlEncode(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// 把密钥字符串变成 HMAC key。同一密钥只派生一次。
export async function ticketHmacKey(secret) {
  if (!secret) throw new Error('缺少 ticket 签名密钥');
  const cached = KEY_CACHE.get(secret);
  if (cached) return cached;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );
  KEY_CACHE.set(secret, key);
  return key;
}

// 生成 ticket。payload 里只放「object key / 用户 id / 过期时间」三样。
export async function signBookTicket(secret, { key, uid, exp }, now = Date.now()) {
  const payload = b64urlEncode(new TextEncoder().encode(JSON.stringify({
    key, uid, exp: exp ?? now + MULTIPART_TICKET_TTL_MS
  })));
  const hmac = await ticketHmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', hmac, new TextEncoder().encode(payload)));
  return `${TICKET_PREFIX}.${payload}.${b64urlEncode(sig)}`;
}

// 校验 ticket：签名一致 + uid 匹配 + 未过期。
// 返回 { key, uid }；任何异常都抛 Error（调用方转 401/403，不泄露具体原因）。
export async function verifyBookTicket(secret, ticket, expectedUid, now = Date.now()) {
  if (typeof ticket !== 'string' || !ticket) throw new Error('缺少上传凭据');
  const parts = ticket.split('.');
  if (parts.length !== 3 || parts[0] !== TICKET_PREFIX) throw new Error('上传凭据格式非法');
  const [, payload, sigText] = parts;

  const hmac = await ticketHmacKey(secret);
  let ok = false;
  try {
    ok = await crypto.subtle.verify('HMAC', hmac, b64urlDecode(sigText), new TextEncoder().encode(payload));
  } catch { ok = false; }
  if (!ok) throw new Error('上传凭据签名不匹配');

  let body;
  try { body = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))); }
  catch { throw new Error('上传凭据内容非法'); }
  if (!body || typeof body.key !== 'string' || !body.key) throw new Error('上传凭据内容非法');
  if (expectedUid && body.uid !== expectedUid) throw new Error('上传凭据不属于当前用户');
  if (!Number.isFinite(body.exp) || body.exp < now) throw new Error('上传凭据已过期');
  return { key: body.key, uid: body.uid };
}
// 清洗原始文件名（仅作展示 / 下载名，绝不参与 object key）
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
  if (!name || name === '.' || name === '..') return `book.${ext}`;
  return name;
}

// 生成正文 R2 key：books/<user_id>/<YYYY>/<uuid>.<ext>
export function buildBookKey(userId, ext, date = new Date()) {
  const safeExt = ALLOWED_BOOK_EXTENSIONS.has(ext) ? ext : 'bin';
  return `books/${userId}/${date.getUTCFullYear()}/${crypto.randomUUID()}.${safeExt}`;
}

// 生成封面 R2 key：与正文同目录，文件名加 -cover 后缀，便于按书定位
export function buildCoverKey(bookKey, coverExt) {
  const allowed = new Set(['jpg', 'png', 'gif', 'webp']);
  const safeExt = allowed.has(coverExt) ? coverExt : 'jpg';
  return `${bookKey}-cover.${safeExt}`;
}

// 从封面字节里判断图片类型。
// 电子书封面实际会碰到 GIF（老 MOBI 常见）与 WebP（新 EPUB），因此一并支持；
// 其余一律返回 null，由调用方退回「没有封面」而不是把未知字节当图片存下来。
export function sniffCoverMime(bytes) {
  const b = toBytes(bytes);
  if (!b || b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: 'image/png', ext: 'png' };
  // GIF87a / GIF89a
  if (matchAscii(b, 0, 'GIF87a') || matchAscii(b, 0, 'GIF89a')) return { mime: 'image/gif', ext: 'gif' };
  // WebP：RIFF....WEBP
  if (matchAscii(b, 0, 'RIFF') && matchAscii(b, 8, 'WEBP')) return { mime: 'image/webp', ext: 'webp' };
  return null;
}

export async function sha256Hex(input) {
  const bytes = toBytes(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
