// 图书库（R2）接口 —— 电子书书架 + 站内阅读。
//
// 定位：站长上传电子书（**只支持 EPUB / PDF**）到 R2，读者在「图书」页浏览、
//       在线预览（PDF 内嵌 / EPUB 站内阅读）或下载。
//       2026-10-12 用户决定：MOBI / AZW3 不再支持，上传直接拒绝，前端也不再出现。
//
// 与 files.js 的区别：
//   files = 碎念附件（20MB，PDF/Office/文本，下载用）；
//   books = 电子书（不限单本大小，4 种电子书格式，带封面 + 书架元数据 + 阅读器）。
//   分成两张表是刻意的：书架要按「书名/作者/格式/封面」组织，附件表没有这些字段。
//
// 为什么不用 multipart/form-data（和 assets / files 不一样）：
//   电子书可以很大，而 Worker 内存只有 128MB。`request.formData()` 会把整个文件
//   读进内存，直接爆掉。这里改为**原始请求体直传**：
//     请求体 = 文件字节（Content-Type: application/octet-stream）
//     文件名走请求头 X-Book-Name（encodeURIComponent 编码）
//   路由把 request.body 这个 ReadableStream **原样**灌进 R2，全程不落地内存，
//   只在开头缓冲 4KB 用于魔数嗅探。
//
// 两条上传通道（大文件必须走后者）：
//   1) 一次性直传  POST /api/books —— 整个文件就是一个请求体。
//      受 Cloudflare Workers 单请求体约 100MB 的平台硬上限约束，
//      因此只适合中小文件；代码里的 400MB 是保护上限，不是业务限制。
//   2) 分片上传   POST /api/books/multipart → PUT .../parts/:n → POST .../complete
//      前端把文件切成 8MiB 一片，每片一个独立小请求，再由 Worker 转交给 R2 的
//      multipart upload（createMultipartUpload / resumeMultipartUpload / uploadPart）。
//      单本大小因此不再受「单请求体」约束，只受 5GB 的保护上限约束。
//      object key 不明文下发：创建时用 HMAC 签成一个 ticket，后续请求带 ?ticket=...
//
// 封面提取：文件进 R2 之后，再按需从 R2 **range 读取**少量字节喂给 bookCover.js，
//   避免为了抽封面把整本书读进内存。抽到的封面单独存成 R2 对象，
//   前端书架只加载封面小图，不碰正文。
//
// 路由（见 router.js）：
//   POST   /api/books                          一次性直传（requireAdmin，原始请求体）
//   POST   /api/books/multipart                创建分片上传（requireAdmin，JSON）
//   PUT    /api/books/multipart/:uploadId/parts/:partNumber
//                                              上传第 N 片（requireAdmin，原始请求体 + ?ticket=）
//   POST   /api/books/multipart/:uploadId/complete
//                                              合并并入库（requireAdmin，JSON + ?ticket=）
//   DELETE /api/books/multipart/:uploadId      放弃上传（requireAdmin，?ticket=）
//   GET    /api/books                          列出（访客只返回 is_public=true）
//   GET    /api/books/:id                      单本元数据（JSON）
//   GET    /api/books/:id/file                 正文字节（公开可读，支持 Range，供 PDF 内嵌 / EPUB 阅读）
//   GET    /api/books/:id/cover                封面图（公开可读）
//   PATCH  /api/books/:id                      改书名 / 作者 / 简介 / 公开状态（requireAdmin，仅本人）
//   DELETE /api/books/:id                      删除（requireAdmin，仅本人；同时删正文与封面两个 R2 对象）
//
// 安全：object key 由服务端生成（books/<user_id>/<年>/<uuid>.<ext>），用户文件名只作展示；
//       正文/封面读取都要求 is_public=true 或本人，私人书即便拿到 UUID 也读不到。

import { ok, readJson, HttpError, corsHeaders } from '../lib/response.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { SupabaseClient, qs } from '../lib/supabase.js';
import { requireUuid, optionalString, optionalBool, optionalInt } from '../lib/validate.js';
import {
  sniffBookFormat, sanitizeFilename, buildBookKey, buildCoverKey, sniffCoverMime,
  isWithinBookLimit, isWithinMultipartBookLimit, checkPartSize, normalizeCompletedParts,
  signBookTicket, verifyBookTicket, planPartCount,
  MAX_BOOK_BYTES, MAX_MULTIPART_BOOK_BYTES, MULTIPART_PART_BYTES, MULTIPART_MAX_PARTS,
  MAX_COVER_BYTES, BOOK_FORMATS
} from '../lib/bookType.js';
import { extractBookMeta } from '../lib/bookCover.js';
import { cachedData, bumpVersion } from '../lib/edgeCache.js';

