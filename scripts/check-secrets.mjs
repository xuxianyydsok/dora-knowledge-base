#!/usr/bin/env node
// 提交前 / CI 凭据扫描器。
//
// 起因：2026-10-08 发现 docs/progress.md 明文写有管理员邮箱与密码，并已随历史公开。
// 本脚本的作用是让「凭据写进仓库」这件事在下一次提交时就被拦住，而不是等到被人发现。
//
// 用法：
//   node scripts/check-secrets.mjs            # 扫描 git 跟踪的所有文本文件
//   node scripts/check-secrets.mjs --staged   # 只扫暂存区（pre-commit 钩子用）
//   node scripts/check-secrets.mjs --history  # 扫描全部提交历史（含「先提交再删除」的旧内容）
//
// 退出码：0 = 通过（可能有 warn）；1 = 命中 error，应阻断提交。
//
// 行内豁免：在命中行末尾加注释 `secret-scan:allow` 即可跳过该行（需写明理由）。

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.bmp',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.pdf', '.zip', '.gz', '.tar', '.7z', '.rar',
  '.mp3', '.mp4', '.webm', '.mov', '.wav', '.flac',
  '.wasm', '.so', '.dll', '.exe', '.node', '.class', '.jar',
]);
const SKIP_FILE = [
  /(^|\/)package-lock\.json$/,
  /(^|\/)(pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$/,
  /(^|\/)(dist|build|coverage|\.vite)\//,
];

// 占位值白名单：出现这些前缀说明是「示意值」而不是真凭据
const PLACEHOLDER = /^\s*(\$|<|\{|your|xxx+|example|placeholder|changeme|redacted|todo|\.\.\.)/i;

// 占位词白名单：整词相等才算示意值（`postgresql://user:pass@…` 这种文档写法不该被拦）
const PLACEHOLDER_WORDS = new Set([
  'password', 'passwd', 'pass', 'pwd', 'secret', 'token', 'key', 'apikey',
  'api-key', 'example', 'placeholder', 'changeme', 'redacted', 'xxx',
  'test', 'demo', 'admin', 'user', 'username', 'yourpassword', 'your-password',
]);

function isPlaceholder(value) {
  if (!value) return false;
  if (PLACEHOLDER.test(value)) return true;
  return PLACEHOLDER_WORDS.has(value.trim().toLowerCase());
}

const RULES = [
  {
    id: 'jwt-literal',
    sev: 'error',
    why: 'JWT 字面量（anon key / access token / service key 都属于此类）',
    re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  },
  {
    id: 'github-token',
    sev: 'error',
    why: 'GitHub 个人访问令牌',
    re: /\b(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
  },
  {
    id: 'openai-style-key',
    sev: 'error',
    why: 'sk- 开头的模型 / 服务密钥',
    re: /\bsk-[A-Za-z0-9]{32,}\b/g,
  },
  {
    id: 'aws-access-key',
    sev: 'error',
    why: 'AWS Access Key ID',
    re: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    id: 'private-key-block',
    sev: 'error',
    why: '私钥文件内容',
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  },
  {
    id: 'inline-password',
    sev: 'error',
    why: '键值形式的明文密码',
    re: /["']?(password|passwd|pwd)["']?\s*[:=]\s*["']([^"']{6,})["']/gi,
    valueGroup: 2,
  },
  {
    id: 'db-url-with-password',
    sev: 'error',
    why: '连接串内联明文密码',
    re: /postgres(?:ql)?:\/\/[^\s:@/]+:([^\s@/]{4,})@/g,
    valueGroup: 1,
  },
  {
    id: 'personal-email',
    sev: 'warn',
    why: '个人邮箱（历史上就是从这里泄漏的）',
    re: /\b[A-Za-z0-9._%+-]+@(gmail|qq|163|126|outlook|hotmail|icloud|foxmail|yeah|sina)\.(com|cn)\b/gi,
  },
  {
    id: 'cloudflare-account-id',
    sev: 'warn',
    why: 'Cloudflare Account ID / Zone ID（32 位十六进制）',
    re: /\b[0-9a-f]{32}\b/g,
  },
];

const SKIP_LINE = /secret-scan:allow|process\.env|import\.meta\.env/;

function sh(args, raw) {
  return execFileSync('git', args, {
    encoding: raw ? 'buffer' : 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mask(s) {
  if (s.length <= 8) return '*'.repeat(s.length);
  return `${s.slice(0, 4)}${'*'.repeat(Math.min(s.length - 8, 24))}${s.slice(-4)}`;
}

function scanText(text, meta) {
  const out = [];
  const lines = text.split('\n');
  for (const rule of RULES) {
    const re = new RegExp(rule.re.source, rule.re.flags);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (SKIP_LINE.test(line)) continue;
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line)) !== null) {
        const raw = m[0];
        const value = rule.valueGroup ? m[rule.valueGroup] : null;
        if (!isPlaceholder(value)) {
          out.push({
            ...meta,
            line: meta.line == null ? null : i + 1,
            rule: rule.id,
            sev: rule.sev,
            why: rule.why,
            snippet: line.trim().slice(0, 160)
              .replace(new RegExp(escapeRe(raw), 'g'), mask(raw)),
          });
        }
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    }
  }
  return out;
}

function filesToScan(stagedOnly) {
  const args = stagedOnly
    ? ['diff', '--cached', '--name-only', '--diff-filter=ACM']
    : ['ls-files'];
  return sh(args).split('\n').map((s) => s.trim()).filter(Boolean);
}

function textOf(rel, stagedOnly) {
  if (stagedOnly) {
    try { return sh(['show', `:${rel}`]); } catch { return null; }
  }
  if (!existsSync(rel)) return null;
  return readFileSync(rel, 'utf8');
}

function workingTreeScan(stagedOnly) {
  const files = filesToScan(stagedOnly).filter((rel) => {
    if (BINARY_EXT.has(path.extname(rel).toLowerCase())) return false;
    return !SKIP_FILE.some((re) => re.test(rel));
  });
  const findings = [];
  for (const rel of files) {
    const src = textOf(rel, stagedOnly);
    if (src == null || src.includes('\u0000')) continue;
    findings.push(...scanText(src, { rel }));
  }
  return { count: files.length, findings };
}

function historyScan() {
  const text = sh(['log', '--all', '-p', '--no-color', '-U0']);
  const commits = sh(['rev-list', '--all', '--count']).trim();
  // 提交标题出现在 patch 的 "commit <sha>" 行之后，仅用于给出上下文
  const findings = scanText(text, { rel: '(历史 patch)' });
  return { count: Number(commits) || 0, findings };
}

function main() {
  const stagedOnly = process.argv.includes('--staged');
  const history = process.argv.includes('--history');

  const res = history ? historyScan() : workingTreeScan(stagedOnly);
  const scope = history ? `${res.count} 个提交的改动` : `${res.count} 个文件`;

  const errors = res.findings.filter((f) => f.sev === 'error');
  const warns = res.findings.filter((f) => f.sev === 'warn');

  console.log(`凭据扫描 —— ${scope}`);
  for (const [label, list] of [['错误', errors], ['警告', warns]]) {
    if (!list.length) continue;
    console.log(`\n${label}级命中 ${list.length} 处：`);
    for (const f of list) {
      const loc = f.line == null ? f.rel : `${f.rel}:${f.line}`;
      console.log(`  [${f.rule}] ${loc}  (${f.why})`);
      console.log(`      ${f.snippet}`);
    }
  }

  console.log();
  if (errors.length) {
    console.log(`✗ 发现 ${errors.length} 处必须修复的凭据泄漏。`);
    console.log('  修法：改为环境变量引用（如 $ADMIN_PASSWORD），或从文档中移除取值。');
    console.log('  确属误报请在行尾加 `secret-scan:allow` 并注明理由。');
    process.exit(1);
  }
  console.log(`✓ 未发现必须修复的凭据泄漏${warns.length ? `（${warns.length} 处警告，请人工确认）` : ''}。`);
  process.exit(0);
}

main();
