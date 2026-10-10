// Cloudflare Workers 入口
// fetch：REST API 入口（JWT 鉴权 + 各业务模块 + 管理员 MCP 端点）

import { handleRequest } from './router.js';

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  }
};
