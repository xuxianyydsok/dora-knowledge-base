// 受保护路由：未登录时重定向到登录页
//
// ⚠️ 重要：preact-router 会把**路由参数**（`:id` 等）连同 path/matches 一起作为 props 传给
// 匹配到的这个组件，必须原样转发给子组件。否则子页面拿到的 `id` 是 undefined，
// 请求变成 `/api/music/undefined`，后端返回「id 必须为合法 UUID」
// （曾导致所有受保护详情页 /music/:id、/music/:id/edit、/music/:id/lyrics、
//   /posts/:id、/movies/:id 全部打不开）。
import { cloneElement } from 'preact';
import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { useAuth } from '../lib/auth.jsx';

export function ProtectedRoute({ children, ...rest }) {
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) route('/login', true);
  }, [loading, isAuthenticated]);

  if (loading) return <div class="center-box">加载中…</div>;
  if (!isAuthenticated) return null;

  // 把 path / matches / 路由参数（id、slug…）转发给子组件
  return cloneElement(children, rest);
}
