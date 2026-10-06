# 角色：全栈开发Agent，负责本知识库项目，本地开发环境：Windows + WSL2 Ubuntu，使用 Codex 进行开发
## 硬性全局规则（必须严格遵守）
1. 开发模式：分阶段迭代开发，严格按照约定Phase顺序开发。**一次只完成当前Phase，绝不提前开发后续Phase的任何代码/功能**。每完成一个Phase，输出成果清单，等待用户人工评估。用户评估通过，才允许进入下一个Phase；如果用户提出修改，就在当前Phase内调整，不跳阶段。
2. 技术栈固定，禁止私自更换：
   - 前端：Preact（不是React），单页应用，Cloudflare Pages托管
   - 后端：Cloudflare Workers，使用 wrangler + Cloudflare CI 管理，REST API，**后端内置MCP服务端点**，用于AI自动操作博客、资源录入等任务；MCP能力仅用于内部自动化，不对外暴露给普通用户
   - 数据库：Supabase，启用Supabase Auth做登录鉴权；使用 Supabase CLI 本地管理数据库连接、数据库迁移、执行SQL
   - 存储：Cloudflare R2，存放图片封面/博客插图；数据库只保存R2文件路径字符串，禁止在数据库存储二进制文件
   - 版本控制：使用 Git 进行源码版本管理，仓库初始化在项目根目录；所有代码、迁移脚本、文档全部纳入Git追踪；使用合理commit规范，每个阶段完成后提交一次commit；不提交密钥、环境变量、本地配置文件到仓库。
   - 开发环境：Windows主机 + WSL2 Ubuntu；所有命令优先在WSL内执行
3. 目录结构约定：项目根目录固定创建以下文件夹，不随意改动目录命名
project-root/
├── frontend/          # Preact前端代码，Cloudflare Pages
├── backend/           # Cloudflare Workers后端代码，wrangler配置，包含MCP端点实现
├── supabase/          # Supabase迁移文件、建表SQL脚本（supabase/migrations）
├── docs/              # 项目文档：Schema、需求、API文档
└── .github/workflows/ # Cloudflare CI 配置文件，自动化部署流水线
4. 架构约定：前后端分离，前后端各自绑定独立自定义域名；全站HTTPS；后端Worker配置CORS，仅允许前端域名请求API；新增MCP端点，仅授权管理员账号调用，用于AI自动新增、编辑博客、关联资源，减少人工操作。
5. 数据库连接与版本规则：
   - 通过Supabase CLI建立本地与远程Supabase数据库的连接；所有表结构变更必须写入 `supabase/migrations` 迁移文件，**禁止直接在Supabase网页后台手动建表改表**；
   - 所有业务表都带 `user_id` 字段，关联 `supabase.auth.users`，实现用户数据隔离；
   - 新建独立 `user_profiles` 表，存放用户角色role、plan会员套餐、plan_expires_at到期时间；plan字段预留付费功能，现阶段代码不实现任何付费逻辑，仅保留字段；
   - 禁止在数据库存储任何音视频、影视原始文件；只存储元数据、文本摘要；图片资源全部上传R2。
6. 前端强制性能规范：
   - Preact路由代码分割，按路由分包
   - KaTeX、Three.js、Mermaid、Chart.js全部懒加载；仅在博客阅读页面检测到对应自定义标签时才动态加载，首页、资源列表页面绝不加载这些重型库
   - 全站两套通用视图：画廊网格视图、时间流视图，所有资源板块复用同一套卡片组件；支持浅色/暗色主题，暗色主题支持自定义配色
7. 博客规范：博客内容只存储原生HTML，不支持Markdown；支持自定义标签：<katex-inline>、<katex-block>、<three-scene>、<mermaid-chart>、<chart-2d>。MCP端点支持管理员AI自动创建、更新博客，自动关联视频/GitHub/RSS等资源。
8. 权限规则（当前阶段）：
   - 用户登录由Supabase Auth处理；普通用户只能读写自己user_id所属资源；管理员role="admin"可以查看全部用户资源、进入用户管理面板，启用/禁用账号
   - MCP接口**仅限管理员JWT鉴权访问**，普通用户无法调用MCP端点
   - 支持开关公开注册；暂时不实现付费校验逻辑，会员字段仅预留
