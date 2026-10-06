# 影音接口核对清单（去重累积）

> 用途：汇总多份外部「影音接口清单」，逐条实测、去重，作为集成依据。
> 实测环境：WSL2 Ubuntu，经本地代理出网，2026-10-06。
> 状态：✅ 实测可用 ｜ ⚠️ 可用但有明显限制 ｜ ❌ 实测不可用 ｜ 🚫 需自部署/需注册 key（暂不集成）
>
> **本文件只记录结论，不记录进度。** 项目进度与接力说明看 `docs/progress.md`。
> 新增清单时：追加一行来源编号 → 逐条实测 → 更新对应表格状态 → 更新第四节「集成状态」。

## 已核对的来源

| 编号 | 来源 | 备注 |
|------|------|------|
| L1 | `C:\Users\x1078\Doubao\chats\2026-10-06\new-chat-2\影音助手接口清单.md` | 偏采集源与自部署项目 |
| L2 | `E:\AI Agent测试\CESHI\TEST4\影音接口清单.md` | 偏公开免 key 元数据接口 |

> 结论（2026-10-06）：L1/L2 去重后能用的接口**已全部集成**，详见第四节。
> 后续还会有新的清单文件，按同样流程累积即可。

---

## 一、影视

### 1.1 苹果CMS 采集源（已集成 / 待集成）

| 源 | 地址 | 状态 | 来源 | 说明 |
|----|------|------|------|------|
| 量子资源 lzi | `https://cj.lziapi.com/api.php/provide/vod/` | ✅ 已集成 | — | 主力源，动漫需带 `t=29`/`t=30` |
| 非凡资源 ffzy | `https://api.ffzyapi.com/api.php/provide/vod/` | ✅ 已集成 | L1 | |
| 电影天堂 dytt | `https://caiji.dyttzyapi.com/api.php/provide/vod/` | ✅ 已集成 | L1 | |
| 最大资源 zuid | `https://api.zuidapi.com/api.php/provide/vod` | ✅ 已集成 | L1 | 补到 lzi 缺失的「仙逆」「迪迦奥特曼」等；偶发非 JSON 响应需容错 |
| 360资源 zy360 | `https://360zy.com/api.php/provide/vod/` | ✅ 已集成 | L1 | |
| ffzy5.tv | `http://ffzy5.tv/api.php/provide/vod` | ⚠️ 不集成 | L1 | 仅剩短剧，无增量 |
| 豆瓣资源 dbzy | `https://dbzy.tv/api.php/provide/vod/` | ❌ 不集成 | L1 | 返回「Current API forbids keyword search」 |
| 黑木耳 heimuer | `https://cj.heimuer.xyz` | ❌ 不集成 | L1 | 302 跳转，无响应 |
| 新华为 cjhw | `https://cjhwba.com` | ❌ 不集成 | L1 | 空响应 |
| 麻花 mahua | `https://www.mhapi123.com/inc/api.php` | ❌ 不集成 | L1 | 空响应 |
| 天涯 tyyszy / ck资源 ckzy | — | 未测 | L1 | 清单未给出可用域名 |

### 1.2 公开元数据接口（免 key）

| 接口 | 用途 | 状态 | 来源 | 说明 |
|------|------|------|------|------|
| **Cinemeta (Stremio)** | 电影/剧集元数据、海报、演员、评分 | ✅ **已集成**（2026-10-06） | L2 | 搜索用 `catalog/movie/top/search=关键词.json`（**支持中文**）；详情 `meta/movie/{imdb_id}.json`；已接入 `lib/metadb.js`，在 `fetchMovieMeta` 里补前 4 条缺失的海报/评分 |
| TVMaze | 剧集信息、播出表 | ✅ 已集成 | L2 | 现有兜底源 |
| **Kitsu** | 动漫/漫画元数据 | ✅ **已集成**（2026-10-06） | L2 | `kitsu.io/api/edge/anime?filter[text]=`；作为 Bangumi 的备选（`lib/metadb.js`） |
| **Bangumi** | ACG 条目库（中文资料全） | ✅ **已集成**（2026-10-06） | L2 | `POST api.bgm.tv/v0/search/subjects`，**必须带 User-Agent**；动漫条目优先用它补封面/简介/评分 |
| Internet Archive | 公版影视 + etree 现场音乐 | ✅ 已集成 | L1/L2 | 影视兜底源；音乐侧 26.6 万条 FLAC 演出录音可复用 |
| TMDB / OMDb / Trakt / Fanart.tv | 影视元数据增强 | 🚫 需 key | L2 | 暂不集成 |

---

## 二、音乐

### 2.1 高音质点播（完整曲目，非试听）

| 接口 | 音质实测 | 状态 | 来源 | 说明 |
|------|----------|------|------|------|
| **GD音乐台** | `br=999` → **56MB FLAC / 1607kbps 完整曲** | ✅ **已集成（主源，2026-10-06）** | L1 | 基址 `https://music-api.gdstudio.xyz/api.php`；`types=search/url/lyric/pic` 四项全通；**仅 netease 源能拿到直链**（joox/bilibili 实测 `br=-1`），故默认只用 netease；**5 分钟 50 次限频**；**必须用浏览器 UA**（自定义 UA 返回空列表）；直链是带时间戳的签名地址会过期 → 已加 `POST /api/music/stream` 重解析 |
| Audius | 320kbps MP3 完整曲 | ✅ 已集成 | L1/L2 | 独立音乐人为主，华语流行覆盖弱 |
| Internet Archive etree | 真无损 FLAC | ✅ 部分可用 | L2 | 现场音乐存档，非流行曲库 |
| Radio Browser FLAC | 无损连续流 | ✅ **待集成（可选）** | L2 | 电台不可点歌，适合背景播放 |
| Jamendo | FLAC 完整曲 | 🚫 需 client_id | L1/L2 | 独立音乐 |
| 网易最简直链 | ~128k | ❌ 不集成 | L1 | 音质不达标 |
| NeteaseCloudMusicApi / UnblockNeteaseMusic / web-music-api / mioku / @meting/core / listen1-api | 可拿无损 | 🚫 需自部署 | L1 | 需 VIP cookie + 服务器，暂不引入 |

