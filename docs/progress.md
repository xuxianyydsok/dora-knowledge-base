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

## 0. 项目速览

| 项 | 值 |
| --- | --- |
| 项目 | **Dora** · 个人知识管理平台（原「知识库」） |
| 仓库路径 | `/home/xgc/projects/knowledge-base`（WSL2 Ubuntu 原生文件系统，**禁止放到 /mnt/c**） |
| 技术栈 | 前端 Preact + Vite（Cloudflare Pages） / 后端 Cloudflare Workers + wrangler（REST + 管理员 MCP） / Supabase（Postgres + Auth + RLS，CLI 迁移） / Cloudflare R2 / GitHub Actions |
| 前端线上 | `https://dora.xuguochen.de5.net`（Pages 项目 `knowledge-base`，默认域 `knowledge-base-9j0.pages.dev`） |
| 后端线上 | `https://api.xuguochen.de5.net`（Worker `knowledge-base-api`） |
| Supabase | 项目 ref `wkpxbyauvnxvmzidbeer`（ap-southeast-2 / PG17）；本地凭证在 `supabase/.env.local`（已 gitignore） |
| 管理员账号 | `<REDACTED:ADMIN_EMAIL>` / `<REDACTED:ADMIN_PASSWORD>`（uid `22ebc30e-d335-4199-9cfd-597e9402fb9e`，role=admin） |
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

## 3. 下一步（按优先级，接手即可开工）

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
curl -s -x http://127.0.0.1:7897 -X POST "$VITE_SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"<REDACTED:ADMIN_EMAIL>","password":"<REDACTED:ADMIN_PASSWORD>"}' \
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
