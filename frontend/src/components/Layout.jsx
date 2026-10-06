// 全局基础布局：顶栏 + 导航 + 主内容区
import { useRouter } from 'preact-router';
import { ThemeToggle } from './ThemeToggle.jsx';
import { NotificationBell } from './NotificationBell.jsx';
import { useAuth } from '../lib/auth.jsx';

export function Layout({ children }) {
  const { isAuthenticated, user, signOut, isAdmin } = useAuth();
  const [router] = useRouter();
  const path = router?.path || '/';

  const link = (href, label) => (
    <a href={href} class={path === href ? 'active' : ''}>{label}</a>
  );

  return (
    <div class="app-shell">
      <header class="app-header">
        <a href="/" class="brand">📚 知识库</a>
        <nav class="app-nav">
          {link('/', '首页')}
          {isAuthenticated && link('/videos', '视频')}
          {isAuthenticated && link('/github', 'GitHub')}
          {isAuthenticated && link('/posts', '博客')}
          {isAuthenticated && link('/music', '音乐')}
          {isAuthenticated && link('/favorites', '收藏')}
          {isAuthenticated && link('/graph', '图谱')}
          {isAuthenticated && link('/categories', '分类')}
          {isAuthenticated && link('/tags', '标签')}
        </nav>
        <span class="spacer" />
        {isAuthenticated && (
          <a href="/search" title="全局搜索" aria-label="全局搜索">🔍</a>
        )}
        <ThemeToggle />
        {isAuthenticated && <NotificationBell />}
        {isAuthenticated ? (
          <span class="row">
            <a href="/settings" title="设置" aria-label="设置">⚙️</a>
            <a href="/backup" title="备份" aria-label="备份">💾</a>
            <span class="muted">{isAdmin ? '👑 ' : ''}{user?.email}</span>
            <button onClick={signOut}>退出</button>
          </span>
        ) : (
          <a href="/login"><button class="primary">登录</button></a>
        )}
      </header>
      <main class="app-main">{children}</main>
    </div>
  );
}
