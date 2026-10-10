// Cloudflare Workers 入口
// fetch：REST API 入口（JWT 鉴权 + 各业务模块 + 管理员 MCP 端点）
// scheduled：每日同步 GitHub Star

import { handleRequest } from './router.js';
import { scheduledSync } from './lib/githubStars.js';
import { analyzePending } from './lib/githubAi.js';

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  },

  // 定时任务：
  //   */5 2-3 * * * → 每天 UTC 02:00–03:55 每 5 分钟同步一页 GitHub Star（lib/githubStars.js）
  //   * * * * *     → 每分钟 AI 解读 2 个还没解读的收藏（lib/githubAi.js）
  async scheduled(event, env, ctx) {
    // 只剩 Star 同步一个 Cron；同步完顺手解读一批新仓库，其余在打开 GitHub 页时按需解读
    ctx.waitUntil(scheduledSync(env, new Date(event.scheduledTime))
      .then(() => analyzePending(env))
      .then((r) => console.log('github ai', JSON.stringify(r)))
      .catch((e) => console.error('github star sync', e.message)));
  }
};
