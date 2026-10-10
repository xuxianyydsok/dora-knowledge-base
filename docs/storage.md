# 存储说明（Cloudflare R2 图片素材）

> 状态标注：✅ 已实现　🧭 计划中（尚未实现）
> 本文档在 2026-10-10（分支 `feat/r2-assets`）按实现现状重写。

## 1. 存储桶
| 项 | 值 |
| --- | --- |
| 桶名 | `knowledge-base-assets` |
| 账户 / Account ID | 见 Cloudflare 控制台与 `CLOUDFLARE_ACCOUNT_ID`（**不写入仓库**） |
| 存储类别 | Standard |
| Worker 绑定 | `R2_BUCKET`（见 `backend/wrangler.toml`） |
| 用途 | 博客封面、文章插图等静态图片 |

约定：
- 数据库（`public.assets`）**只存元数据**，二进制一律放 R2；**禁止存储二进制**。
- 禁止在数据库或 R2 存放音视频、影视原始文件，只存元数据与文本。
- 前端**不直接持有 R2 凭证**；上传/读取/删除一律经 Worker API。

## 2. 已实现的接口（✅）

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/assets` | `requireAdmin` | `multipart/form-data` 上传，字段名 `file`；返回素材行（含 `public_url`） |
| GET | `/api/assets` | `requireAdmin` | 列出本人素材，支持 `?limit=`（默认 24，≤100）与 `?offset=` |
| GET | `/api/assets/:id` | **完全公开，不鉴权** | 按 `assets.id`（uuid）返回图片字节 |
| DELETE | `/api/assets/:id` | `requireAdmin` | 删除；被文章引用时返回 `409` |

路由注册见 `backend/src/router.js`，实现见 `backend/src/routes/assets.js`。

### 2.1 为什么公开读取用 `id` 而不是 R2 object key
- URL 干净：`https://api.xuguochen.de5.net/api/assets/<uuid>`，无 `%2F` 编码与转义风险。
- 天然满足「只能读表里存在的记录」——不会把 R2 变成**任意 key 探测器**。
- object key 只在服务端使用，可随时调整命名规则而不破坏已发布 URL。

### 2.2 object key 与 public_url
- **object key 完全由服务端生成**：`assets/<user_id>/<YYYY>/<uuid>.<ext>`。
  用户提供的原始文件名**只作展示/下载名**，绝不参与 key，杜绝目录穿越与注入。
- `public_url = <请求 origin>/api/assets/<id>`，上传时按**当次请求 origin** 计算并入库
  （例如 `https://api.xuguochen.de5.net/api/assets/<uuid>`）。
- `posts.cover_path` 直接存这个**绝对地址**，前端 `<img src>` 可直接使用。

### 2.3 上传安全（✅）
- 允许格式：**仅** JPEG / PNG / WebP / AVIF；SVG / GIF / HTML / 未知格式一律 `415`。
- **魔数与声明 MIME 必须一致**（不信任 `Content-Type` 与扩展名），实现在
  `backend/src/lib/imageType.js#resolveImageType`。
- 单张上限 **10MB**（`10 * 1024 * 1024` 字节）；超限 `413`。先看 `file.size` 快速拒绝，
  再读 `arrayBuffer()` 复核实际长度。
- 文件名清洗：去目录分隔符、控制字符、`..` 穿越片段，超长截断（≤120 字符），
  清洗后为空则回退 `image.<ext>`。
- 读取响应头：`Content-Type`（服务端判定值）、`ETag`（优先 R2 `httpEtag`，否则 sha256）、
  `Cache-Control: public, max-age=31536000, immutable`、`Content-Disposition: inline`、
  `X-Content-Type-Options: nosniff`。
- 不接受远程 URL 抓取，只接受直接上传的字节。

### 2.4 删除引用保护（✅）
`DELETE /api/assets/:id` 在该素材的 `user_id` 范围内检查 `posts`：
1. `cover_path` 精确等于 `public_url` 或 `object_key`；
2. `content` 模糊包含 `public_url` 或 `object_key`（只取 `id,title`，限量）。

若有引用 → `409`，body 带 `referenced_by: [{id, title}, ...]`，提示「该图片正被 N 篇文章引用，
请先解除引用」。无引用 → 先删 R2 对象再删表记录，返回 `{ id, deleted: true }`；
R2 删除失败会抛出可读错误，不静默吞掉。

### 2.5 MCP 工具（✅，仅管理员）
| 工具 | 参数 | 说明 |
| --- | --- | --- |
| `list_assets` | `{ limit?: number }`（默认 20，≤100） | 列出管理员本人素材 |
| `set_post_cover` | `{ post_id, asset_id }` | 把素材设为文章封面（写 `posts.cover_path`）；两者均校验归属 |
| `upload_image` | `{ filename, content_type, data_base64 }` | base64 上传；**复用** REST 的 `storeImage()` 校验与落库逻辑 |

> 出于引用保护考虑，**不提供**删除素材的 MCP 工具。
> `upload_image` 拿不到请求 origin 时，回退 `env.ASSET_PUBLIC_BASE`，否则用后端常量
> `https://api.xuguochen.de5.net`（**仅后端兜底，前端与 migration 均不硬编码域名**）。

## 3. 已知限制
- **AVIF 尺寸未解析**：`imageDimensions()` 对 AVIF 恒返回 `{ width: null, height: null }`
  （box 解析复杂、出错风险高）。AVIF 仍可正常上传与访问，仅 `width`/`height` 为空。
- 未做图片转码 / 压缩：上传什么字节就存什么字节，不生成缩略图或 WebP 副本。

## 4. 尚未实现（🧭）
- 图片转码 / 压缩 / 自动生成缩略图。
- CDN 自定义域名（当前公开地址走 Worker 域名）。
- 批量封面匹配（把历史文章的 `cover_path` 批量回填/迁移）。
- R2 生命周期与孤儿对象清理（当前删除素材即删 R2，无定期对账）。

## 5. 命名约定
- 素材 object key：`assets/<user_id>/<YYYY>/<uuid>.<ext>`（服务端生成，勿手改）。
- 历史遗留的路径式命名（`covers/...`、`posts/<post-id>/...`、`avatars/<user-id>.<ext>`）
  仍可作为 `cover_path` 字符串被引用；新素材统一走 `/api/assets/<id>`。
