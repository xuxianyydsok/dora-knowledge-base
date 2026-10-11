// 搜索历史（本地存储，音乐 / 影视共用一套实现）
//
// 用户要求（2026-10-11）：
//   搜索过的关键词要在搜索框下方留成「搜索历史」，每条右侧一个 × 可单独删除，
//   旁边还要有「一键清空」。
//
// 设计取舍：
// - 存 localStorage 而不是后端：搜索历史是**本机使用习惯**，跨设备同步没意义，
//   还要为它多开一张表 + 接口，得不偿失。
// - 音乐 / 影视各存一份（key 不同），互不干扰。
// - 去重按「完全相同的关键词」，重复搜索会把该词提到最前（最近使用优先）。
// - 上限 12 条，超出丢最旧的。

const MAX = 12;

function storageKey(scope) {
  return `kb-search-history:${scope}`;
}

// 读取历史（永远返回数组，localStorage 损坏 / 被禁用时返回空）
export function readHistory(scope) {
  try {
    const raw = localStorage.getItem(storageKey(scope));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((s) => typeof s === 'string' && s.trim()) : [];
  } catch {
    return [];
  }
}

function write(scope, list) {
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify(list.slice(0, MAX)));
  } catch {
    // 隐私模式 / 配额满：历史记不住不影响搜索本身，静默忽略
  }
}

// 记一条：去重后放到最前
export function pushHistory(scope, keyword) {
  const kw = String(keyword || '').trim();
  if (!kw) return readHistory(scope);
  const list = [kw, ...readHistory(scope).filter((s) => s !== kw)];
  write(scope, list);
  return list.slice(0, MAX);
}

// 删一条
export function removeHistory(scope, keyword) {
  const list = readHistory(scope).filter((s) => s !== keyword);
  write(scope, list);
  return list;
}

// 全部清空
export function clearHistory(scope) {
  try {
    localStorage.removeItem(storageKey(scope));
  } catch {
    // 同上，忽略
  }
  return [];
}
