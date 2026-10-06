// 首页（Phase1 占位）：后续阶段挂载各资源模块
import { useAuth } from '../lib/auth.jsx';

export function Home() {
  const { isAuthenticated } = useAuth();
  return (
    <section class="stack">
      <h1>知识库</h1>
      <p class="muted">
        管理博客、学习视频、GitHub 收藏、音乐、RSS 订阅与影视资源。
      </p>
      {!isAuthenticated && (
        <p><a href="/login">登录</a> 后开始管理你的资源。</p>
      )}
    </section>
  );
}
