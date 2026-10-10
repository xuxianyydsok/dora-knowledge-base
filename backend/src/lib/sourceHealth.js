// 源健康中心：把「影视采集源」与「音乐音源」的可用性收敛成一份统一结构。
//
// 设计目标（详见 docs/source-health.md）：
//   1) 统一结构：影视 / 音乐同形，前端一处渲染；只声明「可验证」的能力。
//   2) 单源隔离：每个源独立探测 + 单源超时 + 全局预算，个别源挂掉不拖垮全局。
//   3) 短 TTL 缓存 + 并发去重：同一 isolate 内不重复打上游免费接口。
//   4) 冷启动安全：**没有健康数据时不得把源全禁掉**，搜索照常全量尝试。
//   5) 纯函数可离线单测：rankSources / isSourceUsable / judgeMovieProbe /
//      judgeMusicProbe / summarizeHealth / createHealthStore。
//
// 依赖方向是单向的：sourceHealth → maccms / meting（不反向 import fetchers），
// 避免与 fetchers.js 形成循环依赖。

import {
  getVodSources, searchMaccms, detailMaccms, isPlayableUrl
} from './maccms.js';
import { getMetingInstances, searchMetingMusic } from './meting.js';

// —— 探测预算（毫秒）——
// 影视：6 个源并发，单源 6s、整体 8s；音乐：多路并发，单源 8s、整体 10s。
const MOVIE_BUDGET_MS = 8000;
const MOVIE_SOURCE_TIMEOUT_MS = 6000;
const MUSIC_BUDGET_MS = 10000;
const MUSIC_SOURCE_TIMEOUT_MS = 8000;

// 单次子请求超时（影视搜索/详情、GD 搜索/取流）
const MACCMS_SEARCH_TIMEOUT_MS = 2500;
const MACCMS_DETAIL_TIMEOUT_MS = 2500;
const GD_PROBE_TIMEOUT_MS = 3500;
const AUDIUS_PROBE_TIMEOUT_MS = 4000;
const TRIAL_PROBE_TIMEOUT_MS = 4000;

// 默认 TTL：影视 90s、音乐 120s（可用 env.SOURCE_HEALTH_TTL_MS 统一覆盖）
const DEFAULT_MOVIE_TTL_MS = 90 * 1000;
const DEFAULT_MUSIC_TTL_MS = 120 * 1000;

// 探测用的固定关键词：只为验证「能连通并返回结果」，不代表只支持这些词。
// 中文目录（GD音乐台 / Meting）用中文词，英文目录（Audius / iTunes / Deezer）用英文词。
const PROBE_KEYWORD_CN = '测试';
const PROBE_KEYWORD_EN = 'test';

const TRIAL_NOTE = '仅 30 秒试听（非完整曲目）';

// 探测请求的 UA：与 fetchers.js 保持一致（部分上游会拦截自定义 UA）
const PROBE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// GD音乐台基址：与 fetchers.js 的 GD_BASE 相同，此处独立实现以免形成循环依赖。
const GD_PROBE_BASE = 'https://music-api.gdstudio.xyz/api.php';

// ---------------------------------------------------------------
// 纯函数区（无 IO，便于离线单测）
// ---------------------------------------------------------------

/**
 * 健康状态权重：0=可用(ok)、1=未知(无数据/冷启动)、2=降级(degraded)、null=不可用(down)。
 * 未知排在 ok 之后、degraded 之前 —— 没探测过的源不该被当成坏的。
 */
export function sourceHealthWeight(healthMap, key) {
  if (!healthMap) return 1;
  const rec = healthMap instanceof Map ? healthMap.get(key) : healthMap[key];
  const status = typeof rec === 'string' ? rec : rec?.status;
  if (status === 'ok') return 0;
  if (status === 'degraded') return 2;
  if (status === 'down') return null;
  return 1;
}

