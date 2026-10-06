// 音乐收藏库
// 主记录写入统一资源表 resources(type='music')，专属字段写入 music_tracks
// 支持：标签、分类、收藏夹、全局检索、关联图谱（复用统一资源机制）
// 权限：普通用户仅操作自己名下音乐；管理员可 ?all=true 查看全部

import { ok, readJson, HttpError } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { fetchMusicMeta, fetchLyrics, resolveGdstudioUrl, GD_DEFAULT_SOURCE } from '../lib/fetchers.js';
import {
  requireString, optionalString, requireUuid, optionalInt, optionalBool
} from '../lib/validate.js';
import {
  setResourceTags, withTags, getProgress, upsertProgress, validateTagIds
} from '../lib/resources.js';

const TABLE = 'resources';
const EXT = 'music_tracks';
const TYPE = 'music';

function userFilter(user, all) {
  return user.isAdmin && all ? {} : { user_id: `eq.${user.id}` };
}

// 读取音乐扩展信息（批量）
async function loadTracks(db, resourceIds) {
  if (!resourceIds.length) return {};
  const rows = await db.select(EXT, qs({
    select: '*', resource_id: `in.(${resourceIds.join(',')})`
  }));
  return Object.fromEntries(rows.map((r) => [r.resource_id, r]));
}

// 合并资源与其音乐扩展字段
async function withTrack(db, resources) {
  const list = Array.isArray(resources) ? resources : [resources];
  const map = await loadTracks(db, list.map((r) => r.id));
  return list.map((r) => {
    const t = map[r.id] || {};
    const { resource_id, user_id, created_at, updated_at, ...track } = t;
    return { ...r, track };
  });
}

// POST /api/music/search  —— 搜索音乐元信息候选（不落库）
// 聚合 Audius（完整音轨）/ iTunes / Deezer，结果含 quality 与 audio_url
export async function searchMusicMeta(request, env) {
  const { db, user } = await requireAuth(request, env);
  const body = await readJson(request);
  const query = requireString(body.query, 'query', { max: 200 });
  const limit = optionalInt(body.limit, 'limit', { min: 1, max: 20 }) ?? 5;

  const result = await fetchMusicMeta(query, limit, env);

  // 可选：带分类时校验归属
  let categoryId = null;
  if (body.category_id !== undefined && body.category_id !== null) {
    categoryId = requireUuid(body.category_id, 'category_id');
    const rows = await db.select('categories', qs({
      select: 'id', id: `eq.${categoryId}`,
      ...(user.isAdmin ? {} : { user_id: `eq.${user.id}` })
    }));
    if (!rows.length) throw new HttpError(422, '分类不存在或无权限');
  }
  return ok({ ...result, category_id: categoryId }, request, env);
}

// POST /api/music/lyrics  —— 获取歌词（LRCLIB，含带时间轴的同步歌词）
// 请求体：{ title, artist, album?, duration? }
export async function getMusicLyrics(request, env) {
  await requireAuth(request, env);
  const body = await readJson(request);
  const title = requireString(body.title, 'title', { max: 300 });
  const artist = requireString(body.artist, 'artist', { max: 200 });
  const album = optionalString(body.album, 'album', { max: 200 }) ?? null;
  const duration = optionalInt(body.duration, 'duration', { min: 0, max: 100000 }) ?? null;

  const lyrics = await fetchLyrics({ title, artist, album, duration }, env.GD_MUSIC_SOURCE || GD_DEFAULT_SOURCE);
  return ok({ title, artist, album, duration, ...lyrics }, request, env);
}

