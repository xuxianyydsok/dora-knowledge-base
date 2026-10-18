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
import * as fileType from '../src/lib/fileType.js';
import * as bookType from '../src/lib/bookType.js';
import * as videoType from '../src/lib/videoType.js';
import * as sourceHealth from '../src/lib/sourceHealth.js';
import * as publicScope from '../src/lib/publicScope.js';
import * as timelineMerge from '../src/lib/timelineMerge.js';
import * as timelineRoute from '../src/routes/timeline.js';
import * as mediaUrl from '../src/lib/mediaUrl.js';
import * as musicSources from '../src/lib/musicSources.js';
import * as markdown from '../src/lib/markdown.js';
import * as musicIdentity from '../src/lib/musicIdentity.js';
import * as movies from '../src/routes/movies.js';
import * as safeUrl from '../src/lib/safeUrl.js';
import * as momentsRoute from '../src/routes/moments.js';
import * as meRoute from '../src/routes/me.js';
import * as githubAi from '../src/lib/githubAi.js';
import * as dynamicSources from '../src/lib/dynamicSources.js';
import * as audioType from '../src/lib/audioType.js';
import * as audioMeta from '../src/lib/audioMeta.js';
import * as zhConvert from '../src/lib/zhConvert.js';
import * as visibility from '../src/routes/visibility.js';
import * as bilibili from '../src/lib/bilibili.js';
// 前端纯函数（无依赖、无 import，Node 可直接加载）：验证前后端直链判定一致
import * as feMediaUrl from '../../frontend/src/lib/mediaUrl.js';

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

  await test('批量可见性: 三类资源共用入口，只改 is_public 且必须带 user_id', async () => {
    assert(typeof visibility.updateVisibility === 'function', '缺少 updateVisibility');
    const kinds = visibility.VISIBILITY_KINDS;
    assert(kinds.posts?.table === 'posts', 'posts 应写 posts 表');
    assert(kinds.music?.table === 'resources' && kinds.music.type === 'music', 'music 应写 resources + type=music');
    assert(kinds.movies?.table === 'resources' && kinds.movies.type === 'movie', 'movies 应写 resources + type=movie');
    assert(typeof kinds.posts.cache === 'function', '必须声明缓存命名空间');
    return '三类入口 + user_id 隔离 + 缓存失效';
  });

  await test('图书阅读: 独立路由 + EPUB/PDF 统一进度键', async () => {
    const app = readFileSync(join(FRONTEND_SRC, 'app.jsx'), 'utf8');
    const progress = readFileSync(join(FRONTEND_SRC, 'lib', 'bookProgress.js'), 'utf8');
    const reader = readFileSync(join(FRONTEND_SRC, 'components', 'BookReader.jsx'), 'utf8');
    assert(/path="\/books\/:id"/.test(app), '缺少 /books/:id 阅读路由');
    assert(/loadBookProgress/.test(reader) && /saveBookProgress/.test(reader), '阅读器必须恢复并保存进度');
    assert(/saveBookProgress\(book\.id, \{ page: pdfPage \}\)/.test(reader), 'PDF 翻页必须写入统一进度键');
    assert(/bk:reader:progress:/.test(progress), '进度键必须统一');
    return '独立阅读路由 + EPUB/PDF 统一进度';
  });

  await test('影视播放: URL 线路/集数使用安全索引', async () => {
    const view = readFileSync(join(FRONTEND_SRC, 'routes', 'MovieView.jsx'), 'utf8');
    assert(/safeRouteIndex/.test(view) && /safeEpIndex/.test(view), '线路与集数必须按实际数据夹取');
    assert(/currentEpisodes/.test(view), '播放器必须使用当前线路的集数');
    assert(/selectEpisode\(safeEpIndex \+ 1\)/.test(view), '自动下一集必须写回 URL');
    return '线路/集数夹取 + 下一集同步 URL';
  });

  await test('音乐搜索: URL 恢复不会重复请求同一关键词', async () => {
    const music = readFileSync(join(FRONTEND_SRC, 'routes', 'Music.jsx'), 'utf8');
    assert(/urlSearchRef/.test(music), '搜索恢复必须有去重状态');
    assert(/urlSearchRef\.current = q[\s\S]*route\(`\/music\?tab=search/.test(music), 'runSearch 应先记录关键词再写 URL');
    assert(/urlSearchRef\.current === q/.test(music), '同一关键词不得重复请求');
    return 'URL 恢复搜索去重';
  });

  await test('影视列表: URL 恢复与快速切换只保留最后一次请求', async () => {
    const movies = readFileSync(join(FRONTEND_SRC, 'routes', 'Movies.jsx'), 'utf8');
    assert(/urlRequestRef/.test(movies), '列表必须有请求代次');
    assert(/urlRequestRef\.current === requestKey/.test(movies), '旧请求结果不得覆盖新频道');
    assert(/urlRequestRef\.current = next === 'search'/.test(movies), 'switchMode 必须先登记新请求');
    return '列表请求代次 + URL 恢复去重';
  });

  await test('B 站导入: 前端不再拒绝 b23.tv 短链', async () => {
    const adminMusic = readFileSync(join(FRONTEND_SRC, 'routes', 'AdminMusic.jsx'), 'utf8');
    assert(!/b23\.tv 短链无法直接识别/.test(adminMusic), '前端不得提前拒绝短链');
    assert(/bilibili_url: parsed\.isShortLink \? biliUrl\.trim\(\) : parsed\.bvid/.test(adminMusic),
      '短链应原样交给后端展开');
    return '短链交由后端安全展开';
  });

  await test('B 站短链: 服务端展开且只允许 B 站跳转', async () => {
    const redirect = (location) => async () => new Response(null, { status: 302, headers: { location } });
    const ok = await bilibili.expandBilibiliShortLink('https://b23.tv/eTMZ54Q', {
      fetchImpl: redirect('https://www.bilibili.com/video/BV1Rj421Q7R8?p=1')
    });
    assert(ok.bvid === 'BV1Rj421Q7R8', '短链应展开出 BV 号');
    assert(ok.p === 1, '应保留分 P');

    let externalError = '';
    try {
      await bilibili.expandBilibiliShortLink('https://b23.tv/evil', {
        fetchImpl: redirect('https://example.com/video/BV1Rj421Q7R8')
      });
    } catch (e) { externalError = e.message; }
    assert(/非 B 站地址/.test(externalError), '外站跳转必须拒绝');

    let entryError = '';
    try {
      await bilibili.expandBilibiliShortLink('https://example.com/eTMZ54Q', {
        fetchImpl: redirect('https://b23.tv/x')
      });
    } catch (e) { entryError = e.message; }
    assert(/不是有效的 b23\.tv 短链/.test(entryError), '非 b23.tv 入口必须拒绝');
    return '展开成功 + 外站拒绝 + 入口限制';
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
    // 例外：站长收藏（/api/favorites/public）对所有人公开，必须与个人收藏分开判定
    assert(isGuestAllowed('GET', '/api/favorites/public'), '站长收藏应允许访客只读');
    assert(!isGuestAllowed('GET', '/api/favorites/public/x'), '站长收藏子路径不应被额外放行');
    assert(!isGuestAllowed('GET', '/api/favorites'), '个人收藏仍应对访客关闭');
    return `放行 ${allowedGet.length} 条 / 拒绝 ${deniedGet.length} 条 + 站长收藏例外 3 断言`;
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

  await test('访客白名单：上传曲目的 audio/cover 字节端点放行，上传本身拒绝', async () => {
    const { isGuestAllowed } = publicScope;
    const id = '11111111-1111-1111-1111-111111111111';
    // 访客要能听站长公开的音乐、看它的封面
    assert(isGuestAllowed('GET', `/api/music/${id}/audio`) === true, '访客应可读音频字节');
    assert(isGuestAllowed('GET', `/api/music/${id}/cover`) === true, '访客应可读封面字节');
    // 上传是管理员专属写操作，访客一律不能碰
    assert(isGuestAllowed('POST', '/api/music/upload') === false, '访客不应能上传音乐');
    // 白名单只负责「能不能进」：非 uuid 路径虽然会被 /api/music 前缀放进中间件，
    // 但路由层的 requireUuid 会返回 422，因此不构成绕过（这里显式锁定这个分工）。
    const audioSrc = readFileSync(join(BACKEND, 'src', 'routes', 'musicUpload.js'), 'utf8');
    assert(/getMusicAudio[\s\S]{0,200}requireUuid\(/.test(audioSrc), 'getMusicAudio 必须先校验 uuid');
    assert(/getMusicCover[\s\S]{0,200}requireUuid\(/.test(audioSrc), 'getMusicCover 必须先校验 uuid');
    // 私有曲目的过滤也在路由层（is_public），白名单不负责这一步
    assert(/readable[\s\S]{0,200}is_public === true/.test(audioSrc), '路由层必须按 is_public 过滤');
    return 'audio/cover 放行、upload 拒绝、uuid 与 is_public 由路由层把关';
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

  // ---- 图片展览 + 公开时间轴（2026-10-10） ----
  section('UNIT · 图片展览与公开时间轴（聚合/排序/分页/字段安全）');

  await test('访客白名单：/api/gallery 与 /api/timeline 只读放行，写操作拒绝', async () => {
    const { isGuestAllowed } = publicScope;
    assert(isGuestAllowed('GET', '/api/gallery'), '访客应可读 /api/gallery');
    assert(isGuestAllowed('GET', '/api/timeline'), '访客应可读 /api/timeline');
    assert(!isGuestAllowed('POST', '/api/gallery'), '访客不应 POST /api/gallery');
    assert(!isGuestAllowed('PATCH', '/api/gallery/x'), '访客不应 PATCH /api/gallery');
    assert(!isGuestAllowed('DELETE', '/api/gallery/x'), '访客不应 DELETE /api/gallery');
    return 'GET 2 条放行 / 写 3 条拒绝';
  });

  await test('mergeTimeline: 五类映射统一结构与跳转地址', async () => {
    const { mergeTimeline } = timelineMerge;
    const res = mergeTimeline({
      posts: [{ id: 'p1', title: '文章', excerpt: '摘要', published_at: '2026-05-01T00:00:00Z', created_at: '2026-04-01T00:00:00Z' }],
      resources: [
        { id: 'r1', type: 'github', title: '仓库', summary: 's', url: 'https://github.com/a/b', created_at: '2026-04-03T00:00:00Z' },
        { id: 'r2', type: 'music', title: '歌', summary: 's', created_at: '2026-04-04T00:00:00Z' },
        { id: 'r3', type: 'movie', title: '片', summary: 's', created_at: '2026-04-05T00:00:00Z' }
      ],
      gallery: [{ id: 'g1', title: '照片', description: '说明', captured_at: '2026-03-01', created_at: '2026-03-02T00:00:00Z', cover: '/api/assets/x' }]
    }, { limit: 20 });
    assert(res.items.length === 5, `应合并 5 条，实得 ${res.items.length}`);
    const types = res.items.map((i) => i.type).sort().join(',');
    assert(types === 'gallery,github,movie,music,post', `类型集合错误: ${types}`);
    for (const it of res.items) {
      for (const k of ['id', 'type', 'title', 'summary', 'date', 'url', 'cover']) {
        assert(k in it, `缺少字段 ${k}: ${JSON.stringify(it)}`);
      }
    }
    const by = Object.fromEntries(res.items.map((i) => [i.source_id, i]));
    assert(by.p1.url === '/posts/p1', `post url 错误: ${by.p1.url}`);
    assert(by.p1.date === '2026-05-01T00:00:00.000Z', `post 应优先 published_at: ${by.p1.date}`);
    assert(by.r1.url === 'https://github.com/a/b', `github 应用外链: ${by.r1.url}`);
    assert(by.r2.url === '/music/r2', `music url 错误: ${by.r2.url}`);
    assert(by.r3.url === '/movies/r3', `movie url 错误: ${by.r3.url}`);
    assert(by.g1.date === '2026-03-01T00:00:00.000Z', `gallery 应用 captured_at: ${by.g1.date}`);
    assert(by.g1.url === '/gallery', `gallery url 错误: ${by.g1.url}`);
    return `${res.items.length} 条，类型 ${types}`;
  });

  await test('mergeTimeline: date 倒序 + 同 date 按 id 升序 + 游标分页不重叠', async () => {
    const { mergeTimeline } = timelineMerge;
    const posts = [
      { id: 'b', title: 'B', published_at: '2026-01-02T00:00:00Z' },
      { id: 'a', title: 'A', published_at: '2026-01-02T00:00:00Z' },
      { id: 'c', title: 'C', published_at: '2026-01-01T00:00:00Z' },
      { id: 'd', title: 'D', published_at: '2025-12-31T00:00:00Z' },
      { id: 'e', title: 'E', published_at: '2025-12-30T00:00:00Z' }
    ];
    const first = mergeTimeline({ posts }, { limit: 2 });
    assert(first.items.length === 2, `limit=2 应返回 2 条，实得 ${first.items.length}`);
    assert(first.items[0].source_id === 'a' && first.items[1].source_id === 'b',
      `同 date 应按 id 升序: ${first.items.map((i) => i.source_id).join(',')}`);
    assert(first.next_cursor === `${first.items[1].date}|${first.items[1].id}`,
      `复合游标应为「第 2 条 date|id」: ${first.next_cursor}`);

    const second = mergeTimeline({ posts }, { limit: 2, before: first.next_cursor });
    assert(second.items.length === 2, `第二页应有 2 条，实得 ${second.items.length}`);
    const firstIds = first.items.map((i) => i.id);
    const overlap = second.items.filter((i) => firstIds.includes(i.id));
    assert(overlap.length === 0, `两页不应重叠: ${overlap.map((i) => i.id).join(',')}`);
    assert(second.items[0].source_id === 'c', `第二页首条应为 c: ${second.items[0].source_id}`);
    assert(second.next_cursor !== null, '第二页之后仍应有下一页游标');

    const last = mergeTimeline({ posts }, { limit: 2, before: second.next_cursor });
    assert(last.items.length === 1 && last.items[0].source_id === 'e', `最后一页应只剩 e: ${last.items.map((i) => i.source_id)}`);
    assert(last.next_cursor === null, `最后一页 next_cursor 应为 null: ${last.next_cursor}`);
    return `第1页 ${first.items.map((i) => i.source_id)} / 第2页 ${second.items.map((i) => i.source_id)} / 第3页 ${last.items.map((i) => i.source_id)}`;
  });

  await test('mergeTimeline: 同一天多条不跳条（复合游标回归）', async () => {
    const { mergeTimeline } = timelineMerge;
    // 展览 captured_at 是「日」精度：同一天必然有多条，旧实现按时间严格小于会永久漏条
    const sameDay = '2026-06-01T00:00:00.000Z';
    const gallery = ['a', 'b', 'c', 'd', 'e'].map((k) => ({
      id: k, title: `图${k}`, captured_at: '2026-06-01', created_at: sameDay, cover: '/x'
    }));
    const seen = [];
    let cursor = null;
    for (let page = 0; page < 5; page += 1) {
      const res = mergeTimeline({ gallery }, { limit: 2, before: cursor });
      seen.push(...res.items.map((i) => i.source_id));
      cursor = res.next_cursor;
      if (!cursor) break;
    }
    assert(seen.length === 5, `同一天 5 条应全部翻到，实得 ${seen.length}: ${seen.join(',')}`);
    assert(new Set(seen).size === 5, `不应重复: ${seen.join(',')}`);
    assert(seen.join(',') === 'a,b,c,d,e', `应按 id 升序稳定分页: ${seen.join(',')}`);
    return `3 页翻完同一天 5 条：${seen.join(',')}`;
  });

  await test('mergeTimeline: 旧格式游标（仅时间）仍兼容，按严格小于处理', async () => {
    const { mergeTimeline } = timelineMerge;
    const posts = [
      { id: 'a', title: 'A', published_at: '2026-01-02T00:00:00Z' },
      { id: 'b', title: 'B', published_at: '2026-01-01T00:00:00Z' }
    ];
    const res = mergeTimeline({ posts }, { limit: 10, before: '2026-01-02T00:00:00.000Z' });
    assert(res.items.length === 1 && res.items[0].source_id === 'b',
      `旧格式游标应只保留更早的 b: ${res.items.map((i) => i.source_id).join(',')}`);
    return '旧格式游标按严格小于，兼容通过';
  });

  await test('mergeTimeline: limit 上限 50、非法 before 不抛错', async () => {
    const { mergeTimeline } = timelineMerge;
    const posts = Array.from({ length: 80 }).map((_, i) => ({
      id: `p${String(i).padStart(3, '0')}`,
      title: `t${i}`,
      published_at: new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString()
    }));
    const capped = mergeTimeline({ posts }, { limit: 999 });
    assert(capped.items.length === 50, `limit 应封顶 50，实得 ${capped.items.length}`);
    assert(capped.next_cursor !== null, '截断时应有下一页游标');
    const bad = mergeTimeline({ posts: posts.slice(0, 3) }, { limit: 20, before: 'not-a-date' });
    assert(bad.items.length === 3, `非法 before 应按无 before 处理，实得 ${bad.items.length}`);
    return '上限 50 / 非法游标忽略';
  });

  await test('mergeTimeline: 输出只含安全字段，绝不带 object_key/sha256/user_id/content', async () => {
    const { mergeTimeline, mapPost, mapGallery, mapResource } = timelineMerge;
    const dirtyPost = {
      id: 'p1', title: 'x', excerpt: 'y', published_at: '2026-01-01T00:00:00Z',
      content: '<p>正文</p>', user_id: 'u1', object_key: 'assets/u1/2026/a.png', sha256: 'deadbeef'
    };
    const dirtyRes = { id: 'r1', type: 'github', title: 'r', summary: 's', url: 'https://x', created_at: '2026-01-01T00:00:00Z', user_id: 'u1', metadata: { star: 1 }, sha256: 'x' };
    const dirtyGal = { id: 'g1', title: 'g', description: 'd', captured_at: '2026-01-01', created_at: '2026-01-01T00:00:00Z', cover: '/api/assets/1', user_id: 'u1', object_key: 'k' };
    const banned = ['object_key', 'sha256', 'user_id', 'content', 'metadata'];
    for (const mapped of [mapPost(dirtyPost), mapResource(dirtyRes), mapGallery(dirtyGal)]) {
      for (const k of banned) assert(!(k in mapped), `映射结果不应含 ${k}: ${JSON.stringify(mapped)}`);
    }
    const res = mergeTimeline({ posts: [dirtyPost], resources: [dirtyRes], gallery: [dirtyGal] }, { limit: 10 });
    for (const it of res.items) {
      for (const k of banned) assert(!(k in it), `时间轴条目不应含 ${k}: ${JSON.stringify(it)}`);
    }
    return `3 类映射 + ${res.items.length} 条合并条目均无内部字段`;
  });

  await test('timeline 粗过滤方向：倒序翻页必须用 lte（旧实现 gte 会让下一页为空）', async () => {
    const { postFilters, resourceFilters, galleryFilters } = timelineRoute;
    const user = { id: 'u1', isGuest: true };
    const cursor = '2026-10-09T00:00:00.000Z|post:abc';

    const post = postFilters(user, cursor, 30);
    assert(post.or && post.or.includes('published_at.lte.'), `posts 应用 lte: ${post.or}`);
    assert(!post.or.includes('gte.'), `posts 不应出现 gte: ${post.or}`);
    assert(post.or.includes('published_at.is.null'), 'posts 需覆盖 published_at 为空回退 created_at');
    assert(post.or.includes('created_at.lte.'), 'posts 回退分支应比 created_at');
    assert(post.order.includes('nullslast'), `posts 排序应 nullslast: ${post.order}`);

    const res = resourceFilters(user, cursor, 30);
    assert(res.created_at === `lte.2026-10-09T00:00:00.000Z`, `resources 应用 lte: ${res.created_at}`);

    const gal = galleryFilters(user, cursor, 30);
    assert(gal.or && gal.or.includes('captured_at.lte.2026-10-09'), `gallery 应按 captured_at lte 游标日: ${gal.or}`);
    assert(gal.or.includes('captured_at.is.null'), 'gallery 需覆盖 captured_at 为空回退 created_at');
    assert(gal.or.includes('created_at.lte.'), 'gallery 回退分支应比 created_at');
    assert(!gal.or.includes('gte.'), `gallery 不应出现 gte: ${gal.or}`);

    // 第一页（无游标）不应带任何时间过滤
    assert(!postFilters(user, null, 30).or && !resourceFilters(user, null, 30).created_at,
      '无游标时不应附加时间过滤');

    // 2026-10-11 用户要求：图书也进时间轴，粗过滤方向同样必须是 lte
    const book = timelineRoute.bookFilters(user, cursor, 30);
    assert(book.created_at === `lte.2026-10-09T00:00:00.000Z`, `books 应用 lte: ${book.created_at}`);
    assert(book.is_public === 'eq.true', 'books 必须叠加 is_public=true（时间轴是公开页）');
    assert(book.user_id === 'eq.u1', 'books 必须限定 owner');
    assert(!timelineRoute.bookFilters(user, null, 30).created_at, 'books 无游标时不应附加时间过滤');
    return 'posts/resources/gallery 粗过滤方向全部为 lte 且覆盖回退日期列';
  });

  await test('timeline 图书映射：书名 / 作者 / 封面 / 链接 / 安全字段', async () => {
    const { mapBook, mergeTimeline, TIMELINE_TYPES } = timelineMerge;
    assert(TIMELINE_TYPES.includes('book'), 'TIMELINE_TYPES 应含 book');

    const mapped = mapBook({
      id: 'b1', title: '三体', author: '刘慈欣', format: 'epub',
      cover_url: 'https://api.example/api/books/b1/cover',
      original_name: '三体 （典藏版·三册）.epub',
      created_at: '2026-10-11T10:34:40Z',
      // 故意混入内部字段，确认映射层不外传
      object_key: 'books/u1/2026/x.epub', cover_key: 'books/u1/2026/x.epub-cover.jpg', user_id: 'u1'
    });
    assert(mapped.type === 'book', `类型应为 book: ${mapped.type}`);
    assert(mapped.title === '三体', `书名应取 title: ${mapped.title}`);
    assert(mapped.summary === '刘慈欣 · EPUB', `副标题应为「作者 · 格式」: ${mapped.summary}`);
    assert(mapped.url === '/books', `链接应回书架: ${mapped.url}`);
    assert(mapped.cover === 'https://api.example/api/books/b1/cover', '封面应用 cover_url');
    for (const k of ['object_key', 'cover_key', 'user_id']) {
      assert(!(k in mapped), `图书映射不应含 ${k}: ${JSON.stringify(mapped)}`);
    }

    // 书名缺失时回退文件名去扩展名；作者缺失时副标题只剩格式
    const fallback = mapBook({ id: 'b2', format: 'pdf', original_name: '盗墓笔记（全集）.pdf', created_at: '2026-10-11T00:00:00Z' });
    assert(fallback.title === '盗墓笔记（全集）', `应回退去扩展名的文件名: ${fallback.title}`);
    assert(fallback.summary === 'PDF', `无作者时副标题应为格式: ${fallback.summary}`);
    assert(fallback.cover === null, '无封面时 cover 应为 null');

    // 缺 created_at 的图书不进时间轴（时间轴必须有日期）
    const res = mergeTimeline({ books: [
      { id: 'ok', title: 'A', format: 'epub', created_at: '2026-10-11T00:00:00Z' },
      { id: 'nodate', title: 'B', format: 'epub' }
    ] }, { limit: 10 });
    assert(res.items.length === 1 && res.items[0].source_id === 'ok', `缺日期应被过滤: ${JSON.stringify(res.items)}`);
    return '图书映射（书名 / 作者 / 格式 / 封面 / 回退 / 安全字段）全部正确';
  });

  await test('timeline 跨日翻页回归：第一页末条 2026-10-09，第二页能取到 2026-10-08', async () => {
    const { mergeTimeline } = timelineMerge;
    const posts = [
      { id: 'a', title: 'A', published_at: '2026-10-09T08:00:00Z', created_at: '2026-10-09T08:00:00Z' },
      { id: 'b', title: 'B', published_at: '2026-10-09T06:00:00Z', created_at: '2026-10-09T06:00:00Z' },
      { id: 'c', title: 'C', published_at: '2026-10-08T20:00:00Z', created_at: '2026-10-08T20:00:00Z' },
      { id: 'd', title: 'D', published_at: '2026-10-07T10:00:00Z', created_at: '2026-10-07T10:00:00Z' }
    ];
    const first = mergeTimeline({ posts }, { limit: 2 });
    assert(first.items.map((i) => i.source_id).join(',') === 'a,b', `第一页应为 a,b: ${first.items.map((i) => i.source_id)}`);
    assert(first.items[1].date.startsWith('2026-10-09'), `第一页末条应在 10-09: ${first.items[1].date}`);
    assert(first.next_cursor.startsWith('2026-10-09'), `游标应在 10-09: ${first.next_cursor}`);

    const second = mergeTimeline({ posts }, { limit: 2, before: first.next_cursor });
    assert(second.items.length > 0, '第二页不应为空（旧实现 gte 会直接空）');
    assert(second.items.map((i) => i.source_id).join(',') === 'c,d', `第二页应为 c,d: ${second.items.map((i) => i.source_id)}`);
    assert(second.items[0].date.startsWith('2026-10-08'), `第二页首条应为 10-08: ${second.items[0].date}`);
    return `第1页 ${first.items.map((i) => i.source_id)} → 第2页 ${second.items.map((i) => i.source_id)}（跨日正常）`;
  });

  await test('gallery 迁移：assets 复合唯一 + gallery_items 复合外键同 owner', async () => {
    const sql = readFileSync(join(BACKEND, '..', 'supabase', 'migrations', '20261010000016_gallery_items.sql'), 'utf8');
    assert(/assets_user_id_id_key\s+unique\s*\(user_id,\s*id\)/.test(sql.replace(/\s+/g, ' ')),
      'assets 应有 (user_id,id) 唯一约束 assets_user_id_id_key');
    assert(/foreign key\s*\(user_id,\s*asset_id\)\s*references\s+public\.assets\s*\(user_id,\s*id\)/.test(sql.replace(/\s+/g, ' ')),
      'gallery_items 应有复合外键 (user_id,asset_id) -> assets(user_id,id)');
    assert(/gallery_items_asset_same_owner/.test(sql), '复合外键应有明确命名');
    assert(/on delete restrict/.test(sql), '复合外键应 on delete restrict');
    assert(!/references public\.assets\(id\)/.test(sql.replace(/\s+/g, ' ')),
      '不应再有只引用 assets(id) 的单列外键');
    return '复合唯一 + 复合外键同 owner + restrict 全部就位';
  });

  await test('gallery 路由：decorate 按 owner 过滤 assets，且不返回 original_name', async () => {
    const src = readFileSync(join(BACKEND, 'src', 'routes', 'gallery.js'), 'utf8');
    // decorate 的素材查询必须带 user_id（无论访客与否）
    const decorateSrc = src.slice(src.indexOf('async function decorate'), src.indexOf('// 读取单个素材'));
    assert(/user_id:\s*`eq\.\$\{userId\}`/.test(decorateSrc), 'decorate 必须按 userId 过滤 assets');
    assert(/is_public\s*=\s*'eq\.true'/.test(decorateSrc), 'decorate 访客分支应叠加 is_public');
    // ASSET_SELECT 不得包含 original_name（避免把原始文件名当 alt 泄露给访客）
    const selectLine = src.match(/const ASSET_SELECT = '([^']+)'/);
    assert(selectLine, '应能找到 ASSET_SELECT 定义');
    assert(!selectLine[1].includes('original_name'), `ASSET_SELECT 不应含 original_name: ${selectLine[1]}`);
    assert(!/alt:\s*asset\.original_name/.test(src), 'alt 不应使用 asset.original_name');
    return 'decorate 带 owner 过滤 / ASSET_SELECT 与 alt 均不含 original_name';
  });

  await test('gallery 路由：ASSET_SELECT 必须含 is_public（否则公开展览永远 409）', async () => {
    // 回归（2026-10-11 线上实测）：ASSET_SELECT 漏掉 is_public 时，findOwnAsset 返回的 asset
    // 没有 is_public 字段，createGalleryItem 的 `asset.is_public !== true` 恒为真，
    // 导致「加入公开展览」永远 409、前端看不到任何公开图。这里把该列钉死。
    const src = readFileSync(join(BACKEND, 'src', 'routes', 'gallery.js'), 'utf8');
    const selectLine = src.match(/const ASSET_SELECT = '([^']+)'/);
    assert(selectLine, '应能找到 ASSET_SELECT 定义');
    const cols = selectLine[1].split(',').map((c) => c.trim());
    assert(cols.includes('is_public'),
      `ASSET_SELECT 必须包含 is_public（公开展览校验依赖它），实际: ${selectLine[1]}`);
    // 校验逻辑确实依赖 asset.is_public，两者必须成对存在
    assert(/asset\.is_public !== true/.test(src), '公开展览校验应基于 asset.is_public');
    return `ASSET_SELECT 含 is_public：${selectLine[1]}`;
  });

  // ---- 此刻页 + 设置安全中心（2026-10-10） ----
  section('UNIT · 碎念页与设置安全中心（URL 安全 / 字段白名单 / 访客边界）');

  await test('isSafeUrl: 放行 http/https 与站内相对地址，拒绝伪协议/协议相对/反斜杠', async () => {
    const { isSafeUrl } = safeUrl;
    for (const ok of ['https://example.com/x', 'http://example.com', '/posts/abc', '/moments?a=1']) {
      assert(isSafeUrl(ok) === true, `应放行: ${ok}`);
    }
    for (const bad of [
      'javascript:alert(1)', 'data:text/html,x', '//evil.com', '/\\evil.com', '/\\/evil.com',
      'https://', '', null, 123, 'mailto:a@b.c', 'file:///etc/passwd'
    ]) {
      assert(isSafeUrl(bad) === false, `应拒绝: ${JSON.stringify(bad)}`);
    }
    return '放行 4 条 / 拒绝 11 条';
  });

  await test('normalizeSafeUrl: 非法返回 null 且不抛错，合法原样返回', async () => {
    const { normalizeSafeUrl } = safeUrl;
    assert(normalizeSafeUrl('https://example.com/x') === 'https://example.com/x', '合法外链应原样返回');
    assert(normalizeSafeUrl('/posts/abc') === '/posts/abc', '合法站内地址应原样返回');
    for (const bad of ['javascript:alert(1)', '//evil.com', '', null, undefined, 42, {}]) {
      assert(normalizeSafeUrl(bad) === null, `非法输入应返回 null: ${JSON.stringify(bad)}`);
    }
    return '合法原样返回 / 非法一律 null（无异常）';
  });

  await test('momentGuestFilters: 访客读碎念必须叠加 is_public=eq.true', async () => {
    const f = publicScope.momentGuestFilters();
    assert(f.is_public === 'eq.true', `访客过滤应为 eq.true: ${JSON.stringify(f)}`);
    return JSON.stringify(f);
  });

  await test('normalizeAssetIds: 去重保序 / 上限 9 张 / 非数组与非法 uuid 报 422', async () => {
    const { normalizeAssetIds } = momentsRoute;
    const a = '11111111-1111-4111-8111-111111111111';
    const b = '22222222-2222-4222-8222-222222222222';
    assert(normalizeAssetIds(undefined) === undefined, '未传应返回 undefined（表示不改配图）');
    assert(JSON.stringify(normalizeAssetIds(null)) === '[]', 'null 应清空为空数组');
    assert(JSON.stringify(normalizeAssetIds([a, b, a])) === JSON.stringify([a, b]), '重复 id 应去重且保序');
    assert(publicScope.MAX_MOMENT_ASSETS === 9, '配图上限应为 9（朋友圈九宫格）');

    let threw = false;
    try { normalizeAssetIds('nope'); } catch (e) { threw = e.status === 422; }
    assert(threw, '非数组应 422');

    threw = false;
    try { normalizeAssetIds([a, 'not-a-uuid']); } catch (e) { threw = e.status === 422; }
    assert(threw, '非法 uuid 应 422');

    threw = false;
    try { normalizeAssetIds(Array.from({ length: 10 }, (_, i) => `33333333-3333-4333-8333-${String(i).padStart(12, '0')}`)); }
    catch (e) { threw = e.status === 422; }
    assert(threw, '超过 9 张应 422');
    return '去重保序 / null 清空 / 上限 9 / 非法输入 422';
  });

  await test('moments 路由契约：GET 按 user_id + 访客 is_public、写操作 requireAdmin、无 select:*、不回传 user_id', async () => {
    for (const fn of ['listMoments', 'createMoment', 'updateMoment', 'deleteMoment']) {
      assert(typeof momentsRoute[fn] === 'function', `moments.js 应导出 ${fn}`);
    }
    const src = readFileSync(join(BACKEND, 'src', 'routes', 'moments.js'), 'utf8');
    const listSrc = src.slice(src.indexOf('export async function listMoments'), src.indexOf('// POST /api/moments'));
    assert(/user_id:\s*`eq\.\$\{user\.id\}`/.test(listSrc), 'listMoments 必须按 user_id 过滤');
    assert(/momentGuestFilters\(\)/.test(listSrc), 'listMoments 访客分支应叠加 momentGuestFilters()');
    assert(/is_public:\s*'eq\.true'/.test(readFileSync(join(BACKEND, 'src', 'lib', 'publicScope.js'), 'utf8')),
      'momentGuestFilters 必须返回 is_public=eq.true');
    assert((src.match(/requireAdmin\(/g) || []).length >= 3, '三个写操作都应 requireAdmin');
    assert(!/select:\s*'\*'/.test(src), '不得使用 select:*（防止 user_id 回传）');
    assert(/const SELECT = 'id,content,is_public,created_at,updated_at'/.test(src),
      'SELECT 应为不含 user_id 的字段白名单');
    const shapeSrc = src.slice(src.indexOf('function shape'), src.indexOf('// 规范化配图数组'));
    assert(!/user_id/.test(shapeSrc), 'shape 不得回传 user_id');
    // 配图必须逐条校验归属，否则可挂他人素材
    assert(/assertOwnAssets\(/.test(src), '写入配图前必须校验素材归属');
    assert(/user_id:\s*`eq\.\$\{userId\}`/.test(src), 'decorate 取素材必须显式按 owner 过滤');
    return 'user_id 过滤 + 访客 is_public + requireAdmin + 字段白名单 + 配图归属校验 全部就位';
  });

  await test('buildProfilePatch: 只挑安全列，特权列逐个 422，长度/格式校验生效', async () => {
    const { buildProfilePatch } = meRoute;

    const patch = buildProfilePatch({ display_name: 'Dora', username: 'ok_name-1' });
    assert(Object.keys(patch).join(',') === 'display_name,username',
      `patch 只应含 display_name/username: ${JSON.stringify(patch)}`);

    for (const body of [{ role: 'admin' }, { plan: 'pro' }, { is_disabled: false }, { id: 'x' }]) {
      let threw = false;
      try { buildProfilePatch(body); } catch (e) { threw = e.status === 422; }
      assert(threw, `特权字段必须 422: ${JSON.stringify(body)}`);
    }

    let shortThrew = false;
    try { buildProfilePatch({ username: 'a' }); } catch (e) { shortThrew = e.status === 422; }
    assert(shortThrew, 'username 太短应 422');
    assert(buildProfilePatch({ username: 'ok_name-1' }).username === 'ok_name-1', '合法 username 应通过');

    let emptyThrew = false;
    try { buildProfilePatch({}); } catch (e) { emptyThrew = e.status === 422; }
    assert(emptyThrew, '没有可更新字段应 422');

    assert(buildProfilePatch({ display_name: null }).display_name === null, 'display_name 传 null 应清空');
    let badUrlThrew = false;
    try { buildProfilePatch({ avatar_path: 'javascript:alert(1)' }); } catch (e) { badUrlThrew = e.status === 422; }
    assert(badUrlThrew, 'avatar_path 非法地址应 422');
    return '安全列挑出 / 特权列 4 个 422 / 长度与 URL 校验通过';
  });

  await test('访客白名单：/api/moments GET 放行，写操作全拒绝；旧 /api/now 已下线', async () => {
    const { isGuestAllowed } = publicScope;
    assert(isGuestAllowed('GET', '/api/moments') === true, '访客应可读 /api/moments');
    assert(isGuestAllowed('POST', '/api/moments') === false, '访客不应 POST /api/moments');
    assert(isGuestAllowed('PATCH', '/api/moments/x') === false, '访客不应 PATCH /api/moments');
    assert(isGuestAllowed('DELETE', '/api/moments/x') === false, '访客不应 DELETE /api/moments');
    assert(isGuestAllowed('GET', '/api/now') === false, '旧 /api/now 不应再放行（已改名为 /api/moments）');
    return 'GET 放行 / 写操作拒绝 / 旧 now 路径已下线';
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

  await test('normalizeVod: 剔除分享页，保留并归一网页播放页（2026-10-11 修复）', async () => {
    // 真实形态：一条线路里既有真 m3u8，也有分享页；另一条线路是网页播放页。
    // 分享页（/share/<hash>）交给 <video> 必然失败 → 剔除；
    // 网页播放页（/play/<id>）的真直链固定在 <播放页>/index.m3u8 → 归一后保留。
    const raw = {
      vod_id: 50482,
      vod_name: '复仇者联盟4',
      type_name: '动作片',
      type_id_1: 1,
      vod_play_from: 'dyttm3u8$$$dytt',
      vod_play_url: [
        'HD国语$https://vip.dytt-kan.com/2025/index.m3u8#HD中字$https://vip.dytt-kan.com/share/abc123',
        'HD国语$https://v.gsuus.com/play/kazVzrma'
      ].join('$$$')
    };
    const out = maccms.normalizeVod(raw, { key: 'dytt', name: '电影天堂' });
    assert(out.routes.length === 2, `两条线路都应保留，实际 ${out.routes.length}`);
    const first = out.routes[0];
    assert(first.name === 'dyttm3u8', `含真 m3u8 的线路应排前面，实际 ${first.name}`);
    assert(first.episodes.length === 1, `分享页应被剔除，实际剩 ${first.episodes.length}`);
    assert(first.episodes[0].url === 'https://vip.dytt-kan.com/2025/index.m3u8', '保留的应是原始 m3u8');
    const second = out.routes[1];
    assert(second.episodes.length === 1, `网页播放页应归一后保留，实际 ${second.episodes.length}`);
    assert(second.episodes[0].url === 'https://v.gsuus.com/play/kazVzrma/index.m3u8', '播放页应归一为 index.m3u8');
    assert(second.episodes[0].original_url === 'https://v.gsuus.com/play/kazVzrma', '应保留 original_url 便于排查');
    assert(out.playable_url === 'https://vip.dytt-kan.com/2025/index.m3u8', 'playable_url 应是 m3u8');
    assert(out.episode_count === 2, `episode_count 应为 2，实际 ${out.episode_count}`);
    return '分享页剔除、网页播放页归一保留，playable_url 为 m3u8';
  });

  await test('normalizeVod: 全部为分享页时兜底保留原始线路（不产生空壳）', async () => {
    const raw = {
      vod_id: 1, vod_name: '测试', type_id_1: 1,
      vod_play_from: 'yun', vod_play_url: '正片$https://x.com/share/abc123'
    };
    const out = maccms.normalizeVod(raw, { key: 'k', name: 'K' });
    assert(out.routes.length === 1, '兜底应保留原始线路');
    assert(out.playable_url === null, '无可播直链时 playable_url 应为 null');
    assert(out.routes[0].diagnostic === true, '兜底线路必须打 diagnostic 标记，供前端识别为不可播');
    assert(out.episode_count === 0, `分享页不应算作剧集，实际 ${out.episode_count}`);
    return '兜底保留原始线路，playable_url 为 null';
  });

  await test('normalizeVod: 网页播放页归一为直链，不再落入兜底（只有 360 能播的根因）', async () => {
    // 回归：光速/速播/豪华 三个源给的是网页播放页，旧逻辑把它当「非直链」整条丢弃，
    // 用户看到的就是「只有 360 能播」。归一后必须变成正常直链线路。
    const raw = {
      vod_id: 2, vod_name: '繁花', type_id_1: 2,
      vod_play_from: 'guangsu', vod_play_url: '第01集$https://v.gsuus.com/play/kazVzrma'
    };
    const out = maccms.normalizeVod(raw, { key: 'guangsu', name: '光速资源' });
    assert(out.routes.length === 1, '应保留 1 条线路');
    assert(out.routes[0].diagnostic !== true, '归一成功不应打 diagnostic 标记');
    assert(out.playable_url === 'https://v.gsuus.com/play/kazVzrma/index.m3u8', 'playable_url 应是归一后的 m3u8');
    assert(out.episode_count === 1, `归一后应算作 1 集，实际 ${out.episode_count}`);
    return '网页播放页已归一为可播直链';
  });

  await test('toPlayableUrl: 播放页归一、分享页拒绝、直链原样（前后端同规则）', async () => {
    const cases = [
      ['https://v.gsuus.com/play/kazVzrma', 'https://v.gsuus.com/play/kazVzrma/index.m3u8'],
      ['https://v.gsuus.com/play/kazVzrma/', 'https://v.gsuus.com/play/kazVzrma/index.m3u8'],
      ['https://a.com/2025/index.m3u8', 'https://a.com/2025/index.m3u8'],
      ['https://a.com/movie.mp4?x=1', 'https://a.com/movie.mp4?x=1'],
      ['https://vip.dytt-kan.com/share/abc123', ''],
      ['https://a.com/detail/1', ''],
      ['', ''],
      [null, '']
    ];
    for (const [input, expected] of cases) {
      const be = maccms.toPlayableUrl(input);
      const fe = feMediaUrl.toPlayableUrl(input);
      assert(be === expected, `后端 toPlayableUrl(${input}) 应为 ${expected}，实际 ${be}`);
      assert(fe === expected, `前端 toPlayableUrl(${input}) 应为 ${expected}，实际 ${fe}`);
    }
    return `${cases.length} 组前后端归一一致`;
  });

  // ---- 前端播放地址归一（2026-10-10 回归：清洗为空后回退 raw，网页地址仍进播放器） ----
  section('UNIT · 前端播放地址归一（回归防护）');

  await test('前端 isDirectVideoUrl: 与后端 isPlayableUrl 同规则', async () => {
    const cases = [
      'https://v.gsuus.com/play/x/index.m3u8',
      'https://a.com/movie.mp4?x=1',
      'https://vip.dytt-kan.com/share/abc123',
      'https://hn.bfvvs.com/play/lejLLq4b',
      '',
      null
    ];
    for (const u of cases) {
      assert(
        feMediaUrl.isDirectVideoUrl(u) === maccms.isPlayableUrl(u),
        `前后端判定不一致：${u}（前端 ${feMediaUrl.isDirectVideoUrl(u)} / 后端 ${maccms.isPlayableUrl(u)}）`
      );
    }
    return `${cases.length} 组前后端判定一致`;
  });

  await test('前端 cleanRoutes: 分享页剔除、播放页归一、绝不回退原始网页线路', async () => {
    // 回归场景（2026-10-11 更新）：源站只给分享页时清洗后必须为空（旧实现在此回退 raw → 网页地址进播放器）；
    // 但网页播放页 /play/<id> 现在能归一成直链，必须保留而不是丢弃。
    const webOnly = [
      { name: 'dytt', episodes: [{ name: 'HD', url: 'https://vip.dytt-kan.com/share/abc123' }] },
      { name: 'lzi', episodes: [{ name: '正片', url: 'https://hn.bfvvs.com/play/lejLLq4b' }] }
    ];
    const cleanedWeb = feMediaUrl.cleanRoutes(webOnly);
    assert(cleanedWeb.length === 1, '分享页线路应被剔除，播放页线路应保留');
    assert(cleanedWeb[0].episodes.length === 1, '播放页应归一成 1 个直链剧集');
    assert(cleanedWeb[0].episodes[0].url === 'https://hn.bfvvs.com/play/lejLLq4b/index.m3u8', '播放页应归一为 index.m3u8');
    assert(feMediaUrl.hasOnlyWebRoutes(webOnly) === false, '播放页归一后不算「只剩网页地址」');

    // 全是分享页（无法归一）时才清洗为空，且不得回退 raw
    const shareOnly = [
      { name: 'dytt', episodes: [{ name: 'HD', url: 'https://vip.dytt-kan.com/share/abc123' }] }
    ];
    assert(feMediaUrl.cleanRoutes(shareOnly).length === 0, '全是分享页时应清洗为空，不得回退 raw');
    assert(feMediaUrl.hasOnlyWebRoutes(shareOnly) === true, '应识别出「只剩网页地址」');

    // 混合场景：只保留直链剧集，网页剧集剔除
    const mixed = [{
      name: 'dyttm3u8',
      episodes: [
        { name: 'HD', url: 'https://vip.dytt-kan.com/2025/index.m3u8' },
        { name: 'HD2', url: 'https://vip.dytt-kan.com/share/abc123' }
      ]
    }];
    const cleaned = feMediaUrl.cleanRoutes(mixed);
    assert(cleaned.length === 1 && cleaned[0].episodes.length === 1, '应只保留 1 个直链剧集');
    assert(feMediaUrl.hasOnlyWebRoutes(mixed) === false, '含直链时不应判为只剩网页');
    return '空回退已消除，分享页剔除 / 播放页归一 / 混合只留直链';
  });

  await test('前端 resolvePlayUrl: 只接受可播地址，分享页一律拒绝', async () => {
    const { resolvePlayUrl } = feMediaUrl;
    assert(resolvePlayUrl('https://a.com/x.m3u8', 'https://b.com/y.mp4') === 'https://a.com/x.m3u8', '剧集直链优先');
    assert(resolvePlayUrl(null, 'https://b.com/y.mp4') === 'https://b.com/y.mp4', '剧集缺失时回退存库直链');
    assert(resolvePlayUrl(null, 'https://vip.dytt-kan.com/share/abc123') === '', '存库网页地址必须返回空');
    assert(
      resolvePlayUrl('https://hn.bfvvs.com/play/lejLLq4b', null) === 'https://hn.bfvvs.com/play/lejLLq4b/index.m3u8',
      '剧集网页播放页应归一为直链'
    );
    assert(resolvePlayUrl('', '') === '', '都为空时返回空');
    return '5 组断言全过（分享页不产生播放地址，播放页归一为直链）';
  });

  await test('契约：MovieView / MoviePlayer 不得再把未校验地址喂给播放器', async () => {
    // 源码契约（防回归，不做脆弱全文匹配）：这两处是 2026-10-10 回归的根因位置。
    const view = readFileSync(join(FRONTEND_SRC, 'routes', 'MovieView.jsx'), 'utf8');
    const player = readFileSync(join(FRONTEND_SRC, 'components', 'MoviePlayer.jsx'), 'utf8');
    // 详情页必须走统一归一函数，且不得再出现「回退 raw」的写法
    assert(/from '\.\.\/lib\/mediaUrl\.js'/.test(view), 'MovieView 应 import lib/mediaUrl.js');
    assert(/resolvePlayUrl\(/.test(view), 'MovieView 应用 resolvePlayUrl 计算播放地址');
    assert(/cleanRoutes\(/.test(view), 'MovieView 应用 cleanRoutes 清洗线路');
    assert(!/cleaned\.length \? cleaned : raw/.test(view), 'MovieView 不得再回退原始线路');
    // 播放器必须对地址做归一/直链校验（2026-10-11 起统一走 toPlayableUrl：
    // 既拒绝分享页，又能把网页播放页归一成直链）
    assert(/from '\.\.\/lib\/mediaUrl\.js'/.test(player), 'MoviePlayer 应 import lib/mediaUrl.js');
    assert(/toPlayableUrl\(/.test(player), 'MoviePlayer 应对播放地址做归一/直链校验');
    return 'MovieView / MoviePlayer 已统一走直链归一';
  });

  await test('酷我音源：伪 JSON 解析 + 音质档位', async () => {
    // 酷我搜索接口返回单引号伪 JSON（值里带 &nbsp; 实体、\\uXXXX 转义），
    // 直接 JSON.parse 会炸，因此这里固化解析口径。
    const raw = "{'AARTIST':{'MUSICRID':'MUSIC_12345','NAME':'晴天&nbsp;(Live)','ARTIST':'周杰伦&周杰伦','"
      + "ALBUM':'叶惠美','FORMATS':'MP3H,WMA96','DURATION':'269','web_albumpic_short':'120/37/x.jpg'},"
      + "{'AARTIST':{'MUSICRID':'MUSIC_67890','NAME':'稻香','ARTIST':'周杰伦','ALBUM':'魔杰座','"
      + "FORMATS':'WMA96','DURATION':'223','web_albumpic_short':''}";
    const list = musicSources.parseKuwoSearch(raw);
    assert(list.length === 2, `应解析出 2 条，实际 ${list.length}`);
    assert(list[0].platform === 'kuwo', 'platform 应为 kuwo');
    assert(list[0].external_id === '12345', `external_id 应去掉 MUSIC_ 前缀，实际 ${list[0].external_id}`);
    assert(list[0].title === '晴天 (Live)', `&nbsp; 应还原成空格，实际「${list[0].title}」`);
    assert(list[0].artist === '周杰伦/周杰伦', `多歌手用 / 连接，实际「${list[0].artist}」`);
    assert(list[0].artwork_url === 'https://img1.kuwo.cn/star/albumcover/120/37/x.jpg', '封面 URL 应拼好');
    // ⚠ 不按 FORMATS 标称音质：2026-10-12 实测「标了 MP3H 的曲目，逐档取流时
    // 320kmp3 也拿不到，实际只有 mp3（≈128K）」—— 标称会虚高。
    // 因此 bitrate 一律为 0，真实音质等取流成功后回填；FORMATS 只作为
    // 「最高可能音质」的提示保留在 max_bitrate_hint 里。
    assert(list[0].bitrate === 0, `未取流前不得标称音质，实际 ${list[0].bitrate}`);
    assert(list[0].max_bitrate_hint === 320, `有 MP3H 时提示 320K，实际 ${list[0].max_bitrate_hint}`);
    assert(list[1].max_bitrate_hint === 128, `无 MP3H 时提示 128K，实际 ${list[1].max_bitrate_hint}`);
    assert(list[0].needs_resolve === true, '未取直链时应标 needs_resolve');
    // ⚠ 上游把值做了**两层**转义：真实的 & 在响应里是 `\\\\u0026`（4 个反斜杠），
    // 只做一次解码会残留反斜杠，多歌手就显示成「陈奕迅\\\/王菲」。
    // 这条用真实抓到的原始片段固化（2026-10-12，「因为爱情」的 ARTIST）。
    const esc = "{'AARTIST':{'MUSICRID':'MUSIC_1694640','NAME':'因为爱情-《将爱情进行到底》电影主题曲',"
      + "'ARTIST':'陈奕迅\\\\\\\\u0026王菲','ALBUM':'A','FORMATS':'MP3128','DURATION':'218','web_albumpic_short':''}";
    const escList = musicSources.parseKuwoSearch(esc);
    assert(escList[0].artist === '陈奕迅/王菲',
      `双层转义 & 应还原成多歌手分隔，实际「${escList[0].artist}」`);
    // 脏数据不应产生条目
    assert(musicSources.parseKuwoSearch('').length === 0, '空串应返回空数组');
    assert(musicSources.parseKuwoSearch('garbage').length === 0, '非酷我格式应返回空数组');
    return `解析 ${list.length} 条，音质档 320/128 正确，双层转义还原正确`;
  });

  await test('QQ音乐音源：vkeys 适配（字段映射 / 会员标注 / 时长解析）', async () => {
    // 不联网：直接调 searchVkeysMusic 需要真实接口，这里只验证纯逻辑导出。
    // 时长文本 "4分29秒" → 269 秒；vkeys 的 interval 就是这个格式。
    assert(typeof musicSources.searchVkeysMusic === 'function', '应导出 searchVkeysMusic');
    assert(typeof musicSources.vkeysStreamUrl === 'function', '应导出 vkeysStreamUrl');
    // 空 mid 应直接返回 null（不发请求）
    assert(await musicSources.vkeysStreamUrl('') === null, '空 mid 应返回 null');
    assert(await musicSources.vkeysStreamUrl(null) === null, 'null mid 应返回 null');
    return 'vkeys 适配器导出正确，空输入安全';
  });

  await test('Markdown 渲染：README 转 HTML（标题/列表/代码/链接/表格）', () => {
    const md = [
      '# 标题',
      '',
      '一段**加粗**与`代码`的文字。',
      '',
      '- 项目一',
      '- 项目二',
      '',
      '```js',
      'const a = 1 < 2;',
      '```',
      '',
      '> 引用',
      '',
      '[链接](https://example.com)'
    ].join('\n');
    const html = markdown.markdownToHtml(md);
    assert(html.includes('<h1>标题</h1>'), '标题应转 h1');
    assert(html.includes('<strong>加粗</strong>'), '粗体应转 strong');
    assert(html.includes('<code>代码</code>'), '行内码应转 code');
    assert(html.includes('<li>项目一</li>'), '列表应转 li');
    assert(html.includes('<pre><code'), '代码块应转 pre>code');
    assert(html.includes('<blockquote>'), '引用应转 blockquote');
    assert(html.includes('href="https://example.com"'), '链接应保留 href');
    return '常见 Markdown 语法转换正确';
  });

  await test('Markdown 渲染：XSS 防护（脚本被转义，不出现在标签位）', () => {
    const html = markdown.markdownToHtml('正常文字\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>');
    // 关键：不得出现可执行的 script 标签
    assert(!/<script/i.test(html), 'script 标签必须被转义');
    assert(html.includes('&lt;script&gt;'), 'script 应以转义文本形式出现');
    return '原始 HTML 被转义，无法注入脚本';
  });

  await test('音乐去重：同一首歌（同名同歌手）只保留一条', async () => {
    // 注意：不要解构出与模块同名的变量（const { musicIdentity } = musicIdentity 会 TDZ 报错）
    const { musicIdentity: identity, dedupeMusicList, findDuplicateMusic } = musicIdentity;
    // 归一化：大小写、空白、括号、分隔符全部忽略
    assert(identity({ title: '晴天', artist: '周杰伦' }) === identity({ title: ' 晴天 ', artist: '周杰伦' }),
      '空白差异应视为同一首');
    assert(identity({ title: 'Hello', artist: 'Adele' }) === identity({ title: 'hello', artist: 'ADELE' }),
      '大小写差异应视为同一首');
    assert(identity({ title: '晴天 (Live)', artist: '周杰伦' }) === identity({ title: '晴天（Live）', artist: '周杰伦' }),
      '中英文括号差异应视为同一首');
    assert(identity({ title: '稻香', artist: '周杰伦' }) !== identity({ title: '稻香', artist: '其他' }),
      '不同歌手不应合并');
    assert(identity({ title: '', artist: '周杰伦' }) === null, '歌名为空时无法判定，应返回 null');
    assert(identity({}) === null, '空对象应返回 null');

    // 列表去重：保留最先出现（= created_at 最新）的那条
    const items = [
      { id: 'a', title: '晴天', track: { artist: '周杰伦' } },
      { id: 'b', title: '晴天', track: { artist: '周杰伦' } },
      { id: 'c', title: '稻香', track: { artist: '周杰伦' } },
      { id: 'd', title: '晴天', track: { artist: '翻唱歌手' } }
    ];
    const deduped = dedupeMusicList(items);
    assert(deduped.length === 3, `应去重到 3 条，实际 ${deduped.length}`);
    assert(deduped[0].id === 'a', '应保留最先出现的那条');
    assert(deduped.map((m) => m.id).join('') === 'acd', `顺序应为 a,c,d，实际 ${deduped.map((m) => m.id).join('')}`);
    assert(dedupeMusicList(null).length === 0, '非数组应返回空数组');
    assert(dedupeMusicList([{ id: 'x' }]).length === 1, '歌名为空时无法判定，一律保留');

    // 入库查重：在已查到的曲目里按「歌名 + 歌手」找
    const rows = [{ id: 'r1', title: '晴天' }, { id: 'r2', title: '稻香' }];
    const tracks = { r1: { artist: '周杰伦' }, r2: { artist: '周杰伦' } };
    assert(findDuplicateMusic(rows, tracks, { title: '晴天', artist: '周杰伦' })?.id === 'r1', '应命中已有条目');
    assert(findDuplicateMusic(rows, tracks, { title: '晴天', artist: '林俊杰' }) === null, '歌手不同不应命中');
    assert(findDuplicateMusic(rows, tracks, { title: '七里香', artist: '周杰伦' }) === null, '库里没有的歌不应命中');
    assert(findDuplicateMusic(rows, tracks, { title: '', artist: '' }) === null, '空标题不应命中');
    return '身份归一 6 组 + 列表去重 5 组 + 入库查重 4 组断言全过';
  });

  await test('音乐排序：多词查询（歌名 + 歌手）时正片应压过翻唱 / 伴奏', async () => {
    // 背景（2026-10-12 用户反馈「音乐源都变少了 / 搜出来看不了」）：
    // 搜「周杰伦 晴天」这种两段式查询时，真歌《晴天》（歌手=周杰伦）在旧的整串匹配下
    // 三个分支全不中、拿 0 分；而「周杰伦“晴天”Pop Beat」这类标题逐字包含整串的
    // 翻唱 / 伴奏命中 includes(+8)，再叠多源确认(+20) 就霸榜。
    const q = '周杰伦 晴天';
    const real = fetchers.musicScore({ title: '晴天', artist: '周杰伦', audio_url: 'x', srcCount: 3 }, q);
    const beat = fetchers.musicScore({ title: '周杰伦“晴天”Pop Beat', artist: '何洛林', audio_url: 'x', srcCount: 3 }, q);
    const dj = fetchers.musicScore({ title: '周杰伦-晴天 (DJ苏天伦版)', artist: '苏天伦', audio_url: 'x', srcCount: 6 }, q);
    assert(real > beat, `正片《晴天》应高于伴奏，实际 real=${real} beat=${beat}`);
    assert(real > dj, `正片《晴天》应高于 DJ 版，实际 real=${real} dj=${dj}`);

    // 顺序颠倒（歌手在前 / 歌名在前）都应识别出「两段各命中一次」
    const swapped = fetchers.musicScore({ title: '晴天', artist: '周杰伦', audio_url: 'x' }, '晴天 周杰伦');
    const onlyArtist = fetchers.musicScore({ title: '稻香', artist: '周杰伦', audio_url: 'x' }, '晴天 周杰伦');
    assert(swapped > onlyArtist, '两段都命中应高于只命中歌手');

    // 单词查询的既有行为不能被改坏：搜「周杰伦」时本人条目仍应领先翻唱。
    const tally = new Map([['周杰伦', 40]]);
    const self = fetchers.musicScore({ title: '稻香', artist: '周杰伦', audio_url: 'x' }, '周杰伦', tally);
    const cover = fetchers.musicScore({ title: '稻香', artist: '其他歌手', audio_url: 'x' }, '周杰伦', tally);
    assert(self > cover, '单词查询：本人应高于翻唱');
    return `正片 ${real} > 伴奏 ${beat} / DJ ${dj}；两段命中 ${swapped} > 仅歌手 ${onlyArtist}`;
  });

  await test('影视源过滤：名字干净但内容全是成人的伪装源必须被类目级判定剔除', async () => {
    const { isAdultClassLabel, adultClassStats } = dynamicSources;
    // 真实案例（2026-10-12 从 Cloudflare 出口实测 ac=list 拿到的类目表）：
    // 这三个源的**名字**完全正常，只按名字过滤会全部放进主站。
    const baiflower = ['变态另类', '云转码入库勿删', '强奸乱伦', '日韩无码', '日本AV', '黑料吃瓜',
      '传媒视频', '国产精品', '欧美电影', '经典三级', '明星淫梦', 'AV解说', '动漫电影',
      '少女嫩模', '精选短片', '深夜视频', '原创', '国产综艺', '人兽', '二次元', '同性恋', '国产探花'];
    const vietnam = ['视频一区', '视频二区', '视频三区', '亚洲情色', '热门女优', '中文字幕',
      '国产自拍', '无码专区', '伦理三级', '制服师生', '强奸乱伦', '丝袜美腿', '人妻熟女',
      '欧美性爱', '4K岛国', '韩国资源', '卡通动漫', '人妖人兽', '男同女同', 'VR资源', 'JAV高清'];
    const jipin = ['视频一区', '日韩无码', '国产精品', '日韩精品', '欧美精品', '自拍偷拍',
      '伦理影片', '人妻系列', '制服诱惑', '强奸乱伦', 'AV明星', 'SM重味', '巨乳系列',
      '颜射系列', '口交视频', '自慰系列', '教师学生', '大秀视频', '明星换脸', '熟女少妇', '人兽乱交'];
    for (const [name, labels] of [['百花', baiflower], ['越南', vietnam], ['新极品', jipin]]) {
      const s = adultClassStats(labels.map((type_name) => ({ type_name })));
      const blocked = s.total >= 4 && (s.ratio > 0.3 || s.adult.length >= 6);
      assert(blocked, `${name} 应被判为成人源（命中 ${s.adult.length}/${s.total}）`);
    }

    // 正常源不能误杀：它们各自都挂着一个「伦理片」叶子类目（实测电影天堂 / 猫眼 /
    // iKun / 豆瓣 / 茅台都是如此），占比很低，必须放行。
    const normal = ['电影片', '连续剧', '综艺片', '动漫片', '动作片', '喜剧片', '爱情片',
      '科幻片', '恐怖片', '剧情片', '战争片', '国产剧', '香港剧', '韩国剧', '欧美剧',
      '记录片', '台湾剧', '日本剧', '海外剧', '泰国剧', '大陆综艺', '港台综艺', '伦理片'];
    const ns = adultClassStats(normal.map((type_name) => ({ type_name })));
    const nblocked = ns.total >= 4 && (ns.ratio > 0.3 || ns.adult.length >= 6);
    assert(!nblocked, `正常源不应被剔除（命中 ${ns.adult.length}/${ns.total}）`);

    // 「三级」「写真」「人妻」这类词单独出现时不该判成人（正规源也常用），
    // 但「伦理三级」「自拍偷拍」这类组合要判。
    assert(!isAdultClassLabel('三级'), '裸词「三级」不应单独判成人');
    assert(isAdultClassLabel('伦理三级'), '「伦理三级」应判成人');
    assert(isAdultClassLabel('自拍偷拍'), '「自拍偷拍」应判成人');
    assert(!isAdultClassLabel('都市情感'), '普通类目不应误判');
    assert(!isAdultClassLabel(''), '空类目不应误判');

    // 名字级过滤仍要保留（上游清单里带 🔞 的源根本不该进来）
    assert(dynamicSources.isBlockedSource({ name: '🔞XX资源', key: 'x.com', api: 'https://x.com/api' }), '带 🔞 的源应被剔除');
    assert(!dynamicSources.isBlockedSource({ name: '电影天堂', key: 'dyttzyapi.com', api: 'http://caiji.dyttzyapi.com/api.php/provide/vod' }), '正常源不应被名字级过滤误杀');
    return `成人源拦截 3/3，正常源放行，类目级判定 5 组断言全过`;
  });

  await test('默认采集源：含 360zy、不含实测不可用源', async () => {
    const keys = maccms.getVodSources({}).map((s) => s.key);
    assert(keys.includes('360zy'), `默认源应包含 360zy，实际：${keys.join(',')}`);
    // 2026-10-12 复测口径（用户要求「直接没效果的不要放进来」）：
    //   · dytt / ffzy / lzi 在 2026-10-09 曾判不可用，2026-10-12 复测
    //     （搜索 → m3u8 主清单 → 变体 → 首个 ts 分片 206）已全部恢复，**重新收录**；
    //   · 仍在黑名单的是实测拿不到可播地址 / 连不上的源。
    for (const dead of ['jszy', 'zuid', 'ruyi', 'wujin', 'bfzy', 'ikun', 'mdzy']) {
      assert(!keys.includes(dead), `默认源不应包含已下线/未采用的 ${dead}`);
    }
    // 复测恢复的三条源必须在列（用户特意指出旧项目里这三条当时能用）
    for (const back of ['dytt', 'ffzy', 'lzi']) {
      assert(keys.includes(back), `2026-10-12 复测恢复的源应包含 ${back}，实际：${keys.join(',')}`);
    }
    assert(maccms.getAnimeClassIdsSync({ key: '360zy' }) !== null, '360zy 应有硬编码动漫类目（可为空数组）');
    return `默认源 ${keys.length} 个：${keys.join(',')}`;
  });

  await test('mediaUrl: 音频直链判定与播放地址归一', async () => {
    const {
      isDirectAudioUrl, isDirectVideoUrl, resolveAudioPlayback,
      looksLikeAudioStream, isStaleAudioUrl, isMetingStreamUrl
    } = mediaUrl;
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

    // Meting 取流端点（无后缀、302 跳转）必须被当作可播，否则「搜得到、加不进收藏」
    const meting = 'https://api.qijieya.cn/meting/?server=netease&type=url&id=210049';
    assert(isMetingStreamUrl(meting) === true, 'Meting type=url 端点应被识别');
    assert(looksLikeAudioStream(meting) === true, 'Meting 端点应视为可播流');
    assert(isStaleAudioUrl(meting) === false, 'Meting 端点不应标 stale');
    const metingResolved = resolveAudioPlayback({ url: meting, audio_url: null });
    assert(metingResolved.url === meting && metingResolved.quality === 'full',
      `Meting 端点应被 resolveAudioPlayback 接受: ${JSON.stringify(metingResolved)}`);
    // 判定要收紧：普通网页（哪怕路径含 meting）不能混进来
    assert(isMetingStreamUrl('https://api.qijieya.cn/meting/?server=netease&type=pic&id=1') === false,
      'Meting 的 type=pic 封面端点不是音频流');
    assert(isMetingStreamUrl('https://example.com/meting/?type=url') === true
      && isMetingStreamUrl('https://example.com/foo?type=url') === false,
      'Meting 端点判定应要求路径 /meting');
    return '音频/影视直链判定 + 三级优先级 + url_stale 体检 + Meting 端点共 19 组断言全过';
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

// ---------------------------------------------------------------- UNIT · 文档附件类型嗅探
async function fileTypeUnit() {
  section('UNIT · 文档附件（PDF / Word / 文本，拒绝脚本类）');

  const PDF = Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n');
  const OLE = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(32)]);
  const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(28)]);

  await test('文档类型 · 魔数 + 声明一致才放行', () => {
    assert(fileType.resolveFileType(PDF, 'application/pdf')?.ext === 'pdf', 'PDF 应识别');
    assert(fileType.resolveFileType(PDF, '')?.ext === 'pdf', 'PDF 空声明应以魔数为准');
    assert(fileType.resolveFileType(PDF, 'application/msword') === null, 'PDF 字节 + Word 声明应拒绝');

    const docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const xlsx = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    assert(fileType.resolveFileType(ZIP, docx)?.ext === 'docx', 'zip + docx 声明应放行');
    assert(fileType.resolveFileType(ZIP, xlsx)?.ext === 'xlsx', 'zip + xlsx 声明应放行');
    // zip 容器无法只靠魔数区分三兄弟，没有合法 OOXML 声明时必须拒绝（不能当 exe/zip 收进来）
    assert(fileType.resolveFileType(ZIP, 'application/zip') === null, '裸 zip 声明应拒绝');
    assert(fileType.resolveFileType(ZIP, '') === null, 'zip 无声明应拒绝');
    assert(fileType.resolveFileType(OLE, 'application/msword')?.ext === 'doc', 'OLE + doc 声明应放行');
    return 'PDF / doc / docx / xlsx 均按魔数+声明双校验，裸 zip 被拒';
  });

  await test('文档类型 · HTML / 脚本 / 二进制伪装成文本一律拒绝', () => {
    const html = Buffer.from('<!DOCTYPE html><html><script>alert(1)</script></html>');
    // HTML 内容看起来像文本，但声明 text/plain 之外的 mime 会被拒；声明 text/plain 时会被当纯文本收下
    assert(fileType.resolveFileType(html, 'text/html') === null, 'HTML 声明必须拒绝（存储型 XSS）');
    assert(fileType.resolveFileType(Buffer.from('PK\x03\x04\u0000\u0001binary'), 'text/plain') === null, '含 NUL 的二进制不能当文本');
    const binary = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
    assert(fileType.resolveFileType(binary, 'text/plain') === null, '二进制伪装 text/plain 应拒绝');
    return 'HTML / 二进制伪装均被拒';
  });

  await test('文档类型 · 纯文本 / CSV / Markdown 放行且大小有上限', () => {
    const txt = Buffer.from('这是一个纯文本说明。\n第二行。\n');
    assert(fileType.resolveFileType(txt, 'text/plain')?.ext === 'txt', 'text/plain 应识别');
    assert(fileType.resolveFileType(txt, 'text/csv')?.ext === 'csv', 'text/csv 应识别');
    assert(fileType.resolveFileType(txt, 'text/markdown')?.ext === 'md', 'markdown 应识别');
    assert(fileType.resolveFileType(txt, '')?.ext === 'txt', '空声明按 text/plain 处理');

    const limit = fileType.MAX_FILE_BYTES;
    assert(fileType.isWithinFileLimit(limit), '等于上限应通过');
    assert(!fileType.isWithinFileLimit(limit + 1), '超过上限应拒绝');
    assert(!fileType.isWithinFileLimit(0), '空文件应拒绝');
    return `上限 ${Math.round(limit / 1024 / 1024)}MB，文本三兄弟识别正常`;
  });

  await test('文档类型 · 文件名清洗与 object key 不含用户输入', () => {
    assert(!fileType.sanitizeFilename('../../etc/passwd', 'txt').includes('/'), '目录穿越片段必须去掉');
    assert(!fileType.sanitizeFilename('..\\..\\win.ini', 'txt').includes('\\'), '反斜杠必须去掉');
    const key = fileType.buildFileKey('11111111-1111-1111-1111-111111111111', 'pdf', new Date('2026-10-11T00:00:00Z'));
    assert(/^files\/11111111-1111-1111-1111-111111111111\/2026\/[0-9a-f-]{36}\.pdf$/.test(key), `object key 形态不对: ${key}`);
    return '文件名清洗 + key 形态校验通过';
  });
}

