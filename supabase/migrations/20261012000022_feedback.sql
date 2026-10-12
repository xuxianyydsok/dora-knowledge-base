-- =============================================================
-- 迁移 0022：共创反馈表 feedback
-- 背景：「共创」页（/coop）邀请访客与登录用户对站点提意见 / 报缺陷 / 要功能。
--       这是一张**公开可写、仅站长可读**的表，与站内其它「本人可读写」的表不同。
-- 说明：仅新增迁移，不修改历史迁移。
--
-- 形态：一条反馈 = 分类 + 正文 + 可选的署名 / 联系方式 + 提交页面 + 处理状态。
-- 安全要点：
--   1. user_id **可空** —— 匿名提交时为空，实名且已登录时写登录用户 id；
--      访客（未登录）一律匿名，绝不落 user_id。
--   2. 任何人都能 insert（匿名反馈是公开表单）；select / update / delete 只有管理员
--      （public.is_admin()）能过 RLS。Worker 用 service_role 直连会绕过 RLS，
--      因此「管理员才能看」这件事在路由层用 requireAdmin 再挡一道。
--   3. 响应字段走白名单，**绝不返回 user_id**；匿名条目的昵称统一回 '匿名读者'
--      （见 backend/src/routes/feedback.js#shape 与 docs/coop.md）。
-- =============================================================

create table if not exists public.feedback (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,  -- 匿名时为空
  is_anonymous boolean not null default true,
  display_name text,            -- 实名时填的昵称 / 姓名；匿名时为空
  contact      text,            -- 可选联系方式（邮箱 / 微信等），最长 200
  category     text not null default 'other'
    check (category in ('bug','improve','feature','other')),       -- 缺陷 / 改进 / 新功能 / 其它
  content      text not null,   -- 反馈正文，1~4000 字（长度由应用层校验）
  page_url     text,            -- 提交时所在页面，最长 500，便于定位问题
  user_agent   text,            -- 提交者 UA，最长 500
  status       text not null default 'new'
    check (status in ('new','read','done')),                       -- 待处理 / 已读 / 已处理
  admin_note   text,            -- 站长备注
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.feedback is '共创反馈：访客与登录用户对站点提的意见 / 缺陷 / 功能需求，仅站长可读';
comment on column public.feedback.user_id is '实名且已登录时的提交者 id；匿名提交恒为空（不泄露身份）';
comment on column public.feedback.is_anonymous is '是否匿名提交；匿名条目的 display_name 对外统一回「匿名读者」';
comment on column public.feedback.display_name is '实名提交时的称呼；匿名提交时为空';
comment on column public.feedback.category is '分类：bug 缺陷 / improve 改进 / feature 新功能 / other 其它';
comment on column public.feedback.status is '处理状态：new 待处理 / read 已读 / done 已处理';

create index if not exists idx_feedback_status_created
  on public.feedback(status, created_at desc);
create index if not exists idx_feedback_created
  on public.feedback(created_at desc);

create trigger trg_feedback_updated_at
  before update on public.feedback
  for each row execute function public.set_updated_at();

alter table public.feedback enable row level security;

-- 公开表单：任何人都能提交（含未登录访客，with check (true)）
create policy "feedback_insert_anyone" on public.feedback
  for insert with check (true);

-- 只有管理员能看 / 改 / 删（风格与其它表的 is_admin() 用法一致）
create policy "feedback_select_admin" on public.feedback
  for select using (public.is_admin());
create policy "feedback_update_admin" on public.feedback
  for update using (public.is_admin()) with check (public.is_admin());
create policy "feedback_delete_admin" on public.feedback
  for delete using (public.is_admin());
