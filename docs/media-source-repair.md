# 影视/音乐播放可靠性修复（2026-10-10）

> 分支 `fix/media-playback-reliability`。本文说明「搜到电影却全部显示片源无法解析」的根因、
> 本轮改动、验证结果与残余风险。**本轮没有 commit / push / 部署，也没有动数据库。**

## 1. 用户症状

> 「我搜了一部电影，然后全部显示的是片源无法解析。」

## 2. 根因（线上实测确认）

### 2.1 已收藏记录指向「已下线的采集源」

线上 `resources(type='movie')` 共 7 条，`source_key` 分别是 `dytt` / `jszy` / `lzi`：

| 标题 | 存库 source_key | 存库 url | 实测 |
| --- | --- | --- | --- |
| 复仇者联盟4：终局之战 | dytt | `https://vip.dytt-kan.com/...` | **403（死）** |
| 庆余年 第二季 | dytt | `https://vip.dytt-play.com/...` | 200 |
| 人生交换 | jszy | `https://vv.jisuzyv.com/play/...` | 200 |
| 庆余年第二季 | lzi | `https://v.lzcdn28.com/...` | **404（死）** |

这三个源在 2026-10-09 已因「片源 403/404」从 `DEFAULT_VOD_SOURCES` 移除，于是：

- 详情页回源 `POST /api/movies/source-detail {source:'dytt'}` → `404 采集源不存在：dytt`；
- 播放时用存库旧直链（dytt 403）→ 播放器报「片源无法解析」。

### 2.2 采集源线路里混着非直链地址

`vod_play_url` 同时包含可直接播放的 `.m3u8` 和**网页地址**：

```
dyttm3u8  HD国语  https://vip.dytt-kan.com/.../index.m3u8   ← 可播
dytt      HD国语  https://vip.dytt-kan.com/share/<hash>     ← 网页分享页
hnyun     正片    https://hn.bfvvs.com/play/lejLLq4b        ← 网页播放页
hnm3u8    正片    https://hn.bfvvs.com/play/lejLLq4b/index.m3u8  ← 可播
```

`normalizeVod` 原样保留全部线路，详情页把它们都列成「线路」，用户点到网页地址必然失败。

### 2.3 音乐库存了网页地址当播放地址

线上 1 条 Audius 曲目把 `https://audius.co/byone/...`（网页）写进了 `resources.url`，
真正的可播地址在 `metadata.audio_url`（`https://api.audius.co/v1/tracks/<id>/stream`）。
GD 音乐台的直链是**带时间戳的签名地址会过期**，旧链接同样 403。

## 3. 本轮改动

### 3.1 新增 `backend/src/lib/mediaUrl.js`（纯函数、无 IO）

| 函数 | 作用 |
| --- | --- |
| `isDirectAudioUrl(url)` | 是否音频直链（mp3/flac/m4a/aac/ogg/opus/wav/mp3/mp4/m3u8…） |
| `isDirectVideoUrl(url)` | 是否影视直链（m3u8 / mp4） |
| `resolveAudioPlayback({url,audio_url,preview_url})` | 音频地址归一：完整音轨 > 显式直链 > 试听片段；网页地址一律忽略 |
| `looksLikeAudioStream(url)` | 直链后缀，或无后缀的流式端点（如 Audius `/stream`）都算可播 |
| `isStaleAudioUrl(url)` | 有地址但既非直链也非流式端点 → 疑似网页地址（只读体检用） |

### 3.2 `backend/src/lib/maccms.js`

- `normalizeVod`：**剔除非直链线路与剧集**；若某条线路一个直链都没有就整条丢弃；
  兜底（全部为非直链）保留原始线路，但 `playable_url` 仍为 `null`。
- `DEFAULT_VOD_SOURCES`：**新增 `360zy`**（360资源备用，`https://360zy.com`），实测 5/5 可播。
- `ANIME_CLASS_IDS`：补 `'360zy': [38,39,40]`。

### 3.3 `backend/src/routes/movies.js`

- 纯函数 `pickBestMovieCandidate(candidates, {title, mediaType})`：
  只接受**可信阈值** `RESOLVE_MAX_RELEVANCE = 3` 的候选（完全同名 / 关键词+第N季 / 关键词+(年份) / 其他前缀），
  拒绝相关度 4/5 的同名异片；优先与 `media_type` 一致；再按相关度、标题长度、集数排序。
- `POST /api/movies/:id/refresh-source`（requireAuth）：
  1. 读该 movie 资源 + `movie_titles` 扩展；
  2. 原 `source_key` 若仍在用，先按其 `source_vod_id` 回源取最新线路（最快最准）；
  3. 否则用**原标题**（必要时回退主标题）去在用源重搜，按可信阈值挑最佳候选回填；
  4. **写操作严格 `user_id=eq.${user.id}`；管理员不跨用户写；不确定就 404，不写库**。

### 3.4 `backend/src/routes/music.js`

- `createMusic`：`resolveAudioPlayback` 归一，**无可用直链返回 422**；只存直链；试听标 `preview`。
- `updateMusic`：`url` 只接受音频直链，网页地址 422 拒绝。
- `getMusic`：返回只读 `url_stale` 标记（存库地址疑似网页时），**不自动改库**。

### 3.5 前端

- `MovieView.jsx`：过滤非直链线路/剧集；`playUrl` 只取直链；站长可见「重新匹配片源」按钮
  （详情加载失败、无播放地址、或存库地址疑似失效时出现）。
- `Music.jsx`：不再把 `page_url` 当播放地址（改传 `audio_url || preview_url`）。
- `MusicView.jsx`：`url_stale` 时提示「音源可能已过期，点播放会自动重新解析」。
- `api.js`：新增 `refreshMovieSource(id)`。

## 4. 验证结果（本机，2026-10-10）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 后端确定性 + 契约测试 | `cd backend && npm run test:unit` | ✅ 60/60 通过 |
| 前端生产构建 | `cd frontend && npm run build` | ✅ 通过 |
| 凭据扫描（工作树） | `node scripts/check-secrets.mjs` | ✅ 170 文件 |
| 凭据扫描（全历史） | `node scripts/check-secrets.mjs --history` | ✅ 82 提交 |
| 空白字符检查 | `git diff --check` | ✅ 通过 |
| 语法检查 | `node --check`（6 个改动文件） | ✅ 全部通过 |

**真实联网验证**（只读）：

- `360zy` 5/5 端到端可播；`ruyi` 3/5 → 不收录。
- 重匹配干跑（线上 4 条真实记录）：`复仇者联盟4：终局之战`→hhzy、`庆余年 第二季`→zy360new、
  `人生交换`→subo，三条 m3u8 实测 206；`庆余年第二季` 精确命中同名。

## 5. 残余风险

1. **采集源随时会挂**：过滤与自愈只把死线路挡在门外，源本身仍可能下线；实时口径看 `/sources` 面板。
2. **重匹配是尽力而为**：源站标题写法千差万别，主标题回退也未必 100% 命中；命中不了就 404。
3. **存量数据未批量修复**：只提供站长手动入口，**不自动批量改库**。
4. **未做真机端到端**：重匹配接口只在本地用真实 fetchers 干跑过，未在部署后的 Worker 上验证。