const TABLE = 'books';
const FALLBACK_PUBLIC_BASE = 'https://api.xuguochen.de5.net';

// 嗅探魔数需要的头部字节数
const HEAD_PROBE_BYTES = 4096;

// 对外字段白名单：绝不返回 object_key / cover_key / user_id（内部信息）
const SELECT = 'id,original_name,mime_type,format,size,title,author,description,' +
  'public_url,cover_url,is_public,sort_order,created_at,updated_at';

function requestOrigin(request, env) {
  try { return new URL(request.url).origin; }
  catch { return env.ASSET_PUBLIC_BASE || FALLBACK_PUBLIC_BASE; }
}

// 组装对外结构（统一补上「这本书能不能在线读」的能力位，前端据此决定按钮）
function shape(row) {
  const caps = { pdf: 'inline', epub: 'reader' };
  return {
    id: row.id,
    title: row.title || stripExt(row.original_name),
    author: row.author || '',
    description: row.description || '',
    format: row.format,
    mime_type: row.mime_type,
    size: row.size,
    file_url: row.public_url,
    cover_url: row.cover_url || null,
    is_public: row.is_public,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
    // 阅读能力：pdf 用浏览器内嵌，epub 用站内阅读器
    read_mode: caps[row.format] || 'download'
  };
}

function stripExt(name) {
  if (typeof name !== 'string') return '未命名';
  const dot = name.lastIndexOf('.');
  return (dot > 0 ? name.slice(0, dot) : name) || '未命名';
}

// 把 R2 对象包装成 bookCover.js 需要的「随机读取字节源」。
// 这是本文件能处理 100MB 电子书的关键：抽封面只按需读几段，从不整本读。
function r2ByteSource(env, objectKey, size) {
  return {
    size,
    async read(offset, length) {
      const start = Math.max(0, Math.min(offset, size));
      const end = Math.max(start, Math.min(offset + length, size));
      if (end <= start) return new Uint8Array(0);
      const object = await env.R2_BUCKET.get(objectKey, { range: { offset: start, length: end - start } });
      if (!object) return new Uint8Array(0);
      return new Uint8Array(await object.arrayBuffer());
    }
  };
}