/** 单个源是否可用（可参与搜索）。健康数据缺失视为「可用」，保证冷启动安全。 */
export function isSourceUsable(health) {
  return sourceHealthWeight({ __one: health }, '__one') !== null;
}

/**
 * 按健康状态过滤 + 排序源列表：
 *   - status === 'down' 的源被剔除；
 *   - 其余按 ok → 未知 → degraded 排序，同档保持原有顺序（稳定排序）。
 * healthMap 为空 / 缺失时不剔除任何源，也不改顺序（冷启动安全）。
 */
export function rankSources(sources, healthMap) {
  const list = Array.isArray(sources) ? sources : [];
  if (!healthMap) return list.slice();
  return list
    .map((s, i) => ({ s, i, w: sourceHealthWeight(healthMap, s.key) }))
    .filter((x) => x.w !== null)
    .sort((a, b) => a.w - b.w || a.i - b.i)
    .map((x) => x.s);
}

/** 由健康结果构建 key → 记录 的映射，供 rankSources / sourceHealthWeight 使用。 */
export function healthMap(health) {
  const map = new Map();
  for (const s of health?.sources || []) map.set(s.key, s);
  return map;
}

/**
 * 影视源探测结果判定（纯函数）。
 * 搜索成功但详情验证失败 → degraded（不是 down）；详情成功但没有可播放地址 → degraded。
 */
export function judgeMovieProbe({ searchCount = 0, detailOk = false, hasPlayableUrl = false, detailError = null } = {}) {
  // search 必须反映真实观测：搜索空结果时 capabilities.search 应为 false，
  // 否则会出现「error 说搜索空结果、能力标签却显示『搜索』」的自相矛盾（与 judgeMusicProbe 一致）。
  const capabilities = { search: searchCount > 0, detail: !!detailOk, play: false };
  if (!searchCount) {
    return { status: 'degraded', capabilities, error: '搜索返回空结果', notes: null };
  }
  if (!detailOk) {
    return { status: 'degraded', capabilities, error: detailError || '详情接口未验证通过', notes: null };
  }
  if (!hasPlayableUrl) {
    return { status: 'degraded', capabilities, error: '详情未返回可播放地址', notes: null };
  }
  return { status: 'ok', capabilities: { ...capabilities, play: true }, error: null, notes: null };
}

/**
 * 音乐源探测结果判定（纯函数）。
 * 硬性：试听源（iTunes/Deezer）**永远不是 ok**，且**不声明 play**，也不宣称无损/高音质。
 */
export function judgeMusicProbe({ trialOnly = false, resultCount = 0, hasPlayableUrl = false, error = null } = {}) {
  const capabilities = { search: resultCount > 0, play: false, lyrics: false, trial_only: !!trialOnly };
  if (error) {
    return { status: 'down', capabilities, error, notes: trialOnly ? TRIAL_NOTE : null };
  }
  if (!resultCount) {
    return { status: 'degraded', capabilities, error: '搜索返回空结果', notes: trialOnly ? TRIAL_NOTE : null };
  }
  // 试听源：能搜到、能放 30 秒，但**不算完整播放**
  if (trialOnly) {
    return { status: 'degraded', capabilities, error: '仅提供 30 秒试听', notes: TRIAL_NOTE };
  }
  if (!hasPlayableUrl) {
    return { status: 'degraded', capabilities, error: '搜索有结果但未取到可播放地址', notes: null };
  }
  return { status: 'ok', capabilities: { ...capabilities, play: true }, error: null, notes: null };
}

/** 汇总统计：total/ok/degraded/down，并分影视 / 音乐两组。 */
export function summarizeHealth(sources) {
  const blank = () => ({ total: 0, ok: 0, degraded: 0, down: 0 });
  const summary = { total: 0, ok: 0, degraded: 0, down: 0, movie: blank(), music: blank() };
  for (const s of sources || []) {
    const bucket = s.kind === 'music' ? summary.music : summary.movie;
    summary.total += 1;
    bucket.total += 1;
    if (s.status === 'ok') { summary.ok += 1; bucket.ok += 1; }
    else if (s.status === 'degraded') { summary.degraded += 1; bucket.degraded += 1; }
    else { summary.down += 1; bucket.down += 1; }
  }
  return summary;
}

