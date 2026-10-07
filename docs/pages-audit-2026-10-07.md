# 页面清单与逐页问题审计（2026-10-07）

> 配套文档：`docs/handoff-2026-10-07-refactor.md`（任务背景与交接）。
> 本文是**重构前的现状盘点**，只描述"现在长什么样、问题在哪"，不含最终方案。
> 所有行数与结构均来自 2026-10-07 的代码实测，非推测；标注「待复核」的条目是接手 Agent 需要自己确认的。

---

## 1. 全站共性问题（先看这个，再逐页看）

### 1.1 页头有三套体系，同一种东西长得不一样

`components/PageHeader.jsx` 只有 14 行，**只有 12 个页面在用**；另外 13 个页面各自造了页头：

| 页头形态 | 使用页面 | CSS 类 |
| --- | --- | --- |
| 统一组件 | Posts / Videos / Github / Search / Graph / Favorites / Categories / Tags / Backup / Settings / AdminUsers / RssFeeds | `PageHeader` |
| 影视专用 | Movies | `vod-head` |
| 音乐专用 | Music | `music-head` |
| 工具条 + `<h2>` | RssArticles / PostEdit / MovieEdit / MusicEdit | `toolbar` |
| 详情页专用 | MovieView / MusicView / MusicPlayer / MusicLyrics | `page-bar` / `song-bar` / `np-bar` |
| 完全裸写 | Home（hero）、Login（裸 `<h1>`） | `hero` / 行内 style |

**后果**：kicker、标题、副标题、右侧操作区的位置和字号不统一，同一个"列表页"从博客跳到音乐再跳到 RSS，头部结构都会变。这是用户"组件排布不合理"观感的主要来源之一。

### 1.2 行内 style 过多，说明缺通用类与组件

出现次数最多的文件（`grep -o 'style='`）：

`MovieEdit` 15 · `NotificationBell` 15 · `Backup` 11 · `RssFeeds` 10 · `PostEdit` 10 · `MusicEdit` 10 · `AdminUsers` 10 · `PostView` 9 · `RssArticles` 8 · `GraphView` 7 · `MovieView` 6 · `ThemeCustomizer` 6 · `Tags` 5 · `Search` 5

典型形态：`style="padding:14px"`、`style="gap:10px;flex-wrap:wrap"`、`style="font-size:12px"`。**同一个卡片内边距在四个页面写了四种写法**，说明缺少 `card--pad`、`meta-row`、`chip-row` 这类基础类。

### 1.3 列表页卡片各写各的，通用视图组件只是空壳

`GalleryView.jsx` 20 行、`TimelineView.jsx` 30 行、`ViewSwitch.jsx` 16 行——它们只负责外层容器，**每页自己传 `renderCard`**。于是：

- Videos / Github 的卡片是一种写法，Posts 是另一种，RssArticles 又是另一种；
- `Search.jsx` 甚至没走 `GalleryView`，直接用 `gallery-grid` 拼；
- 卡片内的"元信息行"（日期 / 来源 / 状态 / 标签）在每页重复实现。

### 1.4 编辑页三胞胎几乎一模一样

`PostEdit`(113) / `MovieEdit`(110) / `MusicEdit`(106) 三个文件结构高度重合：`toolbar` + `<h2>` + `form.stack` + 若干 `row style="gap:12px;flex-wrap:wrap"` + 保存按钮。**没有任何共享的表单骨架组件。**

### 1.5 加载态与空态写法不统一

至少四种：`<div class="center-box">加载中…</div>`、骨架屏 `skeleton-card`、组件化的 `EmptyState`、以及各页自己的 `<p class="muted">`。详情页的"加载中"甚至直接复用错误样式位置（`MovieView` 里 `if (!movie) return <div class="center-box">加载中…</div>`）。

### 1.6 样式集中在一个 120KB / 3646 行的 global.css

`frontend/src/styles/global.css` 单文件承载全站样式，已有约 60 个分区注释（顶栏、画廊、时间流、黑胶、歌词、落地页……）。**所有页面样式互相影响，改名要全局搜索**。是否拆分需要评估（拆不好会引入回归），但**必须建立"新增样式写在哪个分区"的规范**。

