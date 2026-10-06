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
| POST | `/api/music/lyrics` | 获取歌词（LRCLIB，缺失时回退 GD音乐台），body: `{ title, artist, album?, duration? }` |
| POST | `/api/music/stream` | 重新解析可播放直链（直链是会过期的签名地址），body: `{ platform, external_id, source? }` |
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
| `audio_fallbacks` | 备用播放地址数组（多音源节点），主地址失败时前端依次尝试 |
| `preview_url` | 试听片段地址 |
| `artist_avatar` | 歌手头像链接（播放器唱片右下角与歌词页展示） |
| `quality` | `full`=完整音轨（默认），`preview`=试听片段 |
| `platform` / `external_id` / `gd_source` | 音源身份，写入 `resources.metadata`；直链过期后凭它调 `/api/music/stream` 重新解析 |
| `bitrate` / `format` / `file_size` | 音质信息（如 `1619` kbps / `flac` / 64MB），同样写入 `resources.metadata` |
| `duration` | 时长（秒） |
| `genre` / `release_year` | 流派 / 发行年份 |
| `notes` / `lyrics` | 备注 / 歌词（纯文本） |
| `category_id` / `tag_ids` / `is_public` | 分类 / 标签 / 公开 |

### 元数据抓取（多源聚合）
`POST /api/music/search` 并发调用四个免费数据源，同名同歌手去重合并后返回候选
（合并时播放地址与音质取更优的一侧，封面/专辑/时长互补）：

| 数据源 | 说明 | 音质 |
| --- | --- | --- |
| **GD音乐台**（主源） | `https://music-api.gdstudio.xyz`，返回**完整曲目**直链。实测 `netease` 源稳定给出 900~1600kbps、20~64MB 的 FLAC；`joox`/`bilibili` 在当前环境拿不到直链，故默认只用 `netease`（可用环境变量 `GD_MUSIC_SOURCE` 覆盖） | `full`（无损） |
| **Audius** | 独立音乐平台，完整音轨 320kbps MP3，CORS 全开，多发现节点互备 | `full` |
| iTunes Search | 元信息与封面规范 | `preview`（30s 试听） |
| Deezer | iTunes 被限流（Workers 共享出口 IP 常返回 429）时兜底 | `preview` |

返回候选字段：`{ platform, external_id, gd_source, title, artist, artist_avatar, album, artwork_url,
audio_url, audio_fallbacks, preview_url, quality, bitrate, format, file_size, duration, genre,
release_year, page_url }`。结果按「完整曲目优先 + 音源可信度」排序。
**不下载音频、不入库音频文件**，后端不转发音频流。

GD音乐台三个注意点（接入时踩过的坑，写在这里避免重复踩）：
1. **限频 5 分钟 50 次**，且是共享出口 IP 的配额 —— 因此一次搜索只解析最靠前的 3 条直链
   （`GD_RESOLVE_LIMIT`），其余拿不到地址的结果会被丢弃；直链与封面在 Worker 进程内缓存 10 分钟。
2. **必须用浏览器 User-Agent**，自定义 UA 会被拦截并返回空列表。
3. **直链是网易云 CDN 的带时间戳签名地址，会过期**（路径形如 `/20261006171212/…`）——
   因此收藏时会把 `platform` / `external_id` / `gd_source` 写进 `resources.metadata`，
   前端播放失败时调 `POST /api/music/stream` 换一条新直链（见 `frontend/src/lib/player.jsx`）。

歌词：`POST /api/music/lyrics` 先查 **LRCLIB**（开源、无需 Key、支持中文），未命中时回退 **GD音乐台**歌词接口。返回：

```json
{ "source": "lrclib", "instrumental": false,
  "synced": "[00:27.38] 窗外的麻雀 在電線桿上多嘴\n...",
  "plain": "窗外的麻雀 在電線桿上多嘴\n..." }
```

- `synced` 为带时间轴的 LRC 文本，前端据此实现逐句高亮与自动滚动；无同步歌词时为 `null`。
- 抓取源的歌手名常带前缀（如 `Jay 周杰伦`），服务端会自动尝试多种候选写法匹配。

重新解析直链：

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"platform":"gdstudio","external_id":"2712018330","source":"netease"}' \
  "$BASE/api/music/stream"
