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

## 2.36 首页轮播可由站长配置（2026-10-13，分支 feat/now-settings）

### 用户需求

> 「首页它不是有那些图片吗？我想实现能够在管理员端上传图片，或者说一些视频
>  来进行轮播图的替换」「存在数据库里吧，就新建一个数据库表」「可以复用图展的素材」
>  「视频的话要静音循环。当然，可以开启个开关吧，就是说可以静音，也可以播放那个音乐」
>  「体积的话暂时不限制吧」

> ⚠ 本轮是**上一轮对话被上下文超限打断后接续完成的**。中断时的进度：
> 后端路由 / 迁移 / 前端 api / HeroCarousel 数据获取已写完，但
> **管理端 UI 完全没做**，HeroCarousel 的静音开关也只加了状态没加按钮。

### 方案：只存引用，不重复存文件

新表 `hero_slides`（迁移 `20261013000027_hero_slides.sql`）**只存对图展素材的引用**：

| `source` | 指向 | 形态 |
| --- | --- | --- |
| `asset` | `assets` 表 | 图片 |
| `wallpaper` | `wallpapers` 表 | 视频 |

**为什么不在首页再传一遍文件**：图展已有完整的上传 + R2 + 策展流程，
首页只是「挑几张出来展示」。复制文件会导致「同一张图存两遍」「删了图展首页还挂着破图」。
两张素材表都设 `on delete cascade` —— 删图展素材时首页引用自动消失，不留死引用。

### 本轮完成内容

**后端**（`backend/src/routes/heroSlides.js`，新增）

| 接口 | 鉴权 | 作用 |
| --- | --- | --- |
| GET `/api/hero/slides` | 访客可读 | 列出；访客只看 `is_active=true` **且素材已公开**的项 |
| POST `/api/hero/slides` | 管理员 | 从图展挑一个素材加入（去重、校验归属） |
| PUT `/api/hero/slides/order` | 管理员 | 批量重排（数组下标即 `sort_order`） |
| PATCH `/api/hero/slides/:id` | 管理员 | 改图注 / 启用 / 静音 |
| DELETE `/api/hero/slides/:id` | 管理员 | 移除引用（不删素材本身） |

- `router.js` 接 5 条路由，**`/order` 必须排在 `/:id` 之前**（否则被当 id 吞掉）；
- `publicScope.js` 白名单加 `hero`（访客只读，写操作仍被挡）；
- 返回结构统一给 `media_url` + `media_type`（前端不用管底层是图还是视频），
  另给 `media_public` 供管理端提示「素材还没公开，访客看不到这一条」。

**前端**

| 文件 | 变化 |
| --- | --- |
| `components/HeroCarousel.jsx` | 优先读 `/api/hero/slides`，失败 / 为空**回退内置 18 张图**；支持视频（静音循环自动播）；新增喇叭开关（用户主动点开可出声，浏览器只拦「自动播放」） |
| `components/Icon.jsx` | 加 `volumeOff` 图标 |
| `routes/Gallery.jsx` | 新增「首页轮播」抽屉（`HeroDrawer`）：从图展图片 / 动态壁纸挑入、上下移动、启用开关、视频静音开关、图注、移除；页头加「首页轮播」入口按钮 |
| `styles/home-landing.css` | `.ld-hero-sound` 静音按钮 |
| `styles/gallery-timeline.css` | 抽屉里的类型角标 / 未公开警告样式 |
| `lib/api.js` | 5 个方法（列表 / 新增 / 改 / 删 / 重排） |

**图展接口的一处改动**：`GET /api/gallery` 每条多返回 `asset_id`
（轮播要用它建立引用）。公开地址 `/api/assets/<id>` 本身就含这个 id，不构成额外泄露。

### 验证

- 后端单测 **139 项全过**（新增 3 项：路由顺序与写权限、访客白名单 + 私人素材不下发、
  外键 cascade 与「不存文件字节」）；
- 新增前端探针 `frontend/tests/heroCarousel.probe.mjs` **25 项全过**
  （后台配置优先 / 接口失败回退 18 张 / 空配置回退 / 视频静音循环 / 静音开关 / 管理端四接口契约）；
- 其余前端探针无回归：`justified` 50、`gallery` 17、`favorites`、`changelog` 39、
  `queueOrder`、`miniPlayer`、`musicIdentity` 19、`coop` 20、`ui-buttons` 18、
  `fontUnify` 11、`graphStats` 42、`statCharts` 311、`readerSwipe`、`star3dLayout` 53、
  `bilibili` 51；`bookshelf` 11 过 / 1 失败（已知噪声：本地无 Supabase 配置）；
- 生产构建成功（`npm run build`）。

### 坑与教训

1. **Preact 对 `<video muted>` 的更新不可靠**：只改 props 有时不会作用到正在播放的元素上。
   静音状态一律用 `ref` 直接写 `el.muted`（并顺手 `play()`）。
2. **探针的 DOM shim 要声明媒体属性**：`muted` / `autoPlay` 在真 DOM 上是**属性**（不是 attribute），
   shim 里没有它们时，组件写 `el.muted = …` 会静默写到一个不存在的字段上，
   断言也会误判。`autoPlay` 必须是**驼峰**（preact 靠 `'autoPlay' in el` 决定写属性还是 attribute）。
3. **探针跑完要卸载组件**：`HeroCarousel` 的自动轮播是 `setInterval`，
   不卸载会一直挂在事件循环上，探针要等 2 分钟才被 timeout 掐掉（卸载后 1.1 秒）。
4. **本地 5173 端口可能被别的项目占用**（本轮被 `math-modeling-studio` 的 vite 占着）：
   跑真浏览器探针前先确认端口上确实是本项目，否则会拿到「整页没渲染」的假失败。
   用 `PROBE_BASE` / `UI_BASE` 环境变量换端口（本轮用 5180）。

### 下一步

- 线上跑一次迁移（`20261013000027_hero_slides.sql`）后，站长在图展页「首页轮播」里实测一次。
- 视频体积目前**不限制**（用户明确说「暂时不限制」）；若首屏变慢，再考虑加体积上限。

---

## 2.35 影视源修「只有 3 条源」+ 音乐上传收紧（2026-10-13，分支 feat/now-settings）

### 追加：给 AI 的写作基建 + 撤销导航栏「更多」下拉（同日）

**用户需求**：「后续可能直接让 Agent 帮我写博客文章，但它不知道我写了哪些文章、
文章的规格是什么样的」「换电脑后可以让 Agent 把项目拉下来，找到 MCP 连接上，
直接把我写的文章告诉它」。

**一、`AGENTS.md`（仓库根目录，最关键的一环）**
- Agent 克隆仓库后**自动读取**的进门须知（Codex / Claude Code / Cursor 都认这个约定）。
- 内容：项目结构与技术栈、部署方式（GitHub Actions / Cloudflare / Supabase）、
  MCP 接口与鉴权、写作规范入口、本地环境、常用命令、行为约定、文档地图。
- **为什么它是关键**：没有它，「换电脑 → clone → 让 Agent 写文章」就不成立 ——
  Agent 不知道这个项目怎么部署、怎么连 MCP、文章该怎么写。

**二、`docs/blog-writing-guide.md`（写作规范）**
- 从现有 **315 篇**文章反推出来的实际规格（不是凭空写的）：
  正文 HTML 骨架（`<section>` + `<h2>` 中文序号）、8~9 节、4500~7000 字、
  标题「分类（中文序号）：副标题」、slug 规则 `<分类slug>-<两位序号>-<英文关键词>`、
  14 个分类对照表、29 个已有标签、可用自定义标签（katex/three/mermaid/chart）、
  **三篇范文**（真实文章片段）、常见错误对照表。

**三、新增 3 个 MCP 查询工具（让 Agent「看得见」）**
| 工具 | 用途 |
|---|---|
| `list_posts` | 按分类/状态/关键词查已有文章 —— 写前查重、确认序号 |
| `list_categories` | 分类及每类篇数 —— 判断新文章归哪类 |
| `list_tags` | 标签及 id —— `create_post` 的 `tag_ids` 只收 UUID，必须能查 |

**四、`tools/` 两个脚本**
- `mcp-login.mjs`：用站长邮箱密码换 JWT 存 `.mcp-token`（已加 `.gitignore`）。
  解决「JWT 一小时就过期，新电脑上的 Agent 怎么拿」的问题。
- `publish-post.mjs`：一条命令发文 —— 自动查分类算序号 → 生成 slug →
  校验序号是否与推算一致 → 调 MCP 发布。支持 `--dry-run` / `--draft` / `--private`。

**五、撤销导航栏「更多」下拉（用户同日改主意）**
- 原话：「还是不要添加那个更多的那个按钮，还是把更新和共创放出来，在那个导航栏上」。
- `PRIMARY` 恢复 13 项（更新 / 共创回到一级导航），删除 `MORE` 常量与下拉样式。
- `Dropdown` / `MenuLink` 组件保留 —— 管理员下拉菜单还在用。

**踩坑修复（重要）**
`list_posts` 最初写成「先取最新 N 条 → 再在内存里按分类过滤」，
导致「软件工程」明明 8 篇、接口只返回 1 篇（其余 7 篇被 limit 截掉了）。
**AI 拿到这种错误结果会直接写出重复序号**（以为这个分类只写到第一篇）。
已改为**过滤下推 SQL**：分类先解析成 `category_id` 再查、关键词用 `ilike`。
修复后线上实测返回完整 8 篇。

**验证**：后端 136 项全过；线上实测 `list_tags` 29 个标签、`list_categories`
14 个分类及篇数、`list_posts` 按分类返回 8 篇完整列表；导航栏 13 项、「更多」按钮已移除。


### 追加：B 站曲目 + 导航栏「更多」+ 视频库收归站长（同日）

用户原话：「上传音乐的时候可以上传一个哔哩哔哩的链接」「我需要的就是那个视频窗口，
比如有些音乐是以 MV 形式呈现的，直接看那个视频」「一、二、三的话都要做」
（指清理冗余、导航收窄、视频库仅管理员）。

**一、B 站视频曲目（MV）**
- 形态：**嵌入 B 站官方播放器**（iframe），不走 `<audio>`。
  实测原因：B 站取流接口不给浏览器跨域；后端代取受机房 IP 限流
  （Worker 里请求 B 站的 API / 首页 / 播放器页**三个域名全部超时**，
  而同一链接在本机秒回）。官方播放器由用户浏览器直连，不受影响。
- 前后端各一份 `lib/bilibili.js`（规则一致，有探针断言两边结果相同）：
  链接解析（完整链接 / 手机端 / 播放器链接 / 纯 BV 号 / 分 P / b23.tv 短链识别 /
  av 号识别）、嵌入地址生成、校验、播放页地址。
- 管理员上传页新增「添加 B 站视频（MV）」区；音乐页曲目带 **B站 徽章**。
- 「全部播放 / 随机」排除 B 站曲目（没有 audio_url，混进音频队列会卡住）。
- 已知限制：iframe 跨域读不到播放进度，底部播放条对 B 站曲目不显示进度（UI 已注明）。
- **不做封面与歌词刮削**（用户明确决定）：视频里画面与歌词都有，再挂封面反而突兀。

**二、导航栏「更多」下拉**
- 一级导航 13 → **11 项**，「更新日志 / 共创」收进「更多」下拉。
- 新增 `MORE` 常量；复用已有的 `Dropdown` 组件；按钮样式与 `.app-nav a` 完全一致
  （字号 / 字重 / 内边距 / 圆角），避免比旁边链接高一点而显得不齐。

