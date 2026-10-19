// 站点级配置（site_settings 键值表）。
//
// 2026-10-19：首页轮播图下方的摘要文案需要能在管理员端编辑。
// 复用 init 迁移里已有的 site_settings：
//   key   = 'hero_subtitle'              ← 首页读取的“当前启用文案”（兼容旧格式）
//   key   = 'hero_subtitle_items'        ← 管理端的多条摘要（正文/启用/排序）
//
// 为什么不新建表：摘要条数很少（通常几条），复用键值表就能完整支持
// 新增 / 编辑 / 启用停用 / 排序 / 删除；首页始终只读 hero_subtitle 这一条，
// 不把管理用的元数据暴露给访客。
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
import { cachedData, bumpVersion, invalidateNamespace } from '../lib/edgeCache.js';

const TABLE = 'site_settings';
const HERO_SUBTITLE = 'hero_subtitle';
const HERO_SUBTITLE_ITEMS = 'hero_subtitle_items';
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

function normalizeItems(input) {
  if (!Array.isArray(input)) throw new HttpError(422, 'hero_subtitle_items 必须为数组');
  if (input.length > 100) throw new HttpError(422, '摘要最多 100 条');
  return input.map((item, i) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new HttpError(422, `第 ${i + 1} 条摘要格式无效`);
    }
    const text = typeof item.text === 'string' ? item.text.trim() : '';
    if (!text) throw new HttpError(422, `第 ${i + 1} 条摘要正文不能为空`);
    if (text.length > MAX_SUBTITLE) {
      throw new HttpError(422, `第 ${i + 1} 条摘要最多 ${MAX_SUBTITLE} 个字符`);
    }
    return {
      id: typeof item.id === 'string' && item.id ? item.id : `sub_${Date.now()}_${i}`,
      text,
      is_active: item.is_active !== false,
      sort_order: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : i,
      created_at: item.created_at || new Date().toISOString(),
      updated_at: item.updated_at || new Date().toISOString()
    };
  }).sort((a, b) => a.sort_order - b.sort_order);
}

// 读取当前启用文案：优先新结构；旧数据只有 hero_subtitle 时原样兼容。
async function loadSubtitleState(db) {
  const rows = await db.select(TABLE, qs({
    select: 'key,value,updated_at',
    key: `in.(${PUBLIC_KEYS.concat(HERO_SUBTITLE_ITEMS).join(',')})`
  }));
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const legacy = byKey.get(HERO_SUBTITLE);
  const itemsRow = byKey.get(HERO_SUBTITLE_ITEMS);
  let items = [];
  if (itemsRow?.value && Array.isArray(itemsRow.value.items)) {
    items = normalizeItems(itemsRow.value.items);
  } else {
    const text = shape(legacy).text;
    if (text) {
      items = [{
        id: 'legacy',
        text,
        is_active: true,
        sort_order: 0,
        created_at: legacy?.updated_at || null,
        updated_at: legacy?.updated_at || null
      }];
    }
  }
  const active = items.find((x) => x.is_active) || null;
  return {
    hero_subtitle: { text: active?.text || '' },
    items,
    updated_at: active?.updated_at || legacy?.updated_at || null
  };
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
      const state = await loadSubtitleState(db);
      return { hero_subtitle: state.hero_subtitle, updated_at: state.updated_at };
    }
  });
  return json({ data }, { headers: { 'X-List-Cache': cache } }, request, env);
}

// GET /api/site-settings/admin —— 仅管理员，返回完整多条摘要
export async function listHeroSubtitleItems(request, env) {
  const { db } = await requireAdmin(request, env);
  const state = await loadSubtitleState(db);
  return ok(state, request, env);
}

// PATCH /api/site-settings —— 仅管理员，当前只开放首页摘要
export async function updateSiteSettings(request, env) {
  const { db, user } = await requireAdmin(request, env);
  const body = await readJson(request);
  if (!('hero_subtitle' in body) && !('hero_subtitle_items' in body)) {
    throw new HttpError(422, '没有需要更新的字段');
  }

  let state;
  if ('hero_subtitle_items' in body) {
    const items = normalizeItems(body.hero_subtitle_items);
    const active = items.find((x) => x.is_active);
    const current = active ? { text: active.text } : { text: '' };
    const rows = await db.request(TABLE, {
      method: 'POST',
      body: [
        {
          key: HERO_SUBTITLE_ITEMS,
          value: { items },
          description: '首页轮播摘要多条管理（启用/排序）'
        },
        {
          key: HERO_SUBTITLE,
          value: current,
          description: '首页轮播图下方摘要文案（当前启用项）'
        }
      ],
      prefer: 'return=representation,resolution=merge-duplicates'
    });
    state = { hero_subtitle: current, items, updated_at: rows?.[0]?.updated_at || null };
  } else {
    // 兼容旧的单条保存调用：视为替换当前唯一一条。
    const heroSubtitle = normalizeSubtitle(body.hero_subtitle);
    const now = new Date().toISOString();
    const items = heroSubtitle.text
      ? [{ id: 'legacy', text: heroSubtitle.text, is_active: true, sort_order: 0, created_at: now, updated_at: now }]
      : [];
    await db.request(TABLE, {
      method: 'POST',
      body: [
        { key: HERO_SUBTITLE, value: heroSubtitle, description: '首页轮播图下方摘要文案' },
        { key: HERO_SUBTITLE_ITEMS, value: { items }, description: '首页轮播摘要多条管理（启用/排序）' }
      ],
      prefer: 'return=representation,resolution=merge-duplicates'
    });
    state = { hero_subtitle: heroSubtitle, items, updated_at: now };
  }

  await Promise.all([
    bumpVersion(`site-settings/${user.id}`, env),
    invalidateNamespace(`site-settings/${user.id}`, env)
  ]);
  return ok(state, request, env);
}
