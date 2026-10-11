# 碎念页与设置安全中心（2026-10-10 初版，2026-10-11 改版，分支 `feat/now-settings`）

本文说明两个页面背后的数据模型、权限边界与安全取舍：

- `/moments` 碎念（朋友圈式的短动态流）
- `/settings` 设置与安全中心（账号 / 外观 / 安全 / 数据 / 管理员入口）

## 1. 碎念（`/moments`）

### 1.0 改版说明（2026-10-11）

初版是「此刻」（`/now`）——六类状态卡（在造 / 在学 / 在读 / 在听 / 在看 / 在想）。
用户要求改成**朋友圈式**的随手记，于是：

- 页面与接口改名为「碎念」/ `/moments`，**旧的 `/api/now` 已下线**（路由与白名单都换掉了）；
- 数据模型换成「一段正文 + 若干配图」，**去掉六类 kind**（朋友圈没有分类）；
- 导航上「碎念」升为**一级导航**，同时删掉了「更多」下拉（当时它只剩这一项）；
- 初版的 `now_entries` 表**从未在线上执行过**（线上迁移只到 0016），所以这次直接用新结构建表，
  旧迁移文件已删除，新迁移 `20261010000018_moments.sql` 已应用并登记进迁移历史。

### 1.1 产品定位

「碎念」是站长**显式发布**的短动态：一段正文 + 可选配图（最多 9 张），按发布时间倒序。

它**不是行为追踪**——页面不会自动读取播放历史、阅读记录、访问日志等私人行为，
所有条目都由站长手动发布，且只有**显式勾选「公开」**的条目才会出现在访客眼前。

### 1.2 数据模型：`moments` + `moment_assets` + `moment_files`

迁移 `supabase/migrations/20261010000018_moments.sql`（碎念与配图）、
`supabase/migrations/20261010000019_moment_files.sql`（文件附件）。

`moments`（碎念本体）：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid | 主键 |
| `user_id` | uuid | 归属（`auth.users`，级联删除） |
| `content` | text | 正文，必填（≤2000 字） |
| `is_public` | boolean | 是否对外可见，**默认 false（私人）** |
| `created_at` / `updated_at` | timestamptz | 时间戳，`updated_at` 由触发器维护 |

`moment_assets`（配图关联，二进制仍在 R2 的 `assets`）：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `moment_id` | uuid | 指向 `moments(id)`，级联删除 |
| `asset_id` | uuid | 指向 `assets(id)`，**不复制**图片字段 |
| `user_id` | uuid | 归属 |
| `sort_order` | integer | 展示顺序（按数组下标写入） |

约束与索引：

- 主键 `(moment_id, asset_id)`：同一条碎念里同一张图只能出现一次。
- **复合外键** `(user_id, asset_id) -> assets(user_id, id)`：在数据库层强制「配图与碎念同 owner」
  （与 `gallery_items` 同一套做法——仅靠 RLS 的 `auth.uid()=user_id` 挡不住直连 Supabase 的
  authenticated 用户挂他人素材）。
- `idx_moments_user_public (user_id, is_public, created_at desc)`、`idx_moment_assets_moment`。
- 复用 `public.set_updated_at()` 触发器维护 `updated_at`。
- 开启 RLS；策略与 `assets` / `gallery_items` 一致（本人读写、管理员可读全部、管理员 `for all`）。

`files` + `moment_files`（**2026-10-11 新增：文件附件**）：

| 表 | 关键字段 | 说明 |
| --- | --- | --- |
| `files` | `id` / `user_id` / `object_key` / `public_url` / `original_name` / `mime_type` / `size` / `sha256` / `is_public` | 文档附件元数据，二进制在 R2（`files/<user_id>/<年>/<uuid>.<ext>`）；**默认 `is_public=false`** |
| `moment_files` | `moment_id` / `file_id` / `user_id` / `sort_order` | 碎念 ↔ 附件关联；主键 `(moment_id, file_id)`；复合外键 `(user_id, file_id) -> files(user_id, id)` 强制同 owner |

**为什么图片和文档分两张表**：图片展与博客封面只认 `assets`（要宽高、要能当 `<img>`），
PDF / Word 混进去会破坏缩略图逻辑；反过来文档也不需要宽高。分开后各自的安全校验也互不干扰。

**附件公开状态跟随碎念**（`moments.js#replaceFileLinks` / `syncLinkedFilesPublic`）：

- 发布 / 编辑时，若碎念 `is_public=true`，本次挂载的附件一并置为 `is_public=true`（否则访客能读到
  碎念却下不了附件）；若碎念是私人，附件保持 / 收回 `false`。
- 把附件从碎念里移出关联时，**旧附件自动收回公开**，避免「碎念删了附件还挂在公网」。
- 仅改 `is_public` 而附件列表没变时，也会把已挂载附件的公开状态同步过去。

### 1.3 为什么默认私人

「碎念」是**公开内容页**，但默认值不能是「公开」。原因：

