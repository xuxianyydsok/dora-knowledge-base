// HTML 博客系统
// 正文仅存原生 HTML，支持自定义标签 katex-inline/katex-block/three-scene/mermaid-chart/chart-2d
// 支持关联资源（视频/GitHub/音乐/影视/RSS）与分类、标签
// 权限：普通用户仅操作自己的文章；管理员可 ?all=true 查看全部

import { ok, readJson, HttpError } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import {
  requireString, optionalString, requireUuid, optionalBool, requireEnum, slugify
} from '../lib/validate.js';
import { validateTagIds } from '../lib/resources.js';

const TABLE = 'posts';
const ALLOWED_TAGS = ['katex-inline', 'katex-block', 'three-scene', 'mermaid-chart', 'chart-2d'];

function userFilter(user, all) {
  return user.isAdmin && all ? {} : { user_id: `eq.${user.id}` };
}

// 检测正文使用的重型组件（供前端按需懒加载）
export function detectHeavyTags(content = '') {
  return ALLOWED_TAGS.filter((tag) => content.includes(`<${tag}`));
}

// 覆盖式设置博客标签（写入 post_tags）
async function setPostTags(db, postId, userId, tagIds) {
  if (!Array.isArray(tagIds)) return;
  await db.remove('post_tags', qs({ post_id: `eq.${postId}` }));
  const unique = [...new Set(tagIds)];
  if (unique.length === 0) return;
  await db.request('post_tags', {
    method: 'POST',
    body: unique.map((tagId) => ({ post_id: postId, tag_id: tagId, user_id: userId })),
    prefer: 'return=representation,resolution=merge-duplicates'
  });
}

// 读取博客标签
async function loadPostTags(db, postId) {
  const links = await db.select('post_tags', qs({ select: 'tag_id', post_id: `eq.${postId}` }));
  if (!links.length) return [];
  const ids = links.map((l) => l.tag_id);
  return db.select('tags', qs({ select: 'id,name,color', id: `in.(${ids.join(',')})` }));
}

// 加载文章关联资源（resource_links）
async function loadLinkedResources(db, postId) {
  const links = await db.select(
    'post_resources',
    qs({ select: 'resource_id,relation', post_id: `eq.${postId}`, order: 'sort_order.asc' })
  );
  if (!links.length) return [];
  const ids = [...new Set(links.map((l) => l.resource_id))];
  const resources = await db.select('resources', qs({
    select: 'id,type,title,url,source,summary,metadata', id: `in.(${ids.join(',')})`
  }));
  const map = Object.fromEntries(resources.map((r) => [r.id, r]));
  return links
    .map((l) => (map[l.resource_id] ? { ...map[l.resource_id], relation: l.relation } : null))
    .filter(Boolean);
}

// 覆盖式设置文章关联资源
async function setLinkedResources(db, postId, userId, links) {
  if (!Array.isArray(links)) return;
  await db.remove('post_resources', qs({ post_id: `eq.${postId}` }));
  if (!links.length) return;
  const rows = links.map((l, idx) => ({
    user_id: userId,
    post_id: postId,
    resource_id: l.resource_id,
    relation: l.relation || 'related',
    sort_order: idx
  }));
  await db.request('post_resources', {
    method: 'POST',
    body: rows,
    prefer: 'return=representation,resolution=merge-duplicates'
  });
}

// 校验关联资源归属
async function validateResourceIds(db, user, resourceIds) {
  if (!Array.isArray(resourceIds) || resourceIds.length === 0) return [];
  const unique = [...new Set(resourceIds)];
  const rows = await db.select('resources', qs({
    select: 'id',
    id: `in.(${unique.join(',')})`,
    ...(user.isAdmin ? {} : { user_id: `eq.${user.id}` })
  }));
  return rows.map((r) => r.id);
}

// GET /api/posts
export async function listPosts(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === 'true';

  const filters = { ...userFilter(user, all) };
  const status = url.searchParams.get('status');
  if (status) filters.status = `eq.${requireEnum(status, 'status', ['draft', 'published'])}`;
  const categoryId = url.searchParams.get('category_id');
  if (categoryId) filters.category_id = `eq.${categoryId}`;

  const rows = await db.select(TABLE, qs({
    select: 'id,user_id,title,slug,excerpt,cover_path,status,category_id,is_public,published_at,created_at,updated_at',
    ...filters,
    order: 'updated_at.desc'
  }));
  return ok(rows, request, env);
}

// GET /api/posts/:id
export async function getPost(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');

  const rows = await db.select(TABLE, qs({
    select: '*', id: `eq.${id}`,
    ...(user.isAdmin ? {} : { user_id: `eq.${user.id}` })
  }));
  if (!rows.length) throw new HttpError(404, '文章不存在或无权限');

  const post = rows[0];
  const linked = await loadLinkedResources(db, id);
  const tags = await loadPostTags(db, id);
  return ok({
    ...post,
    tags,
    linked_resources: linked,
    heavy_tags: detectHeavyTags(post.content)
  }, request, env);
}

