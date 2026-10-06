// 分类 CRUD 接口
// 权限：普通用户仅能读写自己名下分类；管理员可传 ?all=true 查看全部

import { ok, fail, readJson, HttpError } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { requireString, optionalString, optionalInt, requireUuid, slugify } from '../lib/validate.js';

const TABLE = 'categories';

// GET /api/categories
export async function listCategories(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === 'true' && user.isAdmin;

  const query = qs({
    select: '*',
    ...(all ? {} : { user_id: `eq.${user.id}` }),
    order: 'sort_order.asc,created_at.desc'
  });
  const rows = await db.select(TABLE, query);
  return ok(rows, request, env);
}

// POST /api/categories
export async function createCategory(request, env) {
  const { db, user } = await requireAuth(request, env);
  const body = await readJson(request);

  const name = requireString(body.name, 'name', { max: 100 });
  const slug = optionalString(body.slug) ? slugify(body.slug) : slugify(name);

  const rows = await db.insert(TABLE, {
    user_id: user.id,
    name,
    slug,
    description: optionalString(body.description, 'description') ?? null,
    sort_order: optionalInt(body.sort_order, 'sort_order') ?? 0
  });
  return ok(rows[0], request, env, 201);
}

// PATCH /api/categories/:id
export async function updateCategory(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');
  const body = await readJson(request);

  const patch = {};
  if (body.name !== undefined) {
    patch.name = requireString(body.name, 'name', { max: 100 });
    if (body.slug === undefined) patch.slug = slugify(patch.name);
  }
  if (body.slug !== undefined) patch.slug = slugify(requireString(body.slug, 'slug'));
  if (body.description !== undefined) patch.description = optionalString(body.description, 'description') ?? null;
  if (body.sort_order !== undefined) patch.sort_order = optionalInt(body.sort_order, 'sort_order');

  if (Object.keys(patch).length === 0) throw new HttpError(422, '没有可更新的字段');

  const rows = await db.update(TABLE, qs({ id: `eq.${id}`, user_id: `eq.${user.id}` }), patch);
  if (!rows.length) throw new HttpError(404, '分类不存在或无权限');
  return ok(rows[0], request, env);
}

// DELETE /api/categories/:id
export async function deleteCategory(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');
  const rows = await db.remove(TABLE, qs({ id: `eq.${id}`, user_id: `eq.${user.id}` }));
  if (!rows.length) throw new HttpError(404, '分类不存在或无权限');
  return ok({ id }, request, env);
}
