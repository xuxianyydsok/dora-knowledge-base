// B 站曲目支持 —— **后端版本**（与 frontend/src/lib/bilibili.js 同源同规则）
//
// 为什么前后端各放一份：Worker 与前端是两个独立构建产物，没有共享源码目录。
// 两边的解析规则必须一致（前端拼播放器地址、后端校验入库），
// 所以这里的内容与前端那份保持一致；改动时**必须两边一起改**，
// 并且 tests/bilibili.probe.mjs 会同时跑两份、断言结果一致。
//
// B 站视频号格式：BV + 10 位 base58 字符（大小写敏感，不能统一转大小写）。
// 例：BV1GJ411x7h7
const BVID_RE = /BV[0-9A-Za-z]{10}/;

// 旧版 AV 号（纯数字 aid）：B 站仍在用，允许输入，但**无法直接拼嵌入地址**，
// 需要先查一次接口换成 BV 号（那一步要联网，不在纯函数里做）。
const AVID_RE = /(?:^|[^0-9])av(\d{1,12})(?:[^0-9]|$)/i;

/**
 * 从任意输入里抽出 B 站视频号。
 *
 * 支持的形式（用户可能粘贴任意一种）：
 *   · 完整链接  https://www.bilibili.com/video/BV1GJ411x7h7?p=1
 *   · 短链接    https://b23.tv/xxxxxx        （需要联网跳转，这里只识别出「是短链」）
 *   · 手机端    https://m.bilibili.com/video/BV1GJ411x7h7
 *   · 播放器    https://player.bilibili.com/player.html?bvid=BV1GJ411x7h7
 *   · 纯 BV 号  BV1GJ411x7h7
 *   · 带分 P    ...?p=3   → 同时解析出分 P 号
 *
 * @returns {{ bvid: string|null, p: number|null, isShortLink: boolean, isAv: boolean }}
 *   bvid 为 null 且 isShortLink 为 true 时，调用方需要先展开短链再解析。
 */
export function parseBilibiliInput(input) {
  const raw = String(input || '').trim();
  if (!raw) return { bvid: null, p: null, isShortLink: false, isAv: false };

  // 分 P：只在明确带 ?p= 或 &p= 时取，避免把 BV 号里的数字当成分 P
  let p = null;
  const pMatch = raw.match(/[?&]p=(\d{1,4})(?:&|$)/);
  if (pMatch) {
    const n = Number(pMatch[1]);
    if (Number.isFinite(n) && n > 0) p = n;
  }

  // 短链（b23.tv）：只能识别，不能在这里展开（要联网）
  if (/^(https?:\/\/)?b23\.tv\//i.test(raw)) {
    return { bvid: null, p, isShortLink: true, isAv: false };
  }

  // BV 号：直接找，不依赖链接结构（这样任何形态的链接都能命中）
  const bv = raw.match(BVID_RE);
  if (bv) return { bvid: bv[0], p, isShortLink: false, isAv: false };

  // AV 号
  const av = raw.match(AVID_RE);
  if (av) return { bvid: null, p, isShortLink: false, isAv: true, aid: Number(av[1]) };

  return { bvid: null, p, isShortLink: false, isAv: false };
}

/**
 * 生成 B 站官方播放器的嵌入地址。
 *
 * 参数说明（都是 B 站嵌入播放器支持的）：
 *   bvid      必填
 *   p         分 P（MV 常有多个分 P）
 *   autoplay  是否自动播放。默认 **false** ——
 *             浏览器会拦截「非用户手势触发的自动播放（带声音）」，
 *             传 true 反而会出现「静音自动播」的怪异行为。用户点了播放再播更符合预期。
 *   danmaku   是否显示弹幕，默认 **0（关）**。
 *             用户要的是「音乐 / MV 播放器」，不是视频站；弹幕盖在 MV 上很干扰。
 *             想看弹幕的可以在播放器里自己打开（B 站播放器带这个开关）。
 *   highQuality 是否默认高清，默认 1（MV 看画质）
 */
export function bilibiliEmbedUrl(bvid, { p = null, autoplay = false, danmaku = false, highQuality = true } = {}) {
  const id = String(bvid || '').trim();
  if (!BVID_RE.test(id)) return null;
  const params = new URLSearchParams();
  params.set('bvid', id);
  params.set('autoplay', autoplay ? '1' : '0');
  params.set('danmaku', danmaku ? '1' : '0');
  params.set('high_quality', highQuality ? '1' : '0');
  // 关掉「相关推荐」浮层：默认会盖住画面右下角，MV 看起来像在看视频站
  params.set('poster', '0');
  params.set('as_wide', '1');
  if (p && Number(p) > 0) params.set('p', String(Number(p)));
  return `https://player.bilibili.com/player.html?${params.toString()}`;
}

/** 是否是合法的 B 站视频号（用于入库前校验）。 */
export function isValidBvid(v) {
  return BVID_RE.test(String(v || '').trim());
}

/** B 站视频的规范播放页地址（给「去 B 站看原片」用）。 */
export function bilibiliPageUrl(bvid, { p = null } = {}) {
  const id = String(bvid || '').trim();
  if (!BVID_RE.test(id)) return null;
  const suffix = p && Number(p) > 0 ? `?p=${Number(p)}` : '';
  return `https://www.bilibili.com/video/${id}${suffix}`;
}
