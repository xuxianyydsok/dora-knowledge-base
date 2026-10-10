# 公开读边界（公开访客 / 登录用户 / 管理员三层权限）

> 2026-10-10，分支 `fix/public-read-boundaries`。本文说明访客只读模式下的**读权限边界**，
> 以及「为什么必须在查询层过滤」这个关键约束。

## 1. 背景：一个真实的越权

`PUBLIC_MODE="true"`（2026-10-09 起）让未登录访客以**站长身份**只读浏览。原实现里：

- 中间件 `backend/src/middleware/auth.js` 的 `guestContext` 把访客上下文的 `user.id` 设为
  **最早创建的 admin（站长）的 user_id**；
- 白名单 `PUBLIC_READ` 里含 `favorites`，`PUBLIC_POST` 里含 `/api/github/analyze`。

于是访客能读到站长的**全部**私人数据：未发布草稿、私密资源、收藏夹，还能调用消耗
Workers AI 额度的 `/api/github/analyze`。只有少数路由（posts 的 status、graph 的 status）
做了部分过滤，资源类接口几乎完全没有公开过滤。

**根因**：把「访客 = 站长身份」当成了权限模型，而不是「访客 = 受限的只读视图」。

## 2. 三层模型

| 层 | 身份标志 | 能读什么 |
| --- | --- | --- |
| **公开访客**（未登录） | `isGuest=true` / `isAdmin=false` | 仅 `posts: status=published AND is_public=true`；`resources: is_public=true`；categories / tags（owner 的安全字段）；公开检索；`GET /api/graph`（仅公开子图） |
| **登录用户** | 无 `isGuest` | 自己的全部数据（`user_id=eq.自己`） |
| **管理员**（站长） | `isAdmin=true` | 自己全部数据 + 显式 `?all=true` 时全部数据 |

**访客恒有** `isGuest=true` / `isAdmin=false`，`?all=true` 对访客**无效**
（`canUseAll(user, paramAll) => !!paramAll && !!user?.isAdmin`）。

### 2.1 guest context 的语义

`guestContext` 返回的 `user.id` 是**站点 owner 的 user_id，只用于限定查询范围**，
不是身份认证。它必须与「公开过滤」成对使用：

```js
// 访客读博客：owner 范围 + 公开过滤，二者缺一不可
{ user_id: `eq.${user.id}`, status: 'eq.published', is_public: 'eq.true' }
```

## 3. 为什么必须在查询层过滤（不能只改中间件）

Worker 用 **`SUPABASE_SERVICE_ROLE_KEY`** 直连 PostgREST。service_role **绕过 RLS**，
数据库的行级安全策略（如 `posts` 上「本人或管理员或 `is_public and status='published'`」）
**不会**替 Worker 过滤。

因此：

- 中间件只能决定「访客能不能进这个接口」，**不能**决定「能读到哪几行」；
- 每个读路由都必须在自己的查询里**显式叠加**公开条件，否则等于把站长的私密数据
  当公开数据发出去。

过滤条件集中放在**无 IO 的纯模块** `backend/src/lib/publicScope.js`，供中间件与路由共用，
并被离线单测锁定（`backend/tests/run.mjs` 的 `UNIT · 公开读边界`）。

```js
export const PUBLIC_READ_RE = /^\/api\/(categories|tags|videos|github|posts|music|movies|news|search|graph)(\/|$)/;
export const PUBLIC_POST_PATHS = new Set([
  '/api/movies/search', '/api/movies/source-detail', '/api/music/search', '/api/music/lyrics', '/api/music/stream'
]);
export function isGuestAllowed(method, pathname) { /* ... */ }
export function canUseAll(user, paramAll) { return !!paramAll && !!user?.isAdmin; }
export function guestPostFilters() { return { status: 'eq.published', is_public: 'eq.true' }; }
export function guestResourceFilters() { return { is_public: 'eq.true' }; }
```

> 注意白名单里**已移除** `favorites`（收藏夹属个人数据）与 `/api/github/analyze`
> （消耗 AI 额度，仅管理员）。

## 4. 逐路由权限矩阵

### 4.1 博客 Posts

| 方法 | 路径 | 公开访客 | 登录用户 | 管理员 |
| --- | --- | --- | --- | --- |
| GET | `/api/posts` | ✅ 仅 `published + is_public` | 自己全部（可按 `status` 过滤） | 自己全部；`?all=true` 全部 |
| GET | `/api/posts/:id` | ✅ 命中后校验 `published + is_public`，否则 **404** | 自己（非本人 404） | 任意 |
| GET | `/api/posts/slug/:slug` | 同上 | 同上 | 同上 |
| POST/PATCH/DELETE | `/api/posts*` | ❌ 401 | ✅ 仅本人 | ✅ 仅本人 |

访客读到的文章，其**关联资源**（`linked_resources`）也只会带上 `is_public=true` 的资源，
避免「文章公开、关联的私密资源被顺带带出」。

### 4.2 资源类：视频 / GitHub / 音乐 / 影视

