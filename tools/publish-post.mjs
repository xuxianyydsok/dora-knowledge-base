#!/usr/bin/env node
// 发布博客文章到 Dora Studio（走 MCP 接口）
//
// 用途：让 Agent（或用户）用一条命令发文，不用懂鉴权、不用手拼 JSON、不用算 slug。
//
// 用法：
//   node tools/publish-post.mjs 文章.html \
//     --title "软件工程（九）：xxx" \
//     --category 软件工程 \
//     --excerpt "一句话摘要" \
//     --tags "软件工程,CI/CD"
//
// 可选：
//   --slug <自定义slug>   不传则按「分类slug-两位序号-关键词」自动生成
//   --draft               存草稿（默认直接发布）
//   --private             不公开（默认公开）
//   --dry-run             只预览，不真正提交
//
// 前置：先跑 node tools/mcp-login.mjs 拿 token
//
// 为什么要有这个脚本（2026-10-13 用户需求）：
//   「到时候我拉下来了之后，直接就把我想写的文章告诉它，然后它就自己去写了」
//   Agent 直接调 MCP 也行，但那样它要自己算序号、拼 slug、处理 401 重登。
//   把这些都封在脚本里，出错概率低得多。

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN_FILE = resolve(ROOT, '.mcp-token');
const API = process.env.MCP_API_BASE || 'https://api.xuguochen.de5.net';

// ---------------- 参数解析 ----------------
const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--'));
const flags = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) continue;
  const key = a.slice(2);
  const next = argv[i + 1];
  if (next && !next.startsWith('--')) { flags[key] = next; i++; }
  else flags[key] = true;
}

if (!file) {
  console.error('用法：node tools/publish-post.mjs 文章.html --title "标题" --category 分类名 [--excerpt "..."] [--tags "a,b"]');
  process.exit(1);
}
const filePath = resolve(process.cwd(), file);
if (!existsSync(filePath)) {
  console.error(`❌ 找不到文件：${filePath}`);
  process.exit(1);
}
if (!flags.title) { console.error('❌ 缺少 --title'); process.exit(1); }
if (!flags.category) { console.error('❌ 缺少 --category（如「软件工程」）'); process.exit(1); }

const content = readFileSync(filePath, 'utf8');

// ---------------- 读 token ----------------
if (!existsSync(TOKEN_FILE)) {
  console.error('❌ 还没登录。先运行：node tools/mcp-login.mjs');
  process.exit(1);
}
let token;
try {
  const t = JSON.parse(readFileSync(TOKEN_FILE, 'utf8'));
  token = t.access_token;
  // 过期提醒（不阻塞，服务端会最终裁决）
  if (t.expires_at && t.expires_at * 1000 < Date.now()) {
    console.error('⚠️  token 已过期，请重新运行：node tools/mcp-login.mjs');
    process.exit(1);
  }
} catch {
  console.error('❌ .mcp-token 损坏，请重新运行：node tools/mcp-login.mjs');
  process.exit(1);
}

async function callMcp(tool, args) {
  const res = await fetch(`${API}/api/mcp/invoke`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, arguments: args })
  });
  const text = await res.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { /* 非 JSON */ }
  if (!res.ok) {
    const msg = payload?.error || `HTTP ${res.status}`;
    if (res.status === 401 || res.status === 403) {
      console.error(`❌ 鉴权失败（${msg}）。token 可能已过期，请重新运行：node tools/mcp-login.mjs`);
      process.exit(1);
    }
    throw new Error(msg);
  }
  return payload?.data?.result ?? payload?.result ?? payload;
}

// ---------------- 查分类与已有文章，自动算序号 ----------------
console.log('→ 查询分类与已有文章…');
const cats = await callMcp('list_categories', {});
const catList = cats?.items || [];
const want = String(flags.category).trim().toLowerCase();
const cat = catList.find((c) => String(c.name).toLowerCase() === want
  || String(c.slug).toLowerCase() === want);

if (!cat) {
  console.error(`❌ 找不到分类「${flags.category}」。现有分类：`);
  for (const c of catList) console.error(`   - ${c.name}（${c.slug}，${c.post_count} 篇）`);
  process.exit(1);
}

const posts = await callMcp('list_posts', { category: cat.name, limit: 200 });
const list = posts?.items || [];
console.log(`   分类「${cat.name}」已有 ${list.length} 篇`);

