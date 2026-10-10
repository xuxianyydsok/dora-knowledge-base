// 极简路由：按 方法 + 路径 分发，支持 :id 参数
// 所有 API 前缀为 /api

import { corsHeaders, fail, HttpError } from './lib/response.js';
import * as categories from './routes/categories.js';
import * as tags from './routes/tags.js';
import * as me from './routes/me.js';
import * as videos from './routes/videos.js';
import * as github from './routes/github.js';
import * as posts from './routes/posts.js';
import * as mcp from './routes/mcp.js';
import * as search from './routes/search.js';
import * as graph from './routes/graph.js';
import * as favorites from './routes/favorites.js';
import * as notifications from './routes/notifications.js';
import * as backup from './routes/backup.js';
import * as preferences from './routes/preferences.js';
import * as music from './routes/music.js';
import * as movies from './routes/movies.js';
import * as admin from './routes/admin.js';
import * as news from './routes/news.js';
import * as douban from './routes/douban.js';
import * as musicCharts from './routes/musicCharts.js';
import * as assets from './routes/assets.js';
import * as gallery from './routes/gallery.js';
import * as timeline from './routes/timeline.js';
import { vodProxy } from './routes/vodProxy.js';

// 路由表：[method, pattern, handler]
// pattern 中 :name 表示路径参数；handler 依次接收 (request, env, param1, param2, ...)
const routes = [
  ['GET', '/api/me', me.getMe],

  // 管理员用户管理（仅管理员）
  ['GET', '/api/admin/users', admin.listUsers],
  ['GET', '/api/admin/users/:id', admin.getUser],
  ['PATCH', '/api/admin/users/:id', admin.updateUser],

  // 分类
  ['GET', '/api/categories', categories.listCategories],
  ['POST', '/api/categories', categories.createCategory],
  ['PATCH', '/api/categories/:id', categories.updateCategory],
  ['DELETE', '/api/categories/:id', categories.deleteCategory],

  // 标签
  ['GET', '/api/tags', tags.listTags],
  ['POST', '/api/tags', tags.createTag],
  ['POST', '/api/tags/batch', tags.batchCreateTags],
  ['PATCH', '/api/tags/batch', tags.batchUpdateTags],
  ['DELETE', '/api/tags/batch', tags.batchDeleteTags],
  ['PATCH', '/api/tags/:id', tags.updateTag],
  ['DELETE', '/api/tags/:id', tags.deleteTag],

  // 学习视频
  ['GET', '/api/videos', videos.listVideos],
  ['POST', '/api/videos', videos.createVideo],
  ['POST', '/api/videos/fetch', videos.fetchVideoInfo],
  ['GET', '/api/videos/:id', videos.getVideo],
  ['PATCH', '/api/videos/:id', videos.updateVideo],
  ['DELETE', '/api/videos/:id', videos.deleteVideo],
  ['GET', '/api/videos/:id/progress', videos.getVideoProgress],
  ['PUT', '/api/videos/:id/progress', videos.saveVideoProgress],

  // GitHub 收藏
  ['GET', '/api/github', github.listGithub],
  ['POST', '/api/github', github.createGithub],
  ['POST', '/api/github/fetch', github.fetchGithubInfo],
  ['POST', '/api/github/sync', github.syncGithub],
  ['POST', '/api/github/analyze', github.analyzeGithub],
  ['GET', '/api/github/:id', github.getGithub],
  ['PATCH', '/api/github/:id', github.updateGithub],
  ['DELETE', '/api/github/:id', github.deleteGithub],

  // 博客
  ['GET', '/api/posts', posts.listPosts],
  ['POST', '/api/posts', posts.createPost],
  ['GET', '/api/posts/slug/:slug', posts.getPostBySlug],
  ['GET', '/api/posts/:id', posts.getPost],
  ['PATCH', '/api/posts/:id', posts.updatePost],
  ['DELETE', '/api/posts/:id', posts.deletePost],

  // 图片素材（R2）：上传/列出/删除需管理员；按 id 读取完全公开
  ['POST', '/api/assets', assets.uploadAsset],
  ['GET', '/api/assets', assets.listAssets],
  ['GET', '/api/assets/:id', assets.getAsset],
  ['DELETE', '/api/assets/:id', assets.deleteAsset],

  // 图片展览（策展元数据）：读写需管理员；访客经公开读边界只看公开条目
  ['GET', '/api/gallery', gallery.listGalleryItems],
  ['POST', '/api/gallery', gallery.createGalleryItem],
  ['PATCH', '/api/gallery/:id', gallery.updateGalleryItem],
  ['DELETE', '/api/gallery/:id', gallery.deleteGalleryItem],

  // 公开时间轴（聚合已发布博客 + 公开资源 + 公开展览）
  ['GET', '/api/timeline', timeline.listTimeline],

  // 音乐收藏库
  ['GET', '/api/music', music.listMusic],
  ['POST', '/api/music', music.createMusic],
  ['POST', '/api/music/search', music.searchMusicMeta],
  ['GET', '/api/music/charts', musicCharts.listMusicCharts],
  ['GET', '/api/img/music', musicCharts.musicImage],
  ['POST', '/api/music/lyrics', music.getMusicLyrics],
  ['POST', '/api/music/stream', music.resolveMusicStream],
  ['GET', '/api/music/:id', music.getMusic],
  ['PATCH', '/api/music/:id', music.updateMusic],
  ['DELETE', '/api/music/:id', music.deleteMusic],
  ['GET', '/api/music/:id/progress', music.getMusicProgress],
  ['PUT', '/api/music/:id/progress', music.saveMusicProgress],

  // 影视收藏库
  ['GET', '/api/movies', movies.listMovies],
  ['POST', '/api/movies', movies.createMovie],
  ['POST', '/api/movies/search', movies.searchMovieMeta],
  ['GET', '/api/movies/latest', movies.listMovieLatest],
  ['GET', '/api/movies/douban', douban.listDouban],
  ['GET', '/api/img/douban', douban.doubanImage],
  ['GET', '/api/movies/sources/health', movies.getVodSourceHealth],
  ['POST', '/api/movies/source-detail', movies.getMovieSourceDetail],
  ['GET', '/api/movies/:id', movies.getMovie],
  ['PATCH', '/api/movies/:id', movies.updateMovie],
  ['DELETE', '/api/movies/:id', movies.deleteMovie],
  // 重新匹配片源（原源下线/死链时，用标题去在用源重搜并回填；仅本人）
  ['POST', '/api/movies/:id/refresh-source', movies.refreshMovieSource],
  ['GET', '/api/movies/:id/progress', movies.getMovieProgress],
  ['PUT', '/api/movies/:id/progress', movies.saveMovieProgress],

  // 统一源健康中心（影视 + 音乐）；管理员可全量探测，访客只读缓存
  ['GET', '/api/sources/health', movies.getSourcesHealth],

  // NewsNow 热榜（代理自部署的 newsnow-api）
  ['GET', '/api/news/sources', news.listNewsSources],
  ['GET', '/api/news/:id', news.getNews],


  // 全文检索
  ['GET', '/api/search', search.search],

  // 关联图谱
  ['GET', '/api/graph', graph.getGraph],
  ['GET', '/api/graph/console', graph.getConsole],
  ['GET', '/api/graph/board', graph.getBoard],

  // 收藏夹
  ['GET', '/api/favorites', favorites.listFavorites],
  ['POST', '/api/favorites', favorites.createFavorite],
  ['DELETE', '/api/favorites/target', favorites.deleteFavoriteByTarget],
  ['DELETE', '/api/favorites/:id', favorites.deleteFavorite],

  // 通知中心
  ['GET', '/api/notifications', notifications.listNotifications],
  ['GET', '/api/notifications/count', notifications.countUnread],
  ['POST', '/api/notifications', notifications.createNotification],
  ['POST', '/api/notifications/check-links', notifications.checkLinks],
  ['PATCH', '/api/notifications/read-all', notifications.markAllRead],
  ['DELETE', '/api/notifications', notifications.clearNotifications],
  ['PATCH', '/api/notifications/:id', notifications.updateNotification],
  ['DELETE', '/api/notifications/:id', notifications.deleteNotification],

  // 备份导入导出
  ['GET', '/api/backup/export', backup.exportBackup],
  ['POST', '/api/backup/import', backup.importBackup],

  // 用户偏好（主题配色）
  ['GET', '/api/preferences', preferences.getPreferences],
  ['PUT', '/api/preferences', preferences.updatePreferences],
  ['DELETE', '/api/preferences', preferences.resetPreferences],

  // 管理员 MCP 端点
  ['GET', '/api/mcp/tools', mcp.listMcpTools],
  ['POST', '/api/mcp/invoke', mcp.invokeMcpTool],
  ['POST', '/api/mcp', mcp.mcpRpc]
];

