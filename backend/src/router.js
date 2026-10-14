// 极简路由：按 方法 + 路径 分发，支持 :id 参数
// 所有 API 前缀为 /api

import { corsHeaders, fail, HttpError } from './lib/response.js';
import * as categories from './routes/categories.js';
import * as tags from './routes/tags.js';
import * as me from './routes/me.js';
import * as videos from './routes/videos.js';
import * as github from './routes/github.js';
import * as posts from './routes/posts.js';
import * as notion from './routes/notion.js';
import * as media from './routes/media.js';
import * as mcp from './routes/mcp.js';
import * as search from './routes/search.js';
import * as graph from './routes/graph.js';
import * as favorites from './routes/favorites.js';
import * as notifications from './routes/notifications.js';
import * as backup from './routes/backup.js';
import * as preferences from './routes/preferences.js';
import * as music from './routes/music.js';
import * as musicUpload from './routes/musicUpload.js';
import * as movies from './routes/movies.js';
import * as admin from './routes/admin.js';
import * as news from './routes/news.js';
import * as douban from './routes/douban.js';
import * as musicCharts from './routes/musicCharts.js';
import * as assets from './routes/assets.js';
import * as files from './routes/files.js';
import * as gallery from './routes/gallery.js';
import * as moments from './routes/moments.js';
import * as feedback from './routes/feedback.js';
import * as timeline from './routes/timeline.js';
import * as books from './routes/books.js';
import * as wallpapers from './routes/wallpapers.js';
import * as heroSlides from './routes/heroSlides.js';
import * as dynamicSources from './routes/dynamicSources.js';
import { vodProxy } from './routes/vodProxy.js';

