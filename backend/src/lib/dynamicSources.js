// 动态影视源（LunaTV-config 订阅）
//
// 背景（2026-10-12 用户拍板）：
//   原先 DEFAULT_VOD_SOURCES 是人工精挑的 8 条，覆盖面有限、片子少、偶尔卡。
//   改为订阅 hafrey1/LunaTV-config —— 该仓库每天自动检测约 70 个采集源并重新生成
//   base58 配置。主站把这份清单拉下来，**用主站自己的四步探测筛一遍**
//   （搜索 → 详情 → m3u8 主清单 → 首个分片），只保留真正能播的源。
//
// 与上游检测的区别（这是本模块存在的意义）：
//   上游 check_api.js 只验证「接口能连通」；主站额外验证「点进去能不能播」。
//   所以直接拿上游清单会出现「搜得到、点开播不了」，必须再筛。
//
// 存储：探测结果写进 R2（key 固定），避免占用 Supabase 表 / 迁移。
//   失败时**回退到上一次的结果**，绝不把源列表清空。
//
// 子请求预算：Cloudflare 免费版单次请求上限 50 个子请求，付费版 1000。
//   因此探测**分批进行**（每次 cron 只探一批），几轮下来把全部源覆盖完。

const CONFIG_URL_DEFAULT =
  'https://raw.githubusercontent.com/hafrey1/LunaTV-config/main/LunaTV-config.txt';

// R2 对象键：探测结果
const R2_KEY_SOURCES = 'system/dynamic-vod-sources.json';
// R2 对象键：探测进度（记录上一轮探到第几个，实现分批）
const R2_KEY_CURSOR = 'system/dynamic-vod-cursor.json';

// 每批探测的源数量。每条源探测需要 2 个子请求（搜索 + 详情），
// 取 12 → 24 个子请求，安全落在免费版 50 的上限内。
const PROBE_BATCH_SIZE = 12;

// 连续失败多少次才把一个源摘掉。
// 一次失败可能只是网络抖动 / 上游瞬时 503，立刻摘掉会误杀好源；
// 连续 3 轮（跨天）都不行，才认为它真的坏了。
const MAX_CONSECUTIVE_FAILURES = 3;

// 动态源在搜索结果里的排序权重：排在人工精挑源之后（数值越小越靠前）。
// 现在已无人工源，但保留该字段便于日后需要时插队。
const DYNAMIC_WEIGHT = 100;

// ---------------------------------------------------------------
// base58 解码（零依赖实现，避免为一个编码引入 npm 包）
// ---------------------------------------------------------------
const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const B58_MAP = (() => {
  const m = new Map();
  for (let i = 0; i < B58_ALPHABET.length; i += 1) m.set(B58_ALPHABET[i], i);
  return m;
})();

/**
 * base58 解码成 Uint8Array。
 * 采用「按位累加」的朴素实现：配置文本约 16KB，解码后 ~12KB，
 * 数据量很小，朴素实现完全够用（且无第三方依赖）。
 */
