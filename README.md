# 知识库项目

个人资源知识库平台：统一管理 HTML 博客、学习视频（B站/YouTube）、GitHub 收藏、音乐、影视与 RSS 订阅。
内置画廊网格 / 时间流两套通用视图、浅色/暗色主题（支持自定义配色）、全局搜索、资源关联图谱、收藏夹、JSON 备份与通知中心。
提供**管理员专用 MCP 端点**，供 AI 自动创建/更新博客并绑定各类资源，减少手动录入。

## 技术栈
| 层 | 选型 |
| --- | --- |
| 前端 | Preact + Vite（单页应用，按路由分包，重型库懒加载），部署于 Cloudflare Pages |
| 后端 | Cloudflare Workers + wrangler（REST API + 管理员 MCP 端点 + Cron 定时抓取） |
| 数据库 | Supabase（Postgres + Auth + RLS），迁移由 Supabase CLI 管理 |
| 存储 | Cloudflare R2（封面/插图，数据库仅存路径字符串） |
| 版本控制 | Git + GitHub Actions（Cloudflare CI） |

## 核心特性
- **统一资源模型**：视频/GitHub/音乐/影视/RSS 文章统一存入 `resources` 表（`type` 区分），自动共享标签、分类、收藏夹、全局检索与图谱能力。
- **HTML 博客**：正文仅存原生 HTML，支持自定义标签 `<katex-inline>`、`<katex-block>`、`<three-scene>`、`<mermaid-chart>`、`<chart-2d>`；前端按需懒加载对应重型库，首页不加载。
- **权限模型**：所有业务表带 `user_id`；普通用户仅读写本人数据；管理员可读全部（`?all=true`），但**写操作始终限定本人**；MCP 端点仅管理员可调用。
- **通知中心**：RSS 新条目、播放链接失效告警，支持未读计数与标记已读。
- **RSS 模块**：Worker Cron 每小时分批抓取，ETag/Last-Modified 条件请求，规避 30s 超时；支持 OPML 导入导出。

## 目录结构
```
knowledge-base/
├── frontend/                 # Preact 前端（Cloudflare Pages）
│   └── src/{components,routes,lib,renderers,styles}
├── backend/                  # Cloudflare Workers 后端
│   ├── src/{routes,lib,middleware}
│   └── wrangler.toml
├── supabase/migrations/      # 数据库迁移（唯一改表入口）
├── docs/                     # 需求、Schema、API、前端、部署文档
└── .github/workflows/        # CI：前端 Pages / 后端 Workers / 数据库迁移
```

## 本地开发

### 0. 环境要求（WSL2 Ubuntu 内执行，不使用 Windows 端 CLI）
- Node.js 20+ 与 npm
- Git（已配置 `user.name` / `user.email`）
- Supabase CLI、wrangler
- 项目放在 WSL 原生文件系统（如 `~/projects/knowledge-base`），**禁止**放在 `/mnt/c/`

### 1. 安装依赖
```bash
cd frontend && npm install
cd ../backend && npm install
```

### 2. 配置本地环境变量（均已被 .gitignore 忽略，禁止提交）
`backend/.dev.vars`：
```ini
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
# 可选
# SUPABASE_JWT_SECRET=<jwt secret>   # 兼容 HS256
# GITHUB_TOKEN=<token>               # 提升 GitHub 速率限制
# TMDB_API_KEY=<key>                 # 影视元数据优先使用 TMDB
```
`frontend/.env.local`：
```ini
VITE_API_BASE_URL=http://127.0.0.1:8787
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

### 3. 数据库迁移
```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push          # 应用 supabase/migrations 下的迁移
supabase migration list   # 核对本地/远程迁移状态
```
> 所有表结构变更必须新增迁移文件，**禁止在 Supabase 网页后台手动改表**。

### 4. 启动本地服务
```bash
# 后端（注意清除代理变量，否则 workerd 出站请求异常）
cd backend
env -u CODEX_CI -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy \
  -u ALL_PROXY -u all_proxy npx wrangler dev --port 8787 --local --ip 127.0.0.1

# 前端（另开终端）
cd frontend && npx vite --port 5173 --host 127.0.0.1
```
- 后端健康检查：`curl http://127.0.0.1:8787/health`
- 本地触发 Cron：`curl "http://127.0.0.1:8787/cdn-cgi/local/scheduled"`
- 访问 `http://127.0.0.1:5173`，注册/登录后使用。

