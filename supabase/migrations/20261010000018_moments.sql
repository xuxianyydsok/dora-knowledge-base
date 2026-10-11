-- =============================================================
-- 迁移 0018：碎念表 moments / moment_assets
-- 背景：「此刻」页（六类状态卡）已按用户要求改版为「碎念」——朋友圈式的短动态流。
--       原来的 20261010000017_now_entries.sql 从未在线上执行（线上已应用到 0016），
--       且六类 kind 的结构不适合朋友圈形态，故本迁移用新结构取代，并删除旧迁移文件。
-- 说明：仅新增迁移，不修改历史迁移。
--
-- 形态：一条「碎念」= 一段正文 + 若干图片（可 0 张），按发布时间倒序排列。
-- 安全要点（默认私人）：is_public 默认 false，只有站长显式置为 true 才对外可见；
-- 访客读 /api/now 时路由必须**在查询层**显式叠加 is_public=eq.true——
-- Worker 用 service_role 直连 PostgREST，RLS 不会替它过滤（见 docs/public-access.md）。
-- =============================================================

create table if not exists public.moments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  content    text not null,
  is_public  boolean not null default false,   -- 默认私人，显式公开才对外可见
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.moments is '碎念：站长显式发布的短动态（朋友圈形态），不是行为追踪';
comment on column public.moments.content is '正文，必填';
comment on column public.moments.is_public is '是否对公开访客可见；**默认 false（私人）**，只有站长显式公开才对外可见';

-- 图片关联表：一条碎念可带多张图，二进制仍在 R2（assets），本表只存引用与顺序。
-- 同 owner 由**复合外键**在数据库层强制（与 gallery_items 同一套做法）：
-- 仅靠 RLS 的 auth.uid()=user_id 不够，authenticated 用户直连 Supabase 时，
-- 只要知道他人 asset UUID，就能插一条 user_id=自己、asset_id=他人的记录。
create table if not exists public.moment_assets (
  moment_id  uuid not null references public.moments(id) on delete cascade,
  asset_id   uuid not null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (moment_id, asset_id),
  constraint moment_assets_asset_same_owner
    foreign key (user_id, asset_id) references public.assets(user_id, id) on delete restrict
);

comment on table public.moment_assets is '碎念配图：引用 assets.id，二进制仍在 R2';
comment on constraint moment_assets_asset_same_owner on public.moment_assets is '数据库级同 owner 约束：不能把他人素材挂到自己的碎念上';

create index if not exists idx_moments_user_public
  on public.moments(user_id, is_public, created_at desc);
create index if not exists idx_moment_assets_moment
  on public.moment_assets(moment_id, sort_order);

create trigger trg_moments_updated_at
  before update on public.moments
  for each row execute function public.set_updated_at();

alter table public.moments enable row level security;
alter table public.moment_assets enable row level security;

-- 策略风格与 assets / gallery_items 一致：本人可读写，管理员可读全部
create policy "moments_select_own" on public.moments
  for select using (auth.uid() = user_id or public.is_admin());
create policy "moments_insert_own" on public.moments
  for insert with check (auth.uid() = user_id);
create policy "moments_update_own" on public.moments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "moments_delete_own" on public.moments
  for delete using (auth.uid() = user_id);

create policy "moment_assets_select_own" on public.moment_assets
  for select using (auth.uid() = user_id or public.is_admin());
create policy "moment_assets_insert_own" on public.moment_assets
  for insert with check (auth.uid() = user_id);
create policy "moment_assets_delete_own" on public.moment_assets
  for delete using (auth.uid() = user_id);

-- 管理员全权（风格同 assets_admin_all / gallery_items_admin_all）
create policy "moments_admin_all" on public.moments
  for all using (public.is_admin()) with check (public.is_admin());
create policy "moment_assets_admin_all" on public.moment_assets
  for all using (public.is_admin()) with check (public.is_admin());
