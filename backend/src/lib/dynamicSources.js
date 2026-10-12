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

// 补充订阅源（2026-10-12 调研后接入）。
// 为什么加：主库 hafrey1 过滤成人后约 39 条，实测安全源通过率 67%；
// smallmain/moontv-aggr-config 是「五库去重合并」的产物，lite.json 全是安全源、
// 通过率 82%，能补进主库没有的约 30 条可用源。
// 走 jsdelivr 而不是 raw.githubusercontent：实测 raw 对这两个仓库间歇 403，
// jsdelivr 稳定 200（且本身是 CDN，从 CF 边缘取更快）。
// 只当**补充**：拉取失败不影响主库（见 fetchAllSubscriptions）。
// 每条补充库给**多个镜像**，按顺序尝试、第一个成功即用：
//   实测 jsdelivr 与 raw.githubusercontent 都会间歇性失败（本机测 jsdelivr 约 1/3 失败），
//   单挂一个地址等于「补充库时有时无」，源数量会来回抖。两个都挂上，可用性高得多。
const EXTRA_CONFIGS = [
  { name: 'smallmain/lite', urls: [
    'https://cdn.jsdelivr.net/gh/smallmain/moontv-aggr-config@main/lite.json',
    'https://raw.githubusercontent.com/smallmain/moontv-aggr-config/main/lite.json'
  ] }
];

// R2 对象键：探测结果
const R2_KEY_SOURCES = 'system/dynamic-vod-sources.json';
// R2 对象键：探测进度（记录上一轮探到第几个，实现分批）
const R2_KEY_CURSOR = 'system/dynamic-vod-cursor.json';

// 每批探测的源数量。
//
// 2026-10-13 调整：从 3 提到 6，并改成**并行探测**（见 refreshDynamicSources）。
//
// 起因（用户反馈「有些电视剧搜出来只有 3 条影视源，你那不是 69 条吗？」）：
//   探测是分批滚动的，原来每批只探 3 个源，而订阅里有 43 个安全源
//   → 要 15 轮才覆盖一遍。cron 每天只触发 24 次，等于「一整天都覆盖不完一轮」，
//   R2 里长期只有 5 条「已验证通过」的源 —— 搜索自然只有 3 条源命中。
//   改 6 后一天 24 轮可探 144 次，43 个源当天就能覆盖 3 遍，之后滚动复检。
//
// ⚠ 子请求预算（Cloudflare 免费版**单次调用**上限 50，实测确认）：
//   每条源最多 5 个子请求（类目表 + 列表 + 详情 + m3u8 主清单 + 分片探测），
//   再叠加订阅拉取（主库 + 补充库最多 3 个）与探测内可能的重试。
//   6 × 5 = 30，加订阅约 33，留足余量。
//   注意这是**总量**限制而非并发限制 —— 批大小开太大（例如 12）会直接把
//   整轮探测打爆在「Too many subrequests」上，结果一个源都存不进去。
const PROBE_BATCH_SIZE = 6;

// 探测并发度。串行探测 10 个源要 30~60s，远超 cron 的 waitUntil 舒适区间；
// 全并发又可能瞬时打满子请求预算。折中取 3。
const PROBE_CONCURRENCY = 3;

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

// 类目级判定：**比名字更可靠**，用来抓「名字干净、内容全是成人」的伪装源。
// 2026-10-12 实测发现的真实案例（名字完全看不出问题）：
//   · bhziyuan.com「百花资源站」→ 类目：强奸乱伦 / 日韩无码 / 日本AV / 经典三级 / 少女嫩模…
//   · api.vnzyz.com「越南资源站」→ 类目：亚洲情色 / 热门女优 / 无码专区 / VR资源 / JAV高清…
//   · jipinvip1.com「新极品资源站」→ 类目：日韩无码 / 自拍偷拍 / SM重味 / 颜射系列…
// 这三条都是调研里「实测可用、通过率不低」的源，只按名字过滤会全部放进主站。
// ⚠ 只收**高精度**词：这里的词一旦误判就会整源剔除，宁缺毋滥。
// 特意不收的模糊词（正规源也常用，收了会误杀）：
//   原创 / 精品 / 传媒 / 网红 / 二次元 / 人妻 / 少妇 / 丝袜 / 美腿 / 写真 /
//   福利 / 激情 / 三级（单看「三级」太宽，改用「伦理三级」这类组合）
const ADULT_CLASS_RE = /强奸|乱伦|人兽|无码|有码专区|日本AV|JAV|AV解说|AV明星|色情|情色|伦理三级|伦理片|伦理影片|自拍偷拍|偷拍自拍|黑料|吃瓜|探花|女优|嫩模|传媒视频|淫|口交|颜射|自慰|SM重味|SM调教|换脸|男同|女同|同性恋|人妖|VR资源|深夜视频|里番|H漫|禁漫|巨乳|爆乳|母狗|反差|媚药|迷奸|援交|外围|约炮|撸管|大秀|视频[一二三四五]区|变态另类|欧美性爱|制服诱惑|制服师生|教师学生|学生空姐|野战车震|偷情少妇|精品探花|精品网红|家庭乱伦|百合女同|亚洲情色|热门女优|4K岛国|国产自拍|韩国资源|卡通动漫|制服诱惑/i;

