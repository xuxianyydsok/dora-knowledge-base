// 资源关联图谱数据接口
// 输出 nodes + edges，供前端 D3 渲染
// 节点类型：post（博客）/ resource（视频、GitHub 等）/ tag（标签）
// 边类型：post-resource（博客关联资源）/ post-tag（博客标签）/ resource-tag（资源标签）
// 权限：普通用户仅自己数据；管理员可 ?all=true

import { ok } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';

// GET /api/graph
export async function getGraph(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === 'true' && user.isAdmin;
  const userFilter = all ? {} : { user_id: `eq.${user.id}` };

  // 节点：博客、资源、标签
  const [posts, resources, tags] = await Promise.all([
    db.select('posts', qs({ select: 'id,title,status', ...userFilter })),
    db.select('resources', qs({ select: 'id,type,title,url', ...userFilter })),
    db.select('tags', qs({ select: 'id,name,color', ...userFilter }))
  ]);

  const nodes = [
    ...posts.map((p) => ({ id: p.id, type: 'post', label: p.title, status: p.status })),
    ...resources.map((r) => ({ id: r.id, type: 'resource', resource_type: r.type, label: r.title, url: r.url })),
    ...tags.map((t) => ({ id: t.id, type: 'tag', label: t.name, color: t.color }))
  ];

  const nodeIds = new Set(nodes.map((n) => n.id));

  // 边：博客-资源
  const postResources = await db.select('post_resources',
    qs({ select: 'post_id,resource_id,relation', ...userFilter }));
  // 边：博客-标签
  const postTags = await db.select('post_tags',
    qs({ select: 'post_id,tag_id', ...userFilter }));
  // 边：资源-标签
  const resourceTags = await db.select('resource_tags',
    qs({ select: 'resource_id,tag_id', ...userFilter }));

  const edges = [];
  const push = (source, target, type, extra = {}) => {
    if (nodeIds.has(source) && nodeIds.has(target)) {
      edges.push({ id: `${type}:${source}:${target}`, source, target, type, ...extra });
    }
  };

  postResources.forEach((l) => push(l.post_id, l.resource_id, 'post-resource', { relation: l.relation }));
  postTags.forEach((l) => push(l.post_id, l.tag_id, 'post-tag'));
  resourceTags.forEach((l) => push(l.resource_id, l.tag_id, 'resource-tag'));

  return ok({
    nodes,
    edges,
    stats: {
      posts: posts.length,
      resources: resources.length,
      tags: tags.length,
      edges: edges.length
    }
  }, request, env);
}