1. 默认公开意味着「发布即外泄」——站长在发布框里漏勾一次，私人碎念就被访客读到；
2. 与 `gallery_items` 保持一致语义：**显式公开才对外可见**；
3. 数据库默认值与路由过滤双层保证，即使应用层写错，访客也不会看到私人条目。

> 前端发布框的复选框**默认勾选「公开」**（朋友圈的直觉是「发了就是给大家看」），
> 但后端与数据库的默认值仍是 `false`。这样「前端忘记传字段」时落到安全的一侧；
> 而用户想发私密内容时，取消勾选即可。

### 1.4 权限矩阵（三层模型）

与全站一致（见 `docs/public-access.md`）：

| 操作 | 公开访客 | 登录用户 | 管理员（站长） |
| --- | --- | --- | --- |
| `GET /api/moments` | ✅ 仅 `is_public=eq.true` | 仅本人 | 仅本人 |
| `POST /api/moments` | ❌ 401 | ❌ 403（需管理员） | ✅ 仅本人，默认私人 |
| `PATCH /api/moments/:id` | ❌ 401 | ❌ 403 | ✅ 仅本人（`id` 且 `user_id` 双限定） |
| `DELETE /api/moments/:id` | ❌ 401 | ❌ 403 | ✅ 仅本人 |

关键点：

- Worker 用 **service_role** 直连 PostgREST，**RLS 不会替它过滤**。访客读必须由路由在
  查询层显式叠加 `is_public=eq.true`（`backend/src/lib/publicScope.js#momentGuestFilters`）。
- 访客上下文里的 `user.id` 是**站长 id，只用于限定查询范围**，不是身份；
  因此 `POST/PATCH/DELETE` 一律 `requireAdmin`，访客根本进不去写接口。
- **登录用户/管理员读 `/api/moments` 也只返回本人条目**（碎念是公开内容页，不因登录而看到私密项）。
- 写操作永远只作用于本人：`PATCH/DELETE` 用 `id=eq.X 且 user_id=eq.自己` 双条件，
  非本人一律 404（不泄露存在性）。

### 1.5 配图安全规则

配图只存 `assets.id` 引用，二进制始终在 R2，**不复制**到碎念表。三道校验：

1. **应用层**：`assertOwnAssets()` 逐条确认每个 `asset_id` 都属于当前用户，缺失即 404
   （不泄露「这个 id 是否存在」）；张数上限 9（`MAX_MOMENT_ASSETS`，前后端共用口径）。
2. **数据库层**：`moment_assets` 的复合外键 `(user_id, asset_id) -> assets(user_id, id)`
   强制同 owner，绕不过去。
3. **读取层**：`decorate()` 无论访客还是站长都显式带 `user_id=eq.<owner>` 取素材，
   查不到的直接丢弃（非本人 / 未公开 / 已删），因此不会把别人的私人图带出来。

`asset_ids` 会被**去重保序**（`normalizeAssetIds`），PATCH 传该字段表示**整体替换**配图。

> URL 安全校验（`javascript:` / 协议相对地址等）已抽成通用纯函数
> `backend/src/lib/safeUrl.js`（`isSafeUrl` / `normalizeSafeUrl`），
> `PATCH /api/me` 的 `avatar_path` 与碎念共用同一实现，不再各写一份。

### 1.6 响应字段白名单

`/api/moments` 返回固定字段：`id, content, is_public, created_at, updated_at` + `images[]`。

**绝不返回 `user_id`**（访客上下文里那是站长 id），也不 `select: '*'` 后整行透传。
`images[]` 只含 `url / width / height / mime_type`，**不含** `object_key` / `sha256` / `original_name`。

## 2. 设置与安全中心（`/settings`）

### 2.1 分区

| 分区 | 内容 |
| --- | --- |
| 账号 | 只读展示邮箱 / 角色 / 套餐 / 用户 ID；可编辑显示名与用户名 |
| 外观 | 原样保留 `ThemeCustomizer`（主题配色） |
| 安全 | 修改密码（官方重置邮件）、退出登录（二次确认）、静态安全提醒 |
| 数据 | 备份与恢复入口链接到 `/backup`；导出备份快捷按钮 |
| 管理员 | 仅 `isAdmin` 渲染：用户管理 `/admin/users`、源状态 `/sources` |

本页不新建导航、不加权限体系、不加路由；管理员快捷入口只是链接到已有页面。

### 2.2 能改 / 不能改的字段

`PATCH /api/me`（`backend/src/routes/me.js#updateMe`）：

- **可改**（安全字段白名单）：`display_name`、`avatar_path`、`username`。
- **明确拒绝**（不是忽略，是 422）：`role`、`plan`、`plan_expires_at`、`is_disabled`、`id`。
- 访客（`user.isGuest`）一律 403——访客上下文里的 `user.id` 是站长 id，绝不能借它改档案。
- `display_name`：可选字符串，≤80，允许传 `null` 清空。
- `avatar_path`：可选字符串，≤500，只允许 http/https 绝对地址或站内相对地址
  （复用 `normalizeNowUrl`，不重复实现），允许 `null`。
