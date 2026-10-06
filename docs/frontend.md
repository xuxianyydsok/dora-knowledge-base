# 前端说明（Phase1）

技术栈：Preact + preact-router + Vite，Supabase Auth 登录，Cloudflare Pages 托管。

## 目录
```
frontend/src/
├── main.jsx            # 入口，注入全局样式
├── app.jsx             # Provider 组合 + 路由
├── lib/
│   ├── config.js       # 运行时配置（Vite 环境变量）
│   ├── supabase.js     # Supabase Auth 客户端
│   ├── api.js          # 后端 REST 客户端（自动附带 JWT）
│   ├── auth.jsx        # 鉴权上下文（会话 + 角色）
│   ├── theme.jsx       # 主题上下文（light/dark）
│   └── viewMode.jsx    # 视图模式上下文（gallery/timeline）
├── components/
│   ├── Layout.jsx      # 全局布局（顶栏/导航）
│   ├── Card.jsx        # 通用卡片
│   ├── TagChip.jsx     # 标签徽章（自定义颜色）
│   ├── GalleryView.jsx # 画廊网格视图
│   ├── TimelineView.jsx# 时间流视图
│   ├── ViewSwitch.jsx  # 视图切换
│   ├── ThemeToggle.jsx # 主题切换
│   └── ProtectedRoute.jsx # 受保护路由
├── routes/
│   ├── Home.jsx / Login.jsx / Categories.jsx / Tags.jsx
│   └── routes.js       # 懒加载路由表
└── styles/global.css   # 主题变量与组件样式
```

## 关键设计
- **路由分包**：非首页路由通过 `preact/compat` 的 `lazy` + 动态 `import()` 按路由拆分。
- **主题**：CSS 变量定义浅色/暗色两套，`data-theme` 属性切换，持久化到 localStorage。
- **双视图**：`gallery`/`timeline` 全局上下文切换，所有资源板块复用 `Card` + 两个视图组件。
- **角色**：登录后调用 `/api/me` 获取 `user_profiles.role`，而非依赖 `user_metadata`。
- **重型库懒加载**：KaTeX/Three.js/Mermaid/Chart.js/D3 在 Phase2+ 博客页按需加载，Phase1 不引入。

## 环境变量（frontend/.env.local，禁止提交）
```
VITE_API_BASE_URL=http://127.0.0.1:8787
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

---

# Phase2 新增前端内容

## 新增目录
```
frontend/src/
├── renderers/                 # 重型库懒加载与渲染（仅博客页按需触发）
│   ├── loader.js              # 动态 import 加载器（缓存）
│   ├── katex.js               # <katex-inline> / <katex-block>
│   ├── mermaid.js             # <mermaid-chart>
│   ├── chart.js               # <chart-2d>（JSON 配置）
│   └── three.js               # <three-scene>（JSON 配置）
├── components/
│   ├── PostRenderer.jsx       # 博客渲染引擎（检测标签 -> 懒加载渲染器）
│   └── VideoPlayer.jsx        # iframe 播放器 + 进度上报
└── routes/
    ├── Videos.jsx             # 学习视频库
    ├── Github.jsx             # GitHub 收藏
    ├── Posts.jsx              # 博客列表
    ├── PostEdit.jsx           # 博客编辑（标签插入 + 实时预览）
    └── PostView.jsx           # 博客阅读
```

## 懒加载策略（强制规范）
- 首页、视频/GitHub/博客**列表页**不加载 KaTeX/Three.js/Mermaid/Chart.js。
- 仅当博客正文（阅读页或编辑器预览）出现对应自定义标签时，`PostRenderer` 才动态
  `import()` 对应渲染器与库。
- 构建产物验证：`dist/index.html` 不含任何重型库的 `modulepreload`；入口 JS 不引用
  `katex/mermaid/three/chart` chunk。

## 自定义标签用法（正文原生 HTML 中）
```html
<katex-inline>a^2+b^2=c^2</katex-inline>
<katex-block>\int_0^1 x^2 dx</katex-block>
<mermaid-chart>graph TD;A-->B;</mermaid-chart>
<chart-2d>{"type":"bar","data":{"labels":["A","B"],"datasets":[{"label":"示例","data":[3,5]}]}}</chart-2d>
<three-scene>{"objects":[{"type":"box","color":5847279}]}</three-scene>
```

## 路由
| 路径 | 页面 |
| --- | --- |
| `/videos` | 学习视频库（抓取新增、iframe 播放、进度保存） |
| `/github` | GitHub 收藏（抓取新增、刷新 star） |
| `/posts` | 博客列表 |
| `/posts/new`、`/posts/:id/edit` | 博客编辑 |
| `/posts/:id` | 博客阅读 |

---

# Phase3 新增前端内容

## 新增目录
```
frontend/src/
├── components/
│   ├── GraphView.jsx          # D3 力导向图谱（D3 懒加载）
│   ├── NotificationBell.jsx   # 通知中心面板（未读徽标 + 下拉）
│   └── ThemeCustomizer.jsx    # 主题自定义配色面板
└── routes/
    ├── Search.jsx             # 全局搜索
    ├── Graph.jsx              # 资源关联图谱
    ├── Favorites.jsx          # 收藏夹管理
    ├── Backup.jsx             # 导入导出备份
    └── Settings.jsx           # 设置（主题配色）
