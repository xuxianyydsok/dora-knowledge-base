-- =============================================================
-- 迁移 0014：移除 RSS 模块（用户决定，2026-10-09，不保留数据）
-- 删除 rss_articles / rss_feeds 表、RSS 通知，以及 resources 中的 rss_article 类型
-- =============================================================

drop table if exists public.rss_articles cascade;
drop table if exists public.rss_feeds cascade;

delete from public.notifications where type = 'rss_new';

delete from public.resources where type = 'rss_article';

alter table public.resources drop constraint if exists resources_type_check;
alter table public.resources
  add constraint resources_type_check check (type in ('video','github','music','movie'));

comment on table public.resources is '统一资源表，type 区分视频/GitHub/音乐/影视';
