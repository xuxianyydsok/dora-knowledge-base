-- =============================================================
-- 迁移 0019：碎念文件附件 files / moment_files
-- 背景：用户要求碎念支持「朋友圈式」发布 —— 除文字与图片外，还能附 PDF / Word 等文档。
--       图片继续走 assets（已有表，带宽高元数据）；文档另立 files 表，避免污染素材库
--       （图片展 / 博客封面只认 assets，混入 PDF 会破坏缩略图）。
-- 说明：仅新增迁移，不修改历史迁移。
--
-- 安全要点（与 assets / moments 同一套）：
--   1) 二进制始终在 R2，本表只存元数据；object_key 由服务端生成，不含用户输入；
--   2) 同 owner 由**复合外键**在数据库层强制，防止把他人文件挂到自己的碎念上；
--   3) 默认 is_public=false：文档可能含私人内容，只有站长显式公开才对外可见。
-- =============================================================

create table if not exists public.files (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  object_key    text not null,
  public_url    text not null,
  original_name text not null,
  mime_type     text not null,
  size          bigint not null,
  sha256        text,
  is_public     boolean not null default false,
  created_at    timestamptz not null default now(),
  -- 复合唯一键：供 moment_files 的复合外键引用，保证「文件与碎念同属一人」
  constraint files_user_id_id_key unique (user_id, id)
);

comment on table public.files is '文档附件（PDF / Word 等）：碎念用，二进制在 R2，本表只存元数据';
comment on column public.files.is_public is '是否允许公开下载；默认 false（私人）';

create index if not exists idx_files_user_created on public.files(user_id, created_at desc);

-- 碎念 ↔ 文件 关联表（多对多，带顺序）
create table if not exists public.moment_files (
  moment_id  uuid not null references public.moments(id) on delete cascade,
  file_id    uuid not null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (moment_id, file_id),
  constraint moment_files_file_same_owner
    foreign key (user_id, file_id) references public.files(user_id, id) on delete restrict
);

comment on table public.moment_files is '碎念文件附件：引用 files.id，二进制仍在 R2';
comment on constraint moment_files_file_same_owner on public.moment_files is '数据库级同 owner 约束：不能把他人文件挂到自己的碎念上';

create index if not exists idx_moment_files_moment on public.moment_files(moment_id, sort_order);

alter table public.files enable row level security;
alter table public.moment_files enable row level security;

create policy "files_select_own" on public.files
  for select using (auth.uid() = user_id or public.is_admin());
create policy "files_insert_own" on public.files
  for insert with check (auth.uid() = user_id);
create policy "files_update_own" on public.files
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "files_delete_own" on public.files
  for delete using (auth.uid() = user_id);
create policy "files_admin_all" on public.files
  for all using (public.is_admin()) with check (public.is_admin());

create policy "moment_files_select_own" on public.moment_files
  for select using (auth.uid() = user_id or public.is_admin());
create policy "moment_files_insert_own" on public.moment_files
  for insert with check (auth.uid() = user_id);
create policy "moment_files_delete_own" on public.moment_files
  for delete using (auth.uid() = user_id);
create policy "moment_files_admin_all" on public.moment_files
  for all using (public.is_admin()) with check (public.is_admin());
