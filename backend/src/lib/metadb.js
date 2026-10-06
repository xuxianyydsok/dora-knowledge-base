// 影视/动漫元数据补全源（只补齐展示信息，不提供播放地址）
// ---------------------------------------------------------------
// 采集源（苹果CMS）的条目普遍缺高清海报、背景图，动漫条目的中文封面质量也参差，
// 因此用下面三个公开免 key 的接口做**尽力而为**的补全：
//   Cinemeta (Stremio) —— 电影/剧集的海报、背景图、IMDb 评分，支持中文关键词
//   Bangumi            —— 中文 ACG 条目库，封面与简介质量最好（必须带 User-Agent）
//   Kitsu              —— 动漫元数据（罗马音/英文检索，作为 Bangumi 的备选）
// 任何失败都返回 null 并静默跳过，绝不影响主搜索流程。
// 仅抓取元信息与图片链接，不下载、不转发任何影视文件。

import { HttpError } from './response.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
// Bangumi 对 User-Agent 有硬性要求，缺省会 403
const BGUA = 'dora-knowledge-base/0.1 (https://github.com/xuguochen/dora)';
const CINEMETA = 'https://v3-cinemeta.strem.io';

async function req(url, { headers = {}, method = 'GET', body, timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { 'User-Agent': UA, ...headers },
      body,
      signal: controller.signal
    });
    if (!res.ok) throw new HttpError(502, `元数据接口请求失败 (${res.status})`);
    return await res.json();
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err.name === 'AbortError') throw new HttpError(504, `元数据接口超时（${timeoutMs}ms）`);
    throw new HttpError(502, `元数据接口请求失败：${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

// 标题归一化：去掉季数/年份/标点后比较，避免「一人之下 第一季」匹配不上「一人之下」
function titleKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\s\-_.:：,，。!！?？'"'']/g, '')
    .replace(/(第[一二三四五六七八九十\d]+季|season\d+|全集|完整版|hd|bd)/g, '');
}

// Cinemeta：优先使用类型化搜索（电影 / 剧集），返回海报、背景图与 IMDb 评分
export async function cinemetaLookup(title, { mediaType = 'movie' } = {}) {
  const q = String(title || '').trim();
  if (!q) return null;
  const type = mediaType === 'tv' ? 'series' : 'movie';
  const list = await req(`${CINEMETA}/catalog/${type}/top/search=${encodeURIComponent(q)}.json`);
  const metas = Array.isArray(list?.metas) ? list.metas : [];
  if (!metas.length) return null;
  const want = titleKey(q);
  // 优先精确匹配，否则取第一条
  const hit = metas.find((m) => titleKey(m.name) === want) || metas[0];
  const out = {
    imdb_id: hit.imdb_id || hit.id || null,
    poster_url: hit.poster || null,
    backdrop_url: hit.background || null,
    release_date: /^\d{4}$/.test(String(hit.releaseInfo || '')) ? `${hit.releaseInfo}-01-01` : null,
    rating: null
  };
  // 评分需要详情接口，仅在条目确实缺评分时多花一次请求（由调用方决定是否要）
  if (out.imdb_id) {
    try {
      const detail = await req(`${CINEMETA}/meta/${type}/${out.imdb_id}.json`);
      const m = detail?.meta;
      if (m) {
        out.rating = Number(m.imdbRating) || null;
        out.backdrop_url = out.backdrop_url || m.background || null;
        out.poster_url = out.poster_url || m.poster || null;
        out.overview = m.description || null;
      }
    } catch {
      // 详情失败不影响已拿到的海报
    }
  }
  return out;
}

// Bangumi：中文 ACG 条目（封面、简介、评分、放送日期）
export async function bangumiLookup(title) {
  const q = String(title || '').trim();
  if (!q) return null;
  const data = await req('https://api.bgm.tv/v0/search/subjects', {
    method: 'POST',
    headers: { 'User-Agent': BGUA, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ keyword: q, filter: { type: [2] } })
  });
  const list = Array.isArray(data?.data) ? data.data : [];
  if (!list.length) return null;
  const want = titleKey(q);
  const hit = list.find((s) => titleKey(s.name_cn || s.name) === want) || list[0];
  return {
    poster_url: hit.images?.large || hit.images?.common || hit.image || null,
    overview: hit.summary ? String(hit.summary).slice(0, 800) : null,
    rating: Number(hit.rating?.score) || null,
    release_date: /^\d{4}-\d{2}-\d{2}$/.test(String(hit.date || '')) ? hit.date : null
  };
}

// Kitsu：动漫元数据（Bangumi 未命中时使用）
export async function kitsuLookup(title) {
  const q = String(title || '').trim();
  if (!q) return null;
  const data = await req(
    `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(q)}&page[limit]=5`,
    { headers: { Accept: 'application/vnd.api+json' } }
  );
  const list = Array.isArray(data?.data) ? data.data : [];
  if (!list.length) return null;
  const want = titleKey(q);
  const hit = list.find((a) => titleKey(a.attributes?.canonicalTitle) === want) || list[0];
  const at = hit.attributes || {};
  return {
    poster_url: at.posterImage?.large || at.posterImage?.original || null,
    overview: at.synopsis ? String(at.synopsis).slice(0, 800) : null,
    rating: Number(at.averageRating) ? Number(at.averageRating) / 10 : null,
    release_date: at.startDate || null
  };
}
