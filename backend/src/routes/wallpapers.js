// 动态壁纸（R2）接口 —— 图展的「动态壁纸」区。
//
// 定位：站长上传短视频（MP4 / WebM）到 R2，访客在「图展」页静音循环播放。
//       与 assets（静态图片）**完全分开**：不同的表、不同的 R2 前缀
//       （assets/ 存图，wallpapers/ 存视频），用户明确要求动静分开。
//
// 为什么不用 multipart/form-data（与 books 同因）：
//   视频可达 100MB，Worker 内存只有 128MB，request.formData() 会把整个文件读进内存。
//   这里改为**原始请求体直传**：
//     body = 视频字节（Content-Type: application/octet-stream 或 video/*）
//     文件名走请求头 X-Wallpaper-Name（encodeURIComponent 编码）
//   路由把 request.body 原样灌进 R2，全程不落地内存，只在开头缓冲 64KB 用于
//   嗅探容器 + 解析 MP4 时长与分辨率（moov 一般在头部，64KB 足够）。
//
// 路由（见 router.js）：
//   POST   /api/wallpapers            上传（requireAdmin，原始请求体直传）
//   GET    /api/wallpapers            列出（访客只返回 is_public=true）
//   GET    /api/wallpapers/:id        单条元数据（JSON）
//   GET    /api/wallpapers/:id/file   视频字节（公开可读，支持 Range，供 <video> 播放）
//   PATCH  /api/wallpapers/:id        改标题 / 说明 / 排序 / 公开状态（requireAdmin，仅本人）
//   DELETE /api/wallpapers/:id        删除（requireAdmin，仅本人；同时删 R2 对象）
//
// 安全：object key 由服务端生成（wallpapers/<user_id>/<年>/<uuid>.<ext>），用户文件名只作展示；
//       视频读取要求 is_public=true 或本人，私人壁纸即便拿到 UUID 也读不到。

import { ok, readJson, HttpError, corsHeaders } from '../lib/response.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { SupabaseClient, qs } from '../lib/supabase.js';
import { requireUuid, optionalString, optionalBool, optionalInt } from '../lib/validate.js';
import { cachedData, bumpVersion } from '../lib/edgeCache.js';
import {
  sniffVideoFormat, parseVideoMeta, sanitizeFilename, buildVideoKey,
  isWithinVideoLimit, VIDEO_FORMATS, MAX_VIDEO_BYTES
} from '../lib/videoType.js';

const TABLE = 'wallpapers';
const FALLBACK_PUBLIC_BASE = 'https://api.xuguochen.de5.net';

// 嗅探 + 解析元数据需要的头部字节数。
// 64KB 是实测出来的：四个 4K 样本的 moov box 都在前 64KB 内，
// 取 4KB 会解析不到时长与分辨率（见 docs/progress.md 本轮记录）。
const HEAD_PROBE_BYTES = 64 * 1024;

// 对外字段白名单：绝不返回 object_key / user_id（内部信息）
const SELECT = 'id,original_name,mime_type,format,size,duration,width,height,' +
  'title,description,sort_order,is_public,public_url,created_at,updated_at';

function requestOrigin(request, env) {
  try { return new URL(request.url).origin; }
  catch { return env.ASSET_PUBLIC_BASE || FALLBACK_PUBLIC_BASE; }
}

