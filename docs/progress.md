# 开发进度与接力文档（Progress & Handoff）

> **这份文档是给「下一个接手的 Agent / 人」看的一页纸**：项目做到哪一步、本轮改了什么、
> 下一步做什么、动手前必须先知道的坑。
>
> 维护约定：**每完成一轮开发，就更新本文的「当前状态」「本轮完成内容」「下一步」三节**，
> 不要另开进度文件。历史细节看 git log 与 `docs/interface-inventory.md`。
>
> 阅读顺序：`README.md`（怎么装、怎么跑） → 本文（做到哪了 / 接下来做什么）
> → `docs/interface-inventory.md`（外部接口逐条实测结论） → `docs/api.md`（接口契约）。

---

## 2.29 安全与质量底座（2026-10-10，分支 fix/security-quality-recovery）

本轮在**当前 main（`ba02cfc`，RSS 与视频模块均已删除）**上重新实现第一批安全/质量修复，
不机械套用旧工作区的 patch，而是按现状重新设计。**没有 commit / push**。

### 从旧工作区（`~/tmp/dora-recovery-20261010`）恢复 / 重做的内容

1. **测试修复**：`backend/tests/run.mjs` 删除了对已删除模块 `src/lib/rss.js` 的 `import`，
   以及 `parseFeed` / `rss.stripHtml` / RSS live 抓取三段用例；`stripHtml` 用例改写为同类的
   `maccms.normalizeVod` 简介清洗用例。契约测试（api.js ↔ router.js 全页面覆盖）保留并更新。
2. **CI 质量闸门**：新增 `.github/workflows/quality.yml`（前端 `npm ci`+`build`、后端 `npm ci`+`test:unit`、
   凭据扫描，Node 22，push/PR 都跑）。
3. **部署 workflow 加固**：`db-migrate.yml` / `deploy-backend.yml` / `deploy-frontend.yml` 增加必需 Secrets
   非空预检（只打印变量名，不回显值）；backend 部署前先跑 `npm run test:unit`。
4. **数据库安全迁移**：新增 `supabase/migrations/20261010000014_lock_profile_privileged_fields.sql`，
   撤销 `authenticated` 对 `user_profiles` 的表级 update/insert，只按列授权 `username/display_name/avatar_path`，
   普通用户不能再自改 `role/plan/plan_expires_at/is_disabled`。只新增迁移，不改历史迁移。
5. **前端安全头**：新增 `frontend/public/_headers`（nosniff / DENY / Referrer-Policy / Permissions-Policy /
   HSTS / CSP）。CSP 对 `connect/img/media` 放开 `https:`，兼容 Supabase、自建 API、豆瓣与音乐封面中转、
   第三方音视频直链、blob/data；**不写任何真实域名或密钥**。
6. **博客 XSS 清洗**：新增 `frontend/src/lib/sanitizeHtml.js`（无依赖白名单清洗），接入 `PostRenderer.jsx`；
   保留 `katex-*/mermaid-chart/chart-2d/three-scene` 自定义渲染标签，拦截 `script`、`on*` 事件属性、
   `javascript:`/`data:` 等危险 URL。
7. **资源写操作隔离**：`lib/resources.js` 的 `setResourceTags` 补齐 `user_id`，`validateTagIds` 对管理员也
   只允许本人标签，新增 `validateCategoryId`；music/movies/github/videos/posts 的分类与标签写入统一走校验，
   music/movies 扩展表 update/delete 补齐 `user_id`；posts 的 `post_tags`/`post_resources` 清理带 `user_id`。
   另修复 MCP 两个真实缺陷：`create_post`/`update_post` 误写 `resource_tags`（应为 `post_tags`）、
   `list_resources` 管理员会列出他人资源（现始终限定本人）。
8. **备份 v2**：`backend/src/routes/backup.js` 导出补齐 `music_tracks`、`movie_titles`、`notifications`、
   `user_preferences`、`resource_links` 与播放进度；导入按依赖顺序恢复并重映射 ID；
   `replace` 明确返回 422；前端 `Backup.jsx` 移除虚假「替换模式」，只保留安全合并。
9. **请求层与可访问性**：`frontend/src/lib/api.js` 默认 20 秒超时，区分超时/取消/断网/非 JSON 错误
   （源探活接口单独放宽到 60s）；`app.jsx` 增加真正 404（不再静默回落首页）；`Card.jsx` 支持 Enter/Space；
   修复 `Home.jsx` / `VideoPlayer.jsx` / `MovieHome.jsx` 中 `<a>` 套 `<button>` 的非法嵌套交互。

### 明确不恢复

- **RSS 模块**：2026-10-09 用户决定删除，本轮不恢复代码/表/用例，备份 v2 也不含 `rss_*`。
- **视频页**：2026-10-09 已移除，本轮不恢复（后端 `/api/videos` 接口保留未动）。

### 验证结果（本机，2026-10-10）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 后端确定性+契约测试 | `cd backend && npm run test:unit` | ✅ 34/34 通过 |
| 前端生产构建 | `cd frontend && npm run build` | ✅ 通过（`dist/_headers` 已生成） |
| 凭据扫描 | `node scripts/check-secrets.mjs` | ✅ 158 文件，未发现必须修复的泄漏 |
| 空白字符检查 | `git diff --check` | ✅ 通过 |

> 说明：本机为完成构建，使用 `npm ci --offline` 从 npm 本地缓存还原依赖（未联网、未改动依赖清单）。

### 待办 / 残余风险

1. 迁移 `20261010000014` 需经 CI（或人工）在 Supabase 应用后才生效；未应用前自提权风险仍在。
2. 部署 workflow 的 Secrets 预检会**阻断**缺失 Secrets 的部署——这是预期行为，但需确认仓库 Secrets 已配齐。
3. CSP 中 `connect/img/media` 为 `https:` 宽放（为兼容多环境域名）；若未来收敛到固定域名，可再收紧。
4. 备份 v2 的导入仍是逐条写入（非事务），大批量导入可能较慢；失败时可能部分写入。
5. 未做无限画板（本轮只筑安全与质量底座）。

## 2.30 图片素材系统 R2（2026-10-10，分支 feat/r2-assets）

在最新 main（`aae903a`）上实现第一版图片素材系统：R2 存二进制、`assets` 表存元数据、
公开按 id 读取、上传/删除/引用保护齐备。**没有 commit / push**。

### 本轮完成

1. **新增 `backend/src/lib/imageType.js`**（纯函数、无 IO，便于离线单测）：
   `sniffImageType`（魔数识别 JPEG/PNG/WebP/AVIF）、`resolveImageType`（魔数与声明 MIME 一致性）、
   `imageDimensions`（PNG IHDR / JPEG SOF / WebP VP8·VP8L·VP8X；**AVIF 不解析，恒为 null**）、
   `sanitizeFilename`（去穿越/分隔符/控制字符，≤120 字符）、`buildObjectKey`、`sha256Hex`、`isWithinLimit`。
   任何尺寸解析异常都返回 `{width:null,height:null}`，绝不抛错导致上传失败。
2. **新增 `backend/src/routes/assets.js`**：4 条接口 —— `POST /api/assets`（上传，requireAdmin）、
   `GET /api/assets`（分页列出，requireAdmin）、`GET /api/assets/:id`（**公开读取字节，不鉴权**）、
   `DELETE /api/assets/:id`（删除，被引用返回 409 并带 `referenced_by`）。
   核心落库逻辑抽为 `storeImage()`，供 REST 与 MCP 共用。
3. **`backend/src/router.js`** 注册 4 条路由（`/api/posts` 之后）。
4. **新增迁移 `supabase/migrations/20261010000015_assets.sql`**：建 `public.assets`（含全部字段与注释）、
   索引 `(user_id, created_at desc)`、RLS 策略（本人读写 + `is_admin()` 全权，风格照抄现有表）；
   仅新增、未改历史迁移，未硬编码任何真实域名。
5. **`backend/src/routes/mcp.js`** 新增 3 个工具：`list_assets`、`set_post_cover`、`upload_image`
   （base64 上传，复用 `storeImage`，不复制校验逻辑）；不提供删除素材工具。
6. **`backend/tests/run.mjs`** 新增 7 个纯离线 UNIT 用例（类型嗅探 / MIME 一致性 / 大小上限边界 /
   尺寸解析 / 文件名清洗 / object_key），使用内嵌真实 1x1 字节，不碰网络与 R2。
7. **前端 `frontend/src/lib/api.js`**：新增 `uploadAsset(file,{onProgress})`（XMLHttpRequest，
   60s 超时，带 Authorization，不手设 Content-Type）、`listAssets`、`deleteAsset`、`assetUrl`。
8. **前端 `frontend/src/routes/PostEdit.jsx`**：新增轻量封面区（预览 / 拖拽 + 点击上传 / 进度 /
   「复制图片链接」/「插入到正文」/「最近素材」）；编辑已有文章时回填 `cover_path`，保存时一并提交。
   （`sanitizeHtml.js` 已白名单 `img` 的 `src`/`alt`，无需改动。）
9. **文档**：重写 `docs/storage.md`（已实现 / 计划中分明），本节。

### 验证结果（本机，2026-10-10）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 后端确定性 + 契约测试 | `cd backend && npm run test:unit` | ✅ 41/41 通过（新增 7 项图片用例全过） |
| 前端生产构建 | `cd frontend && npm run build` | ✅ 通过（`built in 34.18s`） |
| 凭据扫描 | `node scripts/check-secrets.mjs` | ✅ 通过 |
| 空白字符检查 | `git diff --check` | ✅ 通过 |
| 后端语法检查 | `node --check`（4 个改动文件） | ✅ 通过 |

> 另用 mock db/R2 离线跑通 `storeImage()`：object key = `assets/<uid>/2026/<uuid>.png`、
> `public_url` 回填正确、MIME 不符与 SVG 均按 415 拒绝。

### 下一步
- 迁移 `20261010000015` 需经 CI（或人工）在 Supabase 应用后才生效。
- 前端封面区的**视觉与真机上传**未做端到端验证（本机无法连真实 R2/Supabase）。

### 坑与注意
- **公开读取必须走 `assets.id`，不能暴露 R2 object key**，否则 R2 会变成任意 key 探测器。
- `storeImage` 先插占位 `public_url` 再回填真实地址：因为 URL 需要表主键 `id`，插入前拿不到。
- AVIF 尺寸恒为 null，前端不要依赖 `width`/`height` 做布局计算。
- PostEdit 的拖放区用 `var(--primary)` 高亮（该主题无 `--accent` 变量）。

---

## 2.31 影视/音乐源健康中心 + 自动避开失效线路（2026-10-10，分支 feat/source-health-console）

在最新 main（`a475c1a`）上实现第一版「统一源健康中心」：影视采集源与音乐音源共用一份
健康结构，管理员可一页看清谁挂了，搜索自动跳过 `down` 的源。**没有 commit / push**。

### 本轮完成

1. **新增 `backend/src/lib/sourceHealth.js`**（依赖单向：→ maccms / meting，不反向 import fetchers，避免循环）：
   - 统一结构：`{ generated_at, cached, ttl_ms, summary, sources[] }`；每条含
     `key/name/kind/status/ok/latency_ms/checked_at/error/capabilities/notes`。
   - 纯函数：`rankSources` / `isSourceUsable` / `sourceHealthWeight` / `healthMap` /
     `judgeMovieProbe` / `judgeMusicProbe` / `summarizeHealth` / `finalizeRecord` /
     `probeEntries` / `createHealthStore`。
   - 探测调度 `probeEntries`：单源超时 + 全局预算双保险；单源抛错 / 超时隔离，整体必返回。
   - 短 TTL 缓存 + 并发去重 `createHealthStore`：TTL 内命中、进行中 Promise 复用、
     `allowProbe: false` 时**绝不探测**（访客路径）。
2. **影视探测**：逐源「搜索（固定词 `测试`）→ 详情（`ac=detail`）→ 校验可播放地址」；
   搜索成功但详情失败 → `degraded`。单源 6s、整体 8s。
3. **音乐探测**：GD音乐台（`GD_MUSIC_SOURCES` 默认 netease/joox，含实际取流）、
   Meting（`getMetingInstances` 逐实例逐平台）、Audius、iTunes、Deezer；
   单源 8s、整体 10s。**iTunes/Deezer 恒为 `degraded` + `trial_only`，绝不声明无损/高音质**。
4. **`backend/src/router.js`** 注册 `GET /api/sources/health`；`backend/src/routes/movies.js` 新增
   `getSourcesHealth`（管理员 `requireAdmin` 全量探测 / `?refresh=1`；访客与普通用户只读缓存），
   并把 `getVodSourceHealth` 改为复用**同一份缓存**（鉴权行为与现状兼容）。
5. **`backend/src/lib/fetchers.js`**：
   - `searchMaccmsAll` 读健康缓存后 `rankSources`：跳过 `down`、`degraded` 后置；
     **健康数据缺失时不剔除任何源**（冷启动安全），且不改变最终的相关度排序。
   - `fetchMusicMeta` 同理跳过已知 `down` 的音源；iTunes/Deezer 候选带 `trial_only: true`，
     `mergeCandidate` 保留该标注；`musicScore` 排序逻辑未动。
6. **前端**：新增 `frontend/src/routes/SourceHealth.jsx`（`/sources`，`ProtectedRoute` 不带 `guest`）；
   `Layout.jsx` 的「更多」下拉加「源状态」入口（仅 `isAdmin`）；`app.jsx` + `routes.js` 注册路由；
   `api.js` 新增 `getSourceHealth(params='')`；`Movies.jsx` 抽屉底部加「查看完整源状态」链接（仅管理员）；
   `global.css` 追加少量 `.sh-*` 响应式样式（桌面 + 手机）。
7. **测试**：`backend/tests/run.mjs` UNIT 新增 4 个纯离线用例（过滤/排序与冷启动、
   单源失败隔离、TTL/并发去重/访客不探测、试听源状态判定）。CONTRACT 自动覆盖新接口路径。
8. **文档**：新增 `docs/source-health.md`；更新 `docs/api.md` 接口表；本节。

### 验证结果（本机，2026-10-10）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 后端确定性 + 契约测试 | `cd backend && npm run test:unit` | ✅ 48/48 通过（main 基线 42 + 新增 5 项源健康 UNIT 用例 + 1 项 SourceHealth 页面契约用例） |
| 前端生产构建 | `cd frontend && npm run build` | ✅ 通过 |
| 凭据扫描 | `node scripts/check-secrets.mjs` | ✅ 通过 |
| 空白字符检查 | `git diff --check` | ✅ 通过 |

### 验收修正（主代理复核，2026-10-10）

本轮共修两处（第 3 项为连带自查）：

1. **`judgeMovieProbe` 能力自相矛盾**：搜索空结果时 `error` 写「搜索返回空结果」，
   但 `capabilities.search` 恒为 `true`，前端会误显示「搜索」能力标签。
   改为 `search: searchCount > 0`（与 `judgeMusicProbe` 一致），并在 UNIT 补断言：
   空结果时 `capabilities.search === false`、`status === 'degraded'`；
   详情失败但搜索通时 `capabilities.search === true`。
2. **缓存过期后访客仍拿到过期数据（严重）**：`createHealthStore` 在缓存过期且
   `allowProbe=false` 时原本返回过期缓存，导致一次**瞬时 `down` 被无限期沿用**——
   搜索路径 `rankSources` 会一直剔除该源，直到管理员手动刷新为止，与「短 TTL / 瞬时观测」冲突。
   改为：过期或缺失时**不发探测、也不返回过期数据**，`sources` 返回空数组 +
   `empty: true` + `stale: true` + `stale_at`（`cached: false`）；缓存本身保留，管理员路径仍可重探覆盖。
   `getSourceHealth` 聚合透传 `stale`/`stale_at`；`getVodSourceHealth` 只读影视槽、同样不返回过期 down。
   空 `sources` → 空 `healthMap` → `rankSources` 不剔除任何源（冷启动式全量尝试）。
   新增 UNIT 用例覆盖：TTL 内访客可读、TTL 后零网络且不返回过期数据、过期 down 不参与过滤、管理员可重探。
3. **非管理员刷新按钮假报成功**：`/sources` 页非管理员点「刷新」时后端忽略 `refresh=1` 只返回缓存，
   前端却弹「已重新探测全部源」。改为：非管理员**不显示刷新按钮**；`load()` 内部对非管理员
   强制把 `refresh` 退化为普通只读加载，且**不弹任何 success toast**。

### 下一步

- 本页与影视抽屉共用缓存；若上游免费源频繁抖动，可考虑把 TTL 调大或加「最近 24h 可用率」。
- 目前只有「瞬时观测」，没有历史趋势；如需趋势需额外落库（本轮未做）。

### 坑与注意

- **冷启动安全**：`rankSources` 在健康数据缺失时必须原样返回全部源；任何「先过滤再判断」的
  改动都要守住这条，否则首次请求会把所有源禁掉、搜索直接空。
- **访客绝不触发探测**：访客路径走 `getSourceHealth(env, { allowProbe: false })`，
  该分支不产生任何网络请求；改鉴权时别把它退回真实探测。
- **过期缓存不得用于过滤**：`allowProbe:false` 且缓存过期/缺失时必须返回空 `sources`
  （不是返回过期缓存）。否则一次瞬时 `down` 会被无限期沿用，搜索会一直把该源剔除。
- **健康只调整「源顺序 / 参与与否」，不改相关度排序**：`fetchMovieMeta` 里相关度仍是第一关键字。
- 探测用的固定词是 `测试`（中文目录）/ `test`（英文目录），只为验证连通，不代表只支持这些词。
- `docs/api.md` 里 `/api/sources/health` 与 `/api/movies/sources/health` 是两条路径、同一份缓存。

---

## 2.32 修复 PUBLIC_MODE 访客越权（公开 / 登录 / 管理员三层边界，2026-10-10，分支 fix/public-read-boundaries）

在最新 main（`a176ca9`）上修复「访客只读模式」的越权读。**没有 commit / push，也没有动数据库。**

### 问题（主代理审计结论）

`guestContext` 把访客上下文的 `user.id` 设为站长（最早 admin）的 user_id，白名单里又含
`favorites` 与 `/api/github/analyze`。于是访客能读到站长的**全部**私人数据（草稿、私密资源、
收藏夹），还能调用消耗 Workers AI 额度的接口。资源类接口（videos/github/music/movies、
search 的 resources 分支、graph 的 resources 节点）此前**完全没有**公开过滤。

### 本轮完成

1. **新增 `backend/src/lib/publicScope.js`**（纯函数、无 IO，供中间件与路由共用、供离线单测）：
   `PUBLIC_READ_RE` / `PUBLIC_POST_PATHS`（**已移除 favorites 与 /api/github/analyze**）、
   `isGuestAllowed`、`canUseAll`、`guestPostFilters`、`guestResourceFilters`、
   `isPostVisibleToGuest`、`isResourceVisibleToGuest`。
2. **`backend/src/middleware/auth.js`**：改用 `isGuestAllowed`，删掉内联白名单；注释写明
   「访客的 id 只是 owner 范围限定，不是身份认证，读路由必须再叠加公开过滤」。
3. **`backend/src/routes/posts.js`**：列表叠加 `guestPostFilters()`；`getPost` / `getPostBySlug`
   命中后要求 `published + is_public`，否则 404；访客读文章时**关联资源也只带公开资源**。
4. **`backend/src/routes/search.js`**：posts 分支叠加 `status + is_public`；resources 分支
   叠加 `is_public`。
5. **`backend/src/routes/graph.js`**：`getGraph` 访客只拿公开子图（posts + resources 均加
   `is_public`，tags 仍取 owner 的）；`getConsole` / `getBoard` 访客直接 **403**（个人视图）。
6. **`backend/src/routes/favorites.js`**：`listFavorites` 对访客 **403**（第二道防线）。
7. **`backend/src/routes/github.js`**：`listGithub` 访客叠加 `is_public`，`getGithub` 校验公开；
   `analyzeGithub` 改为**仅管理员**（第二道防线）。
8. **`backend/src/routes/videos.js` / `music.js` / `movies.js`**：列表叠加 `is_public`，
   单条详情校验 `is_public`（否则 404），且访客拿到的 `progress` 恒为 `null`
   （不能把站长 owner 的播放进度当公开数据）；写操作未改。
9. **`backend/src/routes/categories.js` / `tags.js`**：访客 `select` 收窄为安全字段
   （categories：`id,name,slug,description,sort_order`；tags：`id,name,slug,color`）。
10. **前端**：`app.jsx` 的 `/favorites` 去掉 `guest`（必须登录）；`Graph.jsx` 未登录时不请求
    console，直接显示「图谱控制台需要站长登录」空态（经典视图对访客保留）；
    `Favorites.jsx` 对 403 显示友好空态；`Github.jsx` 非管理员不再自动触发 AI 解读。
11. **测试**：`backend/tests/run.mjs` UNIT 新增 6 个纯离线用例（白名单放行/拒绝、
    POST 只读检索白名单、访客过滤构造、`all=true` 不能绕过、单条可见性、
    auth.js 契约「不再内联 favorites / github/analyze 且已 import publicScope」）。
