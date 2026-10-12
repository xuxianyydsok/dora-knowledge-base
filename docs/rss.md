# RSS 阅读器（/rss）

> 2026-10-12 恢复上线。**形态：站长订阅一次，访客直接读**。

## 1. 为什么是这个形态

2026-10-09 曾把整个 RSS 模块删掉，用户给的理由是：**「我懒得一个一个去点订阅」**，
而且当时的界面不好看。

2026-10-12 用户要求恢复，并明确了两点：

1. 不想自己一个个加源 —— 所以由**站长订阅一次**，写进数据库，所有访客打开 `/rss` 直接读，
   不需要登录、不需要自己订阅（这就是「方案 A：站长订阅、访客只读」）。
2. 界面要像开源阅读器 **Folo** —— 所以重做成三栏阅读器。

好处：额度最低（只有站长的源被抓取一次，访客读的是数据库里已有的条目），
也不需要给访客做账号体系。代价：访客的「已读」只存在自己浏览器里。

## 2. 权限边界（重要）

| 操作 | 访客 | 登录普通用户 | 站长 |
| --- | --- | --- | --- |
| 看订阅源列表 / 条目列表 / 条目正文 | ✅ | ✅ | ✅ |
| 导出 OPML | ✅（只读） | ✅ | ✅ |
| 新增 / 修改 / 删除订阅源 | ❌ | ❌ | ✅ |
| 手动抓取（单源 / 全部） | ❌ | ❌ | ✅ |
| 标记已读 / 全部已读 | ❌（存本机） | ❌（存本机） | ✅（存数据库） |
| 导入 OPML / 自动发现 / 精选源 | ❌ | ❌ | ✅ |

实现落点：

- **白名单**：`backend/src/lib/publicScope.js` 的 `PUBLIC_READ_RE` 含 `rss`，
  所以访客的 `GET /api/rss/*` 能进；`POST/PATCH/DELETE` 都不在白名单里，天然被挡。
- **查询层过滤**（关键）：Worker 用 `service_role` 直连 PostgREST，**RLS 不替它过滤**，
  所以访客读必须在查询里显式叠加 `is_public=eq.true`（见 `guestRssFeedFilters()`）。
  访客上下文里 `user.id` 就是站长的 id，因此「只看站长的源」这一条天然成立。
- **写操作**：`backend/src/routes/rss.js` 里所有写接口走 `requireAdmin`。
- **字段白名单**：`FEED_SELECT` / `ARTICLE_SELECT` 不含 `user_id`，绝不回传。

访客请求一个**非公开**的源或条目时，返回**空列表 / 404**，而不是 403 ——
不泄露「这个东西存在但你没权限」。

## 3. 已读状态为什么分两套

- **站长**：写 `rss_articles.is_read`，多设备同步。
- **访客与普通用户**：只写本机 `localStorage`（`frontend/src/lib/rssRead.js`）。
  原因是访客没有写权限；如果硬写数据库，全站访客会互相覆盖彼此的阅读进度。
  代价是换个浏览器就重置，可以接受（与 `lib/searchHistory.js` 同一套思路）。

## 4. 抓取怎么跑（不新增 cron）

Cloudflare 免费版**每账号上限 5 个 cron 触发器**，本账号已被
`mailflare`(2) / `moontv-plus`(1) / `rin-server`(1) + 本 Worker(1) 占满，
**不能再加**。因此 RSS 抓取**搭现有 cron 的车**：

`backend/src/index.js` 的 `scheduled` 里，在 `*/5 2-3 * * *` 分支顺带调用
`syncAllFeeds(db, { deadlineMs: 20000, batchSize: 6, timeoutMs: 8000 })`。

- 该 cron 每天触发 24 次 → 每天约 144 次抓取机会。
- 源默认抓取间隔 `fetch_interval = 14400`（4 小时），所以一个源一天约被抓 4~6 次。
- 每次最多抓 6 个「最久没抓的」源，有 20 秒截止时间保护，不会撞 Workers 超时。

抓取逻辑（`backend/src/lib/rssSync.js`）：

- 条件请求：带上 `If-None-Match` / `If-Modified-Since`，源站返回 304 就跳过解析。
- 幂等去重：`unique (feed_id, guid)` + `resolution=ignore-duplicates`。
- 失败记账：写 `last_error` / `error_count`（成功归零），前端左栏给源打一个红色 `!`。

## 5. 订阅源怎么加（站长）

