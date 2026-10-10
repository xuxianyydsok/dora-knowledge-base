// 公开读边界：集中定义「访客能读哪些接口」与「访客查询必须叠加的过滤条件」。
//
// 为什么单独抽成一个无 IO 的纯模块：
// - 中间件（middleware/auth.js）只负责「能不能进」，真正的数据过滤必须在各路由的
//   查询层完成（Worker 用 service_role 直连 PostgREST，RLS 不会替它过滤）；
// - 纯函数可离线单测，锁定「公开/登录/管理员」三层边界的回归。

// 访客可只读的 GET 路径。
// 注意：不含 favorites（收藏夹属个人数据），也不含 /progress（个人播放进度）。
export const PUBLIC_READ_RE = /^\/api\/(categories|tags|videos|github|posts|music|movies|news|search|graph)(\/|$)/;

// 访客可调用的「只读但用 POST」的检索接口。
// 注意：不含 /api/github/analyze（消耗 Workers AI 额度，仅管理员可用）。
export const PUBLIC_POST_PATHS = new Set([
  '/api/movies/search',
  '/api/movies/source-detail',
  '/api/music/search',
  '/api/music/lyrics',
  '/api/music/stream'
]);

// 判断访客（未登录）是否可以访问某方法 + 路径。
export function isGuestAllowed(method, pathname) {
  if (method === 'POST') return PUBLIC_POST_PATHS.has(pathname);
  if (method !== 'GET') return false;
  if (pathname.endsWith('/progress')) return false;
  return PUBLIC_READ_RE.test(pathname);
}

// 只有管理员显式传 ?all=true 才能越出本人数据范围；访客恒为 false。
export function canUseAll(user, paramAll) {
  return !!paramAll && !!user?.isAdmin;
}

// 访客读博客时必须同时满足的两个条件（返回可直接喂给 qs() 的片段）。
export function guestPostFilters() {
  return { status: 'eq.published', is_public: 'eq.true' };
}

// 访客读资源（影视/音乐/GitHub/视频）时必须满足的公开条件。
export function guestResourceFilters() {
  return { is_public: 'eq.true' };
}

// 访客拿到的单条博客是否可见（草稿 / 私密一律按「不存在」处理，不泄露存在性）。
export function isPostVisibleToGuest(post) {
  return !!post && post.status === 'published' && post.is_public === true;
}

// 访客拿到的单条资源是否可见。
export function isResourceVisibleToGuest(resource) {
  return !!resource && resource.is_public === true;
}
