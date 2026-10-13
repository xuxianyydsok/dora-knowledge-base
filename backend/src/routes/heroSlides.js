// 首页轮播（Hero）素材管理 —— 管理员配置首页那几张轮播图 / 视频。
//
// 背景（2026-10-13 用户原话）：
//   「首页它不是有那些图片吗？我想实现能够在管理员端上传图片，或者说一些视频
//    来进行轮播图的替换」
//   「存在数据库里吧，就新建一个数据库表」「可以复用图展的素材」
//   「视频的话要静音循环。当然，可以开启个开关，就是可以静音也可以播放那个音乐」
//   「体积的话暂时不限制吧」
//
// 设计（重要）：**本表只存引用，不存文件**。
//   素材来源是图展已有的两套：
//     · source='asset'     → 引用 assets 表（静态图片）
//     · source='wallpaper' → 引用 wallpapers 表（动态壁纸视频）
//   R2 对象仍归图展那两张表管；删图展素材时本表引用由外键 cascade 自动清掉，
//   不会出现「首页挂着一条指向已删对象的死引用」。
//
// 为什么不重复存文件：图展已有完整的上传 + 策展流程，首页只是「挑几张出来展示」。
//   复制文件会导致「同一张图存两遍」「删了图展首页还挂着破图」。
//
// 路由（见 router.js）：
//   GET    /api/hero/slides         列出首页轮播（访客只看到 is_active=true 的）
//   POST   /api/hero/slides         新增一条引用（requireAdmin）
//   PATCH  /api/hero/slides/:id     改图注 / 排序 / 启用 / 静音（requireAdmin）
//   DELETE /api/hero/slides/:id     移除一条引用（requireAdmin，不删素材本身）
//   PUT    /api/hero/slides/order   批量重排（requireAdmin，拖拽后一次性保存）
//
// 安全：所有写操作 requireAdmin；访客只读且只看启用项。

import { ok, readJson, HttpError } from '../lib/response.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { requireUuid, optionalString, optionalBool, optionalInt } from '../lib/validate.js';

const TABLE = 'hero_slides';

