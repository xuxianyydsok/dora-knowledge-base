// 影视收藏库
// 主记录写入统一资源表 resources(type='movie')，专属字段写入 movie_titles（1:1）
// 支持：标签、分类、收藏夹、全局检索、关联图谱（复用统一资源机制）
// 权限：普通用户仅操作自己名下影视；管理员可 ?all=true 查看全部；
//       写操作（更新/删除/进度）始终限定本人。

import { ok, readJson, HttpError } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { fetchMovieMeta, fetchMovieLatest, fetchMovieDetailBySource, checkVodSources } from '../lib/fetchers.js';
import {
  requireString, optionalString, requireUuid, optionalInt, optionalBool,
  optionalNumber, optionalDateString, requireEnum
} from '../lib/validate.js';
import { setResourceTags, withTags, getProgress, upsertProgress, validateTagIds } from '../lib/resources.js';

const TABLE = 'resources';
const EXT = 'movie_titles';
const TYPE = 'movie';

function userFilter(user, all) {
  return user.isAdmin && all ? {} : { user_id: `eq.${user.id}` };
}

// 批量读取影视扩展信息
async function loadTitles(db, resourceIds) {
  if (!resourceIds.length) return {};
  const rows = await db.select(EXT, qs({ select: '*', resource_id: `in.(${resourceIds.join(',')})` }));
  return Object.fromEntries(rows.map((r) => [r.resource_id, r]));
}

// 合并资源与其影视扩展字段
async function withTitle(db, resources) {
  const list = Array.isArray(resources) ? resources : [resources];
  const map = await loadTitles(db, list.map((r) => r.id));
  return list.map((r) => {
    const t = map[r.id] || {};
    const { resource_id, user_id, created_at, updated_at, ...title } = t;
    return { ...r, title_info: title };
  });
}

