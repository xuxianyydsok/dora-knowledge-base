# API 文档（Phase1）

所有接口前缀 `/api`，需在请求头携带 `Authorization: Bearer <Supabase JWT>`（`/health` 除外）。
响应统一格式：成功 `{ "data": ... }`，失败 `{ "error": "..." }`。

## 鉴权与角色
- 后端通过 Supabase JWKS（ES256）校验 JWT，或兼容 `SUPABASE_JWT_SECRET` 的 HS256。
- 校验通过后加载 `user_profiles`：`role=admin` 为管理员，`is_disabled=true` 拒绝访问。
- 数据隔离：普通用户查询强制 `user_id = 当前用户`；管理员可加 `?all=true` 查看全部。
- CORS：仅允许 `env.CORS_ORIGINS` 白名单内的前端域名。

## 当前用户
### GET /api/me
返回当前用户 id、email、role、plan、is_admin。

## 分类 Categories
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/categories` | 列表（管理员可 `?all=true`） |
| POST | `/api/categories` | 创建，body: `{ name, slug?, description?, sort_order? }` |
| PATCH | `/api/categories/:id` | 更新（部分字段） |
| DELETE | `/api/categories/:id` | 删除 |

## 标签 Tags
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/tags` | 列表（管理员可 `?all=true`） |
| POST | `/api/tags` | 创建，body: `{ name, slug?, color? }`，`color` 为 `#RRGGBB` |
| PATCH | `/api/tags/:id` | 更新（name/slug/color） |
| DELETE | `/api/tags/:id` | 删除 |
| POST | `/api/tags/batch` | 批量创建，body: `{ items: [{ name, color? }] }`（≤200） |
| PATCH | `/api/tags/batch` | 批量更新，body: `{ items: [{ id, name?, color? }] }` |
| DELETE | `/api/tags/batch` | 批量删除，body: `{ ids: [...] }` |

### 校验规则
- `name` 必填，长度受限；`color` 必须为 `#RRGGBB`；`id` 必须为合法 UUID。
- 批量接口单次上限 200 条。

## 示例
```bash
TOKEN=<supabase access token>
# 获取当前用户
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8787/api/me
# 创建标签
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"前端","color":"#ff8800"}' http://127.0.0.1:8787/api/tags
```

---

# Phase2 新增接口

## 学习视频 Videos
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/videos` | 列表（管理员可 `?all=true`；可 `?category_id=`） |
| POST | `/api/videos/fetch` | 抓取元信息（不落库），body: `{ url }` |
| POST | `/api/videos` | 新增，body: `{ url, title?, summary?, category_id?, tag_ids?, is_public? }` |
| GET | `/api/videos/:id` | 详情（含 `tags`、`progress`） |
| PATCH | `/api/videos/:id` | 更新（title/summary/category_id/is_public/tag_ids） |
| DELETE | `/api/videos/:id` | 删除 |
| GET | `/api/videos/:id/progress` | 读取播放进度 |
| PUT | `/api/videos/:id/progress` | 保存进度，body: `{ position, duration?, completed? }`（progress 自动计算） |

支持链接：Bilibili（`BV`/`av`）、YouTube（`watch?v=` / `youtu.be` / `shorts`）。
返回的 `metadata` 含 `embed_url`（iframe 播放地址）、`cover_url`、`duration` 等，**后端不转发流媒体**。

## GitHub 收藏
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/github` | 列表（管理员可 `?all=true`；可 `?category_id=`） |
| POST | `/api/github/fetch` | 抓取仓库元信息（不落库），body: `{ url }` |
| POST | `/api/github` | 新增，body: `{ url, title?, summary?, category_id?, tag_ids?, is_public? }` |
| GET | `/api/github/:id` | 详情 |
| PATCH | `/api/github/:id` | 更新；传 `{ "refresh": true }` 可重新抓取 star 等元信息 |
| DELETE | `/api/github/:id` | 删除 |

`metadata` 含 `stars`、`forks`、`language`、`topics`、`html_url`、`avatar_url` 等。
> GitHub 匿名接口限流 60 次/小时，可通过 `wrangler secret put GITHUB_TOKEN` 提升额度。

