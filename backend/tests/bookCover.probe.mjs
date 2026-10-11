// bookCover.js 的离线探针：用真实电子书 + 合成 MOBI 验证封面 / 元数据提取。
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

// 合成最小 MOBI：PalmDB + record0(PalmDOC+MOBI+EXTH) + 一张 JPEG 记录
function buildSyntheticMobi({ title = 'Synthetic Book', author = 'Test Author', azw3 = false } = {}) {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9]);

  const enc = new TextEncoder();
  const titleBytes = enc.encode(title);
  const authorBytes = enc.encode(author);

  // EXTH：201（cover offset，相对 first image index）+ 100（作者）+ 503（书名）
  const exthRecords = [];
  const pushExth = (type, data) => {
    const len = 8 + data.length;
    const rec = new Uint8Array(len);
    const dv = new DataView(rec.buffer);
    dv.setUint32(0, type);
    dv.setUint32(4, len);
    rec.set(data, 8);
    exthRecords.push(rec);
  };
  const coverOffset = new Uint8Array(4);
  new DataView(coverOffset.buffer).setUint32(0, 0);
  pushExth(201, coverOffset);
  pushExth(100, authorBytes);
  pushExth(503, titleBytes);

  const exthBodyLen = exthRecords.reduce((n, r) => n + r.length, 0);
  const exth = new Uint8Array(12 + exthBodyLen + 4);
  exth.set(enc.encode('EXTH'), 0);
  new DataView(exth.buffer).setUint32(4, exth.length);
  new DataView(exth.buffer).setUint32(8, exthRecords.length);
  let exthPos = 12;
  for (const r of exthRecords) { exth.set(r, exthPos); exthPos += r.length; }

  const palmdoc = new Uint8Array(16);
  const mobi = new Uint8Array(232);
  mobi.set(enc.encode('MOBI'), 0);
  const mdv = new DataView(mobi.buffer);
  // 解析器读的是「相对记录 0 起点」的偏移，MOBI 签名在记录 0 偏移 16，
  // 所以这里写 mobi 数组时要减去 16。
  mdv.setUint32(0x14 - 16, mobi.length);   // MOBI header 长度
  mdv.setUint32(0x1c - 16, 65001);         // text encoding = UTF-8
  mdv.setUint32(0x24 - 16, azw3 ? 8 : 6);  // version：6=MOBI，8=AZW3/KF8
  mdv.setUint32(0x6c - 16, 1);             // first image index = 记录 1
  mdv.setUint32(0x80 - 16, 0x40);          // EXTH flags：bit 0x40 置位

  const headerPart = new Uint8Array(palmdoc.length + mobi.length + exth.length);
  headerPart.set(palmdoc, 0);
  headerPart.set(mobi, palmdoc.length);
  headerPart.set(exth, palmdoc.length + mobi.length);

  // full name 放在记录 0 尾部（UTF-8 + NUL），回填 offset/length
  const record0 = new Uint8Array(headerPart.length + titleBytes.length + 1);
  record0.set(headerPart, 0);
  record0.set(titleBytes, headerPart.length);
  new DataView(record0.buffer).setUint32(0x54, headerPart.length);
  new DataView(record0.buffer).setUint32(0x58, titleBytes.length + 1);

  const records = [record0, jpeg];
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

  // 真实 PDF / MOBI（文件名带一长串站点后缀，用关键词匹配）
  const realPdf = await findSample('/mnt/d/books', '图解微积分', '.pdf');
  if (realPdf) {
    const meta = await probeFile(realPdf);
    if (meta) await saveCover(meta, '/tmp/cover-realpdf');
  }
  const realMobi = await findSample('/mnt/d/books', '理工学霸', '.mobi');
  if (realMobi) {
    const meta = await probeFile(realMobi);
    if (meta) await saveCover(meta, '/tmp/cover-realmobi');
  }

  console.log('\n--- 合成 MOBI / AZW3 ---');
  const mobiMeta = await extractBookMeta(bufferSource(buildSyntheticMobi({ title: '合成测试书', author: '测试作者' })));
  report('mobi ', mobiMeta);
  const azw3Meta = await extractBookMeta(bufferSource(buildSyntheticMobi({ title: '合成 AZW3', author: '测试作者', azw3: true })));
  report('azw3 ', azw3Meta);

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