### 5. 设为管理员
注册后，用 service_role key 调用 Supabase REST 把 `user_profiles.role` 改为 `admin`：
```bash
curl -X PATCH "$SUPABASE_URL/rest/v1/user_profiles?id=eq.<user_id>" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" -d '{"role":"admin"}'
```

## 环境变量清单

### 后端 Worker Secrets（生产）
| 名称 | 必填 | 说明 |
| --- | --- | --- |
| `SUPABASE_URL` | ✅ | Supabase 项目地址 |
| `SUPABASE_ANON_KEY` | ✅ | 匿名密钥 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | 服务角色密钥（仅后端使用） |
| `CORS_ORIGINS` | ✅ | 允许的前端域名，逗号分隔 |
| `SUPABASE_JWT_SECRET` | ❌ | 兼容 HS256 签名时使用 |
| `GITHUB_TOKEN` | ❌ | 提升 GitHub 元信息抓取速率限制 |
| `TMDB_API_KEY` | ❌ | 影视元数据优先使用 TMDB |

### 前端构建变量（Cloudflare Pages）
| 名称 | 必填 | 说明 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | ✅ | 后端 Worker 地址 |
| `VITE_SUPABASE_URL` | ✅ | Supabase 项目地址 |
| `VITE_SUPABASE_ANON_KEY` | ✅ | 匿名密钥 |

### GitHub Actions Secrets
| 名称 | 用途 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Pages + Workers 部署 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID |
| `CF_PAGES_PROJECT` | Pages 项目名 |
| `VITE_API_BASE_URL` / `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | 前端构建注入 |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI 登录 |
| `SUPABASE_PROJECT_REF` | Supabase 项目 ref |
| `SUPABASE_DB_PASSWORD` | 数据库密码（迁移用） |

## 部署
```bash
# 后端
cd backend && npx wrangler deploy
npx wrangler secret put SUPABASE_URL          # 其余 secret 同理

# 前端
cd frontend && npm run build
npx wrangler pages deploy dist --project-name <CF_PAGES_PROJECT>
```
CI 在 `main` 分支按路径自动触发：`frontend/**` → Pages，`backend/**` → Workers，`supabase/migrations/**` → 数据库迁移。

**自定义域名绑定、DNS/SSL 配置与上线检查清单见 `docs/deployment.md`。**

## MCP 端点（管理员专用）
仅管理员 JWT 可访问，供 AI 自动化维护内容：
```bash
# 工具发现
curl -H "Authorization: Bearer $ADMIN_TOKEN" "$API/api/mcp/tools"

# 调用：创建博客并绑定资源
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"tool":"create_post","arguments":{"title":"标题","content":"<p>正文</p>","status":"published"}}' \
  "$API/api/mcp/invoke"

# JSON-RPC 2.0 入口
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' "$API/api/mcp"
```
工具清单：`create_post`、`update_post`、`add_video`、`add_github_repo`、`add_music`、`add_movie`、`link_resources`、`list_resources`。

## 文档索引
- **开发进度与接力（先看这个）**：`docs/progress.md`
- 需求：`docs/requirements.md`
- 数据库 Schema：`docs/schema.md`
- API：`docs/api.md`
- 前端说明：`docs/frontend.md`
- 部署与上线：`docs/deployment.md`
- 存储：`docs/storage.md`
- 外部影音接口实测清单：`docs/interface-inventory.md`

## 开发阶段
| 阶段 | 内容 |
| --- | --- |
| Phase0 | 环境初始化与项目骨架、数据库迁移、CI |
| Phase1 | 公共底座：JWT 鉴权、分类标签、全局 UI 与双视图 |
| Phase2 | 学习视频、GitHub 收藏、HTML 博客与渲染引擎、MCP 端点 |
| Phase3 | 全文检索、关联图谱、收藏夹、备份、主题配色、通知中心 |
| Phase4 | 音乐收藏库 |
| Phase5 | RSS 订阅 + 影视库 |
| Phase6 | 管理员用户面板、权限统一修复、域名部署与文档 |

Phase0–6 之后的增量（按时间顺序）：自定义域名上线 → SaaS 液态玻璃风格改造与落地页 →
品牌更名 **Dora** + 自托管字体 → 现代线性图标系统 + 品牌流光 →
音乐/影视多源聚合（Audius + GD音乐台 / 苹果CMS 采集源）+ 黑胶播放器 + 同步歌词 →
影视采集源扩到 5 个、动漫类目搜索、元数据补全（Cinemeta / Bangumi / Kitsu）。
**当前进度与下一步见 `docs/progress.md`。**
