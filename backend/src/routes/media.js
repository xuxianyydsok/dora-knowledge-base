// 媒体文件（R2）：Notion 迁移配图 + 博客封面 / 正文插图的上传、读取、删除
//
// 背景（2026-10-14）：
//   Notion 迁过来的 207 篇文章里，正文插图在**原稿里就是** `/api/media?path=notion/<slug>/<file>`
//   （NotionNext 站自己的取图端点）。这些文件已由迁移脚本全部下载到本地
//   （423 个：349 张正文插图 + 61 张封面 + 余量），但**必须先把它们传进 R2**，
//   并把键位对上（`notion/<slug>/<filename>` 与 `covers/notion/<slug>.<ext>`），
//   正文插图才会显示。上传脚本见 `scripts/notion-blog-import/deliverables/upload_assets.*`。
//
// ⚠ 与 /api/assets 的分工（那张表按 uuid 读取，是「不许把 R2 变成任意 key 探测器」的既定设计）：
//   本路由按 **key** 读取，天然可枚举。因此公开读**只放行 Notion 迁移这两个前缀**
//   （`notion/` 与 `covers/notion/`）—— 它们全是公开博客的配图，枚举出来也没有额外信息。
//   其余前缀（`posts/` `avatars/` `assets/` …）一律只允许**登录后**读写，避免把私有对象的
//   key 空间暴露给匿名访客。写操作（POST / DELETE）本来就都走 requireAuth。
//
// 接口：
//   GET    /api/media?path=notion/...        读取（公开，仅限 notion/ 与 covers/notion/）
//   POST   /api/media                        上传（multipart/form-data，字段名 file；需登录）
//   DELETE /api/media?path=...               删除（需登录）
//
// 约定：DB 里只存路径字符串，禁止存二进制（见 docs/storage.md）。
import { ok, fail, HttpError } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { isMediaPublic } from '../lib/publicScope.js';

const MAX_BYTES = 10 * 1024 * 1024;   // 单文件 10MB
const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'
]);
const ALLOWED_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'svg']);
const EXT_BY_MIME = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
  'image/gif': 'gif', 'image/avif': 'avif', 'image/svg+xml': 'svg'
};

// 写入允许的前缀（POST 显式指定 path 时的白名单）
const WRITE_PREFIX = ['covers/', 'posts/', 'avatars/', 'notion/'];

function assertKey(key) {
  const clean = String(key || '').trim();
  if (!clean) throw new HttpError(400, '缺少 path 参数');
  if (clean.includes('..') || clean.startsWith('/')) throw new HttpError(400, '非法 path');
  return clean;
}

function pickExt(file) {
  const fromName = (file.name || '').split('.').pop()?.toLowerCase() || '';
  if (ALLOWED_EXT.has(fromName)) return fromName === 'jpeg' ? 'jpg' : fromName;
  return EXT_BY_MIME[file.type] || 'bin';
}

// 生成安全的相对路径
function buildPath(scope, file, explicit) {
  if (explicit) {
    if (!WRITE_PREFIX.some((p) => explicit.startsWith(p))) {
      throw new HttpError(400, `path 必须以 ${WRITE_PREFIX.join(' / ')} 开头`);
    }
    return assertKey(explicit);
  }
  const ext = pickExt(file);
  const rand = crypto.randomUUID().slice(0, 12);
  const ts = Date.now().toString(36);
  if (scope === 'cover') return `covers/notion/${ts}-${rand}.${ext}`;
  if (scope === 'post') return `posts/${ts}-${rand}.${ext}`;
  return `notion/${ts}-${rand}.${ext}`;
}

// GET /api/media?path=... —— 读取
// 公开边界在 middleware/auth.js 里由 PUBLIC_READ_RE 放行；这里再做一次前缀收窄，
// 保证「公开」只覆盖 Notion 迁移配图，其余前缀登录后才读得到。
export async function getMedia(request, env) {
  if (!env.R2_BUCKET) throw new HttpError(503, '存储未配置（缺少 R2_BUCKET 绑定）');
  const key = assertKey(new URL(request.url).searchParams.get('path'));

  if (!isMediaPublic(key)) {
    // 非公开前缀：必须带有效令牌。任何失败都按「不存在」返回，不泄露对象是否存在。
    let guest = true;
    try {
      const ctx = await requireAuth(request, env);
      guest = !!ctx.user.isGuest;
    } catch {
      guest = true;
    }
    if (guest) throw new HttpError(404, '资源不存在');
  }

  const object = await env.R2_BUCKET.get(key);
  if (!object) return fail('资源不存在', 404, request, env);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(object.body, { headers });
}

// POST /api/media —— 上传（multipart/form-data，字段名 file）
export async function uploadMedia(request, env) {
  const { user } = await requireAuth(request, env);
  if (!env.R2_BUCKET) throw new HttpError(503, '存储未配置（缺少 R2_BUCKET 绑定）');

  const ct = request.headers.get('content-type') || '';
  if (!ct.includes('multipart/form-data')) throw new HttpError(415, '请使用 multipart/form-data 上传');

  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') throw new HttpError(400, '缺少 file 字段');
  if (file.size > MAX_BYTES) throw new HttpError(413, `文件过大（上限 ${MAX_BYTES / 1024 / 1024}MB）`);
  if (file.type && !ALLOWED_MIME.has(file.type)) throw new HttpError(415, `不支持的类型：${file.type}`);

  const scope = String(form.get('scope') || 'post');   // cover | post | notion
  const explicit = form.get('path') ? String(form.get('path')) : null;
  const key = buildPath(scope, file, explicit);

  const buf = await file.arrayBuffer();
  await env.R2_BUCKET.put(key, buf, {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
    customMetadata: { uploadedBy: user.id, scope }
  });

  return ok({
    path: key,
    size: file.size,
    contentType: file.type || null,
    url: `/api/media?path=${encodeURIComponent(key)}`
  }, request, env, 201);
}

// DELETE /api/media?path=... —— 删除
export async function deleteMedia(request, env) {
  const { user } = await requireAuth(request, env);
  if (!env.R2_BUCKET) throw new HttpError(503, '存储未配置（缺少 R2_BUCKET 绑定）');

  const key = assertKey(new URL(request.url).searchParams.get('path'));
  if (!WRITE_PREFIX.some((p) => key.startsWith(p))) throw new HttpError(400, '非法 path');

  await env.R2_BUCKET.delete(key);
  return ok({ path: key, deleted: true }, request, env);
}
