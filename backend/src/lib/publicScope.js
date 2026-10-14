// 公开读边界：集中定义「访客能读哪些接口」与「访客查询必须叠加的过滤条件」。
//
// 为什么单独抽成一个无 IO 的纯模块：
// - 中间件（middleware/auth.js）只负责「能不能进」，真正的数据过滤必须在各路由的
//   查询层完成（Worker 用 service_role 直连 PostgREST，RLS 不会替它过滤）；
// - 纯函数可离线单测，锁定「公开/登录/管理员」三层边界的回归。
//
// 例外：/api/feedback 的 POST 是**访客可写**的（共创反馈是公开留言表单，匿名提交
// 必须让未登录访客也能用），因此它出现在 PUBLIC_POST_PATHS 里；GET / PATCH / DELETE
// 仍不放行，查看与管理只走 requireAdmin。详见 docs/coop.md。

// 访客可只读的 GET 路径。
// 注意：不含 favorites（收藏夹属个人数据），也不含 /progress（个人播放进度）。
// 含 moments（碎念页）：只读公开动态；它的写操作（POST/PATCH/DELETE）天然不在 GET 白名单内，
// 且写方法只走 PUBLIC_POST_PATHS，因此不要往那里加 moments。
// 含 files（碎念附件）：GET /api/files/:id 对访客放行，但路由层只返回 is_public=true 的文件；
//   GET /api/files（列表）仍被 requireAdmin 挡住，不会因为放进白名单而泄露私人附件清单。
// 含 books（图书）：书架面向读者，列出/正文/封面都对访客放行，但路由层只放行
//   is_public=true 的书（私人书对访客一律按「不存在」处理）。
// 含 hero（2026-10-13）：首页轮播素材对访客只读开放 —— 首页是公开页面，
// 访客必须能读到轮播列表（路由层只返回 is_active=true 的项）。
// 含 notion-posts（2026-10-14）：Notion 博客分区与 posts 一样是公开阅读区，
// 路由层只放行 status='published' + is_public=true（guestPostFilters）。
export const PUBLIC_READ_RE = /^\/api\/(categories|tags|videos|github|posts|notion-posts|music|movies|news|search|graph|gallery|timeline|moments|files|books|wallpapers|hero)(\/|$)/;

// 站长收藏（2026-10-11 用户要求）：站长收藏的影视 / 音乐对所有人可见可播。
// 它是一条**精确路径**（不是前缀），因此单独判定 —— 不能塞进上面的前缀正则，
// 否则 `/api/favorites/public/anything` 也会被连带放行。
export const PUBLIC_EXACT_GET_PATHS = new Set(['/api/favorites/public']);

// 访客可调用的「只读但用 POST」的检索接口。
// 注意：不含 /api/github/analyze（消耗 Workers AI 额度，仅管理员可用）。
// 含 /api/feedback（共创反馈）：这是唯一一个**访客可写**的 POST —— 反馈是公开留言表单，
//   匿名提交必须让未登录访客也能用；但它只放行 POST，查看 / 改状态 / 删除仍要 requireAdmin。
export const PUBLIC_POST_PATHS = new Set([
  '/api/movies/search',
  '/api/movies/source-detail',
  '/api/music/search',
  '/api/music/lyrics',
  '/api/music/stream',
  '/api/feedback'
]);

// 判断访客（未登录）是否可以访问某方法 + 路径。
export function isGuestAllowed(method, pathname) {
  if (method === 'POST') return PUBLIC_POST_PATHS.has(pathname);
  if (method !== 'GET') return false;
  if (pathname.endsWith('/progress')) return false;
  if (PUBLIC_EXACT_GET_PATHS.has(pathname)) return true;
  // 上传曲目的字节端点：/api/music/:id/audio 与 /api/music/:id/cover。
  // 访客要能听站长公开的音乐、看它的封面，因此必须放行；
  // 路由层会按 is_public 再过滤一次（私有曲目对访客一律 404）。
  if (/^\/api\/music\/[0-9a-f-]{36}\/(audio|cover)$/.test(pathname)) return true;
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

// 碎念配图张数上限（前后端共用口径；前端超过就不让选）。
export const MAX_MOMENT_ASSETS = 9;

// 碎念文件附件个数上限（PDF / Word 等；与配图分开计数）。
export const MAX_MOMENT_FILES = 5;

// 访客读碎念时必须叠加的查询条件（供路由与测试共用）。
// Worker 用 service_role 直连 PostgREST，RLS 不替它过滤，这一条必须在查询层显式带上。
export function momentGuestFilters() {
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
