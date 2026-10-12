// bookCover.js 的离线探针：用真实 EPUB / PDF 验证封面与元数据提取，
// 并确认 MOBI / AZW3 已被明确拒绝（本站 2026-10-12 起只支持 EPUB / PDF）。
// 用法：node tests/bookCover.probe.mjs
// 设计：文件不存在时优雅跳过（打印 skip），不报错退出非 0；方便在没有样本的机器上跑。
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extractBookMeta } from '../src/lib/bookCover.js';

// 在目录里按关键词 + 后缀找样本（真实文件名常带一堆后缀，不能写死）
async function findSample(dir, keyword, ext) {
  if (!existsSync(dir)) return null;
  const files = await readdir(dir);
  const hit = files.find((f) => f.toLowerCase().endsWith(ext) && f.includes(keyword));
  return hit ? `${dir}/${hit}` : null;
}

// 把 Node Buffer 包成 ByteSource：只拷贝请求的区间，绝不整本读
const bufferSource = (buf) => ({
  size: buf.length,
  read: async (o, l) => new Uint8Array(buf.subarray(Math.max(0, Math.min(o, buf.length)), Math.max(0, Math.min(o + l, buf.length))))
});

function report(label, meta, extra = '') {
  const coverLen = meta.cover ? meta.cover.length : 0;
  console.log(
    `  ${label}: format=${meta.format} title=${JSON.stringify(meta.title)} ` +
    `author=${JSON.stringify(meta.author)} cover=${coverLen}B mime=${meta.coverMime}${extra}`
  );
}

// 按实际 MIME 决定扩展名，避免把 GIF 存成 .jpg 造成误判
const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };
async function saveCover(meta, basePath) {
  if (!meta.cover) return;
  const ext = EXT_BY_MIME[meta.coverMime] || 'bin';
  const path = `${basePath}.${ext}`;
  await writeFile(path, meta.cover);
  console.log(`  -> 封面已写入 ${path}（${meta.cover.length}B, ${meta.coverMime}）`);
}

async function probeFile(path) {
  if (!existsSync(path)) {
    console.log(`skip（文件不存在）: ${path}`);
    return null;
  }
  const buf = await readFile(path);
  console.log(`\n=== ${path}（${(buf.length / 1024 / 1024).toFixed(1)} MB）`);
  const t0 = Date.now();
  const meta = await extractBookMeta(bufferSource(buf));
  const cost = Date.now() - t0;
  report('结果', meta, ` 耗时=${cost}ms`);
  return meta;
}

// 合成最小 PalmDB（MOBI / AZW3 的容器）：只用来验证这两种格式已被拒绝，
// 不再验证封面提取 —— 本站 2026-10-12 起只支持 EPUB / PDF。
function buildSyntheticPalmDb({ azw3 = false } = {}) {
  const enc = new TextEncoder();
  const palmdoc = new Uint8Array(16);
  const mobi = new Uint8Array(232);
  mobi.set(enc.encode('MOBI'), 0);
  const mdv = new DataView(mobi.buffer);
  mdv.setUint32(0x14 - 16, mobi.length);   // MOBI header 长度
  mdv.setUint32(0x1c - 16, 65001);         // text encoding = UTF-8
  mdv.setUint32(0x24 - 16, azw3 ? 8 : 6);  // version：6=MOBI，8=AZW3/KF8

  const record0 = new Uint8Array(palmdoc.length + mobi.length);
  record0.set(palmdoc, 0);
  record0.set(mobi, palmdoc.length);

  const records = [record0];
  const headerSize = 78 + records.length * 8;
  const total = headerSize + records.reduce((n, r) => n + r.length, 0);
  const out = new Uint8Array(total);
  const odv = new DataView(out.buffer);
  out.set(enc.encode('BOOKMOBI'), 60);
  odv.setUint16(76, records.length);
  let cursor = headerSize;
  records.forEach((rec, i) => {
    odv.setUint32(78 + i * 8, cursor);
    out.set(rec, cursor);
    cursor += rec.length;
  });
  return out;
}

async function main() {
  console.log('--- 真实文件 ---');
  const epub1 = await probeFile('/mnt/d/books/books2/盗墓笔记（全集）.epub');
  if (epub1) await saveCover(epub1, '/tmp/cover-epub-daomu');
  const epub2 = await probeFile('/mnt/d/books/books2/三体 （典藏版·三册）.epub');
  if (epub2) await saveCover(epub2, '/tmp/cover-epub-santi');
  const pdf1 = await probeFile('/mnt/d/books/图解微积分.pdf');
  if (pdf1) await saveCover(pdf1, '/tmp/cover-pdf');

  // 真实 PDF（文件名带一长串站点后缀，用关键词匹配）
  const realPdf = await findSample('/mnt/d/books', '图解微积分', '.pdf');
  if (realPdf) {
    const meta = await probeFile(realPdf);
    if (meta) await saveCover(meta, '/tmp/cover-realpdf');
  }

  console.log('\n--- MOBI / AZW3 应被拒绝（本站只支持 EPUB / PDF）---');
  let rejectFail = 0;
  for (const [label, buf] of [
    ['mobi ', buildSyntheticPalmDb({ azw3: false })],
    ['azw3 ', buildSyntheticPalmDb({ azw3: true })]
  ]) {
    const meta = await extractBookMeta(bufferSource(buf));
    const okReject = meta.format === null;
    if (!okReject) rejectFail += 1;
    report(label, meta, okReject ? '  ✅ 已拒绝（format=null）' : '  ❌ 不应被接受');
  }
  if (rejectFail) {
    console.error(`\n❌ ${rejectFail} 个 MOBI/AZW3 样本未被拒绝`);
    process.exitCode = 1;
  }

  console.log('\n--- 大文件内存检查（80MB EPUB）---');
  const bigPath = '/mnt/d/books/books2/三体 （典藏版·三册）.epub';
  if (!existsSync(bigPath)) {
    console.log('skip（文件不存在）');
  } else {
    const buf = await readFile(bigPath);
    const before = process.memoryUsage().heapUsed;
    let peak = before;
    const src = {
      size: buf.length,
      read: async (o, l) => {
        const out = new Uint8Array(buf.subarray(Math.max(0, Math.min(o, buf.length)), Math.max(0, Math.min(o + l, buf.length))));
        const now = process.memoryUsage().heapUsed;
        if (now > peak) peak = now;
        return out;
      }
    };
    const meta = await extractBookMeta(src);
    const delta = (peak - before) / 1024 / 1024;
    console.log(`  format=${meta.format} cover=${meta.cover ? meta.cover.length : 0}B`);
    console.log(`  heapUsed 峰值增量 ≈ ${delta.toFixed(1)} MB（文件本身 ${(buf.length / 1024 / 1024).toFixed(1)} MB）`);
  }
  console.log('\n探针结束。');
}

main().catch((err) => {
  console.error('探针异常：', err);
  process.exitCode = 1;
});