/** 把一次探测结果整理成统一记录（纯函数，时间由调用方注入）。 */
export function finalizeRecord(entry, res, latencyMs, checkedAt = new Date().toISOString()) {
  const status = ['ok', 'degraded', 'down'].includes(res?.status)
    ? res.status
    : (res?.ok ? 'ok' : 'down');
  return {
    key: entry.key,
    name: entry.name,
    kind: entry.kind,
    status,
    ok: status === 'ok',
    latency_ms: Math.max(0, Math.round(latencyMs || 0)),
    checked_at: checkedAt,
    error: res?.error || (status === 'down' ? '探测失败' : null),
    capabilities: res?.capabilities || {},
    notes: res?.notes ?? null
  };
}

// ---------------------------------------------------------------
// 探测调度：单源超时 + 全局预算 + 单源失败隔离
// ---------------------------------------------------------------

function withTimeout(promise, ms, label = '探测超时') {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms);
  });
  return Promise.race([Promise.resolve(promise), guard]).finally(() => clearTimeout(timer));
}

/**
 * 并发探测一组源，返回统一记录数组。
 *   - 每个 entry 形如 { key, name, kind, probe, timeoutMs? }，probe() 返回
 *     { status, capabilities, notes?, error? } 或抛出（抛出即判 down）。
 *   - 单源超时（entry.timeoutMs ?? perSourceMs）与全局预算（budgetMs）双保险：
 *     全局预算耗尽时，仍未返回的源统一标 down（原因写明「总预算内未返回」）。
 *   - 无论个别源怎么失败，本函数**一定 resolve**，不会 reject。
 */
export function probeEntries(entries, { budgetMs = 10000, perSourceMs = 6000, now = Date.now } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) return Promise.resolve([]);
  return new Promise((resolve) => {
    const startedAll = now();
    const results = new Array(list.length);
    let settled = 0;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(budgetTimer);
      resolve(list.map((entry, i) => results[i] || finalizeRecord(
        entry,
        { status: 'down', error: `探测超时（${budgetMs}ms 总预算内未返回）` },
        now() - startedAll
      )));
    };

    const budgetTimer = setTimeout(finish, budgetMs);

    list.forEach((entry, i) => {
      const t0 = now();
      const limit = entry.timeoutMs || perSourceMs;
      withTimeout(Promise.resolve().then(() => entry.probe()), limit, `探测超时（${limit}ms）`)
        .then((res) => { results[i] = finalizeRecord(entry, res, now() - t0); })
        .catch((err) => {
          results[i] = finalizeRecord(entry, { status: 'down', error: err?.message || String(err) }, now() - t0);
        })
        .finally(() => {
          settled += 1;
          if (settled === list.length) finish();
        });
    });
  });
}

// ---------------------------------------------------------------
// 短 TTL 缓存 + 并发去重（可离线单测）
// ---------------------------------------------------------------

/**
 * 健康缓存槽：TTL 内直接命中；同一时刻的并发请求复用同一个探测 Promise。
 *   get({ ttl, refresh, allowProbe, probe, now })
 *     - refresh=true 强制重新探测；
 *     - allowProbe=false 时**绝不**发起探测，只读**新鲜**缓存（访客路径）；
 *       缓存缺失或已过期时返回空列表 + empty/stale 标记，**不返回过期数据**。
 * 返回 { sources, at, cached, empty?, stale?, stale_at? }。
 */