// 从已有标题里抽出最大的中文序号，下一篇 +1
const CN = ['一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五',
  '十六','十七','十八','十九','二十','二十一','二十二','二十三','二十四','二十五','二十六','二十七',
  '二十八','二十九','三十'];
function cnToNum(s) {
  const i = CN.indexOf(s);
  if (i >= 0) return i + 1;
  return Number(s) || 0;
}
let maxSeq = 0;
for (const p of list) {
  const m = String(p.title || '').match(/（([一二三四五六七八九十]+|\d+)）/);
  if (m) maxSeq = Math.max(maxSeq, cnToNum(m[1]));
}
const nextSeq = maxSeq + 1;
const nextCn = CN[nextSeq - 1] || String(nextSeq);

// 检查标题里用户写的序号是否与「自动算出来的」一致，不一致就提醒
const titleSeqMatch = String(flags.title).match(/（([一二三四五六七八九十]+|\d+)）/);
if (titleSeqMatch) {
  const userSeq = cnToNum(titleSeqMatch[1]);
  if (userSeq !== nextSeq) {
    console.log('');
    console.log(`⚠️  序号提醒：你写的标题是「（${titleSeqMatch[1]}）」，但按已有 ${list.length} 篇推算，`);
    console.log(`    这个分类的下一篇应该是「（${nextCn}）」。请确认是否写错了序号。`);
    if (!flags.force) {
      console.log('    如确认无误，加 --force 继续。');
      process.exit(2);
    }
  }
}

// slug：优先用 --slug，否则按「分类slug-两位序号-关键词」生成
let slug = flags.slug;
if (!slug) {
  const kw = String(flags.title)
    .replace(/^[^（）]*（[^）]*）[：:——]*/, '')   // 去掉「分类（序号）：」
    .replace(/[《》【】（）()、，。！？；：""''\s]/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')                // 只留英文数字（中文关键词需要手写 --slug）
    .replace(/-+/g, '-').replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 40);
  slug = `${cat.slug}-${String(nextSeq).padStart(2, '0')}${kw ? `-${kw}` : ''}`;
}

const excerpt = flags.excerpt || content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);

console.log('');
console.log('─── 即将发布 ───');
console.log(`  标题：${flags.title}`);
console.log(`  分类：${cat.name}`);
console.log(`  slug：${slug}`);
console.log(`  摘要：${excerpt.slice(0, 60)}…`);
console.log(`  正文字数：${content.replace(/<[^>]*>/g, '').length}`);
console.log(`  状态：${flags.draft ? '草稿' : '发布'} / ${flags.private ? '私有' : '公开'}`);
if (flags.tags) console.log(`  标签：${flags.tags}`);
console.log('');

if (flags['dry-run']) {
  console.log('（--dry-run：仅预览，未提交）');
  process.exit(0);
}

// 标签：把「名字」换成「UUID」。
// 后端的 create_post 只接受 tag_id（validateTagIds 按 id 查库），
// 所以必须先用 list_tags 查一遍，把用户写的「软件工程」换成对应的 UUID。
let tagIds;
if (flags.tags) {
  const names = String(flags.tags).split(',').map((s) => s.trim()).filter(Boolean);
  const all = await callMcp('list_tags', {});
  const byName = new Map((all?.items || []).map((t) => [String(t.name).toLowerCase(), t]));
  tagIds = [];
  const missing = [];
  for (const n of names) {
    const hit = byName.get(n.toLowerCase());
    if (hit) tagIds.push(hit.id);
    else missing.push(n);
  }
  if (missing.length) {
    console.log(`⚠️  这些标签不存在，已跳过：${missing.join('、')}`);
    console.log(`    现有标签：${(all?.items || []).map((t) => t.name).join('、')}`);
  }
  if (!tagIds.length) tagIds = undefined;
}

console.log('→ 提交中…');
const result = await callMcp('create_post', {
  title: flags.title,
  content,
  slug,
  excerpt,
  status: flags.draft ? 'draft' : 'published',
  is_public: !flags.private,
  ...(tagIds ? { tag_ids: tagIds } : {})
});

const id = result?.id || result?.post?.id;
console.log('✅ 发布成功');
if (id) console.log(`   文章地址：https://dora.xuguochen.de5.net/posts/${id}`);
console.log('');
console.log('提示：如果用了新标签没生效，去站点「标签」页手动加一下，或复用已有标签。');