**三、视频库收归站长可见**
- 三处同时约束（缺一处就会漏）：
  · 前端路由 `/videos` 走 `ProtectedRoute admin`（新增 `admin` 属性）
  · 入口只在管理员下拉菜单里
  · 后端 `routes/videos.js` 全部 8 个 handler 改用 `requireAdmin`
- 为什么连接口一起锁：只挡前端的话，知道 URL 的人仍能直接调接口拿数据。
- 数据与代码完整保留（用户要求「先留着，后续看是否需要开发」），将来放开只需去掉这三处。

**顺带修的**
- 搜索页与站长控制台里的**死链接**：搜到 video 类型结果点进去会跳 `/videos`，
  而该页已下线并重定向回首页（看起来像坏了）。现在按身份分流。
- 音乐页「7 路上游检索」、影视页「12 个采集源」写死数字 → 改为不写死（实际音乐已 9 路）。
- 访客在全局搜索里不再返回 video 类型（后端按身份过滤），避免「搜得到点不进」。

**验证**：`bilibili` 探针 51 项、后端单测 136 项、`changelog` 39 项全过；
无头 Chrome 实测：导航栏 11 项 + 「更多」下拉两项、访客访问 /videos 跳登录页、
访客搜索 video 类型 0 条。


### 追加：图谱改成三维（2D / 3D 可切换）（同日）

**用户原话**：「我想把那个就是图谱的最开始的那两张的话，就是改成这种三维的效果」
「二弟的话还是保留，只是说要添加一个 3D 的按钮，还是说在它的后面就跟着一个 3D 的」
「根据你的建议来。然后第二点的话是缓慢自转」。

**采纳的方案**：**2D 与 3D 并存**，画布右上角一个「2D / 3D」切换按钮。
- 桌面默认 **3D**、手机默认 **2D**（窄屏 <900px 或 `deviceMemory ≤ 4` 自动降级）。
- 2D 版（`StarMap.jsx`）**一行未改**，只是把 `buildScene` 加了个 `export` 供 3D 复用。

**为什么 3D 复用 2D 的 `buildScene`**：两边用同一批「星区 / 星点 / 连线 / 邻居表」，
只是坐标从二维圆盘映射到三维空间。这样分类配色、筛选联动、悬停语义完全一致，
不会出现「2D 和 3D 看起来是两个东西」。

**文件划分**
| 文件 | 职责 |
|---|---|
| `lib/star3dLayout.js` | **纯函数**：二维→三维坐标映射、颜色转换、包围盒、布局自检。零依赖，Node 可直接测 |
| `components/StarMap3D.jsx` | three 场景、着色器、相机、交互（拖动 / 滚轮 / 悬停 / 点击） |
| `tests/star3dLayout.probe.mjs` | 28 项离线断言（数组长度、坐标有限、中心留空、尺度合理、稳定性、边界输入） |

**性能取舍**（博客 358 点 / 1022 边，开源更大）
- 节点用**单个 `THREE.Points`**（一次 draw call），不给每个点建 Mesh；
- 连线用**单个 `LineSegments`**；
- 逐点大小 + 圆形柔边用自定义着色器（`PointsMaterial` 是方块且不支持逐点大小）；
- 设备像素比上限 2；切标签页时暂停渲染循环。

**实测**（无头 Chrome + 真实图谱数据）
- 渲染：358 点全部画出，深空底 + 彩色星点 + 连线，截图确认（不是白屏/全黑）；
- 缓慢自转：两帧截图不同；拖动旋转、滚轮缩放均生效；
- 悬停：显示文章标题气泡；点击：触发跳转回调（实测进入《朗兰兹纲领》一文）；
- 卸载干净：切回 2D 后 WebGL 上下文与监听全部释放；
- 窄屏分流：1440px → 3D，390px → 2D。

**踩坑记录（都是实测才暴露的）**
1. **`ShaderMaterial` 不会自动注入 `color` attribute** —— 漏写 `attribute vec3 color`
   时 `vColor` 拿到未定义值，整片星点渲染成黑色。症状：画布只有深空底，一颗星都看不见。
2. **`pickAt` 未命中返回 `null` 而不是 `-1`** —— 调用处用 `i < 0` 判断，
   而 `null < 0` 是 false，一路走到 `geo.points[null].label` 抛异常。
   症状：悬停完全没提示气泡，控制台报 `Cannot read properties of undefined`。
3. **`root.matrixWorld` / `cam` 不会自己更新** —— 只在 `render()` 时更新，
   拾取发生在两次 render 之间时矩阵还是旧的，投影坐标全错。必须显式
   `updateMatrixWorld()`。症状：悬停永远不命中。
4. **星云中心是空的**（半径从 0.35 起步）—— 测试一开始一直点画布正中，
   结果 18px 内一个点都没有。这不是 bug，但排查时容易误判成拾取坏了。
5. **抽离模块时误删 `ROTATE_SPEED`** —— 单测全过（那个常量不在 lib 里），
   但浏览器里每帧抛 `ReferenceError`。说明「纯函数单测」挡不住这类遗漏，
   必须配合浏览器实测。

**追加：3D 也要有流动光点（同日，用户要求）**

用户原话：「3D图里面的，还是要和2D的那个图一样，也是要有那些流动的光点」。

- 2D 版沿随机连线跑光点（粒子 t 从 0 走到 1，带渐变拖尾 + 亮头，加色混合）；
  3D 版对齐同一套观感：**拖尾 = 单个 LineSegments、亮头 = 单个 Points**，
  两者都是每帧只更新 buffer + `setDrawRange`，不做「每个光点一个 Mesh」。
- 纯计算抽进 `lib/star3dLayout.js`：`flowTargetCount`（数量口径与 2D 一致，
  连线数 5%、夹在 60~260）、`stepFlow`（推进与回收）、`flowGeometry`（坐标与透明度）。
- **新粒子的初始 t 必须随机**：若都从 0 起步，第一帧会看到所有光点同时从起点出发、
  之后永远同相位地一起走一起消失，画面像在「整体呼吸」而不是流动。2D 版就是这么做的。
- 悬停联动与 2D 一致：鼠标停在某个点上时**只保留与它相连的光点**，
  这样「谁和谁有关系」一眼能看出来，而不是一团乱流。
- 单测从 28 项扩到 **53 项**（新增光点数量口径、推进、回收、长期运行不增长、
  拖尾几何、越界与 clamp 等）。

**验证**：`star3dLayout` 28 项、`readerSwipe` 19 项、`ui-buttons` 18 项、
`coop` 20 项、`justified` 50 项、`fontUnify` 11 项全过；
`bookshelf` 11 过 / 1 失败（失败项是「有真实图书上架」，本地无 Supabase 配置导致，
线上接口实测有书，与本轮无关）。


### 追加：PDF 改成站内阅读器（微信读书那种）（同日）

**用户原话**：「图书的在线阅读，你能不能做一个像微信读书那样的一个在线阅读器啊？
现在的话，它都是直接跳到那个浏览器阅之前我记得你好像之前做过吧？
然后里面的那些配置就不要变，或者按照微信读书的那种排布方式也可以。」

**问题定位**：EPUB 早就是站内自研阅读器（目录 / 字号 / 字体 / 背景 / 单双页 / 进度条），
**只有 PDF 是直接把文件塞进 `<iframe>` 交给浏览器内置阅读器** ——
工具栏、配色、翻页全由浏览器决定，各家表现不一致，手机上还常变成下载。

**做法**：装 `pdfjs-dist`（Mozilla PDF.js，MIT，1 个包），PDF 也自绘渲染。

| 项目 | 说明 |
|---|---|
| 新文件 | `frontend/src/lib/pdfReader.js`（打开 / 渲染 / 缩放 / 大纲 / 页码工具） |
| 改动 | `components/BookReader.jsx`（PDF 分支走 canvas，新增页码直达、缩放、书签目录）、`styles/books.css`、`vite.config.js`（构建时拷 pdf.js 附加资源） |
| 依赖 | `pdfjs-dist@6.4.299`（`npm install`，经用户同意） |
| 构建产物 | `pdf.min` 480KB 单独分包，**只在打开 PDF 时加载**；`dist/pdfjs/` 4MB（cmaps + 字体 + wasm）由 Pages 静态托管 |

**几个关键取舍**

1. **不整本下载**：`getDocument` 传 URL，pdf.js 自己按 Range 分段取
   （后端 `/api/books/:id/file` 已支持 Range → 206），大文件秒开第一页。
2. **中文 PDF 必须给 cMap**：不给的话 GBK / Big5 旧书整页空白或乱码。
   169 个 bcmap + 16 个标准字体 + 2 个 wasm 由 `vite.config.js` 在构建时拷进
   `public/pdfjs/`（走 public 而不是 import，避免被 Rollup 逐个打进 bundle）。
3. **高分屏**：canvas 按 `devicePixelRatio` 放大再用 CSS 缩回，否则文字发虚。
4. **不引 pdf.js 的 viewer**：那个是完整应用，会和本站路由 / 样式打架；只用 core。
5. **PDF 没有「字号 / 字体」**：固定版面的字是画上去的，改不了。
   这两项换成 PDF 真正有用的**缩放 + 适宽 / 适页**，背景与单双页保留。

**实测**（无头 Chrome + 中文 PDF 样本）

- 渲染管线：2 页文档 → 适宽 143% → canvas 852×1205（dpr=1），
  采样 19371 像素中 1931 个非白、999 种颜色 → 确实画出了内容（不是白屏）。
- 组件 UI：`第 1 / 2 页 · 0%` → 点「下一页」→ `第 2 / 2 页 · 100%`；
  设置面板有「缩放 234% / 适宽 / 适页 / 自定义」，无「字号 / 字体」；
  点「适页」后缩放从 234% 降到 100%；**页面内不再有 iframe**。
- 回归：`readerSwipe` 19 项、`bookshelf` 11 项、`fontUnify` 11 项、
  `ui-buttons` 18 项、`coop` 20 项、`justified` 50 项、`statCharts` 311 项、
  `graphStats` 42 项、`musicIdentity` 19 项、`miniPlayer` / `queueOrder` /
  `favorites` / `gallery` / `epubReader` 全部通过；后端单测 136 项全过。

**踩坑记录**：`readerSwipe.probe.mjs` 用 esbuild 单独打包 BookReader，
而 pdfReader 用 Vite 的 `?url` 后缀取 worker 地址，esbuild 解析不了那个后缀
（报 `No matching export for import "default"`）。esbuild 的 `alias` 又不接受
路径形式的键，最后用 `onResolve` 插件把 pdfReader 换成测试桩
（`tests/stubs/pdfReader.stub.mjs`）解决。

### 追加：站内 RSS 阅读器彻底移除（同日）

用户原话：「直接把 RSS 的那个项目给砍了。太麻烦了，直接取消，我直接还是自己用 FOLO 算了，
相关的文件把它清理干净」。

RSS 模块经历过「10-09 删 → 10-12 恢复 → 10-13 再删」，这次是**彻底放弃**，
不再保留任何代码痕迹。清理范围：

| 层 | 删除内容 |
|---|---|
| 后端 | `lib/rss.js`、`lib/rssPresets.js`、`lib/rssSync.js`、`lib/rssTranslate.js`、`routes/rss.js` |
| 后端接线 | `router.js` 的 17 条路由与 import、`index.js` 的抓取定时任务、`publicScope.js` 的白名单与 `guestRssFeedFilters` |
| 前端 | `routes/Rss.jsx`、`lib/rssRead.js`、`styles/rss.css`、`app.jsx` 路由、`routes.js` 懒加载、`Layout.jsx` 导航项、`api.js` 全部 RSS 方法、`Icon.jsx` 的 rss 图标 |
| 通知 | `rss_new` 类型（`notify.js`、`routes/notifications.js`） |
| 数据库 | 迁移 `20261013000025_drop_rss.sql`：drop 两张表、清 rss_new 通知与 rss_article 资源、收敛 type 约束 |
| 测试 | `tests/run.mjs` 里 RSS 段（11 项用例）与 4 个 import；136 项全过 |
| 文档 | `docs/rss.md` 删除，相关文档交叉引用更新 |

