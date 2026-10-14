-- ============================================================================
-- Notion 博客迁移：独立分区表 notion_posts
-- 文件：supabase/migrations/20261014000028_notion_posts.sql
--
-- 背景（2026-10-14，用户要求）：
--   现有博客是早年从 Halo 导入的（posts 表，315 行）。
--   本轮要把 Notion（NotionNext + Vercel）那批文章迁进来，要求：
--   「两个博客要隔离开，相当于一个是 HALO 的博客，一个是 Notion 的博客。
--     只需要让它们做一定的隔离，但是排版可以沿用之前的。」
--
-- 为什么用**独立表**而不是给 posts 加 source 列：
--   · 物理隔离最彻底，绝无可能污染现有 315 篇 Halo 文章；
--   · Notion 侧有 10 个特有字段（notion_category / parent_slug / is_blank …），
--     塞进 posts 会让那张表长出大量语义只对一半数据成立的列；
--   · posts 的既有 RLS / 约束 / 前端接口一行都不用改，回归面最小。
--
-- 幂等：全部 if not exists / 先判存在再建，可重复执行。
-- ============================================================================

-- -------------------------------------------------------------
-- 1. 建表
-- -------------------------------------------------------------
create table if not exists public.notion_posts (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,

  -- 正文与基本展示字段（与 posts 同名同义，便于前端复用同一套排版组件）
  title           text        not null,
  slug            text        not null,
  content         text        not null default '',
  excerpt         text,
  cover_path      text,
  status          text        not null default 'published',
  is_public       boolean     not null default true,
  published_at    timestamptz,

  -- Notion 专属字段
  notion_category text,                                  -- Notion 原始分类（如 AI / 学海无涯）
  notion_icon     text,                                  -- 页面 emoji 图标
  notion_summary  text,                                  -- 摘要文本（含"暂不提供阅读"等提示）
  tags            text[]      not null default '{}',     -- 内联数组，不另建关联表（隔离性优先）
  source_ref      text,                                  -- Notion page id，幂等导入键
  parent_slug     text,                                  -- 子页面所属父文章
  is_subpage      boolean     not null default false,
  sort_order      integer     not null default 0,
  is_locked       boolean     not null default false,    -- 密码锁（本轮全公开，见下）
  password_hash   text,                                  -- 禁止存明文
  is_blank        boolean     not null default false,    -- Notion 空白页 → 占位卡片

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint notion_posts_status_check check (status in ('draft', 'published')),
  constraint notion_posts_user_slug_key unique (user_id, slug)
);

comment on table  public.notion_posts                 is 'Notion 博客迁移分区（与 posts 的 Halo 来源博客隔离，2026-10-14）';
comment on column public.notion_posts.notion_category is 'Notion 原始分类，前端「Notion 博客」按它自动分组';
comment on column public.notion_posts.tags            is '内联标签数组（未用关联表，换取与 posts 的完全隔离）';
comment on column public.notion_posts.source_ref      is 'Notion page id，用于幂等重导入';
comment on column public.notion_posts.parent_slug     is '子页面所属父文章 slug（仅 is_subpage=true 时有值）';
comment on column public.notion_posts.is_locked       is '是否启用密码访问（本轮迁移的 42 篇已按要求全公开，字段留待后续「博客密码锁」功能）';
comment on column public.notion_posts.password_hash   is '访问密码哈希，禁止存储明文（预留）';
comment on column public.notion_posts.is_blank        is 'Notion 空白页（无正文），前端显示为占位卡片';

-- -------------------------------------------------------------
-- 2. 索引
-- -------------------------------------------------------------
-- 幂等导入键：同一 Notion page 只允许一条
create unique index if not exists uq_notion_posts_source_ref
  on public.notion_posts (user_id, source_ref)
  where source_ref is not null;

-- 列表页：按状态 + 发布时间倒序
create index if not exists idx_notion_posts_status
  on public.notion_posts (user_id, status, published_at desc nulls last);

-- 分区内按 Notion 分类分组 / 筛选
create index if not exists idx_notion_posts_category
  on public.notion_posts (notion_category);

-- 子页面按父文章聚合
create index if not exists idx_notion_posts_parent
  on public.notion_posts (user_id, parent_slug)
  where is_subpage = true;

-- -------------------------------------------------------------
-- 3. RLS（沿用 posts 的行级策略写法）
-- -------------------------------------------------------------
alter table public.notion_posts enable row level security;

drop policy if exists notion_posts_select on public.notion_posts;
create policy notion_posts_select on public.notion_posts
  for select to public
  using (auth.uid() = user_id or is_admin() or (is_public and status = 'published'));

drop policy if exists notion_posts_insert_own on public.notion_posts;
create policy notion_posts_insert_own on public.notion_posts
  for insert to public
  with check (auth.uid() = user_id);

drop policy if exists notion_posts_update_own on public.notion_posts;
create policy notion_posts_update_own on public.notion_posts
  for update to public
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists notion_posts_delete_own on public.notion_posts;
create policy notion_posts_delete_own on public.notion_posts
  for delete to public
  using (auth.uid() = user_id);

-- -------------------------------------------------------------
-- 4. 说明：与 posts 的关系
-- -------------------------------------------------------------
-- 两表**无外键、无视图、无共享序列**，完全独立。
-- 前端「Notion 博客」走独立路由 /notion + 独立接口 /api/notion-posts，
-- 只在**排版组件**层面复用博客那套（Card / GalleryView / TimelineView / 阅读页），
-- 数据层不共用，避免任何一方的改动影响另一方。
-- 迁移脚本见：scripts/notion-blog-import/deliverables/