# → { "platform":"gdstudio", "external_id":"2712018330", "source":"netease",
#     "audio_url":"https://m801.music.126.net/...flac", "bitrate":922, "file_size":36600676,
#     "quality":"full" }
```

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

---

# Phase5 新增接口：RSS 订阅 + 影视库

## RSS 订阅

订阅源存于 `rss_feeds`，条目存于 `rss_articles`（仅元信息 + 文本摘要，不下载媒体文件）。
新条目写入通知中心（`type=rss_new`）。Worker Cron 每小时分批抓取一次，规避 30s 超时。

### 订阅源
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/rss/feeds` | 列表（含 `unread_count`；管理员可 `?all=true`；可 `?category_id=`） |
| POST | `/api/rss/feeds` | 新增，body: `{ feed_url, title?, site_url?, category_id?, fetch_interval?, fetch_now? }`，默认立即抓取一次 |
| GET | `/api/rss/feeds/:id` | 详情 |
| PATCH | `/api/rss/feeds/:id` | 更新（title/site_url/fetch_interval/is_active/category_id/feed_url） |
| DELETE | `/api/rss/feeds/:id` | 删除（级联删除条目） |
| POST | `/api/rss/feeds/:id/fetch` | 手动抓取单个订阅源，返回 `{ notModified, newCount }` |
| POST | `/api/rss/fetch-all` | 抓取本人全部活跃订阅源（分批，body: `{ batch_size? }`，≤30） |

- `fetch_interval` 单位秒，范围 300–86400，默认 3600。
- 抓取使用 ETag / Last-Modified 条件请求，未更新时返回 `notModified=true`。
- 同一 `(feed_id, guid)` 幂等，重复抓取不会产生重复条目。

### 条目
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/rss/articles` | 列表（`?feed_id=&unread=true&limit=&offset=`；管理员可 `?all=true`），返回含 `feed_title` |
| PATCH | `/api/rss/articles/:id` | 标记已读/未读，body: `{ is_read }` |
| POST | `/api/rss/articles/read-all` | 全部已读（可 `{ feed_id }` 限定单个源） |

### OPML 导入导出
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/rss/opml` | 导出 OPML（`text/xml`，需携带 JWT） |
| POST | `/api/rss/opml` | 导入，body: `{ opml: "<xml>" }` 或 `{ feeds: [{ feed_url, title? }] }`；已存在链接自动跳过 |

### 调用示例
```bash
TOKEN=<access token>
BASE=http://127.0.0.1:8787

# 添加订阅源并立即抓取
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"feed_url":"https://hnrss.org/frontpage","title":"Hacker News"}' "$BASE/api/rss/feeds"

# 手动抓取单个源
curl -X POST -H "Authorization: Bearer $TOKEN" "$BASE/api/rss/feeds/<feed_id>/fetch"

# 未读条目
curl -H "Authorization: Bearer $TOKEN" "$BASE/api/rss/articles?unread=true&limit=20"

# 导出 / 导入 OPML
curl -H "Authorization: Bearer $TOKEN" "$BASE/api/rss/opml" -o rss.opml
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"feeds":[{"feed_url":"https://github.blog/feed/","title":"GitHub Blog"}]}' "$BASE/api/rss/opml"
```

## 影视库

影视主记录存于统一资源表 `resources(type='movie')`，专属字段存于扩展表 `movie_titles`（1:1）。
因此影视自动支持：标签、分类、收藏夹、全局检索、关联图谱。