export function createHealthStore() {
  let cache = null;
  let inflight = null;
  return {
    async get({ ttl = DEFAULT_MOVIE_TTL_MS, refresh = false, allowProbe = true, probe = null, now = Date.now } = {}) {
      if (!refresh && cache && now() - cache.at < cache.ttl) {
        return { sources: cache.sources, at: cache.at, cached: true };
      }
      if (!allowProbe || typeof probe !== 'function') {
        // 缓存新鲜的情况已在上一个分支返回；到这里说明缓存缺失或已过期。
        // 过期数据不得用于源过滤：一次瞬时的 down 若被无限期沿用，会把该源一直剔除，
        // 直到管理员手动刷新为止 —— 与「短 TTL / 瞬时观测」语义冲突。
        // 因此这里返回空列表 + stale 标记（保留 cache 本身，管理员路径仍可重探覆盖）。
        if (cache) {
          return { sources: [], at: cache.at, cached: false, empty: true, stale: true, stale_at: cache.at };
        }
        return { sources: [], at: null, cached: false, empty: true, stale: false };
      }
      // 并发去重：进行中的探测直接复用
      if (inflight) return inflight;
      const run = Promise.resolve()
        .then(() => probe())
        .then((sources) => {
          const at = now();
          cache = { sources: Array.isArray(sources) ? sources : [], at, ttl };
          return { sources: cache.sources, at, cached: false };
        })
        .finally(() => { inflight = null; });
      inflight = run;
      return run;
    },
    peek() { return cache; },
    reset() { cache = null; inflight = null; }
  };
}

// 模块级缓存槽：影视 / 音乐各一份（TTL 不同）
const movieStore = createHealthStore();
const musicStore = createHealthStore();

export function resetSourceHealthCache() {
  movieStore.reset();
  musicStore.reset();
}

// ---------------------------------------------------------------
// 影视源探测
// ---------------------------------------------------------------

// 单个采集源：搜索（必做）→ 详情（能力验证）。搜索失败直接抛出（判 down）。
async function probeOneMaccms(source) {
  const list = await searchMaccms(source, PROBE_KEYWORD_CN, 5, null, MACCMS_SEARCH_TIMEOUT_MS);
  if (!list.length) return judgeMovieProbe({ searchCount: 0 });
  const id = list[0].external_id;
  if (!id) return judgeMovieProbe({ searchCount: list.length, detailOk: false, detailError: '搜索未返回资源 ID' });
  try {
    const detail = await withTimeout(
      detailMaccms(source, id),
      MACCMS_DETAIL_TIMEOUT_MS,
      `详情接口超时（${MACCMS_DETAIL_TIMEOUT_MS}ms）`
    );
    const hasPlayableUrl = !!(detail?.playable_url
      || (detail?.routes || []).some((r) => (r.episodes || []).some((e) => isPlayableUrl(e.url))));
    return judgeMovieProbe({ searchCount: list.length, detailOk: true, hasPlayableUrl });
  } catch (err) {
    return judgeMovieProbe({
      searchCount: list.length,
      detailOk: false,
      detailError: `详情接口验证失败：${err?.message || err}`
    });
  }
}

export async function probeMovieSources(env = {}) {
  const entries = getVodSources(env).map((s) => ({
    key: s.key,
    name: s.name,
    kind: 'movie',
    probe: () => probeOneMaccms(s)
  }));
  return probeEntries(entries, { budgetMs: MOVIE_BUDGET_MS, perSourceMs: MOVIE_SOURCE_TIMEOUT_MS });
}

// ---------------------------------------------------------------
// 音乐源探测
// ---------------------------------------------------------------

async function probeFetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': PROBE_UA, Accept: 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return JSON.parse(text);
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error(`请求超时（${timeoutMs}ms）`);
    throw err instanceof Error ? err : new Error(String(err));
  } finally {
    clearTimeout(timer);
  }
}

const GD_SOURCE_LABEL = { netease: '网易云', joox: 'JOOX' };

