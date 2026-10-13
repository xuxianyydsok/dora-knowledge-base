// 管理员专用 MCP 端点
// 用途：AI 自动创建/更新博客、绑定视频/GitHub/标签资源
// 安全：强制管理员 JWT 鉴权，普通用户一律 403，不对外开放给普通用户
//
// 支持两种调用形态：
// 1) 工具发现：GET  /api/mcp/tools
// 2) 工具调用：POST /api/mcp/invoke  { "tool": "...", "arguments": { ... } }
// 3) JSON-RPC 2.0：POST /api/mcp  { "jsonrpc":"2.0","method":"tools/call",... }
//
// 鉴权：Authorization: Bearer <Supabase 管理员 JWT>

import { ok, json, readJson, HttpError } from '../lib/response.js';
import { requireAdmin } from '../middleware/auth.js';
import { qs } from '../lib/supabase.js';
import { fetchVideoMeta, fetchGithubMeta } from '../lib/fetchers.js';
import { slugify, requireString } from '../lib/validate.js';
import { setResourceTags, validateTagIds } from '../lib/resources.js';
import { detectHeavyTags } from './posts.js';
import { storeImage, fallbackPublicBase } from './assets.js';
import { decodeBase64 } from '../lib/imageType.js';

// ---------------------------------------------------------------
// MCP 工具定义（供 AI 发现）
// ---------------------------------------------------------------
const TOOLS = [
  {
    name: 'create_post',
    description: '创建一篇 HTML 博客文章，可绑定视频/GitHub/标签等资源',
    inputSchema: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string', description: '文章标题' },
        content: { type: 'string', description: '原生 HTML 正文，支持 katex-inline/katex-block/three-scene/mermaid-chart/chart-2d 标签' },
        slug: { type: 'string', description: 'URL 别名，省略则由标题生成' },
        excerpt: { type: 'string', description: '摘要' },
        status: { type: 'string', enum: ['draft', 'published'], default: 'draft' },
        is_public: { type: 'boolean' },
        tag_ids: { type: 'array', items: { type: 'string' }, description: '标签 UUID 列表' },
        linked_resources: {
          type: 'array',
          description: '关联资源',
          items: {
            type: 'object',
            required: ['resource_id'],
            properties: {
              resource_id: { type: 'string' },
              relation: { type: 'string', enum: ['related', 'embeds', 'references'] }
            }
          }
        }
      }
    }
  },
  {
    name: 'update_post',
    description: '更新已有博客文章（按 id 或 slug 定位），可重设标签与关联资源',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        slug: { type: 'string' },
        title: { type: 'string' },
        content: { type: 'string' },
        excerpt: { type: 'string' },
        status: { type: 'string', enum: ['draft', 'published'] },
        is_public: { type: 'boolean' },
        tag_ids: { type: 'array', items: { type: 'string' } },
        linked_resources: { type: 'array', items: { type: 'object' } }
      }
    }
  },
  {
    name: 'add_video',
    description: '按链接抓取并新增一条学习视频资源（Bilibili/YouTube）',
    inputSchema: {
      type: 'object',
      required: ['url'],
      properties: {
        url: { type: 'string' },
        title: { type: 'string' },
        summary: { type: 'string' },
        tag_ids: { type: 'array', items: { type: 'string' } }
      }
    }
  },
  {
    name: 'add_github_repo',
    description: '按链接抓取并新增一条 GitHub 仓库收藏',
    inputSchema: {
      type: 'object',
      required: ['url'],
      properties: {
        url: { type: 'string' },
        title: { type: 'string' },
        summary: { type: 'string' },
        tag_ids: { type: 'array', items: { type: 'string' } }
      }
    }
  },
  {
    name: 'add_music',
    description: '新增一条音乐收藏（歌名/歌手/专辑/封面/播放地址/备注）',
    inputSchema: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string', description: '歌曲名称' },
        artist: { type: 'string' },
        album: { type: 'string' },
        artwork_url: { type: 'string', description: '封面链接' },
        audio_url: { type: 'string', description: '播放地址（外链）' },
        duration: { type: 'number', description: '时长（秒）' },
        notes: { type: 'string' },
        tag_ids: { type: 'array', items: { type: 'string' } }
      }
    }
  },
  {
    name: 'add_movie',
    description: '新增一条影视收藏（电影/剧集，含名称、海报、简介、类型、上映时间等）',
    inputSchema: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string', description: '影视名称' },
        media_type: { type: 'string', enum: ['movie', 'tv'], default: 'movie' },
        original_title: { type: 'string' },
        director: { type: 'string' },
        cast_list: { type: 'string' },
        genres: { type: 'string', description: '类型，逗号分隔' },
        release_date: { type: 'string', description: 'YYYY-MM-DD' },
        runtime: { type: 'number', description: '时长（分钟）' },
        rating: { type: 'number', description: '评分 0-10' },
        overview: { type: 'string', description: '简介' },
        poster_url: { type: 'string', description: '海报链接' },
        url: { type: 'string', description: '外部详情页链接' },
        source: { type: 'string', description: '数据源：tmdb/tvmaze/manual' },
        notes: { type: 'string' },
        tag_ids: { type: 'array', items: { type: 'string' } }
      }
    }
  },
  {
    name: 'link_resources',
    description: '把若干资源绑定到一篇博客文章（覆盖式）',
    inputSchema: {
      type: 'object',
      required: ['post_id', 'resource_ids'],
      properties: {
        post_id: { type: 'string' },
        resource_ids: { type: 'array', items: { type: 'string' } },
        relation: { type: 'string', enum: ['related', 'embeds', 'references'] }
      }
    }
  },
  {
    name: 'list_resources',
    description: '列出管理员名下资源（可按类型过滤），用于 AI 关联前查询',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['video', 'github', 'music', 'movie'] },
        limit: { type: 'number', default: 20 }
      }
    }
  },
  {
    name: 'list_assets',
    description: '列出管理员本人上传的图片素材（用于选封面/插图）',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 20, description: '返回条数，上限 100' }
      }
    }
  },
  {
    name: 'list_posts',
    description: '列出已有博客文章（标题 / slug / 分类 / 状态 / 日期），用于写作前查重与确认序号。'
      + 'AI 写新文章前应先调用本工具，避免写出重复的标题序号（如已有「软件工程（八）」就不能再写八）',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: '按分类名或 slug 过滤（可选，如「软件工程」或 software-engineering）' },
        status: { type: 'string', enum: ['draft', 'published'], description: '按状态过滤（可选）' },
        keyword: { type: 'string', description: '按标题关键词过滤（可选）' },
        limit: { type: 'number', default: 50, description: '返回条数，上限 200' }
      }
    }
  },
  {
    name: 'list_categories',
    description: '列出全部分类及每类的文章数，用于判断新文章该归入哪个分类',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'list_tags',
    description: '列出已有标签（含 id、名称、文章数）。写文章要挂标签时，先用本工具把标签名换成 tag_id',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '按名称关键词过滤（可选）' }
      }
    }
  },
  {
    name: 'set_post_cover',
    description: '把某个素材设为某篇文章的封面（写入 posts.cover_path）',
    inputSchema: {
      type: 'object',
      required: ['post_id', 'asset_id'],
      properties: {
        post_id: { type: 'string', description: '文章 UUID' },
        asset_id: { type: 'string', description: '素材 UUID' }
      }
    }
  },
  {
    name: 'upload_image',
    description: '以 base64 上传一张图片（JPEG/PNG/WebP/AVIF，≤10MB），返回素材元数据与公开 URL',
    inputSchema: {
      type: 'object',
      required: ['filename', 'content_type', 'data_base64'],
      properties: {
        filename: { type: 'string', description: '原始文件名（仅作展示）' },
        content_type: { type: 'string', description: '声明的 MIME，需与文件魔数一致' },
        data_base64: { type: 'string', description: '图片字节的 base64 编码' }
      }
    }
  }
];

