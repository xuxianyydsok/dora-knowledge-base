// JSON 导入导出备份
// 导出：当前用户全部资源（分类/标签/视频/GitHub/博客/收藏/进度）
// 导入：按「分类 -> 标签 -> 资源 -> 博客」顺序恢复，ID 重新映射
// 权限：普通用户仅导出/导入自己数据；管理员可 ?all=true 导出全部

import { ok, readJson, HttpError } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';

const BACKUP_VERSION = 1;

// GET /api/backup/export
export async function exportBackup(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === 'true' && user.isAdmin;
  const scope = all ? {} : { user_id: `eq.${user.id}` };

  const [categories, tags, resources, posts, favorites, progress, postResources, postTags, resourceTags] =
    await Promise.all([
      db.select('categories', qs({ select: '*', ...scope })),
      db.select('tags', qs({ select: '*', ...scope })),
      db.select('resources', qs({ select: '*', ...scope })),
      db.select('posts', qs({ select: '*', ...scope })),
      db.select('favorites', qs({ select: '*', ...scope })),
      db.select('user_progress', qs({ select: '*', ...scope })),
      db.select('post_resources', qs({ select: '*', ...scope })),
      db.select('post_tags', qs({ select: '*', ...scope })),
      db.select('resource_tags', qs({ select: '*', ...scope }))
    ]);

  return ok({
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    user_id: user.id,
    data: {
      categories, tags, resources, posts, favorites, progress,
      post_resources: postResources,
      post_tags: postTags,
      resource_tags: resourceTags
    }
  }, request, env);
}

// POST /api/backup/import
// body: { data: { ... }, mode: 'merge' | 'replace' }
export async function importBackup(request, env) {
  const { db, user } = await requireAuth(request, env);
  const body = await readJson(request);
  const data = body.data;
  if (!data || typeof data !== 'object') throw new HttpError(422, '缺少 data 字段');
  if (body.mode && !['merge', 'replace'].includes(body.mode)) {
    throw new HttpError(422, "mode 必须为 'merge' 或 'replace'");
  }

  const stats = { categories: 0, tags: 0, resources: 0, posts: 0, favorites: 0 };

  // merge 模式下，按「名称/slug」复用已有分类与标签，避免重复
  const existingCats = await db.select('categories', qs({ select: 'id,slug', user_id: `eq.${user.id}` }));
  const existingTags = await db.select('tags', qs({ select: 'id,slug', user_id: `eq.${user.id}` }));
  const catMap = Object.fromEntries(existingCats.map((c) => [c.slug, c.id]));
  const tagMap = Object.fromEntries(existingTags.map((t) => [t.slug, t.id]));
  const idMap = { categories: {}, tags: {}, resources: {}, posts: {} };

  // 1) 分类
  for (const c of data.categories || []) {
    if (catMap[c.slug]) { idMap.categories[c.id] = catMap[c.slug]; continue; }
    const rows = await db.insert('categories', {
      user_id: user.id, name: c.name, slug: c.slug,
      description: c.description ?? null, sort_order: c.sort_order ?? 0
    });
    idMap.categories[c.id] = rows[0].id;
    catMap[c.slug] = rows[0].id;
    stats.categories++;
  }

  // 2) 标签
  for (const t of data.tags || []) {
    if (tagMap[t.slug]) { idMap.tags[t.id] = tagMap[t.slug]; continue; }
    const rows = await db.insert('tags', {
      user_id: user.id, name: t.name, slug: t.slug, color: t.color || '#6b7280'
    });
    idMap.tags[t.id] = rows[0].id;
    tagMap[t.slug] = rows[0].id;
    stats.tags++;
  }

  // 3) 资源
  for (const r of data.resources || []) {
    const rows = await db.insert('resources', {
      user_id: user.id,
      type: r.type,
      title: r.title,
      url: r.url ?? null,
      source: r.source ?? null,
      cover_path: r.cover_path ?? null,
      summary: r.summary ?? null,
      category_id: r.category_id ? (idMap.categories[r.category_id] ?? null) : null,
      metadata: r.metadata || {},
      is_public: !!r.is_public
    });
    idMap.resources[r.id] = rows[0].id;
    stats.resources++;
  }

  // 4) 博客
  for (const p of data.posts || []) {
    // slug 冲突时追加后缀
    let slug = p.slug || 'post';
    const dup = await db.select('posts', qs({ select: 'id', user_id: `eq.${user.id}`, slug: `eq.${slug}` }));
    if (dup.length) slug = `${slug}-${Date.now().toString(36)}`;

    const rows = await db.insert('posts', {
      user_id: user.id,
      title: p.title,
      slug,
      content: p.content || '',
      excerpt: p.excerpt ?? null,
      cover_path: p.cover_path ?? null,
      status: p.status || 'draft',
      category_id: p.category_id ? (idMap.categories[p.category_id] ?? null) : null,
      is_public: !!p.is_public,
      published_at: p.published_at ?? null
    });
    idMap.posts[p.id] = rows[0].id;
    stats.posts++;
  }

  // 5) 关联关系（重映射后写入）
  const resourceLinks = (data.post_resources || []).filter(
    (l) => idMap.posts[l.post_id] && idMap.resources[l.resource_id]
  ).map((l) => ({
    user_id: user.id,
    post_id: idMap.posts[l.post_id],
    resource_id: idMap.resources[l.resource_id],
    relation: l.relation || 'related',
    sort_order: l.sort_order ?? 0
  }));
  if (resourceLinks.length) {
    await db.request('post_resources', { method: 'POST', body: resourceLinks, prefer: 'return=representation,resolution=merge-duplicates' });
  }

  const postTagLinks = (data.post_tags || []).filter(
    (l) => idMap.posts[l.post_id] && idMap.tags[l.tag_id]
  ).map((l) => ({ user_id: user.id, post_id: idMap.posts[l.post_id], tag_id: idMap.tags[l.tag_id] }));
  if (postTagLinks.length) {
    await db.request('post_tags', { method: 'POST', body: postTagLinks, prefer: 'return=representation,resolution=merge-duplicates' });
  }

  const resourceTagLinks = (data.resource_tags || []).filter(
    (l) => idMap.resources[l.resource_id] && idMap.tags[l.tag_id]
  ).map((l) => ({ user_id: user.id, resource_id: idMap.resources[l.resource_id], tag_id: idMap.tags[l.tag_id] }));
  if (resourceTagLinks.length) {
    await db.request('resource_tags', { method: 'POST', body: resourceTagLinks, prefer: 'return=representation,resolution=merge-duplicates' });
  }

  // 6) 收藏
  for (const f of data.favorites || []) {
    const payload = { user_id: user.id };
    if (f.resource_id && idMap.resources[f.resource_id]) payload.resource_id = idMap.resources[f.resource_id];
    else if (f.post_id && idMap.posts[f.post_id]) payload.post_id = idMap.posts[f.post_id];
    else continue;
    try {
      await db.request('favorites', { method: 'POST', body: payload, prefer: 'return=representation,resolution=merge-duplicates' });
      stats.favorites++;
    } catch { /* 忽略重复收藏 */ }
  }

  return ok({ imported: stats }, request, env, 201);
}
