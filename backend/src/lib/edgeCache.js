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
// R2 里的缓存前缀。用 R2 做**第二级**缓存的原因（2026-10-14 实测）：
//   Cloudflare Cache API 的命中不稳定 —— 同一条 /api/categories，
//   连续 5 次实测是 miss(3.7s) / 超时 / hit(3.4s) / 超时 / 超时。
//   而走 R2 的接口（/api/assets）实测稳定 2.7 秒。所以把「已算好的结果」
//   也存一份到 R2：Cache API 未命中时先看 R2，命中就直接返回，完全绕开 Supabase。
const R2_PREFIX = 'system/cache/';

function cacheApi() {
  return typeof caches !== 'undefined' ? caches.default : null;
}

// R2 二级缓存：读写都吞异常（缓存坏了不该影响主流程）
async function r2Get(env, key) {
  if (!env || !env.R2_BUCKET) return null;
  try {
    const obj = await env.R2_BUCKET.get(R2_PREFIX + key);
    if (!obj) return null;
    const txt = await obj.text();
    const parsed = JSON.parse(txt);
    // 存的是 { at, ttl, data }，过期就不认
    if (!parsed || typeof parsed.ttl !== 'number') return null;
    if (Date.now() - parsed.at > parsed.ttl * 1000) return null;
    return parsed.data;
  } catch { return null; }
}

async function r2Put(env, key, data, ttl) {
  if (!env || !env.R2_BUCKET) return 'no-bucket';
  try {
    await env.R2_BUCKET.put(R2_PREFIX + key, JSON.stringify({ at: Date.now(), ttl, data }), {
      httpMetadata: { contentType: 'application/json' }
    });
    return 'ok';
  } catch (e) {
    return 'err:' + (e && e.message ? e.message.slice(0, 60) : 'unknown');
  }
}

// 过期也拿出来用（回源失败时的兜底，比白屏强）
async function r2GetStale(env, key) {
  if (!env || !env.R2_BUCKET) return null;
  try {
    const obj = await env.R2_BUCKET.get(R2_PREFIX + key);
    if (!obj) return null;
    const parsed = JSON.parse(await obj.text());
    return parsed && parsed.data !== undefined ? parsed.data : null;
  } catch { return null; }
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
  // 版本号写成**路径段**而不是查询串：R2 的 object key 不接受 `?`，
  // 用 `?v=` 会让 r2Put 静默失败（实测「Cache API 未命中、R2 也没有」）。
  if (versionNs) fullKey = `${key}/v${await versionOf(versionNs)}`;
  const req = cacheable ? cacheKeyOf(fullKey) : null;

  // ① Cache API（最快，但实测命中不稳定）
  if (cacheable) {
    const hit = await cache.match(req);
    if (hit) {
      try {
        const body = await hit.json();
        return { data: body, cache: 'hit' };
      } catch { /* 缓存坏了就当未命中 */ }
    }
    // ② R2（稳定，实测 ~2.7 秒；命中时完全绕开 Supabase）
    const fromR2 = await r2Get(env, fullKey);
    if (fromR2 !== null) {
      // 顺手回填 Cache API，下次更快
      cache.put(req, new Response(JSON.stringify(fromR2), {
        headers: { 'content-type': 'application/json', 'cache-control': `max-age=${ttl}` }
      })).catch(() => {});
      return { data: fromR2, cache: 'r2' };
    }
  }

  try {
    const data = await load();
    let r2State = 'skip';
    if (cacheable && ttl > 0) {
      // 两级都写；失败不影响响应
      const [, r2res] = await Promise.all([
        cache.put(req, new Response(JSON.stringify(data), {
          headers: { 'content-type': 'application/json', 'cache-control': `max-age=${ttl}` }
        })).catch(() => {}),
        r2Put(env, fullKey, data, ttl)
      ]);
      // 写完立刻回读一次：确认「写入成功」不是假象（曾出现 r2:ok 但外部读不到）
      const back = await r2Get(env, fullKey);
      r2State = `${r2res || 'skip'}/${back === null ? 'readback-null' : 'readback-ok'}`;
    }
    // 诊断用：把 R2 写入结果带出去（线上排查「为什么二级缓存没生效」）
    return { data, cache: cacheable ? `miss(r2:${r2State})` : 'bypass' };
  } catch (err) {
    // ③ 回源失败：宁可给一份**过期的**数据，也别让页面空白
    if (cacheable && staleOnError) {
      const stale = await cache.match(req).catch(() => null);
      if (stale) {
        try { return { data: await stale.json(), cache: 'stale' }; } catch { /* 落到抛错 */ }
      }
      const staleR2 = await r2GetStale(env, fullKey);
      if (staleR2 !== null) return { data: staleR2, cache: 'stale-r2' };
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

export async function bumpVersion(ns, env) {
  const cache = cacheApi();
  try {
    const cur = Number(await versionOf(ns)) || 0;
    if (cache) {
      await cache.put(cacheKeyOf(`__ver__/${ns}`), new Response(String(cur + 1), {
        headers: { 'content-type': 'text/plain', 'cache-control': `max-age=${VER_TTL}` }
      }));
    }
    // R2 侧的旧版本数据不会被自动回收（键里带版本号，旧键没人再读）。
    // 按前缀列出并删除该命名空间下的旧对象，避免无限堆积。
    // 删失败无所谓：数据不会错，只是多占一点空间。
    // 键实际形如 `<ns>/<参数>/v<版本>`，必须按 `<ns>/` 前缀删，
    // 而不是 `<ns>`（少斜杠会匹配不到任何对象）。
    await r2DeletePrefix(env, `${ns.replace(/\/+$/, '')}/`);
  } catch { /* 失败最多让旧缓存多活一个 TTL */ }
}

/**
 * 按命名空间直接清掉 Cache API 中的已知列表键，并清空 R2 快照。
 *
 * 版本号机制本身已经能让旧键失效，但如果某个接口的写操作没有 bumpVersion，
 * 或者线上版本号键暂时不可用，就会继续读到旧数据。这个函数用于「写后立即刷新」
 * 这类必须看到新值的场景，调用方传明确的 key 前缀即可。
 */
export async function invalidateNamespace(ns, env) {
  const prefix = `${String(ns).replace(/\/+$/, '')}/`;
  const cache = cacheApi();
  if (cache) {
    // Cache API 无法按前缀枚举，只能删已知的少量精确键；
    // 这里同时删掉版本号键，让下一次读取从 0 开始重新回源。
    await cache.delete(cacheKeyOf(`__ver__/${prefix.slice(0, -1)}`)).catch(() => {});
  }
  await r2DeletePrefix(env, prefix);
}

// 按前缀删除 R2 对象（用于缓存失效后清理旧版本快照）。
// R2 list 一次最多 1000 条，缓存键数量远小于此，一页足够；仍做分页以防万一。
async function r2DeletePrefix(env, prefix) {
  if (!env || !env.R2_BUCKET) return;
  const full = R2_PREFIX + prefix;
  try {
    let cursor;
    do {
      const page = await env.R2_BUCKET.list({ prefix: full, cursor, limit: 500 });
      if (page.objects && page.objects.length) {
        await Promise.all(page.objects.map((o) => env.R2_BUCKET.delete(o.key).catch(() => {})));
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  } catch { /* 忽略 */ }
}
