-- =============================================================
-- 迁移 0003：统一资源表、资源-标签关联、资源间关联、播放进度
-- 外部资源仅存元信息与文本摘要，媒体文件一律不入库
-- =============================================================

-- -------------------------------------------------------------
-- 统一资源表 resources
-- type 区分：video / github / music / movie / rss_article
-- metadata 存放各类型差异化元信息（JSON），避免表爆炸
-- -------------------------------------------------------------
create table if not exists public.resources (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  type         text not null check (type in ('video','github','music','movie','rss_article')),
  title        text not null,
  url          text,                                      -- 外部链接（B站/Youtube/GitHub 等）
  source       text,                                      -- 来源平台：bilibili/youtube/github/...
  cover_path   text,                                      -- R2 封面路径字符串
  summary      text,                                      -- 文本摘要
  category_id  uuid references public.categories(id) on delete set null,
  metadata     jsonb not null default '{}'::jsonb,        -- 差异化元信息
  is_public    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table  public.resources is '统一资源表，type 区分视频/GitHub/音乐/影视/RSS文章';
comment on column public.resources.cover_path is 'R2 文件路径字符串，禁止存二进制';
comment on column public.resources.metadata is '各类型差异化元信息（时长、star数、作者等）';

create index if not exists idx_resources_user_id on public.resources(user_id);
create index if not exists idx_resources_type on public.resources(user_id, type);
create index if not exists idx_resources_category on public.resources(category_id);
create index if not exists idx_resources_created on public.resources(created_at desc);

create trigger trg_resources_updated_at
  before update on public.resources
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- 资源-标签 多对多关联
-- -------------------------------------------------------------
create table if not exists public.resource_tags (
  resource_id uuid not null references public.resources(id) on delete cascade,
  tag_id      uuid not null references public.tags(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (resource_id, tag_id)
);

create index if not exists idx_resource_tags_user on public.resource_tags(user_id);
create index if not exists idx_resource_tags_tag on public.resource_tags(tag_id);

-- -------------------------------------------------------------
-- 资源间关联（博客绑定视频/GitHub/RSS 等，也支持资源互链）
-- -------------------------------------------------------------
create table if not exists public.resource_links (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  from_resource uuid not null references public.resources(id) on delete cascade,
  to_resource   uuid not null references public.resources(id) on delete cascade,
  relation      text not null default 'related',   -- related / embeds / references
  created_at    timestamptz not null default now(),
  unique (from_resource, to_resource, relation)
);

comment on table public.resource_links is '资源关联关系：博客绑定各类资源';

create index if not exists idx_resource_links_from on public.resource_links(from_resource);
create index if not exists idx_resource_links_to on public.resource_links(to_resource);

-- -------------------------------------------------------------
-- 播放/阅读进度（视频、音乐、影视、RSS 已读）
-- -------------------------------------------------------------
create table if not exists public.user_progress (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  position    integer not null default 0,      -- 秒 或 阅读位置
  duration    integer,                          -- 总时长（秒），可为空
  progress    numeric(5,2) not null default 0,  -- 百分比 0-100
  completed   boolean not null default false,
  updated_at  timestamptz not null default now(),
  unique (user_id, resource_id)
);

create index if not exists idx_user_progress_user on public.user_progress(user_id);

create trigger trg_user_progress_updated_at
  before update on public.user_progress
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------
alter table public.resources enable row level security;
create policy "resources_select" on public.resources
  for select using (auth.uid() = user_id or public.is_admin() or is_public);
create policy "resources_insert_own" on public.resources
  for insert with check (auth.uid() = user_id);
create policy "resources_update_own" on public.resources
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "resources_delete_own" on public.resources
  for delete using (auth.uid() = user_id);

alter table public.resource_tags enable row level security;
create policy "resource_tags_all_own" on public.resource_tags
  for all using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id);

alter table public.resource_links enable row level security;
create policy "resource_links_all_own" on public.resource_links
  for all using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id);

alter table public.user_progress enable row level security;
create policy "user_progress_all_own" on public.user_progress
  for all using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id);
