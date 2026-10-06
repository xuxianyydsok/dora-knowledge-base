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
// 音乐元信息：iTunes Search API（无需 API Key）
// 仅抓取元信息与试听片段地址，音频文件不入库、后端不转发音频流
// ---------------------------------------------------------------
export async function fetchMusicMeta(query, limit = 5) {
  const q = (query || '').trim();
  if (!q) throw new HttpError(422, '缺少搜索关键词');

  const res = await fetchWithTimeout(
    `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=${Math.min(limit, 20)}`,
    { headers: { 'User-Agent': UA } }
  );
  if (!res.ok) throw new HttpError(502, `音乐元信息接口请求失败 (${res.status})`);

  const body = await res.json();
  const results = (body.results || []).map((r) => ({
    platform: 'itunes',
    external_id: String(r.trackId ?? ''),
    title: r.trackName,
    artist: r.artistName,
    album: r.collectionName,
    artwork_url: (r.artworkUrl100 || '').replace('100x100bb', '600x600bb') || null,
    preview_url: r.previewUrl || null,
    duration: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : null,
    genre: r.primaryGenreName || null,
    release_year: r.releaseDate ? new Date(r.releaseDate).getFullYear() : null,
    page_url: r.trackViewUrl || null
  }));

  return { query: q, count: results.length, candidates: results };
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
      page_url: s.url || null
    };
  });

  return { query, source: 'tvmaze', count: candidates.length, candidates };
}

export async function fetchMovieMeta(query, limit = 5, env = {}) {
  const q = (query || '').trim();
  if (!q) throw new HttpError(422, '缺少搜索关键词');
  // 配置了 TMDB Key 时优先使用 TMDB，失败则回退 TVmaze
  if (env.TMDB_API_KEY) {
    try {
      return await searchTmdb(q, limit, env);
    } catch {
      return searchTvmaze(q, limit);
    }
  }
  return searchTvmaze(q, limit);
}
