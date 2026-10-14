// 标签 CRUD 接口 + 批量管理
// 权限：普通用户仅能读写自己名下标签；管理员可传 ?all=true 查看全部
// 标签支持自定义颜色（#RRGGBB）

import { ok, json, readJson, HttpError } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import {
  requireString, optionalString, requireHexColor, requireUuid, slugify
} from '../lib/validate.js';
import { cachedData, bumpCache } from '../lib/edgeCache.js';

const TABLE = 'tags';
const DEFAULT_COLOR = '#6b7280';
const CACHE_TTL = 300;   // 5 分钟：标签很少变，且是首屏必需（见 edgeCache.js 说明）

// GET /api/tags
export async function listTags(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === 'true' && user.isAdmin;

  const { data, cache } = await cachedData(request, env, {
    key: `tags/${user.id}/${all ? 'all' : 'own'}`,
    ttl: CACHE_TTL,
    user,
    load: async () => db.select(TABLE, qs({
      // 访客只返回安全字段，不暴露 user_id / created_at / updated_at 等内部字段
      select: user.isGuest ? 'id,name,slug,color' : '*',
      ...(all ? {} : { user_id: `eq.${user.id}` }),
      order: 'name.asc'
    }))
  });
  return json({ data }, { headers: { 'X-List-Cache': cache } }, request, env);
}

// POST /api/tags
export async function createTag(request, env) {
  const { db, user } = await requireAuth(request, env);
  const body = await readJson(request);

  const name = requireString(body.name, 'name', { max: 60 });
  const color = body.color === undefined ? DEFAULT_COLOR : requireHexColor(body.color);

  const rows = await db.insert(TABLE, {
    user_id: user.id,
    name,
    slug: optionalString(body.slug) ? slugify(body.slug) : slugify(name),
    color
  });
  await bumpCache(`tags/${user.id}/own`);
  return ok(rows[0], request, env, 201);
}

// PATCH /api/tags/:id
export async function updateTag(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');
  const body = await readJson(request);

  const patch = {};
  if (body.name !== undefined) {
    patch.name = requireString(body.name, 'name', { max: 60 });
    if (body.slug === undefined) patch.slug = slugify(patch.name);
  }
  if (body.slug !== undefined) patch.slug = slugify(requireString(body.slug, 'slug'));
  if (body.color !== undefined) patch.color = requireHexColor(body.color);

  if (Object.keys(patch).length === 0) throw new HttpError(422, '没有可更新的字段');

  const rows = await db.update(TABLE, qs({ id: `eq.${id}`, user_id: `eq.${user.id}` }), patch);
  if (!rows.length) throw new HttpError(404, '标签不存在或无权限');
  await bumpCache(`tags/${user.id}/own`);
  return ok(rows[0], request, env);
}

// DELETE /api/tags/:id
export async function deleteTag(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');
  const rows = await db.remove(TABLE, qs({ id: `eq.${id}`, user_id: `eq.${user.id}` }));
  if (!rows.length) throw new HttpError(404, '标签不存在或无权限');
  await bumpCache(`tags/${user.id}/own`);
  return ok({ id }, request, env);
}

// POST /api/tags/batch  —— 批量创建
export async function batchCreateTags(request, env) {
  const { db, user } = await requireAuth(request, env);
  const body = await readJson(request);
  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(422, 'items 必须为非空数组');
  }
  if (items.length > 200) throw new HttpError(422, '单次批量创建不能超过 200 条');

  const rows = items.map((item, idx) => {
    const name = requireString(item?.name, `items[${idx}].name`, { max: 60 });
    const color = item?.color === undefined ? DEFAULT_COLOR : requireHexColor(item.color, `items[${idx}].color`);
    return {
      user_id: user.id,
      name,
      slug: item?.slug ? slugify(item.slug) : slugify(name),
      color
    };
  });

  // upsert：同一用户下 slug 冲突时更新颜色/名称
  const created = await db.request(TABLE, {
    method: 'POST',
    body: rows,
    prefer: 'return=representation,resolution=merge-duplicates'
  });
  await bumpCache(`tags/${user.id}/own`);
  return ok(created, request, env, 201);
}

// PATCH /api/tags/batch  —— 批量更新（按 id 逐条更新）
export async function batchUpdateTags(request, env) {
  const { db, user } = await requireAuth(request, env);
  const body = await readJson(request);
  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(422, 'items 必须为非空数组');
  }
  if (items.length > 200) throw new HttpError(422, '单次批量更新不能超过 200 条');

  const updated = [];
  for (const [idx, item] of items.entries()) {
    const id = requireUuid(item?.id, `items[${idx}].id`);
    const patch = {};
    if (item.name !== undefined) {
      patch.name = requireString(item.name, `items[${idx}].name`, { max: 60 });
      if (item.slug === undefined) patch.slug = slugify(patch.name);
    }
    if (item.slug !== undefined) patch.slug = slugify(requireString(item.slug, `items[${idx}].slug`));
    if (item.color !== undefined) patch.color = requireHexColor(item.color, `items[${idx}].color`);
    if (Object.keys(patch).length === 0) continue;

    const rows = await db.update(TABLE, qs({ id: `eq.${id}`, user_id: `eq.${user.id}` }), patch);
    if (rows.length) updated.push(rows[0]);
  }
  await bumpCache(`tags/${user.id}/own`);
  return ok(updated, request, env);
}

// DELETE /api/tags/batch  —— 批量删除
export async function batchDeleteTags(request, env) {
  const { db, user } = await requireAuth(request, env);
  const body = await readJson(request);
  const ids = body.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new HttpError(422, 'ids 必须为非空数组');
  }
  if (ids.length > 200) throw new HttpError(422, '单次批量删除不能超过 200 条');
  ids.forEach((id, idx) => requireUuid(id, `ids[${idx}]`));

  const rows = await db.remove(TABLE, qs({ id: `in.(${ids.join(',')})`, user_id: `eq.${user.id}` }));
  await bumpCache(`tags/${user.id}/own`);
  return ok({ deleted: rows.length, ids: rows.map((r) => r.id) }, request, env);
}
