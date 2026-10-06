// Cloudflare Workers 入口（Phase0 占位）
// Phase1 起将拆分路由、JWT 鉴权中间件、MCP 端点等模块
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({ status: 'ok', service: 'knowledge-base-api' }),
        { headers: { 'content-type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    });
  }
};
