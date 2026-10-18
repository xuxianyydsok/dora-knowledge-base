// 站点级配置（site_settings 键值表）。
//
// 2026-10-19：首页轮播图下方的摘要文案需要能在管理员端编辑。
// 这类「单条文案」不值得单独建表，复用 init 迁移里已有的 site_settings：
//   key   = 'hero_subtitle'
//   value = { text: '...' }
//
// 权限：
//   GET  /api/site-settings  访客可读（首页要展示；只返回白名单里的公开键）
//   PATCH /api/site-settings 仅管理员（requireAdmin）
//
// 安全：Worker 用 service_role 直连 PostgREST，RLS 不替它过滤，
// 因此这里显式只允许白名单键，避免把内部配置（如注册开关）误发给访客。

import { ok, json, readJson, HttpError } from '../lib/response.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { cachedData, bumpVersion } from '../lib/edgeCache.js';

const TABLE = 'site_settings';
const HERO_SUBTITLE = 'hero_subtitle';
const PUBLIC_KEYS = [HERO_SUBTITLE];
const MAX_SUBTITLE = 500;

function shape(row) {
  const value = row?.value && typeof row.value === 'object' ? row.value : {};
  return { text: String(value.text || '') };
}

function normalizeSubtitle(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpError(422, 'hero_subtitle 必须为对象');
  }
  if (typeof input.text !== 'string') throw new HttpError(422, 'hero_subtitle.text 必须为字符串');
  const text = input.text.trim();
  if (text.length > MAX_SUBTITLE) {
    throw new HttpError(422, `首页摘要最多 ${MAX_SUBTITLE} 个字符`);
  }
  return { text };
}

// GET /api/site-settings —— 首页读取公开文案
export async function getSiteSettings(request, env) {
  const { db, user } = await requireAuth(request, env);
  const { data, cache } = await cachedData(request, env, {
    key: `site-settings/${user.id}/public`,
    ttl: 300,
    user,
    versionNs: `site-settings/${user.id}`,
    load: async () => {
      const rows = await db.select(TABLE, qs({
        select: 'key,value,updated_at',
        key: `in.(${PUBLIC_KEYS.join(',')})`
      }));
      const byKey = new Map(rows.map((r) => [r.key, r]));
      return {
        hero_subtitle: shape(byKey.get(HERO_SUBTITLE)),
        updated_at: byKey.get(HERO_SUBTITLE)?.updated_at || null
      };
    }
  });
  return json({ data }, { headers: { 'X-List-Cache': cache } }, request, env);
}

// PATCH /api/site-settings —— 仅管理员，当前只开放首页摘要
export async function updateSiteSettings(request, env) {
  const { db, user } = await requireAdmin(request, env);
  const body = await readJson(request);
  if (!('hero_subtitle' in body)) throw new HttpError(422, '没有需要更新的字段');
  const heroSubtitle = normalizeSubtitle(body.hero_subtitle);

  const rows = await db.request(TABLE, {
    method: 'POST',
    body: {
      key: HERO_SUBTITLE,
      value: heroSubtitle,
      description: '首页轮播图下方摘要文案'
    },
    prefer: 'return=representation,resolution=merge-duplicates'
  });
  await bumpVersion(`site-settings/${user.id}`, env);
  return ok({
    hero_subtitle: shape(rows[0]),
    updated_at: rows[0]?.updated_at || null
  }, request, env);
}
