// 批量调整资源 / 文章的公开状态。
//
// 为什么单独开一个接口：
// - 音乐、影视、博客原本只能逐条 PATCH，站长要把历史内容一次性公开时要点上百次；
// - 三个模块的可见性规则相同（本人数据、写操作必须带 user_id、缓存要失效），
//   集中在一处比复制三份更容易保持一致。
//
// 边界：
// - 只处理当前登录用户自己的数据；管理员也不能借这个接口改别人的内容。
// - 每次最多 200 条，和标签批量接口的上限保持一致。
// - 只改 is_public，不碰 status / 播放地址 / 其它字段。

import { ok, readJson, HttpError } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { requireUuid, optionalBool } from '../lib/validate.js';
import { bumpVersion } from '../lib/edgeCache.js';

export const VISIBILITY_KINDS = {
  posts: { table: 'posts', type: null, cache: () => 'posts' },
  music: { table: 'resources', type: 'music', cache: (id) => `music/${id}` },
  movies: { table: 'resources', type: 'movie', cache: (id) => `movies/${id}` }
};

function normalize(body) {
  const kind = body?.kind;
  if (!VISIBILITY_KINDS[kind]) throw new HttpError(422, 'kind 必须为 posts / music / movies');
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    throw new HttpError(422, 'ids 必须为非空数组');
  }
  if (body.ids.length > 200) throw new HttpError(422, '单次最多调整 200 条');
  const ids = [...new Set(body.ids.map((id, i) => requireUuid(id, `ids[${i}]`)))];
  const isPublic = optionalBool(body.is_public, 'is_public');
  if (isPublic === undefined) throw new HttpError(422, 'is_public 必须为布尔值');
  return { kind, ids, isPublic };
}

// PATCH /api/visibility
export async function updateVisibility(request, env) {
  const { db, user } = await requireAuth(request, env);
  const { kind, ids, isPublic } = normalize(await readJson(request));
  const spec = VISIBILITY_KINDS[kind];

  const filters = {
    id: `in.(${ids.join(',')})`,
    user_id: `eq.${user.id}`
  };
  if (spec.type) filters.type = `eq.${spec.type}`;

  const rows = await db.update(spec.table, qs(filters), { is_public: isPublic });
  await bumpVersion(spec.cache(user.id), env);

  return ok({
    kind,
    is_public: isPublic,
    updated: rows.length,
    ids: rows.map((r) => r.id)
  }, request, env);
}