function matchRoute(method, pathname) {
  for (const [m, pattern, handler] of routes) {
    if (m !== method) continue;
    const pParts = pattern.split('/').filter(Boolean);
    const uParts = pathname.split('/').filter(Boolean);
    if (pParts.length !== uParts.length) continue;

    const params = [];
    let matched = true;
    for (let i = 0; i < pParts.length; i++) {
      if (pParts[i].startsWith(':')) {
        params.push(decodeURIComponent(uParts[i]));
      } else if (pParts[i] !== uParts[i]) {
        matched = false;
        break;
      }
    }
    if (matched) return { handler, params };
  }
  return null;
}

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  const { pathname } = url;

  // 影视播放代理：纯代理、免鉴权、ACAO *（含自己的预检处理）
  if (pathname === '/api/vod/proxy' && ['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    try {
      return await vodProxy(request, env);
    } catch (err) {
      console.error('vod proxy 错误:', err?.stack || err);
      return new Response(JSON.stringify({ error: err?.message || '代理失败' }), {
        status: 502, headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }

  // CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  // 健康检查
  if (pathname === '/health') {
    return new Response(JSON.stringify({ status: 'ok', service: 'knowledge-base-api' }), {
      headers: { 'content-type': 'application/json', ...corsHeaders(request, env) }
    });
  }

  const match = matchRoute(request.method, pathname);
  if (!match) return fail('接口不存在', 404, request, env);

  try {
    return await match.handler(request, env, ...match.params);
  } catch (err) {
    if (err instanceof HttpError) {
      return fail(err.message, err.status, request, env, err.extra);
    }
    console.error('未处理错误:', err?.stack || err);
    return fail(err?.message || '服务器内部错误', err?.status || 500, request, env);
  }
}
