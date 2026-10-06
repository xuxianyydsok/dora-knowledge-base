-- =============================================================
-- 迁移 0005：博客-资源关联表
-- 背景：resource_links 的 from_resource 外键指向 resources(id)，
--       无法表达「博客(posts) ↔ 资源(resources)」的关联关系。
--       博客绑定视频/GitHub/音乐/影视/RSS 资源需要独立关联表。
-- =============================================================

create table if not exists public.post_resources (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  post_id     uuid not null references public.posts(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  relation    text not null default 'related'
              check (relation in ('related','embeds','references')),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (post_id, resource_id, relation)
);

comment on table public.post_resources is '博客与资源的关联关系（博客绑定视频/GitHub/RSS 等）';
comment on column public.post_resources.relation is '关联类型：related/embeds/references';

create index if not exists idx_post_resources_post on public.post_resources(post_id);
create index if not exists idx_post_resources_resource on public.post_resources(resource_id);
create index if not exists idx_post_resources_user on public.post_resources(user_id);

-- RLS：本人可读写自己的关联；管理员可读全部
alter table public.post_resources enable row level security;

create policy "post_resources_select_own" on public.post_resources
  for select using (auth.uid() = user_id or public.is_admin());
create policy "post_resources_insert_own" on public.post_resources
  for insert with check (auth.uid() = user_id);
create policy "post_resources_update_own" on public.post_resources
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "post_resources_delete_own" on public.post_resources
  for delete using (auth.uid() = user_id);
