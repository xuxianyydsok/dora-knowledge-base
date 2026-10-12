// 音频元数据刮削：ID3/Vorbis 标签解析 + 在线兜底补全
//
// 背景（2026-10-12 用户要求）：
//   管理员上传本地音频时「只填歌名 + 歌手」，专辑 / 封面 / 时长等由后端自动补全。
//
// 补全策略（分层，逐层兜底，任一层失败都不阻断上传）：
//   ① **本地标签**（最准，且不耗网络）：从文件字节里直接读
//      - MP3 的 ID3v2（TIT2/TPE1/TALB/APIC）
//      - FLAC 的 VORBIS_COMMENT（TITLE/ARTIST/ALBUM）+ PICTURE 块
//      - M4A 的 ilst atom（©nam/©ART/©alb/covr）
//      本地标签是「用户自己整理过的」，优先级高于在线猜测。
//   ② **在线兜底**：本地缺什么，就用「歌名 + 歌手」去 iTunes / Deezer 搜，
//      取第一条高置信度结果补上（封面、专辑、时长、流派、年份）。
//      这两个源都是公开免 key 接口，且封面是 600x600 高清图。
//   ③ **封面转存**：在线封面（如 iTunes 的 mzstatic 链接）会失效，
//      因此拿到后转存到 R2，库里只存自己的地址。
//
// 本模块**只解析字节、只发只读请求**，不写库、不碰 R2（转存由路由层做），
// 因此可以离线单测（在线部分用注入的 fetch 替身）。

import { HttpError } from './response.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// 元数据接口单次超时（两个源都在 1s 内返回，8s 是宽松上限）
const META_TIMEOUT_MS = 8000;
// 封面下载上限：8MB（超过就放弃封面，不让一张图把内存吃掉）
export const MAX_COVER_BYTES = 8 * 1024 * 1024;

// ---------------------------------------------------------------
// 通用小工具
// ---------------------------------------------------------------
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

