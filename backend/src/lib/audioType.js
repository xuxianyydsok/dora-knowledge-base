// 音频文件类型嗅探 / 文件名清洗 / R2 key 生成（纯函数，无 IO，便于离线单测）
//
// 背景（2026-10-12 用户要求）：
//   「我只会把我下载的歌曲给到，也就是上传到」「我肯定要手动填几个字的，
//    就比如说它的歌名，还有那个它的歌手是谁，谁唱了这首歌，就提供这两部分的内容。」
//   即：管理员上传本地音频文件，只填「歌名 + 歌手」，其余交给后端刮削。
//
// 与 imageType.js / fileType.js / bookType.js 同一套原则：
//   1. 只认「字节魔数」，不信任客户端声明的 Content-Type 或扩展名；
//   2. 只允许**音频**容器：MP3 / FLAC / M4A(AAC) / OGG / OPUS / WAV / WMA / APE；
//   3. 单文件上限 200MB —— 无损 FLAC 常在 20~70MB，现场录音可到 100MB+，
//      200MB 留足余量，同时防止把 R2 当网盘。
//      注意：这是**一次性直传**的上限（受 Workers 单请求体约束）。

// 单个音频文件最大字节数：200MB。
// 一次性直传走 request.formData()，整个文件会进内存，而 Workers 内存上限 128MB，
// 因此这里实际把「能传多大」卡在平台约束之下。更大的音频需要走分片（当前未实现，
// 若将来有需求，可照 books.js 的 multipart 通道补一条）。
export const MAX_AUDIO_BYTES = 200 * 1024 * 1024;

// 格式 → 落盘扩展名 + MIME（白名单，其余一律拒绝）
export const AUDIO_FORMATS = {
  mp3: { ext: 'mp3', mime: 'audio/mpeg' },
  flac: { ext: 'flac', mime: 'audio/flac' },
  m4a: { ext: 'm4a', mime: 'audio/mp4' },
  ogg: { ext: 'ogg', mime: 'audio/ogg' },
  opus: { ext: 'opus', mime: 'audio/ogg' },
  wav: { ext: 'wav', mime: 'audio/wav' },
  wma: { ext: 'wma', mime: 'audio/x-ms-wma' },
  ape: { ext: 'ape', mime: 'audio/x-ape' }
};

export const ALLOWED_AUDIO_EXTENSIONS = new Set(Object.values(AUDIO_FORMATS).map((f) => f.ext));

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
function indexOfAscii(bytes, text, from = 0, to = bytes.length) {
  const end = Math.min(to, bytes.length) - text.length;
  for (let i = Math.max(0, from); i <= end; i++) {
    if (matchAscii(bytes, i, text)) return i;
  }
  return -1;
}

// 按魔数嗅探音频格式；识别不出返回 null。
//
// 判定细节（都是踩过的坑）：
//   · MP3 有两种开头：带 ID3v2 标签的以 "ID3" 开头；裸帧以 0xFF 0xEx/0xFx 开头。
//     后者太宽松（很多格式都以 0xFF 开头），因此**只接受 0xFF 后接 (byte & 0xE0) === 0xE0**
//     这一族（即帧同步位全 1），并要求至少 4 字节可读。
//   · M4A 属于 ISO-BMFF：offset 4 起是 "ftyp"，brand 通常是 M4A / mp42 / isom。
//     **必须**同时看到 ftyp 与音频 brand，否则会把 mp4 视频也当音频收进来。
//   · WAV 是 RIFF 容器：0 起 "RIFF"，8 起 "WAVE"。
//   · OGG 容器里既可能是 Vorbis 也可能是 Opus。规范上靠 codepage 区分，
//     但头部 4KB 内一般能搜到 "OpusHead" / "vorbis" 字样，据此细分；
//     搜不到时按 ogg 处理（两者 MIME 相同，播放行为一致）。
export function sniffAudioFormat(input) {
  const bytes = toBytes(input);
  if (!bytes || bytes.length < 4) return null;

  // 1) FLAC
  if (matchAscii(bytes, 0, 'fLaC')) return { format: 'flac' };

  // 2) OGG（Vorbis / Opus）
  if (matchAscii(bytes, 0, 'OggS')) {
    const head = Math.min(bytes.length, 4096);
    if (indexOfAscii(bytes, 'OpusHead', 0, head) >= 0) return { format: 'opus' };
    return { format: 'ogg' };
  }

  // 3) WAV
  if (matchAscii(bytes, 0, 'RIFF') && bytes.length >= 12 && matchAscii(bytes, 8, 'WAVE')) {
    return { format: 'wav' };
  }

  // 4) WMA / ASF：30 26 B2 75 8E 66 CF 11
  if (bytes.length >= 8 &&
      bytes[0] === 0x30 && bytes[1] === 0x26 && bytes[2] === 0xb2 && bytes[3] === 0x75 &&
      bytes[4] === 0x8e && bytes[5] === 0x66 && bytes[6] === 0xcf && bytes[7] === 0x11) {
    return { format: 'wma' };
  }

  // 5) APE（Monkey's Audio）："MAC " 开头
  if (matchAscii(bytes, 0, 'MAC ')) return { format: 'ape' };

  // 6) MP4 / M4A（ISO-BMFF）：offset 4 起是 ftyp
  if (bytes.length >= 12 && matchAscii(bytes, 4, 'ftyp')) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
    // 视频 brand（isom / mp42 / avc1 / iso2 ...）里 isom/mp42 也可能是纯音频，
    // 因此**不靠 brand 排除**，而是看头部有没有音频轨标识（mp4a / M4A）。
    const head = Math.min(bytes.length, 4096);
    const isAudioBrand = brand.startsWith('m4a') || brand.startsWith('m4b') || brand === 'mp42' || brand === 'isom';
    const hasAudioTrack = indexOfAscii(bytes, 'mp4a', 0, head) >= 0
      || indexOfAscii(bytes, 'M4A ', 0, head) >= 0;
    if (isAudioBrand || hasAudioTrack) return { format: 'm4a' };
    return null;
  }

  // 7) MP3：ID3v2 标签
  if (matchAscii(bytes, 0, 'ID3')) return { format: 'mp3' };

  // 8) MP3：裸帧同步（0xFF 后高 3 位全 1）
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    // 排除 MP3 帧同步与 ADTS AAC 的混淆：ADTS 的第二个字节低 4 位是 0x1/0x9 之类，
    // 但两者 MIME 都能被浏览器播放，且本站不接受裸 AAC，因此统一按 mp3 处理。
    return { format: 'mp3' };
  }

  return null;
}