---

## 2. 逐页清单

格式：**页面 · 路由 · 行数** → 现状 → 问题 → 建议方向（方向仅为参考，最终方案由接手 Agent 出）

### 2.1 公共页（10）

**Home · `/` · 339 行**
- 现状：落地页 hero（badge / 标题 / 副标题 / 双 CTA / 4 个统计数字 / 玻璃预览窗）+ 功能矩阵 + 能力列表 + 步骤 + CTA + 页脚；已登录时切换为"控制台概览"（欢迎区 + 模块磁贴 + 最近添加 + 快捷入口）。
- 问题：一个文件承担"未登录营销页 + 已登录控制台"两种完全不同的信息架构；统计数字（6 资源模块 / 5 渲染引擎）是**硬编码**，与真实数据无关；控制台概览与各模块页面功能重叠。
- 方向：拆成两个路由或两个组件文件；统计数字改为真实数据或删除；控制台概览重新定义为"今日新增 / 未读通知 / 继续观看"等**有行动价值**的信息。

**Login · `/login` · 55 行**
- 现状：`max-width:380px` 的居中表单，登录/注册切换，无品牌视觉。
- 问题：与全站液态玻璃风格脱节；无"忘记密码"、无第三方登录、错误提示用 `style="color:var(--danger)"` 内联。
- 方向：视觉对齐落地页；补齐找回密码与错误态规范。

**Search · `/search` · 106 行**
- 现状：`PageHeader` + `toolbar` 表单 + 结果用 `gallery-grid` 手写卡片。
- 问题：**没有 `ViewSwitch`**（其他列表页都有）；结果卡片与 Posts 卡片重复实现；无搜索历史、无筛选（按类型 / 标签）、无高亮命中词。
- 方向：复用统一卡片；补筛选与命中高亮。

**Graph · `/graph` · 50 行**
- 现状：`PageHeader` + `GraphView`（125 行）+ 空态提示。
- 问题：页面本身很薄，能力是否完整取决于 `GraphView`；缺少交互说明（能拖拽吗？能筛选类型吗？）、无全屏、无图例。
- 方向：明确交互契约并补图例/控制面板。**待复核：`GraphView` 的实际交互能力。**

**Favorites · `/favorites` · 92 行**
- 现状：`PageHeader` + `ViewSwitch` + Gallery/Timeline + 卡片内"打开 / 移除"按钮。
- 问题：收藏夹是**单一扁平列表**，没有"收藏夹分组/命名收藏夹"的概念（而需求文档里提到过收藏夹）；卡片按钮用 `<span>` 包裹而非按钮组。

**Categories · `/categories` · 80 行**
- 现状：`PageHeader` + `ViewSwitch` + 新增表单 + 列表卡片（含删除）。
- 问题：对"分类"提供画廊/时间流双视图**意义不明**（分类是管理型数据，不是浏览型内容）；无排序、无重命名、无"该分类下有多少资源"。

**Tags · `/tags` · 124 行**
- 现状：`PageHeader` + `ViewSwitch` + 新增表单 + 批量删除（复选框）+ 列表。
- 问题：同上，双视图对标签无意义；批量操作与单条删除混在一起；无合并同名标签、无使用量统计。

**Settings · `/settings` · 20 行**
- 现状：`PageHeader` + 一个卡片 + `ThemeCustomizer`。
- 问题：**整个页面只有主题设置**；账号信息、密码、通知偏好、数据导出入口都不在这里（散落在 Backup / 顶栏头像菜单）。
- 方向：Settings 应成为偏好中心，聚合主题、账号、通知、危险区。

**Backup · `/backup` · 88 行**
- 现状：导出卡片 + 导入表单（含两个复选框，行内 style 11 处）。
- 问题：无导入预览/冲突提示的视觉呈现；导入是"选文件直接执行"，缺少二次确认；无历史导出记录。

