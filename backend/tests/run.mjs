// 全站页面测试套件（backend/tests/run.mjs）
// 用法：cd backend && node tests/run.mjs [--live-only|--unit-only]
//
// 三层设计：
//   UNIT     纯函数离线用例 —— 解析器、相关度、打分（确定性，必须全过）
//   CONTRACT 页面 ↔ 接口契约 —— 每个 routes/*.jsx 用到的 api.* 方法必须存在；
//            api.js 里每个请求路径必须能在后端 router.js 找到（方法+路径都匹配）。
//            这一层直接覆盖「每一个页面」，防的是前后端版本漂移
//            （2026-10-07 生产事故的同类：新前端调旧后端不存在的路由）。
//   LIVE     真实网络 —— 影视/音乐搜索的实际命中数、相关度、延迟、源可用率。
//            第三方源本身会抖动，断言阈值写得比实测低一档，但仍能抓住
//            「搜不出来 / 结果很少 / 正片被衍生剧压下去」这三类用户痛点回归。
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import * as maccms from '../src/lib/maccms.js';
import * as fetchers from '../src/lib/fetchers.js';
import * as imageType from '../src/lib/imageType.js';
import * as sourceHealth from '../src/lib/sourceHealth.js';
import * as publicScope from '../src/lib/publicScope.js';
import * as mediaUrl from '../src/lib/mediaUrl.js';
import * as movies from '../src/routes/movies.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const BACKEND = join(HERE, '..');
const FRONTEND_SRC = join(BACKEND, '..', 'frontend', 'src');

const args = process.argv.slice(2);
const ONLY = args.includes('--live-only') ? 'live' : args.includes('--unit-only') ? 'unit' : null;

const results = [];
let currentSection = '';

function section(name) { currentSection = name; console.log(`\n=== ${name} ===`); }

