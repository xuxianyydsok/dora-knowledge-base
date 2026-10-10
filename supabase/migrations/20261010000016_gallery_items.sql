-- =============================================================
-- 迁移 0016：图片展览表 gallery_items
-- 背景：assets 只是素材仓库；展览需要「策展」元数据（标题/说明/拍摄日期/排序/公开状态）。
--       本迁移只建关联表，不存二进制，不复制 assets 字段。
-- 说明：仅新增迁移，不修改历史迁移（本文件尚未在线上应用，故可继续修改）。
--
-- 安全要点（数据库级）：gallery_items 与 assets 必须**同 owner**。
-- 仅靠 RLS 的 auth.uid()=user_id 不够：authenticated 用户可直连 Supabase，
-- 只要知道他人的 asset UUID，就能插入一条 user_id=自己、asset_id=他人的记录。
-- 因此给 assets 加 (user_id,id) 唯一约束，gallery_items 用**复合外键**
-- (user_id,asset_id) -> assets(user_id,id) 在数据库层强制同 owner。
-- =============================================================

-- 复合外键需要被引用列有唯一约束；assets.id 已是主键，但复合引用要求 (user_id,id) 唯一。
-- 用 DO 块做幂等：重复执行迁移不会因约束已存在而报错。
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'assets_user_id_id_key'
      and conrelid = 'public.assets'::regclass
  ) then
    alter table public.assets
      add constraint assets_user_id_id_key unique (user_id, id);
  end if;
end $$;

create table if not exists public.gallery_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  asset_id    uuid not null,
  title       text,
  description text,
  captured_at date,                                    -- 拍摄/创作日期，可空
  sort_order  integer not null default 0,
  is_public   boolean not null default false,          -- 默认私人，显式公开才对外可见
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, asset_id),                          -- 同一素材只能加入展览一次
  -- 复合外键：强制 asset 与 gallery 同 owner（数据库层，不依赖应用代码）
  constraint gallery_items_asset_same_owner
    foreign key (user_id, asset_id) references public.assets(user_id, id) on delete restrict
);

comment on table public.gallery_items is '图片展览条目：策展元数据，引用 assets.id，二进制仍在 R2';
comment on column public.gallery_items.captured_at is '拍摄/创作日期，仅用于展示与排序语义';
comment on column public.gallery_items.is_public is '是否对公开访客可见；公开时要求关联 assets.is_public=true';
comment on column public.gallery_items.asset_id is '引用 assets.id；与 user_id 组成复合外键指向 assets(user_id,id)，强制同 owner，on delete restrict';
comment on constraint gallery_items_asset_same_owner on public.gallery_items is '数据库级同 owner 约束：不能把他人素材加进自己的展览';

create index if not exists idx_gallery_items_user_public
  on public.gallery_items(user_id, is_public, sort_order desc, captured_at desc nulls last);
create index if not exists idx_gallery_items_asset
  on public.gallery_items(asset_id);

create trigger trg_gallery_items_updated_at
  before update on public.gallery_items
  for each row execute function public.set_updated_at();

alter table public.gallery_items enable row level security;

-- 策略风格与现有表一致：本人可读写，管理员可读全部（参考 assets / user_preferences）
create policy "gallery_items_select_own" on public.gallery_items
  for select using (auth.uid() = user_id or public.is_admin());
create policy "gallery_items_insert_own" on public.gallery_items
  for insert with check (auth.uid() = user_id);
create policy "gallery_items_update_own" on public.gallery_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gallery_items_delete_own" on public.gallery_items
  for delete using (auth.uid() = user_id);

-- 管理员全权（风格同 assets_admin_all）
create policy "gallery_items_admin_all" on public.gallery_items
  for all using (public.is_admin()) with check (public.is_admin());
