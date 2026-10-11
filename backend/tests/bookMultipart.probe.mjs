// bookType.js 里「分片上传」相关纯逻辑的离线探针。
// 用法：node tests/bookMultipart.probe.mjs
//
// 覆盖三块（都不依赖 Worker 运行时，Node 里就能跑）：
//   1. ticket 签名 / 验签：正确性、防篡改、过期、用户不匹配；
//   2. 片长校验 checkPartSize：除最后一片外必须 ≥ 5MiB；
//   3. 分片清单 normalizeCompletedParts：排序 / 去重 / 连续性 / 与创建时片数一致。
import assert from 'node:assert/strict';
import {
  signBookTicket, verifyBookTicket,
  checkPartSize, planPartCount, normalizeCompletedParts,
  MULTIPART_PART_BYTES, MULTIPART_MIN_PART_BYTES, MULTIPART_TICKET_TTL_MS,
  MAX_BOOK_BYTES, MAX_MULTIPART_BOOK_BYTES,
  isWithinBookLimit, isWithinMultipartBookLimit
} from '../src/lib/bookType.js';

let passed = 0;
const fails = [];

async function t(name, fn) {
  try {
    const extra = await fn();
    passed++;
    console.log(`  ✓ ${name}${extra ? ` —— ${extra}` : ''}`);
  } catch (err) {
    fails.push(name);
    console.log(`  ✗ ${name}\n      ${err?.message || err}`);
  }
}

const SECRET = 'test-secret-not-a-real-key';
const UID = '11111111-1111-1111-1111-111111111111';
const OTHER_UID = '22222222-2222-2222-2222-222222222222';
const KEY = `books/${UID}/2026/33333333-3333-3333-3333-333333333333.epub`;

