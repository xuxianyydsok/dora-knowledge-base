# 存储说明（Cloudflare R2）

## 存储桶信息
| 项 | 值 |
| --- | --- |
| 桶名 | `knowledge-base-assets` |
| 账户 | `<REDACTED>@gmail.com` |
| Account ID | `<REDACTED:CF_ACCOUNT_ID>` |
| 存储类别 | Standard |
| 用途 | 图片封面、博客插图等静态资源 |

## 使用约定
- 数据库仅保存 R2 文件路径字符串（如 `covers/xxx.webp`），**禁止存储二进制**
- 禁止在数据库存储任何音视频、影视原始文件，只存元数据与文本摘要
- Worker 通过绑定 `R2_BUCKET` 访问该桶（见 `backend/wrangler.toml`）
- 上传/删除通过 Worker API 进行，前端不直接持有 R2 凭证

## 命名建议
- 封面：`covers/<type>/<id>.<ext>`
- 博客插图：`posts/<post-id>/<filename>`
- 头像：`avatars/<user-id>.<ext>`
