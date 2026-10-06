// 通知中心
// 通知类型：rss_new（RSS 新文章）/ link_broken（播放链接失效）/ system（系统）
// 支持未读计数、标记已读/未读、全部已读、删除
// 权限：普通用户仅自己的通知；管理员可 ?all=true 查看全部

import { ok, readJson, HttpError } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { requireString, optionalString, requireUuid, requireEnum } from '../lib/validate.js';
import { checkLink } from '../lib/linkcheck.js';

const TYPES = ['rss_new', 'link_broken', 'system'];

// GET /api/notifications?unread=true&type=rss_new&limit=50
export async function listNotifications(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === 'true' && user.isAdmin;

  const filters = { select: '*', order: 'created_at.desc' };
  if (!all) filters.user_id = `eq.${user.id}`;
  if (url.searchParams.get('unread') === 'true') filters.is_read = 'eq.false';
  const type = url.searchParams.get('type');
  if (type) filters.type = `eq.${requireEnum(type, 'type', TYPES)}`;
  filters.limit = String(Math.min(Number(url.searchParams.get('limit')) || 50, 200));

  const rows = await db.select('notifications', qs(filters));
  return ok(rows, request, env);
}

// GET /api/notifications/count —— 未读数量（用于徽标）
export async function countUnread(request, env) {
  const { db, user } = await requireAuth(request, env);
  const rows = await db.select('notifications', qs({
    select: 'id', user_id: `eq.${user.id}`, is_read: 'eq.false'
  }));
  return ok({ unread: rows.length }, request, env);
}

// POST /api/notifications —— 创建通知（用户自建；管理员可指定 user_id）
export async function createNotification(request, env) {
  const { db, user } = await requireAuth(request, env);
  const body = await readJson(request);

  const type = requireEnum(body.type || 'system', 'type', TYPES);
  const title = requireString(body.title, 'title', { max: 200 });

  let targetUser = user.id;
  if (body.user_id !== undefined && body.user_id !== null && body.user_id !== user.id) {
    if (!user.isAdmin) throw new HttpError(403, '仅管理员可为其他用户创建通知');
    targetUser = requireUuid(body.user_id, 'user_id');
  }

  const rows = await db.insert('notifications', {
    user_id: targetUser,
    type,
    title,
    body: optionalString(body.body, 'body', { max: 2000 }) ?? null,
    link: optionalString(body.link, 'link', { max: 1000 }) ?? null,
    is_read: false
  });
  return ok(rows[0], request, env, 201);
}

// PATCH /api/notifications/:id —— 标记已读/未读
export async function updateNotification(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');
  const body = await readJson(request);
  if (typeof body.is_read !== 'boolean') throw new HttpError(422, 'is_read 必须为布尔值');

  const rows = await db.update('notifications', qs({
    id: `eq.${id}`,
    user_id: `eq.${user.id}`
  }), { is_read: body.is_read });
  if (!rows.length) throw new HttpError(404, '通知不存在或无权限');
  return ok(rows[0], request, env);
}

// PATCH /api/notifications/read-all —— 全部标记已读
export async function markAllRead(request, env) {
  const { db, user } = await requireAuth(request, env);
  const rows = await db.update('notifications', qs({
    user_id: `eq.${user.id}`, is_read: 'eq.false'
  }), { is_read: true });
  return ok({ updated: rows.length }, request, env);
}

// DELETE /api/notifications/:id
export async function deleteNotification(request, env, id) {
  const { db, user } = await requireAuth(request, env);
  requireUuid(id, 'id');
  const rows = await db.remove('notifications', qs({
    id: `eq.${id}`,
    user_id: `eq.${user.id}`
  }));
  if (!rows.length) throw new HttpError(404, '通知不存在或无权限');
  return ok({ id }, request, env);
}

// DELETE /api/notifications —— 清空（可选仅已读）
export async function clearNotifications(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);
  const onlyRead = url.searchParams.get('read') === 'true';
  const rows = await db.remove('notifications', qs({
    user_id: `eq.${user.id}`,
    ...(onlyRead ? { is_read: 'eq.true' } : {})
  }));
  return ok({ deleted: rows.length }, request, env);
}

// POST /api/notifications/check-links
// 检测当前用户视频资源的播放链接，失效则写入 link_broken 通知
export async function checkLinks(request, env) {
  const { db, user } = await requireAuth(request, env);
  const body = await readJson(request).catch(() => ({}));
  const limit = Math.min(Number(body?.limit) || 10, 30);

  const resources = await db.select('resources', qs({
    select: 'id,title,url,type',
    type: 'eq.video',
    user_id: `eq.${user.id}`,
    limit: String(limit)
  }));

  // 已有未读失效告警的资源，避免重复告警
  const existing = await db.select('notifications', qs({
    select: 'link', user_id: `eq.${user.id}`, type: 'eq.link_broken', is_read: 'eq.false'
  }));
  const alerted = new Set(existing.map((n) => n.link));

  const results = [];
  const toCreate = [];
  for (const r of resources) {
    if (!r.url || alerted.has(r.url)) { results.push({ id: r.id, title: r.title, skipped: true }); continue; }
    const check = await checkLink(r.url);
    results.push({ id: r.id, title: r.title, ok: check.ok, reason: check.reason });
    if (!check.ok) {
      toCreate.push({
        user_id: user.id,
        type: 'link_broken',
        title: `播放链接可能失效：${r.title}`,
        body: `检测结果：${check.reason || '不可访问'}`,
        link: r.url,
        is_read: false
      });
    }
  }

  if (toCreate.length) await db.insert('notifications', toCreate);
  return ok({ checked: results.length, broken: toCreate.length, results }, request, env);
}
