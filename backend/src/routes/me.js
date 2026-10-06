// 当前用户信息接口
// 返回 user_profiles 中的角色与套餐信息，供前端判断管理员/展示
import { ok } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';

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
