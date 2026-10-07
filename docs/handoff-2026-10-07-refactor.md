# 交接文档：体验重构任务（2026-10-07）

> 本文是给**下一个接手的 Agent** 的一次性交接材料，来源是用户与上一轮 Agent 的对话。
> 常规进度仍在 `docs/progress.md` 维护；本文只解决"这一轮要干什么、有什么坑"。
> 阅读顺序：**本文第 0 节（环境）→ `README.md` → `docs/progress.md` → `docs/pages-audit-2026-10-07.md`（逐页问题）→ `docs/interface-inventory.md` → `docs/api.md`**。

---

## 0. 环境与路径（开工前必读）

### 机器与虚拟机

- 用户的电脑是 **Windows**；所有开发都在 **WSL2 里的 Ubuntu 虚拟机**中进行，**不在 Windows 侧写代码**。
- WSL 发行版：**`Ubuntu-24.04`**（Ubuntu 24.04.4 LTS）；Linux 用户名 `xgc`，家目录 `/home/xgc`。
- **本轮唯一的目标项目**：`/home/xgc/projects/knowledge-base`
  - 从 Windows 侧访问该目录：`\\wsl$\Ubuntu-24.04\home\xgc\projects\knowledge-base`
  - Windows 浏览器通过 `localhost` 访问 WSL 里跑的服务（前端 5173 / 后端 8787）。
- `~/projects` 下另有三个目录，**与本任务完全无关，不要动**：`Demo/`（全栈教学示例）、`cad-workspace/`（CAD 工作区）、`test_cases/`（空壳目录）。

### 已装工具（实测版本）

| 工具 | 版本 |
| --- | --- |
| Node.js | `v24.20.0` |
| npm | `11.19.0` |
| wrangler | `4.147.0` |
| Supabase CLI | `2.119.0` |

### 两条路径禁忌

1. **绝不要把项目或构建产物放到 `/mnt/c/...`**。跨文件系统访问极慢，且 `wrangler` / `vite` 在该路径下行为异常。项目已在 WSL 原生盘，**保持现状**。
2. **不要碰 Windows 侧的 Codex 环境**：`C:\Users\x1078\.codex\`（含它自己的 `config.toml` 与会话数据）。那是 Windows 原生 Codex 的另一套配置，用户明确说过不处理。

### 运行时的坑（重要，来自 `docs/progress.md`）

- 当前 shell 里存在 `CODEX_CI` 与代理环境变量，会导致**本地 `wrangler dev` 出网失败**。启动前必须清掉：

```bash
env -u CODEX_CI -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u ALL_PROXY -u all_proxy \
  npx wrangler dev --port 8787 --local --ip 127.0.0.1
```

- 本地接口测试容易失败，**验证优先直接打线上**（`https://api.xuguochen.de5.net`）。
- 收尾要释放端口：`pkill -f workerd; pkill -f "wrangler dev"; pkill -f vite`。

### 凭据与敏感文件

- `backend/.dev.vars`、`frontend/.env.local`、`supabase/.env.local`、`supabase/.temp/` —— 均已在 `.gitignore`。**不要读取内容、不要输出到对话、不要提交**。
- 线上接口验证需要管理员 JWT 时，按 `docs/progress.md` 第 5 节的方式临时获取。**注意：该节含有明文口令，不要把口令复制进任何新建文件，也不要写进提交信息。**

---

## 1. 用户对这一轮的目标（原话意图整理）

**一句话**：不是修 bug，而是把整个产品从"能用的个人项目"提升到"大型项目的功能深度 + 行业顶尖的界面水准"。

用户明确列出：

1. **背景/整体视觉是满意的，不要推倒重来。** 吐槽集中在"每个页面的功能设计"和"对应功能那些组件的排布"。
2. **影视库 + 音乐库**是重灾区：组件排布不合理，要求重新设计得更合理、更易用。
3. **搜索源要更多、质量要更高。** 不仅是影视采集源，音乐音源同理——"尽可能多、尽可能高质量"。
4. **每个页面都要对标行业顶尖水平。** 用户点名参考 **Folo**（RSS 阅读器，开源，https://github.com/RSSNext/Folo ）的 RSS 界面设计与功能完备度，要求"内部功能设计也要完全齐备"。
5. **当前评价：像"豆腐渣工程"。** 认为项目"没有站在大型项目的角度思考功能如何设计、UI 如何美化"，"细节没打磨好，功能不够深入"。
6. **用户自认的一个成因**：联网调研不够，没有参考/集成优秀的开源项目。
7. **约束条件**：云端服务全部使用免费额度，用户主要担心**数据库（Supabase）压力**——但明确表示"这不能成为理由"。

**用户对"重构"的措辞纠正**：不是推倒重写，而是"将它的功能进行一个更大的改观"，重点是**功能深度 + 页面组件排布**。

