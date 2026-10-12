// 音乐「管理员上传本地音频」接口
//
// 背景（2026-10-12 用户原话）：
//   「音乐的话，用户就是没有登录或者用户的那个界面的话，是不能手动录入音乐的。
//    然后呢，就是管理员端的话，可以就是直接上传音乐，然后要正确的识别，
//    并且将它的一个歌手或者专辑的那个图像给刮削出来，然后对应的歌词的话也要配好」
//   「我肯定要手动填几个字的，就比如说它的歌名，还有那个它的歌手是谁，
//    谁唱了这首歌，就提供这两部分的内容。」
//
// 因此本模块的形态是：
//   管理员上传音频文件 → 只填「歌名 + 歌手（+ 可选歌词）」 → 后端自动刮削专辑 / 封面 /
//   歌词（手填歌词优先） →
//   落 R2 + 落库 → 前端音乐页直接能播。
//
// 为什么不用 multipart/form-data：
//   无损 FLAC 常在 20~70MB，`request.formData()` 会把整个文件读进内存，
//   而 Workers 内存上限 128MB —— 会直接爆。因此走**原始请求体直传**：
//     请求体        = 音频文件字节（Content-Type: application/octet-stream）
//     X-Audio-Name  = 文件名（encodeURIComponent 编码）
//     X-Audio-Title = 歌名（encodeURIComponent 编码）
//     X-Audio-Artist= 歌手（encodeURIComponent 编码）
//     X-Audio-Lyrics= 歌词（可选，encodeURIComponent 编码；填了就不再联网刮削）
//   这与 books.js 的两条上传通道是同一套思路（那边甚至还有分片通道）。
//
// 路由（见 router.js）：
//   POST   /api/music/upload        上传（requireAdmin，原始请求体直传）
//   GET    /api/music/:id/audio     音频字节（公开可读，支持 Range，供 <audio> 播放）
//   GET    /api/music/:id/cover     封面图（公开可读）
//
// 安全：
//   · object key 由服务端生成（audio/<user_id>/<年>/<uuid>.<ext>），用户文件名只作展示；
//   · audio_key / cover_key 绝不对外返回，对外只给上面两个「按 id 取字节」的端点；
//   · 上传要求 requireAdmin（普通用户与访客都不能录音乐）。

import { ok, HttpError, corsHeaders } from '../lib/response.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { requireUuid } from '../lib/validate.js';
import {
  sniffAudioFormat, sanitizeFilename, guessTitleFromFilename, guessArtistFromFilename,
  buildAudioKey, buildAudioCoverKey, sniffCoverImage,
  isWithinAudioLimit, MAX_AUDIO_BYTES, AUDIO_FORMATS
} from '../lib/audioType.js';
import { scrapeAudioMeta, downloadCover } from '../lib/audioMeta.js';
import { takeHeadAndRest, limitStream, withKnownLength, serveR2Object } from '../lib/r2Stream.js';
import { fetchLyrics } from '../lib/fetchers.js';
import { dedupeMusicList, findDuplicateMusic, musicIdentity, normalizeMusicText } from '../lib/musicIdentity.js';
import { withTags, getProgress } from '../lib/resources.js';
import { toSimplified, hasTraditional } from '../lib/zhConvert.js';

const TABLE = 'resources';
const EXT = 'music_tracks';
const TYPE = 'music';

// 嗅探魔数需要的头部字节数（4KB 足够认出所有音频容器）
const HEAD_PROBE_BYTES = 4096;

// 从自定义头里取 UTF-8 字符串（前端用 encodeURIComponent 编码）
function headerText(request, name) {
  const raw = request.headers.get(name);
  if (!raw) return '';
  try { return decodeURIComponent(raw); } catch { return raw; }
}

function requestOrigin(request, env) {
  try { return new URL(request.url).origin; }
  catch { return env.ASSET_PUBLIC_BASE || 'https://api.xuguochen.de5.net'; }
}

// 读取音乐扩展记录
async function loadTrack(db, resourceId) {
  const rows = await db.select(EXT, qs({ select: '*', resource_id: `eq.${resourceId}` }));
  return rows[0] || null;
}