// 从请求体里先读出前 N 字节（用于魔数嗅探），并把「已读的字节 + 剩余流」重新拼成
// 一个可继续消费的 ReadableStream。全程只缓冲前 N 字节，不会把整本书读进内存。
async function takeHeadAndRest(request, headSize) {
  if (!request.body) throw new HttpError(422, '缺少请求体（应直接把文件字节作为 body 发送）');
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

  // 剩余流：先把已读块原样吐出，再继续泵原始 reader
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

// 带字节数上限的流包装：超过上限立刻报错，避免「Content-Length 缺失时无限写 R2」
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

// R2 的 put 要求流**长度已知**，否则运行时会报错（或退化成整段缓冲，反而更耗内存）。
// Workers 为此提供了全局 FixedLengthStream：把它包在流上就声明了总长度。
// 之所以要判 typeof：本文件也要能在 Node 里被单测 import，而 Node 没有这个全局。
function withKnownLength(stream, length) {
  const FL = globalThis.FixedLengthStream;
  if (typeof FL !== 'function' || !Number.isFinite(length) || length <= 0) return stream;
  try {
    return stream.pipeThrough(new FL(length));
  } catch {
    // 长度声明失败不致命：退回原流，让 R2 自己决定怎么处理
    return stream;
  }
}

// ---------------------------------------------------------------
// 收尾：抽封面 + 入库 + 失败补偿。
// 一次性直传（uploadBook）与分片上传（completeBookMultipart）**共用这一段**，
// 保证两条通道落库的字段、封面提取策略、失败补偿完全一致，不会各写一份跑偏。
// ---------------------------------------------------------------
async function finalizeBookUpload(env, db, user, { objectKey, size, etag, decodedName, spec, format, origin }) {
  // 抽封面 + 书名 / 作者（失败不阻断上传，只是没有封面）
  let meta = { title: null, author: null, cover: null, coverMime: null };
  let coverKey = null;
  try {
    const extracted = await extractBookMeta(r2ByteSource(env, objectKey, size));
    meta = { ...meta, ...extracted };
    if (meta.cover && meta.cover.byteLength > 0 && meta.cover.byteLength <= MAX_COVER_BYTES) {
      const coverSpec = sniffCoverMime(meta.cover) || { mime: meta.coverMime, ext: meta.coverMime === 'image/png' ? 'png' : 'jpg' };
      if (coverSpec?.mime) {
        coverKey = buildCoverKey(objectKey, coverSpec.ext);
        await env.R2_BUCKET.put(coverKey, meta.cover, { httpMetadata: { contentType: coverSpec.mime } });
      }
    }
  } catch (err) {
    console.error('封面提取失败（不影响上传）:', objectKey, err?.message || err);
  }

  // 入库；失败则补偿删除已写入的 R2 对象，避免孤儿
  let row;
  try {
    const rows = await db.insert(TABLE, {
      user_id: user.id,
      object_key: objectKey,
      cover_key: coverKey,
      // 先占位，拿到 id 后再回填真实 URL（URL 用表主键，不暴露 R2 key）
      public_url: `${origin}/api/books/pending`,
      cover_url: null,
      original_name: sanitizeFilename(decodedName, spec.ext),
      mime_type: spec.mime,
      format,
      size,
      etag,
      title: meta.title ? String(meta.title).slice(0, 300) : null,
      author: meta.author ? String(meta.author).slice(0, 200) : null,
      is_public: true
    });
    row = rows[0];

    const publicUrl = `${origin}/api/books/${row.id}/file`;
    const coverUrl = coverKey ? `${origin}/api/books/${row.id}/cover` : null;
    await db.update(TABLE, qs({ id: `eq.${row.id}`, user_id: `eq.${user.id}` }), {
      public_url: publicUrl, cover_url: coverUrl
    });
    row = { ...row, public_url: publicUrl, cover_url: coverUrl };
  } catch (err) {
    try {
      await env.R2_BUCKET.delete(objectKey);
      if (coverKey) await env.R2_BUCKET.delete(coverKey);
    } catch (cleanupErr) {
      console.error('books 落库失败后补偿删除 R2 失败:', objectKey, cleanupErr?.message || cleanupErr);
    }
    throw err;
  }

  console.log(`books 上传: id=${row.id} key=${objectKey} size=${size} format=${format} cover=${coverKey || 'none'}`);
  return row;
}

// ---------------------------------------------------------------
// POST /api/books —— 上传电子书（原始请求体直传 R2）
// ---------------------------------------------------------------
export async function uploadBook(request, env) {
  const { db, user } = await requireAdmin(request, env);
  if (!env.R2_BUCKET) throw new HttpError(503, '存储未配置（缺少 R2_BUCKET 绑定）');

  // 声明长度先做一次快速拒绝（省掉无谓的流式写入）
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > 0 && !isWithinBookLimit(declaredLength)) {
    throw new HttpError(413,
      `单个请求体过大（超过 ${Math.round(MAX_BOOK_BYTES / 1024 / 1024)}MB），请改用分片上传接口`);
  }

  const { head, rest } = await takeHeadAndRest(request, HEAD_PROBE_BYTES);
  const sniffed = sniffBookFormat(head);
  if (!sniffed) {
    throw new HttpError(415, '仅支持 EPUB / PDF 电子书，且文件内容需与格式一致');
  }
  const spec = BOOK_FORMATS[sniffed.format];

  // 文件名走请求头（encodeURIComponent 编码），缺失时用默认名
  const rawName = request.headers.get('x-book-name') || '';
  let decodedName = '';
  try { decodedName = decodeURIComponent(rawName); } catch { decodedName = rawName; }

  const objectKey = buildBookKey(user.id, spec.ext);
  const origin = requestOrigin(request, env);

  // 流式写 R2：request.body 原样灌进去，不整本读进内存
  let putResult;
  try {
    const limited = limitStream(rest, MAX_BOOK_BYTES, () =>
      new HttpError(413,
        `单个请求体过大（超过 ${Math.round(MAX_BOOK_BYTES / 1024 / 1024)}MB），请改用分片上传接口`)
    );
    putResult = await env.R2_BUCKET.put(objectKey, withKnownLength(limited, declaredLength), {
      httpMetadata: { contentType: spec.mime }
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.error('R2 put 失败:', objectKey, err?.message || err);
    throw new HttpError(502, '电子书写入存储失败，请稍后重试');
  }

  // 真实大小：优先 R2 返回值，其次声明长度
  const size = Number(putResult?.size) || declaredLength || 0;
  const etag = putResult?.httpEtag || null;

  const row = await finalizeBookUpload(env, db, user, {
    objectKey, size, etag, decodedName, spec, format: sniffed.format, origin
  });
  return ok(shape(row), request, env, 201);
}

// ---------------------------------------------------------------
// 分片上传（大文件）
//
// 流程：
//   1) POST /api/books/multipart
//        body: { name, size, parts, head }  head = 首片前 4KB 的 base64
//        → 嗅探格式 → createMultipartUpload → 返回 { upload_id, ticket, part_size, ... }
//   2) PUT  /api/books/multipart/:uploadId/parts/:n?ticket=...
//        body = 第 n 片的原始字节 → resumeMultipartUpload(...).uploadPart(n, request.body)
//        → { part_number, etag }
//   3) POST /api/books/multipart/:uploadId/complete?ticket=...
//        body: { name, size, parts: [{ part_number, etag }] } → complete → finalizeBookUpload
//   4) DELETE /api/books/multipart/:uploadId?ticket=...  （取消时调，abort 掉，避免 R2 留碎片）
//
// ticket 只在 query string 里传，所以不必给 CORS 再加请求头。
// ---------------------------------------------------------------

// 从 base64 还原首片头部字节（创建分片上传时用来嗅探格式）
function decodeHeadProbe(base64) {
  if (typeof base64 !== 'string' || !base64) return null;
  try {
    const bin = atob(base64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function ticketSecret(env) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new HttpError(503, '服务未正确配置（缺少签名密钥）');
  return env.SUPABASE_SERVICE_ROLE_KEY;
}

// 校验 ?ticket= 并把 object key 取回来；失败一律 401（不细分原因，避免试探）
async function resolveTicket(request, env, user) {
  const ticket = new URL(request.url).searchParams.get('ticket') || '';
  try {
    return await verifyBookTicket(ticketSecret(env), ticket, user.id);
  } catch (err) {
    throw new HttpError(401, err?.message || '上传凭据无效');
  }
}

// POST /api/books/multipart —— 创建分片上传
export async function createBookMultipart(request, env) {
  const { user } = await requireAdmin(request, env);
  if (!env.R2_BUCKET) throw new HttpError(503, '存储未配置（缺少 R2_BUCKET 绑定）');

  const body = await readJson(request);
  const size = Number(body.size);
  const totalParts = Number(body.parts);
  if (!isWithinMultipartBookLimit(size)) {
    throw new HttpError(413,
      `图书过大（超过 ${Math.round(MAX_MULTIPART_BOOK_BYTES / 1024 / 1024 / 1024)}GB 的保护上限）`);
  }
  if (!Number.isInteger(totalParts) || totalParts < 1 || totalParts > MULTIPART_MAX_PARTS) {
    throw new HttpError(422, `分片数非法（应为 1–${MULTIPART_MAX_PARTS}）`);
  }
  // 片数必须与「按 8MiB 切片」的预期一致，避免客户端声称的片数与实际不符
  const expectedParts = planPartCount(size);
  if (totalParts !== expectedParts) {
    throw new HttpError(422, `分片数与文件大小不匹配（应为 ${expectedParts} 片）`);
  }

  const head = decodeHeadProbe(body.head);
  const sniffed = sniffBookFormat(head);
  if (!sniffed) {
    throw new HttpError(415, '仅支持 EPUB / PDF 电子书，且文件内容需与格式一致');
  }
  const spec = BOOK_FORMATS[sniffed.format];

  let decodedName = '';
  try { decodedName = decodeURIComponent(String(body.name || '')); } catch { decodedName = String(body.name || ''); }

  const objectKey = buildBookKey(user.id, spec.ext);
  let upload;
  try {
    upload = await env.R2_BUCKET.createMultipartUpload(objectKey, {
      httpMetadata: { contentType: spec.mime }
    });
  } catch (err) {
    console.error('创建分片上传失败:', objectKey, err?.message || err);
    throw new HttpError(502, '无法创建分片上传，请稍后重试');
  }

  // ticket 里只放 object key / uid / 过期时间；object key 绝不直接下发
  const ticket = await signBookTicket(ticketSecret(env), { key: objectKey, uid: user.id });

  await bumpVersion(`books/${user.id}`, env);
  return ok({
    upload_id: upload.uploadId,
    ticket,
    part_size: MULTIPART_PART_BYTES,
    parts: totalParts,
    format: sniffed.format,
    mime: spec.mime,
    name: sanitizeFilename(decodedName, spec.ext)
  }, request, env, 201);
}

// PUT /api/books/multipart/:uploadId/parts/:partNumber —— 上传单片
export async function uploadBookPart(request, env, uploadId, partNumberRaw) {
  const { user } = await requireAdmin(request, env);
  if (!env.R2_BUCKET) throw new HttpError(503, '存储未配置（缺少 R2_BUCKET 绑定）');
  if (!request.body) throw new HttpError(422, '缺少分片内容（应把这一片的字节作为 body 发送）');

  const { key } = await resolveTicket(request, env, user);

  const partNumber = Number(partNumberRaw);
  const totalParts = Number(new URL(request.url).searchParams.get('parts'));
  const declaredLength = Number(request.headers.get('content-length'));
  // 片长校验（除最后一片外每片 ≥ 5MiB）。content-length 缺失时跳过预检，交给 R2 兜底。
  if (Number.isFinite(declaredLength) && declaredLength > 0) {
    const problem = checkPartSize(declaredLength, partNumber, totalParts);
    if (problem) throw new HttpError(422, problem);
  } else if (!Number.isInteger(partNumber) || partNumber < 1) {
    throw new HttpError(422, '分片序号非法');
  }

  try {
    const upload = env.R2_BUCKET.resumeMultipartUpload(key, uploadId);
    const part = await upload.uploadPart(partNumber, request.body);
    return ok({ part_number: part.partNumber, etag: part.etag }, request, env);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.error('分片上传失败:', key, partNumber, err?.message || err);
    throw new HttpError(502, '分片上传失败，请重试该分片');
  }
}

// POST /api/books/multipart/:uploadId/complete —— 合并并入库
export async function completeBookMultipart(request, env, uploadId) {
  const { db, user } = await requireAdmin(request, env);
  if (!env.R2_BUCKET) throw new HttpError(503, '存储未配置（缺少 R2_BUCKET 绑定）');

  const { key } = await resolveTicket(request, env, user);
  const body = await readJson(request);

  const totalParts = Number(new URL(request.url).searchParams.get('parts'));
  let parts;
  try {
    parts = normalizeCompletedParts(body.parts, Number.isInteger(totalParts) ? totalParts : undefined);
  } catch (err) {
    throw new HttpError(422, err?.message || '分片清单非法');
  }

  const size = Number(body.size);
  if (!isWithinMultipartBookLimit(size)) throw new HttpError(413, '图书大小超出保护上限');

  // 文件名与格式由 ticket 对应的 key 后缀决定（创建时已嗅探并锁定）
  const ext = key.slice(key.lastIndexOf('.') + 1);
  const format = Object.entries(BOOK_FORMATS).find(([, v]) => v.ext === ext)?.[0] || 'pdf';
  const spec = BOOK_FORMATS[format];

  let decodedName = '';
  try { decodedName = decodeURIComponent(String(body.name || '')); } catch { decodedName = String(body.name || ''); }

  const upload = env.R2_BUCKET.resumeMultipartUpload(key, uploadId);
  let object;
  try {
    object = await upload.complete(parts);
  } catch (err) {
    console.error('分片合并失败:', key, err?.message || err);
    throw new HttpError(502, '分片合并失败，请重新上传');
  }

  const realSize = Number(object?.size) || size || 0;
  const etag = object?.httpEtag || null;
  const row = await finalizeBookUpload(env, db, user, {
    objectKey: key, size: realSize, etag, decodedName, spec, format, origin: requestOrigin(request, env)
  });
  return ok(shape(row), request, env, 201);
}

// DELETE /api/books/multipart/:uploadId —— 放弃上传（abort，清掉 R2 上的临时分片）
export async function abortBookMultipart(request, env, uploadId) {
  const { user } = await requireAdmin(request, env);
  if (!env.R2_BUCKET) throw new HttpError(503, '存储未配置（缺少 R2_BUCKET 绑定）');

  const { key } = await resolveTicket(request, env, user);
  try {
    await env.R2_BUCKET.resumeMultipartUpload(key, uploadId).abort();
  } catch (err) {
    // 已经合并/已中止的上传再 abort 会报错，这里不视为失败
    console.warn('放弃分片上传时出错（可忽略）:', key, err?.message || err);
  }
  return ok({ aborted: true }, request, env);
}

// ---------------------------------------------------------------
// GET /api/books —— 列出
// ---------------------------------------------------------------
export async function listBooks(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 60, 1), 200);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
  const format = url.searchParams.get('format');

  const filters = {
    select: SELECT,
    user_id: `eq.${user.id}`,
    order: 'sort_order.desc,created_at.desc',
    limit: String(limit),
    offset: String(offset)
  };
  // 访客只看公开书：必须在查询层过滤（Worker 用 service_role，RLS 不替它过滤）
  if (user.isGuest) filters.is_public = 'eq.true';
  if (format && BOOK_FORMATS[format]) filters.format = `eq.${format}`;

  const { data, cache } = await cachedData(request, env, {
    key: `books/${user.id}/${limit}/${offset}/${format || ''}`,
    ttl: 300,
    user,
    versionNs: `books/${user.id}`,
    load: async () => {
      const rows = await db.select(TABLE, qs(filters));
      const items = rows.map(shape);
      return { items, count: items.length, limit, offset };
    }
  });
  return json({ data }, { headers: { 'X-List-Cache': cache } }, request, env);
}

// 读取单本可读的书：公开书人人可读；私人书只有本人能读。
// 查不到一律 404，不泄露「存在但没权限」。
// 内部查询额外带上 user_id / object_key / cover_key（白名单只作用于对外结构）。
async function findReadableBook(db, user, id) {
  const rows = await db.select(TABLE, qs({
    select: 'id,user_id,is_public,object_key,cover_key,mime_type,format,original_name,etag',
    id: `eq.${id}`,
    limit: '1'
  }));
  const row = rows[0];
  if (!row) return null;
  if (row.is_public === true) return row;
  // 私人书：只有本人可读（访客上下文的 user.id 是站长 id，但 isGuest 恒 true，不会走到这里）
  if (user.isGuest) return null;
  return row.user_id === user.id ? row : null;
}

// ---------------------------------------------------------------
// GET /api/books/:id —— 单本元数据
// ---------------------------------------------------------------
export async function getBook(request, env, id) {
  requireUuid(id, 'id');
  const { db, user } = await requireAuth(request, env);
  const rows = await db.select(TABLE, qs({ select: SELECT, id: `eq.${id}`, limit: '1' }));
  const row = rows[0];
  if (!row) throw new HttpError(404, '图书不存在');
  if (!row.is_public) {
    if (user.isGuest) throw new HttpError(404, '图书不存在');
    const own = await db.select(TABLE, qs({ select: 'id', id: `eq.${id}`, user_id: `eq.${user.id}` }));
    if (!own.length) throw new HttpError(404, '图书不存在');
  }
  return ok(shape(row), request, env);
}

// 从 R2 返回一个对象，支持 Range（浏览器内嵌 PDF / 阅读器按需取字节都要它）
async function serveObject(request, env, objectKey, { mime, filename, immutable = true, fallbackEtag = '', forceDownload = false }) {
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
  if (!object) throw new HttpError(404, '文件缺失');

  const headers = {
    // 前端在**另一个域**（dora.xuguochen.de5.net）上，EPUB 阅读器要 fetch 正文，
    // 因此正文响应必须带 CORS 头；否则 fetch 会被浏览器拦下（iframe / img 不受影响）。
    ...corsHeaders(request, env),
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
    ETag: object.httpEtag || fallbackEtag || '"unknown"',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=60',
    'X-Content-Type-Options': 'nosniff'
  };
  if (filename) {
    // ?download=1 → attachment 强制下载；默认 inline 让浏览器直接预览。
    // 跨域场景下 <a download> 会被浏览器忽略，所以下载必须由后端用
    // Content-Disposition 决定，不能只靠前端的 download 属性。
    const kind = forceDownload ? 'attachment' : 'inline';
    headers['Content-Disposition'] = `${kind}; filename*=UTF-8''${encodeURIComponent(filename)}`;
  }

  // Range 命中时 R2 会返回带 range 信息的对象
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
// GET /api/books/:id/file —— 正文（公开可读 + Range）
// ---------------------------------------------------------------
export async function getBookFile(request, env, id) {
  requireUuid(id, 'id');
  const { db, user } = await requireAuth(request, env);
  const row = await findReadableBook(db, user, id);
  if (!row) throw new HttpError(404, '图书不存在');
  if (!env.R2_BUCKET) throw new HttpError(503, '存储未配置');

  const wantsDownload = new URL(request.url).searchParams.get('download') === '1';
  return serveObject(request, env, row.object_key, {
    mime: row.mime_type,
    filename: row.original_name || `book.${row.format}`,
    immutable: true,
    fallbackEtag: row.etag || '',
    forceDownload: wantsDownload
  });
}

// ---------------------------------------------------------------
// GET /api/books/:id/cover —— 封面（公开可读）
// ---------------------------------------------------------------
export async function getBookCover(request, env, id) {
  requireUuid(id, 'id');
  const { db, user } = await requireAuth(request, env);
  const row = await findReadableBook(db, user, id);
  if (!row) throw new HttpError(404, '图书不存在');
  if (!row.cover_key) throw new HttpError(404, '这本书没有封面');
  if (!env.R2_BUCKET) throw new HttpError(503, '存储未配置');

  const head = await env.R2_BUCKET.head(row.cover_key);
  const mime = head?.httpMetadata?.contentType || 'image/jpeg';
  return serveObject(request, env, row.cover_key, { mime, filename: null, immutable: true });
}

// ---------------------------------------------------------------
// PATCH /api/books/:id —— 改元数据（仅本人）
// ---------------------------------------------------------------
export async function updateBook(request, env, id) {
  const { db, user } = await requireAdmin(request, env);
  requireUuid(id, 'id');
  const body = await readJson(request);

  const patch = {};
  const title = optionalString(body.title, 'title', { max: 300 });
  const author = optionalString(body.author, 'author', { max: 200 });
  const description = optionalString(body.description, 'description', { max: 2000 });
  const isPublic = optionalBool(body.is_public, 'is_public');
  const sortOrder = optionalInt(body.sort_order, 'sort_order', { min: -10000, max: 10000 });
  if (title !== undefined) patch.title = title;
  if (author !== undefined) patch.author = author;
  if (description !== undefined) patch.description = description;
  if (isPublic !== undefined) patch.is_public = isPublic;
  if (sortOrder !== undefined) patch.sort_order = sortOrder;
  if (!Object.keys(patch).length) throw new HttpError(422, '没有可更新的字段');

  const rows = await db.update(TABLE, qs({ id: `eq.${id}`, user_id: `eq.${user.id}` }), patch);
  if (!rows.length) throw new HttpError(404, '图书不存在或无权限');
  await bumpVersion(`books/${user.id}`, env);
  return ok(shape(rows[0]), request, env);
}

// ---------------------------------------------------------------
// DELETE /api/books/:id —— 删除（同时删正文 + 封面两个 R2 对象）
// ---------------------------------------------------------------
export async function deleteBook(request, env, id) {
  const { db, user } = await requireAdmin(request, env);
  requireUuid(id, 'id');

  const rows = await db.select(TABLE, qs({
    select: 'id,object_key,cover_key', id: `eq.${id}`, user_id: `eq.${user.id}`
  }));
  if (!rows.length) throw new HttpError(404, '图书不存在或无权限');
  const book = rows[0];

  if (!env.R2_BUCKET) throw new HttpError(503, '存储未配置');
  try {
    await env.R2_BUCKET.delete(book.object_key);
    if (book.cover_key) await env.R2_BUCKET.delete(book.cover_key);
  } catch (err) {
    console.error('R2 delete 失败:', book.object_key, err?.message || err);
    throw new HttpError(502, '删除存储对象失败，请稍后重试');
  }

  await db.remove(TABLE, qs({ id: `eq.${id}`, user_id: `eq.${user.id}` }));
  console.log(`books 删除: id=${id} key=${book.object_key}`);
  await bumpVersion(`books/${user.id}`, env);
  return ok({ id, deleted: true }, request, env);
}

// 供前端 / 文档引用的能力位（避免前后端各写一份）
export const BOOK_READ_MODES = { pdf: 'inline', epub: 'reader' };
