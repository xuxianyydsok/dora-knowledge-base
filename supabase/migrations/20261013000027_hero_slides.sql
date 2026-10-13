-- =============================================================
-- 首页轮播（Hero）素材管理（2026-10-13）
--
-- 背景（用户原话）：
--   「首页它不是有那些图片吗？我想实现能够在管理员端上传图片，
--    或者说一些视频来进行轮播图的替换」
--   「存在数据库里吧，就新建一个数据库表」「可以复用图展的素材」
--   「视频的话要静音循环。当然可以开启个开关，可以静音也可以播放那个音乐」
--   「体积的话暂时不限制」
--
-- 设计：单独一张表，**只存引用**，不重复存文件。
--   来源有两种（source 字段区分）：
--     asset      —— 引用图展的静态图片（assets 表）
--     wallpaper  —— 引用图展的动态壁纸视频（wallpapers 表）
--   R2 对象仍归 assets / wallpapers 两张表管理，删素材时首页轮播的引用
--   由外键 on delete cascade 自动清理（不会留下指向空对象的死引用）。
--
-- 为什么不把文件字节直接存这张表：
--   图展已经有完整的「上传 → R2 → 元数据」流程与策展 UI，首页只是「挑几张出来展示」。
--   复制一份文件会带来「同一张图存两遍」「删了图展首页还挂着破图」这类问题。
--
-- 排序：sort_order 升序，相同则按创建时间。管理员可上下移动。
--
-- 注意：只新增迁移，不改历史迁移。
-- =============================================================

create table if not exists public.hero_slides (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,

  -- 素材来源：asset = 图展静态图片，wallpaper = 图展动态壁纸（视频）
  source       text not null check (source in ('asset', 'wallpaper')),

  -- 指向图展素材。两张表都用 on delete cascade：
  -- 站长在图展里删掉某张图/某段视频时，首页这条引用自动消失，
  -- 不会出现「首页挂着一条指向已删对象的死引用」。
  asset_id     uuid references public.assets(id) on delete cascade,
  wallpaper_id uuid references public.wallpapers(id) on delete cascade,

  -- 图注（画面右下角那行中文说明，用户不喜欢洋文标签）
  label        text,

  -- 排序：越小越靠前
  sort_order   integer not null default 0,

  -- 是否启用（下架但保留配置，不用删了再加回来）
  is_active    boolean not null default true,

  -- 视频是否静音。用户要求「视频要静音循环，但可以开关」——
  -- true = 静音（默认，也是浏览器的自动播放前提）；
  -- false = 播放声音（注意：浏览器会拦截带声音的自动播放，
  --         此时首页视频不会自动播，需要用户点一下）。
  muted        boolean not null default true,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- 来源与引用必须一致：asset 来源必须有 asset_id，wallpaper 来源必须有 wallpaper_id
  constraint hero_slides_ref_check check (
    (source = 'asset' and asset_id is not null and wallpaper_id is null) or
    (source = 'wallpaper' and wallpaper_id is not null and asset_id is null)
  )
);

comment on table public.hero_slides is
  '首页轮播素材：只存对图展素材（assets / wallpapers）的引用，不重复存文件';

create index if not exists idx_hero_slides_order
  on public.hero_slides(user_id, is_active, sort_order);

create trigger trg_hero_slides_updated_at
  before update on public.hero_slides
  for each row execute function public.set_updated_at();