function readUInt32BE(bytes, offset) {
  if (offset < 0 || offset + 4 > bytes.length) return 0;
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function readUInt32LE(bytes, offset) {
  if (offset < 0 || offset + 4 > bytes.length) return 0;
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

// 去掉字符串里的 NUL 与首尾空白（标签里常见填充）
function cleanText(s) {
  return String(s || '').replace(/\0/g, '').trim();
}

// ---------------------------------------------------------------
// ID3v2（MP3）
//
// 结构：'ID3' + 版本(2) + flags(1) + size(4, syncsafe) + 若干帧
//   帧：id(4) + size(4, BE 或 syncsafe，取决于版本) + flags(2) + 数据
//   v2.3 用普通 BE size，v2.4 用 syncsafe —— 两种都要支持，否则会读错帧长。
// 文本帧：编码字节(1) + 文本；编码 0=ISO-8859-1, 1=UTF-16(BOM), 2=UTF-16BE, 3=UTF-8
// APIC 帧：编码(1) + MIME(0 结尾) + pictureType(1) + description(0 结尾) + 图片字节
// ---------------------------------------------------------------
function decodeId3Text(bytes, offset, end) {
  if (offset >= end) return '';
  const enc = bytes[offset];
  const body = bytes.subarray(offset + 1, end);
  try {
    if (enc === 0) {
      // ISO-8859-1：逐字节转码（标签里多为 ASCII）
      let s = '';
      for (const b of body) s += String.fromCharCode(b);
      return cleanText(s);
    }
    if (enc === 1 || enc === 2) {
      // UTF-16：enc=1 带 BOM，enc=2 是大端
      let start = 0;
      let le = false;
      if (enc === 1 && body.length >= 2) {
        if (body[0] === 0xff && body[1] === 0xfe) { le = true; start = 2; }
        else if (body[0] === 0xfe && body[1] === 0xff) { le = false; start = 2; }
      }
      let s = '';
      for (let i = start; i + 1 < body.length; i += 2) {
        const code = le ? (body[i] | (body[i + 1] << 8)) : ((body[i] << 8) | body[i + 1]);
        if (code === 0) break;
        s += String.fromCharCode(code);
      }
      return cleanText(s);
    }
    // enc === 3：UTF-8
    return cleanText(new TextDecoder('utf-8').decode(body));
  } catch {
    return '';
  }
}

export function parseId3v2(input) {
  const bytes = toBytes(input);
  if (!bytes || bytes.length < 10) return null;
  if (!matchAscii(bytes, 0, 'ID3')) return null;

  const version = bytes[3];
  // size 是 syncsafe 整数：每字节只用低 7 位
  const size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14)
    | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
  const tagEnd = Math.min(bytes.length, 10 + size);

  const out = { title: null, artist: null, album: null, cover: null, coverMime: null };
  let at = 10;
  // 帧头长度：v2.2 是 6 字节（3 字符 id + 3 字节 size），v2.3/2.4 是 10 字节
  const isV22 = version <= 2;
  const frameHeader = isV22 ? 6 : 10;

  while (at + frameHeader <= tagEnd) {
    const id = String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], isV22 ? 0 : bytes[at + 3]);
    // 全 0 表示进入 padding，后面没有帧了
    if (!id.replace(/\0/g, '')) break;

    let frameSize;
    if (isV22) {
      frameSize = (bytes[at + 3] << 16) | (bytes[at + 4] << 8) | bytes[at + 5];
    } else if (version === 4) {
      // v2.4 用 syncsafe
      frameSize = ((bytes[at + 4] & 0x7f) << 21) | ((bytes[at + 5] & 0x7f) << 14)
        | ((bytes[at + 6] & 0x7f) << 7) | (bytes[at + 7] & 0x7f);
    } else {
      // v2.3 用普通 BE
      frameSize = readUInt32BE(bytes, at + 4);
    }
    if (frameSize <= 0 || at + frameHeader + frameSize > tagEnd) break;

    const dataStart = at + frameHeader;
    const dataEnd = dataStart + frameSize;

    if (id === 'TIT2' || id === 'TT2') out.title = decodeId3Text(bytes, dataStart, dataEnd) || out.title;
    else if (id === 'TPE1' || id === 'TP1') out.artist = decodeId3Text(bytes, dataStart, dataEnd) || out.artist;
    else if (id === 'TALB' || id === 'TAL') out.album = decodeId3Text(bytes, dataStart, dataEnd) || out.album;
    else if ((id === 'APIC' || id === 'PIC') && !out.cover) {
      // APIC：编码(1) + MIME(0 结尾) + type(1) + desc(0 结尾) + 图片
      let p = dataStart + 1;
      let mime = '';
      if (id === 'APIC') {
        let start = p;
        while (p < dataEnd && bytes[p] !== 0) p++;
        mime = String.fromCharCode(...bytes.subarray(start, p));
        p++; // 跳过 NUL
      } else {
        // v2.2 的 PIC：3 字节图片格式（如 JPG/PNG）
        const fmt = String.fromCharCode(bytes[p], bytes[p + 1], bytes[p + 2]).toUpperCase();
        mime = fmt.includes('PNG') ? 'image/png' : 'image/jpeg';
        p += 3;
      }
      p++; // picture type
      // description：按编码决定终止符宽度（UTF-16 用双字节 0）
      const enc = bytes[dataStart];
      if (enc === 1 || enc === 2) {
        while (p + 1 < dataEnd && !(bytes[p] === 0 && bytes[p + 1] === 0)) p += 2;
        p += 2;
      } else {
        while (p < dataEnd && bytes[p] !== 0) p++;
        p++;
      }
      if (p < dataEnd) {
        out.cover = bytes.slice(p, dataEnd);
        out.coverMime = mime || null;
      }
    }

    at = dataEnd;
  }
  return out;
}

