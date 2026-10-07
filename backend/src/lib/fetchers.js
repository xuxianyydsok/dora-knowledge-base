// 外部资源元信息抓取（仅抓元信息，不转发任何流媒体）
// - 视频：Bilibili / YouTube
// - 仓库：GitHub
// 全部使用原生 fetch，失败时抛出带 status 的错误，由路由层转换为响应。

import { HttpError } from './response.js';
import {
  getVodSources, searchMaccms, detailMaccms, checkMaccms, curatedMaccms, getAnimeClassIds
} from './maccms.js';
import { cinemetaLookup, bangumiLookup, kitsuLookup } from './metadb.js';
import { getMetingInstances, searchMetingMusic } from './meting.js';

const UA = 'knowledge-base-app/0.1 (+https://github.com/)';

// 给单个任务套一个「时间预算」：超出预算就返回失败哨兵，而不是让整批一起等它。
// 外部采集源质量参差，个别源经常挂满超时，把整次搜索拖到十几秒 ——
// 用预算把每个阶段钉死上限，慢源直接放弃，其余源的结果照常返回。
//（与 fetchWithTimeout 的区别：那个是单次请求超时，这个是「一批任务的整体阶段预算」。）
function withBudget(promise, ms, label = '外部接口超时') {
  let timer;
  const guard = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, e: new HttpError(504, label) }), ms);
  });
  return Promise.race([
    Promise.resolve(promise).then((v) => ({ ok: true, v }), (e) => ({ ok: false, e })),
    guard
  ]).finally(() => clearTimeout(timer));
}

// 带超时的 fetch：避免外部接口不可达时请求长时间悬挂
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new HttpError(504, `外部接口请求超时（${timeoutMs}ms）：${url}`);
    }
    throw new HttpError(502, `外部接口请求失败：${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------
// 视频：解析 Bilibili / YouTube 链接并抓取元信息
// ---------------------------------------------------------------
export function parseVideoUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new HttpError(422, '视频链接格式无效');
  }
  const host = url.hostname.replace(/^www\./, '');

  // Bilibili: BV 号 或 av 号
  if (host.endsWith('bilibili.com') || host === 'b23.tv') {
    const bv = url.pathname.match(/\/(BV[0-9A-Za-z]+)/);
    if (bv) return { platform: 'bilibili', id: bv[1], kind: 'bvid' };
    const av = url.pathname.match(/\/av(\d+)/);
    if (av) return { platform: 'bilibili', id: av[1], kind: 'aid' };
    throw new HttpError(422, '未能从链接中解析出 Bilibili 视频 ID');
  }

  // YouTube: watch?v= / youtu.be/ / shorts/
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
    let id = url.searchParams.get('v');
    if (!id && host === 'youtu.be') id = url.pathname.slice(1);
    if (!id) {
      const shorts = url.pathname.match(/\/shorts\/([0-9A-Za-z_-]+)/);
      if (shorts) id = shorts[1];
    }
    if (!id) throw new HttpError(422, '未能从链接中解析出 YouTube 视频 ID');
    return { platform: 'youtube', id, kind: 'videoId' };
  }

  throw new HttpError(422, '仅支持 Bilibili 与 YouTube 视频链接');
}

// Bilibili 视频元信息
// 注意：Cloudflare Workers 出口 IP 为共享地址，B站风控会对「非浏览器 UA」
// 返回 412 Precondition Failed。因此这里使用完整浏览器 UA + 源站 Referer，
// 并在失败时依次回退到 wbi/view 与 view 备用端点。
async function fetchBilibili(id, kind) {
  const param = kind === 'bvid' ? `bvid=${id}` : `aid=${id}`;
  const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  const endpoints = [
    `https://api.bilibili.com/x/web-interface/view?${param}`,
    `https://api.bilibili.com/x/web-interface/wbi/view?${param}`
  ];

  let body = null;
  let lastStatus = 0;
  for (const endpoint of endpoints) {
    let res;
    try {
      res = await fetchWithTimeout(endpoint, {
        headers: {
          'User-Agent': BROWSER_UA,
          Referer: 'https://www.bilibili.com/',
          Origin: 'https://www.bilibili.com',
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          // 提供匿名 buvid，降低被判定为爬虫的概率
          Cookie: `buvid3=${crypto.randomUUID()}infoc`
        }
      });
    } catch {
      continue;
    }
    lastStatus = res.status;
    if (!res.ok) continue;
    try {
      const parsed = await res.json();
      if (parsed.code === 0 && parsed.data) { body = parsed; break; }
      // 接口可达但业务码非 0，记录后继续尝试下一个端点
      body = parsed;
    } catch {
      continue;
    }
  }

  if (!body || body.code !== 0 || !body.data) {
    if (lastStatus === 412) {
      throw new HttpError(502, 'Bilibili 拒绝了本次请求 (412)，通常为出口 IP 风控，请稍后重试');
    }
    throw new HttpError(502, `Bilibili 元信息获取失败${body?.message ? `：${body.message}` : ''}`);
  }
  const d = body.data;
  return {
    platform: 'bilibili',
    external_id: d.bvid,
    title: d.title,
    author: d.owner?.name,
    cover_url: d.pic,
    duration: d.duration,               // 秒
    description: (d.desc || '').slice(0, 2000),
    embed_url: `https://player.bilibili.com/player.html?bvid=${d.bvid}&autoplay=0`,
    page_url: `https://www.bilibili.com/video/${d.bvid}`
  };
}

// YouTube 视频元信息（oEmbed，无需 API Key）
async function fetchYoutube(id) {
  const watch = `https://www.youtube.com/watch?v=${id}`;
  const res = await fetchWithTimeout(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`,
    { headers: { 'User-Agent': UA } }
  );
  if (!res.ok) throw new HttpError(502, `YouTube 元信息获取失败 (${res.status})`);
  const d = await res.json();
  return {
    platform: 'youtube',
    external_id: id,
    title: d.title,
    author: d.author_name,
    cover_url: d.thumbnail_url,
    duration: null,
    description: '',
    embed_url: `https://www.youtube.com/embed/${id}`,
    page_url: watch
  };
}

export async function fetchVideoMeta(rawUrl) {
  const { platform, id, kind } = parseVideoUrl(rawUrl);
  return platform === 'bilibili' ? fetchBilibili(id, kind) : fetchYoutube(id);
}

// ---------------------------------------------------------------
// GitHub 仓库元信息
// 可选 env.GITHUB_TOKEN 提升速率限制；未配置时使用匿名请求
// ---------------------------------------------------------------
export function parseGithubUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new HttpError(422, 'GitHub 链接格式无效');
  }
  if (!url.hostname.replace(/^www\./, '').endsWith('github.com')) {
    throw new HttpError(422, '仅支持 github.com 链接');
  }
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2) throw new HttpError(422, 'GitHub 链接需包含 owner/repo');
  return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
}

