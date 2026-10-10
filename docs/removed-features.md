# 已撤销 / 暂停的功能与配置

记录被移除或临时关闭的功能，方便以后恢复。恢复前先读本文件与 `docs/progress.md`。

---

## 1. RSS 模块（已删除，2026-10-09）

**原因**：用户决定不再需要 RSS（原计划从 Folo 导入订阅，后放弃）。数据不保留。

**删掉了什么**
- 后端：`backend/src/routes/rss.js`、`backend/src/lib/rss.js`、`backend/src/lib/rssSync.js`，以及全部 `/api/rss/*` 路由（订阅源增删改查、手动抓取、条目列表/已读、OPML 导入导出）。
- 定时任务：Worker 的 `scheduled` 处理器（每小时抓取 RSS）已删除；`backend/wrangler.toml` 改为 `[triggers] crons = []`。
- 前端：`RssFeeds.jsx`、`RssArticles.jsx` 页面，`/rss`、`/rss/articles` 路由，导航「RSS」按钮，`api.js` 中 RSS 方法，首页 RSS 卡片与磁贴，搜索/图谱/通知中的 RSS 类型。
- 通知类型 `rss_new`；资源类型 `rss_article`（MCP、搜索枚举）。
- 数据库：迁移 `supabase/migrations/20261009000014_drop_rss.sql` 删除 `rss_feeds`、`rss_articles` 表、`rss_new` 通知，`resources.type` 约束去掉 `rss_article`。
  - ⚠️ 自动迁移（GitHub Actions「Supabase DB Migrate」）因缺少 `SUPABASE_*` 仓库密钥未执行，需在 Supabase SQL Editor 手动运行该文件内容。

**如何恢复**
- 代码：`git revert 21f2525`（提交「feat(rss): 按需求移除整个 RSS 模块」），恢复后把 `wrangler.toml` 的 `crons` 改回 `["0 * * * *"]`。
- 数据库：新建一个迁移，重新执行 `20261006000004_blog_rss_notifications.sql` 与 `20261006000009_movies.sql` 中 RSS 相关的建表/加列语句，并把 `rss_article` 加回 `resources_type_check`。旧数据无法恢复。

---

## 2. 强制登录（已暂停，改为访客只读模式，2026-10-09）

**原因**：网站主要给别人看，暂时不需要访客登录；以后需要再加回。

**现在的行为**
- 未登录访客可以只读浏览：NewsNow、视频、GitHub、博客（只显示已发布文章）、音乐、影视、搜索，以及「更多」菜单里的收藏、图谱、分类、标签。看到的是站长（最早创建的 admin 账号）的内容。
- 访客可以直接播放影视（2026-10-09 用户要求「访客播放不要加限制」）：点搜索结果进入 `/movies/watch/:source/:vid`，按采集源详情直接播放，不入库、不记进度；也可以调用影视/音乐的只读检索接口（POST `/api/movies/search`、`/api/movies/source-detail`、`/api/music/search`、`/api/music/lyrics`、`/api/music/stream`）。音乐同理：访客点歌直接播放，不入库。
- 访客不能：新增/编辑/删除任何内容，查看/保存播放进度，访问备份、设置、通知、用户管理等页面。
- 顶栏不再显示「登录」按钮；站长仍可直接访问 `/login` 登录，登录后一切照旧。

**涉及的配置与代码**
- `backend/wrangler.toml`：`[vars] PUBLIC_MODE = "true"`。
- `backend/src/middleware/auth.js`：`requireAuth` 在无令牌、GET、路径命中 `PUBLIC_READ` 白名单时返回访客上下文（`user.isGuest = true`，`isAdmin = false`）。
- `backend/src/routes/posts.js`、`search.js`、`graph.js`：访客只看 `status = published` 的文章。
- `frontend/src/components/ProtectedRoute.jsx`：新增 `guest` 属性；`frontend/src/app.jsx` 中可公开浏览的路由带 `guest`。
- `frontend/src/lib/api.js`：未登录时跳过进度读写，其他写操作直接提示「访客模式只能浏览」。
- `frontend/src/components/Layout.jsx`：主导航和搜索对所有人显示，隐藏「登录」按钮。
- `frontend/src/routes/Home.jsx`：未登录首页按钮由「免费开始使用」改为「开始浏览」（跳 `/news`）。

**如何恢复强制登录**
1. `backend/wrangler.toml` 把 `PUBLIC_MODE` 改为 `"false"`（只改这一项后端就恢复全部要求登录）。
2. 前端：去掉 `app.jsx` 里各路由的 `guest`，`Layout.jsx` 恢复 `isAuthenticated &&` 判断与「登录」按钮，`Home.jsx` 按钮改回 `/login`。
3. 推送到 `main`，CI 自动部署前后端。

## 博客列表的「画廊 / 时间流」视图切换（已移除，2026-10-09）

**原因**：用户要求博客换成 halo-theme-cosolar 风格（Hark 推荐、用户同意）。新首页是固定的 cosolar 布局（精选轮播 + 卡片列表 + 侧边栏），不再提供视图切换。
**影响**：`/posts` 不再使用 `GalleryView` / `TimelineView` / `ViewSwitch`（组件本身仍保留，其它页面在用）。
**恢复**：从 git 历史取回 `frontend/src/routes/Posts.jsx`（提交 6159db1 及之前的版本）。