// GET /api/posts/slug/:slug  —— 按 slug 读取（阅读页友好）
export async function getPostBySlug(request, env, slug) {
  const { db, user } = await requireAuth(request, env);
  const rows = await db.select(TABLE, qs({
    select: '*', slug: `eq.${slug}`,
    ...(user.isAdmin ? {} : { user_id: `eq.${user.id}` })
  }));
  if (!rows.length) throw new HttpError(404, '文章不存在或无权限');
  const post = rows[0];
  const linked = await loadLinkedResources(db, post.id);
  const tags = await loadPostTags(db, post.id);
  return ok({ ...post, tags, linked_resources: linked, heavy_tags: detectHeavyTags(post.content) }, request, env);
}

// POST /api/posts
export async function createPost(request, env) {
  const { db, user } = await requireAuth(request, env);
  const body = await readJson(request);

  const title = requireString(body.title, 'title', { max: 300 });
  const content = optionalString(body.content, 'content', { max: 500000 }) ?? '';
  const status = body.status === undefined ? 'draft' : requireEnum(body.status, 'status', ['draft', 'published']);
  const slug = body.slug ? slugify(requireString(body.slug, 'slug')) : slugify(title);

  let categoryId = null;
  if (body.category_id !== undefined && body.category_id !== null) {
    categoryId = requireUuid(body.category_id, 'category_id');
  }

  const rows = await db.insert(TABLE, {
    user_id: user.id,
    title,
    slug,
    content,
    excerpt: optionalString(body.excerpt, 'excerpt', { max: 1000 }) ?? null,
    cover_path: optionalString(body.cover_path, 'cover_path', { max: 500 }) ?? null,
    status,
    category_id: categoryId,
    is_public: optionalBool(body.is_public, 'is_public') ?? false,
    published_at: status === 'published' ? new Date().toISOString() : null
  });
  const post = rows[0];

  if (body.tag_ids !== undefined) {
    const tagIds = await validateTagIds(db, user.id, user.isAdmin, body.tag_ids);
    await setPostTags(db, post.id, user.id, tagIds);
  }
  if (body.linked_resources !== undefined) {
    const validIds = await validateResourceIds(db, user, (body.linked_resources || []).map((l) => l.resource_id));
    const links = (body.linked_resources || []).filter((l) => validIds.includes(l.resource_id));
    await setLinkedResources(db, post.id, user.id, links);
  }

  const linked = await loadLinkedResources(db, post.id);
  const tags = await loadPostTags(db, post.id);
  return ok({ ...post, tags, linked_resources: linked, heavy_tags: detectHeavyTags(content) }, request, env, 201);
}

// PATCH /api/posts/:id
export async function updatePost(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');
  const body = await readJson(request);

  const patch = {};
  if (body.title !== undefined) {
    patch.title = requireString(body.title, 'title', { max: 300 });
    if (body.slug === undefined) patch.slug = slugify(patch.title);
  }
  if (body.slug !== undefined) patch.slug = slugify(requireString(body.slug, 'slug'));
  if (body.content !== undefined) patch.content = optionalString(body.content, 'content', { max: 500000 }) ?? '';
  if (body.excerpt !== undefined) patch.excerpt = optionalString(body.excerpt, 'excerpt', { max: 1000 }) ?? null;
  if (body.cover_path !== undefined) patch.cover_path = optionalString(body.cover_path, 'cover_path', { max: 500 }) ?? null;
  if (body.category_id !== undefined) {
    patch.category_id = body.category_id === null ? null : requireUuid(body.category_id, 'category_id');
  }
  if (body.is_public !== undefined) patch.is_public = optionalBool(body.is_public, 'is_public');
  if (body.status !== undefined) {
    patch.status = requireEnum(body.status, 'status', ['draft', 'published']);
    if (patch.status === 'published') patch.published_at = new Date().toISOString();
  }

  if (Object.keys(patch).length > 0) {
    const rows = await db.update(TABLE, qs({
      id: `eq.${id}`,
      ...(user.isAdmin ? {} : { user_id: `eq.${user.id}` })
    }), patch);
    if (!rows.length) throw new HttpError(404, '文章不存在或无权限');
  }

  if (body.tag_ids !== undefined) {
    const tagIds = await validateTagIds(db, user.id, user.isAdmin, body.tag_ids);
    await setPostTags(db, id, user.id, tagIds);
  }
  if (body.linked_resources !== undefined) {
    const validIds = await validateResourceIds(db, user, (body.linked_resources || []).map((l) => l.resource_id));
    const links = (body.linked_resources || []).filter((l) => validIds.includes(l.resource_id));
    await setLinkedResources(db, id, user.id, links);
  }

  const rows = await db.select(TABLE, qs({
    select: '*', id: `eq.${id}`,
    ...(user.isAdmin ? {} : { user_id: `eq.${user.id}` })
  }));
  if (!rows.length) throw new HttpError(404, '文章不存在或无权限');
  const post = rows[0];
  const linked = await loadLinkedResources(db, post.id);
  const tags = await loadPostTags(db, post.id);
  return ok({ ...post, tags, linked_resources: linked, heavy_tags: detectHeavyTags(post.content) }, request, env);
}

// DELETE /api/posts/:id
export async function deletePost(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');
  await db.remove('post_resources', qs({ post_id: `eq.${id}` }));
  await db.remove('post_tags', qs({ post_id: `eq.${id}` }));
  const rows = await db.remove(TABLE, qs({
    id: `eq.${id}`,
    ...(user.isAdmin ? {} : { user_id: `eq.${user.id}` })
  }));
  if (!rows.length) throw new HttpError(404, '文章不存在或无权限');
  return ok({ id }, request, env);
}
