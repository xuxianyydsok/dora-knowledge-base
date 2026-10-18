// 内容统计（2026-10-18）
//
// 用途：把站内真实文章列表聚合成「数据组」动效组件需要的形式。
// 为什么单独一个文件：
//   · 纯函数、零依赖，Node 可以直接 import 做离线单测；
//   · 雷达图 / 3D 柱阵 / 流图 / 曲线 四个组件共用同一套口径，
//     不会出现「同一个数在两个图里不一样」。
//
// 数据口径（重要，写进注释免得日后各算各的）：
//   · 「发文量」= posts 里 status='published' 的文章数（调用方负责先过滤）；
//   · 「分类」取 category_id → 调用方传 cats 映射表；
//   · 「标签」取 tag_ids 数组；
//   · 时间一律按**本地时区**归到「天」，避免 UTC 跨日错位。

const DAY = 24 * 60 * 60 * 1000;

/** 取文章的展示日期（与 blogData.dateOf 同口径；调用方负责按状态过滤） */
export function postDate(p) {
  return p?.published_at || p?.created_at || null;
}

/**
 * 图表只统计「已发布」文章。
 *
 * 站长登录后，博客列表会带出草稿；如果直接聚合，草稿会被算进
 * 分类体量 / 月度流图，而「每日发文量」又会按日期把它们排除，
 * 四张图就会互相矛盾。访客数据本来就全是 published，这个过滤是幂等的。
 */
export function publishedPosts(posts) {
  return (posts || []).filter((p) => p?.status === 'published');
}

/** 归一到当天 00:00 的本地日期 key */
export function dayKeyOf(d) {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`;
}

/**
 * 按天统计发文量（用于 197 曲线 / 199 柱状图）。
 * @returns {{ days: {date: Date, n: number}[], total: number }}
 *   days 按时间升序，连续无空档（没发文的日子补 0），最多 days 天。
 */
export function dailyCounts(posts, days = 30) {
  const counts = new Map();
  for (const p of publishedPosts(posts)) {
    const k = dayKeyOf(postDate(p));
    if (k) counts.set(k, (counts.get(k) || 0) + 1);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out = [];
  let total = 0;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY);
    const n = counts.get(dayKeyOf(d)) || 0;
    total += n;
    out.push({ date: d, n });
  }
  return { days: out, total };
}

/**
 * 分类体量（用于 170 雷达 / 172 3D 柱阵）。
 * @param posts 文章列表
 * @param cats  分类列表 [{id,name}]
 * @param limit 取前几个分类（按数量降序）
 * @returns {{ name: string, value: number }[]}
 */
export function categoryCounts(posts, cats, limit = 6) {
  const byId = new Map((cats || []).map((c) => [c.id, c.name]));
  const counts = new Map();
  for (const p of publishedPosts(posts)) {
    const name = byId.get(p.category_id);
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, value]) => ({ name, value }));
}

/**
 * 分类 × 标签的交叉计数（用于 172 3D 柱阵）。
 * 只保留「体量前 catLimit 的分类 × 出现次数前 tagLimit 的标签」，
 * 否则矩阵会稀疏到全是 0。
 * @returns {{ cats: string[], tags: string[], matrix: number[][] }}
 */
export function categoryTagMatrix(posts, cats, tags, catLimit = 8, tagLimit = 8) {
  const catName = new Map((cats || []).map((c) => [c.id, c.name]));
  const tagName = new Map((tags || []).map((t) => [t.id, t.name]));

  const catCount = new Map();
  const tagCount = new Map();
  const pairs = new Map();   // "分类\t标签" → 数量

  for (const p of publishedPosts(posts)) {
    const c = catName.get(p.category_id);
    if (!c) continue;
    const ts = (p.tag_ids || []).map((id) => tagName.get(id)).filter(Boolean);
    catCount.set(c, (catCount.get(c) || 0) + 1);
    for (const t of ts) {
      tagCount.set(t, (tagCount.get(t) || 0) + 1);
      const k = `${c}\t${t}`;
      pairs.set(k, (pairs.get(k) || 0) + 1);
    }
  }

  const catList = [...catCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, catLimit).map((x) => x[0]);
  const tagList = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, tagLimit).map((x) => x[0]);
  const matrix = catList.map((c) => tagList.map((t) => pairs.get(`${c}\t${t}`) || 0));
  return { cats: catList, tags: tagList, matrix };
}

/**
 * 按月的分类发文量（用于 176 流图）。
 * @returns {{ months: string[], series: { name: string, values: number[] }[] }}
 */
export function monthlyByCategory(posts, cats, months = 12, catLimit = 6) {
  const catName = new Map((cats || []).map((c) => [c.id, c.name]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 生成最近 N 个月的 key（YYYY-M）与显示名
  const keys = [];
  const labels = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${d.getMonth() + 1}`);
    labels.push(`${d.getMonth() + 1}月`);
  }
  const idx = new Map(keys.map((k, i) => [k, i]));

  const perCat = new Map();   // 分类名 → number[months]
  for (const p of publishedPosts(posts)) {
    const d = new Date(postDate(p));
    if (Number.isNaN(d.getTime())) continue;
    const i = idx.get(`${d.getFullYear()}-${d.getMonth() + 1}`);
    if (i === undefined) continue;
    const c = catName.get(p.category_id) || '未分类';
    if (!perCat.has(c)) perCat.set(c, new Array(months).fill(0));
    perCat.get(c)[i] += 1;
  }

  const series = [...perCat.entries()]
    .map(([name, values]) => ({ name, values, sum: values.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.sum - a.sum)
    .slice(0, catLimit)
    .map(({ name, values }) => ({ name, values }));

  return { months: labels, series };
}