// POST /api/music/stream —— 重新解析可播放直链
// 说明：第三方 CDN 的直链是带时间戳的签名地址，会过期；已收藏曲目播放失败时，
// 前端带上收藏时保存的 platform / external_id 调本接口即可换到新的直链。
// 请求体：{ platform, external_id, source? }
export async function resolveMusicStream(request, env) {
  await requireAuth(request, env);
  const body = await readJson(request);
  const platform = optionalString(body.platform, 'platform', { max: 40 }) ?? null;
  const externalId = requireString(body.external_id, 'external_id', { max: 200 });
  const gdSource = optionalString(body.source, 'source', { max: 40 })
    || env.GD_MUSIC_SOURCE || GD_DEFAULT_SOURCE;

  if (platform !== 'gdstudio') {
    throw new HttpError(422, `该音源不支持重新解析：${platform || 'unknown'}`);
  }
  const info = await resolveGdstudioUrl(externalId, gdSource);
  if (!info.url) throw new HttpError(404, '该曲目暂时拿不到播放地址，请稍后重试');

  return ok({
    platform,
    external_id: externalId,
    source: gdSource,
    audio_url: info.url,
    bitrate: info.br,
    file_size: info.size,
    quality: 'full'
  }, request, env);
}

// GET /api/music
export async function listMusic(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === 'true';

  const filters = { type: `eq.${TYPE}`, ...userFilter(user, all) };
  const categoryId = url.searchParams.get('category_id');
  if (categoryId) filters.category_id = `eq.${categoryId}`;

  const rows = await db.select(TABLE, qs({
    select: '*', ...filters, order: 'created_at.desc'
  }));
  const tagged = await withTags(db, rows);
  const withExt = await withTrack(db, tagged);
  return ok(withExt, request, env);
}

// GET /api/music/:id
export async function getMusic(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');

  const rows = await db.select(TABLE, qs({
    select: '*', id: `eq.${id}`, type: `eq.${TYPE}`,
    ...(user.isAdmin ? {} : { user_id: `eq.${user.id}` })
  }));
  if (!rows.length) throw new HttpError(404, '音乐不存在或无权限');

  const [tagged] = await withTags(db, rows);
  const [withExt] = await withTrack(db, tagged);
  const progress = await getProgress(db, user.id, id);
  return ok({ ...withExt, progress }, request, env);
}

