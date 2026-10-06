// 重型库懒加载器：仅在检测到对应自定义标签时才动态 import
// 首页、资源列表页绝不加载这些库

const loaders = {
  katex: () => import('katex').then((m) => m.default || m),
  mermaid: () => import('mermaid').then((m) => m.default || m),
  chart: () => import('chart.js/auto').then((m) => m.default || m),
  three: () => import('three').then((m) => m)
};

const cache = {};

export function loadLib(name) {
  if (!loaders[name]) return Promise.reject(new Error(`未知库: ${name}`));
  cache[name] ||= loaders[name]();
  return cache[name];
}
