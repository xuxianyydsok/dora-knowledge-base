// 影视收藏库
// 主记录写入统一资源表 resources(type='movie')，专属字段写入 movie_titles（1:1）
// 支持：标签、分类、收藏夹、全局检索、关联图谱（复用统一资源机制）
// 权限：普通用户仅操作自己名下影视；管理员可 ?all=true 查看全部；
//       写操作（更新/删除/进度）始终限定本人。

import { ok, readJson, HttpError } from '../lib/response.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { fetchMovieMeta, fetchMovieLatest, fetchMovieDetailBySource } from '../lib/fetchers.js';
import { getSourceHealth, getVodSourceHealth as readVodSourceHealth } from '../lib/sourceHealth.js';
import { getVodSources, titleRelevance } from '../lib/maccms.js';
import {
  requireString, optionalString, requireUuid, optionalInt, optionalBool,
  optionalNumber, optionalDateString, requireEnum
} from '../lib/validate.js';
import {
  setResourceTags, withTags, getProgress, upsertProgress, validateTagIds, validateCategoryId
} from '../lib/resources.js';
import { guestResourceFilters, isResourceVisibleToGuest } from '../lib/publicScope.js';

const TABLE = 'resources';
const EXT = 'movie_titles';
const TYPE = 'movie';

// 重新匹配片源时的可信阈值：只接受「完全同名 / 前缀命中」的候选。
// titleRelevance：0=完全同名 1=关键词+第N季 2=关键词+(年份) 3=其他前缀 4=包含 5=不相关。
// 4/5 属「标题里只是恰好包含关键词」（同名异片、衍生短剧、混剪），一律拒绝，
// 避免把《流浪地球2》重匹配到《流浪地球之大夏战狼》这类错片。
const RESOLVE_MAX_RELEVANCE = 3;

function userFilter(user, all) {
  return user.isAdmin && all ? {} : { user_id: `eq.${user.id}` };
}

