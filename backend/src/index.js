// Cloudflare Workers 入口
// Phase1：JWT 鉴权中间件 + 分类/标签 CRUD

import { handleRequest } from './router.js';

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  }
};