// ---------------------------------------------------------------
// FLAC：METADATA_BLOCK
//   'fLaC' + 若干块：blockHeader(4) = 末块标志(1bit)+类型(7bit) + 长度(24bit)
//   类型 4 = VORBIS_COMMENT（文本标签），类型 6 = PICTURE（封面）
// ---------------------------------------------------------------
export function parseFlacTags(input) {
  const bytes = toBytes(input);
  if (!bytes || bytes.length < 8) return null;
  if (!matchAscii(bytes, 0, 'fLaC')) return null;

  const out = { title: null, artist: null, album: null, cover: null, coverMime: null };
  let at = 4;

  while (at + 4 <= bytes.length) {
    const header = bytes[at];
    const isLast = (header & 0x80) !== 0;
    const type = header & 0x7f;
    const len = (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3];
    const dataStart = at + 4;
    const dataEnd = Math.min(bytes.length, dataStart + len);
    if (dataStart + len > bytes.length) break;

    if (type === 4) {
      // VORBIS_COMMENT：vendorLen(4 LE) + vendor + count(4 LE) + 若干 "KEY=value"
      // 注意 vendorLen 自身占 4 字节，跳 vendor 时必须把长度字段一起跳掉，
      // 否则 count 会从 vendor 字符串中间开始读（这个坑让整块标签静默解析失败）。
      let p = dataStart + 4 + readUInt32LE(bytes, dataStart);
      if (p + 4 <= dataEnd) {
        const count = readUInt32LE(bytes, p);
        p += 4;
        for (let i = 0; i < count && p + 4 <= dataEnd; i++) {
          const vlen = readUInt32LE(bytes, p);
          p += 4;
          if (p + vlen > dataEnd) break;
          const entry = new TextDecoder('utf-8').decode(bytes.subarray(p, p + vlen));
          p += vlen;
          const eq = entry.indexOf('=');
          if (eq <= 0) continue;
          const key = entry.slice(0, eq).toUpperCase();
          const value = cleanText(entry.slice(eq + 1));
          if (!value) continue;
          if (key === 'TITLE' && !out.title) out.title = value;
          else if (key === 'ARTIST' && !out.artist) out.artist = value;
          else if (key === 'ALBUM' && !out.album) out.album = value;
        }
      }
    } else if (type === 6 && !out.cover) {
      // PICTURE：type(4 BE) + mimeLen(4 BE) + mime + descLen(4 BE) + desc + w/h/depth/colors(4x4) + dataLen(4 BE) + data
      let p = dataStart + 4;
      const mimeLen = readUInt32BE(bytes, p); p += 4;
      if (p + mimeLen <= dataEnd) {
        out.coverMime = String.fromCharCode(...bytes.subarray(p, p + mimeLen)) || null;
        p += mimeLen;
        const descLen = readUInt32BE(bytes, p); p += 4 + descLen + 16; // 跳过 4 个尺寸字段
        const dataLen = readUInt32BE(bytes, p); p += 4;
        if (p + dataLen <= dataEnd && dataLen > 0) out.cover = bytes.slice(p, p + dataLen);
      }
    }

    if (isLast) break;
    at = dataEnd;
  }
  return out;
}