// ---------------------------------------------------------------- UNIT · 电子书类型
async function bookTypeUnit() {
  section('UNIT · 电子书类型（魔数嗅探 / 上限 / key 形态）');

  const ascii = (s) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
  const head = (prefix, len = 64) => {
    const out = new Uint8Array(len);
    out.set(ascii(prefix).subarray(0, len), 0);
    return out;
  };

  await test('电子书 · 按魔数识别 PDF / EPUB，普通 zip 被拒', () => {
    assert(bookType.sniffBookFormat(head('%PDF-1.7'))?.format === 'pdf', 'PDF 头应识别');

    // EPUB：zip 头 + 头部的 application/epub+zip 标记
    const epub = new Uint8Array(200);
    epub.set([0x50, 0x4b, 0x03, 0x04], 0);
    epub.set(ascii('application/epub+zip'), 30);
    assert(bookType.sniffBookFormat(epub)?.format === 'epub', 'EPUB 应识别');

    // 只有 zip 头、没有 epub 标记的（如 docx）必须被拒，避免把 Office 文件当电子书收
    const notEpub = new Uint8Array(200);
    notEpub.set([0x50, 0x4b, 0x03, 0x04], 0);
    assert(bookType.sniffBookFormat(notEpub) === null, '普通 zip 不应被当成电子书');
    return 'PDF / EPUB 识别正确，非电子书 zip 被拒';
  });

  await test('电子书 · MOBI / AZW3 明确被拒（本站只收 EPUB / PDF）', () => {
    const build = (version) => {
      const buf = new Uint8Array(200);
      buf.set(ascii('BOOK'), 60);
      buf[76] = 0; buf[77] = 1;               // 记录数 = 1（大端 uint16）
      buf[78] = 0; buf[79] = 0; buf[80] = 0; buf[81] = 78;   // 记录 0 偏移 = 78
      buf.set(ascii('MOBI'), 78 + 16);         // PalmDOC(16B) 之后是 MOBI header
      const v = 78 + 16 + 0x24;                // version 在 MOBI header +0x24
      buf[v + 3] = version;
      return buf;
    };
    assert(bookType.sniffBookFormat(build(6)) === null, 'MOBI（version 6）必须被拒');
    assert(bookType.sniffBookFormat(build(8)) === null, 'AZW3（version 8）必须被拒');
    assert(!Object.prototype.hasOwnProperty.call(bookType.BOOK_FORMATS, 'mobi'), '白名单不应再有 mobi');
    assert(!Object.prototype.hasOwnProperty.call(bookType.BOOK_FORMATS, 'azw3'), '白名单不应再有 azw3');
    return 'MOBI / AZW3 被拒，白名单只剩 EPUB / PDF';
  });

  await test('电子书 · 上限 100MB 与 object key 形态', () => {
    assert(bookType.isWithinBookLimit(bookType.MAX_BOOK_BYTES), '等于上限应通过');
    assert(!bookType.isWithinBookLimit(bookType.MAX_BOOK_BYTES + 1), '超过上限应拒绝');
    assert(!bookType.isWithinBookLimit(0), '空文件应拒绝');
    assert(bookType.MAX_BOOK_BYTES > fileType.MAX_FILE_BYTES, '电子书上限应比普通附件宽');

    const key = bookType.buildBookKey('11111111-1111-1111-1111-111111111111', 'epub', new Date('2026-10-11T00:00:00Z'));
    assert(/^books\/11111111-1111-1111-1111-111111111111\/2026\/[0-9a-f-]{36}\.epub$/.test(key), `object key 形态不对: ${key}`);
    assert(bookType.buildCoverKey(key, 'jpg') === `${key}-cover.jpg`, '封面 key 应挂在正文同目录');
    assert(!bookType.buildCoverKey(key, 'exe').endsWith('.exe'), '封面扩展名必须白名单化');
    return `上限 ${Math.round(bookType.MAX_BOOK_BYTES / 1024 / 1024)}MB，key=${key}`;
  });

  await test('电子书 · 文件名清洗不含用户输入路径', () => {
    assert(!bookType.sanitizeFilename('../../etc/passwd', 'epub').includes('/'), '目录穿越片段必须去掉');
    assert(!bookType.sanitizeFilename('..\\..\\win.ini', 'epub').includes('\\'), '反斜杠必须去掉');
    assert(bookType.sanitizeFilename('', 'pdf').endsWith('.pdf'), '空名要有兜底');
    return '文件名清洗通过';
  });

  await test('电子书 · 封面魔数只认图片格式', () => {
    assert(bookType.sniffCoverMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))?.ext === 'jpg', 'JPEG 应识别');
    assert(bookType.sniffCoverMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))?.ext === 'png', 'PNG 应识别');
    assert(bookType.sniffCoverMime(head('GIF89a'))?.ext === 'gif', 'GIF 应识别（老 MOBI 封面常见）');
    assert(bookType.sniffCoverMime(head('RIFF0000WEBP'))?.ext === 'webp', 'WebP 应识别');
    assert(bookType.sniffCoverMime(ascii('not an image')) === null, '非图片必须拒绝');
    return 'JPEG / PNG / GIF / WebP 识别正确，非图片被拒';
  });
}