### 影视 CRUD
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/movies` | 列表（管理员可 `?all=true`；可 `?category_id=&media_type=movie\|tv`），返回含 `title_info` 与 `tags` |
| POST | `/api/movies/search` | 搜索元信息候选（不落库），body: `{ query, limit? }` |
| GET | `/api/movies/latest` | 精选片单（首页用），`?limit=&sort=hot\|new`，按评分或年份排序 |
| GET | `/api/movies/sources/health` | 各采集源健康检查（设置页用） |
| POST | `/api/movies/source-detail` | 按 `{ source, external_id }` 取采集源完整线路与剧集（详情页选集用） |
| POST | `/api/movies` | 新增，body 见下 |
| GET | `/api/movies/:id` | 详情（含 `title_info`、`tags`、`progress`） |
| PATCH | `/api/movies/:id` | 更新（主资源字段 + 扩展字段） |
| DELETE | `/api/movies/:id` | 删除（同时删除扩展记录） |
| GET | `/api/movies/:id/progress` | 读取观看进度 |
| PUT | `/api/movies/:id/progress` | 保存进度，body: `{ position, duration?, completed? }` |

### 新增/更新字段
| 字段 | 说明 |
| --- | --- |
| `title` | 名称（必填） |
| `media_type` | `movie`（电影，默认）/ `tv`（剧集） |
| `original_title` | 原名 |
| `director` / `cast_list` | 导演 / 主演（文本，逗号分隔） |
| `genres` | 类型/流派（文本，逗号分隔） |
| `release_date` | 上映/首播日期（`YYYY-MM-DD`） |
| `runtime` | 时长（分钟） |
| `rating` | 评分 0–10 |
| `overview` | 简介 |
| `poster_url` / `backdrop_url` | 海报 / 背景图链接（同时写入 `cover_path`） |
| `url` | **播放地址**：仅存放可播放的视频直链（`.mp4` 等），作为 HTML5 `<video src>` 使用 |
| `external_url` | **外部详情页**链接（TVmaze / TMDB 等资料页），非播放地址，前端仅用于跳转 |
| `external_id` / `source` | 外部数据源 ID / 来源（`lzi`/`ffzy`/`dytt`/`zuid`/`zy360`/`tmdb`/`tvmaze`/`manual`） |
| `source_key` / `source_vod_id` | 采集源标识与源站资源 ID（详情页按它回源取完整剧集） |
| `routes` | 全部播放线路 `[{ name, episodes:[{ name, url }] }]`，前端据此切换线路/选集 |
| `area` / `remarks` | 地区 / 备注（如「全40集」「HD国语」） |
| `notes` | 备注 |
| `category_id` / `tag_ids` / `is_public` | 分类 / 标签 / 公开 |

### 元数据抓取（苹果CMS 采集源为主）
`POST /api/movies/search` 以**苹果CMS 采集接口**为主源（真正能搜到电影/电视剧并可直接播放的源），
采集源全部失败时才回退 Internet Archive / TVmaze。

| 采集源 | 地址 | 说明 |
| --- | --- | --- |
| 量子资源 `lzi` | `https://cj.lziapi.com/api.php/provide/vod/` | 主力源 |
| 非凡资源 `ffzy` | `https://api.ffzyapi.com/api.php/provide/vod/` | |
| 电影天堂 `dytt` | `https://caiji.dyttzyapi.com/api.php/provide/vod/` | |
| 最大资源 `zuid` | `https://api.zuidapi.com/api.php/provide/vod` | 补到 lzi 缺失的「仙逆」「迪迦奥特曼」等 |
| 360资源 `zy360` | `https://360zy.com/api.php/provide/vod/` | |

可用环境变量 `VOD_SOURCES`（JSON 数组）覆盖默认源列表。

**搜索策略（两个都影响命中率，改代码前先读这段）**
1. **每个源两路并发**：普通关键词搜索 + 该源「国产/日韩/欧美动漫」类目搜索。
   动漫正片在关键词搜索里几乎被真人剧、短剧和同名作品挤掉（实测「凡人修仙传」关键词命中 0 条动漫，
   按类目命中 4 条），而**各源的动漫 type_id 并不统一**（lzi/ffzy/dytt/zuid 是 29，
   但 zy360 的 29 是动画片、38 才是国产动漫）——因此通过 `ac=list` 返回的 class 列表
   **按名称动态发现**并缓存 1 小时（`lib/maccms.js` 的 `getAnimeClassIds`）。
2. **内容过滤**：按 `type_id_1` 顶层分类只保留 1=电影片 / 2=连续剧（动漫搜索时额外放行 4=动漫片），
   并剔除预告片、电影解说、综艺、体育、短剧、AI漫剧、有声等（`isFeatureContent`）。
   仅靠 `type_id_1` 不够——部分源把短剧挂在「连续剧」根类目下，故同时按 `type_name` 过滤。
3. **相关度排序**：完全同名 > 前缀命中 > 包含 > 其他，同档位「可播放优先」。

**元数据补全**（`lib/metadb.js`，只补前 4 条且确实缺字段的条目，失败静默跳过）：

| 数据源 | 用途 | 说明 |
| --- | --- | --- |
| Cinemeta (Stremio) | 电影/剧集海报、背景图、IMDb 评分 | 搜索支持中文；评分需再查一次详情接口 |
| Bangumi | 中文 ACG 条目封面/简介/评分 | **必须带 User-Agent**，动漫条目优先用它 |
| Kitsu | 动漫元数据（Bangumi 未命中时） | |
| Internet Archive | 公有领域影视，提供完整 MP4 直链 | 采集源全挂时的兜底 |

返回候选字段：`{ source, source_name, source_key, external_id, media_type, title, original_title,
overview, poster_url, backdrop_url, release_date, runtime, rating, genres, director, cast_list,
area, remarks, episode_count, playable_url, routes, alt_sources, imdb_id }`。

- `playable_url` 为可直接播放的视频直链（`.m3u8` / `.mp4`），**可播放的结果排在最前**；
  `routes` 是全部线路与剧集，前端详情页据此切换线路/选集。
- 同名条目跨源去重时合并线路，并补齐其余来源缺失的元信息。
- 仅抓取元信息与播放地址字符串，**不下载视频文件、后端不转发视频流**。

