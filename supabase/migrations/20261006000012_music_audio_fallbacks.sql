-- =============================================================
-- 迁移 0012：音乐备用播放地址
-- 背景：音乐主源 Audius 由多个发现节点提供服务，单个节点可能把
--       某条音轨的 CID 拉黑（返回 403）。为提升播放成功率，
--       同一音轨保存多个节点地址，前端在主地址失败时依次尝试。
-- 变更：music_tracks 新增 audio_fallbacks（字符串数组）
-- 说明：仅保存播放地址字符串，音频文件不入库，后端不转发音频流。
-- =============================================================

alter table public.music_tracks
  add column if not exists audio_fallbacks jsonb;

comment on column public.music_tracks.audio_fallbacks is '备用播放地址数组（多音源节点），主地址失败时前端依次尝试';
