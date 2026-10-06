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

async function request(path, { method = 'GET', body } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeader())
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

  // 博客
  listPosts: (params = '') => request(`/api/posts${params}`),
  getPost: (id) => request(`/api/posts/${id}`),
  getPostBySlug: (slug) => request(`/api/posts/slug/${encodeURIComponent(slug)}`),
  createPost: (body) => request('/api/posts', { method: 'POST', body }),
  updatePost: (id, body) => request(`/api/posts/${id}`, { method: 'PATCH', body }),
  deletePost: (id) => request(`/api/posts/${id}`, { method: 'DELETE' })
};
