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
        type: { type: 'string', enum: ['video', 'github', 'music', 'movie', 'rss_article'] },
        limit: { type: 'number', default: 20 }
      }
    }
  }
];

// ---------------------------------------------------------------
// 工具实现
// ---------------------------------------------------------------
async function findPost(db, user, { id, slug }) {
  const filters = { select: '*' };
  if (id) filters.id = `eq.${id}`;
  else if (slug) filters.slug = `eq.${slug}`;
  else throw new HttpError(422, '必须提供 id 或 slug');

  const rows = await db.select('posts', qs({
    ...filters,
    ...(user.isAdmin ? {} : { user_id: `eq.${user.id}` })
  }));
  if (!rows.length) throw new HttpError(404, '文章不存在');
  return rows[0];
}

async function resolveTagIds(db, user, tagIds) {
  if (tagIds === undefined) return undefined;
  return validateTagIds(db, user.id, user.isAdmin, tagIds);
}

async function setLinkedResources(db, postId, userId, links) {
  await db.remove('post_resources', qs({ post_id: `eq.${postId}` }));
  if (!Array.isArray(links) || links.length === 0) return;
  const rows = links.map((l, idx) => ({
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
    if (tagIds) await setResourceTags(db, post.id, user.id, tagIds);
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
      await db.update('posts', qs({ id: `eq.${post.id}` }), patch);
    }
    const tagIds = await resolveTagIds(db, user, args.tag_ids);
    if (tagIds) await setResourceTags(db, post.id, user.id, tagIds);
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

  async add_github_repo(db, user, args) {
    const url = requireString(args.url, 'url', { max: 500 });
    const meta = await fetchGithubMeta(url, {});
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

  async link_resources(db, user, args) {
    const post = await findPost(db, user, { id: args.post_id });
    const links = (args.resource_ids || []).map((rid) => ({ resource_id: rid, relation: args.relation }));
    await setLinkedResources(db, post.id, user.id, links);
    return { post_id: post.id, linked: links.length };
  },

  async list_resources(db, user, args) {
    const filters = { select: 'id,type,title,url,source,created_at' };
    if (args.type) filters.type = `eq.${args.type}`;
    if (!user.isAdmin) filters.user_id = `eq.${user.id}`;
    filters.order = 'created_at.desc';
    filters.limit = String(Math.min(Number(args.limit) || 20, 100));
    const rows = await db.select('resources', qs(filters));
    return { items: rows, count: rows.length };
  }
};

async function invokeTool(db, user, toolName, args = {}) {
  const handler = handlers[toolName];
  if (!handler) throw new HttpError(404, `未知工具: ${toolName}`);
  return handler(db, user, args);
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
  const result = await invokeTool(db, user, tool, body.arguments || {});
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
      const result = await invokeTool(db, user, toolName, args);
      return reply({ content: [{ type: 'text', text: JSON.stringify(result) }], isError: false });
    }
    return rpcError(-32601, `未支持的方法: ${method}`);
  } catch (err) {
    if (err instanceof HttpError) return rpcError(-32602, err.message);
    return rpcError(-32603, err.message || '内部错误');
  }
}
