// 统一 JSON 响应与 CORS 处理
// CORS 仅允许配置的前端域名（env.CORS_ORIGINS，逗号分隔）

export function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const headers = {
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };

  // 开发环境放行 localhost；生产仅允许白名单域名
  if (origin && (allowed.includes(origin) || allowed.includes('*'))) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export function json(data, init = {}, request, env) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    ...(request && env ? corsHeaders(request, env) : {}),
    ...(init.headers || {})
  };
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function ok(data, request, env, status = 200) {
  return json({ data }, { status }, request, env);
}

export function fail(message, status = 400, request, env, extra = {}) {
  return json({ error: message, ...extra }, { status }, request, env);
}

// 解析并校验 JSON 请求体
export async function readJson(request) {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) {
    throw new HttpError(415, '请求体必须为 application/json');
  }
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'JSON 格式错误');
  }
}

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
