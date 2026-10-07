# Dora 体验重构方案（2026-10-07）

> 配套文档：`docs/handoff-2026-10-07-refactor.md`（任务背景）、`docs/pages-audit-2026-10-07.md`（逐页现状审计）。
> 本文是**方案**，不是进度；落地进度仍记在 `docs/progress.md`。
> 所有代码事实、实测数据均来自 2026-10-07 的本机实测，非推测；标注「待复核」的条目需要线上确认。

---

## 0. 本轮边界与不变量

**不动的（用户明确要求）**
- 液态玻璃视觉语言、色彩 token、自托管字体、品牌标识（Dora）。
- 路由结构、统一资源模型（`resources` 表 + `type` 区分）、既有 API 契约的向后兼容。

**要动的**
- 每个页面的**功能深度**（多想一层，补上行业标准配置）。
- 页面上**组件的排布方式**与全站组件统一（页头 / 卡片 / 状态 / 表单 / 详情骨架）。
- 影视库、音乐库重排；RSS 阅读器化；搜索源扩充。

**不可违反的约束**
1. 数据库变更必须走 `supabase/migrations/` 迁移文件，禁止直接改线上表。
2. 所有写操作必须带 `user_id=eq.${user.id}`；管理员仅通过 `?all=true` 获得**读**权限。
3. 云端服务全部免费额度 —— 方案必须说明对 Supabase 的压力（见 §6.5、§7.4）。
4. 不读取/输出/提交 `.dev.vars`、`.env.local`、`supabase/.temp/`。
5. 本地 `wrangler dev` 出网会挂 → 清 `CODEX_CI` 与代理变量；接口验证优先打线上。

---

## 1. 本轮前置：工作树已收敛（已完成）

### 1.1 处置结果

| 文件 | 处置 | 说明 |
| --- | --- | --- |
| `backend/src/lib/maccms.js` | 提交 | 无防盗链源提前 + 新增红牛；线上 Worker `68e5831f` 已按此运行，不提交会回退 |
| `backend/src/lib/fetchers.js` | 提交 | 音乐候选上限 20→30；影视「可播放优先 + 上映年份降序」 |
| `docs/progress.md` | 提交 | 新增 2.10 节 |
| `docs/handoff-2026-10-07-refactor.md`、`docs/pages-audit-2026-10-07.md` | 提交（原 untracked） | 上一轮交接产物 |
| `frontend/src/routes/Music.jsx` | **回退到 HEAD** | 见 §1.2 |
| `backend/src/lib/maccms.js.bak` | 删除 | 与 HEAD 版逐字节相同，零信息 |

提交：`195691b chore(repo): 收敛上一轮未提交改动…`（main，领先 origin 1）。当前工作分支：`refactor/experience-2026-10`。

### 1.2 为什么 Music.jsx 必须回退（实测证据）

不是「半成品」而是**坏态**：

1. **残留游离 JSX token**：第 234–235 行为裸 `))}`、`)}`，被 JSX 当作**字面文本**渲染到音乐页底部。
   esbuild 实测报 2 条 `The character "}" is not valid inside a JSX element`。
2. **构建产物已污染**：`dist/assets/Music-BOt3MjM2.js`（04:53 构建）实测含 `))}` 字面串、且已无「音乐库还是空的」文案 → 上次构建即出自坏源码。
3. **死代码**：`RECOMMEND`(L12)、`AlbumCard`(L22)、`shelves`(L184)、`remove`(L177) 全部无引用。
4. **功能倒挂**：整块「我的音乐库」被删除，而它正是本轮要重排的对象。

回退后 `npx vite build` 通过，Music chunk 由 4223 字节回到 6599 字节，音乐库文案复现 —— 已验证恢复。

> 线上 `/music` 是否已部署该坏产物**待复核**（`progress.md` 只记录了后端部署）。

---

## 2. 现状核实：关键缺陷 → 根因

