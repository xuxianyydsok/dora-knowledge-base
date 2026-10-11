// 极简静态服务器（零依赖）：给本地构建产物做 SPA 回退，供界面探针使用。
// 只监听 127.0.0.1，只读，不做任何写操作。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const ROOT = process.argv[2] || 'dist';
const PORT = Number(process.argv[3] || 5173);

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
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(buf);
  } catch {
    try {
      const buf = await readFile(join(ROOT, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(buf);
    } catch {
      res.writeHead(404); res.end('not found');
    }
  }
}).listen(PORT, '127.0.0.1', () => console.log(`spa-server on http://127.0.0.1:${PORT}`));
