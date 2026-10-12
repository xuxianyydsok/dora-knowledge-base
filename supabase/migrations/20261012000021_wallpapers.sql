-- =============================================================
-- 迁移 0021：动态壁纸表 wallpapers
-- 背景：图展（/gallery）从「只有静态图片」扩展为「静态图片 + 动态壁纸」两区。
--       动态壁纸是短视频（MP4 / WebM），由站长上传，访客在页面里静音循环播放。
--       用户明确要求「R2 里动态壁纸与静态壁纸分开」，因此：
--         · 图片素材 → assets 表 + R2 前缀 assets/
--         · 动态壁纸 → 本表    + R2 前缀 wallpapers/
--       两张表、两个前缀，互不混淆（删一张表不会牵连另一边的数据）。
-- 说明：仅新增迁移，不修改历史迁移。
--
-- 二进制一律放 R2（object_key 指向），本表只存元数据 + 同源访问 URL。
-- 安全要点：默认私人（is_public=false），只有站长显式公开才对外可见；
--   访客读 /api/wallpapers 时路由必须在**查询层**显式叠加 is_public=eq.true ——
--   Worker 用 service_role 直连 PostgREST，RLS 不会替它过滤（见 docs/public-access.md）。
-- =============================================================

create table if not exists public.wallpapers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  object_key    text not null unique,          -- R2 key：wallpapers/<user_id>/<YYYY>/<uuid>.<ext>
  public_url    text not null,                 -- <origin>/api/wallpapers/<id>/file
  original_name text,                          -- 清洗后的原始文件名（仅展示 / 下载名）
  mime_type     text not null,                 -- video/mp4 | video/webm
  format        text not null,                 -- mp4 | webm
  size          bigint not null,
  duration      numeric,                       -- 时长（秒），解析不出为 null
  width         integer,                       -- 画面宽（px），解析不出为 null
  height        integer,                       -- 画面高（px）
  title         text,
  description   text,
  sort_order    integer not null default 0,
  is_public     boolean not null default false, -- 默认私人，显式公开才对外可见
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint wallpapers_format_check check (format in ('mp4', 'webm'))
);

comment on table public.wallpapers is '动态壁纸元数据：短视频（MP4/WebM），二进制在 R2 的 wallpapers/ 前缀下，与图片素材（assets/）分开存';
comment on column public.wallpapers.object_key is 'R2 对象键，格式 wallpapers/<user_id>/<YYYY>/<uuid>.<ext>，由服务端生成';
comment on column public.wallpapers.public_url is '同源公开访问地址（<origin>/api/wallpapers/<id>/file）';
comment on column public.wallpapers.duration is '时长（秒，numeric）；从 MP4 mvhd box 解析，解析不出为 null';
comment on column public.wallpapers.width is '画面宽（px）；从 MP4 tkhd box 解析，解析不出为 null';
comment on column public.wallpapers.is_public is '是否对公开访客可见；**默认 false（私人）**，只有站长显式公开才对外可见';

-- 按用户 + 排序 / 创建时间列出
create index if not exists idx_wallpapers_user_created
  on public.wallpapers(user_id, sort_order desc, created_at desc);
create index if not exists idx_wallpapers_user_public
  on public.wallpapers(user_id, is_public);

create trigger trg_wallpapers_updated_at
  before update on public.wallpapers
  for each row execute function public.set_updated_at();

alter table public.wallpapers enable row level security;

-- 策略风格与 assets / books / gallery_items 一致：本人可读写，管理员可读全部
create policy "wallpapers_select_own" on public.wallpapers
  for select using (auth.uid() = user_id or public.is_admin());
create policy "wallpapers_insert_own" on public.wallpapers
  for insert with check (auth.uid() = user_id);
create policy "wallpapers_update_own" on public.wallpapers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "wallpapers_delete_own" on public.wallpapers
  for delete using (auth.uid() = user_id);

create policy "wallpapers_admin_all" on public.wallpapers
  for all using (public.is_admin()) with check (public.is_admin());