// POST /api/movies/search  —— 搜索影视元信息候选（不落库）
export async function searchMovieMeta(request, env) {
  const { db, user } = await requireAuth(request, env);
  const body = await readJson(request);
  const query = requireString(body.query, 'query', { max: 200 });
  // 上限 60：影视搜索要能一次给出足够多的候选（此前 5 条 + 各层再截断，是「搜不出东西」的主因）
  const limit = optionalInt(body.limit, 'limit', { min: 1, max: 60 }) ?? 30;

  const result = await fetchMovieMeta(query, limit, env);

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

// GET /api/movies/latest  —— 采集源最新入库（影视首页用）
export async function listMovieLatest(request, env) {
  await requireAuth(request, env);
  const url = new URL(request.url);
  const limit = optionalInt(url.searchParams.get('limit'), 'limit', { min: 1, max: 60 }) ?? 30;
  const sort = url.searchParams.get('sort') === 'new' ? 'new' : 'hot';
  const result = await fetchMovieLatest(limit, env, sort);
  return ok(result, request, env);
}

// POST /api/movies/source-detail  —— 按采集源 + 资源 ID 取完整线路与剧集
export async function getMovieSourceDetail(request, env) {
  await requireAuth(request, env);
  const body = await readJson(request);
  const sourceKey = requireString(body.source, 'source', { max: 60 });
  const externalId = requireString(body.external_id, 'external_id', { max: 100 });
  const detail = await fetchMovieDetailBySource(sourceKey, externalId, env);
  return ok(detail, request, env);
}

// GET /api/movies/sources/health  —— 采集源可用性检查
export async function getVodSourceHealth(request, env) {
  await requireAuth(request, env);
  const result = await checkVodSources(env);
  return ok(result, request, env);
}

// GET /api/movies
export async function listMovies(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === 'true';

  const filters = { select: '*', type: `eq.${TYPE}`, ...userFilter(user, all) };
  const categoryId = url.searchParams.get('category_id');
  if (categoryId) filters.category_id = `eq.${categoryId}`;
  const mediaType = url.searchParams.get('media_type');
  if (mediaType) requireEnum(mediaType, 'media_type', ['movie', 'tv']);

  // media_type 位于扩展表，需先按扩展表过滤出 resource_id
  let extIds = null;
  if (mediaType) {
    const extRows = await db.select(EXT, qs({
      select: 'resource_id', media_type: `eq.${mediaType}`,
      ...(user.isAdmin && all ? {} : { user_id: `eq.${user.id}` })
    }));
    extIds = extRows.map((r) => r.resource_id);
    if (!extIds.length) return ok([], request, env);
  }

  const rows = await db.select(TABLE, qs({
    select: '*', ...filters,
    ...(extIds ? { id: `in.(${extIds.join(',')})` } : {}),
    order: 'created_at.desc'
  }));
  const tagged = await withTags(db, rows);
  const withExt = await withTitle(db, tagged);
  return ok(withExt, request, env);
}

// GET /api/movies/:id
export async function getMovie(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');

  const rows = await db.select(TABLE, qs({
    select: '*', id: `eq.${id}`, type: `eq.${TYPE}`,
    ...(user.isAdmin ? {} : { user_id: `eq.${user.id}` })
  }));
  if (!rows.length) throw new HttpError(404, '影视不存在或无权限');

  const [tagged] = await withTags(db, rows);
  const [withExt] = await withTitle(db, tagged);
  const progress = await getProgress(db, user.id, id);
  return ok({ ...withExt, progress }, request, env);
}

// POST /api/movies
export async function createMovie(request, env) {
  const { db, user } = await requireAuth(request, env);
  const body = await readJson(request);

  const title = requireString(body.title, 'title', { max: 300 });
  const mediaType = body.media_type === undefined
    ? 'movie'
    : requireEnum(body.media_type, 'media_type', ['movie', 'tv']);

  let categoryId = null;
  if (body.category_id !== undefined && body.category_id !== null) {
    categoryId = requireUuid(body.category_id, 'category_id');
  }
  const tagIds = await validateTagIds(db, user.id, user.isAdmin, body.tag_ids);

  const posterUrl = optionalString(body.poster_url, 'poster_url', { max: 1000 }) ?? null;
  const overview = optionalString(body.overview, 'overview', { max: 4000 }) ?? null;
  const releaseDate = optionalDateString(body.release_date, 'release_date') ?? null;
  // url 仅存放可播放的视频直链；external_url 存放外部详情页（TVmaze/TMDB 等）
  const playableUrl = optionalString(body.url, 'url', { max: 1000 }) ?? null;
  const externalUrl = optionalString(body.external_url ?? body.page_url, 'external_url', { max: 1000 }) ?? null;

  const rows = await db.insert(TABLE, {
    user_id: user.id,
    type: TYPE,
    title,
    url: playableUrl,
    source: optionalString(body.source, 'source', { max: 60 }) ?? 'manual',
    cover_path: posterUrl,
    summary: optionalString(body.notes, 'notes', { max: 4000 }) ?? overview,
    category_id: categoryId,
    metadata: {
      media_type: mediaType,
      original_title: optionalString(body.original_title, 'original_title', { max: 300 }) ?? null,
      genres: optionalString(body.genres, 'genres', { max: 300 }) ?? null,
      release_date: releaseDate,
      runtime: optionalInt(body.runtime, 'runtime', { min: 0, max: 2000 }) ?? null,
      rating: optionalNumber(body.rating, 'rating', { min: 0, max: 10 }) ?? null
    },
    is_public: optionalBool(body.is_public, 'is_public') ?? false
  });
  const resource = rows[0];

  const ext = await db.insert(EXT, {
    resource_id: resource.id,
    user_id: user.id,
    media_type: mediaType,
    original_title: optionalString(body.original_title, 'original_title', { max: 300 }) ?? null,
    director: optionalString(body.director, 'director', { max: 300 }) ?? null,
    cast_list: optionalString(body.cast_list, 'cast_list', { max: 1000 }) ?? null,
    genres: optionalString(body.genres, 'genres', { max: 300 }) ?? null,
    release_date: releaseDate,
    runtime: optionalInt(body.runtime, 'runtime', { min: 0, max: 2000 }) ?? null,
    rating: optionalNumber(body.rating, 'rating', { min: 0, max: 10 }) ?? null,
    overview,
    poster_url: posterUrl,
    backdrop_url: optionalString(body.backdrop_url, 'backdrop_url', { max: 1000 }) ?? null,
    external_id: optionalString(body.external_id, 'external_id', { max: 100 }) ?? null,
    source: optionalString(body.source, 'source', { max: 60 }) ?? 'manual',
    external_url: externalUrl,
    // 采集源信息：source_key + source_vod_id 用于回源取完整线路
    source_key: optionalString(body.source_key, 'source_key', { max: 60 }) ?? null,
    source_vod_id: optionalString(body.source_vod_id, 'source_vod_id', { max: 100 }) ?? null,
    routes: Array.isArray(body.routes) ? body.routes : null,
    area: optionalString(body.area, 'area', { max: 100 }) ?? null,
    remarks: optionalString(body.remarks, 'remarks', { max: 200 }) ?? null,
    notes: optionalString(body.notes, 'notes', { max: 4000 }) ?? null
  });

  await setResourceTags(db, resource.id, user.id, tagIds);
  const [tagged] = await withTags(db, [resource]);
  const { resource_id, user_id, created_at, updated_at, ...titleInfo } = ext[0];
  return ok({ ...tagged, title_info: titleInfo }, request, env, 201);
}

// PATCH /api/movies/:id
export async function updateMovie(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');
  const body = await readJson(request);

  // 写操作严格限定本人，管理员仅拥有读权限
  const scope = { id: `eq.${id}`, type: `eq.${TYPE}`, user_id: `eq.${user.id}` };
  const existing = await db.select(TABLE, qs({ select: 'id', ...scope }));
  if (!existing.length) throw new HttpError(404, '影视不存在或无权限');

  // 主资源字段
  const patch = {};
  if (body.title !== undefined) patch.title = requireString(body.title, 'title', { max: 300 });
  if (body.url !== undefined) patch.url = optionalString(body.url, 'url', { max: 1000 }) ?? null;
  if (body.poster_url !== undefined) patch.cover_path = optionalString(body.poster_url, 'poster_url', { max: 1000 }) ?? null;
  if (body.notes !== undefined) patch.summary = optionalString(body.notes, 'notes', { max: 4000 }) ?? null;
  if (body.is_public !== undefined) patch.is_public = optionalBool(body.is_public, 'is_public');
  if (body.category_id !== undefined) {
    patch.category_id = body.category_id === null ? null : requireUuid(body.category_id, 'category_id');
  }
  if (Object.keys(patch).length) {
    await db.update(TABLE, qs(scope), patch);
  }

  // 扩展表字段
  const extPatch = {};
  if (body.media_type !== undefined) extPatch.media_type = requireEnum(body.media_type, 'media_type', ['movie', 'tv']);
  if (body.original_title !== undefined) extPatch.original_title = optionalString(body.original_title, 'original_title', { max: 300 }) ?? null;
  if (body.director !== undefined) extPatch.director = optionalString(body.director, 'director', { max: 300 }) ?? null;
  if (body.cast_list !== undefined) extPatch.cast_list = optionalString(body.cast_list, 'cast_list', { max: 1000 }) ?? null;
  if (body.genres !== undefined) extPatch.genres = optionalString(body.genres, 'genres', { max: 300 }) ?? null;
  if (body.release_date !== undefined) extPatch.release_date = optionalDateString(body.release_date, 'release_date') ?? null;
  if (body.runtime !== undefined) extPatch.runtime = optionalInt(body.runtime, 'runtime', { min: 0, max: 2000 }) ?? null;
  if (body.rating !== undefined) extPatch.rating = optionalNumber(body.rating, 'rating', { min: 0, max: 10 }) ?? null;
  if (body.overview !== undefined) extPatch.overview = optionalString(body.overview, 'overview', { max: 4000 }) ?? null;
  if (body.poster_url !== undefined) extPatch.poster_url = optionalString(body.poster_url, 'poster_url', { max: 1000 }) ?? null;
  if (body.backdrop_url !== undefined) extPatch.backdrop_url = optionalString(body.backdrop_url, 'backdrop_url', { max: 1000 }) ?? null;
  if (body.external_id !== undefined) extPatch.external_id = optionalString(body.external_id, 'external_id', { max: 100 }) ?? null;
  if (body.source !== undefined) extPatch.source = optionalString(body.source, 'source', { max: 60 }) ?? null;
  if (body.external_url !== undefined) extPatch.external_url = optionalString(body.external_url, 'external_url', { max: 1000 }) ?? null;
  if (body.source_key !== undefined) extPatch.source_key = optionalString(body.source_key, 'source_key', { max: 60 }) ?? null;
  if (body.source_vod_id !== undefined) extPatch.source_vod_id = optionalString(body.source_vod_id, 'source_vod_id', { max: 100 }) ?? null;
  if (body.routes !== undefined) extPatch.routes = Array.isArray(body.routes) ? body.routes : null;
  if (body.area !== undefined) extPatch.area = optionalString(body.area, 'area', { max: 100 }) ?? null;
  if (body.remarks !== undefined) extPatch.remarks = optionalString(body.remarks, 'remarks', { max: 200 }) ?? null;
  if (body.notes !== undefined) extPatch.notes = optionalString(body.notes, 'notes', { max: 4000 }) ?? null;

  if (Object.keys(extPatch).length) {
    const rows = await db.update(EXT, qs({ resource_id: `eq.${id}`, user_id: `eq.${user.id}` }), extPatch);
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
  const [withExt] = await withTitle(db, tagged);
  return ok(withExt, request, env);
}

// DELETE /api/movies/:id
export async function deleteMovie(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');
  const scope = { id: `eq.${id}`, type: `eq.${TYPE}`, user_id: `eq.${user.id}` };

  const rows = await db.select(TABLE, qs({ select: 'id', ...scope }));
  if (!rows.length) throw new HttpError(404, '影视不存在或无权限');

  await db.remove(EXT, qs({ resource_id: `eq.${id}`, user_id: `eq.${user.id}` }));
  await db.remove(TABLE, qs(scope));
  return ok({ id }, request, env);
}

// PUT /api/movies/:id/progress  —— 保存观看进度
export async function saveMovieProgress(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');
  const body = await readJson(request);

  const rows = await db.select(TABLE, qs({
    select: 'id', id: `eq.${id}`, type: `eq.${TYPE}`, user_id: `eq.${user.id}`
  }));
  if (!rows.length) throw new HttpError(404, '影视不存在或无权限');

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

// GET /api/movies/:id/progress
export async function getMovieProgress(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');
  const progress = await getProgress(db, user.id, id);
  return ok(progress || { resource_id: id, position: 0, progress: 0, completed: false }, request, env);
}