**保留**（其它模块在用的通用件，不是 RSS 专用）：
`lib/markdown.js`（Markdown→HTML，测试在用）、`lib/zhConvert.js`（繁体转简体，音乐歌词在用）。

导航栏因此少一项，现在是：NewsNow / GitHub / 博客 / 音乐 / 影视 / 图书 / 图展 / 时间轴 /
碎念 / 图谱 / 收藏 / 更新 / 共创。

### 用户反馈

> 「而且有些电视剧它搜出来只有3条影视源是怎么回事？你那不是69条吗？」
> 「管理员那里的话，那个音乐导入的那个你还要修改一下，在用户端的话是不能看到那个
>  音乐导入的。然后管理员端音乐导入的话，只用负责导入音乐和填写它的歌手和歌词就行了，
>  其他的没有必要填，也就是你的那个页面太麻烦了」

### 影视源：根因是「子请求超限」，不是源坏了

**实测确认的事实**：Cloudflare **免费版单次调用**的子请求上限是 **50**
（用临时 Worker 连发 80 次 fetch，第 51 次开始报
`Too many subrequests by single Worker invocation`）。这是**总量**限制，不是并发限制。

**旧代码的两个坑（叠加起来就是「只有 3 条源」）**：

1. **搜索阶段给每个源发 `ac=list` 发现动漫类目**。
   `ANIME_CLASS_IDS` 硬编码表只有 13 个老源 key，而动态源（LunaTV 订阅）的 key
   是域名（`dyttzyapi.com` 这种），**一个都不命中** → 40 多个源各发 1 次
   `ac=list`，43 个子请求直接把配额吃满，后续请求全部抛错，
   整次搜索只剩最先返回的少数几个源有结果。
2. **探测批量太小**：每批只探 3 个源，43 个源要 15 轮才覆盖一遍；
   cron 每天只触发 24 次 → R2 里长期只有 5 条「已验证通过」的源。

**修复**：

- `dynamicSources.probeSourceDeep` 顺手把 `anime_class_ids`（动漫类目 ID）
  与 `keyword_search`（是否支持 `wd=` 关键词搜索）**实测出来写进源记录**，
  搜索阶段直接读，**零额外子请求**（`maccms.getAnimeClassIdsSync` /
  `supportsKeywordSearch`）。
- 搜索阶段硬性截断：关键词源 ≤ 34、动漫类目任务 ≤ 6，合计 40，
  元数据补全最多 8，卡在 50 以内。
- 探测批量 3 → 6，并改成 **3 路并发**（串行时 6 个源要 20~40s，
  cron 的 `waitUntil` 容易被掐断，结果写不进 R2）。
- 手动重探接口用 `batchSize: 8`（独立 invocation，没有 GitHub/RSS 抢配额）。
- 旧数据兼容：`verified_at` 存在但没有 `anime_class_ids` 的记录按
  「无动漫类目」处理，不再联网发现。

### 实测源池（2026-10-13，Cloudflare 出口，四步端到端）

从 LunaTV 主库 + smallmain 补充库合并去重、按名字与类目剔除成人源后共 **43 条**，
四步（列表 → 详情 → m3u8 主清单 → 首个分片）全通 **37 条**，
其中 8 条明确不支持关键词搜索（「暂不支持搜索」/「forbids keyword search」），
靠最新列表 + 本地匹配仍可用。

### 音乐上传

- 用户端**看不到**上传入口：`Music.jsx` 的按钮包在 `isAdmin` 里，
  `MusicEdit.jsx` 也加了管理员拦截（直接敲 `/music/new` 也进不去）。
- 新增 `/admin/music` 页（之前 `AdminMusic.jsx` 已存在但**没注册路由**），
  并在音乐页给站长显示「上传音乐」入口。
- 管理员**只填歌名 + 歌手 + 歌词**（歌词可选）。新增 `X-Audio-Lyrics`
  自定义头；填了就用站长这份，不再联网刮削，也不再被自动匹配覆盖。
- GitHub Trending 翻译模型从 `qwen3-30b-a3b-fp8` 换成
  `llama-3.2-3b-instruct`：整篇 README 翻译从 20~85 neurons / 6~22s
  降到 10 neurons / 0.5s。

### 验证

- 后端单测 147 项全过；前端 `npm run build` 通过。
- 所有临时探针 Worker 已 `wrangler delete --force` 并验证 404。

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

### 八、图书收敛为 EPUB/PDF + 站长收藏去重（2026-10-12 第五轮）

**① 图书只保留 EPUB 与 PDF（`backend/src/lib/bookType.js`、`bookCover.js`、`routes/books.js`、`frontend/src/routes/Books.jsx`）**

用户决定：本站只支持这两种能在浏览器里直接渲染、可站内阅读的格式；MOBI / AZW3 不再上传、
前端也不再出现。改动覆盖三层：

| 位置 | 改动 |
| --- | --- |
| `bookType.js` | `BOOK_FORMATS` 白名单只剩 `pdf` / `epub`；删除 `sniffPalmDb()`，`sniffBookFormat()` 遇到 PalmDB 容器返回 `null`（由路由转 415） |
| `bookCover.js` | 删除 `extractMobi()` 与 `decodeMobiString()`，以及随之不再使用的 `asciiAt()` / `u16be()`；`sniffBookFormat()` 只认 EPUB / PDF |
| `routes/books.js` | `shape()` 的 `caps` 与 `BOOK_READ_MODES` 去掉 mobi/azw3；两处 415 文案改为「仅支持 EPUB / PDF 电子书」 |
| `frontend/src/routes/Books.jsx` | `FORMATS` 筛选去掉 MOBI / AZW3；`ACCEPT` 去掉这两个扩展名；上传前端校验改为只认 `\.(epub\|pdf)$`；删除阅读器里「暂不支持在线阅读」的整段兜底 UI；页面副标题与上传区提示同步改写 |

**决策依据（写下来免得以后反复讨论）**：

- MOBI / AZW3 浏览器无法直接渲染，本来就只能下载，与「在线阅读」的定位不符；
- AZW3 的成本远高于 MOBI：本机 7 个样本里 5 个是 HUFF/CDIC 压缩（要自己实现按位哈夫曼解码），
  正文还是 KF8「空壳 + 碎片」结构（`aid` 拼装、`kindle:pos:fid:` 跳转、`kindle:embed:` 图片），
  另外可能带 DRM；MOBI 只是 PalmDOC 解压 + `mbp:pagebreak` 分章，工作量约为 AZW3 的三分之一；
- 站长的书架上现在**一本 AZW3 都没有**，MOBI 也极少（线上 11 本全是 EPUB）；
- 同一种书想在线阅读时，直接拿 EPUB 版体验最好，因此 MOBI / AZW3 的价值有限。

**② 站长登录后收藏页不再重复（`frontend/src/routes/Favorites.jsx`）**

**现象**：站长本人登录后打开收藏页，会看到「个人收藏」与「站长收藏」两份内容 ——
而后者的数据源（`GET /api/favorites/public`）取的正是**站长自己的收藏**，等于同一批内容显示两遍。

**修法**：用 `useAuth().isAdmin` 判断，站长本人不渲染「站长收藏」分区：

```jsx
const adminSection = !isAdmin && adminItems.length ? ( ... ) : null;
```

- 访客 / 普通用户 → 仍能看到「站长收藏」（他们的个人收藏通常是空的，这是内容来源）；
- 站长本人 → 只看到自己那一份（可移除、可管理），不再重复。

**验证**：后端 `test:unit` 107 项、`bookCover.probe`（真实 EPUB / PDF 封面提取 +
MOBI / AZW3 必须被拒 + 76MB EPUB 堆增量 1.4MB）、前端 `changelog` 39 项、`ui-buttons` 18 项、
`statCharts` 311 项、`graphStats` 42 项全过；`check-secrets` 无泄漏；`git diff --check` 干净。
`v0.11.0` 更新日志补上这两条（`remove` + `fix`）。

### 九、图展加「动态壁纸」区 + 图片分页展示（2026-10-12 第六轮）

**用户要求**：图展里加一个动态壁纸区（视频形式，管理员可上传素材），
R2 里动态壁纸与静态图片分开存；图展的图片**不要一股脑全展示**，
默认只显示 3~6 行，有一个「查看更多」按钮点开看全部。

#### ① 后端：动态壁纸独立成表 + 独立 R2 前缀

| 文件 | 内容 |
| --- | --- |
| `backend/src/lib/videoType.js`（新增） | 纯函数：`sniffVideoFormat()` 只认 MP4（offset 4 = `ftyp`）与 WebM（EBML `1A45DFA3`）；`parseMp4Meta()` 从 moov → mvhd 取时长、tkhd 取宽高；`MAX_VIDEO_BYTES = 100MB`；`buildVideoKey()` → `wallpapers/<uid>/<年>/<uuid>.<ext>` |
| `supabase/migrations/20261012000021_wallpapers.sql`（新增） | `wallpapers` 表 + RLS + 索引 + updated_at 触发器，风格与 assets / books 一致 |
| `backend/src/routes/wallpapers.js`（新增） | 6 条路由：POST 上传（原始请求体直传 R2，文件名走 `X-Wallpaper-Name`）、GET 列表、GET 单条、GET 视频字节（**支持 Range + CORS**，供 `<video>` 流式播放）、PATCH、DELETE |
| `backend/src/router.js` | 注册 6 条 wallpapers 路由 |
| `backend/src/lib/publicScope.js` | `PUBLIC_READ_RE` 加入 `wallpapers`（列出与读字节对访客放行，路由层仍按 `is_public=true` 过滤） |
| `backend/src/lib/response.js` | `Access-Control-Allow-Headers` 加入 `X-Wallpaper-Name` |

**为什么不用 multipart/form-data**（与 books 同因）：视频可达 100MB，Worker 内存只有 128MB，
`request.formData()` 会把整个文件读进内存。改为原始请求体直传 —— 路由把 `request.body`
原样灌进 R2，只在开头缓冲 **64KB** 用于嗅探容器 + 解析 MP4 元数据。

> **64KB 是实测出来的**：先用 4KB 探过，四个 4K 样本都解析不到时长与分辨率（moov box 不在前 4KB）；
> 换到 64KB 后四个样本全部解析成功，因此常量定为 `HEAD_PROBE_BYTES = 64 * 1024`。

**实测（四个真实样本，`/mnt/c/Users/x1078/Pictures/视频1/`）**：

| 文件 | 容器 | 分辨率 | 时长 | 大小 |
| --- | --- | --- | --- | --- |
| 【哲风壁纸】低趴姿态-地狱猫.mp4 | mp4 | 3840×2160 | 15.00s | 20.9MB |
| 【哲风壁纸】光之巨人-发光眼睛.mp4 | mp4 | 3927×2160 | 30.00s | 14.9MB |
| 【哲风壁纸】反光-城市街道.mp4 | mp4 | 3840×2160 | 15.13s | 25.3MB |
| 【哲风壁纸】夜景-性能车-汽车.mp4 | mp4 | 3840×2160 | 21.20s | 25.2MB |