---

## 2. 项目现状速览

| 项 | 值 |
| --- | --- |
| 项目 | **Dora** · 个人知识管理平台（原「知识库」） |
| 仓库 | `/home/xgc/projects/knowledge-base`（WSL2 原生盘，禁止放 `/mnt/c`） |
| 技术栈 | Preact + Vite（Cloudflare Pages）/ Cloudflare Workers + wrangler / Supabase Postgres / Cloudflare R2 / GitHub Actions |
| 前端线上 | `https://dora.xuguochen.de5.net` |
| 后端线上 | `https://api.xuguochen.de5.net` |
| 当前分支 | `main`，与 `origin/main` 齐平，HEAD = `f5d64b1` |
| 规模 | `frontend/src` 64 文件、`backend/src` 33 文件，合计约 15,559 行 |
| 进度 | Phase0–6 全部完成并上线，之后为增量改造 |

**后端路由**（17）：admin / backup / categories / favorites / github / graph / mcp / me / movies / music / notifications / posts / preferences / rss / search / tags / videos

**前端页面**（25）：Home / Login / Posts / PostView / PostEdit / Videos / Github / Music 系 / Movies 系 / RssFeeds / RssArticles / Search / Graph / Favorites / Categories / Tags / Settings / Backup / AdminUsers 等

**核心设计**：统一资源模型——视频 / GitHub / 音乐 / 影视 / RSS 文章全部存入 `resources` 表，用 `type` 区分，因此标签、分类、收藏夹、全局搜索、关系图谱天然共享。

**两条不可违反的铁律**（`docs/progress.md` 第 0 节）：
- 数据库变更必须走 `supabase/migrations/` 迁移文件，不允许直接改线上表结构。
- 写操作必须 `user_id=eq.${user.id}`；管理员仅通过 `?all=true` 获得**读**权限。

---

## 3. ⚠️ 工作树是脏的——动手前必须先处理

当前有 **4 处未提交改动 + 1 个未跟踪文件**，是上一轮留下的半成品，**不是接手 Agent 的改动，禁止直接 revert**：

| 文件 | 改动内容 | 状态判断 |
| --- | --- | --- |
| `backend/src/lib/maccms.js` | 重排 `DEFAULT_VOD_SOURCES`：新增红牛资源，把无防盗链的 3 源（dytt/zy360/hongniu）提前，lzi/ffzy/zuid 降为补充 | 逻辑完整，但**未提交** |
| `backend/src/lib/fetchers.js` | 音乐搜索上限 20→30；影视候选改为「可播放优先 + 上映年份降序」 | 逻辑完整，但**未提交** |
| `docs/progress.md` | 新增 2.10 节「影视源修复（2026-10-07）」，记录**后端已部署上线**（Worker 版本 `68e5831f-dbd5-4b60-bc02-3f8cad3ecca4`） | 内容完整，但**未提交** |
| `frontend/src/routes/Music.jsx` | **删除了音乐页的「我的音乐库」整块列表、搜索框下的推荐词、「发现更多」区块**（净删 57 行） | **半成品**：`RECOMMEND`(L12)、`shelves`(L184)、`AlbumCard`(L22) 三个定义仍在但已无任何引用，属死代码 |
| `backend/src/lib/maccms.js.bak` | 未跟踪的备份文件（12KB） | 应删除或加入 `.gitignore` |

**注意**：`docs/progress.md` 里记录了后端已部署，但前端是否同步部署未确认（`frontend/dist/` 构建于 04:53，源码改动为 04:44）。

**建议的第一步**：先与用户确认这 4 处是"保留并提交"还是"作为半成品纳入本轮重构"，不要擅自丢弃。

---

## 4. 已知技术短板（重构时的发力点）

上一轮 Agent 的观察，供下一轮参考（不是用户原话，是分析结论）：

- **纯 JavaScript，没有 TypeScript。** 1.5 万行代码、17 个后端路由 + 25 个前端页面，全靠约定维持，没有类型护栏。
- **没有测试目录。** 没有任何自动化测试，改动靠手测 + 线上验证。
- **前端路由单文件偏大**，`Music.jsx` 这类页面文件承担了过多职责（现在正是出问题的地方）。
- **组件复用度不足**：`GalleryView` / `TimelineView` / `ViewSwitch` 已有雏形，但各业务页仍在自行拼装卡片与列表，导致"每个页面的组件排布不一致、不合理"——这正是用户吐槽的根源。
- **缺少设计语言规范**：有 CSS 变量与主题系统，但没有组件级的布局规范文档，所以新页面只能凭感觉排布。
- **联网调研不足**：采集源、设计参考、开源方案对比都缺少沉淀记录。

---

## 5. Agentik MCP（$5 免费额度）——能力边界，务必看清

### 连接状态