// POST /api/music
export async function createMusic(request, env) {
  const { db, user } = await requireAuth(request, env);
  const body = await readJson(request);

  const title = requireString(body.title, 'title', { max: 300 });
  const artist = optionalString(body.artist, 'artist', { max: 200 }) ?? null;
  const album = optionalString(body.album, 'album', { max: 200 }) ?? null;
  const audioUrl = optionalString(body.audio_url, 'audio_url', { max: 1000 }) ?? null;
  const artworkUrl = optionalString(body.artwork_url, 'artwork_url', { max: 1000 }) ?? null;
  const previewUrl = optionalString(body.preview_url, 'preview_url', { max: 1000 }) ?? null;
  const artistAvatar = optionalString(body.artist_avatar, 'artist_avatar', { max: 1000 }) ?? null;
  // quality：full=完整音轨，preview=试听片段（由抓取源决定，手动录入默认 full）
  const quality = body.quality === 'preview' ? 'preview' : 'full';
  // 备用播放地址（多音源节点），仅接受字符串数组
  const audioFallbacks = Array.isArray(body.audio_fallbacks)
    ? body.audio_fallbacks.filter((u) => typeof u === 'string' && u.length <= 1000).slice(0, 5)
    : null;

  let categoryId = null;
  if (body.category_id !== undefined && body.category_id !== null) {
    categoryId = requireUuid(body.category_id, 'category_id');
  }
  const tagIds = await validateTagIds(db, user.id, user.isAdmin, body.tag_ids);

  // 主资源记录
  const rows = await db.insert(TABLE, {
    user_id: user.id,
    type: TYPE,
    title,
    url: optionalString(body.url, 'url', { max: 1000 }) ?? audioUrl ?? previewUrl ?? null,
    source: optionalString(body.source, 'source', { max: 60 }) ?? 'manual',
    cover_path: artworkUrl,
    summary: optionalString(body.notes, 'notes', { max: 2000 }) ?? null,
    category_id: categoryId,
    metadata: {
      artist, album,
      duration: optionalInt(body.duration, 'duration', { min: 0 }) ?? null,
      genre: optionalString(body.genre, 'genre', { max: 100 }) ?? null,
      quality,
      // 音源身份：第三方直链是带签名的会过期地址，播放失败时前端凭这三个字段
      // 调 POST /api/music/stream 重新解析（见 routes/music.js）。
      platform: optionalString(body.platform, 'platform', { max: 40 }) ?? null,
      external_id: optionalString(body.external_id, 'external_id', { max: 200 }) ?? null,
      gd_source: optionalString(body.gd_source, 'gd_source', { max: 40 }) ?? null,
      // 音质信息：bitrate ≥ 900 或 format=flac 即为无损完整曲
      bitrate: optionalInt(body.bitrate, 'bitrate', { min: 0, max: 10000 }) ?? null,
      format: optionalString(body.format, 'format', { max: 20 }) ?? null,
      file_size: optionalInt(body.file_size, 'file_size', { min: 0 }) ?? null
    },
    is_public: optionalBool(body.is_public, 'is_public') ?? false
  });
  const resource = rows[0];

  // 音乐扩展记录
  const ext = await db.insert(EXT, {
    resource_id: resource.id,
    user_id: user.id,
    artist,
    album,
    artwork_url: artworkUrl,
    audio_url: audioUrl,
    preview_url: previewUrl,
    artist_avatar: artistAvatar,
    quality,
    audio_fallbacks: audioFallbacks,
    duration: optionalInt(body.duration, 'duration', { min: 0 }) ?? null,
    genre: optionalString(body.genre, 'genre', { max: 100 }) ?? null,
    release_year: optionalInt(body.release_year, 'release_year', { min: 0, max: 3000 }) ?? null,
    notes: optionalString(body.notes, 'notes', { max: 2000 }) ?? null,
    lyrics: optionalString(body.lyrics, 'lyrics', { max: 20000 }) ?? null
  });

  await setResourceTags(db, resource.id, user.id, tagIds);
  const [tagged] = await withTags(db, [resource]);
  const { resource_id, user_id, created_at, updated_at, ...track } = ext[0];
  return ok({ ...tagged, track }, request, env, 201);
}

