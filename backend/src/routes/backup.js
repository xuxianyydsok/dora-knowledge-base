// JSON 导入导出备份
// 导出：当前用户的分类/标签/资源/博客/收藏/关联/扩展表/进度/通知/偏好（v2 全量）
// 导入：按依赖顺序恢复并重新映射 ID；仅支持安全的合并模式（replace 明确拒绝）
// 权限：普通用户仅导出/导入自己数据；管理员可 ?all=true 导出全部
//
// 注意：RSS 模块 2026-10-09 已整体删除，备份不再包含 rss_* 表，也不恢复它们。

import { ok, readJson, HttpError } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';

const BACKUP_VERSION = 2;

// GET /api/backup/export
export async function exportBackup(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === 'true' && user.isAdmin;
  const scope = all ? {} : { user_id: `eq.${user.id}` };

  const [
    categories, tags, resources, posts, favorites, progress,
    postResources, postTags, resourceTags, resourceLinks,
    musicTracks, movieTitles, notifications, preferences
  ] =
    await Promise.all([
      db.select('categories', qs({ select: '*', ...scope })),
      db.select('tags', qs({ select: '*', ...scope })),
      db.select('resources', qs({ select: '*', ...scope })),
      db.select('posts', qs({ select: '*', ...scope })),
      db.select('favorites', qs({ select: '*', ...scope })),
      db.select('user_progress', qs({ select: '*', ...scope })),
      db.select('post_resources', qs({ select: '*', ...scope })),
      db.select('post_tags', qs({ select: '*', ...scope })),
      db.select('resource_tags', qs({ select: '*', ...scope })),
      db.select('resource_links', qs({ select: '*', ...scope })),
      db.select('music_tracks', qs({ select: '*', ...scope })),
      db.select('movie_titles', qs({ select: '*', ...scope })),
      db.select('notifications', qs({ select: '*', ...scope })),
      db.select('user_preferences', qs({ select: '*', ...scope }))
    ]);

  return ok({
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    user_id: user.id,
    data: {
      categories, tags, resources, posts, favorites, progress,
      post_resources: postResources,
      post_tags: postTags,
      resource_tags: resourceTags,
      resource_links: resourceLinks,
      music_tracks: musicTracks,
      movie_titles: movieTitles,
      notifications,
      user_preferences: preferences
    }
  }, request, env);
}

// POST /api/backup/import
// body: { data: { ... }, mode: 'merge' }
export async function importBackup(request, env) {
  const { db, user } = await requireAuth(request, env);
  const body = await readJson(request);
  const data = body.data;
  if (!data || typeof data !== 'object') throw new HttpError(422, '缺少 data 字段');
  if (body.mode === 'replace') {
    throw new HttpError(422, '替换恢复尚未安全实现，请使用合并模式');
  }
  if (body.mode && body.mode !== 'merge') {
    throw new HttpError(422, "mode 必须为 'merge'");
  }

  const stats = {
    categories: 0, tags: 0, resources: 0, posts: 0, favorites: 0,
    music_tracks: 0, movie_titles: 0, progress: 0, notifications: 0, preferences: 0
  };

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

  // 4) 资源扩展表（备份 v2；v1 无这些字段，保持向后兼容）
  for (const t of data.music_tracks || []) {
    const resourceId = idMap.resources[t.resource_id];
    if (!resourceId) continue;
    await db.insert('music_tracks', {
      resource_id: resourceId,
      user_id: user.id,
      artist: t.artist ?? null,
      album: t.album ?? null,
      artwork_url: t.artwork_url ?? null,
      audio_url: t.audio_url ?? null,
      preview_url: t.preview_url ?? null,
      duration: t.duration ?? null,
      genre: t.genre ?? null,
      release_year: t.release_year ?? null,
      notes: t.notes ?? null,
      lyrics: t.lyrics ?? null,
      quality: t.quality || 'full',
      artist_avatar: t.artist_avatar ?? null,
      audio_fallbacks: t.audio_fallbacks ?? null
    });
    stats.music_tracks++;
  }

  for (const t of data.movie_titles || []) {
    const resourceId = idMap.resources[t.resource_id];
    if (!resourceId) continue;
    await db.insert('movie_titles', {
      resource_id: resourceId,
      user_id: user.id,
      media_type: t.media_type || 'movie',
      original_title: t.original_title ?? null,
      director: t.director ?? null,
      cast_list: t.cast_list ?? null,
      genres: t.genres ?? null,
      release_date: t.release_date ?? null,
      runtime: t.runtime ?? null,
      rating: t.rating ?? null,
      overview: t.overview ?? null,
      poster_url: t.poster_url ?? null,
      backdrop_url: t.backdrop_url ?? null,
      external_id: t.external_id ?? null,
      source: t.source ?? null,
      notes: t.notes ?? null,
      external_url: t.external_url ?? null,
      source_key: t.source_key ?? null,
      source_vod_id: t.source_vod_id ?? null,
      routes: t.routes ?? null,
      area: t.area ?? null,
      remarks: t.remarks ?? null
    });
    stats.movie_titles++;
  }

  // 5) 博客
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

  // 6) 关联关系（重映射后写入）
  const postResourceLinks = (data.post_resources || []).filter(
    (l) => idMap.posts[l.post_id] && idMap.resources[l.resource_id]
  ).map((l) => ({
    user_id: user.id,
    post_id: idMap.posts[l.post_id],
    resource_id: idMap.resources[l.resource_id],
    relation: l.relation || 'related',
    sort_order: l.sort_order ?? 0
  }));
  if (postResourceLinks.length) {
    await db.request('post_resources', { method: 'POST', body: postResourceLinks, prefer: 'return=representation,resolution=merge-duplicates' });
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

  // 资源与资源之间的关联（resource_links）
  const linkedResources = (data.resource_links || []).filter(
    (l) => idMap.resources[l.from_resource] && idMap.resources[l.to_resource]
  ).map((l) => ({
    user_id: user.id,
    from_resource: idMap.resources[l.from_resource],
    to_resource: idMap.resources[l.to_resource],
    relation: l.relation || 'related'
  }));
  if (linkedResources.length) {
    await db.request('resource_links', { method: 'POST', body: linkedResources, prefer: 'return=representation,resolution=merge-duplicates' });
  }

  // 7) 收藏、播放进度、通知与偏好
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

  for (const p of data.progress || []) {
    const resourceId = idMap.resources[p.resource_id];
    if (!resourceId) continue;
    await db.request('user_progress?on_conflict=user_id,resource_id', {
      method: 'POST',
      body: {
        user_id: user.id,
        resource_id: resourceId,
        position: p.position ?? 0,
        duration: p.duration ?? null,
        progress: p.progress ?? 0,
        completed: !!p.completed
      },
      prefer: 'return=representation,resolution=merge-duplicates'
    });
    stats.progress++;
  }

  for (const n of data.notifications || []) {
    await db.insert('notifications', {
      user_id: user.id,
      type: n.type || 'system',
      title: n.title || '恢复的通知',
      body: n.body ?? null,
      link: n.link ?? null,
      is_read: !!n.is_read
    });
    stats.notifications++;
  }

  const preference = Array.isArray(data.user_preferences)
    ? data.user_preferences[0]
    : data.user_preferences;
  if (preference?.theme && typeof preference.theme === 'object') {
    await db.request('user_preferences?on_conflict=user_id', {
      method: 'POST',
      body: { user_id: user.id, theme: preference.theme },
      prefer: 'return=representation,resolution=merge-duplicates'
    });
    stats.preferences = 1;
  }

  return ok({ imported: stats }, request, env, 201);
}
