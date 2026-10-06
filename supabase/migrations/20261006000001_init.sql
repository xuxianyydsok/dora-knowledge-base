-- =============================================================
-- 迁移 0001：扩展、通用函数、用户档案、站点设置
-- 说明：本文件创建全局基础对象，供后续所有迁移复用
-- =============================================================

-- 启用需要的扩展
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- -------------------------------------------------------------
-- 通用触发器函数：自动维护 updated_at
-- -------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -------------------------------------------------------------
-- 用户档案表 user_profiles
-- 关联 supabase.auth.users；存放角色、会员套餐（预留）、禁用状态
-- -------------------------------------------------------------
create table if not exists public.user_profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique,
  display_name    text,
  avatar_path     text,                                   -- R2 文件路径，不存二进制
  role            text not null default 'user' check (role in ('user','admin')),
  plan            text not null default 'free',           -- 会员套餐，预留付费功能
  plan_expires_at timestamptz,                            -- 会员到期时间，预留
  is_disabled     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table  public.user_profiles is '用户档案：角色/会员套餐/禁用状态，关联 auth.users';
comment on column public.user_profiles.plan is '会员套餐字段，现阶段仅预留，不实现付费逻辑';

create trigger trg_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- 新用户注册时自动建档
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, username, display_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 管理员判定辅助函数（供 RLS 策略复用）
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- -------------------------------------------------------------
-- 站点设置表 site_settings（如：是否开放公开注册）
-- -------------------------------------------------------------
create table if not exists public.site_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  description text,
  updated_at  timestamptz not null default now()
);

comment on table public.site_settings is '站点级配置键值表（注册开关等）';

create trigger trg_site_settings_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

insert into public.site_settings (key, value, description)
values ('allow_public_registration', 'true'::jsonb, '是否开放公开注册')
on conflict (key) do nothing;

-- RLS：用户仅可读写自己的档案；管理员可读全部
alter table public.user_profiles enable row level security;

create policy "user_profiles_select_own" on public.user_profiles
  for select using (auth.uid() = id or public.is_admin());
create policy "user_profiles_update_own" on public.user_profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "user_profiles_insert_own" on public.user_profiles
  for insert with check (auth.uid() = id);
create policy "user_profiles_admin_all" on public.user_profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- 站点设置：所有人可读，仅管理员可写
alter table public.site_settings enable row level security;
create policy "site_settings_select_all" on public.site_settings
  for select using (true);
create policy "site_settings_admin_write" on public.site_settings
  for all using (public.is_admin()) with check (public.is_admin());
