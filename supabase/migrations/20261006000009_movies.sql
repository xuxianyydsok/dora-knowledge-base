-- =============================================================
-- 迁移 0009：影视收藏库
-- 设计：影视主记录存于统一资源表 resources(type='movie')，
--       从而自动接入标签(resource_tags)、分类(category_id)、
--       收藏夹(favorites)、全局检索与关联图谱。
--       影视专属字段存于扩展表 movie_titles（1:1）。
-- =============================================================

create table if not exists public.movie_titles (
  resource_id  uuid primary key references public.resources(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  media_type   text not null default 'movie' check (media_type in ('movie','tv')),  -- 电影/剧集
  original_title text,                        -- 原名
  director     text,                          -- 导演
  cast_list    text,                          -- 主演（逗号分隔文本）
  genres       text,                          -- 类型（逗号分隔文本）
  release_date date,                          -- 上映/首播日期
  runtime      integer,                       -- 时长（分钟）
  rating       numeric(3,1),                  -- 评分 0-10
  overview     text,                          -- 简介
  poster_url   text,                          -- 海报链接
  backdrop_url text,                          -- 背景图链接
  external_id  text,                          -- 外部数据源 ID
  source       text,                          -- 数据源：tmdb/tvmaze/manual
  notes        text,                          -- 备注
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table  public.movie_titles is '影视专属字段扩展表，1:1 关联 resources(type=movie)';
comment on column public.movie_titles.media_type is 'movie=电影，tv=剧集';
comment on column public.movie_titles.poster_url is '海报链接；如需 R2 存储仅记录路径字符串';

create index if not exists idx_movie_titles_user on public.movie_titles(user_id);
create index if not exists idx_movie_titles_media on public.movie_titles(user_id, media_type);

create trigger trg_movie_titles_updated_at
  before update on public.movie_titles
  for each row execute function public.set_updated_at();

-- RLS：本人可读写自己的影视；管理员可读全部
alter table public.movie_titles enable row level security;

create policy "movie_titles_select_own" on public.movie_titles
  for select using (auth.uid() = user_id or public.is_admin());
create policy "movie_titles_insert_own" on public.movie_titles
  for insert with check (auth.uid() = user_id);
create policy "movie_titles_update_own" on public.movie_titles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "movie_titles_delete_own" on public.movie_titles
  for delete using (auth.uid() = user_id);

-- -------------------------------------------------------------
-- RSS 增强：记录条件请求信息，减少重复抓取与带宽
-- -------------------------------------------------------------
alter table public.rss_feeds
  add column if not exists etag text,
  add column if not exists last_modified text;

comment on column public.rss_feeds.etag is 'HTTP ETag，用于条件请求';
comment on column public.rss_feeds.last_modified is 'Last-Modified 响应头，用于条件请求';
