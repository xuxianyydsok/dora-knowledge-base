// JWT 校验：优先使用 Supabase JWKS（ES256/RS256 非对称签名），
// 兼容旧版 HS256 共享密钥模式（提供 SUPABASE_JWT_SECRET 时启用）。
// 使用 Web Crypto，无第三方依赖，适配 Workers 运行时。

const JWKS_CACHE_TTL_MS = 10 * 60 * 1000; // JWKS 缓存 10 分钟
let jwksCache = { keys: null, fetchedAt: 0, url: '' };

function base64UrlToUint8Array(input) {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function decodeBase64UrlJson(input) {
  return JSON.parse(new TextDecoder().decode(base64UrlToUint8Array(input)));
}

async function getJwks(env) {
  const url = `${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`;
  const now = Date.now();
  if (jwksCache.keys && jwksCache.url === url && now - jwksCache.fetchedAt < JWKS_CACHE_TTL_MS) {
    return jwksCache.keys;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`获取 JWKS 失败 (${res.status})`);
  const { keys } = await res.json();
  jwksCache = { keys, fetchedAt: now, url };
  return keys;
}

async function importKeyFromJwk(jwk) {
  const algo = jwk.alg === 'ES256'
    ? { name: 'ECDSA', namedCurve: 'P-256' }
    : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
  return crypto.subtle.importKey('jwk', jwk, algo, false, ['verify']);
}

async function verifyWithJwks(env, header, signingInput, signature) {
  const keys = await getJwks(env);
  const jwk = keys.find((k) => k.kid === header.kid) || (keys.length === 1 ? keys[0] : null);
  if (!jwk) throw new Error('未找到匹配的 JWKS 公钥');

  const key = await importKeyFromJwk(jwk);
  const algo = jwk.alg === 'ES256'
    ? { name: 'ECDSA', hash: 'SHA-256' }
    : { name: 'RSASSA-PKCS1-v1_5' };

  const valid = await crypto.subtle.verify(
    algo, key, base64UrlToUint8Array(signature), new TextEncoder().encode(signingInput)
  );
  if (!valid) throw new Error('JWT 签名校验失败');
}

async function verifyWithHmac(env, signingInput, signature) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(env.SUPABASE_JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const valid = await crypto.subtle.verify(
    'HMAC', key, base64UrlToUint8Array(signature), new TextEncoder().encode(signingInput)
  );
  if (!valid) throw new Error('JWT 签名校验失败');
}

// 校验并解析 JWT，返回 payload；失败抛出带 status 的错误
export async function verifyJwt(token, env) {
  const parts = token.split('.');
  if (parts.length !== 3) throw Object.assign(new Error('JWT 格式错误'), { status: 401 });

  const [headerB64, payloadB64, signature] = parts;
  let header, payload;
  try {
    header = decodeBase64UrlJson(headerB64);
    payload = decodeBase64UrlJson(payloadB64);
  } catch {
    throw Object.assign(new Error('JWT 解析失败'), { status: 401 });
  }

  const signingInput = `${headerB64}.${payloadB64}`;

  if (header.alg === 'HS256') {
    if (!env.SUPABASE_JWT_SECRET) {
      throw Object.assign(new Error('服务端未配置 JWT 密钥'), { status: 500 });
    }
    await verifyWithHmac(env, signingInput, signature);
  } else if (header.alg === 'ES256' || header.alg === 'RS256') {
    await verifyWithJwks(env, header, signingInput, signature);
  } else {
    throw Object.assign(new Error(`不支持的签名算法: ${header.alg}`), { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw Object.assign(new Error('登录已过期'), { status: 401 });
  }
  if (payload.nbf && payload.nbf > now + 5) {
    throw Object.assign(new Error('JWT 尚未生效'), { status: 401 });
  }
  if (payload.aud && payload.aud !== 'authenticated' && payload.aud !== 'service_role') {
    throw Object.assign(new Error('JWT 受众无效'), { status: 401 });
  }
  return payload;
}
