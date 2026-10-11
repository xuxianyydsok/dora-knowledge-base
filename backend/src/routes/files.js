// 文档附件（R2）接口 —— 碎念用。
//
// 与 assets 的分工：
//   assets = 图片素材（图片展 / 博客封面 / 碎念配图），有宽高，前端当图用；
//   files  = 文档附件（PDF / Word / Excel / PPT / 文本），前端当文件下载 / 预览用。
// 分成两张表是刻意的：图片展与博客封面只认 assets，混入 PDF 会破坏缩略图逻辑。
//
// 路由（见 router.js）：
//   POST   /api/files      上传（requireAdmin，multipart/form-data，字段 file）
//   GET    /api/files      列出本人附件（requireAdmin，分页）
//   GET    /api/files/:id  按 id 返回文件字节（公开可读，但**只对 is_public=true**）
//   DELETE /api/files/:id  删除（requireAdmin，被碎念引用时返回 409）
//
// 安全：object key 由服务端生成（files/<user_id>/<年>/<uuid>.<ext>），用户文件名只作展示；
//       GET 只认 is_public=true，私人附件即便拿到 UUID 也读不到。

import { ok, fail, HttpError } from '../lib/response.js';
import { requireAdmin } from '../middleware/auth.js';
import { SupabaseClient, qs } from '../lib/supabase.js';
import { requireUuid } from '../lib/validate.js';
import {
  resolveFileType, sanitizeFilename, buildFileKey, sha256Hex,
  isWithinFileLimit, MAX_FILE_BYTES
} from '../lib/fileType.js';

const TABLE = 'files';
const FALLBACK_PUBLIC_BASE = 'https://api.xuguochen.de5.net';

function requestOrigin(request, env) {
  try { return new URL(request.url).origin; }
  catch { return env.ASSET_PUBLIC_BASE || FALLBACK_PUBLIC_BASE; }
}

