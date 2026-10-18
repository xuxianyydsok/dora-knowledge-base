// 应用根组件：Provider 组合 + 路由（按路由懒加载分包）
import { Suspense } from 'preact/compat';
import { Router, route } from 'preact-router';
import { useEffect } from 'preact/hooks';

function Redirect({ to }) { useEffect(() => { route(to, true); }, []); return null; }
import { AuthProvider, useAuth } from './lib/auth.jsx';
import { ThemeProvider } from './lib/theme.jsx';
import { ViewModeProvider } from './lib/viewMode.jsx';
import { PlayerProvider } from './lib/player.jsx';
import { Layout } from './components/Layout.jsx';
import { MiniPlayer } from './components/MiniPlayer.jsx';
import { Toaster } from './components/Toaster.jsx';
import { EmptyState } from './components/StateView.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { PointerGlow } from './components/PointerGlow.jsx';
import { ClickFx } from './components/ClickFx.jsx';
import { LiquidMetal } from './components/LiquidMetal.jsx';
import { RouteProgress } from './components/RouteProgress.jsx';
import { Home } from './routes/Home.jsx';
import {
  Categories, Tags, Login, Videos, Github, Posts, PostEdit, PostView, BlogArchive, BlogTopics,
  Search, Graph, GraphHub, Favorites, Backup, Settings,
  Music, MusicView, MusicEdit, MusicLyrics,
  MusicPlayer, AdminMusic,
  Movies, MovieView, MovieEdit, AdminUsers, News, SourceHealth,
  Gallery, Timeline, Moments, Books, BookRead, Changelog, Coop, AdminFeedback,
  AdminExcerpts,
  AdminHeroSubtitle,
  MathFrame, NotionPosts, NotionPostView
} from './routes/routes.js';

// 真正的 404：未匹配任何路由时显示，而不是静默回落到首页
function NotFound() {
  return (
    <EmptyState
      icon="search"
      title="页面不存在"
      hint="这个地址可能已失效，或输入有误。"
      action={<a class="btn primary" href="/">返回首页</a>}
    />
  );
}