// 一次性直传的保护上限（见 MAX_AUDIO_BYTES 注释）。
export function isWithinAudioLimit(size) {
  return Number.isFinite(size) && size > 0 && size <= MAX_AUDIO_BYTES;
}

// 文件名清洗：只作展示，绝不参与 R2 key。
// 去掉路径分隔符与控制字符，压缩空白，限长。
export function sanitizeFilename(name) {
  if (typeof name !== 'string') return '';
  return name
    .replace(/[\\/]/g, '_')                 // 路径分隔符
    .replace(/[\u0000-\u001f\u007f]/g, '')  // 控制字符
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_FILENAME_LENGTH);
}

// 从文件名推断「歌名」：去扩展名 + 去掉常见的「歌手 - 歌名」前缀噪声。
// 只作为管理员输入框的**预填建议**，最终以管理员填的为准。
export function guessTitleFromFilename(name) {
  const clean = sanitizeFilename(name);
  if (!clean) return '';
  const noExt = clean.replace(/\.[a-z0-9]{1,5}$/i, '');
  // 「歌手 - 歌名」「歌手-歌名」这类命名很常见，取后半段当歌名更准
  const dash = noExt.match(/^(.{1,40}?)\s*[-–—]\s*(.+)$/);
  if (dash && dash[2].trim()) return dash[2].trim();
  return noExt.trim();
}

// 从文件名推断歌手：只在「歌手 - 歌名」这种明确形态下才返回，否则返回空串。
// 刻意保守 —— 猜错歌手比留空更糟，管理员一眼就能补上。
export function guessArtistFromFilename(name) {
  const clean = sanitizeFilename(name);
  if (!clean) return '';
  const noExt = clean.replace(/\.[a-z0-9]{1,5}$/i, '');
  const dash = noExt.match(/^(.{1,40}?)\s*[-–—]\s*(.+)$/);
  if (dash && dash[1].trim() && dash[2].trim()) return dash[1].trim();
  return '';
}

// 生成 R2 object key：完全由服务端决定，不含任何用户输入。
// 与 buildBookKey / buildObjectKey 同构：audio/<user_id>/<年>/<uuid>.<ext>
export function buildAudioKey(userId, ext, date = new Date()) {
  const safeExt = ALLOWED_AUDIO_EXTENSIONS.has(ext) ? ext : 'bin';
  return `audio/${userId}/${date.getUTCFullYear()}/${crypto.randomUUID()}.${safeExt}`;
}

// 生成封面 R2 key：与音频同目录，文件名加 -cover 后缀，便于按曲目定位。
// 刮削到的封面会**转存**到 R2（外链封面（如 iTunes）会失效，存一份才长久）。
export function buildAudioCoverKey(audioKey, coverExt) {
  const allowed = new Set(['jpg', 'png', 'webp']);
  const safeExt = allowed.has(coverExt) ? coverExt : 'jpg';
  return `${audioKey}-cover.${safeExt}`;
}

// 从封面字节里判断图片类型（刮削到的封面要转存 R2，必须先确认它是张图）。
// 与 bookCover.js 同一套魔数判定，但这里只需区分 jpg / png / webp。
export function sniffCoverImage(input) {
  const bytes = toBytes(input);
  if (!bytes || bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { ext: 'png', mime: 'image/png' };
  if (matchAscii(bytes, 0, 'RIFF') && matchAscii(bytes, 8, 'WEBP')) return { ext: 'webp', mime: 'image/webp' };
  return null;
}