| 方法 | 路径 | 公开访客 | 登录用户 | 管理员 |
| --- | --- | --- | --- | --- |
| GET | `/api/videos`、`/api/github`、`/api/music`、`/api/movies` | ✅ 仅 `is_public=true` | 自己全部 | 自己全部；`?all=true` 全部 |
| GET | `.../:id`（上述四类） | ✅ 命中后校验 `is_public=true`，否则 **404** | 自己（非本人 404） | 任意 |
| POST/PATCH/DELETE | 上述四类的写操作 | ❌ 401 | ✅ 仅本人 | ✅ 仅本人 |

访客读单条资源时，响应里的 `progress` 恒为 `null`（不再拿站长 owner 的播放进度当公开数据）。

### 4.3 检索与图谱

| 方法 | 路径 | 公开访客 | 登录用户 | 管理员 |
| --- | --- | --- | --- | --- |
| GET | `/api/search` | ✅ posts 仅 `published+public`；resources 仅 `is_public` | 自己全部 | 自己全部；`?all=true` 全部 |
| GET | `/api/graph` | ✅ **仅公开子图**（posts `published+public`、resources `is_public`；tags 仍取 owner 的） | 自己 | 自己；`?all=true` 全部 |
| GET | `/api/graph/console` | ❌ **403**（聚合 GitHub Star / AI 解读等个人数据） | ✅ 自己 | ✅ 自己 |
| GET | `/api/graph/board` | ❌ **403** | ✅ 自己 | ✅ 自己 |

### 4.4 分类与标签

| 方法 | 路径 | 公开访客 | 登录用户 | 管理员 |
| --- | --- | --- | --- | --- |
| GET | `/api/categories` | ✅ owner 的记录，字段收窄为 `id,name,slug,description,sort_order` | 自己全部 | 自己全部；`?all=true` 全部 |
| GET | `/api/tags` | ✅ owner 的记录，字段收窄为 `id,name,slug,color` | 自己全部 | 自己全部；`?all=true` 全部 |
| 写操作 | 同上 | ❌ 401 | ✅ 仅本人 | ✅ 仅本人 |

### 4.5 收藏夹 / AI / 个人数据

| 方法 | 路径 | 公开访客 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/favorites` | ❌ **403** | 已移出白名单；路由内再加一道 `if (user.isGuest) 403` |
| POST/DELETE | `/api/favorites*` | ❌ 401 | 写操作 |
| POST | `/api/github/analyze` | ❌ **403**（仅管理员） | 消耗 Workers AI 额度 |
| GET | `/api/posts/:id/progress`、`/api/videos/:id/progress`、`/api/music/:id/progress`、`/api/movies/:id/progress` | ❌ 401 | 个人进度 |
| GET | `/api/notifications*`、`/api/preferences`、`/api/backup/export`、`/api/me` | ❌ 401 | 个人数据 |
| 任意 | `/api/admin/*`、`/api/mcp/*` | ❌ 401/403 | 管理员接口 |

### 4.6 明确不在本次范围（保持原样）

- `GET /api/assets/:id`：按设计**完全公开**（图片素材按 id 读取），不动。
- `GET /api/news/*`：NewsNow 热榜，无 owner 数据，不动。
- `GET /api/movies/sources/health`、`GET /api/sources/health`：只读缓存，访客可读，不动。
- `/api/vod/proxy`：免鉴权的播放代理，不动。

## 5. 残余风险（本版本未解决，知情接受）

1. **categories / tags 名称暴露**：访客能看到 owner 的**全部**分类与标签名称，
   即使其中某些只服务于私密内容。本版本**不做**「按公开内容反查分类/标签」
   （需额外 join，成本高、收益低）。
2. **公开资源的 metadata 字段**：`resources.metadata` 是 JSON，含 GitHub 的 star / language /
   AI 解读等。对 `is_public=true` 的资源，访客能看到其中内容（设计上公开资源即公开）。
3. **ownerCache 进程级缓存**：`auth.js` 用模块级 `ownerCache` 缓存「最早 admin」，
   站长换人 / 被禁用后，该 Worker isolate 存活期间仍会沿用旧 owner id（只影响范围限定，
   不影响公开过滤）。若要严格，可加 TTL。
4. **未做真实端到端验证**：本机无 Supabase / R2 连接，本轮只有离线单测 + 构建，
   没有对线上跑过访客请求（见 `docs/progress.md` 本节「验证结果」）。

## 6. 重要：线上现状 = 访客看不到任何影视 / 音乐 / GitHub 资源

线上 `resources` 表当前**全部** `is_public=false`（github 439 / movie 7 / music 3 / video 1）。
因此按本轮的公开边界，**访客将看不到任何影视 / 音乐 / GitHub / 视频资源**
（列表为空、按 id 直接访问返回 404）。

**这是本轮要求的预期结果，不是 bug。** 若产品上希望公开展示某条资源，
需要由站长显式把该记录的 `is_public` 置为 `true`（影视 / 音乐 / GitHub 的编辑页均已有该开关）。

- 博客不受影响：线上 315 篇全部 `status=published` 且 `is_public=true`，访客照常可见。
- 公开检索（`/api/search`）同理：posts 有结果，resources 无结果。
- 影视 / 音乐页的「搜索后直接播放」不走 `resources` 表（走采集源检索，见 4.6），
  访客仍可搜索并播放，不受 `is_public` 影响。