**AdminUsers · `/admin/users` · 129 行**
- 现状：`PageHeader` + 用户列表卡片（禁用状态、当前账号标记、搜索框）。
- 问题：行内 style 10 处；权限相关操作缺少风险提示（禁用某人意味着什么）；无分页（用户多了会一次拉全）。

### 2.2 内容模块（15）

**Posts · `/posts` · 79 行** — 标准范式页（PageHeader + 新建按钮 + ViewSwitch + Gallery/Timeline + EmptyState）。**这一页是全站最规范的，可作为其他列表页的模板。**

**PostView · `/posts/:id` · 67 行**
- 现状：`toolbar` + 裸 `<h1>`，正文走 `PostRenderer`，底部关联资源卡片。
- 问题：阅读页缺少阅读体验要素——无目录/大纲、无阅读进度、无字号/行宽调节、无上一篇/下一篇；与 `MovieView`（视觉很完整）形成强烈落差。

**PostEdit · `/posts/new` `/:id/edit` · 113 行**
- 现状：toolbar + 表单 + 插入自定义标签按钮 + 实时预览卡片。
- 问题：纯 `<textarea>` 编辑器，无 Markdown/富文本工具栏、无图片上传、无草稿自动保存（行内 style 10 处）。

**Videos · `/videos` · 113 行** — 结构规范（PageHeader + inline-form + 双视图 + EmptyState）。问题：添加后无进度/时长展示、无播放列表概念、卡片信息密度偏低。

**Github · `/github` · 104 行** — 结构同 Videos，规范。问题：无语言/Star 排序筛选、无分组、无刷新按钮同步最新 star 数。

**Music · `/music` · 238 行** ⚠️ **用户重点吐槽 + 当前是半成品**
- 现状（工作树改动后）：`music-head`（kicker + h1 + 搜索框）+ 搜索结果区 + 收藏结果按钮。**音乐库列表、推荐词、发现区块已被删除**，但 `RECOMMEND`(L12)、`shelves`(L184)、`AlbumCard`(L22) 定义仍在，属死代码。
- 问题：页面职责被砍到只剩"搜索"，用户自己的音乐库无处可看；`music-head` 与 `vod-head`、`PageHeader` 三套页头并存；搜索结果行与专辑卡片两套信息密度不同的组件混用。
- 方向：先与用户确认音乐库的归宿（回到本页？独立页面？），再统一页头与卡片体系。

**MusicView · `/music/:id` · 181 行**
- 现状：`song-page` + `song-bar` + 封面/信息/播放控制。
- 问题：与 `MovieView` 的详情页体系（`detail-page` / `detail-hero`）完全不同，一个产品里两套详情页骨架。

**MusicPlayer · `/music/:id/play` · 192 行**
- 现状：全屏沉浸式 now-playing（背景虚化 + 黑胶 + 歌词面板 + 队列）。
- 问题：视觉是亮点，但**路由耦合播放状态**（必须进这个页面才在播？）；空态时展示"还没有正在播放的歌曲"并给出返回按钮，说明存在"进来却没在播"的状态设计缺陷。

**MusicLyrics · `/music/:id/lyrics` · 180 行**
- 现状：`lyric-page` + `np-bar` + 侧栏封面 + 同步歌词列表。
- 问题：与 `MusicPlayer` 里的歌词面板**功能重复**（两个地方都能看同步歌词）；`np-bar` 在三个页面各写一遍。

**MusicEdit · `/music/new` `/:id/edit` · 106 行** — 同编辑页三胞胎问题（行内 style 10 处）。

**Movies · `/movies` · 271 行** ⚠️ **用户重点吐槽**
- 现状：`movies-page` + `vod-head`（kicker "Movie Library" + h1 影视库 + 搜索框）+ `reco-panel`（可折叠的推荐片单，按地区分组）+ 结果列表 + 库列表。
- 问题：页头与前两套体系又不一致；推荐面板（reco-panel）占了首屏很大空间且与搜索结果争抢注意力；结果卡片信息密度高（年份 / 进度 / 多按钮）但缺少海报网格布局——影视类产品通常以**海报墙**为主视觉，这里却是列表行；两个列表（搜索结果 / 我的库）在同一个滚动流里，层级不清。
- 方向：影视库应以海报网格为主；推荐区应降级或独立；搜索与库要有明确分区或标签页。

