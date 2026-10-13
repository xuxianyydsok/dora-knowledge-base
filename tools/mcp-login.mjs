#!/usr/bin/env node
// MCP 登录：用站长邮箱密码换一个管理员 JWT，存到 .mcp-token
//
// 为什么需要这个脚本（2026-10-13 用户需求）：
//   「后续如果我换电脑了，或者不在这台电脑上操作了，可以让 Agent 把项目拉下来，
//    找到对应的 MCP，然后连接上」。
//   MCP 接口要管理员 JWT，而 JWT 会过期（默认 1 小时）。
//   新电脑上的 Agent 不该每次都要用户手动贴 token —— 这个脚本让它自己换。
//
// 用法：
//   1. 在项目根目录建 .env.local（已被 .gitignore 忽略），写入：
//        MCP_EMAIL=你的站长邮箱
//        MCP_PASSWORD=你的站长密码
//   2. node tools/mcp-login.mjs
//   3. 之后 tools/publish-post.mjs 会自动读 .mcp-token
//
// 安全：
//   · .env.local 与 .mcp-token 都在 .gitignore 里，绝不入库
//   · 脚本不打印密码与 token 内容，只打印「成功 / 有效期」
//   · token 存文件权限 600

import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = resolve(ROOT, '.env.local');
const TOKEN_FILE = resolve(ROOT, '.mcp-token');

// 从 backend/.dev.vars 读 Supabase 地址（那里是唯一事实来源，避免两处配置漂移）
function readSupabaseUrl() {
  const devVars = resolve(ROOT, 'backend/.dev.vars');
  if (!existsSync(devVars)) return null;
  const line = readFileSync(devVars, 'utf8').split('\n')
    .find((l) => l.startsWith('SUPABASE_URL='));
  return line ? line.slice('SUPABASE_URL='.length).trim().replace(/^["']|["']$/g, '') : null;
}

function readAnonKey() {
  const devVars = resolve(ROOT, 'backend/.dev.vars');
  if (!existsSync(devVars)) return null;
  const line = readFileSync(devVars, 'utf8').split('\n')
    .find((l) => l.startsWith('SUPABASE_ANON_KEY='));
  return line ? line.slice('SUPABASE_ANON_KEY='.length).trim().replace(/^["']|["']$/g, '') : null;
}

function readLocalEnv() {
  if (!existsSync(ENV_FILE)) return {};
  const out = {};
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const local = readLocalEnv();
const email = local.MCP_EMAIL;
const password = local.MCP_PASSWORD;

if (!email || !password) {
  console.error('❌ 缺少登录凭据。请在项目根目录创建 .env.local：');
  console.error('');
  console.error('   MCP_EMAIL=你的站长邮箱');
  console.error('   MCP_PASSWORD=你的站长密码');
  console.error('');
  console.error('（该文件已被 .gitignore 忽略，不会进仓库）');
  process.exit(1);
}

const supabaseUrl = readSupabaseUrl();
const anonKey = readAnonKey();
if (!supabaseUrl || !anonKey) {
  console.error('❌ 读不到 Supabase 配置，请确认 backend/.dev.vars 存在且含 SUPABASE_URL 与 SUPABASE_ANON_KEY');
  process.exit(1);
}

// 用 Supabase Auth 的密码模式登录
const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: anonKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

if (!res.ok) {
  const text = await res.text();
  // 不打印服务端原文（可能含敏感信息），只给状态码与常见原因
  console.error(`❌ 登录失败（HTTP ${res.status}）`);
  console.error('   常见原因：邮箱或密码不对 / 邮箱未确认 / 账号被禁用');
  if (res.status === 400) console.error('   （Supabase 对密码错误统一返回 400）');
  process.exit(1);
}

const data = await res.json();
if (!data.access_token) {
  console.error('❌ 登录成功但没拿到 token，请检查 Supabase 项目配置');
  process.exit(1);
}

// 存 token（含过期时间，便于后续判断是否要重登）
writeFileSync(TOKEN_FILE, JSON.stringify({
  access_token: data.access_token,
  refresh_token: data.refresh_token,
  expires_at: data.expires_at,
  obtained_at: new Date().toISOString(),
  email
}, null, 2), 'utf8');
try { chmodSync(TOKEN_FILE, 0o600); } catch { /* Windows / 某些文件系统不支持，忽略 */ }

const hours = data.expires_in ? Math.round(data.expires_in / 3600) : 1;
console.log('✅ 登录成功');
console.log(`   账号：${email}`);
console.log(`   有效期：约 ${hours} 小时`);
console.log(`   token 已存到 .mcp-token（已被 .gitignore 忽略）`);
console.log('');
console.log('接下来可以：');
console.log('   node tools/publish-post.mjs 文章.html --title "标题" --category 分类名');