| # | 现象 | 实测证据 | 根因 |
| --- | --- | --- | --- |
| 1 | 页头 3+ 套体系 | 仅 **12/25** 个路由用 `PageHeader`；Movies=`vod-head`、Music=`music-head`、RSS条目/编辑页=`toolbar`+`h2`、详情页=`song-bar`/`np-bar`/`page-bar` | 缺页头规范与 variant |
| 2 | 列表卡片各写各的 | `GalleryView`(20 行)/`TimelineView`(30 行) 只做外容器，每页自传 `renderCard`；`Search.jsx` 未走它们 | 缺「列表页骨架」组件 |
| 3 | 状态 4 种写法并存 | `<div class=center-box>加载中…` / `skeleton-card` / `EmptyState` / `<p class=muted>` | 缺 Loading/Error 组件 |
| 4 | 编辑页三胞胎 | `PostEdit`(113)/`MovieEdit`(110)/`MusicEdit`(106) 结构重合，零共享 | 缺表单骨架 |
| 5 | 内联 style 泛滥 | `MovieEdit` 15、`NotificationBell` 15、`Backup` 11、`RssFeeds` 10… | 缺 `card--pad`/`meta-row`/`chip-row` 等基础类 |
| 6 | 样式单文件 3646 行 | `global.css` 约 60 个分区，改名需全局搜 | 缺「新样式写哪个分区」规范 |
| 7 | RSS 不是阅读器 | `rss_articles` **只存 `summary`，无正文列**；UI 是卡片列表 + 跳外链 | 结构性缺口，非美化问题 |
| 8 | 详情页骨架不可复用 | `MovieView` 的 `detail-hero` 是全站最完整骨架，无人复用 | 未下沉为通用组件 |
| 9 | 音乐页只剩搜索 | 库列表被删（§1.2） | 本轮重排 |

---

## 3. P0-A：统一组件与信息架构规范

### 3.1 设计原则

1. **一个页面 = 一种骨架**，同类型页面共用同一组件，差异只用 props 表达。
2. **视觉语言不变**：只在既有 CSS 变量与玻璃基类（`.glass`、`.card`）之上做组合，不引入新色板。
3. **状态必须三态齐备**：加载 / 空 / 错误，且由骨架统一渲染，页面不再各写。
4. **新增样式必须在 `global.css` 的既有分区内**，并遵循 §3.8 的分区表。

### 3.2 页头：`PageHeader` 扩展为 4 个 variant

现有 `PageHeader`（16 行）只有 kicker/title/sub/actions 一种形态。扩展为：

| variant | 用途 | 现状对应 | 将接入 |
| --- | --- | --- | --- |
| `list` | 列表/工具页：kicker + h1 + sub + 右侧操作 + 底部细分割线 | 已有 | 12 个已用页 + Search 复用 |
| `detail` | 详情页：面包屑 + 返回 + 标题 + 右侧编辑 | `page-bar` / `song-bar` / `np-bar` | MovieView / MusicView / PostView / VideoView |
| `editor` | 编辑页：返回 + 标题 + 保存/取消 | `toolbar`+`h2` | PostEdit / MovieEdit / MusicEdit |
| `landing` | 落地页：保留 Hero（不改造） | `hero` | Home（未登录态） |

新增 `PageBar`（轻量工具条）承接「返回 / 编辑 / 视图切换 / 计数」这一行，替换各页手写 `toolbar`。

### 3.3 列表页骨架：`ResourceListPage`

把「页头 + 工具条 + 视图切换 + 三态 + 网格/时间流」固化为一个组件：

```jsx
<ResourceListPage
  header={{ kicker, title, sub, actions }}
  toolbar={<FilterBar …/>}          // 可选
  views={{ gallery: <GalleryView …/>, timeline: <TimelineView …/> }}
  state={{ loading, error, items }}
  renderCard={(item) => <ResourceCard …/>}
  empty={{ icon, title, hint, action }}
/>
```

- `GalleryView` / `TimelineView` 保留，但**只作为内层渲染器**被 `ResourceListPage` 调用；三态与工具条上移。
- `Search.jsx`、`Categories.jsx`、`Tags.jsx` 从手写布局迁移到该骨架。
- **分类/标签页不提供双视图**（管理型数据用列表更合理），单独给 `AdminListPage` 变体（表格 + 行内操作）。

### 3.4 卡片分层

