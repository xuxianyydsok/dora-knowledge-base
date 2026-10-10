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
    db.select('posts', qs({ select: 'id,title,status', ...userFilter, ...(user.isGuest ? { status: 'eq.published' } : {}) })),
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

  // GitHub Star 同步进来的仓库可能上千个：图谱里只保留和博客/标签有关联的，避免一屏孤立点
  const linked = new Set(edges.flatMap((e) => [e.source, e.target]));
  const shown = nodes.filter((n) => !(n.type === 'resource' && n.resource_type === 'github' && !linked.has(n.id)));

  return ok({
    nodes: shown,
    edges,
    stats: {
      posts: posts.length,
      resources: resources.length,
      tags: tags.length,
      edges: edges.length
    }
  }, request, env);
}

// GET /api/graph/console —— 「知识库控制台」聚合数据（流动管线图 + 仪表盘）
// left：内容来源（博客分类 + 影视/音乐/视频/GitHub）；right：标签 + GitHub 应用分类
// flows：每条 = 一条可画的连线 [leftKey, rightKey]（博客按「分类→标签」，GitHub 按「GitHub→AI 分类」）
// events：最近动态；heat：近 365 天每日新增数
export async function getConsole(request, env) {
  const { db, user } = await requireAuth(request, env);
  const uf = { user_id: `eq.${user.id}` };
  const [posts, cats, tags, postTags, resources] = await Promise.all([
    db.select('posts', qs({ select: 'id,title,category_id,status,published_at,created_at', ...uf, ...(user.isGuest ? { status: 'eq.published' } : {}) })),
    db.select('categories', qs({ select: 'id,name,slug', ...uf, order: 'sort_order.asc' })),
    db.select('tags', qs({ select: 'id,name,slug,color', ...uf })),
    db.select('post_tags', qs({ select: 'post_id,tag_id', ...uf })),
    db.select('resources', qs({
      select: 'id,type,title,created_at,starred_at:metadata->>starred_at,ai_tags:metadata->ai->tags,ai_at:metadata->ai->>analyzed_at,ai_one:metadata->ai->>one_line,ai_tries:metadata->>ai_tries',
      ...uf, limit: '5000'
    }))
  ]);

  const byType = (t) => resources.filter((r) => r.type === t);
  const gh = byType('github');
  const postById = new Map(posts.map((p) => [p.id, p]));

  // 左列
  const catCount = new Map();
  posts.forEach((p) => { const k = p.category_id || 'none'; catCount.set(k, (catCount.get(k) || 0) + 1); });
  const left = [
    ...cats.filter((c) => catCount.get(c.id)).map((c) => ({ key: `c:${c.id}`, label: c.name, slug: c.slug, group: '博客', count: catCount.get(c.id) })),
    ...(catCount.get('none') ? [{ key: 'c:none', label: '未分类', group: '博客', count: catCount.get('none') }] : []),
    { key: 's:movie', label: '影视', group: '资源', count: byType('movie').length },
    { key: 's:music', label: '音乐', group: '资源', count: byType('music').length },
    { key: 's:video', label: '视频', group: '资源', count: byType('video').length },
    { key: 's:github', label: 'GitHub 收藏', group: '资源', count: gh.length }
  ];

  // 右列 + 连线
  const flows = [];
  const tagCount = new Map();
  postTags.forEach((l) => {
    const p = postById.get(l.post_id);
    if (!p) return;
    tagCount.set(l.tag_id, (tagCount.get(l.tag_id) || 0) + 1);
    flows.push([`c:${p.category_id || 'none'}`, `t:${l.tag_id}`]);
  });
  const aiCount = new Map();
  gh.forEach((r) => (Array.isArray(r.ai_tags) ? r.ai_tags : []).forEach((t) => {
    aiCount.set(t, (aiCount.get(t) || 0) + 1);
    flows.push(['s:github', `a:${t}`]);
  }));
  const right = [
    ...tags.filter((t) => tagCount.get(t.id)).sort((a, b) => tagCount.get(b.id) - tagCount.get(a.id))
      .map((t) => ({ key: `t:${t.id}`, label: t.name, slug: t.slug, group: '标签', count: tagCount.get(t.id), color: t.color })),
    ...[...aiCount.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => ({ key: `a:${t}`, label: t, group: '应用分类', count: n }))
  ];

  // AI 进度
  const done = gh.filter((r) => r.ai_at).length;
  const failed = gh.filter((r) => !r.ai_at && Number(r.ai_tries) >= 3).length;

  // 最近动态
  const ev = [];
  posts.forEach((p) => ev.push({ t: p.published_at || p.created_at, kind: 'post', text: p.title, id: p.id }));
  gh.forEach((r) => {
    if (r.starred_at) ev.push({ t: r.starred_at, kind: 'star', text: r.title, id: r.id });
    if (r.ai_at) ev.push({ t: r.ai_at, kind: 'ai', text: `${r.title} → ${r.ai_one || ''}`, id: r.id });
  });
  resources.filter((r) => r.type !== 'github').forEach((r) => ev.push({ t: r.created_at, kind: r.type, text: r.title, id: r.id }));
  const events = ev.filter((e) => e.t).sort((a, b) => (a.t < b.t ? 1 : -1)).slice(0, 40);

  // 热力图：近 371 天
  const since = Date.now() - 371 * 864e5;
  const heat = {};
  const bump = (t) => { if (!t) return; const ms = Date.parse(t); if (ms >= since) { const d = new Date(ms + 8 * 36e5).toISOString().slice(0, 10); heat[d] = (heat[d] || 0) + 1; } };
  posts.forEach((p) => bump(p.published_at || p.created_at));
  gh.forEach((r) => bump(r.starred_at));
  resources.filter((r) => r.type !== 'github').forEach((r) => bump(r.created_at));

  return ok({
    stats: {
      posts: posts.length, tags: tags.length, categories: cats.length,
      movies: byType('movie').length, music: byType('music').length, videos: byType('video').length,
      github: gh.length, ai_done: done, ai_failed: failed, ai_pending: gh.length - done - failed,
      nodes: left.length + right.length, flows: flows.length
    },
    left, right, flows, events, heat,
    now: new Date().toISOString()
  }, request, env);
}
