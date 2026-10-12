-- =============================================================
-- 音乐「管理员上传本地音频」（2026-10-12）
--
-- 背景（用户原话）：
--   「我只会把我下载的歌曲给到，也就是上传到」
--   「我肯定要手动填几个字的，就比如说它的歌名，还有那个它的歌手是谁，
--    谁唱了这首歌，就提供这两部分的内容。」
--   即：管理员上传音频文件，只填「歌名 + 歌手」，专辑 / 封面 / 歌词自动刮削。
--
-- 变更内容：
--   1. music_tracks 新增 audio_key / cover_key —— 指向 R2 对象的**内部 key**，
--      绝不对外返回（对外只给 /api/music/:id/audio 与 /api/music/:id/cover 这两个
--      「按 id 取字节」的端点，与 books / assets 同一套做法）。
--   2. music_tracks 新增 uploaded（是否为管理员上传的本地文件）。
--      用途：前端据此显示「本地上传」标记；删除曲目时据此决定要不要清 R2 对象。
--   3. music_tracks 新增 meta_source（元数据来源：id3 / itunes / deezer / manual），
--      便于排查「封面怎么来的」，也方便日后批量重刮。
--
-- 为什么不复用 audio_url 存 R2 地址：
--   audio_url 语义是「外链直链」，会被 mediaUrl.js 的直链判定当作可播地址，
--   而 R2 内部 key 不是 URL、不该出现在对外 JSON 里。两者混在一起会让
--   「isStaleAudioUrl 体检」误判，因此刻意分开两个字段。
--
-- 注意：只新增迁移，不改历史迁移。
-- =============================================================

alter table public.music_tracks
  add column if not exists audio_key   text,                          -- R2 内部 key（仅上传曲目有）
  add column if not exists cover_key   text,                          -- R2 内部 key（刮削封面转存后写入）
  add column if not exists uploaded    boolean not null default false, -- 是否管理员本地上传
  add column if not exists meta_source text;                           -- id3 / itunes / deezer / manual

comment on column public.music_tracks.audio_key is
  'R2 内部 object key（audio/<user_id>/<年>/<uuid>.<ext>）；仅管理员上传的曲目有值，绝不对外返回';
comment on column public.music_tracks.cover_key is
  'R2 内部 object key；刮削到的封面转存 R2 后写入，绝不对外返回';
comment on column public.music_tracks.uploaded is
  '是否为管理员上传的本地音频文件（true 时删除曲目需一并清理 R2 对象）';
comment on column public.music_tracks.meta_source is
  '元数据来源：id3=文件内嵌标签 / itunes / deezer=在线兜底 / manual=管理员手填';

-- 按「上传的曲目」筛选（前端可能想单独看本地上传的）
create index if not exists idx_music_tracks_uploaded
  on public.music_tracks(user_id, uploaded)
  where uploaded = true;
