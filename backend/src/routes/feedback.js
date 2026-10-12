// 共创反馈（/coop）接口——邀请大家参与站点建设时留下的意见 / 缺陷 / 功能需求。
//
// 定位：**公开可写、仅站长可读**。任何访客都能提交一条反馈（匿名反馈是公开表单），
// 但只有站长（requireAdmin）能查看、改状态、写备注、删除。它与站内其它
// 「本人可读写」的表不同，权限模型更像「留言板 + 后台收件箱」。
//
// 关键不变量（不能破坏）：
//   1. 匿名条目**绝不落 user_id**、响应里也**绝不返回 user_id / 邮箱**；
//      访客（user.isGuest）一律强制匿名，不接受实名。
//   2. 对外字段走白名单（见 shape），匿名条目的 display_name 统一回 '匿名读者'。
//   3. 落库成功后给站长插一条 type='feedback' 的通知；通知失败只 console.error，
//      绝不影响反馈本身的成功返回（用 try/catch 包住）。
//
// 路由（见 router.js）：
//   POST   /api/feedback      提交反馈（公开，访客亦可）
//   GET    /api/feedback      列出（requireAdmin；支持 status / category / limit / offset）
//   PATCH  /api/feedback/:id  改状态 / 站长备注（requireAdmin）
//   DELETE /api/feedback/:id  删除（requireAdmin）

import { ok, readJson, HttpError } from '../lib/response.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { requireString, optionalString, optionalBool, requireUuid, requireEnum } from '../lib/validate.js';
import { adminOwnerId } from './favorites.js';

const TABLE = 'feedback';

// 正文长度上限：1~4000 字（超长报 422，由 requireString 的 max 负责）
export const MAX_CONTENT = 4000;
export const MAX_DISPLAY_NAME = 60;
export const MAX_CONTACT = 200;
export const MAX_PAGE_URL = 500;
export const MAX_UA = 500;

// 四类反馈：缺陷 / 改进 / 新功能 / 其它
export const CATEGORIES = ['bug', 'improve', 'feature', 'other'];
export const CATEGORY_LABELS = { bug: '缺陷', improve: '值得改进', feature: '想要的新功能', other: '其它' };

// 处理状态：待处理 / 已读 / 已处理
export const STATUSES = ['new', 'read', 'done'];
export const STATUS_LABELS = { new: '待处理', read: '已读', done: '已处理' };

// 输出白名单：**绝不带 user_id**，匿名条目的 display_name 统一回「匿名读者」。
const SELECT = 'id,is_anonymous,display_name,contact,category,content,page_url,status,admin_note,created_at,updated_at';

// 组装对外的安全结构（丢弃 user_id / user_agent 等内部字段）
function shape(row) {
  const anonymous = !!row.is_anonymous;
  return {
    id: row.id,
    is_anonymous: anonymous,
    // 匿名条目绝不回真实称呼；实名条目回填提交时填的称呼
    display_name: anonymous ? '匿名读者' : (row.display_name || ''),
    contact: row.contact || '',
    category: row.category,
    content: row.content,
    page_url: row.page_url || '',
    status: row.status,
    admin_note: row.admin_note || '',
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// POST /api/feedback —— 公开可写（访客也能提交）
export async function createFeedback(request, env) {
  const { db, user } = await requireAuth(request, env);
  const body = await readJson(request);

  const content = requireString(body.content, 'content', { max: MAX_CONTENT });
  const category = body.category === undefined || body.category === null
    ? 'other'
    : requireEnum(body.category, 'category', CATEGORIES);
  const requestedAnonymous = optionalBool(body.is_anonymous, 'is_anonymous') ?? true;
  const displayName = optionalString(body.display_name, 'display_name', { max: MAX_DISPLAY_NAME });
  const contact = optionalString(body.contact, 'contact', { max: MAX_CONTACT });
  const pageUrl = optionalString(body.page_url, 'page_url', { max: MAX_PAGE_URL });

  // 访客（未登录只读上下文）强制匿名：不落 user_id、不接受实名
  const isAnonymous = user.isGuest ? true : requestedAnonymous;
  const userId = isAnonymous ? null : user.id;

  // 实名且未填称呼时，用邮箱 @ 前的部分兜底
  let finalName = null;
  if (!isAnonymous) {
    const fallback = String(user.email || '').split('@')[0].trim();
    finalName = (displayName && displayName.trim()) || fallback || null;
  }

  const userAgent = (request.headers.get('User-Agent') || '').slice(0, MAX_UA);

  const rows = await db.insert(TABLE, {
    user_id: userId,
    is_anonymous: isAnonymous,
    display_name: finalName,
    contact: contact ?? null,
    category,
    content,
    page_url: pageUrl ?? null,
    user_agent: userAgent || null,
    status: 'new'
  });
  const row = rows[0];

  // 给站长插一条通知。失败只记录，绝不影响反馈本身的成功返回。
  try {
    const adminId = await adminOwnerId(db);
    if (adminId) {
      const label = CATEGORY_LABELS[category] || category;
      const excerpt = content.slice(0, 60);
      await db.insert('notifications', {
        user_id: adminId,
        type: 'feedback',
        title: '收到新的共创反馈',
        body: `【${label}】${excerpt}${content.length > 60 ? '…' : ''}`,
        link: '/admin/feedback',
        is_read: false
      });
    }
  } catch (err) {
    console.error('反馈通知写入失败:', err?.stack || err);
  }

  // 只回 id 与时间，绝不回 user_agent / user_id
  return ok({ id: row.id, created_at: row.created_at }, request, env, 201);
}

// GET /api/feedback —— 仅管理员
export async function listFeedback(request, env) {
  const { db } = await requireAdmin(request, env);
  const url = new URL(request.url);

  const filters = { select: SELECT, order: 'created_at.desc' };
  const status = url.searchParams.get('status');
  if (status) filters.status = `eq.${requireEnum(status, 'status', STATUSES)}`;
  const category = url.searchParams.get('category');
  if (category) filters.category = `eq.${requireEnum(category, 'category', CATEGORIES)}`;

  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 200);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
  filters.limit = String(limit);
  filters.offset = String(offset);

  const rows = await db.select(TABLE, qs(filters));
  const items = rows.map(shape);
  return ok({ items, count: items.length, limit, offset }, request, env);
}

// PATCH /api/feedback/:id —— 仅管理员，可改状态 / 站长备注
export async function updateFeedback(request, env, id) {
  const { db } = await requireAdmin(request, env);
  requireUuid(id, 'id');
  const body = await readJson(request);

  const patch = {};
  if ('status' in body) patch.status = requireEnum(body.status, 'status', STATUSES);
  if ('admin_note' in body) {
    patch.admin_note = optionalString(body.admin_note, 'admin_note', { max: 2000 }) ?? null;
  }
  if (!Object.keys(patch).length) throw new HttpError(422, '没有需要更新的字段');

  const rows = await db.update(TABLE, qs({ id: `eq.${id}` }), patch);
  if (!rows.length) throw new HttpError(404, '反馈不存在');
  return ok(shape(rows[0]), request, env);
}

// DELETE /api/feedback/:id —— 仅管理员
export async function deleteFeedback(request, env, id) {
  const { db } = await requireAdmin(request, env);
  requireUuid(id, 'id');
  const rows = await db.remove(TABLE, qs({ id: `eq.${id}` }));
  if (!rows.length) throw new HttpError(404, '反馈不存在');
  return ok({ id, removed: true }, request, env);
}
