// 外部资源元信息抓取（仅抓元信息，不转发任何流媒体）
// - 视频：Bilibili / YouTube
// - 仓库：GitHub
// 全部使用原生 fetch，失败时抛出带 status 的错误，由路由层转换为响应。

import { HttpError } from './response.js';

const UA = 'knowledge-base-app/0.1 (+https://github.com/)';

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
async function fetchBilibili(id, kind) {
  const param = kind === 'bvid' ? `bvid=${id}` : `aid=${id}`;
  const res = await fetchWithTimeout(`https://api.bilibili.com/x/web-interface/view?${param}`, {
    headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com' }
  });
  if (!res.ok) throw new HttpError(502, `Bilibili 接口请求失败 (${res.status})`);
  const body = await res.json();
  if (body.code !== 0 || !body.data) {
    throw new HttpError(502, `Bilibili 元信息获取失败: ${body.message || body.code}`);
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

// 归一化用于去重：同名同歌手视为同一首
function dedupeKey(c) {
  const norm = (s) => String(s || '').toLowerCase().replace(/[\s\-_.()（）[\]【】]/g, '');
  return `${norm(c.title)}|${norm(c.artist)}`;
}

export async function fetchMusicMeta(query, limit = 5) {
  const q = (query || '').trim();
  if (!q) throw new HttpError(422, '缺少搜索关键词');
  const capped = Math.min(limit, 20);

  // 三个源并发，任一失败不影响其余；Audius 结果排最前（可完整播放）
  const settled = await Promise.allSettled([
    searchAudiusMusic(q, capped),
    searchItunesMusic(q, capped),
    searchDeezerMusic(q, capped)
  ]);

  const sources = [];
  const merged = [];
  const seen = new Set();
  for (const item of settled) {
    if (item.status !== 'fulfilled') continue;
    sources.push(item.value.source);
    for (const c of item.value.candidates) {
      const key = dedupeKey(c);
      // 已收录同名同歌手时：若新结果音质更高（完整音轨）则替换试听版本
      if (seen.has(key)) {
        const idx = merged.findIndex((m) => dedupeKey(m) === key);
        if (idx >= 0 && merged[idx].quality !== 'full' && c.quality === 'full') merged[idx] = c;
        continue;
      }
      seen.add(key);
      merged.push(c);
    }
  }

  if (!merged.length) {
    const reason = settled.find((s) => s.status === 'rejected');
    throw reason?.reason || new HttpError(502, '音乐元信息接口请求失败');
  }

  return {
    query: q,
    source: sources.join('+'),
    sources,
    count: merged.length,
    candidates: merged.slice(0, capped)
  };
}

// ---------------------------------------------------------------
// 歌词：LRCLIB（开源、无需 Key、支持中文，返回带时间轴的同步歌词）
// 前端据此实现逐句高亮与自动滚动。
// ---------------------------------------------------------------
export async function fetchLyrics({ title, artist, album, duration }) {
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
  if (!usable.length) throw new HttpError(404, '未找到该歌曲的歌词');

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

export async function fetchMovieMeta(query, limit = 5, env = {}) {
  const q = (query || '').trim();
  if (!q) throw new HttpError(422, '缺少搜索关键词');
  const capped = Math.min(limit, 20);

  // 并发聚合多个免费源：
  //   Internet Archive → 可完整播放的公有领域影片（有 playable_url）
  //   TMDB（需 Key，可选）/ TVmaze → 元信息更完整，但无可播放直链
  const tasks = [searchInternetArchive(q, capped)];
  if (env.TMDB_API_KEY) tasks.push(searchTmdb(q, capped, env));
  tasks.push(searchTvmaze(q, capped));

  const settled = await Promise.allSettled(tasks);

  const sources = [];
  const merged = [];
  const seen = new Set();
  for (const item of settled) {
    if (item.status !== 'fulfilled') continue;
    sources.push(item.value.source);
    for (const c of item.value.candidates) {
      const key = movieKey(c);
      if (seen.has(key)) {
        // 已收录同名条目时：优先保留可播放版本，并补齐缺失的元信息
        const idx = merged.findIndex((m) => movieKey(m) === key);
        if (idx >= 0) {
          const prev = merged[idx];
          const preferNew = (!prev.playable_url && c.playable_url);
          const base = preferNew ? c : prev;
          const other = preferNew ? prev : c;
          merged[idx] = {
            ...base,
            overview: base.overview || other.overview,
            poster_url: base.poster_url || other.poster_url,
            release_date: base.release_date || other.release_date,
            rating: base.rating ?? other.rating,
            genres: base.genres || other.genres,
            runtime: base.runtime ?? other.runtime,
            page_url: base.page_url || other.page_url,
            playable_url: base.playable_url || other.playable_url
          };
        }
        continue;
      }
      seen.add(key);
      merged.push(c);
    }
  }

  if (!merged.length) {
    const reason = settled.find((s) => s.status === 'rejected');
    throw reason?.reason || new HttpError(502, '影视元信息接口请求失败');
  }

  // 可播放的结果排在前面，方便直接收藏观看
  merged.sort((a, b) => Number(!!b.playable_url) - Number(!!a.playable_url));

  return {
    query: q,
    source: sources.join('+'),
    sources,
    count: merged.length,
    candidates: merged.slice(0, capped)
  };
}
