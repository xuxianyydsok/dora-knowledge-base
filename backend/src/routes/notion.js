// Notion 博客分区（独立表 notion_posts，2026-10-14）
//
// 背景（用户要求）：
//   Notion（NotionNext + Vercel）那一批文章要迁进站，但**必须与早年从 Halo 导入的
//   posts 表物理隔离**：「只需要让它们做一定的隔离，但是排版可以沿用之前的」。
//   因此数据层完全独立（独立表 + 独立接口），只在**前端排版组件**层面复用同一套。
//
// 与 routes/posts.js 的三点差异：
//   1. 列表接口**不下发正文**：207 篇正文合计近 800 KB，列表页一行都用不到，
//      正文只从 /api/notion-posts/slug/:slug 取（PostgREST 侧也只 select 元数据列）。
//   2. 没有分类表 / 标签关联表：notion_category 与 tags 都是行内字段，
//      分类由前端从列表里聚合出来（少一次往返，也少两张表）。
//   3. 不下发 password_hash：它是为后续「博客密码锁」预留的列，永远不出网。
//
// 访客边界沿用 posts 的口径：只看 status='published' 且 is_public=true
// （Worker 用 service_role 直连 PostgREST，RLS 不会替它过滤，必须在查询层显式带上）。

import { ok, HttpError } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { requireString, requireEnum } from '../lib/validate.js';
import { guestPostFilters, isPostVisibleToGuest, isMediaPublic } from '../lib/publicScope.js';

const TABLE = 'notion_posts';

// 列表投影：刻意剔除 content（大字段）与 password_hash（敏感字段）
const LIST_COLUMNS = [
  'id', 'title', 'slug', 'excerpt', 'cover_path', 'status',
  'published_at', 'created_at', 'updated_at',
  'notion_category', 'notion_icon', 'notion_summary', 'tags',
  'parent_slug', 'is_subpage', 'sort_order', 'is_locked', 'is_blank'
].join(',');

// 阅读页里「父页面 / 子页面 / 同级」导航用的轻量投影
const NAV_COLUMNS = 'id,title,slug,notion_icon,notion_category,is_blank,published_at';

// 封面地址归一化（2026-10-14 实测发现的问题）：
// 迁移载荷里的 cover_path 是 R2 的**对象键**（形如 covers/notion/跨年2026，博客上线.jpg），
// 不是能直接喂给 <img src> 的地址 —— 原样下发会让浏览器去站内找 /covers/... 而 404，
// 61 篇文章集体变破图。这里统一归一化成一个真正可用的地址：
//   · 已是 http(s):// / 协议相对 / 站内绝对路径 / data:  → 原样
//   · 迁移配图的对象键（起点在 MEDIA_PUBLIC_PREFIXES 内）→ /api/media?path=<URL 编码的键>
//     键位与 scripts/notion-blog-import/deliverables/upload_assets.* 一致：
//     封面 covers/notion/<标题>.<ext>、正文插图 notion/<标题>/<文件名>。
//   · 其他 → null，前端回退到默认封面。
// 图片传上 R2 之前该地址会 404，前端 PostCover 会回退默认封面、ArticleReader 会收起失败的图，
// 所以不会出现破图；上传完成后**不需要改代码**就会自动显示。
function coverUrlOf(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^(https?:)?\/\//i.test(s)) return s;
  if (s.startsWith('/') || s.startsWith('data:')) return s;
  if (isMediaPublic(s)) return `/api/media?path=${encodeURIComponent(s)}`;
  return null;
}

// 单条可见性：访客必须同时满足 published + is_public，
// 否则一律按「不存在」处理（不泄露存在性，与 posts.js 一致）。
function assertVisible(post, user) {
  if (!post) throw new HttpError(404, '文章不存在或无权限');
  if (user.isGuest && !isPostVisibleToGuest(post)) throw new HttpError(404, '文章不存在或无权限');
}

// GET /api/notion-posts
// 查询参数：
//   ?all=true            管理员越出本人数据范围（与 posts 的 ?all=true 对称）
//   ?status=draft|published
//   ?category=<分类名>   Notion 原始分类（如「学海无涯」）
//   ?parent_slug=<slug>  只取某篇文章的子页面
//   ?top=true            只要顶层（剔除子页面）
export async function listNotionPosts(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === 'true';

  const filters = user.isAdmin && all ? {} : { user_id: `eq.${user.id}` };
  if (user.isGuest) {
    Object.assign(filters, guestPostFilters());
  } else {
    const status = url.searchParams.get('status');
    if (status) filters.status = `eq.${requireEnum(status, 'status', ['draft', 'published'])}`;
  }

  const category = url.searchParams.get('category');
  if (category) filters.notion_category = `eq.${category}`;
  const parentSlug = url.searchParams.get('parent_slug');
  if (parentSlug) filters.parent_slug = `eq.${parentSlug}`;
  if (url.searchParams.get('top') === 'true') filters.is_subpage = 'eq.false';

  const rows = await db.select(TABLE, qs({
    select: LIST_COLUMNS,
    ...filters,
    // 迁移时 sort_order 统一为 0，所以实际排序落在发布时间上；
    // 没有发布时间的（draft）用 nullslast 推到末尾，不让它们顶到最前面。
    order: 'sort_order.asc,published_at.desc.nullslast,created_at.desc'
  }));
  // 顺手把封面归一化，前端拿到 cover_url 直接可用（null 即用默认封面）
  return ok(rows.map((r) => ({ ...r, cover_url: coverUrlOf(r.cover_path) })), request, env);
}

// GET /api/notion-posts/slug/:slug —— 按 slug 读取正文（Notion 侧 slug 天然唯一且可读）
// 一并返回三份导航数据，阅读页不用再发第二、三个请求：
//   parent   父页面（本页是子页时；用于面包屑）
//   children 子页面列表（用于文章末尾的「本页包含」）
//   siblings 同父下的其它子页面（用于「同目录其它页」）
export async function getNotionPostBySlug(request, env, slug) {
  const { db, user } = await requireAuth(request, env);
  const key = requireString(slug, 'slug', { max: 300 });

  const rows = await db.select(TABLE, qs({
    select: '*',
    slug: `eq.${key}`,
    ...(user.isAdmin ? {} : { user_id: `eq.${user.id}` })
  }));
  assertVisible(rows[0], user);
  const post = rows[0];

  // password_hash 即使全是 null 也不下发（避免日后接入密码锁时漏出去）
  const { password_hash, ...safe } = post;

  const visibility = user.isGuest ? guestPostFilters() : {};
  const children = await db.select(TABLE, qs({
    select: NAV_COLUMNS,
    user_id: `eq.${post.user_id}`,
    parent_slug: `eq.${post.slug}`,
    ...visibility,
    order: 'sort_order.asc,published_at.asc.nullslast,created_at.asc'
  }));

  const parent = post.parent_slug
    ? (await db.select(TABLE, qs({
        select: NAV_COLUMNS,
        user_id: `eq.${post.user_id}`,
        slug: `eq.${post.parent_slug}`,
        ...visibility
      })))[0] || null
    : null;

  const siblings = post.parent_slug
    ? await db.select(TABLE, qs({
        select: NAV_COLUMNS,
        user_id: `eq.${post.user_id}`,
        parent_slug: `eq.${post.parent_slug}`,
        slug: `neq.${post.slug}`,
        ...visibility,
        order: 'sort_order.asc,published_at.asc.nullslast'
      }))
    : [];

  return ok({ ...safe, cover_url: coverUrlOf(safe.cover_path), parent, children, siblings }, request, env);
}
