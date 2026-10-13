// 受保护路由：未登录时重定向到登录页
// guest：访客模式（2026-10-09 起）下允许未登录只读浏览的页面，后端以站长身份只读返回
// admin：**仅管理员**可见的页面（2026-10-13 新增）。未登录 → 跳登录页；
//        已登录但非管理员 → 显示「仅站长可见」空态，而不是白屏或跳首页。
//        为什么需要它：像 /videos（视频库）这类「先留着、但暂不对访客开放」的功能，
//        用 guest=false 会把普通登录用户也挡在登录页外（体验莫名其妙），
//        用 guest=true 又会直接暴露给所有人。admin 才是准确表达。
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

import { LoadingState, EmptyState } from '../components/StateView.jsx';
export function ProtectedRoute({ children, guest = false, admin = false, ...rest }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated && !guest) route('/login', true);
  }, [loading, isAuthenticated, guest]);

  if (loading) return <LoadingState shape="list" count={4} />;
  if (!isAuthenticated && !guest) return null;

  // 仅管理员：已登录但不是站长时，给一句说明而不是空白页
  if (admin && !isAdmin) {
    return (
      <EmptyState
        icon="crown"
        title="这个页面只有站长能看"
        hint="它目前还在站长这边试用，暂未对访客开放。"
        action={<a class="btn primary" href="/">回到首页</a>}
      />
    );
  }

  // 把 path / matches / 路由参数（id、slug…）转发给子组件
  return cloneElement(children, rest);
}