// ---------------------------------------------------------------
// 工具实现
// ---------------------------------------------------------------
// 定位文章：写操作严格限定管理员本人数据（管理员仅有读取全部权限）
async function findPost(db, user, { id, slug }) {
  const filters = { select: '*', user_id: `eq.${user.id}` };
  if (id) filters.id = `eq.${id}`;
  else if (slug) filters.slug = `eq.${slug}`;
  else throw new HttpError(422, '必须提供 id 或 slug');

  const rows = await db.select('posts', qs(filters));
  if (!rows.length) throw new HttpError(404, '文章不存在');
  return rows[0];
}

async function resolveTagIds(db, user, tagIds) {
  if (tagIds === undefined) return undefined;
  // 写操作仅允许使用本人标签（管理员同样不可挂他人标签）
  return validateTagIds(db, user.id, false, tagIds);
}

// 覆盖式设置博客标签（写 post_tags，而非资源标签 resource_tags）
// 修复：此前 create_post/update_post 误调用 setResourceTags 写错表，
// 导致博客标签既没写进 post_tags，又在 resource_tags 留下指向博客 id 的脏数据。
async function setPostTags(db, postId, userId, tagIds) {
  await db.remove('post_tags', qs({
    post_id: `eq.${postId}`,
    user_id: `eq.${userId}`
  }));
  if (!tagIds?.length) return;
  await db.request('post_tags', {
    method: 'POST',
    body: tagIds.map((tagId) => ({ post_id: postId, tag_id: tagId, user_id: userId })),
    prefer: 'return=representation,resolution=merge-duplicates'
  });
}