// GD音乐台：搜索有结果 + 实际取一次直链（play 能力只有解析成功才算数）
async function probeGdstudio(source) {
  const search = await probeFetchJson(
    `${GD_PROBE_BASE}?${new URLSearchParams({ types: 'search', source, name: PROBE_KEYWORD_CN, count: '3', pages: '1' })}`,
    GD_PROBE_TIMEOUT_MS
  );
  const list = Array.isArray(search) ? search : [];
  if (!list.length) return judgeMusicProbe({ resultCount: 0 });
  const id = list[0]?.url_id || list[0]?.id;
  let hasPlayableUrl = false;
  if (id) {
    try {
      const info = await probeFetchJson(
        `${GD_PROBE_BASE}?${new URLSearchParams({ types: 'url', id: String(id), source, br: '999' })}`,
        GD_PROBE_TIMEOUT_MS
      );
      hasPlayableUrl = !!info?.url;
    } catch {
      hasPlayableUrl = false;   // 取流失败按「未取到播放地址」处理，不判 down
    }
  }
  return judgeMusicProbe({ resultCount: list.length, hasPlayableUrl });
}

// Meting：搜索结果自带可播放地址（302 端点），有 url 即视为拿到播放地址
async function probeMeting(instance, server) {
  const res = await searchMetingMusic(instance, server, PROBE_KEYWORD_CN, 3, MUSIC_SOURCE_TIMEOUT_MS);
  const candidates = res?.candidates || [];
  return judgeMusicProbe({
    resultCount: candidates.length,
    hasPlayableUrl: candidates.some((c) => !!c.audio_url)
  });
}

async function probeAudius() {
  const body = await probeFetchJson(
    `https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(PROBE_KEYWORD_EN)}&limit=3&app_name=dora-knowledge-base`,
    AUDIUS_PROBE_TIMEOUT_MS
  );
  const list = Array.isArray(body?.data) ? body.data : [];
  return judgeMusicProbe({
    resultCount: list.length,
    hasPlayableUrl: list.some((t) => t.is_streamable !== false)
  });
}

// iTunes / Deezer：只有 30 秒试听，恒为 degraded + trial_only，绝不声明完整播放
async function probeTrial(kind) {
  const url = kind === 'itunes'
    ? `https://itunes.apple.com/search?term=${encodeURIComponent(PROBE_KEYWORD_EN)}&entity=song&limit=3`
    : `https://api.deezer.com/search?q=${encodeURIComponent(PROBE_KEYWORD_EN)}&limit=3`;
  const body = await probeFetchJson(url, TRIAL_PROBE_TIMEOUT_MS);
  const list = kind === 'itunes'
    ? (Array.isArray(body?.results) ? body.results : [])
    : (Array.isArray(body?.data) ? body.data : []);
  return judgeMusicProbe({ trialOnly: true, resultCount: list.length });
}

export async function probeMusicSources(env = {}) {
  const entries = [];

  // GD音乐台：逐上游平台探测（默认 netease、joox）
  const gdSources = String(env.GD_MUSIC_SOURCES || 'netease,joox')
    .split(',').map((s) => s.trim()).filter(Boolean);
  for (const src of gdSources) {
    entries.push({
      key: `gdstudio:${src}`,
      name: `GD音乐台 · ${GD_SOURCE_LABEL[src] || src}`,
      kind: 'music',
      probe: () => probeGdstudio(src)
    });
  }

  // Meting：逐实例逐上游平台探测
  for (const inst of getMetingInstances(env)) {
    for (const server of inst.servers) {
      entries.push({
        key: `meting:${inst.key}:${server}`,
        name: `Meting · ${inst.key} · ${server}`,
        kind: 'music',
        probe: () => probeMeting(inst, server)
      });
    }
  }

  entries.push({ key: 'audius', name: 'Audius', kind: 'music', probe: probeAudius });
  entries.push({ key: 'itunes', name: 'iTunes（试听）', kind: 'music', probe: () => probeTrial('itunes') });
  entries.push({ key: 'deezer', name: 'Deezer（试听）', kind: 'music', probe: () => probeTrial('deezer') });

  return probeEntries(entries, { budgetMs: MUSIC_BUDGET_MS, perSourceMs: MUSIC_SOURCE_TIMEOUT_MS });
}

