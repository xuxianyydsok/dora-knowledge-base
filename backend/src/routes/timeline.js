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
// 已知限制（详见 docs/gallery-timeline.md）：三类表日期列不同，
// 分页游标统一用 date，但每类只按各自排序主列做 before 过滤；每源多取一条，
// 极端情况下某一源可能漏掉极少量老条目（近似分页，可接受）。

import { ok } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { mergeTimeline, TIMELINE_MAX_LIMIT } from '../lib/timelineMerge.js';

// 取「已发布 + 公开」的博客
function postFilters(user, before, perSource) {
  const filters = {
    select: 'id,title,excerpt,cover_path,published_at,created_at',
    user_id: `eq.${user.id}`,
    status: 'eq.published',
    is_public: 'eq.true',
    order: 'published_at.desc',
    limit: String(perSource)
  };
  if (before) filters.published_at = `lt.${before}`;
  return filters;
}

// 取公开资源；video 页已删除，不进时间轴
function resourceFilters(user, before, perSource) {
  const filters = {
    select: 'id,type,title,summary,url,cover_path,created_at',
    user_id: `eq.${user.id}`,
    is_public: 'eq.true',
    type: 'in.(github,music,movie)',
    order: 'created_at.desc',
    limit: String(perSource)
  };
  if (before) filters.created_at = `lt.${before}`;
  return filters;
}

// 取公开展览条目；只按 created_at 过滤（captured_at 只用于展示排序，见文件头说明）
function galleryFilters(user, before, perSource) {
  const filters = {
    select: 'id,title,description,captured_at,created_at,asset_id',
    user_id: `eq.${user.id}`,
    is_public: 'eq.true',
    order: 'captured_at.desc.nullslast,created_at.desc',
    limit: String(perSource)
  };
  if (before) filters.created_at = `lt.${before}`;
  return filters;
}

// GET /api/timeline?limit=20&before=<ISO>
export async function listTimeline(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);

  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 20, 1), TIMELINE_MAX_LIMIT);
  const before = url.searchParams.get('before');
  const perSource = limit + 1;   // 多取一条，用于判断是否还有下一页

  const [posts, resources, galleryItems] = await Promise.all([
    db.select('posts', qs(postFilters(user, before, perSource))),
    db.select('resources', qs(resourceFilters(user, before, perSource))),
    db.select('gallery_items', qs(galleryFilters(user, before, perSource)))
  ]);

  // 展览条目的封面来自素材：只在 DB 层取公开素材，查不到的条目直接丢弃
  let gallery = [];
  if (galleryItems.length) {
    const assetIds = [...new Set(galleryItems.map((g) => g.asset_id))];
    const assets = await db.select('assets', qs({
      select: 'id,public_url,is_public',
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
