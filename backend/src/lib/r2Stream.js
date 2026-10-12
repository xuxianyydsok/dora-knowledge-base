// R2 流式上传 / 读取的小工具（纯函数 + 少量 IO，供 books / music 上传共用）
//
// 为什么单独抽出来：
//   books.js 里已经有一套「不把文件读进内存」的上传实现（request.body 原样灌进 R2），
//   音乐上传需要**完全同一套**逻辑。复制一份会立刻漂移（一处修了 bug 另一处没修），
//   因此抽成公共模块，两边都从这里 import。
//
// 核心约束：Workers 内存上限 128MB，而音频/电子书可能几十上百 MB。
//   `request.formData()` 会把整个文件读进内存 → 直接爆掉。
//   因此大文件上传一律走**原始请求体直传**：
//     请求体 = 文件字节（Content-Type: application/octet-stream）
//     文件名等元信息走自定义请求头（encodeURIComponent 编码）

import { HttpError } from './response.js';

// 从请求体里先读出前 N 字节（用于魔数嗅探），并把「已读的字节 + 剩余流」重新拼成
// 一个可继续消费的 ReadableStream。全程只缓冲前 N 字节，不会把整个文件读进内存。
export async function takeHeadAndRest(request, headSize) {
  if (!request.body) throw new HttpError(422, '缺少请求体（应直接把文件字节作为 body 发送）');
  const reader = request.body.getReader();
  const chunks = [];
  let buffered = 0;
  let done = false;

  while (buffered < headSize && !done) {
    const next = await reader.read();
    done = next.done;
    if (done) break;
    if (!next.value?.byteLength) continue;
    chunks.push(next.value);
    buffered += next.value.byteLength;
  }

  const head = new Uint8Array(buffered);
  let at = 0;
  for (const c of chunks) { head.set(c, at); at += c.byteLength; }

  // 剩余流：先把已读块原样吐出，再继续泵原始 reader
  let index = 0;
  const rest = new ReadableStream({
    async pull(controller) {
      if (index < chunks.length) { controller.enqueue(chunks[index++]); return; }
      if (done) { controller.close(); return; }
      const next = await reader.read();
      if (next.done) { done = true; controller.close(); return; }
      controller.enqueue(next.value);
    },
    cancel(reason) { return reader.cancel(reason); }
  });

  return { head, rest };
}

// 带字节数上限的流包装：超过上限立刻报错，避免「Content-Length 缺失时无限写 R2」
export function limitStream(stream, maxBytes, onTooLarge) {
  let total = 0;
  return stream.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      total += chunk.byteLength;
      if (total > maxBytes) { controller.error(onTooLarge()); return; }
      controller.enqueue(chunk);
    }
  }));
}

// R2 的 put 要求流**长度已知**，否则运行时会报错（或退化成整段缓冲，反而更耗内存）。
// Workers 为此提供了全局 FixedLengthStream：把它包在流上就声明了总长度。
// 之所以要判 typeof：本文件也要能在 Node 里被单测 import，而 Node 没有这个全局。
export function withKnownLength(stream, length) {
  const FL = globalThis.FixedLengthStream;
  if (typeof FL !== 'function' || !Number.isFinite(length) || length <= 0) return stream;
  try {
    return stream.pipeThrough(new FL(length));
  } catch {
    // 长度声明失败不致命：退回原流，让 R2 自己决定怎么处理
    return stream;
  }
}

// 把 R2 对象包装成「随机读取字节源」（bookCover.js / audioMeta.js 需要按偏移读）。
// 这是处理大文件的关键：抽封面只按需读几段，从不整本读。
export function r2ByteSource(env, objectKey, size) {
  return {
    size,
    async read(offset, length) {
      const start = Math.max(0, Math.min(offset, size));
      const end = Math.max(start, Math.min(offset + length, size));
      if (end <= start) return new Uint8Array(0);
      const object = await env.R2_BUCKET.get(objectKey, { range: { offset: start, length: end - start } });
      if (!object) return new Uint8Array(0);
      return new Uint8Array(await object.arrayBuffer());
    }
  };
}

// 统一的 R2 字节响应（支持 Range，带 CORS）。
// 与 books.js 的 serveObject 同一套语义：默认 inline，?download=1 时 attachment。
export async function serveR2Object(request, env, objectKey, {
  mime, filename = null, immutable = true, fallbackEtag = '', forceDownload = false, corsHeaders
}) {
  const rangeHeader = request.headers.get('Range');
  let range;
  if (rangeHeader) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (m) {
      const hasStart = m[1] !== '';
      const hasEnd = m[2] !== '';
      if (hasStart) {
        const start = Number(m[1]);
        range = hasEnd ? { offset: start, length: Number(m[2]) - start + 1 } : { offset: start };
      } else if (hasEnd) {
        const head = await env.R2_BUCKET.head(objectKey);
        const size = Number(head?.size) || 0;
        const n = Number(m[2]);
        range = { offset: Math.max(0, size - n), length: n };
      }
    }
  }

  const object = await env.R2_BUCKET.get(objectKey, range ? { range } : undefined);
  if (!object) throw new HttpError(404, '文件缺失');

  const headers = {
    ...(corsHeaders ? corsHeaders(request, env) : {}),
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
    ETag: object.httpEtag || fallbackEtag || '"unknown"',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=60',
    'X-Content-Type-Options': 'nosniff'
  };
  if (filename) {
    // 跨域场景下 <a download> 会被浏览器忽略，所以下载必须由后端用
    // Content-Disposition 决定，不能只靠前端的 download 属性。
    const kind = forceDownload ? 'attachment' : 'inline';
    headers['Content-Disposition'] = `${kind}; filename*=UTF-8''${encodeURIComponent(filename)}`;
  }

  const r = object.range;
  if (r && typeof r.offset === 'number' && typeof r.length === 'number') {
    const size = Number(object.size) || 0;
    headers['Content-Range'] = `bytes ${r.offset}-${r.offset + r.length - 1}/${size}`;
    headers['Content-Length'] = String(r.length);
    return new Response(object.body, { status: 206, headers });
  }

  if (object.size != null) headers['Content-Length'] = String(object.size);
  return new Response(object.body, { status: 200, headers });
}
