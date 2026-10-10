// 公开时间轴（人生轨迹 / 档案线）
//
// 定位：把「已发布公开博客 + 公开资源 + 公开展览」聚合成一条公开内容时间线。
// 它不是行为追踪，也不是审计日志——只读公开内容，且每条都必须在数据库查询阶段过滤。
//
// 权限（与 docs/public-access.md 三层模型一致）：
//   访客（未登录） owner 范围 + posts 已发布且公开 / resources 公开 / gallery 公开；
//   登录用户 / 管理员 同样只看「公开」内容（时间轴是公开页），私有内容不进这条线。
//
// 关键约束：Worker 用 service_role 直连 PostgREST，RLS 不会替它过滤，
// 所以三类查询都必须显式叠加公开条件（见下面各 filters）。
//
// 分页策略（详见 docs/gallery-timeline.md）：时间轴是**倒序**（新 → 旧），
// 「下一页」= 更早的内容，所以 DB 粗过滤用 `lte.`（小于等于游标），
// 再交给 timelineMerge 用复合游标做精确过滤（不会重复、不会跳条）。
// 每类多取 limit*4+10 条，抵消同日多条被精确层过滤掉的情况。

import { ok } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { mergeTimeline, TIMELINE_MAX_LIMIT } from '../lib/timelineMerge.js';

// 游标格式 `<ISO 时间>|<id>`。粗过滤只取「时间」部分，精确的「是否在游标之后」
// 交给 mergeTimeline 判断；粗过滤必须**放宽**（多取）而不是收紧，否则会漏条。
//
// 方向很重要：时间轴是**倒序**（新 → 旧），「下一页」= 更早的内容 = 日期 **小于等于** 游标，
// 所以粗过滤用 `lte.`。若写成 `gte.`，跨过游标日期后下一页会直接为空。
export function cursorTime(before) {
  if (typeof before !== 'string' || !before) return null;
  const raw = before.split('|')[0];
  return Number.isFinite(new Date(raw).getTime()) ? new Date(raw).toISOString() : null;
}

// 日期列（date 类型）只比到「日」，避免 date 与 timestamptz 比较时的时区偏差
export function cursorDay(before) {
  const iso = cursorTime(before);
  return iso ? iso.slice(0, 10) : null;
}

// 取「已发布 + 公开」的博客。
// 展示日期是 published_at（缺失回退 created_at），因此粗过滤要同时覆盖两种行：
//   published_at <= 游标  或  (published_at 为空 且 created_at <= 游标)
export function postFilters(user, before, perSource) {
  const filters = {
    select: 'id,title,excerpt,cover_path,published_at,created_at',
    user_id: `eq.${user.id}`,
    status: 'eq.published',
    is_public: 'eq.true',
    order: 'published_at.desc.nullslast',
    limit: String(perSource)
  };
  const ts = cursorTime(before);
  if (ts) filters.or = `(published_at.lte.${ts},and(published_at.is.null,created_at.lte.${ts}))`;
  return filters;
}

// 取公开资源；video 页已删除，不进时间轴。展示日期固定是 created_at，单列即可。
export function resourceFilters(user, before, perSource) {
  const filters = {
    select: 'id,type,title,summary,url,cover_path,created_at',
    user_id: `eq.${user.id}`,
    is_public: 'eq.true',
    type: 'in.(github,music,movie)',
    order: 'created_at.desc',
    limit: String(perSource)
  };
  const ts = cursorTime(before);
  if (ts) filters.created_at = `lte.${ts}`;
  return filters;
}

// 取公开展览条目。展示日期是 captured_at（缺失回退 created_at），因此**不能**只按
// created_at 过滤：否则「今天加入、但拍摄日期很早」的图会被错误排除。
//   captured_at <= 游标日  或  (captured_at 为空 且 created_at <= 游标时刻)
export function galleryFilters(user, before, perSource) {
  const filters = {
    select: 'id,title,description,captured_at,created_at,asset_id',
    user_id: `eq.${user.id}`,
    is_public: 'eq.true',
    order: 'captured_at.desc.nullslast,created_at.desc',
    limit: String(perSource)
  };
  const ts = cursorTime(before);
  const day = cursorDay(before);
  if (ts) filters.or = `(captured_at.lte.${day},and(captured_at.is.null,created_at.lte.${ts}))`;
  return filters;
}

// GET /api/timeline?limit=20&before=<ISO>
export async function listTimeline(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);

  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 20, 1), TIMELINE_MAX_LIMIT);
  const before = url.searchParams.get('before');
  // 粗过滤交给各 buildXFilters 处理（方向已修正为倒序 lte）
  // 多取若干条：同一天（尤其展览 captured_at 是日精度）可能有多条被 mergeTimeline 过滤掉，
  // 取 limit*4+10 保证过滤后仍够一页，避免「某页只剩一两条」。
  const perSource = limit * 4 + 10;

  const [posts, resources, galleryItems] = await Promise.all([
    db.select('posts', qs(postFilters(user, before, perSource))),
    db.select('resources', qs(resourceFilters(user, before, perSource))),
    db.select('gallery_items', qs(galleryFilters(user, before, perSource)))
  ]);

  // 展览条目的封面来自素材：必须按 owner + is_public 过滤（Worker 用 service_role，
  // RLS 不会替它过滤；时间轴是公开页，绝不能让他人私人素材的 URL 出现在这里）。
  let gallery = [];
  if (galleryItems.length) {
    const assetIds = [...new Set(galleryItems.map((g) => g.asset_id))];
    const assets = await db.select('assets', qs({
      select: 'id,public_url',
      id: `in.(${assetIds.join(',')})`,
      user_id: `eq.${user.id}`,
      is_public: 'eq.true'
    }));
    const assetMap = Object.fromEntries(assets.map((a) => [a.id, a]));
    gallery = galleryItems
      .filter((g) => assetMap[g.asset_id])
      .map((g) => ({ ...g, cover: assetMap[g.asset_id].public_url }));
  }

  const result = mergeTimeline({ posts, resources, gallery }, { limit, before });
  return ok(result, request, env);
}
