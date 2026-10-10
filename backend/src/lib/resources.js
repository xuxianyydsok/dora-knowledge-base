// 资源公共逻辑：标签关联、进度读写、列表组装
// 所有操作显式带 user_id，确保数据隔离

import { qs } from './supabase.js';
import { HttpError } from './response.js';

// 覆盖式设置资源的标签关联
export async function setResourceTags(db, resourceId, userId, tagIds) {
  if (!Array.isArray(tagIds)) return;
  // 先清空该资源的标签关联，再写入新的（必须带 user_id，避免误删/误写他人关联）
  await db.remove('resource_tags', qs({
    resource_id: `eq.${resourceId}`,
    user_id: `eq.${userId}`
  }));
  const unique = [...new Set(tagIds)];
  if (unique.length === 0) return;
  const rows = unique.map((tagId) => ({ resource_id: resourceId, tag_id: tagId, user_id: userId }));
  await db.request('resource_tags', {
    method: 'POST',
    body: rows,
    prefer: 'return=representation,resolution=merge-duplicates'
  });
}

// 读取多个资源的标签（resource_id -> [{id,name,color}]）
export async function loadTagsForResources(db, resourceIds) {
  if (!resourceIds.length) return {};
  const links = await db.select(
    'resource_tags',
    qs({ select: 'resource_id,tag_id', resource_id: `in.(${resourceIds.join(',')})` })
  );
  if (!links.length) return {};
  const tagIds = [...new Set(links.map((l) => l.tag_id))];
  const tags = await db.select('tags', qs({ select: 'id,name,color', id: `in.(${tagIds.join(',')})` }));
  const tagMap = Object.fromEntries(tags.map((t) => [t.id, t]));
  const result = {};
  for (const link of links) {
    const tag = tagMap[link.tag_id];
    if (!tag) continue;
    (result[link.resource_id] ||= []).push(tag);
  }
  return result;
}

// 为资源列表附加 tags 字段
export async function withTags(db, resources) {
  const list = Array.isArray(resources) ? resources : [resources];
  const ids = list.map((r) => r.id).filter(Boolean);
  const tagMap = await loadTagsForResources(db, ids);
  return list.map((r) => ({ ...r, tags: tagMap[r.id] || [] }));
}

// 读取用户对某资源的进度
export async function getProgress(db, userId, resourceId) {
  const rows = await db.select(
    'user_progress',
    qs({ user_id: `eq.${userId}`, resource_id: `eq.${resourceId}`, select: '*' })
  );
  return rows[0] || null;
}

// 写入/更新进度（upsert）
export async function upsertProgress(db, userId, resourceId, { position, duration, progress, completed }) {
  const patch = { user_id: userId, resource_id: resourceId };
  if (position !== undefined) patch.position = position;
  if (duration !== undefined) patch.duration = duration;
  if (progress !== undefined) patch.progress = progress;
  if (completed !== undefined) patch.completed = completed;

  // PostgREST 的 upsert 默认按主键判冲突；(user_id, resource_id) 是普通唯一约束，
  // 必须显式给 on_conflict，否则第二次保存会报 duplicate key
  const rows = await db.request('user_progress?on_conflict=user_id,resource_id', {
    method: 'POST',
    body: patch,
    prefer: 'return=representation,resolution=merge-duplicates'
  });
  return rows[0];
}

// 校验标签 id 是否属于当前用户，返回合法 id 列表。
// 写操作（创建/更新资源、博客）一律只允许挂当前用户自己的标签，管理员也不例外：
// 管理员若复用他人标签，会在自己的资源上挂出指向他人标签的关联，越权且污染数据。
export async function validateTagIds(db, userId, _isAdmin, tagIds) {
  if (!Array.isArray(tagIds) || tagIds.length === 0) return [];
  const unique = [...new Set(tagIds)];
  const rows = await db.select('tags', qs({
    select: 'id',
    id: `in.(${unique.join(',')})`,
    user_id: `eq.${userId}`
  }));
  return rows.map((r) => r.id);
}

// service_role 会绕过 RLS，因此所有写操作引用的 category_id 都必须在业务层校验归属。
export async function validateCategoryId(db, userId, categoryId) {
  if (categoryId === null || categoryId === undefined) return null;
  const rows = await db.select('categories', qs({
    select: 'id',
    id: `eq.${categoryId}`,
    user_id: `eq.${userId}`
  }));
  if (!rows.length) throw new HttpError(422, '分类不存在或无权限');
  return categoryId;
}
