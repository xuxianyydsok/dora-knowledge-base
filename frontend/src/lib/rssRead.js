// RSS 阅读状态（本机）
//
// 为什么访客的「已读」不存后端：
//   本站的 RSS 是「站长订阅一次、所有人来读」的方案 A（2026-10-12）。
//   如果访客的已读也写进 rss_articles.is_read，全站访客会互相覆盖彼此的阅读进度，
//   而且访客本来就没有写权限。因此：
//     · 站长（isAdmin）→ 已读存数据库，多设备同步；
//     · 访客与普通用户 → 已读只存本机 localStorage，换个浏览器就重置（可接受）。
//   这与 lib/searchHistory.js 是同一套思路：纯本机习惯，不值得多开一张表。

const KEY = 'kb-rss-read';
// 上限：只记最近 3000 条，避免长期使用后 localStorage 无限膨胀。
const MAX = 3000;

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // 隐私模式 / 配额满：记不住不影响阅读，静默忽略
  }
}

export function isLocallyRead(articleId) {
  return readAll().includes(String(articleId));
}

export function markLocallyRead(articleId, read = true) {
  const id = String(articleId);
  const list = readAll().filter((s) => s !== id);
  if (read) list.unshift(id);
  write(list);
  return list;
}

// 批量标记（「全部已读」用）
export function markManyLocallyRead(ids, read = true) {
  const set = new Set(readAll());
  for (const id of ids) {
    if (read) set.add(String(id));
    else set.delete(String(id));
  }
  write([...set]);
}

export function localReadCount() {
  return readAll().length;
}

export function clearLocalRead() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 同上
  }
}
