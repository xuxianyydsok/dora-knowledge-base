// 当前用户信息接口
// - GET  /api/me：返回 user_profiles 中的角色与套餐信息，供前端判断管理员/展示
// - PATCH /api/me：允许本人修改安全字段（display_name / avatar_path / username）
//
// 权限与安全（见 docs/public-access.md、迁移 20261010000014）：
//   访客（未登录只读上下文 isGuest=true）一律 403——访客上下文里的 user.id 是站长 id，
//   绝不能借它改站长的档案；只有真正登录的本人才能改自己的安全字段。
//   role / plan / plan_expires_at / is_disabled / id 属特权字段，请求体里出现即 422
//   （不是忽略），避免「传了就当没看见」造成的误解。
//   数据库层另有迁移 0014 把 authenticated 的表级 update 收窄到这三列，这里是第二道保险。
//
// 返回结构与 GET 一致：{ id, email, username, display_name, role, plan, is_admin }，
// **绝不含** token / JWT / access_token / refresh_token / 数据库地址 / 密钥。
import { ok, readJson, HttpError } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { normalizeSafeUrl } from '../lib/safeUrl.js';

// 本人可改的安全列白名单
const SAFE_FIELDS = new Set(['display_name', 'avatar_path', 'username']);
// 特权列：出现即 422（明确拒绝，不是忽略）
const PRIVILEGED_FIELDS = new Set(['role', 'plan', 'plan_expires_at', 'is_disabled', 'id']);

// 只挑出允许本人修改的安全列；出现特权列直接抛 422。
// 纯函数、无 IO，供路由与离线单测共用。
export function buildProfilePatch(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(422, '请求体必须为对象');
  }

  const patch = {};
  for (const key of Object.keys(body)) {
    if (PRIVILEGED_FIELDS.has(key)) {
      throw new HttpError(422, `不允许修改特权字段: ${key}`);
    }
    if (!SAFE_FIELDS.has(key)) {
      throw new HttpError(422, `不支持修改字段: ${key}`);
    }
  }

  if ('display_name' in body) {
    const v = body.display_name;
    if (v === null) patch.display_name = null;
    else if (typeof v !== 'string') throw new HttpError(422, 'display_name 必须为字符串');
    else {
      const trimmed = v.trim();
      if (trimmed.length > 80) throw new HttpError(422, 'display_name 长度不能超过 80');
      patch.display_name = trimmed || null;
    }
  }

  if ('avatar_path' in body) {
    const v = body.avatar_path;
    if (v === null) patch.avatar_path = null;
    else if (typeof v !== 'string') throw new HttpError(422, 'avatar_path 必须为字符串');
    else {
      if (v.length > 500) throw new HttpError(422, 'avatar_path 长度不能超过 500');
      const normalized = normalizeSafeUrl(v);
      if (!normalized) throw new HttpError(422, 'avatar_path 必须是 http/https 链接或站内相对地址');
      patch.avatar_path = normalized;
    }
  }

  if ('username' in body) {
    const v = body.username;
    if (typeof v !== 'string') throw new HttpError(422, 'username 必须为字符串');
    const trimmed = v.trim();
    if (trimmed.length < 3 || trimmed.length > 60) throw new HttpError(422, 'username 长度必须为 3..60');
    if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
      throw new HttpError(422, 'username 只能包含字母、数字、下划线、点、连字符');
    }
    patch.username = trimmed;
  }

  if (!Object.keys(patch).length) throw new HttpError(422, '没有需要更新的字段');
  return patch;
}

// GET /api/me
export async function getMe(request, env) {
  const { user } = await requireAuth(request, env);
  return ok({
    id: user.id,
    email: user.email,
    username: user.username,
    display_name: user.displayName,
    role: user.role,
    plan: user.plan,
    is_admin: user.isAdmin
  }, request, env);
}

// PATCH /api/me —— 仅本人，且仅安全字段
export async function updateMe(request, env) {
  const { db, user } = await requireAuth(request, env);
  // 访客上下文里的 user.id 是站长 id，绝不允许借它改档案
  if (user.isGuest) throw new HttpError(403, '访客不能修改账号信息');

  const body = await readJson(request);
  const patch = buildProfilePatch(body);

  let rows;
  try {
    // 严格按本人 id 更新：请求体里的 id 已在 buildProfilePatch 里被 422 拒绝
    rows = await db.update('user_profiles', qs({ id: `eq.${user.id}` }), patch);
  } catch (err) {
    if (err?.status === 409 || /duplicate key/i.test(err?.message || '')) {
      throw new HttpError(409, '用户名已被占用');
    }
    throw err;
  }

  const profile = rows[0] || {};
  return ok({
    id: user.id,
    email: user.email,
    username: profile.username ?? user.username,
    display_name: profile.display_name ?? user.displayName,
    role: profile.role ?? user.role,
    plan: profile.plan ?? user.plan,
    is_admin: profile.role ? profile.role === 'admin' : user.isAdmin
  }, request, env);
}