// 组装对外结构：把 R2 的内部 key 换成「按 id 取字节」的公开地址，
// 并且**绝不**把 audio_key / cover_key 本身发出去。
function shapeForClient(resource, track, origin) {
  const { audio_key, cover_key, ...rest } = track || {};
  const audioUrl = audio_key ? `${origin}/api/music/${resource.id}/audio` : (track?.audio_url || null);
  const coverUrl = cover_key ? `${origin}/api/music/${resource.id}/cover` : (track?.artwork_url || null);
  return {
    ...resource,
    cover_path: coverUrl,
    track: { ...rest, audio_url: audioUrl, artwork_url: coverUrl }
  };
}

// ---------------------------------------------------------------
// POST /api/music/upload —— 管理员上传本地音频
// ---------------------------------------------------------------
export async function uploadMusic(request, env) {
  const { db, user } = await requireAdmin(request, env);
  if (!env.R2_BUCKET) throw new HttpError(503, '存储未配置（缺少 R2_BUCKET 绑定）');

  // 声明长度先做一次快速拒绝（省掉无谓的流式写入）
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > 0 && !isWithinAudioLimit(declaredLength)) {
    throw new HttpError(413, `音频过大，单曲上限 ${Math.round(MAX_AUDIO_BYTES / 1024 / 1024)}MB`);
  }

  // 歌名 / 歌手来自请求头（管理员手填，必填歌名）
  const rawName = headerText(request, 'x-audio-name');
  const titleInput = headerText(request, 'x-audio-title').trim();
  const artistInput = headerText(request, 'x-audio-artist').trim();
  // 歌词：2026-10-13 用户要求「管理员端只用负责导入音乐和填写它的歌手和歌词就行了」。
  // 手填歌词优先于自动刮削 —— 站长贴了歌词说明他就是要这一份（可能是自己校对过的），
  // 再联网覆盖反而会把他的内容冲掉。
  const lyricsInput = headerText(request, 'x-audio-lyrics').trim();
  if (!titleInput) throw new HttpError(422, '请填写歌名');
  if (titleInput.length > 300) throw new HttpError(422, '歌名过长（上限 300 字）');
  if (artistInput.length > 200) throw new HttpError(422, '歌手名过长（上限 200 字）');
  if (lyricsInput.length > 20000) throw new HttpError(422, '歌词过长（上限 20000 字）');

  // 嗅探真实格式（不信任 Content-Type / 扩展名）
  const { head, rest } = await takeHeadAndRest(request, HEAD_PROBE_BYTES);
  const sniffed = sniffAudioFormat(head);
  if (!sniffed) {
    throw new HttpError(415, '仅支持 MP3 / FLAC / M4A / OGG / OPUS / WAV / WMA / APE 音频，且文件内容需与格式一致');
  }
  const spec = AUDIO_FORMATS[sniffed.format];

  const objectKey = buildAudioKey(user.id, spec.ext);
  const origin = requestOrigin(request, env);

  // 流式写 R2：request.body 原样灌进去，不整首读进内存
  let putResult;
  try {
    const limited = limitStream(rest, MAX_AUDIO_BYTES, () =>
      new HttpError(413, `音频过大，单曲上限 ${Math.round(MAX_AUDIO_BYTES / 1024 / 1024)}MB`));
    putResult = await env.R2_BUCKET.put(objectKey, withKnownLength(limited, declaredLength), {
      httpMetadata: { contentType: spec.mime }
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.error('R2 put 失败:', objectKey, err?.message || err);
    throw new HttpError(502, '音频写入存储失败，请稍后重试');
  }

  const size = Number(putResult?.size) || declaredLength || 0;
  const etag = putResult?.httpEtag || null;

  // 失败补偿：入库失败时把刚写进 R2 的对象删掉，避免留下孤儿对象
  try {
    return await finalizeUpload(env, db, user, {
      objectKey, size, etag, titleInput, artistInput, rawName, spec,
      format: sniffed.format, origin, request, lyricsInput
    });
  } catch (err) {
    try { await env.R2_BUCKET.delete(objectKey); } catch { /* 补偿失败不掩盖原始错误 */ }
    throw err;
  }
}

// ---------------------------------------------------------------
// 收尾：刮削元数据 → 转存封面 → 取歌词 → 落库
// 抽出来是为了让「失败补偿」只写一次（外层 catch 统一删 R2 对象）。
// ---------------------------------------------------------------
async function finalizeUpload(env, db, user, {
  objectKey, size, etag, titleInput, artistInput, rawName, spec, format, origin, request, lyricsInput
}) {
  // ① 刮削：本地标签优先，缺什么用 iTunes / Deezer 补什么。
  //    需要文件头部字节来读标签，这里只从 R2 读前 1MB（足够覆盖 ID3/FLAC 标签区）。
  let headBytes = null;
  try {
    const probeLen = Math.min(size, 1024 * 1024);
    const obj = await env.R2_BUCKET.get(objectKey, { range: { offset: 0, length: probeLen } });
    if (obj) headBytes = new Uint8Array(await obj.arrayBuffer());
  } catch {
    // 读标签失败不影响上传
  }

  const meta = await scrapeAudioMeta({
    bytes: headBytes, format, title: titleInput, artist: artistInput
  }).catch(() => ({
    title: titleInput, artist: artistInput, album: null, artwork_url: null,
    duration: null, genre: null, release_year: null,
    coverBytes: null, coverMime: null, artwork_source: null
  }));

  // ② 封面转存 R2：内嵌封面直接用；只有在线链接时才下载。
  //    转存是必要的 —— iTunes / Deezer 的外链封面会失效，存一份才长久。
  let coverKey = null;
  let coverBytes = meta.coverBytes || null;
  if (!coverBytes && meta.artwork_url) {
    coverBytes = await downloadCover(meta.artwork_url).catch(() => null);
  }
  if (coverBytes && coverBytes.byteLength) {
    const coverSpec = sniffCoverImage(coverBytes);
    if (coverSpec) {
      coverKey = buildAudioCoverKey(objectKey, coverSpec.ext);
      try {
        await env.R2_BUCKET.put(coverKey, coverBytes, { httpMetadata: { contentType: coverSpec.mime } });
      } catch {
        coverKey = null; // 封面写失败不阻断上传，只是没封面
      }
    }
  }

  // ③ 歌词：管理员手填的优先；没填才用「歌名 + 歌手」去 LRCLIB / GD 找同步歌词。
  //    繁体转简体交给 zhConvert（子代理并行开发中；这里做成可选依赖，
  //    模块缺失时自动跳过转换，不影响上传）。
  let lyrics = lyricsInput || null;
  let lyricsSource = lyricsInput ? 'manual' : null;
  if (!lyrics) {
    try {
      const found = await fetchLyrics({
        title: meta.title || titleInput,
        artist: meta.artist || artistInput,
        album: meta.album,
        duration: meta.duration
      }, env.GD_MUSIC_SOURCE || undefined);
      lyrics = found.synced || found.plain || null;
      lyricsSource = found.source || null;
    } catch {
      // 找不到歌词是常态，不是错误
    }
  }
  // 歌词统一转简体（用户要求：「有些时候搜出来的歌词展现的是繁体中文，这一点需要改正」）。
  // 带时间轴的 LRC 只转汉字、原样保留 [mm:ss.xx]，因此不会破坏同步。
  if (lyrics && hasTraditional(lyrics)) lyrics = toSimplified(lyrics);

  // ④ 查重：同一首歌（歌名 + 歌手归一化后一致）已存在时，删掉刚传的对象并返回已有那条。
  //    与 createMusic 同一套口径（musicIdentity.js），避免「同一首传两次」。
  const mine = await db.select(TABLE, qs({
    select: 'id,title', type: `eq.${TYPE}`, user_id: `eq.${user.id}`, order: 'created_at.desc'
  }));
  if (mine.length) {
    const key = musicIdentity({ title: meta.title || titleInput, artist: meta.artist || artistInput });
    const titleMatched = mine.filter((r) => normalizeMusicText(r.title) === normalizeMusicText(meta.title || titleInput));
    if (key && titleMatched.length) {
      const candRows = await db.select(EXT, qs({
        select: '*', resource_id: `in.(${titleMatched.map((r) => r.id).join(',')})`
      }));
      const candMap = Object.fromEntries(candRows.map((r) => [r.resource_id, r]));
      const dup = findDuplicateMusic(titleMatched, candMap, {
        title: meta.title || titleInput, artist: meta.artist || artistInput
      });
      if (dup) {
        try {
          await env.R2_BUCKET.delete(objectKey);
          if (coverKey) await env.R2_BUCKET.delete(coverKey);
        } catch { /* 清理失败不影响返回 */ }
        const full = await db.select(TABLE, qs({ select: '*', id: `eq.${dup.id}` }));
        const [tagged] = await withTags(db, full);
        const track = await loadTrack(db, dup.id);
        return ok({ ...shapeForClient(tagged, track, origin), duplicate: true }, request, env, 200);
      }
    }
  }

  // ⑤ 落库：主资源 + 音乐扩展
  const resourceRows = await db.insert(TABLE, {
    user_id: user.id,
    type: TYPE,
    title: meta.title || titleInput,
    url: `${origin}/api/music/upload`,   // 占位：真实播放地址由 audio_key 推导
    source: 'upload',
    cover_path: null,                     // 落库后再按 coverKey 回填（见下）
    summary: null,
    metadata: {
      artist: meta.artist || artistInput,
      album: meta.album,
      duration: meta.duration,
      genre: meta.genre,
      quality: 'full',
      bitrate: null,
      format: format,
      file_size: size,
      uploaded: true
    },
    is_public: false   // 上传的曲目默认私有，由管理员在编辑页决定是否公开
  });
  const resource = resourceRows[0];

  await db.insert(EXT, {
    resource_id: resource.id,
    user_id: user.id,
    artist: meta.artist || artistInput,
    album: meta.album,
    artwork_url: null,                    // 对外地址由 shapeForClient 推导
    audio_url: null,                      // 同上：不把内部 key 塞进 audio_url
    preview_url: null,
    quality: 'full',
    duration: meta.duration,
    genre: meta.genre,
    release_year: meta.release_year,
    lyrics,
    audio_key: objectKey,
    cover_key: coverKey,
    uploaded: true,
    meta_source: meta.coverBytes ? 'id3' : (meta.artwork_source || 'manual')
  });

  const full = await db.select(TABLE, qs({ select: '*', id: `eq.${resource.id}` }));
  const [tagged] = await withTags(db, full);
  const track = await loadTrack(db, resource.id);

  return ok({
    ...shapeForClient(tagged, track, origin),
    // 让管理员一眼看出「封面刮到了没有、歌词配上了没有」
    artwork_source: coverKey ? (meta.coverBytes ? 'id3' : meta.artwork_source) : null,
    lyrics_source: lyricsSource,
    has_lyrics: !!lyrics,
    file_size: size,
    audio_format: format,
    etag
  }, request, env, 201);
}

// ---------------------------------------------------------------
// GET /api/music/:id/audio —— 音频字节（公开可读 + Range）
// ---------------------------------------------------------------
export async function getMusicAudio(request, env, id) {
  requireUuid(id, 'id');
  const { db, user } = await requireAuth(request, env);

  const rows = await db.select(TABLE, qs({ select: 'id,user_id,is_public,type', id: `eq.${id}`, type: `eq.${TYPE}` }));
  const row = rows[0];
  if (!row) throw new HttpError(404, '音乐不存在');
  const track = await loadTrack(db, id);
  if (!track?.audio_key) throw new HttpError(404, '这首曲目没有上传音频');

  // 可见性：公开曲目对所有人可读；私有的只有本人（访客上下文的 user.id 是站长 id，
  // 但 isGuest 恒 true，因此必须显式排除访客，否则站长的私有上传会被访客读走）
  const readable = row.is_public === true
    || user.isAdmin
    || (!user.isGuest && row.user_id === user.id);
  if (!readable) throw new HttpError(404, '音乐不存在或无权限');

  if (!env.R2_BUCKET) throw new HttpError(503, '存储未配置');
  return serveR2Object(request, env, track.audio_key, {
    mime: AUDIO_FORMATS[track.audio_key.split('.').pop()]?.mime || 'audio/mpeg',
    filename: null,
    immutable: true,
    corsHeaders
  });
}

// ---------------------------------------------------------------
// GET /api/music/:id/cover —— 封面（公开可读）
// ---------------------------------------------------------------
export async function getMusicCover(request, env, id) {
  requireUuid(id, 'id');
  const { db, user } = await requireAuth(request, env);

  const rows = await db.select(TABLE, qs({ select: 'id,user_id,is_public,type', id: `eq.${id}`, type: `eq.${TYPE}` }));
  const row = rows[0];
  if (!row) throw new HttpError(404, '音乐不存在');
  const track = await loadTrack(db, id);
  if (!track?.cover_key) throw new HttpError(404, '这首曲目没有封面');

  const readable = row.is_public === true
    || user.isAdmin
    || (!user.isGuest && row.user_id === user.id);
  if (!readable) throw new HttpError(404, '音乐不存在或无权限');

  if (!env.R2_BUCKET) throw new HttpError(503, '存储未配置');
  const head = await env.R2_BUCKET.head(track.cover_key);
  const mime = head?.httpMetadata?.contentType || 'image/jpeg';
  return serveR2Object(request, env, track.cover_key, { mime, filename: null, immutable: true, corsHeaders });
}