| 组件 | 用途 | 规格 | 现状 |
| --- | --- | --- | --- |
| `Card` | 通用玻璃容器 | 已有 36 行 | 保留 |
| `ResourceCard` | 封面 + 标题 + **MetaRow** + 操作区 | 新建 | 取代各页手写 |
| `PosterCard` | 影视海报 **2:3** | 由 `VodPoster` 升级 | 已有雏形 |
| `AlbumCard` | 音乐 **1:1** | 由 Music.jsx 内联组件上提 | 已有雏形 |
| `RowCard` | 横向行（搜索结果/条目列表） | 由 `SearchRow` 上提 | 已有雏形 |
| `MetaRow` | 统一的「日期 / 来源 / 状态 / 标签」行 | **新建（关键）** | 每页重复实现 |

`MetaRow` 是「卡片不一致」的直接解法：把四类元信息的图标、字号、间距、分隔符固定下来，各页只传数据。

### 3.5 状态三件套

| 组件 | 说明 |
| --- | --- |
| `LoadingState` | 骨架屏，`shape` ∈ `grid`/`rows`/`detail`/`list`；替换所有「加载中…」纯文本与 `skeleton-card` 手写 |
| `EmptyState` | 已有（14 行），扩展 `size`、`icon`、`action`；分类/标签/收藏/RSS 各页补定制文案 |
| `ErrorState` | **新建**：错误信息 + 重试按钮；替换散落的 `<p style="color:var(--danger)">` |

### 3.6 表单骨架：`FormPage`

```jsx
<FormPage title="新增影视" onBack onSave saving>
  <FieldRow label="标题"><input …/></FieldRow>
  <FieldRow label="海报"><ImageField …/></FieldRow>
</FormPage>
```

收编 `PostEdit` / `MovieEdit` / `MusicEdit` 三胞胎；顺带补齐三页共同缺失的能力：字段级错误提示、未保存离开确认、提交中禁用。

### 3.7 详情页骨架：`DetailHero` + `DetailSection`

将 `MovieView` 的 `detail-hero`（背景模糊图 + 大海报 + 元信息 + 导演/主演 + 简介 + 操作区）**下沉为通用组件**：

- `MovieView`：现状复用（无行为变化，仅换实现）。
- `MusicView`：改用同一骨架（专辑/封面 + 歌手/专辑/年份/流派/音质 + 播放/歌词/编辑）。
- `PostView`：补齐阅读体验要素 —— 目录（大纲）、阅读进度、字号/行宽调节、上一篇/下一篇。
- `VideoView`（若存在）：同构。

### 3.8 样式规范（`global.css`）

**分区表**（新增样式必须落在对应分区，并按顺序追加）：

| 分区 | 内容 |
| --- | --- |
| 1. 变量与主题 | tokens、明暗主题 |
| 2. 基础元素 | 文字、链接、按钮、表单控件、玻璃基类 |
| 3. 应用外壳 | 顶栏、抽屉、页脚 |
| 4. **通用组件（新增）** | `page-head` / `page-bar` / `ResourceListPage` / `MetaRow` / `EmptyState` / `ErrorState` / `LoadingState` / `FormPage` / `DetailHero` |
| 5. 内容模块 | 博客正文、画廊、时间流、卡片 |
| 6. 业务模块 | 音乐、影视、RSS |
| 7. 落地页 | Hero、功能矩阵、页脚 |
| 8. 响应式与无障碍 | 断点、`prefers-reduced-motion` |

**新增基础类**（消除内联 style）：`card--pad`、`card--flush`、`meta-row`、`meta-item`、`chip-row`、`stack-sm`、`stack-md`、`row-tight`。

**token 增补**：间距梯度 `--sp-1…--sp-6`、圆角 `--r-sm/md/lg`、层级 `--z-nav/drawer/modal`（当前散落硬编码）。

**是否拆分 `global.css`**：**本轮不拆**。3646 行单文件确有维护成本，但拆分在无测试保护下回归风险高、收益滞后。本轮只建立「写哪个分区」的规范，把拆分列为独立议题（S6 之后评估）。

---

## 4. P0-B：影视库 `/movies` 重排

**现状问题**：`vod-head` 与全站页头不一致；推荐片单 `reco-panel` 占据首屏、与搜索结果争抢注意力；影视以**列表行**呈现（行业惯例是**海报墙**）；「搜索结果」与「我的库」在同一滚动流里、层级不清。

**新结构（自上而下）**

