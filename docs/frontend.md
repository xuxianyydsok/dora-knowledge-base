# 前端说明（Phase1）

技术栈：Preact + preact-router + Vite，Supabase Auth 登录，Cloudflare Pages 托管。

## 目录
```
frontend/src/
├── main.jsx            # 入口，注入全局样式
├── app.jsx             # Provider 组合 + 路由
├── lib/
│   ├── config.js       # 运行时配置（Vite 环境变量）
│   ├── supabase.js     # Supabase Auth 客户端
│   ├── api.js          # 后端 REST 客户端（自动附带 JWT）
│   ├── auth.jsx        # 鉴权上下文（会话 + 角色）
│   ├── theme.jsx       # 主题上下文（light/dark）
│   └── viewMode.jsx    # 视图模式上下文（gallery/timeline）
├── components/
│   ├── Layout.jsx      # 全局布局（顶栏/导航）
│   ├── Card.jsx        # 通用卡片
│   ├── TagChip.jsx     # 标签徽章（自定义颜色）
│   ├── GalleryView.jsx # 画廊网格视图
│   ├── TimelineView.jsx# 时间流视图
│   ├── ViewSwitch.jsx  # 视图切换
│   ├── ThemeToggle.jsx # 主题切换
│   └── ProtectedRoute.jsx # 受保护路由
├── routes/
│   ├── Home.jsx / Login.jsx / Categories.jsx / Tags.jsx
│   └── routes.js       # 懒加载路由表
└── styles/global.css   # 主题变量与组件样式
```

## 关键设计
- **路由分包**：非首页路由通过 `preact/compat` 的 `lazy` + 动态 `import()` 按路由拆分。
- **主题**：CSS 变量定义浅色/暗色两套，`data-theme` 属性切换，持久化到 localStorage。
- **双视图**：`gallery`/`timeline` 全局上下文切换，所有资源板块复用 `Card` + 两个视图组件。
- **角色**：登录后调用 `/api/me` 获取 `user_profiles.role`，而非依赖 `user_metadata`。
- **重型库懒加载**：KaTeX/Three.js/Mermaid/Chart.js/D3 在 Phase2+ 博客页按需加载，Phase1 不引入。

## 环境变量（frontend/.env.local，禁止提交）
```
VITE_API_BASE_URL=http://127.0.0.1:8787
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```
