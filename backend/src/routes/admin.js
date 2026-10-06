// 管理员用户管理接口
// - 查看全部用户列表（含档案与资源统计）
// - 启用 / 禁用账号
// - 修改用户角色（user/admin）
// 权限：全部接口强制 requireAdmin（管理员 JWT）
// 安全：管理员不可禁用/降级自己，避免误锁；禁用通过 user_profiles.is_disabled 生效，
//       requireAuth 中间件会拒绝 is_disabled 用户的所有请求。

import { ok, readJson, HttpError } from '../lib/response.js';
import { requireAdmin } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { requireUuid, requireEnum } from '../lib/validate.js';

// 通过 Supabase Auth Admin API 读取邮箱映射（user_profiles 不含邮箱）
// 使用 service_role key；失败时降级为不返回邮箱，不影响用户列表可用性
async function loadEmails(env) {
  const url = `${env.SUPABASE_URL}/auth/v1/admin/users?per_page=1000`;
  try {
    const res = await fetch(url, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
      }
    });
    if (!res.ok) return {};
    const body = await res.json();
    return Object.fromEntries((body.users || []).map((u) => [u.id, u.email]));
  } catch {
    return {};
  }
}

// 用户资源数量统计（按 user_id 聚合）
async function resourceCounts(db) {
  const rows = await db.select('resources', qs({ select: 'user_id' }));
  return rows.reduce((acc, r) => {
    acc[r.user_id] = (acc[r.user_id] || 0) + 1;
    return acc;
  }, {});
}

// 用户博客数量统计
async function postCounts(db) {
  const rows = await db.select('posts', qs({ select: 'user_id' }));
  return rows.reduce((acc, r) => {
    acc[r.user_id] = (acc[r.user_id] || 0) + 1;
    return acc;
  }, {});
}

// 读取目标用户档案，不存在则 404
async function findProfile(db, id) {
  requireUuid(id, 'id');
  const rows = await db.select('user_profiles', qs({ select: '*', id: `eq.${id}` }));
  if (!rows.length) throw new HttpError(404, '用户不存在');
  return rows[0];
}

// GET /api/admin/users
// 返回全部用户档案（含 role/plan/is_disabled/创建时间）与资源统计
export async function listUsers(request, env) {
  const { db } = await requireAdmin(request, env);
  const url = new URL(request.url);

  const filters = { select: '*', order: 'created_at.desc' };
  const role = url.searchParams.get('role');
  if (role) filters.role = `eq.${requireEnum(role, 'role', ['user', 'admin'])}`;
  if (url.searchParams.get('disabled') === 'true') filters.is_disabled = 'eq.true';
  filters.limit = String(Math.min(Number(url.searchParams.get('limit')) || 200, 500));

  const [profiles, resources, posts, emails] = await Promise.all([
    db.select('user_profiles', qs(filters)),
    resourceCounts(db),
    postCounts(db),
    loadEmails(env)
  ]);

  return ok(profiles.map((p) => ({
    ...p,
    email: emails[p.id] || null,
    stats: {
      resources: resources[p.id] || 0,
      posts: posts[p.id] || 0
    }
  })), request, env);
}

// GET /api/admin/users/:id
export async function getUser(request, env, id) {
  const { db } = await requireAdmin(request, env);
  const profile = await findProfile(db, id);

  const [resources, posts, emails] = await Promise.all([
    db.select('resources', qs({ select: 'id', user_id: `eq.${id}` })),
    db.select('posts', qs({ select: 'id', user_id: `eq.${id}` })),
    loadEmails(env)
  ]);

  return ok({
    ...profile,
    email: emails[id] || null,
    stats: { resources: resources.length, posts: posts.length }
  }, request, env);
}

// PATCH /api/admin/users/:id
// body: { is_disabled?, role? }
export async function updateUser(request, env, id) {
  const { db, user } = await requireAdmin(request, env);
  requireUuid(id, 'id');
  await findProfile(db, id);

  const body = await readJson(request);
  const patch = {};

  if (body.is_disabled !== undefined) {
    if (typeof body.is_disabled !== 'boolean') throw new HttpError(422, 'is_disabled 必须为布尔值');
    // 禁止管理员禁用自己，避免把自己锁在系统外
    if (id === user.id && body.is_disabled) throw new HttpError(422, '不能禁用当前登录的管理员账号');
    patch.is_disabled = body.is_disabled;
  }
  if (body.role !== undefined) {
    patch.role = requireEnum(body.role, 'role', ['user', 'admin']);
    // 禁止管理员把自己降级，避免失去管理权限
    if (id === user.id && patch.role !== 'admin') throw new HttpError(422, '不能降级当前登录的管理员账号');
  }
  if (!Object.keys(patch).length) throw new HttpError(422, '未提供可更新字段（is_disabled / role）');

  const rows = await db.update('user_profiles', qs({ id: `eq.${id}` }), patch);
  if (!rows.length) throw new HttpError(404, '用户不存在');
  const emails = await loadEmails(env);
  return ok({ ...rows[0], email: emails[id] || null }, request, env);
}
