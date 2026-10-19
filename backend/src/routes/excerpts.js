// 首页摘抄（Excerpts）—— 站长在后台维护「此刻」区那张大卡片的内容。
//
// 背景（2026-10-18 用户原话）：
//   「摘抄那个卡片我要写很多的东西，就需要像 Dora Studio 那样的大卡片……
//     摘抄那里的话需要在管理员那里管理一下，就是我可以输入文本，
//     就是我想把我想摘抄的内容在那个地方进行管理，然后在前端的页面进行展示」
//
// 路由（见 router.js）：
//   GET    /api/excerpts       首页 / 管理端读取（访客只看到启用项）
//   POST   /api/excerpts       新增（requireAdmin）
//   PUT    /api/excerpts/order 批量重排（requireAdmin；3 段路径必须先于 /:id）
//   PATCH  /api/excerpts/:id   修改正文 / 出处 / 启用（requireAdmin）
//   DELETE /api/excerpts/:id   删除（requireAdmin）
//
// 安全：Worker 用 service_role 直连 PostgREST，RLS 不会替它过滤；
// 访客过滤必须在查询层显式叠加 is_active=eq.true。

import { ok, json, readJson, HttpError } from '../lib/response.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { requireUuid, requireString, optionalString, optionalBool, optionalInt } from '../lib/validate.js';
import { cachedData, bumpVersion, invalidateNamespace } from '../lib/edgeCache.js';

const TABLE = 'excerpts';
const SELECT = 'id,content,source,sort_order,is_active,created_at,updated_at';
export const MAX_EXCERPT_CONTENT = 20000;
export const MAX_EXCERPT_SOURCE = 200;

function shape(row) {
  return {
    id: row.id,
    content: row.content,
    source: row.source || '',
    sort_order: Number(row.sort_order) || 0,
    is_active: row.is_active !== false,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// GET /api/excerpts
export async function listExcerpts(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);
  // 管理员管理页读全部；访客 / 普通登录用户只看启用项。
  // 注意：不能只凭 user.isAdmin 自动放行 —— 首页也可能由站长登录后打开，
  // 那里必须仍只拿启用项，否则停用的摘抄会重新出现在首页轮播里。
  const all = url.searchParams.get('all') === 'true' && user.isAdmin;
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 200);

  const filters = {
    select: SELECT,
    user_id: `eq.${user.id}`,
    order: 'sort_order.asc,created_at.asc',
    limit: String(limit)
  };
  // 默认（含站长首页）只拿启用项；只有管理页显式 ?all=true 才读停用项。
  if (!all) filters.is_active = 'eq.true';

  const { data, cache } = await cachedData(request, env, {
    key: `excerpts/${user.id}/${all ? 'all' : 'active'}/${limit}`,
    ttl: 300,
    user,
    versionNs: `excerpts/${user.id}`,
    load: async () => {
      const rows = await db.select(TABLE, qs(filters));
      const items = rows.map(shape);
      return { items, count: items.length };
    }
  });
  return json({ data }, { headers: { 'X-List-Cache': cache } }, request, env);
}

// GET /api/excerpts/diagnose —— 仅站长：不经过缓存，直接看数据库真实记录。
// 用于排查「后台看得到、访客首页看不到」这类账号/启用状态问题。
export async function diagnoseExcerpts(request, env) {
  const { db, user } = await requireAdmin(request, env);
  const rows = await db.select(TABLE, qs({
    select: 'id,user_id,content,source,sort_order,is_active,created_at,updated_at',
    order: 'created_at.desc',
    limit: '200'
  }));
  return ok({
    viewer: { id: user.id, email: user.email, role: user.role },
    total: rows.length,
    active: rows.filter((r) => r.is_active !== false).length,
    rows: rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      owner_is_viewer: r.user_id === user.id,
      is_active: r.is_active !== false,
      content: String(r.content || '').slice(0, 120),
      source: r.source || '',
      sort_order: r.sort_order,
      created_at: r.created_at,
      updated_at: r.updated_at
    }))
  }, request, env);
}