// 判定「类目名是否成人向」。类目表来自 ac=list 的 class 数组。
// 注意：**只看类目名，不看条目名** —— 条目名里出现「人妻 / 少妇」等词在正规
// 影视剧里也常见（如《昼颜》类题材），按标题判会大量误杀正常片子；
// 而类目表是源站自己划的专区，命名直白，是判定站点性质的可靠信号。
export function isAdultClassLabel(label) {
  return ADULT_CLASS_RE.test(String(label || '').trim());
}

/**
 * 统计一个源站类目表里的成人向类目占比。
 * @returns {{adult: string[], total: number, ratio: number}}
 */
export function adultClassStats(classes = []) {
  const names = (Array.isArray(classes) ? classes : [])
    .map((c) => String(c?.type_name || '').trim())
    .filter(Boolean);
  const adult = names.filter((n) => isAdultClassLabel(n));
  return { adult, total: names.length, ratio: names.length ? adult.length / names.length : 0 };
}

// 成人类目占比超过该阈值即整源剔除。
// 为什么不是「命中一个就剔除」：正规源也常挂一个「伦理片」叶子类目
// （实测电影天堂 / 猫眼 / iKun / 豆瓣 / 茅台都有，占比 1/30 上下），
// 一刀切会把所有正常源一起干掉。而真正的成人站占比普遍 > 50%。
const ADULT_CLASS_RATIO_LIMIT = 0.3;
// 单看占比仍可能漏掉「小站只有几个类目、其中一个是成人」的情况，
// 因此再补一条绝对量阈值：成人类目 ≥ 6 个也直接剔除（正常源不会挂这么多）。
const ADULT_CLASS_ABS_LIMIT = 6;

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

/**
 * 拉取**全部**订阅（主库 + 补充库）并合并去重。
 *
 * 合并规则：按**接口主机名**去重，主库优先 —— 同一个站点在主库与补充库里
 * 都有时，保留主库那条（主库的维护频率更高、name 更规范）。
 *
 * 容错：补充库拉取失败**不影响主库**。这是有意的设计 ——
 * 主库是站点的生命线，不能因为一个可选的补充库 403/超时就整体拉不到源。
 * 主库失败才抛错（调用方会回退到上一次的 R2 结果）。
 */
