-- =============================================================
-- 迁移 0011：音乐音质与歌手头像
-- 背景：音乐元信息改为多源聚合（Audius 完整音轨 / iTunes / Deezer 试听）。
--       需要区分「完整音轨」与「试听片段」，并在播放器展示歌手头像。
-- 变更：
--   1. music_tracks 新增 quality 列（full=完整音轨，preview=试听片段）
--   2. music_tracks 新增 artist_avatar 列（歌手头像链接）
--   3. 历史数据：已有 audio_url 的视为完整音轨，仅有 preview_url 的视为试听
-- =============================================================

alter table public.music_tracks
  add column if not exists quality text not null default 'full'
    check (quality in ('full', 'preview')),
  add column if not exists artist_avatar text;

comment on column public.music_tracks.quality is 'full=完整音轨，preview=试听片段（仅保存播放地址字符串，不存音频文件）';
comment on column public.music_tracks.artist_avatar is '歌手头像链接，用于播放器与歌词页展示';

-- 历史数据修正：只有试听片段、没有完整音轨的记录标记为 preview
update public.music_tracks
   set quality = 'preview'
 where audio_url is null
   and preview_url is not null;