1. `PageHeader variant="list"`：`kicker="Movie Library"` + 标题 + 副标题 + 右侧「手动添加」。
2. **搜索条**（胶囊输入 + 搜索按钮）。
3. **分段导航（Tabs）**：`精选推荐` / `最新入库` / `我的收藏` —— 三个模式**互斥**，主区一次只呈现一个，取代现在「搜索结果 + 我的库」上下堆叠。
4. **推荐片单降级**：`reco-panel` 由首屏大面板改为 Tab 内的**一行 chips**（可横向滚动），桌面展开、移动端折叠，默认不抢占首屏。
5. **主区：海报网格**（`PosterCard` 2:3）
   - hover/focus 浮出「播放 / 收藏 / 详情」；
   - 左上角**来源角标**（采集源名）、右上角**多源标记**（`alt_sources` 非空时显示「多源」）；
   - 底部信息：片名 + 年份 + 评分 + 已看进度条（复用 `user_progress`）。
6. **筛选行**（新增）：类型（电影/剧集/动漫）、地区、年份、排序（最新/评分/相关度）。

**新增能力**
- **批量收藏**：多选海报 → 一次请求入库（对应 `progress.md` 第 3 节遗留的「片单批量收藏提速」，后端一次性批量接口替代已停用的 `seed-movies.mjs`）。
- **继续观看**：`user_progress` 已有 `movie` 类型进度，Tab 顶部给「继续观看」横排。
- **源状态入口**：把 `/api/movies/sources/health` 做成可见的「源状态」抽屉（命中率 / 直链可用率 / 最近失败），给用户「为什么这个片搜不到」的解释。

---

## 5. P0-C：音乐库 `/music` 重排（音乐库回到本页）

**决策（已与用户确认）**：音乐库**回到 `/music` 页内**，不做独立路由。

**新结构**

1. `PageHeader variant="list"`（替换 `music-head`）。
2. **搜索区**：胶囊搜索 + 推荐词 chips（复用 `RECOMMEND`，恢复被删的 `music-reco`）。
3. **分段（Tabs）**：`音乐库` / `搜索结果` / `播放队列`
   - **音乐库**：货架式（`最近添加` / `全部` / `按歌手` / `按专辑`），`AlbumCard` 网格；支持按歌手、专辑、音质（无损/完整音轨/试听）筛选与排序。
   - **搜索结果**：`SearchRow` 横向列表（保留上轮的用户反馈改动），带音源/音质/时长/收藏。
   - **播放队列**：展示当前队列、跳播、清空（当前队列只存在于 `lib/player.jsx` 内存，无 UI）。
4. **空态**：库为空 → 图标 + 推荐词一键搜索；搜索结果为空 → 换词建议。
5. **清理死代码**：`RECOMMEND` 恢复引用、`AlbumCard` 上提为共享组件、`shelves` 重写为多货架、`remove()` 接回批量管理 UI。

**新增能力**：一键全部播放 / 随机播放、批量删除与批量入库、按音质过滤、未知歌手的专辑归并。

---

## 6. P1：RSS 阅读器化（对标 Folo）

### 6.1 对标基线（公开资料整理，非源码逐条核对）

| 能力 | Folo | 本项目现状 |
| --- | --- | --- |
| 三栏阅读器 | ✅ 订阅源 / 条目 / 正文 | ❌ 单列表 + 跳外链 |
| 未读管理 | ✅ 全部/未读、按源未读计数、全部已读 | ⚠️ 有「仅未读」与全部已读，无按源计数导航 |
| 快捷键 | ✅ `j`/`k` 导航、`s` 收藏、`m` 已读、`Esc` | ❌ 无 |
| 订阅源分组 | ✅ 文件夹/视图 | ⚠️ 数据库已有 `category_id` 列，UI 未用 |
| 正文阅读 | ✅ 站内全文（含图片） | ❌ 只有 `summary`，跳原站 |
| AI 摘要/翻译 | ✅ 内置（无需自带 token） | ❌ 无 |
| 多视图（图片/视频/播客） | ✅ | ❌ 无 |
| 稍后读 / 收藏到知识库 | ✅ | ⚠️ 有 favorites 表，未接 |

> 上表用于确定「做到什么程度算齐备」。若需逐条对齐 Folo 官方仓库的精确能力，建议用一次 `exa/search`（约 $0.007/次）或 `serper/search`（约 $0.001/次）—— **执行前会先向你报备价格**。

