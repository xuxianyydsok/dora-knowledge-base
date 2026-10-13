-- =============================================================
-- 音乐「B 站视频曲目」（2026-10-13）
--
-- 背景（用户原话）：
--   「我在上传那个音乐的时候，就是可以上传那个一个哔哩哔哩的一个链接」
--   「我需要的就是那个视频窗口，就比如说有些音乐它是以 MV 的形式呈现出来的，
--    那个就不光是听音乐，那个直接看那个视频」
--
-- 设计：B 站曲目**不用 <audio> 播放**，而是嵌 B 站官方播放器（iframe）。
--   原因：B 站音频流的取流接口不给浏览器跨域，且后端机房 IP 会被限流；
--   而官方嵌入播放器由**用户浏览器**直连 B 站，不受机房 IP 影响，实测可播。
--
-- 新增字段：
--   bvid —— B 站视频号（BVxxxxxxxxxx），对外公开（前端要用它拼播放器地址）
--   其余（title / artist / 封面）复用现有列，封面取自 B 站封面图 URL
--
-- 为什么单独存 bvid 而不是塞进 audio_url：
--   audio_url 语义是「可直接喂给 <audio> 的媒体直链」，会被 mediaUrl.js 的直链判定
--   当作可播地址。B 站视频页不是直链，混进去会让「直链体检」误判，
--   也会让播放器尝试用 <audio> 加载一个 HTML 页面。因此刻意分开。
--
-- 注意：只新增迁移，不改历史迁移。
-- =============================================================

alter table public.music_tracks
  add column if not exists bvid text;

comment on column public.music_tracks.bvid is
  'B 站视频号（BV 号）；有值表示这是「嵌入 B 站播放器」的曲目，前端据此走 iframe 而不是 <audio>';

-- 同一首歌可能同时有本地音频与 B 站 MV，因此不建唯一索引，只建普通索引便于按 bvid 查
create index if not exists idx_music_tracks_bvid
  on public.music_tracks(bvid)
  where bvid is not null;