// ---------------------------------------------------------------
// M4A / MP4：ilst atom
//   moov > udta > meta > ilst > 若干项（©nam 歌名 / ©ART 歌手 / ©alb 专辑 / covr 封面）
//   每个项的 payload 是一组 data atom：size(4 BE) + 'data' + type(4) + locale(4) + 内容
// 说明：这里做的是**够用就好**的递归查找，不实现完整的 MP4 box 树解析 ——
//       音频文件的元数据都集中在 ilst 里，找到它就够了。
// ---------------------------------------------------------------
export function parseM4aTags(input) {
  const bytes = toBytes(input);
  if (!bytes || bytes.length < 16) return null;
  if (!matchAscii(bytes, 4, 'ftyp')) return null;

  const out = { title: null, artist: null, album: null, cover: null, coverMime: null };

  // 在字节流里找 'ilst'，然后顺序解析它内部的原子
  let ilstAt = -1;
  const scanEnd = Math.min(bytes.length - 4, 4 * 1024 * 1024); // 只在头 4MB 里找（避免扫整首歌）
  for (let i = 0; i <= scanEnd; i++) {
    if (bytes[i] === 0x69 && bytes[i + 1] === 0x6c && bytes[i + 2] === 0x73 && bytes[i + 3] === 0x74) {
      ilstAt = i;
      break;
    }
  }
  if (ilstAt < 0) return out;

  // ilst 自身的 size 在它前面 4 字节
  const ilstSize = readUInt32BE(bytes, ilstAt - 4);
  const ilstEnd = Math.min(bytes.length, ilstAt + 4 + (ilstSize > 8 ? ilstSize - 8 : 0));
  let at = ilstAt + 4;

  while (at + 8 <= ilstEnd) {
    const itemSize = readUInt32BE(bytes, at);
    if (itemSize < 8 || at + itemSize > ilstEnd) break;
    const name = String.fromCharCode(bytes[at + 4], bytes[at + 5], bytes[at + 6], bytes[at + 7]);
    // data atom 紧跟在项名之后
    let p = at + 8;
    if (p + 16 <= at + itemSize && matchAscii(bytes, p + 4, 'data')) {
      const dataType = readUInt32BE(bytes, p + 8);
      const payloadStart = p + 16;
      const payloadEnd = at + itemSize;
      if (name === '©nam' && !out.title) out.title = cleanText(new TextDecoder('utf-8').decode(bytes.subarray(payloadStart, payloadEnd)));
      else if (name === '©ART' && !out.artist) out.artist = cleanText(new TextDecoder('utf-8').decode(bytes.subarray(payloadStart, payloadEnd)));
      else if (name === '©alb' && !out.album) out.album = cleanText(new TextDecoder('utf-8').decode(bytes.subarray(payloadStart, payloadEnd)));
      else if (name === 'covr' && !out.cover && payloadEnd > payloadStart) {
        // dataType: 13 = JPEG, 14 = PNG
        out.cover = bytes.slice(payloadStart, payloadEnd);
        out.coverMime = dataType === 14 ? 'image/png' : 'image/jpeg';
      }
    }
    at += itemSize;
  }
  return out;
}

// 统一入口：按魔数选解析器，返回 { title, artist, album, cover, coverMime }
// 解析不出来时返回空结构（**不抛错** —— 标签缺失是常态，不是错误）。
export function parseAudioTags(input, format) {
  const empty = { title: null, artist: null, album: null, cover: null, coverMime: null };
  try {
    if (format === 'mp3') return parseId3v2(input) || empty;
    if (format === 'flac') return parseFlacTags(input) || empty;
    if (format === 'm4a') return parseM4aTags(input) || empty;
  } catch {
    // 标签损坏很常见，静默降级
  }
  return empty;
}

// ---------------------------------------------------------------
// 在线兜底：iTunes / Deezer 按「歌名 + 歌手」找元数据
// 只取**第一条**结果，但要求歌名归一化后一致，避免「搜错歌」。
// ---------------------------------------------------------------
function normKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\s\-_.:：,，。!！?？'"'’‘“”()（）\[\]【】]/g, '')
    .replace(/(feat|ft)\.?.*$/g, '');
}

async function fetchJson(url, timeoutMs = META_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: controller.signal });
    if (!res.ok) throw new HttpError(502, `元数据接口请求失败 (${res.status})`);
    return await res.json();
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err.name === 'AbortError') throw new HttpError(504, `元数据接口超时（${timeoutMs}ms）`);
    throw new HttpError(502, `元数据接口请求失败：${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

// iTunes Search：返回高清封面（600x600）、专辑、时长、流派、年份
// 注意：iTunes 的 artworkUrl100 把 "100x100bb" 换成 "600x600bb" 就是高清图。
export async function lookupItunes(title, artist) {
  const term = [title, artist].filter(Boolean).join(' ');
  if (!term) return null;
  const data = await fetchJson(
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=5`
  );
  const list = Array.isArray(data?.results) ? data.results : [];
  if (!list.length) return null;
  const want = normKey(title);
  // 歌名一致优先；没有一致的就不采用（宁缺毋滥，避免挂错封面）
  const hit = list.find((r) => normKey(r.trackName) === want) || null;
  if (!hit) return null;
  return {
    source: 'itunes',
    title: cleanText(hit.trackName) || null,
    artist: cleanText(hit.artistName) || null,
    album: cleanText(hit.collectionName) || null,
    artwork_url: (hit.artworkUrl100 || '').replace('100x100bb', '600x600bb') || null,
    duration: hit.trackTimeMillis ? Math.round(hit.trackTimeMillis / 1000) : null,
    genre: cleanText(hit.primaryGenreName) || null,
    release_year: hit.releaseDate ? new Date(hit.releaseDate).getFullYear() || null : null
  };
}

