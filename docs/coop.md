# 共创（Co-create）：公开反馈收集与站长收件箱

> 2026-10-12，分支 `feat/now-settings`。本文说明「共创」页（`/coop`）的完整实现：
> 数据库表、4 个接口的鉴权与字段、前端两个页面、通知联动，以及匿名提交的安全理由。

## 1. 它是什么

「共创」是一封写给访客的邀请信 + 一个反馈表单：站长第一人称介绍站点是怎么一个人
慢慢搭起来的，邀请大家一起参与；访客 / 登录用户可以在表单里提缺陷、提改进、要新功能。
提交默认**匿名**，也可以实名（需登录）。提交成功弹一个温暖的感谢弹窗，并提示
「右上角通知铃铛会有提示」。站长在 `/admin/feedback` 收件箱里逐条处理。

与站内其它「本人可读写」的表不同，`feedback` 是**公开可写、仅站长可读**的一张表，
权限模型更像「留言板 + 后台收件箱」。

## 2. 数据库：`public.feedback`

迁移文件：`supabase/migrations/20261012000022_feedback.sql`（只新增，不改历史迁移）。

| 列 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `uuid` | 主键，`default gen_random_uuid()` |
| `user_id` | `uuid` | **可空**；实名且已登录时写登录用户 id，`references auth.users(id) on delete set null` |
| `is_anonymous` | `boolean not null default true` | 是否匿名提交 |
| `display_name` | `text` | 实名时的称呼；匿名时为空 |
| `contact` | `text` | 可选联系方式（邮箱 / 微信等），最长 200 |
| `category` | `text not null default 'other'` | `check in ('bug','improve','feature','other')`（缺陷 / 改进 / 新功能 / 其它） |
| `content` | `text not null` | 正文，1~4000 字（长度由应用层校验） |
| `page_url` | `text` | 提交时所在页面，最长 500，便于定位问题 |
| `user_agent` | `text` | 提交者 UA，最长 500 |
| `status` | `text not null default 'new'` | `check in ('new','read','done')`（待处理 / 已读 / 已处理） |
| `admin_note` | `text` | 站长备注 |
| `created_at` / `updated_at` | `timestamptz` | 默认 `now()`；`updated_at` 由触发器维护 |

索引：`(status, created_at desc)`、`(created_at desc)`。
触发器：`trg_feedback_updated_at`（`before update` 调用 `public.set_updated_at()`，与其它表一致）。

RLS（`enable row level security`）：

- `feedback_insert_anyone`：`for insert with check (true)` —— **任何人都能提交**（匿名反馈是公开表单）；
- `feedback_select_admin` / `feedback_update_admin` / `feedback_delete_admin`：`using (public.is_admin())`
  —— **只有管理员能看 / 改 / 删**。

> 注意：Worker 用 `SUPABASE_SERVICE_ROLE_KEY` 直连 PostgREST，**service_role 会绕过 RLS**。
> 因此「管理员才能看」这件事在**路由层**用 `requireAdmin` 再挡一道（见下）。

## 3. 接口（`backend/src/routes/feedback.js`）

注册在 `backend/src/router.js`（`moments` 路由附近）。`matchRoute` 按路径段数精确匹配，
`/api/feedback/:id` 不会吞掉别的路径。

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| `POST` | `/api/feedback` | **公开**（含访客） | 提交反馈 |
| `GET` | `/api/feedback` | `requireAdmin` | 列出，支持 `?status=`、`?category=`、`?limit=`（默认 100，≤200）、`?offset=`；按 `created_at desc` |
| `PATCH` | `/api/feedback/:id` | `requireAdmin` | 可改 `status`（new/read/done）、`admin_note` |
| `DELETE` | `/api/feedback/:id` | `requireAdmin` | 删除 |

### 3.1 `POST /api/feedback` 的入参与行为

请求体字段：