// POST /api/excerpts
export async function createExcerpt(request, env) {
  const { db, user } = await requireAdmin(request, env);
  const body = await readJson(request);

  const content = requireString(body.content, 'content', { max: MAX_EXCERPT_CONTENT });
  const source = optionalString(body.source, 'source', { max: MAX_EXCERPT_SOURCE });
  const isActive = optionalBool(body.is_active, 'is_active') ?? true;

  // 新条目默认排在最后；管理端也可以显式给 sort_order。
  let sortOrder = optionalInt(body.sort_order, 'sort_order', { min: 0, max: 100000 });
  if (sortOrder === undefined) {
    const last = await db.select(TABLE, qs({
      select: 'sort_order',
      user_id: `eq.${user.id}`,
      order: 'sort_order.desc',
      limit: '1'
    }));
    sortOrder = last.length ? (Number(last[0].sort_order) || 0) + 1 : 0;
  }

  const rows = await db.insert(TABLE, {
    user_id: user.id,
    content,
    source: source ?? null,
    sort_order: sortOrder,
    is_active: isActive
  });
  await Promise.all([
    bumpVersion(`excerpts/${user.id}`, env),
    invalidateNamespace(`excerpts/${user.id}`, env)
  ]);
  return ok(shape(rows[0]), request, env, 201);
}

// PATCH /api/excerpts/:id
export async function updateExcerpt(request, env, id) {
  const { db, user } = await requireAdmin(request, env);
  requireUuid(id, 'id');
  const body = await readJson(request);

  const patch = {};
  if (body.content !== undefined) {
    patch.content = requireString(body.content, 'content', { max: MAX_EXCERPT_CONTENT });
  }
  if (body.source !== undefined) {
    patch.source = optionalString(body.source, 'source', { max: MAX_EXCERPT_SOURCE }) ?? null;
  }
  if (body.is_active !== undefined) patch.is_active = optionalBool(body.is_active, 'is_active');
  if (body.sort_order !== undefined) {
    patch.sort_order = optionalInt(body.sort_order, 'sort_order', { min: 0, max: 100000 });
  }
  if (!Object.keys(patch).length) throw new HttpError(422, '没有需要更新的字段');

  const rows = await db.update(TABLE, qs({ id: `eq.${id}`, user_id: `eq.${user.id}` }), patch);
  if (!rows.length) throw new HttpError(404, '摘抄不存在或无权限');
  await Promise.all([
    bumpVersion(`excerpts/${user.id}`, env),
    invalidateNamespace(`excerpts/${user.id}`, env)
  ]);
  return ok(shape(rows[0]), request, env);
}

// DELETE /api/excerpts/:id
export async function deleteExcerpt(request, env, id) {
  const { db, user } = await requireAdmin(request, env);
  requireUuid(id, 'id');
  const rows = await db.remove(TABLE, qs({ id: `eq.${id}`, user_id: `eq.${user.id}` }));
  if (!rows.length) throw new HttpError(404, '摘抄不存在或无权限');
  await Promise.all([
    bumpVersion(`excerpts/${user.id}`, env),
    invalidateNamespace(`excerpts/${user.id}`, env)
  ]);
  return ok({ id, removed: true }, request, env);
}

// PUT /api/excerpts/order
export async function reorderExcerpts(request, env) {
  const { db, user } = await requireAdmin(request, env);
  const body = await readJson(request);
  const ids = Array.isArray(body.ids) ? body.ids : null;
  if (!ids || !ids.length) throw new HttpError(422, '缺少 ids 数组');
  if (ids.length > 200) throw new HttpError(422, '一次最多重排 200 项');

  const results = await Promise.allSettled(ids.map((sid, i) => {
    requireUuid(sid, 'ids[]');
    return db.update(TABLE, qs({ id: `eq.${sid}`, user_id: `eq.${user.id}` }), { sort_order: i });
  }));
  const failed = results.filter((r) => r.status === 'rejected').length;
  await Promise.all([
    bumpVersion(`excerpts/${user.id}`, env),
    invalidateNamespace(`excerpts/${user.id}`, env)
  ]);
  return ok({ updated: ids.length - failed, failed }, request, env);
}
