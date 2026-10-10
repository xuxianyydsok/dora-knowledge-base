// 鉴权中间件
// - requireAuth：校验 Supabase Auth JWT，加载 user_profiles 角色信息
// - requireAdmin：在 requireAuth 基础上强制要求 role=admin（供 MCP 与管理员接口复用）
// 普通用户仅能操作自己的数据；管理员可查看全部。
// - 访客模式（env.PUBLIC_MODE="true"，2026-10-09 起开启）：未带令牌的 GET 请求、且路径在
//   PUBLIC_READ 白名单内时，以「站长」（最早创建的 admin）身份只读访问，user.isGuest=true。
//   写操作、进度、备份、通知、偏好、管理员接口仍必须登录。关闭：把 PUBLIC_MODE 改成 "false"。

import { verifyJwt } from '../lib/jwt.js';
import { SupabaseClient, qs } from '../lib/supabase.js';
import { HttpError } from '../lib/response.js';

function extractToken(request) {
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

// 访客可只读访问的接口（不含 /progress 等个人数据）
const PUBLIC_READ = /^\/api\/(categories|tags|favorites|videos|github|posts|music|movies|news|search|graph)(\/|$)/;

let ownerCache = null;

async function guestContext(request, env) {
  if (env.PUBLIC_MODE !== 'true' || request.method !== 'GET') return null;
  const { pathname } = new URL(request.url);
  if (!PUBLIC_READ.test(pathname) || pathname.endsWith('/progress')) return null;

  const db = new SupabaseClient(env);
  if (!ownerCache) {
    const rows = await db.select('user_profiles', qs({
      role: 'eq.admin', select: '*', order: 'created_at.asc', limit: '1'
    }));
    ownerCache = Array.isArray(rows) ? rows[0] : null;
  }
  if (!ownerCache) return null;

  return {
    db,
    token: null,
    user: {
      id: ownerCache.id,
      email: null,
      role: 'guest',
      plan: ownerCache.plan,
      username: ownerCache.username,
      displayName: ownerCache.display_name,
      isAdmin: false,
      isGuest: true
    }
  };
}

export async function requireAuth(request, env) {
  const token = extractToken(request);
  if (!token) {
    const guest = await guestContext(request, env);
    if (guest) return guest;
    throw new HttpError(401, '缺少访问令牌');
  }

  let payload;
  try {
    payload = await verifyJwt(token, env);
  } catch (err) {
    throw new HttpError(err.status || 401, err.message || 'JWT 校验失败');
  }

  const userId = payload.sub;
  if (!userId) throw new HttpError(401, 'JWT 缺少 sub');

  const db = new SupabaseClient(env);
  const rows = await db.select('user_profiles', qs({ id: `eq.${userId}`, select: '*' }));
  const profile = Array.isArray(rows) ? rows[0] : null;

  if (!profile) throw new HttpError(403, '用户档案不存在');
  if (profile.is_disabled) throw new HttpError(403, '账号已被禁用');

  return {
    db,
    token,
    user: {
      id: userId,
      email: payload.email,
      role: profile.role,
      plan: profile.plan,
      username: profile.username,
      displayName: profile.display_name,
      isAdmin: profile.role === 'admin'
    }
  };
}

export async function requireAdmin(request, env) {
  const ctx = await requireAuth(request, env);
  if (!ctx.user.isAdmin) throw new HttpError(403, '需要管理员权限');
  return ctx;
}

// 数据隔离辅助：普通用户强制按 user_id 过滤；管理员可显式查看全部
export function scopeToUser(user, filters = {}) {
  if (user.isAdmin && filters.all === 'true') return {};
  return { user_id: `eq.${user.id}` };
}
