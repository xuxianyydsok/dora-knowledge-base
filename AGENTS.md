# AGENTS.md —— 给 AI 的进门须知

> **这个文件是给 AI 助手（Codex / Claude Code / Cursor 等）看的。**
> 任何 Agent 克隆本仓库后，**第一件事就是读这个文件**。
> 它会告诉你：这个项目是什么、怎么部署、怎么写文章、怎么发布。

---

## 一、这个项目是什么

**Dora Studio** —— 个人知识库网站（https://dora.xuguochen.de5.net）。

| 层 | 选型 | 部署位置 |
|---|---|---|
| 前端 | Preact + Vite（SPA，按路由分包） | Cloudflare Pages（项目名 `knowledge-base`） |
| 后端 | Cloudflare Workers（REST + MCP 端点 + Cron） | Worker `knowledge-base-api` → `https://api.xuguochen.de5.net` |
| 数据库 | Supabase（Postgres + Auth） | 项目 ref `wkpxbyauvnxvmzidbeer` |
| 存储 | Cloudflare R2（封面 / 插图 / 图书 / 音频） | 桶 `knowledge-base-assets` |
| 仓库 | GitHub | `xuxianyydsok/dora-knowledge-base` |

**主要栏目**：博客、GitHub 收藏、音乐、影视、图书、图展、时间轴、碎念、图谱、收藏、RSS 已移除。

---

## 二、我要写博客文章（最常用场景）

### 2.1 先读写作规范

**→ `docs/blog-writing-guide.md`**

里面写了：正文 HTML 结构、标题命名规则、slug 规则、篇幅、可用标签、范文。
**动手写之前必须读它**，否则写出来的文章格式会和现有 300+ 篇不一致。

### 2.2 再查「已经写了什么」（避免重复）

**这一步不能省。** AI 是无状态的，不查就不知道「软件工程」已经写到第八篇。

用 MCP 工具查询（见第四节怎么连）：

```
list_categories   → 看有哪些分类、每类几篇
list_posts        → 看某分类下已有文章的标题与序号
```

例如要写「软件工程」的下一篇：

```bash
# 1. 看这个分类写到第几篇了
curl -s -X POST "$API/api/mcp/invoke" \
  -H "Authorization: Bearer $ADMIN_JWT" -H 'Content-Type: application/json' \
  -d '{"tool":"list_posts","arguments":{"category":"软件工程","limit":100}}'
```

返回里能看到「软件工程（八）：CI/CD 流水线」已存在 → 所以新文章应该是「软件工程（九）：…」。

### 2.3 写文章

正文是**原生 HTML**（不是 Markdown），结构见写作规范。

### 2.4 发布

```bash
node tools/publish-post.mjs 文章.html \
  --title "软件工程（九）：xxx" \
  --category 软件工程 \
  --excerpt "一句话摘要" \
  --tags "标签1,标签2"
```

脚本会自动：生成 slug → 调用 MCP 接口 → 发布上线。加 `--dry-run` 只预览不提交。

---

## 三、怎么部署（改了代码要发布）

### 3.1 自动化（推荐）

**推送到 `main` 分支，GitHub Actions 会自动部署**：

| 改动位置 | 触发的工作流 | 效果 |
|---|---|---|
| `frontend/**` | Deploy Frontend | 构建并发布到 Cloudflare Pages |
| `backend/**` | Deploy Backend | 部署 Cloudflare Worker |
| `supabase/migrations/**` | Supabase DB Migrate | 应用数据库迁移 |

```bash
git add -A && git commit -m "..." && git push origin HEAD:main
```

### 3.2 手动部署（CI 挂了时用）

```bash
# 后端
cd backend && wrangler deploy

# 前端（需要先构建，环境变量从 backend/.dev.vars 取）
cd frontend
set -a && source <(grep -E '^(SUPABASE_URL|SUPABASE_ANON_KEY)=' ../backend/.dev.vars | sed 's/^/VITE_/') && set +a
export VITE_API_BASE_URL=https://api.xuguochen.de5.net
npm run build && wrangler pages deploy dist --project-name=knowledge-base --branch=main
```

### 3.3 改数据库结构

**唯一入口是 `supabase/migrations/` 下的 SQL 文件**，不要手改线上表。

```bash
# 写一个 supabase/migrations/<时间戳>_<说明>.sql，然后推送，CI 自动执行
```

---

## 四、MCP 接口（给 AI 用的工具）

