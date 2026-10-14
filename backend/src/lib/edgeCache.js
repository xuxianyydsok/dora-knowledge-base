// 边缘缓存工具（2026-10-14）
//
// 背景：实测「直连 Supabase 1.5~2.5 秒」的查询，**经 Cloudflare Worker 要 7~50 秒**，
//   且频繁超时（categories / tags / music 都实测到 50 秒 000）。前端首屏
//   Promise.all 里只要有一个卡住，整页就一直转圈。
//
//   网络路径我们改不了，能做的是**让 Worker 尽量少回源**：把读接口的结果
//   放进 Cloudflare 边缘缓存（caches.default），命中时不再访问 Supabase。
//
// 用法（读接口包一层）：
//
//   export async function listCategories(request, env) {
//     return cachedJson(request, env, {
//       key: 'categories',
//       ttl: 300,
//       load: async () => { ...原来查库的逻辑，返回要下发的数据... }
//     });
//   }
//
// 注意：
//   · **只缓存访客**（未登录）。登录用户的数据与本人相关，缓存会串号。
//   · key 里必须包含所有会改变结果的查询参数（调用方负责拼），否则会串数据。
//   · 写操作请调用 bump() 主动失效对应 key，别等 TTL 过期。

const CACHE_ORIGIN = 'https://dora-cache.internal';

function cacheApi() {
  return typeof caches !== 'undefined' ? caches.default : null;
}

// 缓存键：固定 origin + 路径。参数由调用方拼进 path。
export function cacheKeyOf(path) {
  return new Request(`${CACHE_ORIGIN}/${String(path).replace(/^\/+/, '')}`);
}

/**
 * 读接口的边缘缓存包装。
 *
 * @param request 原始请求
 * @param env     Worker env
 * @param opts.key    缓存键（字符串，调用方要带上区分参数）
 * @param opts.ttl    秒
 * @param opts.load   真正取数据的函数，返回「要下发给前端的原始数据」（不含 ok() 包装）
 * @param opts.onlyGuest 是否只缓存访客（默认 true）
 * @param opts.user   已鉴权的 user（给了才能判断 isGuest；没给则一律不缓存，安全兜底）
 * @param opts.staleOnError 回源失败时，是否用过期缓存兜底（默认 true）
 */
export async function cachedData(request, env, opts) {
  const { key, ttl = 300, load, onlyGuest = true, user, staleOnError = true, versionNs } = opts;
  const cache = cacheApi();
  const cacheable = cache && (!onlyGuest || (user && user.isGuest));
  // 带 versionNs 时把版本号拼进键：写操作 bumpVersion(ns) 后旧缓存自动失效，
  // 不用逐个删（分页键是变量，没法枚举）。见文件末尾的说明。
  let fullKey = key;
  if (versionNs) fullKey = `${key}?v=${await versionOf(versionNs)}`;
  const req = cacheable ? cacheKeyOf(fullKey) : null;

  if (cacheable) {
    const hit = await cache.match(req);
    if (hit) {
      try {
        const body = await hit.json();
        return { data: body, cache: 'hit' };
      } catch { /* 缓存坏了就当未命中 */ }
    }
  }

  try {
    const data = await load();
    if (cacheable && ttl > 0) {
      // 写缓存失败不该影响响应
      await cache.put(req, new Response(JSON.stringify(data), {
        headers: { 'content-type': 'application/json', 'cache-control': `max-age=${ttl}` }
      })).catch(() => {});
    }
    return { data, cache: cacheable ? 'miss' : 'bypass' };
  } catch (err) {
    // 回源失败：宁可给一份**过期的**数据，也别让页面空白
    if (cacheable && staleOnError) {
      const stale = await cache.match(req).catch(() => null);
      if (stale) {
        try { return { data: await stale.json(), cache: 'stale' }; } catch { /* 落到抛错 */ }
      }
    }
    throw err;
  }
}

/**
 * 主动失效一个或多个缓存键（写操作后调用）。
 * 失败静默：失效失败最多让数据晚 TTL 秒更新，不该影响写操作本身。
 */
export async function bumpCache(keys) {
  const cache = cacheApi();
  if (!cache) return;
  const list = Array.isArray(keys) ? keys : [keys];
  await Promise.all(list.map((k) => cache.delete(cacheKeyOf(k)).catch(() => {})));
}

// ---------------------------------------------------------------
// 版本号失效（适合「分页键是变量、没法逐个删」的场景）
//
// Cache API 不支持按前缀枚举，所以分页列表（gallery 的 limit/offset、
// music 的搜索词……）没法在写操作时把旧键一个个删掉。
// 办法：键里带一个**版本号**，写操作时把版本号 +1 —— 旧缓存自然失效
// （没人再按旧版本号去读），新请求用新版本号重新回源。
//
// 版本号存在 Cache API 里（key = `__ver__/<ns>`），TTL 给 30 天；
// 丢了也只是版本号归零、退化成「一次性回源」，不影响正确性。

const VER_TTL = 60 * 60 * 24 * 30;

export async function versionOf(ns) {
  const cache = cacheApi();
  if (!cache) return '0';
  try {
    const hit = await cache.match(cacheKeyOf(`__ver__/${ns}`));
    if (!hit) return '0';
    const v = await hit.text();
    return v || '0';
  } catch { return '0'; }
}

export async function bumpVersion(ns) {
  const cache = cacheApi();
  if (!cache) return;
  try {
    const cur = Number(await versionOf(ns)) || 0;
    await cache.put(cacheKeyOf(`__ver__/${ns}`), new Response(String(cur + 1), {
      headers: { 'content-type': 'text/plain', 'cache-control': `max-age=${VER_TTL}` }
    }));
  } catch { /* 失败最多让旧缓存多活一个 TTL */ }
}
