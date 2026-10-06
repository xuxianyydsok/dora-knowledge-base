// Cloudflare Workers 入口
// fetch：REST API 入口（JWT 鉴权 + 各业务模块 + 管理员 MCP 端点）
// scheduled：Cron 定时任务，分批抓取 RSS 订阅源（规避 30s 超时）

import { handleRequest } from './router.js';
import { SupabaseClient } from './lib/supabase.js';
import { syncAllFeeds } from './lib/rssSync.js';

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  },

  // Cron 触发：抓取所有用户的活跃 RSS 订阅源
  async scheduled(event, env, ctx) {
    try {
      const db = new SupabaseClient(env);
      const summary = await syncAllFeeds(db, { deadlineMs: 25000, batchSize: 20 });
      console.log('[cron] RSS 抓取完成', JSON.stringify(summary));
    } catch (err) {
      console.error('[cron] RSS 抓取失败', err?.stack || err);
    }
  }
};
