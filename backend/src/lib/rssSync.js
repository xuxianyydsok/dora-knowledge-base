// RSS 抓取同步核心逻辑
// 供 HTTP 手动抓取接口与 Worker Cron 定时任务复用
// 仅保存条目元信息与文本摘要，不下载媒体文件

import { qs } from './supabase.js';
import { fetchFeed } from './rss.js';
import { notify } from './notify.js';

const MAX_EXISTING_GUIDS = 5000;

// 抓取单个订阅源并落库，返回 { notModified, newCount }
// feed 为 rss_feeds 表的一行（含 id/user_id/feed_url/etag/last_modified）
export async function syncFeed(db, feed, { timeoutMs = 10000 } = {}) {
  const now = new Date().toISOString();
  let result;
  try {
    result = await fetchFeed(feed.feed_url, {
      etag: feed.etag,
      lastModified: feed.last_modified,
      timeoutMs
    });
  } catch (err) {
    // 抓取失败仅记录时间，不抛出，避免中断批量任务
    await db.update('rss_feeds', qs({ id: `eq.${feed.id}` }), { last_fetched_at: now });
    throw err;
  }

  if (result.notModified) {
    await db.update('rss_feeds', qs({ id: `eq.${feed.id}` }), {
      last_fetched_at: now,
      etag: result.etag ?? feed.etag ?? null,
      last_modified: result.lastModified ?? feed.last_modified ?? null
    });
    return { notModified: true, newCount: 0 };
  }

  const parsed = result.feed || {};
  const items = parsed.items || [];

  // 读取该源已存在的 guid，判断哪些是新条目
  const existing = await db.select('rss_articles', qs({
    select: 'guid', feed_id: `eq.${feed.id}`, limit: String(MAX_EXISTING_GUIDS)
  }));
  const seen = new Set(existing.map((r) => r.guid));
  const fresh = items.filter((it) => it.guid && !seen.has(it.guid));

  if (fresh.length) {
    await db.request('rss_articles', {
      method: 'POST',
      body: fresh.map((it) => ({
        user_id: feed.user_id,
        feed_id: feed.id,
        guid: it.guid,
        title: it.title,
        link: it.link,
        author: it.author,
        summary: it.summary,
        cover_path: it.coverPath,
        published_at: it.publishedAt,
        is_read: false
      })),
      // guid 冲突时忽略，保证幂等
      prefer: 'return=representation,resolution=ignore-duplicates'
    });
  }

  // 更新源信息（标题/站点链接仅在为空时补全）与条件请求信息
  const feedPatch = {
    last_fetched_at: now,
    etag: result.etag ?? feed.etag ?? null,
    last_modified: result.lastModified ?? feed.last_modified ?? null
  };
  if (!feed.title && parsed.title) feedPatch.title = parsed.title;
  if (!feed.site_url && parsed.siteUrl) feedPatch.site_url = parsed.siteUrl;
  await db.update('rss_feeds', qs({ id: `eq.${feed.id}` }), feedPatch);

  // 新条目写入通知中心（按源聚合一条，避免刷屏）
  if (fresh.length) {
    await notify(db, feed.user_id, {
      type: 'rss_new',
      title: `RSS 更新：${feed.title || parsed.title || feed.feed_url}`,
      body: `新增 ${fresh.length} 篇文章`,
      link: feed.site_url || parsed.siteUrl || feed.feed_url
    });
  }

  return { notModified: false, newCount: fresh.length };
}

// 判断订阅源是否到期需要抓取
function isDue(feed, nowMs) {
  if (!feed.last_fetched_at) return true;
  const last = new Date(feed.last_fetched_at).getTime();
  if (Number.isNaN(last)) return true;
  const intervalMs = Math.max(Number(feed.fetch_interval) || 3600, 300) * 1000;
  return nowMs - last >= intervalMs;
}

// 批量抓取所有用户的活跃订阅源
// 采用「截止时间 + 单次上限」分批处理，规避 Workers 30s 超时
export async function syncAllFeeds(db, { deadlineMs = 25000, batchSize = 20, timeoutMs = 8000 } = {}) {
  const started = Date.now();
  const feeds = await db.select('rss_feeds', qs({
    select: 'id,user_id,title,feed_url,site_url,fetch_interval,last_fetched_at,etag,last_modified',
    is_active: 'eq.true',
    order: 'last_fetched_at.asc.nullsfirst',
    limit: String(batchSize * 4)
  }));

  const nowMs = Date.now();
  const due = feeds.filter((f) => isDue(f, nowMs)).slice(0, batchSize);

  const summary = { scanned: feeds.length, attempted: due.length, newItems: 0, errors: 0 };
  for (const feed of due) {
    if (Date.now() - started > deadlineMs) break;   // 超时保护，剩余留待下次 Cron
    try {
      const res = await syncFeed(db, feed, { timeoutMs });
      summary.newItems += res.newCount;
    } catch {
      summary.errors++;
    }
  }
  return summary;
}