### 2.2 元数据与歌词

| 接口 | 用途 | 状态 | 来源 | 说明 |
|------|------|------|------|------|
| Deezer | 搜索、专辑、封面 | ✅ 已集成 | L2 | 仅 30 秒试听，**只作元数据源** |
| iTunes Search | 搜索、封面 | ✅ 已集成 | L2 | 中文需加 `country=tw/hk` |
| LRCLIB | 同步歌词 | ✅ 已集成 | L2 | 优先 `/api/get`，回退 `/api/search` |
| MusicBrainz | 音乐百科元数据 | ✅ **待集成** | L1/L2 | 限速 1 req/s，必须带 User-Agent |
| **TheAudioDB** | 歌手资料、封面图 | ✅ **已集成**（2026-10-06） | L2 | 测试 key `123`，限速低 → 只补第一条结果的歌手头像；注意要用 `www.theaudiodb.com`（不带 www 会 301） |
| netstart 网易云镜像 | 搜索、歌词 | ⚠️ 不集成 | L1 | 搜索可用但 `lyric`/`song/url` 超时，稳定性不足；GD音乐台已覆盖同一曲库 |
| music-api-for-ncm | 搜索（含 songId/封面） | ⚠️ 不集成（备选） | L1 | `music-api-for-ncm.onmicrosoft.cn/api/search/{词}`；同上，GD音乐台已覆盖，保留备选 |
| Last.fm | 标签、相似推荐 | 🚫 需 key | L1/L2 | |
| Spotify | 曲库搜索 | 🚫 需 key 且无完整播放流 | L2 | |
| JioSaavn / SoundCloud / ytmusicapi | 印度曲库/创作者音乐 | 未测 | L1 | 优先级低 |
| Jikan (MyAnimeList) | 动漫元数据 | ❌ 直连超时 | L2 | 用 Kitsu / Bangumi 替代 |

---

## 三、去重结论

- **两份清单重复项**：Audius、MusicBrainz、Jamendo、Last.fm、Internet Archive、Deezer、iTunes、LRCLIB、TVMaze —— 各保留一条。
- **仅 L1 独有且可用**：GD音乐台（音乐主源）、最大资源 zuid、360资源 zy360、music-api-for-ncm、netstart。
- **仅 L2 独有且可用**：Cinemeta、Kitsu、Bangumi、TheAudioDB、Radio Browser。
- **排除项**：需自部署项目、需注册 key 的接口、音质不达标的直链、实测失效的采集源。

## 四、集成状态与后续优先级

> 本节随进度更新；代码层面的接力说明见 `docs/progress.md`。

**已集成（可用）**

| 类别 | 接口 | 落地位置 |
| --- | --- | --- |
| 影视主源 | 苹果CMS 采集源 lzi / ffzy / dytt / zuid / zy360（5 个） | `backend/src/lib/maccms.js`（`DEFAULT_VOD_SOURCES`，可用 `VOD_SOURCES` 覆盖） |
| 影视补全 | Cinemeta、Bangumi、Kitsu | `backend/src/lib/metadb.js` → `fetchers.js` 的 `enrichMovieCandidates` |
| 影视兜底 | Internet Archive、TVmaze | `backend/src/lib/fetchers.js` |
| 音乐主源 | GD音乐台（netease 源，FLAC 完整曲） | `backend/src/lib/fetchers.js`（`searchGdstudioMusic` / `resolveGdstudioUrl`） |
| 音乐补充 | Audius（完整音轨）、iTunes / Deezer（元信息与封面）、TheAudioDB（歌手头像） | 同上 |
| 歌词 | LRCLIB（主）、GD音乐台（兜底） | `fetchLyrics` |

**下一步优先级**

1. **继续累积清单**：用户手里还有若干份「影音接口清单」，会陆续给出路径。
   流程固定为：逐条实测 → 与本文既有条目去重 → 结论写回本文 → 只集成真正可用的。
   **已核对过的条目不要重复测**（L1/L2 两份已核完）。
2. 音乐可选补充：`Radio Browser`（FLAC 无损电台，不可点歌）、`MusicBrainz`（限速 1 req/s，需 UA）。
3. 影视可选补充：`TMDB`（需 key，配置 `TMDB_API_KEY` 后自动启用，代码里已有回退分支）。
4. 明确**不集成**：需自部署项目（NeteaseCloudMusicApi / UnblockNeteaseMusic / web-music-api / @meting/core / listen1-api）、
   需注册 key 且无完整播放流的（Spotify / Last.fm / Jamendo）、音质不达标（网易最简直链 128k）、
   实测失效的采集源（ffzy5 / dbzy / 黑木耳 / 新华为 / 麻花）、稳定性不足的镜像（netstart / music-api-for-ncm）。