async function main() {
  console.log('\n=== ticket 签名 / 验签 ===');

  await t('正常签发 + 验签，能取回 object key', async () => {
    const ticket = await signBookTicket(SECRET, { key: KEY, uid: UID });
    const out = await verifyBookTicket(SECRET, ticket, UID);
    assert.equal(out.key, KEY);
    assert.equal(out.uid, UID);
    return `ticket 长度 ${ticket.length}`;
  });

  await t('ticket 里不含明文 object key', async () => {
    const ticket = await signBookTicket(SECRET, { key: KEY, uid: UID });
    // payload 是 base64url(JSON)，明文 key 不会以可读形式出现
    assert.ok(!ticket.includes(KEY), 'ticket 不该直接包含明文 key');
    assert.ok(!ticket.includes('books/'), 'ticket 不该直接包含 books/ 前缀');
    return '不含 books/ 明文';
  });

  await t('换密钥验签失败（防伪造）', async () => {
    const ticket = await signBookTicket(SECRET, { key: KEY, uid: UID });
    await assert.rejects(() => verifyBookTicket('another-secret', ticket, UID));
  });

  await t('篡改 payload 验签失败', async () => {
    const ticket = await signBookTicket(SECRET, { key: KEY, uid: UID });
    const parts = ticket.split('.');
    // 改掉 payload 里任意一个字符，签名就对不上了
    const payload = parts[1];
    const mutated = payload.slice(0, -1) + (payload.slice(-1) === 'A' ? 'B' : 'A');
    await assert.rejects(() => verifyBookTicket(SECRET, [parts[0], mutated, parts[2]].join('.'), UID));
  });

  await t('换用户验签失败（uid 不匹配）', async () => {
    const ticket = await signBookTicket(SECRET, { key: KEY, uid: UID });
    await assert.rejects(() => verifyBookTicket(SECRET, ticket, OTHER_UID));
  });

  await t('过期 ticket 验签失败', async () => {
    const now = Date.now();
    const ticket = await signBookTicket(SECRET, { key: KEY, uid: UID, exp: now - 1000 }, now);
    await assert.rejects(() => verifyBookTicket(SECRET, ticket, UID, now));
  });

  await t('未过期 ticket 在 TTL 内仍有效', async () => {
    const now = Date.now();
    const ticket = await signBookTicket(SECRET, { key: KEY, uid: UID }, now);
    const out = await verifyBookTicket(SECRET, ticket, UID, now + MULTIPART_TICKET_TTL_MS - 1000);
    assert.equal(out.key, KEY);
    return `TTL ${Math.round(MULTIPART_TICKET_TTL_MS / 3600000)}h`;
  });

  await t('空 / 畸形 ticket 一律失败', async () => {
    await assert.rejects(() => verifyBookTicket(SECRET, '', UID));
    await assert.rejects(() => verifyBookTicket(SECRET, 'garbage', UID));
    await assert.rejects(() => verifyBookTicket(SECRET, 'bkm1.aaa.bbb', UID));
    await assert.rejects(() => verifyBookTicket(SECRET, 'v2.aaa.bbb', UID));
  });

  console.log('\n=== 片长校验（R2 硬规则：除最后一片外 ≥ 5MiB）===');

  await t('中间片等于 8MiB → 通过', () => {
    assert.equal(checkPartSize(MULTIPART_PART_BYTES, 1, 3), null);
    return '8MiB 片长合法';
  });

  await t('中间片刚好 5MiB → 通过（边界）', () => {
    assert.equal(checkPartSize(MULTIPART_MIN_PART_BYTES, 2, 5), null);
  });

  await t('中间片小于 5MiB → 拒绝', () => {
    const msg = checkPartSize(MULTIPART_MIN_PART_BYTES - 1, 2, 5);
    assert.ok(msg && msg.includes('5MB'), `应报片长不足，实际: ${msg}`);
    return msg;
  });

  await t('最后一片可以任意小（甚至 1 字节）', () => {
    assert.equal(checkPartSize(1, 5, 5), null);
    assert.equal(checkPartSize(1234, 3, 3), null);
  });

  await t('片序号越界 / 非法 → 拒绝', () => {
    assert.ok(checkPartSize(MULTIPART_PART_BYTES, 0, 3));
    assert.ok(checkPartSize(MULTIPART_PART_BYTES, 4, 3));
    assert.ok(checkPartSize(MULTIPART_PART_BYTES, 1.5, 3));
    assert.ok(checkPartSize(0, 1, 3));
    assert.ok(checkPartSize(MULTIPART_PART_BYTES, 1, 0));
  });

  console.log('\n=== 片数推导 planPartCount ===');

  await t('按 8MiB 向上取整', () => {
    assert.equal(planPartCount(MULTIPART_PART_BYTES), 1);
    assert.equal(planPartCount(MULTIPART_PART_BYTES + 1), 2);
    assert.equal(planPartCount(MULTIPART_PART_BYTES * 10), 10);
    assert.equal(planPartCount(1), 1);
    return `1GiB → ${planPartCount(1024 * 1024 * 1024)} 片`;
  });

  await t('非法输入返回 0', () => {
    assert.equal(planPartCount(0), 0);
    assert.equal(planPartCount(-1), 0);
    assert.equal(planPartCount(NaN), 0);
    assert.equal(planPartCount(100, 0), 0);
  });

  console.log('\n=== 分片清单 normalizeCompletedParts ===');

  await t('乱序输入 → 按 partNumber 升序输出', () => {
    const parts = normalizeCompletedParts([
      { part_number: 3, etag: '"c"' },
      { part_number: 1, etag: '"a"' },
      { part_number: 2, etag: '"b"' }
    ], 3);
    assert.deepEqual(parts.map((p) => p.partNumber), [1, 2, 3]);
    assert.deepEqual(parts.map((p) => p.etag), ['"a"', '"b"', '"c"']);
    return '1,2,3';
  });

  await t('etag 前后空白被裁掉', () => {
    const parts = normalizeCompletedParts([{ part_number: 1, etag: '  "x"  ' }], 1);
    assert.equal(parts[0].etag, '"x"');
  });

  await t('缺片（序号不连续）→ 抛错', () => {
    assert.throws(() => normalizeCompletedParts([
      { part_number: 1, etag: '"a"' },
      { part_number: 3, etag: '"c"' }
    ], 3));
  });

  await t('重复序号 → 抛错', () => {
    assert.throws(() => normalizeCompletedParts([
      { part_number: 1, etag: '"a"' },
      { part_number: 1, etag: '"b"' }
    ]));
  });

  await t('与创建时片数不一致 → 抛错', () => {
    assert.throws(() => normalizeCompletedParts([{ part_number: 1, etag: '"a"' }], 2));
  });

  await t('缺少 etag / 非法序号 → 抛错', () => {
    assert.throws(() => normalizeCompletedParts([{ part_number: 1 }], 1));
    assert.throws(() => normalizeCompletedParts([{ part_number: 0, etag: '"a"' }], 1));
    assert.throws(() => normalizeCompletedParts([], 0));
    assert.throws(() => normalizeCompletedParts(null));
  });

  console.log('\n=== 保护上限（不是业务限制）===');

  await t('直传保护上限 400MB：100MB 通过，401MB 拒绝', () => {
    assert.equal(MAX_BOOK_BYTES, 400 * 1024 * 1024);
    assert.ok(isWithinBookLimit(100 * 1024 * 1024), '100MB 应通过（平台会自己 413，代码不拦）');
    assert.ok(isWithinBookLimit(MAX_BOOK_BYTES));
    assert.ok(!isWithinBookLimit(MAX_BOOK_BYTES + 1));
  });

  await t('分片保护上限 5GB：1GB / 4GB 通过，5GB+1 拒绝', () => {
    assert.equal(MAX_MULTIPART_BOOK_BYTES, 5 * 1024 * 1024 * 1024);
    assert.ok(isWithinMultipartBookLimit(1024 * 1024 * 1024));
    assert.ok(isWithinMultipartBookLimit(4 * 1024 * 1024 * 1024));
    assert.ok(isWithinMultipartBookLimit(MAX_MULTIPART_BOOK_BYTES));
    assert.ok(!isWithinMultipartBookLimit(MAX_MULTIPART_BOOK_BYTES + 1));
    assert.ok(!isWithinMultipartBookLimit(0));
  });

  await t('分片上限远高于直传上限（说明分片确实解除了 100MB 约束）', () => {
    assert.ok(MAX_MULTIPART_BOOK_BYTES > MAX_BOOK_BYTES * 10);
    return `${Math.round(MAX_BOOK_BYTES / 1024 / 1024)}MB → ${MAX_MULTIPART_BOOK_BYTES / 1024 / 1024 / 1024}GB`;
  });

  console.log(`\n结果：${passed} 项通过，${fails.length} 项失败`);
  if (fails.length) {
    console.log('失败项：' + fails.join('、'));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('探针异常：', err);
  process.exitCode = 1;
});
