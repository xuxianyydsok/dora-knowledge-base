// 音乐「同一首歌」的判定口径（纯函数，零依赖，可离线单测）
//
// 2026-10-12 用户反馈：管理端「最近添加」里同一首歌会重复出现。
// 根因是「收藏」是纯插入（POST /api/music），同一首歌点两次就有两条资源记录，
// 列表只按 created_at 排序、没有任何去重，于是看起来像「一首歌加了两遍」。
//
// 这里给出唯一的口径，供三处复用：
//   1) createMusic  —— 入库前查重，已存在就直接返回已有条目，不再新建；
//   2) listMusic    —— 历史脏数据（同一首歌已经存了两条）在列表层合并；
//   3) 前端「最近添加」—— 再兜一道，防止旧后端 / 缓存导致重复。
//
// 为什么按「歌名 + 歌手」而不是按 platform+external_id：
//   用户的心智是「这首歌我已经收过了」，而同一首歌从网易云、酷狗、酷我搜到，
//   platform / external_id 完全不同；只按音源身份去重，跨源重复照样出现。

/** 归一化用于比较的文本：忽略大小写、空白与常见分隔/括号符号。 */
export function normalizeMusicText(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[\s\-_.()（）[\]【】{}·'"“”‘’`~!！?？,，、/\\|]/g, '');
}

/**
 * 一首歌的身份键。歌名 + 歌手都为空时返回 null（这种条目无法判定，一律保留）。
 * 歌手为空时退化成「只比歌名」——同名不同歌手的情况很少，且比「全部重复」更符合直觉。
 */
export function musicIdentity({ title, artist } = {}) {
  const t = normalizeMusicText(title);
  if (!t) return null;
  return `${t}|${normalizeMusicText(artist)}`;
}

/**
 * 列表去重：同一身份键只保留第一条（列表按 created_at 倒序，因此保留的是最新那条）。
 * 传入的 items 元素形如 `{ id, title, track: { artist } }`。
 */
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

/** 在已查到的同用户曲目里找同歌同歌手的条目；找不到返回 null。 */
export function findDuplicateMusic(rows, tracks, { title, artist } = {}) {
  const key = musicIdentity({ title, artist });
  if (!key) return null;
  for (const row of Array.isArray(rows) ? rows : []) {
    const t = tracks?.[row.id] || {};
    if (musicIdentity({ title: row.title, artist: t.artist }) === key) return row;
  }
  return null;
}