export async function fetchGithubMeta(rawUrl, env = {}) {
  const { owner, repo } = parseGithubUrl(rawUrl);
  const headers = { 'User-Agent': UA, Accept: 'application/vnd.github+json' };
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;

  const res = await fetchWithTimeout(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (res.status === 404) throw new HttpError(404, `GitHub 仓库不存在: ${owner}/${repo}`);
  if (!res.ok) throw new HttpError(502, `GitHub 接口请求失败 (${res.status})`);
  const d = await res.json();

  return {
    platform: 'github',
    owner: d.owner?.login || owner,
    repo: d.name || repo,
    full_name: d.full_name,
    title: d.full_name,
    description: d.description || '',
    stars: d.stargazers_count ?? 0,
    forks: d.forks_count ?? 0,
    language: d.language,
    topics: d.topics || [],
    html_url: d.html_url,
    homepage: d.homepage || null,
    avatar_url: d.owner?.avatar_url || null,
    archived: !!d.archived,
    updated_at: d.updated_at
  };
}

// ---------------------------------------------------------------
// 音乐元信息（多源聚合，全部无需 API Key）
//   1) Audius（主源）：独立音乐平台，提供【完整音轨】320kbps MP3，
//      CORS 全开，前端可直接播放，不存在试听截断。
//   2) iTunes Search：元信息与封面最规范，音频为 30s 试听，作为补充。
//   3) Deezer：iTunes 被限流（Workers 共享出口 IP 常返回 429）时的元信息兜底。
// 结果统一带 quality 字段：full=完整音轨，preview=试听片段。
// 音频文件不入库、后端不转发音频流，仅保存播放地址字符串。
// ---------------------------------------------------------------

const AUDIUS_APP = 'dora-knowledge-base';
// Audius 有多个发现节点，单个节点可能把某条音轨的 CID 拉黑（返回 403）。
// 依次提供多个节点地址，前端播放失败时自动切换下一个。
const AUDIUS_NODES = [
  'https://api.audius.co',
  'https://discoveryprovider.audius.co',
  'https://discoveryprovider2.audius.co'
];

function audiusStreamUrls(trackId) {
  return AUDIUS_NODES.map((n) => `${n}/v1/tracks/${trackId}/stream?app_name=${AUDIUS_APP}`);
}

// Audius：搜索完整音轨
async function searchAudiusMusic(q, limit) {
  const res = await fetchWithTimeout(
    `https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(q)}&limit=${limit}&app_name=${AUDIUS_APP}`,
    { headers: { 'User-Agent': UA, Accept: 'application/json' } }
  );
  if (!res.ok) throw new HttpError(502, `音乐元信息接口请求失败 (${res.status})`);

  const body = await res.json();
  const candidates = (body.data || [])
    .filter((t) => t.is_streamable !== false)
    .map((t) => ({
      platform: 'audius',
      external_id: String(t.id ?? ''),
      title: t.title || null,
      artist: t.user?.name || t.user?.handle || null,
      artist_avatar: t.user?.profile_picture?.['480x480']
        || t.user?.profile_picture?.['150x150'] || null,
      album: t.album_name || t.playlist_name || null,
      artwork_url: t.artwork?.['1000x1000'] || t.artwork?.['480x480'] || null,
      // 稳定 stream 端点：浏览器自动跟随 302 到签名地址，签名不会过期
      audio_url: audiusStreamUrls(t.id)[0],
      // 备用播放地址（多节点），前端在主地址失败时依次尝试
      audio_fallbacks: audiusStreamUrls(t.id).slice(1),
      preview_url: null,
      quality: 'full',
      duration: t.duration || null,
      genre: t.genre || null,
      release_year: t.release_date ? new Date(t.release_date).getFullYear() : null,
      page_url: t.permalink ? `https://audius.co${t.permalink}` : null
    }));

  return { source: 'audius', candidates };
}

async function searchItunesMusic(q, limit) {
  const res = await fetchWithTimeout(
    `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=${limit}`,
    { headers: { 'User-Agent': UA, Accept: 'application/json' } }
  );
  if (!res.ok) throw new HttpError(502, `音乐元信息接口请求失败 (${res.status})`);

  const body = await res.json();
  const candidates = (body.results || []).map((r) => ({
    platform: 'itunes',
    external_id: String(r.trackId ?? ''),
    title: r.trackName,
    artist: r.artistName,
    album: r.collectionName,
    artwork_url: (r.artworkUrl100 || '').replace('100x100bb', '600x600bb') || null,
    artist_avatar: null,
    audio_url: null,
    preview_url: r.previewUrl || null,
    quality: 'preview',
    duration: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : null,
    genre: r.primaryGenreName || null,
    release_year: r.releaseDate ? new Date(r.releaseDate).getFullYear() : null,
    page_url: r.trackViewUrl || null
  }));

  return { source: 'itunes', candidates };
}

async function searchDeezerMusic(q, limit) {
  const res = await fetchWithTimeout(
    `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    { headers: { 'User-Agent': UA, Accept: 'application/json' } }
  );
  if (!res.ok) throw new HttpError(502, `音乐元信息接口请求失败 (${res.status})`);

  const body = await res.json();
  // Deezer 出错时返回 200 + { error: {...} }
  if (body.error) {
    throw new HttpError(502, `音乐元信息接口请求失败：${body.error.message || body.error.type || '未知错误'}`);
  }

  const candidates = (body.data || []).map((r) => ({
    platform: 'deezer',
    external_id: String(r.id ?? ''),
    title: r.title || null,
    artist: r.artist?.name || null,
    artist_avatar: r.artist?.picture_xl || r.artist?.picture_big || null,
    album: r.album?.title || null,
    artwork_url: r.album?.cover_xl || r.album?.cover_big || r.album?.cover_medium || null,
    audio_url: null,
    // 注意：Deezer 试听链接带签名，约 15 分钟后失效，仅供即时试听
    preview_url: r.preview || null,
    quality: 'preview',
    duration: r.duration || null,
    genre: null,
    release_year: null,
    page_url: r.link || null
  }));

  return { source: 'deezer', candidates };
}

// ---------------------------------------------------------------
// 音乐主源：GD音乐台（https://music-api.gdstudio.xyz）
// iTunes / Deezer 只能给 30 秒试听；GD音乐台返回的是**完整曲目**直链：
//   types=search  搜索（source=netease / joox / bilibili）
//   types=url     取直链（br=999 请求最高音质）→ { url, br, size }
//   types=lyric   取 LRC 歌词      types=pic 取封面（返回 JSON，不是图片直链）
// 实测（2026-10-06，经代理）：netease 源稳定返回 br≈920~1620kbps、30~64MB 的 FLAC 完整曲；
// joox / bilibili 在本环境返回 br=-1（拿不到直链），因此默认只用 netease，
// 可用环境变量 GD_MUSIC_SOURCE 覆盖。
// 两个已知限制：
//   ① 5 分钟 50 次限频 —— 故直链按曲目缓存，一次搜索最多解析 limit 条；
//   ② 直链是网易云 CDN 的带时间戳签名地址（路径含 /20261006165420/ 之类），**会过期** ——
//      故已收藏曲目播放失败时由前端调 POST /api/music/stream 按 external_id 重新解析。
// 仅保存播放地址字符串，不下载音频文件、后端不转发音频流。
// ---------------------------------------------------------------
// 时间预算（毫秒）：外部接口质量参差，用预算把「最坏耗时」钉死，
// 避免个别慢接口把整次搜索拖到十几秒。
const MUSIC_BUDGET_MS = 7000;   // 音乐：全部音源并发阶段的整体预算
const ENRICH_BUDGET_MS = 4000;  // 影视：搜索后元信息补全阶段
const COVER_BUDGET_MS = 2500;   // 音乐：封面 / 歌手头像补全阶段
const GD_BASE = 'https://music-api.gdstudio.xyz/api.php';
export const GD_DEFAULT_SOURCE = 'netease';
const GD_URL_TTL = 10 * 60 * 1000;
// 实测：GD音乐台会拦截自定义 UA（返回空列表），必须用浏览器 UA
const GD_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const gdUrlCache = new Map(); // `${source}:${id}` -> { url, br, size, at }

async function gdApi(params, timeoutMs = 12000) {
  const url = `${GD_BASE}?${new URLSearchParams(params).toString()}`;
  const res = await fetchWithTimeout(
    url,
    { headers: { 'User-Agent': GD_UA, Accept: 'application/json' } },
    timeoutMs
  );
  if (!res.ok) throw new HttpError(502, `音乐接口请求失败 (${res.status})`);
  return res.json();
}

// 解析（并缓存）单曲直链
export async function resolveGdstudioUrl(id, source = GD_DEFAULT_SOURCE) {
  const key = `${source}:${id}`;
  const hit = gdUrlCache.get(key);
  if (hit && Date.now() - hit.at < GD_URL_TTL && hit.url) return hit;
  const d = await gdApi({ types: 'url', id, source, br: 999 });
  const info = {
    url: d?.url || null,
    br: Number(d?.br) > 0 ? Number(d.br) : null,
    size: Number(d?.size) || 0,
    source,
    at: Date.now()
  };
  if (info.url) gdUrlCache.set(key, info);
  return info;
}

// 解析（并缓存）封面：GD 的 pic 接口返回的是 JSON（内含图片地址），不能直接当 <img src>
async function resolveGdstudioCover(picId, source = GD_DEFAULT_SOURCE) {
  if (!picId) return null;
  const key = `pic:${source}:${picId}`;
  const hit = gdUrlCache.get(key);
  if (hit && Date.now() - hit.at < GD_URL_TTL) return hit.url;
  const d = await gdApi({ types: 'pic', id: picId, source, size: 500 }, 8000);
  const url = d?.url || null;
  if (url) gdUrlCache.set(key, { url, at: Date.now() });
  return url;
}

// GD 曲目 → 统一候选结构（audio_url 为可直接播放的完整曲直链）
function gdCandidate(t, source, resolved) {
  return {
    platform: 'gdstudio',
    gd_source: source,
    external_id: String(t.url_id || t.id || ''),
    title: t.name || null,
    artist: Array.isArray(t.artist) ? t.artist.join(' / ') : (t.artist || null),
    artist_avatar: null,
    album: t.album || null,
    // GD 的封面接口返回 JSON，不能直接当 <img src>；封面优先由同曲的 iTunes/Deezer 结果合并补全，
    // 仍未命中时由 fetchMusicMeta 用 gd_pic_id 补查（见 resolveGdstudioCover）
    artwork_url: null,
    gd_pic_id: t.pic_id || null,
    audio_url: resolved?.url || null,
    audio_fallbacks: [],
    preview_url: null,
    // 完整曲目（无损 FLAC），与 iTunes/Deezer 的 30 秒试听区分
    quality: 'full',
    bitrate: resolved?.br || null,
    format: resolved?.url && /\.flac(\?|$)/i.test(resolved.url) ? 'flac' : null,
    file_size: resolved?.size || 0,
    duration: null,
    genre: null,
    release_year: null,
    page_url: null
  };
}

// 每次搜索最多解析几条直链：GD 限频「5 分钟 50 次」且是共享出口 IP 的配额，
// 每条结果要消耗 1 次 types=url 额度，因此只解析最靠前的几条（其余结果拿不到地址会被丢弃）。
const GD_RESOLVE_LIMIT = 3;

// 搜索：并发解析最靠前的几条直链（限频考虑，不做全量解析）
// 关键改动（2026-10-07）：**未解析出直链的条目不再丢弃**。
// GD 的 types=search 不消耗解析额度，只有 types=url 才消耗（5 分钟 50 次共享配额），
// 因此可以多拿条目、只解析 Top 3，其余标记 needs_resolve 交给前端按需解析
// （用户点播/收藏时调 POST /api/music/stream 现取直链）。
// 这样搜索结果数量从「解析成功的那几条（≤3）」变成「源站命中的全部条目」。
async function searchGdstudioMusic(q, limit, source = GD_DEFAULT_SOURCE) {
  const list = await gdApi({ types: 'search', source, name: q, count: Math.max(limit, 30), pages: 1 });
  if (!Array.isArray(list) || !list.length) return { source: 'gdstudio', candidates: [] };

  const rows = list.slice(0, limit);
  const top = rows.slice(0, GD_RESOLVE_LIMIT);
  const settled = await Promise.allSettled(
    top.map((t) => resolveGdstudioUrl(t.url_id || t.id, source))
  );
  const resolved = new Map();
  top.forEach((t, i) => {
    const info = settled[i].status === 'fulfilled' ? settled[i].value : null;
    if (info?.url) resolved.set(String(t.url_id || t.id), info);
  });

  const candidates = rows.map((t) => {
    const c = gdCandidate(t, source, resolved.get(String(t.url_id || t.id)) || null);
    if (!c.audio_url) {
      c.needs_resolve = true;   // 前端据此在点播时调 /api/music/stream
      c.quality = 'full';       // 上游是完整曲目，只是直链还没取
    }
    return c;
  });
  return { source: 'gdstudio', candidates };
}

// GD 歌词（LRCLIB 缺词时的兜底，中文流行曲覆盖较好）
async function fetchGdstudioLyrics({ title, artist }, source = GD_DEFAULT_SOURCE) {
  const kw = [title, artist].filter(Boolean).join(' ');
  if (!kw) return null;
  const list = await gdApi({ types: 'search', source, name: kw, count: 5, pages: 1 });
  if (!Array.isArray(list) || !list.length) return null;
  for (const t of list.slice(0, 3)) {
    const d = await gdApi({ types: 'lyric', id: t.lyric_id || t.id, source });
    const text = d?.lyric || d?.tlyric || '';
    if (!text) continue;
    return {
      source: 'gdstudio',
      instrumental: false,
      synced: /\[\d{1,2}:\d{2}/.test(text) ? text : null,
      plain: text
    };
  }
  return null;
}

// TheAudioDB：歌手头像与简介（公开测试 key 123，限频低，只补第一条结果）
async function fetchArtistProfile(name) {
  const key = String(name || '').split(/[\/,&]/)[0].trim();
  if (!key || key.length > 60) return null;
  try {
    const res = await fetchWithTimeout(
      `https://www.theaudiodb.com/api/v1/json/123/search.php?s=${encodeURIComponent(key)}`,
      { headers: { 'User-Agent': UA, Accept: 'application/json' } },
      8000
    );
    if (!res.ok) return null;
    const a = (await res.json())?.artists?.[0];
    if (!a) return null;
    return {
      name: a.strArtist || key,
      avatar: a.strArtistThumb || a.strArtistLogo || a.strArtistFanart || null,
      bio: a.strBiography ? String(a.strBiography).slice(0, 300) : null
    };
  } catch {
    return null; // 补图失败不影响搜索结果
  }
}

