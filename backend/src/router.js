// 极简路由：按 方法 + 路径 分发，支持 :id 参数
// 所有 API 前缀为 /api

import { corsHeaders, fail, HttpError } from './lib/response.js';
import * as categories from './routes/categories.js';
import * as tags from './routes/tags.js';
import * as me from './routes/me.js';

// 路由表：[method, pattern, handler]
// pattern 中 :name 表示路径参数
const routes = [
  ['GET', '/api/me', me.getMe],
  ['GET', '/api/categories', categories.listCategories],
  ['POST', '/api/categories', categories.createCategory],
  ['PATCH', '/api/categories/:id', categories.updateCategory],
  ['DELETE', '/api/categories/:id', categories.deleteCategory],

  ['GET', '/api/tags', tags.listTags],
  ['POST', '/api/tags', tags.createTag],
  ['POST', '/api/tags/batch', tags.batchCreateTags],
  ['PATCH', '/api/tags/batch', tags.batchUpdateTags],
  ['DELETE', '/api/tags/batch', tags.batchDeleteTags],
  ['PATCH', '/api/tags/:id', tags.updateTag],
  ['DELETE', '/api/tags/:id', tags.deleteTag]
];

function matchRoute(method, pathname) {
  for (const [m, pattern, handler] of routes) {
    if (m !== method) continue;
    const pParts = pattern.split('/').filter(Boolean);
    const uParts = pathname.split('/').filter(Boolean);
    if (pParts.length !== uParts.length) continue;

    const params = {};
    let matched = true;
    for (let i = 0; i < pParts.length; i++) {
      if (pParts[i].startsWith(':')) {
        params[pParts[i].slice(1)] = decodeURIComponent(uParts[i]);
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
    return await match.handler(request, env, match.params.id);
  } catch (err) {
    if (err instanceof HttpError) {
      return fail(err.message, err.status, request, env, err.extra);
    }
    console.error('未处理错误:', err?.stack || err);
    return fail(err?.message || '服务器内部错误', err?.status || 500, request, env);
  }
}