### 6.2 三栏布局与断点

```
┌───────────────┬──────────────────────┬────────────────────────────┐
│ 侧栏（280px）  │ 条目列表（360px）      │ 正文区（自适应）             │
│ 全部 12       │ ● 标题 1              │  标题 / 来源 / 时间          │
│ 未读 5        │   源 · 2h             │  正文（按需抽取）            │
│ ─ 分组：前端  │ ○ 标题 2  ✓已读       │  [阅读原文] [收藏] [摘要]     │
│   ─ 源 A (3)  │   源 · 昨天           │                            │
│   ─ 源 B (1)  │ …                     │                            │
└───────────────┴──────────────────────┴────────────────────────────┘
```

| 断点 | 布局 |
| --- | --- |
| ≥1180px | 三栏常驻 |
| 768–1180px | 两栏（侧栏收成图标条，条目列表 + 正文） |
| <768px | 单栏 + 抽屉（列表 ⇄ 正文切换） |

### 6.3 功能清单

**必备（S4 交付）**
1. 三栏阅读器 + 正文区（先渲染 `summary`，正文按需抽取）。
2. 未读管理：全部/未读切换、按源与按分组未读计数、单条已读/未读、全部已读（含按源限定）。
3. 快捷键：`j`/`k` 上下条、`Enter` 打开、`s` 收藏、`m` 切换已读、`o` 阅读原文、`/` 聚焦搜索、`Esc` 返回列表；`?` 呼出快捷键帮助浮层。
4. **订阅源分组**（复用 `categories`，见 §6.4）。
5. 按订阅源 / 分组筛选，搜索框（前端过滤已加载条目）。
6. 收藏到知识库（`favorites` 或 `resources` 的 `rss_article` 类型）。

**进阶（S4 之后）**
7. 正文抽取：Worker 侧按需抓取 + 简化（类 Readability），**结果走 Cache API / KV，不落 Supabase**。
8. AI 摘要 / 翻译（需 LLM 额度，单列预算讨论）。
9. 阅读进度 / 稍后读 / 命中高亮。

### 6.4 数据模型与迁移

| 需求 | 方案 | 是否需要迁移 |
| --- | --- | --- |
| 订阅源分组 | **`rss_feeds.category_id` 已存在**（`references public.categories(id)`）→ 只需后端 `listFeeds` 返回 `category`、前端补 UI | **不需要** |
| 未读状态 | `rss_articles.is_read` 已存在 | 不需要 |
| 阅读进度 | 复用 `user_progress`（`resources.type='rss_article'`） | 不需要 |
| **正文内容** | **推荐：不落库**。Worker 按需抓取原文 + 抽取正文，经 Cache API 缓存（TTL 按源） | 不需要 |
| （备选）正文落库 | 若坚持离线可读，则新增 `rss_articles.content_html text` | 需要 `20261008000001_rss_reader.sql` |

> 结论：**采用「按需抽取 + 边缘缓存」可在零迁移的前提下做到 Folo 的阅读器形态**，且对 Supabase 零增量压力。这是本轮对「免费额度敏感」这一约束的直接回应。

### 6.5 Supabase 压力评估（RSS）

| 项 | 现状 | 改造后 | 说明 |
| --- | --- | --- | --- |
| 抓取写入 | Cron 每小时分批，每源最多 20 条，`guid` 冲突忽略（幂等） | 不变 | 已有 ETag/Last-Modified 条件请求，未变更时不写 |
| 条目读取 | 前端 `limit=100` 一次拉全 | **改为分页 + 按需加载** | 三栏阅读器天然分页，减少单次响应体积 |
| 正文 | 不涉及 | **不落库**（边缘缓存） | 零增量 |
| 已读标记 | PATCH 单条 | 不变（加批量已读上限） | 高频写操作，需加节流 |
| 分组 | 不涉及 | 复用 `categories`，零新增表 | — |

---

## 7. 搜索源扩充方案（含实测结论）

**测试方法**：WSL2 Ubuntu 内经本机代理（`127.0.0.1:7897`）出网，直连各源站 API；对首条结果的播放直链做「无 Referer / 直链域 Referer / 接口域 Referer / 第三方 Referer」四种探测，校验是否返回 `#EXTM3U`。脚本见 §10。