// 归一化用于去重：同名同歌手视为同一首
function dedupeKey(c) {
  const norm = (s) => String(s || '').toLowerCase().replace(/[\s\-_.()（）[\]【】]/g, '');
  return `${norm(c.title)}|${norm(c.artist)}`;
}

// 音质优先级：完整曲目 > 试听片段；同档位按音源可信度。
// meting 与 gdstudio 都是完整曲目，audius 次之，itunes/deezer 只有 30 秒试听。
// 这里 gdstudio 略高于 meting，原因只有一个：**音质**。
//   实测 GD 返回 1619kbps FLAC（约 64MB/首），而 Meting 默认实例只给 netease 的 MP3
//   （br 参数被忽略，且 type=url 只是 302 跳到 m801.music.126.net 的 .mp3）。
// 但 GD 的直链是签名地址、会过期，且解析有「5 分钟 50 次」额度限制，
// 因此**未解析出直链的 GD 仍然降档**（见 candidateRank 的 needs_resolve），
// 不会把一堆「点了还要等解析」的条目顶到 Meting 的稳定结果前面。
const QUALITY_RANK = { full: 3, preview: 1 };
const PLATFORM_RANK = { gdstudio: 4, meting: 3, audius: 2, deezer: 1, itunes: 1 };

// 综合排序分 = 质量档 ×100 + 音源 ×10 + 是否已拿到直链。
// 「待解析（GD 未取直链）」降一档但仍高于试听片段：它有完整曲目的潜力，
// 且点播时会即时解析，不该被 30 秒试听挤到后面。
function candidateRank(c) {
  const quality = c.needs_resolve ? 2 : (QUALITY_RANK[c.quality] || 0);
  return quality * 100 + (PLATFORM_RANK[c.platform] || 0) * 10 + (c.audio_url ? 1 : 0);
}