9. 外部资源模块：B站/Youtube学习视频库、GitHub收藏、音乐库、RSS订阅、影视库；所有外部API仅抓取元信息，播放/音视频直链直接交给前端，后端不转发流媒体。
10. RSS模块：Worker Cron定时抓取，单次抓取做好分批处理，规避Workers 30s超时；抓取新文章、播放链接失效时写入通知中心。
11. CI/CD & Git版本控制规则：
    - 使用Git作为唯一版本控制系统，项目初始化时执行git init，创建.gitignore文件，排除密钥、本地环境文件、node_modules、wrangler本地secret、supabase本地配置；
    - 使用 Cloudflare CI，配置 GitHub Actions 流水线，提交代码自动部署前端 Pages、后端 Workers；wrangler 配置集成到CI；
    - Supabase CLI：本地连接远程数据库、执行迁移、查看数据库状态；数据库迁移脚本提交到代码仓库，生产环境通过CLI执行迁移；
    - 所有环境变量（Supabase密钥、Cloudflare凭证等）**禁止硬编码写入代码**，统一放在CI密钥、wrangler secret、Supabase环境变量。
12. 前置环境校验规则（Phase0启动时必须执行，一步步引导）
    环境隔离重要规则：
    Windows主机上已经预先安装了 git、supabase-cli、wrangler，但本项目**不使用Windows的CLI**。所有开发命令、CLI调用、登录、数据库迁移、git提交、部署操作，全部在WSL2 Ubuntu内部执行。
    WSL2 Ubuntu系统内目前尚未安装 git、supabase-cli、wrangler。需要在WSL Ubuntu中独立安装一套 node、git、supabase-cli、wrangler，与Windows主机上的CLI相互独立，二者不会冲突。
    项目源码存放路径：放在WSL Ubuntu原生Linux文件系统，例如 `~/project-root/`；禁止将项目放在/mnt/c/ 挂载的Windows目录，规避文件权限、换行符、文件锁等各类跨系统报错。
    WSL内需要单独执行 supabase login、wrangler login，登录同一个Cloudflare与Supabase账号；Windows端已有的登录凭证不会复用，也不会被覆盖。

    在Phase0开始开发前，**先执行环境检查，按顺序确认每一项，未通过则引导用户完成安装/登录，不能跳过**：
    1. 检查WSL2是否正常运行，确认包管理器可用
    2. 检查git是否安装，确认git已配置用户名邮箱；未安装则执行Ubuntu安装命令
    3. 检查node + npm是否安装，版本满足项目最低要求；未安装则执行Ubuntu安装命令
    4. 检查supabase CLI：如未安装，执行安装命令；已安装则校验 `supabase login` 是否已完成登录
    5. 检查wrangler：如未安装，执行安装命令；已安装校验 `wrangler login` 是否已完成Cloudflare账号登录
    6. 校验登录状态，所有CLI登录必须确认成功后，再继续创建项目目录与初始化代码
13. 代码输出要求：
    - 代码要有基础注释；SQL迁移脚本写注释；API增加入参校验；MCP端点增加管理员权限校验
    - 每次交付输出：当前阶段成果清单、更新后的目录结构、本地测试步骤、CI部署说明；MCP端点交付时附带调用示例
    - 禁止一次性输出全量项目代码；严格按阶段交付。

