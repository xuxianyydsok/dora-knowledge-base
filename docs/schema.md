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
| `20261009000014_drop_rss.sql` | 删除 `rss_feeds` / `rss_articles`（2026-10-09 用户决定移除 RSS） |
| `20261012000023_rss.sql` | **重建** `rss_feeds` / `rss_articles`（2026-10-12 RSS 恢复，形态改为「站长订阅、访客只读」） |
| `20261013000027_hero_slides.sql` | `hero_slides`（首页轮播素材，**只存对图展素材的引用**） |
| `20261018000029_excerpts.sql` | `excerpts`（首页摘抄，站长后台维护） |

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
- **hero_slides**（2026-10-13）：首页轮播素材。`source` ∈ asset/wallpaper，
  `asset_id` / `wallpaper_id` 指向图展的 `assets` / `wallpapers`（**均 on delete cascade**，
  删素材时首页引用自动消失，不会留下死引用）；`label`（图注）、`sort_order`、
  `is_active`、`muted`（视频是否静音，默认 true）。**只存引用、不重复存文件** ——
  素材与 R2 对象仍归图展那两张表管。
- **excerpts**（2026-10-18）：首页摘抄。`content`（正文，≤20000 字）、
  `source`（出处，可空）、`sort_order`、`is_active`（是否参与首页轮播）。
  访客只读启用项；写操作仅管理员。
- **rss_feeds**（2026-10-12 恢复重建）：订阅源，`feed_url`、`description`（源简介）、
  `fetch_interval`（默认 14400 秒）、`last_fetched_at`、`is_active`、`is_public`（访客可见）、
  `last_error` / `error_count`（抓取健康度）、`etag` / `last_modified`（条件请求）
- **rss_articles**：条目元信息 + 纯文本摘要 + 源站自带正文 HTML（`content_html`，
  ≥200 字才存、截 200KB），`guid` 去重、`is_read`
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
