-- =============================================================
-- 迁移 0007：博客-标签关联表
-- 背景：resource_tags.resource_id 外键指向 resources(id)，
--       无法为博客(posts)建立标签关联。Phase3 关联图谱需要
--       「博客 ↔ 标签」边，故新增独立关联表。
-- =============================================================

create table if not exists public.post_tags (
  post_id    uuid not null references public.posts(id) on delete cascade,
  tag_id     uuid not null references public.tags(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, tag_id)
);

comment on table public.post_tags is '博客与标签的多对多关联';

create index if not exists idx_post_tags_post on public.post_tags(post_id);
create index if not exists idx_post_tags_tag on public.post_tags(tag_id);
create index if not exists idx_post_tags_user on public.post_tags(user_id);

alter table public.post_tags enable row level security;

create policy "post_tags_select_own" on public.post_tags
  for select using (auth.uid() = user_id or public.is_admin());
create policy "post_tags_insert_own" on public.post_tags
  for insert with check (auth.uid() = user_id);
create policy "post_tags_delete_own" on public.post_tags
  for delete using (auth.uid() = user_id);
