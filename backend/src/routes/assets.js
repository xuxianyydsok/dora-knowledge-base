// 图片素材（R2）接口
//
// 设计要点（主代理已定）：
//   1. 公开读取用 assets 表的 id（uuid），而不是 R2 object key：
//      URL 干净、无 %2F 编码风险，且天然满足「只能读表里存在的记录」，
//      不会把 R2 变成任意 key 探测器。
//   2. object key 完全由服务端生成：assets/<user_id>/<YYYY>/<uuid>.<ext>，
//      用户提供的文件名只作展示，绝不参与 key，杜绝目录穿越/注入。
//   3. public_url = <请求 origin>/api/assets/<id>，上传时按当次请求 origin 计算并入库。
//      前端 posts.cover_path 直接存这个绝对地址，<img src> 可直接使用。
//
// 路由（见 router.js）：
//   POST   /api/assets      上传（requireAdmin，multipart/form-data，字段 file）
//   GET    /api/assets      列出素材（requireAdmin，分页）
//   GET    /api/assets/:id  按 id 返回图片字节（完全公开，不鉴权）
//   DELETE /api/assets/:id  删除（requireAdmin，被文章引用时返回 409）

import { ok, fail, HttpError } from '../lib/response.js';
import { requireAdmin } from '../middleware/auth.js';
import { SupabaseClient, qs, escapeLike } from '../lib/supabase.js';
import { requireUuid } from '../lib/validate.js';
import {
  resolveImageType, imageDimensions, sanitizeFilename, buildObjectKey,
  sha256Hex, isWithinLimit, MAX_IMAGE_BYTES
} from '../lib/imageType.js';

const TABLE = 'assets';

// 后端兜底公开域名：仅用于 MCP 上传（拿不到请求 origin 时）。
// 绝不写进前端或 migration。
const FALLBACK_PUBLIC_BASE = 'https://api.xuguochen.de5.net';

// ---------------------------------------------------------------
// 核心落库逻辑（REST 上传与 MCP upload_image 共用，禁止复制校验逻辑）
// ---------------------------------------------------------------
// 返回：assets 表插入后的完整行
export async function storeImage(env, db, user, { bytes, filename, contentType, origin } = {}) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  // 1) 大小上限（先看长度快速拒绝）
  if (!isWithinLimit(data.byteLength)) {
    throw new HttpError(413, `图片过大，单张上限 ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB`);
  }

  // 2) 魔数 + MIME 一致性校验（不信任 Content-Type / 扩展名）
  const type = resolveImageType(data, contentType);
  if (!type) {
    throw new HttpError(415, '仅支持 JPEG / PNG / WebP / AVIF，且文件内容与声明类型需一致');
  }

  // 3) 服务端生成 object key（不含用户输入）
  const objectKey = buildObjectKey(user.id, type.ext);

  // 4) 元数据（尺寸解析失败不影响上传）
  const [sha256, dimensions] = await Promise.all([
    sha256Hex(data),
    Promise.resolve(imageDimensions(data, type.mime))
  ]);

  // 5) 写入 R2
  if (!env.R2_BUCKET) throw new HttpError(503, '存储未配置（缺少 R2_BUCKET 绑定）');
  try {
    await env.R2_BUCKET.put(objectKey, data, {
      httpMetadata: { contentType: type.mime }
    });
  } catch (err) {
    console.error('R2 put 失败:', objectKey, err?.message || err);
    throw new HttpError(502, '图片写入存储失败，请稍后重试');
  }

  // 6) 入库（service_role 直连；user_id 显式带上，保证隔离）
  //    若入库/回填失败，R2 对象会变成孤儿，需补偿删除。
  let row;
  try {
    const rows = await db.insert(TABLE, {
      user_id: user.id,
      object_key: objectKey,
      // public_url 先占位，插入拿到 id 后再回填（保证 URL 用表主键）
      public_url: `${origin}/api/assets/pending`,
      original_name: sanitizeFilename(filename, type.ext),
      mime_type: type.mime,
      size: data.byteLength,
      width: dimensions.width,
      height: dimensions.height,
      sha256,
      is_public: true
    });
    row = rows[0];

    // 回填真实 public_url
    const publicUrl = `${origin}/api/assets/${row.id}`;
    await db.update(TABLE, qs({ id: `eq.${row.id}`, user_id: `eq.${user.id}` }), { public_url: publicUrl });
    row = { ...row, public_url: publicUrl };
  } catch (err) {
    // 补偿删除，避免孤儿对象（存储泄漏）
    try {
      await env.R2_BUCKET.delete(objectKey);
    } catch (cleanupErr) {
      // 补偿删除自身失败只记录，不掩盖原始错误
      console.error('assets 落库失败后补偿删除 R2 失败:', objectKey, cleanupErr?.message || cleanupErr);
    }
    throw err;
  }

  console.log(`assets 上传: id=${row.id} key=${objectKey} size=${data.byteLength} mime=${type.mime}`);
  return row;
}

// 解析请求 origin（优先 X-Forwarded-Proto + Host，回退 request.url）
function requestOrigin(request, env) {
  try {
    const u = new URL(request.url);
    return u.origin;
  } catch {
    return env.ASSET_PUBLIC_BASE || FALLBACK_PUBLIC_BASE;
  }
}