**默认私人**：`wallpapers.is_public` 默认 `false`（与 assets 默认 `true` 不同）——
视频比图片更大更敏感，误公开代价高，站长要展出时在策展抽屉里显式打开「公开」。

#### ② 前端：图展拆两区 + 折叠展示

| 文件 | 改动 |
| --- | --- |
| `frontend/src/lib/api.js` | 新增 `uploadWallpaper()`（XHR 原始体直传，带进度、10 分钟超时、前端先拦 100MB）与 5 个 `api.*`（`listWallpapers` / `getWallpaper` / `updateWallpaper` / `deleteWallpaper` / `wallpaperFileUrl`） |
| `frontend/src/routes/Gallery.jsx` | 拆成「静态图片」+「动态壁纸」两区；两区各自 `slice(0, limit)` 折叠 +「查看更多 / 收起」；新增 `WallpaperCard`（静音循环自动播放）与 `WallpaperLightbox`（原地放大 + 取消静音 + 进度条）；策展抽屉加「上传动态壁纸」与「动态壁纸管理」两个区块 |
| `frontend/src/styles/gallery-timeline.css` | 新增 `.gl-section` / `.gl-sec-head` / `.gl-more-btn` / `.gl-wall-*` / `.gl-lb-video` / `.gl-lb-sound` |

**为什么是 4 行**：桌面 3 列 → 12 张、平板 2 列 → 8 张、手机 1 列 → 4 张，
首屏一屏半左右既有展厅的丰盛感，又不会长到要滚很久。列数由 `useColumns()` 读
`matchMedia` 得到，与 CSS 断点（1024 / 640）保持一致，窗口缩放时会跟着重算。

**壁纸区用网格不用 masonry**：视频都是 16:9 一类的规整画幅，错落反而让行高参差、看着不整齐。

**两区各自拉数据**：用 `Promise.allSettled` —— 一边失败不会让整页变成错误页，
只显示一条轻提示；只有两边都失败才走整页 `ErrorState`。

#### ③ 验证

- 后端 `test:unit` **111 项全过**（新增 `videoTypeUnit()` 4 项：魔数嗅探 / MP4 元数据解析 /
  100MB 上限与 `wallpapers/` key 形态 / 文件名清洗；其中 key 用例显式断言**不得**落在 `assets/` 前缀下）
- 前端 `gallery.probe.mjs`（新增，**15 项全过**）：真 preact 渲染 30 张图片 + 9 个视频，
  断言两区都渲染、默认只出 12 张 `<img>`、第 13 张不出现在 HTML 里、壁纸渲染成 `<video>`
  且带 `muted` / `loop`、点击「查看更多」后展开到 30 张且按钮变「收起」
- 前端 `favorites` 5 项、`changelog` 39 项、`statCharts` 311 项、`graphStats` 42 项全过

**已知未做（等用户确认后再动手）**：

- 迁移 `20261012000021_wallpapers.sql` **尚未应用到线上 Supabase**，
  因此 `wallpapers` 表在线上还不存在；需要先跑迁移才能上传。
- 本机没有本地 Supabase，无法端到端验证上传 → R2 → 播放这条链路，
  只能靠单元测试 + 探针 + 真实样本的元数据解析来保证。

### 十、共创页 + 歌词页 + 无固定时长加载进度条（2026-10-12 第七轮）

#### ① 影视卡按钮与点击延迟

| 文件 | 改动 |
| --- | --- |
| `frontend/src/components/VodPoster.jsx` | 右上角从**纯 `+` 图标**改成带文字的胶囊按钮（默认「加入影视库」，访客态「播放」）；新增 `pending` prop，点击后卡片盖一层 `.vod-loading` 转圈遮罩 |
| `frontend/src/routes/Movies.jsx` | 新增 `pendingKey` state（按条目追踪，不再用全局 `busy` 布尔）；**修掉延迟根因** |
| `frontend/src/styles/global.css` | `.vod-collect` 改成带文字胶囊；新增 `.vod-loading` / `.vod-card.is-pending` / `@keyframes vod-loading-in` |

**延迟的根因**：原来入库成功后要 `await load()` 把整个影视列表重拉一遍，
再从列表里找刚建的那条来跳转，实测多花 3~4 秒。现在直接用 `createMovie`
的响应结果跳转，延迟消失。

**加载遮罩的 180ms 淡入延迟**：命中缓存、秒开的条目不会闪一下转圈。

#### ② 全站页面加载进度条

新增 `frontend/src/components/RouteProgress.jsx` + `frontend/src/styles/route-progress.css`，
挂在 `frontend/src/app.jsx` 的 `<Layout>` 之前。三条规则：

1. 出现加载态先等 **120ms** 才显示 —— 秒开的页面完全不显示进度条；
2. 一旦显示**没有固定时长** —— 慢多久转多久；
3. 加载态消失立刻收尾淡出（220ms）。

**为什么用 `MutationObserver` 而不是 Router 事件**：Router 的 `loading` 只在懒加载
chunk 期间为真，而真正让用户觉得「卡住」的是页面拿到 chunk 之后、数据回来之前
那段空窗。判据改成 DOM 里有没有 `.app-main .sk-grid / .center-box / .loading-more`
（骨架屏 / 居中 loading / 加载更多），观察 `document.body`，所以与 Router 上下文解耦。

实测：153ms 出现、内容到位后 264ms 淡出，宽度 11% → 100%。

#### ③ 共创页（子代理 Aristotle 交付）

新增：

| 文件 | 说明 |
| --- | --- |
| `supabase/migrations/20261012000022_feedback.sql` | `feedback` 表（公开可写、仅站长可读） |
| `backend/src/routes/feedback.js` | 4 条路由：POST 公开，GET / PATCH / DELETE 仅管理员 |
| `frontend/src/routes/Coop.jsx` | 共创页（介绍 + 迷你星体 + 反馈表单 + 感谢弹窗 + 结尾字标） |
| `frontend/src/routes/AdminFeedback.jsx` | 站长端反馈收件箱 |
| `frontend/src/styles/coop.css` | 共创页样式 |
| `docs/coop.md` | 设计说明 |

修改：`backend/src/router.js`（注册 4 条路由）、`backend/src/lib/publicScope.js`
（POST 访客可写）、`backend/src/routes/notifications.js`（`TYPES` 加 `feedback`）、
`frontend/src/lib/api.js`（`GUEST_POST` + 4 个方法）、`frontend/src/components/NotificationBell.jsx`、
`frontend/src/components/Layout.jsx`（顶栏加「共创」、头像菜单加「共创反馈」）、
`frontend/src/app.jsx`、`frontend/src/routes/routes.js`。

**匿名不变量**：访客（`user.isGuest`）一律**强制匿名**，不接受实名；匿名条目
**不落 `user_id`**、响应里也**绝不返回** `user_id` / 邮箱，`display_name` 统一回「匿名读者」。
提交成功后给站长插一条 `type='feedback'` 的通知（`link=/admin/feedback`），
通知写入失败只 `console.error`，不影响反馈本身的成功返回。

#### ④ 共创页结尾字标 + 迷你星体

- `frontend/src/routes/Coop.jsx` 新增 `FooterWordmark`（在 `RecentChanges` 之后）：
  把 `Dora Studio` 拆成 10 个字母 + 1 个词间空格，每个字母带 `--i` 错峰延迟
  （2s → 5.6s），复刻模板的 `@keyframes ech` RGB 错位呼吸 + 一条渐变细线。
- 新增 `frontend/src/components/MiniUniverse.jsx`：复刻模板「A8 一个宇宙」——
  360 粒子 Fibonacci 球面 + 邻近连线 + 色相青→紫→粉流转；从占满整屏缩成
  300px（窄屏 200px）方形小件；`ctx.setTransform` 处理 DPR；离开视口 /
  页面隐藏时停 rAF；`prefers-reduced-motion` 下不建 canvas。
- 接在介绍与表单之间：`<div class="coop-orb"><MiniUniverse><p class="coop-orb-text">欢迎加入共创</p><span class="coop-orb-sub">转动看看</span></MiniUniverse></div>`。

实测（`cdp.mjs`，端口 9541）：300×300、canvas 298×298、188 个采样点有像素、
文字「欢迎加入共创」带 `background-clip:text`，页面顺序
`coop-intro → coop-orb → coop-form → coop-done → coop-mark`。

#### ⑤ 音乐歌词页（子代理 Ptolemy 交付）

| 文件 | 改动 |
| --- | --- |
| `frontend/src/routes/MusicLyrics.jsx` | 重做布局与歌词渲染 |
| `frontend/src/styles/lyrics.css` | **新建**，歌词页全部新样式（未触碰 `global.css`） |
| `frontend/src/components/MiniPlayer.jsx` | `.mini-meta` 跳转改 `/music/{id}/lyrics`，title 改「展开歌词」 |
| `frontend/src/routes/MusicView.jsx` | 详情页封面改为可点按钮，跳歌词页，悬停显示「歌词」提示 |

桌面端左右两栏：左黑胶（`clamp(200px,24vw,300px)`、圆形裁切、播放时 28s 匀速自转
+ 外圈呼吸光晕）；右歌词滚动区。`≤900px` 自动上下堆叠。

**已唱 / 未唱的区分**：未唱行 `color-mix(--text 22%)`、字号小、行距 1.95 松排；
已唱行按「离当前行的距离」在 40% → 86% 之间渐变（越早唱过越淡），形成若隐若现的
渐隐带（实测 alpha 0.40 → 0.83，始终高于未唱的 0.22）；当前行最大最亮、主题渐变
文字 + 流动光带 + `drop-shadow` 光晕。

**顺带修掉一个真实缺陷**：`.vinyl.lp` / `.vinyl-hole` / `.lp-*` 原本只写在
`now-settings.css` 里，而歌词页不 import 它 —— 直接访问 `/music/:id/lyrics` 时
黑胶退回 168px、封面 300px 未裁切溢出、轴孔消失。已把这些样式自包含进 `lyrics.css`。

#### ⑥ 影视播放的代理兼容（子代理 Lovelace 交付）

`backend/src/routes/vodProxy.js`：

- 白名单补齐实测缺口（`360zyx.vip`、`modujx15.com`），并把 `modujx` 序号域名
  正则从 `^modujx\d+\.com$` 放宽为 `(^|\.)modujx\d+\.com$`，覆盖 `bf.modujx15.com`
  这类带子域的分片域名；
- `MEDIA_EXT` 兜底扩容（补 `mpd` / `m4b` / `f4v` / `flv` / `mov` / `webm` / `mkv` /
  `mp3` / `wav` / `ogg` / `ogv`）；`localhost` / 内网 IP / 非 http(s) 的
  `isPrivateHost` 边界**未放松**；
- **302 逐跳校验**：新增 `fetchUpstream`，改手动跟随（`redirect:'manual'`，最多 5 跳），
  每一跳都重新走 `checkTarget`；重定向到未知域名且非媒体路径返回 403；
- 判型与 content-type 兜底改用**最终路径**；m3u8 改写 base 用最终 URL；
- 缓存 / CORS：m3u8 `max-age=300`、分片 / 密钥 `max-age=86400`，补 `Vary: Accept-Encoding`。

`frontend/src/components/MoviePlayer.jsx`：

- 新增 `probePlayable`：并行探测直连与代理，**一路探到首个分片**（`Range: bytes=0-0`），
  master 先取变体再取分片，顺便探 key；`PROBE_MS = 2500`；
- 选路由 `viaProxy` 改为 `routeOverride + useMemo`：命中 `dora:vod-proxy-hosts`
  直接走代理、命中新增 `dora:vod-direct-hosts` 直接直连（首帧就走对路）；
