# 部署与 CI 说明（Phase0）

## 环境约定
- 所有命令在 **WSL2 Ubuntu** 内执行（不使用 Windows 端 CLI）
- 项目路径：WSL 原生文件系统（如 `~/projects/knowledge-base`），禁止放在 `/mnt/c/`
- 敏感信息一律通过 CI Secrets / `wrangler secret` / Supabase 环境变量注入，禁止硬编码

## 目录结构
```
project-root/
├── frontend/            # Preact 单页应用，Cloudflare Pages
├── backend/             # Cloudflare Workers，含 MCP 端点
├── supabase/migrations/ # 数据库迁移 SQL（唯一改表入口）
├── docs/                # 需求、Schema、部署文档
└── .github/workflows/   # GitHub Actions CI
```

## 本地开发
```bash
# 前端
cd frontend && npm install && npm run dev

# 后端
cd backend && npm install && npm run dev
```

## 数据库迁移（唯一改表方式）
```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push            # 应用 supabase/migrations 下的迁移
supabase migration list     # 查看迁移状态
```

## CI 流水线（GitHub Actions）
| 工作流 | 触发条件 | 作用 |
| --- | --- | --- |
| `deploy-frontend.yml` | `frontend/**` 变更 | 构建并发布到 Cloudflare Pages |
| `deploy-backend.yml` | `backend/**` 变更 | 部署 Cloudflare Worker |
| `db-migrate.yml` | `supabase/migrations/**` 变更 | 应用数据库迁移 |

### 需配置的 GitHub Secrets
- `CLOUDFLARE_API_TOKEN`：Cloudflare API Token（Pages + Workers 权限）
- `CLOUDFLARE_ACCOUNT_ID`：Cloudflare 账户 ID
- `CF_PAGES_PROJECT`：Cloudflare Pages 项目名
- `SUPABASE_ACCESS_TOKEN`：Supabase 访问令牌
- `SUPABASE_PROJECT_REF`：Supabase 项目 ref
- `SUPABASE_DB_PASSWORD`：Supabase 数据库密码

## 存储（Cloudflare R2）
- 桶名：`knowledge-base-assets`（封面/插图）
- 数据库仅保存 R2 路径字符串，禁止存二进制

## 数据库连接信息（本地）
- 项目 ref：`wkpxbyauvnxvmzidbeer`
- 区域：`ap-southeast-2`
- 直连主机：`db.wkpxbyauvnxvmzidbeer.supabase.co:5432`（**仅 IPv6**，WSL 内不可达）
- 连接池（IPv4，本地开发用）：`aws-0-ap-southeast-2.pooler.supabase.com:5432`
  - 用户名：`postgres.wkpxbyauvnxvmzidbeer`
- 本地凭证存放：`supabase/.env.local`（已被 `.gitignore` 忽略，禁止提交）
- CI 使用 GitHub Secret `SUPABASE_DB_PASSWORD`

> 注意：WSL2 内直连数据库走 IPv6 会 `ENETUNREACH`，本地脚本请统一使用连接池地址。

## 后端密钥（wrangler secret）
Phase1 起后端依赖以下 Cloudflare Worker Secrets（生产环境）：
```bash
cd backend
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```
本地开发通过 `backend/.dev.vars` 提供（已被 `.gitignore` 忽略）。

## 前端环境变量（Cloudflare Pages）
在 Pages 项目设置中配置：
- `VITE_API_BASE_URL`：后端 Worker 地址
- `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`

CI 部署前端时同样通过 GitHub Secrets 注入这三个变量。

## 本地开发常见问题
- **wrangler dev 启动后请求挂起/进程崩溃**：若 shell 中存在 `HTTP_PROXY/HTTPS_PROXY` 等代理变量，
  workerd 会继承并导致出站请求异常。启动本地 Worker 时请清除代理变量：
  ```bash
  cd backend
  env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u ALL_PROXY -u all_proxy \
    npx wrangler dev --port 8787 --local --ip 127.0.0.1
  ```
- 本地 `.dev.vars` 需包含 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、
  `CORS_ORIGINS`；`CORS_ORIGINS` 需包含本地前端地址（如 `http://127.0.0.1:5173`）。
- WSL2 内数据库直连走 IPv6 不可达，脚本请使用连接池地址（见上文）。
