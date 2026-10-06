// 全局基础布局：顶栏 + 导航 + 主内容区
import { useRouter } from 'preact-router';
import { ThemeToggle } from './ThemeToggle.jsx';
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
          {isAuthenticated && link('/categories', '分类')}
          {isAuthenticated && link('/tags', '标签')}
        </nav>
        <span class="spacer" />
        <ThemeToggle />
        {isAuthenticated ? (
          <span class="row">
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
