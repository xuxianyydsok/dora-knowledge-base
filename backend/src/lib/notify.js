// 通知写入辅助
// 通知类型：rss_new（RSS 新文章）/ link_broken（播放链接失效）/ system（系统）
// 权限：写入始终绑定目标用户 user_id，保证数据隔离

import { qs } from './supabase.js';

// 写入单条通知
export async function notify(db, userId, { type = 'system', title, body = null, link = null }) {
  const rows = await db.insert('notifications', {
    user_id: userId,
    type,
    title,
    body,
    link,
    is_read: false
  });
  return rows[0];
}

// 批量写入通知
export async function notifyMany(db, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return db.insert('notifications', rows);
}

// 读取用户某类未读通知中已存在的 link 集合（用于去重，避免重复告警）
export async function unreadLinks(db, userId, type) {
  const rows = await db.select('notifications', qs({
    select: 'link', user_id: `eq.${userId}`, type: `eq.${type}`, is_read: 'eq.false'
  }));
  return new Set(rows.map((n) => n.link).filter(Boolean));
}