// 组装对外结构
function shape(row) {
  return {
    id: row.id,
    title: row.title || stripExt(row.original_name),
    description: row.description || '',
    format: row.format,
    mime_type: row.mime_type,
    size: row.size,
    // numeric 经 PostgREST 回来可能是字符串，统一转成数字（前端要拿它算进度）
    duration: row.duration == null ? null : Number(row.duration),
    width: row.width,
    height: row.height,
    file_url: row.public_url,
    is_public: row.is_public,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function stripExt(name) {
  if (typeof name !== 'string') return '动态壁纸';
  const dot = name.lastIndexOf('.');
  return (dot > 0 ? name.slice(0, dot) : name) || '动态壁纸';
}

// 从请求体里先读出前 N 字节（用于嗅探 + 解析元数据），并把「已读字节 + 剩余流」
// 重新拼成一个可继续消费的 ReadableStream。全程只缓冲前 N 字节，不把视频读进内存。
async function takeHeadAndRest(request, headSize) {
  if (!request.body) throw new HttpError(422, '缺少请求体（应直接把视频字节作为 body 发送）');
  const reader = request.body.getReader();
  const chunks = [];
  let buffered = 0;
  let done = false;

  while (buffered < headSize && !done) {
    const next = await reader.read();
    done = next.done;
    if (done) break;
    if (!next.value?.byteLength) continue;
    chunks.push(next.value);
    buffered += next.value.byteLength;
  }

  const head = new Uint8Array(buffered);
  let at = 0;
  for (const c of chunks) { head.set(c, at); at += c.byteLength; }

  let index = 0;
  const rest = new ReadableStream({
    async pull(controller) {
      if (index < chunks.length) { controller.enqueue(chunks[index++]); return; }
      if (done) { controller.close(); return; }
      const next = await reader.read();
      if (next.done) { done = true; controller.close(); return; }
      controller.enqueue(next.value);
    },
    cancel(reason) { return reader.cancel(reason); }
  });

  return { head, rest };
}

// 带字节数上限的流包装：超过上限立刻报错，避免 Content-Length 缺失时无限写 R2
function limitStream(stream, maxBytes, onTooLarge) {
  let total = 0;
  return stream.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      total += chunk.byteLength;
      if (total > maxBytes) { controller.error(onTooLarge()); return; }
      controller.enqueue(chunk);
    }
  }));
}

// R2 的 put 要求流长度已知（同 books.js，理由见那里的注释）
function withKnownLength(stream, length) {
  const FL = globalThis.FixedLengthStream;
  if (typeof FL !== 'function' || !Number.isFinite(length) || length <= 0) return stream;
  try {
    return stream.pipeThrough(new FL(length));
  } catch {
    return stream;
  }
}

// ---------------------------------------------------------------
// POST /api/wallpapers —— 上传动态壁纸（原始请求体直传 R2）
// ---------------------------------------------------------------
export async function uploadWallpaper(request, env) {
  const { db, user } = await requireAdmin(request, env);
  if (!env.R2_BUCKET) throw new HttpError(503, '存储未配置（缺少 R2_BUCKET 绑定）');

  // 声明长度先做一次快速拒绝（省掉无谓的流式写入）
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > 0 && !isWithinVideoLimit(declaredLength)) {
    throw new HttpError(413,
      `视频过大，单个上限 ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)}MB`);
  }

  const { head, rest } = await takeHeadAndRest(request, HEAD_PROBE_BYTES);
  const sniffed = sniffVideoFormat(head);
  if (!sniffed) {
    throw new HttpError(415, '仅支持 MP4 / WebM 动态壁纸，且文件内容需与格式一致');
  }
  const spec = VIDEO_FORMATS[sniffed.format];
  const meta = parseVideoMeta(head, sniffed.format);

  // 文件名走请求头（encodeURIComponent 编码），缺失时用默认名
  const rawName = request.headers.get('x-wallpaper-name') || '';
  let decodedName = '';
  try { decodedName = decodeURIComponent(rawName); } catch { decodedName = rawName; }

  const objectKey = buildVideoKey(user.id, spec.ext);
  const origin = requestOrigin(request, env);

  // 流式写 R2：request.body 原样灌进去，不整段读进内存
  let putResult;
  try {
    const limited = limitStream(rest, MAX_VIDEO_BYTES, () =>
      new HttpError(413, `视频过大，单个上限 ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)}MB`));
    putResult = await env.R2_BUCKET.put(objectKey, withKnownLength(limited, declaredLength), {
      httpMetadata: { contentType: spec.mime }
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.error('R2 put 失败:', objectKey, err?.message || err);
    throw new HttpError(502, '视频写入存储失败，请稍后重试');
  }

  const size = Number(putResult?.size) || declaredLength || 0;

  // 入库（service_role 直连；user_id 显式带上，保证隔离）
  // 失败则补偿删除 R2 对象，避免孤儿
  let row;
  try {
    const rows = await db.insert(TABLE, {
      user_id: user.id,
      object_key: objectKey,
      public_url: `${origin}/api/wallpapers/pending`,
      original_name: sanitizeFilename(decodedName, spec.ext),
      mime_type: spec.mime,
      format: sniffed.format,
      size,
      duration: meta.duration,
      width: meta.width,
      height: meta.height,
      title: stripExt(decodedName) || null,
      // 默认私人：与 assets 不同 —— 图片素材默认公开，但视频更大更敏感，
      // 默认私人更稳妥，站长要展出时在策展里显式公开。
      is_public: false
    });
    row = rows[0];

    const publicUrl = `${origin}/api/wallpapers/${row.id}/file`;
    await db.update(TABLE, qs({ id: `eq.${row.id}`, user_id: `eq.${user.id}` }), { public_url: publicUrl });
    row = { ...row, public_url: publicUrl };
  } catch (err) {
    try { await env.R2_BUCKET.delete(objectKey); }
    catch (cleanupErr) {
      console.error('wallpapers 落库失败后补偿删除 R2 失败:', objectKey, cleanupErr?.message || cleanupErr);
    }
    throw err;
  }

  console.log(`wallpapers 上传: id=${row.id} key=${objectKey} size=${size} format=${sniffed.format} ${meta.width}x${meta.height} ${meta.duration}s`);
  return ok(shape(row), request, env, 201);
}

// ---------------------------------------------------------------
// GET /api/wallpapers —— 列出
// ---------------------------------------------------------------
export async function listWallpapers(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 60, 1), 200);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

  const filters = {
    select: SELECT,
    user_id: `eq.${user.id}`,
    order: 'sort_order.desc,created_at.desc',
    limit: String(limit),
    offset: String(offset)
  };
  // 访客只看公开条目：必须在查询层过滤（Worker 用 service_role，RLS 不替它过滤）
  if (user.isGuest) filters.is_public = 'eq.true';

  const { data, cache } = await cachedData(request, env, {
    key: `wallpapers/${user.id}/${limit}/${offset}`,
    ttl: 300,
    user,
    versionNs: `wallpapers/${user.id}`,
    load: async () => {
      const rows = await db.select(TABLE, qs(filters));
      const items = rows.map(shape);
      return { items, count: items.length, limit, offset };
    }
  });
  return json({ data }, { headers: { 'X-List-Cache': cache } }, request, env);
}

