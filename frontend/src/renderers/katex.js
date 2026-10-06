// KaTeX 渲染：处理 <katex-inline> 与 <katex-block>
import { loadLib } from './loader.js';

export async function renderKatex(container) {
  const katex = await loadLib('katex');
  // 确保 KaTeX 样式已加载（懒加载，仅在博客页引入）
  await import('katex/dist/katex.min.css');

  container.querySelectorAll('katex-inline').forEach((el) => {
    try {
      katex.render(el.textContent.trim(), el, { throwOnError: false, displayMode: false });
    } catch (e) {
      el.textContent = `公式错误: ${e.message}`;
    }
  });

  container.querySelectorAll('katex-block').forEach((el) => {
    try {
      katex.render(el.textContent.trim(), el, { throwOnError: false, displayMode: true });
    } catch (e) {
      el.textContent = `公式错误: ${e.message}`;
    }
  });
}
