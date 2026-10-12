// Cloudflare Workers 入口
// fetch：REST API 入口（JWT 鉴权 + 各业务模块 + 管理员 MCP 端点）
// scheduled：每日同步 GitHub Star + 刷新动态影视源

import { handleRequest } from './router.js';
import { scheduledSync } from './lib/githubStars.js';
import { analyzePending } from './lib/githubAi.js';
import { refreshDynamicSources } from './lib/dynamicSources.js';
import { resetVodSourceCache } from './lib/maccms.js';
import { SupabaseClient } from './lib/supabase.js';
import { syncAllFeeds } from './lib/rssSync.js';

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  },

  // 定时任务：
  //   */5 2-3 * * * → 每天 UTC 02:00–03:55 每 5 分钟同步一页 GitHub Star（lib/githubStars.js）
  //                   —— 同一个 cron 里**顺带**探一小批动态影视源。
  //                   Cloudflare 免费版每账号上限 5 个 cron，本账号已满
  //                   （mailflare 2 / moontv-plus 1 / rin-server 1 + 本任务），
  //                   所以不新增触发器，改为搭车运行。
  //   * * * * *     → 每分钟 AI 解读 2 个还没解读的收藏（lib/githubAi.js）
  async scheduled(event, env, ctx) {
    const cron = event.cron || '';

    // ① GitHub Star 同步（只在 */5 2-3 * * * 触发时跑）：
    //    同步完顺手解读一批新仓库。失败不影响下面的影视源探测。
    if (cron === '*/5 2-3 * * *') {
      ctx.waitUntil(scheduledSync(env, new Date(event.scheduledTime))
        .then(() => analyzePending(env))
        .then((r) => console.log('github ai', JSON.stringify(r)))
        .catch((e) => console.error('github star sync', e.message)));

      // ③ RSS 抓取（2026-10-12 恢复）：**搭同一个 cron 的车**，不新增触发器。
      //    每轮最多抓 6 个「到期的源」（按 last_fetched_at 最旧的先抓），
      //    每天触发 24 次 → 每天约 144 次抓取机会，够覆盖几十个源滚动更新。
      //    站点默认抓取间隔是 4 小时，所以一个源一天大约被真正抓 4~6 次。
      ctx.waitUntil((async () => {
        const db = new SupabaseClient(env);
        const summary = await syncAllFeeds(db, { deadlineMs: 20000, batchSize: 6, timeoutMs: 8000, env });
        console.log('rss sync', JSON.stringify(summary));
      })().catch((e) => console.error('rss sync 失败:', e?.message || e)));
    }

    // ② 动态影视源探测：**任何 cron 触发都顺带跑一小批**。
    //    这样它搭现有 cron 的车（不新增触发器），也便于用临时 cron 单独验证。
    ctx.waitUntil(
      refreshDynamicSources(env, { batchSize: resolveDynamicBatch(env) })
        .then((summary) => {
          resetVodSourceCache();   // 探测结果更新后清缓存，下个请求即用新源
          console.log('dynamic vod sources', JSON.stringify(summary));
        })
        .catch((e) => console.error('dynamic vod sources 失败:', e?.message || e))
    );
  }
};

// 每次 cron 探测的源数量。
// 预算：Cloudflare 免费版单次调用上限 50 个子请求；本 cron 同时还要跑
// GitHub Star 同步（含分页 + 入库），因此影视源这边只取 3 个源
// （每源最多 5 次请求 ≈ 15 次），留足余量。
// 该 cron 每天触发 24 次 → 每天约探 72 次，足够把 39 个源覆盖并滚动体检。
// 可用环境变量 DYNAMIC_SOURCE_BATCH 覆盖（付费版可调大）。
function resolveDynamicBatch(env) {
  const raw = Number(env?.DYNAMIC_SOURCE_BATCH);
  return Number.isFinite(raw) && raw > 0 ? raw : 3;
}