// 合并同一首歌的多源结果：播放地址与音质取更优的一侧，封面/专辑/时长等元信息互补
// （GD音乐台拿不到可直接引用的封面地址，正好由 iTunes / Deezer 的封面补上）
function mergeCandidate(prev, next) {
  const better = candidateRank(next) > candidateRank(prev) ? next : prev;
  const other = better === next ? prev : next;
  return {
    ...other,
    ...better,
    artwork_url: better.artwork_url || other.artwork_url,
    artist_avatar: better.artist_avatar || other.artist_avatar,
    album: better.album || other.album,
    duration: better.duration || other.duration,
    release_year: better.release_year || other.release_year,
    genre: better.genre || other.genre,
    // 直链取「有」的一侧：合并双方只要任一侧解析出了直链就应保留下来
    audio_url: better.audio_url || other.audio_url,
    // 落败一侧的地址并入备用列表 —— 兼顾「音质」与「链路稳定」：
    // GD 的签名直链会过期，而 Meting 的取流地址是稳定的 302 端点，
    // 两者互为兜底，播放器在主地址失败时可依次重试。
    audio_fallbacks: [...new Set([
      ...(better.audio_fallbacks || []),
      ...(other.audio_url ? [other.audio_url] : []),
      ...(other.audio_fallbacks || [])
    ])].filter((u) => u && u !== (better.audio_url || other.audio_url)).slice(0, 5),
    // 试听片段保留为最后兜底：主直链失效时播放器仍能出声
    preview_url: better.preview_url || null,
    // 合并后若已有直链，就不再是「待解析」
    needs_resolve: !(better.audio_url || other.audio_url)
  };
}