```

## 新增路由
| 路径 | 页面 |
| --- | --- |
| `/search` | 全局搜索（按类型/资源类型过滤） |
| `/graph` | 资源关联图谱（D3 力导向，可拖拽/缩放） |
| `/favorites` | 收藏夹（画廊/时间流双视图） |
| `/backup` | 导入导出备份 |
| `/settings` | 主题自定义配色 |

顶栏新增：🔍 搜索入口、🔔 通知铃铛（含未读徽标，每分钟轮询）、⚙️ 设置、💾 备份。

## 懒加载说明
- **D3** 仅在 `/graph` 路由的 `GraphView` 中通过 `await import('d3')` 加载，首屏不引入。
- 构建验证：`dist/index.html` 无任何重型库 `modulepreload`；入口 JS 对 Graph/D3 chunk 均为动态 `import()`。
- 现有 KaTeX/Mermaid/Chart.js/Three.js 仍遵循 Phase2 的「博客页按需加载」策略。

## 主题自定义配色
- 可在 `/settings` 分别配置浅色/暗色两套配色（9 个变量）。
- 通过 CSS 变量覆盖实现，即时预览；「保存配色」持久化到后端 `user_preferences`。
- 登录后自动从后端加载已保存配色；未登录时回退到 localStorage。
- 配色值受后端白名单与 `#RRGGBB` 格式校验。

---

# Phase4 新增前端内容：音乐库

## 新增文件
```
frontend/src/
├── components/
│   └── AudioPlayer.jsx    # HTML5 音频播放器（播放/进度条/音量/进度记忆）
└── routes/
    ├── Music.jsx          # 音乐库列表（元数据搜索新增 + 画廊/时间流双视图）
    ├── MusicView.jsx      # 音乐详情（封面/元信息/播放器/标签/备注/歌词）
    └── MusicEdit.jsx      # 音乐编辑（新建/编辑）
```

## 新增路由
| 路径 | 页面 |
| --- | --- |
| `/music` | 音乐库列表 |
| `/music/new` | 手动添加音乐 |
| `/music/:id` | 音乐详情 |
| `/music/:id/edit` | 编辑音乐 |

顶栏导航新增「音乐」入口。

## 音频播放器
- 使用原生 `<audio>` 元素，播放地址为外部直链，后端不转发音频流。
- **进度记忆**：加载时自动定位到上次 `position`；播放中每 5 秒上报一次；暂停/听完时也上报。
- 支持进度条拖动、音量调节、「标记听完」。

## 与其他模块的集成
- **全局搜索**：`/search` 的资源类型下拉新增「音乐」；点击结果跳转音乐详情。
- **资源图谱**：音乐作为 `resource` 节点（`resource_type='music'`）展示，含标签边。
- **收藏夹**：可将音乐加入收藏夹并正常展示。
- 音乐列表/详情页复用 Phase1 的通用卡片与画廊/时间流双视图组件。

---

# Phase5 新增前端内容：RSS 订阅 + 影视库

## 新增文件
```
frontend/src/
├── components/
│   └── MoviePlayer.jsx     # HTML5 视频播放器（播放/进度条/音量/进度记忆）
└── routes/
    ├── Movies.jsx          # 影视列表（元数据搜索新增 + 画廊/时间流双视图）
    ├── MovieView.jsx       # 影视详情（海报/元信息/播放器/标签/简介/备注）
    ├── MovieEdit.jsx       # 影视编辑（新建/编辑）
    ├── RssFeeds.jsx        # RSS 订阅源管理（增删改/手动抓取/OPML 导入导出）
    └── RssArticles.jsx     # RSS 条目浏览（按源筛选/未读过滤/标记已读/双视图）
```

