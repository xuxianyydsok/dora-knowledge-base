// 音乐「同一首歌」的判定口径（前端版）
//
// 与 backend/src/lib/musicIdentity.js **保持同一套规则**（后端做入库查重与列表去重，
// 前端在渲染层再兜一道，防止旧后端 / 缓存 / 历史脏数据让「最近添加」出现重复）。
// 前后端各存一份是本站既有约定（纯函数、零依赖，见 lib/mediaUrl.js 的同类做法），
// 由 backend/tests/run.mjs 的契约用例锁定两边规则一致。

/** 归一化用于比较的文本：忽略大小写、空白与常见分隔/括号符号。 */
export function normalizeMusicText(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[\s\-_.()（）[\]【】{}·'"“”‘’`~!！?？,，、/\\|]/g, '');
}

/** 一首歌的身份键：歌名 + 歌手；歌名为空时返回 null（无法判定，一律保留）。 */
export function musicIdentity({ title, artist } = {}) {
  const t = normalizeMusicText(title);
  if (!t) return null;
  return `${t}|${normalizeMusicText(artist)}`;
}

/** 列表去重：同一身份键只保留第一条（列表按 created_at 倒序，保留的是最新那条）。 */
export function dedupeMusicList(items) {
  const list = Array.isArray(items) ? items : [];
  const seen = new Set();
  const out = [];
  for (const m of list) {
    const key = musicIdentity({ title: m?.title, artist: m?.track?.artist ?? m?.artist });
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(m);
  }
  return out;
}