async function test(name, fn, { page = null } = {}) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ section: currentSection, name, page, ok: true, ms: Date.now() - t0, detail });
    console.log(`  ✅ ${name}${detail ? ' —— ' + detail : ''} (${Date.now() - t0}ms)`);
  } catch (e) {
    results.push({ section: currentSection, name, page, ok: false, ms: Date.now() - t0, detail: e.message });
    console.log(`  ❌ ${name} —— ${e.message} (${Date.now() - t0}ms)`);
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ---------------------------------------------------------------- UNIT
async function unit() {
  section('UNIT · 解析器与排序（离线确定性）');

  await test('titleRelevance: 庆余年五档分级', async () => {
    const { titleRelevance } = maccms;
    assert(titleRelevance('庆余年', '庆余年') === 0, '完全同名应为 0');
    assert(titleRelevance('庆余年第二季', '庆余年') === 1, '第X季应为 1');
    assert(titleRelevance('庆余年(2024)', '庆余年') === 2, '带年份应为 2');
    assert(titleRelevance('庆余年特别篇', '庆余年') === 3, '其他前缀应为 3');
    assert(titleRelevance('新庆余年传奇', '庆余年') === 4, '包含应为 4');
    assert(titleRelevance('觉醒年代', '庆余年') === 5, '不相关应为 5');
    return '6 个断言全过';
  });

  await test('parsePlayUrls: $$$ 分组 + # 分集 + $名值分离', async () => {
    // 返回结构是「按播放源分组的剧集数组」：[[{name,url},...],[{name,url},...]]
    const groups = maccms.parsePlayUrls(
      '第01集$https://a.com/1.m3u8#第02集$https://a.com/2.m3u8$$$HD$https://b.com/hd.m3u8'
    );
    assert(Array.isArray(groups) && groups.length === 2, `应解析出 2 个播放源分组，实得 ${groups?.length}`);
    assert(groups[0].length === 2 && groups[0][0].name === '第01集' && groups[0][1].url === 'https://a.com/2.m3u8',
      `第一组剧集解析错误: ${JSON.stringify(groups[0])}`);
    assert(groups[1].length === 1 && groups[1][0].name === 'HD', `第二组解析错误: ${JSON.stringify(groups[1])}`);
    return `${groups.length} 源 / ${groups.flat().length} 集`;
  });

  await test('parseVideoUrl: B 站 BV / av 与 YouTube（垃圾链接抛 422）', async () => {
    assert(fetchers.parseVideoUrl('https://www.bilibili.com/video/BV1xx411c7mD')?.id === 'BV1xx411c7mD', 'BV 号解析失败');
    assert(fetchers.parseVideoUrl('https://www.bilibili.com/video/av170001')?.id === '170001', 'av 号解析失败');
    assert(fetchers.parseVideoUrl('https://youtu.be/dQw4w9WgXcQ')?.id === 'dQw4w9WgXcQ', 'youtu.be 解析失败');
    let threw = false;
    try { fetchers.parseVideoUrl('https://example.com/foo'); } catch (e) { threw = e.status === 422; }
    assert(threw, '垃圾 URL 应抛 422 HttpError');
    return '4 个断言全过';
  });

  await test('parseGithubUrl: 返回 {owner, repo}（非 GitHub 抛 422）', async () => {
    const r = fetchers.parseGithubUrl('https://github.com/facebook/react');
    assert(r.owner === 'facebook' && r.repo === 'react', `解析错误: ${JSON.stringify(r)}`);
    const r2 = fetchers.parseGithubUrl('https://github.com/vuejs/core.git');
    assert(r2.repo === 'core', '.git 后缀未剥离');
    let threw = false;
    try { fetchers.parseGithubUrl('https://example.com/not-github'); } catch (e) { threw = e.status === 422; }
    assert(threw, '非 GitHub 应抛 422');
    return '3 个断言全过';
  });

  await test('parseMusicUrl: 当前契约 = 一律 external（注意：0 调用方的死代码）', async () => {
    // ⚠️ 该函数是全后端唯一的「粘贴链接加音乐」桩实现：任何合法 URL 都返回
    // {platform:'external'}，且 routes/ 里没有任何调用方 —— 属死代码。
    // 若未来上线「粘贴网易云链接解析单曲」功能，这里必须改成真正反解 id。
    const m = fetchers.parseMusicUrl('https://music.163.com/song?id=347230');
    assert(m && m.platform === 'external', `契约变更，需重评: ${JSON.stringify(m)}`);
    let threw = false;
    try { fetchers.parseMusicUrl('not-a-url'); } catch (e) { threw = e.status === 422; }
    assert(threw, '非法 URL 应抛 422');
    return '现状已锁定（死代码，0 调用方）';
  });

  await test('mediaTypeOf: jyzy 分类树（1=电视剧 2=电影 17=动漫）不再错标', async () => {
    // 回归：2026-10-07 实测发现 normalizeVod 硬编码 type_id_1 ∈ {2,4} 为剧集，
    // jyzy/hhzy（1=电视剧 2=电影）的剧集被错标成电影。改为按叶子类目名判定。
    const mk = (type_name, type_id_1) => maccms.normalizeVod(
      { vod_name: '测试', vod_play_url: '第01集$https://a.com/1.m3u8', type_name, type_id_1 }, { key: 'jyzy', name: '测试源' }
    ).media_type;
    assert(mk('内地剧', 1) === 'tv', '内地剧应为 tv（jyzy 树 type_id_1=1）');
    assert(mk('剧情片', 2) === 'movie', '剧情片应为 movie（jyzy 树 type_id_1=2）');
    assert(mk('中国动漫', 17) === 'tv', '中国动漫应为 tv');
    assert(mk('动漫电影', 1) === 'movie', '动漫电影应为 movie');
    assert(mk('连续剧', 2) === 'tv', '连续剧应为 tv（标准树）');
    assert(mk('', 4) === 'tv', '无名时回退 type_id_1=4 → tv');
    assert(mk('', 1) === 'movie', '无名时回退 type_id_1=1 → movie');
    return '7 个断言全过';
  });

  await test('normalizeVod: 简介剥离 HTML 与实体解码', async () => {
    // 采集源返回的 vod_content 是富文本，normalizeVod 必须清洗成纯文本简介。
    // （RSS 模块 2026-10-09 已删除，原 stripHtml 用例改测同类的 maccms.normalizeVod。）
    const out = maccms.normalizeVod(
      { vod_name: '测试片', vod_play_url: '正片$https://a.com/1.m3u8', vod_content: '<p>你好<b>世界</b>&amp;大家</p>' },
      { key: 'guangsu', name: '光速资源' }
    );
    assert(typeof out.overview === 'string' && out.overview.includes('你好') && out.overview.includes('世界'),
      `简介清洗失败: ${JSON.stringify(out.overview)}`);
    assert(!/<[^>]+>/.test(out.overview || ''), `简介仍含 HTML 标签: ${out.overview}`);
    return `overview=${out.overview}`;
  });

  // ---- 图片素材：类型嗅探 / 尺寸解析 / 文件名清洗 / object key（纯离线） ----
  // 内嵌真实最小字节（PIL 生成，1x1），不依赖网络与 R2。
  const PNG_1x1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPgEpEDAABoAD1UCKP3AAAAAElFTkSuQmCC',
    'base64'
  );
  const JPEG_1x1 = Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDxGiiitjI//9k=',
    'base64'
  );
  const WEBP_1x1 = Buffer.from(
    'UklGRi4AAABXRUJQVlA4ICIAAABwAQCdASoBAAEAAUAmJZQCdAFAAAD+/DeBV/fU6D4r4AAA',
    'base64'
  );

  await test('sniffImageType: 真实字节头识别 JPEG/PNG/WebP', async () => {
    assert(imageType.sniffImageType(PNG_1x1)?.mime === 'image/png', 'PNG 未识别');
    assert(imageType.sniffImageType(JPEG_1x1)?.mime === 'image/jpeg', 'JPEG 未识别');
    assert(imageType.sniffImageType(WEBP_1x1)?.mime === 'image/webp', 'WebP 未识别');
    return '3 种格式均识别';
  });

  await test('sniffImageType: SVG/GIF/HTML/文本/空字节 → null', async () => {
    assert(imageType.sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')) === null, 'SVG 应被拒');
    assert(imageType.sniffImageType(Buffer.from('GIF89a000000000000')) === null, 'GIF 应被拒');
    assert(imageType.sniffImageType(Buffer.from('<!DOCTYPE html><html></html>')) === null, 'HTML 应被拒');
    assert(imageType.sniffImageType(Buffer.from('hello world plain text')) === null, '纯文本应被拒');
    assert(imageType.sniffImageType(new Uint8Array(0)) === null, '空字节应被拒');
    return '5 个非图片输入全部拒绝';
  });

  await test('resolveImageType: 魔数与声明 MIME 不一致必须拒绝', async () => {
    assert(imageType.resolveImageType(PNG_1x1, 'image/jpeg') === null, 'PNG 字节 + image/jpeg 声明应拒绝');
    assert(imageType.resolveImageType(JPEG_1x1, 'image/png') === null, 'JPEG 字节 + image/png 声明应拒绝');
    assert(imageType.resolveImageType(PNG_1x1, 'image/png')?.mime === 'image/png', '一致的声明应放行');
    assert(imageType.resolveImageType(PNG_1x1, '')?.mime === 'image/png', '空声明应以魔数为准');
    return '3 拒绝 + 2 放行';
  });

  await test('大小上限：MAX_IMAGE_BYTES 边界（不分配 10MB 内存）', async () => {
    const limit = imageType.MAX_IMAGE_BYTES;
    assert(limit === 10 * 1024 * 1024, `上限应为 10MB，实得 ${limit}`);
    assert(imageType.isWithinLimit(limit), '等于上限应通过');
    assert(!imageType.isWithinLimit(limit + 1), '超过上限应拒绝');
    assert(!imageType.isWithinLimit(0), '空文件应拒绝');
    return `limit=${limit}`;
  });

  await test('imageDimensions: 1x1 PNG/JPEG/WebP 解析正确，垃圾字节返回 null 不抛错', async () => {
    assert(JSON.stringify(imageType.imageDimensions(PNG_1x1, 'image/png')) === '{"width":1,"height":1}', 'PNG 尺寸错误');
    assert(JSON.stringify(imageType.imageDimensions(JPEG_1x1, 'image/jpeg')) === '{"width":1,"height":1}', 'JPEG 尺寸错误');
    assert(JSON.stringify(imageType.imageDimensions(WEBP_1x1, 'image/webp')) === '{"width":1,"height":1}', 'WebP 尺寸错误');
    // AVIF 未实现，恒为 null
    assert(imageType.imageDimensions(PNG_1x1, 'image/avif').width === null, 'AVIF 应返回 null');
    // 垃圾字节不得抛错
    const junk = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
    const dim = imageType.imageDimensions(junk, 'image/png');
    assert(dim.width === null && dim.height === null, '垃圾字节应返回 {null,null}');
    return '3 格式正确 + AVIF/垃圾字节安全返回 null';
  });

  await test('sanitizeFilename: 目录穿越/分隔符/超长名被清洗', async () => {
    const cases = ['../../etc/passwd', 'a/b\\c.png', '..\\..\\win.png', '%2e%2e%2fetc%2fpasswd'];
    for (const raw of cases) {
      const out = imageType.sanitizeFilename(raw, 'png');
      assert(!out.includes('/'), `仍含 /: ${out}`);
      assert(!out.includes('\\'), `仍含 \\: ${out}`);
      assert(!out.includes('..'), `仍含 ..: ${out}`);
    }
    const long = imageType.sanitizeFilename('x'.repeat(300) + '.png', 'png');
    assert(long.length <= 120, `超长名未截断: ${long.length}`);
    assert(long.endsWith('.png'), `截断丢失扩展名: ${long}`);
    // 清洗后为空时回退 image.<ext>
    assert(imageType.sanitizeFilename('...', 'webp') === 'image.webp', '空名应回退 image.<ext>');
    return '4 穿越用例 + 超长 + 空名';
  });

  await test('buildObjectKey: assets/<user_id>/<YYYY>/<uuid>.<ext> 且不含用户文件名', async () => {
    const uid = '11111111-2222-3333-4444-555555555555';
    const key = imageType.buildObjectKey(uid, 'png', new Date('2026-10-10T00:00:00Z'));
    assert(key.startsWith('assets/'), `应以 assets/ 开头: ${key}`);
    assert(key.includes(uid), `应包含 user_id: ${key}`);
    assert(/\.png$/.test(key), `应以合法扩展名结尾: ${key}`);
    assert(/assets\/[^/]+\/\d{4}\/[0-9a-f-]{36}\.png$/.test(key), `格式不符: ${key}`);
    assert(!key.includes('passwd') && !key.includes('..'), 'key 不应含用户输入');
    return key;
  });

  await test('decodeBase64: atob 路径正确解码、拒绝非法输入、不破坏二进制', async () => {
    const pngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPgEpEDAABoAD1UCKP3AAAAAElFTkSuQmCC';
    const bytes = imageType.decodeBase64(pngB64);
    assert(bytes instanceof Uint8Array, '应返回 Uint8Array');
    assert([...bytes.slice(0, 8)].join(',') === '137,80,78,71,13,10,26,10', `PNG 魔数不符: ${[...bytes.slice(0, 8)].join(',')}`);

    // data URL 前缀
    const withPrefix = imageType.decodeBase64(`data:image/png;base64,${pngB64}`);
    assert(withPrefix && withPrefix.length === bytes.length && withPrefix[1] === 0x50, 'data URL 前缀解码失败');

    // 含空白字符
    const spaced = imageType.decodeBase64(`${pngB64.slice(0, 8)}\n ${pngB64.slice(8)}`);
    assert(spaced && spaced.length === bytes.length, '空白字符应被忽略');

    // 非法输入 → null
    assert(imageType.decodeBase64('!!!not base64!!!') === null, '非法字符应返回 null');
    assert(imageType.decodeBase64('') === null, '空字符串应返回 null');
    assert(imageType.decodeBase64('abc') === null, '长度不合法应返回 null');
    assert(imageType.decodeBase64(null) === null, '非字符串应返回 null');
    assert(imageType.decodeBase64('data:image/png,abc') === null, '非 base64 data URL 应返回 null');

    // 非 ASCII 字节（JPEG 头 FF D8 FF）不能被 UTF-8 编码破坏
    const jpegHead = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString('base64');
    const jpegBytes = imageType.decodeBase64(jpegHead);
    assert(jpegBytes && jpegBytes[0] === 0xff && jpegBytes[1] === 0xd8 && jpegBytes[2] === 0xff,
      `JPEG 头字节被破坏: ${jpegBytes ? [...jpegBytes].join(',') : null}`);
    return '解码/前缀/空白/非法/二进制 6 组断言全过';
  });

  // ---- 源健康中心：纯离线用例（过滤/排序、单源隔离、缓存、状态判定） ----
  await test('rankSources / isSourceUsable: down 剔除、ok 在 degraded 前、缺失不剔除（冷启动安全）', async () => {
    const { rankSources, isSourceUsable, healthMap } = sourceHealth;
    const sources = [
      { key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }
    ];
    // 健康数据缺失 → 一个都不能少、顺序不变
    assert(rankSources(sources, null).length === 4, '健康数据缺失时不应剔除任何源');
    assert(rankSources(sources, healthMap({ sources: [] })).map((s) => s.key).join('') === 'abcd',
      '空健康 map 不应剔除或改序');

    const map = healthMap({ sources: [
      { key: 'a', status: 'degraded' },
      { key: 'b', status: 'down' },
      { key: 'c', status: 'ok' }
    ] });
    const ranked = rankSources(sources, map).map((s) => s.key);
    assert(!ranked.includes('b'), `down 源应被剔除: ${ranked}`);
    assert(ranked[0] === 'c', `ok 源应排最前: ${ranked}`);
    assert(ranked.join('') === 'cda', `顺序应为 ok → 未知 → degraded: ${ranked}`);

    assert(isSourceUsable({ status: 'ok' }) === true, 'ok 应可用');
    assert(isSourceUsable({ status: 'degraded' }) === true, 'degraded 应可用');
    assert(isSourceUsable({ status: 'down' }) === false, 'down 应不可用');
    assert(isSourceUsable(undefined) === true, '健康缺失应视为可用（冷启动安全）');
    return '4 组断言全过';
  });

  await test('probeEntries: 单源失败/超时被隔离，整体仍返回且失败源标 down 带原因', async () => {
    const { probeEntries } = sourceHealth;
    const entries = [
      { key: 'good', name: '正常源', kind: 'movie', probe: async () => ({ status: 'ok', capabilities: { search: true } }) },
      { key: 'boom', name: '抛错源', kind: 'movie', probe: async () => { throw new Error('模拟连接失败'); } },
      { key: 'slow', name: '超时源', kind: 'movie', timeoutMs: 20, probe: () => new Promise(() => {}) }
    ];
    const out = await probeEntries(entries, { budgetMs: 500, perSourceMs: 200 });
    const byKey = Object.fromEntries(out.map((r) => [r.key, r]));
    assert(out.length === 3, `应返回全部 3 条，实得 ${out.length}`);
    assert(byKey.good.status === 'ok' && byKey.good.ok === true, `正常源应为 ok: ${JSON.stringify(byKey.good)}`);
    assert(byKey.boom.status === 'down' && /模拟连接失败/.test(byKey.boom.error), `抛错源应 down 且带原因: ${JSON.stringify(byKey.boom)}`);
    assert(byKey.slow.status === 'down' && /超时/.test(byKey.slow.error), `超时源应 down 且注明超时: ${JSON.stringify(byKey.slow)}`);
    assert(out.every((r) => typeof r.latency_ms === 'number' && typeof r.checked_at === 'string'),
      '每条记录都应带 latency_ms 与 checked_at');
    return `3 源：${out.map((r) => `${r.key}=${r.status}`).join(', ')}`;
  });

  await test('createHealthStore: TTL 内命中缓存、超 TTL 重探、并发去重只探一次、访客不触发探测', async () => {
    const { createHealthStore } = sourceHealth;
    const store = createHealthStore();
    let clock = 1000;
    let probes = 0;
    const probe = async () => { probes += 1; return [{ key: 'x', status: 'ok' }]; };

    const first = await store.get({ ttl: 100, probe, now: () => clock });
    assert(first.cached === false && probes === 1, `首次应真实探测: probes=${probes}`);
    const second = await store.get({ ttl: 100, probe, now: () => clock });
    assert(second.cached === true && probes === 1, `TTL 内应命中缓存: probes=${probes}`);
    clock += 101;   // 超 TTL
    const third = await store.get({ ttl: 100, probe, now: () => clock });
    assert(third.cached === false && probes === 2, `超 TTL 应重新探测: probes=${probes}`);

    // 并发去重：同一时刻两次调用只探测一次
    const store2 = createHealthStore();
    let slowProbes = 0;
    const slowProbe = () => new Promise((resolve) => setTimeout(() => {
      slowProbes += 1; resolve([{ key: 'y', status: 'ok' }]);
    }, 20));
    await Promise.all([
      store2.get({ ttl: 100, probe: slowProbe, now: () => clock }),
      store2.get({ ttl: 100, probe: slowProbe, now: () => clock })
    ]);
    assert(slowProbes === 1, `并发两次调用只应探测一次: ${slowProbes}`);

    // 访客路径：allowProbe=false 时绝不探测，只读缓存
    const store3 = createHealthStore();
    let guestProbes = 0;
    const guest = await store3.get({
      ttl: 100, allowProbe: false, now: () => clock,
      probe: async () => { guestProbes += 1; return [{ key: 'z', status: 'ok' }]; }
    });
    assert(guestProbes === 0 && guest.empty === true && guest.sources.length === 0,
      `访客缓存为空时不得探测，且应返回 empty: ${JSON.stringify(guest)}`);
    return 'TTL / 并发去重 / 访客不探测 全部通过';
  });

  await test('缓存过期语义: TTL 内访客可读、TTL 后不返回过期数据且零网络、过期 down 不参与过滤、管理员可重探', async () => {
    const { createHealthStore, healthMap, rankSources } = sourceHealth;
    const store = createHealthStore();
    let clock = 1000;
    let probes = 0;
    // 管理员首探：返回一个 down 源（模拟一次瞬时故障）
    const adminProbe = async () => {
      probes += 1;
      return [{ key: 'a', name: 'A源', kind: 'movie', status: 'down', ok: false, error: '模拟故障' }];
    };

    const first = await store.get({ ttl: 100, allowProbe: true, probe: adminProbe, now: () => clock });
    assert(first.cached === false && probes === 1, `管理员首探应真实探测: probes=${probes}`);

    // ① TTL 内访客可读缓存：拿到该结果且 cached === true，不新增探测
    const guestFresh = await store.get({ ttl: 100, allowProbe: false, now: () => clock });
    assert(guestFresh.cached === true && guestFresh.sources.length === 1
      && guestFresh.sources[0].status === 'down' && probes === 1,
      `TTL 内访客应读到缓存且不探测: ${JSON.stringify(guestFresh)} probes=${probes}`);

    // ② TTL 后访客：零网络 + 不返回过期数据
    clock += 101;
    const guestStale = await store.get({ ttl: 100, allowProbe: false, now: () => clock });
    assert(guestStale.sources.length === 0 && guestStale.empty === true && guestStale.stale === true,
      `TTL 后访客应返回空 + stale: ${JSON.stringify(guestStale)}`);
    assert(guestStale.cached === false, `过期不是有效缓存命中，cached 应为 false: ${guestStale.cached}`);
    assert(guestStale.stale_at === first.at, `stale_at 应等于过期缓存的探测时间: ${guestStale.stale_at} vs ${first.at}`);
    assert(probes === 1, `访客路径不得新增探测: probes=${probes}`);

    // ③ 过期 down 不参与过滤：把访客拿到的空结果喂给 rankSources，所有源必须保留
    const sources = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];
    const ranked = rankSources(sources, healthMap({ sources: guestStale.sources }));
    assert(ranked.length === 3 && ranked.map((s) => s.key).join('') === 'abc',
      `过期 down 不得剔除源，应全量保留且不改序: ${ranked.map((s) => s.key)}`);

    // ④ 随后管理员可重探：覆盖缓存、拿到新结果、cached === false
    const adminAgain = await store.get({
      ttl: 100, allowProbe: true, now: () => clock,
      probe: async () => {
        probes += 1;
        return [{ key: 'a', name: 'A源', kind: 'movie', status: 'ok', ok: true }];
      }
    });
    assert(probes === 2 && adminAgain.cached === false && adminAgain.sources[0].status === 'ok',
      `管理员应能重探并覆盖缓存: probes=${probes} ${JSON.stringify(adminAgain.sources)}`);
    return 'TTL内读缓存 / 过期零网络不返回过期 / 过期 down 不参与过滤 / 管理员重探 全部通过';
  });

  await test('状态判定: 试听源永不 ok、不声明无损；影视详情失败为 degraded', async () => {
    const { judgeMusicProbe, judgeMovieProbe } = sourceHealth;
    const trial = judgeMusicProbe({ trialOnly: true, resultCount: 3, hasPlayableUrl: true });
    assert(trial.status !== 'ok', `试听源不得为 ok: ${trial.status}`);
    assert(trial.capabilities.play === false, '试听源不得声明 play');
    assert(trial.capabilities.trial_only === true, '试听源应标记 trial_only');
    assert(!/无损|高音质|HiFi/i.test(JSON.stringify(trial)), '试听源不得宣称无损/高音质');
    assert(/试听/.test(trial.notes || ''), `试听源应注明试听: ${trial.notes}`);

    const empty = judgeMusicProbe({ resultCount: 0 });
    assert(empty.status === 'degraded' && empty.capabilities.play === false, '空结果应为 degraded 且不声明 play');

    const full = judgeMusicProbe({ resultCount: 5, hasPlayableUrl: true });
    assert(full.status === 'ok' && full.capabilities.play === true, '完整曲目源应为 ok 且声明 play');

    const detailFail = judgeMovieProbe({ searchCount: 5, detailOk: false, detailError: '详情超时' });
    assert(detailFail.status === 'degraded' && detailFail.capabilities.search === true,
      `搜索成功但详情失败应为 degraded: ${JSON.stringify(detailFail)}`);
    // 搜索空结果：status 仍为 degraded，但 capabilities.search 必须为 false（不得与 error 文案矛盾）
    const emptySearch = judgeMovieProbe({ searchCount: 0 });
    assert(emptySearch.status === 'degraded', `搜索空结果应为 degraded: ${emptySearch.status}`);
    assert(emptySearch.capabilities.search === false,
      `搜索空结果时 capabilities.search 应为 false: ${JSON.stringify(emptySearch)}`);
    const movieOk = judgeMovieProbe({ searchCount: 5, detailOk: true, hasPlayableUrl: true });
    assert(movieOk.status === 'ok' && movieOk.capabilities.play === true, '影视搜索+详情+可播放应为 ok');
    return '试听/空/完整/详情失败/空结果能力 5 组断言全过';
  });

  // ---- 公开读边界（三层权限：公开访客 / 登录用户 / 管理员） ----
  section('UNIT · 公开读边界（访客白名单与过滤）');

  await test('访客 GET 白名单：公开只读接口放行、个人接口拒绝', async () => {
    const { isGuestAllowed } = publicScope;
    const allowedGet = [
      '/api/posts', '/api/posts/123e4567-e89b-12d3-a456-426614174000', '/api/search', '/api/graph',
      '/api/categories', '/api/tags', '/api/videos', '/api/github', '/api/music', '/api/movies'
    ];
    for (const p of allowedGet) assert(isGuestAllowed('GET', p), `访客应可读 ${p}`);
    const deniedGet = [
      '/api/favorites', '/api/posts/123/progress', '/api/notifications', '/api/notifications/count',
      '/api/preferences', '/api/backup/export', '/api/admin/users', '/api/me', '/api/mcp/tools'
    ];
    for (const p of deniedGet) assert(!isGuestAllowed('GET', p), `访客不应读 ${p}`);
    return `放行 ${allowedGet.length} 条 / 拒绝 ${deniedGet.length} 条`;
  });

  await test('访客 POST：仅只读检索放行，analyze 与写操作拒绝', async () => {
    const { isGuestAllowed } = publicScope;
    for (const p of ['/api/movies/search', '/api/movies/source-detail', '/api/music/search', '/api/music/lyrics', '/api/music/stream']) {
      assert(isGuestAllowed('POST', p), `访客应可 POST ${p}`);
    }
    for (const p of ['/api/github/analyze', '/api/posts', '/api/favorites', '/api/tags', '/api/movies']) {
      assert(!isGuestAllowed('POST', p), `访客不应 POST ${p}`);
    }
    assert(!isGuestAllowed('PATCH', '/api/posts/1'), '访客不应 PATCH');
    assert(!isGuestAllowed('DELETE', '/api/favorites/1'), '访客不应 DELETE');
    return '只读检索 5 条放行；analyze/写操作全拒绝';
  });

  await test('访客过滤构造：博客须 published+public、资源须 public', async () => {
    const pf = publicScope.guestPostFilters();
    assert(pf.status === 'eq.published', `posts.status 应为 eq.published: ${pf.status}`);
    assert(pf.is_public === 'eq.true', `posts.is_public 应为 eq.true: ${pf.is_public}`);
    const rf = publicScope.guestResourceFilters();
    assert(rf.is_public === 'eq.true', `resources.is_public 应为 eq.true: ${rf.is_public}`);
    return `posts=${JSON.stringify(pf)} resources=${JSON.stringify(rf)}`;
  });

  await test('all=true 不能绕过：访客恒 false，仅管理员生效', async () => {
    const { canUseAll } = publicScope;
    assert(canUseAll({ isAdmin: false, isGuest: true }, true) === false, '访客传 all=true 也必须为 false');
    assert(canUseAll({ isAdmin: false }, true) === false, '普通用户传 all=true 也必须为 false');
    assert(canUseAll({ isAdmin: true }, true) === true, '管理员传 all=true 应为 true');
    assert(canUseAll({ isAdmin: true }, false) === false, '管理员不传 all 应为 false');
    assert(canUseAll(null, true) === false, '无用户上下文应为 false');
    return '访客/普通用户无法用 all 越权，管理员按显式参数生效';
  });

  await test('单条可见性：草稿或私密一律不可见', async () => {
    const { isPostVisibleToGuest, isResourceVisibleToGuest } = publicScope;
    assert(isPostVisibleToGuest({ status: 'published', is_public: true }) === true, '已发布且公开应可见');
    assert(isPostVisibleToGuest({ status: 'published', is_public: false }) === false, '已发布但私密应不可见');
    assert(isPostVisibleToGuest({ status: 'draft', is_public: true }) === false, '草稿应不可见');
    assert(isResourceVisibleToGuest({ is_public: true }) === true, '公开资源应可见');
    assert(isResourceVisibleToGuest({ is_public: false }) === false, '私密资源应不可见');
    return '草稿 / 私密 / 公开 5 组断言全过';
  });

  await test('契约：auth.js 已委托 publicScope，且不再内联 favorites / github-analyze', async () => {
    const authSrc = readFileSync(join(BACKEND, 'src', 'middleware', 'auth.js'), 'utf8');
    assert(/from '\.\.\/lib\/publicScope\.js'/.test(authSrc), 'auth.js 应 import publicScope.js');
    assert(/isGuestAllowed/.test(authSrc), 'auth.js 应调用 isGuestAllowed');
    assert(!/favorites/.test(authSrc), 'auth.js 不应再内联 favorites 白名单');
    assert(!/github\/analyze/.test(authSrc), 'auth.js 不应再内联 github/analyze 白名单');
    return 'auth.js 与 publicScope.js 边界一致';
  });

  // ---- 媒体播放可靠性（2026-10-10：片源无法解析） ----
  section('UNIT · 媒体直链判定与片源过滤');

  await test('isPlayableUrl: 只认 m3u8/mp4 直链，网页地址不算', async () => {
    const { isPlayableUrl } = maccms;
    assert(isPlayableUrl('https://v.gsuus.com/play/x/index.m3u8') === true, 'm3u8 应为直链');
    assert(isPlayableUrl('https://a.com/movie.mp4?x=1') === true, '带查询串的 mp4 应为直链');
    assert(isPlayableUrl('https://vip.dytt-kan.com/share/abc123') === false, '分享页不是直链');
    assert(isPlayableUrl('https://hn.bfvvs.com/play/lejLLq4b') === false, '网页播放页不是直链');
    assert(isPlayableUrl('') === false, '空地址不是直链');
    return '5 组断言全过';
  });

  await test('normalizeVod: 剔除非直链线路与剧集（片源无法解析的根因）', async () => {
    // 真实形态：一条线路里既有网页分享页，也有真 m3u8；另一条线路全是网页地址
    const raw = {
      vod_id: 50482,
      vod_name: '复仇者联盟4',
      type_name: '动作片',
      type_id_1: 1,
      vod_play_from: 'dyttm3u8$$$dytt',
      vod_play_url: [
        'HD国语$https://vip.dytt-kan.com/2025/index.m3u8#HD中字$https://vip.dytt-kan.com/share/abc123',
        'HD国语$https://vip.dytt-kan.com/share/def456'
      ].join('$$$')
    };
    const out = maccms.normalizeVod(raw, { key: 'dytt', name: '电影天堂' });
    assert(out.routes.length === 1, `应只剩 1 条含直链的线路，实际 ${out.routes.length}`);
    assert(out.routes[0].name === 'dyttm3u8', `应保留 dyttm3u8 线路，实际 ${out.routes[0].name}`);
    assert(out.routes[0].episodes.length === 1, `应只保留 1 个直链剧集，实际 ${out.routes[0].episodes.length}`);
    assert(out.routes[0].episodes[0].url.endsWith('index.m3u8'), '保留的应是 m3u8');
    assert(out.playable_url.endsWith('index.m3u8'), 'playable_url 应是 m3u8');
    assert(out.episode_count === 1, `episode_count 应为 1，实际 ${out.episode_count}`);
    return '非直链线路/剧集已剔除，playable_url 为 m3u8';
  });

  await test('normalizeVod: 全部为非直链时兜底保留原始线路（不产生空壳）', async () => {
    const raw = {
      vod_id: 1, vod_name: '测试', type_id_1: 1,
      vod_play_from: 'yun', vod_play_url: '正片$https://x.com/play/123'
    };
    const out = maccms.normalizeVod(raw, { key: 'k', name: 'K' });
    assert(out.routes.length === 1, '兜底应保留原始线路');
    assert(out.playable_url === null, '无可播直链时 playable_url 应为 null');
    return '兜底保留原始线路，playable_url 为 null';
  });

  await test('默认采集源：含 360zy、不含已下线源', async () => {
    const keys = maccms.getVodSources({}).map((s) => s.key);
    assert(keys.includes('360zy'), `默认源应包含 360zy，实际：${keys.join(',')}`);
    for (const dead of ['dytt', 'jszy', 'lzi', 'ffzy', 'zuid', 'ruyi']) {
      assert(!keys.includes(dead), `默认源不应包含已下线/未采用的 ${dead}`);
    }
    assert(maccms.getAnimeClassIdsSync({ key: '360zy' }) !== null, '360zy 应有硬编码动漫类目（可为空数组）');
    return `默认源 ${keys.length} 个：${keys.join(',')}`;
  });

  await test('mediaUrl: 音频直链判定与播放地址归一', async () => {
    const { isDirectAudioUrl, isDirectVideoUrl, resolveAudioPlayback, looksLikeAudioStream, isStaleAudioUrl } = mediaUrl;
    assert(isDirectAudioUrl('https://m801.music.126.net/x/y.flac') === true, 'flac 应为音频直链');
    assert(isDirectAudioUrl('https://api.audius.co/v1/tracks/abc/stream') === false, '无后缀端点不是直链');
    assert(isDirectAudioUrl('https://audius.co/byone/周杰伦-七里香') === false, '平台网页地址不是直链');
    assert(isDirectVideoUrl('https://a.com/x.m3u8') === true && isDirectVideoUrl('https://a.com/play/1') === false, '影视直链判定');

    // 优先级：完整音轨 > 显式直链 > 试听片段；网页地址一律忽略
    const full = resolveAudioPlayback({ url: 'https://x/page/1', audio_url: 'https://x/a.flac' });
    assert(full.url === 'https://x/a.flac' && full.quality === 'full', '应优先完整音轨直链');
    const fromUrl = resolveAudioPlayback({ url: 'https://x/a.mp3', audio_url: null });
    assert(fromUrl.url === 'https://x/a.mp3' && fromUrl.quality === 'full', '显式直链 url 应被接受');
    const trial = resolveAudioPlayback({ url: 'https://x/page/1', audio_url: null, preview_url: 'https://x/p.m4a' });
    assert(trial.url === 'https://x/p.m4a' && trial.quality === 'preview' && trial.trialOnly === true, '试听片段应标 preview');
    const none = resolveAudioPlayback({ url: 'https://audius.co/byone/x', audio_url: null, preview_url: null });
    assert(none.url === null, '只有网页地址时应判为无可用直链');

    // url_stale 体检：无后缀的流式端点算可播（Audius），平台网页地址算疑似失效
    assert(looksLikeAudioStream('https://api.audius.co/v1/tracks/abc/stream') === true, '无后缀 /stream 端点应视为可播');
    assert(isStaleAudioUrl('https://api.audius.co/v1/tracks/abc/stream') === false, 'Audius stream 端点不应标 stale');
    assert(isStaleAudioUrl('https://audius.co/byone/周杰伦-七里香') === true, '平台网页地址应标 stale');
    assert(isStaleAudioUrl('https://m801.music.126.net/x.flac') === false, 'flac 直链不应标 stale');
    return '音频/影视直链判定 + 三级优先级 + url_stale 体检共 13 组断言全过';
  });

  await test('pickBestMovieCandidate: 只接受可信标题，拒绝同名异片', async () => {
    const { pickBestMovieCandidate } = movies;
    const cands = [
      { source: 'guangsu', external_id: '1', title: '流浪地球之大夏战狼', playable_url: 'https://a/1.m3u8', media_type: 'movie' },
      { source: 'guangsu', external_id: '2', title: '流浪地球2', playable_url: 'https://a/2.m3u8', media_type: 'movie' },
      { source: 'guangsu', external_id: '3', title: '流浪地球2：再次冒险', playable_url: 'https://a/3.m3u8', media_type: 'movie' }
    ];
    const best = pickBestMovieCandidate(cands, { title: '流浪地球2', mediaType: 'movie' });
    assert(best && best.external_id === '2', `应选完全同名那条，实际 ${best && best.external_id}`);

    // 只有「包含关键词」的衍生片（相关度 4）时，必须拒绝，不能瞎写
    const onlyDerived = pickBestMovieCandidate(
      [{ source: 's', external_id: '9', title: '流浪地球之大夏战狼', playable_url: 'https://a/9.m3u8', media_type: 'movie' }],
      { title: '流浪地球2' }
    );
    assert(onlyDerived === null, '只有同名异片候选时应返回 null（拒绝自动写库）');

    // 无直链的候选一律不选
    const noPlay = pickBestMovieCandidate(
      [{ source: 's', external_id: '1', title: '测试', playable_url: null, media_type: 'movie' }],
      { title: '测试' }
    );
    assert(noPlay === null, '无可播直链时应返回 null');
    return '完全同名选中 / 同名异片拒绝 / 无直链拒绝，3 组断言全过';
  });
}