> ⚠️ **局限说明**：本地 WSL 经代理的出口 IP 与 Cloudflare Worker 的出口不同。**源站的限频、地域策略与超时表现可能与线上不一致**，因此下表中「超时/不可达」需在线上（`/api/movies/sources/health`）复核后再定论；「可直连 / 防盗链」这类基于响应码的结论不受出口 IP 影响，可直接采信。

### 7.1 影视采集源实测（2026-10-07，关键词「庆余年」）

| 源 | key | 命中 | 直链探测（无/直链域/接口域/三方） | 结论 | 建议 |
| --- | --- | --- | --- | --- | --- |
| 红牛资源 | `hongniu` | 8 | 200M / 200M / 200M / 200M | ✅ 可直接播放 | 已集成，保持优先 |
| **极速资源** | `jszy` | 8 | 200M / 200M / 200M / 200M | ✅ 可直接播放 | **建议新增** |
| **光速资源** | `guangsu` | 8 | 200M / 200M / 200M / 200M | ✅ 可直接播放 | **建议新增** |
| **艾坤资源** | `ikun` | 3 | 200M / 200M / 200M / 200M | ✅ 可直接播放（命中偏低） | **建议新增（低优先）** |
| 多多资源 | `duoduo` | 1 | 200M / 200M / 200M / 200M | ✅ 可直接播放（命中很低） | 可选 |
| 电影天堂 | `dytt` | 7 | 200M / 200M / 200M / 200M | ✅ 可直接播放 | 已集成（注意：首轮取到过期剧集时曾 403，**逐剧集不稳定**） |
| 量子资源 | `lzi` | 3 | 404 / 404 / 404 / 404 | ❌ 直链已过期 | 已集成，降级为补充 |
| 非凡资源 | `ffzy` | 8 | 403 / 403 / 403 / 403 | 🔒 防盗链（三方 Referer 也 403） | 已集成，需后端代理 |
| 最大资源 | `zuid` | 7 | 403 / 403 / 403 / 403 | 🔒 防盗链 | 已集成，需后端代理 |
| 无尽资源 | `wujin` | 9 | 403 / 403 / 403 / 403 | 🔒 防盗链 | 不建议集成 |
| 暴风资源 | `bfzy` | 10 | 404 / 404 / 404 / 404 | ❌ 直链失效 | 不建议集成 |
| 360资源 | `zy360` | 超时 | — | ⚠️ 本地探测超时 | 已集成，**需线上复核** |
| 天空资源 | `tiankong` | 返回 HTML | — | ❌ 非标准 maccms 搜索接口 | 不集成 |
| 闪电资源 | `sdzy` | 「暂不支持搜索」 | — | ❌ 仅支持类目/ID 拉取 | 不集成 |

**首轮另测的 16 个候选域名结果**：`leduo`（SSL 超时）、`kuaikan`（404）、`wolong`/`suoni`/`jinying`/`modu`/`piaohua`（SSL EOF）、`xinlang`（403）、`huya`（404）、`tyyszy`（400）、`okzy`（超时且不支持搜索）、`heimuer`（返回 HTML）、`dbzy`（关键词搜索被禁）——**均不可用**。

**净结论**：本轮可新增 **3 个可直接播放的采集源**（`jszy` / `guangsu` / `ikun`），采集源总数由 5 个提升到 8 个，且「无防盗链」源由 3 个提升到 6 个。

### 7.2 音乐音源实测（2026-10-07）

