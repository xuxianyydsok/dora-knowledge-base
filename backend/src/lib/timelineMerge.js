// 公开时间轴聚合：把三类公开内容映射成统一结构并稳定排序。
//
// 为什么抽成无 IO 的纯模块：
// - 时间轴要把 posts / resources / gallery_items 三张表「不同日期列」揉成一条时间线，
//   排序与分页规则最容易出错（跳条、重复、漏条），必须能离线单测锁定；
// - 安全红线（只输出安全字段）也在这里集中保证，避免路由层不小心把 object_key 带出去。

// 时间轴允许的内容类型。video 页 2026-10-09 已删除，故不含 video。
export const TIMELINE_TYPES = ['post', 'github', 'music', 'movie'];

// 各类型的中文标签（前端可直接复用，避免两边各写一套）
export const TIMELINE_TYPE_LABELS = {
  post: '博客', github: 'GitHub', music: '音乐', movie: '影视', gallery: '图片'
};

export const TIMELINE_MAX_LIMIT = 50;

// 可解析的时间字符串才算合法游标；否则一律忽略（当作第一页）
function isUsableDate(value) {
  if (typeof value !== 'string' || !value) return false;
  return Number.isFinite(new Date(value).getTime());
}

function toDateString(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function safeString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

// 统一结构：id / type / title / summary / date / url / cover / source_id
// source_id 是原始记录 uuid（前端跳转用）；其余内部字段一律不外传。
function build({ prefix, type, sourceId, title, summary, date, url, cover }) {
  return {
    id: `${prefix}:${sourceId}`,
    type,
    title: safeString(title) || '未命名',
    summary: safeString(summary),
    date: toDateString(date),
    url: safeString(url),
    cover: safeString(cover) || null,
    source_id: sourceId
  };
}

// 博客：日期优先 published_at（已发布才有意义），回退 created_at；链接指向文章详情
export function mapPost(row = {}) {
  return build({
    prefix: 'post',
    type: 'post',
    sourceId: row.id,
    title: row.title,
    summary: row.excerpt,
    date: row.published_at || row.created_at,
    url: `/posts/${row.id}`,
    cover: row.cover_path
  });
}

// 资源：github 用外部链接，music / movie 指向站内详情页
export function mapResource(row = {}) {
  const type = TIMELINE_TYPES.includes(row.type) ? row.type : 'github';
  const url = type === 'github'
    ? (safeString(row.url) || '/github')
    : type === 'music' ? `/music/${row.id}` : `/movies/${row.id}`;
  return build({
    prefix: type,
    type,
    sourceId: row.id,
    title: row.title,
    summary: row.summary,
    date: row.created_at,
    url,
    cover: row.cover_path
  });
}

// 展览：展示用 captured_at（拍摄/创作日期），缺失回退 created_at；链接指向展览页
export function mapGallery(row = {}) {
  return build({
    prefix: 'gallery',
    type: 'gallery',
    sourceId: row.id,
    title: row.title,
    summary: row.description,
    date: row.captured_at || row.created_at,
    url: '/gallery',
    cover: row.cover
  });
}

// 合并三类 + 按 date 倒序（同 date 按 id 升序，保证稳定分页）+ 游标分页
export function mergeTimeline({ posts = [], resources = [], gallery = [] } = {}, { limit = 20, before = null } = {}) {
  const capped = Math.min(Math.max(Number(limit) || 20, 1), TIMELINE_MAX_LIMIT);
  const cursor = isUsableDate(before) ? new Date(before).toISOString() : null;

  const mapped = [
    ...(Array.isArray(posts) ? posts.map(mapPost) : []),
    ...(Array.isArray(resources) ? resources.map(mapResource) : []),
    ...(Array.isArray(gallery) ? gallery.map(mapGallery) : [])
  ].filter((item) => item.source_id && item.date);

  // before 为严格小于：同一时刻的条目不会在下一页重复出现
  const visible = cursor ? mapped.filter((item) => item.date < cursor) : mapped;

  visible.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const items = visible.slice(0, capped);
  const nextCursor = visible.length > capped ? items[items.length - 1].date : null;
  return { items, next_cursor: nextCursor };
}