- 首帧超时 6000ms → **2500ms** 立即切代理；两条记忆互斥（互删），各留最近 50 条；
- 双路都失败且无下条线路时 `toastError` 明确提示（`failedToastRef` 保证只弹一次）。

#### ⑦ 本轮验证结果（2026-10-12，本机）

| 项目 | 结果 |
| --- | --- |
| 后端 `npm run test:unit` | **113 项全过** |
| 前端 `coop.probe.mjs`（新增） | **17 项全过**：区块顺序 / 四类分类 / 默认匿名 / 匿名时无称呼框 / 空内容禁用提交 / 输入后可用 / 计数器 / 访客态实名按钮禁用 / 结尾字标 10 字母 + 1 空格 / 渐变细线 / 逐字错峰 2s→5.6s / 迷你星体 300×300 / 星体 canvas / 「欢迎加入共创」/ 渐变裁切 / 无横向溢出 |
| 前端 `favorites` | 5 项全过 |
| 前端 `gallery` | 15 项全过 |
| 前端 `changelog` | 39 项全过 |
| 前端 `statCharts` | 311 项全过 |
| 前端 `graphStats` | 42 项全过 |
| 前端 `ui-buttons` | 18 项全过（含 `/graph/repos` 侧栏与画布等高 620px 差 0px） |
| `scripts/check-secrets.mjs` | 245 个文件，无凭据泄漏 |
| `git diff --check` | 干净 |
| 生产构建 | 成功（24.99s） |

**无头 Chrome 真渲染实测**（`cdp.mjs`）：

- 页面加载进度条：点导航进 `/gallery` → **145ms** 出现、**632ms** 收尾淡出、宽度爬到 **100%**；
- 影视卡：切「最新入库」→ 30 张 `.vod-card`，右上角 `.vod-collect` 是 `999px` 胶囊、
  高 28px、带图标 + 文字，访客态文案「播放」；
- 歌词页（真实曲目 `a9d283f5-…`）：左 340px / 右 707px **同排两栏**，黑胶 **300px** 圆形
  （`border-radius:50%`、动画 `lyr-spin`），**50 行**歌词渲染。

**待用户确认后再动手**：

- 迁移 `20261012000021_wallpapers.sql` 与 `20261012000022_feedback.sql`
  **尚未应用到线上 Supabase**（线上 `/api/wallpapers` 实测 404、`feedback` 表不存在）；
- 需先跑 `supabase db push`（或走 `db-migrate.yml` CI）再部署前端。

### 十一、首页书架改成「两行反向流动书带 + 就地阅读」（2026-10-12 第八轮）

#### ① 四条要求与落地

用户原话拆解：

1. 「尺寸不要两边都抵到边缘，要合理规划宽度」→ 收回上一版的 `100vw` 全幅，
   书架改成**只占「此刻」Bento 栅格的一整行**（`grid-column: 1 / -1`），
   宽度即正文宽度（1440 视口下 1232px / 正文 1280px），两侧再用渐隐遮罩收口，
   书是「淡出」而不是被硬切在边缘。
2. 「两行就行了」→ 从三层改成 **两行**。
3. 「上面一行从左往右、下面一行从右往左移动」→ 两条**无缝滚动**书带
   （`bs-run-right` / `bs-run-left`），同速反向。
4. 「鼠标停在某一本上、点击可以在线阅读」→ 悬停**暂停**整条带，
   点真实图书**就地弹出阅读器**；右上角另有「查看更多 →」跳 `/books`。

#### ② 关键实现

| 文件 | 改动 |
| --- | --- |
| `frontend/src/components/BookShelf.jsx` | 整文件重写（两行书带 + 无缝滚动 + 悬停暂停 + 就地阅读 + 查看更多） |
| `frontend/src/components/BookReader.jsx` | 新增 `import '../styles/books.css'` 与 `'../styles/wenkai.css'`（阅读器自包含样式，不依赖宿主页面 import 过） |

**无缝循环的做法**：把这一行的书**复制一份**接在后面，整条轨道 `translateX(-50%)`
就是一个完美循环 —— 半条轨道的长度等于复制出来的那半条，接缝处的间距与轨道内部
一致（同一个 flex `gap`），所以看不出接缝。滚动是纯 CSS animation（GPU 合成，
不跑 rAF，不烧 CPU）。

**速度口径**：一条轨道的时长 = 半条轨道长度 / 线速度（`SPEED = 42 px/s`），
因此两行的**视觉速度一致**，只是方向相反（实测两行都是 29s、1.2 秒各走 48px）。

**悬停暂停为什么必须用原生鼠标事件测**：合成 `mouseover` 事件**不会**触发 CSS `:hover`，
所以探针里用 CDP 的 `Input.dispatchMouseEvent` 发真实鼠标移动。实测悬停后
`animation-play-state` 变为 `paused`，移开恢复 `running`。

**就地阅读**：`BookShelf` 直接复用 `/books` 的同一个 `BookReader` 组件
（portal 到 `body`），因此阅读器设置（字号 / 字体 / 背景 / 单双页）、EPUB 章节、
PDF 内嵌全部与图书页一致，不需要第二套实现。补位书（生成式封面）点了跳 `/books`。

#### ③ 验证

- 前端 `bookshelf.probe.mjs`（新增，**12 项全过**）：书架落在正文宽度内（1232 / 1280，
  且 < 视口 1440）、两行、两条滚动带、两块层板、上行向右（Δ+48px）、下行向左（Δ−48px）、
  两带同速（29s）、书是 2:3 竖版（132×198）、28 本真书上架、「查看更多」跳 `/books`、
  页面无横向溢出
- 无头 Chrome 原生鼠标实测：悬停书带 → `paused`；点真实图书 → 就地弹出
  `.bk-reader`，标题为《三体读客版（套装共3册）》
- 后端 `npm run test:unit` **113 项全过**；`git diff --check` 干净；生产构建成功

---

## 2026-10-12（本轮补记）：图展排版修复 + 阅读手势 + 搜索历史位置 + 星体位置

用户本轮反馈三件事，另加两条追加要求，已全部落地（**未部署**，等用户确认）。

### ① 图展图片「排版很不协调」

- **根因**：静态图片区用纯 CSS `columns` 做错落瀑布流。各列高度不齐，底部会留一大块
  空档；R2 里 48 张图宽高比差异很大（1080~2560 宽，另有一张 6144×3321），
  一混排就「看着乱」。
- **做法**：改用「整齐等高行」（justified rows）。新增纯函数
  `frontend/src/lib/justified.js`（零依赖，可离线单测）：逐张往当前行里塞，
  一旦「现在收行这一行会有多高」掉到目标行高以下就收行；行高 = 行内可用宽度 ÷
  该行宽高比之和；舍入余数补给行尾，整行宽度与容器严格一致。
- **接入**：`Gallery.jsx` 用**回调 ref + ResizeObserver** 量容器宽度（关键：图片区在数据
  到达前不渲染，普通 `useRef + useEffect` 只跑首帧、那时 `ref.current` 还是 `null`，
  宽度会永远停在 0，排版只能用兜底宽度 —— 实测确认过这个 bug）。
- **折叠改成按行**：`expandPics` 现在按 `COLLAPSE_ROWS = 4` **行**切，而不是按张数切。
  按张数切会在行中间断开、底部留一行「半截图」的图片。
- **实测**（1440 视口 / 容器 1232px）：4 行；前三行各 3 张、行高 227px、行宽合计 1209px；
  第四行 4 张、行高 193px；无横向溢出。

### ② 动态壁纸无法在线预览

- **根因**：`<video src>` 无法携带 `Authorization` 请求头，而 `/api/wallpapers/:id/file`
  走 `requireAuth`，私人壁纸一律 404（图片能用是因为 `/api/assets` 是公开接口）。
- **做法**：`backend/src/middleware/auth.js` 的 `extractToken` 增加「GET 请求接受
  `?token=<JWT>` 查询串」（**仅 GET**，写操作不认）；前端新增
  `setAuthToken` / `withMediaToken`，图书文件 / 封面 / 下载 / 壁纸文件 URL 统一走它。
- **另加**：图展策展抽屉新增「一键公开全部」（图片 / 动态壁纸各一个），
  串行 PATCH 该区所有未公开条目，带确认、计数，失败不中断。

### ③ 图书翻页手势

- **根因**：原来只有**双指**滑动绑定翻页（`if (!touch || !touch.multi) return;`），
  单指滑动完全没逻辑 —— 这就是「滑到底之后再滑完全没反应」。
- **做法**：抽成纯函数 `resolveSwipe({ dx, dy, atBottom, atTop, threshold })`：
  - 向右滑（`dx>0`）→ 下一章；向左滑 → 上一章（横滑一律翻章，正文是纵向排版不冲突）；
  - 向下滑到底（起点就在底部）→ 下一章；向上滑到顶 → 上一章；
  - 起点是否在尽头在**手势开始时**记录，而不是抬手时才查 —— 否则「滑到底的那一次」
    会被判成没到底，白滚一下没反应；
  - 短章节（一屏到底）上下滑直接翻章；双指上下滑保留。
- `epubReader.js` 的 `body` 加 `touch-action: pan-y`：纵向滚动交还浏览器，
  横向留给阅读器的翻章手势（不被系统的横滑返回吃掉）。

### ④ 搜索历史位置（追加要求）

- 原来 `SearchHistory` 是工具条的兄弟节点，flex 把它排到了搜索框**右边**。
  现在音乐 / 影视页都把「搜索框 + 历史」包进 `.toolbar-search`（column flex），
  历史贴在搜索框正下方；`.sh-bar` 改成网格，`一键清空` 单独占一行靠右。

### ⑤ 共创页星体位置（追加要求）

- 从「段落下方居中」改成贴在介绍文字**右侧**、高度与那段文字齐平
  （`.coop-lead` 两栏 + `.coop-orb { align-self: center }`）；≤900px 落回上下堆叠。
- 实测（1440 视口）：星体在文字右侧、同一行、高度比 0.87；页面无横向溢出。

### 验证

- `frontend/tests/justified.probe.mjs` **50 项全过**
- `frontend/tests/gallery.probe.mjs` **17 项全过**（含「默认最多 4 行」「按行折叠」新断言）
- `frontend/tests/readerSwipe.probe.mjs`（新增）**19 项全过**
- `frontend/tests/coop.probe.mjs` **19 项全过**（含星体位置 3 项新断言）
- `frontend/tests/bookshelf.probe.mjs` **12 项全过**；`favorites` **5 项**；
  `changelog` **39 项**
- 后端 `npm run test:unit` **113 项全过**
- 生产构建成功；无头 Chrome 实测图展 4 行整齐、共创页星体位置、书架两行反向流动

---

## 2026-10-12（本轮补记 2）：底部播放条按《Nacre 音乐》模板补齐

用户要求（原话要点）：参照 `E:\documents\111\Nacre 音乐.html` 的底部播放条，
**把播放相关的功能都集成进这一条**，不要再为它们另开页面 ——
点封面立即进歌词页、收藏按钮、循环播放、顺序播放、下一曲后面的播放队列，
点了就地弹出。除了「点封面看实时歌词」这一个交互外，不需要新的页面。

### ① 播放顺序抽成纯函数 `frontend/src/lib/queueOrder.js`

原来「下一首 / 上一首」是 `index ± 1`，做不到随机、循环，也做不到
「随机时上一首能回到刚才那首」。现在用一个**显式的顺序表**：

