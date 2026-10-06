// 跨类型收藏夹 CRUD
// 可收藏资源(resource_id)或博客(post_id)，恰好其一
// 权限：普通用户仅自己的收藏；管理员可 ?all=true

import { ok, readJson, HttpError } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { requireUuid } from '../lib/validate.js';

// 校验目标归属并返回规范化字段
async function resolveTarget(db, user, body) {
  const hasResource = body.resource_id !== undefined && body.resource_id !== null;
  const hasPost = body.post_id !== undefined && body.post_id !== null;
  if (hasResource === hasPost) {
    throw new HttpError(422, '必须且只能提供 resource_id 或 post_id 之一');
  }
  const scope = user.isAdmin ? {} : { user_id: `eq.${user.id}` };

  if (hasResource) {
    const id = requireUuid(body.resource_id, 'resource_id');
    const rows = await db.select('resources', qs({ select: 'id', id: `eq.${id}`, ...scope }));
    if (!rows.length) throw new HttpError(404, '资源不存在或无权限');
    return { resource_id: id, post_id: null };
  }
  const id = requireUuid(body.post_id, 'post_id');
  const rows = await db.select('posts', qs({ select: 'id', id: `eq.${id}`, ...scope }));
  if (!rows.length) throw new HttpError(404, '博客不存在或无权限');
  return { resource_id: null, post_id: id };
}

// 组装收藏项的目标详情
async function decorate(db, favorites) {
  if (!favorites.length) return [];
  const resourceIds = favorites.filter((f) => f.resource_id).map((f) => f.resource_id);
  const postIds = favorites.filter((f) => f.post_id).map((f) => f.post_id);

  const [resources, posts] = await Promise.all([
    resourceIds.length
      ? db.select('resources', qs({ select: 'id,type,title,url,source,summary', id: `in.(${resourceIds.join(',')})` }))
      : [],
    postIds.length
      ? db.select('posts', qs({ select: 'id,title,slug,status,excerpt', id: `in.(${postIds.join(',')})` }))
      : []
  ]);
  const rMap = Object.fromEntries(resources.map((r) => [r.id, r]));
  const pMap = Object.fromEntries(posts.map((p) => [p.id, p]));

  return favorites.map((f) => ({
    ...f,
    target: f.resource_id
      ? { kind: 'resource', ...(rMap[f.resource_id] || {}) }
      : { kind: 'post', ...(pMap[f.post_id] || {}) }
  }));
}

// GET /api/favorites
export async function listFavorites(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === 'true' && user.isAdmin;

  const rows = await db.select('favorites', qs({
    select: '*',
    ...(all ? {} : { user_id: `eq.${user.id}` }),
    order: 'created_at.desc'
  }));
  return ok(await decorate(db, rows), request, env);
}

// POST /api/favorites
export async function createFavorite(request, env) {
  const { db, user } = await requireAuth(request, env);
  const body = await readJson(request);
  const target = await resolveTarget(db, user, body);

  const rows = await db.request('favorites', {
    method: 'POST',
    body: { user_id: user.id, ...target },
    prefer: 'return=representation,resolution=merge-duplicates'
  });
  const [item] = await decorate(db, rows);
  return ok(item, request, env, 201);
}

// DELETE /api/favorites/:id
export async function deleteFavorite(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');
  const rows = await db.remove('favorites', qs({
    id: `eq.${id}`,
    ...(user.isAdmin ? {} : { user_id: `eq.${user.id}` })
  }));
  if (!rows.length) throw new HttpError(404, '收藏不存在或无权限');
  return ok({ id }, request, env);
}

// DELETE /api/favorites/target?resource_id=...|post_id=...
export async function deleteFavoriteByTarget(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);
  const resourceId = url.searchParams.get('resource_id');
  const postId = url.searchParams.get('post_id');
  if (!resourceId && !postId) throw new HttpError(422, '需提供 resource_id 或 post_id');

  const filters = { ...(user.isAdmin ? {} : { user_id: `eq.${user.id}` }) };
  if (resourceId) filters.resource_id = `eq.${requireUuid(resourceId, 'resource_id')}`;
  if (postId) filters.post_id = `eq.${requireUuid(postId, 'post_id')}`;

  const rows = await db.remove('favorites', qs(filters));
  return ok({ deleted: rows.length }, request, env);
}
