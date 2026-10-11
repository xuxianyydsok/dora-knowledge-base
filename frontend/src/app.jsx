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
import { Home } from './routes/Home.jsx';
import {
  Categories, Tags, Login, Videos, Github, Posts, PostEdit, PostView, BlogArchive, BlogTopics,
  Search, Graph, GraphHub, Favorites, Backup, Settings,
  Music, MusicView, MusicEdit, MusicLyrics,
  MusicPlayer,
  Movies, MovieView, MovieEdit, AdminUsers, News, SourceHealth,
  Gallery, Timeline, Moments, Books, Changelog
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
      {/* 视频页 2026-10-09 移除（见 docs/removed-features.md），旧链接回首页 */}
      <Redirect path="/videos" to="/" />
      <ProtectedRoute guest path="/github"><Github /></ProtectedRoute>
      <ProtectedRoute guest path="/posts"><Posts /></ProtectedRoute>
      <ProtectedRoute guest path="/posts/archive"><BlogArchive /></ProtectedRoute>
      <ProtectedRoute guest path="/posts/categories"><BlogTopics mode="categories" /></ProtectedRoute>
      <ProtectedRoute guest path="/posts/tags"><BlogTopics mode="tags" /></ProtectedRoute>
      <ProtectedRoute path="/posts/new"><PostEdit /></ProtectedRoute>
      <ProtectedRoute path="/posts/:id/edit"><PostEdit /></ProtectedRoute>
      <ProtectedRoute guest path="/posts/:id"><PostView /></ProtectedRoute>
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
      <ProtectedRoute guest path="/movies"><Movies /></ProtectedRoute>
      <ProtectedRoute path="/movies/new"><MovieEdit /></ProtectedRoute>
      <ProtectedRoute path="/movies/:id/edit"><MovieEdit /></ProtectedRoute>
      <ProtectedRoute guest path="/movies/watch/:source/:vid"><MovieView /></ProtectedRoute>
      <ProtectedRoute guest path="/movies/:id"><MovieView /></ProtectedRoute>
      <ProtectedRoute guest path="/books"><Books /></ProtectedRoute>
      <ProtectedRoute path="/admin/users"><AdminUsers /></ProtectedRoute>
      <ProtectedRoute path="/sources"><SourceHealth /></ProtectedRoute>
      {/* 收藏页对访客开放（2026-10-11 用户要求）：未登录时页面显示友好空态，
          而不是被重定向到登录页（顶栏「收藏」曾因此看起来像「站长登录」）。 */}
      <ProtectedRoute guest path="/favorites"><Favorites /></ProtectedRoute>
      {/* 更新日志（2026-10-11 用户要求）：公开只读，记录每一轮加了什么功能 */}
      <ProtectedRoute guest path="/changelog"><Changelog /></ProtectedRoute>
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
