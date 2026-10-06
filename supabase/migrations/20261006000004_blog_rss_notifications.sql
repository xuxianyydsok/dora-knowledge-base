-- =============================================================
-- 迁移 0004：博客、RSS 订阅、通知中心、收藏夹
-- 博客正文仅存原生 HTML，不支持 Markdown
-- =============================================================

-- -------------------------------------------------------------
-- 博客表 posts
-- content 为原生 HTML，可含自定义标签：
--   <katex-inline> <katex-block> <three-scene> <mermaid-chart> <chart-2d>
-- -------------------------------------------------------------
create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  slug         text not null,
  content      text not null default '',        -- 原生 HTML
  excerpt      text,
  cover_path   text,                            -- R2 封面路径
  status       text not null default 'draft' check (status in ('draft','published')),
  category_id  uuid references public.categories(id) on delete set null,
  is_public    boolean not null default false,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, slug)
);

comment on table  public.posts is 'HTML 博客文章，正文仅存原生 HTML';
comment on column public.posts.content is '原生 HTML，支持 katex/three/mermaid/chart 自定义标签';

create index if not exists idx_posts_user on public.posts(user_id);
create index if not exists idx_posts_status on public.posts(user_id, status);

create trigger trg_posts_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- RSS 订阅源
-- -------------------------------------------------------------
create table if not exists public.rss_feeds (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text,
  feed_url      text not null,
  site_url      text,
  category_id   uuid references public.categories(id) on delete set null,
  fetch_interval integer not null default 3600,   -- 抓取间隔（秒）
  last_fetched_at timestamptz,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, feed_url)
);

create index if not exists idx_rss_feeds_user on public.rss_feeds(user_id);
create index if not exists idx_rss_feeds_active on public.rss_feeds(is_active);

create trigger trg_rss_feeds_updated_at
  before update on public.rss_feeds
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- RSS 文章（仅存元信息 + 摘要，不存全文媒体）
-- -------------------------------------------------------------
create table if not exists public.rss_articles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  feed_id      uuid not null references public.rss_feeds(id) on delete cascade,
  guid         text not null,
  title        text not null,
  link         text,
  author       text,
  summary      text,
  cover_path   text,
  published_at timestamptz,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (feed_id, guid)
);

create index if not exists idx_rss_articles_user on public.rss_articles(user_id);
create index if not exists idx_rss_articles_feed on public.rss_articles(feed_id, published_at desc);

-- -------------------------------------------------------------
-- 通知中心：RSS 新文章、播放链接失效告警等
-- -------------------------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null,                -- rss_new / link_broken / system
  title       text not null,
  body        text,
  link        text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id, is_read, created_at desc);

-- -------------------------------------------------------------
-- 跨类型收藏夹（Phase3 使用，先建表预留结构）
-- -------------------------------------------------------------
create table if not exists public.favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, resource_id)
);

create index if not exists idx_favorites_user on public.favorites(user_id);

-- -------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------
alter table public.posts enable row level security;
create policy "posts_select" on public.posts
  for select using (auth.uid() = user_id or public.is_admin() or (is_public and status = 'published'));
create policy "posts_insert_own" on public.posts
  for insert with check (auth.uid() = user_id);
create policy "posts_update_own" on public.posts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "posts_delete_own" on public.posts
  for delete using (auth.uid() = user_id);

alter table public.rss_feeds enable row level security;
create policy "rss_feeds_all_own" on public.rss_feeds
  for all using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id);

alter table public.rss_articles enable row level security;
create policy "rss_articles_all_own" on public.rss_articles
  for all using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id);

alter table public.notifications enable row level security;
create policy "notifications_all_own" on public.notifications
  for all using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id);

alter table public.favorites enable row level security;
create policy "favorites_all_own" on public.favorites
  for all using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id);