12. **文档**：新增 `docs/public-access.md`（三层权限矩阵 + 残余风险 + 线上资源全非公开的说明）；
    更新 `docs/removed-features.md` 的「强制登录（已暂停）」一节；本节。

### 验证结果（本机，2026-10-10）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 后端确定性 + 契约测试 | `cd backend && npm run test:unit` | ✅ 54/54 通过（新增 6 项公开读边界用例） |
| 前端生产构建 | `cd frontend && npm run build` | ✅ 通过 |
| 凭据扫描 | `node scripts/check-secrets.mjs` | ✅ 通过 |
| 空白字符检查 | `git diff --check` | ✅ 通过 |

> 说明：本机未联网安装依赖；`backend/node_modules` 不存在，`npm run test:unit` 走的是
> 纯 Node 脚本（无第三方依赖），因此可直接运行。

### 重要：线上资源全部非公开 → 访客看不到影视 / 音乐 / GitHub

线上 `resources` 全部 `is_public=false`（github 439 / movie 7 / music 3 / video 1），
因此**访客将看不到任何影视 / 音乐 / GitHub / 视频资源**（列表为空、按 id 访问 404）。
这是本轮公开边界的**预期结果**，不是 bug；若产品要公开展示，需站长显式把相应记录
置为 `is_public=true`（各编辑页已有该开关）。博客不受影响（315 篇均 `published + is_public`）。
详见 `docs/public-access.md` 第 6 节。**这一点需要主代理向用户确认产品预期。**

### 下一步

- 若用户确认「公开资源」是期望的产品形态，需要一个「批量公开 / 公开筛选」的站长操作入口
  （本轮未做，避免扩大改动面）。
- 若要更严格的分类/标签可见性，需按公开内容反查（见残余风险 1）。
- 本机无 Supabase / R2 连接，**未做真实端到端**访客请求验证；上线前建议用匿名请求抽查
  `/api/posts`、`/api/movies`、`/api/favorites`、`/api/github/analyze` 四条。

### 坑与注意

- **service_role 绕过 RLS**：Worker 直连 PostgREST 用 service_role，数据库策略不替它过滤，
  因此「公开」必须写进查询条件；只改中间件白名单不足以修复越权。
- **404 而非 403**：草稿 / 私密资源对访客返回 404，避免通过状态码泄露「存在性」。
- **访客的 user.id 不是身份**：它是 owner 范围限定；任何读路由都必须叠加公开过滤。
- **别把 favorites / github-analyze 加回白名单**：`backend/tests/run.mjs` 的
  `UNIT · 公开读边界` 用例会直接失败。

---

## 2.33 影视/音乐播放可靠性修复（2026-10-10，分支 fix/media-playback-reliability）

修复用户反馈的「搜了一部电影，全部显示片源无法解析」。**没有动数据库**（存量数据不自动批量修）。

### 根因（主代理线上实测确认）

1. **已收藏的影视记录指向「已下线的采集源」**。线上 `resources(type='movie')` 7 条里，
   `source_key` 是 `dytt` / `jszy` / `lzi` —— 这三个源早在 2026-10-09 就因「片源 403/404」
   从 `DEFAULT_VOD_SOURCES` 移除。于是详情页回源调 `/api/movies/source-detail` 直接
   `404 采集源不存在：dytt`；播放时用存库的旧直链（dytt 已 403）→ 播放器报「片源无法解析」。
2. **采集源线路里混着大量非直链地址**：`vod_play_url` 同时含可直接播放的 `.m3u8` 与网页地址
   （分享页 `/share/<hash>`、网页播放页 `/play/<id>`）。`normalizeVod` 原样保留，
   详情页把它们也列成「线路」，用户点到必然失败。
3. **音乐库存了网页地址当播放地址**：线上 1 条 Audius 曲目把 `https://audius.co/...` 网页地址
   写进了 `resources.url`（真正的可播地址在 `metadata.audio_url`，形如
   `https://api.audius.co/v1/tracks/<id>/stream`），前端必然报「暂无可用的播放地址」。
   GD 音乐台的直链是**带时间戳的签名地址会过期**，旧链接同样会 403。

### 本轮完成

1. **新增 `backend/src/lib/mediaUrl.js`**（纯函数、无 IO）：
   `isDirectAudioUrl` / `isDirectVideoUrl` / `resolveAudioPlayback`（音频直链三级优先级：
   完整音轨 > 显式直链 > 试听片段）/ `looksLikeAudioStream`（无后缀的 `/stream` 流式端点算可播）/
   `isStaleAudioUrl`（只读体检标记）。
2. **`backend/src/lib/maccms.js`**：
   - `normalizeVod` **剔除非直链线路与剧集**（兜底：全为非直链时保留原始线路，但 `playable_url` 仍为 `null`）；
   - `DEFAULT_VOD_SOURCES` **新增 `360zy`（360资源备用，`https://360zy.com`）**，实测 5/5 端到端可播；
   - `ANIME_CLASS_IDS` 补 `360zy: [38,39,40]`；注释记录 2026-10-10 复测结论。
3. **`backend/src/routes/movies.js`**：
   - 新增纯函数 `pickBestMovieCandidate`（可信阈值 `RESOLVE_MAX_RELEVANCE = 3`，
     只接受「完全同名 / 关键词+第N季 / 关键词+(年份) / 其他前缀」，拒绝相关度 4/5 的同名异片）；
   - 新增 `POST /api/movies/:id/refresh-source`：原源下线/死链时，用原标题（必要时回退主标题）
     去在用源重搜并回填；**严格 `user_id` 限定、管理员也不跨用户写、不确定就 404 不写库**。
4. **`backend/src/routes/music.js`**：`createMusic` / `updateMusic` 只接受**媒体直链**
   （网页地址 422 拒绝），试听片段标 `preview`；`getMusic` 返回只读 `url_stale` 标记（不自动改库）。
5. **前端**：`MovieView.jsx` 过滤非直链线路/剧集、站长可见「重新匹配片源」按钮（仅本人写）；
   `Music.jsx` 不再把 `page_url` 当播放地址；`MusicView.jsx` 显示 `url_stale` 提示；
   `api.js` 新增 `refreshMovieSource`。
6. **测试**：`backend/tests/run.mjs` 新增 6 个纯离线用例（直链判定、线路过滤、兜底、默认源、音频归一、重匹配阈值）。

### 提交与上线（2026-10-10）

| 项 | 值 |
| --- | --- |
| 功能提交 | `74c8a42` fix(media): 影视/音乐源可靠性修复——剔除死源、新增 360zy、重匹配片源接口 |
| 合并提交（main） | `87e13f8` merge: 影视/音乐源可靠性修复（`--no-ff`，无冲突） |
| push | `58f80ce..87e13f8 main -> main` |
| GitHub Actions | Deploy Backend ✅ / Deploy Frontend ✅ / Quality Checks ✅ / Secret Scan ✅（均 success） |
| 线上接口 | `https://api.xuguochen.de5.net/health` → **200**（`{"status":"ok",...}`）；`https://dora.xuguochen.de5.net/` → **200** |
| 线上产物 | 前端主包与 `MovieView-*.js` 分块均含 `refresh-source` / 「重新匹配片源」，已随部署更新 |

> 说明：任务书给的 `https://api.xuguochen.de5.net/api/health` 实际返回 404——
> 该 Worker 的健康检查真实路径是 `/health`（见 `backend/src/router.js:208`）；
> `dora.xuguochen.de5.net/api/health` 返回 200 是前端 SPA 的 index.html 兜底，不是真实接口。

### 验证结果（本机，2026-10-10）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 后端确定性 + 契约测试 | `cd backend && npm run test:unit` | ✅ 60/60 通过（新增 6 项媒体用例） |
| 前端生产构建 | `cd frontend && npm run build` | ✅ 通过 |
| 凭据扫描（工作树） | `node scripts/check-secrets.mjs` | ✅ 170 文件，无泄漏 |
| 凭据扫描（全历史） | `node scripts/check-secrets.mjs --history` | ✅ 82 提交，无泄漏 |
| 空白字符检查 | `git diff --check` | ✅ 通过 |

**真实联网验证**（只读，未写任何数据）：
- 新增源 `360zy` 5/5 端到端可播（搜索 → 详情 → master → 变体 → 首个 ts 分片 206，直连与代理均可）。
- 候选源 `ruyi`（如意资源）只有 3/5（2 部片首条结果无 m3u8 直链）→ **未采用**。
- 重匹配逻辑对线上 4 条真实记录干跑：`复仇者联盟4：终局之战`→hhzy、`庆余年 第二季`→zy360new、
  `人生交换`→subo（三条 m3u8 均实测 206）；`庆余年第二季` 精确命中同名。

### 残余风险 / 未做

1. **采集源随时会挂**：本轮的过滤与自愈只是把「死线路」挡在门外，源本身仍可能下线；
   实时口径以「源状态」面板（`/sources`）为准。
2. **重匹配是「尽力而为」**：源站标题写法千差万别，主标题回退也未必 100% 命中；命中不了就 404 不写库。
3. **存量数据未批量修复**：本轮只提供「站长手动点一下」的入口，**不自动批量改库**
   （用户明确要求不要静默自动修数据库）。
4. **未做真机端到端**：本机无线上 Worker 部署，重匹配接口只在本地用真实 fetchers 干跑过。

---

---

## 2.34 图片展览 + 公开时间轴（2026-10-10，分支 feat/gallery-timeline）

在最新 main（`58f80ce`）上新增两个公开页面与配套后端，**没有 commit / push**。

### 本轮完成

1. **新增迁移 `supabase/migrations/20261010000016_gallery_items.sql`**：建 `public.gallery_items`
   （`user_id / asset_id / title / description / captured_at / sort_order / is_public / 时间戳`），
   `unique(user_id, asset_id)`、索引与 RLS 策略（本人读写 + 管理员全权）。
   **数据库级同 owner**：`assets` 加 `unique(user_id, id)`（`assets_user_id_id_key`），
   `gallery_items` 用复合外键 `(user_id, asset_id) -> assets(user_id, id) on delete restrict`
   （`gallery_items_asset_same_owner`）——仅靠 RLS 挡不住「authenticated 直连插他人素材」。
2. **新增 `backend/src/routes/gallery.js`**：`GET/POST/PATCH/DELETE /api/gallery`。
   访客查询层叠加 `is_public=eq.true`（条目与素材各一道）；`decorate()` 无论访客还是站长都按
   `user_id` 过滤 `assets`（Worker 用 service_role，RLS 不生效）；响应不含
   `object_key / sha256 / user_id / asset_id / original_name`，`alt` 用策展标题。
   「展览公开 ⇒ 素材必须公开」在创建与改公开两处校验，拒绝半成功；重复加入返回 409。
3. **新增 `backend/src/lib/timelineMerge.js`**（无 IO 纯函数）：三类内容 → 统一结构
   `{id,type,title,summary,date,url,cover,source_id}`，按 `date` 倒序、同 date 按 id 升序；
   游标为 `<date>|<id>` **复合游标**（同一天多条不跳条），兼容旧格式「仅时间」，`limit` 封顶 50。
4. **新增 `backend/src/routes/timeline.js`**：`GET /api/timeline`，三类查询各自在 DB 层叠加公开条件
   （posts `published + is_public`、resources `is_public`、gallery `is_public` 且素材公开）。
   倒序翻页粗过滤用 `lte.`，并覆盖「主日期列 + 回退列」（posts `published_at`/`created_at`、
   gallery `captured_at`/`created_at`），避免跨日翻页为空或漏掉「今天加入、拍摄日期较早」的图。
5. **`backend/src/lib/publicScope.js`**：访客读白名单加入 `gallery` 与 `timeline`（写操作仍一律拒绝）。
6. **`backend/src/routes/assets.js`**：`findReferences` 增加 `gallery_items` 引用检查
   （返回值加 `kind`），被展览引用的素材删除返回 409。
7. **前端**：新增 `routes/Gallery.jsx`（纯 CSS 错落 masonry + 灯箱 + 管理员策展抽屉）、
   `routes/Timeline.jsx`（年份/月份分组、中轴节点、类型筛选、游标加载更多）、
   `styles/gallery-timeline.css`（只含 `.gl-*` / `.tl-*`，`prefers-reduced-motion` 兼容）；
   `lib/api.js` 增 5 个方法；`routes/routes.js` + `app.jsx` 加 2 条懒加载路由；
   `components/Layout.jsx` 的 `TOOLS` 仅追加「图片展」「时间轴」两项。
8. **文档**：新增 `docs/gallery-timeline.md`（数据模型 / 权限矩阵 / 三条公开不变量 / 排序语义 /
   近似分页限制 / 待办），`docs/api.md` 追加两节，本节。

### 权限模型（本轮新增部分）

| 操作 | 访客 | 登录用户 | 管理员 |
| --- | --- | --- | --- |
| 读展览 | 仅公开条目（且素材公开） | 本人全部 | 本人全部 |
| 写展览 | ❌ | 仅本人 | 仅本人 |
| 读时间轴 | 仅公开内容 | 仅公开内容 | 仅公开内容 |

### 验证结果（本机，2026-10-10）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 后端确定性 + 契约测试 | `cd backend && npm run test:unit` | ✅ 73/73 通过（展览/时间轴 12 组 + 影音 6 组 + 原有用例） |
| 前端生产构建 | `cd frontend && npm run build` | ✅ 通过（`✓ built in 25.41s`） |
| 凭据扫描 | `node scripts/check-secrets.mjs` | 见下 |
| 空白字符检查 | `git diff --check` | 见下 |

> 本机 frontend 构建借助相邻 worktree 已缓存的 `node_modules`（软链后立即移除），未联网、未改动依赖清单。

### 待办 / 残余风险

1. 迁移 `20261010000016` 需经 CI（或人工）在 Supabase 应用后才生效。
2. 本机无法连真实 Supabase / R2，**未做端到端验证**（上传素材 → 加入展览 → 访客可见 → 时间轴出现）。
3. 时间轴游标为 `<date>|<id>` 复合游标，同一天多条不会跳条；粗过滤方向为倒序 `lte.` 并覆盖回退日期列，跨日翻页已验证；代价是游标附近会多取少量数据（详见 `docs/gallery-timeline.md` §4）。
4. 线上 `resources` 目前全部 `is_public=false`，时间轴的资源区线上暂为空，属预期。
5. 相册 / 分组、拖拽排序、图片转码与缩略图仍未做。
6. `assets` 的 `(user_id,id)` 唯一约束随迁移 0016 一起应用；若线上曾手工加过同名约束，DO 块会跳过。
7. **公开 / 私人内容控制入口**（站长一键切换内容公开状态的管理面）仍待办。

### 2.34.1 导航调整：图片展 / 时间轴升为一级模块（2026-10-10）

用户决定：`/gallery`（图片展）与 `/timeline`（时间轴）不再收在「更多」下拉里，
直接平铺到桌面/横屏顶栏一级导航（`Layout.jsx` 的 `TOOLS` → `PRIMARY`，现共 8 项）。
「更多」保留收藏 / 分类 / 标签与管理员「源状态」。为避免 8 项在 1024px 笔记本上
挤压搜索与头像，`global.css` 顶栏横向滚动阈值由 920px 上调至 1080px，仅改断点，未动其它布局。

## 0. 项目速览

| 项 | 值 |
| --- | --- |
| 项目 | **Dora** · 个人知识管理平台（原「知识库」） |
| 仓库路径 | `/home/xgc/projects/knowledge-base`（WSL2 Ubuntu 原生文件系统，**禁止放到 /mnt/c**） |
| 技术栈 | 前端 Preact + Vite（Cloudflare Pages） / 后端 Cloudflare Workers + wrangler（REST + 管理员 MCP） / Supabase（Postgres + Auth + RLS，CLI 迁移） / Cloudflare R2 / GitHub Actions |
| 前端线上 | `https://dora.xuguochen.de5.net`（Pages 项目 `knowledge-base`，默认域 `knowledge-base-9j0.pages.dev`） |
| 后端线上 | `https://api.xuguochen.de5.net`（Worker `knowledge-base-api`） |
| Supabase | 项目 ref `wkpxbyauvnxvmzidbeer`（ap-southeast-2 / PG17）；本地凭证在 `supabase/.env.local`（已 gitignore） |
| 管理员账号 | 邮箱见 `supabase/.env.local` 的 `ADMIN_EMAIL`（已 gitignore），**密码只存密码管理器、不入仓库**（uid `22ebc30e-d335-4199-9cfd-597e9402fb9e`，role=admin） |
| 强制规则 | 回复用简体中文；DB 变更必须走 `supabase/migrations` 迁移文件；禁止硬编码密钥；**写操作铁律**：任何写入（更新/删除/进度）必须 `user_id=eq.${user.id}`，管理员只有 `?all=true` 的**读**权限 |

---

## 1. 当前状态

**Phase0–6 全部完成并上线**，之后是按需求追加的增量改造：

| 阶段 / 增量 | 提交 | 状态 |
| --- | --- | --- |
| Phase0 环境初始化 | `33f24d0` | ✅ 上线 |
| Phase1 公共底座（JWT/分类/标签/主题/双视图） | `bc4ed9c` | ✅ |
| Phase2 视频/GitHub/博客 + 管理员 MCP | `d1eae06` | ✅ |
| Phase3 检索/图谱/收藏夹/备份/通知 | `01d9ecb` | ✅ |
| Phase4 音乐库 | `de1049d` | ✅ |
| Phase5 RSS + 影视库 | `c15d574` | ✅ |
| Phase6 管理员面板 + 权限漏洞统一修复 | `aebaf86` | ✅ |
| 域名上线（pages/worker 自定义域名 + 证书） | `021a593` | ✅ |
| SaaS 液态玻璃风格改造 + 落地页 | `bd5c958` | ✅ |
| 品牌更名 Dora + 自托管字体 | `0206e89` | ✅ |
| 现代线性图标系统 + 品牌流光 | `50863d5` | ✅ |
| 音乐/影视多源聚合 + 黑胶播放器 + 同步歌词 | `7d63e78` | ✅ |
| **本轮接力：GD音乐台无损音源 + 5 个影视采集源 + 动漫类目搜索 + 音乐/影视 UI 收尾** | `92f9ca2` | ✅ 已提交并部署上线 |

> 本轮之前的会话在「音乐/影视 UI 重构」中途因模型限流中断（最后一句停在
> 「删掉旧的 AudioPlayer，并补齐音乐模块的样式」）。本轮**接力把未落地的部分做完**。

---

## 2. 本轮完成内容（2026-10-06 接力）

### 2.1 后端 · 音乐：GD音乐台成为主源

文件：`backend/src/lib/fetchers.js`（新增 GD音乐台适配器 + 重写 `fetchMusicMeta`）、
`backend/src/routes/music.js`、`backend/src/router.js`。

- **新增主源 `GD音乐台`**（`https://music-api.gdstudio.xyz`）：返回**完整曲目**直链，
  实测 `netease` 源稳定给出 **900~1600kbps / 20~64MB 的 FLAC**（`br=999`）。
  `joox` / `bilibili` 在这台机器上拿不到直链（`br=-1`），故默认只用 `netease`
  （可用环境变量 `GD_MUSIC_SOURCE` 覆盖）。
- 四个源并发聚合、同名同歌手去重合并（`mergeCandidate`）：播放地址与音质取更优的一侧，
  **封面/专辑/时长互补**；排序为「完整曲目优先 + 音源可信度」。
- **封面处理**：GD 的 `types=pic` 返回的是 JSON（不能直接当 `<img src>`），
  因此优先用同曲的 iTunes/Deezer 封面，仍缺时再补查 GD（最多 3 条）。
- **歌手头像**：`TheAudioDB`（公开测试 key `123`）补全第一条结果的歌手头像，失败静默。
- **歌词**：LRCLIB 未命中时回退 GD 歌词接口（`fetchLyrics(..., gdSource)`）。
- **新接口 `POST /api/music/stream`**：按 `{ platform, external_id, source }` 重新解析直链。

> **为什么需要重解析**：GD 返回的直链是网易云 CDN 的**带时间戳签名地址**
> （路径形如 `/20261006171212/…`），**会过期**。收藏时会把 `platform` / `external_id` /
> `gd_source` 写进 `resources.metadata`，前端播放失败时自动换一条新直链。

### 2.2 后端 · 影视：5 个采集源 + 动漫类目搜索 + 元数据补全

文件：`backend/src/lib/maccms.js`、`backend/src/lib/metadb.js`（**新增**）、`backend/src/lib/fetchers.js`。

- **采集源 3 → 5**：新增 `最大资源 zuid`（`https://api.zuidapi.com/api.php/provide/vod`）
  与 `360资源 zy360`（`https://360zy.com/api.php/provide/vod/`）。
  5 源健康检查全部 OK（lzi 0.8s / ffzy 0.9s / dytt 0.8s / zuid 1.7s / zy360 1.0s）。