// 从重匹配候选里挑「最可信」的一条（纯函数，供离线单测）。
// 规则：
//   1) 必须含可播放直链（playable_url），否则对播放毫无意义；
//   2) 标题相关度必须 ≤ RESOLVE_MAX_RELEVANCE（完全同名/前缀命中），否则视为同名异片，丢弃；
//   3) 优先与原记录的 media_type 一致（电影别重匹配成剧集）；
//   4) 再按相关度、标题长度（正片名更短）排序，最后取集数更多者（正片而非片段）。
// 返回 null 表示「没有足够可信的候选，不要自动写库」。
export function pickBestMovieCandidate(candidates, { title, mediaType = null } = {}) {
  const ok = (Array.isArray(candidates) ? candidates : [])
    .filter((c) => c && c.playable_url && c.external_id && c.source)
    .map((c) => ({ c, rel: titleRelevance(c.title, title) }))
    .filter((x) => x.rel <= RESOLVE_MAX_RELEVANCE);
  if (!ok.length) return null;
  ok.sort((a, b) => {
    if (mediaType) {
      const am = a.c.media_type === mediaType ? 0 : 1;
      const bm = b.c.media_type === mediaType ? 0 : 1;
      if (am !== bm) return am - bm;
    }
    if (a.rel !== b.rel) return a.rel - b.rel;
    const lenDiff = String(a.c.title || '').length - String(b.c.title || '').length;
    if (lenDiff !== 0) return lenDiff;
    return (b.c.episode_count || 0) - (a.c.episode_count || 0);
  });
  return ok[0].c;
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
    categoryId = await validateCategoryId(db, user.id, requireUuid(body.category_id, 'category_id'));
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
// 改为复用统一的源健康缓存（与 /api/sources/health 同一份），不再各探一遍。
// 鉴权保持与现状兼容（requireAuth，访客模式下由 guestContext 放行）：
//   管理员可用 ?refresh=1 强制刷新；访客 / 普通用户只读缓存，缓存为空则返回空列表，绝不触发探测。
export async function getVodSourceHealth(request, env) {
  const { user } = await requireAuth(request, env);
  const refresh = user.isAdmin && new URL(request.url).searchParams.get('refresh') === '1';
  const result = await readVodSourceHealth(env, { refresh, allowProbe: user.isAdmin });
  return ok(result, request, env);
}

// GET /api/sources/health  —— 影视 + 音乐统一源健康（管理员可全量探测 / 强制刷新）
// 鉴权策略（推荐方案 b）：
//   - 管理员：requireAdmin，可全量探测，可用 ?refresh=1 强制刷新。
//   - 普通访客 / 未登录：**绝不触发上游探测**，只读已有缓存；
//     缓存为空时返回空列表 + note（「暂无数据，请稍后由管理员刷新」），前端据此提示。
export async function getSourcesHealth(request, env) {
  const refresh = new URL(request.url).searchParams.get('refresh') === '1';
  let isAdmin = false;
  try {
    const ctx = await requireAdmin(request, env);
    isAdmin = ctx.user.isAdmin;
  } catch (err) {
    // 未登录（401）/ 非管理员（403）：降级为「只读缓存」，不视为错误
    if (!(err instanceof HttpError) || ![401, 403].includes(err.status)) throw err;
  }
  const result = await getSourceHealth(env, { refresh: isAdmin && refresh, allowProbe: isAdmin });
  return ok(result, request, env);
}

// GET /api/movies
export async function listMovies(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === 'true';

  const filters = { select: '*', type: `eq.${TYPE}`, ...userFilter(user, all) };
  if (user.isGuest) Object.assign(filters, guestResourceFilters());   // 访客只看公开影视
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
  if (user.isGuest && !isResourceVisibleToGuest(rows[0])) throw new HttpError(404, '影视不存在或无权限');

  const [tagged] = await withTags(db, rows);
  const [withExt] = await withTitle(db, tagged);
  // 访客的 user.id 是 owner 范围限定，不能把站长的播放进度当公开数据返回
  const progress = user.isGuest ? null : await getProgress(db, user.id, id);
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
    categoryId = await validateCategoryId(db, user.id, requireUuid(body.category_id, 'category_id'));
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
    patch.category_id = body.category_id === null
      ? null
      : await validateCategoryId(db, user.id, requireUuid(body.category_id, 'category_id'));
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

// POST /api/movies/:id/refresh-source  —— 重新匹配片源（仅登录本人；管理员也只看本人）
//
// 用途：早期收藏的记录里，source_key 可能是**已下线**的采集源（如 dytt/jszy/lzi），
// 或保存的 url 是死链。此时前端「立即播放」只会报「片源无法解析」。
// 本接口用**原标题**去当前所有在用采集源重新搜索，按可信阈值挑一条最佳候选并回填。
//
// 安全与正确性约束（重要）：
//   1) 写操作严格限定 user_id=当前用户；管理员不跨用户写（本接口没有 owner 参数）；
//   2) 只写回自己名下的 movie 记录与 movie_titles 扩展；
//   3) **绝不自动写**：由前端管理员/站长主动点击才调用；不确定就返回 404/422 并说明原因；
//   4) 匹配必须过 pickBestMovieCandidate 的可信阈值，避免把同名异片写错。
export async function refreshMovieSource(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');

  // 读：管理员可读他人，但本接口的写范围仍锁定本人，因此这里也只取本人记录
  const scope = { id: `eq.${id}`, type: `eq.${TYPE}`, user_id: `eq.${user.id}` };
  const rows = await db.select(TABLE, qs({ select: '*', ...scope }));
  if (!rows.length) throw new HttpError(404, '影视不存在或无权限');
  const resource = rows[0];

  const extRows = await db.select(EXT, qs({ select: '*', resource_id: `eq.${id}`, user_id: `eq.${user.id}` }));
  const ext = extRows[0] || {};
  const title = String(resource.title || '').trim();
  if (!title) throw new HttpError(422, '该记录没有标题，无法重新匹配片源');

  const configured = getVodSources(env);
  const configuredKeys = new Set(configured.map((s) => s.key));
  const oldKey = ext.source_key || resource.source || null;
  const oldKeyUsable = !!(oldKey && configuredKeys.has(oldKey));

  // 先看原源是否还在用：在用就按其 source_vod_id 回源取最新线路（最快、最准）
  let chosen = null;
  if (oldKeyUsable) {
    const vodId = ext.source_vod_id || ext.external_id || null;
    if (vodId) {
      try {
        const detail = await fetchMovieDetailBySource(oldKey, String(vodId), env);
        if (detail?.playable_url) {
          chosen = {
            source: oldKey,
            source_name: detail.source_name || oldKey,
            external_id: String(detail.external_id || vodId),
            title: detail.title || title,
            media_type: detail.media_type || ext.media_type || 'movie',
            playable_url: detail.playable_url,
            routes: detail.routes || null,
            poster_url: detail.poster_url || null,
            matched: 'same-source'
          };
        }
      } catch {
        // 原源取不到（下线/超时/资源被删）→ 落到下面的全源重新搜索
      }
    }
  }

  // 原源不可用或取不到直链：用原标题去当前所有在用源重新搜索
  if (!chosen) {
    // 关键词候选：原标题 → 去掉「第N季/部/集」与括号年份后的主标题。
    // 各源标题写法不统一（「庆余年 第二季」vs「庆余年第二季」vs「庆余年」），
    // 只搜原标题会漏掉；主标题作**后备关键词**能提高命中，但最终仍由
    // pickBestMovieCandidate 按原标题的相关度阈值把关，不会因此写错片。
    const keywords = [title];
    const base = title.replace(/[\s·:：-]+/g, '').replace(/第[一二三四五六七八九十0-9]{1,3}[季部集].*$/, '')
      .replace(/[（(]\d{4}[)）].*$/, '').trim();
    if (base && base !== title) keywords.push(base);

    let best = null;
    for (const kw of keywords) {
      const found = await fetchMovieMeta(kw, 30, env);
      best = pickBestMovieCandidate(found?.candidates, {
        title,                                   // 仍按**原标题**判定相关度，后备关键词只负责召回
        mediaType: ext.media_type || null
      });
      if (best) break;
    }
    if (!best) {
      throw new HttpError(404, `没有找到与《${title}》足够可信的可用片源，未做任何修改`);
    }
    chosen = { ...best, matched: 'researched' };
  }

  // 回填主资源（严格 user_id 限定）
  const resourcePatch = { url: chosen.playable_url };
  if (chosen.poster_url && !resource.cover_path) resourcePatch.cover_path = chosen.poster_url;
  await db.update(TABLE, qs(scope), resourcePatch);

  // 回填扩展表（严格 user_id 限定）
  const extPatch = {
    source_key: chosen.source,
    source_vod_id: String(chosen.external_id),
    external_id: String(chosen.external_id),
    source: chosen.source,
    routes: chosen.routes || null
  };
  const updated = await db.update(EXT, qs({ resource_id: `eq.${id}`, user_id: `eq.${user.id}` }), extPatch);
  if (!updated.length) {
    await db.insert(EXT, { resource_id: id, user_id: user.id, media_type: ext.media_type || 'movie', ...extPatch });
  }

  return ok({
    ok: true,
    matched: chosen.matched,
    title,
    old_source_key: oldKey,
    source_key: chosen.source,
    source_name: chosen.source_name || chosen.source,
    external_id: String(chosen.external_id),
    url: chosen.playable_url,
    route_count: Array.isArray(chosen.routes) ? chosen.routes.length : 0,
    changed: ['url', 'source_key', 'source_vod_id', 'external_id', 'routes']
  }, request, env);
}
