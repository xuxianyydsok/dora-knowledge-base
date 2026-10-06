-- =============================================================
-- 迁移 0010：影视「外部详情页」与「播放地址」分离
-- 背景：影视元信息抓取（TVmaze / TMDB）只返回外部详情页链接，
--       不提供视频直链。此前该链接被写入 resources.url，
--       而前端把它当作 <video src> 使用，导致「无法播放」。
-- 变更：
--   1. movie_titles 新增 external_url 列（外部详情页，如 TVmaze/TMDB 页面）
--   2. resources.url 仅保留「可播放的视频直链」，由用户手动填写
--   3. 历史数据修正：把来源为 tvmaze/tmdb 的 resources.url 迁移到 external_url
-- =============================================================

alter table public.movie_titles
  add column if not exists external_url text;

comment on column public.movie_titles.external_url is '外部详情页链接（TVmaze/TMDB 等），非视频直链，前端用于跳转';
comment on column public.resources.url is '影视播放地址：仅存放可播放的视频直链，后端不转发视频流';

-- 历史数据修正：抓取来源的记录，其 resources.url 实际是外部详情页
-- 顺序不可颠倒：先复制到 external_url，再清空 resources.url
update public.movie_titles t
   set external_url = r.url
  from public.resources r
 where r.id = t.resource_id
   and t.external_url is null
   and r.source in ('tvmaze', 'tmdb')
   and r.url is not null;

update public.resources r
   set url = null
  from public.movie_titles t
 where t.resource_id = r.id
   and r.type = 'movie'
   and r.source in ('tvmaze', 'tmdb')
   and t.external_url = r.url;