// 校验资源归属（仅允许关联本人资源）
async function validateResourceIds(db, userId, resourceIds) {
  if (!Array.isArray(resourceIds) || resourceIds.length === 0) return [];
  const unique = [...new Set(resourceIds)];
  const rows = await db.select('resources', qs({
    select: 'id', id: `in.(${unique.join(',')})`, user_id: `eq.${userId}`
  }));
  return rows.map((r) => r.id);
}

async function setLinkedResources(db, postId, userId, links) {
  await db.remove('post_resources', qs({
    post_id: `eq.${postId}`,
    user_id: `eq.${userId}`
  }));
  if (!Array.isArray(links) || links.length === 0) return;
  // 过滤掉非本人资源，避免越权关联
  const validIds = await validateResourceIds(db, userId, links.map((l) => l.resource_id));
  const filtered = links.filter((l) => validIds.includes(l.resource_id));
  if (!filtered.length) return;
  const rows = filtered.map((l, idx) => ({
    user_id: userId,
    post_id: postId,
    resource_id: l.resource_id,
    relation: l.relation || 'related',
    sort_order: idx
  }));
  await db.request('post_resources', {
    method: 'POST',
    body: rows,
    prefer: 'return=representation,resolution=merge-duplicates'
  });
}

const handlers = {
  async create_post(db, user, args) {
    const title = requireString(args.title, 'title', { max: 300 });
    const content = typeof args.content === 'string' ? args.content : '';
    const status = args.status === 'published' ? 'published' : 'draft';
    const rows = await db.insert('posts', {
      user_id: user.id,
      title,
      slug: args.slug ? slugify(args.slug) : slugify(title),
      content,
      excerpt: args.excerpt ?? null,
      status,
      is_public: !!args.is_public,
      published_at: status === 'published' ? new Date().toISOString() : null
    });
    const post = rows[0];
    const tagIds = await resolveTagIds(db, user, args.tag_ids);
    if (tagIds) await setPostTags(db, post.id, user.id, tagIds);
    if (args.linked_resources) await setLinkedResources(db, post.id, user.id, args.linked_resources);
    return { id: post.id, slug: post.slug, status: post.status, heavy_tags: detectHeavyTags(content) };
  },

  async update_post(db, user, args) {
    const post = await findPost(db, user, args);
    const patch = {};
    if (args.title !== undefined) patch.title = requireString(args.title, 'title', { max: 300 });
    if (args.slug !== undefined) patch.slug = slugify(requireString(args.slug, 'slug'));
    if (args.content !== undefined) patch.content = String(args.content);
    if (args.excerpt !== undefined) patch.excerpt = args.excerpt;
    if (args.is_public !== undefined) patch.is_public = !!args.is_public;
    if (args.status !== undefined) {
      patch.status = args.status === 'published' ? 'published' : 'draft';
      if (patch.status === 'published') patch.published_at = new Date().toISOString();
    }
    if (Object.keys(patch).length) {
      await db.update('posts', qs({
        id: `eq.${post.id}`,
        user_id: `eq.${user.id}`
      }), patch);
    }
    const tagIds = await resolveTagIds(db, user, args.tag_ids);
    if (tagIds) await setPostTags(db, post.id, user.id, tagIds);
    if (args.linked_resources) await setLinkedResources(db, post.id, user.id, args.linked_resources);
    return { id: post.id, updated: Object.keys(patch), heavy_tags: detectHeavyTags(patch.content ?? post.content) };
  },

  async add_video(db, user, args) {
    const url = requireString(args.url, 'url', { max: 500 });
    const meta = await fetchVideoMeta(url);
    const rows = await db.insert('resources', {
      user_id: user.id,
      type: 'video',
      title: args.title ? requireString(args.title, 'title', { max: 300 }) : meta.title,
      url: meta.page_url,
      source: meta.platform,
      summary: args.summary ?? meta.description ?? null,
      metadata: meta
    });
    const resource = rows[0];
    const tagIds = await resolveTagIds(db, user, args.tag_ids);
    if (tagIds) await setResourceTags(db, resource.id, user.id, tagIds);
    return { id: resource.id, title: resource.title, platform: meta.platform };
  },

  async add_github_repo(db, user, args, env) {
    const url = requireString(args.url, 'url', { max: 500 });
    const meta = await fetchGithubMeta(url, env);
    const rows = await db.insert('resources', {
      user_id: user.id,
      type: 'github',
      title: args.title ? requireString(args.title, 'title', { max: 300 }) : meta.title,
      url: meta.html_url,
      source: 'github',
      summary: args.summary ?? meta.description ?? null,
      metadata: meta
    });
    const resource = rows[0];
    const tagIds = await resolveTagIds(db, user, args.tag_ids);
    if (tagIds) await setResourceTags(db, resource.id, user.id, tagIds);
    return { id: resource.id, title: resource.title, stars: meta.stars };
  },

  async add_music(db, user, args) {
    const title = requireString(args.title, 'title', { max: 300 });
    const rows = await db.insert('resources', {
      user_id: user.id,
      type: 'music',
      title,
      url: args.audio_url || null,
      source: 'manual',
      cover_path: args.artwork_url || null,
      summary: args.notes || null,
      metadata: { artist: args.artist || null, album: args.album || null, duration: args.duration || null }
    });
    const resource = rows[0];
    await db.insert('music_tracks', {
      resource_id: resource.id,
      user_id: user.id,
      artist: args.artist || null,
      album: args.album || null,
      artwork_url: args.artwork_url || null,
      audio_url: args.audio_url || null,
      duration: args.duration || null,
      notes: args.notes || null
    });
    const tagIds = await resolveTagIds(db, user, args.tag_ids);
    if (tagIds) await setResourceTags(db, resource.id, user.id, tagIds);
    return { id: resource.id, title: resource.title, artist: args.artist || null };
  },

  async add_movie(db, user, args) {
    const title = requireString(args.title, 'title', { max: 300 });
    const mediaType = args.media_type === 'tv' ? 'tv' : 'movie';
    const rows = await db.insert('resources', {
      user_id: user.id,
      type: 'movie',
      title,
      url: args.url || null,
      source: args.source || 'manual',
      cover_path: args.poster_url || null,
      summary: args.notes || args.overview || null,
      metadata: {
        media_type: mediaType,
        original_title: args.original_title || null,
        genres: args.genres || null,
        release_date: args.release_date || null,
        runtime: args.runtime || null,
        rating: args.rating ?? null
      }
    });
    const resource = rows[0];
    await db.insert('movie_titles', {
      resource_id: resource.id,
      user_id: user.id,
      media_type: mediaType,
      original_title: args.original_title || null,
      director: args.director || null,
      cast_list: args.cast_list || null,
      genres: args.genres || null,
      release_date: args.release_date || null,
      runtime: args.runtime || null,
      rating: args.rating ?? null,
      overview: args.overview || null,
      poster_url: args.poster_url || null,
      source: args.source || 'manual',
      notes: args.notes || null
    });
    const tagIds = await resolveTagIds(db, user, args.tag_ids);
    if (tagIds) await setResourceTags(db, resource.id, user.id, tagIds);
    return { id: resource.id, title: resource.title, media_type: mediaType };
  },

  async link_resources(db, user, args) {
    const post = await findPost(db, user, { id: args.post_id });
    const links = (args.resource_ids || []).map((rid) => ({ resource_id: rid, relation: args.relation }));
    await setLinkedResources(db, post.id, user.id, links);
    return { post_id: post.id, linked: links.length };
  },

  async list_resources(db, user, args) {
    // MCP 只服务管理员本人自动化：始终限定 user_id，避免把其他用户资源列给 AI。
    const filters = {
      select: 'id,type,title,url,source,created_at',
      user_id: `eq.${user.id}`
    };
    if (args.type) filters.type = `eq.${args.type}`;
    filters.order = 'created_at.desc';
    filters.limit = String(Math.min(Number(args.limit) || 20, 100));
    const rows = await db.select('resources', qs(filters));
    return { items: rows, count: rows.length };
  },

  async list_assets(db, user, args) {
    // 始终限定本人，避免把其他用户素材列给 AI
    const rows = await db.select('assets', qs({
      select: 'id,public_url,original_name,mime_type,size,width,height,created_at',
      user_id: `eq.${user.id}`,
      order: 'created_at.desc',
      limit: String(Math.min(Number(args.limit) || 20, 100))
    }));
    return { items: rows, count: rows.length };
  },

  // 列出已有文章 —— AI 写作前查重、确认序号用。
  //
  // 为什么必须给 AI 这个工具（2026-10-13 用户提出）：
  //   「他不知道没有历史数据知道我写了哪些文章，然后这个文章的规格是什么样的」
  //   AI 是无状态的，不查就不知道「软件工程」已经写到第八篇，
  //   必然会写出重复的序号、或者撞已有标题。
  //
  // 只返回标题级字段（不含 content）：315 篇文章的正文有几十 MB，
  // 全带出来既慢又没必要 —— AI 要的是「有哪些、叫什么叫什么、什么分类」。
  async list_posts(db, user, args) {
    // ⚠ 关键：**过滤必须下推到 SQL**，不能先取 N 条再在内存里筛。
    //   踩过的坑（2026-10-13 实测）：原先写成「取最新 50 条 → 内存里按分类过滤」，
    //   结果「软件工程」明明有 8 篇，接口只返回 1 篇 ——
    //   因为 8 篇里只有 1 篇落在最新 50 条内，其余被 limit 截掉了。
    //   AI 拿到错误结果就会误判「这个分类只写到第一篇」，直接写出重复序号。
    //
    //   所以：分类先解析成 category_id 并下推；关键词也下推（ilike）。
    const filters = {
      select: 'id,title,slug,status,is_public,category_id,published_at,created_at',
      user_id: `eq.${user.id}`,
      order: 'created_at.desc',
      limit: String(Math.min(Number(args.limit) || 50, 500))
    };
    if (args.status) filters.status = `eq.${args.status}`;

    // 分类名 / slug → category_id（先查分类表，再按 id 过滤）
    let catFilter = null;
    if (args.category) {
      const cats = await db.select('categories', qs({ select: 'id,name,slug' }));
      const want = String(args.category).trim().toLowerCase();
      catFilter = cats.find((c) => String(c.name).toLowerCase() === want
        || String(c.slug).toLowerCase() === want) || null;
      if (!catFilter) return { items: [], count: 0, note: `没有名为「${args.category}」的分类` };
      filters.category_id = `eq.${catFilter.id}`;
    }
    // 关键词下推（Supabase 的 ilike 用 * 作通配符）
    if (args.keyword) {
      const kw = String(args.keyword).trim().replace(/[%,()*]/g, ' ');
      filters.title = `ilike.*${kw}*`;
    }

    const rows = await db.select('posts', qs(filters));

    // 分类：把 category_id 换成人能读的分类名（AI 也需要读得懂）
    const cats = await db.select('categories', qs({ select: 'id,name,slug' }));
    const catById = new Map(cats.map((c) => [c.id, c]));

    const items = rows.map((r) => {
      const c = catById.get(r.category_id);
      return {
        id: r.id,
        title: r.title,
        slug: r.slug,
        status: r.status,
        is_public: r.is_public,
        category: c ? c.name : null,
        category_slug: c ? c.slug : null,
        created_at: r.created_at
      };
    });

    return { items, count: items.length };
  },

  // 列出分类与每类文章数 —— AI 判断「新文章该归哪类、这类写到第几篇了」。
  async list_categories(db, user) {
    const [cats, posts] = await Promise.all([
      db.select('categories', qs({ select: 'id,name,slug,description', order: 'name' })),
      db.select('posts', qs({ select: 'category_id', user_id: `eq.${user.id}` }))
    ]);
    const tally = new Map();
    for (const p of posts) tally.set(p.category_id, (tally.get(p.category_id) || 0) + 1);
    return {
      items: cats.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description || null,
        post_count: tally.get(c.id) || 0
      })),
      count: cats.length
    };
  },

  // 列出标签（含 id）—— AI 挂标签前需要把「名字」换成「UUID」。
  //
  // 为什么必须给这个工具：create_post 的 tag_ids 只接受 UUID
  //（后端 validateTagIds 按 id 查询），而 AI 只知道标签的中文名。
  // 没有这个工具，AI 就只能瞎编 UUID，标签必然挂不上。
  async list_tags(db, user, args) {
    const rows = await db.select('tags', qs({
      select: 'id,name,slug',
      user_id: `eq.${user.id}`,
      order: 'name'
    }));
    let items = rows.map((t) => ({ id: t.id, name: t.name, slug: t.slug }));
    if (args.keyword) {
      const kw = String(args.keyword).trim().toLowerCase();
      items = items.filter((t) => String(t.name).toLowerCase().includes(kw));
    }
    return { items, count: items.length };
  },

  async set_post_cover(db, user, args) {
    const postId = requireString(args.post_id, 'post_id', { max: 64 });
    const assetId = requireString(args.asset_id, 'asset_id', { max: 64 });
    // 校验文章与素材均属于本人，否则 404（不泄漏他人数据是否存在）
    const posts = await db.select('posts', qs({ select: 'id', id: `eq.${postId}`, user_id: `eq.${user.id}` }));
    if (!posts.length) throw new HttpError(404, '文章不存在');
    const assets = await db.select('assets', qs({ select: 'id,public_url', id: `eq.${assetId}`, user_id: `eq.${user.id}` }));
    if (!assets.length) throw new HttpError(404, '素材不存在');
    const coverPath = assets[0].public_url;
    await db.update('posts', qs({ id: `eq.${postId}`, user_id: `eq.${user.id}` }), { cover_path: coverPath });
    return { post_id: postId, cover_path: coverPath };
  },

  async upload_image(db, user, args, env) {
    const filename = requireString(args.filename, 'filename', { max: 300 });
    const contentType = requireString(args.content_type, 'content_type', { max: 100 });
    const b64 = requireString(args.data_base64, 'data_base64', { max: 40 * 1024 * 1024 });
    // 解码 base64（纯 Web API，Worker 与 Node 通用）
    const bytes = decodeBase64(b64);
    if (!bytes) throw new HttpError(422, 'data_base64 不是合法的 base64');
    if (!bytes.length) throw new HttpError(422, 'data_base64 解码后为空');
    // 复用 REST 上传的同一套校验 + 落库逻辑（不复制校验）
    const row = await storeImage(env, db, user, {
      bytes,
      filename,
      contentType,
      origin: fallbackPublicBase(env)
    });
    return {
      id: row.id,
      public_url: row.public_url,
      object_key: row.object_key,
      mime_type: row.mime_type,
      size: row.size,
      width: row.width,
      height: row.height
    };
  }
};

