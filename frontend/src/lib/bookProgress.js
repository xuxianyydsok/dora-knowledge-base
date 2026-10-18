// 图书阅读进度（EPUB / PDF 共用）。
//
// 为什么单独抽出来：
// - /books 与首页书架共用同一个阅读器；
// - EPUB 原来每次从第 1 章开始，PDF 只记页码，两个格式的行为不一致；
// - 这里统一成「按书 id 存一条进度」，阅读器打开时恢复，翻章 / 翻页 / 滚动时更新。
//
// 只存本机 localStorage：访客没有登录，不能把进度写到云端；登录用户也保持
// 现有行为，避免未经用户确认就新增一张表。

const PREFIX = 'bk:reader:progress:';

function readRaw(bookId) {
  if (!bookId) return null;
  try {
    const raw = localStorage.getItem(PREFIX + bookId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function loadBookProgress(bookId) {
  const raw = readRaw(bookId) || {};
  const chapter = Number(raw.chapter);
  const percent = Number(raw.percent);
  const page = Number(raw.page);
  return {
    chapter: Number.isFinite(chapter) && chapter >= 0 ? Math.floor(chapter) : 0,
    percent: Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0,
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
    updated_at: raw.updated_at || null
  };
}

export function saveBookProgress(bookId, patch = {}) {
  if (!bookId) return;
  const current = loadBookProgress(bookId);
  const next = {
    ...current,
    ...patch,
    updated_at: new Date().toISOString()
  };
  try {
    localStorage.setItem(PREFIX + bookId, JSON.stringify(next));
  } catch {
    // 隐私模式 / 存储已满：阅读本身不能因此失败
  }
}

export function clearBookProgress(bookId) {
  if (!bookId) return;
  try {
    localStorage.removeItem(PREFIX + bookId);
  } catch {
    // 忽略
  }
}
