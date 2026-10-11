// 图谱统计：把 /api/graph/blog 与 /api/graph/repos 的原始数据，换算成各类统计图需要的数据集。
//
// 为什么单独抽成纯函数模块：
//   1) GraphHub.jsx 只负责「取数 → 传参给图表组件」，统计口径全部集中在这里，改口径不用翻组件；
//   2) 纯函数无 DOM 依赖，可以在 Node 里离线单测（见 frontend/tests/graphStats.probe.mjs），
//      而图表渲染只能靠浏览器验证 —— 把容易错的部分（分箱、交叉计数、时间轴对齐）挪出来测。
//
// 设计取舍：
//   - 所有函数都返回「图表组件直接可用」的结构，不做二次加工；
//   - 排行榜一律降序、截断到 topN，其余合并为「其他」（避免图例被长尾撑爆）；
//   - 时间轴（每月发文 / 每月新增 star）**补齐空月**，否则折线会在缺月处直接连线，看着像数据错位。

// 与 StatCharts.jsx 的色板保持一致的取色方式：按索引轮转，保证同名分类在不同图里颜色一致
export const PALETTE = [
  '#2f6bff', '#00b894', '#ff7a1a', '#e8397a', '#8b5cf6', '#0fb9b1',
  '#f2b705', '#ef476f', '#3a86ff', '#06d6a0', '#c77dff', '#ff6b35',
  '#118ab2', '#e0a800', '#7c4dff', '#00a8e8'
];

export function colorAt(i) {
  return PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];
}

