-- =============================================================
-- 迁移 0025：彻底移除 RSS 模块（2026-10-13）
-- 背景：RSS 阅读器 2026-10-12 按「站长订阅一次、访客只读」的方案恢复过（迁移 0023），
--       但 2026-10-13 用户决定放弃站内 RSS，改为自己用 Folo 客户端读
--       （原话：「直接把RSS的那个项目给砍了。太麻烦了，直接取消，我直接还是自己用FOLO算了」）。
--       因此后端 lib/rss*.js、routes/rss.js、前端 Rss.jsx 等已整体删除，
--       这里把数据库里对应的表与数据一并清掉，不留孤儿。
--
-- 说明：只新增迁移，不改历史迁移（0014 首次删除、0023 恢复都保留原样）。
--       本迁移与 0014 同样是「不保留数据」的删除 —— 用户已明确不再需要站内 RSS。
-- =============================================================

drop table if exists public.rss_articles cascade;
drop table if exists public.rss_feeds cascade;

-- RSS 新文章通知（notify.js 曾用 type='rss_new'）
delete from public.notifications where type = 'rss_new';

-- resources 里若残留 rss_article 类型条目，一并清掉；
-- 并把 type 约束收敛回实际使用的类型集合（与 0014 口径一致）。
delete from public.resources where type = 'rss_article';

alter table public.resources drop constraint if exists resources_type_check;
alter table public.resources
  add constraint resources_type_check check (type in ('video','github','music','movie'));

comment on table public.resources is '统一资源表，type 区分视频/GitHub/音乐/影视';