// POST /api/files —— 上传文档附件
export async function uploadFile(request, env) {
  const { db, user } = await requireAdmin(request, env);

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    throw new HttpError(415, '上传必须使用 multipart/form-data，字段名 file');
  }

  let form;
  try { form = await request.formData(); }
  catch { throw new HttpError(400, '无法解析上传表单'); }

  const file = form.get('file');
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    throw new HttpError(422, '缺少上传文件字段 file');
  }
  if (!isWithinFileLimit(file.size)) {
    throw new HttpError(413, `文件过大，单个附件上限 ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isWithinFileLimit(bytes.byteLength)) {
    throw new HttpError(413, `文件过大，单个附件上限 ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB`);
  }

  const type = resolveFileType(bytes, file.type);
  if (!type) {
    throw new HttpError(415, '仅支持 PDF / Word / Excel / PPT / TXT / CSV / Markdown，且文件内容需与类型一致');
  }

  const objectKey = buildFileKey(user.id, type.ext);
  const sha256 = await sha256Hex(bytes);
  const origin = requestOrigin(request, env);

  if (!env.R2_BUCKET) throw new HttpError(503, '存储未配置（缺少 R2_BUCKET 绑定）');
  try {
    await env.R2_BUCKET.put(objectKey, bytes, { httpMetadata: { contentType: type.mime } });
  } catch (err) {
    console.error('R2 put 失败:', objectKey, err?.message || err);
    throw new HttpError(502, '文件写入存储失败，请稍后重试');
  }

  let row;
  try {
    const rows = await db.insert(TABLE, {
      user_id: user.id,
      object_key: objectKey,
      public_url: `${origin}/api/files/pending`,
      original_name: sanitizeFilename(file.name, type.ext),
      mime_type: type.mime,
      size: bytes.byteLength,
      sha256,
      // 默认私人：碎念公开时前端会显式把附件的 is_public 一并置 true
      is_public: false
    });
    row = rows[0];
    const publicUrl = `${origin}/api/files/${row.id}`;
    await db.update(TABLE, qs({ id: `eq.${row.id}`, user_id: `eq.${user.id}` }), { public_url: publicUrl });
    row = { ...row, public_url: publicUrl };
  } catch (err) {
    try { await env.R2_BUCKET.delete(objectKey); }
    catch (cleanupErr) { console.error('files 落库失败后补偿删除 R2 失败:', objectKey, cleanupErr?.message || cleanupErr); }
    throw err;
  }

  console.log(`files 上传: id=${row.id} key=${objectKey} size=${bytes.byteLength} mime=${type.mime}`);
  return ok({
    id: row.id, public_url: row.public_url, original_name: row.original_name,
    mime_type: row.mime_type, size: row.size, is_public: row.is_public, created_at: row.created_at
  }, request, env, 201);
}

// GET /api/files —— 列出本人附件
export async function listFiles(request, env) {
  const { db, user } = await requireAdmin(request, env);
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 24, 1), 100);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

  const rows = await db.select(TABLE, qs({
    select: 'id,public_url,original_name,mime_type,size,is_public,created_at',
    user_id: `eq.${user.id}`,
    order: 'created_at.desc',
    limit: String(limit),
    offset: String(offset)
  }));
  return ok({ items: rows, count: rows.length, limit, offset }, request, env);
}

// GET /api/files/:id —— 公开下载 / 预览（只放行 is_public=true）
export async function getFile(request, env, id) {
  requireUuid(id, 'id');
  const db = new SupabaseClient(env);
  const rows = await db.select(TABLE, qs({
    select: 'id,object_key,mime_type,original_name,sha256',
    id: `eq.${id}`,
    is_public: 'eq.true'
  }));
  if (!rows.length) throw new HttpError(404, '文件不存在');
  const file = rows[0];

  if (!env.R2_BUCKET) throw new HttpError(503, '存储未配置');
  const object = await env.R2_BUCKET.get(file.object_key);
  if (!object) throw new HttpError(404, '文件缺失');

  const etag = object.httpEtag || `"${file.sha256 || file.id}"`;
  // 下载名做 RFC 5987 编码，避免中文文件名在部分浏览器乱码
  const safeName = encodeURIComponent(file.original_name || 'file');
  return new Response(object.body, {
    headers: {
      'Content-Type': file.mime_type,
      ETag: etag,
      'Cache-Control': 'public, max-age=31536000, immutable',
      // inline：PDF / 文本可在浏览器直接预览；下载时由前端 download 属性控制
      'Content-Disposition': `inline; filename*=UTF-8''${safeName}`,
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

// DELETE /api/files/:id —— 删除（被碎念引用时 409）
export async function deleteFile(request, env, id) {
  const { db, user } = await requireAdmin(request, env);
  requireUuid(id, 'id');

  const rows = await db.select(TABLE, qs({
    select: 'id,object_key,public_url', id: `eq.${id}`, user_id: `eq.${user.id}`
  }));
  if (!rows.length) throw new HttpError(404, '文件不存在或无权限');
  const file = rows[0];

  const refs = await db.select('moment_files', qs({
    select: 'moment_id', user_id: `eq.${user.id}`, file_id: `eq.${id}`, limit: '20'
  }));
  if (refs.length) {
    return fail(`该文件正被 ${refs.length} 条碎念引用，请先解除引用`, 409, request, env, { referenced_by: refs });
  }

  if (!env.R2_BUCKET) throw new HttpError(503, '存储未配置');
  try { await env.R2_BUCKET.delete(file.object_key); }
  catch (err) {
    console.error('R2 delete 失败:', file.object_key, err?.message || err);
    throw new HttpError(502, '删除存储对象失败，请稍后重试');
  }

  await db.remove(TABLE, qs({ id: `eq.${id}`, user_id: `eq.${user.id}` }));
  console.log(`files 删除: id=${id} key=${file.object_key}`);
  return ok({ id, deleted: true }, request, env);
}