- `content`（必填，1~4000 字，超长报 **422**）；
- `category`（可选，默认 `other`，必须是 `bug|improve|feature|other` 之一）；
- `is_anonymous`（可选布尔，默认 `true`）；
- `display_name`（可选，最长 60）；
- `contact`（可选，最长 200）；
- `page_url`（可选，最长 500）。

行为：

- **已登录用户**：`user_id = 当前用户 id`；若 `is_anonymous === false` 且没填 `display_name`，
  用**邮箱 @ 前的部分**兜底。
- **访客**（`user.isGuest`）：**强制匿名** —— `is_anonymous = true`、`user_id = null`，
  不接受实名。
- `user_agent` 取请求头 `User-Agent`（截断到 500），只入库、不回给提交者。
- 落库成功后，给**站长**插一条 `notifications`（见第 5 节）。
- 返回 `ok({ id, created_at }, …, 201)` —— **不回 `user_agent` / `user_id`**。

### 3.2 对外字段白名单

所有读 / 写响应都只回：
`id, is_anonymous, display_name, contact, category, content, page_url, status, admin_note, created_at, updated_at`。

- **匿名条目绝不返回 `user_id` 或邮箱**；其 `display_name` 统一回 `'匿名读者'`；
- 实名条目可以返回 `display_name`（提交时填的称呼）。

### 3.3 访客可写边界

`backend/src/lib/publicScope.js` 的 `PUBLIC_POST_PATHS` 里加入了 `/api/feedback`（**只放 POST**）。
这是全站唯一一个「访客可写」的 POST：反馈是公开留言表单，匿名提交必须让未登录访客也能用。
`GET / PATCH / DELETE` 仍不放行，查看与管理只走 `requireAdmin`。

## 4. 前端两个页面

| 页面 | 路径 | 文件 | 鉴权 |
| --- | --- | --- | --- |
| 共创 | `/coop` | `frontend/src/routes/Coop.jsx`（样式 `frontend/src/styles/coop.css`） | `<ProtectedRoute guest>` —— 访客可访问 |
| 共创反馈管理 | `/admin/feedback` | `frontend/src/routes/AdminFeedback.jsx` | `<ProtectedRoute>`（不带 guest）—— 仅登录用户，页面内再判 `!isAdmin` 显示「仅站长可见」 |

导航：`frontend/src/components/Layout.jsx` 顶栏 `PRIMARY` 数组末尾（「更新」之后）加了「共创」；
头像下拉菜单里（「用户管理」旁）加了「共创反馈」入口。

### 4.1 共创页（`/coop`）

- 上半部分：3~4 段第一人称介绍文案，阅读型窄栏 + 衬线标题（`--font-display`），段落间宽松留白；
- 下半部分：表单 —— 分类 chip（复用 `.seg`，不用原生 `<select>`）、正文 `<textarea>`（`maxlength=4000`
  + 字数计数器）、署名方式（匿名默认 / 实名，实名时展开「你的称呼」输入框）、可选联系方式；
- 提交按钮 `<button class="primary">`，提交中禁用并显示「正在提交…」；
- 提交成功 → 感谢弹窗；失败 → `toastError`；
- 页面底部「已经改过的例子」：从 `lib/changelog.js` 的 `CHANGELOG` 取最新一版的前 3 条变更展示
  （只读，不改 changelog.js），让访客看到反馈是真的会落地。

### 4.2 感谢弹窗

自己写的小组件 `ThanksDialog`，用 `createPortal` 挂到 `document.body`（避免祖先 `transform`
让 `position: fixed` 相对整页定位）。半透明遮罩 + 背景模糊、圆角卡片、进入动画（轻微缩放 + 淡入）；
标题「收到了，谢谢你」，正文是一段温暖的话；一枚「好的」按钮关闭；弹窗里顺带用小字 + `Icon name="bell"`
提醒「我回复或改动之后，右上角的通知铃铛会有提示」。支持 **Esc 关闭**、**点遮罩关闭**。

### 4.3 管理页（`/admin/feedback`）