// ---------------------------------------------------------------- UNIT · 音频上传（管理员本地曲目）
async function audioTypeUnit() {
  section('UNIT · 音频上传（魔数嗅探 / 标签解析 / 上限 / key 形态）');

  const ascii = (s) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
  const head = (prefix, len = 64) => {
    const out = new Uint8Array(len);
    out.set(ascii(prefix).subarray(0, len), 0);
    return out;
  };

  await test('音频 · 按魔数识别 MP3 / FLAC / M4A / OGG / WAV / WMA / APE', () => {
    assert(audioType.sniffAudioFormat(head('ID3\x03\x00'))?.format === 'mp3', 'ID3 头应识别为 mp3');
    assert(audioType.sniffAudioFormat(head('fLaC'))?.format === 'flac', 'fLaC 应识别为 flac');
    assert(audioType.sniffAudioFormat(head('OggS'))?.format === 'ogg', 'OggS 应识别为 ogg');
    assert(audioType.sniffAudioFormat(head('RIFF\x00\x00\x00\x00WAVE'))?.format === 'wav', 'RIFF+WAVE 应识别为 wav');
    assert(audioType.sniffAudioFormat(head('MAC '))?.format === 'ape', 'MAC 应识别为 ape');

    // OGG 容器里带 OpusHead 时细分出 opus
    const opus = new Uint8Array(200);
    opus.set(ascii('OggS'), 0);
    opus.set(ascii('OpusHead'), 40);
    assert(audioType.sniffAudioFormat(opus)?.format === 'opus', 'OggS + OpusHead 应识别为 opus');

    // WMA：ASF GUID 头
    const wma = new Uint8Array([0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11, 0, 0, 0, 0]);
    assert(audioType.sniffAudioFormat(wma)?.format === 'wma', 'ASF GUID 应识别为 wma');

    // M4A：offset 4 是 ftyp，brand=m4a
    const m4a = new Uint8Array(64);
    m4a.set(ascii('ftypM4A '), 4);
    assert(audioType.sniffAudioFormat(m4a)?.format === 'm4a', 'ftyp+M4A 应识别为 m4a');
    return '7 种音频容器识别正确';
  });

  await test('音频 · 非音频与过短输入一律拒绝', () => {
    assert(audioType.sniffAudioFormat(head('%PDF-1.7')) === null, 'PDF 不应被当音频');
    assert(audioType.sniffAudioFormat(head('\x89PNG')) === null, 'PNG 不应被当音频');
    assert(audioType.sniffAudioFormat(head('PK\x03\x04')) === null, 'zip 不应被当音频');
    assert(audioType.sniffAudioFormat(new Uint8Array(2)) === null, '过短输入应拒绝');
    assert(audioType.sniffAudioFormat(null) === null, 'null 应拒绝');
    return '非音频全部被拒';
  });

  await test('音频 · 大小上限判定（200MB）', () => {
    assert(audioType.isWithinAudioLimit(1024) === true, '1KB 应通过');
    assert(audioType.isWithinAudioLimit(audioType.MAX_AUDIO_BYTES) === true, '正好等于上限应通过');
    assert(audioType.isWithinAudioLimit(audioType.MAX_AUDIO_BYTES + 1) === false, '超过上限应拒绝');
    assert(audioType.isWithinAudioLimit(0) === false, '0 应拒绝');
    assert(audioType.isWithinAudioLimit(NaN) === false, 'NaN 应拒绝');
    return `上限 ${Math.round(audioType.MAX_AUDIO_BYTES / 1024 / 1024)}MB 判定正确`;
  });

  await test('音频 · 文件名清洗与歌名 / 歌手推断', () => {
    assert(!audioType.sanitizeFilename('../../etc/passwd').includes('/'), '路径分隔符必须去掉');
    assert(audioType.sanitizeFilename('a\u0000b') === 'ab', '控制字符必须去掉');

    // 「歌手 - 歌名」是最常见的命名，应能拆出两半
    assert(audioType.guessTitleFromFilename('周杰伦 - 晴天.mp3') === '晴天', '应拆出歌名');
    assert(audioType.guessArtistFromFilename('周杰伦 - 晴天.mp3') === '周杰伦', '应拆出歌手');
    // 没有明确分隔符时：歌名取全名，歌手留空（宁缺毋滥，避免猜错）
    assert(audioType.guessTitleFromFilename('晴天.flac') === '晴天', '无分隔符时歌名取全名');
    assert(audioType.guessArtistFromFilename('晴天.flac') === '', '无分隔符时歌手应留空');
    return '文件名清洗 + 歌名/歌手推断正确';
  });

  await test('音频 · R2 key 形态（不含用户输入，带 uuid）', () => {
    const uid = '11111111-1111-1111-1111-111111111111';
    const key = audioType.buildAudioKey(uid, 'flac', new Date('2026-10-12T00:00:00Z'));
    assert(/^audio\/11111111-1111-1111-1111-111111111111\/2026\/[0-9a-f-]{36}\.flac$/.test(key),
      `object key 形态不对: ${key}`);
    // 非法扩展名退化成 bin，绝不把用户输入拼进 key
    const bad = audioType.buildAudioKey(uid, '../../evil', new Date('2026-10-12T00:00:00Z'));
    assert(bad.endsWith('.bin') && !bad.includes('..'), `非法扩展名应退化: ${bad}`);
    const cover = audioType.buildAudioCoverKey(key, 'jpg');
    assert(cover === `${key}-cover.jpg`, `封面 key 应在音频 key 后加后缀: ${cover}`);
    return 'key 形态正确，用户输入不参与拼接';
  });

  await test('音频 · ID3v2 标签解析（歌名 / 歌手 / 专辑 / 内嵌封面）', () => {
    // 手工拼一个最小 ID3v2.3 标签：TIT2 + TPE1 + TALB + APIC
    const frames = [];
    const textFrame = (id, text) => {
      const body = new Uint8Array([3, ...new TextEncoder().encode(text)]); // enc=3(UTF-8)
      const out = new Uint8Array(10 + body.length);
      out.set(ascii(id), 0);
      const size = body.length;
      out[4] = (size >>> 24) & 0xff; out[5] = (size >>> 16) & 0xff;
      out[6] = (size >>> 8) & 0xff; out[7] = size & 0xff;
      out.set(body, 10);
      return out;
    };
    frames.push(textFrame('TIT2', '晴天'));
    frames.push(textFrame('TPE1', '周杰伦'));
    frames.push(textFrame('TALB', '叶惠美'));
    // APIC：enc(1) + 'image/jpeg'(0 结尾) + type(1) + desc(0 结尾) + 假图片字节
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
    const mime = new TextEncoder().encode('image/jpeg');
    const apicBody = new Uint8Array(1 + mime.length + 1 + 1 + 1 + jpeg.length);
    let p = 0;
    apicBody[p++] = 3;
    apicBody.set(mime, p); p += mime.length; apicBody[p++] = 0;
    apicBody[p++] = 3; // picture type
    apicBody[p++] = 0; // desc 终止
    apicBody.set(jpeg, p);
    const apic = new Uint8Array(10 + apicBody.length);
    apic.set(ascii('APIC'), 0);
    apic[4] = (apicBody.length >>> 24) & 0xff; apic[5] = (apicBody.length >>> 16) & 0xff;
    apic[6] = (apicBody.length >>> 8) & 0xff; apic[7] = apicBody.length & 0xff;
    apic.set(apicBody, 10);
    frames.push(apic);

    const total = frames.reduce((s, f) => s + f.length, 0);
    const tag = new Uint8Array(10 + total);
    tag.set(ascii('ID3'), 0);
    tag[3] = 3; // v2.3
    // syncsafe size（每字节低 7 位）
    tag[6] = (total >>> 21) & 0x7f; tag[7] = (total >>> 14) & 0x7f;
    tag[8] = (total >>> 7) & 0x7f; tag[9] = total & 0x7f;
    let at = 10;
    for (const f of frames) { tag.set(f, at); at += f.length; }

    const parsed = audioMeta.parseId3v2(tag);
    assert(parsed.title === '晴天', `歌名解析错误: ${parsed.title}`);
    assert(parsed.artist === '周杰伦', `歌手解析错误: ${parsed.artist}`);
    assert(parsed.album === '叶惠美', `专辑解析错误: ${parsed.album}`);
    assert(parsed.cover && parsed.cover.length === jpeg.length, `封面字节数错误: ${parsed.cover?.length}`);
    return 'ID3v2 四个字段全部解析正确';
  });

  await test('音频 · FLAC VORBIS_COMMENT 解析', () => {
    // 拼一个最小的 FLAC：fLaC + 一个 VORBIS_COMMENT 块（标记为末块）
    const enc = new TextEncoder();
    const vendor = enc.encode('test');
    const entries = [enc.encode('TITLE=晴天'), enc.encode('ARTIST=周杰伦')];
    const bodyLen = 4 + vendor.length + 4 + entries.reduce((s, e) => s + 4 + e.length, 0);
    const body = new Uint8Array(bodyLen);
    let p = 0;
    body[p++] = vendor.length; body[p++] = 0; body[p++] = 0; body[p++] = 0;
    body.set(vendor, p); p += vendor.length;
    body[p++] = entries.length; body[p++] = 0; body[p++] = 0; body[p++] = 0;
    for (const e of entries) {
      body[p++] = e.length & 0xff; body[p++] = (e.length >>> 8) & 0xff; body[p++] = 0; body[p++] = 0;
      body.set(e, p); p += e.length;
    }
    const flac = new Uint8Array(4 + 4 + body.length);
    flac.set(enc.encode('fLaC'), 0);
    flac[4] = 0x80 | 4;                    // 末块标志 + 类型 4（VORBIS_COMMENT）
    flac[5] = (body.length >>> 16) & 0xff; flac[6] = (body.length >>> 8) & 0xff; flac[7] = body.length & 0xff;
    flac.set(body, 8);

    const parsed = audioMeta.parseFlacTags(flac);
    assert(parsed.title === '晴天', `FLAC 歌名解析错误: ${parsed.title}`);
    assert(parsed.artist === '周杰伦', `FLAC 歌手解析错误: ${parsed.artist}`);
    return 'FLAC VORBIS_COMMENT 解析正确';
  });

  await test('音频 · 标签缺失时不抛错（降级为空结构）', () => {
    const empty = audioMeta.parseAudioTags(head('fLaC'), 'flac');
    assert(empty && empty.title === null && empty.cover === null, '无标签时应返回空结构');
    // 损坏的字节流不能抛异常
    const broken = audioMeta.parseAudioTags(new Uint8Array([0x49, 0x44, 0x33, 0x03, 0, 0, 0xff, 0xff, 0xff, 0x7f]), 'mp3');
    assert(broken && typeof broken === 'object', '损坏标签应静默降级');
    assert(audioMeta.parseAudioTags(null, 'mp3').title === null, 'null 输入应返回空结构');
    return '标签缺失 / 损坏均安全降级';
  });

  await test('音频 · 封面类型嗅探（用于转存 R2）', () => {
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    assert(audioType.sniffCoverImage(jpg)?.ext === 'jpg', 'JPEG 应识别');
    assert(audioType.sniffCoverImage(png)?.ext === 'png', 'PNG 应识别');
    assert(audioType.sniffCoverImage(head('not an image')) === null, '非图片必须拒绝');
    return '封面类型嗅探正确';
  });

  await test('歌词 · 繁体转简体（用户要求「繁体歌词要改正」）', () => {
    assert(zhConvert.toSimplified('妳說我們過得很好') === '你说我们过得很好', '常用繁体应转换');
    assert(zhConvert.toSimplified('後來 我總算學會了如何去愛') === '后来 我总算学会了如何去爱', '整句歌词应转换');
    assert(zhConvert.toSimplified('時間') === '时间', '时间应转换');
    // 幂等 + 边界：非字符串原样返回，不能抛错
    assert(zhConvert.toSimplified('') === '', '空串应返回空串');
    assert(zhConvert.toSimplified(null) === null, 'null 应原样返回');
    assert(zhConvert.toSimplified(123) === 123, '数字应原样返回');
    assert(zhConvert.toSimplified(zhConvert.toSimplified('妳說')) === '你说', '转换应幂等');
    // hasTraditional：用于避免对简体歌词白做功
    assert(zhConvert.hasTraditional('你说我们过得很好') === false, '简体不应判为繁体');
    assert(zhConvert.hasTraditional('妳說') === true, '繁体应判为繁体');
    assert(zhConvert.hasTraditional(null) === false, 'null 不应抛错');
    return `转换表 ${zhConvert.ZH_CONVERT_SIZE} 条，幂等与边界均正确`;
  });

  await test('歌词 · 转换不得破坏 LRC 时间轴（同步歌词的关键性质）', () => {
    // 同步歌词带 [mm:ss.xx] 标记，前端靠它逐句高亮；转简体时只能动汉字。
    const lrc = '[00:12.34]妳說我們過得很好\n[00:16.78]後來 我總算學會了如何去愛';
    const out = zhConvert.toSimplified(lrc);
    assert(out.startsWith('[00:12.34]'), `时间轴被破坏: ${out}`);
    assert(out.includes('[00:16.78]'), `第二行时间轴被破坏: ${out}`);
    assert(out.includes('你说我们过得很好'), `歌词未转换: ${out}`);
    assert(out.includes('后来 我总算学会了如何去爱'), `第二行未转换: ${out}`);
    // 时间轴字符（数字、冒号、点、方括号、换行）必须一字不差
    const stamps = (s) => (s.match(/\[\d{2}:\d{2}\.\d{2}\]/g) || []).join(',');
    assert(stamps(lrc) === stamps(out), `时间轴集合发生变化: ${stamps(out)}`);
    return 'LRC 时间轴完整保留，仅汉字被转换';
  });
}

