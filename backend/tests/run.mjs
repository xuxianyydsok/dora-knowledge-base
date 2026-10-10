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