- **动漫类目搜索（关键修复）**：动漫正片在关键词搜索里几乎被真人剧/短剧挤掉，
  现在**每个源两路并发**：关键词搜索 + 该源「国产/日韩/欧美动漫」类目搜索。
  各源动漫 `type_id` 并不统一（zy360 的 29 是动画片、38 才是国产动漫），
  因此用 `ac=list` 的 class 列表**按名称动态发现**并缓存 1 小时（`getAnimeClassIds`）。
  实测「凡人修仙传」动漫命中 0 → 4；「诡秘之主」0 → 3（全是国产动漫）；「诛仙」→ 含 2 部动漫。
- **内容过滤收紧**：除 `type_id_1` 顶层分类（只留 1=电影片 / 2=连续剧，动漫搜索放行 4=动漫片）外，
  再按 `type_name` 剔除短剧 / AI漫剧 / 综艺 / 体育 / 新闻 / 解说 / 预告 / 有声。
- **相关度排序**：完全同名 > 前缀命中 > 包含 > 其他，同档位可播放优先。
- **新增 `lib/metadb.js` 元数据补全**：`Cinemeta (Stremio)` 补海报/背景图/IMDb 评分、
  `Bangumi`（必须带 UA）与 `Kitsu` 补动漫封面与简介。
  只补前 4 条、且确实缺字段的条目，任一失败静默跳过（`fetchMovieMeta` 中 `enrichMovieCandidates`）。

### 2.3 前端 · 音乐/影视 UI 收尾

- `frontend/src/styles/global.css`：**+916 行**，补齐此前缺失的全部音乐模块样式
  （`mini-*` 常驻底栏、`np-*` 沉浸式正在播放页、`lyric-*` 歌词页、`shelf/album-*/track-*` 音乐库、
  以及影院播放器漏掉的 `watch-frame`/`watch-meta`）。颜色全部走既有 CSS 变量，
  含浅/暗双主题、900/640px 响应式与 `prefers-reduced-motion` 降级。
- `frontend/src/lib/player.jsx`：主音源与备用音源全部失败时，若曲目带
  `metadata.platform === 'gdstudio'`，自动调 `/api/music/stream` 换新直链并续播（只尝试一次）。
- `frontend/src/lib/api.js`：新增 `resolveMusicStream`。
- `frontend/src/routes/Music.jsx`：收藏时带上 `platform/external_id/gd_source/bitrate/format/file_size`。

### 2.4 本轮验证记录（可复现）

```bash
# 后端逻辑（Node 直连，无需 wrangler；必须让 Node 走代理，见第 4 节坑 ③）
cd ~/projects/knowledge-base/backend
NODE_USE_ENV_PROXY=1 node <(cat <<'JS'
const b='/home/xgc/projects/knowledge-base/backend/src/lib/';
const { fetchMusicMeta, fetchLyrics, resolveGdstudioUrl, fetchMovieMeta, checkVodSources } = await import(b+'fetchers.js');
console.log((await fetchMusicMeta('七里香',5,{})).candidates.map(c=>`${c.platform} ${c.title} ${c.quality} ${c.bitrate||'-'} ${c.audio_url?'url✓':'url✗'} ${c.artwork_url?'cover✓':'cover✗'}`).join('\n'));
console.log(await checkVodSources({}));
console.log((await fetchMovieMeta('诡秘之主',5,{})).candidates.map(c=>`${c.source} ${c.title} ${c.type_name} 可播${c.playable_url?'✓':'✗'}`).join('\n'));
JS
)
```

实测结果（2026-10-06）：

| 检查项 | 本地（Node 直连） | 线上（`api.xuguochen.de5.net`，部署后复测） |
| --- | --- | --- |
| 音乐「七里香 / 告白气球 / 晴天」 | GD音乐台各出 3 条 **FLAC 完整曲**（br 570~1607），封面 ✅，Audius/iTunes/Deezer 正常合并 | ✅ `sources=gdstudio+audius+deezer`，5 条候选，首条封面 ✅ |
| 直链重新解析 | ✅ br=919 / 29MB | ✅ br=919 / 29MB（`/api/music/stream`） |
| 歌词 | ✅ LRCLIB 同步歌词 34 行 | ✅ `source=lrclib`、`synced=true` |
| 采集源健康 | ✅ 5/5 | ✅ 5/5（lzi 323ms / ffzy 587ms / dytt 593ms / zuid 35ms / zy360 625ms） |
| 动漫搜索 | 「诡秘之主」3 条全是国产动漫；「凡人修仙传」动漫 5 条；「诛仙」含动漫 2 部 | ✅「诡秘之主」3 条国产动漫（lzi/zy360，均可播放）；「复仇者联盟」4 部电影均可播放 |
| 前端 | `npx vite build` ✅ 退出码 0 | ✅ `dora.xuguochen.de5.net` 200；线上 CSS 含全部 69 个音乐/影视样式类 |

> ⚠️ **本轮没有做视觉截图验收**：本机 Playwright 未安装可用 Chromium（`~/.omp/logs` 报
> 「Shared browser daemon unavailable」，与上一轮「需 sudo 才能装浏览器」同一原因）。
> 样式只做到了「构建通过 + 线上 CSS 类名覆盖齐全 + 页面 200」这一层，
> **像素级效果仍需人眼确认**（要看的点见第 3 节第 4 条）。

### 2.5 文档更新
- `docs/api.md`：音乐多源表 + GD 三个坑 + `/api/music/stream`；影视采集源表、搜索策略、
  元数据补全表、`/api/movies/latest`、`/sources/health`、`/source-detail`、以及 maccms 新增字段。
- `docs/interface-inventory.md`：把本轮已集成的接口状态从「待集成」改为「已集成」。
- 本文（`docs/progress.md`）：新增。

### 2.6 上线后的返工（同日，用户实测反馈）

1. **点歌播放报 `file_size 超出范围`（422）**
   - 根因：`lib/validate.js` 的 `optionalInt` 默认上限是 `1e6`，而 `file_size` 单位是**字节**
     （无损 FLAC 常 20~70MB），必然越界；我在 `routes/music.js` 写 metadata 时没显式放宽上限。
   - 修复：`file_size` 显式改为 `{ min: 0, max: 10_000_000_000 }`。
   - 复现 → 验证：同一 payload（`file_size=36600676`）修复前 `HTTP 422 {"error":"file_size 超出范围"}`，
     修复后 `HTTP 201`，`metadata` 中 `platform/external_id/gd_source/bitrate/format/file_size` 全部正确落库。
   - 同类隐患：`optionalInt` 的 1e6 默认上限**不适合任何「字节 / 毫秒 / 大数值」字段**，新增字段时务必显式给 max。
2. **搜索结果改为横向列表**（原来是专辑卡片网格，一行一首更好扫读）
   - `frontend/src/routes/Music.jsx`：新增 `SearchRow`（封面 + 曲目/歌手/专辑 + 音源标签 +
     音质标签「无损/完整音轨/试听」+ 时长 + 收藏按钮），点击任意位置=收藏并播放，右侧 `+`=仅入库；
     `addFrom(candidate, { play })` 支持只收藏不跳转。
   - `frontend/src/styles/global.css`：新增 `.result-list/.result-row/.result-art/.result-main/.result-src/
     .result-rate/.result-quality/.result-time/.result-collect`（含 hover/键盘焦点/触屏常显播放键/720px 断点）。
   - 「我的音乐库」货架仍是专辑卡片网格（只有搜索结果改成了列表）。
   - 顺带清理：`AlbumCard` 去掉只为搜索服务的 `candidate` 分支与收藏按钮，删除随之失效的 `.album-collect` 样式。

---

## 2.7 UI 质量提升（同日，以 Awwwards / Webby / FWA 为基准的一轮）

**先记能力边界**：本轮第一次做到「可视化验证」。这台机器原本没有可用浏览器 ——
Playwright 的 `chrome-headless-shell` 缺 `libnspr4 / libnss3 / libasound2`（装它们要 sudo）。
本轮用 `apt-get download` + `dpkg-deb -x` 把这三个 deb 解到 `~/.local/browser-libs`，
再用 `LD_LIBRARY_PATH` 包装脚本（`~/.local/bin/omp-chrome`）驱动 omp 自带的 Chromium，
并安装 Noto Sans/Serif CJK（`~/.fonts`）解决中文豆腐块，于是可以真机截图逐页自检：

```js
const tab = await browser.open({
  name: 'dora', url: 'https://dora.xuguochen.de5.net/',
  viewport: { width: 1440, height: 900 },
  app: { path: '/home/xgc/.local/bin/omp-chrome', args: ['--proxy-server=http://127.0.0.1:7897'] }
});
display(await tab.screenshot({ format: 'webp' }));
```

改动（按影响面排序）：

1. **顶栏重构**（`components/Layout.jsx`、`Icon.jsx` 新增 `menu`/`chevronDown`、`global.css`）：
   原先 12 项平铺 + 邮箱/退出挤在同一行、窄一点就折成两行。现在单行——
   品牌 · 6 个内容模块（视频/GitHub/博客/音乐/影视/RSS）· **更多**(收藏/图谱/分类/标签)
   · 搜索 / 主题 / 通知 · **头像菜单**(设置/备份/用户管理/退出)；≤920px 收成抽屉（背景 97% 不透明）。
2. **控制台重做**（`routes/Home.jsx`）：欢迎区（日期 + 管理员徽章 + 写博客/找音乐/找影视）、
   6 个模块磁贴、**最近添加**（真实数据 + 相对时间）、**快捷入口**（6 个工具直达）。
   原先只有 6 个磁贴，下面大半屏空白。
3. **暗色表面层级**（tokens）：`--glass-bg` 55%→72%、`--glass-bg-strong` 78%→90%、边框对比加强、
   `--glass-highlight` 0.10→0.14 —— 卡片才真正"浮"起来；内容区 1240→1280px，上下留白加大。
4. **音乐页 / 影视页页头**（`Music.jsx` / `Movies.jsx` + CSS）：不再是「空容器玻璃面板」，
   改为 kicker + 大标题（`clamp(30px, 3.2vw, 40px)`）+ 副标题 + 胶囊搜索框（`focus-within` 光晕）+ 细分割线；
   音乐库专辑网格 158→174px、货架标题与计数胶囊化；影视推荐片单去掉面板外壳、行距收紧。
5. **落地页规格条横跨整行**：原先只压在左栏、右下留一大块空白；条目字号/基线统一，预览卡显式定位到第 1 行右列。

**同时修掉的真实缺陷**（不是纯美化）：
- `ProtectedRoute` 丢掉路由参数 → 所有 `/xxx/:id` 详情页报「id 必须为合法 UUID」（见提交 `9184dd3`）。
- `file_size` 校验上限吃掉无损音乐（`97363d8`）。
- 确认 preact-router **确实拦截内部链接**（实测 `window.__probe` 跨导航存活、`<audio>` 未被销毁），
  所以「点导航会整页刷新、打断播放器」的担心不成立——原实现是对的。

仍待打磨（未在本轮完成，接手可直接做）：
- 音乐**详情 / 正在播放 / 歌词**页的细部：hero 左右平衡、空状态、动效节奏。
- 音乐库条目少时下半屏空 —— 可加「发现 / 热门」横向货架（Apple Music 式 Top Picks）。
- 落地页预览窗仍是骨架块，可换成更有产品感的示意（真实封面/海报缩略）。
- 收藏 / 图谱 / 检索 / 设置 / 用户管理等次级页面的同款打磨。
- 动效系统统一（入场/悬停/按压的时长与缓动一致化）+ 键盘可达性（focus 顺序与可见焦点）复核。

---

## 2.8 UI 质量提升（第二轮：音乐模块三页 + 全站页面头/空状态统一）

按 2.7 节末尾的待办清单继续，改动同样逐页截图核对（1440 宽、亮/暗主题、部分 390 宽）。

**音乐模块（本轮重点）**
1. **详情页 `MusicView`**：加面包屑（音乐库 › 歌名）；hero 增加纵向压暗遮罩（原先模糊底图糊成一片）；
   操作区改为「播放 / 同步歌词 / 编辑」+ 标签；下方从「大片空白」改为两栏 ——
   **歌曲信息**（歌手/专辑/时长/年份/流派/音质/加入时间，只渲染有值的行）+ **接下来播放**
   （无同歌手同专辑时自动退回「音乐库其它歌曲」，库内只有一首则给带 CTA 的空态）。
2. **正在播放页 `MusicPlayer`**：沉浸态下**顶栏与底部播放条全部让位**（`body:has(.now-playing) .app-header{display:none}`）；
   直接打开 `/play` 没有播放上下文时，空态改为「图标 + 文案 + 去音乐库 + 库内 6 首可点卡片」，不再是死胡同。
3. **歌词页 `MusicLyrics`**：舞台整体居中（`max-width: 1180px`）、歌词列限宽 720px（一行太长难跟读）、
   隐藏滚动条；复核确认逐句高亮 / 已唱过的行变淡 / 自动居中滚动都正常（实测 `currentTime=42.7s` 时 `.lyric-line.active` 命中当前句）。
4. **音乐库**：条目少于 6 首时补「发现更多」区（8 个推荐词一键搜索），避免只有一两张卡片时下半屏全空。

**全站统一（可复用组件）**

| 新增 | 作用 | 已接入 |
| --- | --- | --- |
| `components/PageHeader.jsx` | kicker + 大标题 + 副标题 + 右侧操作，底部细分割线 | 视频 / GitHub / 博客 / RSS / 收藏 / 图谱 / 分类 / 标签 / 检索 / 设置 / 备份 / 用户管理（11 页） |
| `components/EmptyState.jsx` | 图标 + 标题 + 提示 + 可选 CTA | `GalleryView`/`TimelineView` 新增 `empty` 插槽；视频/GitHub/博客给了定制文案，其余用默认文案 |
| `.inline-form` | 胶囊输入框（与音乐/影视搜索同款） | 视频、GitHub 的「添加」表单 |

**细节质感**：`::selection` 用主色、滚动条跟随主题（沉浸页另行隐藏）、主题切换加过渡；
新增 `link` 图标。

**本轮又踩到的坑（已记）**：Cloudflare Pages 部署后有传播延迟，新哈希的 CSS/JS 可能先返回
`index.html`（`content-type: text/html`）→ 页面**完全无样式**；浏览器也可能继续用旧的 route chunk
（表现为改了文案却看不到）。验证流程固定为：先轮询 `assets/<hash>.css` 直到 `text/css` 且含预期标记，
再截图；必要时 `reload()` 一次。

**仍待打磨（接手可直接做）**
- 分类 / 标签 / 收藏 / RSS 条目 / 影视列表页的空态文案可再定制（当前用默认文案）。
- 加载态仍是「加载中…」纯文本，可统一换成骨架屏（音乐库已有 `skeleton-card` 可复用）。
- 文章详情/编辑页、影视详情/播放页的细部打磨与截图核对（本轮未看）。
- 移动端**页面级**复核（目前只核了音乐库与抽屉；≤920px 的列表/详情页待看）。
- 落地页下方区块（功能矩阵 / 能力 / 四步 / CTA / 页脚）的细部。
- 键盘焦点顺序、Esc/Enter 行为的系统复盘（焦点环样式已统一）。

---

## 2.9 影视详情页核对 + 移动端复核（第三轮）

**影视详情页**（首次真正点进有数据的详情页：临时收藏《流浪地球》→ 逐项核对 → 删除测试条目）：

| 问题 | 修复 |
| --- | --- |
| 线路标签直接打印采集源内部代号（`lzm3u8` / `ffm3u8` / `dyttm3u8`…），同源多条只差序号 | 映射为「量子资源 · m3u8」「非凡资源 · m3u8 (2)」，原始标识保留在 `title` |
| 主演一次列出 28 位 | 只展示前 8 位 + 「等 N 位」，完整名单进 `title` |
| 「播放线路」计数实际显示的是当前线路的集数（`1 个`），却列出 8 条线路 | 改为「8 条线路」/「N 条线路 · M 集」 |
| 「返回影视库 / 编辑」是厚玻璃按钮，与主操作争夺注意力 | 改为 ghost 样式（无边框无底，hover 才浮出） |

**移动端（390×844）页面级复核**：影视库无横向溢出；发现**推荐片单 6 行把正文推到两屏之后** →
手机端默认收起（「推荐搜索 [展开]」），桌面始终展开；收起后首屏即可看到片单与海报网格。

**验证方法记录**：`tab.emulate({ viewport: { width: 390, height: 844 }, isMobile: true })` +
`screenshot()`，并用 `document.documentElement.scrollWidth > innerWidth` 判定横向溢出。

**仍待打磨**
- 其余列表页（分类/标签/收藏/RSS 条目/影视收藏）的空态文案可再定制（当前用统一默认文案）。
- 加载态仍是「加载中…」纯文本，可统一换骨架屏（`.skeleton-card` 已存在）。
- 文章详情/编辑页、影视**播放页**（影院模式 / m3u8 选集）尚未做视觉核对。
- 移动端其余页面（控制台/详情/播放/歌词）未逐页看。
- 落地页下方区块（功能矩阵 / 能力 / 四步 / CTA / 页脚）未细看。

---


---

## 2.10 影视源修复（2026-10-07）

### 问题
用户反馈影视库搜索《庆余年》等剧集无法正常播放。

### 排查结论
- 原5个采集源接口均正常返回数据，但**大部分源的m3u8播放地址存在问题**：
  - 量子资源(lzi)、暴风资源(bfzy)：直链404，资源已过期
  - 非凡资源(ffzy)、最大资源(zuid)：直链403防盗链，前端直接加载被拦截
- 仅3个源的m3u8可无Referer直接访问：**电影天堂(dytt)、360资源(zy360)**
- 新增测试通过的源：**红牛资源(hongniu)**，同样无防盗链，庆余年搜索结果36集完整

### 修复内容
修改 `backend/src/lib/maccms.js` 的 `DEFAULT_VOD_SOURCES`：
1. 新增红牛资源 `https://www.hongniuzy2.com/api.php/provide/vod/`
2. 调整源顺序：3个无防盗链可直接播放的源（dytt / zy360 / hongniu）排最前，有防盗链的源(lzi/ffzy/zuid)放后作为补充
3. 利用现有排序逻辑：同相关度下按源列表顺序优先，保证用户搜索时优先拿到可直接播放的结果

### 部署
- 后端Worker已部署上线：版本 `68e5831f-dbd5-4b60-bc02-3f8cad3ecca4`

### 仍待优化
- 长远方案：后端新增m3u8代理接口，转发时携带正确Referer，解决所有防盗链源的播放问题
- 目前3个无防盗链源已覆盖大部分热门剧集，先保证基础可用

## 2.11 NewsNow 热榜接入（2026-10-09）

- 新增独立 Worker `newsnow-api`（源码 newsnext/newsnow，MIT，`CF_PAGES=1` 构建后取 `_worker.js` 以模块方式上传），域名 `news.xuguochen.de5.net`；未启用 D1/登录/缓存。
- 后端：`backend/src/routes/news.js` + `lib/newsSources.js`（47 个源）。`GET /api/news/sources`、`GET /api/news/:id`，需登录；经 service binding `NEWSNOW` 调用，边缘缓存 5 分钟。
- 前端：导航「视频」前新增「NewsNow」，路由 `/news`（`routes/News.jsx`），按栏目（精选/国内/国际/科技/财经/体育）展示玻璃卡片热榜。
- 已知：GitHub Actions 部署自 2026-10-07 起失败（疑似仓库 Secrets 中 Cloudflare 令牌在安全轮换后失效）。

## 2.12 移除 RSS 模块（2026-10-09，用户决定，不保留数据）

- 删除后端 routes/rss.js、lib/rss.js、lib/rssSync.js 及全部 /api/rss 路由；Worker 不再有 scheduled 处理器，wrangler.toml `crons = []`。
- 删除前端 RssFeeds/RssArticles 页面、导航 RSS 按钮、api 方法、首页卡片、搜索/图谱/通知里的 RSS 类型。
- 迁移 `20261009000014_drop_rss.sql`：删 rss_feeds/rss_articles 表、rss_new 通知，resources.type 去掉 rss_article。
- 文档中其余 RSS 描述为历史记录，以本节为准。

## 2.13 访客只读模式（2026-10-09）

- 网站对外展示，暂停强制登录：未登录可只读浏览站长内容（博客仅已发布），写操作仍需登录；顶栏隐藏登录按钮。
- 开关：`backend/wrangler.toml` 的 `PUBLIC_MODE`。详细改动与恢复方法见 `docs/removed-features.md`（RSS 删除记录也在里面）。

## 2.14 影视库 UI 升级（方案 C，2026-10-09）

