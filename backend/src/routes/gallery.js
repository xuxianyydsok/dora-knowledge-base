// 图片展览（策展元数据）接口
//
// 定位：assets 是素材仓库，gallery_items 是「展厅」——给素材加标题/说明/拍摄日期/排序/公开状态。
// 二进制始终在 R2，本表只存元数据并引用 assets.id。
//
// 权限（与全站三层模型一致）：
//   访客（未登录） 只看 owner + gallery_items.is_public=true，且关联 assets.is_public=true 的条目；
//   登录用户       仅本人数据；
//   管理员         仅本人数据（管理员有读全部权限，但写操作永远只作用于本人，见 docs/api.md Phase6）。
//
// 关键不变量（不能破坏）：
//   展览公开 ⇒ 关联素材必须公开。服务端在「创建公开条目」和「把条目改为公开」时都做校验，
//   拒绝半成功（不会出现「展览公开了、图却读不出来」）。
//
// 路由（见 router.js）：
//   GET    /api/gallery      列出（访客自动只返回公开条目）
//   POST   /api/gallery      加入展览（requireAdmin，默认 is_public=false）
//   PATCH  /api/gallery/:id  改元数据 / 公开状态（requireAdmin）
//   DELETE /api/gallery/:id  移出展览（requireAdmin，只删条目，绝不删 R2 素材）

import { ok, readJson, HttpError } from '../lib/response.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import {
  requireUuid, optionalString, optionalInt, optionalBool, optionalDateString
} from '../lib/validate.js';

const TABLE = 'gallery_items';
const ASSETS = 'assets';
// 与 assets.js 的公开字段保持一致：只取展示需要的列，绝不带 object_key / sha256
const ASSET_SELECT = 'id,public_url,width,height,mime_type,original_name,is_public';

// 把「条目 + 素材」组装成对外的安全结构（丢弃内部字段）
function shape(item, asset) {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    captured_at: item.captured_at,
    sort_order: item.sort_order,
    is_public: item.is_public,
    created_at: item.created_at,
    updated_at: item.updated_at,
    image: {
      url: asset.public_url,
      width: asset.width,
      height: asset.height,
      mime_type: asset.mime_type,
      alt: asset.original_name || item.title || ''
    }
  };
}

// 批量取素材并组装；访客在 DB 层叠加 is_public 条件，找不到的条目直接丢弃
async function decorate(db, items, { guest }) {
  const assetIds = [...new Set(items.map((i) => i.asset_id))];
  if (!assetIds.length) return [];
  const filters = { select: ASSET_SELECT, id: `in.(${assetIds.join(',')})` };
  if (guest) filters.is_public = 'eq.true';
  const assets = await db.select(ASSETS, qs(filters));
  const map = Object.fromEntries(assets.map((a) => [a.id, a]));
  return items.filter((i) => map[i.asset_id]).map((i) => shape(i, map[i.asset_id]));
}

// 读取单个素材（限定本人），返回 null 表示不存在/无权限
async function findOwnAsset(db, userId, assetId) {
  const rows = await db.select(ASSETS, qs({
    select: 'id,public_url,width,height,mime_type,original_name,is_public',
    id: `eq.${assetId}`,
    user_id: `eq.${userId}`
  }));
  return rows[0] || null;
}

// GET /api/gallery
export async function listGalleryItems(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 60, 1), 200);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

  const filters = {
    select: '*',
    user_id: `eq.${user.id}`,
    order: 'sort_order.desc,captured_at.desc.nullslast,created_at.desc',
    limit: String(limit),
    offset: String(offset)
  };
  // 访客只看公开条目：必须在查询层过滤，不能先拉全部再前端过滤
  if (user.isGuest) filters.is_public = 'eq.true';

  const items = await db.select(TABLE, qs(filters));
  const out = await decorate(db, items, { guest: !!user.isGuest });
  return ok({ items: out, count: out.length, limit, offset }, request, env);
}

