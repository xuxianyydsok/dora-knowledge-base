# 数据库 Schema 说明（Phase0）

> 所有表结构变更均通过 `supabase/migrations` 迁移文件管理，禁止网页后台手动改表。
> 所有业务表带 `user_id` 外键关联 `auth.users(id)`，实现用户数据隔离。

## 迁移文件

| 文件 | 内容 |
| --- | --- |
| `20261006000001_init.sql` | 扩展、`set_updated_at()`、`user_profiles`、`site_settings`、`is_admin()` |
| `20261006000002_categories_tags.sql` | `categories`、`tags`（支持自定义颜色） |
| `20261006000003_resources.sql` | `resources`、`resource_tags`、`resource_links`、`user_progress` |
| `20261006000004_blog_rss_notifications.sql` | `posts`、`rss_feeds`、`rss_articles`、`notifications`、`favorites` |

## 表清单

### 基础
- **user_profiles**：`id`(=auth.users.id)、`username`、`display_name`、`avatar_path`、`role`(user/admin)、`plan`(预留)、`plan_expires_at`(预留)、`is_disabled`
- **site_settings**：站点键值配置，含 `allow_public_registration`（公开注册开关）

### 分类 / 标签
- **categories**：`user_id`、`name`、`slug`、`description`、`sort_order`
- **tags**：`user_id`、`name`、`slug`、`color`（HEX 自定义颜色）

### 资源
- **resources**：统一资源表，`type` ∈ video/github/music/movie/rss_article；`metadata`(jsonb) 存差异化元信息；`cover_path` 存 R2 路径
- **resource_tags**：资源↔标签 多对多
- **resource_links**：资源间关联（博客绑定资源等），`relation` ∈ related/embeds/references
- **user_progress**：播放/阅读进度，`position`/`duration`/`progress`/`completed`

### 博客 / RSS / 通知
- **posts**：HTML 博客，`content` 原生 HTML（支持 katex/three/mermaid/chart 标签）、`status`、`slug`、`cover_path`
- **rss_feeds**：订阅源，`feed_url`、`fetch_interval`、`last_fetched_at`、`is_active`
- **rss_articles**：文章元信息+摘要，`guid` 去重、`is_read`
- **notifications**：通知中心，`type` ∈ rss_new/link_broken/system
- **favorites**：跨类型收藏夹

## 安全模型（RLS）
- 所有业务表启用 RLS：本人可读写自己的数据；管理员（`is_admin()`）可读全部
- `posts`/`resources` 支持 `is_public` 公开读取
- `site_settings` 全员可读、仅管理员可写
- 新用户注册通过 `on_auth_user_created` 触发器自动建档

## 权限辅助
- `public.is_admin()`：判断当前 JWT 用户是否 `role='admin'`，供 RLS 与后续 Worker 逻辑复用
- `public.set_updated_at()`：通用 `updated_at` 自动维护
