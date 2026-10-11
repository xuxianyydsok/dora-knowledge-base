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

// 取公开资源。2026-10-11 起：**音乐 / 影视不再按入库时间进时间轴**
// （用户要求这两类改为「观看历史」，见 progressFilters）；这里只取 github。
// video 页已删除，不进时间轴。展示日期固定是 created_at，单列即可。
export function resourceFilters(user, before, perSource) {
  const filters = {
    select: 'id,type,title,summary,url,cover_path,created_at',
    user_id: `eq.${user.id}`,
    is_public: 'eq.true',
    type: 'eq.github',
    order: 'created_at.desc',
    limit: String(perSource)
  };
  const ts = cursorTime(before);
  if (ts) filters.created_at = `lte.${ts}`;
  return filters;
}

// 取「观看 / 收听历史」：user_progress 里属于公开音乐 / 影视的记录，按观看时间倒序。
// 粗过滤按 updated_at（观看时间）—— 这正是排序键，方向与其它来源一致（倒序 → lte）。
export function progressFilters(user, before, perSource) {
  const filters = {
    select: 'resource_id,position,duration,progress,completed,updated_at',
    user_id: `eq.${user.id}`,
    order: 'updated_at.desc',
    limit: String(perSource)
  };
  const ts = cursorTime(before);
  if (ts) filters.updated_at = `lte.${ts}`;
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

// 取公开图书（2026-10-11 用户要求：图书进时间轴）。
// 展示日期固定是 created_at（上架时间），单列即可；封面用上传时自动提取的 cover_url。
export function bookFilters(user, before, perSource) {
  const filters = {
    select: 'id,title,author,format,cover_url,original_name,created_at',
    user_id: `eq.${user.id}`,
    is_public: 'eq.true',
    order: 'created_at.desc',
    limit: String(perSource)
  };
  const ts = cursorTime(before);
  if (ts) filters.created_at = `lte.${ts}`;
  return filters;
}

// 允许按类型单独取。前端「博客 / GitHub / 图片 / 音乐 / 影视」各标签各查各的，
// 避免某一类（尤其 GitHub 一次同步上千条、时间戳全相同）把其它类挤到几十页之后。
// 单类型 → 只查那一张表（顺带快很多）；不给 type → 仍按旧的「全部合并」行为。
const SINGLE_TYPES = new Set(['post', 'github', 'gallery', 'music', 'movie', 'book']);

// GET /api/timeline?limit=20&before=<ISO>&type=post
export async function listTimeline(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);

  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 20, 1), TIMELINE_MAX_LIMIT);
  const before = url.searchParams.get('before');
  const typeParam = url.searchParams.get('type');
  const type = SINGLE_TYPES.has(typeParam) ? typeParam : null;
  // 粗过滤交给各 buildXFilters 处理（方向已修正为倒序 lte）
  // 多取若干条：同一天（尤其展览 captured_at 是日精度）可能有多条被 mergeTimeline 过滤掉，
  // 取 limit*4+10 保证过滤后仍够一页，避免「某页只剩一两条」。
  const perSource = limit * 4 + 10;

  // 单类型只查一张表；不指定类型时才四路并发（旧的「全部」行为，保留给其它调用方）
  const wantPost = !type || type === 'post';
  const wantRepo = !type || type === 'github';
  const wantGallery = !type || type === 'gallery';
  const wantProgress = !type || type === 'music' || type === 'movie';
  const wantBook = !type || type === 'book';

  const [posts, resources, galleryItems, progressRows, bookRows] = await Promise.all([
    wantPost ? db.select('posts', qs(postFilters(user, before, perSource))) : [],
    wantRepo ? db.select('resources', qs(resourceFilters(user, before, perSource))) : [],
    wantGallery ? db.select('gallery_items', qs(galleryFilters(user, before, perSource))) : [],
    wantProgress ? db.select('user_progress', qs(progressFilters(user, before, perSource))) : [],
    wantBook ? db.select('books', qs(bookFilters(user, before, perSource))) : []
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

  // 观看历史：只保留「音乐 / 影视」，且该资源要么公开、要么是**站长收藏**
  //（站长收藏对所有人可见可播，见 routes/favorites.js 的 listAdminFavorites）。
  // 其余私人资源一律不带出 —— 时间轴是公开页。
  let progress = [];
  if (progressRows.length) {
    const ids = [...new Set(progressRows.map((p) => p.resource_id))];
    const [res, adminFavs] = await Promise.all([
      db.select('resources', qs({
        select: 'id,type,title,cover_path,is_public',
        id: `in.(${ids.join(',')})`,
        user_id: `eq.${user.id}`,
        type: 'in.(music,movie)'
      })),
      db.select('favorites', qs({
        select: 'resource_id', user_id: `eq.${user.id}`, resource_id: 'not.is.null'
      }))
    ]);
    const adminFavSet = new Set(adminFavs.map((f) => f.resource_id));
    const visible = res.filter((r) => r.is_public === true || adminFavSet.has(r.id));
    const map = Object.fromEntries(visible.map((r) => [r.id, r]));
    progress = progressRows
      .filter((p) => map[p.resource_id])
      .map((p) => ({ ...p, ...map[p.resource_id] }));
  }

  // 单类型时把白名单交给 mergeTimeline：万一某张表里混进了别的类型，也不会串味。
  const result = mergeTimeline({ posts, resources, gallery, progress, books: bookRows },
    { limit, before, types: type ? [type] : null });
  return ok(result, request, env);
}