- `username`：可选字符串，3..60，正则 `/^[a-zA-Z0-9_.-]+$/`；
  PostgREST 409 / `duplicate key` → `HttpError(409, '用户名已被占用')`。
- 写库严格按本人 id：`db.update('user_profiles', qs({ id: eq.${user.id} }), patch)`。

字段挑选逻辑抽成可单测的纯函数 `buildProfilePatch(body)`。

数据库层另有迁移 `20261010000014_lock_profile_privileged_fields.sql` 把 `authenticated`
的表级 update 收窄到这三列，应用层校验是第二道保险。

### 2.3 为什么密码重置走官方邮件

设置页**绝不接收、不显示、不发送明文密码**。点「发送重置邮件」时调用
`supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/login' })`，
由 Supabase 官方流程发信，用户在邮件里点链接自行设置新密码。

前端不接触明文密码，就少了「前端把密码发到自建接口、接口再转发」这一整条风险链。

### 2.4 为什么不显示令牌

设置页**绝不显示** token / JWT / access_token / refresh_token / 数据库地址 / 密钥。
这些值出现在界面上只会增加被肩窥、被截图、被浏览器插件采集的风险；
它们对用户也没有任何可操作价值。

`PATCH /api/me` 的返回结构与 `GET /api/me` 一致：
`{ id, email, username, display_name, role, plan, is_admin }`。

## 3. 已知边界与后续可做

- **碎念无 RSS / 订阅**：后续可加 `/moments.rss`，把公开条目输出为 feed。
- **无草稿预览**：管理员编辑时只在页内表单改，没有「预览为访客」模式。
- **无点赞 / 评论**：朋友圈形态只做了发布与展示；互动需要新表与访客身份，暂不做。
- **无图片拖拽排序**：配图按选择顺序排列，不能拖动调整。
- **无历史快照**：条目被编辑/删除后不保留版本；碎念是动态流，不是日志。
- **头像路径可改但无上传 UI**：`avatar_path` 字段已在后端开放，前端暂未接入头像上传。
- **设置页无会话管理**：不列出登录设备、不提供「退出其它设备」。
- **已做真实端到端验证（2026-10-11）**：对线上跑了发布 / 配图 / 公开切换 / 访客可见性 /
  权限边界 / 配图归属共 10 组请求，全部符合预期（见 `docs/progress.md` 2.33）。

## 4. 相关文件

- 迁移：`supabase/migrations/20261010000018_moments.sql`、
  `supabase/migrations/20261010000019_moment_files.sql`（都已应用并登记到 `schema_migrations`）
- 后端：`backend/src/lib/safeUrl.js`、`backend/src/lib/fileType.js`、`backend/src/routes/moments.js`、
  `backend/src/routes/files.js`、`backend/src/routes/me.js`、`backend/src/lib/publicScope.js`、
  `backend/src/router.js`
- 前端：`frontend/src/routes/Moments.jsx`、`frontend/src/routes/Login.jsx`、
  `frontend/src/routes/Settings.jsx`、`frontend/src/routes/Favorites.jsx`、
  `frontend/src/components/Layout.jsx`、`frontend/src/components/FavoriteButton.jsx`、
  `frontend/src/styles/now-settings.css`、`frontend/src/lib/api.js`
- 单测：`backend/tests/run.mjs` 的「UNIT · 碎念页与设置安全中心」「UNIT · 文档附件」小节

## 5. 登录 / 注册页（`/login`，2026-10-11 重做）

- 两个标签页：**站长登录**（邮箱 + 密码）与**新用户注册**（邮箱 + 密码 + 确认密码）。
- 注册走 Supabase Auth；**新账号一律是普通用户** —— 数据库触发器 `handle_new_user()` 决定
  `user_profiles.role` 默认 `'user'`，注册者拿不到站长权限（这是硬保证，不在前端控制）。
- 已开邮箱验证时会提示「去邮箱确认链接」，未开则注册后直接进首页。
- 常见英文报错翻成中文（密码错 / 未验证 / 邮箱已注册 / 密码太短）。
- 已登录时不再显示表单，改为「已登录 + 当前账号 + 进入设置 / 退出登录」。
- 顶栏入口：主题按钮右侧常驻齿轮 —— 已登录 → `/settings`，访客 → `/login`；
  访客右上角另有明确的「登录」按钮。

## 6. 收藏页（`/favorites`，2026-10-11 改版）

- 定位：读者把喜欢的**音乐 / 影视**存起来，方便以后回来听 / 看。
- 分组：音乐 / 影视 / 其它（博客与其它资源），顶部标签筛选；封面网格（音乐 1:1、影视 2:3）。
- 收藏按钮在音乐 / 影视详情页操作区（`components/FavoriteButton.jsx`）；未登录不渲染，
  后端 `/api/favorites` 对访客 403。