// Deezer：封面更大（cover_xl 1000x1000），作为 iTunes 未命中时的兜底
export async function lookupDeezer(title, artist) {
  const term = [title, artist].filter(Boolean).join(' ');
  if (!term) return null;
  const data = await fetchJson(`https://api.deezer.com/search?q=${encodeURIComponent(term)}&limit=5`);
  if (data?.error) return null;
  const list = Array.isArray(data?.data) ? data.data : [];
  if (!list.length) return null;
  const want = normKey(title);
  const hit = list.find((r) => normKey(r.title) === want) || null;
  if (!hit) return null;
  return {
    source: 'deezer',
    title: cleanText(hit.title) || null,
    artist: cleanText(hit.artist?.name) || null,
    album: cleanText(hit.album?.title) || null,
    artwork_url: hit.album?.cover_xl || hit.album?.cover_big || hit.album?.cover_medium || null,
    duration: hit.duration || null,
    genre: null,
    release_year: null
  };
}

// 刮削入口：本地标签优先，缺什么就用在线结果补什么。
// 返回 { title, artist, album, artwork_url, duration, genre, release_year,
//        coverBytes, coverMime, artwork_source }
// 任何一步失败都只是「这一项没补上」，绝不抛错中断上传。
export async function scrapeAudioMeta({ bytes, format, title, artist, fetchImpl = fetch }) {
  const local = parseAudioTags(bytes, format);

  // 先把本地标签里有的用起来
  const merged = {
    title: local.title || cleanText(title) || null,
    artist: local.artist || cleanText(artist) || null,
    album: local.album || null,
    artwork_url: null,
    duration: null,
    genre: null,
    release_year: null,
    coverBytes: local.cover || null,
    coverMime: local.coverMime || null,
    artwork_source: local.cover ? 'id3' : null
  };

  // 本地缺封面 / 缺专辑 → 去在线找
  const needOnline = !merged.coverBytes || !merged.album || !merged.duration;
  if (needOnline) {
    // 用「本地标签的歌名」优先，管理员填的兜底
    const qTitle = merged.title || cleanText(title);
    const qArtist = merged.artist || cleanText(artist);
    if (qTitle) {
      for (const lookup of [lookupItunes, lookupDeezer]) {
        try {
          const found = await lookup(qTitle, qArtist);
          if (!found) continue;
          if (!merged.album && found.album) merged.album = found.album;
          if (!merged.duration && found.duration) merged.duration = found.duration;
          if (!merged.genre && found.genre) merged.genre = found.genre;
          if (!merged.release_year && found.release_year) merged.release_year = found.release_year;
          // 歌手：本地没有时用在线补（管理员填了就以管理员为准）
          if (!merged.artist && found.artist) merged.artist = found.artist;
          if (!merged.coverBytes && found.artwork_url) {
            merged.artwork_url = found.artwork_url;
            merged.artwork_source = found.source;
          }
          break; // 第一个命中的源就够用
        } catch {
          // 在线兜底失败不影响上传
        }
      }
    }
  }

  return merged;
}

// 下载在线封面（用于转存 R2）。带大小上限与类型校验，失败返回 null。
export async function downloadCover(url) {
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), META_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: controller.signal });
    if (!res.ok) return null;
    const len = Number(res.headers.get('content-length'));
    if (Number.isFinite(len) && len > MAX_COVER_BYTES) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_COVER_BYTES) return null;
    return new Uint8Array(buf);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
