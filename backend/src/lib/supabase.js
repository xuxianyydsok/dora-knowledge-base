// Supabase REST（PostgREST）轻量客户端
// 使用 service_role key 直连数据库；RLS 仍生效，但 service_role 绕过 RLS，
// 因此所有查询必须在业务层显式按 user_id 过滤，确保数据隔离。

export class SupabaseClient {
  constructor(env) {
    this.url = env.SUPABASE_URL;
    this.key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!this.url || !this.key) {
      throw new Error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 配置');
    }
  }

  async request(path, { method = 'GET', body, headers = {}, prefer } = {}) {
    const res = await fetch(`${this.url}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        'Content-Type': 'application/json',
        ...(prefer ? { Prefer: prefer } : {}),
        ...headers
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    const text = await res.text();
    const payload = text ? JSON.parse(text) : null;

    if (!res.ok) {
      const message = payload?.message || payload?.hint || `Supabase 请求失败 (${res.status})`;
      const err = new Error(message);
      err.status = res.status;
      err.details = payload;
      throw err;
    }
    return payload;
  }

  select(table, query = '') {
    return this.request(`${table}${query ? `?${query}` : ''}`);
  }

  insert(table, rows) {
    return this.request(table, {
      method: 'POST',
      body: rows,
      prefer: 'return=representation'
    });
  }

  update(table, query, patch) {
    return this.request(`${table}?${query}`, {
      method: 'PATCH',
      body: patch,
      prefer: 'return=representation'
    });
  }

  remove(table, query) {
    return this.request(`${table}?${query}`, {
      method: 'DELETE',
      prefer: 'return=representation'
    });
  }

  // 调用数据库 RPC（如 is_admin 判定）
  async rpc(fn, args = {}) {
    return this.request(`rpc/${fn}`, { method: 'POST', body: args });
  }
}

// 将对象编码为 PostgREST 查询参数
export function qs(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.append(k, v);
  }
  return sp.toString();
}

// 转义 PostgREST 模糊匹配（ilike）中的特殊字符，避免语法错误/注入
export function escapeLike(input) {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/[(),]/g, '');
}
