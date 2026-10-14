// 极简静态服务器（零依赖）：给本地构建产物做 SPA 回退，供界面探针使用。
// 只监听 127.0.0.1，只读，不做任何写操作。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const ROOT = process.argv[2] || 'dist';
const PORT = Number(process.argv[3] || 5173);
// 可选：给所有响应加 CSP（用线上 `_headers` 里那条），用于验证「子站/图鉴在
// 真实 CSP 下还能不能跑」。默认不加，避免影响其它探针。
const CSP = process.env.PROBE_CSP || '';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json'
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  let rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  if (rel === '/' || rel === '\\') rel = '/index.html';
  const file = join(ROOT, rel);
  try {
    const buf = await readFile(file);
    const h = { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' };
    if (CSP) h['Content-Security-Policy'] = CSP;
    res.writeHead(200, h);
    res.end(buf);
  } catch {
    // 目录请求（如 /math/）→ 取目录下的 index.html。
    // Cloudflare Pages 对静态目录本来就这么处理（优先真实文件，再回退 SPA），
    // 本地探针服务器必须对齐，否则 /math/ 会被下面的 SPA 回退吞成主站首页，
    // 让「子站没渲染」看起来像 bug。
    try {
      const idx = join(file, 'index.html');
      const buf = await readFile(idx);
      const h2 = { 'Content-Type': 'text/html; charset=utf-8' };
      if (CSP) h2['Content-Security-Policy'] = CSP;
      res.writeHead(200, h2);
      res.end(buf);
      return;
    } catch { /* 不是目录，继续走 SPA 回退 */ }
    try {
      const buf = await readFile(join(ROOT, 'index.html'));
      const h3 = { 'Content-Type': 'text/html; charset=utf-8' };
      if (CSP) h3['Content-Security-Policy'] = CSP;
      res.writeHead(200, h3);
      res.end(buf);
    } catch {
      res.writeHead(404); res.end('not found');
    }
  }
}).listen(PORT, '127.0.0.1', () => console.log(`spa-server on http://127.0.0.1:${PORT}`));