| 音源 | 端点 | 命中 | 直链探测 | 结论 | 建议 |
| --- | --- | --- | --- | --- | --- |
| GD音乐台 | `music-api.gdstudio.xyz` | 5 | `200 audio/mpeg`（`br=999`） | ✅ 可靠 | 现有主源，保持 |
| **Meting@qijieya** | `api.qijieya.cn/meting/` | 30 | `200 audio/mpeg` | ✅ 可直接播放 | **建议新增**（`netease` + `migu` 双平台可用；`tencent`/`kugou` 返回 HTML 不可用） |
| **Meting@mysqil** | `meting.mysqil.com/api` | 30 | `200 audio/mpeg` | ✅ 可直接播放 | **建议新增**（仅 `netease` 可用） |
| Audius | `api.audius.co` | 2 | 403 / 超时 / 502 | ⚠️ 当前网络不可用 | 已集成，保留多节点 fallback，**需线上复核** |
| 酷狗音乐 | `songsearch.kugou.com` | 5 | `err_code 20010 / 30020` | 🚫 直链需 Cookie(`mid`/`dfid`)+签名 | 暂不集成 |
| 酷我音乐 | `search.kuwo.cn` | 3 | 无直链 | 🚫 直链需 `kw_token`；但搜索响应含 `FORMATS=ALFLAC/2000kbps/24MB`，**潜力大** | 暂不集成，列为后续项 |
| QQ音乐 | `c.y.qq.com` | 0（本地） | 需 `vkey` 签名 | 🚫 暂不集成 |
| 咪咕（官方旧接口） | `m.music.migu.cn` | 返回 HTML | — | 🚫 旧接口已下线 | 改走 Meting 的 `migu` 平台 |
| 网易云官方 | `music.163.com/api` | 5 | 需登录 | 🚫 仅可作元数据 | — |
| Meting@i-meto | `api.i-meto.com` | 30 | 嵌套 url **404** | ❌ 实例失效 | 不集成 |
| Meting@injahow | `api.injahow.cn` | 0 | `{"error":"unknown type"}` | ❌ 不支持搜索 | 不集成 |

**净结论**：新增 **2 个 Meting 公共实例**（`qijieya` / `mysqil`），其中 `qijieya` 额外提供 `migu` 平台，可明显提升华语与非主流曲目的命中率。

### 7.3 实施建议

**影视侧**
1. `DEFAULT_VOD_SOURCES` 增补 `jszy` / `guangsu` / `ikun`，沿用「无防盗链优先」排序（现有排序逻辑已支持）。
2. **新增 m3u8 反代接口** `GET /api/movies/hls?src=<source_key>&u=<urlencoded>`：
   - 目的：解决 `ffzy` / `zuid` 等防盗链源的播放（实测三方 Referer 也 403，说明是**Referer 白名单**，必须由服务端注入正确 Referer/UA）。
   - 设计要点：**严格域名白名单**（只允许各采集源的播放 CDN 域）、仅登录用户可调、透传 `Range`、用 Cache API 缓存 playlist 与分片。
   - ⚠️ **安全红线**：不做白名单就是一个开放代理，会被滥用 —— 这是本方案里风险最高的一项，需你单独确认后再实施。
3. **源状态看板**：`/api/movies/sources/health` 扩展为可见面板（命中率、直链可用率、最近失败时间），给用户可解释性。

**音乐侧**
4. 新增 `meting` 适配器，支持实例 × 平台矩阵（`qijieya`×`netease`/`migu`、`mysqil`×`netease`）。
5. **多实例 + 多平台 fallback + 进程内缓存（10 分钟）**，与现有 GD 的降级策略一致；直链过期继续走 `POST /api/music/stream` 重解析。
6. 公共实例不可控，必须在 `docs/interface-inventory.md` 记录「实例清单 + 最近实测时间」，并纳入健康检查。

### 7.4 Supabase 压力评估（搜索源扩充）

搜索**全程不落库**（只在用户点「收藏」时写 1 行 `resources`），因此新增源对 Supabase **零增量压力**；代价是 Worker 出站请求变多（免费额度 10 万请求/天，需在源健康看板里监控）。

---

## 8. 分阶段实施与验收标准