export async function fetchMusicMeta(query, limit = 30, env = {}) {
  const q = (query || '').trim();
  if (!q) throw new HttpError(422, '缺少搜索关键词');
  // 每个上游都请求「至少 30 条」：只有拿到足够多的原始条目，
  // 跨源去重后才有足够结果可展示。（此前 limit 被逐层下传，最终被截到个位数。）
  const perSource = Math.max(limit, 30);
  const capped = Math.min(limit, 60);

  // 多源并发，任一失败不影响其余：
  //   Meting 公共实例 —— 搜索即带可直接播放的直链，是结果数量的主力
  //   GD音乐台 —— 完整曲目主源（网易云源，实测 900~1600kbps FLAC 直链）
  //   Audius   —— 独立音乐完整音轨（320kbps）
  //   iTunes / Deezer —— 仅 30 秒试听，主要作为元信息与封面来源
  const metingJobs = getMetingInstances(env).flatMap((inst) =>
    inst.servers.map((server) => searchMetingMusic(inst, server, q, perSource))
  );

  // 每个音源都套时间预算：任一慢源不再拖住整次搜索（Meting 公共实例偶发慢响应）。
  // 同一次同步表达式内创建 Promise 并立刻交给 Promise.all，避免未处理的拒绝。
  const settled = await Promise.all([
    ...metingJobs,
    searchGdstudioMusic(q, perSource, env.GD_MUSIC_SOURCE || GD_DEFAULT_SOURCE),
    searchAudiusMusic(q, perSource),
    searchItunesMusic(q, perSource),
    searchDeezerMusic(q, perSource)
  ].map((p) => withBudget(p, MUSIC_BUDGET_MS)));

  const sources = [];
  const merged = [];
  const index = new Map();
  for (const item of settled) {
    if (!item.ok || !item.v?.candidates.length) continue;
    sources.push(item.v.source);
    for (const c of item.v.candidates) {
      const key = dedupeKey(c);
      if (index.has(key)) {
        const i = index.get(key);
        merged[i] = mergeCandidate(merged[i], c);
        continue;
      }
      index.set(key, merged.length);
      merged.push(c);
    }
  }

  if (!merged.length) {
    // 同影视：区分「源不可用」与「确实没搜到」，避免正常空结果被报成错误
    const allFailed = settled.every((s) => !s.ok);
    return {
      query: q,
      source: 'none',
      sources: [],
      count: 0,
      candidates: [],
      note: allFailed
        ? '音乐接口暂时不可用，请稍后重试'
        : '未找到匹配的曲目，试试「歌名 歌手」或只输入歌名'
    };
  }

  // 可完整播放的排前面，试听片段垫底
  merged.sort((a, b) => candidateRank(b) - candidateRank(a));

  const top = merged.slice(0, capped);
  // 封面补全：GD音乐台不返回可直接引用的封面地址，优先用同曲的 iTunes/Deezer 封面（mergeCandidate 已合）；
  // 对仍缺封面的 GD 结果再补查 pic 接口 —— 最多 3 条，避免吃掉限频额度。
  const needCover = top
    .filter((c) => !c.artwork_url && c.platform === 'gdstudio' && c.gd_pic_id)
    .slice(0, 3);
  if (needCover.length) {
    await withBudget(Promise.all(needCover.map(async (c) => {
      c.artwork_url = await resolveGdstudioCover(c.gd_pic_id, c.gd_source).catch(() => null);
    })), COVER_BUDGET_MS);
  }
  // 歌手头像补全：只查第一条，失败静默（TheAudioDB 限频很低）
  if (top[0] && !top[0].artist_avatar) {
    const profile = await withBudget(fetchArtistProfile(top[0].artist), COVER_BUDGET_MS);
    if (profile.ok && profile.v?.avatar) top[0].artist_avatar = profile.v.avatar;
  }

  return {
    query: q,
    source: sources.join('+'),
    sources,
    count: top.length,
    candidates: top
  };
}

// ---------------------------------------------------------------
// 歌词：LRCLIB（开源、无需 Key、支持中文，返回带时间轴的同步歌词）
// 前端据此实现逐句高亮与自动滚动。
// ---------------------------------------------------------------
export async function fetchLyrics({ title, artist, album, duration }, gdSource = GD_DEFAULT_SOURCE) {
  if (!title || !artist) throw new HttpError(422, '缺少歌曲名或歌手名');

  // 抓取源（Audius 等）的歌手名常带前缀/后缀，例如「Jay 周杰伦」，
  // 直接精确匹配会失败，因此依次尝试多种候选写法。
  const clean = (s) => String(s || '').trim();
  const stripPrefix = (s) => clean(s).replace(/^.*?[\s\-–—]+(?=[^\s\-–—])/, '').trim();

  const titleCandidates = [...new Set([clean(title), stripPrefix(title)])].filter(Boolean);
  const artistCandidates = [...new Set([
    clean(artist),
    stripPrefix(artist),
    // 「Jay 周杰伦」→ 取中文部分；「Jay Chou」→ 取首词
    clean(artist).replace(/[A-Za-z0-9.&'\s-]+/g, '').trim(),
    clean(artist).split(/[\s,;&]+/)[0]
  ])].filter((s) => s && s.length > 1);

  // 1) 先试精确匹配（/api/get）：命中率最高，且时长一致时最准确
  for (const t of titleCandidates) {
    for (const a of artistCandidates) {
      const exact = new URLSearchParams({ artist_name: a, track_name: t });
      if (album) exact.set('album_name', album);
      if (duration) exact.set('duration', String(Math.round(duration)));
      try {
        const res = await fetchWithTimeout(
          `https://lrclib.net/api/get?${exact.toString()}`,
          { headers: { 'User-Agent': UA, Accept: 'application/json' } },
          12000
        );
        if (res.ok) {
          const d = await res.json();
          if (d && (d.syncedLyrics || d.plainLyrics)) {
            return {
              source: 'lrclib',
              instrumental: !!d.instrumental,
              synced: d.syncedLyrics || null,
              plain: d.plainLyrics || null
            };
          }
        }
      } catch {
        // 单个候选失败不影响后续尝试
      }
    }
  }

  // 2) 再走搜索（/api/search）：用歌名精确匹配，再按同步歌词与时长接近度排序
  const collect = [];
  for (const t of titleCandidates) {
    const search = new URLSearchParams({ track_name: t });
    try {
      const res = await fetchWithTimeout(
        `https://lrclib.net/api/search?${search.toString()}`,
        { headers: { 'User-Agent': UA, Accept: 'application/json' } },
        12000
      );
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) collect.push(...list);
      }
    } catch {
      // 忽略单次失败
    }
    if (collect.length) break;
  }

  // 搜索无结果时退化为关键词搜索（q 参数）
  if (!collect.length) {
    try {
      const res = await fetchWithTimeout(
        `https://lrclib.net/api/search?q=${encodeURIComponent(`${title} ${artist}`)}`,
        { headers: { 'User-Agent': UA, Accept: 'application/json' } },
        12000
      );
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) collect.push(...list);
      }
    } catch {
      // 忽略
    }
  }

  const usable = collect.filter((r) => r && (r.syncedLyrics || r.plainLyrics));
  if (!usable.length) {
    // 兜底：GD音乐台歌词（LRCLIB 缺词时，中文流行曲覆盖较好，同样带时间轴）
    try {
      const gd = await fetchGdstudioLyrics({ title, artist }, gdSource);
      if (gd) return gd;
    } catch {
      // 兜底失败按「未找到」处理
    }
    throw new HttpError(404, '未找到该歌曲的歌词');
  }

  // 排序：优先同步歌词 → 歌名完全一致 → 时长最接近
  const titleKey = (s) => String(s || '').toLowerCase().replace(/\s/g, '');
  const wantTitle = titleKey(titleCandidates[0]);
  const scored = usable
    .map((r) => ({
      row: r,
      synced: r.syncedLyrics ? 0 : 1,
      titleMatch: titleKey(r.trackName) === wantTitle ? 0 : 1,
      diff: duration && r.duration ? Math.abs(r.duration - duration) : 999
    }))
    .sort((a, b) => a.synced - b.synced || a.titleMatch - b.titleMatch || a.diff - b.diff);

  const best = scored[0].row;
  return {
    source: 'lrclib',
    instrumental: !!best.instrumental,
    synced: best.syncedLyrics || null,
    plain: best.plainLyrics || null
  };
}

