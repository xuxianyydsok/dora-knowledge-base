-- =============================================================
-- 迁移 0008：音乐收藏库
-- 设计：音乐主记录存放于统一资源表 resources(type='music')，
--       从而自动接入标签(resource_tags)、分类(category_id)、
--       收藏夹(favorites)、全局检索与关联图谱。
--       音乐专属字段（歌手/专辑/播放地址/时长等）存于扩展表
--       music_tracks，与 resources 一对一（参照 user_profiles 扩展 auth.users）。
-- =============================================================

create table if not exists public.music_tracks (
  resource_id  uuid primary key references public.resources(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  artist       text,                          -- 歌手
  album        text,                          -- 专辑
  artwork_url  text,                          -- 封面链接（外链或 R2 路径）
  audio_url    text,                          -- 播放地址（外链，前端直接播放）
  preview_url  text,                          -- 试听片段
  duration     integer,                       -- 时长（秒）
  genre        text,                          -- 流派
  release_year integer,                       -- 发行年份
  notes        text,                          -- 备注
  lyrics       text,                          -- 歌词（文本，非音频文件）
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table  public.music_tracks is '音乐专属字段扩展表，1:1 关联 resources(type=music)';
comment on column public.music_tracks.audio_url is '音频播放地址（外链），后端不转发音频流';
comment on column public.music_tracks.artwork_url is '封面链接；如需 R2 存储仅记录路径字符串';

create index if not exists idx_music_tracks_user on public.music_tracks(user_id);
create index if not exists idx_music_tracks_artist on public.music_tracks(user_id, artist);

create trigger trg_music_tracks_updated_at
  before update on public.music_tracks
  for each row execute function public.set_updated_at();

-- RLS：本人可读写自己的音乐；管理员可读全部
alter table public.music_tracks enable row level security;

create policy "music_tracks_select_own" on public.music_tracks
  for select using (auth.uid() = user_id or public.is_admin());
create policy "music_tracks_insert_own" on public.music_tracks
  for insert with check (auth.uid() = user_id);
create policy "music_tracks_update_own" on public.music_tracks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "music_tracks_delete_own" on public.music_tracks
  for delete using (auth.uid() = user_id);