**入口**：`https://api.xuguochen.de5.net/api/mcp`

| 方式 | 说明 |
|---|---|
| `GET /api/mcp/tools` | 工具发现，返回全部工具与参数定义 |
| `POST /api/mcp/invoke` | 直接调用：`{"tool":"...","arguments":{...}}` |
| `POST /api/mcp` | JSON-RPC 2.0（支持 `initialize` / `tools/list` / `tools/call`） |

**鉴权**：`Authorization: Bearer <管理员 JWT>`（仅站长可用，普通用户 403）。

### 可用工具

| 工具 | 用途 |
|---|---|
| `create_post` | 创建文章（标题、HTML 正文、slug、摘要、状态、标签） |
| `update_post` | 更新文章 |
| `list_posts` | **列出已有文章**（查重、确认序号） |
| `list_categories` | **列出分类及每类篇数** |
| `list_resources` | 列出资源（视频/GitHub/音乐/影视） |
| `list_assets` | 列出图片素材（选封面用） |
| `set_post_cover` | 设置文章封面 |
| `upload_image` | 上传图片（base64） |
| `add_video` / `add_github_repo` / `add_music` / `add_movie` | 新增各类资源 |
| `link_resources` | 把资源关联到文章 |

### 怎么拿 JWT

```bash
node tools/mcp-login.mjs
```

它用 `.env.local` 里的站长邮箱密码换一个 JWT，存到 `.mcp-token`（已被 .gitignore 忽略）。
后续脚本会自动读它。

---

## 五、写作规范（摘要）

**详细规范见 `docs/blog-writing-guide.md`**，这里只列最容易写错的几条：

- 正文是 **HTML**，不是 Markdown。外层用 `<section>`，分节用 `<h2>一、二、三…`
- 标题格式：`分类名（中文序号）：副标题`，例如 `软件工程（九）：xxx`
- slug 格式：`<分类英文>-<两位序号>-<英文关键词>`，例如 `software-engineering-09-xxx`
- **序号必须接着已有文章往下排**，先查 `list_posts` 再定
- 段落要成篇（每节 2~4 段，每段 150~400 字），不要写成要点列表
- 可用自定义标签：`<katex-inline>` / `<katex-block>` / `<three-scene>` / `<mermaid-chart>` / `<chart-2d>`

---

## 六、本地环境

### 6.1 环境要求

- Node.js 20+、Git、wrangler、Supabase CLI
- **在 WSL2 内操作**，项目放 WSL 原生文件系统（不要放 `/mnt/c/`）

### 6.2 敏感信息（严禁提交）

以下文件都已被 `.gitignore` 忽略，**不要读进对话、不要提交、不要打印**：

- `backend/.dev.vars`（Supabase URL / service role key）
- `frontend/.env.local`（VITE_ 开头的变量）
- `.env.local`（MCP 登录用的站长邮箱密码）
- `.mcp-token`（登录后拿到的 JWT）

### 6.3 常用命令

```bash
# 后端单测（136 项）
cd backend && npm run test:unit

# 前端构建
cd frontend && npm run build

# 前端探针（需要 dev server 跑在 5173）
cd frontend && npm run dev          # 另开一个终端
node frontend/tests/star3dLayout.probe.mjs   # 纯函数探针，不需要 server
```

---

## 七、行为约定

- **改完代码要跑测试**：`cd backend && npm run test:unit`，前端改动跑对应探针。
- **部署前先问用户**：除非用户明确说「直接部署」，否则改完先汇报、等确认。
- **不要动 `.dev.vars` / `.env.local` / `.mcp-token`**，也不要打印它们的值。
- **数据库只通过 migration 改**，不要手改线上表结构。
- **临时探针 Worker 用完要删**（`wrangler delete --name xxx --force`）。
- **写完文章后**，如果序号规则或分类有变化，记得同步更新 `docs/blog-writing-guide.md`。

---

## 八、文档地图

| 文件 | 内容 |
|---|---|
| `AGENTS.md` | **本文件** —— AI 的进门须知 |
| `docs/blog-writing-guide.md` | **博客写作规范**（写文章必读） |
| `docs/api.md` | 接口清单 |
| `docs/schema.md` | 数据库表结构 |
| `docs/deployment.md` | 部署与 CI 细节 |
| `docs/progress.md` | 开发进度与接力记录 |
| `docs/backlog.md` | 待办清单 |
| `README.md` | 项目总览 |
