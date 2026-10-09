// NewsNow 热榜：代理自部署的 NewsNow 服务（Worker newsnow-api，域名 news.xuguochen.de5.net）
// - 优先走 service binding（env.NEWSNOW），没有绑定时回退到 env.NEWSNOW_BASE 地址
// - 边缘缓存 5 分钟，避免频繁打到上游触发源站限流
// 权限：需要登录；只读，不写库

import { ok, HttpError } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { NEWS_COLUMNS, NEWS_FEATURED, NEWS_SOURCES } from '../lib/newsSources.js';

const CACHE_TTL = 300;
const DEFAULT_BASE = 'https://news.xuguochen.de5.net';
const SOURCE_IDS = new Set(NEWS_SOURCES.map((s) => s.id));

export async function listNewsSources(request, env) {
  await requireAuth(request, env);
  return ok({ columns: NEWS_COLUMNS, featured: NEWS_FEATURED, sources: NEWS_SOURCES }, request, env);
}

async function fetchUpstream(env, id) {
  const path = `/api/s?id=${encodeURIComponent(id)}`;
  const init = { headers: { accept: 'application/json' } };
  if (env.NEWSNOW && typeof env.NEWSNOW.fetch === 'function') {
    return env.NEWSNOW.fetch(new Request(`https://newsnow.internal${path}`, init));
  }
  return fetch(`${(env.NEWSNOW_BASE || DEFAULT_BASE).replace(/\/$/, '')}${path}`, init);
}

export async function getNews(request, env, id) {
  await requireAuth(request, env);
  if (!SOURCE_IDS.has(id)) throw new HttpError(404, '未知的热榜源');

  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const cacheKey = new Request(`https://dora-cache.internal/news/${id}`);
  let payload = null;

  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) payload = await hit.json();
  }

  if (!payload) {
    let res;
    try {
      res = await fetchUpstream(env, id);
    } catch {
      throw new HttpError(502, '热榜服务暂时不可用');
    }
    if (!res.ok) throw new HttpError(502, `热榜服务返回 ${res.status}`);
    const raw = await res.json().catch(() => null);
    if (!raw || !Array.isArray(raw.items)) throw new HttpError(502, '热榜数据格式异常');

    payload = {
      id,
      updated_at: raw.updatedTime ? new Date(raw.updatedTime).toISOString() : new Date().toISOString(),
      items: raw.items.slice(0, 30).map((it) => ({
        title: String(it.title || '').slice(0, 300),
        url: it.url || it.mobileUrl || '',
        info: typeof it.extra?.info === 'string' ? it.extra.info : (typeof it.extra?.date === 'string' ? it.extra.date : '')
      })).filter((it) => it.title && it.url)
    };

    if (cache && payload.items.length) {
      await cache.put(cacheKey, new Response(JSON.stringify(payload), {
        headers: { 'content-type': 'application/json', 'cache-control': `max-age=${CACHE_TTL}` }
      }));
    }
  }

  return ok(payload, request, env);
}
