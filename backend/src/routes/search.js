// 资源全文检索
// 支持博客(posts)与资源(resources：video/github/music/movie/rss_article)多类型检索
// 权限：普通用户仅检索自己的数据；管理员可传 ?all=true 检索全部

import { ok, HttpError } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { qs, escapeLike } from '../lib/supabase.js';
import { requireEnum } from '../lib/validate.js';

// GET /api/search?q=关键词&type=all|post|resource&resource_type=video&limit=20
export async function search(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);

  const rawQ = (url.searchParams.get('q') || '').trim();
  if (!rawQ) throw new HttpError(422, '缺少查询参数 q');
  if (rawQ.length > 200) throw new HttpError(422, '查询关键词过长');

  const type = url.searchParams.get('type') || 'all';
  requireEnum(type, 'type', ['all', 'post', 'resource']);

  const resourceType = url.searchParams.get('resource_type');
  if (resourceType) requireEnum(resourceType, 'resource_type', ['video', 'github', 'music', 'movie', 'rss_article']);

  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 50);
  const all = url.searchParams.get('all') === 'true' && user.isAdmin;
  const q = escapeLike(rawQ);
  const pattern = `*${q}*`;

  const results = [];

  // 博客检索：标题 / 摘要 / 正文
  if (type === 'all' || type === 'post') {
    const filters = {
      select: 'id,title,excerpt,status,cover_path,updated_at,user_id',
      or: `(title.ilike.${pattern},excerpt.ilike.${pattern},content.ilike.${pattern})`,
      order: 'updated_at.desc',
      limit: String(limit)
    };
    if (!all) filters.user_id = `eq.${user.id}`;
    const posts = await db.select('posts', qs(filters));
    results.push(...posts.map((p) => ({ kind: 'post', ...p })));
  }

  // 资源检索：标题 / 摘要
  if (type === 'all' || type === 'resource') {
    const filters = {
      select: 'id,type,title,summary,url,source,cover_path,created_at,user_id',
      or: `(title.ilike.${pattern},summary.ilike.${pattern})`,
      order: 'created_at.desc',
      limit: String(limit)
    };
    if (!all) filters.user_id = `eq.${user.id}`;
    if (resourceType) filters.type = `eq.${resourceType}`;
    const resources = await db.select('resources', qs(filters));
    results.push(...resources.map((r) => ({ kind: 'resource', ...r })));
  }

  // 按时间倒序合并，截断到 limit
  results.sort((a, b) => {
    const ta = new Date(a.updated_at || a.created_at || 0).getTime();
    const tb = new Date(b.updated_at || b.created_at || 0).getTime();
    return tb - ta;
  });

  return ok({ query: rawQ, count: results.length, items: results.slice(0, limit) }, request, env);
}
