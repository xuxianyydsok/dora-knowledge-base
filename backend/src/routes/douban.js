// 豆瓣片单 + 高清海报中转（影视库首页用，2026-10-09）
// - GET /api/movies/douban?type=tv|movie&tag=国产剧&limit=24&start=0
//   读取豆瓣公开片单接口 /j/search_subjects，边缘缓存 30 分钟
// - GET /api/img/douban?p=<p123.jpg>&h=<img9>&s=m|l
//   豆瓣图片有防盗链（不带 Referer 返回 418），由 Worker 带 Referer 拉取后长期缓存
//   s=m → 540×810（海报墙）；s=l → 1080×1620（首屏大图）
// 仅转发元信息与海报图片，不涉及任何影视文件。图片接口无需登录（<img> 无法带令牌）。

import { ok, HttpError, corsHeaders } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const REFERER = 'https://movie.douban.com/';
const LIST_TTL = 1800;
const IMG_TTL = 60 * 60 * 24 * 30;

export const DOUBAN_TAGS = {
  tv: ['热门', '国产剧', '美剧', '英剧', '韩剧', '日剧', '港剧', '日本动画', '综艺', '纪录片'],
  movie: ['热门', '最新', '经典', '豆瓣高分', '冷门佳片', '华语', '欧美', '韩国', '日本', '动作', '喜剧', '爱情', '科幻', '悬疑', '恐怖', '动画']
};

// cover: https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2933527614.jpg
function posterRef(cover) {
  const m = String(cover || '').match(/^https?:\/\/(img\d+)\.doubanio\.com\/view\/photo\/[a-z_]+\/public\/(p\d+\.(?:jpg|jpeg|png|webp))$/i);
  return m ? { h: m[1], p: m[2] } : null;
}

export async function listDouban(request, env) {
  await requireAuth(request, env);
  const url = new URL(request.url);
  const type = url.searchParams.get('type') === 'movie' ? 'movie' : 'tv';
  const tag = url.searchParams.get('tag') || '热门';
  if (!DOUBAN_TAGS[type].includes(tag)) throw new HttpError(422, '不支持的分类');
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 24));
  const start = Math.max(0, Math.min(500, Number(url.searchParams.get('start')) || 0));

  const upstream = `https://movie.douban.com/j/search_subjects?type=${type}&tag=${encodeURIComponent(tag)}&sort=recommend&page_limit=${limit}&page_start=${start}`;
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const cacheKey = new Request(`https://dora-cache.internal/douban/${type}/${encodeURIComponent(tag)}/${limit}/${start}`);

  let data = null;
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) data = await hit.json();
  }
  if (!data) {
    let res;
    try {
      res = await fetch(upstream, { headers: { 'user-agent': UA, referer: REFERER, accept: 'application/json' } });
    } catch {
      throw new HttpError(502, '豆瓣暂时连不上');
    }
    if (!res.ok) throw new HttpError(502, `豆瓣返回 ${res.status}`);
    const raw = await res.json().catch(() => null);
    if (!raw || !Array.isArray(raw.subjects)) throw new HttpError(502, '豆瓣数据格式异常');

    data = {
      type, tag,
      items: raw.subjects.map((s) => {
        const ref = posterRef(s.cover);
        return {
          id: String(s.id),
          title: String(s.title || '').slice(0, 200),
          rating: s.rate ? Number(s.rate) : null,
          episodes: s.episodes_info || '',
          is_new: !!s.is_new,
          media_type: type,
          douban_url: s.url || `https://movie.douban.com/subject/${s.id}/`,
          poster: ref ? `/api/img/douban?h=${ref.h}&p=${ref.p}&s=m` : null,
          poster_hd: ref ? `/api/img/douban?h=${ref.h}&p=${ref.p}&s=l` : null
        };
      }).filter((x) => x.title)
    };
    if (cache && data.items.length) {
      await cache.put(cacheKey, new Response(JSON.stringify(data), {
        headers: { 'content-type': 'application/json', 'cache-control': `max-age=${LIST_TTL}` }
      }));
    }
  }
  return ok(data, request, env);
}

export async function doubanImage(request, env) {
  const url = new URL(request.url);
  const h = url.searchParams.get('h') || '';
  const p = url.searchParams.get('p') || '';
  const size = url.searchParams.get('s') === 'l' ? 'l_ratio_poster' : 'm_ratio_poster';
  if (!/^img\d{1,2}$/.test(h) || !/^p\d+\.(jpg|jpeg|png|webp)$/i.test(p)) throw new HttpError(400, '图片参数不合法');

  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const cacheKey = new Request(`https://dora-cache.internal/douban-img/${size}/${h}/${p}`);
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return withCors(hit, request, env);
  }

  const res = await fetch(`https://${h}.doubanio.com/view/photo/${size}/public/${p}`, {
    headers: { 'user-agent': UA, referer: REFERER }
  });
  if (!res.ok) throw new HttpError(502, `海报获取失败 (${res.status})`);

  const out = new Response(res.body, {
    headers: {
      'content-type': res.headers.get('content-type') || 'image/jpeg',
      'cache-control': `public, max-age=${IMG_TTL}, immutable`
    }
  });
  if (cache) await cache.put(cacheKey, out.clone());
  return withCors(out, request, env);
}

function withCors(res, request, env) {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(corsHeaders(request, env))) r.headers.set(k, v);
  return r;
}
