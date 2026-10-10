// 用户偏好：主题（白天 light / 素雅 sepia）与自定义配色持久化。暗色主题 2026-10-09 已移除，旧值 dark 按 light 处理
// 权限：普通用户仅读写自己的偏好；管理员可读全部

import { ok, readJson, HttpError } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';

const HEX = /^#[0-9a-fA-F]{6}$/;

// 允许自定义的主题变量白名单
const THEME_KEYS = ['bg', 'bg_elevated', 'bg_subtle', 'text', 'text_muted', 'border', 'primary', 'primary_contrast', 'danger'];

function validateTheme(theme) {
  if (theme === undefined) return undefined;
  if (typeof theme !== 'object' || theme === null || Array.isArray(theme)) {
    throw new HttpError(422, 'theme 必须为对象');
  }
  const out = {};
  if (theme.mode !== undefined) {
    if (!['light', 'sepia', 'dark'].includes(theme.mode)) throw new HttpError(422, "theme.mode 必须为 'light' 或 'sepia'");
    out.mode = theme.mode === 'dark' ? 'light' : theme.mode;
  }
  for (const variant of ['light', 'sepia']) {
    if (theme[variant] === undefined) continue;
    const colors = theme[variant];
    if (typeof colors !== 'object' || colors === null) {
      throw new HttpError(422, `theme.${variant} 必须为对象`);
    }
    out[variant] = {};
    for (const [key, value] of Object.entries(colors)) {
      if (!THEME_KEYS.includes(key)) continue;      // 忽略未知键
      if (typeof value !== 'string' || !HEX.test(value)) {
        throw new HttpError(422, `theme.${variant}.${key} 必须为 #RRGGBB 格式`);
      }
      out[variant][key] = value.toLowerCase();
    }
  }
  return out;
}

// GET /api/preferences
export async function getPreferences(request, env) {
  const { db, user } = await requireAuth(request, env);
  const rows = await db.select('user_preferences', qs({ select: '*', user_id: `eq.${user.id}` }));
  const pref = rows[0] || { user_id: user.id, theme: {}, updated_at: null };
  return ok(pref, request, env);
}

// PUT /api/preferences —— 覆盖写入主题配置
export async function updatePreferences(request, env) {
  const { db, user } = await requireAuth(request, env);
  const body = await readJson(request);
  const theme = validateTheme(body.theme);
  if (theme === undefined) throw new HttpError(422, '缺少 theme 字段');

  const rows = await db.request('user_preferences', {
    method: 'POST',
    body: { user_id: user.id, theme },
    prefer: 'return=representation,resolution=merge-duplicates'
  });
  return ok(rows[0], request, env);
}

// DELETE /api/preferences —— 重置为主题默认
export async function resetPreferences(request, env) {
  const { db, user } = await requireAuth(request, env);
  const rows = await db.update('user_preferences', qs({ user_id: `eq.${user.id}` }), { theme: {} });
  return ok(rows[0] || { user_id: user.id, theme: {} }, request, env);
}
