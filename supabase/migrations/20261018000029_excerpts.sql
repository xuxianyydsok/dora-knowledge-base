-- =============================================================
-- 首页摘抄（2026-10-18）
--
-- 背景（用户原话）：
--   「摘抄那个卡片我要写很多的东西，就需要像 Dora Studio 那样的大卡片，
--     那样的高度和长度……摘抄那里的话需要在管理员那里管理一下，
--     就是我可以输入文本，就是我想把我想摘抄的内容在那个地方进行管理，
--     然后在前端的页面进行展示」
--
-- 设计：
--   · 一条摘抄 = 正文 + 可选出处 + 启用状态 + 排序；
--   · 首页只轮播 is_active=true 的条目，按 sort_order 升序；
--   · 访客只读公开启用的条目，写操作全部 requireAdmin；
--   · 不把摘抄塞进 site_settings 的 JSON：条目会长期增删，独立表才能稳定排序、
--     分页和做字段校验。
--
-- 幂等：全部 if not exists / drop ... if exists，可安全重跑。
-- =============================================================

create table if not exists public.excerpts (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  content     text        not null,
  source      text,
  sort_order  integer     not null default 0,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint excerpts_content_not_blank check (length(btrim(content)) > 0)
);

comment on table public.excerpts is '首页「摘抄」卡片内容，由站长在后台维护';
comment on column public.excerpts.content is '摘抄正文（纯文本，前端按段落显示）';
comment on column public.excerpts.source is '出处 / 作者 / 书名，可空';
comment on column public.excerpts.is_active is '是否参与首页轮播；停用但保留内容';

create index if not exists idx_excerpts_order
  on public.excerpts(user_id, is_active, sort_order, created_at);

drop trigger if exists trg_excerpts_updated_at on public.excerpts;
create trigger trg_excerpts_updated_at
  before update on public.excerpts
  for each row execute function public.set_updated_at();

alter table public.excerpts enable row level security;

drop policy if exists "excerpts_select_own" on public.excerpts;
create policy "excerpts_select_own" on public.excerpts
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "excerpts_insert_own" on public.excerpts;
create policy "excerpts_insert_own" on public.excerpts
  for insert with check (auth.uid() = user_id);

drop policy if exists "excerpts_update_own" on public.excerpts;
create policy "excerpts_update_own" on public.excerpts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "excerpts_delete_own" on public.excerpts;
create policy "excerpts_delete_own" on public.excerpts
  for delete using (auth.uid() = user_id);

drop policy if exists "excerpts_admin_all" on public.excerpts;
create policy "excerpts_admin_all" on public.excerpts
  for all using (public.is_admin()) with check (public.is_admin());