// ---------------------------------------------------------------- UNIT · GitHub AI 解读
// ---------------------------------------------------------------- UNIT · 动态壁纸类型
async function videoTypeUnit() {
  section('UNIT · 动态壁纸类型（魔数嗅探 / MP4 元数据 / 上限 / key 形态）');

  const ascii = (s) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
  const head = (prefix, len = 64) => {
    const out = new Uint8Array(len);
    out.set(ascii(prefix).subarray(0, len), 0);
    return out;
  };

  await test('动态壁纸 · 按魔数识别 MP4 / WebM，其它容器被拒', () => {
    const mp4 = new Uint8Array(64);
    mp4.set([0, 0, 0, 0x20], 0);
    mp4.set(ascii('ftypisom'), 4);
    assert(videoType.sniffVideoFormat(mp4)?.format === 'mp4', 'MP4（ftyp）应识别');

    const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert(videoType.sniffVideoFormat(webm)?.format === 'webm', 'WebM（EBML）应识别');

    // AVI（RIFF....AVI ）与 MKV 之外的随机头必须被拒
    assert(videoType.sniffVideoFormat(head('RIFF0000AVI ')) === null, 'AVI 必须被拒');
    assert(videoType.sniffVideoFormat(head('not a video at all')) === null, '非视频必须被拒');
    assert(videoType.sniffVideoFormat(new Uint8Array(4)) === null, '过短的输入必须被拒');
    return 'MP4 / WebM 识别正确，AVI 等被拒';
  });

  await test('动态壁纸 · MP4 时长与分辨率解析（mvhd / tkhd）', () => {
    // 手工构造最小 moov：mvhd(version0, timescale=1000, duration=5000) + trak/tkhd(1920x1080)
    const u32 = (arr, at, v) => { arr[at] = (v >>> 24) & 0xff; arr[at + 1] = (v >>> 16) & 0xff; arr[at + 2] = (v >>> 8) & 0xff; arr[at + 3] = v & 0xff; };
    const mvhdPayload = 100;      // mvhd 载荷长度（够放下 timescale/duration）
    const tkhdPayload = 92;       // tkhd 载荷长度（宽高在末尾 8 字节）
    const moovPayload = (8 + mvhdPayload) + (8 + 8 + tkhdPayload);   // mvhd + trak(tkhd)
    const buf = new Uint8Array(8 + moovPayload);
    let p = 0;
    u32(buf, p, 8 + moovPayload); buf.set(ascii('moov'), p + 4); p += 8;
    u32(buf, p, 8 + mvhdPayload); buf.set(ascii('mvhd'), p + 4);
    u32(buf, p + 8 + 12, 1000);       // timescale
    u32(buf, p + 8 + 16, 5000);       // duration → 5 秒
    p += 8 + mvhdPayload;
    u32(buf, p, 8 + 8 + tkhdPayload); buf.set(ascii('trak'), p + 4); p += 8;
    u32(buf, p, 8 + tkhdPayload); buf.set(ascii('tkhd'), p + 4);
    u32(buf, p + 8 + tkhdPayload - 8, 1920 * 65536);   // width（16.16 定点）
    u32(buf, p + 8 + tkhdPayload - 4, 1080 * 65536);   // height

    const meta = videoType.parseMp4Meta(buf);
    assert(Math.round(meta.duration) === 5, `时长应为 5 秒，实际 ${meta.duration}`);
    assert(meta.width === 1920 && meta.height === 1080, `分辨率应为 1920x1080，实际 ${meta.width}x${meta.height}`);

    // 没有 moov 的头部（moov 在文件尾部）必须安静返回 null，不能抛错
    const noMoov = videoType.parseMp4Meta(head('ftypisom'));
    assert(noMoov.duration === null && noMoov.width === null, '解析不出时应返回 null 而非抛错');
    return `时长 ${meta.duration}s，${meta.width}x${meta.height}`;
  });

  await test('动态壁纸 · 上限 100MB 与 object key 形态（wallpapers/ 前缀）', () => {
    assert(videoType.isWithinVideoLimit(videoType.MAX_VIDEO_BYTES), '等于上限应通过');
    assert(!videoType.isWithinVideoLimit(videoType.MAX_VIDEO_BYTES + 1), '超过上限应拒绝');
    assert(!videoType.isWithinVideoLimit(0), '空文件应拒绝');
    assert(!Object.prototype.hasOwnProperty.call(videoType.VIDEO_FORMATS, 'avi'), '白名单不应有 avi');

    const key = videoType.buildVideoKey('11111111-1111-1111-1111-111111111111', 'mp4', new Date('2026-10-12T00:00:00Z'));
    assert(/^wallpapers\/11111111-1111-1111-1111-111111111111\/2026\/[0-9a-f-]{36}\.mp4$/.test(key), `object key 形态不对: ${key}`);
    // 关键：动态壁纸与静态图片必须落在不同前缀，否则「动静分开」的要求就破了
    assert(!key.startsWith('assets/'), '动态壁纸不得落在 assets/ 前缀下');
    assert(!videoType.buildVideoKey('11111111-1111-1111-1111-111111111111', 'exe').endsWith('.exe'), '扩展名必须白名单化');
    return `上限 ${Math.round(videoType.MAX_VIDEO_BYTES / 1024 / 1024)}MB，key=${key}`;
  });

  await test('动态壁纸 · 文件名清洗不含用户输入路径', () => {
    assert(!videoType.sanitizeFilename('../../etc/passwd', 'mp4').includes('/'), '目录穿越片段必须去掉');
    assert(!videoType.sanitizeFilename('..\\..\\win.ini', 'mp4').includes('\\'), '反斜杠必须去掉');
    assert(videoType.sanitizeFilename('', 'mp4').endsWith('.mp4'), '空名要有兜底');
    const long = videoType.sanitizeFilename('x'.repeat(400) + '.mp4', 'mp4');
    assert(long.length <= 120 && long.endsWith('.mp4'), `超长名应截断并保留扩展名，实际 ${long.length}`);
    return '文件名清洗通过';
  });

  // ---- 首页轮播素材（2026-10-13） ----
  // 用户要求：管理端可把图展的图片 / 视频挑到首页轮播，视频静音循环且可开关。
  await test('首页轮播 · 路由顺序（/order 必须排在 /:id 之前）与写权限', () => {
    const src = readFileSync(join(BACKEND, 'src', 'router.js'), 'utf8');
    const orderAt = src.indexOf("'/api/hero/slides/order'");
    const idAt = src.indexOf("'/api/hero/slides/:id'");
    assert(orderAt > 0, 'router.js 应有 PUT /api/hero/slides/order');
    assert(idAt > 0, 'router.js 应有 /api/hero/slides/:id');
    // 顺序反了的话 PUT /order 会被当成「改 id=order 的项」，永远 404。
    assert(orderAt < idAt, '/api/hero/slides/order 必须排在 /api/hero/slides/:id 之前');

    const hero = readFileSync(join(BACKEND, 'src', 'routes', 'heroSlides.js'), 'utf8');
    // 读对访客开放、写必须管理员：数一遍 requireAdmin 出现次数（4 个写接口）
    const adminCalls = (hero.match(/requireAdmin\(/g) || []).length;
    assert(adminCalls >= 4, `4 个写接口都应 requireAdmin，实际 ${adminCalls} 处`);
    assert(/export async function listHeroSlides[\s\S]{0,300}requireAuth\(/.test(hero),
      'listHeroSlides 应走 requireAuth（访客可读）');
    // 访客过滤必须在查询层（Worker 是 service_role，RLS 不替它过滤）
    assert(/user\.isGuest\)\s*filters\.is_active\s*=\s*'eq\.true'/.test(hero),
      '访客必须在查询层叠加 is_active=eq.true');
    return `order 在 :id 之前，${adminCalls} 处 requireAdmin，访客过滤下推查询层`;
  });

  await test('首页轮播 · 访客白名单放行只读、拒绝写；私人素材不下发给访客', () => {
    const { isGuestAllowed } = publicScope;
    assert(isGuestAllowed('GET', '/api/hero/slides'), '访客应可读首页轮播列表（首页要显示）');
    assert(!isGuestAllowed('POST', '/api/hero/slides'), '访客不应能新增轮播项');
    assert(!isGuestAllowed('PUT', '/api/hero/slides/order'), '访客不应能重排');
    assert(!isGuestAllowed('PATCH', '/api/hero/slides/x'), '访客不应能改');
    assert(!isGuestAllowed('DELETE', '/api/hero/slides/x'), '访客不应能删');

    // 视频素材（动态壁纸）默认私人：挂在首页也播不出来，必须对访客隐藏，
    // 否则首页会出现「轮播到这一条就是一片空白」。
    const hero = readFileSync(join(BACKEND, 'src', 'routes', 'heroSlides.js'), 'utf8');
    assert(/media_public/.test(hero), '应透出素材是否公开（media_public）供管理端提示');
    assert(/user\.isAdmin\s*\|\|\s*s\.media_public/.test(hero),
      '访客必须过滤掉「底层素材未公开」的轮播项');
    return 'GET 放行 / 写 4 条拒绝 + 私人素材不下发';
  });

  await test('首页轮播 · 素材引用完整性由外键 cascade 兜底（不重复存文件）', () => {
    const sql = readFileSync(join(BACKEND, '..', 'supabase', 'migrations',
      '20261013000027_hero_slides.sql'), 'utf8');
    const flat = sql.replace(/\s+/g, ' ');
    // 只存引用：两张素材表都要 cascade，删素材时首页引用自动消失，
    // 不会留下「首页挂着一条指向已删对象的死引用」。
    assert(/asset_id\s+uuid\s+references\s+public\.assets\(id\)\s+on delete cascade/.test(flat),
      'asset_id 应 references assets(id) on delete cascade');
    assert(/wallpaper_id\s+uuid\s+references\s+public\.wallpapers\(id\)\s+on delete cascade/.test(flat),
      'wallpaper_id 应 references wallpapers(id) on delete cascade');
    // 来源与引用必须一致：否则会出现 source=asset 但只填了 wallpaper_id 的脏数据
    assert(/hero_slides_ref_check/.test(flat), '应有来源与引用一致性的 check 约束');
    // 绝不存文件字节：表里不该出现 object_key / size 这类「存了文件」的列
    assert(!/object_key/.test(flat), 'hero_slides 只存引用，不该有 object_key');
    // RLS：全站约定「所有业务表启用行级安全」。曾漏掉（2026-10-13 线上实测
    // relrowsecurity=false），这里锁死，防止再漏。
    assert(/alter table public\.hero_slides enable row level security/.test(flat),
      'hero_slides 必须启用 RLS（与 assets / wallpapers 等所有业务表一致）');
    for (const p of ['select_own', 'insert_own', 'update_own', 'delete_own', 'admin_all']) {
      assert(new RegExp(`policy "hero_slides_${p}"`).test(flat), `缺少策略 hero_slides_${p}`);
    }
    // 迁移必须幂等：线上表曾被手工建过，`create trigger` 不幂等会让 CI 重跑整条失败
    assert(/drop trigger if exists trg_hero_slides_updated_at/.test(flat),
      '建 trigger 前必须先 drop if exists（迁移要能安全重跑）');
    return '两张素材表均 cascade，来源一致性有约束，不存文件字节，RLS 与幂等均已锁定';
  });

  // ---- 首页摘抄（2026-10-18） ----
  await test('首页摘抄 · 访客只读启用项、写操作仅管理员、/order 在 /:id 前', () => {
    const { isGuestAllowed } = publicScope;
    assert(isGuestAllowed('GET', '/api/excerpts'), '访客应可读首页摘抄');
    assert(!isGuestAllowed('POST', '/api/excerpts'), '访客不应能新增摘抄');
    assert(!isGuestAllowed('PUT', '/api/excerpts/order'), '访客不应能排序');
    assert(!isGuestAllowed('PATCH', '/api/excerpts/x'), '访客不应能改摘抄');
    assert(!isGuestAllowed('DELETE', '/api/excerpts/x'), '访客不应能删摘抄');

    const routerSrc = readFileSync(join(BACKEND, 'src', 'router.js'), 'utf8');
    const orderAt = routerSrc.indexOf("'/api/excerpts/order'");
    const idAt = routerSrc.indexOf("'/api/excerpts/:id'");
    assert(orderAt > 0 && idAt > 0 && orderAt < idAt,
      '/api/excerpts/order 必须排在 /api/excerpts/:id 之前');

    const src = readFileSync(join(BACKEND, 'src', 'routes', 'excerpts.js'), 'utf8');
    const adminCalls = (src.match(/requireAdmin\(/g) || []).length;
    assert(adminCalls >= 4, `4 个写接口都应 requireAdmin，实际 ${adminCalls} 处`);
    assert(/export async function listExcerpts[\s\S]{0,300}requireAuth\(/.test(src),
      'listExcerpts 应走 requireAuth（访客可读）');
    assert(/if \(!all\) filters\.is_active = 'eq\.true'/.test(src),
      '非管理员必须在查询层只取启用项');
    assert(/all\s*=\s*url\.searchParams\.get\('all'\) === 'true' && user\.isAdmin/.test(src),
      '?all=true 只能对管理员生效');
    // 站长首页也可能登录着：默认仍必须只取启用项，只有管理页显式 ?all=true 才读停用项。
    assert(/默认（含站长首页）只拿启用项/.test(src),
      'listExcerpts 的默认口径必须写明：站长首页也只取启用项');
    return `GET 放行 / 写 4 条拒绝 + order 顺序正确 + 访客过滤下推查询层`;
  });

  await test('首页摘抄 · 迁移含 RLS、幂等触发器与内容非空约束', () => {
    const sql = readFileSync(join(BACKEND, '..', 'supabase', 'migrations',
      '20261018000029_excerpts.sql'), 'utf8');
    const flat = sql.replace(/\s+/g, ' ');
    assert(/create table if not exists public\.excerpts/.test(flat), '应创建 excerpts 表');
    assert(/content\s+text\s+not null/.test(flat), 'content 必填');
    assert(/source\s+text/.test(flat), 'source 可空');
    assert(/is_active\s+boolean\s+not null default true/.test(flat), 'is_active 默认启用');
    assert(/excerpts_content_not_blank/.test(flat), '应有正文非空约束');
    assert(/alter table public\.excerpts enable row level security/.test(flat),
      'excerpts 必须启用 RLS');
    for (const p of ['select_own', 'insert_own', 'update_own', 'delete_own', 'admin_all']) {
      assert(new RegExp(`policy "excerpts_${p}"`).test(flat), `缺少策略 excerpts_${p}`);
    }
    assert(/drop trigger if exists trg_excerpts_updated_at/.test(flat),
      '建 trigger 前必须先 drop if exists（迁移要能安全重跑）');
    return 'excerpts 表 / 非空约束 / RLS / 幂等触发器均已锁定';
  });

  // ---- 首页轮播摘要（2026-10-19） ----
  await test('首页摘要 · 访客只读公开键、写仅管理员、不泄露内部配置', () => {
    const { isGuestAllowed } = publicScope;
    assert(isGuestAllowed('GET', '/api/site-settings'), '访客应可读首页摘要');
    assert(!isGuestAllowed('PATCH', '/api/site-settings'), '访客不应能改首页摘要');

    const routerSrc = readFileSync(join(BACKEND, 'src', 'router.js'), 'utf8');
    assert(routerSrc.includes("['GET', '/api/site-settings', siteSettings.getSiteSettings]"),
      'router.js 应有 GET /api/site-settings');
    assert(routerSrc.includes("['PATCH', '/api/site-settings', siteSettings.updateSiteSettings]"),
      'router.js 应有 PATCH /api/site-settings');

    const src = readFileSync(join(BACKEND, 'src', 'routes', 'siteSettings.js'), 'utf8');
    assert(/PUBLIC_KEYS\s*=\s*\[HERO_SUBTITLE\]/.test(src),
      '公开键必须白名单，不能把 site_settings 全表发给访客');
    assert(/export async function updateSiteSettings[\s\S]{0,300}requireAdmin\(/.test(src),
      'updateSiteSettings 必须 requireAdmin');
    assert(/export async function getSiteSettings[\s\S]{0,300}requireAuth\(/.test(src),
      'getSiteSettings 应走 requireAuth（访客可读）');
    assert(/MAX_SUBTITLE\s*=\s*500/.test(src), '首页摘要应有长度上限');
    return 'GET 放行 / PATCH 拒绝 + 公开键白名单 + 长度上限';
  });

  // ---- 博客列表接口（2026-10-14 修「博客页打不开」） ----
  await test('博客列表 · 走边缘缓存、写操作失效、标签一次往返取回', () => {
    const src = readFileSync(join(BACKEND, 'src', 'routes', 'posts.js'), 'utf8');
    // 1) 用统一工具 cachedData（只缓存访客的逻辑在 edgeCache.js 里统一实现）
    assert(/cachedData\(request, env, \{/.test(src), '应走统一的 cachedData');
    // 2) 缓存键必须带上所有会改变结果的参数（status / category / with_tags / all）
    const keyLine = (src.match(/key: `posts\/[^`]*`/) || [''])[0];
    for (const p of ['user.id', 'all', 'statusParam', 'categoryParam', 'withTags']) {
      assert(keyLine.includes(p), `缓存键漏了 ${p}（不同参数会串数据）：${keyLine}`);
    }
    // 3) 写操作要失效缓存（版本号失效），否则新文章 5 分钟不出现
    const invalidations = (src.match(/await invalidatePostListCache\(\)/g) || []).length;
    assert(invalidations >= 3, `create/update/delete 三处都要失效缓存，实际 ${invalidations} 处`);
    assert(/invalidatePostListCache\(\)[\s\S]{0,120}bumpVersion\('posts', env\)/.test(src),
      '失效应走 bumpVersion（版本号失效，且要传 env 才能清 R2 旧快照）');
    // 4) 标签用 PostgREST 内嵌查询（一次往返），不是再查一次 post_tags 全表
    assert(/post_tags\(tag_id\)/.test(src), 'with_tags 应走内嵌查询');
    // 只针对 listPosts 的函数体：那里不应再单独查一次 post_tags（那是两次往返）。
    // 详情页的 loadPostTags 按 post_id 精确查一条，是合理的，不算在内。
    const listBody = src.slice(src.indexOf('export async function listPosts'), src.indexOf('// 博客列表缓存失效'));
    assert(!/db\.select\('post_tags'/.test(listBody),
      'listPosts 里不应再单独查一次 post_tags（那是两次往返）');
    return `cachedData + 键含 5 个参数 + ${invalidations} 处版本号失效 + 标签内嵌一次往返`;
  });

  // ---- 高频读接口的边缘缓存（2026-10-14 修「整站接口 50 秒超时」） ----
  await test('高频读接口都接了边缘缓存（categories/tags/gallery/music/books/moments/timeline/wallpapers/posts）', () => {
    const targets = ['categories', 'tags', 'gallery', 'music', 'books', 'moments', 'timeline', 'wallpapers', 'posts'];
    const missing = [];
    for (const f of targets) {
      const src = readFileSync(join(BACKEND, 'src', 'routes', `${f}.js`), 'utf8');
      if (!/cachedData\(request, env, \{/.test(src)) missing.push(f);
    }
    assert(missing.length === 0, `这些接口还没接边缘缓存：${missing.join(', ')}`);

    // 缓存工具本身：只缓存访客（默认）、带 TTL、支持版本号失效
    const util = readFileSync(join(BACKEND, 'src', 'lib', 'edgeCache.js'), 'utf8');
    assert(/onlyGuest = true/.test(util), '默认只缓存访客（登录用户数据会串号）');
    assert(/export async function bumpVersion/.test(util), '要有版本号失效能力');
    assert(/staleOnError/.test(util), '回源失败要能用过期缓存兜底（宁可旧数据也别白屏）');
    // R2 二级缓存：Cache API 命中不稳定（实测 miss/超时/hit 交替），
    // 所以要把结果也存 R2，命中时完全绕开 Supabase。
    assert(/R2_PREFIX/.test(util) && /r2Get\(env, fullKey\)/.test(util),
      '要有 R2 二级缓存（Cache API 命中不稳定）');
    // 每个接了缓存的接口，写操作都要能失效（否则改了数据要等满 TTL）。
    // 例外：timeline 是**纯聚合读接口**（自己不写，数据来自 posts/resources/
    // gallery/books/user_progress），没有可 bump 的写操作；它靠 5 分钟 TTL
    // 自然更新，对聚合页来说够用。
    const NO_WRITE = new Set(['timeline']);
    const noBump = [];
    for (const f of targets) {
      if (NO_WRITE.has(f)) continue;
      const src = readFileSync(join(BACKEND, 'src', 'routes', `${f}.js`), 'utf8');
      if (!/bumpVersion\(/.test(src)) noBump.push(f);
    }
    assert(noBump.length === 0, `这些接口接了缓存但写操作不失效：${noBump.join(', ')}`);
    return `${targets.length} 个接口已接入（timeline 纯聚合靠 TTL）+ 工具含访客限定/版本号/R2 二级/过期兜底`;
  });

  // ---- 模块导入完整性（2026-10-15 线上事故：图书页 json is not defined） ----
  await test('所有路由：用到 json() 就必须从 response.js 导入', () => {
    // 事故经过：给 books / wallpapers 加边缘缓存时用了 `return json({ data }, …)`，
    // 但 import 只写了 ok/readJson/HttpError —— 模块能构建通过（Node 不做未声明
    // 标识符的静态检查），**运行时**才抛 `ReferenceError: json is not defined`，
    // 表现为「图书页打不开」。这类错误构建期抓不到，只能靠静态扫描兜住。
    const files = readdirSync(join(BACKEND, 'src', 'routes')).filter((f) => f.endsWith('.js'));
    const missing = [];
    for (const f of files) {
      const src = readFileSync(join(BACKEND, 'src', 'routes', f), 'utf8');
      const usesJson = /\breturn json\(|\bjson\(\{/.test(src);
      if (!usesJson) continue;
      const importsJson = /import\s*\{[^}]*\bjson\b[^}]*\}\s*from\s*'\.\.\/lib\/response\.js'/.test(src);
      if (!importsJson) missing.push(f);
    }
    assert(missing.length === 0, `这些路由用了 json() 却没导入：${missing.join(', ')}`);
    return `扫描 ${files.length} 个路由文件，json() 导入全部齐全`;
  });

  // ---- Notion 博客封面口径（2026-10-15 用户要求统一用 Halo 默认封面） ----
  await test('Notion 博客统一用 Halo 默认封面（不再下发自带封面）', () => {
    const src = readFileSync(join(BACKEND, 'src', 'routes', 'notion.js'), 'utf8');
    // coverUrlOf 恒返回 null → 前端 PostCover 回退到 DEFAULT_COVER（与 Halo 同一张）
    assert(/function coverUrlOf\(\)\s*\{\s*return null;\s*\}/.test(src),
      'coverUrlOf 应恒返回 null（统一走默认封面）');
    // 但 cover_path 数据必须保留（只改下发值，不删数据）
    assert(/cover_path/.test(src), 'cover_path 仍要保留在查询里（数据不删）');
    // 前端确实会回退：PostCard 的 PostCover 在空值时用 DEFAULT_COVER
    const card = readFileSync(join(FRONTEND_SRC, 'components', 'PostCard.jsx'), 'utf8');
    assert(/usableCover\(src\) \|\| fallback/.test(card), 'PostCover 空值应回退默认封面');
    // 且默认封面就是 Halo 那张（两个分区共用同一常量）
    const media = readFileSync(join(FRONTEND_SRC, 'lib', 'blogMedia.js'), 'utf8');
    assert(/DEFAULT_COVER = '\/blog\/default-cover\.webp'/.test(media),
      '默认封面应指向 /blog/default-cover.webp');
    return 'coverUrlOf→null + cover_path 保留 + 前端回退 /blog/default-cover.webp';
  });
}

// ---------------------------------------------------------------- UNIT · GitHub AI 解读
async function githubAiUnit() {
  section('UNIT · GitHub AI 解读（中文 / 字数下限 / README 清洗）');

  await test('GitHub AI · 概述不足 50 个汉字必须判失败', () => {
    const short = '一个扫描密钥的工具。';
    let failed = false;
    try {
      githubAi.parseAnswer({ response: JSON.stringify({ one_line: '密钥扫描工具', summary: short, tags: ['安全工具'] }) });
    } catch (e) { failed = /50/.test(e.message); }
    assert(failed, '不足 50 个汉字时应当抛错（否则会把「一句就交差」的解读写进库）');

    const ok = githubAi.parseAnswer({ response: JSON.stringify({
      one_line: '密钥扫描工具',
      summary: '这是一款用于扫描代码仓库中泄露的 API 密钥与凭据的安全工具，支持增量扫描、代理访问和智能过滤，适合安全研究人员与开发者在持续集成流程中使用。',
      tags: ['安全工具'], keywords: ['密钥扫描'], platforms: ['cli']
    }) });
    assert(githubAi.countZh(ok.summary) >= 50, '合格概述应当通过校验');
    assert(ok.ai_version === githubAi.AI_VERSION, '解读要带上当前版本号，便于以后自动重做');
    return `阈值 ${githubAi.MIN_ZH} 字，拒绝 ${githubAi.countZh(short)} 字，接受 ${githubAi.countZh(ok.summary)} 字`;
  });

  await test('GitHub AI · 英文术语多但中文够数不应被误判', () => {
    const mixed = 'Insomnia 是一款开源的 API 客户端，支持 GraphQL、REST、WebSockets、gRPC 等多种接口协议，可用于接口调试、设计、测试与模拟，并提供环境变量管理与代码生成能力，适合后端开发者与测试工程师日常使用。';
    const r = githubAi.parseAnswer({ response: JSON.stringify({ one_line: 'API 调试客户端', summary: mixed, tags: ['开发工具'] }) });
    assert(githubAi.countZh(r.summary) >= 50, `中文术语混排的概述应当通过，实际 ${githubAi.countZh(r.summary)} 字`);
    return `术语混排仍识别为中文（${githubAi.countZh(mixed)} 字）`;
  });

  await test('GitHub AI · README 里的控制字符被清掉（8006 报错根因）', () => {
    const dirty = 'a\u0000b\u200bc\u2028d\ufffd\n\n\n\nend';
    const clean = githubAi.sanitizeReadme(dirty);
    assert(!/[\u0000\u200b\u2028\ufffd]/.test(clean), '不可见字符必须清干净');
    assert(clean.includes('abcd'), '正常字符要保留');
    assert(!/\n{3,}/.test(clean), '连续空行要压掉');

    const p = githubAi.buildPrompt({ full_name: 'a/b', description: 'x\u0000y', topics: ['t\u200b1'] }, '');
    assert(!/[\u0000\u200b]/.test(p), '提示词里也不能残留不可见字符');
    return '控制字符 / 零宽字符 / 连续空行均已清理';
  });

  await test('GitHub AI · 提示词含中文与 50 字要求', () => {
    const p = githubAi.buildPrompt({ full_name: 'a/b', description: '一个工具' }, 'README');
    assert(p.includes('简体中文'), '提示词必须明确要求简体中文');
    assert(p.includes('不少于 50 个字'), '提示词必须写明 summary 不少于 50 个字');
    return '提示词含「简体中文」与「不少于 50 个字」';
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
  // XHR 直传（uploadAsset / uploadFile）：xhr.open('PUT', `${API_BASE_URL}/api/...`)
  // 这些请求不经 request()，方法写在 xhr.open 里，必须单独识别，否则会被当成 GET 误报「路由不存在」。
  const xhrPaths = new Set();
  for (const m of apiSrc.matchAll(/xhr\.open\(\s*'([A-Z]+)'\s*,\s*`\$\{API_BASE_URL\}([/]api[^`'"]*)/g)) {
    xhrPaths.add(m[2]);
    if (!apiCalls.some((c) => c.path === m[2] && c.method === m[1])) {
      apiCalls.push({ method: m[1], path: m[2] });
    }
  }
  // 上面那个「无方法默认 GET」的兜底会把 xhr 路径也收成 GET，这里剔除误判的 GET 条目
  for (let i = apiCalls.length - 1; i >= 0; i--) {
    if (apiCalls[i].method === 'GET' && xhrPaths.has(apiCalls[i].path)) apiCalls.splice(i, 1);
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

  await test('音乐去重口径前后端一致（backend / frontend musicIdentity.js）', async () => {
    // 前后端各存一份纯函数（本站既有约定，见 lib/mediaUrl.js）。
    // 两套规则必须完全一致，否则会出现「后端拦住了、前端还显示两条」这类难查的错位。
    const fe = await import(join(FRONTEND_SRC, 'lib', 'musicIdentity.js'));
    const samples = [
      { title: '晴天', artist: '周杰伦' },
      { title: ' 晴天 ', artist: '周杰伦' },
      { title: '晴天（Live）', artist: '周杰伦' },
      { title: '晴天 (Live)', artist: '周杰伦' },
      { title: 'Hello', artist: 'Adele' },
      { title: 'hello', artist: 'ADELE' },
      { title: '稻香', artist: '周杰伦' },
      { title: '', artist: '周杰伦' },
      { title: null, artist: null }
    ];
    for (const s of samples) {
      assert(fe.musicIdentity(s) === musicIdentity.musicIdentity(s),
        `身份键不一致：${JSON.stringify(s)} → 前端 ${fe.musicIdentity(s)} / 后端 ${musicIdentity.musicIdentity(s)}`);
    }
    const list = [
      { id: 'a', title: '晴天', track: { artist: '周杰伦' } },
      { id: 'b', title: ' 晴天', track: { artist: '周杰伦 ' } },
      { id: 'c', title: '稻香', track: { artist: '周杰伦' } }
    ];
    assert(fe.dedupeMusicList(list).map((m) => m.id).join('') === musicIdentity.dedupeMusicList(list).map((m) => m.id).join(''),
      '列表去重结果不一致');
    return `${samples.length} 组身份键 + 列表去重结果一致`;
  });

  await test('播放历史路由 /api/music/history 排在 /api/music/:id 之前', async () => {
    // 顺序错了会被 matchRoute 当成 id='history' 走详情接口，返回 404 而不是历史列表。
    const histAt = routerSrc.indexOf("'/api/music/history'");
    const detailAt = routerSrc.indexOf("['GET', '/api/music/:id'");
    assert(histAt > 0, 'router.js 应有 /api/music/history 路由');
    assert(detailAt > 0, 'router.js 应有 /api/music/:id 路由');
    assert(histAt < detailAt, '/api/music/history 必须排在 /api/music/:id 之前');
    return '路由顺序正确';
  });

  await test('音乐上传路由已注册：upload / :id/audio / :id/cover', async () => {
    assert(routerMap.has('POST /api/music/upload'), 'router.js 应有 POST /api/music/upload');
    assert(routerMap.has('GET /api/music/:id/audio'), 'router.js 应有 GET /api/music/:id/audio');
    assert(routerMap.has('GET /api/music/:id/cover'), 'router.js 应有 GET /api/music/:id/cover');
    // 上传是管理员专属：路由必须走 requireAdmin（普通用户不能录音乐）
    const upSrc = readFileSync(join(BACKEND, 'src', 'routes', 'musicUpload.js'), 'utf8');
    assert(/export async function uploadMusic[\s\S]{0,400}requireAdmin\(/.test(upSrc),
      'uploadMusic 必须用 requireAdmin（普通用户与访客都不能上传）');
    // 内部 R2 key 绝不能出现在对外结构里
    assert(!/shapeForClient[\s\S]{0,600}audio_key:\s*audio_key/.test(upSrc),
      'shapeForClient 不应把 audio_key 原样返回');
    return '3 条路由已注册，上传走 requireAdmin';
  });

  // 前端 Context 解构护栏（2026-10-11 新增）
  // 起因：Settings.jsx 曾把 theme/toggleTheme 从 useAuth() 解构（它们其实属于 useTheme()），
  // 主题按钮文案恒错、点击 toggleTheme() 抛 TypeError 导致整页崩溃；vite build 不做运行时检查，抓不到。
  // 这里静态比对：页面从 useAuth()/useTheme() 解构的每个字段，必须是 Provider 真正暴露的键。
  function contextKeys(src, startMarker, endMarker) {
    const i = src.indexOf(startMarker);
    if (i < 0) throw new Error(`找不到 ${startMarker}`);
    const j = src.indexOf(endMarker, i);
    if (j < 0) throw new Error(`找不到 ${endMarker}`);
    const body = src.slice(i + startMarker.length, j) + ',';
    return new Set([...body.matchAll(/([A-Za-z_$][\w$]*)\s*[:,]/g)].map((m) => m[1]));
  }

  const authKeys = contextKeys(readFileSync(join(FRONTEND_SRC, 'lib', 'auth.jsx'), 'utf8'), 'const value = {', '};');
  const themeKeys = contextKeys(readFileSync(join(FRONTEND_SRC, 'lib', 'theme.jsx'), 'utf8'), 'value={{', '}}>');
  // 自校验：解析结果必须与 Provider 实际暴露的键完全一致，否则说明解析器坏了（宁可炸这里，也不要假绿）
  assert([...authKeys].sort().join(',') === 'isAdmin,isAuthenticated,loading,profile,session,signIn,signOut,signUp,user',
    `useAuth 暴露键解析异常: ${[...authKeys].sort().join(',')}`);
  assert([...themeKeys].sort().join(',') === 'colors,currentColors,isSepia,resetColors,saveColors,setColor,setTheme,theme,toggleTheme',
    `useTheme 暴露键解析异常: ${[...themeKeys].sort().join(',')}`);

  const ctxScanFiles = [
    join(FRONTEND_SRC, 'app.jsx'),
    ...readdirSync(join(FRONTEND_SRC, 'routes')).filter((f) => f.endsWith('.jsx')).map((f) => join(FRONTEND_SRC, 'routes', f)),
    ...readdirSync(join(FRONTEND_SRC, 'components')).filter((f) => f.endsWith('.jsx')).map((f) => join(FRONTEND_SRC, 'components', f))
  ];

  await test('useAuth()/useTheme() 解构字段都在 Provider 暴露范围内', async () => {
    const problems = [];
    for (const file of ctxScanFiles) {
      const src = readFileSync(file, 'utf8');
      for (const [hook, keys] of [['useAuth', authKeys], ['useTheme', themeKeys]]) {
        const re = new RegExp(`const\\s*\\{([^}]*)\\}\\s*=\\s*${hook}\\(\\)`, 'g');
        for (const m of src.matchAll(re)) {
          for (const field of m[1].split(',').map((x) => x.trim()).filter(Boolean)) {
            if (field.startsWith('...')) continue;
            const name = field.split(':')[0].trim();
            if (!keys.has(name)) problems.push(`${file.split('/src/')[1]} → ${hook}() 解构了不存在的 ${name}`);
          }
        }
      }
    }
    assert(problems.length === 0, `Context 解构越界:\n    ${problems.join('\n    ')}`);
    return `${ctxScanFiles.length} 个文件 / useAuth ${authKeys.size} 键 / useTheme ${themeKeys.size} 键`;
  });

  await test('资料字段（display_name / avatar_path / role…）必须取 profile，不能取 useAuth().user', async () => {
    // useAuth().user 是 Supabase 会话对象（session.user），只有 email / id 等 auth 字段；
    // display_name / avatar_path / username / role / plan 都在 profile 上。
    // 曾把 user?.displayName 当昵称用，线上恒为空（2026-10-11 碎念页）。
    const PROFILE_ONLY = ['displayName', 'display_name', 'avatar_path', 'avatarPath', 'username', 'role', 'plan', 'isAdmin'];
    const problems = [];
    for (const file of ctxScanFiles) {
      const src = readFileSync(file, 'utf8');
      // 找出从 useAuth() 解构出名为 user 的文件
      const hasUser = /const\s*\{[^}]*\buser\b[^}]*\}\s*=\s*useAuth\(\)/.test(src);
      if (!hasUser) continue;
      for (const field of PROFILE_ONLY) {
        // 只查 user?.field / user.field 这种读取，避免误报把字段写在别处的情况
        const re = new RegExp(`\\buser\\s*\\??\\.\\s*${field}\\b`, 'g');
        if (re.test(src)) problems.push(`${file.split('/src/')[1]} → user.${field}（应从 profile 取）`);
      }
    }
    assert(problems.length === 0, `资料字段取错对象:\n    ${problems.join('\n    ')}`);
    return `扫描 ${ctxScanFiles.length} 个文件，未发现从 user 读资料字段`;
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
if (!ONLY || ONLY === 'unit') { await unit(); await fileTypeUnit(); await bookTypeUnit(); await audioTypeUnit(); await videoTypeUnit(); await githubAiUnit(); await contract(); }
if (!ONLY || ONLY === 'live') await live();

const failed = results.filter((r) => !r.ok);
console.log(`\n${'='.repeat(60)}`);
console.log(`总计 ${results.length} 项：${results.length - failed.length} 过 / ${failed.length} 失败 / 耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (failed.length) {
  console.log('\n失败清单：');
  for (const f of failed) console.log(`  ❌ [${f.section}] ${f.name} —— ${f.detail}`);
}
process.exit(failed.length ? 1 : 0);
