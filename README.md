# 知识库项目

个人知识库系统：学习视频、GitHub 收藏、HTML 博客、音乐、RSS、影视库，支持画廊/时间流双视图与明暗主题。

## 技术栈
- 前端：Preact + Vite（Cloudflare Pages）
- 后端：Cloudflare Workers + wrangler（REST API + 管理员 MCP 端点）
- 数据库：Supabase（Postgres + Auth + RLS）
- 存储：Cloudflare R2（仅存文件路径）
- CI/CD：GitHub Actions

## 文档
- 需求：`docs/requirements.md`
- 数据库 Schema：`docs/schema.md`
- 部署说明：`docs/deployment.md`

## 开发阶段
- Phase0：环境初始化与项目骨架
- Phase1：公共底座（鉴权、分类标签、全局 UI）
- Phase2：核心学习资源 + MCP 端点
- Phase3：扩展功能 + 通知中心
- Phase4：音乐收藏库
- Phase5：RSS + 影视库
- Phase6：管理员面板与上线部署