// 对外字段：把内部 id 与引用换成前端能直接用的结构
function shape(row, { asset, wallpaper } = {}) {
  const src = row.source === 'wallpaper' ? wallpaper : asset;
  return {
    id: row.id,
    source: row.source,
    label: row.label || '',
    sort_order: row.sort_order,
    is_active: row.is_active,
    muted: row.muted,
    // 统一给一个 media_url + media_type，前端不用管底层是图还是视频
    media_url: src?.url || null,
    media_type: row.source === 'wallpaper' ? 'video' : 'image',
    // 底层素材是否对访客可见。**视频素材（动态壁纸）默认私人**，
    // 如果站长把一段私人视频加进首页轮播，访客拿到 media_url 也播不出来
    // （/api/wallpapers/:id/file 会拒绝），因此要把这个状态透出给管理端提示。
    media_public: src ? src.isPublic !== false : null,
    // 视频补充信息（前端用来决定要不要显示静音开关、以及预加载策略）
    duration: row.source === 'wallpaper' ? (src?.duration ?? null) : null,
    width: src?.width ?? null,
    height: src?.height ?? null,
    // 原始素材信息（管理端要显示「这张图来自图展的哪个素材」）
    asset_id: row.asset_id,
    wallpaper_id: row.wallpaper_id,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// 批量取出引用到的素材，避免 N+1 查询
async function loadRefs(db, rows) {
  const assetIds = [...new Set(rows.filter((r) => r.source === 'asset' && r.asset_id).map((r) => r.asset_id))];
  const wallIds = [...new Set(rows.filter((r) => r.source === 'wallpaper' && r.wallpaper_id).map((r) => r.wallpaper_id))];

  const [assets, walls] = await Promise.all([
    assetIds.length
      ? db.select('assets', qs({ select: 'id,public_url,width,height,original_name,is_public', id: `in.(${assetIds.join(',')})` }))
      : [],
    wallIds.length
      ? db.select('wallpapers', qs({ select: 'id,public_url,width,height,duration,original_name,is_public', id: `in.(${wallIds.join(',')})` }))
      : []
  ]);
  const assetMap = new Map(assets.map((a) => [a.id, {
    url: a.public_url, width: a.width, height: a.height, name: a.original_name,
    isPublic: a.is_public !== false
  }]));
  const wallMap = new Map(walls.map((w) => [w.id, {
    url: w.public_url, width: w.width, height: w.height,
    duration: w.duration == null ? null : Number(w.duration), name: w.original_name,
    isPublic: w.is_public === true
  }]));
  return { assetMap, wallMap };
}

// ---------------------------------------------------------------
// GET /api/hero/slides —— 列出（访客只看到启用项）
// ---------------------------------------------------------------
export async function listHeroSlides(request, env) {
  const { db, user } = await requireAuth(request, env);

  const filters = {
    select: '*',
    user_id: `eq.${user.id}`,
    order: 'sort_order.asc,created_at.asc',
    limit: '100'
  };
  // 访客只读启用项：Worker 用 service_role 直连 PostgREST，RLS 不替它过滤，
  // 必须在查询层显式带上（与 gallery / wallpapers 同一套做法）。
  if (user.isGuest) filters.is_active = 'eq.true';

  const rows = await db.select(TABLE, qs(filters));
  const { assetMap, wallMap } = await loadRefs(db, rows);
  const items = rows.map((r) => shape(r, {
    asset: assetMap.get(r.asset_id),
    wallpaper: wallMap.get(r.wallpaper_id)
  }))
    .filter((s) => s.media_url)   // 素材被删掉的残引用直接跳过（外键已 cascade，这是兜底）
    // 访客只看到「底层素材也对外可见」的项：私人视频即便挂在首页也播不出来
    // （/api/wallpapers/:id/file 会拒绝），留一条空轮播比少一条更糟。
    // 站长本人始终能看到全部，便于在后台发现自己忘了公开素材。
    .filter((s) => user.isAdmin || s.media_public);

  return ok({ items, count: items.length }, request, env);
}

// ---------------------------------------------------------------
// POST /api/hero/slides —— 新增一条（把图展素材加入首页轮播）
// ---------------------------------------------------------------
export async function createHeroSlide(request, env) {
  const { db, user } = await requireAdmin(request, env);
  const body = await readJson(request);

  const source = optionalString(body.source, 'source', { max: 20 });
  if (source !== 'asset' && source !== 'wallpaper') {
    throw new HttpError(422, 'source 只能是 asset（图片）或 wallpaper（视频）');
  }
  const refId = source === 'asset'
    ? requireUuid(body.asset_id, 'asset_id')
    : requireUuid(body.wallpaper_id, 'wallpaper_id');

  // 校验素材存在且属于本人（避免引用别人的素材）
  const table = source === 'asset' ? 'assets' : 'wallpapers';
  const rows = await db.select(table, qs({ select: 'id', id: `eq.${refId}`, user_id: `eq.${user.id}` }));
  if (!rows.length) throw new HttpError(404, '素材不存在或不属于你');

  // 去重：同一素材不重复加入（否则首页会出现两张一模一样的图）
  const exist = await db.select(TABLE, qs({
    select: 'id',
    user_id: `eq.${user.id}`,
    [source === 'asset' ? 'asset_id' : 'wallpaper_id']: `eq.${refId}`
  }));
  if (exist.length) throw new HttpError(409, '这个素材已经在首页轮播里了');

  // 排在最后
  const all = await db.select(TABLE, qs({ select: 'sort_order', user_id: `eq.${user.id}`, order: 'sort_order.desc', limit: '1' }));
  const nextOrder = all.length ? (Number(all[0].sort_order) || 0) + 1 : 0;

  const inserted = await db.insert(TABLE, {
    user_id: user.id,
    source,
    asset_id: source === 'asset' ? refId : null,
    wallpaper_id: source === 'wallpaper' ? refId : null,
    label: optionalString(body.label, 'label', { max: 80 }) ?? null,
    sort_order: nextOrder,
    is_active: body.is_active === undefined ? true : !!body.is_active,
    // 视频默认静音：浏览器只允许「静音视频」自动播放，
    // 不静音的话首页那段视频不会自动播（用户要求「静音循环 + 可开关」）。
    muted: body.muted === undefined ? true : !!body.muted
  });

  const { assetMap, wallMap } = await loadRefs(db, inserted);
  return ok(shape(inserted[0], {
    asset: assetMap.get(inserted[0].asset_id),
    wallpaper: wallMap.get(inserted[0].wallpaper_id)
  }), request, env, 201);
}

// ---------------------------------------------------------------
// PATCH /api/hero/slides/:id —— 改图注 / 启用 / 静音
// ---------------------------------------------------------------
export async function updateHeroSlide(request, env, id) {
  const { db, user } = await requireAdmin(request, env);
  requireUuid(id, 'id');
  const body = await readJson(request);

  const patch = {};
  if (body.label !== undefined) patch.label = optionalString(body.label, 'label', { max: 80 }) ?? null;
  if (body.is_active !== undefined) patch.is_active = optionalBool(body.is_active, 'is_active');
  if (body.muted !== undefined) patch.muted = optionalBool(body.muted, 'muted');
  if (body.sort_order !== undefined) patch.sort_order = optionalInt(body.sort_order, 'sort_order', { min: 0 }) ?? 0;

  if (!Object.keys(patch).length) throw new HttpError(422, '没有要修改的字段');

  const rows = await db.update(TABLE, qs({ id: `eq.${id}`, user_id: `eq.${user.id}` }), patch);
  if (!rows.length) throw new HttpError(404, '轮播项不存在');
  const { assetMap, wallMap } = await loadRefs(db, rows);
  return ok(shape(rows[0], {
    asset: assetMap.get(rows[0].asset_id),
    wallpaper: wallMap.get(rows[0].wallpaper_id)
  }), request, env);
}

// ---------------------------------------------------------------
// DELETE /api/hero/slides/:id —— 移除引用（不删图展里的素材本身）
// ---------------------------------------------------------------
export async function deleteHeroSlide(request, env, id) {
  const { db, user } = await requireAdmin(request, env);
  requireUuid(id, 'id');
  const rows = await db.remove(TABLE, qs({ id: `eq.${id}`, user_id: `eq.${user.id}` }));
  if (!rows.length) throw new HttpError(404, '轮播项不存在');
  return ok({ id, removed: true }, request, env);
}

// ---------------------------------------------------------------
// PUT /api/hero/slides/order —— 批量重排（管理端拖拽 / 上下移动后保存）
// ---------------------------------------------------------------
export async function reorderHeroSlides(request, env) {
  const { db, user } = await requireAdmin(request, env);
  const body = await readJson(request);
  const ids = Array.isArray(body.ids) ? body.ids : null;
  if (!ids || !ids.length) throw new HttpError(422, '缺少 ids 数组');
  if (ids.length > 100) throw new HttpError(422, '一次最多重排 100 项');

  // 逐条更新 sort_order = 数组下标。用 allSettled 而不是 Promise.all：
  // 个别 id 不属于本人时会失败，但不该让整次重排崩掉。
  const results = await Promise.allSettled(ids.map((sid, i) => {
    requireUuid(sid, 'ids[]');
    return db.update(TABLE, qs({ id: `eq.${sid}`, user_id: `eq.${user.id}` }), { sort_order: i });
  }));
  const failed = results.filter((r) => r.status === 'rejected').length;
  return ok({ updated: ids.length - failed, failed }, request, env);
}