export function base58Decode(input) {
  const text = String(input || '').trim();
  if (!text) throw new Error('base58 输入为空');

  const bytes = [0];
  for (const ch of text) {
    const value = B58_MAP.get(ch);
    if (value === undefined) throw new Error(`base58 含非法字符：${ch}`);
    let carry = value;
    for (let i = 0; i < bytes.length; i += 1) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  // 前导 '1' 代表前导零字节
  for (let i = 0; i < text.length && text[i] === '1'; i += 1) bytes.push(0);

  return new Uint8Array(bytes.reverse());
}

/** 解析订阅内容：可能是 base58，也可能是明文 JSON（两种都容错）。 */
export function parseSubscription(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('订阅内容为空');

  // 先试明文 JSON
  if (raw.startsWith('{')) {
    const obj = JSON.parse(raw);
    return { config: obj, encoding: 'plain' };
  }

  const decoded = new TextDecoder().decode(base58Decode(raw));
  return { config: JSON.parse(decoded), encoding: 'base58' };
}

/**
 * 把 LunaTV 配置的 api_site 转成主站内部源结构。
 * LunaTV 结构：{ "host": { name, api, detail } }
 * 主站结构：  { key, name, api, detail }
 *
 * key 用域名（LunaTV 本身就是用域名当 key），保证多次拉取顺序变化时 key 稳定。
 */
// —— 成人 / 违规内容源过滤（硬性）——
// 上游 LunaTV 清单里混着大量成人资源站（名字带 🔞、以及一批以黑话命名的站）。
// 这些**绝不能**进入面向普通访客的知识库站点。
// 判定依据：源名称里的标记 + 域名 / 名称里的敏感词。
const ADULT_NAME_RE = /🔞|成人|里番|色情|黄片|福利片|老色|黑料|桃花|小鸡|jkun|番号|白嫖|乐播|av资源|午夜/i;
const ADULT_HOST_RE = /(^|[.\-])(av|porn|xxx|sex|18|18av|jav)([.\-]|$)/i;

/** 判断一个源是否为成人 / 违规源（命中即排除）。 */
export function isBlockedSource(site) {
  const name = String(site?.name || '');
  const host = String(site?.key || site?.host || '');
  const api = String(site?.api || '');
  if (ADULT_NAME_RE.test(name)) return true;
  try {
    const hostname = new URL(api).hostname;
    if (ADULT_HOST_RE.test(hostname)) return true;
  } catch { /* api 不合法时忽略 */ }
  return ADULT_HOST_RE.test(host);
}

export function normalizeLunaSources(apiSite = {}) {
  const out = [];
  for (const [host, site] of Object.entries(apiSite || {})) {
    const api = String(site?.api || '').trim();
    if (!api) continue;
    const name = String(site?.name || host).trim() || host;
    const entry = {
      key: String(host).trim(),
      name,
      api,
      detail: String(site?.detail || '').trim() || undefined
    };
    // 成人 / 违规源直接剔除，不进主站
    if (isBlockedSource(entry)) continue;
    out.push(entry);
  }
  return out;
}

// ---------------------------------------------------------------
// 拉取订阅
// ---------------------------------------------------------------

/**
 * 拉取并解析订阅配置。
 * @returns {Promise<{ sources: Array, cacheTime: number|null, encoding: string }>}
 */
export async function fetchSubscription(env = {}, { url = null, timeoutMs = 8000 } = {}) {
  const target = url || env.LUNA_CONFIG_URL || CONFIG_URL_DEFAULT;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(target, {
      signal: controller.signal,
      headers: {
        // GitHub raw 对无 UA 的请求偶尔会限流
        'User-Agent': 'dora-knowledge-base/1.0 (+dynamic-vod-sources)',
        Accept: 'text/plain,*/*'
      },
      cf: { cacheTtl: 300 }
    });
    if (!res.ok) throw new Error(`订阅拉取失败 HTTP ${res.status}`);
    const text = await res.text();
    const { config, encoding } = parseSubscription(text);
    const sources = normalizeLunaSources(config?.api_site);
    if (!sources.length) throw new Error('订阅里没有解析到任何源（api_site 为空）');
    return {
      sources,
      cacheTime: Number(config?.cache_time) || null,
      encoding
    };
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error(`订阅拉取超时（${timeoutMs}ms）`);
    throw err instanceof Error ? err : new Error(String(err));
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------
// R2 读写（探测结果 + 游标）
// ---------------------------------------------------------------

async function r2GetJson(env, key) {
  if (!env?.R2_BUCKET) return null;
  try {
    const obj = await env.R2_BUCKET.get(key);
    if (!obj) return null;
    const text = await obj.text();
    return JSON.parse(text);
  } catch (err) {
    console.error(`[dynamicSources] 读 R2 失败 ${key}:`, err?.message || err);
    return null;
  }
}

async function r2PutJson(env, key, value) {
  if (!env?.R2_BUCKET) throw new Error('缺少 R2_BUCKET 绑定');
  await env.R2_BUCKET.put(key, JSON.stringify(value), {
    httpMetadata: { contentType: 'application/json' }
  });
}

/**
 * 读取已启用的动态源列表（搜索路径用）。
 * 返回数组；没有数据时返回空数组（调用方回退到内置默认源）。
 */
export async function getDynamicSources(env = {}) {
  const data = await r2GetJson(env, R2_KEY_SOURCES);
  if (!data || !Array.isArray(data.sources)) return [];
  return data.sources.filter((s) => s && s.key && s.api && !s.disabled);
}

/** 读取完整状态（含探测元信息，管理员接口用）。 */
export async function getDynamicSourceState(env = {}) {
  const data = await r2GetJson(env, R2_KEY_SOURCES);
  return data || null;
}

// ---------------------------------------------------------------
// 四步探测：搜索 → 详情 → m3u8 主清单 → 首个分片
// ---------------------------------------------------------------

/**
 * 深度探测单个源（比 sourceHealth 的两步更严格）。
 *
 * 步骤：
 *   1) 列表：ac=videolist（不带关键词，取最新更新）→ 必须有结果
 *      ⚠ 不能用关键词搜索来判源好坏：很多源**禁用了关键词搜索**
 *      （接口直接返回 `Current API forbids keyword search`），
 *      但它们「取最新列表」完全正常、站点上也能搜到片。
 *      用关键词探测会把这类源误判成坏的（实测 49/69 被误杀）。
 *   2) 详情：ac=detail&ids=首条 id → 必须拿到可播地址
 *   3) 主清单：GET 该 m3u8 → 必须 200 且内容像 m3u8
 *   4) 首个分片（参考项，不决定成败）：取一个分片看是否 200/206。
 *      很多源对分片做了防盗链，直连 403 —— 但主站播放器走 /api/vod/proxy 能播，
 *      所以这一步只作为 `segment_ok` 记录，**不据此判定源不可用**。
 *
 * 判定：1) 2) 3) 全过即算可用（用户要求：「直接没效果的不要放进来」）。
 *
 * @returns {Promise<{ ok: boolean, latencyMs: number, step: string, error?: string, segment_ok?: boolean }>}
 */
export async function probeSourceDeep(source, {
  listTimeoutMs = 8000,
  detailTimeoutMs = 8000,
  playlistTimeoutMs = 8000
} = {}) {
  const started = Date.now();
  const done = (ok, step, error) => ({
    ok,
    step,
    latencyMs: Date.now() - started,
    ...(error ? { error: String(error).slice(0, 160) } : {})
  });

  // —— 步骤 1：列表（不带关键词，取最新更新）——
  let detailUrl;
  try {
    const listUrl = buildApiUrl(source.api, { ac: 'videolist', pg: 1 });
    const body = await fetchJsonWithTimeout(listUrl, listTimeoutMs);
    const list = Array.isArray(body?.list) ? body.list : [];
    if (!list.length) return done(false, 'list', '列表为空');
    const first = list[0];
    const id = first?.vod_id;
    if (!id) return done(false, 'list', '首条结果没有 vod_id');
    detailUrl = buildApiUrl(source.api, { ac: 'detail', ids: id });
  } catch (err) {
    return done(false, 'list', err?.message || err);
  }

  // —— 步骤 2：详情 ——
  let playUrl;
  try {
    const body = await fetchJsonWithTimeout(detailUrl, detailTimeoutMs);
    const raw = (Array.isArray(body?.list) ? body.list : [])[0];
    if (!raw) return done(false, 'detail', '详情为空');
    playUrl = firstPlayableFromRaw(raw);
    if (!playUrl) return done(false, 'detail', '详情里没有可播地址');
  } catch (err) {
    return done(false, 'detail', err?.message || err);
  }

  // —— 步骤 3：m3u8 主清单 ——
  let playlistText;
  try {
    const res = await fetchTextWithTimeout(playUrl, playlistTimeoutMs, {
      // 分片服务器普遍校验 Referer 必须来自播放页所在源站
      Referer: new URL(source.api).origin + '/'
    });
    playlistText = res.text;
    if (!res.ok) return done(false, 'playlist', `主清单 HTTP ${res.status}`);
    if (!/#EXTM3U/i.test(playlistText)) return done(false, 'playlist', '主清单不是 m3u8');
  } catch (err) {
    return done(false, 'playlist', err?.message || err);
  }

  // —— 步骤 4：首个分片（参考项，失败不影响判定）——
  let segmentOk = false;
  try {
    // master playlist 里是变体（子 m3u8）；media playlist 里直接是 .ts 分片
    const variant = playlistText
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('#'));

    if (!variant) {
      // 清单里没有条目：罕见，但不据此判死，交给播放器决定
      return { ...done(true, 'ok'), segment_ok: false };
    }

    const variantUrl = new URL(variant, playUrl).toString();
    const isNested = /\.m3u8(\?|#|$)/i.test(variantUrl);

    if (isNested) {
      // 变体清单 → 再取一次，然后从里面拿第一个 .ts
      const sub = await fetchTextWithTimeout(variantUrl, playlistTimeoutMs, {
        Referer: new URL(source.api).origin + '/'
      });
      if (sub.ok) {
        const seg = sub.text
          .split('\n')
          .map((l) => l.trim())
          .find((l) => l && !l.startsWith('#'));
        if (seg) {
          const segUrl = new URL(seg, variantUrl).toString();
          const head = await headWithTimeout(segUrl, playlistTimeoutMs, {
            Referer: new URL(source.api).origin + '/'
          });
          segmentOk = head.ok;
        }
      }
    } else {
      // 直接就是分片地址
      const head = await headWithTimeout(variantUrl, playlistTimeoutMs, {
        Referer: new URL(source.api).origin + '/'
      });
      segmentOk = head.ok;
    }
  } catch {
    // 分片校验失败只记为参考信息，不判源不可用
    segmentOk = false;
  }

  return { ...done(true, 'ok'), segment_ok: segmentOk };
}

// —— 探测用的小工具 ——

const PROBE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function buildApiUrl(api, params) {
  const sep = api.includes('?') ? '&' : '?';
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${api}${sep}${qs}`;
}

async function fetchJsonWithTimeout(url, timeoutMs) {
  // 采集接口普遍校验 Referer 必须来自源站自身，否则 403/503（防盗链）。
  // 实测：iqiyizyapi.com 的详情接口不带 Referer 返回 503，带上就 200。
  const referer = sourceOriginOf(url);
  let res = await fetchTextWithTimeout(url, timeoutMs, referer ? { Referer: referer } : {});
  if (!res.ok) {
    // 少数源反过来不认 Referer，去掉再试一次（两类站都存在，兜底比猜更省事）
    res = await fetchTextWithTimeout(url, timeoutMs);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  try {
    return JSON.parse(res.text);
  } catch {
    throw new Error('返回内容不是 JSON');
  }
}

/** 取 URL 的源站（用于构造 Referer）。 */
function sourceOriginOf(url) {
  try {
    return new URL(url).origin + '/';
  } catch {
    return '';
  }
}

async function fetchTextWithTimeout(url, timeoutMs, extraHeaders = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': PROBE_UA, Accept: '*/*', ...extraHeaders }
    });
    return { ok: res.ok, status: res.status, text: await res.text() };
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error(`超时（${timeoutMs}ms）`);
    throw err instanceof Error ? err : new Error(String(err));
  } finally {
    clearTimeout(timer);
  }
}

async function headWithTimeout(url, timeoutMs, extraHeaders = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // 用 Range 取前 1 字节：比 HEAD 兼容性好（部分源不支持 HEAD），也比整片下载省流量
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': PROBE_UA, Range: 'bytes=0-0', ...extraHeaders }
    });
    // 200 / 206 都算成功
    return { ok: res.ok || res.status === 206, status: res.status };
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error(`分片超时（${timeoutMs}ms）`);
    throw err instanceof Error ? err : new Error(String(err));
  } finally {
    clearTimeout(timer);
  }
}

/** 从采集接口的原始条目里取第一个可播地址（vod_play_url 形如 "第1集$url#第2集$url"）。 */
function firstPlayableFromRaw(raw) {
  const playUrl = String(raw?.vod_play_url || '');
  if (!playUrl) return '';
  for (const group of playUrl.split('$$$')) {
    for (const item of group.split('#')) {
      const url = item.split('$').pop()?.trim();
      if (url && isPlayableUrl(url)) return url;
    }
  }
  return '';
}

/** 只认 m3u8 / mp4 直链（与 maccms.js 的判定保持一致）。 */
function isPlayableUrl(url = '') {
  return /\.(m3u8|mp4)(\?|#|$)/i.test(url);
}

// ---------------------------------------------------------------
// 定时刷新：分批探测 → 合并结果 → 写 R2
// ---------------------------------------------------------------

/**
 * 执行一轮刷新（供 cron 调用）。
 *
 * 分批策略：
 *   - 每次只探 PROBE_BATCH_SIZE 个源，游标记在 R2；
 *   - 几轮下来把全部源覆盖完，然后从头再来（滚动体检）；
 *   - 每轮结果**合并**进已通过名单（通过就留下，失败则移除）。
 *
 * @returns {Promise<object>} 本轮摘要（供日志 / 管理接口展示）
 */
export async function refreshDynamicSources(env = {}, { batchSize = PROBE_BATCH_SIZE, url = null } = {}) {
  const started = Date.now();
  const summary = {
    at: new Date().toISOString(),
    total: 0,
    probed: 0,
    passed: 0,
    failed: 0,
    cursor: 0,
    encoding: null,
    errors: []
  };

  // 1) 拉订阅
  const sub = await fetchSubscription(env, { url });
  const all = sub.sources;
  summary.total = all.length;
  summary.encoding = sub.encoding;

  // 2) 读旧状态（含游标 + 已通过名单）
  const prev = await r2GetJson(env, R2_KEY_SOURCES);
  const prevSources = Array.isArray(prev?.sources) ? prev.sources : [];
  const passedMap = new Map(prevSources.map((s) => [s.key, s]));
  // 失败计数：记录每个源连续失败了几轮（跨轮累计）
  const failMap = new Map(
    Object.entries(prev?.failures || {}).map(([k, v]) => [k, Number(v) || 0])
  );

  // 3) 本轮要探的切片（游标轮转）
  const cursor = Number.isFinite(prev?.cursor) ? prev.cursor % all.length : 0;
  const slice = [];
  for (let i = 0; i < Math.min(batchSize, all.length); i += 1) {
    slice.push(all[(cursor + i) % all.length]);
  }
  summary.cursor = (cursor + slice.length) % all.length;

  // 4) 逐个深探（串行，避免瞬时子请求打爆；单批 12 个 × 4 步 ≈ 48 个子请求）
  for (const source of slice) {
    try {
      const res = await probeSourceDeep(source);
      summary.probed += 1;
      if (res.ok) {
        summary.passed += 1;
        passedMap.set(source.key, {
          ...source,
          weight: DYNAMIC_WEIGHT,
          latency_ms: res.latencyMs,
          segment_ok: !!res.segment_ok,
          verified_at: new Date().toISOString()
        });
        failMap.delete(source.key);
      } else {
        summary.failed += 1;
        // 不立刻摘：先记失败次数，连续失败够多才摘（避免网络抖动误杀）
        const fails = (failMap.get(source.key) || 0) + 1;
        failMap.set(source.key, fails);
        if (fails >= MAX_CONSECUTIVE_FAILURES) passedMap.delete(source.key);
        summary.errors.push({ key: source.key, step: res.step, error: res.error });
      }
    } catch (err) {
      summary.failed += 1;
      const fails = (failMap.get(source.key) || 0) + 1;
      failMap.set(source.key, fails);
      if (fails >= MAX_CONSECUTIVE_FAILURES) passedMap.delete(source.key);
      summary.errors.push({ key: source.key, step: 'exception', error: String(err?.message || err).slice(0, 160) });
    }
  }

  // 5) 订阅里已消失的源也清掉（源站下线）
  const liveKeys = new Set(all.map((s) => s.key));
  for (const key of [...passedMap.keys()]) {
    if (!liveKeys.has(key)) passedMap.delete(key);
  }
  for (const key of [...failMap.keys()]) {
    if (!liveKeys.has(key)) failMap.delete(key);
  }

  // 6) 写 R2
  const sources = [...passedMap.values()].sort(
    (a, b) => (a.weight ?? DYNAMIC_WEIGHT) - (b.weight ?? DYNAMIC_WEIGHT)
      || (a.latency_ms ?? 9e9) - (b.latency_ms ?? 9e9)
  );
  await r2PutJson(env, R2_KEY_SOURCES, {
    at: summary.at,
    total: all.length,
    cursor: summary.cursor,
    encoding: sub.encoding,
    failures: Object.fromEntries(failMap),
    sources
  });
  await r2PutJson(env, R2_KEY_CURSOR, { cursor: summary.cursor, at: summary.at });

  summary.available = sources.length;
  summary.ms = Date.now() - started;
  return summary;
}
