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

## 窄屏顶栏的「三横线 / 叉号」抽屉菜单（已移除，2026-10-09）

**原因**：用户要求去掉 Dora 图标前的三横线/叉号按钮。
**现在的行为**：≤920px 时一级导航（NewsNow/视频/GitHub/博客/音乐/影视/更多）在 Dora 图标右侧单行横向滑动，右端渐隐提示可滑动；「更多」下拉照常展开。账号操作（设置/备份/用户管理/退出）只在头像菜单里（原抽屉底部的重复入口一并移除）。
**涉及代码**：`frontend/src/components/Layout.jsx`（删 `.nav-toggle` 按钮、`navOpen` 状态、`.nav-drawer-actions`）；`frontend/src/styles/global.css`（≤920px 抽屉样式改为横向滚动）。
**恢复**：从 git 历史取回这两个文件中 8c52f80 版本的对应片段。

## 博客首页分类条里的小搜索框与入口（已替换，2026-10-09）

**原因**：用户觉得首页顶部不好看。搜索框和「分类/标签/归档/写文章」移到新的顶部高清横幅里（大号圆角搜索框），分类条只放分类、单行横向滚动并显示篇数；「首页」按钮改名「全部」。
**恢复**：从 git 历史取回 `frontend/src/routes/Posts.jsx`（8c52f80 版本）。

## GitHub 页的「粘贴链接手动添加」、卡片画廊/时间流、单个刷新与删除（已移除，2026-10-09）

**原因**：用户要求 GitHub 页改为同步自己在 GitHub 上的 Star（约 1,338 个），不要卡片形式；采纳 Hark 建议：去掉手动添加，GitHub 上取消收藏后 Dora 同步删除，按语言 + 话题自动分组。
**现在的行为**：`/github` 为紧凑列表 + 语言/话题筛选 + 搜索 + 排序；数据由 Worker 定时任务每天同步（`backend/src/lib/githubStars.js`），站长可点「立即同步」。
**注意**：同步会删除 resources 表里不在 GitHub Star 中的 github 类型记录（包括以前手动添加的）。
**恢复**：从 git 历史取回 `frontend/src/routes/Github.jsx`（f8abbc1 版本）；后端 `POST /api/github`、`PATCH/DELETE /api/github/:id` 仍保留未删。要停掉同步：`backend/wrangler.toml` 把 `crons` 改回 `[]`。

## 博客首页横幅下方的分类横栏（已移除，2026-10-09）

**原因**：用户觉得横幅和文章之间的分类横栏不美观，要求去掉。
**现在的行为**：分类入口保留在横幅里的「分类」页、右侧栏「专题类别」和移动端底部工具栏；按分类/标签筛选时，列表标题旁有「× 查看全部」。
**恢复**：从 git 历史取回 `frontend/src/routes/Posts.jsx` 中 `.cs-nav` 那段（a587551 版本）。

## 暗色（夜间）主题（已移除，2026-10-09）

**原因**：用户要求去掉夜间主题，改为「白天 / 素雅」两套；素雅配色参考 GithubStarsManager（MIT）。
**现在的行为**：右上角按钮在白天（light，默认）和素雅（sepia）之间切换；旧的 `dark` 记录（localStorage / 后端偏好）自动当作白天。后端偏好接口只接受 light / sepia 的自定义配色。
**残留**：`global.css` 里还有约 27 条 `[data-theme='dark']` 规则，已不会生效，留作恢复参考。
**恢复**：取回 `frontend/src/lib/theme.jsx`、`ThemeToggle.jsx`、`backend/src/routes/preferences.js` 和 `global.css` 顶部暗色变量块（974db09 版本）。

## GitHub 收藏页「热门话题」侧栏方框 + 右上「全部语言」下拉（2026-10-09 移除）
- 原因：用户要求左栏先显示应用分类，下面改为编程语言方框；语言下拉与侧栏重复。
- 现状：左栏「编程语言」方框（前 10 种 + 展开全部），可与应用分类叠加筛选；话题仍可被搜索框搜到。
- 恢复：在 `frontend/src/routes/Github.jsx` 重新加入 topics 统计（r.topics 计数）与 `.gh-topics` 方框 / 右上 `<select value={lang}>`；样式 `.gh-topics` 仍保留在 global.css。

## 影视采集源精简（2026-10-09 移除 7 个）
- 原因：用户要求只留「真能播 + 延迟低」的源。用 流浪地球/庆余年/繁花/兰香如故/凡人修仙传 逐源实测（搜索 → m3u8 → 首个 ts 分片，无 Referer，从 Cloudflare 边缘与美国网络各测一遍）。
- 移除：dytt 电影天堂、jszy 极速、ffzy 非凡、zuid 最大（片源 403）；lzi 量子（片源 404）；hongniu 红牛（片源 2.6s 且偶发超时）、jyzy 金鹰（片源 6.2s）。
- 新增：mdzy 魔都资源（5/5，搜索约 150ms）。
- 现存 6 个：guangsu、subo、hhzy、ikun、zy360new、mdzy（均 5/5）。
- 恢复：把对应条目加回 `backend/src/lib/maccms.js` 的 DEFAULT_VOD_SOURCES，或用环境变量 VOD_SOURCES（JSON 数组）覆盖。注意：403 的源在中国大陆直连网络下可能可播，若以后在大陆无代理访问可复测。
- 音乐源同日复测（晴天/稻香/海阔天空/孤勇者）：GD 音乐台 netease、Meting qijieya netease/migu 全部 4/4 可播，保持不变；文档里的 Vercel 网易云 API 拿不到播放地址、LX 音源脚本只能在洛雪客户端用，未采用。
