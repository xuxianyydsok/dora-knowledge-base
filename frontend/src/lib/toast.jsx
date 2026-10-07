// 全局轻提示（Toast）的「无 Context」实现
//
// 为什么需要它：此前各页的失败反馈是「在页面里塞一行红色 <p>」——
// 位置随页面跳动、成功操作完全没反馈、切路由后提示还挂在新页面上。
// 这里做一层极简发布/订阅：任何模块（含 lib/player.jsx 这类非组件代码）都能直接
// 调用 toast()，由挂在根部的 <Toaster /> 统一渲染。
//
// 用法：
//   import { toastSuccess, toastError } from '../lib/toast.jsx';
//   toastSuccess('已加入影视库');
//   toastError(e.message);

let items = [];
let seq = 0;

const listeners = new Set();

function emit() {
  for (const fn of listeners) fn(items);
}

export function subscribeToasts(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function dismissToast(id) {
  const next = items.filter((t) => t.id !== id);
  if (next.length === items.length) return;
  items = next;
  emit();
}

// 最多保留 4 条：提示堆成一面墙比不提示还烦
export function toast(message, { tone = 'info', duration = 3200, action = null } = {}) {
  if (!message) return null;
  const id = ++seq;
  items = [...items.slice(-3), { id, message: String(message), tone, action }];
  emit();
  if (duration > 0) setTimeout(() => dismissToast(id), duration);
  return id;
}

export const toastInfo = (m, o) => toast(m, { ...o, tone: 'info' });
export const toastSuccess = (m, o) => toast(m, { ...o, tone: 'success' });
export const toastWarn = (m, o) => toast(m, { ...o, tone: 'warn' });
// 错误多留一会儿：用户往往需要读完再决定怎么处理
export const toastError = (m, o) => toast(m, { ...o, tone: 'danger', duration: durationOf(o) });

function durationOf(o) {
  return o && Number.isFinite(o.duration) ? o.duration : 5600;
}
