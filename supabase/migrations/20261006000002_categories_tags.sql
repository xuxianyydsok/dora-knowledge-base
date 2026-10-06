-- =============================================================
-- 迁移 0002：分类、标签（标签支持自定义颜色）
-- 所有业务表均带 user_id 外键，实现用户数据隔离
-- =============================================================

-- -------------------------------------------------------------
-- 分类表 categories
-- -------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  slug        text not null,
  description text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, slug)
);

comment on table public.categories is '资源分类，按用户隔离';

create index if not exists idx_categories_user_id on public.categories(user_id);

create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- 标签表 tags（支持自定义颜色）
-- -------------------------------------------------------------
create table if not exists public.tags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  slug        text not null,
  color       text not null default '#6b7280',   -- 自定义颜色（HEX）
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, slug)
);

comment on table public.tags is '标签，支持自定义颜色，按用户隔离';
comment on column public.tags.color is '标签颜色，HEX 字符串，例如 #ff8800';

create index if not exists idx_tags_user_id on public.tags(user_id);

create trigger trg_tags_updated_at
  before update on public.tags
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- RLS：本人可读写自己的分类/标签，管理员可读全部
-- -------------------------------------------------------------
alter table public.categories enable row level security;

create policy "categories_select_own" on public.categories
  for select using (auth.uid() = user_id or public.is_admin());
create policy "categories_insert_own" on public.categories
  for insert with check (auth.uid() = user_id);
create policy "categories_update_own" on public.categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "categories_delete_own" on public.categories
  for delete using (auth.uid() = user_id);

alter table public.tags enable row level security;

create policy "tags_select_own" on public.tags
  for select using (auth.uid() = user_id or public.is_admin());
create policy "tags_insert_own" on public.tags
  for insert with check (auth.uid() = user_id);
create policy "tags_update_own" on public.tags
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tags_delete_own" on public.tags
  for delete using (auth.uid() = user_id);