// ---------------------------------------------------------------
// POST /api/assets —— 上传
// ---------------------------------------------------------------
export async function uploadAsset(request, env) {
  const { db, user } = await requireAdmin(request, env);

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    throw new HttpError(415, '上传必须使用 multipart/form-data，字段名 file');
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    throw new HttpError(400, '无法解析上传表单');
  }
  const file = form.get('file');
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    throw new HttpError(422, '缺少上传文件字段 file');
  }

  // 先按 file.size 快速拒绝超大文件，避免把 10MB+ 读进内存
  if (!isWithinLimit(file.size)) {
    throw new HttpError(413, `图片过大，单张上限 ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  // 复核实际长度（file.size 可能被伪造）
  if (!isWithinLimit(bytes.byteLength)) {
    throw new HttpError(413, `图片过大，单张上限 ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB`);
  }

  const row = await storeImage(env, db, user, {
    bytes,
    filename: file.name,
    contentType: file.type,
    origin: requestOrigin(request, env)
  });
  return ok(row, request, env, 201);
}

// ---------------------------------------------------------------
// GET /api/assets —— 列出（分页）
// ---------------------------------------------------------------
export async function listAssets(request, env) {
  const { db, user } = await requireAdmin(request, env);
  const url = new URL(request.url);

  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 24, 1), 100);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

  const rows = await db.select(TABLE, qs({
    select: 'id,public_url,original_name,mime_type,size,width,height,created_at',
    user_id: `eq.${user.id}`,
    order: 'created_at.desc',
    limit: String(limit),
    offset: String(offset)
  }));
  return ok({ items: rows, count: rows.length, limit, offset }, request, env);
}

// ---------------------------------------------------------------
// GET /api/assets/:id —— 公开读取图片字节（不鉴权）
// ---------------------------------------------------------------
export async function getAsset(request, env, id) {
  requireUuid(id, 'id');
  const db = new SupabaseClient(env);

  const rows = await db.select(TABLE, qs({
    select: 'id,object_key,mime_type,sha256,is_public',
    id: `eq.${id}`,
    is_public: 'eq.true'
  }));
  if (!rows.length) throw new HttpError(404, '图片不存在');
  const asset = rows[0];

  if (!env.R2_BUCKET) throw new HttpError(503, '存储未配置');
  const object = await env.R2_BUCKET.get(asset.object_key);
  if (!object) throw new HttpError(404, '图片文件缺失');

  const etag = object.httpEtag || `"${asset.sha256 || asset.id}"`;
  return new Response(object.body, {
    headers: {
      'Content-Type': asset.mime_type,
      ETag: etag,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

// ---------------------------------------------------------------
// DELETE /api/assets/:id —— 删除（被引用时 409）
// ---------------------------------------------------------------
export async function deleteAsset(request, env, id) {
  const { db, user } = await requireAdmin(request, env);
  requireUuid(id, 'id');

  // 确认素材归属本人
  const rows = await db.select(TABLE, qs({
    select: 'id,object_key,public_url',
    id: `eq.${id}`,
    user_id: `eq.${user.id}`
  }));
  if (!rows.length) throw new HttpError(404, '素材不存在或无权限');
  const asset = rows[0];

  const referenced = await findReferences(db, user.id, asset);
  if (referenced.length) {
    return fail(
      `该图片正被 ${referenced.length} 篇文章引用，请先解除引用`,
      409, request, env,
      { referenced_by: referenced }
    );
  }

  // 先删 R2，再删表；R2 失败要抛出可读错误，不静默吞掉
  if (!env.R2_BUCKET) throw new HttpError(503, '存储未配置');
  try {
    await env.R2_BUCKET.delete(asset.object_key);
  } catch (err) {
    console.error('R2 delete 失败:', asset.object_key, err?.message || err);
    throw new HttpError(502, '删除存储对象失败，请稍后重试');
  }

  await db.remove(TABLE, qs({ id: `eq.${id}`, user_id: `eq.${user.id}` }));
  console.log(`assets 删除: id=${id} key=${asset.object_key}`);
  return ok({ id, deleted: true }, request, env);
}

// 在本人文章范围内查找引用该素材的文章（cover_path 精确匹配 / content 包含）
async function findReferences(db, userId, asset) {
  const refs = new Map();
  const collect = (rows) => {
    for (const r of rows || []) if (!refs.has(r.id)) refs.set(r.id, { id: r.id, title: r.title });
  };

  // 1) cover_path 精确等于 public_url 或 object_key
  collect(await db.select('posts', qs({
    select: 'id,title', user_id: `eq.${userId}`, cover_path: `eq.${asset.public_url}`, limit: '20'
  })));
  collect(await db.select('posts', qs({
    select: 'id,title', user_id: `eq.${userId}`, cover_path: `eq.${asset.object_key}`, limit: '20'
  })));

  // 2) content 里包含 public_url 或 object_key（模糊匹配，只取 id/title，限制条数）
  const urlLike = escapeLike(asset.public_url);
  const keyLike = escapeLike(asset.object_key);
  collect(await db.select('posts', qs({
    select: 'id,title', user_id: `eq.${userId}`, content: `ilike.*${urlLike}*`, limit: '20'
  })));
  collect(await db.select('posts', qs({
    select: 'id,title', user_id: `eq.${userId}`, content: `ilike.*${keyLike}*`, limit: '20'
  })));

  return [...refs.values()];
}

// 供 MCP upload_image 复用的公开 base（拿不到请求 origin 时的兜底）
export function fallbackPublicBase(env) {
  return env.ASSET_PUBLIC_BASE || FALLBACK_PUBLIC_BASE;
}