左栏齿轮 → 管理抽屉，三个页签：

1. **添加**：粘 **feed 地址**或**站点首页**都行。粘首页时后端会去页面里找
   `<link rel="alternate" type="application/rss+xml">`，找不到再试 `/feed`、`/rss`、
   `/atom.xml` 等常见路径（`POST /api/rss/discover`），返回候选让你挑。
2. **精选源**：预置 14 个**国内**源，默认全选，一次导入
   （`backend/src/lib/rssPresets.js`）。每个地址都实测过能抓；
   抓不到的（机器之心 302、虎嗅超时、品玩返回 HTML、知乎日报 404、澎湃 302）已剔除。
3. **批量**：立即抓取全部 / 导出 OPML / 导入 OPML。

## 6. 接口一览

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/rss/feeds` | 读 | 订阅源列表（含 `total_count` / `unread_count`；访客的 `unread_count` 为 null） |
| GET | `/api/rss/feeds/:id` | 读 | 单个源 |
| GET | `/api/rss/articles` | 读 | 条目列表（`?feed_id=&unread=true&limit=&offset=`，**不含正文**） |
| GET | `/api/rss/articles/:id` | 读 | 单条详情（**含 `content_html`**，阅读器点开时才取） |
| GET | `/api/rss/opml` | 读 | 导出 OPML（`text/xml`） |
| GET | `/api/rss/presets` | 读 | 精选源清单（`?group=ai|media|dev|all`） |
| POST | `/api/rss/feeds` | 站长 | 新增（`{ feed_url, title?, fetch_interval?, is_public? }`，默认立即抓一次） |
| PATCH | `/api/rss/feeds/:id` | 站长 | 改（`title/site_url/description/fetch_interval/is_active/is_public/category_id/feed_url`） |
| DELETE | `/api/rss/feeds/:id` | 站长 | 删除（级联删条目） |
| POST | `/api/rss/feeds/:id/fetch` | 站长 | 抓单个源 |
| POST | `/api/rss/fetch-all` | 站长 | 批量抓（`{ batch_size? }` ≤30，45s 截止） |
| POST | `/api/rss/discover` | 站长 | 自动发现（`{ url }` → 候选 feed 列表，不落库） |
| POST | `/api/rss/articles/read-all` | 站长 | 全部已读（可 `{ feed_id }`） |
| PATCH | `/api/rss/articles/:id` | 站长 | 标记已读 / 未读 |
| POST | `/api/rss/opml` | 站长 | 导入（`{ opml }` 或 `{ feeds: [...] }`，已存在的跳过） |

## 7. 数据库

迁移 `supabase/migrations/20261012000023_rss.sql`（**只新增，不改历史迁移**）：

```
rss_feeds    id, user_id, title, feed_url, site_url, description, category_id,
             fetch_interval, last_fetched_at, last_error, error_count,
             etag, last_modified, is_active, is_public, created_at, updated_at
rss_articles id, user_id, feed_id, guid, title, link, author, summary,
             content_html, cover_path, published_at, is_read, created_at
```

`content_html` 是源站 feed 自带的正文（`content:encoded` / Atom `content`），
**只有正文够长（≥200 字）才存**，截断 200KB；入库前不算正文的短摘要只进 `summary`，
阅读器就引导读者点「阅读原文」。渲染前一律过 `frontend/src/lib/sanitizeHtml.js`
白名单清洗（与博客正文同一套，防第三方 feed 注入 XSS）。

## 8. 坑与注意

1. **不能加 cron 触发器**（账号已满 5 个），抓取只能搭车 —— 改抓取频率要改 `fetch_interval`
   或 `syncAllFeeds` 的 `batchSize`，不要动 `wrangler.toml` 的 `crons`。
2. **访客过滤必须在查询层做**，别指望 RLS（Worker 是 `service_role`，绕过 RLS）。
3. **列表接口不要带 `content_html`**：正文 HTML 可能上百 KB，列表带它会让首屏变得很慢。
4. 部分国内源对爬虫不友好（302 / 超时 / 返回 HTML），加源前先实测；
   实测方法见 `docs/rss.md` 本节与 `backend/src/lib/rssPresets.js` 的注释。
5. 站点 favicon 直接取 `<源域名>/favicon.ico`，取不到退回首字母方块 ——
   这是前端行为，不走后端，因此不会被 CORS 挡住（`<img>` 不受同源限制）。