// ---------------------------------------------------------------
// GET /api/wallpapers/:id —— 单条元数据
// ---------------------------------------------------------------
export async function getWallpaper(request, env, id) {
  requireUuid(id, 'id');
  const { db, user } = await requireAuth(request, env);
  const row = await findReadableWallpaper(db, user, id);
  if (!row) throw new HttpError(404, '动态壁纸不存在');
  return ok(shape(row), request, env);
}

// 读取可访问的单条记录：本人始终可读，访客 / 他人只读 is_public=true。
// 私人壁纸对访客按「不存在」处理，不泄露存在性。
async function findReadableWallpaper(db, user, id) {
  const filters = { select: '*', id: `eq.${id}` };
  if (user.isGuest) filters.is_public = 'eq.true';
  else filters.user_id = `eq.${user.id}`;
  const rows = await db.select(TABLE, qs(filters));
  return rows[0] || null;
}

// ---------------------------------------------------------------
// GET /api/wallpapers/:id/file —— 视频字节（公开可读 + Range）
// ---------------------------------------------------------------
export async function getWallpaperFile(request, env, id) {
  requireUuid(id, 'id');
  const { db, user } = await requireAuth(request, env);
  const row = await findReadableWallpaper(db, user, id);
  if (!row) throw new HttpError(404, '动态壁纸不存在');
  if (!env.R2_BUCKET) throw new HttpError(503, '存储未配置');

  const wantsDownload = new URL(request.url).searchParams.get('download') === '1';
  return serveVideo(request, env, row.object_key, {
    mime: row.mime_type,
    filename: row.original_name || `wallpaper.${row.format}`,
    forceDownload: wantsDownload
  });
}