| 项 | 值 |
| --- | --- |
| 客户端 | Codex（用户级配置 `~/.codex/config.toml`） |
| 端点 | `https://ai.agentik.cc/mcp`（Streamable HTTP） |
| 认证 | **OAuth 已完成**，无需 API Key |
| 工具 | `discover_tools` / `inspect_tool` / `get_account` / `prepare_topup` / `run_tool` / `get_run` |
| 验证方式 | `discover_tools` + `inspect_tool` 均已实际调用成功 |

### 额度现状（2026-10-07 实测 `get_account`）

- `available_usd: 5`，**全部为促销额度**；`paid_available_usd: 0`。
- 到期时间：**2026-10-21T01:39:21Z**。
- **单次调用预留上限 `max_call_usd: $0.10`**——超过这个数的工具，促销额度不覆盖，会直接调用失败（不会扣钱）。
- **视频类工具不可用**（明确要求 paid credit）。
- 促销额度先于付费额度消耗；用光且未充值后，所有付费工具失效。`$0` 免费工具不受影响（另有每日 50 次上限，工作区充值后为 1000 次/天）。

### 能干什么、不能干什么

**不能**：跑 Claude Code 或 Codex。Agentik 是第三方**工具市场**（当前 391 个工具），不是模型订阅，买不到任何编程能力。

目录里唯一的"模型"类端点是 dataforseo 的 AI Visibility 系列（Claude / ChatGPT / Gemini / Perplexity），**不适合开发用途**：
- `user_prompt` 上限 **500 字符**，无仓库上下文、无文件读写、无法执行命令；
- Claude 那个的 `model_name` 枚举**只有 `claude-haiku-4-5`**，选不了 Opus/Sonnet；
- 单价（单次预留）：Gemini $0.00085 / ChatGPT $0.0016 / Claude $0.0031 / Perplexity $0.0151。

**能**：当**联网调研副手**，这是这 $5 对本任务最有价值的用法：
- `serper/search`（Google SERP）约 **$0.001/次**
- `exa/search`（神经搜索，可回正文）约 **$0.007/次**
- 其它可用：`exa/particle`（播客检索）、各类 dataforseo SEO 端点
- 完全免费的：`frankfurter/latest-rates`（汇率，$0）

按 100–300 次调研检索估算，总成本约 $0.3–$2，额度充足。

### 使用纪律

- **执行任何付费工具前必须先 `inspect_tool` 确认价格为 $0，并向用户报备；未获确认不得执行。**
- 不得在未授权时 `prepare_topup`、`run_tool`、`get_run`。
- `get_account` / `discover_tools` / `inspect_tool` 是免费只读的，可放心使用。
- 用户明确要求：**不要在聊天里索要或粘贴任何 API Key / 凭据**。

### 遗留问题（用户已表示"不用管"）

Windows 侧的 `C:\Users\x1078\.codex\config.toml` 曾被写入一条**未认证**的 `[mcp_servers.agentik]` 条目（备份为 `config.toml.bak-20261007-095134-pre-agentik`）。用户明确说不要处理 Windows 侧，**不要动它**。

---

## 6. 给下一轮 Agent 的建议路径

1. **先收敛工作树**：确认第 3 节的 4 处改动如何处置，让 `git status` 干净后再开新分支。
2. **先出方案，再写代码**：本轮是"体验重构"，涉及 25 个页面，直接开工必然返工。建议先产出一份方案文档（放 `docs/`），至少覆盖：
   - 全站页面的**信息架构与组件排布规范**（每页的区块顺序、密度、空状态、加载态）；
   - 抽出的**通用页面骨架组件**（统一页头、视图切换、卡片网格、空状态），治"每页各排一套"的病；
   - 影视 / 音乐页的**具体重排方案**；
   - 搜索源扩充清单（影视采集源 + 音乐音源），每源标注**可用性实测结论**（是否防盗链、是否过期、命中率），沿用 `docs/interface-inventory.md` 的格式；
   - 数据库压力评估（用户在意 Supabase 免费额度）。
3. **善用那 $5 调研**：用 `serper` / `exa` 查 Folo 等开源项目的界面与功能设计、Cloudflare Workers / Supabase 最佳实践。调研结论要沉淀进 `docs/`，不要只留在对话里。
4. **遵循既有约定**：DB 改动走迁移文件；写操作带 `user_id` 过滤；每次改动后跑 `npx vite build` 与 `node --check`；提交信息格式 `feat(scope): 摘要`。
5. **不要碰**：`backend/.dev.vars`、`frontend/.env.local`、`supabase/.temp/` 等敏感文件；不要把它们提交进仓库。

### 顺手该处理的安全问题

`docs/progress.md` 第 0 节**明文写有管理员账号与密码**，且这段内容已进入 git 历史。建议与用户确认后改为环境变量引用，并考虑是否需要清理历史记录。