| 函数 | 作用 |
| --- | --- |
| `buildOrder(length, { shuffle, current, random })` | 生成播放顺序；随机时 Fisher–Yates 洗牌，并把当前曲目固定在最前（开着随机点下一首不会立刻跳走） |
| `stepIndex(order, current, delta, repeat)` | 沿顺序走一步；`-1` 表示没有下一首（顺序播放到头） |
| `nextRepeat(repeat)` | 顺序 → 列表循环 → 单曲循环 → 顺序 |

关键设计：顺序表只在**队列长度 / 随机开关**变化时重排，换歌（index 变）不重排 ——
否则「随机」会退化成「每次点下一首随机抽一首」，「上一首」也回不去。

### ② `lib/player.jsx` 接入

- 新增 `shuffle` / `repeat`（持久化到 localStorage）、`order`；
- `next` / `prev` 改走 `stepIndex`；`prev` 保留「播放超过 3 秒先回到开头」的惯例；
- `onEnded`：单曲循环重播本首（不重新解析音源）、列表循环绕回开头、
  顺序播放到头则停下；
- `hasPrev` / `hasNext`：顺序播放到头时置灰，循环模式下始终可点；
- 新增 `toggleShuffle` / `cycleRepeat`（带 toast 提示当前模式）。

### ③ `components/MiniPlayer.jsx` 重写

播放条从左到右：**封面（点进歌词页）· 曲目信息（点进详情）· 收藏 ·
随机 · 上一首 · 播放 · 下一首 · 循环 · 队列 · 音量 · 关闭**。

- 封面从原来的「整块可点」拆成独立按钮：点封面**立即**进 `/music/:id/lyrics`；
  曲目信息另外可点，进歌曲详情。
- 收藏按钮复用 `/api/favorites` 同一套接口，登出后自动隐藏；收藏后用危险色 + 实心。
- 循环按钮在「单曲循环」时带一个 `1` 角标；随机 / 循环开启时按钮走主色。
- 队列按钮点了**就地弹出**浮层（不跳页）：列出全部曲目、显示当前曲目与均衡器动画、
  点击任意行 `goTo(i)` 切歌；点外部 / Esc 关闭。
- 样式集中在 `styles/global.css` 的 `.mini-*` 段：图标按钮、角标、队列浮层；
  颜色一律走主题变量，中文不套等宽字体。

### 验证

- `frontend/tests/queueOrder.probe.mjs`（新增）**34 项全过**：
  顺序 / 随机 / 列表循环 / 单曲循环 / 边界 / 模式轮转
- `frontend/tests/miniPlayer.probe.mjs`（新增）**36 项全过**：
  无曲目不渲染、访客不渲染收藏、点封面跳歌词页、点信息进详情、
  随机 / 循环 on 态与角标、点队列就地弹出（不跳页）、队列列出全部曲目、
  点队列第 3 首调 `goTo(2)`、登录后收藏可加可取消
- 回归：`justified` 50 / `gallery` 17 / `readerSwipe` 19 / `favorites` 5 /
  `changelog` 39 全过；后端 `npm run test:unit` **113 项全过**
- 生产构建成功

---

### 十二、首页首屏重构 + 全站字体收口 + 音乐音源扩充（2026-10-12 第九轮）

本轮用户提了 8 条，全部落在**前端视觉**与**音乐音源**两块，后端业务逻辑未动。
改动**未部署**，等用户确认。

#### ① 首屏做减法，标题独立成「标题带」

用户要求：「把散落的知识 收进一张星图」的**知识改碎片**；
这句话要**挪到「写在前面」上面、也就是「开始浏览」下面**；
文字特效参照 `E:\documents\111\blog-home-v2.html` 第一个页面；
首屏大图上的**时钟、印章、「个人知识库」小标全部去掉**，但**时钟不要删，放进新标题带**。

落地（`HeroCarousel.jsx` + 新增 `LandingParts.jsx::TitleBand`）：

| 位置 | 改动 |
| --- | --- |
| `HeroCarousel.jsx` | 删掉 kicker「个人知识库」、删掉巨型标题两行、删掉时钟与印章两个悬浮小组件；首屏只剩大图 + 图注 + 两个按钮 |
| `LandingParts.jsx` | 新增导出 `TitleBand`：巨字「把散落的碎片 / 收进一张星图」，逐字错峰升起（`translateY(112%) rotate(7deg)` → 归位）+ 手绘感下划线（`stroke-dashoffset` 画出）+ 实时时钟；渐变按字切片（`charGradients(TITLE_LINES, TITLE_GRADIENT)`） |
| `Home.jsx` | `<HeroCarousel />` 后插入 `<TitleBand />`；「最近写的」改「**写在前面**」 |
| `home-landing.css` | 新增 `.tb*` 全套样式（渐变字 `background-clip:text`、手绘线、时钟、≤820px 隐藏时钟） |

**为什么渐变要逐字切片**（老坑，代码里已注明）：每个字都要做 transform 动画，
transform 会让这个字自成一层合成层，父元素上的 `background-clip:text` 裁不到
别的合成层里的字形，整行会直接变透明。所以按字在标题里的位置算出它该分到的那一小段渐变。

#### ② 「写在前面」改成逐字跟随滚动由虚到实

用户要求：参照 `E:\documents\111\余白 · 博客首页111.html` 的呈现方式 ——
向下滑动时那些字**由虚到实**。

改法（`LandingParts.jsx::IntroBlock` + `home-landing.css`）：
从「整行一起模糊揭幕」改成**每个字一个 `.ld-i-ch`**，
初始 `filter: blur(6px); opacity: .16`，进入视口后加 `.on` 变 `filter:none; opacity:1`，
按字序错峰点亮。

实测：1440×1000 下滚动，178 个字从 0 → 178 逐字点亮（y=700 亮 1 个 / y=1600 全亮）。

#### ③ 「站点构成」环形图：数字醒目 + 颜色加深 + 线条加粗 + 提速

用户反馈：「周围的那些数字要醒目一些，你的太小了」「颜色加深、线条加粗、
变化快一些、虚实相间」。

| 项 | 改前 | 改后 |
| --- | --- | --- |
| `viewBox` | 680 | **760**（圆心 380,380；`transform-origin` 同步改） |
| 画布宽度 | max-width 620 | **700** |
| 环带描边 `.ld-ring-band` | 4.5 | **6.5** |
| 刻度 `.ld-ring-ticks` | 0.9 | **1.2** |
| 模块名 `.ld-label-name` | 17px | **20px** |
| 模块说明 `.ld-label-meta` | 9px | **11.5px**，weight 600，fill 改 `--ld-ink` |
| 旋转一圈 `.ld-rotor` | 120s | **42s**，另叠一层 `ld-breathe 5.6s` 呼吸（`data-active` 时只留旋转） |

实测：标签 `11.5px/600`、动画 `ld-spin 42s` + `ld-breathe 5.6s`、**0 个标签被裁**。

#### ④ 全站字体收口（子代理完成，已验收）

用户要求：「导航栏里面的那些按钮的话它的字体可以改成统一的」「有些页面的字体
换成有精致感的，像博客里 dora 那个字母就很好看」。

根因：`.app-nav a` **压根没声明字体**，各浏览器各自回退，所以和左侧品牌名对不上。

改动：

- `global.css`：`.app-nav a` 显式 `var(--font-ui)` / 13.5px / 500 / `letter-spacing:-0.01em`；
  `.app-nav a.active` 字重 600 → 500（Satoshi 只自托管 400/500/700，600 是浏览器**合成的假粗体**，边缘发虚）；
  顶栏 `.menu-*` / `.login-link` / `.theme-toggle` 全部显式走 `var(--font-ui)` 并与导航对齐；
  `button, .btn` 与 `input, select, textarea` 在原有 `font: inherit` 之后补 `font-family: var(--font-ui)`
  （只写 inherit 的话，按钮被放进博客正文或歌词页就会跟着变，表单控件在 Windows 上会回退到系统字体）；
  新增 `table, optgroup { font-family: var(--font-ui) }` 收口；
  `.post-content h1/h2/h3` 硬编码 → `var(--font-ui)`；`.post-content code` / `.cs-month time` → `var(--font-mono)`。
- `books.css`(7 处) / `changelog.css` / `coop.css` / `now-settings.css`：`font-family: inherit` → `var(--font-ui)`。
- `routes/PostEdit.jsx`：编辑器内联等宽栈 → `var(--font-mono)`。
- **故意保留**：`global.css` 的 `.post-content-wrap` 衬线栈（全站唯一一处刻意绕过令牌，
  比 `--font-display` 多了 `Noto Serif SC` / 思源宋体 / `PingFang SC`，是为长文阅读观感加的）；
  `--font-mono` 与 `graph-console.css` / `starmap.css` 的中文兜底全部原样保留。

实测：新增 `frontend/tests/fontUnify.probe.mjs` **11 项全过** ——
导航 `Satoshi | 13.5px | 500`、品牌 / 登录胶囊 / body / 按钮 / 搜索页 input+select 全部 `Satoshi`；
1440/1080/768/390/360 五档顶栏无横向溢出、链接高度一致、顶栏仍 64px。

#### ⑤ 博客列表页站名改英文

`frontend/src/routes/Posts.jsx`：横幅 `<h1>Dora 的博客</h1>` → **`<h1>The Blog of Dora</h1>`**
（用户要求「the blog of dora，该大写的大写」）。

#### ⑥ 音乐音源扩充（子代理完成，已验收）

用户反馈：「音乐源还是有点少了」「三四十五六十的音乐搜不出来，或者搜出来都看不了」，
并要求「尽量先是音质高的」。

**新增酷我（官方）这一路**（`backend/src/lib/musicSources.js` 新增约 150 行）：

- 酷我是**完全独立于网易云 / 酷狗的第三个片库**，搜索与取流都是自有接口，
  不依赖第三方中转、不需要 Key，直链是普通 CDN 地址（**非签名、不会过期**）；
- 实测（2026-10-12，8 个热门关键词：晴天/稻香/青花瓷/孤勇者/海阔天空/平凡之路/
  see you again/hello）：**搜索 8/8 有结果、取流 8/8 返回可用地址、
  拉首个 1KB 分片 8/8 返回 206 `audio/mpeg`** —— 可用性是目前所有音源里最好的一路；
- 音质策略：FLAC(2000kflac) → 320K → 128K → 通用 mp3 逐档降级，拿到哪档标哪档，
  **绝不虚标**（搜索阶段 `bitrate` 一律 0，只留 `max_bitrate_hint`，真实音质等取流成功后回填）；
- 搜索接口返回的是**单引号伪 JSON**（值里可能带引号、`&nbsp;` 实体、`\uXXXX` 转义），
  直接 `JSON.parse` 会炸，因此按条目切块后逐字段正则提取（`parseKuwoSearch`）；
- 取直链是「每首一次请求」，全量取会把搜索拖到十几秒 —— 只解析最靠前的 12 条，
  其余标 `needs_resolve`，播放时按需重解析。

**顺带修掉「搜出来点进去放不了」的一类情况**：网易云官方外链端点对**版权受限**曲目会
302 到 `/404`（返回 HTML 而不是音频）。实测 10 个热门关键词各取首条正片，**只有 6/10 返回真音频**，
其余 4 首（孤勇者 / 海阔天空 / 平凡之路 / 夜曲）返回 `text/html`。
现在搜索阶段对最靠前的 12 条并发做一次轻量探测（`Range: bytes=0-1` 判 `content-type`），
探测不通过的标 `playable_probe_failed`，由 `fetchers.js` 的排序（`candidateRank` 里 `-1000`）
沉到最后一档 —— **只降权不剔除**，网络抖动时用户仍能手动点到。

