-- =============================================================
-- 迁移 0020：图书表 books（电子书书架）
-- 背景：图书功能 2026-10-11 曾因单本过大（最大 772MB）整体下线；
--       本轮重新上线：**不设业务上的单本大小上限**（大文件走 R2 分片上传，
--       见 backend/src/lib/bookType.js 的 MAX_MULTIPART_BOOK_BYTES），
--       并新增「上传时自动提取封面」；前端书架只加载封面小图，正文按需 range 读取。
-- 说明：仅新增迁移，不修改历史迁移。
--
-- 二进制一律放 R2：object_key = 正文，cover_key = 上传时自动提取的封面。
-- 本表只存元数据 + 同源访问 URL。
--
-- 安全要点（与 assets / gallery_items 同一套）：
--   is_public 默认 true（书架是给人看的），但正文 / 封面接口仍只放行
--   is_public=true 或本人，私人书即便拿到 UUID 也读不到。
-- =============================================================

create table if not exists public.books (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  object_key    text not null unique,          -- 正文 R2 key，服务端生成
  cover_key     text unique,                   -- 封面 R2 key，可为空（没抽到封面）
  public_url    text not null,                 -- <origin>/api/books/<id>/file
  cover_url     text,                          -- <origin>/api/books/<id>/cover
  original_name text,                          -- 清洗后的原始文件名（仅展示 / 下载名）
  mime_type     text not null,
  format        text not null,                 -- pdf | epub | mobi | azw3
  size          bigint not null,
  etag          text,                          -- R2 httpEtag，作 Range 响应兜底
  title         text,                          -- 从书里解析出的书名（可被 PATCH 覆盖）
  author        text,                          -- 从书里解析出的作者
  description   text,                          -- 站长手写简介
  sort_order    integer not null default 0,
  is_public     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint books_format_check check (format in ('pdf', 'epub', 'mobi', 'azw3'))
);

comment on table public.books is '电子书书架元数据：只存元数据，正文与封面在 R2';
comment on column public.books.object_key is '正文 R2 对象键，格式 books/<user_id>/<YYYY>/<uuid>.<ext>，服务端生成';
comment on column public.books.cover_key is '封面 R2 对象键（上传时自动提取）；未提取到封面时为空';
comment on column public.books.format is '电子书格式：pdf / epub / mobi / azw3（上传时按魔数嗅探，不信任扩展名）';
comment on column public.books.size is '正文字节数；单本不设业务上限（大文件走 R2 分片上传），仅保留保护性上限';
comment on column public.books.title is '书名：优先取书内元数据，缺失时用文件名去扩展名；站长可 PATCH 覆盖';
comment on column public.books.is_public is '是否对访客可见；默认 true（书架面向读者）';

-- 按用户 + 排序 / 创建时间列出书架
create index if not exists idx_books_user_created
  on public.books(user_id, sort_order desc, created_at desc);
create index if not exists idx_books_user_format
  on public.books(user_id, format);

create trigger trg_books_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

alter table public.books enable row level security;

-- 策略风格与 assets / gallery_items 一致：本人可读写，管理员可读全部
create policy "books_select_own" on public.books
  for select using (auth.uid() = user_id or public.is_admin());
create policy "books_insert_own" on public.books
  for insert with check (auth.uid() = user_id);
create policy "books_update_own" on public.books
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "books_delete_own" on public.books
  for delete using (auth.uid() = user_id);

-- 管理员全权（风格同 assets_admin_all / gallery_items_admin_all）
create policy "books_admin_all" on public.books
  for all using (public.is_admin()) with check (public.is_admin());
