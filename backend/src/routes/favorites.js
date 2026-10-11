// 跨类型收藏夹 CRUD
// 可收藏资源(resource_id)或博客(post_id)，恰好其一
// 权限：普通用户仅自己的收藏；管理员可 ?all=true

import { ok, readJson, HttpError } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { requireUuid } from '../lib/validate.js';

// 校验目标归属并返回规范化字段
// 写操作：仅允许收藏本人资源/博客（管理员同样不可收藏他人数据）
async function resolveTarget(db, user, body) {
  const hasResource = body.resource_id !== undefined && body.resource_id !== null;
  const hasPost = body.post_id !== undefined && body.post_id !== null;
  if (hasResource === hasPost) {
    throw new HttpError(422, '必须且只能提供 resource_id 或 post_id 之一');
  }
  const scope = { user_id: `eq.${user.id}` };

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
      // cover_path 用于收藏页展示封面（音乐 / 影视）；metadata 里带音质等展示信息
      ? db.select('resources', qs({ select: 'id,type,title,url,source,summary,cover_path,metadata', id: `in.(${resourceIds.join(',')})` }))
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
  // 第二道防线：/api/favorites 已移出访客白名单，这里再挡一次
  if (user.isGuest) throw new HttpError(403, '收藏夹需要登录');
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === 'true' && user.isAdmin;

  const rows = await db.select('favorites', qs({
    select: '*',
    ...(all ? {} : { user_id: `eq.${user.id}` }),
    order: 'created_at.desc'
  }));
  return ok(await decorate(db, rows), request, env);
}

// 站长的收藏对所有人公开（2026-10-11 用户要求）：
// 「站长收藏的影视 / 音乐要同步给所有注册用户，默认每个访问的人都能看 / 能听」。
// 实现上不做「收藏时偷偷改 is_public」这种隐式副作用，而是把公开范围收在**读接口**里：
// 站长收藏的资源即便 is_public=false，访客也能通过下面两条路径读到 ——
//   ① GET /api/favorites/public（收藏页的「站长收藏」分区）
//   ② getMusic / getMovie 的访客可见性判定会额外放行「站长收藏过的资源」
// 这样「取消收藏」不会连带改数据，站长仍可用 is_public 控制其它场景的可见性。

// 找出站长（最早创建的 admin）的 user_id。
// 访客上下文里 user.id 已经就是站长 id，但这里显式查一次，保证登录用户调用时同样正确。
export async function adminOwnerId(db) {
  const rows = await db.select('user_profiles', qs({
    select: 'id', role: 'eq.admin', order: 'created_at.asc', limit: '1'
  }));
  return rows[0]?.id || null;
}

// 站长收藏过的资源 id 集合（只含资源类收藏；用于放行访客读取详情页）
export async function adminFavoriteResourceIds(db, adminId) {
  if (!adminId) return [];
  const rows = await db.select('favorites', qs({
    select: 'resource_id', user_id: `eq.${adminId}`, resource_id: 'not.is.null'
  }));
  return rows.map((r) => r.resource_id).filter(Boolean);
}

// 访客能否打开某条**非公开**资源：仅当它被站长收藏。
// 详情页（音乐 / 影视）在访客可见性判定里调用本函数，保证「站长收藏点了就能听 / 能看」。
export async function isAdminFavorited(db, resourceId) {
  if (!resourceId) return false;
  const adminId = await adminOwnerId(db);
  if (!adminId) return false;
  const rows = await db.select('favorites', qs({
    select: 'id', user_id: `eq.${adminId}`, resource_id: `eq.${resourceId}`, limit: '1'
  }));
  return rows.length > 0;
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

// GET /api/favorites/public —— 站长的公开收藏（影视 / 音乐），所有访客可读
// 只返回「资源类」收藏，且只保留影视与音乐（博客 / 其它资源不进这个分区）。
export async function listAdminFavorites(request, env) {
  const { db } = await requireAuth(request, env);
  const adminId = await adminOwnerId(db);
  if (!adminId) return ok([], request, env);

  const rows = await db.select('favorites', qs({
    select: '*', user_id: `eq.${adminId}`, resource_id: 'not.is.null', order: 'created_at.desc', limit: '200'
  }));
  const decorated = await decorate(db, rows);
  const items = decorated
    .filter((f) => f.target?.kind === 'resource' && (f.target.type === 'music' || f.target.type === 'movie'))
    .map((f) => ({ ...f, owner: 'admin' }));
  return ok(items, request, env);
}

// DELETE /api/favorites/:id
export async function deleteFavorite(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');
  const rows = await db.remove('favorites', qs({
    id: `eq.${id}`,
    user_id: `eq.${user.id}`
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

  const filters = { user_id: `eq.${user.id}` };
  if (resourceId) filters.resource_id = `eq.${requireUuid(resourceId, 'resource_id')}`;
  if (postId) filters.post_id = `eq.${requireUuid(postId, 'post_id')}`;

  const rows = await db.remove('favorites', qs(filters));
  return ok({ deleted: rows.length }, request, env);
}
