// 受保护路由：未登录时重定向到登录页
import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { useAuth } from '../lib/auth.jsx';

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) route('/login', true);
  }, [loading, isAuthenticated]);

  if (loading) return <div class="center-box">加载中…</div>;
  if (!isAuthenticated) return null;
  return children;
}
