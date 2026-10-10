// 音乐首页数据（2026-10-09，Apple Music 风格改版）
// - GET /api/music/charts?chart=hot|new|soar|original&limit=50  网易云官方榜单（经 Meting），边缘缓存 1 小时
// - GET /api/img/music?id=<网易云图片 id>&s=300|600|1000         高清封面中转：跟随 Meting 的 302，
//   把 param=300y300 换成所需尺寸后取图，缓存 30 天（无需登录）
import { ok, HttpError, corsHeaders } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { getMetingInstances, fetchMetingPlaylist } from '../lib/meting.js';

export const CHARTS = {
  hot: { id: '3778678', name: '热歌榜' },
  new: { id: '3779629', name: '新歌榜' },
  soar: { id: '19723756', name: '飙升榜' },
  original: { id: '2884035', name: '原创榜' }
};
const LIST_TTL = 3600;
const IMG_TTL = 60 * 60 * 24 * 30;

export async function listMusicCharts(request, env) {
  await requireAuth(request, env);
  const url = new URL(request.url);
  const key = url.searchParams.get('chart') || 'hot';
  const chart = CHARTS[key];
  if (!chart) throw new HttpError(422, '不支持的榜单');
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50));

  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const cacheKey = new Request(`https://dora-cache.internal/music-chart/${key}/${limit}`);
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return ok(await hit.json(), request, env);
  }
  const inst = getMetingInstances(env).find((i) => (i.servers || []).includes('netease'));
  if (!inst) throw new HttpError(503, '没有可用的 Meting 实例');
  const tracks = await fetchMetingPlaylist(inst, 'netease', chart.id, limit);
  const data = { chart: key, name: chart.name, tracks };
  if (cache && tracks.length) {
    await cache.put(cacheKey, new Response(JSON.stringify(data), {
      headers: { 'content-type': 'application/json', 'cache-control': `max-age=${LIST_TTL}` }
    }));
  }
  return ok(data, request, env);
}

export async function musicImage(request, env) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id') || '';
  const size = ['300', '600', '1000'].includes(url.searchParams.get('s')) ? url.searchParams.get('s') : '600';
  if (!/^\d{5,25}$/.test(id)) throw new HttpError(400, '图片参数不合法');

  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const cacheKey = new Request(`https://dora-cache.internal/music-img/${size}/${id}`);
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return withCors(hit, request, env);
  }
  const inst = getMetingInstances(env).find((i) => (i.servers || []).includes('netease'));
  if (!inst) throw new HttpError(503, '没有可用的 Meting 实例');
  const sep = inst.base.includes('?') ? '&' : '?';
  const r = await fetch(`${inst.base}${sep}server=netease&type=pic&id=${id}`, { redirect: 'manual' });
  const loc = r.headers.get('location');
  if (!loc || !/^https:\/\/p\d+\.music\.126\.net\//.test(loc)) throw new HttpError(502, '封面地址解析失败');
  const target = loc.replace(/([?&])param=\d+y\d+/, `$1param=${size}y${size}`)
    + (/[?&]param=/.test(loc) ? '' : `${loc.includes('?') ? '&' : '?'}param=${size}y${size}`);
  const img = await fetch(target);
  if (!img.ok) throw new HttpError(502, `封面获取失败 (${img.status})`);
  const out = new Response(img.body, {
    headers: {
      'content-type': img.headers.get('content-type') || 'image/jpeg',
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
