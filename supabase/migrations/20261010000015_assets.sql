-- =============================================================
-- 迁移 0015：图片素材表 assets
-- 背景：博客封面/插图此前只存路径字符串，没有素材元数据与统一上传入口。
--       本迁移新增 assets 表，只存元数据（R2 object key、公开 URL、尺寸、sha256 等），
--       二进制一律放 Cloudflare R2，数据库不存图片字节。
-- 说明：仅新增迁移，不修改历史迁移。
-- =============================================================

create table if not exists public.assets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  object_key    text not null unique,          -- R2 object key，由服务端生成
  public_url    text not null,                 -- 同源绝对 URL（<origin>/api/assets/<id>）
  original_name text,                          -- 清洗后的原始文件名（仅展示/下载名）
  mime_type     text not null,
  size          bigint not null,
  width         integer,                        -- 解析不出可为 null
  height        integer,
  sha256        text,
  is_public     boolean not null default true,
  created_at    timestamptz not null default now()
);

comment on table public.assets is '图片素材元数据：只存元数据，二进制在 R2（object_key 指向 R2 对象）';
comment on column public.assets.object_key is 'R2 对象键，格式 assets/<user_id>/<YYYY>/<uuid>.<ext>，由服务端生成';
comment on column public.assets.public_url is '同源公开访问地址（<origin>/api/assets/<id>），博客封面/插图直接引用';
comment on column public.assets.original_name is '清洗后的原始文件名，仅作展示/下载名，不参与 object_key';
comment on column public.assets.sha256 is '内容 sha256（小写 hex），用于去重与 ETag 兜底';
comment on column public.assets.width is '图片宽度（像素）；AVIF 未解析，为 null';
comment on column public.assets.is_public is '是否允许匿名按 id 读取；默认 true';

-- 按用户 + 创建时间倒序列出素材
create index if not exists idx_assets_user_created
  on public.assets(user_id, created_at desc);

alter table public.assets enable row level security;

-- 策略风格与现有表一致：本人可读写，管理员可读全部（参考 user_preferences / user_profiles）
create policy "assets_select_own" on public.assets
  for select using (auth.uid() = user_id or public.is_admin());
create policy "assets_insert_own" on public.assets
  for insert with check (auth.uid() = user_id);
create policy "assets_update_own" on public.assets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "assets_delete_own" on public.assets
  for delete using (auth.uid() = user_id);

-- 管理员全权（风格同 init 的 user_profiles_admin_all）
create policy "assets_admin_all" on public.assets
  for all using (public.is_admin()) with check (public.is_admin());
