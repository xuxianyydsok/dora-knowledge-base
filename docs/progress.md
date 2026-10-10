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
