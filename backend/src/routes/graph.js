// 资源关联图谱数据接口
// 输出 nodes + edges，供前端 D3 渲染
// 节点类型：post（博客）/ resource（视频、GitHub 等）/ tag（标签）
// 边类型：post-resource（博客关联资源）/ post-tag（博客标签）/ resource-tag（资源标签）
// 权限：普通用户仅自己数据；管理员可 ?all=true

import { ok, HttpError } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { guestPostFilters, guestResourceFilters } from '../lib/publicScope.js';
import { selectAllGithubLite } from '../lib/githubStars.js';

// GET /api/graph
export async function getGraph(request, env) {
  const { db, user } = await requireAuth(request, env);
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === 'true' && user.isAdmin;
  const userFilter = all ? {} : { user_id: `eq.${user.id}` };

  // 节点：博客、资源、标签
  // 访客只拿公开子图：已发布 + 公开的博客、公开资源；标签仍取 owner 的（图谱节点需要，
  // 且标签本身只有名称/颜色等安全字段）。
  const [posts, resources, tags] = await Promise.all([
    db.select('posts', qs({ select: 'id,title,status', ...userFilter, ...(user.isGuest ? guestPostFilters() : {}) })),
    db.select('resources', qs({ select: 'id,type,title,url', ...userFilter, ...(user.isGuest ? guestResourceFilters() : {}) })),
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
  // 控制台聚合了 GitHub Star、AI 解读等个人数据，属管理/个人视图，不对访客开放
  if (user.isGuest) throw new HttpError(403, '图谱控制台需要站长登录');
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

// GET /api/graph/board —— 无限画板：博客星域 + GitHub 星域 + 跨域连线
// posts: [id,title,cat,tags[],date]；repos: [id,title,one_line,cat,lang,stars,url]
// links: [postId, repoId, keyword]（博客标签 与 仓库语言/topics/AI 关键词 同名即相连）
export async function getBoard(request, env) {
  const { db, user } = await requireAuth(request, env);
  // 无限画板同样是个人视图（博客星域 + GitHub 星域），不对访客开放
  if (user.isGuest) throw new HttpError(403, '图谱控制台需要站长登录');
  const uf = { user_id: `eq.${user.id}` };
  const [posts, cats, tags, postTags, repos] = await Promise.all([
    db.select('posts', qs({ select: 'id,title,category_id,published_at,created_at', ...uf, ...(user.isGuest ? { status: 'eq.published' } : {}) })),
    db.select('categories', qs({ select: 'id,name,slug', ...uf, order: 'sort_order.asc' })),
    db.select('tags', qs({ select: 'id,name,slug', ...uf })),
    db.select('post_tags', qs({ select: 'post_id,tag_id', ...uf })),
    db.select('resources', qs({
      select: 'id,title,url,ai_one:metadata->ai->>one_line,ai_tags:metadata->ai->tags,ai_kw:metadata->ai->keywords,lang:metadata->>language,topics:metadata->topics,stars:metadata->stars',
      ...uf, type: 'eq.github', limit: '3000'
    }))
  ]);
  const tagName = new Map(tags.map((t) => [t.id, t.name]));
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const ptags = new Map();
  postTags.forEach((l) => { if (!ptags.has(l.post_id)) ptags.set(l.post_id, []); ptags.get(l.post_id).push(tagName.get(l.tag_id)); });

  const P = posts.map((p) => ({
    id: p.id, title: p.title, cat: catName.get(p.category_id) || '未分类',
    tags: (ptags.get(p.id) || []).filter(Boolean), date: (p.published_at || p.created_at || '').slice(0, 10)
  }));
  const R = repos.map((r) => ({
    id: r.id, title: r.title, url: r.url, one: r.ai_one || '', lang: r.lang || '',
    cat: (Array.isArray(r.ai_tags) && r.ai_tags[0]) || '待解读', stars: Number(r.stars) || 0,
    kw: [r.lang, ...(Array.isArray(r.topics) ? r.topics : []), ...(Array.isArray(r.ai_kw) ? r.ai_kw : [])].filter(Boolean).map((x) => String(x).toLowerCase())
  }));

  // 跨域连线：每个博客标签最多连 6 个仓库（星数高的优先），每篇文章最多 3 条
  const byKw = new Map();
  R.forEach((r) => r.kw.forEach((k) => { if (!byKw.has(k)) byKw.set(k, []); byKw.get(k).push(r); }));
  byKw.forEach((list) => list.sort((a, b) => b.stars - a.stars));
  const links = [];
  P.forEach((p) => {
    let n = 0;
    for (const t of p.tags) {
      const list = byKw.get(String(t).toLowerCase());
      if (!list) continue;
      for (const r of list.slice(0, 2)) { if (n >= 3) break; links.push([p.id, r.id, t]); n++; }
    }
  });
  R.forEach((r) => { delete r.kw; });
  return ok({ posts: P, repos: R, links }, request, env);
}

// ---------------- 星图（2026-10-11）----------------
// 「更多 → 图谱」下的两个公开图谱：博客图谱 / 开源项目图谱。
// 与 getConsole（站长个人控制台）不同，这两个是**给访客看的公开星图**：
// 只取已发布且公开的博客、公开的资源，不返回任何 user_id / 私密字段。
// 前端不做力导向（上千个仓库会卡），改为「聚类轨道」：中心枢纽 + 卫星绕行，
// 所以这里只需要给出**带权重的节点 + 连线**，坐标由前端按稳定伪随机算。

// GET /api/graph/blog —— 博客图谱：分类（枢纽）→ 文章（卫星）+ 标签（枢纽）
export async function getBlogGraph(request, env) {
  const { db, user } = await requireAuth(request, env);
  const uf = { user_id: `eq.${user.id}` };
  const [posts, cats, tags, postTags] = await Promise.all([
    db.select('posts', qs({
      select: 'id,title,slug,category_id,published_at,created_at,excerpt',
      ...uf, ...(user.isGuest ? guestPostFilters() : {}), limit: '2000'
    })),
    db.select('categories', qs({ select: 'id,name,slug', ...uf, limit: '200' })),
    db.select('tags', qs({ select: 'id,name,slug,color', ...uf, limit: '500' })),
    db.select('post_tags', qs({ select: 'post_id,tag_id', ...uf, limit: '5000' }))
  ]);

  const postIds = new Set(posts.map((p) => p.id));
  const tagName = new Map(tags.map((t) => [t.id, t.name]));

  // 每个标签被多少篇（可见的）文章使用 —— 只有真正挂上文章的标签才上图，避免孤立点
  const tagCount = new Map();
  postTags.forEach((l) => {
    if (!postIds.has(l.post_id)) return;
    tagCount.set(l.tag_id, (tagCount.get(l.tag_id) || 0) + 1);
  });

  const catCount = new Map();
  posts.forEach((p) => { const k = p.category_id || 'none'; catCount.set(k, (catCount.get(k) || 0) + 1); });

  const nodes = [
    ...cats.filter((c) => catCount.get(c.id)).map((c) => ({
      id: `c:${c.id}`, kind: 'hub', group: '分类', label: c.name, slug: c.slug,
      count: catCount.get(c.id), color: '#3ee6a8'
    })),
    ...[...tagCount.entries()].map(([id, n]) => ({
      id: `t:${id}`, kind: 'hub', group: '标签', label: tagName.get(id) || '标签', slug: null,
      count: n, color: '#4cc9ff'
    })),
    ...posts.map((p) => ({
      id: `p:${p.id}`, kind: 'leaf', group: '文章', label: p.title, parent: `c:${p.category_id || 'none'}`,
      date: (p.published_at || p.created_at || '').slice(0, 10), color: '#ffb547'
    }))
  ];

  const known = new Set(nodes.map((n) => n.id));
  const links = [];
  postTags.forEach((l) => {
    if (!postIds.has(l.post_id) || !tagCount.get(l.tag_id)) return;
    links.push({ source: `p:${l.post_id}`, target: `t:${l.tag_id}`, kind: 'tag' });
  });
  // 文章 → 分类：用 parent 表达，前端画成轨道；这里也补一条显式连线，便于统计与悬停高亮
  posts.forEach((p) => {
    const k = `c:${p.category_id || 'none'}`;
    if (known.has(k)) links.push({ source: `p:${p.id}`, target: k, kind: 'category' });
  });
  // 分类里没挂到任何分类的文章（未分类）不产生孤立点：把它们挂到「未分类」枢纽上
  const orphans = nodes.filter((n) => n.kind === 'leaf' && !known.has(n.parent));
  if (orphans.length) {
    nodes.push({ id: 'c:none', kind: 'hub', group: '分类', label: '未分类', slug: null, count: orphans.length, color: '#8a847b' });
    orphans.forEach((o) => { o.parent = 'c:none'; links.push({ source: o.id, target: 'c:none', kind: 'category' }); });
  }

  const shown = new Set(nodes.map((n) => n.id));
  return ok({
    nodes,
    links: links.filter((l) => shown.has(l.source) && shown.has(l.target)),
    stats: {
      posts: posts.length, categories: nodes.filter((n) => n.group === '分类').length,
      tags: nodes.filter((n) => n.group === '标签').length,
      links: links.length
    },
    now: new Date().toISOString()
  }, request, env);
}

// GET /api/graph/repos —— 开源项目图谱：编程语言（外环枢纽）+ AI 应用分类（内环枢纽）→ 仓库（卫星）
export async function getRepoGraph(request, env) {
  const { db, user } = await requireAuth(request, env);
  const rows = await selectAllGithubLite(db, {
    ...{ user_id: `eq.${user.id}` },
    ...(user.isGuest ? guestResourceFilters() : {})
  });

  const repo = (r) => ({
    id: `r:${r.id}`,
    title: r.title || '',                       // owner/name
    name: String(r.title || '').split('/').pop() || r.title,
    owner: String(r.title || '').split('/')[0] || '',
    url: r.url,
    one: String(r.ai?.one_line || r.summary || '').slice(0, 90),
    lang: r.language || '',
    tags: Array.isArray(r.ai?.tags) ? r.ai.tags : [],
    stars: Number(r.stars) || 0,
    starred_at: r.starred_at || null
  });
  const repos = rows.map(repo);

  const tally = (fn) => {
    const m = new Map();
    repos.forEach((r) => fn(r).forEach((k) => { if (k) m.set(k, (m.get(k) || 0) + 1); }));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  const langs = tally((r) => [r.lang]).slice(0, 12);
  const cats = tally((r) => (r.tags.length ? [r.tags[0]] : [])).slice(0, 12);
  const langSet = new Set(langs.map(([l]) => l));
  const catSet = new Set(cats.map(([c]) => c));

  const nodes = [
    ...langs.map(([name, count]) => ({ id: `L:${name}`, kind: 'hub', ring: 'outer', group: '编程语言', label: name, count, color: '#4cc9ff' })),
    ...cats.map(([name, count]) => ({ id: `A:${name}`, kind: 'hub', ring: 'inner', group: '应用分类', label: name, count, color: '#b48cff' })),
    ...repos.map((r) => ({
      id: r.id, kind: 'leaf', group: '仓库', label: r.name, owner: r.owner, url: r.url, one: r.one,
      lang: langSet.has(r.lang) ? r.lang : '', cat: catSet.has(r.tags[0]) ? r.tags[0] : '',
      stars: r.stars, date: (r.starred_at || '').slice(0, 10),
      parent: `L:${langSet.has(r.lang) ? r.lang : '其他'}`, color: '#ffb547'
    }))
  ];

  const known = new Set(nodes.map((n) => n.id));
  const links = [];
  if (repos.some((r) => !langSet.has(r.lang))) {
    nodes.push({ id: 'L:其他', kind: 'hub', ring: 'outer', group: '编程语言', label: '其他', count: repos.filter((r) => !langSet.has(r.lang)).length, color: '#8a847b' });
  }
  nodes.filter((n) => n.kind === 'leaf').forEach((n) => {
    if (known.has(n.parent)) links.push({ source: n.id, target: n.parent, kind: 'lang' });
    if (n.cat) links.push({ source: n.id, target: `A:${n.cat}`, kind: 'cat' });
  });

  return ok({
    nodes,
    links,
    stats: {
      repos: repos.length,
      languages: nodes.filter((n) => n.group === '编程语言').length,
      categories: nodes.filter((n) => n.group === '应用分类').length,
      links: links.length
    },
    now: new Date().toISOString()
  }, request, env);
}
