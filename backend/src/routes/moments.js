// 碎念（/moments）接口——朋友圈式的短动态流。
//
// 定位：站长**显式发布**的短动态（一段正文 + 若干图片 + 若干文件附件），按发布时间倒序。
// 它不是行为追踪：绝不自动暴露播放历史、阅读记录等私人行为，条目由站长手动维护。
//
// 权限（与全站三层模型一致，见 docs/public-access.md）：
//   访客（未登录） 只看「站长 owner 范围 + is_public=eq.true」——默认私人的碎念一律不可见；
//   登录用户       只看本人（user_id=eq.自己）；不因登录获得读他人数据的能力；
//   管理员         只看本人（写操作永远只作用于本人，见 docs/api.md Phase6）。
//
// 关键不变量（不能破坏）：
//   1. Worker 用 service_role 直连 PostgREST，RLS **不会**替它过滤，因此访客读必须
//      在查询层显式叠加 `is_public=eq.true`（见 lib/publicScope.js#momentGuestFilters）；
//   2. 响应字段走白名单，**绝不返回 user_id**，也不整行透传（始终用固定 SELECT）；
//   3. 配图只接受**本人** assets.id，且服务端逐条校验归属，避免挂上他人素材。
//
// 路由（见 router.js）：
//   GET    /api/moments      列出（访客自动只返回公开碎念）
//   POST   /api/moments      发布（requireAdmin，默认 is_public=false）
//   PATCH  /api/moments/:id  改正文 / 公开状态 / 配图（requireAdmin，仅本人）
//   DELETE /api/moments/:id  删除（requireAdmin，仅本人；只删关联，绝不删 R2 素材）

import { ok, json, readJson, HttpError } from '../lib/response.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { momentGuestFilters, MAX_MOMENT_ASSETS, MAX_MOMENT_FILES } from '../lib/publicScope.js';
import { requireUuid, requireString, optionalBool } from '../lib/validate.js';
import { cachedData, bumpVersion } from '../lib/edgeCache.js';

const TABLE = 'moments';
const LINKS = 'moment_assets';
const ASSETS = 'assets';
const FILE_LINKS = 'moment_files';
const FILES = 'files';

// 输出白名单：绝不带 user_id（访客上下文里那是站长 id，泄露等于暴露 owner 标识）
const SELECT = 'id,content,is_public,created_at,updated_at';
// 配图只取展示需要的列：不带 object_key / sha256 / original_name（内部信息）
const ASSET_SELECT = 'id,public_url,width,height,mime_type,is_public';
// 附件要展示文件名与大小（用户要看得到自己附了什么），但仍不带 object_key / sha256
const FILE_SELECT = 'id,public_url,original_name,mime_type,size,is_public';

// 正文长度上限：碎念是短动态，不鼓励写成长文（长文请用博客）
export const MAX_CONTENT = 2000;

// 组装对外的安全结构（丢弃 user_id 等内部字段）
function shape(row, images, files) {
  return {
    id: row.id,
    content: row.content,
    is_public: row.is_public,
    created_at: row.created_at,
    updated_at: row.updated_at,
    images,
    files
  };
}

