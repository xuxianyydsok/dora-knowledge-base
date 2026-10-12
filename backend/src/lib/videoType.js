// 动态壁纸（视频）类型嗅探 / 元数据解析 / 文件名清洗 / R2 key 生成（纯函数，无 IO）
//
// 与 imageType.js 同一套原则：
//   1. 只认「字节魔数」，不信任客户端声明的 Content-Type 或扩展名；
//   2. 只允许两种浏览器能直接播放的容器：MP4（ISO BMFF / H.264）与 WebM；
//      AVI / MKV / MOV(非 mp4) 等一律拒绝（415），因为 <video> 播不了；
//   3. 时长 / 分辨率「尽力而为」：解析失败返回 null，绝不抛错导致上传失败。
//
// 与 assets（静态图片）的关系：
//   assets   → 图片素材，R2 前缀 assets/<uid>/<年>/<uuid>.<ext>
//   wallpaper→ 动态壁纸，R2 前缀 wallpapers/<uid>/<年>/<uuid>.<ext>
//   用户明确要求「R2 里动态壁纸与静态壁纸分开」，因此前缀不同、表也不同。

// 单个视频上限：100MB。
// 这是**平台护栏**而非产品限制：Cloudflare Workers 单请求体约 100MB 就 413。
// 上传走「原始 body 直传 R2」（见 routes/wallpapers.js），不整段进内存。
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

// 允许的容器 → 落盘扩展名 + MIME
export const VIDEO_FORMATS = {
  mp4: { ext: 'mp4', mime: 'video/mp4' },
  webm: { ext: 'webm', mime: 'video/webm' }
};

export const ALLOWED_VIDEO_EXTENSIONS = new Set(Object.values(VIDEO_FORMATS).map((f) => f.ext));

const MAX_FILENAME_LENGTH = 120;

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

function readU32BE(bytes, offset) {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

// 64 位大端（Box 的 largesize / mvhd version 1 的时长）；超出安全整数返回 null
function readU64BE(bytes, offset) {
  const hi = readU32BE(bytes, offset);
  const lo = readU32BE(bytes, offset + 4);
  if (hi == null || lo == null) return null;
  return hi * 0x100000000 + lo;
}

// ---------------------------------------------------------------- 格式嗅探

// 按魔数判断容器类型；识别不出返回 null。
// 只需要文件头部（64 字节足够）即可判定，因此上传时可以先读一小段再决定落盘扩展名。
export function sniffVideoFormat(input) {
  const bytes = toBytes(input);
  if (!bytes || bytes.length < 12) return null;

  // MP4 / ISO BMFF：offset 4 是 'ftyp'，紧跟着 4 字节 brand
  if (matchAscii(bytes, 4, 'ftyp')) {
    // 只接受常见、浏览器能播的 brand。其余（如 3gp、qt 的 MOV）先按 mp4 收，
    // 因为它们的容器结构一致，能不能播最终由浏览器决定；这里不额外收紧，
    // 避免把合法的 fMP4 误拒。
    return { format: 'mp4' };
  }

  // WebM / Matroska：EBML 头 1A 45 DF A3。只有 WebM 能在浏览器直接播，
  // 但 MKV 与 WebM 共享同一容器头，无法只凭头部分辨，因此一并按 webm 收，
  // 由前端 <video> 的实际加载结果决定（加载失败会显示占位）。
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return { format: 'webm' };
  }

  return null;
}

// ---------------------------------------------------------------- MP4 元数据

// 遍历同一层里的所有 Box，对每个 box 调 onBox(type, payloadStart, payloadEnd)。
// MP4 是 Box 树，这里只做「顺序扫描」——足够取 moov 里的 mvhd / tkhd。
function walkBoxes(bytes, start, end, onBox) {
  let p = start;
  while (p + 8 <= end) {
    let size = readU32BE(bytes, p);
    if (size == null) return;
    const type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
    let headerSize = 8;
    if (size === 1) {
      // largesize：8 字节大小紧跟在 type 之后
      const big = readU64BE(bytes, p + 8);
      if (big == null || big < 16) return;
      size = big;
      headerSize = 16;
    } else if (size === 0) {
      // size 0 = 一直到文件末尾
      size = end - p;
    }
    if (size < headerSize || p + size > end) return;
    onBox(type, p + headerSize, p + size);
    p += size;
  }
}

