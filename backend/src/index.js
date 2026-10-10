// Cloudflare Workers 入口
// fetch：REST API 入口（JWT 鉴权 + 各业务模块 + 管理员 MCP 端点）
// scheduled：每日同步 GitHub Star

import { handleRequest } from './router.js';
import { scheduledSync } from './lib/githubStars.js';

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  },

  // 定时任务：每天 UTC 02:00–03:55 每 5 分钟同步一页 GitHub Star（见 lib/githubStars.js）
  async scheduled(event, env, ctx) {
    ctx.waitUntil(scheduledSync(env, new Date(event.scheduledTime)).catch((e) => console.error('github star sync', e.message)));
  }
};
