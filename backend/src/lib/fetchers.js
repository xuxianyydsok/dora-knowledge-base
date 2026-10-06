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