// 解析用户直接提供的音乐链接（Apple Music / 其他），仅做基本校验
export function parseMusicUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new HttpError(422, '音乐链接格式无效');
  }
  return { platform: 'external', url: url.toString() };
}

// ---------------------------------------------------------------
// 影视元信息
// 默认使用 TVmaze（免费、无需 Key，覆盖剧集/综艺）；
// 若配置 env.TMDB_API_KEY，则优先使用 TMDB（电影 + 剧集更完整）。
// 仅抓取元信息与海报链接，影视原始文件不入库、后端不转发视频流。
// ---------------------------------------------------------------

// 清理影视简介中的 HTML（TVmaze summary 含 <p> 等标签）
function stripTags(html = '') {
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function searchTmdb(query, limit, env) {
  const url = `https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(env.TMDB_API_KEY)}`
    + `&query=${encodeURIComponent(query)}&language=zh-CN&include_adult=false`;
  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new HttpError(502, `TMDB 接口请求失败 (${res.status})`);
  const body = await res.json();

  const img = (p, size = 'w500') => (p ? `https://image.tmdb.org/t/p/${size}${p}` : null);
  const candidates = (body.results || [])
    .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
    .slice(0, Math.min(limit, 20))
    .map((r) => ({
      platform: 'tmdb',
      source: 'tmdb',
      external_id: String(r.id),
      media_type: r.media_type,
      title: r.title || r.name || '(无标题)',
      original_title: r.original_title || r.original_name || null,
      overview: r.overview || null,
      poster_url: img(r.poster_path),
      backdrop_url: img(r.backdrop_path, 'w780'),
      release_date: r.release_date || r.first_air_date || null,
      rating: typeof r.vote_average === 'number' ? Math.round(r.vote_average * 10) / 10 : null
    }));

  return { query, source: 'tmdb', count: candidates.length, candidates };
}

async function searchTvmaze(query, limit) {
  const res = await fetchWithTimeout(
    `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`,
    { headers: { 'User-Agent': UA } }
  );
  if (!res.ok) throw new HttpError(502, `TVmaze 接口请求失败 (${res.status})`);
  const body = await res.json();

  const candidates = (body || []).slice(0, Math.min(limit, 20)).map((entry) => {
    const s = entry.show || {};
    return {
      platform: 'tvmaze',
      source: 'tvmaze',
      external_id: String(s.id ?? ''),
      media_type: 'tv',
      title: s.name || '(无标题)',
      original_title: null,
      overview: s.summary ? stripTags(s.summary) : null,
      poster_url: s.image?.original || s.image?.medium || null,
      backdrop_url: null,
      release_date: s.premiered || null,
      runtime: s.averageRuntime || s.runtime || null,
      rating: s.rating?.average ?? null,
      genres: (s.genres || []).join(', ') || null,
      // TVmaze 只提供剧集资料页，没有视频直链
      page_url: s.url || null,
      playable_url: null
    };
  });

  return { source: 'tvmaze', candidates };
}

// ---------------------------------------------------------------
// Internet Archive：公有领域影视库，提供可直链播放的 MP4
// 这是本项目唯一能拿到「完整可播放视频」的免费来源（无需 Key）。
// 检索 → 逐个取 metadata → 挑选体积最大的 MP4 作为播放地址。
// 视频文件不入库、后端不转发视频流，仅保存直链字符串。
// ---------------------------------------------------------------
const IA_PLAYABLE_FORMATS = ['mpeg4', 'h.264', '512kb mpeg4', 'matroska', 'ogg video'];

function iaFileUrl(identifier, name) {
  return `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(name)}`;
}

// 从 IA 条目文件列表中挑选最合适的可播放视频文件
function pickIaVideoFile(files = []) {
  const videos = files.filter((f) => {
    const fmt = String(f.format || '').toLowerCase();
    const name = String(f.name || '').toLowerCase();
    return IA_PLAYABLE_FORMATS.includes(fmt) && /\.(mp4|m4v|mkv|ogv|webm)$/.test(name);
  });
  if (!videos.length) return null;
  // 优先 mp4（浏览器兼容最好），其次选体积最大（通常为完整版而非预告）
  const mp4 = videos.filter((f) => /\.(mp4|m4v)$/.test(String(f.name).toLowerCase()));
  const pool = mp4.length ? mp4 : videos;
  return pool.sort((a, b) => Number(b.size || 0) - Number(a.size || 0))[0];
}

async function searchInternetArchive(query, limit) {
  const params = new URLSearchParams({
    q: `title:(${query}) AND mediatype:movies AND format:(MPEG4)`,
    sort: 'downloads desc',
    rows: String(Math.min(Math.max(limit, 5), 12)),
    page: '1',
    output: 'json'
  });
  // 需要多个 fl[] 字段，URLSearchParams 无法表达重复键，手动拼接
  const searchUrl = `https://archive.org/advancedsearch.php?${params.toString()}`
    + `&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&fl%5B%5D=description`;

  const res = await fetchWithTimeout(searchUrl, { headers: { 'User-Agent': UA, Accept: 'application/json' } }, 15000);
  if (!res.ok) throw new HttpError(502, `影视元信息接口请求失败 (${res.status})`);
  const body = await res.json();
  const docs = body?.response?.docs || [];
  if (!docs.length) return { source: 'internetarchive', candidates: [] };

  // 并发取 metadata，挑出确实含可播放视频文件的条目
  const details = await Promise.allSettled(docs.map(async (doc) => {
    const metaRes = await fetchWithTimeout(
      `https://archive.org/metadata/${encodeURIComponent(doc.identifier)}`,
      { headers: { 'User-Agent': UA, Accept: 'application/json' } },
      15000
    );
    if (!metaRes.ok) throw new HttpError(502, 'metadata 获取失败');
    const meta = await metaRes.json();
    const file = pickIaVideoFile(meta.files);
    if (!file) throw new HttpError(404, '无可播放文件');
    return { doc, meta, file };
  }));

  const candidates = [];
  for (const item of details) {
    if (item.status !== 'fulfilled') continue;
    const { doc, meta, file } = item.value;
    const md = meta.metadata || {};
    const rawDesc = Array.isArray(md.description) ? md.description[0] : md.description;
    const year = md.year || doc.year || null;
    candidates.push({
      platform: 'internetarchive',
      source: 'internetarchive',
      external_id: String(doc.identifier),
      media_type: 'movie',
      title: md.title || doc.title || '(无标题)',
      original_title: null,
      overview: rawDesc ? stripTags(String(rawDesc)).slice(0, 2000) : null,
      poster_url: `https://archive.org/services/img/${encodeURIComponent(doc.identifier)}`,
      backdrop_url: null,
      release_date: year ? `${year}-01-01` : null,
      runtime: file.length ? Math.round(Number(file.length) / 60) : null,
      rating: null,
      genres: Array.isArray(md.subject) ? md.subject.slice(0, 4).join(', ') : (md.subject || null),
      director: md.director || null,
      cast_list: md.creator && md.creator !== md.director ? String(md.creator).slice(0, 300) : null,
      page_url: `https://archive.org/details/${encodeURIComponent(doc.identifier)}`,
      // 可直链播放的完整视频地址
      playable_url: iaFileUrl(doc.identifier, file.name)
    });
    if (candidates.length >= Math.min(limit, 20)) break;
  }

  return { source: 'internetarchive', candidates };
}

// 归一化用于去重：同名（忽略年份/标点）视为同一部
function movieKey(c) {
  return String(c.title || '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/[\s\-_.:：,，。'’"]/g, '');
}

// ---------------------------------------------------------------
// 影视主源：苹果CMS（maccms）采集接口
// 这是真正能搜到「电影/电视剧」并可直接播放的源：
// 并发查询全部配置的采集源，按标题+年份去重，多源结果合并线路。
// 参见 lib/maccms.js。仅抓取元信息与播放地址字符串。
// ---------------------------------------------------------------
// 实测（2026-10-07）除已移除的 zy360 外，各源关键词搜索均在 2.1s 内返回，
// 类目发现均在 5s 内返回；因此预算收到「比实测最慢值略宽」即可，
// 既保住正常源，又把个别源抖动时的最坏耗时钉住。
const KW_BUDGET_MS = 4000;      // 关键词搜索阶段整体预算
const ANIME_BUDGET_MS = 3200;   // 动漫类目补充阶段预算

async function searchMaccmsAll(keyword, limit, env) {
  const sources = getVodSources(env);
  // 每个源都要求「至少 20 条」：跨源按片名去重后条目会大幅缩水
  //（同一部剧在 9 个源各占一条，去重后只剩 1 条），
  // 若把 limit 直接下传，去重后往往只剩几条 —— 这是「搜一部剧只有很少内容」的主因之一。
  const perSource = Math.max(limit, 20);

  // ① 关键词搜索 与 ② 动漫类目发现 **并发**发起，并各套时间预算。
  // 两者在同一个同步表达式里创建 Promise 并立刻交给 all，
  // 既不会出现「中间隔着 await → 未处理的 Promise 拒绝」（会导致整请求中断），
  // 也不让类目发现串行拖慢整次搜索。
  const [kwSettled, animeIds] = await Promise.all([
    Promise.all(sources.map((s) => withBudget(
      searchMaccms(s, keyword, perSource), KW_BUDGET_MS, `${s.name} 搜索超时`
    ))),
    Promise.all(sources.map((s) => withBudget(
      getAnimeClassIds(s), ANIME_BUDGET_MS, `${s.name} 类目发现超时`
    )))
  ]);

  // ③ 动漫类目搜索依赖 ② 的结果，只能在之后发起。
  // 这一步不能省：动漫正片在关键词搜索里几乎被真人剧、短剧和同名作品挤掉
  //（实测「凡人修仙传」关键词命中 0 条动漫，按类目命中 7 条）。
  const animeTasks = [];
  sources.forEach((s, i) => {
    const ids = animeIds[i].ok && Array.isArray(animeIds[i].v) ? animeIds[i].v : [];
    for (const t of ids) {
      animeTasks.push({ key: s.key, run: () => searchMaccms(s, keyword, perSource, t) });
    }
  });
  const animeSettled = animeTasks.length
    ? await Promise.all(animeTasks.map((t) => withBudget(t.run(), ANIME_BUDGET_MS)))
    : [];

  const settled = [...kwSettled, ...animeSettled];
  const keys = [...sources.map((s) => s.key), ...animeTasks.map((t) => t.key)];

  const sourcesUsed = [];
  const merged = [];
  const index = new Map();
  for (let i = 0; i < settled.length; i++) {
    const item = settled[i];
    if (!item.ok || !item.v?.length) continue;
    const srcKey = keys[i];
    if (!sourcesUsed.includes(srcKey)) sourcesUsed.push(srcKey);
    for (const c of item.v) {
      // 同一部片在不同采集源里年份可能不一致（如「觉醒年代」2019/2021），
      // 因此仅按片名去重，避免同一部剧出现多条重复结果。
      const key = movieKey(c);
      if (index.has(key)) {
        // 同一条目出现在多个源：合并线路，优先保留有可播放地址的版本
        const prev = merged[index.get(key)];
        merged[index.get(key)] = {
          ...prev,
          playable_url: prev.playable_url || c.playable_url,
          routes: [...prev.routes, ...c.routes],
          // 取更完整的元信息：评分、简介、海报、集数
          rating: prev.rating ?? c.rating,
          overview: prev.overview || c.overview,
          poster_url: prev.poster_url || c.poster_url,
          episode_count: Math.max(prev.episode_count || 0, c.episode_count || 0),
          remarks: prev.remarks || c.remarks,
          source: prev.source,
          source_name: prev.source_name,
          // 合并多源来源标记，便于前端展示「多源」
          alt_sources: [...new Set([...(prev.alt_sources || []), c.source])]
        };
        continue;
      }
      index.set(key, merged.length);
      merged.push(c);
    }
  }

  // 与关键词的相关度排序：完全同名 > 前缀命中 > 包含 > 其他；同档位保持「先关键词搜索、后类目搜索」的原顺序，
  // 这样「凡人修仙传」「凡人修仙传2020」这类正片会排在「凡人修仙传之XX外传」之前。
  const kw = String(keyword || '').replace(/\s/g, '');
  const relevance = (c) => {
    const t = String(c.title || '').replace(/\s/g, '');
    if (t === kw) return 0;
    if (t.startsWith(kw)) return 1;
    if (t.includes(kw)) return 2;
    return 3;
  };
  const ranked = merged
    .map((c, i) => ({ c, i, r: relevance(c), playable: c.playable_url ? 0 : 1 }))
    .sort((a, b) => a.r - b.r || a.playable - b.playable || a.i - b.i)
    .map((x) => x.c);

  return { sources: sourcesUsed, candidates: ranked, allFailed: settled.every((s) => !s.ok) };
}

// ---------------------------------------------------------------
// 元数据补全（Cinemeta / Bangumi / Kitsu，见 lib/metadb.js）
// 采集源的海报与评分偶有缺失，动漫条目的封面质量也参差。
// 只补前 limit 条、且确实缺字段的条目，且每条最多再花 1~2 次外部请求，避免拖慢搜索；
// 任一补全失败静默跳过（metadb 内部已做错误隔离）。
// ---------------------------------------------------------------
const ANIME_RE = /(动漫|动画)/;

async function enrichOne(c) {
  const isAnime = ANIME_RE.test(String(c.type_name || ''));
  let patch = null;

  // 动漫：优先 Bangumi（中文封面最准），未命中再退 Kitsu
  if (isAnime && !c.poster_url) {
    patch = await bangumiLookup(c.title).catch(() => null)
      || await kitsuLookup(c.title).catch(() => null);
  }
  // 电影/剧集：缺海报或缺评分时用 Cinemeta 补
  if (!patch && (!c.poster_url || !c.rating)) {
    patch = await cinemetaLookup(c.title, { mediaType: c.media_type }).catch(() => null);
  }
  if (!patch) return c;

  return {
    ...c,
    // 采集源自带字段优先，补全只填空缺
    poster_url: c.poster_url || patch.poster_url || null,
    backdrop_url: c.backdrop_url || patch.backdrop_url || null,
    rating: c.rating ?? patch.rating ?? null,
    overview: c.overview || patch.overview || null,
    release_date: c.release_date || patch.release_date || null,
    imdb_id: patch.imdb_id || null
  };
}

async function enrichMovieCandidates(candidates, limit = 4) {
  const head = candidates.slice(0, limit);
  const tail = candidates.slice(limit);
  const enriched = await Promise.all(head.map((c) => enrichOne(c)));
  return [...enriched, ...tail];
}

export async function fetchMovieMeta(query, limit = 24, env = {}) {
  const q = (query || '').trim();
  if (!q) throw new HttpError(422, '缺少搜索关键词');
  const capped = Math.min(limit, 60);

  // 主源：苹果CMS 采集接口（真正的影视资源站，含可直接播放的 m3u8/mp4）
  const primary = await searchMaccmsAll(q, capped, env);
  if (primary.candidates.length) {
    // 前 N 条补全海报/评分（缺字段时才请求，动漫走 Bangumi/Kitsu）
    // 补全（Cinemeta/Bangumi/Kitsu）走外部库，同样套时间预算：
    // 「补一张海报」不该把整次搜索从 6 秒拖到十几秒。超时就先用采集源自带的海报与评分。
    const head = primary.candidates.slice(0, capped);
    const enriched = await withBudget(enrichMovieCandidates(head), ENRICH_BUDGET_MS);
    const candidates = enriched.ok ? enriched.v : head;
    // 新片优先：按上映日期降序，可播放的优先
    candidates.sort((a, b) => {
      const playableDiff = Number(!!b.playable_url) - Number(!!a.playable_url);
      if (playableDiff !== 0) return playableDiff;
      const yearA = parseInt((a.release_date || '0000').slice(0, 4)) || 0;
      const yearB = parseInt((b.release_date || '0000').slice(0, 4)) || 0;
      return yearB - yearA;
    });
    return {
      query: q,
      source: primary.sources.join('+') || 'maccms',
      sources: primary.sources,
      count: candidates.length,
      candidates
    };
  }

  // 兜底：采集源全部不可用时，回退公有领域片库（Internet Archive）与剧集资料库
  const settled = await Promise.allSettled([
    searchInternetArchive(q, capped),
    searchTvmaze(q, capped)
  ]);
  const sources = [];
  const merged = [];
  for (const item of settled) {
    if (item.status !== 'fulfilled') continue;
    sources.push(item.value.source);
    merged.push(...item.value.candidates);
  }
  if (!merged.length) {
    // 「搜不到」与「源挂了」是两件事，不该都表现为 502 报错：
    // 前者对用户是正常结果（换个词就行），后者才值得提示稍后重试。
    // 返回空结果 + note，前端据此渲染空状态并给出可操作建议。
    const allFailed = primary.allFailed;
    return {
      query: q,
      source: 'none',
      sources: [],
      count: 0,
      candidates: [],
      note: allFailed
        ? '采集源暂时不可用，请稍后重试'
        : '未找到匹配的影视资源，试试更短的关键词或换个说法'
    };
  }
  merged.sort((a, b) => Number(!!b.playable_url) - Number(!!a.playable_url));
  return {
    query: q,
    source: sources.join('+'),
    sources,
    count: merged.length,
    candidates: merged.slice(0, capped)
  };
}

// 精选片单（影视首页用）
// 采集源按「最近更新」排序时前几页几乎全是体育直播 / 新闻，因此首页不再用 h 参数，
// 改为按电影片 / 连续剧的子类型取候选，过滤掉预告片、电影解说、综艺、体育等内容。
// sort=hot 按评分优先（默认，首页推荐）；sort=new 按年份优先（最新入库）。
export async function fetchMovieLatest(limit = 24, env = {}, sort = 'hot') {
  const sources = getVodSources(env);
  const perSource = Math.max(12, Math.ceil(limit / sources.length));
  const settled = await Promise.allSettled(
    sources.map((s) => curatedMaccms(s, perSource))
  );

  const used = [];
  const merged = [];
  const index = new Map();
  for (let i = 0; i < settled.length; i++) {
    const item = settled[i];
    if (item.status !== 'fulfilled' || !item.value.length) continue;
    used.push(sources[i].key);
    for (const c of item.value) {
      const key = movieKey(c);
      if (index.has(key)) {
        // 同一部片出现在多个源：合并线路，保留可播放地址
        const prev = merged[index.get(key)];
        merged[index.get(key)] = {
          ...prev,
          playable_url: prev.playable_url || c.playable_url,
          routes: [...prev.routes, ...c.routes],
          rating: prev.rating ?? c.rating,
          poster_url: prev.poster_url || c.poster_url,
          episode_count: Math.max(prev.episode_count || 0, c.episode_count || 0),
          remarks: prev.remarks || c.remarks,
          alt_sources: [...new Set([...(prev.alt_sources || []), c.source])]
        };
        continue;
      }
      index.set(key, merged.length);
      merged.push(c);
    }
  }

  const yearOf = (c) => Number(String(c.release_date || '').slice(0, 4)) || 0;
  merged.sort((a, b) => (sort === 'new'
    ? (yearOf(b) - yearOf(a)) || (Number(b.rating) || 0) - (Number(a.rating) || 0)
    : (Number(b.rating) || 0) - (Number(a.rating) || 0) || (yearOf(b) - yearOf(a))));

  return { sources: used, sort, count: merged.length, candidates: merged.slice(0, limit) };
}

// 采集源详情（选集用）：按 source key + 资源 ID 取完整线路
export async function fetchMovieDetailBySource(sourceKey, id, env = {}) {
  const source = getVodSources(env).find((s) => s.key === sourceKey);
  if (!source) throw new HttpError(404, `采集源不存在：${sourceKey}`);
  return detailMaccms(source, id);
}

// 采集源健康检查（设置页展示）
export async function checkVodSources(env = {}) {
  const sources = getVodSources(env);
  const results = await Promise.all(sources.map((s) => checkMaccms(s)));
  return { sources: results };
}