async function invokeTool(db, user, toolName, args = {}, env = {}) {
  const handler = handlers[toolName];
  if (!handler) throw new HttpError(404, `未知工具: ${toolName}`);
  return handler(db, user, args, env);
}

// ---------------------------------------------------------------
// 路由处理
// ---------------------------------------------------------------

// GET /api/mcp/tools  —— 工具发现（仅管理员）
export async function listMcpTools(request, env) {
  await requireAdmin(request, env);
  return ok({ tools: TOOLS }, request, env);
}

// POST /api/mcp/invoke  —— 直接调用工具（仅管理员）
export async function invokeMcpTool(request, env) {
  const { db, user } = await requireAdmin(request, env);
  const body = await readJson(request);
  const tool = requireString(body.tool, 'tool', { max: 60 });
  const result = await invokeTool(db, user, tool, body.arguments || {}, env);
  return ok({ tool, result }, request, env);
}

// POST /api/mcp  —— JSON-RPC 2.0 兼容入口（仅管理员）
export async function mcpRpc(request, env) {
  const { db, user } = await requireAdmin(request, env);
  const body = await readJson(request);
  const { id = null, method } = body;

  const reply = (result) => json({ jsonrpc: '2.0', id, result }, {}, request, env);
  const rpcError = (code, message) => json({ jsonrpc: '2.0', id, error: { code, message } }, {}, request, env);

  try {
    if (method === 'initialize') {
      return reply({
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'knowledge-base-mcp', version: '0.1.0' },
        capabilities: { tools: { listChanged: false } }
      });
    }
    if (method === 'tools/list') {
      return reply({ tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) });
    }
    if (method === 'tools/call') {
      const toolName = body.params?.name;
      const args = body.params?.arguments || {};
      const result = await invokeTool(db, user, toolName, args, env);
      return reply({ content: [{ type: 'text', text: JSON.stringify(result) }], isError: false });
    }
    return rpcError(-32601, `未支持的方法: ${method}`);
  } catch (err) {
    if (err instanceof HttpError) return rpcError(-32602, err.message);
    return rpcError(-32603, err.message || '内部错误');
  }
}
