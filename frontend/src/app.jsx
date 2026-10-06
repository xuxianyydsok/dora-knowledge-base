// 应用根组件：Provider 组合 + 路由（按路由懒加载分包）
import { Suspense } from 'preact/compat';
import { Router } from 'preact-router';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import { ThemeProvider } from './lib/theme.jsx';
import { ViewModeProvider } from './lib/viewMode.jsx';
import { Layout } from './components/Layout.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { Home } from './routes/Home.jsx';
import {
  Categories, Tags, Login, Videos, Github, Posts, PostEdit, PostView,
  Search, Graph, Favorites, Backup, Settings,
  Music, MusicView, MusicEdit
} from './routes/routes.js';

function RouterView() {
  return (
    <Router>
      <Home path="/" />
      <Login path="/login" />
      <ProtectedRoute path="/categories"><Categories /></ProtectedRoute>
      <ProtectedRoute path="/tags"><Tags /></ProtectedRoute>
      <ProtectedRoute path="/videos"><Videos /></ProtectedRoute>
      <ProtectedRoute path="/github"><Github /></ProtectedRoute>
      <ProtectedRoute path="/posts"><Posts /></ProtectedRoute>
      <ProtectedRoute path="/posts/new"><PostEdit /></ProtectedRoute>
      <ProtectedRoute path="/posts/:id/edit"><PostEdit /></ProtectedRoute>
      <ProtectedRoute path="/posts/:id"><PostView /></ProtectedRoute>
      <ProtectedRoute path="/search"><Search /></ProtectedRoute>
      <ProtectedRoute path="/graph"><Graph /></ProtectedRoute>
      <ProtectedRoute path="/music"><Music /></ProtectedRoute>
      <ProtectedRoute path="/music/new"><MusicEdit /></ProtectedRoute>
      <ProtectedRoute path="/music/:id/edit"><MusicEdit /></ProtectedRoute>
      <ProtectedRoute path="/music/:id"><MusicView /></ProtectedRoute>
      <ProtectedRoute path="/favorites"><Favorites /></ProtectedRoute>
      <ProtectedRoute path="/backup"><Backup /></ProtectedRoute>
      <ProtectedRoute path="/settings"><Settings /></ProtectedRoute>
      <Home default />
    </Router>
  );
}

function Shell() {
  const { loading } = useAuth();
  if (loading) return <div class="center-box">加载中…</div>;
  return (
    <Suspense fallback={<div class="center-box">加载中…</div>}>
      <RouterView />
    </Suspense>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ViewModeProvider>
          <Layout>
            <Shell />
          </Layout>
        </ViewModeProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