// PATCH /api/music/:id
export async function updateMusic(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');
  const body = await readJson(request);

  // 写操作严格限定本人，管理员仅拥有读权限
  const scope = { id: `eq.${id}`, type: `eq.${TYPE}`, user_id: `eq.${user.id}` };
  const existing = await db.select(TABLE, qs({ select: 'id', ...scope }));
  if (!existing.length) throw new HttpError(404, '音乐不存在或无权限');

  // 主资源字段
  const patch = {};
  if (body.title !== undefined) patch.title = requireString(body.title, 'title', { max: 300 });
  if (body.notes !== undefined) patch.summary = optionalString(body.notes, 'notes', { max: 2000 }) ?? null;
  if (body.artwork_url !== undefined) patch.cover_path = optionalString(body.artwork_url, 'artwork_url', { max: 1000 }) ?? null;
  if (body.url !== undefined) patch.url = optionalString(body.url, 'url', { max: 1000 }) ?? null;
  if (body.is_public !== undefined) patch.is_public = optionalBool(body.is_public, 'is_public');
  if (body.category_id !== undefined) {
    patch.category_id = body.category_id === null ? null : requireUuid(body.category_id, 'category_id');
  }
  if (Object.keys(patch).length) {
    await db.update(TABLE, qs(scope), patch);
  }

  // 扩展表字段
  const extPatch = {};
  if (body.artist !== undefined) extPatch.artist = optionalString(body.artist, 'artist', { max: 200 }) ?? null;
  if (body.album !== undefined) extPatch.album = optionalString(body.album, 'album', { max: 200 }) ?? null;
  if (body.audio_url !== undefined) extPatch.audio_url = optionalString(body.audio_url, 'audio_url', { max: 1000 }) ?? null;
  if (body.preview_url !== undefined) extPatch.preview_url = optionalString(body.preview_url, 'preview_url', { max: 1000 }) ?? null;
  if (body.artist_avatar !== undefined) extPatch.artist_avatar = optionalString(body.artist_avatar, 'artist_avatar', { max: 1000 }) ?? null;
  if (body.quality !== undefined) extPatch.quality = body.quality === 'preview' ? 'preview' : 'full';
  if (body.artwork_url !== undefined) extPatch.artwork_url = optionalString(body.artwork_url, 'artwork_url', { max: 1000 }) ?? null;
  if (body.duration !== undefined) extPatch.duration = optionalInt(body.duration, 'duration', { min: 0 }) ?? null;
  if (body.genre !== undefined) extPatch.genre = optionalString(body.genre, 'genre', { max: 100 }) ?? null;
  if (body.release_year !== undefined) extPatch.release_year = optionalInt(body.release_year, 'release_year', { min: 0, max: 3000 }) ?? null;
  if (body.notes !== undefined) extPatch.notes = optionalString(body.notes, 'notes', { max: 2000 }) ?? null;
  if (body.lyrics !== undefined) extPatch.lyrics = optionalString(body.lyrics, 'lyrics', { max: 20000 }) ?? null;

  if (Object.keys(extPatch).length) {
    const rows = await db.update(EXT, qs({ resource_id: `eq.${id}` }), extPatch);
    if (!rows.length) {
      // 扩展记录缺失时补建（兼容历史数据）
      await db.insert(EXT, { resource_id: id, user_id: user.id, ...extPatch });
    }
  }

  if (body.tag_ids !== undefined) {
    const tagIds = await validateTagIds(db, user.id, user.isAdmin, body.tag_ids);
    await setResourceTags(db, id, user.id, tagIds);
  }

  const rows = await db.select(TABLE, qs({ select: '*', ...scope }));
  const [tagged] = await withTags(db, rows);
  const [withExt] = await withTrack(db, tagged);
  return ok(withExt, request, env);
}

// DELETE /api/music/:id
export async function deleteMusic(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');
  const scope = { id: `eq.${id}`, type: `eq.${TYPE}`, user_id: `eq.${user.id}` };

  const rows = await db.select(TABLE, qs({ select: 'id', ...scope }));
  if (!rows.length) throw new HttpError(404, '音乐不存在或无权限');

  await db.remove(EXT, qs({ resource_id: `eq.${id}` }));   // 扩展记录（外键也会级联）
  await db.remove(TABLE, qs(scope));
  return ok({ id }, request, env);
}

// PUT /api/music/:id/progress  —— 保存播放进度
export async function saveMusicProgress(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');
  const body = await readJson(request);

  const rows = await db.select(TABLE, qs({
    select: 'id', id: `eq.${id}`, type: `eq.${TYPE}`, user_id: `eq.${user.id}`
  }));
  if (!rows.length) throw new HttpError(404, '音乐不存在或无权限');

  const position = body.position === undefined ? undefined : Number(body.position);
  const duration = body.duration === undefined ? undefined : Number(body.duration);
  if (position !== undefined && (!Number.isFinite(position) || position < 0)) {
    throw new HttpError(422, 'position 必须为非负数字');
  }
  if (duration !== undefined && (!Number.isFinite(duration) || duration < 0)) {
    throw new HttpError(422, 'duration 必须为非负数字');
  }
  let progress = body.progress === undefined ? undefined : Number(body.progress);
  if (progress === undefined && position !== undefined && duration) {
    progress = Math.min(100, Math.round((position / duration) * 10000) / 100);
  }
  const completed = body.completed !== undefined
    ? !!body.completed
    : (progress !== undefined ? progress >= 99 : undefined);

  const saved = await upsertProgress(db, user.id, id, { position, duration, progress, completed });
  return ok(saved, request, env);
}

// GET /api/music/:id/progress
export async function getMusicProgress(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');
  const progress = await getProgress(db, user.id, id);
  return ok(progress || { resource_id: id, position: 0, progress: 0, completed: false }, request, env);
}