---

## 7. 一句话交接

> 项目 Dora 已完成 Phase0–6 并上线，功能骨架齐全但体验粗糙；本轮目标是把**每个页面的功能深度与组件排布**提升到行业顶尖水准（影视、音乐、RSS 为重点，RSS 对标开源项目 Folo）。工作树有 4 处上一轮未提交的半成品改动需先处置。可用 Agentik 的 $5 促销额度做联网调研，但它**不能**用来跑 Claude Code 或 Codex，单次调用预留上限 $0.10，视频工具不可用。

---

## 8. 启动提示词（用户可直接复制给下一个 Agent）

> 说明：粘贴后请把【日期】和最后一句的选项按需改一下即可使用。

```text
【任务】对 Dora 知识库项目做一轮"体验重构"：不是修 bug，也不是推倒重写，
而是把每个页面的功能深度和组件排布，提升到大型项目 / 行业顶尖的水准。

【环境】
- 我的电脑是 Windows，开发全在 WSL2 的 Ubuntu 虚拟机里做，不要在 Windows 侧改代码。
- WSL 发行版 Ubuntu-24.04，Linux 用户 xgc。
- 目标项目（唯一）：/home/xgc/projects/knowledge-base
  从 Windows 侧看是 \\wsl$\Ubuntu-24.04\home\xgc\projects\knowledge-base
- ~/projects 下的 Demo/、cad-workspace/、test_cases/ 与本任务无关，不要动。
- 不要碰 Windows 侧的 C:\Users\x1078\.codex\（那是另一套 Codex 配置）。

【开工前必读，按顺序】
1. docs/handoff-2026-10-07-refactor.md  ← 先读它的第 0 节（环境与坑）
2. README.md
3. docs/progress.md                      ← 项目做到哪一步、部署与验证方式
4. docs/pages-audit-2026-10-07.md        ← 25 个页面的逐页问题清单
5. docs/interface-inventory.md、docs/api.md

【这一轮要做的事】
- 我对整体背景/玻璃质感视觉是满意的，不要推翻视觉语言。
  我不满意的是：每个页面的功能设计、以及页面上那些组件的排布方式。
- 影视库（/movies）和音乐库（/music）是重点：组件排布要更合理，
  音乐页现在还是个半成品（音乐库列表被删了，留下一堆没用的死代码）。
- 全站页头、列表卡片、加载态/空态不统一，这是"排布不合理"的根因，请一并治理。
- 搜索源要更多、更高质量：影视采集源和音乐音源都要扩充，
  每个源都要实测可用性（是否防盗链、是否过期、命中率），并写进 docs/。
- RSS 模块要完整对标开源项目 Folo（https://github.com/RSSNext/Folo）：
  包括三栏阅读器、未读管理、快捷键、订阅源分组等，不只是换个皮肤。
- 每个页面的功能都要想深一层，别只做表面。我要的是"大型项目"的完成度。

【约束】
- 数据库改动必须走 supabase/migrations/ 迁移文件，不能直接改线上表结构。
- 所有写操作必须带 user_id 过滤；管理员只有 ?all=true 的读权限。
- 云端服务全是免费额度，我比较在意 Supabase 的压力，方案里要说明这一点。
- 不要读取/输出/提交 .dev.vars、.env.local、supabase/.temp 等敏感文件。
- 本地 wrangler dev 出网会挂，需要先清掉 CODEX_CI 和代理环境变量（见交接文档第 0 节）。

【先做这一步，别急着写代码】
- 先处理工作树：现在有 4 处上一轮未提交的改动 + 1 个未跟踪的 .bak 文件，
  其中 frontend/src/routes/Music.jsx 是半成品。请先告诉我你打算怎么处置这些改动，
  得到我确认后再动手。
- 然后产出一份重构方案文档（放 docs/），至少包含：
  统一页头/卡片/空态组件的设计、影视与音乐页的重排方案、
  搜索源扩充清单（含实测结论）、RSS 阅读器的功能清单与布局、
  以及分阶段实施步骤和每步的验收标准。
- 方案给我看过、我点头之后，再开始改代码。

【工具】
- 你可以用已连接的 Agentik MCP 做联网调研：serper/search 约 $0.001/次、
  exa/search 约 $0.007/次，用来查 Folo 的实现、Cloudflare Workers 与 Supabase 最佳实践。
- 但它只有 $5 促销额度（2026-10-21 到期）、单次调用预留上限 $0.10、视频工具不可用；
  它不能用来跑 Claude Code 或 Codex。
- 执行任何付费工具之前，先把价格报给我确认。

现在开始：先读上面那几份文档，然后告诉我你理解的任务、你看出的关键问题，
以及你打算怎么处置工作树里那几处未提交的改动。
```
