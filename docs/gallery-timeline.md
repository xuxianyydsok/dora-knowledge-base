# 图片展览与公开时间轴（2026-10-10，分支 `feat/gallery-timeline`）

本文说明两个新页面背后的数据模型、公开边界与已知限制：

- `/gallery` 图片展览（策展）
- `/timeline` 公开时间轴（人生轨迹 / 档案线）

## 1. 数据模型：`gallery_items`

`assets`（迁移 `20261010000015`）只是**素材仓库**；展览需要「策展」元数据，
所以新增关联表 `gallery_items`（迁移 `20261010000016`）：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid | 主键 |
| `user_id` | uuid | 归属（`auth.users`，级联删除） |
| `asset_id` | uuid | 引用 `assets.id`，**`on delete restrict`** |
| `title` | text | 展览标题，可空 |
| `description` | text | 展览说明，可空 |
| `captured_at` | date | 拍摄 / 创作日期，可空 |
| `sort_order` | integer | 排序权重（越大越靠前），默认 0 |
| `is_public` | boolean | 是否对外可见，**默认 false** |
| `created_at` / `updated_at` | timestamptz | 时间戳，`updated_at` 由触发器维护 |

约束与索引：

- `unique (user_id, asset_id)`：同一素材只能加入展览一次（重复加入返回 409）。
- `idx_gallery_items_user_public (user_id, is_public, sort_order desc, captured_at desc nulls last)`
- `idx_gallery_items_asset (asset_id)`

### 为什么 `on delete restrict`

删除素材时，应用层（`DELETE /api/assets/:id`）会先查引用并返回 409；
`on delete restrict` 是**第二道保险**：即使有人绕过 Worker 直接用 SQL 删 `assets`，
只要素材还在展览里，数据库也会拒绝。要删素材必须先移出展览。

## 2. 权限矩阵

| 操作 | 公开访客 | 登录用户 | 管理员（站长） |
| --- | --- | --- | --- |
| `GET /api/gallery` | ✅ 仅 `gallery_items.is_public=true` 且关联 `assets.is_public=true` | 仅本人全部 | 仅本人全部 |
| `POST /api/gallery` | ❌ 401 | ✅ 仅本人（默认 `is_public=false`） | ✅ 仅本人 |
| `PATCH /api/gallery/:id` | ❌ 401 | ✅ 仅本人 | ✅ 仅本人 |
| `DELETE /api/gallery/:id` | ❌ 401 | ✅ 仅本人（只移出展览） | ✅ 仅本人 |
| `GET /api/timeline` | ✅ 仅公开内容 | 仅公开内容 | 仅公开内容 |

说明：与全站一致，**管理员对写操作也只有本人数据权限**（`docs/api.md` Phase6），
展览不是例外。时间轴是公开页，登录用户与管理员也只看公开内容。

## 3. 公开边界的三条不变量（不能破坏）

1. **展览公开 ⇒ 关联素材必须公开。**
   `POST /api/gallery` 在 `is_public=true` 时、`PATCH` 在把条目改为公开时，都会校验
   关联 `assets.is_public === true`，否则返回 409。这样不会出现「展览公开了、图却读不出来」的半成功状态。
   （当前 `assets.is_public` 上传时恒为 `true`；将来若开放「素材可设为私人」，
   这条校验即成为保证一致性的关键。）
2. **访客过滤在数据库查询层完成，不做前端过滤。**
   Worker 用 `service_role` 直连 PostgREST，RLS 不会替它过滤，因此
   `/api/gallery` 与 `/api/timeline` 都在查询里显式叠加 `is_public=eq.true`。
   前端拿到的就是已过滤的数据。
3. **访客响应不含内部字段。**
   展览响应只给 `id/title/description/captured_at/sort_order/is_public/时间戳 + image{url,width,height,mime_type,alt}`；
   时间轴每条只给 `id/type/title/summary/date/url/cover/source_id`。
   `object_key`、`sha256`、`user_id`、`metadata`、`content` 一律不外传。

## 4. 时间轴排序语义

时间轴把三类内容合并成一条线，日期来源不同：

| 来源 | 日期字段 | 展示链接 |
| --- | --- | --- |
| 博客 `posts` | `published_at`（缺失回退 `created_at`） | `/posts/<id>` |
| 资源 `resources` | `created_at` | GitHub 用外链；音乐 `/music/<id>`；影视 `/movies/<id>` |
| 展览 `gallery_items` | `captured_at`（缺失回退 `created_at`） | `/gallery` |

- 合并后按 `date` 倒序；`date` 相同时按 `id` 升序（**稳定排序**，保证分页不跳条、不重复）。
- 分页游标 `next_cursor` = 当前页最后一条的 `date`；下一页用 `before=<cursor>`，
  语义是**严格小于**（同一时刻的条目不会在两页重复）。
- `limit` 上限 50，默认 20。

### 已知近似分页限制

三类表的排序主列不同（`published_at` / `created_at` / `captured_at`），
但游标只有一条 `date`。为避免「预过滤把本该出现的条目切掉」，
实现上对每类都只按**各自排序主列**做 `before` 过滤，并且每类多取一条（`limit + 1`）。
在极端情况下（某一天内条目极多、跨类型时间高度交错），**某一源可能漏掉极少量老条目**。
这是可接受的近似分页，换来的是查询简单、不会全表扫描。若将来内容量变大，
可改为「按合并后游标统一查询 + 各源各取 limit+1」的更严格方案。

## 5. 已知限制与后续待办

- **单一展览流**：本版不做相册 / 分组 / 多展览，后续可加 `albums` 与 `gallery_items.album_id`。
- **无拖拽排序**：目前用 `sort_order` 数字排序，后续可做拖拽。
- **无图片转码 / 缩略图**：沿用 `assets` 现状，上传什么就展示什么（见 `docs/storage.md`）。
- **明确不恢复**：RSS 模块、独立视频页（见 `docs/removed-features.md`）。
- **资源区线上暂时为空**：线上 `resources` 目前全部 `is_public=false`（见 `docs/public-access.md` §6），
  因此时间轴暂时只有博客与（公开后的）展览条目。这是预期结果，不是 bug。

## 6. 相关文件

- 迁移：`supabase/migrations/20261010000016_gallery_items.sql`
- 后端：`backend/src/routes/gallery.js`、`backend/src/routes/timeline.js`、`backend/src/lib/timelineMerge.js`
- 前端：`frontend/src/routes/Gallery.jsx`、`frontend/src/routes/Timeline.jsx`、`frontend/src/styles/gallery-timeline.css`
- 单测：`backend/tests/run.mjs` 的「UNIT · 图片展览与公开时间轴」小节
