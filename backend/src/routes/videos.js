// 学习视频库（Bilibili / YouTube）
// 元信息抓取 + 资源 CRUD + 播放进度保存
// 权限：普通用户仅操作自己名下视频；管理员可 ?all=true 查看全部

import { ok, readJson, HttpError } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { fetchVideoMeta } from '../lib/fetchers.js';
import {
  requireString, optionalString, requireUuid, isUuid, optionalBool
} from '../lib/validate.js';
import {
  setResourceTags, withTags, getProgress, upsertProgress, validateTagIds
} from '../lib/resources.js';

const TABLE = 'resources';
const TYPE = 'video';

function userFilter(user, all) {
  return user.isAdmin && all ? {} : { user_id: `eq.${user.id}` };
}

// POST /api/videos/fetch  —— 抓取视频元信息（不落库）
export async function fetchVideoInfo(request, env) {
  const { db, user } = await requireAuth(request, env);
  const body = await readJson(request);
  const url = requireString(body.url, 'url', { max: 500 });

  const meta = await fetchVideoMeta(url);

  // 若请求中带 category_id，校验归属
  let categoryId = null;
  if (body.category_id !== undefined && body.category_id !== null) {
    categoryId = requireUuid(body.category_id, 'category_id');
    const rows = await db.select('categories', qs({
      select: 'id',
      id: `eq.${categoryId}`,
      ...(user.isAdmin ? {} : { user_id: `eq.${user.id}` })
    }));
    if (!rows.length) throw new HttpError(422, '分类不存在或无权限');
  }

  return ok({ meta, category_id: categoryId }, request, env);
}

// GET /api/videos
export async function listVideos(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === 'true';

  const filters = { type: `eq.${TYPE}`, ...userFilter(user, all) };
  const categoryId = url.searchParams.get('category_id');
  if (categoryId) filters.category_id = `eq.${categoryId}`;

  const rows = await db.select(TABLE, qs({
    select: '*',
    ...filters,
    order: 'created_at.desc'
  }));
  const data = await withTags(db, rows);
  return ok(data, request, env);
}

// GET /api/videos/:id
export async function getVideo(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');

  const rows = await db.select(TABLE, qs({
    select: '*', id: `eq.${id}`, type: `eq.${TYPE}`,
    ...(user.isAdmin ? {} : { user_id: `eq.${user.id}` })
  }));
  if (!rows.length) throw new HttpError(404, '视频不存在或无权限');

  const [withTagList] = await withTags(db, rows);
  const progress = await getProgress(db, user.id, id);
  return ok({ ...withTagList, progress }, request, env);
}

// POST /api/videos
export async function createVideo(request, env) {
  const { db, user } = await requireAuth(request, env);
  const body = await readJson(request);
  const url = requireString(body.url, 'url', { max: 500 });

  // 抓取元信息（标题/封面/时长等）；允许用请求体覆盖标题
  const meta = await fetchVideoMeta(url);
  const title = body.title !== undefined
    ? requireString(body.title, 'title', { max: 300 })
    : meta.title;

  let categoryId = null;
  if (body.category_id !== undefined && body.category_id !== null) {
    categoryId = requireUuid(body.category_id, 'category_id');
  }

  const tagIds = await validateTagIds(db, user.id, false, body.tag_ids);

  const rows = await db.insert(TABLE, {
    user_id: user.id,
    type: TYPE,
    title,
    url: meta.page_url,
    source: meta.platform,
    cover_path: null,
    summary: optionalString(body.summary, 'summary') ?? meta.description ?? null,
    category_id: categoryId,
    metadata: { ...meta, cover_url: meta.cover_url, embed_url: meta.embed_url },
    is_public: optionalBool(body.is_public, 'is_public') ?? false
  });
  const resource = rows[0];

  await setResourceTags(db, resource.id, user.id, tagIds);
  const [withTagList] = await withTags(db, [resource]);
  return ok(withTagList, request, env, 201);
}

// PATCH /api/videos/:id
export async function updateVideo(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');
  const body = await readJson(request);

  const patch = {};
  if (body.title !== undefined) patch.title = requireString(body.title, 'title', { max: 300 });
  if (body.summary !== undefined) patch.summary = optionalString(body.summary, 'summary') ?? null;
  if (body.category_id !== undefined) {
    patch.category_id = body.category_id === null ? null : requireUuid(body.category_id, 'category_id');
  }
  if (body.is_public !== undefined) patch.is_public = optionalBool(body.is_public, 'is_public');

  const rows = await db.update(TABLE, qs({
    id: `eq.${id}`, type: `eq.${TYPE}`,
    user_id: `eq.${user.id}`
  }), patch);
  if (!rows.length) throw new HttpError(404, '视频不存在或无权限');

  if (body.tag_ids !== undefined) {
    const tagIds = await validateTagIds(db, user.id, false, body.tag_ids);
    await setResourceTags(db, id, user.id, tagIds);
  }
  const [withTagList] = await withTags(db, rows);
  return ok(withTagList, request, env);
}

// DELETE /api/videos/:id
export async function deleteVideo(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');
  const rows = await db.remove(TABLE, qs({
    id: `eq.${id}`, type: `eq.${TYPE}`,
    user_id: `eq.${user.id}`
  }));
  if (!rows.length) throw new HttpError(404, '视频不存在或无权限');
  return ok({ id }, request, env);
}

// PUT /api/videos/:id/progress  —— 保存播放进度
export async function saveVideoProgress(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');
  const body = await readJson(request);

  // 校验资源归属
  const rows = await db.select(TABLE, qs({
    select: 'id', id: `eq.${id}`, type: `eq.${TYPE}`,
    user_id: `eq.${user.id}`
  }));
  if (!rows.length) throw new HttpError(404, '视频不存在或无权限');

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

// GET /api/videos/:id/progress
export async function getVideoProgress(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');
  const progress = await getProgress(db, user.id, id);
  return ok(progress || { resource_id: id, position: 0, progress: 0, completed: false }, request, env);
}