// 'YYYY-MM-DD' / Date → 'YYYY-MM'；解析失败返回 null
export function monthOf(value) {
  if (!value) return null;
  const s = String(value);
  const m = /^(\d{4})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// 生成 [from, to] 之间的连续月份（含端点），用于补齐空月
export function monthRange(from, to) {
  const a = /^(\d{4})-(\d{2})$/.exec(from || '');
  const b = /^(\d{4})-(\d{2})$/.exec(to || '');
  if (!a || !b) return [];
  let y = Number(a[1]);
  let m = Number(a[2]);
  const endY = Number(b[1]);
  const endM = Number(b[2]);
  const out = [];
  // 上限 240 个月（20 年），防御性截断，避免脏数据把循环拉爆
  while ((y < endY || (y === endY && m <= endM)) && out.length < 240) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

// 取「计数最高的前 n 项」，其余合并为「其他」
function topWithRest(map, n, restLabel = '其他') {
  const list = [...map.entries()].sort((a, b) => b[1] - a[1]);
  if (list.length <= n) return list.map(([label, value]) => ({ label, value }));
  const head = list.slice(0, n).map(([label, value]) => ({ label, value }));
  const rest = list.slice(n).reduce((sum, [, v]) => sum + v, 0);
  if (rest > 0) head.push({ label: restLabel, value: rest });
  return head;
}

// ---------------------------------------------------------------
// 博客图谱
// ---------------------------------------------------------------
// 输入：GET /api/graph/blog 的 { nodes, links }
// 输出：{ catRank, tagRank, sunburst, catTagMatrix, monthlyByCat, radar, gauges, totals }
export function blogStats(data, { topCats = 9, topTags = 9, topSeries = 6 } = {}) {
  const nodes = data?.nodes || [];
  const links = data?.links || [];
  const hubs = nodes.filter((n) => n.kind === 'hub');
  const posts = nodes.filter((n) => n.kind === 'leaf');

  const catOf = new Map(hubs.filter((h) => h.group === '分类').map((h) => [h.id, h.label]));
  const tagOf = new Map(hubs.filter((h) => h.group === '标签').map((h) => [h.id, h.label]));

  // 文章 → 标签集合（links 里 kind==='tag' 的边，两端一个是 p: 一个是 t:）
  const postTagIds = new Map();
  links.forEach((l) => {
    if (l.kind !== 'tag') return;
    const src = String(l.source || '');
    const dst = String(l.target || '');
    const post = src.startsWith('p:') ? src : (dst.startsWith('p:') ? dst : null);
    const tag = src.startsWith('t:') ? src : (dst.startsWith('t:') ? dst : null);
    if (!post || !tag) return;
    if (!postTagIds.has(post)) postTagIds.set(post, new Set());
    postTagIds.get(post).add(tag);
  });

  // 分类 / 标签计数
  const catCount = new Map();
  const tagCount = new Map();
  posts.forEach((p) => {
    const cid = p.parent && catOf.has(p.parent) ? p.parent : 'c:none';
    const cname = catOf.get(cid) || '未分类';
    catCount.set(cname, (catCount.get(cname) || 0) + 1);
    for (const t of postTagIds.get(p.id) || []) {
      const tname = tagOf.get(t);
      if (tname) tagCount.set(tname, (tagCount.get(tname) || 0) + 1);
    }
  });

  const catRank = topWithRest(catCount, 20).map((it, i) => ({ ...it, color: colorAt(i) }));
  const tagRank = topWithRest(tagCount, 20).map((it, i) => ({ ...it, color: colorAt(i + 4) }));

  // 旭日：内环分类，外环该分类下的标签（只保留 topCats 个分类，其余归「其他分类」）
  const catList = [...catCount.entries()].sort((a, b) => b[1] - a[1]);
  const shownCats = new Set(catList.slice(0, topCats).map(([name]) => name));
  const sunMap = new Map();   // 分类名 → Map(标签名 → 计数)
  posts.forEach((p) => {
    const cid = p.parent && catOf.has(p.parent) ? p.parent : 'c:none';
    let cname = catOf.get(cid) || '未分类';
    if (!shownCats.has(cname)) cname = '其他分类';
    if (!sunMap.has(cname)) sunMap.set(cname, new Map());
    const inner = sunMap.get(cname);
    for (const t of postTagIds.get(p.id) || []) {
      const tname = tagOf.get(t);
      if (!tname) continue;
      inner.set(tname, (inner.get(tname) || 0) + 1);
    }
  });
  const sunburst = [...sunMap.entries()]
    .sort((a, b) => {
      const av = [...a[1].values()].reduce((s, v) => s + v, 0);
      const bv = [...b[1].values()].reduce((s, v) => s + v, 0);
      return bv - av;
    })
    .map(([label, inner], i) => ({
      label,
      value: [...inner.values()].reduce((s, v) => s + v, 0) || (catCount.get(label) || 0),
      color: colorAt(i),
      children: [...inner.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([t, v], j) => ({ label: t, value: v, color: colorAt(i + j + 3) }))
    }));

  // 分类 × 标签 交叉矩阵：值 = 同时属于该分类且带该标签的文章数
  const catsForMatrix = catList.slice(0, topCats).map(([name]) => name);
  const tagsForMatrix = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, topTags).map(([name]) => name);
  const tagIndex = new Map(tagsForMatrix.map((t, i) => [t, i]));
  const catIndex = new Map(catsForMatrix.map((c, i) => [c, i]));
  const matrix = catsForMatrix.map(() => tagsForMatrix.map(() => 0));
  posts.forEach((p) => {
    const cid = p.parent && catOf.has(p.parent) ? p.parent : 'c:none';
    const cname = catOf.get(cid) || '未分类';
    const r = catIndex.get(cname);
    if (r === undefined) return;
    for (const t of postTagIds.get(p.id) || []) {
      const tname = tagOf.get(t);
      const c = tagIndex.get(tname);
      if (c === undefined) continue;
      matrix[r][c] += 1;
    }
  });

  // 每月发文量：按分类拆成多条系列（top 分类 + 其他），并补齐空月
  const datedPosts = posts.map((p) => {
    const cid = p.parent && catOf.has(p.parent) ? p.parent : 'c:none';
    return { month: monthOf(p.date), cat: catOf.get(cid) || '未分类' };
  }).filter((p) => p.month);

  const months = datedPosts.map((p) => p.month).sort();
  const allMonths = monthRange(months[0], months[months.length - 1]);
  const seriesCats = catList.slice(0, topSeries).map(([name]) => name);
  const monthlyByCat = (() => {
    if (!allMonths.length) return [];
    const buckets = new Map();
    const push = (cat, month) => {
      if (!buckets.has(cat)) buckets.set(cat, new Map());
      const m = buckets.get(cat);
      m.set(month, (m.get(month) || 0) + 1);
    };
    datedPosts.forEach((p) => push(seriesCats.includes(p.cat) ? p.cat : '其他', p.month));
    const order = [...seriesCats, '其他'].filter((c) => buckets.has(c));
    return order.map((cat, i) => ({
      label: cat,
      color: colorAt(i),
      points: allMonths.map((x) => ({ x, y: buckets.get(cat)?.get(x) || 0 }))
    }));
  })();

  // 内容构成雷达：6 个维度，各自按一个「合理上限」归一（不是互相比大小）
  const withTags = posts.filter((p) => (postTagIds.get(p.id)?.size || 0) > 0).length;
  const avgTags = posts.length ? (posts.reduce((s, p) => s + (postTagIds.get(p.id)?.size || 0), 0) / posts.length) : 0;
  const recent = (() => {
    if (!allMonths.length) return 0;
    const last = allMonths[allMonths.length - 1];
    return datedPosts.filter((p) => p.month === last).length;
  })();
  const radar = [
    { label: '文章总量', value: posts.length, max: Math.max(posts.length, 1) },
    { label: '分类覆盖', value: catCount.size, max: Math.max(catCount.size, 1) },
    { label: '标签覆盖', value: tagCount.size, max: Math.max(tagCount.size, 1) },
    { label: '标签使用率', value: posts.length ? withTags / posts.length : 0 },
    { label: '篇均标签', value: avgTags, max: Math.max(avgTags, 1) },
    { label: '最新月产出', value: recent, max: Math.max(recent, 1) }
  ];

  // 三个进度环：分类覆盖率 / 标签覆盖率 / 时间跨度（相对 12 个月）
  const gauges = [
    { label: '分类覆盖率', value: posts.length ? posts.filter((p) => p.parent && catOf.has(p.parent)).length / posts.length : 0, max: 1, color: colorAt(0) },
    { label: '标签覆盖率', value: posts.length ? withTags / posts.length : 0, max: 1, color: colorAt(1) },
    { label: '活跃月份占比', value: allMonths.length ? Math.min(allMonths.length / 12, 1) : 0, max: 1, color: colorAt(2) }
  ];

  return {
    totals: {
      posts: posts.length,
      categories: catCount.size,
      tags: tagCount.size,
      months: allMonths.length,
      avgTags
    },
    catRank,
    tagRank,
    sunburst,
    catTagMatrix: { rows: catsForMatrix, cols: tagsForMatrix, values: matrix },
    monthlyByCat,
    radar,
    gauges,
    // 流向图：分类（左）→ 标签（右），带宽 = 同时属于该分类且带该标签的文章数。
    // 这是「多维归属」最直观的一张图，也是用户点名要的「分类好、从左往右流动的交叉线」。
    flow: {
      columns: [
        {
          title: '分类',
          nodes: catsForMatrix.map((name, i) => ({ id: `c:${name}`, label: name, value: catCount.get(name) || 0, color: colorAt(i) }))
        },
        {
          title: '标签',
          nodes: tagsForMatrix.map((name, i) => ({ id: `t:${name}`, label: name, value: tagCount.get(name) || 0, color: colorAt(i + 5) }))
        }
      ],
      links: (() => {
        const out = [];
        catsForMatrix.forEach((cn, r) => tagsForMatrix.forEach((tn, c) => {
          const v = matrix[r][c];
          if (v > 0) out.push({ source: `c:${cn}`, target: `t:${tn}`, value: v });
        }));
        return out;
      })()
    }
  };
}

// ---------------------------------------------------------------
// 开源项目图谱
// ---------------------------------------------------------------
// 输入：GET /api/graph/repos 的 { nodes, links }
// 输出：{ langRank, catRank, sunburst, langCatMatrix, bubbles, monthlyByLang, gauges, totals }
export function repoStats(data, { topLangs = 9, topCats = 9, topSeries = 6, topBubbles = 24 } = {}) {
  const nodes = data?.nodes || [];
  const repos = nodes.filter((n) => n.kind === 'leaf');

  const langCount = new Map();
  const catCount = new Map();
  const langStars = new Map();
  repos.forEach((r) => {
    const lang = r.lang || '其他';
    const cat = r.cat || '';
    langCount.set(lang, (langCount.get(lang) || 0) + 1);
    langStars.set(lang, (langStars.get(lang) || 0) + (Number(r.stars) || 0));
    if (cat) catCount.set(cat, (catCount.get(cat) || 0) + 1);
  });

  const langRank = topWithRest(langCount, 20).map((it, i) => ({ ...it, color: colorAt(i) }));
  const catRank = topWithRest(catCount, 20).map((it, i) => ({ ...it, color: colorAt(i + 5) }));

  // 旭日：内环语言，外环该语言下的应用分类
  const langList = [...langCount.entries()].sort((a, b) => b[1] - a[1]);
  const shownLangs = new Set(langList.slice(0, topLangs).map(([name]) => name));
  const sunMap = new Map();
  repos.forEach((r) => {
    let lang = r.lang || '其他';
    if (!shownLangs.has(lang)) lang = '其他语言';
    if (!sunMap.has(lang)) sunMap.set(lang, new Map());
    const inner = sunMap.get(lang);
    const cat = r.cat || '未分类';
    inner.set(cat, (inner.get(cat) || 0) + 1);
  });
  const sunburst = [...sunMap.entries()]
    .sort((a, b) => [...b[1].values()].reduce((s, v) => s + v, 0) - [...a[1].values()].reduce((s, v) => s + v, 0))
    .map(([label, inner], i) => ({
      label,
      value: [...inner.values()].reduce((s, v) => s + v, 0),
      color: colorAt(i),
      children: [...inner.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([c, v], j) => ({ label: c, value: v, color: colorAt(i + j + 3) }))
    }));

  // 语言 × 应用分类 交叉矩阵
  const langsForMatrix = langList.slice(0, topLangs).map(([name]) => name);
  const catsForMatrix = [...catCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, topCats).map(([name]) => name);
  const langIndex = new Map(langsForMatrix.map((l, i) => [l, i]));
  const catIndex = new Map(catsForMatrix.map((c, i) => [c, i]));
  const matrix = langsForMatrix.map(() => catsForMatrix.map(() => 0));
  repos.forEach((r) => {
    const r0 = langIndex.get(r.lang || '其他');
    const c0 = catIndex.get(r.cat || '');
    if (r0 === undefined || c0 === undefined) return;
    matrix[r0][c0] += 1;
  });

  // 气泡矩阵：x = 该语言仓库数，y = 平均 star（对数轴），size = 总 star
  const bubbles = langList.slice(0, topBubbles).map(([lang, count], i) => {
    const stars = langStars.get(lang) || 0;
    return {
      x: count,
      y: count ? stars / count : 0,
      size: Math.max(stars, 1),
      label: lang,
      color: colorAt(i),
      meta: `${count} 个仓库 · 共 ${stars} ★`
    };
  }).filter((b) => b.x > 0);

  // 每月新增收藏：按语言拆系列（top 语言 + 其他），补齐空月
  const dated = repos.map((r) => ({ month: monthOf(r.date), lang: r.lang || '其他' })).filter((r) => r.month);
  const months = dated.map((r) => r.month).sort();
  const allMonths = monthRange(months[0], months[months.length - 1]);
  const seriesLangs = langList.slice(0, topSeries).map(([name]) => name);
  const monthlyByLang = (() => {
    if (!allMonths.length) return [];
    const buckets = new Map();
    dated.forEach((r) => {
      const key = seriesLangs.includes(r.lang) ? r.lang : '其他';
      if (!buckets.has(key)) buckets.set(key, new Map());
      const m = buckets.get(key);
      m.set(r.month, (m.get(r.month) || 0) + 1);
    });
    const order = [...seriesLangs, '其他'].filter((k) => buckets.has(k));
    return order.map((k, i) => ({
      label: k,
      color: colorAt(i),
      points: allMonths.map((x) => ({ x, y: buckets.get(k)?.get(x) || 0 }))
    }));
  })();

  // 进度环：AI 解读覆盖率 / 有语言的仓库占比 / 有分类的仓库占比
  const total = repos.length || 1;
  const withAi = repos.filter((r) => r.one).length;
  const withLang = repos.filter((r) => r.lang).length;
  const withCat = repos.filter((r) => r.cat).length;
  const gauges = [
    { label: 'AI 解读覆盖率', value: withAi / total, max: 1, color: colorAt(0) },
    { label: '语言标注率', value: withLang / total, max: 1, color: colorAt(1) },
    { label: '分类标注率', value: withCat / total, max: 1, color: colorAt(2) }
  ];

  const totalStars = repos.reduce((s, r) => s + (Number(r.stars) || 0), 0);

  return {
    totals: {
      repos: repos.length,
      languages: langCount.size,
      categories: catCount.size,
      stars: totalStars,
      aiCoverage: withAi / total
    },
    langRank,
    catRank,
    sunburst,
    langCatMatrix: { rows: langsForMatrix, cols: catsForMatrix, values: matrix },
    bubbles,
    monthlyByLang,
    gauges,
    // 流向图：编程语言（左）→ 应用分类（右），带宽 = 该语言下属于该分类的仓库数。
    flow: {
      columns: [
        {
          title: '编程语言',
          nodes: langsForMatrix.map((name, i) => ({ id: `L:${name}`, label: name, value: langCount.get(name) || 0, color: colorAt(i) }))
        },
        {
          title: '应用分类',
          nodes: catsForMatrix.map((name, i) => ({ id: `A:${name}`, label: name, value: catCount.get(name) || 0, color: colorAt(i + 5) }))
        }
      ],
      links: (() => {
        const out = [];
        langsForMatrix.forEach((ln, r) => catsForMatrix.forEach((cn, c) => {
          const v = matrix[r][c];
          if (v > 0) out.push({ source: `L:${ln}`, target: `A:${cn}`, value: v });
        }));
        return out;
      })()
    }
  };
}
