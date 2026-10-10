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
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { PointerGlow } from './components/PointerGlow.jsx';
import { Home } from './routes/Home.jsx';
import {
  Categories, Tags, Login, Videos, Github, Posts, PostEdit, PostView, BlogArchive, BlogTopics,
  Search, Graph, Favorites, Backup, Settings,
  Music, MusicView, MusicEdit, MusicLyrics,
  MusicPlayer,
  Movies, MovieView, MovieEdit, AdminUsers, News
} from './routes/routes.js';

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
      <ProtectedRoute guest path="/graph"><Graph /></ProtectedRoute>
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
      <ProtectedRoute path="/admin/users"><AdminUsers /></ProtectedRoute>
      <ProtectedRoute guest path="/favorites"><Favorites /></ProtectedRoute>
      <ProtectedRoute path="/backup"><Backup /></ProtectedRoute>
      <ProtectedRoute path="/settings"><Settings /></ProtectedRoute>
      <Home default />
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