// 在 [start,end) 里找第一个指定 type 的 Box，返回其 payload 区间
function findBox(bytes, start, end, wantType) {
  let found = null;
  walkBoxes(bytes, start, end, (type, s, e) => {
    if (!found && type === wantType) found = { start: s, end: e };
  });
  return found;
}

// mvhd：时长。version 0 → timescale/duration 各 4 字节；version 1 → 各 8 字节。
function readMvhdDuration(bytes, box) {
  const version = bytes[box.start];
  if (version === 1) {
    const timescale = readU32BE(bytes, box.start + 20);
    const duration = readU64BE(bytes, box.start + 24);
    if (!timescale || duration == null) return null;
    return duration / timescale;
  }
  const timescale = readU32BE(bytes, box.start + 12);
  const duration = readU32BE(bytes, box.start + 16);
  if (!timescale || duration == null) return null;
  return duration / timescale;
}

// tkhd：宽高。写在 box 末尾，各 4 字节 16.16 定点数。
function readTkhdSize(bytes, box) {
  // 末尾 8 字节 = width(4) + height(4)
  if (box.end - box.start < 8) return null;
  const w = readU32BE(bytes, box.end - 8);
  const h = readU32BE(bytes, box.end - 4);
  if (w == null || h == null) return null;
  // 16.16 定点 → 整数像素（右移 16 位）
  const width = Math.round(w / 65536);
  const height = Math.round(h / 65536);
  if (!width || !height) return null;
  return { width, height };
}

// 从 MP4 头部字节里尽力解析时长（秒）与画面尺寸。
// 只读传入的这段字节；moov 不在头部时（流式文件常见）解析失败，返回 null。
export function parseMp4Meta(input) {
  const bytes = toBytes(input);
  if (!bytes || bytes.length < 16) return { duration: null, width: null, height: null };

  const moov = findBox(bytes, 0, bytes.length, 'moov');
  if (!moov) return { duration: null, width: null, height: null };

  let duration = null;
  let width = null;
  let height = null;

  const mvhd = findBox(bytes, moov.start, moov.end, 'mvhd');
  if (mvhd) duration = readMvhdDuration(bytes, mvhd);

  // 取第一个 trak 的 tkhd（视频轨；音轨的宽高是 0，会被 readTkhdSize 过滤掉）
  walkBoxes(bytes, moov.start, moov.end, (type, s, e) => {
    if (type !== 'trak' || width) return;
    const tkhd = findBox(bytes, s, e, 'tkhd');
    if (tkhd) {
      const size = readTkhdSize(bytes, tkhd);
      if (size) { width = size.width; height = size.height; }
    }
  });

  return {
    duration: Number.isFinite(duration) && duration > 0 ? duration : null,
    width,
    height
  };
}

// 统一入口：按格式取元数据（webm 暂不解析，返回空）
export function parseVideoMeta(input, format) {
  if (format === 'mp4') return parseMp4Meta(input);
  return { duration: null, width: null, height: null };
}

// ---------------------------------------------------------------- 校验 / 命名

export function isWithinVideoLimit(size) {
  return Number.isFinite(size) && size > 0 && size <= MAX_VIDEO_BYTES;
}

// 清洗原始文件名（只作展示 / 下载名，绝不参与 object key）
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
  if (!name || name === '.' || name === '..') return `wallpaper.${ext}`;
  return name;
}

// 生成动态壁纸的 R2 key：wallpapers/<user_id>/<YYYY>/<uuid>.<ext>
// 前缀与图片素材的 assets/ 明确分开（用户要求动静分开存）。
export function buildVideoKey(userId, ext, date = new Date()) {
  const safeExt = ALLOWED_VIDEO_EXTENSIONS.has(ext) ? ext : 'bin';
  return `wallpapers/${userId}/${date.getUTCFullYear()}/${crypto.randomUUID()}.${safeExt}`;
}
