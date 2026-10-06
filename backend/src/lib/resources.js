// 资源公共逻辑：标签关联、进度读写、列表组装
// 所有操作显式带 user_id，确保数据隔离

import { qs } from './supabase.js';

// 覆盖式设置资源的标签关联
export async function setResourceTags(db, resourceId, userId, tagIds) {
  if (!Array.isArray(tagIds)) return;
  // 先清空该资源的标签关联，再写入新的
  await db.remove('resource_tags', qs({ resource_id: `eq.${resourceId}` }));
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

  const rows = await db.request('user_progress', {
    method: 'POST',
    body: patch,
    prefer: 'return=representation,resolution=merge-duplicates'
  });
  return rows[0];
}

// 校验标签 id 是否属于当前用户（或管理员可全量），返回合法 id 列表
export async function validateTagIds(db, userId, isAdmin, tagIds) {
  if (!Array.isArray(tagIds) || tagIds.length === 0) return [];
  const unique = [...new Set(tagIds)];
  const query = isAdmin
    ? qs({ select: 'id', id: `in.(${unique.join(',')})` })
    : qs({ select: 'id', id: `in.(${unique.join(',')})`, user_id: `eq.${userId}` });
  const rows = await db.select('tags', query);
  return rows.map((r) => r.id);
}
