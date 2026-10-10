// GitHub 仓库收藏库
// 仓库元信息抓取 + CRUD，关联标签与分类
// 权限：普通用户仅操作自己名下收藏；管理员可 ?all=true 查看全部

import { ok, readJson, HttpError } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { fetchGithubMeta } from '../lib/fetchers.js';
import { requireString, optionalString, requireUuid, optionalBool } from '../lib/validate.js';
import { setResourceTags, withTags, validateTagIds, validateCategoryId } from '../lib/resources.js';
import { syncStarsPage, selectAllGithubLite } from '../lib/githubStars.js';
import { analyzePending } from '../lib/githubAi.js';

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
    categoryId = await validateCategoryId(db, user.id, requireUuid(body.category_id, 'category_id'));
  }
  return ok({ meta, category_id: categoryId }, request, env);
}

// GET /api/github —— 收藏列表（同步自 GitHub Star，可能上千条：只取列表需要的字段，按收藏时间倒序）
export async function listGithub(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === 'true';
  const rows = await selectAllGithubLite(db, userFilter(user, all));
  return ok(rows, request, env);
}

// POST /api/github/sync { page, run } —— 站长手动同步一页（前端按页循环，直到 done）
export async function syncGithub(request, env) {
  const { user } = await requireAuth(request, env);
  if (!user.isAdmin) throw new HttpError(403, '只有站长可以同步 GitHub 收藏');
  const body = await readJson(request);
  const page = Number(body.page) || 1;
  if (page < 1 || page > 100) throw new HttpError(422, 'page 超出范围');
  const run = requireString(body.run, 'run', { max: 60 });
  if (!/^[\w-]+$/.test(run)) throw new HttpError(422, 'run 格式不正确');
  try {
    return ok(await syncStarsPage(env, user.id, page, run), request, env);
  } catch (e) {
    throw new HttpError(502, e.message);
  }
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
    categoryId = await validateCategoryId(db, user.id, requireUuid(body.category_id, 'category_id'));
  }
  const tagIds = await validateTagIds(db, user.id, false, body.tag_ids);

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
    patch.category_id = body.category_id === null
      ? null
      : await validateCategoryId(db, user.id, requireUuid(body.category_id, 'category_id'));
  }
  if (body.is_public !== undefined) patch.is_public = optionalBool(body.is_public, 'is_public');

  // 支持刷新元信息（star 数等）
  if (body.refresh === true) {
    const existing = await db.select(TABLE, qs({
      select: 'url', id: `eq.${id}`, type: `eq.${TYPE}`,
      user_id: `eq.${user.id}`
    }));
    if (existing.length && existing[0].url) {
      patch.metadata = await fetchGithubMeta(existing[0].url, env);
    }
  }

  if (Object.keys(patch).length > 0) {
    const rows = await db.update(TABLE, qs({
      id: `eq.${id}`, type: `eq.${TYPE}`,
      user_id: `eq.${user.id}`
    }), patch);
    if (!rows.length) throw new HttpError(404, '仓库收藏不存在或无权限');
  }

  if (body.tag_ids !== undefined) {
    const tagIds = await validateTagIds(db, user.id, false, body.tag_ids);
    await setResourceTags(db, id, user.id, tagIds);
  }

  const rows = await db.select(TABLE, qs({
    select: '*', id: `eq.${id}`, type: `eq.${TYPE}`,
    user_id: `eq.${user.id}`
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
    user_id: `eq.${user.id}`
  }));
  if (!rows.length) throw new HttpError(404, '仓库收藏不存在或无权限');
  return ok({ id }, request, env);
}

// POST /api/github/analyze —— 立即解读一批待解读仓库（游客也可触发，只处理还没解读的，不改其他数据）
export async function analyzeGithub(request, env) {
  await requireAuth(request, env);
  return ok(await analyzePending(env), request, env);
}