**MovieView · `/movies/:id` · 239 行** — 全站视觉最完整的页面（`detail-hero` + 背景大图 + 海报 + 评分/集数/线路标签 + 导演主演 + 简介 + 操作区 + `MoviePlayer`）。问题：这套精良的详情页骨架**没有被任何其他模块复用**。

**MovieEdit · `/movies/new` `/:id/edit` · 110 行** — 同编辑页三胞胎问题（行内 style 15 处，全站最多）。

**RssFeeds · `/rss` · 165 行**
- 现状：`PageHeader` + 添加订阅表单 + 订阅源卡片列表（未读计数 / 暂停标记 / URL / 删除）+ 跳转"浏览条目"。
- 问题：订阅源是**扁平列表**，无分组/文件夹、无拖拽排序、无订阅源级刷新与错误状态展示（抓取失败了用户看不到）；行内 style 10 处。

**RssArticles · `/rss/articles` · 125 行** ⚠️ **用户点名要对标 Folo**
- 现状：`toolbar` + `<h2>RSS 条目</h2>` + 未读筛选复选框 + `ViewSwitch` + Gallery/Timeline 卡片列表，卡片上"阅读原文"。
- 问题：**没有阅读器形态**——条目只在站内卡片列表里，点"阅读原文"跳外链；没有三栏布局（订阅源 / 条目列表 / 正文阅读区）、没有未读计数导航、没有键盘快捷键（`j`/`k`/`s`）、没有已读自动标记、没有按订阅源筛选、没有稍后读/收藏到知识库的入口。对照 Folo 的能力差距是**结构性**的，不是美化问题。

---

## 3. 对标参考（用户已点名 + 建议调研）

| 模块 | 用户点名 | 建议一并调研（需联网核实，勿凭印象抄） |
| --- | --- | --- |
| RSS | **Folo**（`https://github.com/RSSNext/Folo`） | FreshRSS、Miniflux、NetNewsWire、Readwise Reader |
| 音乐 | — | Navidrome / Feishin 的库管理、Spotify Web 的搜索-列表-播放层级 |
| 影视 | — | Jellyfin、Emby 媒体库海报墙、Letterboxd 的详情页信息层级 |
| 博客阅读 | — | Obsidian Publish、Notion 的排版与目录、VitePress 文档站的侧栏 |
| 设计系统 | — | 仅取"组件分层与间距规范"思路，**不要照搬紫色/默认审美**，项目已有自己的液态玻璃语言，须保持一致 |

> 调研方法：用 Agentik 的 `serper/search`（约 $0.001/次）与 `exa/search`（约 $0.007/次）检索，把结论写进 `docs/`。详见 handoff 文档第 5 节。

---

## 4. 建议的处理优先级

| 优先级 | 内容 | 理由 |
| --- | --- | --- |
| P0 | 统一页头体系 + 统一列表卡片 + 统一加载/空态 | 全站共性问题，改一处受益 25 个页面；也是用户"排布不统一"的根因 |
| P0 | Music / Movies 两页的重排（含 Music 半成品收尾） | 用户明确点名 |
| P1 | RSS 阅读器化（对标 Folo） | 用户明确点名，且是结构性缺口，工作量最大 |
| P1 | 编辑页三胞胎抽公共骨架 | 消除重复，降低后续维护成本 |
| P2 | 详情页骨架统一（MovieView 的优秀骨架下沉复用） | 提升一致性，性价比高 |
| P2 | Settings 扩展为偏好中心、Search 补筛选 | 完善度提升 |
| P3 | 落地页拆分、真实数据统计、AdminUsers 分页 | 打磨项 |

**每完成一项就同步更新 `docs/progress.md`**（项目既有约定）。
