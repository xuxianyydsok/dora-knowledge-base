// 后端 REST API 客户端
// 自动附带当前会话 JWT；统一解析 { data } / { error } 结构
import { API_BASE_URL } from './config.js';
import { supabase } from './supabase.js';

async function authHeader() {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// 访客模式下允许的只读 POST 检索接口（与后端 PUBLIC_POST 保持一致）
const GUEST_POST = new Set(['/api/movies/search', '/api/movies/source-detail', '/api/music/search', '/api/music/lyrics', '/api/music/stream']);

async function request(path, { method = 'GET', body } = {}) {
  const auth = await authHeader();
  // 访客模式（未登录）只能读：进度上报静默跳过，其余写操作给出明确提示
  if (!auth.Authorization && path.endsWith('/progress')) return null;   // 访客不读写个人进度
  if (!auth.Authorization && method !== 'GET' && !GUEST_POST.has(path)) {
    throw new ApiError(401, '访客模式只能浏览，修改内容需要站长登录');
  }
  const headers = {
    'Content-Type': 'application/json',
    ...auth
  };

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(res.status, payload?.error || `请求失败 (${res.status})`);
  }
  return payload?.data;
}

export const api = {
  // 分类
  listCategories: (params = '') => request(`/api/categories${params}`),
  createCategory: (body) => request('/api/categories', { method: 'POST', body }),
  updateCategory: (id, body) => request(`/api/categories/${id}`, { method: 'PATCH', body }),
  deleteCategory: (id) => request(`/api/categories/${id}`, { method: 'DELETE' }),

  // 标签
  listTags: (params = '') => request(`/api/tags${params}`),
  createTag: (body) => request('/api/tags', { method: 'POST', body }),
  updateTag: (id, body) => request(`/api/tags/${id}`, { method: 'PATCH', body }),
  deleteTag: (id) => request(`/api/tags/${id}`, { method: 'DELETE' }),
  batchCreateTags: (items) => request('/api/tags/batch', { method: 'POST', body: { items } }),
  batchUpdateTags: (items) => request('/api/tags/batch', { method: 'PATCH', body: { items } }),
  batchDeleteTags: (ids) => request('/api/tags/batch', { method: 'DELETE', body: { ids } }),

  // 学习视频
  listVideos: (params = '') => request(`/api/videos${params}`),
  getVideo: (id) => request(`/api/videos/${id}`),
  fetchVideoInfo: (url) => request('/api/videos/fetch', { method: 'POST', body: { url } }),
  createVideo: (body) => request('/api/videos', { method: 'POST', body }),
  updateVideo: (id, body) => request(`/api/videos/${id}`, { method: 'PATCH', body }),
  deleteVideo: (id) => request(`/api/videos/${id}`, { method: 'DELETE' }),
  getVideoProgress: (id) => request(`/api/videos/${id}/progress`),
  saveVideoProgress: (id, body) => request(`/api/videos/${id}/progress`, { method: 'PUT', body }),

  // GitHub 收藏
  listGithub: (params = '') => request(`/api/github${params}`),
  getGithub: (id) => request(`/api/github/${id}`),
  fetchGithubInfo: (url) => request('/api/github/fetch', { method: 'POST', body: { url } }),
  createGithub: (body) => request('/api/github', { method: 'POST', body }),
  updateGithub: (id, body) => request(`/api/github/${id}`, { method: 'PATCH', body }),
  deleteGithub: (id) => request(`/api/github/${id}`, { method: 'DELETE' }),
  syncGithub: (page, run) => request('/api/github/sync', { method: 'POST', body: { page, run } }),

  // 博客
  listPosts: (params = '') => request(`/api/posts${params}`),
  getPost: (id) => request(`/api/posts/${id}`),
  getPostBySlug: (slug) => request(`/api/posts/slug/${encodeURIComponent(slug)}`),
  createPost: (body) => request('/api/posts', { method: 'POST', body }),
  updatePost: (id, body) => request(`/api/posts/${id}`, { method: 'PATCH', body }),
  deletePost: (id) => request(`/api/posts/${id}`, { method: 'DELETE' }),

  // 音乐库
  listMusic: (params = '') => request(`/api/music${params}`),
  getMusic: (id) => request(`/api/music/${id}`),
  searchMusicMeta: (query, limit = 40) => request('/api/music/search', { method: 'POST', body: { query, limit } }),
  getMusicLyrics: (body) => request('/api/music/lyrics', { method: 'POST', body }),
  // 重新解析可播放直链（第三方直链是会过期的签名地址）
  resolveMusicStream: (body) => request('/api/music/stream', { method: 'POST', body }),
  createMusic: (body) => request('/api/music', { method: 'POST', body }),
  updateMusic: (id, body) => request(`/api/music/${id}`, { method: 'PATCH', body }),
  deleteMusic: (id) => request(`/api/music/${id}`, { method: 'DELETE' }),
  getMusicProgress: (id) => request(`/api/music/${id}/progress`),
  saveMusicProgress: (id, body) => request(`/api/music/${id}/progress`, { method: 'PUT', body }),

  // 影视库
  listMovies: (params = '') => request(`/api/movies${params}`),
  getMovie: (id) => request(`/api/movies/${id}`),
  searchMovieMeta: (query, limit = 30) => request('/api/movies/search', { method: 'POST', body: { query, limit } }),
  listMovieLatest: (params = '') => request(`/api/movies/latest${params}`),
  listMusicChart: (chart, limit = 50) => request(`/api/music/charts?chart=${chart}&limit=${limit}`),
  // 豆瓣片单（type=tv|movie，tag 见后端 DOUBAN_TAGS）
  listDouban: (type, tag, limit = 24, start = 0) =>
    request(`/api/movies/douban?type=${type}&tag=${encodeURIComponent(tag)}&limit=${limit}&start=${start}`),
  getMovieSourceDetail: (body) => request('/api/movies/source-detail', { method: 'POST', body }),
  getVodSourceHealth: () => request('/api/movies/sources/health'),
  createMovie: (body) => request('/api/movies', { method: 'POST', body }),
  updateMovie: (id, body) => request(`/api/movies/${id}`, { method: 'PATCH', body }),
  deleteMovie: (id) => request(`/api/movies/${id}`, { method: 'DELETE' }),
  getMovieProgress: (id) => request(`/api/movies/${id}/progress`),
  saveMovieProgress: (id, body) => request(`/api/movies/${id}/progress`, { method: 'PUT', body }),

  // NewsNow 热榜
  listNewsSources: () => request('/api/news/sources'),
  getNews: (id) => request(`/api/news/${encodeURIComponent(id)}`),

  // 全文检索
  search: (q, params = '') => request(`/api/search?q=${encodeURIComponent(q)}${params}`),

  // 关联图谱
  getGraph: (params = '') => request(`/api/graph${params}`),

  // 收藏夹
  listFavorites: (params = '') => request(`/api/favorites${params}`),
  createFavorite: (body) => request('/api/favorites', { method: 'POST', body }),
  deleteFavorite: (id) => request(`/api/favorites/${id}`, { method: 'DELETE' }),
  deleteFavoriteByTarget: (query) => request(`/api/favorites/target?${query}`, { method: 'DELETE' }),

  // 通知中心
  listNotifications: (params = '') => request(`/api/notifications${params}`),
  countUnread: () => request('/api/notifications/count'),
  createNotification: (body) => request('/api/notifications', { method: 'POST', body }),
  checkLinks: (limit = 10) => request('/api/notifications/check-links', { method: 'POST', body: { limit } }),
  markNotification: (id, isRead) => request(`/api/notifications/${id}`, { method: 'PATCH', body: { is_read: isRead } }),
  markAllNotificationsRead: () => request('/api/notifications/read-all', { method: 'PATCH' }),
  deleteNotification: (id) => request(`/api/notifications/${id}`, { method: 'DELETE' }),
  clearNotifications: (onlyRead = false) => request(`/api/notifications?read=${onlyRead}`, { method: 'DELETE' }),

  // 备份
  exportBackup: () => request('/api/backup/export'),
  importBackup: (data, mode = 'merge') => request('/api/backup/import', { method: 'POST', body: { data, mode } }),

  // 偏好
  getPreferences: () => request('/api/preferences'),
  updatePreferences: (theme) => request('/api/preferences', { method: 'PUT', body: { theme } }),
  resetPreferences: () => request('/api/preferences', { method: 'DELETE' }),

  // 管理员用户管理
  adminListUsers: (params = '') => request(`/api/admin/users${params}`),
  adminGetUser: (id) => request(`/api/admin/users/${id}`),
  adminUpdateUser: (id, body) => request(`/api/admin/users/${id}`, { method: 'PATCH', body })
};