// POST /api/gallery
export async function createGalleryItem(request, env) {
  const { db, user } = await requireAdmin(request, env);
  const body = await readJson(request);

  const assetId = requireUuid(body.asset_id, 'asset_id');
  const title = optionalString(body.title, 'title', { max: 200 });
  const description = optionalString(body.description, 'description', { max: 2000 });
  const capturedAt = optionalDateString(body.captured_at, 'captured_at');
  const sortOrder = optionalInt(body.sort_order, 'sort_order', { min: -10000, max: 10000 });
  const isPublic = optionalBool(body.is_public, 'is_public') ?? false;

  const asset = await findOwnAsset(db, user.id, assetId);
  if (!asset) throw new HttpError(404, '素材不存在或无权限');
  if (isPublic && asset.is_public !== true) {
    throw new HttpError(409, '该素材未公开，请先公开素材后再加入公开展览');
  }

  let row;
  try {
    const rows = await db.insert(TABLE, {
      user_id: user.id,
      asset_id: assetId,
      title: title ?? null,
      description: description ?? null,
      captured_at: capturedAt ?? null,
      sort_order: sortOrder ?? 0,
      is_public: isPublic
    });
    row = rows[0];
  } catch (err) {
    // unique(user_id, asset_id)：同一素材只能加入展览一次
    if (err?.status === 409 || /duplicate key/i.test(err?.message || '')) {
      throw new HttpError(409, '该素材已在展览中');
    }
    throw err;
  }

  return ok(shape(row, asset), request, env, 201);
}

// PATCH /api/gallery/:id
export async function updateGalleryItem(request, env, id) {
  const { db, user } = await requireAdmin(request, env);
  requireUuid(id, 'id');
  const body = await readJson(request);

  const rows = await db.select(TABLE, qs({ select: '*', id: `eq.${id}`, user_id: `eq.${user.id}` }));
  if (!rows.length) throw new HttpError(404, '展览条目不存在或无权限');
  const current = rows[0];

  // 用「字段是否存在」判断是否更新，显式传 null 表示清空该字段
  const patch = {};
  if ('title' in body) patch.title = optionalString(body.title, 'title', { max: 200 }) ?? null;
  if ('description' in body) patch.description = optionalString(body.description, 'description', { max: 2000 }) ?? null;
  if ('captured_at' in body) patch.captured_at = optionalDateString(body.captured_at, 'captured_at') ?? null;
  if ('sort_order' in body) patch.sort_order = optionalInt(body.sort_order, 'sort_order', { min: -10000, max: 10000 }) ?? 0;
  if ('is_public' in body) patch.is_public = optionalBool(body.is_public, 'is_public') ?? false;

  if (!Object.keys(patch).length) throw new HttpError(422, '没有需要更新的字段');

  // 改为公开前，确认关联素材也是公开的：保证「展览公开 ⇒ 图可读」，不产生半成功
  if (patch.is_public === true) {
    const asset = await findOwnAsset(db, user.id, current.asset_id);
    if (!asset || asset.is_public !== true) {
      throw new HttpError(409, '关联素材未公开，无法公开该展览条目');
    }
  }

  const updated = await db.update(TABLE, qs({ id: `eq.${id}`, user_id: `eq.${user.id}` }), patch);
  const asset = await findOwnAsset(db, user.id, updated[0].asset_id);
  if (!asset) throw new HttpError(404, '关联素材不存在或无权限');
  return ok(shape(updated[0], asset), request, env);
}

// DELETE /api/gallery/:id —— 只移出展览，绝不删除 R2 素材
export async function deleteGalleryItem(request, env, id) {
  const { db, user } = await requireAdmin(request, env);
  requireUuid(id, 'id');
  const rows = await db.remove(TABLE, qs({ id: `eq.${id}`, user_id: `eq.${user.id}` }));
  if (!rows.length) throw new HttpError(404, '展览条目不存在或无权限');
  return ok({ id, removed: true }, request, env);
}
