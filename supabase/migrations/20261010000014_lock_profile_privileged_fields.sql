-- =============================================================
-- 迁移 0014：锁定 user_profiles 的特权字段
-- 背景：RLS 的 user_profiles_update_own 只限制「能改哪些行」（auth.uid() = id），
--       并不限制「能改哪些列」。普通登录用户因此可以直接把 role 改成 admin、
--       把 plan 改成付费套餐、或把 is_disabled 改回 false，属于自提权漏洞。
-- 处理：撤销 authenticated 对 user_profiles 的表级 update，再按列重新授权，
--       只放开 username / display_name / avatar_path 三个安全字段。
-- 说明：仅新增迁移，不修改历史迁移；admin 走 is_admin() 策略，不受影响。
-- =============================================================

revoke update on table public.user_profiles from authenticated;
grant update (username, display_name, avatar_path) on table public.user_profiles to authenticated;

-- 新用户档案由 security definer 触发器 handle_new_user() 创建，
-- 客户端不应直接插入档案（否则可伪造 role/plan 等字段）。
revoke insert on table public.user_profiles from authenticated;

comment on table public.user_profiles is
  '用户档案：role/plan/is_disabled 等特权字段仅服务端（service_role）与触发器可写；authenticated 仅可改 username/display_name/avatar_path';
