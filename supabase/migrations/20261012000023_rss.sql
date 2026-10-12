-- =============================================================
-- 迁移 0023：恢复 RSS 订阅（2026-10-12）
-- 背景：2026-10-09 用户决定删除 RSS 模块，迁移 0014 把 rss_feeds / rss_articles
--       两张表连同数据一起删掉了（历史不可改，本迁移不修改它）。
--       2026-10-12 用户决定恢复，但形态变了 —— **站长订阅一次，访客直接读**：
--       站长在 /rss 里维护订阅源，所有访客打开 /rss 就能读，不需要自己订阅
--       （用户原话：「我懒得一个一个去点订阅」）。
-- 说明：只新增迁移，不改历史迁移。表结构在旧版基础上补了三列：
--       is_public（源是否对访客可见，默认可见）、last_error / error_count（抓取健康度）。
--
-- 安全要点：访客读 /api/rss/* 时，路由必须在**查询层**显式叠加
--   user_id = 站长 且 is_public = true —— Worker 用 service_role 直连 PostgREST，
--   RLS 不会替它过滤（见 docs/public-access.md）。
-- =============================================================

-- -------------------------------------------------------------
-- 订阅源
-- -------------------------------------------------------------
create table if not exists public.rss_feeds (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  title           text,
  feed_url        text not null,
  site_url        text,
  description     text,                             -- 源站自述（抓取时补全，用于阅读器左栏简介）
  category_id     uuid references public.categories(id) on delete set null,
  fetch_interval  integer not null default 14400,   -- 抓取间隔（秒），默认 4 小时
  last_fetched_at timestamptz,
  last_error      text,                             -- 最近一次抓取失败原因（成功后清空）
  error_count     integer not null default 0,       -- 连续失败次数，成功归零
  etag            text,                             -- HTTP ETag，用于条件请求
  last_modified   text,                             -- Last-Modified 响应头，用于条件请求
  is_active       boolean not null default true,
  is_public       boolean not null default true,    -- 是否对访客可见；默认可见
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, feed_url)
);

comment on table public.rss_feeds is 'RSS/Atom 订阅源：站长订阅一次，访客只读（方案 A，2026-10-12）';
comment on column public.rss_feeds.is_public is '是否对访客可见；默认 true。站长可把单个源设为私人，访客读接口会按它过滤';
comment on column public.rss_feeds.fetch_interval is '抓取间隔（秒），默认 14400（4 小时）；抓取搭现有 cron 的车，不新增触发器';
comment on column public.rss_feeds.error_count is '连续抓取失败次数，成功一次归零；前端据此提示「这个源可能坏了」';

create index if not exists idx_rss_feeds_user on public.rss_feeds(user_id, created_at desc);
create index if not exists idx_rss_feeds_due on public.rss_feeds(is_active, last_fetched_at);
create index if not exists idx_rss_feeds_public on public.rss_feeds(user_id, is_public);

create trigger trg_rss_feeds_updated_at
  before update on public.rss_feeds
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- 文章条目（只存元信息 + 纯文本摘要，不下载媒体、不存全文）
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
  content_html text,                            -- 源站自带的正文 HTML（content:encoded 等），阅读器里就地读
  cover_path   text,
  published_at timestamptz,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (feed_id, guid)
);

comment on table public.rss_articles is 'RSS 条目元信息 + 摘要 + 源站自带的正文 HTML（不下载媒体；源站只给摘要时阅读器引导去原文）';
comment on column public.rss_articles.content_html is '源站 feed 里自带的正文 HTML（content:encoded / content），入库前截断到 200KB；前端用 sanitizeHtml 清洗后再渲染';

create index if not exists idx_rss_articles_user on public.rss_articles(user_id, published_at desc);
create index if not exists idx_rss_articles_feed on public.rss_articles(feed_id, published_at desc);
create index if not exists idx_rss_articles_unread on public.rss_articles(user_id, is_read);

-- -------------------------------------------------------------
-- RLS（风格与 assets / books / moments 一致：本人可读写，管理员可读全部）
-- 注意：访客走的是 Worker 的 service_role 直连，这里的两条策略只是给
--       浏览器直连 Supabase 的场景兜底；真正的访客过滤在路由层。
-- -------------------------------------------------------------
alter table public.rss_feeds enable row level security;
create policy "rss_feeds_select_own" on public.rss_feeds
  for select using (auth.uid() = user_id or public.is_admin());
create policy "rss_feeds_insert_own" on public.rss_feeds
  for insert with check (auth.uid() = user_id);
create policy "rss_feeds_update_own" on public.rss_feeds
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "rss_feeds_delete_own" on public.rss_feeds
  for delete using (auth.uid() = user_id);

alter table public.rss_articles enable row level security;
create policy "rss_articles_select_own" on public.rss_articles
  for select using (auth.uid() = user_id or public.is_admin());
create policy "rss_articles_insert_own" on public.rss_articles
  for insert with check (auth.uid() = user_id);
create policy "rss_articles_update_own" on public.rss_articles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "rss_articles_delete_own" on public.rss_articles
  for delete using (auth.uid() = user_id);