## 新增路由
| 路径 | 页面 |
| --- | --- |
| `/movies` | 影视库列表 |
| `/movies/new` | 手动添加影视 |
| `/movies/:id` | 影视详情 |
| `/movies/:id/edit` | 编辑影视 |
| `/rss` | RSS 订阅源管理 |
| `/rss/articles` | RSS 条目浏览（支持 `?feed_id=`） |

顶栏导航新增「影视」「RSS」入口。

## 影视播放器
- 使用原生 `<video>` 元素，播放地址为外部直链，后端不转发视频流。
- **进度记忆**：加载时自动定位到上次 `position`；播放中每 5 秒上报一次；暂停/播完时也上报。
- 支持进度条拖动、音量调节、全屏、「标记看完」。

## RSS 条目
- 源列表展示未读数与上次抓取时间，支持「立即抓取」「暂停/启用」。
- 条目页支持按订阅源筛选、仅看未读、单条已读/未读、全部已读。
- 新条目由后端抓取时自动写入通知中心（`rss_new`），顶栏铃铛可见。
- OPML 导入支持 `.opml/.xml` 文件，导出直接下载 `knowledge-base-rss.opml`。

## 与其他模块的集成
- **全局搜索**：资源类型下拉含「影视」「RSS」；影视结果跳转 `/movies/:id`。
- **资源图谱**：影视作为 `resource` 节点（`resource_type='movie'`）展示，含标签边；点击跳转详情。
- **收藏夹**：影视与音乐结果点击后跳转对应详情页。
- 列表/详情页复用 Phase1 的通用卡片与画廊/时间流双视图组件。

# Phase6 后续：SaaS 液态玻璃风格改造 + 品牌更名 dora

## 品牌
- 站点名统一为 **Dora**（顶栏 brand、`index.html` 标题/描述、落地页页脚与 CTA）。
- 顶栏「首页」导航已移除：点击品牌图标即可回到首页，避免重复入口。
- 品牌图标：`src/components/Logo.jsx`（六边形「知识晶体」SVG，渐变 id 带自增后缀防同页冲突）+ `public/favicon.svg` 同款。

## 字体（自托管，见 `src/styles/fonts.css`）
| 用途 | 字体 | 文件 |
| --- | --- | --- |
| UI / 标题 | Satoshi（Claude 所用 Styrene 的开源近似体） | `public/fonts/satoshi-{400,500,700}.woff2` |
| 博客正文 | Newsreader（Claude 所用 Tiempos 的衬线近似体） | `public/fonts/newsreader-{400,500}.woff2` |
| 代码块 | `ui-monospace` 系统等宽字体 | — |

- 字体随站点一起发布，不依赖 Google Fonts / Fontshare CDN，国内访问更稳定。
- Satoshi 为拉丁字形，中文自动回退到 `PingFang SC` / `Microsoft YaHei` 等系统字体。
- 博客正文（`.post-content-wrap`）使用 Newsreader，行高 1.85、字号 17.5px，贴近 Claude 的阅读观感。

## 图标系统（`src/components/Icon.jsx`）
现代线性图标集，24×24 网格、`stroke` 描边、颜色继承 `currentColor`，全部内联 SVG，无外部请求。

```jsx
import { Icon } from '../components/Icon.jsx';
<Icon name="blog" size={20} />
<Icon name="crown" size={14} class="crown-mark" />
```

可用名称（`ICON_NAMES`）：`blog` `video` `github` `movie` `music` `rss` `search` `graph` `star` `bell`
`palette` `backup` `sun` `moon` `settings` `crown` `logout` `arrowRight` `arrowLeft` `linkBroken`
`sparkles` `layers` `play` `dot` `globe` `calendar` `clock` `tag` `external` `plus` `close`

- 落地页功能矩阵、能力列表、控制台磁贴、顶栏按钮、卡片元信息与各模块标签全部改用图标，替换掉原有 emoji。
- 模块配色：`tone-indigo`（博客）/ `tone-rose`（视频）/ `tone-slate`（GitHub）/ `tone-violet`（影视）/ `tone-teal`（音乐）/ `tone-amber`（RSS）；暗色主题下自动提亮（`[data-theme='dark'] .tone-*`）。
- 辅助类：`.meta-item`（图标 + 文字）、`.chip-icon`（标签胶囊内图标）、`.dot-live` / `.dot-draft`（状态圆点）。