- 频道栏：精选 / 电视剧 / 电影 / 动漫 / 综艺 / 最新入库（采集源）；搜索结果仍是采集源网格。
- `frontend/src/components/MovieHome.jsx`：首屏大图轮播（虚化高清海报背景 + 清晰海报 + 缩略图切换，6 秒轮播）、「我的片库」行、分类海报行（横滑 + 查看更多展开成海报墙）。点海报 = 用片名在采集源搜索。
- 数据：后端 `routes/douban.js`。`GET /api/movies/douban`（豆瓣 /j/search_subjects，边缘缓存 30 分钟）；`GET /api/img/douban`（带 Referer 中转豆瓣海报，m=540×810 / l=1080×1620，缓存 30 天，无需登录）。
- 访客模式补充：`/api/movies/search`、`/api/movies/source-detail`、`/api/music/search`、`/api/music/lyrics` 这几个只读 POST 也对访客开放（后端 PUBLIC_POST，前端 GUEST_POST）。
- 未做：豆瓣没有排播数据，参考图里的「本周追剧」日历暂未实现；豆瓣没有「国漫」分类，动漫频道只有日本番剧与动画电影。
- 访客播放（同日）：未登录点采集源结果不再入库，直接进 `/movies/watch/:source/:vid` 播放页（MovieView 预览模式，候选经 sessionStorage 传递，缺失时回源 source-detail）；不记播放进度，不显示编辑按钮。

## 2.15 音乐库 UI 升级（Apple Music 风格，2026-10-09）

- 新增默认「首页」Tab（`frontend/src/components/MusicHome.jsx`）：现在就听（热歌榜 No.1 大封面 + 虚化背景）、四张排行榜卡（热歌/新歌/飙升/原创）、选中榜单的双列曲目列表、新歌速递横滑。
- 后端 `routes/musicCharts.js`：`GET /api/music/charts?chart=hot|new|soar|original`（网易云官方榜经 Meting，缓存 1 小时）；`GET /api/img/music?id=&s=300|600|1000`（跟随 Meting 302 改 param 取高清封面，缓存 30 天，无需登录）。`lib/cover.js` 的 `hdCover()` 统一把网易云封面换成高清中转。
- 播放器（`lib/player.jsx`）支持不入库的「内联曲目」（id 为空、数据随队列携带）：榜单曲目所有人直接播放；访客点搜索结果也直接播放，不入库。`/api/music/stream` 加入访客可用的只读 POST。
- 影视播放器：换线成功开始播放后清除「线路不可用」提示。
- 已知：部分采集源 CDN（如 dytt）对境外 IP 返回 403，海外访问时会自动换线。

## 2.16 博客首页换成 cosolar 风格（第 1/3 步，2026-10-09）

- 复刻 halo-theme-cosolar（GPL-3.0，只参考设计、代码自行实现）：青绿主色、分类导航 + 搜索、最新 5 篇精选轮播（6 秒）、最新/最早卡片列表（每页 10 篇）、侧边栏（博主卡、热门标签、专题类别、近期更新）。无封面文章按分类生成渐变封面。
- 后端 `GET /api/posts?with_tags=true` 附带每篇的 `tag_ids`。
- 下一步：第 2 步文章阅读页（进度条、悬浮目录、图片查看器）；第 3 步归档/分类/标签页 + 移动端。

## 2.17 博客阅读页 cosolar 风格 + 统一默认封面（第 2/3 步，2026-10-09）

- 封面：按用户要求，无封面文章不再用分类渐变色，统一用旧站 cosolar 的默认封面 `public/blog/default-cover.webp`（来源与 GPL-3.0 说明见 `public/blog/NOTICE.md`）。
- 阅读页 `PostView.jsx`：顶部渐变进度条、封面头图（标题/分类/日期/字数/阅读时长）、桌面右侧悬浮目录（h1–h3，滚动高亮）、≤1000px 目录抽屉按钮、回到顶部、图片查看器（滚轮/按钮缩放、拖动、ESC 关闭）、长文排版（h2 青绿左边线、行内代码、表格/公式横向滚动）。编辑按钮只对登录用户显示。
- 下一步：第 3 步归档/分类/标签页 + 移动端底部工具栏。

## 2.18 博客归档 / 分类 / 标签页 + 移动端（第 3/3 步，2026-10-09）

- 新路由（访客可看）：`/posts/archive`（年 → 月时间线）、`/posts/categories`（分类卡：篇数 + 最新 3 篇）、`/posts/tags`（按文章数加权的标签墙）。页头用旧站 cosolar 的 `featured-default.webp`。
- 首页筛选改为 URL 参数：`/posts?cat=<slug>`、`/posts?tag=<slug>`、`/posts?focus=search`，可分享、可从聚合页跳回。
- `lib/blogData.js`：首页/归档/聚合页共用一份 60 秒缓存；保存/删除文章时失效。
- 移动端（≤768px）：隐藏侧栏，底部毛玻璃工具栏（首页/分类/标签/归档/搜索，`components/BlogDock.jsx`），播放器出现时自动上移。
- cosolar 复刻三步全部完成。

## 2.19 博客顶部横幅 + 阅读页高清头图 + 去掉汉堡菜单（2026-10-09）

- 首页顶部新增高清横幅 `.cs-banner`：旧站 featured-default.png（3360×1152）缩成 2560 宽 `public/blog/banner-hd.webp`（约 46 KB）。左侧「Dora 的博客」+ 篇数、大号圆角搜索框、分类/标签/归档入口与「写文章」。`Posts.jsx` 的 `BANNERS` 数组多于 1 张时 8 秒淡入淡出轮换。
- 分类条只放分类，单行横向滚动并显示篇数；「首页」改名「全部」。
- 阅读页：无封面文章不再把 1129×678 的默认图拉伸成宽屏，改用 `banner-hd.webp`，高度约 220px，浅色底深色字（`.pv-hero.is-default`）。有 `cover_path` 的文章不变。列表/大卡封面不变。
- 顶栏：去掉 ≤920px 的三横线/叉号抽屉，一级导航改为横向滑动（记录在 removed-features.md）。

## 2.20 GitHub 页改为同步 GitHub Star（2026-10-09）

- 后端 `lib/githubStars.js`：同步 `GITHUB_STARS_USER`（wrangler.toml vars，= xuxianyydsok）的公开 Star 到 resources(type=github)，按页处理（每页 100，Workers 免费版单次 CPU 10ms，不能一次解析上千仓库）。每行写 `metadata.sync_run`，最后一页核对本轮写入数后删除不属于本轮的行（= 已取消收藏）。
- 触发：定时任务 `*/5 2-3 * * *`（每天 UTC 02:00–03:55，每 5 分钟一页，最多 24 页）；站长 `POST /api/github/sync {page, run}`，前端「立即同步」按页循环。可选 secret `GITHUB_TOKEN` 提升 GitHub 限速。
- `GET /api/github` 改为只返回列表字段（stars/language/topics/pushed_at/starred_at…）并分页读完（PostgREST 单次 1000 行上限）。
- 前端 `Github.jsx` 重写：标题 + 大搜索框、左侧语言/热门话题筛选（窄屏变横向滑动）、紧凑列表（点开看话题/主页）、排序（最近收藏/Star 最多/最近更新）、每页 30。
- 图谱：没有关联博客/标签的 GitHub 仓库不进图谱，避免上千孤立点。

## 2.21 GitHub 收藏 AI 中文解读 + GithubStarsManager 风格页面；主题改为白天/素雅（2026-10-09）

- 主题：白天（默认）/ 素雅（sepia，参考 GithubStarsManager，MIT），暗色主题移除（见 removed-features.md）。
- `backend/src/lib/githubAi.js`：Workers AI（`[ai] binding = "AI"`，模型 `@cf/qwen/qwen3-30b-a3b-fp8`，实测约 8 neurons/个，免费每天 10k neurons ≈ 1,200 个）。定时任务 `* * * * *` 每分钟解读 2 个未解读的仓库：README 走 raw.githubusercontent.com 取前 2000 字 → 用户确认的提示词（one_line / summary / tags(14 个固定分类) / keywords / platforms）→ 写 `metadata.ai`。失败 3 次跳过；额度用完不计失败。
- Star 同步 upsert 时保留已有 `metadata.ai`；新增 `metadata.license`。
- 前端 `Github.jsx` 第二版：左栏「应用分类」（14 类 + 待解读）+「热门话题」，右侧搜索卡（语言/平台/排序/同步）→ 工具条（AI 解读 / 原始描述、计数）→ 仓库卡片。左栏与搜索卡同行顶端对齐、sticky、自身滚动。
- 未做：重新解读 / 手动改分类 / 分类锁定（站长功能，等用户要求）。

## 3. 下一步（按优先级，接手即可开工）

0. **【改进建议总目录】`docs/improvement/`（2026-10-10 新建）**：
   系统级改进建议 8 份文档（00 总览 + 01 UI 设计系统 + 02 逐页体验 + 03 影音源与播放 +
   04 内容体系与账号权限 + 05 架构与协作规范 + 06 功能扩展与路线图 + 07 执行 Agent 提示词包）。
   入口：`docs/improvement/00-总览与阅读指引.md`。**派活前先读 07 的提示词包**。

0. **【待办·仅登记，未开发】公开 / 私人内容控制入口（单项 + 批量）**：
   2026-10-10 的公开读边界修复（见 2.32 节）后，访客**只能看到 `is_public=true` 的内容**，
   而线上 `resources` 目前**全部 `is_public=false`** → 访客看不到任何影视 / 音乐 / GitHub 资源。
   需要给站长一个**内容可见性控制入口**：
   - 单项：影视 / 音乐 / GitHub / 视频编辑页已有 `is_public` 开关，需确认前端确实渲染了该开关；
   - 批量：列表页多选 + 「批量公开 / 批量设为私密」，以及「只看私密 / 只看公开」筛选；
   - 建议同时给一个「公开内容预览」（以访客视角看一眼公开后的样子）。
   **本轮只登记待办，不开发**（等用户确认产品形态后再排期）。

0. **【待用户决定】首页横幅换成站长自己的素材**：用户手上有 3 段视频 + 若干张 5–6 MB 高清图，想放进首页横幅轮换（预算约 20 MB）。等用户发原文件后：图片缩到 2560 宽 WebP（约 300–800 KB），视频去音轨、1080p、截 10–15 秒循环 MP4（每段 3–8 MB，≤25 MB Pages 单文件上限）+ 一张截图做 poster，手机端只显示截图；压好先给用户看大小和截图再上线。代码入口：`Posts.jsx` 的 `BANNERS`（目前只支持图片，加视频需扩展渲染）。

1. **继续累积影音接口清单**：用户手上还有若干份「影音接口清单」文件，会陆续给路径。
   流程是——**逐条实测 → 与已有清单去重 → 结论写进 `docs/interface-inventory.md` → 只集成真正可用的**。
   已处理两份（L1 `C:\Users\x1078\Doubao\chats\2026-10-06\new-chat-2\影音助手接口清单.md`、
   L2 `E:\AI Agent测试\CESHI\TEST4\影音接口清单.md`）。**不要重复核对已记录过的条目**。
2. **可选集成项**（清单里实测可用、当时决定暂不集成）：
   - 音乐：`Radio Browser`（FLAC 无损电台，不可点歌）、`MusicBrainz`（限速 1 req/s，需 UA）
   - 影视：`TMDB`（需 key，配 `TMDB_API_KEY` 即自动启用，已有回退逻辑）
   - 需自部署/需 key 的（NeteaseCloudMusicApi、UnblockNeteaseMusic、Spotify、Last.fm…）暂不引入。
3. **影视片单批量收藏提速**：`backend/scripts/seed-movies.mjs` 逐条实时聚合 3 个采集源，太慢（已停用）。
   建议改成后端一次性批量入库接口（一次请求处理 N 条），前端给个「一键收藏片单」按钮。
4. **UI 人工验收**（本轮改完但没有真机截图确认，需人眼过一遍）：
   `/music` 专辑网格与悬停播放键、`/music/:id/play` 沉浸页与旋转唱片、`/music/:id/lyrics` 逐句滚动、
   底部 `MiniPlayer` 是否遮挡页面底部、`/movies` 海报网格与推荐片单、`/movies/:id` 影院详情页与 m3u8 选集播放；
   浅色/暗色两套主题都要看。
5. **可配置音源/片源**：把 `VOD_SOURCES`、`GD_MUSIC_SOURCE` 做成设置页可编辑项（目前只能改环境变量/`wrangler secret`）。
6. **未接入的前端能力**：`MusicPlayer.jsx` 里有 `lyricsOpen` 状态但从未触发（`.lyrics-open` 样式已就绪），
   想做成「播放页内联展开歌词」时可以直接用。

---

## 4. 已知限制与坑（动手前必读）

**① 第三方接口类**

| 坑 | 说明 |
| --- | --- |
| GD音乐台限频 | 5 分钟 50 次，且是**共享出口 IP** 的配额。故一次搜索只解析最靠前的 3 条直链（`GD_RESOLVE_LIMIT`），直链与封面在进程内缓存 10 分钟 |
| GD音乐台 UA | **必须用浏览器 UA**，自定义 UA 会被拦截并返回**空列表**（不报错，极易误判为「没结果」） |
| GD直链会过期 | 网易云 CDN 签名地址；靠 `POST /api/music/stream` 重新解析 |
| iTunes 在 Worker 侧 | 共享出口 IP 常被 429（本地正常）→ 所以保留 Deezer 兜底 |
| 采集源类型 ID 不统一 | 动漫类目要按 class **名称**发现，别硬编码 `29/30` |
| 元数据源 | Bangumi **必须带 User-Agent**；TheAudioDB 限频很低，只查第一条 |
| 播放地址语义 | `resources.url` 只存**可播放直链**；资料页地址存 `movie_titles.external_url` |

**② 本地开发环境**

- WSL 直连 Cloudflare 边缘有 20~30% 抖动（超时/522），**用代理 `-x http://127.0.0.1:7897` 才稳定**；
  线上无此问题（对照域名同样如此）。
- WSL 直连 Supabase DB 只有 IPv6、不可达 → 用连接池
  `aws-0-ap-southeast-2.pooler.supabase.com:5432`，用户 `postgres.wkxbyauvnxvmzidbeer`，密码在 `supabase/.env.local`。
- **本地 `wrangler dev` 出网会挂起**（workerd 网络受限）→ 后端联调基本只能「部署到线上再测」；
  纯逻辑验证走第 2.4 节的 Node 直连方式，最快。
- 环境变量里预置了 `HTTP_PROXY/HTTPS_PROXY`：curl 自动走代理，
  **Node 原生 fetch 不读代理** → 需要 `NODE_USE_ENV_PROXY=1`（Node 24 支持）；
  `wrangler` 反而必须**清掉**代理变量，否则 workerd 崩溃。

**③ 命令陷阱**

```bash
# supabase CLI：必须清掉 CODEX_CI，否则进入非交互 JSON 模式
env -u CODEX_CI supabase <...>

# 迁移（新增列必须写新迁移文件，已执行过的迁移不能改内容）
DB="postgresql://${SUPABASE_POOLER_USER}:${SUPABASE_DB_PASSWORD}@${SUPABASE_POOLER_HOST}:${SUPABASE_POOLER_PORT}/${SUPABASE_DB_NAME}"
env -u CODEX_CI supabase db push --db-url "$DB" --include-all

# wrangler：必须清代理变量
env -u CODEX_CI -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u ALL_PROXY -u all_proxy npx wrangler <...>
```

**④ 代码约定**

- `preact-router` **不解析 query string**，要从 `window.location.search` 读（参考 `RssArticles.jsx`）。
- 路由表 `backend/src/router.js` 里 `['method', pattern, handler]` **按顺序匹配**，
  字面量路径（`/api/movies/latest`）必须排在 `/:id` 之前。
- `movie_titles` / `music_tracks` / `post_tags` / `resource_tags` / `user_preferences` **没有 `id` 列**，
  用 PostgREST 查计数要用正确列名，否则返回 4 键错误对象造成「有残留数据」的误判。
- 前端重型库（KaTeX/Three.js/Mermaid/Chart.js/D3/hls.js）必须**按路由动态 import**，
  上线前检查 `dist/index.html` 不含任何重型库 `modulepreload`。
- **后端数值校验**：`lib/validate.js` 的 `optionalInt` 默认 `min=-1000000 / max=1000000`。
  字节、毫秒、大数字段**必须显式给 `max`**——曾因漏给导致无损音乐的 `file_size`（36MB）直接 422 「超出范围」。
- **Cloudflare Pages 部署后有传播延迟**：刚 `pages deploy` 完，新哈希的资源可能短暂返回
  index.html（`content-type: text/html`）。等几秒或先用部署专属域名 `https://<hash>.knowledge-base-9j0.pages.dev` 验证。

---

## 5. 接力操作手册

```bash
# ── 本地跑起来 ───────────────────────────────────────────────
cd ~/projects/knowledge-base/backend
env -u CODEX_CI -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u ALL_PROXY -u all_proxy \
  npx wrangler dev --port 8787 --local --ip 127.0.0.1        # 注意：本地出网会挂，接口测试建议直接上线上

cd ~/projects/knowledge-base/frontend
set -a && . ./.env.local && set +a
VITE_API_BASE_URL=https://api.xuguochen.de5.net npx vite build   # 构建（本地预览用 npx vite preview）
npx vite --port 5173 --host 127.0.0.1                            # dev server

# ── 部署 ─────────────────────────────────────────────────────
env -u CODEX_CI -u HTTP_PROXY ... npx wrangler deploy            # 后端 Worker（backend/ 目录）
env -u CODEX_CI -u HTTP_PROXY ... npx wrangler pages deploy dist \
  --project-name knowledge-base --branch main --commit-dirty=true # 前端 Pages（frontend/ 构建后）

# ── 拿管理员 JWT（线上接口验证用） ────────────────────────────
cd frontend && set -a && . ./.env.local && set +a
# ADMIN_EMAIL / ADMIN_PASSWORD 从密码管理器取（勿写入仓库、勿写进命令历史）
curl -s -x http://127.0.0.1:7897 -X POST "$VITE_SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['access_token'])"

# 线上验证示例
curl -s -x http://127.0.0.1:7897 --max-time 90 -X POST https://api.xuguochen.de5.net/api/music/search \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" -d '{"query":"七里香","limit":5}'
curl -s -x http://127.0.0.1:7897 --max-time 90 -X POST https://api.xuguochen.de5.net/api/movies/search \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" -d '{"query":"诡秘之主","limit":5}'
```

**提交规范**：`feat(scope): 摘要` / `fix(scope): 摘要`（scope 用 `music` / `movies` / `ui` / `phaseN`）。
提交前必做：`npx vite build` 通过、改动文件 `node --check` 通过、确认没有敏感文件入库
（`.dev.vars`、`.env.local`、`supabase/.temp` 都已在 `.gitignore`），
并把本轮内容更新回本文第 1–3 节。

**收尾**：`pkill -f workerd; pkill -f "wrangler dev"; pkill -f vite`，确认 5173/8787 端口释放。

### 2.22 GitHub 收藏侧栏：应用分类 + 编程语言（2026-10-09）
- 左栏：上方应用分类，下方编程语言方框（按数量前 10，可展开全部），两者可叠加筛选。
- 移除热门话题方框与右上语言下拉（记录于 removed-features.md）。

### 2.23 影视播放页控制栏修复 + 倍速（2026-10-09）
- 原因：「继续观看」卡片的 .watch-bar/.watch-title/.watch-frame 全局样式覆盖了播放器同名类，控制栏被压成 4px 高，返回/暂停/上下集/选集都看不见。改为限定在 .watch-card 下。
- 新增倍速（0.5x–3x，记住上次选择），上一集/下一集改为图标。

### 2.24 影视源全量复测精简 + AI 解读定时修复（2026-10-09）
- 影视源 13→6（guangsu/subo/hhzy/ikun/zy360new/mdzy），全部 5 部测试片可播；移除明细见 removed-features.md。线路名映射补上新源。
- 音乐源复测全部可用，未改。
- AI 解读：cron 判断改为非 */5 即解读，打开 Workers observability 日志。

### 2.25 图谱改为「知识库控制台」（2026-10-09）
- 导航：图谱从「更多」移出，常显在「影视」后面。
- `/graph` 新版：顶部状态条（数字滚动 + 时钟）、中间流动管线图（左：博客分类与影视/音乐/视频/GitHub 来源 → 中间总线 → 右：标签与 GitHub 应用分类；Canvas 光点沿曲线流动，悬停高亮、点击跳转）、底部四块仪表盘（实时日志 / 分布 / 365 天热力图 / AI 解读进度）。每 60 秒刷新，新事件闪烁并触发光点脉冲；标签页隐藏时暂停。
- 本页固定深色（用户选方案 A）。旧 D3 力导向图保留为「经典视图」标签。
- 后端新增 `GET /api/graph/console`（`backend/src/routes/graph.js#getConsole`），游客可读。
- `/github?cat=分类名` 支持从图谱直接筛选。

### 2.26 GitHub AI 解读改为即时（2026-10-09）
- 去掉每分钟 Cron；新增 `POST /api/github/analyze`（游客可触发，只处理未解读仓库，8 个并行）。GitHub 页加载后若有待解读，自动循环调用并实时刷新，状态显示在同步按钮下方。

### 2.27 移除视频页 + 图谱页顶栏深色（2026-10-09）
- 视频页入口/路由移除（记录于 removed-features.md）。
- 图谱页整页深色，顶栏跟随变暗；修复左列被按钮流光伪元素遮挡；右侧卡片固定三列；首次加载失败自动重试 + 重试按钮。