function RouterView() {
  return (
    <Router>
      <Home path="/" />
      <Login path="/login" />
      <ProtectedRoute guest path="/categories"><Categories /></ProtectedRoute>
      <ProtectedRoute guest path="/tags"><Tags /></ProtectedRoute>
      <ProtectedRoute guest path="/news"><News /></ProtectedRoute>
      {/* 视频库（B站 / YouTube 收藏）2026-10-09 从导航下线，2026-10-13 起**仅站长可见**。
          用户要求：「这个视频的功能的话，其实我还想留着，但是能不能就只是在我的管理员端呈现，
          前端用户访问的那一端不能呈现」「只是相当于先留着，后续看是否需要开发」。
          因此：不再重定向到首页（那样站长自己也进不去），改成 admin-only 路由；
          入口只在管理员下拉菜单里（见 Layout.jsx），访客与普通用户看不到、也进不来。 */}
      <ProtectedRoute admin path="/videos"><Videos /></ProtectedRoute>
      <ProtectedRoute guest path="/github"><Github /></ProtectedRoute>
      <ProtectedRoute guest path="/posts"><Posts /></ProtectedRoute>
      <ProtectedRoute guest path="/posts/archive"><BlogArchive /></ProtectedRoute>
      <ProtectedRoute guest path="/posts/categories"><BlogTopics mode="categories" /></ProtectedRoute>
      <ProtectedRoute guest path="/posts/tags"><BlogTopics mode="tags" /></ProtectedRoute>
      <ProtectedRoute path="/posts/new"><PostEdit /></ProtectedRoute>
      <ProtectedRoute path="/posts/:id/edit"><PostEdit /></ProtectedRoute>
      <ProtectedRoute guest path="/posts/:id"><PostView /></ProtectedRoute>
      {/* Notion 博客分区（2026-10-14）：数据层与上面的 Halo 博客（/posts）**完全隔离**
          （独立表 notion_posts + 独立接口 /api/notion-posts），只在排版层面复用同一套
          组件（PostCard / ArticleReader）。列表与阅读页都对访客只读开放；
          未发布或非公开的文章由后端一律按「不存在」处理，不泄露存在性。 */}
      <ProtectedRoute guest path="/notion"><NotionPosts /></ProtectedRoute>
      <ProtectedRoute guest path="/notion/:slug"><NotionPostView /></ProtectedRoute>
      <ProtectedRoute guest path="/search"><Search /></ProtectedRoute>
      {/* 公开星图（顶栏「更多 → 图谱」）：博客图谱 / 开源项目图谱 */}
      <ProtectedRoute guest path="/graph/blog"><GraphHub mode="blog" /></ProtectedRoute>
      <ProtectedRoute guest path="/graph/repos"><GraphHub mode="repos" /></ProtectedRoute>
      {/* 站长个人控制台（聚合 AI 解读进度等私有数据），不再出现在顶栏 */}
      <ProtectedRoute guest path="/graph"><Graph /></ProtectedRoute>
      <ProtectedRoute guest path="/gallery"><Gallery /></ProtectedRoute>
      <ProtectedRoute guest path="/timeline"><Timeline /></ProtectedRoute>
      <ProtectedRoute guest path="/moments"><Moments /></ProtectedRoute>
      <ProtectedRoute guest path="/music"><Music /></ProtectedRoute>
      <ProtectedRoute path="/music/new"><MusicEdit /></ProtectedRoute>
      <ProtectedRoute path="/music/:id/edit"><MusicEdit /></ProtectedRoute>
      <ProtectedRoute guest path="/music/:id/lyrics"><MusicLyrics /></ProtectedRoute>
      <ProtectedRoute guest path="/music/:id/play"><MusicPlayer /></ProtectedRoute>
      <ProtectedRoute guest path="/music/:id"><MusicView /></ProtectedRoute>
      {/* 站长上传本地音乐（2026-10-13）：不带 guest —— 未登录直接跳登录页；
          页面内部还会再拦一次非管理员，避免普通用户误入。 */}
      <ProtectedRoute path="/admin/music"><AdminMusic /></ProtectedRoute>
      <ProtectedRoute guest path="/movies"><Movies /></ProtectedRoute>
      <ProtectedRoute path="/movies/new"><MovieEdit /></ProtectedRoute>
      <ProtectedRoute path="/movies/:id/edit"><MovieEdit /></ProtectedRoute>
      <ProtectedRoute guest path="/movies/watch/:source/:vid"><MovieView /></ProtectedRoute>
      <ProtectedRoute guest path="/movies/:id"><MovieView /></ProtectedRoute>
      <ProtectedRoute guest path="/books"><Books /></ProtectedRoute>
      <ProtectedRoute guest path="/books/:id"><BookRead /></ProtectedRoute>
      <ProtectedRoute path="/admin/users"><AdminUsers /></ProtectedRoute>
      <ProtectedRoute path="/sources"><SourceHealth /></ProtectedRoute>
      {/* 收藏页对访客开放（2026-10-11 用户要求）：未登录时页面显示友好空态，
          而不是被重定向到登录页（顶栏「收藏」曾因此看起来像「站长登录」）。 */}
      <ProtectedRoute guest path="/favorites"><Favorites /></ProtectedRoute>
      {/* 更新日志（2026-10-11 用户要求）：公开只读，记录每一轮加了什么功能 */}
      <ProtectedRoute guest path="/changelog"><Changelog /></ProtectedRoute>
      {/* 共创（2026-10-12）：公开只读介绍 + 访客可提交的反馈表单 */}
      <ProtectedRoute guest path="/coop"><Coop /></ProtectedRoute>
      {/* 数学讲义（考研数学一）：iframe 内嵌 public/math/ 下的静态子站，
          取代原先"整页跳走"的 data-native 跳转，让内容直接出现在导航下方。
          静态站内三页（微积分/线代/概率）在 iframe 内部跳转，不再离开主站。 */}
      <ProtectedRoute guest path="/math"><MathFrame /></ProtectedRoute>
      {/* 共创反馈管理：仅站长（不带 guest，未登录会被重定向到登录页） */}
      <ProtectedRoute path="/admin/feedback"><AdminFeedback /></ProtectedRoute>
      {/* 首页摘抄管理：仅站长（不带 guest，未登录会被重定向到登录页） */}
      <ProtectedRoute admin path="/admin/excerpts"><AdminExcerpts /></ProtectedRoute>
      {/* 首页轮播摘要：仅站长 */}
      <ProtectedRoute admin path="/admin/hero-subtitle"><AdminHeroSubtitle /></ProtectedRoute>
      <ProtectedRoute path="/backup"><Backup /></ProtectedRoute>
      <ProtectedRoute path="/settings"><Settings /></ProtectedRoute>
      <NotFound default />
    </Router>
  );
}

function Shell() {
  const { loading } = useAuth();
  if (loading) return <div class="center-box"><span class="spinner" aria-hidden="true" />正在载入…</div>;
  return (
    <Suspense fallback={<div class="center-box"><span class="spinner" aria-hidden="true" />正在载入…</div>}>
      <RouterView />
    </Suspense>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ViewModeProvider>
          <PlayerProvider>
            <PointerGlow />
            <ClickFx />
            <LiquidMetal />
            {/* 页面加载进度条：贴在视口顶端，只在真的等的时候出现（详见组件注释） */}
            <RouteProgress />
            <Layout>
              <Shell />
            </Layout>
            <MiniPlayer />
            <Toaster />
          </PlayerProvider>
        </ViewModeProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
