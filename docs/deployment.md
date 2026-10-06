# 部署与 CI 说明（Phase6：含自定义域名上线流程）

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

---

# 自定义域名上线流程（Phase6）

架构约定：前端 Pages 与后端 Worker **各自绑定独立自定义域名**，全站 HTTPS，CORS 仅放行前端域名。
示例域名（请替换为你自己的）：前端 `https://kb.example.com`，后端 `https://api.kb.example.com`。

## 一、前置条件
1. 域名已注册，且 DNS 托管在 Cloudflare（在 Cloudflare 控制台「添加站点」，把 NS 记录改到 Cloudflare 分配的两个域名服务器）。
2. 站点状态为 **Active**（DNS 已生效）。
3. 已在 WSL 内完成 `wrangler login`，或准备好 `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`。
4. Worker 已至少部署过一次（`wrangler deploy`），Pages 项目已创建（`wrangler pages project create`）。

## 二、绑定后端 Worker 自定义域名
```bash
cd backend
# 方式 A（推荐）：在 wrangler.toml 声明路由后部署
#   [[routes]]
#   pattern = "api.kb.example.com"
#   custom_domain = true
npx wrangler deploy

# 方式 B：控制台操作
#   Cloudflare 控制台 → Workers & Pages → 选择 knowledge-base-api
#   → Settings → Domains & Routes → Add → Custom Domain → 填 api.kb.example.com
```
说明：
- 使用 `custom_domain = true` 时，Cloudflare 会**自动创建**指向该 Worker 的 DNS 记录（CNAME，已代理/橙云），并自动签发证书。
- 绑定成功后访问 `https://api.kb.example.com/health` 应返回 `{"status":"ok",...}`。
- **不要**手动为该主机名再建一条 A/CNAME，避免与自动记录冲突。

## 三、绑定前端 Pages 自定义域名
```bash
cd frontend
# 方式 A：CLI 绑定
npx wrangler pages domain add kb.example.com --project-name <CF_PAGES_PROJECT>

# 方式 B：控制台操作
#   Workers & Pages → 选择 Pages 项目 → Custom domains → Set up a domain → kb.example.com
```
说明：
- 若域名与 Pages 项目在同一 Cloudflare 账户，Cloudflare 会自动添加 CNAME 并签发证书。
- 若域名在别的账户，需按提示在 DNS 服务商手动添加 CNAME 指向 `<project>.pages.dev`，待证书状态变为 Active。
- SPA 需要把未知路径回退到 `index.html`；Pages 默认对 `index.html` 生效，若出现 404 请确认构建产物根目录为 `dist` 且包含 `index.html`。

## 四、DNS 记录一览
| 主机名 | 类型 | 内容 | 代理 | 用途 |
| --- | --- | --- | --- | --- |
| `kb.example.com` | CNAME | `<project>.pages.dev` | 已代理 | 前端 Pages |
| `api.kb.example.com` | CNAME | 由 Worker Custom Domain 自动创建 | 已代理 | 后端 Worker |

- SSL/TLS 模式：**Full (strict)**。
- 建议开启：Always Use HTTPS、Automatic HTTPS Rewrites、HSTS（确认子域全部 HTTPS 后再开 `includeSubDomains`）。
- 证书由 Cloudflare 边缘证书（Universal SSL）自动签发与续期，无需手动上传。

## 五、更新 CORS 与前端 API 地址（关键）
1. 后端 Worker 的 `CORS_ORIGINS` 必须改为正式前端域名（逗号分隔，可保留本地地址用于开发）：
   ```bash
   cd backend
   # 若写在 wrangler.toml 的 [vars] 中，直接修改后重新 deploy；
   # 或用 secret 覆盖（优先级更高）：
   npx wrangler secret put CORS_ORIGINS
   # 输入：https://kb.example.com,http://127.0.0.1:5173
   npx wrangler deploy
   ```
2. 前端构建时的 `VITE_API_BASE_URL` 改为 `https://api.kb.example.com`（GitHub Secret `VITE_API_BASE_URL`），重新触发前端部署。
3. 验证 CORS：浏览器打开前端站点，F12 Network 检查 `/api/*` 响应头含
   `Access-Control-Allow-Origin: https://kb.example.com`；从其他域名发起请求应被拒绝（无该响应头）。

## 六、Supabase 侧配置
1. **Auth → URL Configuration**：
   - Site URL：`https://kb.example.com`
   - Redirect URLs：追加 `https://kb.example.com/**`
2. 若使用邮件确认/找回密码，确认 SMTP 与邮件模板已配置。
3. 数据库迁移仍只走 `supabase db push`（禁止网页后台改表）。

## 七、Cloudflare R2
- 桶 `knowledge-base-assets` 存放封面/插图；数据库仅保存路径字符串。
- 如需前端直接展示 R2 文件，可在桶上配置**公开访问域名**（R2 → Settings → Public access / Custom domain），并把该域名写入前端配置；后端不代理二进制。

## 八、上线部署检查清单
**代码与配置**
- [ ] 所有迁移已通过 `supabase db push` 应用，`supabase migration list` 本地/远程一致
- [ ] `wrangler secret` 已配置：`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`CORS_ORIGINS`
- [ ] GitHub Secrets 已配置：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`CF_PAGES_PROJECT`、`VITE_API_BASE_URL`、`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`SUPABASE_ACCESS_TOKEN`、`SUPABASE_PROJECT_REF`、`SUPABASE_DB_PASSWORD`
- [ ] 仓库中无任何密钥文件（`.dev.vars`、`.env.local`、`supabase/.env.local` 均被 `.gitignore` 忽略）

**域名与证书**
- [ ] 前端域名解析到 Pages 且证书 Active
- [ ] 后端域名解析到 Worker 且 `/health` 返回 200
- [ ] SSL/TLS 为 Full (strict)，已开启 Always Use HTTPS
- [ ] `CORS_ORIGINS` 仅包含正式前端域名（+ 本地开发地址）

**功能验收**
- [ ] 登录 / 注册 / 退出正常，`/api/me` 返回正确角色
- [ ] 各资源模块（视频、GitHub、博客、音乐、影视、RSS）增删改查正常
- [ ] 画廊/时间流双视图、浅色/暗色主题切换正常
- [ ] 全局搜索、资源图谱、收藏夹、备份导入导出正常
- [ ] 通知中心可收到 RSS 新条目与链接失效告警
- [ ] 管理员用户面板可查看全部用户、启用/禁用、切换角色
- [ ] 越权验证：普通用户无法读写他人数据；管理员可读全部但**不可写他人数据**
- [ ] MCP 端点仅管理员可调用，普通用户返回 403
- [ ] Cron 定时抓取正常（`wrangler tail` 可见 `[cron] RSS 抓取完成`）

**运维**
- [ ] 已开启 Worker 日志/告警（`wrangler tail` 或 Dashboard 观测）
- [ ] R2 存储用量与访问策略已确认
- [ ] 已记录回滚方式：`wrangler rollback`（Worker）、Pages 控制台回滚到上一版本