// ---------------------------------------------------------------- CONTRACT
async function contract() {
  section('CONTRACT · 页面 ↔ 接口（全页面覆盖）');

  const apiSrc = readFileSync(join(FRONTEND_SRC, 'lib', 'api.js'), 'utf8');
  const routerSrc = readFileSync(join(BACKEND, 'src', 'router.js'), 'utf8');

  // 后端路由表：['GET', '/api/xxx', handler]；参数名统一成 :id 以便跨端比对
  const routerMap = new Map();
  for (const m of routerSrc.matchAll(/\['([A-Z]+)', '([^']+)'/g)) {
    routerMap.set(`${m[1]} ${m[2].replace(/:[^/]+/g, ':id')}`, true);
  }

  // api.js 里的请求：request('PATH' 或 request(`PATH`，可带 method: 'X'；以及直写 ${API_BASE_URL}/api/...
  const apiCalls = [];
  for (const m of apiSrc.matchAll(/request\(\s*([`'"])([^`'"]+)\1\s*(?:,\s*\{[\s\S]{0,200}?method:\s*'([A-Z]+)')?/g)) {
    apiCalls.push({ method: m[3] || 'GET', path: m[2] });
  }
  for (const m of apiSrc.matchAll(/API_BASE_URL\}([/]api[^`'"]*)[`'"]\s*,\s*\{[^}]*?method:\s*'([A-Z]+)'/g)) {
    apiCalls.push({ method: m[2], path: m[1] });
  }
  for (const m of apiSrc.matchAll(/API_BASE_URL\}([/]api[^`'"]*)[`'"]/g)) {
    if (!apiCalls.some((c) => c.path === m[1])) apiCalls.push({ method: 'GET', path: m[1] });
  }

  // 归一化：去掉查询串；`/xxx/${id}` → `/xxx/:id`；`/xxx${params}`（查询串载体）→ `/xxx`
  const norm = (p) => p
    .split('?')[0]
    .replace(/\/\$\{[^}]+\}/g, '/:id')
    .replace(/\$\{[^}]+\}/g, '')
    .replace(/\/+/g, '/');

  await test(`api.js 的 ${apiCalls.length} 个请求全部在后端路由表中`, async () => {
    const missing = [];
    for (const c of apiCalls) {
      const key = `${c.method} ${norm(c.path)}`;
      if (!routerMap.has(key)) missing.push(key);
    }
    assert(missing.length === 0, `前端调了后端不存在的路由:\n    ${missing.join('\n    ')}`);
    return `${Object.keys(Object.fromEntries(routerMap)).length} 条后端路由`;
  });

  // 每个页面用到的 api.* 方法必须存在
  const exported = new Set();
  for (const m of apiSrc.matchAll(/^\s{2}(\w+):\s*(?:async\s*)?\(/gm)) exported.add(m[1]);
  for (const m of apiSrc.matchAll(/^\s{2}(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm)) exported.add(m[1]);

  const routeFiles = readdirSync(join(FRONTEND_SRC, 'routes')).filter((f) => f.endsWith('.jsx'));
  const pageReport = [];
  for (const f of routeFiles.sort()) {
    if (f === 'routes.js') continue;
    const src = readFileSync(join(FRONTEND_SRC, 'routes', f), 'utf8');
    const used = [...new Set([...src.matchAll(/api\.(\w+)\(/g)].map((m) => m[1]))];
    const missing = used.filter((u) => !exported.has(u));
    pageReport.push({ f, used, missing });
    await test(`${f}: ${used.length} 个 api 方法全部存在`, async () => {
      assert(missing.length === 0, `调用了 api.js 里不存在的方法: ${missing.join(', ')}`);
      return used.length ? used.join(', ') : '（纯展示页）';
    }, { page: f });
  }
}

// ---------------------------------------------------------------- LIVE
async function live() {
  // 先探活：采集源按出口 IP 限频，连续测试会烧掉配额。
  // 搜索结果条数的阈值按「当前可用源数」校准，把「源被限频」与「代码回归」区分开。
  const state = { aliveSources: 0 };
  section('LIVE · 采集源可用率');
  await test('影视采集源探活 ≥4 可用（默认池 6 个；本机 IP 限频已计入阈值）', async () => {
    // ⚠ 阈值说明：源站按出口 IP 限频，反复跑测试的同一 IP 会被临时压制
    //（2026-10-07 实测：本机探活 7/12 时，同一批「挂掉」的源从海外节点全部秒回）。
    // 2026-10-09 精简后默认池为 6 个（DEFAULT_VOD_SOURCES）；阈值取 4，
    // 低于 4 才说明源真的大面积故障。
    const { getVodSources } = maccms;
    const sources = getVodSources({});
    const settled = await Promise.allSettled(sources.map((s) => maccms.checkMaccms(s)));
    const alive = sources.filter((_, i) => settled[i].status === 'fulfilled' && settled[i].value?.ok);
    const dead = sources.filter((_, i) => !(settled[i].status === 'fulfilled' && settled[i].value?.ok)).map((s) => s.key);
    state.aliveSources = alive.length;
    assert(alive.length >= 4, `只有 ${alive.length} 个源可用（阈值 4），挂掉: ${dead.join(',')}`);
    return `${alive.length}/${sources.length} 可用${dead.length ? '，本轮未响应（多为限频）: ' + dead.join(',') : ''}`;
  }, { page: 'Movies.jsx' });
  // 探活失败（限频）时也不让后续搜索测试误报：阈值放宽并标注
  const movieMin = (healthy) => (state.aliveSources >= 4 ? healthy : 2);
  const calib = () => (state.aliveSources >= 4 ? '' : `（可用源仅 ${state.aliveSources}，阈值已放宽）`);

  section('LIVE · 影视搜索（真实采集源）');

  await test('影视「庆余年」: 足量且正片在前', async () => {
    const t0 = Date.now();
    const res = await fetchers.fetchMovieMeta('庆余年', 30, {});
    const ms = Date.now() - t0;
    assert(res.candidates.length >= movieMin(5), `只有 ${res.candidates.length} 条${calib()}`);
    assert(res.candidates[0].title.startsWith('庆余年'), `榜首不是正片: ${res.candidates[0].title}`);
    const top3Rel = res.candidates.slice(0, 3).map((c) => maccms.titleRelevance(c.title, '庆余年'));
    assert(Math.min(...top3Rel) <= 2, `前三里没有正片（相关度 ${top3Rel}）`);
    const routes = res.candidates.reduce((n, c) => n + (c.routes || []).length, 0);
    assert(routes >= 8, `总线路只有 ${routes} 条（阈值 8）`);
    assert(ms < 9000, `耗时 ${ms}ms 超预算 9s`);
    return `${res.candidates.length} 条 / ${(res.sources || []).length} 源 / ${routes} 线路 / ${ms}ms / 榜首=${res.candidates[0].title}`;
  }, { page: 'Movies.jsx' });

  await test('影视「奥本海默」: 足量且榜首正确', async () => {
    const res = await fetchers.fetchMovieMeta('奥本海默', 30, {});
    assert(res.candidates.length >= movieMin(5), `只有 ${res.candidates.length} 条${calib()}`);
    assert(res.candidates[0].title === '奥本海默', `榜首不对: ${res.candidates[0].title}`);
    return `${res.candidates.length} 条 / ${(res.sources || []).length} 源命中${calib()}`;
  }, { page: 'Movies.jsx' });

  await test('影视「凡人修仙传」: 足量且前三是正片', async () => {
    const res = await fetchers.fetchMovieMeta('凡人修仙传', 30, {});
    assert(res.candidates.length >= movieMin(7), `只有 ${res.candidates.length} 条${calib()}`);
    const rel = res.candidates.slice(0, 3).map((c) => maccms.titleRelevance(c.title, '凡人修仙传'));
    assert(Math.min(...rel) <= 2, `前三没有正片（相关度 ${rel}，榜首=${res.candidates[0].title}）`);
    return `${res.candidates.length} 条 / 榜首=${res.candidates[0].title} / 相关度[${rel}]`;
  }, { page: 'Movies.jsx' });

  section('LIVE · 音乐搜索（真实音源）');

  await test('音乐「周杰伦」: 40 条、绝大多数可播、榜首是本人热歌', async () => {
    const res = await fetchers.fetchMusicMeta('周杰伦', 40, {});
    const cands = res.candidates;
    assert(cands.length >= 35, `只有 ${cands.length} 条（阈值 35）`);
    const playable = cands.filter((c) => c.audio_url || c.needs_resolve || c.preview_url).length;
    assert(playable >= Math.floor(cands.length * 0.8), `可播/可解析只有 ${playable}/${cands.length}`);
    const top = cands[0];
    assert(String(top.artist || '').includes('周杰伦'), `榜首歌手不是周杰伦: ${top.artist}`);
    const hits = ['晴天', '青花瓷', '七里香', '稻香', '告白气球', '兰亭序', '花海', '夜曲'];
    const inTop10 = cands.slice(0, 10).filter((c) => hits.some((h) => c.title.includes(h))).length;
    assert(inTop10 >= 2, `前十里只有 ${inTop10} 首大热歌（阈值 2）: ${cands.slice(0, 10).map((c) => c.title).join('/')}`);
    return `${cands.length} 条 / 可播 ${playable} / 榜首=${top.title}|${top.artist}`;
  }, { page: 'Music.jsx' });

  await test('音乐「孤勇者」: 榜首必须是陈奕迅的原唱（防冒充号回归）', async () => {
    // 回归：曾出现榜首是「陷阱之声|孤勇者」——艺名就叫孤勇者的蹭名号，
    // 靠「歌手==查询词」满分压过原唱。修复后按池内曲目数分档。
    const res = await fetchers.fetchMusicMeta('孤勇者', 40, {});
    assert(res.candidates.length >= 20, `只有 ${res.candidates.length} 条（阈值 20）`);
    const top = res.candidates[0];
    assert(top.title.startsWith('孤勇者') && String(top.artist || '').includes('陈奕迅'),
      `榜首不是陈奕迅的原唱: ${top.title}|${top.artist}（前五: ${res.candidates.slice(0, 5).map((c) => `${c.title}|${c.artist}`).join(' ; ')}）`);
    return `${res.candidates.length} 条 / 榜首=${top.title}|${top.artist}`;
  }, { page: 'Music.jsx' });

  await test('音乐「漠河舞厅」: 原唱柳爽在第一', async () => {
    const res = await fetchers.fetchMusicMeta('漠河舞厅', 40, {});
    assert(res.candidates.length >= 15, `只有 ${res.candidates.length} 条（阈值 15）`);
    assert(String(res.candidates[0].artist || '').includes('柳爽'), `榜首不是柳爽: ${res.candidates[0].artist}`);
    return `${res.candidates.length} 条 / 榜首=${res.candidates[0].title}|${res.candidates[0].artist}`;
  }, { page: 'Music.jsx' });

  // RSS 模块 2026-10-09 已整体删除（见 docs/removed-features.md），不再有 RSS 抓取用例。
}

// ---------------------------------------------------------------- main
const t0 = Date.now();
if (!ONLY || ONLY === 'unit') { await unit(); await contract(); }
if (!ONLY || ONLY === 'live') await live();

const failed = results.filter((r) => !r.ok);
console.log(`\n${'='.repeat(60)}`);
console.log(`总计 ${results.length} 项：${results.length - failed.length} 过 / ${failed.length} 失败 / 耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (failed.length) {
  console.log('\n失败清单：');
  for (const f of failed) console.log(`  ❌ [${f.section}] ${f.name} —— ${f.detail}`);
}
process.exit(failed.length ? 1 : 0);