### 2.28 影视代理兜底 + 去广告（2026-10-09）
- 原因：光速/速播/豪华/艾坤的 ts 分片在 999/9999/65 等非常规 HTTPS 端口，很多网络拦截；m3u8 本身允许跨域。
- 后端 `GET /api/vod/proxy?u=`（`backend/src/routes/vodProxy.js`，免登录）：改写 m3u8 内所有 URI/KEY 为代理地址；分片流式透传（Range/206）；边缘缓存分片 1 天、m3u8 5 分钟；只放行影视 CDN 或媒体后缀，拦内网地址；按 DISCONTINUITY 去广告（响应头 X-Dora-Ads-Removed，`clean=0` 关闭）。
- 前端 MoviePlayer：先直连；hls 致命错误或 6 秒无画面 → 自动切代理并提示；直连失败过的域名记在 localStorage `dora:vod-proxy-hosts`，下次直接走代理；代理也失败再换下一条线路。
- 实测（庆余年）：guangsu/hhzy/ikun 经代理全链路 200/206；subo 的 g.xlzyd.com:9999 偶发 522（上游超时），会自动换线。

### 2.29 此刻页 + 设置安全中心（2026-10-10）

**做了什么**
- 新增 `/now`「此刻」公开状态页：站长显式发布在造/在学/在读/在听/在看/在想，不是行为追踪。
  - 迁移 `supabase/migrations/20261010000017_now_entries.sql`（只新增，不改历史迁移）：`now_entries` 表，
    `is_public` **默认 false（私人）**，RLS 策略与 `assets`/`gallery_items` 一致。
  - 后端 `backend/src/lib/nowUrl.js`（纯函数：`isAllowedNowUrl` / `normalizeNowUrl` / `nowGuestFilters` / `NOW_KINDS`）
    与 `backend/src/routes/now.js`（GET 访客只读公开、写操作 `requireAdmin` 且仅本人）。
  - 前端 `frontend/src/routes/Now.jsx` + `frontend/src/styles/now-settings.css`（`.now-*`），管理员才有增改删入口。
- 新增 `/settings` 设置与安全中心：账号（邮箱/角色/套餐/ID 只读，显示名与用户名可改）、外观（保留 `ThemeCustomizer`）、
  安全（官方重置邮件 + 退出登录二次确认 + 静态提醒）、数据（`/backup` 入口 + 导出备份）、管理员快捷入口。
  - 后端 `PATCH /api/me`（`backend/src/routes/me.js#updateMe` + 纯函数 `buildProfilePatch`）：
    只开放 `display_name`/`avatar_path`/`username`；`role`/`plan`/`plan_expires_at`/`is_disabled`/`id` 出现即 **422**；访客 403。
- 访客白名单 `backend/src/lib/publicScope.js` 加入 `now`（只读 GET；写方法天然拒绝）。
- 前端 `api.js` 新增 `listNow/createNow/updateNow/deleteNow` 与 `getMe/updateMe`；`routes.js`/`app.jsx` 接入 `/now`；`Layout.jsx` 把「此刻」加进「更多」下拉。
- 文档：新增 `docs/now-settings.md`；`docs/api.md` 新增 `Now` 与 `PATCH /api/me` 两节。

**为什么**
- 「此刻」是公开内容，默认必须私人：默认公开等于「添加即外泄」，站长漏勾一次私人状态就被访客读到。
- Worker 用 service_role 直连 PostgREST，RLS 不替它过滤，所以访客读必须在**查询层**显式叠加 `is_public=eq.true`。
- 设置页要能改安全字段，但绝不能自提权：特权字段明确 422（不是静默忽略），并由迁移 0014 在数据库层再收窄一次。
- 密码重置走 Supabase 官方邮件，前端不接收/不发送明文密码；设置页不显示任何 token/密钥。

**验证命令与结果**（本机无 Supabase/R2，只有离线单测 + 前端构建）
- `cd backend && npm run test:unit` → **85 项：85 过 / 0 失败**（含新增「UNIT · 此刻页与设置安全中心」7 项，CONTRACT 全过）。
- `cd frontend && npm run build` → **vite build 成功**（`✓ built in 36.62s`）。
  - 注：本仓库无 `node_modules`，为遵守「禁止安装依赖」的硬约束，构建时把同 lockfile 的兄弟目录
    `dora-improvement-docs/frontend/node_modules` **只读软链**到本仓库 `frontend/node_modules`（未执行任何安装，未改动 lockfile）。
- `node scripts/check-secrets.mjs` / `--history`、`git diff --check` 结果见交付汇报。

### 2.30 此刻页/设置页 自审修复 + Context 解构护栏（2026-10-11）

2.29 交付后自审，发现并修掉 3 个真实缺陷（`vite build` 只做编译，不做运行时检查，抓不到这类问题）：

1. **设置页主题按钮整页崩溃（高危）**：`Settings.jsx` 误把 `theme` / `toggleTheme` 从 `useAuth()` 解构，
   但它们属于 `useTheme()`。后果是按钮文案恒错，且点击 `toggleTheme()` 抛 `TypeError` 直接崩页。
   修复：改为 `const { theme, toggleTheme } = useTheme(); const { profile, isAdmin, signOut } = useAuth();`。
2. **保存账号信息平白 422**：邮箱注册的账号 `username` 可能是 null，空串提交会被后端 3..60 规则拒绝。
   修复：`username` 为空时不提交该字段，只提交 `display_name`。
3. **此刻页编辑表单残留旧值**：从「编辑 A」直接切到「编辑 B」时组件未重挂载，表单仍显示 A 的值。
   修复：给编辑表单加 `key={editing.id}` 强制重建。

**新增护栏（防同类问题再次发生）**：`backend/tests/run.mjs` 的 CONTRACT 段新增
「useAuth()/useTheme() 解构字段都在 Provider 暴露范围内」用例——静态解析两个 Provider 真正暴露的键，
再扫描全部 `.jsx` 的解构，越界即失败。已用「把 bug 放回去」验证护栏确实会变红（86 项 → 85 过 / 1 失败）。

**验证**：`cd backend && npm run test:unit` → **86 项：86 过 / 0 失败**；
`cd frontend && npm run build` → **✓ built in 26.61s**。

---

## 2.31 导航精简 + 图片展灯箱定位修复 + 展览数据重建（2026-10-11，分支 feat/now-settings）

用户反馈三件事，本轮一次性处理完并**已部署**（后端 Worker 与前端 Pages 都已上线）。

### 1. 主导航调整（`frontend/src/components/Layout.jsx`）

- 「收藏」从「更多」下拉**提升为一级导航**（`PRIMARY` 末尾追加 `['/favorites', '收藏']`）。
- 「分类」「标签」从导航里**移除**：博客页已自带分类/标签视图，独立入口冗余。
  **路由本身保留**（`/categories`、`/tags` 仍可直接访问），只是不再出现在菜单里。
- 「更多」下拉现在只剩「此刻」（管理员另见「源状态」）。
- 首页 `Home.jsx` 的快捷入口卡片**未改动**（该文件不在本任务写权限内）。

### 2. 图片展灯箱「点图先滚到底」+ 翻页延迟（`frontend/src/routes/Gallery.jsx`）

根因有两条，都跟**动画残留的 `transform`** 有关：

1. `global.css` 的 `.app-main > * { animation: fade-up … both }` 在动画结束后仍保留
   `transform: translateY(0)`（`both` = 保留结束帧）。**祖先一旦有 transform，`position: fixed`
   就改为相对该祖先定位而不是视口**，于是灯箱被撑到整页高度、打开时画面先滚到最低。
   修复：灯箱与策展抽屉改用 `createPortal(..., document.body)`（与既有 `BlogDock.jsx` 同款做法）。
2. 打开时 `closeRef.current.focus()` 会触发浏览器的 `scrollIntoView`，同样把页面滚走。
   修复：改为 `boxRef.current.focus({ preventScroll: true })`（聚焦灯箱容器本身，Esc / 方向键照常可用）。
3. `global.css` 的 `html { scroll-behavior: smooth }` 会把关闭时的归位 `scrollTo` 变成一段缓慢滚动动画。
   修复：打开时临时把 `documentElement.style.scrollBehavior` 切成 `auto`，关闭时瞬时归位后再还原。

翻页「要等一下才出图」的修复：进入灯箱后**预加载相邻 ±2 张**（`new Image()`，只预取紧邻，不全量），
翻页直接从缓存出图。配合后端 `/api/assets/:id` 的 `Cache-Control: public, max-age=31536000, immutable`，
二次浏览基本零等待。

上一张 / 下一张按钮观感同步改好（`frontend/src/styles/gallery-timeline.css` 的 `.gl-lb-nav` / `.gl-lb-close`）：
加大到 42px（触屏 46px）、半透明深底 + 细描边 + 阴影、`:active` 按下立即缩放反馈、
`:focus-visible` 键盘焦点环，不再依赖 hover 才看得出是按钮。

### 3. 展览数据重建（一次性数据修复，不是代码）

- 用户本机 `C:\Users\x1078\Pictures\图片1` 共 50 张 / 279MB，全部预处理为 **WebP、最长边 2560px**（50 个文件 / 9.7MB）。
- 去掉 2 组重复后，**48 张**上传到 `assets` 表并**全部加入公开展览**（`is_public=true`）。
- R2 桶 `knowledge-base-assets` 清理：删除旧 `Picture/` 7 张 + `Picture/`、`video/` 两个空目录；
  现只剩 48 个规范 `assets/…` 对象（9.3MB）。
- **踩坑记录**：R2 列表 API 默认只返回 20 个，第一次清理时**没翻页**导致误删 11 张新图；
  已全部恢复并逐条复验。**教训：列 R2 对象必须用 `result_info.cursor` 翻页到底。**

### 验证

- `cd backend && npm run test:unit` → **87 项：87 过 / 0 失败**。
- `cd frontend && npm run build` → **✓ built**（带 `VITE_API_BASE_URL` / `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`）。
- 部署：`wrangler pages deploy dist --project-name=knowledge-base --branch=main`（前端）；
  线上 `https://dora.xuguochen.de5.net/` 引用的 `index` / `Gallery` chunk 与本地构建一致。
- 访客视角 `GET /api/gallery?limit=100` → **count=48，48 条全部 `is_public=true`**，
  逐条拉取资源 URL **48/48 返回 200 `image/webp`**。
- 注：本仓库无 `node_modules`，构建时把同 lockfile 的兄弟目录 `dora-improvement-docs/frontend/node_modules`
  **只读软链**进来，构建完 `unlink` 移除（未执行任何安装，未改动 lockfile）。

---

## 2.32 GitHub 收藏全量同步 + AI 中文解读加严（2026-10-11，分支 feat/now-settings）

用户要求：把 GitHub 收藏**完整同步**过来（含左侧「应用分类」+「编程语言」两级筛选），
并且 AI 解读必须**用中文**且**不低于 50 个字**。**代码与数据都已上线**。

### 结论先说：功能早就写好了，坏的是「数据没同步完」+「解读质量没下限」

`/github` 页（`frontend/src/routes/Github.jsx`）与后端 `lib/githubStars.js` / `lib/githubAi.js`
在 2026-10-09 就已经是用户截图里的样子：左栏「应用分类」+ 下方「编程语言」，
右侧搜索卡 / 工具条 / 仓库卡片列表。这轮**没有重写界面**，只修了数据与解读质量。

### 1. GitHub 令牌缺失 → 同步一直失败（根因）

线上 Worker 没有配 `GITHUB_TOKEN`，GitHub 匿名接口**每小时每 IP 只有 60 次**，
而一次完整同步要拉 14 页，于是必然中途 403。
修复：用站长本机已登录的 `gh` 令牌 `wrangler secret put GITHUB_TOKEN`（5000 次/小时）。
之后完整同步 **1342 个仓库**（此前库里只有 638 个，只同步了一半）。

### 2. AI 解读加严：中文 + 不少于 50 个字

- 提示词（`buildPrompt`）明确写「全文必须使用**简体中文**」「summary **不少于 50 个字**」。
- `parseAnswer` 增加**硬校验**：汉字数 < 50 直接判失败，不写库。
- 新增 `AI_VERSION`（=2）与 `MIN_ZH`（=50）。`metadata.ai.ai_version` 低于当前版本的行
  会被 `analyzePending` 自动重新解读，所以以后改提示词只要把 `AI_VERSION` +1 即可全量重做。
- `analyzeOne` 改为**最多重试 3 次**并逐次提高 `temperature`：小模型偶尔只写 40 多字，
  重试一次通常就达标，比整条判失败省额度。

### 3. 两个真实踩坑（都已修 + 加了回归测试）

1. **`8006 Invalid data for body`**：`awesome-mcp-servers`、`L1B3RT4S` 等仓库的 README 含
   控制字符 / 零宽字符 / 异常 Unicode，塞进 Workers AI 请求体会破坏 JSON 序列化。
   新增 `cleanText` / `sanitizeReadme` 统一清洗（保留 `\t`、`\n`，其余不可见字符删掉），
   提示词里拼接的简介 / 话题也一并清洗。
2. **「不是中文」误判**：最初还加了一条「英文字符占比过半就算不是中文」的规则，
   结果 `Kong/insomnia` 这类仓库（summary 里 API / GraphQL / gRPC 术语密集）被误判，
   失败 3 次后被永久跳过。**已删掉这条规则**，只保留汉字数下限。

### 4. 一次性数据修复（不是代码）

- 把 333 条**已达标**的旧解读直接标记为 `ai_version=2`，避免重复消耗 AI 额度。
- 把 47 条「失败 3 次已跳过」的记录清零 `ai_tries`，让它们重新排队。

### 验证

- `cd backend && npm run test:unit` → **91 项：91 过 / 0 失败**（新增 4 项 GitHub AI 用例；
  已用「把 bug 放回去」验证护栏会变红：91 项 → 89 过 / 2 失败）。
- 线上数据：`GET /api/github` → **1342 个仓库，1342 个全部已解读，0 个未解读**；
  summary 汉字数 **min 50 / 中位 66 / max 114**，不足 50 字的 **0 条**。
- 左栏数据：**48 种编程语言**、13 个应用分类（开发工具 1288、AI与机器学习 970、Web应用 802…）。
- 后端 Worker 已部署（Version `85bcf77c-647f-4387-bcab-c542a5ac4197`）。

### 遗留

- `GITHUB_TOKEN` 用的是站长本机 `gh` 的 OAuth 令牌；**令牌轮换后需重新 `wrangler secret put`**。
- 定时同步 `*/5 2-3 * * *` 仍会每天自动跑一次，此后增量同步不会再受限流影响。

---

## 2.33 「此刻」改版为「碎念」+ 去掉「更多」下拉（2026-10-11，分支 feat/now-settings）

用户要求：把「此刻」改成**朋友圈那种碎念**、去掉顶栏的「更多」按钮、把它放进一级导航。
**代码、数据库、前后端都已上线。**

### 0. 先说一个必须先修的严重问题：「此刻」页从来就没能用过

`/api/now` 一直返回 404：**线上数据库根本没有 `now_entries` 表**。
迁移 `20261010000017_now_entries.sql` 只写了文件，从未在线上执行
（`supabase_migrations.schema_migrations` 最后一条是 `20261010000016`）。
所以这一轮不是「改样式」，而是先把数据结构补上。

### 1. 数据模型换新：`moments` + `moment_assets`

- 新迁移 `20261010000018_moments.sql`（**已应用到线上并登记进 `schema_migrations`**）。
- `moments`：`content`（正文，必填）+ `is_public`（默认 **false**）+ 时间戳。
- `moment_assets`：`(moment_id, asset_id, user_id, sort_order)`，主键 `(moment_id, asset_id)`；
  **复合外键** `(user_id, asset_id) -> assets(user_id, id)` 在数据库层强制「配图与碎念同 owner」
  （与 `gallery_items` 同一套做法）。
- 旧的 `20261010000017_now_entries.sql` 已删除（六类 kind 结构不适合朋友圈，且从未上线）。
- 因 `create policy` 不是幂等的，迁移跑完后手工把版本号登记进 `schema_migrations`，
  避免以后 CI 的 `supabase db push` 重复执行报错。

### 2. 后端：`routes/now.js` → `routes/moments.js`

- 接口：`GET/POST /api/moments`、`PATCH/DELETE /api/moments/:id`（旧 `/api/now` 已下线）。
- 权限沿用三层模型：访客只读 `is_public=eq.true`；写操作 `requireAdmin` 且 `id`+`user_id` 双限定。
- 响应白名单 `id, content, is_public, created_at, updated_at` + `images[]`，
  **绝不回传 `user_id`**，`images[]` 不含 `object_key`/`sha256`/`original_name`。
- 配图三道校验：应用层 `assertOwnAssets()` 逐条验归属（缺失即 404）→ 数据库复合外键 → 读取层
  `decorate()` 显式带 `user_id` 过滤；`normalizeAssetIds()` 去重保序、上限 9 张。
- **重构**：把通用 URL 安全校验抽成 `backend/src/lib/safeUrl.js`（`isSafeUrl`/`normalizeSafeUrl`），
  `me.js` 的 `avatar_path` 与碎念共用同一份实现（原先在 `nowUrl.js`，已删除）。
- `publicScope.js`：白名单 `now` → `moments`，新增 `momentGuestFilters()` 与 `MAX_MOMENT_ASSETS`。

### 3. 前端：朋友圈式时间流 + 导航精简

- 新页面 `frontend/src/routes/Moments.jsx`（旧 `Now.jsx` 已删除）：
  单列时间流，头像 + 昵称 + 相对时间 + 正文 + 九宫格配图（1 张单图 / 2–4 张两列 / 5–9 张三列）；
  点图进灯箱（复用图片展那套 portal + `preventScroll` 做法，不再「点图先滚到底」）。
- 发布框：文本框 + 图片选择（**上传新图**或**从已有素材挑**，复用 `POST /api/assets`）+ 公开开关。
  公开开关**默认勾选**（朋友圈直觉是「发了就是给大家看」），但后端/数据库默认值仍是 `false`。
- `Layout.jsx`：**删除「更多」下拉**（当时它只剩一项）；「碎念」升为一级导航（第 9 项）；
  管理员专属的「源状态」移入**头像菜单**（普通访客本来也看不到它）。
- `styles/now-settings.css`：`.now-*` 旧样式整体替换为 `.mo-*`。

### 4. 自审发现并修掉一个真实 bug

`useAuth()` 里的 `user` 是 **Supabase 会话对象**（`session.user`），只有 email/id 等 auth 字段；
`display_name` / `avatar_path` / `username` / `role` / `plan` 都在 **`profile`** 上。
我最初写成 `user?.displayName`，线上会恒为空（昵称永远显示「站长」、头像退化成字母）。
已改为从 `profile` 取，并**新增护栏测试**：「资料字段必须取 profile，不能取 `useAuth().user`」
（已用「把 bug 放回去」验证会变红：92 项 → 91 过 / 1 失败）。

### 验证

- `cd backend && npm run test:unit` → **92 项：92 过 / 0 失败**
  （新增 4 项碎念用例 + 1 项资料字段护栏；并用注入回归验证过 2 个护栏会变红）。
- 线上端到端（真实 Supabase + R2 + Worker）跑了 10 组请求，全部符合预期：
  发布公开碎念 / 配图 / 访客可见 / 改成私人后访客不可见而管理员可见 / 访客不能发布（401）/
  空正文 422 / 他人素材 404 / 响应不含 `user_id` / 图片 200 `image/webp`。
- 部署：后端 Worker `81e37f75`（碎念接口）+ `b6f705ac`… 最终 `81e37f75`；
  前端 Pages `knowledge-base`，线上 `index` / `Moments` chunk 与本地构建一致，`/moments` 200。
- 验收用的自测碎念已删除，线上碎念当前 0 条（等站长自己发）。

## 2.34 图谱拆分 + GitHub 收藏公开 + teldrive 清理（2026-10-11，分支 feat/now-settings）

### 1. GitHub 收藏页「什么都不显示」的根因

不是前端问题：1342 条 `resources(type=github)` 的 **`is_public` 全是 `false`**，
访客视角 `GET /api/github` 恒返回 `[]`（`Github.jsx` 与 CSS 都正常）。

- `backend/src/lib/githubStars.js`：同步时 `is_public: false` → **`true`**（Star 列表本来就是公开内容），
  并在注释里说明「想单独隐藏某个仓库，改数据里的 `is_public` 即可」。
- 线上数据已直接批量改为公开（HTTP 204），复核 `is_public=eq.true` = 1341。
- 验证：访客视角 `GET /api/github` 返回 1341 条。

### 2. 手动取消收藏的仓库要能删掉

用户已在 GitHub 取消收藏 `tgdrive/teldrive`，但 Dora 里还在（同步删除只在定时任务跑到时才生效）。
已按用户要求直接删除该行（`favorites` / `post_resources` / `resource_tags` 里都没有引用）。
时间轴是**动态聚合**（`GET /api/timeline` 现算），删掉资源后自动不再出现，无需另删。