- `PageHeader` 标题「共创反馈」+ 读数（总数 / 待处理 / 已处理）+ 状态筛选标签；
- 每条卡片：分类角标、匿名或实名（匿名显示「匿名读者」）、正文、提交时间、来源页面、联系方式（有才显示）；
- 每条可操作：改状态（待处理 / 已读 / 已处理）、写站长备注、删除（删除前 `confirm`）；
- 空态用 `EmptyState`；`!isAdmin` 时显示「仅站长可见」。

## 5. 通知联动

- 后端：`POST /api/feedback` 成功后给**站长**（`adminOwnerId(db)`，来自 `routes/favorites.js`）
  插一条 `notifications`：`type: 'feedback'`、`title: '收到新的共创反馈'`、`body` 为「分类中文名 + 正文前 60 字」、
  `link: '/admin/feedback'`。**通知写入失败只 `console.error`**，绝不影响反馈本身的成功返回（用 try/catch 包住）。
- 类型白名单：`backend/src/routes/notifications.js` 的 `TYPES` 加入 `'feedback'`。
- 前端：`frontend/src/components/NotificationBell.jsx` 的 `TYPE_META` 加入
  `feedback: { label: '共创反馈', icon: 'heart' }`；并给 `feedback` 类型的条目加了「点一下跳到
  `/admin/feedback`」的行为（`TYPE_TARGET` + `route()` 客户端跳转，不整页刷新）。

## 6. 安全：为什么匿名提交时 `user_id` 为空、为什么匿名条目不能回 `user_id`

「匿名提交」的承诺是**提交者身份不被记录、也无法从接口反推**。要做到这一点，光在 UI 上
显示「匿名」是不够的，必须在数据层与接口层都守住：

1. **匿名时不落 `user_id`**：如果匿名提交仍然写入 `user_id`，那么这条反馈在数据库里
   始终与某个真实账号绑定 —— 一旦后台、导出、日志或误配的接口把它带出去，匿名就名存实亡。
   匿名提交时 `user_id = null`，从源头切断「反馈 ↔ 身份」的关联。
2. **响应绝不回 `user_id`**：即便某条实名反馈确实有 `user_id`，对外字段白名单也不含它。
   原因有二 ——
   - **防越权读**：`GET /api/feedback` 虽由 `requireAdmin` 保护，但白名单是第二道防线，
     避免将来有人新增接口 / 放宽鉴权时把 `user_id` 顺手带出去；
   - **防身份反推**：`user_id` 是可关联到 `user_profiles`（邮箱、用户名）的键，暴露它等于
     暴露「谁提的意见」，对匿名条目尤其致命。
3. **匿名条目昵称统一回「匿名读者」**：连 `display_name` 也不透传（匿名时它本就为空，
   统一文案可防止前端拿到空值后回退显示成别的可识别信息）。
4. **访客强制匿名**：访客上下文里的 `user.id` 是**站长**的 id（见 `docs/public-access.md`），
   若访客提交时不强制匿名，就会把反馈错误地记到站长名下。因此访客提交一律
   `is_anonymous = true`、`user_id = null`，不接受实名。

> 一句话：匿名不是「前端不显示」，而是「后端根本不存、接口根本不回」。

## 7. 相关文件

- 迁移：`supabase/migrations/20261012000022_feedback.sql`
- 后端路由：`backend/src/routes/feedback.js`
- 路由注册：`backend/src/router.js`
- 访客白名单：`backend/src/lib/publicScope.js`
- 通知类型：`backend/src/routes/notifications.js`
- 前端页面：`frontend/src/routes/Coop.jsx`、`frontend/src/routes/AdminFeedback.jsx`
- 前端样式：`frontend/src/styles/coop.css`
- 前端 API：`frontend/src/lib/api.js`
- 通知面板：`frontend/src/components/NotificationBell.jsx`
- 路由 / 导航：`frontend/src/app.jsx`、`frontend/src/routes/routes.js`、`frontend/src/components/Layout.jsx`