// 与 books.js 的 serveObject 同款，但**必须**带 CORS：
// 前端在另一个域，<video src> 跨域播放需要 Access-Control-Allow-Origin。
async function serveVideo(request, env, objectKey, { mime, filename, forceDownload = false }) {
  const rangeHeader = request.headers.get('Range');
  let range;
  if (rangeHeader) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (m) {
      const hasStart = m[1] !== '';
      const hasEnd = m[2] !== '';
      if (hasStart) {
        const start = Number(m[1]);
        range = hasEnd ? { offset: start, length: Number(m[2]) - start + 1 } : { offset: start };
      } else if (hasEnd) {
        // bytes=-N：最后 N 字节
        const head = await env.R2_BUCKET.head(objectKey);
        const size = Number(head?.size) || 0;
        const n = Number(m[2]);
        range = { offset: Math.max(0, size - n), length: n };
      }
    }
  }

  const object = await env.R2_BUCKET.get(objectKey, range ? { range } : undefined);
  if (!object) throw new HttpError(404, '视频文件缺失');

  const headers = {
    ...corsHeaders(request, env),
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
    ETag: object.httpEtag || '"unknown"',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff'
  };
  if (filename) {
    const kind = forceDownload ? 'attachment' : 'inline';
    headers['Content-Disposition'] = `${kind}; filename*=UTF-8''${encodeURIComponent(filename)}`;
  }

  const r = object.range;
  if (r && typeof r.offset === 'number' && typeof r.length === 'number') {
    const size = Number(object.size) || 0;
    headers['Content-Range'] = `bytes ${r.offset}-${r.offset + r.length - 1}/${size}`;
    headers['Content-Length'] = String(r.length);
    return new Response(object.body, { status: 206, headers });
  }

  if (object.size != null) headers['Content-Length'] = String(object.size);
  return new Response(object.body, { status: 200, headers });
}

// ---------------------------------------------------------------
// PATCH /api/wallpapers/:id —— 改元数据（仅本人）
// ---------------------------------------------------------------
export async function updateWallpaper(request, env, id) {
  const { db, user } = await requireAdmin(request, env);
  requireUuid(id, 'id');
  const body = await readJson(request);

  const patch = {};
  // 用「字段是否存在」判断是否更新，显式传 null 表示清空
  if ('title' in body) patch.title = optionalString(body.title, 'title', { max: 200 }) ?? null;
  if ('description' in body) patch.description = optionalString(body.description, 'description', { max: 2000 }) ?? null;
  if ('sort_order' in body) patch.sort_order = optionalInt(body.sort_order, 'sort_order', { min: -10000, max: 10000 }) ?? 0;
  if ('is_public' in body) patch.is_public = optionalBool(body.is_public, 'is_public') ?? false;
  if (!Object.keys(patch).length) throw new HttpError(422, '没有需要更新的字段');

  const rows = await db.update(TABLE, qs({ id: `eq.${id}`, user_id: `eq.${user.id}` }), patch);
  if (!rows.length) throw new HttpError(404, '动态壁纸不存在或无权限');
  await bumpVersion(`wallpapers/${user.id}`, env);
  return ok(shape(rows[0]), request, env);
}

// ---------------------------------------------------------------
// DELETE /api/wallpapers/:id —— 删除（仅本人；同时删 R2 对象）
// ---------------------------------------------------------------
export async function deleteWallpaper(request, env, id) {
  const { db, user } = await requireAdmin(request, env);
  requireUuid(id, 'id');

  const rows = await db.select(TABLE, qs({ select: 'id,object_key', id: `eq.${id}`, user_id: `eq.${user.id}` }));
  if (!rows.length) throw new HttpError(404, '动态壁纸不存在或无权限');
  const row = rows[0];

  await db.remove(TABLE, qs({ id: `eq.${id}`, user_id: `eq.${user.id}` }));
  if (env.R2_BUCKET) {
    try { await env.R2_BUCKET.delete(row.object_key); }
    catch (err) {
      // 元数据已删，R2 残留只记日志：不让清理失败把删除操作报成失败
      console.error('删除动态壁纸时 R2 清理失败:', row.object_key, err?.message || err);
    }
  }
  console.log(`wallpapers 删除: id=${id} key=${row.object_key}`);
  await bumpVersion(`wallpapers/${user.id}`, env);
  return ok({ id, deleted: true }, request, env);
}