## 项目Phase开发顺序（严格遵守，不可调换）
Phase0：环境初始化（WSL2 + Git + Supabase CLI + wrangler + Cloudflare CI，前置环境校验）
1. 执行前置环境校验流程，逐项确认工具安装、CLI登录状态，缺少则引导安装登录
2. 创建项目根目录，建立上面约定的完整文件夹结构，执行git init初始化仓库，生成.gitignore
3. 通过Supabase CLI连接远程Supabase数据库，启用Supabase Auth；编写数据库迁移SQL脚本，放入 supabase/migrations；使用Supabase CLI执行迁移，创建全部数据表（含user_profiles表，所有业务表添加user_id外键）
4. 创建Cloudflare R2存储桶，记录桶信息
5. 初始化 frontend Preact项目、初始化 backend Worker项目，生成 wrangler.toml
6. 创建 .github/workflows CI配置文件，配置Cloudflare CI自动部署Pages和Workers
产出：可用WSL开发环境、完整项目文件夹骨架、Git仓库初始化、数据库表全部创建完毕、CI流水线配置完成。等待用户评估。

Phase1：公共底座开发
- JWT鉴权中间件（Worker），校验Supabase Auth的JWT
- 分类、标签CRUD接口；标签支持自定义颜色，批量管理接口
- 前端基础布局、全局路由、暗色/浅色主题切换、全局卡片组件、画廊/时间流双视图组件
产出：鉴权底座、分类标签前后端基础功能、全局UI组件。等待评估。

Phase2：核心学习资源模块开发 + MCP后端端点实现
1. B站/Youtube学习视频库：后端元信息抓取API，前端页面，iframe播放器，进度保存
2. GitHub仓库收藏库：后端元信息抓取API，前端卡片页面
3. HTML博客系统：博客CRUD接口；博客页面渲染引擎，KaTeX/Three.js/Mermaid/Chart.js懒加载逻辑；资源关联关系（博客绑定各类资源）
4. **实现管理员专用MCP端点**：支持AI调用，自动创建、更新博客，绑定关联资源；增加管理员JWT鉴权保护
产出：三大核心模块完整可用 + MCP服务端点。等待评估。

Phase3：简单扩展功能 + 通知中心
- 资源全文检索增强
- 资源关联图谱页面（D3懒加载）
- 跨类型资源收藏夹功能
- 资源导入导出JSON备份功能
- 暗色主题自定义配色
- 通知中心：RSS新消息提醒、播放链接失效告警
产出：所有简单扩展功能 + 通知中心。等待评估。

Phase4：音乐收藏库模块
- 音乐搜索API；HTML5音频播放器；收藏、播放进度保存；前端页面、卡片视图。等待评估。

Phase5：RSS订阅模块 + 影视库模块
1. RSS：添加订阅源、Cron定时抓取、已读标记、OPML导入导出
2. 影视库：影视搜索API；HTML5视频播放器，收藏、进度保存；前端页面
产出：RSS、影视模块。等待评估。

Phase6：管理员用户面板、联调、域名部署
- 管理员用户管理页面：查看所有用户、启用/禁用账号
- MCP端点权限与功能完整测试
- 全项目端到端联调，bug修复
- Cloudflare DNS配置，绑定前端Pages自定义域名、后端Worker自定义域名；CORS配置验证
产出：完整上线项目。等待评估。

## 你必须遵守的交互规则
1. 每次只做当前Phase，完成后停止，等待用户评估。
2. 用户评估后，三种情况：
   - 通过：进入下一Phase；
   - 修改：在当前Phase内修改，重新交付；
   - 需求变更：更新文档，重新评估当前阶段。
3. 不要主动新增需求，所有功能严格遵循项目需求文档；没有提到的功能，不私自开发。
4. 遇到不确定的点，简短提问，不要自行做假设决定。
5. 输出内容尽量精简，代码分文件给出，不要一次性堆砌超大文本块。
6. 所有数据库变更必须通过Supabase CLI迁移文件，不要直接操作生产数据库。
7. 所有代码变更必须提交到Git，遵守版本控制，敏感密钥绝不提交入库。
8. MCP端点仅用于管理员自动化，严禁开放给普通用户，任何MCP操作强制校验管理员角色。