> 历史坑：TVmaze 只返回资料页链接，曾被当作 `<video src>` 使用，导致「搜到但无法播放」。
> 现在 `resources.url` 只存**播放直链**，`movie_titles.external_url` 存**外部详情页**，两者已分离。

## 权限
- 普通用户仅能读写自己名下 RSS 订阅/条目与影视资源。
- 管理员可 `?all=true` 读取全部；**写操作（更新/删除/进度/抓取）始终限定本人**。

## 调用示例
```bash
# 搜索影视元数据候选
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"Breaking Bad","limit":5}' "$BASE/api/movies/search"

# 新增影视
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Breaking Bad","media_type":"tv","genres":"Drama","rating":9.5,
       "poster_url":"https://.../poster.jpg","url":"https://.../episode.m3u8"}' "$BASE/api/movies"

# 保存观看进度
curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"position":600,"duration":7200}' "$BASE/api/movies/<id>/progress"

# 检索影视
curl -H "Authorization: Bearer $TOKEN" "$BASE/api/search?q=Breaking&resource_type=movie"
```

## MCP 工具
新增 `add_movie`（管理员）：`{ title, media_type?, original_title?, director?, cast_list?, genres?, release_date?, runtime?, rating?, overview?, poster_url?, url?, source?, notes?, tag_ids? }`

## Cron 定时任务
`wrangler.toml` 配置 `[triggers] crons = ["0 * * * *"]`（每小时）。
`scheduled` handler 调用 `syncAllFeeds`，采用「截止时间 25s + 单次 20 个源」分批处理，规避 Workers 30s 超时；未处理完的源在下次 Cron 继续。

---

# Phase6 新增接口：管理员用户管理

全部接口需管理员 JWT（`role=admin`），普通用户访问返回 `403`。
实现文件：`backend/src/routes/admin.js`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/admin/users` | 用户列表（含 `stats.resources` / `stats.posts`；支持 `?role=user\|admin`、`?disabled=true`、`?limit=`） |
| GET | `/api/admin/users/:id` | 单个用户详情（档案 + 资源统计） |
| PATCH | `/api/admin/users/:id` | 更新用户，body: `{ is_disabled?, role? }` |

### 约束
- `role` 仅允许 `user` / `admin`；`is_disabled` 必须为布尔值。
- **管理员不能禁用或降级自己**（返回 422），避免把自己锁在系统外。
- 禁用通过 `user_profiles.is_disabled` 生效：`requireAuth` 中间件会拒绝被禁用账号的所有请求（403 `账号已被禁用`）。
- 用户列表返回 `user_profiles` 档案，并额外通过 Supabase Auth Admin API 合并 `email` 字段（读取失败时该字段为 `null`，不影响列表可用）。

### 调用示例
```bash
TOKEN=<管理员 access token>
BASE=https://api.kb.example.com

# 用户列表
curl -H "Authorization: Bearer $TOKEN" "$BASE/api/admin/users"

# 仅看被禁用用户
curl -H "Authorization: Bearer $TOKEN" "$BASE/api/admin/users?disabled=true"

# 禁用某个账号
curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"is_disabled":true}' "$BASE/api/admin/users/<user_id>"

# 启用并设为管理员
curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"is_disabled":false,"role":"admin"}' "$BASE/api/admin/users/<user_id>"
```

## Phase6 权限修复说明（重要）
统一修复了历史越权写入漏洞，规则为：

| 操作 | 普通用户 | 管理员 |
| --- | --- | --- |
| 读取自己的数据 | ✅ | ✅ |
| 读取全部数据 | ❌ | ✅（`?all=true`） |
| 写入（创建） | ✅ 仅本人 | ✅ 仅本人 |
| 写入（更新/删除） | ✅ 仅本人 | ❌ 仅本人数据，不可改他人 |
| MCP 工具调用 | ❌ 403 | ✅ 但仅作用于本人数据 |

涉及文件：`videos.js`、`github.js`、`posts.js`、`favorites.js`、`notifications.js`、`mcp.js`（`music.js`、`movies.js`、`rss.js` 在 Phase4/5 已符合规范）。
具体改动：
- 所有 `db.update` / `db.remove` 一律附加 `user_id=eq.<当前用户>`，移除 `user.isAdmin ? {}` 绕过。
- 标签/关联资源校验改为 `validateTagIds(db, user.id, false, ...)` 与仅按本人 `user_id` 过滤，避免管理员把他人标签/资源挂到自己的数据上。
- `deletePost` 改为**先校验归属再清理** `post_resources` / `post_tags`，防止越权删除他人文章的关联数据。
- MCP `findPost` / `link_resources` 收紧为仅本人数据。