## 品牌质感特效
- **渐变流光文字**：顶栏 `Dora` 与落地页 `.hero-grad` 使用 `background-clip: text` + 缓慢位移的渐变（`grad-shift`），悬停时顶栏文字流光扫过。
- **图标流光**：`Logo.jsx` 内 `.brand-sheen` 由 SVG `<animate>` 驱动，悬停时在立方体内部斜向扫光（`clip-path` 裁剪，`mix-blend-mode: screen`）。
- **脉冲光环**：悬停时 `.brand-halo` 播放 `halo-pulse`（放大 + 淡出），并叠加 `drop-shadow` 发光。
- 全部动效在 `prefers-reduced-motion: reduce` 下自动降级。

## 新增文件
| 文件 | 说明 |
| --- | --- |
| `src/components/Logo.jsx` | 品牌 SVG 图标 |
| `src/components/PointerGlow.jsx` | 鼠标跟随聚光层，`rAF` 节流，触摸 / 降级环境自动禁用 |
| `src/lib/tilt.js` | `attachTilt()` 卡片 3D 倾斜，触摸 / 降级自动跳过 |
| `public/favicon.svg` | 站点图标 |

## 样式改造（`src/styles/global.css`）
- 新色板：浅色 `--bg:#eef1f8 --primary:#4a6cf7`；暗色 `--bg:#0a0c12 --primary:#6f8dff`。
- 玻璃派生变量（`--glass-bg` / `--glass-border` / `--glass-highlight` / `--glow-*`）用 `color-mix()` 从主题变量计算，**主题自定义配色面板依旧生效**。
- `body` 极光渐变背景（`background-attachment: fixed`）、`.pointer-glow` 鼠标聚光、按钮高光扫过、卡片 3D 悬停。
- 动画：`fade-up` / `pop-in` / `float-y` / `grad-shift` / `pulse-dot`；末尾 `@media (prefers-reduced-motion: reduce)` 降级。
- 落地页样式（`.landing` / `.hero` / `.feature-grid` / `.cap-grid` / `.step-grid` / `.cta` / `.dash-*`）。

## 首页（`src/routes/Home.jsx`）
- 未登录：SaaS 落地页（Hero / 能力矩阵 / 能力列表 / 四步流程 / CTA / 页脚）。
- 已登录：控制台概览，并发统计博客、视频、GitHub、音乐、影视、RSS 数量，卡片可点击跳转。

# 音乐播放器与同步歌词（黑胶风格）

## 黑胶唱片（`src/components/AudioPlayer.jsx`）
- 播放时唱片持续旋转（`.vinyl-disc.spinning` → `@keyframes vinyl-spin`），暂停即停。
- 唱片中心为**专辑封面**，右下角为**歌手头像**（`.vinyl-avatar`，悬停放大）。
- 悬停唱片显示「歌词」提示，**点击唱片或「歌词」按钮**进入歌词页。
- 唱片带纹路高光（`.vinyl-grooves` 锥形渐变）与主色光晕。

## 播放地址与音质
- `audio_url`（完整音轨）优先，其次 `preview_url`（试听），最后 `music.url`。
- `audio_fallbacks` 为多音源节点地址数组；主地址播放失败（如 Audius 单节点 403）时
  `onError` 自动切换到下一个节点。
- 卡片与详情页用 `.quality-tag` 标注「完整音轨」（`.quality-full`）或「试听片段」（`.quality-preview`）。

## 同步歌词页（`src/routes/MusicLyrics.jsx`，路由 `/music/:id/lyrics`）
- 歌词来自 `POST /api/music/lyrics`（LRCLIB），`synced` 为 LRC 格式。
- 客户端解析 `[mm:ss.xx]` 时间轴为行数组，按播放进度计算当前行：
  当前行**放大 + 主色高亮 + 左侧色条 + 光晕**，已唱过的行降低透明度。
- **自动滚动**：当前行居中显示；用户手动滚动时暂停跟随，5 秒后自动恢复（按钮可手动切换）。
- 点击任意歌词行可跳转到该时间点。
- 无时间轴时退化为静态歌词列表；纯音乐显示提示。
- 底部「关于歌手」区块展示歌手头像、专辑与发行年份。

## 相关样式
`.player` / `.vinyl` / `.vinyl-disc` / `.vinyl-cover` / `.vinyl-avatar` / `.quality-tag` /
`.lyrics-panel` / `.lyrics-scroll` / `.lyric-line`（`.active` / `.passed` / `.static`）/ `.artist-avatar`。