### 3. 「更多」下拉 → 「图谱」一级入口 + 两个公开星图

顶栏最终形态（PRIMARY 共 10 项，不再有「更多」下拉）：
`NewsNow · GitHub · 博客 · 音乐 · 影视 · 图片展 · 时间轴 · 碎念 · 图谱 · 收藏`。
「图谱」指向 `/graph/blog`，两种图谱在页面内用标签切换。

- 新增 `backend/src/routes/graph.js` 的两个**公开**接口（访客可读，均叠加 `guestPostFilters` /
  `guestResourceFilters`）：
  - `GET /api/graph/blog` —— 分类 / 标签（枢纽）+ 已发布公开文章（星点）
  - `GET /api/graph/repos` —— 编程语言 / AI 应用分类（枢纽）+ 公开 GitHub 收藏（星点，1341 个）
- 新增前端 `frontend/src/components/StarMap.jsx`（Canvas 星图）与
  `frontend/src/routes/GraphHub.jsx`（页面）+ `frontend/src/styles/starmap.css`。
- 路由：`/graph/blog`、`/graph/repos`（都挂在 `ProtectedRoute guest` 下）。
  旧的 `/graph` 站长控制台**保留但不再出现在顶栏**（聚合 AI 解读进度等私有数据）。

### 4. 星图为什么不是 D3 力导向（重要设计取舍）

用户明确表示：**不要求「连线 = 真实关系」，只要板块清楚、光点流动、够炫就行**。
所以这一版**故意放弃了精确匹配**：

- 布局是「星区」：每个分类 / 语言 / 应用分类占一个扇形角度，星区内的点同色、半径带抖动，
  一眼就能看出板块（`StarMap.jsx#buildScene`）。
- **连线是随机的但稳定**：用节点下标做种子（`rnd()`），62% 连同星区、26% 连相邻星区、
  12% 拉一条贯穿全图的长弧；每个星点约 2~4 条线。同一个点每次刷新连的还是那几条，画面不抖。
- 性能：坐标一次算完，连线 / 星点**按颜色分桶**（一色一条路径、一次描边），
  1341 点 + 2500 线仍是 60fps；悬停时暂停自转并高亮「我 + 我连着的点」。
- 交互：滚轮缩放（以光标为锚点）、拖拽平移、双击复位、悬停提示框、点击枢纽=筛选 / 点击星点=跳转。

### 5. 背景跟随主题色（用户要求：不要固定暗色，也不要影响导航栏）

- `starmap.css` 全部改用主题变量（`--bg-subtle` / `--bg-elevated` / `--border` / `--primary`），
  浅色与素雅两套主题都实测过。
- 画布上的文字颜色从 CSS 变量读（`themeInk`），浅色主题下是深字 + 浅描边。
- `graph-console.css` 里 `.app-shell.page-dark` 原来会**连顶栏一起改暗**（用户明确反对），
  已删掉整段 header / menu-panel 覆盖，只留背景色；`Layout.jsx` 也只对**精确等于 `/graph`** 的
  路径加 `page-dark`（`/graph/blog`、`/graph/repos` 不加）。

### 6. 配色：每个星区一个颜色

`StarMap.jsx` 导出 `SECTOR_COLORS` / `sectorColor(i, inner)`：外圈第 i 个取第 i 色、
内圈错开 5 色。侧栏色点用同一个函数取色，保证「侧栏看到的颜色 = 画布上的颜色」。
`MAX_SECTORS`(14) / `MAX_INNER`(8) 限制星区数量，超出的点归入画布上的「其他」星区，
侧栏也只列画布上真正画出来的那些。

### 验证

- `cd backend && npm run test:unit` → **93 项：93 过 / 0 失败**
- 线上端到端：`GET /api/graph/blog`（358 节点 / 1022 边）、`GET /api/graph/repos`
  （1362 节点 / 2494 边）访客视角均 200；`GET /api/github` 1341 条。
- 无头 Chrome 截图核对：博客图谱 / 开源项目图谱 / 素雅主题 / 414px 窄屏，四种情况都正常。
- 部署：后端 Worker `4782c046`（新增两个图谱接口）；前端 Pages `knowledge-base`。

---

## 2.35 主题第三套 + 设置入口 + 登录/注册页 + 图片上传 + 碎念附件 + 收藏改版 + 图谱文字（2026-10-11，分支 feat/now-settings）

用户一次提了 7 件事，本轮全部落地并**已部署**（后端 Worker `8216fb3d`；前端 Pages `knowledge-base`）。

### 1. 第三套主题「天青」+ 显示名去掉「主题」二字 + 顶栏设置入口

- `frontend/src/styles/global.css` 新增 `[data-theme='celadon']`（青绿主色 `#0f9b8e` + 冷白底）。
- `frontend/src/lib/theme.jsx`：导出 `MODES`（纯净 / 素雅 / 天青）作为显示名**唯一事实来源**，
  三套循环切换；`ThemeToggle.jsx` / `ThemeCustomizer.jsx` / `Settings.jsx` 全部改用 `modeLabel()`，
  不再硬编码「白天」「天青绿」。
- `backend/src/routes/preferences.js`：`celadon` 加入 mode 白名单。
- **顶栏「设置」入口**（`Layout.jsx`）：主题按钮右侧常驻一枚齿轮 —— 已登录 → `/settings`，
  访客 → `/login`；访客右上角另有一个明确的「登录」按钮（原先只有齿轮，入口太隐蔽）。

### 2. 登录 / 注册页重做（`/login`）

- 两个标签页：**站长登录**（邮箱 + 密码）与**新用户注册**（邮箱 + 密码 + 确认密码）。
- 注册走 Supabase Auth；**新账号一律是普通用户**（数据库触发器 `handle_new_user()` 决定 `role='user'`），
  注册者拿不到站长权限。已开邮箱验证时会提示「去邮箱确认」，未开则直接登录。
- 常见英文报错翻成中文（密码错 / 未验证 / 邮箱已注册 / 密码太短）。
- 已登录时不再显示表单，改为「已登录 + 当前账号 + 进入设置 / 退出登录」。
- 样式集中在 `now-settings.css` 的 `.auth-*`，沿用设置页 `.set-card` 卡片观感。

### 3. 图片上传（管理员，图片展策展抽屉直接上传）

- `frontend/src/routes/Gallery.jsx`：策展抽屉新增「**上传新图片**」区块 ——
  选本地图片 → `uploadAsset()` 传 R2 → 自动 `createGalleryItem`（默认公开）→ 刷新展览。
  多选时逐张上传并显示进度，部分失败也把已成功的显示出来。
- 后端无需改动（复用已有 `POST /api/assets`）。

### 4. 碎念文件附件（PDF / Word / Excel / PPT / 文本）

- 新迁移 `supabase/migrations/20261010000019_moment_files.sql`：新增 `files` + `moment_files`
  两张表（**已应用并登记进 `schema_migrations`**）。图片仍走 `assets`，文档另立 `files`，
  避免 PDF 混进图片展 / 博客封面破坏缩略图。
- 后端新增 `backend/src/lib/fileType.js`（**魔数 + 声明双校验**：PDF / doc / docx / xls / xlsx /
  ppt / pptx / txt / csv / md；裸 zip、HTML、二进制伪装一律 415）与 `backend/src/routes/files.js`
  （上传 / 列表 / 公开读 / 删除，单个上限 20MB）。
- 碎念接口新增 `file_ids`：`moments.js` 的 `replaceFileLinks()` 让**附件公开状态跟随碎念**——
  公开碎念的附件自动 `is_public=true`，改回私人 / 移出关联时自动收回。
- 前端 `Moments.jsx`：编辑器新增「上传附件 / 从附件库选」，条目里以「类型徽标 + 文件名 + 大小 + 下载」
  展示；编辑时回填已有配图与附件（原先编辑会清空配图，一并修掉）。
- `publicScope.js`：`files` 加入访客只读白名单（**仅 `GET /api/files/:id` 且只放行 `is_public=true`**；
  列表接口仍 `requireAdmin`，不会泄露私人附件清单）。

### 5. 收藏页改版为「音乐 + 影视」

- `Favorites.jsx` 重写：按 **音乐 / 影视 / 其它** 分组，封面网格（音乐 1:1、影视 2:3），
  顶部标签筛选；空态给「逛音乐 / 逛影视」入口。
- 新增 `frontend/src/components/FavoriteButton.jsx`，接入 `MusicView.jsx` 与 `MovieView.jsx`
  的操作区（未登录不渲染；点击即加 / 取消收藏）。
- 后端 `favorites.js` 的 `decorate()` 补 `cover_path` / `metadata`，供收藏页显示封面。

### 6. 图谱文字「发虚」修复（用户反馈）

- `StarMap.jsx`：枢纽标签从「描边光晕」改成**实底药丸 + 左侧色条**（底色不透明、字色取主题正文色），
  并新增**纵向避让**（先算全部药丸矩形，同侧重叠时往下推），不再互相压住。
- `starmap.css`：侧栏 chip 字号 11 → 12px、色点 7 → 8px、面板标题加大，读数更清楚。

### 验证

- `cd backend && npm run test:unit` → **97 项：97 过 / 0 失败**（新增 4 项文档附件类型用例）。
- 线上端到端（站长 token）：上传 PDF → 私人时匿名读 404 / 匿名列附件 403 → 发布公开碎念 →
  匿名读到 1 条 + 附件 → 附件匿名读 200 `application/pdf` → 改回私人 → 附件自动收回 404 →
  删除碎念 + 附件 → 列表清空。全链路符合预期。
- R2 与数据库一致性核对：R2 48 个对象、`assets` 48 行，差集为空（无孤儿、无丢失）。
- 无头 Chrome 截图核对：登录页、管理员图片展 + 策展抽屉、收藏页、碎念编辑器、博客图谱、
  开源项目图谱、390px 移动端（文档宽度 = 视口宽度，无横向溢出）。

---

## 2026-10-11（第三轮）· 图书库 + 图展/导航/主题/图谱收尾

后端 `bed61ced-91c8-4d5c-ad44-8d2e570d0008`，前端 Pages `knowledge-base`（main）。

### 1. 图书库（全新一级导航「图书」/books）

- 迁移 `supabase/migrations/20261011000020_books.sql`（`books` 表，**已应用**）。
- 后端 `backend/src/lib/bookType.js`（电子书类型嗅探 / 上限 1GB / 分片 25MB）+
  `backend/src/routes/books.js`：**R2 分片上传**（create → uploadPart → complete / abort）+
  **Range 透传读取**（PDF.js 按需拉字节，不整本进 Worker 内存）+ 列表 / 改 / 删。
  路由顺序：`/api/books/multipart*` 排在 `/api/books/:id` 之前。
- 前端 `frontend/src/routes/Books.jsx` + `styles/books.css`：**仿 Koodo Reader 布局**——
  左侧栏（全部图书 / 我的收藏 / 阅读历史 / 我的书架）、顶栏（搜索 / 排序 / 刷新 / 导入图书）、
  2:3 封面网格、卡片「…」菜单、多选底部操作条。
- 阅读器三条路：PDF 用浏览器原生查看器（后端 Range）、EPUB 走 `lib/epub.js`
  （零依赖 ZIP + OPF 解析）分章节渲染、TXT 直接渲染；其它格式提供下载。
- `lib/zipReader.js`（零依赖最小 ZIP 解析）+ `lib/epub.js`。
- **已上传用户本地 24 本图书（2.4GB，含 772MB 的《斯图尔特微积分》）全部成功**。

### 2. 顶栏与主题

- 「图片展」→「**图展**」；新增一级导航「**图书**」（位于图展后）。
- **移除齿轮「设置」按钮**；未登录时在主题按钮右侧放**与主题按钮同款胶囊**的「登录」按钮
  （图标 + 文字，`Icon name="login"`），已登录则隐藏。
- 三套主题显示名去掉「主题」二字：**纯净 / 素雅 / 天青**（新增天青，青绿主色）。

### 3. 收藏页 / 时间轴 / 播放器 / GitHub 文字

- 收藏页 `/favorites` 改为**对访客开放**（不再跳登录页）：未登录渲染友好空态；
  401 / 403 都按「请先登录」处理（原先只判 403，访客会看到「加载失败」）。
- 时间轴去掉「**全部**」标签，默认落在博客；顺序：博客 / GitHub / 图片 / 音乐 / 影视；
  **音乐与影视改为观看 / 收听历史**（后端按 `user_progress.updated_at` 聚合，只保留公开资源）。
- 影视播放进度条加粗到 6px 并用高亮色标出已播放部分（`--watch-p`）。
- GitHub 页正文/元信息提高对比度、加抗锯齿，解决「文字发虚」。

### 4. 图谱（博客图谱 + 开源项目图谱）

- 「图谱」为一级导航（指向 `/graph/blog`），两图在页面内用标签切换。
- **搜索框从顶部 HUD 移到右侧栏最上方**，正对下方分类 / 标签 / 列表。
- 画布**跟随站点主题色**（不再固定暗色），节点用高饱和多彩配色（与主题色区分开）。

### 5. 图展灯箱修复

- 灯箱改用 `createPortal` 挂到 `document.body`（祖先的 `transform` 会让 `position: fixed`
  相对整页定位，表现为「点图先滚到底再显示」）。
- 关闭按钮不再抢焦点（`focus({preventScroll:true})` 聚焦容器）；关闭时瞬时归位
  （临时把 `scroll-behavior` 切回 `auto`）。
- **预加载相邻 ±2 张**，翻页不再等图。

### 6. 修复：图书 CORS

- `GET /api/books/:id` 补 `Access-Control-Allow-Origin`（按 `CORS_ORIGINS` 白名单）
  与 `Access-Control-Expose-Headers: Content-Range, Content-Length, ...`。
  否则前端 `fetch()` 取 EPUB / TXT 字节会被浏览器拦掉（报 `Failed to fetch`）。

### 验证

- `cd backend && npm run test:unit` → **106 项：106 过 / 0 失败**。
- 图书分片上传端到端：真实 EPUB（10MB）create → part → complete → 入库；
  Range 读取返回 `206` + 正确 `Content-Range`。
- 24 本图书全部上传成功；R2 与数据库一致：R2 72 对象 = books 24 + assets 48（files 0，无孤儿）。
- 清理 R2 测试探针对象 `probe/test.txt`、`probe/big.epub`、`probe/huge.pdf`。
- 无头 Chrome + CDP 截图核对：图书页（桌面 / 移动）、图书阅读器（EPUB 分章）、收藏页空态、
  时间轴、博客图谱、开源项目图谱、GitHub 页、图展。
- `node scripts/check-secrets.mjs` → 未发现凭据泄漏；`git diff --check` 干净。

---

## 2026-10-11（第四轮）· 登录按钮对齐 + 时间轴博客修复 + 切页提速

后端 `9e9092b1-d95c-4d08-be58-07e666d6d90c`，前端 Pages `knowledge-base`（main）。

### 1. 登录按钮与主题按钮尺寸不一致（用户反馈）

- 根因：顶栏的圆形图标按钮规则 `.app-header > a[title]`（38×38 圆形、字号 16）
  把同样带 `title` 的 `.login-link` 一起命中了，`width/height/border-radius/font-size` 全被覆盖，
  所以登录按钮实际是 38×38 的圆点、比主题按钮高一圈。
- 修法：规则加 `:not(.login-link)` 排除登录按钮（hover 规则同样处理）；
  `.theme-toggle` / `.login-link` 的尺寸逐项对齐（36 高、左右 12、字号 13、图标 16）。
- 验证（CDP 实测）：两按钮均 74×36、顶边均 13.5px。

### 2. 时间轴「博客」标签空白（用户反馈）

- 根因：**GitHub 一次同步会把上千条收藏写成同一秒的 `created_at`**，
  它们按时间倒序排在最前，把博客挤到几十页之后；前端又是「先取 20 条再按类型过滤」，
  所以「博客」标签一直是空的（`/api/timeline` 首屏 30 条全是 github）。
- 修法：
  - 后端 `/api/timeline` 新增 `?type=post|github|gallery|music|movie`：**只查对应那张表**
    （单类型顺带快很多）；不传 `type` 仍是旧的「全部合并」行为。
  - `mergeTimeline` 支持 `types` 白名单，双保险。
  - 前端 `Timeline.jsx` 改为**按标签单独请求**，并**按标签分别缓存**
    （切回来瞬时出内容，不再「切一次等一次」）。
- 验证：`/api/timeline?type=post` 返回 24 篇博客（共 315 篇，可翻页）；
  切 GitHub 再切回博客，0.3s 内即出内容。

### 3. 切页面启动速度优化

- 实测瓶颈：Worker → Supabase 往返常有 **1.5–6s**（网络抖动时更久），
  且同一页面来回切换会反复请求同一接口。
- `frontend/src/lib/api.js` 新增：
  - **GET 读缓存**（内存、60s TTL、LRU 上限 120 条，只缓存成功结果）；
  - **并发去重**：同一 URL 的并发请求共享同一个 promise；
  - **写后失效**：任何写操作成功即按路径前缀清掉相关 GET 缓存；
  - 导出 `clearApiCache(match)` 供页面手动清（图书「刷新」按钮、GitHub「同步」已接入）。
- 效果：标签间来回切换、页面重访基本瞬时（命中缓存不再打网络）。

### 验证

- `cd backend && npm run test:unit` → **106 项：106 过 / 0 失败**。
- 无头 Chrome + CDP 实测：顶栏两按钮尺寸一致、时间轴博客有内容且切标签瞬时、
  缓存命中生效。
- `node scripts/check-secrets.mjs` 无泄漏；`git diff --check` 干净。

---

## 2026-10-11（第五轮）· 首页 Atlas 改版 + 全站字体修复

前端 Pages `knowledge-base`（main）。本轮无后端改动。

### 1. 首页改版（参考图：`docs/refs/ai-history-atlas.jpg`）

用户要求按「编辑式图谱 / Atlas」信息图的版式重做未登录首页，并**去掉「开始浏览」「了解功能」两个按钮**。

- `frontend/src/routes/Home.jsx`：未登录落地页重写。
- `frontend/src/styles/home-landing.css`（**新增**，732 行，全部 `ld-` 前缀，不碰 global.css）。
- 结构：报头（拉丁 kicker + 超大衬线中文标题 + 年份）→ 三栏主体
  （左 `01–06` 模块索引 / 中**手写 SVG 同心环径向图** / 右能力清单）→
  底部两块图表面板（`01 / 模块条目分布`、`02 / 能力主题构成`）→ 单个克制 CTA。
- 径向图：一环 = 一个模块，环上按条目数撒点（每环 ≤60），外圈编辑刻度尺，
  入场按环依次淡入；`prefers-reduced-motion` 下关闭动画。纯 SVG + CSS，未引第三方库。
- **内容与现状对齐**（这是重点）：
  - **删掉「学习视频库」**——该功能 2026-10-09 已下线（见 `docs/removed-features.md`）。
  - 主模块改为真实的一级导航：博客 / GitHub 收藏 / 图展 / 图书 / 音乐 / 影视。
  - 能力：时间轴 / 碎念 / 图谱（博客 + 开源）/ 收藏 / 检索 / 备份。
  - 主题文案改为「三套主题配色：纯净 / 素雅 / 天青」（原文是过时的「浅色 / 暗色」）。
- 数字来自公开只读接口（`Promise.allSettled`，失败不白屏），加载中显示 `—`。
- 已登录 Dashboard：磁贴补上**图展 / 图书**（原只有 4 项），快捷入口 `/graph` → `/graph/blog`，
  删掉已无导航入口的 `/tags`、`/categories`，换成 `/timeline`、`/moments`。

### 2. 全站字体修复（用户反馈「这个字体很难看」）

**根因**：等宽字体栈（`ui-monospace` / `JetBrains Mono` / `Consolas`）**都没有汉字**，
中文会回退到 Windows 的 **NSimSun（新宋体）**——那是**点阵宋体**，在 11–13px 下锯齿明显。
凡是「中文 + mono」的地方都会显脏，最严重的是图谱页（整个 `.sm` 都是 mono）。

CDP 实测（`CSS.getPlatformFontsForNode`）修复前后：

| 位置 | 修复前 | 修复后 |
| --- | --- | --- |
| `.sm-head-text p`（图谱副标题） | NSimSun 39 字形 | Microsoft YaHei |
| `.sm-chip`（分类标签） | NSimSun | Microsoft YaHei |
| `.sm-search input`（搜索框） | NSimSun | Microsoft YaHei |
| `.sm-head-text h1`（图谱标题） | NSimSun | Noto Serif SC（衬线） |

改动：
- `global.css` 的 `--font-mono`、`starmap.css` 的 `--sm-mono`、`graph-console.css` 的 `--gc-mono`
  三处等宽栈**都补上中文字形兜底**（PingFang SC / Microsoft YaHei / Source Han Sans SC）：
  中文走无衬线、拉丁数字仍走等宽。
