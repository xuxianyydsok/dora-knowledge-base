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
