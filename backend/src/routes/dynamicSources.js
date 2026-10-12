// 动态影视源管理接口（仅管理员）
//
//   GET  /api/admin/vod-sources/dynamic          查看当前生效的动态源与探测状态
//   POST /api/admin/vod-sources/dynamic/refresh  手动触发一轮探测（探一批，约 10~30s）
//   POST /api/admin/vod-sources/dynamic/reset    清空探测结果，回到内置兜底源
//
// 用途：部署后验证、出问题时手动重探，不必等下一个 cron。

import { ok } from '../lib/response.js';
import { requireAdmin } from '../middleware/auth.js';
import {
  fetchSubscription,
  getDynamicSourceState,
  refreshDynamicSources
} from '../lib/dynamicSources.js';
import { resetVodSourceCache } from '../lib/maccms.js';

/** 状态总览：订阅里有几个源、通过几个、游标到哪、上一轮错误。 */
export async function getDynamicVodSources(request, env) {
  await requireAdmin(request, env);

  const state = await getDynamicSourceState(env);

  // 顺便看一眼订阅本身是否可达（不写任何东西）
  let subscription = null;
  try {
    const sub = await fetchSubscription(env);
    subscription = {
      ok: true,
      total: sub.sources.length,
      cache_time: sub.cacheTime,
      encoding: sub.encoding
    };
  } catch (err) {
    subscription = { ok: false, error: err?.message || String(err) };
  }

  return ok({
    subscription,
    cursor: state?.cursor ?? null,
    last_run_at: state?.at ?? null,
    available: Array.isArray(state?.sources) ? state.sources.length : 0,
    sources: (state?.sources || []).map((s) => ({
      key: s.key,
      name: s.name,
      api: s.api,
      latency_ms: s.latency_ms ?? null,
      segment_ok: !!s.segment_ok,
      verified_at: s.verified_at ?? null
    }))
  }, request, env);
}

/**
 * 手动触发一轮探测。
 *
 * 与 cron 的区别：这里是独立的 fetch invocation，**没有** GitHub Star 同步
 * 与 RSS 抓取抢子请求，所以可以一次探更多源（cron 里固定 6 个）。
 * 子请求预算：8 个源 × 最多 5 步 = 40，加订阅拉取 3 个 ≈ 43，卡在免费版 50 以内。
 * 想快速把源池灌满时，连点几次这个接口即可（43 个源约 6 次全覆盖）。
 */
export async function refreshDynamicVodSources(request, env) {
  await requireAdmin(request, env);

  const summary = await refreshDynamicSources(env, { batchSize: 8 });
  resetVodSourceCache();
  return ok({ ok: true, summary }, request, env);
}

/** 清空探测结果（回到内置兜底源）。 */
export async function resetDynamicVodSources(request, env) {
  await requireAdmin(request, env);

  if (env?.R2_BUCKET) {
    await env.R2_BUCKET.delete('system/dynamic-vod-sources.json');
  }
  resetVodSourceCache();
  return ok({ ok: true, message: '已清空动态源，当前回退到内置兜底源' }, request, env);
}

