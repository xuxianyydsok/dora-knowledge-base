// 影视库批量收藏脚本（一次性数据录入）
// 通过后端 REST API 搜索采集源并写入「我的影视库」，不修改任何前端界面。
//
// 用法：
//   API_BASE=https://api.xuguochen.de5.net TOKEN=<管理员JWT> node backend/scripts/seed-movies.mjs
//   TOKEN 获取方式见 docs/api.md「本地测试」章节（Supabase Auth 密码登录）。
//
// 说明：仅抓取元信息与播放地址字符串，不下载视频文件。
// 注：脚本只把 { query, limit } 发给 /api/movies/search —— 动漫条目由后端自动按各源的
//     「国产/日韩/欧美动漫」类目补搜（见 backend/src/lib/maccms.js 的 getAnimeClassIds），
//     不需要在这里指定分类 ID（各采集源的动漫 type_id 并不统一）。
//     这个脚本逐条实时聚合 5 个采集源，速度很慢；更快的做法见 docs/progress.md 第 3 节。

const API_BASE = process.env.API_BASE || 'https://api.xuguochen.de5.net';
const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error('缺少 TOKEN 环境变量（管理员 Supabase JWT）');
  process.exit(1);
}

// 片单：group 用于前端展示归类（写入 remarks 之外不影响结构），match 精确锁定目标条目
const WISHLIST = [
  // —— 中国 · 电视剧 ——
  { title: '觉醒年代', search: '觉醒年代', match: /^觉醒年代$/ },
  { title: '历史转折中的邓小平', search: '历史转折中的邓小平', match: /^历史转折中的邓小平$/ },
  { title: '老九门', search: '老九门', match: /^老九门$/ },
  { title: '九门', search: '九门', match: /^九门(2026)?$/, yearMin: 2025 },
  { title: '终极笔记', search: '终极笔记', match: /^终极笔记$/ },
  { title: '三体', search: '三体', match: /^三体$/ },

  // —— 中国 · 动漫 ——
  { title: '完美世界', search: '完美世界', match: /^完美世界$/, tv: true },
  { title: '画江湖之不良人', search: '画江湖之不良人', match: /^画江湖之不良人(第?[一二三四五六七1-7]季|II|第一季)?$/, tv: true },
  { title: '一人之下', search: '一人之下', match: /^一人之下(第[一二三四五六]季|第一季)?$/, tv: true },
  { title: '诛仙', search: '诛仙', match: /^诛仙(第[一二三四]季|动画版)?$/, tv: true },
  { title: '遮天', search: '遮天', match: /^遮天(动画版)?$/, tv: true },
  { title: '剑来', search: '剑来', match: /^剑来(第[一二]季|第一季)?$/, tv: true },
  { title: '斗破苍穹', search: '斗破苍穹', match: /^斗破苍穹(年番|第[一二三四五]季|三年之约)?$/, tv: true },
  { title: '全职高手', search: '全职高手', match: /^全职高手(第[一二三]季|第一季)?$/, tv: true },
  { title: '诡秘之主', search: '诡秘之主', match: /^诡秘之主$/, tv: true },
  { title: '西行纪', search: '西行纪', match: /^西行纪(第[一二三四五]季|第一季)?$/, tv: true },
  { title: '凡人修仙传', search: '凡人修仙传', match: /^凡人修仙传(2020)?$/, tv: true },
  { title: '仙逆', search: '仙逆', match: /^仙逆$/, tv: true },

  // —— 中国 · 电影 ——
  { title: '战狼', search: '战狼', match: /^战狼2?$/ },
  { title: '流浪地球', search: '流浪地球', match: /^流浪地球2?$/ },
  { title: '唐人街探案', search: '唐人街探案', match: /^唐人街探案[123]?$/ },
  { title: '哪吒之魔童降世', search: '哪吒之魔童降世', match: /^哪吒之魔童降世$/ },
  { title: '哪吒之魔童闹海', search: '哪吒之魔童闹海', match: /^哪吒之魔童闹海$/ },

  // —— 美国 ——
  { title: '复仇者联盟', search: '复仇者联盟', match: /^复仇者联盟[234]?(:.*)?$/ },
  { title: '蜘蛛侠', search: '蜘蛛侠', match: /^(超凡)?蜘蛛侠/ },
  { title: '变形金刚', search: '变形金刚', match: /^变形金刚(:.*)?$/, yearMin: 2007 },
  { title: '美国队长', search: '美国队长', match: /^美国队长[1-4]?$/ },
  { title: '毒液', search: '毒液', match: /^毒液/ },

  // —— 日本 · 奥特曼（优先中文配音版本）——
  { title: '迪迦奥特曼', search: '迪迦奥特曼', match: /^迪迦奥特曼(国语版)?$/, tv: true, cnFirst: true },
  { title: '戴拿奥特曼', search: '戴拿奥特曼', match: /^戴拿奥特曼(国语版)?$/, tv: true, cnFirst: true },
  { title: '奥特银河格斗', search: '奥特银河格斗', match: /^奥特银河格斗/, tv: true, cnFirst: true },
  { title: '赛罗奥特曼', search: '赛罗奥特曼', match: /赛罗|超银河传说|贝利亚/ }
];

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`);
  return payload?.data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const existing = await api('/api/movies');
  const have = new Set(existing.map((m) => m.title));
  console.log(`已有收藏 ${existing.length} 条\n`);

  let added = 0, skipped = 0, missed = 0;
  for (const item of WISHLIST) {
    let candidates = [];
    try {
      const body = { query: item.search, limit: 20 };
      const res = await api('/api/movies/search', { method: 'POST', body: JSON.stringify(body) });
      candidates = res.candidates || [];
    } catch (e) {
      console.log(`  [ERR]  ${item.title} — 搜索失败：${e.message}`);
      missed++;
      continue;
    }

    let picked = candidates.filter((c) => item.match.test(c.title));
    if (item.yearMin) {
      picked = picked.filter((c) => (Number(String(c.release_date || '').slice(0, 4)) || 0) >= item.yearMin);
    }
    if (item.tv) picked = picked.filter((c) => c.media_type === 'tv');
    if (item.cnFirst) {
      // 优先中文配音（国语版 / 普通话版），无则保留原条目
      const cn = picked.filter((c) => /国语|普通话/.test(c.title));
      if (cn.length) picked = cn;
    }

    if (!picked.length) {
      console.log(`  [MISS] ${item.title}`);
      missed++;
      continue;
    }

    for (const c of picked) {
      if (have.has(c.title)) { skipped++; continue; }
      try {
        await api('/api/movies', {
          method: 'POST',
          body: JSON.stringify({
            title: c.title,
            media_type: c.media_type,
            overview: c.overview,
            poster_url: c.poster_url,
            release_date: c.release_date,
            runtime: c.runtime,
            rating: c.rating,
            genres: c.genres,
            director: c.director,
            cast_list: c.cast_list,
            area: c.area,
            remarks: c.remarks,
            external_id: c.external_id,
            source: c.source,
            source_key: c.source,
            source_vod_id: c.external_id,
            routes: c.routes,
            url: c.playable_url || null
          })
        });
        have.add(c.title);
        added++;
        console.log(`  [OK]   ${item.title} → ${c.title}`);
      } catch (e) {
        console.log(`  [FAIL] ${c.title} — ${e.message}`);
      }
      await sleep(120);
    }
  }

  console.log(`\n完成：新增 ${added} 条，跳过已存在 ${skipped} 条，未匹配 ${missed} 组`);
}

main().catch((e) => { console.error(e); process.exit(1); });
