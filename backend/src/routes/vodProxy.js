// 影视播放代理：GET /api/vod/proxy?u=<encodeURIComponent(上游地址)>
// 背景：光速/速播/豪华/艾坤等采集源的 m3u8 在 443 端口，但 .ts 分片在 HTTPS 非标准端口
// （:999 / :9999 / :65），很多网络会拦这些端口，浏览器里只剩 360/魔都 能播。
// 做法：Worker 代取上游（Worker 出站不受这些端口限制），
// - m3u8：把所有 URI 行和 URI="..."（EXT-X-KEY / EXT-X-MAP / EXT-X-MEDIA）改写成经本接口的绝对地址；
//   媒体播放列表顺带过滤插播广告（见 filterAds）；短缓存
// - 分片 / 密钥：原样流式透传（支持 Range → 206），边缘长缓存
// 纯代理、不涉及用户数据，故不走鉴权（访客可用）。
// 安全：仅 http/https；拒绝 localhost / 内网 IP；仅允许已知影视 CDN 域名，或路径是媒体后缀。

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MAX_M3U8 = 2 * 1024 * 1024;   // m3u8 最大 2MB
const SEG_TTL = 86400;              // 分片 / 密钥边缘缓存 1 天
const M3U8_TTL = 300;               // 播放列表缓存 5 分钟

// 已知采集源播放 / 分片域名（后缀匹配）
const KNOWN_HOSTS = [
  'gsuus.com', 'gszyi.com', 'guangsuapi.com',
  'xluuss.com', 'xlzyd.com', 'subokk.com', 'subocaiji.com',
  'hhuus.com', 'hhwenjian.com', 'hhzyapi.com',
  'bfikuncdn.com', 'kkzycdn.com', 'ikunzyapi.com',
  'guoluche.com', '360zyzz.com',
  'modujx13.com', 'mdzyapi.com'
];
const MEDIA_EXT = /\.(m3u8|m3u|ts|key|m4s|mp4|m4a|m4v|aac|vtt|webvtt|jpg|jpeg|png|gif|bmp|webp|image)$/i;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
  'Access-Control-Allow-Headers': 'Range,Content-Type',
  'Access-Control-Expose-Headers': 'Content-Length,Content-Range,Accept-Ranges,X-Dora-Ads-Removed',
  'Access-Control-Max-Age': '86400'
};

function err(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS }
  });
}

function isPrivateHost(host) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h.includes(':')) {   // IPv6
    return h === '::1' || h === '::' || /^(fc|fd|fe8|fe9|fea|feb)/.test(h) || h.startsWith('::ffff:');
  }
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

function isKnownHost(host) {
  const h = host.toLowerCase();
  return KNOWN_HOSTS.some((d) => h === d || h.endsWith(`.${d}`));
}

// 校验目标地址；不合法返回 null
function checkTarget(raw) {
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password) return null;
  if (isPrivateHost(u.hostname)) return null;
  if (!isKnownHost(u.hostname) && !MEDIA_EXT.test(u.pathname)) return null;
  return u;
}

function looksLikeM3u8(target, contentType) {
  return /mpegurl/i.test(contentType || '') || /\.m3u8?$/i.test(target.pathname);
}

