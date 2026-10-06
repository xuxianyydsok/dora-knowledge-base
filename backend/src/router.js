// 极简路由：按 方法 + 路径 分发，支持 :id 参数
// 所有 API 前缀为 /api

import { corsHeaders, fail, HttpError } from './lib/response.js';
import * as categories from './routes/categories.js';
import * as tags from './routes/tags.js';
import * as me from './routes/me.js';
import * as videos from './routes/videos.js';
import * as github from './routes/github.js';
import * as posts from './routes/posts.js';
import * as mcp from './routes/mcp.js';

// 路由表：[method, pattern, handler]
// pattern 中 :name 表示路径参数；handler 依次接收 (request, env, param1, param2, ...)
const routes = [
  ['GET', '/api/me', me.getMe],

  // 分类
  ['GET', '/api/categories', categories.listCategories],
  ['POST', '/api/categories', categories.createCategory],
  ['PATCH', '/api/categories/:id', categories.updateCategory],
  ['DELETE', '/api/categories/:id', categories.deleteCategory],

  // 标签
  ['GET', '/api/tags', tags.listTags],
  ['POST', '/api/tags', tags.createTag],
  ['POST', '/api/tags/batch', tags.batchCreateTags],
  ['PATCH', '/api/tags/batch', tags.batchUpdateTags],
  ['DELETE', '/api/tags/batch', tags.batchDeleteTags],
  ['PATCH', '/api/tags/:id', tags.updateTag],
  ['DELETE', '/api/tags/:id', tags.deleteTag],

  // 学习视频
  ['GET', '/api/videos', videos.listVideos],
  ['POST', '/api/videos', videos.createVideo],
  ['POST', '/api/videos/fetch', videos.fetchVideoInfo],
  ['GET', '/api/videos/:id', videos.getVideo],
  ['PATCH', '/api/videos/:id', videos.updateVideo],
  ['DELETE', '/api/videos/:id', videos.deleteVideo],
  ['GET', '/api/videos/:id/progress', videos.getVideoProgress],
  ['PUT', '/api/videos/:id/progress', videos.saveVideoProgress],

  // GitHub 收藏
  ['GET', '/api/github', github.listGithub],
  ['POST', '/api/github', github.createGithub],
  ['POST', '/api/github/fetch', github.fetchGithubInfo],
  ['GET', '/api/github/:id', github.getGithub],
  ['PATCH', '/api/github/:id', github.updateGithub],
  ['DELETE', '/api/github/:id', github.deleteGithub],

  // 博客
  ['GET', '/api/posts', posts.listPosts],
  ['POST', '/api/posts', posts.createPost],
  ['GET', '/api/posts/slug/:slug', posts.getPostBySlug],
  ['GET', '/api/posts/:id', posts.getPost],
  ['PATCH', '/api/posts/:id', posts.updatePost],
  ['DELETE', '/api/posts/:id', posts.deletePost],

  // 管理员 MCP 端点
  ['GET', '/api/mcp/tools', mcp.listMcpTools],
  ['POST', '/api/mcp/invoke', mcp.invokeMcpTool],
  ['POST', '/api/mcp', mcp.mcpRpc]
];

function matchRoute(method, pathname) {
  for (const [m, pattern, handler] of routes) {
    if (m !== method) continue;
    const pParts = pattern.split('/').filter(Boolean);
    const uParts = pathname.split('/').filter(Boolean);
    if (pParts.length !== uParts.length) continue;

    const params = [];
    let matched = true;
    for (let i = 0; i < pParts.length; i++) {
      if (pParts[i].startsWith(':')) {
        params.push(decodeURIComponent(uParts[i]));
      } else if (pParts[i] !== uParts[i]) {
        matched = false;
        break;
      }
    }
    if (matched) return { handler, params };
  }
  return null;
}

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  const { pathname } = url;

  // CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  // 健康检查
  if (pathname === '/health') {
    return new Response(JSON.stringify({ status: 'ok', service: 'knowledge-base-api' }), {
      headers: { 'content-type': 'application/json', ...corsHeaders(request, env) }
    });
  }

  const match = matchRoute(request.method, pathname);
  if (!match) return fail('接口不存在', 404, request, env);

  try {
    return await match.handler(request, env, ...match.params);
  } catch (err) {
    if (err instanceof HttpError) {
      return fail(err.message, err.status, request, env, err.extra);
    }
    console.error('未处理错误:', err?.stack || err);
    return fail(err?.message || '服务器内部错误', err?.status || 500, request, env);
  }
}