- `StarMap.jsx` 画布 `ctx.font` 同样补中文字形（星区名药丸「学科知识」等）。
- `starmap.css`：`.sm` 的正文默认字体从等宽**改为 `var(--font-ui)`**（此前整个图谱页都是 mono）；
  标题改用 `var(--font-display)` + 500 字重（与 `.page-head h1` 一致，24px → 30px）；
  副标题 11.5 → 13px、chip / tab / 搜索框字号同步上调；等宽只留给 kicker 与 HUD 读数。
- 搜索框 placeholder 文案统一：`搜文章标题…` → `搜索文章标题…`、
  `搜仓库 / 关键词…` → `搜索仓库名 / 关键词…`。

### 3. 顺手修复

- `frontend/index.html` 的 `<meta description>` 还写着已下线的「学习视频」与「RSS」，已更新为现状。
- `frontend/src/lib/auth.jsx`：`/api/me` 改为后台补拉，不再阻塞首屏（`getSession` 回来即解除 loading）。
- `frontend/index.html`：加 `preconnect` / `dns-prefetch` 指向 `api.xuguochen.de5.net`。

### 验证

- `cd backend && npm run test:unit` → **106 项：106 过 / 0 失败**。
- CDP 平台字体实测：图谱页中文从 NSimSun 全部变为 Microsoft YaHei / Noto Serif SC。
- 无头 Chrome + CDP 截图：首页桌面（三栏 Atlas）、首页底部（两块图表面板）、
  首页移动端（单列无溢出）、博客图谱、开源项目图谱。
- `node scripts/check-secrets.mjs` 无泄漏；`git diff --check` 干净。

## 2026-10-11（第四轮）· 移除图书功能

用户实测后决定整体删掉「图书」（电子书太大，24 本约 2.4GB，最大单本 772MB）。

**代码**：删除 `Books.jsx` / `books.css` / `lib/epub.js` / `lib/zipReader.js` /
`backend/src/routes/books.js` / `backend/src/lib/bookType.js`；
清理 `routes.js`、`app.jsx`、`Layout.jsx`、`Settings.jsx`、`Home.jsx`、`lib/api.js`、
`backend/src/router.js`、`backend/src/lib/publicScope.js`、`backend/tests/run.mjs`。
首页主模块由 6 个变 5 个（博客 / GitHub / 图展 / 音乐 / 影视），径向图同步减一环。

**数据**：`drop table public.books`，删掉 `schema_migrations` 里 `20261011000020` 记录，
删除迁移文件；R2 里 `books/` 前缀 24 个对象全部删除（桶内现只剩 `assets/` 48 个）。

**验证**：`npm run build` 通过（产物中已无 `图书` / `api/books` 字样）；
`npm run test:unit` **99 项全过**；`node scripts/check-secrets.mjs` 无泄漏；`git diff --check` 干净；
线上 `GET /api/books` 返回 404，导航栏截图确认「图书」已消失。
详情见 `docs/removed-features.md`。

## 2026-10-11（第六轮）· 图书重新上线（限制体积 + 自动封面 + 在线阅读）

上一轮图书整体下线是因为**单本过大**（24 本约 2.4GB，最大 772MB）。本轮换一套做法重新上线。

### 后端

- 新增 `backend/src/lib/bookType.js`：4 种格式魔数嗅探（PDF / EPUB / MOBI / AZW3）、
  文件名清洗、object key 生成（`books/<user_id>/<年>/<uuid>.<ext>`）、封面魔数校验（JPEG/PNG/GIF/WebP）。
  **单本上限 100MB**（`MAX_BOOK_BYTES`），比普通附件（20MB）宽，但仍然有界。
- 新增 `backend/src/lib/bookCover.js`（子代理实现，674 行，零依赖）：从**随机读取字节源**里
  提取封面 / 书名 / 作者。EPUB 走最小 zip 中央目录 + OPF；PDF 扫 DCTDecode 图像流；
  MOBI/AZW3 解 PalmDB + MOBI header + EXTH。**只 range 读取几段字节，从不整本读进内存**
  （80MB EPUB 实测堆增量 ≈ 0.3MB）。
- 新增 `backend/src/routes/books.js`：上传走**原始请求体直传**（不是 multipart，避免 Worker
  内存爆掉），文件名走 `X-Book-Name` 头；正文 / 封面支持 `Range`；`?download=1` 强制下载。
- `router.js` 注册 7 条路由；`publicScope.js` 的 `PUBLIC_READ_RE` 加入 `books`；
  `response.js` 的 CORS 放行 `X-Book-Name` 头并暴露 `Content-Range`。
- 迁移 `supabase/migrations/20261011000020_books.sql`：`books` 表（含 `format` 检查约束、
  `is_public` 默认 true、updated_at 触发器、RLS 四策略 + 管理员全权）。

### 前端

- 新增 `frontend/src/lib/epubReader.js`（子代理实现，707 行，零依赖）：浏览器端解压 EPUB、
  按 spine 渲染章节、nav/NCX 章节目录、资源重写成 blob URL、脚本与事件属性全部清洗。
- 新增 `frontend/src/routes/Books.jsx` + `styles/books.css`：书架封面墙（2:3 竖版 + 书脊高光 +
  无封面纸纹占位）、搜索 / 格式筛选、站长拖拽上传（带进度）、编辑弹层、就地阅读器
  （PDF iframe 内嵌 / EPUB 站内阅读 / 其它格式如实说明）。
- 导航 `Layout.jsx` 在「影视」后加「图书」；`Home.jsx` 主模块与 Dashboard 磁贴加图书（6 个模块）；
  `routes.js` / `app.jsx` 注册 `/books`（`guest` 放行，访客可读公开书）。

### 验证

- `cd backend && npm run test:unit` → **105 项全过**（新增 5 项电子书单测）。
- `node tests/bookCover.probe.mjs`：两本真实 EPUB + 一本真实 PDF + 一本真实 MOBI 全部提取出封面 / 书名 / 作者。
- `node --expose-gc tests/epubReader.probe.mjs`：两本真实 EPUB 解出 metadata / 章节 / 封面，清洗后无脚本与外链。
- `npm run build` 通过（产物含 `Books-*.js` / `epubReader-*.js` 分包）。
- `node scripts/check-secrets.mjs` 无泄漏；`git diff --check` 干净。

### 说明

- **未部署**：按用户要求「改完先汇报，不要着急部署」。
- 用户新增要求：图书默认**在线阅读**，阅读器里另给「下载」按钮，想存本地的人自己下，不强制下载。

## 2026-10-11（第七轮）· 图书增强 + 图谱侧栏 + 按钮一致性（分支 feat/now-settings）

### 导航与时间轴

- 一级导航「更新版」改名为「更新」（`frontend/src/components/Layout.jsx`）。
- 时间轴新增「图书」类型：`backend/src/lib/timelineMerge.js` 加 `book` 映射（书名优先 `title`、
  回退文件名去扩展名；副标题「作者 · 格式」；链接 `/books`；封面用 `cover_url`；不外传
  `object_key/cover_key/user_id`），`mergeTimeline` 接收 `books`；`backend/src/routes/timeline.js`
  新增 `bookFilters()` 与 `type=book` 单类型查询；前端 `Timeline.jsx` 加 `book:'图书'` 标签与筛选按钮。

### 图谱侧栏（用户核心诉求：与左侧画布等高、不出滚动条）

- `frontend/src/routes/GraphHub.jsx`：新增 `useFitScale()` —— 用 `ResizeObserver` 量测，按
  「当前 scale 下测量 → 按可用/需要比例收敛」（最多 4 轮，下限 0.62）得到 `--sm-chip-scale`，
  字号 / 内边距 / 间距一起等比缩小。新增 `GraphSide` 组件，博客图谱与开源图谱共用
  （搜索框 + 若干分组面板）。
- `frontend/src/styles/starmap.css`：`.sm-panel` 改 `flex: 1 1 0` 两面板等分撑满；
  `.sm-chips` 去掉 `max-height/overflow:auto` 改为 `overflow:hidden`，chip 字号按
  `--sm-chip-scale` 缩放。侧栏与画布实测同高（620px vs 620px，差 0px），无内部滚动条。

### 图书上传：去掉单本大小上限（分片上传）

- `backend/src/lib/bookType.js`：`MAX_BOOK_BYTES` 提到 400MB（直传保护），新增
  `MAX_MULTIPART_BOOK_BYTES = 5GB` 与 `isWithinMultipartBookLimit()`。
- `backend/src/routes/books.js`：新增 R2 分片上传（`createMultipartUpload` → `uploadPart` →
  `complete` / `abort`），用 HMAC 签名 ticket 走 query string（不改 CORS）；抽出
  `finalizeBookUpload()` 共用「提封面 + 入库」。`router.js` 注册 4 条新路由。
- `frontend/src/lib/api.js`：`uploadBook()` 小文件（≤80MB）直传、大文件分片（8MB/片），
  进度按总字节累计；新增 4 个 api 方法。迁移注释改为「不设业务上限」。

### 图书阅读器增强

- `frontend/src/routes/Books.jsx` + `styles/books.css` + `lib/epubReader.js`：双指 / 滚轮 /
  方向键上下滑动翻页、阅读背景色（纸白 / 米黄 / 淡青 / 夜间）、字号档位、字体选择
  （默认霞鹜文楷 + 4 款系统字体栈）、单页 / 双页切换、阅读进度条（可拖动跳章），设置持久化
  到 localStorage（`bk:reader:*` 前缀）。
- 新增自托管字体 `frontend/public/fonts/lxgw/`（霞鹜文楷，97 个 woff2 分片 + OFL 许可，共 4.7MB）
  与 `frontend/src/styles/wenkai.css`（97 条 `@font-face`）。

### 按钮 / 方框一致性修复

- 根因：全局 `button, .btn` 是默认 `inline-block`，而 `<Icon>` 渲染的 `<svg>` 是 `display:block`
  → 「图标 + 文字」按钮会把图标挤到第二行，整体两行高，与旁边单行按钮一高一矮。
- `frontend/src/styles/global.css` 新增 `:where(button:has(> svg.icon), .btn:has(> svg.icon))`
  （只命中「直接子元素是图标」的按钮，用 `:where()` 压优先级、**不设 justify-content** 以免污染
  卡片式按钮）；新增搜索框内按钮高度收敛（28px）与 `.pv-toc-list button` 铺满整行。

### 验证

- `cd backend && npm run test:unit` → **107 项全过**（新增 2 项时间轴图书单测）。
- `node tests/bookMultipart.probe.mjs` → 24 项通过。
- `node tests/ui-buttons.probe.mjs` → **18 过 / 0 失败**（按钮不掉行、搜索框按钮不超高、
  图谱侧栏无滚动条且与画布等高）。
- `node tests/graphStats.probe.mjs` 42 过、`changelog.probe.mjs` 39 过、`epubReader.probe.mjs` 通过。
- `npm run build` 通过；`git diff --check` 干净。

### 说明

- **未部署**：按用户要求「改完先汇报，等确认再部署」。

## 2026-10-11（第八轮）· 首页编辑器式改版 + 全站动效层（分支 feat/now-settings）

用户诉求原话：「人家用的这些动画这么高级，你再根据这个来修改一下，就那个图谱里面除了第一个图的话，
其他的图都要升级优化一下……根据这个作为参考，然后全面升级整个网站的一个界面 UI 的设计，无论是它的
动效动画还是那种组件库的应用，还有就是鼠标的一个点击选停特效等等之类的全面优化，还有一个字体的排版，
还有一个就是它的一个编剧（边距）间距之间的一个安排。」

参考模板：`/mnt/e/documents/111/blog-home-v2.html`（最新版，130KB）与
`/mnt/e/documents/111/留白｜博客首页模板.html`。

### 一、首页改版（编辑器式版面）

- `frontend/src/routes/Home.jsx`：`Landing` 重写为 Hero → 「最近写的」→ 跑马灯 → 「此刻」→
  「站点构成」→ 「关于这个站点」→ 巨型水印页脚；新增 `useBlogData(false)` 取文章 / 分类，
  `api.listBooks('?limit=40')` 取图书。
- 新增 `frontend/src/components/LandingParts.jsx`：`Cover` / `Marquee` / `SplitLines` / `useReveal` /
  `dotDate` / `ArchiveList`（分类标签页 + 特写文章 + 归档列表 + 悬浮预览）/ `Seal` /
  `AboutBlock`（逐字点亮）/ `ProgressRing`。
- 新增 `frontend/src/components/HomeNow.jsx`：「此刻」Bento 小组件区 —— ①此刻天空（可拖时间轴）
  ②倒计时（翻页数字）③写作热力日历 ④迷你折线 ⑤一句话轮播 ⑥书架（鼠标靠近书脊倒）。
- 新增 `frontend/src/lib/genCover.js`（子代理交付）：零依赖生成式封面，
  `genCover(kind, seed)` / `pickCover(seedStr)` / `COVER_KINDS`，4 种图案 waves/rings/arcs/dots，
  mulberry32 PRNG，seed 相同则图相同。
- 新增 `frontend/src/components/HomeFlow.jsx`（子代理交付）：Perlin 噪声流场画布，
  `HomeFlow({class})`，粒子拖尾 + 鼠标涡旋 + IntersectionObserver 暂停 + reduced-motion 静态图。
- `frontend/src/components/HeroCarousel.jsx`：新增悬浮小组件（实时时钟 `ld-hw-clock` + 印章）。
- `frontend/src/styles/home-landing.css`：1211 → 约 2100 行，新增 `.ld-sec` / `.ld-cv` /
  `.ld-feat*` / `.ld-tabs` / `.ld-list` / `.ld-preview` / `.ld-marq*` / `.ld-about*` / `.ld-seal*` /
  `.ld-foot*` / `.ld-wm*` / `.ld-totop*` / `.now-*` / `.ld-hw*` 等。
  **注意**：`.ld-ring` 已改名 `.ld-totop`、`.ld-meta` 改为 `.ld-feat-meta`，避开径向图与导读条的冲突。

### 二、全站动效层

- 新增 `frontend/src/components/ClickFx.jsx`：全站指针特效 —— 点击爆散 / 指针拖尾 / 自定义光标
  （普通链接空心环、`data-cursor` 实心大圆带文字、按下缩放）/ 磁吸 `data-magnetic` /
  倾斜高光 `data-tilt`。单个 canvas + MutationObserver 扫描新元素，只在
  `(hover:hover) and (pointer:fine)` 且非 reduced-motion 时启用，暴露 `window.__doraFx`。
- `frontend/src/app.jsx`：`<ClickFx />` 挂在 `<PointerGlow />` 之后。
- `frontend/src/styles/global.css`：追加 `.fx-canvas` / `.fx-cursor` / `.fx-glare` /
  `[data-magnetic]`、`@keyframes page-enter` / `brand-in`，以及排版 / 间距 / 滚动条 / 焦点环规则。
- `frontend/src/components/Layout.jsx`：`<main>` 按路由 key 重挂 + 路由变化时 `window.scrollTo(0,0)`
  （修「切页停在上一页滚动位置」）。
- `frontend/src/routes/Github.jsx` 卡片加 `data-tilt`，`frontend/src/routes/Gallery.jsx` 图块加 `data-tilt`。

### 三、图谱统计图升级（除星空图外）

- `frontend/src/components/StatCharts.jsx`：7 个图表组件（Sunburst / MatrixHeat / StreamArea /
  BubbleMatrix / RankBars / RadarChart / GaugeRings）全部加错峰入场动画（`sc-anim` / `sc-line`，
  `--i` 算延迟）、悬停放大提亮、`<title>` 数值兜底提示；网格 / 坐标轴改发丝线
  （`color-mix` 跟随主题）、数值 `tabular-nums`、卡片加渐变底与内阴影。
- 关键取舍：动画用 `animation ... backwards`（不用 `forwards`），结束后属性交还内联样式与 `:hover`，
  否则 `transform` 被锁死、悬停放大失效；`prefers-reduced-motion` 下全部关掉。
- `frontend/src/styles/graph-console.css` 同步一份完全相同的规则；**并**在 StatCharts 内部的
  `<style id="stat-charts-css">` 注入一份 —— 因为 `graph-console.css` 只被 `/graph` 控制台加载，
  `/graph/blog`、`/graph/repos`（GraphHub）不加载它，只改 CSS 文件那两个页面不会有变化。
  **两处必须同步修改。**

### 验证

- `cd backend && npm run test:unit` → **107 项全过**。
- `node tests/ui-buttons.probe.mjs` → **18 过 / 0 失败**（按钮不掉行、搜索框按钮不超高、
  图谱侧栏两面板与画布等高 620px vs 620px 且无内部滚动条）。
- `node tests/graphStats.probe.mjs` → 42 过；`node tests/changelog.probe.mjs` → 39 过；
  `node tests/statCharts.probe.mjs` → 311 项断言全过；`node tests/epubReader.probe.mjs` 通过。
- `npm run build` 通过；首页无头实测：`.ld-editorial` / `.ld-marq` / `.ld-feat` / `.ld-tabs` /
  `.now-bento` / `.now-sky` / `.now-hm` / `.ld-hw-clock` / `.ld-totop` / `.ld-wm-wrap` / `.ld-seal` /
  `.ld-about` 全部渲染，`scrollWidth 1440 = innerWidth 1440`（无横向溢出），`.fx-canvas` 已挂载。

### 说明

- **未部署**：按用户要求「改完先汇报，等确认再部署」。

## 2026-10-11（第九轮）· 首页标题逐字动效 + 图谱新增 8 张图（分支 feat/now-settings）

用户原话：「你看这个幺幺幺的那个文件的话值得借鉴的就是它的这段字的那个效果，然后我又更新了一个
零四的文件夹里面呢有 4 种特效……第五个和第六个的那种图就可以了，第四个你不用管」；
「我要的是你绘制的图尽可能的多，然后动画的话尽可能的多，后续的话哪些不需要的话我叫你删，
你不要在原有的基础上又把那个对应的图又改一遍 —— 你可以多绘制很多的图，然后后续我哪些不需要
让你来删就行了」。

参考素材（都在 `/mnt/e/documents/111/`）：
- `余白 · 博客首页111.html` —— 借鉴 h1 的**逐字升起**写法（每字一个 span，
  `translateY(112%) rotate(7deg)` 起步，按 `--d` 错峰归位；第二行描边空心）。
- `04.html` —— 只借鉴 **05 流场墨迹** 与 **06 流量桑基图**；04 三维点阵按要求不做。

### 一、首页大标题逐字动效

- `frontend/src/components/HeroCarousel.jsx`：新增 `TITLE_LINES`，标题拆成
  `把散落的知识` / `收进一张星图` 两行、每字一个 `.ld-hero-ch`，`--d` 按
  `li*0.3 + ci*0.06` 秒错峰；进场 350ms 后加 `.is-in` 触发。第二行带 `.o` 走描边。
- `frontend/src/styles/home-landing.css`：新增 `.ld-hero-line`（`overflow:hidden` 裁掉
  起始位移，`white-space:nowrap` 防窄屏拆行）、`.ld-hero-ch`（默认位移 + 过渡）、
  `.ld-hero-title.is-in .ld-hero-ch { transform: none }`、悬停单字上浮换暖色。
  描边用 `@supports` 包住，**不支持 text-stroke 时退回半透明实心字**，不会整行看不见。
  字号从 `clamp(34px,5.2vw,74px)` 提到 `clamp(34px,6.4vw,96px)` 让首屏更大气。
  `prefers-reduced-motion` 下 `.ld-hero-ch` 直接给终态。

### 二、首页背景流场升级为「三色墨迹」

- `frontend/src/components/HomeFlow.jsx`（子代理重写，277 → 491 行）：
  粒子分 3 个色相组交织；`PALETTES` 提供 3 套配色（靛紫霞光 / 水墨留白 / 琥珀日落），
  每套从 `--primary / --text / --text-muted / --bg` 派生（只有「琥珀日落」用了一个固定暖色
  `#e08a3c` 作点缀）；右下角注入一个配色切换胶囊按钮（样式自注入
  `<style id="ld-flow-css">`，不占 `home-landing.css`）；鼠标扰动改成
  「径向推开 + 切向涡旋」合力（半径 160px，切向 3.2 > 径向 0.8）。
  修掉一个真实问题：装饰层是 `pointer-events:none`，原来挂在父元素上的 `pointermove`
  收不到事件，现在监听挂 `window` 再换算坐标。

### 三、图谱页新增 8 张图（原有图表一行未改）

新增目录 `frontend/src/components/charts/`，8 个组件各自把样式注入
`<style id="charts-*-css">`，不占用 `starmap.css` / `graph-console.css`：