export async function fetchAllSubscriptions(env = {}, { url = null, timeoutMs = 8000 } = {}) {
  const primary = await fetchSubscription(env, { url, timeoutMs });
  // ⚠ 按 api 的**主机名**去重，不能按 key：
  //   两个库的 key 命名规则不同 —— 主库用域名（`caiji.dyttzyapi.com`），
  //   补充库把整条路径拼成 key（`caiji_dyttzyapi_com_provide_vod`）。
  //   按 key 比会把同一个站点当成两条：实测合并出 77 条，其中 34 条是这种重复
  //   （唯一主机名只有 43 个），等于把每个源都探两遍、白烧子请求配额。
  const hostOf = (s) => {
    try { return new URL(s.api).hostname.toLowerCase(); } catch { return String(s.key || '').toLowerCase(); }
  };
  const merged = new Map(primary.sources.map((s) => [hostOf(s), s]));
  const extras = [];

  // 显式传 url 时（管理接口手动重探 / 单测）只拉那一个，不叠加补充库，
  // 保证「指定 url」的行为可预期。
  const configs = url ? [] : EXTRA_CONFIGS;
  for (const cfg of configs) {
    let done = null;
    const tried = [];
    for (const mirror of cfg.urls) {
      try {
        const sub = await fetchSubscription(env, { url: mirror, timeoutMs });
        let added = 0;
        for (const s of sub.sources) {
          const h = hostOf(s);
          if (merged.has(h)) continue;
          merged.set(h, s);
          added += 1;
        }
        done = { url: mirror, total: sub.sources.length, added };
        break;
      } catch (err) {
        tried.push({ url: mirror, error: String(err?.message || err).slice(0, 120) });
      }
    }
    if (done) {
      extras.push({ name: cfg.name, ...done, tried: tried.length ? tried : undefined });
    } else {
      // 补充库全部镜像都失败只记日志，不影响主库结果
      console.error(`[dynamicSources] 补充订阅全部镜像失败 ${cfg.name}`);
      extras.push({ name: cfg.name, error: '所有镜像均失败', tried });
    }
  }

  return {
    sources: [...merged.values()],
    cacheTime: primary.cacheTime,
    encoding: primary.encoding,
    extras
  };
}

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
  // 探测副产品：把「动漫类目 ID」和「是否支持关键词搜索」一并测出来，
  // 写进动态源记录里。这样搜索阶段就不用再对每个源发一次 ac=list
  // 去发现类目 —— 43 个源就是 43 个子请求，直接超过免费版 50 的上限，
  // 会让整次搜索 500（2026-10-13 定位到的「只有 3 条源」的根因）。
  let animeClassIds = [];
  let keywordSearch = false;
  try {
    // 步骤 0（与列表同一轮请求内完成）：先看类目表，剔除「名字干净、内容全是成人」的伪装源。
    // 放在最前面是有意的：这类源接口是通的、片子也能播，只有类目表能识破它，
    // 如果放到最后判定，等于白花 4 次子请求去验证一个注定要丢的源。
    // 拿不到类目表时**不判死**（部分源不支持 ac=list），交给后面的四步探测决定。
    try {
      const classBody = await fetchJsonWithTimeout(buildApiUrl(source.api, { ac: 'list' }), listTimeoutMs);
      const stats = adultClassStats(classBody?.class);
      if (stats.total >= 4 && (stats.ratio > ADULT_CLASS_RATIO_LIMIT || stats.adult.length >= ADULT_CLASS_ABS_LIMIT)) {
        return {
          ...done(false, 'adult', `成人向类目 ${stats.adult.length}/${stats.total}：${stats.adult.slice(0, 4).join('/')}`),
          adult: true
        };
      }
      // 类目表顺手解析出动漫类目 ID（与 maccms.js 的 ANIME_CLASS_RE 同一口径）
      animeClassIds = (Array.isArray(classBody?.class) ? classBody.class : [])
        .filter((c) => /^(国产|日韩|欧美)动漫$/.test(String(c?.type_name || '').trim()))
        .map((c) => Number(c.type_id))
        .filter(Number.isFinite);
    } catch { /* 类目表取不到就跳过这一道，不据此判死 */ }

    // 关键词搜索能力：探测一次，结果写进源记录，搜索阶段照此决定要不要调用。
    // 实测有 8 个源明确回「暂不支持搜索」/「Current API forbids keyword search」，
    // 对它们发关键词请求纯属浪费子请求（而子请求是最稀缺的资源）。
    try {
      const kwBody = await fetchJsonWithTimeout(
        buildApiUrl(source.api, { ac: 'videolist', wd: '庆余年', pg: 1 }), listTimeoutMs
      );
      keywordSearch = Array.isArray(kwBody?.list) && kwBody.list.length > 0;
    } catch { keywordSearch = false; }

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

  return { ...done(true, 'ok'), segment_ok: segmentOk, animeClassIds, keywordSearch };
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

  // 1) 拉订阅（主库 + 补充库合并）
  const sub = await fetchAllSubscriptions(env, { url });
  const all = sub.sources;
  summary.total = all.length;
  summary.encoding = sub.encoding;
  summary.extras = sub.extras || [];

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

  // 4) 深探本批源（3 路并发，兼顾速度与子请求预算）。
  //
  // 2026-10-13 由串行改并发：串行时 6 个源要 20~40s，cron 的 waitUntil
  // 容易被掐断，探测结果写不进 R2 —— 表现就是「源列表长期不更新」。
  // 每条源最多 5 个子请求，3 路并发峰值约 15 个在途，安全落在免费版 50 以内。
  const results = new Array(slice.length);
  let nextIdx = 0;
  const probeNext = async () => {
    while (true) {
      const idx = nextIdx++;
      if (idx >= slice.length) return;
      const source = slice[idx];
      let res;
      try {
        res = await probeSourceDeep(source);
      } catch (err) {
        res = { ok: false, step: 'exception', error: String(err?.message || err).slice(0, 160) };
      }
      results[idx] = { source, res };
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(PROBE_CONCURRENCY, slice.length) }, probeNext)
  );

  for (const { source, res } of results) {
    if (!res) continue;
    try {
      summary.probed += 1;
      if (res.ok) {
        summary.passed += 1;
        passedMap.set(source.key, {
          ...source,
          weight: DYNAMIC_WEIGHT,
          latency_ms: res.latencyMs,
          segment_ok: !!res.segment_ok,
          // 探测副产品，供搜索阶段复用（避免每次搜索都对 43 个源发 ac=list）：
          //   anime_class_ids —— 动漫类目 ID，空数组表示「这个源没有动漫类目」
          //   keyword_search  —— 是否支持 ac=videolist&wd= 关键词搜索
          anime_class_ids: Array.isArray(res.animeClassIds) ? res.animeClassIds : [],
          keyword_search: !!res.keywordSearch,
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
      summary.errors.push({ key: source.key, step: 'merge', error: String(err?.message || err).slice(0, 160) });
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