## HTML 博客 Posts
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/posts` | 列表（可 `?status=draft|published`、`?category_id=`、管理员 `?all=true`） |
| POST | `/api/posts` | 创建，body: `{ title, content, slug?, excerpt?, cover_path?, status?, is_public?, tag_ids?, linked_resources? }` |
| GET | `/api/posts/slug/:slug` | 按 slug 读取 |
| GET | `/api/posts/:id` | 详情（含 `linked_resources`、`heavy_tags`） |
| PATCH | `/api/posts/:id` | 更新（字段同创建） |
| DELETE | `/api/posts/:id` | 删除（同时清理标签与资源关联） |

- `content` 为**原生 HTML**（不支持 Markdown）。
- 自定义标签：`<katex-inline>` `<katex-block>` `<three-scene>` `<mermaid-chart>` `<chart-2d>`。
- `linked_resources`：`[{ resource_id, relation }]`，`relation ∈ related|embeds|references`（覆盖式写入）。
- 响应中的 `heavy_tags` 列出正文用到的重型组件，供前端按需懒加载。

## 管理员 MCP 端点
**强制管理员 JWT 鉴权**，普通用户返回 403；无 token 返回 401。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/mcp/tools` | 工具发现，返回全部工具与 inputSchema |
| POST | `/api/mcp/invoke` | 直接调用：`{ "tool": "...", "arguments": { ... } }` |
| POST | `/api/mcp` | JSON-RPC 2.0：支持 `initialize` / `tools/list` / `tools/call` |

### 工具清单
| 工具 | 作用 |
| --- | --- |
| `create_post` | 创建博客（可含自定义标签、绑定资源） |
| `update_post` | 按 id/slug 更新博客 |
| `add_video` | 按链接抓取并新增视频资源 |
| `add_github_repo` | 按链接抓取并新增 GitHub 收藏 |
| `link_resources` | 将资源绑定到博客（覆盖式） |
| `list_resources` | 列出资源（可按类型过滤） |

### MCP 调用示例
```bash
ADMIN_JWT=<管理员 access token>
BASE=http://127.0.0.1:8787

# 1) 工具发现
curl -H "Authorization: Bearer $ADMIN_JWT" $BASE/api/mcp/tools

# 2) 直接调用：新增视频
curl -X POST -H "Authorization: Bearer $ADMIN_JWT" -H "Content-Type: application/json" \
  -d '{"tool":"add_video","arguments":{"url":"https://www.bilibili.com/video/BV1GJ411x7h7"}}' \
  $BASE/api/mcp/invoke

# 3) 直接调用：创建博客并绑定资源
curl -X POST -H "Authorization: Bearer $ADMIN_JWT" -H "Content-Type: application/json" \
  -d '{"tool":"create_post","arguments":{
        "title":"AI 生成笔记",
        "content":"<p>正文</p><katex-inline>E=mc^2</katex-inline>",
        "status":"published",
        "linked_resources":[{"resource_id":"<video-id>","relation":"embeds"}]}}' \
  $BASE/api/mcp/invoke

# 4) JSON-RPC 2.0 入口
curl -X POST -H "Authorization: Bearer $ADMIN_JWT" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_resources","arguments":{"type":"video"}}}' \
  $BASE/api/mcp
```

---

# Phase3 新增接口

## 全文检索
### GET /api/search
跨博客（标题/摘要/正文）与资源（标题/摘要）检索。

| 参数 | 说明 |
| --- | --- |
| `q` | 必填，检索关键词 |
| `type` | `all`(默认) / `post` / `resource` |
| `resource_type` | `video` / `github` / `music` / `movie` / `rss_article`（可选） |
| `limit` | 返回上限，默认 20，最大 50 |
| `all` | 管理员可传 `true` 检索全部用户数据 |

返回：`{ query, count, items: [{ kind: 'post'|'resource', id, title, ... }] }`

## 资源关联图谱
### GET /api/graph
输出 D3 力导向图所需的节点与边。

- 节点类型：`post` / `resource`（含 `resource_type`）/ `tag`
- 边类型：`post-resource`（含 `relation`）/ `post-tag` / `resource-tag`
- 返回：`{ nodes, edges, stats: { posts, resources, tags, edges } }`
- 管理员可传 `?all=true`

## 收藏夹
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/favorites` | 列表（管理员可 `?all=true`），每项含 `target` 详情 |
| POST | `/api/favorites` | 收藏，body: `{ resource_id }` 或 `{ post_id }`（二选一） |
| DELETE | `/api/favorites/:id` | 按收藏 id 删除 |
| DELETE | `/api/favorites/target?resource_id=...` | 按目标删除（或 `post_id`） |

跨类型：可收藏资源或博客；同时传两者返回 422。

## 通知中心
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/notifications` | 列表，支持 `?unread=true`、`?type=rss_new|link_broken|system`、`?limit=` |
| GET | `/api/notifications/count` | 未读数量（顶栏徽标） |
| POST | `/api/notifications` | 创建通知，body: `{ type, title, body?, link? }`（管理员可指定 `user_id`） |
| POST | `/api/notifications/check-links` | 检测视频播放链接，失效则写入 `link_broken` 通知 |
| PATCH | `/api/notifications/:id` | 标记已读/未读，body: `{ is_read: true|false }` |
| PATCH | `/api/notifications/read-all` | 全部标记已读 |
| DELETE | `/api/notifications/:id` | 删除单条 |
| DELETE | `/api/notifications?read=true` | 清空（`read=true` 仅清已读） |