// —— 广告过滤 ——
// 这些 maccms CDN 的插播广告被 #EXT-X-DISCONTINUITY 夹在正片中间，且分片目录与正片不同
// （正片 /20240523/6Z9jGK4r/2000kb/hls/xxx.ts，广告 /20261009/YzHFe6bI/10103kb/hls/xxx.ts）。
// 规则：按 DISCONTINUITY 切块，统计每块分片的「目录」；与全片主目录（按时长加权多数）不同的块整块丢掉。
// 目录都一样时再看文件名形态（长度+是否纯数字序号），形态不同且块总时长 < 60s 的也丢掉。
function segDir(uri) {
  const p = uri.split(/[?#]/)[0];
  return p.slice(0, p.lastIndexOf('/') + 1);
}
function segShape(uri) {
  const name = uri.split(/[?#]/)[0].split('/').pop() || '';
  const stem = name.replace(/\.[^.]+$/, '');
  const digits = /\d+$/.test(stem) ? stem.replace(/\d+$/, '#') : `len${stem.length}`;
  return digits;
}

export function filterAds(lines) {
  // 切块：每块 = { tags: [...前置行], segs: [{pre:[], uri, dur}], disc: bool }
  const blocks = [];
  let cur = { segs: [] };
  let pending = [];
  const head = [];
  let started = false;
  for (const line of lines) {
    const t = line.trim();
    if (!started && !t.startsWith('#EXTINF') && !t.startsWith('#EXT-X-DISCONTINUITY') && (t.startsWith('#') || !t)) {
      if (t === '#EXT-X-ENDLIST') { pending.push(line); continue; }
      head.push(line); continue;
    }
    started = true;
    if (t === '#EXT-X-DISCONTINUITY') {
      if (cur.segs.length) blocks.push(cur);
      cur = { segs: [], pre: pending };
      pending = [];
      continue;
    }
    if (!t || t.startsWith('#')) { pending.push(line); continue; }
    const inf = pending.find((l) => l.startsWith('#EXTINF'));
    const dur = inf ? parseFloat(inf.slice(8)) || 0 : 0;
    cur.segs.push({ pre: pending, uri: t, dur });
    pending = [];
  }
  if (cur.segs.length) blocks.push(cur);
  const tail = pending;

  if (blocks.length < 2) return { lines, removed: 0 };

  const dirW = new Map();
  const shapeW = new Map();
  for (const b of blocks) for (const s of b.segs) {
    dirW.set(segDir(s.uri), (dirW.get(segDir(s.uri)) || 0) + s.dur + 0.001);
    shapeW.set(segShape(s.uri), (shapeW.get(segShape(s.uri)) || 0) + s.dur + 0.001);
  }
  const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const mainDir = top(dirW);
  const mainShape = top(shapeW);
  const multiDir = dirW.size > 1;

  let removed = 0;
  const keep = blocks.filter((b) => {
    const total = b.segs.reduce((n, s) => n + s.dur, 0);
    const dirs = new Map();
    const shapes = new Map();
    for (const s of b.segs) {
      dirs.set(segDir(s.uri), (dirs.get(segDir(s.uri)) || 0) + 1);
      shapes.set(segShape(s.uri), (shapes.get(segShape(s.uri)) || 0) + 1);
    }
    const bDir = top(dirs);
    const bShape = top(shapes);
    const ad = multiDir ? bDir !== mainDir : (bShape !== mainShape && total < 60);
    if (ad) removed += b.segs.length;
    return !ad;
  });
  if (!removed || !keep.length) return { lines, removed: 0 };

  const out = [...head];
  keep.forEach((b, i) => {
    if (i > 0) out.push('#EXT-X-DISCONTINUITY');
    for (const s of b.segs) { out.push(...s.pre, s.uri); }
  });
  out.push(...tail);
  return { lines: out, removed };
}

function rewriteM3u8(text, base, proxyBase, clean = true) {
  const wrap = (uri) => {
    let abs;
    try { abs = new URL(uri, base).toString(); } catch { return uri; }
    return `${proxyBase}?u=${encodeURIComponent(abs)}`;
  };
  let lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  let removed = 0;
  // 媒体播放列表（有 EXTINF）才做广告过滤；master 列表不动
  if (clean && lines.some((l) => l.startsWith('#EXTINF'))) {
    const r = filterAds(lines);
    lines = r.lines; removed = r.removed;
  }
  const out = lines.map((line) => {
    const t = line.trim();
    if (!t) return line;
    if (t.startsWith('#')) {
      return t.replace(/URI="([^"]+)"/g, (_m, uri) => `URI="${wrap(uri)}"`);
    }
    return wrap(t);
  });
  return { body: out.join('\n'), removed };
}

export async function vodProxy(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const reqUrl = new URL(request.url);
  const raw = reqUrl.searchParams.get('u') || '';
  const target = checkTarget(raw);
  if (!target) return err(400, '代理地址不合法');
  const clean = reqUrl.searchParams.get('clean') !== '0';
  const proxyBase = `${reqUrl.origin}${reqUrl.pathname}`;

  const headers = {
    'User-Agent': UA,
    Referer: `${target.origin}/`,
    Accept: '*/*'
  };
  const range = request.headers.get('Range');
  if (range) headers.Range = range;

  const guessM3u8 = /\.m3u8?$/i.test(target.pathname);
  let upstream;
  try {
    upstream = await fetch(target.toString(), {
      headers,
      redirect: 'follow',
      cf: guessM3u8 ? { cacheTtl: M3U8_TTL, cacheEverything: true } : { cacheTtl: SEG_TTL, cacheEverything: true }
    });
  } catch (e) {
    return err(502, `上游连接失败：${e?.message || e}`);
  }
  if (!upstream.ok && upstream.status !== 206) {
    return err(upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502, `上游返回 ${upstream.status}`);
  }

  const ct = upstream.headers.get('content-type') || '';
  // 按 content-type / 后缀判断 m3u8；都不像但又不是明确的二进制类型时，嗅探开头是否 #EXTM3U
  let isM3u8 = looksLikeM3u8(target, ct);
  if (!isM3u8 && !range && /^text\//i.test(ct)) {
    const len = Number(upstream.headers.get('content-length') || 0);
    if (len && len <= MAX_M3U8) {
      const peek = await upstream.clone().text();
      if (peek.trimStart().startsWith('#EXTM3U')) isM3u8 = true;
    }
  }

  if (isM3u8) {
    const len = Number(upstream.headers.get('content-length') || 0);
    if (len > MAX_M3U8) return err(413, '播放列表过大');
    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_M3U8) return err(413, '播放列表过大');
    const text = new TextDecoder().decode(buf);
    if (!text.trimStart().startsWith('#EXTM3U')) return err(502, '上游返回的不是 m3u8');
    // 以最终地址（跟随重定向后）为相对路径基准
    const base = upstream.url || target.toString();
    const { body, removed } = rewriteM3u8(text, base, proxyBase, clean);
    return new Response(body, {
      status: 200,
      headers: {
        'content-type': 'application/vnd.apple.mpegurl',
        'cache-control': `public, max-age=${M3U8_TTL}`,
        'X-Dora-Ads-Removed': String(removed),
        ...CORS
      }
    });
  }

  // 二进制：流式透传
  const out = new Headers(CORS);
  for (const k of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
    const v = upstream.headers.get(k);
    if (v) out.set(k, v);
  }
    if (/\.ts$/i.test(target.pathname)) out.set('content-type', 'video/mp2t');
  if (/\.key$/i.test(target.pathname)) out.set('content-type', 'application/octet-stream');
  out.set('cache-control', `public, max-age=${SEG_TTL}`);
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