// 路由表：[method, pattern, handler]
// pattern 中 :name 表示路径参数；handler 依次接收 (request, env, param1, param2, ...)
const routes = [
  ['GET', '/api/me', me.getMe],
  ['PATCH', '/api/me', me.updateMe],

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

  // Notion 博客分区（独立表，2026-10-14）：与上面的 Halo 博客（posts）**数据层完全隔离**，
  // 只在排版层面复用前端组件。列表不下发正文，正文走 slug 端点。
  ['GET', '/api/notion-posts', notion.listNotionPosts],
  ['GET', '/api/notion-posts/slug/:slug', notion.getNotionPostBySlug],

  // 媒体文件（R2）：Notion 迁移的配图走 /api/media?path=notion/... 读取
  // （原稿正文里写的就是这个地址）。公开读只放行 notion/ 与 covers/notion/ 两个前缀，
  // 其余前缀登录后可读；上传 / 删除一律 requireAuth。详见 routes/media.js 头部说明。
  ['GET', '/api/media', media.getMedia],
  ['POST', '/api/media', media.uploadMedia],
  ['DELETE', '/api/media', media.deleteMedia],

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

  // 文档附件（R2）：上传/列出/删除需管理员；按 id 读取公开可读（仅 is_public=true 的文件）
  ['POST', '/api/files', files.uploadFile],
  ['GET', '/api/files', files.listFiles],
  ['GET', '/api/files/:id', files.getFile],
  ['DELETE', '/api/files/:id', files.deleteFile],

  // 图书（R2）：上传/改元数据/删除需管理员；列出对访客只返回 is_public=true；
  // 正文与封面按 id 公开可读（私人书仅本人），正文支持 Range 供 PDF 内嵌 / EPUB 阅读。
  // 分片上传三条 + 放弃一条：大文件走它（每片 8MiB，不受单请求体 100MB 平台上限约束）。
  ['POST', '/api/books', books.uploadBook],
  ['POST', '/api/books/multipart', books.createBookMultipart],
  ['PUT', '/api/books/multipart/:uploadId/parts/:partNumber', books.uploadBookPart],
  ['POST', '/api/books/multipart/:uploadId/complete', books.completeBookMultipart],
  ['DELETE', '/api/books/multipart/:uploadId', books.abortBookMultipart],
  ['GET', '/api/books', books.listBooks],
  ['GET', '/api/books/:id', books.getBook],
  ['GET', '/api/books/:id/file', books.getBookFile],
  ['GET', '/api/books/:id/cover', books.getBookCover],
  ['PATCH', '/api/books/:id', books.updateBook],
  ['DELETE', '/api/books/:id', books.deleteBook],

  // 动态壁纸（R2，图展的「动态壁纸」区）：上传/改/删需管理员；列出对访客只返回
  // is_public=true；视频按 id 公开可读并支持 Range（供 <video> 流式播放）。
  // R2 前缀 wallpapers/ 与图片素材的 assets/ 分开存（用户要求动静分开）。
  ['POST', '/api/wallpapers', wallpapers.uploadWallpaper],
  ['GET', '/api/wallpapers', wallpapers.listWallpapers],
  ['GET', '/api/wallpapers/:id', wallpapers.getWallpaper],
  ['GET', '/api/wallpapers/:id/file', wallpapers.getWallpaperFile],
  ['PATCH', '/api/wallpapers/:id', wallpapers.updateWallpaper],
  ['DELETE', '/api/wallpapers/:id', wallpapers.deleteWallpaper],

  // 首页轮播素材（2026-10-13）：只存对图展素材的引用，不重复存文件。
  // 读对访客开放（首页要显示），写全部 requireAdmin。
  // ⚠ 顺序：/api/hero/slides/order 是 3 段路径，必须排在 2 段的 /:id 之前，
  //   否则会被当成 id 吞掉（PUT /api/hero/slides/order 会变成「改 id=order 的项」）。
  ['GET', '/api/hero/slides', heroSlides.listHeroSlides],
  ['POST', '/api/hero/slides', heroSlides.createHeroSlide],
  ['PUT', '/api/hero/slides/order', heroSlides.reorderHeroSlides],
  ['PATCH', '/api/hero/slides/:id', heroSlides.updateHeroSlide],
  ['DELETE', '/api/hero/slides/:id', heroSlides.deleteHeroSlide],

  // 碎念（朋友圈式短动态）：读写需管理员；访客经公开读边界只看公开条目
  ['GET', '/api/moments', moments.listMoments],
  ['POST', '/api/moments', moments.createMoment],
  ['PATCH', '/api/moments/:id', moments.updateMoment],
  ['DELETE', '/api/moments/:id', moments.deleteMoment],

  // 共创反馈：**提交对所有人开放**（含访客，走 PUBLIC_POST_PATHS 白名单）；
  // 查看 / 改状态 / 删除仅站长（requireAdmin）。
  ['POST', '/api/feedback', feedback.createFeedback],
  ['GET', '/api/feedback', feedback.listFeedback],
  ['PATCH', '/api/feedback/:id', feedback.updateFeedback],
  ['DELETE', '/api/feedback/:id', feedback.deleteFeedback],

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
  // 管理员上传本地音频（requireAdmin，原始请求体直传；见 routes/musicUpload.js）
  ['POST', '/api/music/upload', musicUpload.uploadMusic],
  // 播放历史：3 段路径，必须排在 /api/music/:id 之前，否则会被当成 id='history'
  ['GET', '/api/music/history', music.listMusicHistory],
  ['GET', '/api/music/:id', music.getMusic],
  ['PATCH', '/api/music/:id', music.updateMusic],
  ['DELETE', '/api/music/:id', music.deleteMusic],
  ['GET', '/api/music/:id/progress', music.getMusicProgress],
  ['PUT', '/api/music/:id/progress', music.saveMusicProgress],
  // 上传曲目的字节端点：audio 给 <audio> 播放（支持 Range），cover 给封面图
  ['GET', '/api/music/:id/audio', musicUpload.getMusicAudio],
  ['GET', '/api/music/:id/cover', musicUpload.getMusicCover],

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

  // 动态影视源（LunaTV-config 订阅）：查看 / 手动重探 / 清空（仅管理员）
  ['GET', '/api/admin/vod-sources/dynamic', dynamicSources.getDynamicVodSources],
  ['POST', '/api/admin/vod-sources/dynamic/refresh', dynamicSources.refreshDynamicVodSources],
  ['POST', '/api/admin/vod-sources/dynamic/reset', dynamicSources.resetDynamicVodSources],

  // NewsNow 热榜（代理自部署的 newsnow-api）
  ['GET', '/api/news/sources', news.listNewsSources],
  ['GET', '/api/news/:id', news.getNews],

  // 全文检索
  ['GET', '/api/search', search.search],

  // 关联图谱
  ['GET', '/api/graph', graph.getGraph],
  ['GET', '/api/graph/blog', graph.getBlogGraph],
  ['GET', '/api/graph/repos', graph.getRepoGraph],
  ['GET', '/api/graph/console', graph.getConsole],
  ['GET', '/api/graph/board', graph.getBoard],

  // 收藏夹
  // 站长收藏（公开只读）：3 段路径，先于 2 段的 /api/favorites 匹配（避免被前缀规则吞掉）
  ['GET', '/api/favorites/public', favorites.listAdminFavorites],
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