## 导入导出备份
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/backup/export` | 导出当前用户全部数据（管理员可 `?all=true`） |
| POST | `/api/backup/import` | 导入恢复，body: `{ data, mode: 'merge'|'replace' }` |

导出内容：分类、标签、资源、博客、收藏、进度及全部关联关系。
导入按「分类 → 标签 → 资源 → 博客 → 关联 → 收藏」顺序恢复，分类/标签按 slug 复用，其余重建 ID 映射。

## 用户偏好（主题配色）
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/preferences` | 读取偏好 |
| PUT | `/api/preferences` | 写入主题，body: `{ theme: { mode, light:{...}, dark:{...} } }` |
| DELETE | `/api/preferences` | 重置为主题默认 |

可自定义变量（白名单，值为 `#RRGGBB`）：
`bg`、`bg_elevated`、`bg_subtle`、`text`、`text_muted`、`border`、`primary`、`primary_contrast`、`danger`

## 调用示例
```bash
TOKEN=<access token>
BASE=http://127.0.0.1:8787

# 搜索
curl -H "Authorization: Bearer $TOKEN" "$BASE/api/search?q=知识图谱&type=all"

# 图谱
curl -H "Authorization: Bearer $TOKEN" "$BASE/api/graph"

# 收藏博客
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"post_id":"<post-id>"}' "$BASE/api/favorites"

# 检测链接失效
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"limit":10}' "$BASE/api/notifications/check-links"

# 保存暗色自定义配色
curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"theme":{"mode":"dark","dark":{"primary":"#ff8800","bg":"#101014"}}}' "$BASE/api/preferences"

# 导出备份
curl -H "Authorization: Bearer $TOKEN" "$BASE/api/backup/export" -o backup.json
```

---

# Phase4 新增接口：音乐收藏库

音乐主记录存于统一资源表 `resources(type='music')`，专属字段存于扩展表 `music_tracks`（1:1）。
因此音乐自动支持：标签、分类、收藏夹、全局检索、关联图谱。

## 音乐 CRUD
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/music` | 列表（管理员可 `?all=true`；可 `?category_id=`），返回含 `track` 与 `tags` |
| POST | `/api/music/search` | 搜索元信息候选（不落库），body: `{ query, limit? }` |
| POST | `/api/music` | 新增，body 见下 |
| GET | `/api/music/:id` | 详情（含 `track`、`tags`、`progress`） |
| PATCH | `/api/music/:id` | 更新（主资源字段 + 扩展字段） |
| DELETE | `/api/music/:id` | 删除（同时删除扩展记录） |
| GET | `/api/music/:id/progress` | 读取播放进度 |
| PUT | `/api/music/:id/progress` | 保存进度，body: `{ position, duration?, completed? }` |

### 新增/更新字段
| 字段 | 说明 |
| --- | --- |
| `title` | 歌曲名称（必填） |
| `artist` / `album` | 歌手 / 专辑 |
| `artwork_url` | 封面链接（同时写入 `cover_path`） |
| `audio_url` | 播放地址（外链，前端直接播放，后端不转发音频流） |
| `preview_url` | 试听片段地址 |
| `duration` | 时长（秒） |
| `genre` / `release_year` | 流派 / 发行年份 |
| `notes` / `lyrics` | 备注 / 歌词（纯文本） |
| `category_id` / `tag_ids` / `is_public` | 分类 / 标签 / 公开 |

### 元数据抓取
`POST /api/music/search` 调用 iTunes Search API，返回候选：`{ title, artist, album, artwork_url, preview_url, duration, genre, release_year, page_url }`。
仅抓取元信息与试听片段地址，**不下载音频、不入库音频文件**。

## 权限
- 普通用户仅能读写自己名下音乐。
- 管理员可 `?all=true` 读取全部；**写操作（更新/删除/进度）始终限定本人**。

## 调用示例
```bash
TOKEN=<access token>
BASE=http://127.0.0.1:8787

# 搜索元数据候选
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"never gonna give you up","limit":5}' "$BASE/api/music/search"

# 新增音乐
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Never Gonna Give You Up","artist":"Rick Astley","album":"Whenever You Need Somebody",
       "artwork_url":"https://.../cover.jpg","audio_url":"https://.../song.mp3","duration":214,
       "genre":"Pop","release_year":1987,"notes":"经典"}' "$BASE/api/music"

# 保存播放进度
curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"position":100,"duration":214}' "$BASE/api/music/<id>/progress"

# 检索音乐
curl -H "Authorization: Bearer $TOKEN" "$BASE/api/search?q=Rick&resource_type=music"
```

## MCP 工具
新增 `add_music`（管理员）：`{ title, artist?, album?, artwork_url?, audio_url?, duration?, notes?, tag_ids? }`