// 规范化配图数组：去重、保序、限制张数、逐条校验 UUID。
// 纯函数、无 IO，供路由与离线单测共用。
export function normalizeAssetIds(value) {
  if (value === undefined) return undefined;
  if (value === null) return [];
  if (!Array.isArray(value)) throw new HttpError(422, 'asset_ids 必须是数组');
  if (value.length > MAX_MOMENT_ASSETS) {
    throw new HttpError(422, `配图最多 ${MAX_MOMENT_ASSETS} 张`);
  }
  const out = [];
  for (const raw of value) {
    const id = requireUuid(raw, 'asset_ids[]');
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

// 规范化附件 id 数组（规则同配图，上限独立）
export function normalizeFileIds(value) {
  if (value === undefined) return undefined;
  if (value === null) return [];
  if (!Array.isArray(value)) throw new HttpError(422, 'file_ids 必须是数组');
  if (value.length > MAX_MOMENT_FILES) {
    throw new HttpError(422, `附件最多 ${MAX_MOMENT_FILES} 个`);
  }
  const out = [];
  for (const raw of value) {
    const id = requireUuid(raw, 'file_ids[]');
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

// 批量取配图并组装（保持 sort_order 顺序）。
// 无论访客还是站长都**显式**按 owner 过滤 assets：Worker 用 service_role 直连，
// RLS 不会替它过滤；若只按 id 查，碎念一旦引用了他人素材就会把别人的私人图带出来。
async function decorate(db, moments, { userId, guest }) {
  if (!moments.length) return [];
  const ids = moments.map((m) => m.id);
  const [links, fileLinks] = await Promise.all([
    db.select(LINKS, qs({
      select: 'moment_id,asset_id,sort_order',
      moment_id: `in.(${ids.join(',')})`,
      user_id: `eq.${userId}`,
      order: 'sort_order.asc'
    })),
    db.select(FILE_LINKS, qs({
      select: 'moment_id,file_id,sort_order',
      moment_id: `in.(${ids.join(',')})`,
      user_id: `eq.${userId}`,
      order: 'sort_order.asc'
    }))
  ]);
  const assetIds = [...new Set(links.map((l) => l.asset_id))];
  const filters = { select: ASSET_SELECT, user_id: `eq.${userId}` };
  if (assetIds.length) filters.id = `in.(${assetIds.join(',')})`;
  if (guest) filters.is_public = 'eq.true';
  const assets = assetIds.length ? await db.select(ASSETS, qs(filters)) : [];
  const assetMap = Object.fromEntries(assets.map((a) => [a.id, a]));

  const fileIds = [...new Set(fileLinks.map((l) => l.file_id))];
  const fileFilters = { select: FILE_SELECT, user_id: `eq.${userId}` };
  if (fileIds.length) fileFilters.id = `in.(${fileIds.join(',')})`;
  if (guest) fileFilters.is_public = 'eq.true';
  const files = fileIds.length ? await db.select(FILES, qs(fileFilters)) : [];
  const fileMap = Object.fromEntries(files.map((f) => [f.id, f]));

  const byMoment = new Map();
  for (const l of links) {
    const asset = assetMap[l.asset_id];
    if (!asset) continue;   // 非本人 / 未公开 / 已删的素材直接丢弃，不泄露存在性
    if (!byMoment.has(l.moment_id)) byMoment.set(l.moment_id, []);
    byMoment.get(l.moment_id).push({
      id: asset.id,
      url: asset.public_url,
      width: asset.width,
      height: asset.height,
      mime_type: asset.mime_type
    });
  }

  const filesByMoment = new Map();
  for (const l of fileLinks) {
    const file = fileMap[l.file_id];
    if (!file) continue;    // 非本人 / 未公开 / 已删的附件直接丢弃
    if (!filesByMoment.has(l.moment_id)) filesByMoment.set(l.moment_id, []);
    filesByMoment.get(l.moment_id).push({
      id: file.id,
      url: file.public_url,
      name: file.original_name,
      mime_type: file.mime_type,
      size: file.size
    });
  }

  return moments.map((m) => shape(m, byMoment.get(m.id) || [], filesByMoment.get(m.id) || []));
}

// 校验每个 asset_id 都属于本人；返回素材行。缺失即 404（不泄露存在性）。
async function assertOwnAssets(db, userId, assetIds) {
  if (!assetIds.length) return [];
  const rows = await db.select(ASSETS, qs({
    select: 'id,is_public', user_id: `eq.${userId}`, id: `in.(${assetIds.join(',')})`
  }));
  if (rows.length !== assetIds.length) throw new HttpError(404, '配图素材不存在或无权限');
  return rows;
}

// 校验每个 file_id 都属于本人；返回附件行。缺失即 404（不泄露存在性）。
async function assertOwnFiles(db, userId, fileIds) {
  if (!fileIds.length) return [];
  const rows = await db.select(FILES, qs({
    select: 'id,is_public', user_id: `eq.${userId}`, id: `in.(${fileIds.join(',')})`
  }));
  if (rows.length !== fileIds.length) throw new HttpError(404, '附件不存在或无权限');
  return rows;
}

// 写入配图关联（先清空再插入，保证顺序与内容一致）
async function replaceLinks(db, momentId, userId, assetIds) {
  await db.remove(LINKS, qs({ moment_id: `eq.${momentId}`, user_id: `eq.${userId}` }));
  if (!assetIds.length) return;
  await db.insert(LINKS, assetIds.map((assetId, i) => ({
    moment_id: momentId, asset_id: assetId, user_id: userId, sort_order: i
  })));
}

// 同步一组附件的公开状态（只作用于本人文件，越权 id 不会命中）
async function setFilesPublic(db, userId, fileIds, isPublic) {
  if (!fileIds.length) return;
  await db.update(FILES, qs({ id: `in.(${fileIds.join(',')})`, user_id: `eq.${userId}` }), { is_public: !!isPublic });
}

// 写入附件关联（先清空再插入），并让附件的公开状态跟随碎念。
// 关键：碎念公开时附件也必须公开，否则访客能读到碎念却下不了附件（GET /api/files/:id 只放行 is_public）；
//       反过来，被移出关联的旧附件要收回公开，避免「碎念删了附件还挂在公网」。
async function replaceFileLinks(db, momentId, userId, fileIds, isPublic) {
  const old = await db.select(FILE_LINKS, qs({
    select: 'file_id', moment_id: `eq.${momentId}`, user_id: `eq.${userId}`
  }));
  await db.remove(FILE_LINKS, qs({ moment_id: `eq.${momentId}`, user_id: `eq.${userId}` }));
  if (fileIds.length) {
    await db.insert(FILE_LINKS, fileIds.map((fileId, i) => ({
      moment_id: momentId, file_id: fileId, user_id: userId, sort_order: i
    })));
  }
  await setFilesPublic(db, userId, fileIds, isPublic);
  // 本次被移出关联的旧附件：收回公开
  const removed = old.map((r) => r.file_id).filter((id) => !fileIds.includes(id));
  await setFilesPublic(db, userId, removed, false);
}

// 碎念公开状态变化但附件列表没变时，仍要把已挂载附件的公开状态同步过去
async function syncLinkedFilesPublic(db, momentId, userId, isPublic) {
  const links = await db.select(FILE_LINKS, qs({
    select: 'file_id', moment_id: `eq.${momentId}`, user_id: `eq.${userId}`
  }));
  await setFilesPublic(db, userId, links.map((l) => l.file_id), isPublic);
}

// GET /api/moments
export async function listMoments(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 30, 1), 100);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

  const filters = {
    select: SELECT,
    user_id: `eq.${user.id}`,
    order: 'created_at.desc',
    limit: String(limit),
    offset: String(offset)
  };
  // 访客只看公开碎念：必须在查询层过滤，不能先拉全部再前端过滤
  if (user.isGuest) Object.assign(filters, momentGuestFilters());

  const { data, cache } = await cachedData(request, env, {
    key: `moments/${user.id}/${limit}/${offset}`,
    ttl: 300,
    user,
    versionNs: `moments/${user.id}`,
    load: async () => {
      const rows = await db.select(TABLE, qs(filters));
      const items = await decorate(db, rows, { userId: user.id, guest: !!user.isGuest });
      return { items, count: items.length, limit, offset };
    }
  });
  return json({ data }, { headers: { 'X-List-Cache': cache } }, request, env);
}

// POST /api/moments
export async function createMoment(request, env) {
  const { db, user } = await requireAdmin(request, env);
  const body = await readJson(request);

  const content = requireString(body.content, 'content', { max: MAX_CONTENT });
  const isPublic = optionalBool(body.is_public, 'is_public') ?? false;
  const assetIds = normalizeAssetIds(body.asset_ids) ?? [];
  const fileIds = normalizeFileIds(body.file_ids) ?? [];
  await assertOwnAssets(db, user.id, assetIds);
  await assertOwnFiles(db, user.id, fileIds);

  const rows = await db.insert(TABLE, {
    user_id: user.id,        // 强制取当前用户，绝不信任请求体
    content,
    is_public: isPublic
  });
  const row = rows[0];
  try {
    await replaceLinks(db, row.id, user.id, assetIds);
    await replaceFileLinks(db, row.id, user.id, fileIds, isPublic);
  } catch (err) {
    // 配图写入失败就回滚主记录，避免留下半成品碎念
    try { await db.remove(TABLE, qs({ id: `eq.${row.id}`, user_id: `eq.${user.id}` })); } catch { /* 尽力而为 */ }
    throw err;
  }
  const [item] = await decorate(db, [row], { userId: user.id, guest: false });
  return ok(item, request, env, 201);
}

// PATCH /api/moments/:id
export async function updateMoment(request, env, id) {
  const { db, user } = await requireAdmin(request, env);
  requireUuid(id, 'id');
  const body = await readJson(request);

  // 只认本人碎念：id 且 user_id 双重限定，非本人一律 404（不泄露存在性）
  const found = await db.select(TABLE, qs({ select: SELECT, id: `eq.${id}`, user_id: `eq.${user.id}` }));
  if (!found.length) throw new HttpError(404, '碎念不存在或无权限');

  const patch = {};
  if ('content' in body) patch.content = requireString(body.content, 'content', { max: MAX_CONTENT });
  if ('is_public' in body) patch.is_public = optionalBool(body.is_public, 'is_public') ?? false;

  const assetIds = normalizeAssetIds(body.asset_ids);
  if (assetIds) await assertOwnAssets(db, user.id, assetIds);
  const fileIds = normalizeFileIds(body.file_ids);
  if (fileIds) await assertOwnFiles(db, user.id, fileIds);

  if (!Object.keys(patch).length && !assetIds && !fileIds) throw new HttpError(422, '没有需要更新的字段');

  let row = found[0];
  if (Object.keys(patch).length) {
    const updated = await db.update(TABLE, qs({ id: `eq.${id}`, user_id: `eq.${user.id}` }), patch);
    if (!updated.length) throw new HttpError(404, '碎念不存在或无权限');
    row = updated[0];
  }
  if (assetIds) await replaceLinks(db, id, user.id, assetIds);
  // 附件：列表变了就整体替换；只是公开状态变了也要把已挂附件同步过去
  if (fileIds) await replaceFileLinks(db, id, user.id, fileIds, row.is_public);
  else if ('is_public' in patch) await syncLinkedFilesPublic(db, id, user.id, row.is_public);

  const [item] = await decorate(db, [row], { userId: user.id, guest: false });
  return ok(item, request, env);
}

// DELETE /api/moments/:id —— 只删碎念与配图关联，绝不删除 R2 素材
export async function deleteMoment(request, env, id) {
  const { db, user } = await requireAdmin(request, env);
  requireUuid(id, 'id');
  const rows = await db.remove(TABLE, qs({ id: `eq.${id}`, user_id: `eq.${user.id}` }));
  if (!rows.length) throw new HttpError(404, '碎念不存在或无权限');
  return ok({ id, removed: true }, request, env);
}
