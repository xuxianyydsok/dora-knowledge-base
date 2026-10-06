-- =============================================================
-- 迁移 0013：影视采集源字段
-- 背景：影视主源改为苹果CMS（maccms）采集接口，可搜到真正的电影/电视剧
--       并直接拿到可播放的 m3u8/mp4。需要保存采集源标识、资源 ID 与线路数据。
-- 变更：
--   1. movie_titles 新增 source_key（采集源 key，如 lzi/ffzy/dytt）
--   2. movie_titles 新增 source_vod_id（采集源内的资源 ID，用于回源取详情/选集）
--   3. movie_titles 新增 routes（多线路多集 JSON，结构 [{name, episodes:[{name,url}]}]）
--   4. movie_titles 新增 area（地区）、remarks（清晰度/更新备注）
-- 说明：仅保存播放地址字符串，视频文件不入库，后端不转发视频流。
-- =============================================================

alter table public.movie_titles
  add column if not exists source_key text,
  add column if not exists source_vod_id text,
  add column if not exists routes jsonb,
  add column if not exists area text,
  add column if not exists remarks text;

comment on column public.movie_titles.source_key is '苹果CMS采集源标识（lzi/ffzy/dytt 等）';
comment on column public.movie_titles.source_vod_id is '采集源内的资源 ID，用于回源获取完整线路与剧集';
comment on column public.movie_titles.routes is '多线路多集 JSON：[{name, episodes:[{name,url}]}]，url 为 m3u8/mp4 播放地址';
comment on column public.movie_titles.area is '制片地区';
comment on column public.movie_titles.remarks is '采集源备注，如「HD国语」「更新至12集」';

create index if not exists idx_movie_titles_source
  on public.movie_titles(user_id, source_key);
