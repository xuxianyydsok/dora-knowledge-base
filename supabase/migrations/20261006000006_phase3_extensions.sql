-- =============================================================
-- 迁移 0006：Phase3 扩展
--   1) 收藏夹支持「资源」与「博客」两类目标（跨类型）
--   2) 用户偏好表（暗色主题自定义配色持久化）
--   3) 全文检索增强（pg_trgm + GIN 索引，提升 ILIKE 检索性能）
-- =============================================================

-- -------------------------------------------------------------
-- 1) 收藏夹：扩展为可收藏 resources 或 posts
-- -------------------------------------------------------------
alter table public.favorites
  add column if not exists post_id uuid references public.posts(id) on delete cascade;

-- resource_id 允许为空（收藏博客时为 null）
alter table public.favorites
  alter column resource_id drop not null;

-- 移除旧的唯一约束，改用部分唯一索引（NULL 不参与去重）
alter table public.favorites
  drop constraint if exists favorites_user_id_resource_id_key;

create unique index if not exists favorites_user_resource_uniq
  on public.favorites(user_id, resource_id) where resource_id is not null;

create unique index if not exists favorites_user_post_uniq
  on public.favorites(user_id, post_id) where post_id is not null;

-- 恰好指向一个目标（资源或博客）
alter table public.favorites
  drop constraint if exists favorites_target_check;
alter table public.favorites
  add constraint favorites_target_check
  check ((resource_id is not null) <> (post_id is not null));

comment on table public.favorites is '跨类型收藏夹：可收藏资源(resource_id)或博客(post_id)';

-- -------------------------------------------------------------
-- 2) 用户偏好表（主题自定义配色等）
-- -------------------------------------------------------------
create table if not exists public.user_preferences (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  theme      jsonb not null default '{}'::jsonb,   -- { light:{...}, dark:{...}, mode:'dark' }
  updated_at timestamptz not null default now()
);

comment on table public.user_preferences is '用户偏好设置（主题自定义配色等）';
comment on column public.user_preferences.theme is '主题配置：配色覆盖与模式';

create trigger trg_user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

alter table public.user_preferences enable row level security;

create policy "user_preferences_select_own" on public.user_preferences
  for select using (auth.uid() = user_id or public.is_admin());
create policy "user_preferences_insert_own" on public.user_preferences
  for insert with check (auth.uid() = user_id);
create policy "user_preferences_update_own" on public.user_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -------------------------------------------------------------
-- 3) 全文检索增强：pg_trgm 扩展 + GIN 索引
-- -------------------------------------------------------------
create extension if not exists "pg_trgm";

create index if not exists idx_posts_title_trgm
  on public.posts using gin (title gin_trgm_ops);
create index if not exists idx_posts_content_trgm
  on public.posts using gin (content gin_trgm_ops);
create index if not exists idx_resources_title_trgm
  on public.resources using gin (title gin_trgm_ops);
create index if not exists idx_resources_summary_trgm
  on public.resources using gin (summary gin_trgm_ops);