| 文件 | 类名前缀 | 画什么 |
| --- | --- | --- |
| `ChordDiagram.jsx` | `chd-` | 和弦图：左右两圈弧 + 中间缎带（宽 ∝ 数量），缎带生长 + 流动光点 |
| `RadialStack.jsx` | `rds-` | 极坐标堆叠柱：从圆心向外长出，逐段淡入，悬停沿径向外推 |
| `OrbitConstellation.jsx` | `orb-` | 轨道星座：恒星 + 差速公转行星 + 连线光点，入场从恒星飞出 |
| `WaffleGrid.jsx` | `wfg-` | 占比点阵：方块对角线错峰弹出，悬停同段一起提亮 |
| `PolarRings.jsx` | `pr-` | 同心环段：每圈自己是一个 100%，弧段错峰扫出 + 环上光点 |
| `RibbonTimeline.jsx` | `rt-` | 流带时间轴：多条错开的渐变光带 + 沿曲线流动光点 + 悬停竖参考线 |
| `RidgelinePlot.jsx` | `rl-` | 山脊图（Joyplot）：层峦叠嶂叠压，悬停抬升提亮 |
| `TreemapBoard.jsx` | `tm-` | 矩形树图：squarified 布局 + 从中心放大 + 缓慢扫过的高光 |

- `frontend/src/routes/GraphHub.jsx`：新增 `ExtraCharts` 组件与
  `sunburstToGroups()` / `sunburstToOrbit()` 两个映射函数，把 `graphStats` 现成的
  `sunburst` / `catTagMatrix`（`langCatMatrix`）/ `monthlyByCat`（`monthlyByLang`）
  直接喂给 8 个新组件；博客图谱与开源图谱各追加一个 `<StatBoard>`，
  **原有 8 张图一行未改**。
- 所有新组件：零依赖（Preact + 原生 SVG）、颜色只用主题变量 + 同源色板、
  中文走 `var(--font-ui)`、数值走 `var(--font-mono)` + `tabular-nums`、
  `role="img"` + `aria-label`、rAF/ResizeObserver/IntersectionObserver 全部在 cleanup 释放、
  空数据兜底、数据变换全部抽成可导出纯函数。

### 四、流向图（桑基）重写

- `frontend/src/components/FlowSankey.jsx`（子代理重写，507 行）：每条带子按宽度挂
  2~16 颗真实流动光点（沿中轴 `getPointAtLength` 滚动，`sin(u*π)` 两端淡中间亮），
  单个 rAF 驱动全部、`IntersectionObserver` 离屏暂停、`MAX_POINTS=1600` 封顶；
  悬停节点只亮它的出入边、悬停带子只亮这一条，其余压暗；提示改成跟随鼠标的浮层 `div`。
- **修掉一个致命旧 bug**：原代码把列坐标只写在列上（`c.x`），画带子时却取节点盒子的
  `boxS.x` → `undefined` → 路径字符串全是 `NaN`，`getTotalLength()` 返回 0 ——
  **桑基图的带子此前一条都画不出来**。现在坐标同步落到节点盒子上。
- `frontend/src/styles/starmap.css`：只改 307–424 行的 `fs-` 段（带子三层：渐变 + 高光 + 内描边；
  节点圆角 + 微光晕；tooltip 浮层）。

### 验证

- `cd backend && npm run test:unit` → **107 项全过**。
- `node tests/graphStats.probe.mjs` → 42 过；`node tests/statCharts.probe.mjs` → 311 项全过；
  `node tests/changelog.probe.mjs` → 39 过。
- `node tests/ui-buttons.probe.mjs` → **18 过 / 0 失败**（图谱侧栏仍与画布等高 620px vs 620px、
  无内部滚动条，没有被新增图表影响）。
- 8 个新组件的纯函数离线单测（临时脚本，跑完已删）→ 16 项全过，覆盖空数组 / 单点 /
  全 0 / 负数 / 容器为 0；矩形树图另有「面积总和 ≈ 容器面积」断言。
- `npm run build` 通过；无头实测 `/graph/blog`、`/graph/repos` 各渲染 **16 张卡片**
  （原有 8 + 新增 8），9 个样式表（`stat-charts-css` + 8 个 `charts-*-css`）全部注入，
  25 个 SVG，页面无横向溢出。

### 五、附带修复

- `frontend/src/lib/api.js`：图谱接口 `getBlogGraph` / `getRepoGraph` 的超时从默认 20 秒放宽到
  **45 秒**。原因：这两个接口要一次读完整个博客 / 全部 GitHub 收藏再在 Worker 里算星区，
  后端到 Supabase 的往返本来就慢（实测冷启动 20~45 秒），20 秒会把**正常请求**判成
  「请求超时（20 秒）」并显示错误页 —— 用户会以为图谱坏了。
- `frontend/src/components/charts/PolarRings.jsx`：圈标签原本贴在环上，圈一窄就重叠成一团；
  改成图下方一行图例（色块 + 圈名 + 合计），顺带作为「悬停整圈高亮」的入口。

### 说明

- **未部署**：按用户要求「改完先汇报，等确认再部署」。
- 用户已说明：新增的图**先全部保留**，后续他会指出哪些不要，再删。

## 2026-10-12（第十轮）· 品牌字标归位 + 全幅书架 + 过场等页面加载（分支 feat/now-settings）

用户诉求原话：「里面图里面的那个文字的话换成之前的，我是想让你加那个 Dora Studio 不是在这里加的，
而且如果转换页的话那个过渡的动画的话可以再延长个两到三秒，然后直到它就是缓冲完全，不然的话跳转的话
仍然能看到一个明显的还在缓冲的一个状态。我想要的是点击了之后跳转那个过渡的动画，然后过渡动画完了之后
就直接加载到那个页面。」以及：渐变色的 Dora Studio 挪到铁屑卡片、铁屑下移；书架太窄要像轮播图那样全幅、
三层每层 6~10 本、仿真度要高；「站点构成的图不允许用棕色和灰色这种偏暗色系，需要采用那种多彩的鲜艳的
颜色」；「我的音乐和影视不是有数据的吗怎么都是 0」。

### 一、首页首屏与品牌字标

- `frontend/src/lib/brandGradient.js`（**新增**）：把原先写在 `HeroCarousel.jsx` 里的
  `sampleGradient` / `charGradients` / `TITLE_GRADIENT` 抽成共享模块 —— 现在有两处要用
  同一条青→紫→粉渐变（首屏标题 + 铁屑卡片的品牌字标）。**逐字切片**的原因（transform 会让字
  自成合成层，父元素 `background-clip:text` 裁不到）原样保留在模块顶部注释里。
- `frontend/src/components/HeroCarousel.jsx`：`TITLE_LINES` 改回 `['把散落的知识', '收进一张星图']`，
  删掉本文件里的三份渐变实现，改成从 `lib/brandGradient.js` import。
- `frontend/src/components/HomeNow.jsx`：新增 `BRAND_LINES = ['Dora Studio']` 与 `BrandGradient`
  组件（逐字 span + `--ld-grad`），替换铁屑卡片左上角原来那行纯色小字；`BrandFilings` 高度
  400 → 340。
- `frontend/src/styles/home-landing.css`：新增 `.now-brand-t` / `.now-brand-ch`（渐变字标样式），
  `.now-brand .bf { margin-top: clamp(26px,3vw,46px) }` 把铁屑整体下移让出位置。

### 二、书架（子代理重写 `BookShelf.jsx`）

- **全幅**：根节点 `.bs-wrap` 直接补 `grid-column: 1 / -1` + `width:100vw` +
  `margin-left:calc(50% - 50vw)`（与 `.ld-hero` 同手法），并注入
  `.now-bento > .now-shelf, .now-bento > .bs-wrap { padding:0; overflow:visible; border:0; background:transparent }`
  放开父卡片对 100vw 的裁切。**上一版「书架太窄」的根因**：根节点没有 `grid-column`，
  掉进了 12 列网格的第 1 列，卡片只有 1/12 宽。
- **尺寸**：新增纯函数 `computeLayout(width)`；书宽上限 178px（对齐 `/books` 的 `minmax(178px,1fr)`）、
  间隙 20px、封面 2:3、圆角 `4px 10px 10px 4px`。实测 1440px → 每层 10 本（书 118×177，整架 665px）、
  1024px → 7 本、520px → 4 本。
- **仿真度**：层板 = 木纹 `repeating-linear-gradient` + 上表面受光 + 木料本色 + 背光立面 +
  沿高光 + 下沿投影；背板 = 竖纹木纹 + 顶部提亮 + 四角暗角；两侧立板；书压在板面上有接触阴影；
  整体 `rotateX(1.4deg) rotateY(-0.9deg)` 轻微俯视透视。CSS 里**零个十六进制颜色**，全部从主题变量派生。
- **本代理追加的两处修正**（子代理交付后实测发现）：
  1. 真实数据只有 2 本书时，按「书量均摊」会摆成 1/1/0 —— 最下面一层空着一条光板，像没做完。
     改成**真实图书轮流落到三层**（第 i 本 → 第 i%3 层），每层剩余位置用生成式封面补齐到 `layout.cols` 本。
     实测三层各 10 本，真实的两本书分别在第 1、2 层首位，其余是补位书（标题统一「藏书 N」，同样链到 `/books`）。
  2. 生成式封面全部从 `--primary` 派生，一架子书会是同一种颜色、像复印出来的。给 `.bs-gen`
     加了 `--bs-hue`（按书 id 的 hash 取 12 档 × 30°），背景层与图案层各做 `filter: hue-rotate()`，
     书名文字不跟着转。实测书架变成彩色，接近真实书架照片。
  3. `.bs-gen` 的底色从元素本身挪到 `::before`，否则 `hue-rotate` 会把竖排书名一起转色。

### 三、站点构成配色与计数

- `frontend/src/routes/Home.jsx`：`MODULES` 的 `tone` 从原来的低饱和棕灰色板换成多彩鲜艳色
  （博客 `#ff6b6b` / GitHub `#4dabf7` / 图展 `#ffa94d` / 音乐 `#9775fa` / 影视 `#22d3ee` / 图书 `#51cf66`），
  `CAP_GROUPS` 同步；`home-landing.css` 的 `--ld-tone-default` 由 `#a8815c` 改为 `#4dabf7`。
- **音乐 / 影视计数一直是 0 的根因**：`MODULES` 里两条的 `load()` 用的是 `api.listMusic()` /
  `api.listMovies()`，而访客上下文（`PUBLIC_MODE=true`）下后端会给这两个接口叠加
  `guestResourceFilters()` → `is_public=eq.true`。站长的曲库与片库多数没打公开标记，访客拿到的
  永远是空数组。**访客口径的正确数据源是 `/api/favorites/public`**（站长公开收藏，音乐 6 条 / 影视 8 条，
  时间轴页早就在用这个口径）。改成读该接口后按 `target.type` 分流计数，并加了一层 60 秒 TTL 缓存
  避免两条模块各发一次请求。

### 四、页面跳转过场（`PageTransition.jsx`）

- 原先整段只有 900ms（0~450ms 加速、450~900ms 淡出），点完立刻淡出，而新页面还在等懒加载分包 /
  接口，于是「特效演完了、页面还在转圈」。
- 改成三段：`RAMP=1300` 加速 → 巡航（**至少 `MIN_HOLD=1200`，且要等新页面真的渲染出来**）→
  `FADE=900` 淡出；`MAX_WAIT=5200` 是兜底，超时无条件淡出，绝不把用户卡住。
- 「新页面是否就绪」靠 DOM 判断：`Layout.jsx` 在 `<main>` 上加 `data-path={routePath}`，
  `pageReady(path)` 读它，并且把 Suspense 的 `.center-box`「正在载入…」视为未就绪。
- 淡出时星轨整体降亮（`starAlpha`）+ 底色盖得更厚，避免亮线压在正在出现的新页面上显得脏。
- 实测（无头 Chrome，强制 `hover:hover`）：点击 `/gallery` 后 opacity 在 0~2.4s 恒为 1，
  2.4~3.6s 平滑降到 0，总时长约 3.4s；期间 `main[data-path]` 已是 `/gallery` 且正文已渲染。

### 验证结果（本机，2026-10-12）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 统计图探针 | `node tests/statCharts.probe.mjs` | ✅ 311 项 |
| 图谱统计探针 | `node tests/graphStats.probe.mjs` | ✅ 42 项 |
| 更新日志探针 | `node tests/changelog.probe.mjs` | ✅ 39 项 |
| EPUB 阅读器探针 | `node tests/epubReader.probe.mjs` | ✅ 通过 |
| 按钮/侧栏探针 | `node tests/ui-buttons.probe.mjs` | ✅ 18 项 |
| 后端单测 + 契约 | `cd backend && npm run test:unit` | ✅ 107 项 |
| 凭据扫描 | `node scripts/check-secrets.mjs` | ✅ 190 文件，无泄漏 |
| `git diff --check` | — | ✅ 干净 |
| 前端生产构建 | `npm run build` | ✅ 通过 |
| 首页无头实测（1440/1024/520） | — | ✅ 书架全幅、三层各满、无横向溢出、无内部滚动条 |

### 下一步 / 待决策

- 窄屏（520px）时一层 4 本、整架 592px；若用户希望手机上也 6 本一层，需要调
  `BOOK_MIN_NARROW` / `BOOK_MAX_H_NARROW`（书会压到 ~86px，书名较挤）。
- 「摘抄带」的 5 段文案仍是上一轮我自己写的，用户说过后续会给素材替换。

### 五、首页首屏：修字被裁 + 改回左对齐（2026-10-12 追加）

用户反馈：「把散落的知识 / 收进一张星图这句话有些字显示的不是很全，有些地方是被遮挡的，
而且我要你放在左边，不要把它放在正中间。」

**① 字被遮挡的真因（量出来的，不是猜的）**

- `.ld-hero-line` 有 `overflow:hidden`（逐字入场动画要靠它裁掉起始位移），
  而它的高度 = `line-height: 0.98em`。汉字墨迹从基线往上约 0.85em、往下约 0.09em，
  加上 Newsreader 的 `fontBoundingBoxAscent/Descent`（实测 122 / 44 @ 165.6px）后
  行盒需要约 1.0em —— **比 0.98em 高**，于是每个字的**顶部**被切掉。
- 实测（1440×900，字号 165.6px）：行盒 `top=147`，而墨迹顶在 `144` ——
  第一行 6 个字顶部**全部**被裁 3~4px。原来的 `padding:0.1em / margin:-0.1em`
  只挪了行盒位置，并没有把行盒加高，所以没解决问题。
- 用「像素差分」验证：把 `overflow` 改成 `visible` 前后各截一张图，逐行比对，
  差异集中在第 26~29 行（顶部）与第 206~208 行（第二行底部），
  与上面的算法吻合。
- **修法**：`line-height: 0.98 → 1.06`，`padding: 0.14em 0`，`margin: -0.14em 0`
  （给足内边距包住墨迹，再用等量负外边距把多出来的高度还回去，不影响与细线/副标的间距）。
- 修后 7 种宽度实测 `maxCutTop` 全为负数（= 没有裁切）：
  1920 → -2、1440 → -1、1280 → -2、1024 → -1、860 → -1、560 → -1、400 → 0。

**② 改回左对齐**

- `.ld-hero-body`：`left/right: clamp(20px,5vw,72px)` + `top:50%` + `transform:translateY(-50%)`，
  `text-align: left`；`.ld-hero-hl` 的 `margin` 从 `auto` 改成 `0`，
  `.ld-hero-actions` 的 `justify-content` 从 `center` 改成 `flex-start`。
- 字号上限从 `176px` 收到 `132px`（`clamp(38px, 8.2vw, 132px)`）：
  左对齐后一行 6 个汉字宽约 `6 × 字号`，132px 时约 830px，在 1280px 内容区里放得下，
  也不会撞到右侧的悬浮时钟小组件（原 176px 时字标宽约 1050px，会压到时钟）。
- 窄屏媒体查询里的 `.ld-hero-body { top: 46% }` 是给居中排版写的，同步改成 `48%`。
- 顺带：`.ld-hero-body` 一开始写了 `width: min(100%, 62ch)`，实测会把行盒压到 1296px 宽、
  巨型字标 `nowrap` 反而可能被横向裁掉，已改回由 `left/right` 内边距决定宽度 + `max-width:100%`。

**验证**：`statCharts` 311 项、`graphStats` 42 项、`changelog` 39 项、`ui-buttons` 18 项
全过；`check-secrets` 无泄漏；`git diff --check` 干净；生产构建通过。
线上实测（1440×900）：`textAlign=left`、`bodyLeft=72`、`maxCutTop=-1`、
计数 `315/1,341/48/6/8/2`、书架宽 1440 = 视口宽、无横向溢出。

### 六、液态金属珠改品牌渐变 + 转场再缩短（2026-10-12 第三轮）

用户反馈：「鼠标拖动的话它的颜色是渐变的而不是一直呈现这种青色」，以及
「页面跳转的那个过渡动画还要说三到四秒，因为感觉太长」。

**① 液态珠改成品牌渐变（`LiquidMetal.jsx`）**

- **根因**：珠子颜色原本是 `--lm-a: var(--primary)`、`--lm-b: color-mix(--primary 40%, --text)`
  派生的单色渐变。三套主题的主色分别是 `#4a6cf7`（纯净，蓝）、`#3b3833`（素雅，墨）、
  `#0f9b8e`（天青，青）—— 天青主题下整条链子就是青色的，所以用户看到「一直呈现这种青色」。
- **修法**：改用**站点品牌渐变**（`#3de6ff → #8b5cff → #ff5fd2`，与首页标题、铁屑卡片上的
  Dora Studio 字标同一套），并按珠子在队里的位置切片 —— 复用 `lib/brandGradient.js` 的
  `charGradients(['x'.repeat(7)])` 拿到 7 段首尾相接的渐变，头珠偏青、尾珠偏粉。
  实测 7 颗珠子的 `--lm-grad` **7 个各不相同**，聚成大球时是一颗多色金属球。
- **顺带删掉的死代码**：`readTheme()` / `supportsColorMix()` / `applyTheme` / `themeTimer` /
  `themeObserver`（主题轮询与 MutationObserver 监听）—— 颜色不再跟主题走，这些都没用了。
  `THEME_MS` 常量一并删除。
- 注释里写明了「为什么不再跟主题走」：三套主题的主色里有两套（素雅墨色、天青青色）
  做出来的珠子都不好看，品牌渐变在三套主题下都成立。

**② 转场时长压缩（`PageTransition.jsx`）**

| 常量 | 原值 | 现值 | 含义 |
| --- | --- | --- | --- |
| `RAMP` | 1300 | **650** | 加速段：0 → 曲速 |
| `MIN_HOLD` | 1200 | **400** | 巡航段最短时长 |
| `FADE` | 900 | **550** | 淡出段 |
| `MAX_WAIT` | 5200 | **2400** | 等新页面渲染的上限（兜底） |

- 最短总时长 3.4s → **约 1.6s**；最长（页面一直没就绪）7.0s → **约 2.95s**。
- 「等新页面渲染好再淡出」的语义**不变**，只是把等待上限也收短：宁可露出一个还在加载的
  页面，也不要让用户盯着特效等。
- 实测（无头 Chrome，点 `/gallery`）：opacity 在 0~1.4s 恒为 1，1.4~2.0s 平滑降到 0，
  **总时长约 2.0s**（之前 3.4s）。

**验证**：`statCharts` 311 项、`graphStats` 42 项、`changelog` 39 项全过；
`check-secrets` 无泄漏；`git diff --check` 干净；生产构建通过。
线上实测（1440×900）：珠子 7 颗、7 个不同渐变段、`warpMs=2014`、无横向溢出。
（部署时遇到一次 Cloudflare 侧 `upload-token` 500（code 10500），间隔 12 秒重试即成功，
不是本地配置问题。）

### 七、移除全屏过场动画（2026-10-12 第四轮）

用户反馈：转场压到 2 秒后仍嫌长 ——「算了吧还是把这个过多的动画给删了过渡的动画给删了」。

**做法：整个「曲速星海」转场层下线，不是再调时长。**

| 文件 | 改动 |
| --- | --- |
| `frontend/src/components/PageTransition.jsx` | **整个文件删除**（235 行） |
| `frontend/src/app.jsx` | 删掉 `import { PageTransition }` 与 `<PageTransition />` |
| `frontend/src/components/Layout.jsx` | `<main>` 上删掉 `data-path={routePath}`（该属性只服务于转场层）；**`key={routePath}` 保留** |
| `frontend/src/styles/global.css` | 删掉 `.page-warp { ... }` 规则块及其上方注释 |

**保留的动效**：`Layout.jsx` 的 `key={routePath}` 会让 `<main>` 在换路由时整块重挂，仍然触发
`.app-main > *` 的 `fade-up`（淡入 + 上浮，见 `global.css`）—— 所以跳页不是生硬闪切，
只是不再有全屏盖住一切的那 2 秒。

**顺带确认**：`pageReady()` 是 `PageTransition.jsx` 的导出，全仓再无引用，随文件一起消失；
`frontend/tests/` 下无任何 `PageTransition` / `page-warp` / `data-path` 引用，测试不受影响。

**验证**：`statCharts` 311 项、`graphStats` 42 项、`changelog` 39 项、`ui-buttons` 18 项、
后端 `test:unit` 107 项全过；`check-secrets` 190 文件无泄漏；`git diff --check` 干净；
生产构建通过。更新日志 `v0.11.0` 同步改写：删掉两条「转场时长/等渲染」条目，新增一条
`remove` 说明移除原因。
