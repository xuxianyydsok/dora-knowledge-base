// GitHub 仓库收藏库
// 仓库元信息抓取 + CRUD，关联标签与分类
// 权限：普通用户仅操作自己名下收藏；管理员可 ?all=true 查看全部

import { ok, readJson, HttpError } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { fetchGithubMeta } from '../lib/fetchers.js';
import { requireString, optionalString, requireUuid, optionalBool } from '../lib/validate.js';
import { setResourceTags, withTags, validateTagIds } from '../lib/resources.js';

const TABLE = 'resources';
const TYPE = 'github';

function userFilter(user, all) {
  return user.isAdmin && all ? {} : { user_id: `eq.${user.id}` };
}

// POST /api/github/fetch  —— 抓取仓库元信息（不落库）
export async function fetchGithubInfo(request, env) {
  const { db, user } = await requireAuth(request, env);
  const body = await readJson(request);
  const url = requireString(body.url, 'url', { max: 500 });

  const meta = await fetchGithubMeta(url, env);

  let categoryId = null;
  if (body.category_id !== undefined && body.category_id !== null) {
    categoryId = requireUuid(body.category_id, 'category_id');
    const rows = await db.select('categories', qs({
      select: 'id', id: `eq.${categoryId}`,
      ...(user.isAdmin ? {} : { user_id: `eq.${user.id}` })
    }));
    if (!rows.length) throw new HttpError(422, '分类不存在或无权限');
  }
  return ok({ meta, category_id: categoryId }, request, env);
}

// GET /api/github
export async function listGithub(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === 'true';

  const filters = { type: `eq.${TYPE}`, ...userFilter(user, all) };
  const categoryId = url.searchParams.get('category_id');
  if (categoryId) filters.category_id = `eq.${categoryId}`;

  const rows = await db.select(TABLE, qs({
    select: '*', ...filters, order: 'created_at.desc'
  }));
  return ok(await withTags(db, rows), request, env);
}

// GET /api/github/:id
export async function getGithub(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');
  const rows = await db.select(TABLE, qs({
    select: '*', id: `eq.${id}`, type: `eq.${TYPE}`,
    ...(user.isAdmin ? {} : { user_id: `eq.${user.id}` })
  }));
  if (!rows.length) throw new HttpError(404, '仓库收藏不存在或无权限');
  const [item] = await withTags(db, rows);
  return ok(item, request, env);
}

// POST /api/github
export async function createGithub(request, env) {
  const { db, user } = await requireAuth(request, env);
  const body = await readJson(request);
  const url = requireString(body.url, 'url', { max: 500 });

  const meta = await fetchGithubMeta(url, env);
  const title = body.title !== undefined
    ? requireString(body.title, 'title', { max: 300 })
    : meta.title;

  let categoryId = null;
  if (body.category_id !== undefined && body.category_id !== null) {
    categoryId = requireUuid(body.category_id, 'category_id');
  }
  const tagIds = await validateTagIds(db, user.id, user.isAdmin, body.tag_ids);

  const rows = await db.insert(TABLE, {
    user_id: user.id,
    type: TYPE,
    title,
    url: meta.html_url,
    source: 'github',
    cover_path: null,
    summary: optionalString(body.summary, 'summary') ?? meta.description ?? null,
    category_id: categoryId,
    metadata: meta,
    is_public: optionalBool(body.is_public, 'is_public') ?? false
  });
  const resource = rows[0];

  await setResourceTags(db, resource.id, user.id, tagIds);
  const [item] = await withTags(db, [resource]);
  return ok(item, request, env, 201);
}

// PATCH /api/github/:id
export async function updateGithub(request, env, id) {
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

  // 支持刷新元信息（star 数等）
  if (body.refresh === true) {
    const existing = await db.select(TABLE, qs({
      select: 'url', id: `eq.${id}`, type: `eq.${TYPE}`,
      ...(user.isAdmin ? {} : { user_id: `eq.${user.id}` })
    }));
    if (existing.length && existing[0].url) {
      patch.metadata = await fetchGithubMeta(existing[0].url, env);
    }
  }

  if (Object.keys(patch).length > 0) {
    const rows = await db.update(TABLE, qs({
      id: `eq.${id}`, type: `eq.${TYPE}`,
      ...(user.isAdmin ? {} : { user_id: `eq.${user.id}` })
    }), patch);
    if (!rows.length) throw new HttpError(404, '仓库收藏不存在或无权限');
  }

  if (body.tag_ids !== undefined) {
    const tagIds = await validateTagIds(db, user.id, user.isAdmin, body.tag_ids);
    await setResourceTags(db, id, user.id, tagIds);
  }

  const rows = await db.select(TABLE, qs({
    select: '*', id: `eq.${id}`, type: `eq.${TYPE}`,
    ...(user.isAdmin ? {} : { user_id: `eq.${user.id}` })
  }));
  if (!rows.length) throw new HttpError(404, '仓库收藏不存在或无权限');
  const [item] = await withTags(db, rows);
  return ok(item, request, env);
}

// DELETE /api/github/:id
export async function deleteGithub(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');
  const rows = await db.remove(TABLE, qs({
    id: `eq.${id}`, type: `eq.${TYPE}`,
    ...(user.isAdmin ? {} : { user_id: `eq.${user.id}` })
  }));
  if (!rows.length) throw new HttpError(404, '仓库收藏不存在或无权限');
  return ok({ id }, request, env);
}