// ---------------------------------------------------------------
// 对外聚合入口
// ---------------------------------------------------------------

function ttlFor(kind, env = {}) {
  const override = Number(env.SOURCE_HEALTH_TTL_MS);
  if (Number.isFinite(override) && override > 0) return override;
  return kind === 'movie' ? DEFAULT_MOVIE_TTL_MS : DEFAULT_MUSIC_TTL_MS;
}

function buildPayload(sources, { cached, generatedAt, ttl, note = null, stale = false, staleAt = null }) {
  const payload = {
    generated_at: generatedAt,
    cached: !!cached,
    ttl_ms: ttl,
    stale: !!stale,
    stale_at: stale ? (staleAt || null) : null,
    summary: summarizeHealth(sources),
    sources
  };
  if (note) payload.note = note;
  return payload;
}

/**
 * 取统一的源健康结果。
 *   allowProbe=false（访客 / 普通用户路径）**绝不发起上游探测**，只读**新鲜**缓存；
 *   缓存缺失或已过期时返回空列表 + note，让前端提示「稍后由管理员刷新」。
 *   ⚠ 过期缓存**不用于源过滤**：返回空列表，让搜索按「无数据」冷启动式全量尝试；
 *     此时 stale=true、stale_at 为过期缓存的探测时间，供前端提示 / 诊断。
 *   cached 仅在影视与音乐两部分都命中缓存时为 true；
 *   generated_at 取两部分中**较早**的探测时间（保守表示数据至少新到这个时间）。
 */
export async function getSourceHealth(env = {}, { refresh = false, allowProbe = true } = {}) {
  const movieTtl = ttlFor('movie', env);
  const musicTtl = ttlFor('music', env);

  const [movie, music] = await Promise.all([
    movieStore.get({
      ttl: movieTtl, refresh, allowProbe, probe: () => probeMovieSources(env)
    }),
    musicStore.get({
      ttl: musicTtl, refresh, allowProbe, probe: () => probeMusicSources(env)
    })
  ]);

  const sources = [...movie.sources, ...music.sources];
  const ats = [movie.at, music.at].filter((n) => Number.isFinite(n));
  const generatedAt = ats.length ? new Date(Math.min(...ats)).toISOString() : null;
  const stale = !!(movie.stale || music.stale);
  const staleAts = [movie.stale_at, music.stale_at].filter((n) => Number.isFinite(n));
  return buildPayload(sources, {
    cached: movie.cached && music.cached,
    generatedAt,
    ttl: Math.min(movieTtl, musicTtl),
    stale,
    staleAt: staleAts.length ? new Date(Math.min(...staleAts)).toISOString() : null,
    note: sources.length ? null : '暂无数据，请稍后由管理员刷新'
  });
}

/** 只读影视部分（供 /api/movies/sources/health 复用同一份缓存）。 */
export async function getVodSourceHealth(env = {}, { refresh = false, allowProbe = true } = {}) {
  // 只读影视那一份缓存槽（不与音乐混算 stale），过期时同样返回空列表、不返回过期 down。
  const ttl = ttlFor('movie', env);
  const movie = await movieStore.get({
    ttl, refresh, allowProbe, probe: () => probeMovieSources(env)
  });
  return {
    generated_at: Number.isFinite(movie.at) ? new Date(movie.at).toISOString() : null,
    cached: !!movie.cached,
    stale: !!movie.stale,
    stale_at: movie.stale && Number.isFinite(movie.stale_at)
      ? new Date(movie.stale_at).toISOString() : null,
    ttl_ms: ttl,
    sources: movie.sources
  };
}