**排序权重调整**（`fetchers.js`）：`PLATFORM_RANK` 加 `kuwo: 6` 排最高
（同时满足「可用性最好」与「能取到无损 / 320K」两个条件），`kugou: 5`、`netease: 5`。
另：GD 音乐台实测**单源就要 9.8s**（其余源都在 1s 内），在 7s 预算下基本必被丢弃却仍占一次并发请求 ——
这就是「搜索要等 9 秒」的根源，因此默认**不再查 GD**（改成空串），需要它的无损 FLAC 时
用环境变量 `GD_MUSIC_SOURCES=netease,joox` 显式打开。

源探活（`sourceHealth.js`）：`probeOfficialMusic` 从「二选一」改成查表，
新增 `probeKuwo` 与「酷我（官方）」条目。

#### ⑦ 音乐去重与播放历史（上一轮已落地，本轮复验）

`musicIdentity.js`（前后端各一份同规则）：`normalizeMusicText` / `musicIdentity` /
`dedupeMusicList` / `findDuplicateMusic`。列表接口用 `dedupeMusicList` 去重，
`createMusic` 入库前查重（命中返回 200 + `duplicate: true`），前端提示「已经在音乐库里了」。
新增 `GET /api/music/history`（路由排在 `/api/music/:id` **之前**），音乐页新增「播放历史」分组。

#### 验证

- 后端 `npm run test:unit` **117 项全过**（含新增的酷我伪 JSON 解析、音乐去重、
  动态壁纸类型、MOBI/AZW3 必须被拒、默认影视源复测口径等用例）
- 前端探针全过：`justified` 50 / `gallery` 17 / `readerSwipe` 19 / `favorites` 5 /
  `changelog` 39 / `queueOrder` 34 / `miniPlayer` 36 / `musicIdentity` 19 / `coop` 20 /
  `ui-buttons` 18 / `graphStats` 42 / `statCharts` 311 / `bookshelf` 12 / `fontUnify` 11
- `node scripts/check-secrets.mjs` 245 文件无泄漏；`git diff --check` 干净
- 生产构建成功（20.9s）

#### 坑与教训

1. **渐变 + transform 动画不能共存**：父元素 `background-clip:text` 裁不到
   自成合成层的字形，必须按字切片。这个坑在首屏标题与 Dora Studio 字标上各踩过一次。
2. **`font: inherit` 不等于「用全站字体」**：只写 inherit，控件被放进改过字体的容器里就会跟着变。
   要么显式声明 `var(--font-ui)`，要么就别指望它。
3. **Satoshi 没有 600 字重**：写 600 浏览器会**合成假粗体**，边缘发虚。真实档位只有 400/500/700。
4. **伪 JSON 不要硬 `JSON.parse`**：酷我返回单引号 + `&nbsp;` 实体，按条目切块逐字段提取更稳。
5. **官方外链的「有结果」不等于「能播」**：网易云对版权受限曲目 302 到 HTML，
   必须真的探一下 `content-type`。
6. **未跟踪的大目录**：`frontend/public/hero/`（36 文件 5.2MB）与
   `frontend/public/fonts/lxgw/`（98 文件 4.7MB）**从未入库** ——
   若直接推 GitHub main 会导致线上首页轮播图与霞鹜文楷 404。
   本项目的 Pages 一直是本地 `wrangler pages deploy dist` 直传，不走 Git，所以线上正常。

#### 待决策

1. 导航字号本轮从 14px 收到 **13.5px**（为了贴近登录 / 主题胶囊的 13px）。
   若觉得导航变小了不好看，可以改回 14px。
2. 新增探针 `frontend/tests/fontUnify.probe.mjs` 是否保留在仓库里。

---

### 十三、移动端触屏适配 + 铁屑卡片的环绕铁屑（2026-10-12 第十轮）

用户要求两条：

1. 「Dora Studio 那个铁屑框，除了名字之外，它的**周围**也应该有铁屑，把它们整个包围起来」；
2. 「你没有针对手机移动端做适配吗？适配一下」（另：「PDF 那个不用管，可以下载就行，
   它的一些按钮的适配你做一下就可以了」）。

#### ① 铁屑卡片：字形外面加一圈「环绕铁屑」

`frontend/src/components/BrandFilings.jsx`。

**改前**：只有「字形主体 + 一圈极窄毛边」——字是孤零零浮在卡片里，周围什么都没有。

**改后**：`classifyCells()` 新增两个参数 `haloRadius` / `haloDensity`，返回里多一个
`halo` 数组 —— 字形（含毛边）**之外**一圈环形区域内的自由铁屑：

- 只取 `haloRadius` 格以内的点，外面彻底留白（不退化成模板那种「铺满整块」）；
- 密度用**确定性伪随机**控制，且按到字形的距离衰减（紧贴字形处概率 1，最外圈降到 0.25），
  形成由内向外散开的过渡；
- halo 点没有字形切向（`hasN` 为假），所以默认就**指向磁极** ——
  正是模板里「铁屑被磁场吸住」的观感；长度比毛边更短、透明度更低，
  近看是一圈散铁屑，远看不会把字糊住。

**踩到的坑**：`haloRadius` 一开始写死 3 格，实测几乎看不见 ——
因为网格步长 `step` 是跟着笔画宽度走的（这块卡片上只有 6px），3 格才 18px。
改成按**像素**反推：`haloPx = fs * 0.5`（钳在 24~64px），再除以 step 得格数，
这样无论字号 / 容器多大，环绕带的宽度观感一致。

**另一个坑**：`picked.all` 是按覆盖率筛过的点，halo 不在里面，
必须单独并进绘制列表（`const list = [...glyph, ...halo]`），否则永远画不出来。

实测（无头 Chrome，1440×1200 与 390×844 两档）：
画布 500×340 上字形居中，四周都采到了环绕铁屑（左 / 右 / 上 / 下四向均有），
窄屏 360px 下无横向溢出。

#### ② 移动端触屏适配

**实测手段**：`cdp.mjs` 之外另写了一个探针，用 CDP 的
`Emulation.setDeviceMetricsOverride` + `setTouchEmulationEnabled` +
`setEmitTouchEventsForMouse` 真正模拟触屏设备
（无头 Chrome 默认报 `hover:hover`，不模拟就测不到触屏样式），
然后逐页扫描所有 `button / a[href] / [role=button]`，列出命中区小于 40px 的。

**修掉的两类问题**：

| 问题 | 表现 | 修法 |
| --- | --- | --- |
| ① 顶栏控件被 flex 压扁 | 390px 视口下，搜索按钮从 38px 挤成 **20px**、主题按钮从 52px 挤成 **27px** | `.app-header > a[title] / > button / > .row > *` 一律 `flex: none`（固定尺寸的控件不该参与收缩） |
| ② 一批按钮命中区小于 44px | 首页轮播进度点 3px、轮播箭头 36px、影视 / 音乐大按钮 28px、「查看更多」25px、更新日志版本锚点 31px、共创页底部链接 19px、首页页脚链接 28px、海报墙行箭头 30px | 各自在所属样式文件里用 `@media (hover:none) and (pointer:coarse)` 放大到 40~44px |

**为什么用 `(hover:none) and (pointer:coarse)` 而不是宽度断点**：
窗口窄不等于触摸屏（桌面把窗口拉窄仍然用鼠标），而 44px 命中区是**手指**的需求，
跟视口宽度无关。两者分开判断，桌面鼠标环境的外观一点不变。

**另外**：手机端把首页轮播那 18 个进度点**收起**了 ——
18 个点横排要 750px 宽，必然溢出（实测右侧越界 53px）；
收起后只留「上一张 / 03 / 18 / 下一张」，信息不丢、不再溢出。

**一个必须记住的加载顺序坑**：`home-landing.css` 随 Home 路由**异步**加载，
排在 `global.css` 之后。所以轮播箭头（`.ld-hero-arrow`）的放大规则
写到 `global.css` 里会被 `home-landing.css` 的基础规则覆盖（实测写了 44px 仍是 36px）。
凡是 `ld-*` 前缀的样式，覆盖规则必须写回 `home-landing.css` 自己。

#### ③ 首页「写在前面」文案修正

用户指出：「还有反复听过的歌和**看过的片**」——「看过的片」容易被想歪。

`frontend/src/routes/Home.jsx`：

- 「反复听过的歌和看过的片」→「反复听过的歌**与看过的影视**」；
- 下一句「从一篇文章走到一个项目、**一段影像**」→「……**一部作品**」（同类联想一并消掉）。

#### 验证

- 移动端探针（390×844 触屏模拟）逐页扫描：`/` `/posts` `/books` `/music` `/movies`
  `/gallery` `/timeline` `/moments` `/favorites` `/changelog` `/coop` 全部
  **`overflowX = 0`**，不再有 40px 以下的可点目标（除顶栏品牌图标 36px 与
  两个胶囊的 38px 宽度，高度均已 40px）。
- 前端探针全过：`justified` 50 / `gallery` 17 / `readerSwipe` 19 / `favorites` 5 /
  `changelog` 39 / `queueOrder` 34 / `miniPlayer` 36 / `musicIdentity` 19 / `coop` 20 /
  `ui-buttons` 18 / `graphStats` 42 / `statCharts` 311 / `fontUnify` 11 / `bookshelf` 12
- `check-secrets` 245 文件无泄漏；`git diff --check` 干净；生产构建成功

#### 已知噪声（不是缺陷）

`bookshelf.probe.mjs` 的「有真实图书上架」偶发失败（跑 3 次 2 过 1 失败）：
首页书架的数据来自 `api.listBooks('?limit=40')`，接口偶发慢 / 超时会被 `.catch` 吞掉，
书架就全部退回占位书。这是**数据竞态**，与本轮 CSS 改动无关，已记录备查。

#### 决策记录（PDF）

用户明确：「PDF 那个不用管，可以下载就行」。因此**不做**站内 PDF 渲染
（手机浏览器不支持 iframe 内嵌 PDF，会直接下载；要做需要引入 pdf.js，约 1.5MB 额外体积），
保留现在的行为：桌面 Chrome 能在 iframe 里看，手机上点开即下载。

---

## 2026-10-12（本轮补记 3）：影视源改为「订阅 + 自动探测」（分支 feat/now-settings）

用户决定（原话要点）：**不要再人工维护那 8 个源**了 —— 搜来搜去有些片子找不到、
有些还卡。改用 MoonTVPlus 同款的那份**每天自动检测的源清单**，
「用他的这个速度还挺快的」，把源接进主站即可。

### 背景：为什么之前没找到这类项目

上一轮找影视源时是**一个个试采集站接口**（能搜到 + 能播就收），
而 LunaTV-config 这类项目是**「源清单」项目**：别人把几十个源收集好、
还写了脚本每天自动检测。搜索思路不同，所以当时没搜到 —— 是方法窄了，不是网上没有。

### 方案（已与用户确认）

| 项 | 决定 |
| --- | --- |
| 源清单来源 | `hafrey1/LunaTV-config`（该仓库每天北京时间凌晨 1 点自动检测并重新生成，base58 编码） |
| 是否保留人工 8 条 | **不保留**。实测 8 条里有 6 条与清单完全一致，另 2 条是同站不同接口 —— 已被覆盖 |
| 筛选标准 | 用主站自己的探测筛，**不直接采信上游**（上游只验「接口能连通」，不验「点进去能播」） |
| 存储 | R2（`system/dynamic-vod-sources.json`），不新增 Supabase 表、不做迁移 |
| 定时任务 | **复用现有 cron**（不新增触发器，见下） |