| 阶段 | 目标 | 主要交付 | 验收标准 |
| --- | --- | --- | --- |
| **S1** | 统一层（P0-A） | `PageHeader` variant、`PageBar`、`ResourceListPage`、`MetaRow`、`LoadingState`、`ErrorState`、`FormPage`、`DetailHero` + `global.css` 规范与基础类 | 25 个页面全部改用统一骨架；`grep -o 'style='` 总数下降 ≥50%；`npx vite build` 通过；逐页截图（亮/暗）无回归 |
| **S2** | 影视重排 + 源扩充 | §4 新结构 + §7.3 的 1/2/3 | 海报墙为主视觉；三个 Tab 互斥；新增 3 源线上实测可播；`/sources/health` 全部 OK |
| **S3** | 音乐重排 | §5 新结构（库回本页、三 Tabs、死代码清零） | 音乐库可见可播；`RECOMMEND`/`AlbumCard`/`shelves`/`remove` 全部有引用；新增 Meting 源线上可播 |
| **S4** | RSS 阅读器 | §6 三栏 + 未读管理 + 快捷键 + 分组 | 三栏在 ≥1180px 成立、<768px 单栏可用；`j/k/s/m/o/Esc` 全通；分组用 `categories` 无需迁移；正文按需抽取成功且未写库 |
| **S5** | 详情/编辑页统一 + Settings 扩展 | `DetailHero` 接入 MusicView/PostView；`FormPage` 接入三编辑页；Settings 聚合主题/账号/通知/危险区 | 详情页骨架一致；编辑页无重复代码；Settings 不再是「只有主题」 |
| **S6** | 打磨 | 落地页拆分与真实统计、AdminUsers 分页、动效统一、键盘可达性、分类/标签管理型列表重做 | Lighthouse 可访问性 ≥90；无硬编码假数据 |

**每阶段统一验收动作**（项目既有约定）：
```bash
npx vite build          # 前端构建通过
node --check <改动文件>  # 后端语法通过
```
外加：逐页真机截图（本机已有 `omp-chrome` 可视化方案，见 `progress.md` 2.7）、线上复测、更新 `docs/progress.md`。

---

## 9. 风险与开放问题

| # | 风险 / 问题 | 影响 | 应对 |
| --- | --- | --- | --- |
| 1 | **m3u8 反代可能变成开放代理** | 安全 / 被滥用 | 严格域名白名单 + 登录校验 + 限流；**需你单独确认** |
| 2 | 公共 Meting 实例稳定性不可控 | 音源随时失效 | 多实例 fallback + 健康检查 + 记录实测时间 |
| 3 | 免费额度（Supabase / Workers） | 服务不可用 | 正文不落库、列表分页、抓取分批、监控请求量 |
| 4 | 无自动化测试 | 大规模重构易回归 | 每个 S 阶段强制逐页截图；建议为统一组件补最小测试（可选议题） |
| 5 | Folo 能力对齐仅基于公开资料 | 可能遗漏关键特性 | 如需精确对齐，用一次联网调研（**执行前先报价**） |
| 6 | `docs/progress.md` 明文管理员口令 | 凭据泄露（已在 git 历史） | 建议本轮改为环境变量引用；历史清理另行决策 |
| 7 | `global.css` 单文件 3646 行 | 维护成本 | 本轮只建规范不拆分（§3.8） |

---

## 10. 附：实测方法与脚本

实测脚本位于（Windows 侧工作区，非项目仓库，避免污染代码库）：
`C:\Users\x1078\WorkBuddy\2026-10-07-10-29-06\tools\`

| 脚本 | 作用 |
| --- | --- |
| `vod_test2.py` | 影视采集源：命中率 + 4 种 Referer 防盗链探测（**最终版**） |
| `music_multiserver.py` | Meting 实例 × 平台矩阵可用性 |
| `music_diag2.py` | 音源原始响应诊断（酷狗/酷我/Audius/Meting 解析） |

复跑方式（WSL 内，经本机代理）：
```bash
wsl -d Ubuntu-24.04 -- python3 /mnt/c/Users/x1078/WorkBuddy/2026-10-07-10-29-06/tools/vod_test2.py
```

> 首轮脚本的 2 个已知缺陷已修正并记录：① 只读 4000 字节导致大 JSON 被截断、误判为「非 JSON」；② 判定未接受 `206 Partial Content`（Range 请求的正常响应），把可用音源误判为失败。

---

## 11. 待你决策的点

1. **m3u8 反代接口**（§7.3-2）是否实施？这是唯一涉及安全边界的功能，其余方案均为常规改造。
2. **RSS 正文**采用「按需抽取 + 边缘缓存、不落库」（推荐，零迁移、零 Supabase 增量）还是落库？
3. **S1 之后是否拆分 `global.css`**（本方案建议本轮不拆）。
4. 是否需要为精确对标 Folo 做一次付费联网调研（先报价后执行）。
5. `docs/progress.md` 明文口令是否本轮顺手改为环境变量引用。