### ① 新增 `backend/src/lib/dynamicSources.js`

- **base58 解码**：零依赖自实现（约 16KB 文本，朴素按位累加足够），
  同时兼容明文 JSON（`parseSubscription` 两种都认）。
- **源结构转换**：LunaTV 的 `{host:{name,api,detail}}` → 主站 `{key,name,api,detail}`，
  `key` 用域名，保证多次拉取顺序变化时 key 稳定。
- **成人源过滤（硬性）**：上游清单里混着 **30 个成人资源站**（名字带 🔞 及一批黑话命名的站）。
  面向普通访客的知识库站点**绝不能**收录，因此在 `normalizeLunaSources` 里直接剔除：
  **69 → 39 个**。
- **探测（比健康中心更严）**：
  1. 列表：`ac=videolist`（**不带关键词**，取最新更新）
  2. 详情：`ac=detail&ids=` 首条 → 必须有可播地址
  3. 主清单：GET m3u8 → 200 且内容像 m3u8
  4. 首个分片：取一个分片看 200/206 —— **参考项，不决定成败**
     （很多源分片做了防盗链直连 403，但播放器走 `/api/vod/proxy` 能播）
- **分批探测 + 滚动体检**：游标存 R2，每轮探一小批，几轮覆盖全部源，然后从头再来。
- **失败不立刻摘**：连续失败 `MAX_CONSECUTIVE_FAILURES = 3` 轮才移除，
  避免一次网络抖动误杀好源。
- **失败回退**：探测异常时保留上一次的结果，绝不把源列表清空。

### ② 关键修正：**不能用关键词搜索判源好坏**

第一版用「搜索关键词」探测，结果 **49/69 被误判为坏**。
排查发现：**很多源禁用了关键词搜索**（接口直接返回 `Current API forbids keyword search`），
但它们「取最新列表」完全正常、站点上照样能搜到片。
改用 `ac=videolist`（不带关键词）后误判消失。

### ③ 探测必须带 Referer

采集接口普遍校验 Referer 必须来自源站自身，否则 403/503。
实测 `iqiyizyapi.com` 详情接口不带 Referer 返回 **503**，带上就 200。
因此 `fetchJsonWithTimeout` 先带源站 Referer 请求，失败再不带重试一次
（两类站都存在，兜底比猜更省事）。

### ④ 接线：`maccms.js` 改为「动态源优先」

- 新增 `ensureVodSources(env)`（**异步**）：`env.VOD_SOURCES` > 动态源（R2）> 内置兜底源。
- 保留 `getVodSources(env)`（**同步**）用于兼容，只读内存缓存 / env / 内置源。
- **isolate 级内存缓存**：同实例内 5 分钟只读一次 R2，避免每次搜索都打 R2。
- 6 处调用点全部改走 `ensureVodSources`：
  `fetchers.js`(4) / `sourceHealth.js`(1) / `routes/movies.js`(1)。
- 内置 `DEFAULT_VOD_SOURCES` **保留作兜底**：动态源尚未探出结果时站点仍可用。

### ⑤ 定时任务：复用现有 cron（重要）

新增 `*/15 * * * *` 触发器时**部署失败**：

```
This account has reached the Workers Free limit of 5 cron triggers per account
```

排查账号 cron 占用：`mailflare`(2) + `moontv-plus`(1) + `rin-server`(1) +
`knowledge-base-api`(1) = **5 个，已满**。

因此改为**搭现有 cron 的车**：在 `*/5 2-3 * * *` 分支里顺带跑一批探测
（每次 3 个源，`DYNAMIC_SOURCE_BATCH` 可覆盖）。该 cron 每天触发 24 次
→ 每天约探 72 次，足够覆盖 39 个源并滚动体检。
子请求预算：每源最多 5 次请求 ≈ 15 次，与 Star 同步共用 50 次上限仍有余量。

### ⑥ 新增管理员接口（`backend/src/routes/dynamicSources.js`）

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/api/admin/vod-sources/dynamic` | 查看订阅状态 + 当前生效源 + 游标 |
| POST | `/api/admin/vod-sources/dynamic/refresh` | 手动触发一轮探测 |
| POST | `/api/admin/vod-sources/dynamic/reset` | 清空动态源，回退内置兜底 |

### 验证结果

- 本机端到端（内存 R2 + 本地订阅文件）：4 轮探完，**12 个源通过四步探测**（分片校验全 ✅）。
- 本机接线验证：R2 空 → 回退内置 8 个；探测写入后 → 生效 16 个动态源（与内置完全不同）。
- **线上实测**：部署后探测正常写入 R2（`system/dynamic-vod-sources.json`），
  搜索路径实际拿到 **5 个动态源**（电影天堂 / 猫眼 / iKun / 豆瓣 / 茅台），
  确认不是内置那 8 个 → 接线生效。
- 单元测试 117 项全过；`/health` `/api/movies/latest` `/api/sources/health`
  `/api/moments` `/api/books` `/api/gallery` 全部 200。
- 临时调试端点与临时 cron 已删除，线上确认 `/api/debug/dynamic-sources` → 404。

### 坑与注意

1. **CF 免费版每账号 5 个 cron 触发器**，加之前先查占用：
   `curl .../accounts/<id>/workers/scripts/<name>/schedules`。
2. **CF 出口 IP 会被部分源站拒绝**：线上探测时 `iqiyizyapi.com` 返回 503
   （本机同样如此），`cj.lzcaiji.com` 主清单超时。这是源站风控，不是代码问题；
   靠「连续失败 3 轮才摘 + 失败回退上一次结果」兜住。
3. **`wrangler tail` 抓不到 scheduled 日志**（只显示 fetch 请求），
   排查 cron 问题用临时 HTTP 端点更直接。
4. 本机走代理，探测耗时会明显高于 CF 边缘（速播本机 9.9s，CF 上快得多），
   **不要用本机耗时给线上定超时**。

### 下一步

- 观察几天线上探测通过率，必要时调 `DYNAMIC_SOURCE_BATCH` 或超时。
- 管理员接口目前只有后端，前端「源状态」页可考虑加一个入口（待用户决定）。

---

## 2026-10-12（第十一轮）· RSS 阅读器恢复（站长订阅、访客只读，分支 feat/now-settings）

**用户需求**：恢复 RSS（2026-10-09 曾整个删掉），但**不想自己一个个订阅**；
界面要做成开源阅读器 **Folo** 那种样子；**精选源只涉及国内的**。

**结论 / 方案**：走**方案 A —— 站长订阅一次、访客只读**。
站长在 `/rss` 里维护订阅源，所有访客打开 `/rss` 直接读，不用登录、不用订阅；
额度最低（只有站长的源被抓一次，访客读数据库里已有的条目）。

### 本轮完成内容

**后端**

| 文件 | 变化 |
| --- | --- |
| `backend/src/lib/rss.js` | 从删除提交取回 + 加 `description`（源简介）与 `contentHtml`（正文 HTML，≥200 字才存，截 200KB） |
| `backend/src/lib/rssSync.js` | 取回 + 失败记账（`last_error` / `error_count`，成功归零）+ 补全源简介 |
| `backend/src/lib/rssPresets.js` | **新增**：14 个**国内**精选源，分 AI / 科技媒体 / 开发者博客三组 |
| `backend/src/routes/rss.js` | 取回后**按方案 A 重写权限**：读走 `requireAuth`（访客可进）、写走 `requireAdmin`；字段白名单（不回传 `user_id`）；新增 `GET /presets` 与 `POST /discover`（自动发现 feed） |
| `backend/src/router.js` | 接回 14 条 `/api/rss/*` 路由（顺序：3 段路径排在 2 段之前） |
| `backend/src/index.js` | 抓取**搭现有 cron 的车**（`*/5 2-3 * * *` 里抓 6 个到期源），**不新增触发器** |
| `backend/src/lib/publicScope.js` | `PUBLIC_READ_RE` 加 `rss`；新增 `guestRssFeedFilters()`（访客只看 `is_public=true`） |
| `backend/src/routes/notifications.js`、`lib/notify.js` | `rss_new` 通知类型加回 |

**前端**

| 文件 | 变化 |
| --- | --- |
| `frontend/src/routes/Rss.jsx` | **新增**：Folo 式三栏阅读器（订阅源 / 文章列表 / 正文就地阅读），站长多一个管理抽屉（添加 / 精选源 / 批量） |
| `frontend/src/styles/rss.css` | **新增**：三栏布局样式，窄屏逐级折叠成单栏 |
| `frontend/src/lib/rssRead.js` | **新增**：访客的「已读」存本机（站长存数据库） |
| `frontend/src/lib/api.js` | 加 14 个 RSS 方法 |
| `frontend/src/routes/routes.js`、`app.jsx`、`components/Layout.jsx` | 接回 `/rss` 路由与顶栏入口 |
| 旧的 `RssFeeds.jsx` / `RssArticles.jsx` | **删除**（被新的单页三栏阅读器取代） |

**数据库**：新增迁移 `supabase/migrations/20261012000023_rss.sql`
（重建 `rss_feeds` / `rss_articles`，比旧版多 `is_public` / `last_error` / `error_count` / `content_html` 四列）。
**需要手动在 Supabase SQL Editor 跑一次**（见下面「坑」）。

**文档**：新增 `docs/rss.md`（权限矩阵 / 抓取机制 / 接口表 / 坑）；
`docs/removed-features.md` 的 RSS 一节标注为「已恢复，形态已变」。

### 精选源（国内，实测能抓）

AI 与前沿科技：量子位、雷锋网、InfoQ 中文站
科技媒体：36氪、IT之家、爱范儿、极客公园、钛媒体、少数派、开源中国、中国新闻网
开发者博客：阮一峰的网络日志、云风的 BLOG、Solidot 奇客资讯

实测**抓不到、已剔除**：机器之心（`/rss` 302 跳 data-service）、虎嗅（连接超时）、
品玩（返回 HTML 非 feed）、知乎日报（404）、澎湃（302）。这些站已不再对外提供 RSS，
放进来只会变成一堆红叉。

### 验证结果

- 后端单元 + 契约测试：**129 项全过**（新增 9 项 RSS 用例：RSS/Atom 解析、OPML 往返、
  访客白名单、`is_public` 过滤、路由读写权限、精选源纯国内、cron 未新增）。
- 前端生产构建：✅ 通过。
- 线上核对（部署前）：`/api/rss/feeds` → 404（RSS 尚未上线，符合预期）。

### 坑与注意

1. **数据库迁移要手动跑**：`.github/workflows/db-migrate.yml` 需要
   `SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_PASSWORD` 两个仓库密钥，目前**缺失**，
   自动迁移不会执行。必须在 Supabase SQL Editor 手动运行
   `supabase/migrations/20261012000023_rss.sql` 的内容，否则 RSS 接口会报
   「relation rss_feeds does not exist」。
2. **不能加 cron**：账号 5 个触发器已满，抓取只能搭 `*/5 2-3 * * *` 的车。
3. **访客过滤必须在查询层**：Worker 是 `service_role`，绕过 RLS。
4. **列表接口不带正文**：`content_html` 只在 `GET /api/rss/articles/:id` 返回。
5. **旧数据不可恢复**：2026-10-09 删除时数据一并删掉了，恢复后是空库。

### 下一步

- 用户验收 `/rss`：三栏阅读器、站长管理抽屉、精选源一键导入。
- 待办（用户已提，未做）：音乐 / 影视搜索结果里把「来自哪个源」显示得更醒目
  —— 用户反馈「搜出来看着和以前没区别」，其实是页面没把新增的音源 / 片源标出来。
