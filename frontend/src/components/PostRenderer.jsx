// 博客渲染引擎
// - 正文为原生 HTML：写入 DOM 前先经 sanitizeHtml 白名单清洗（防存储型 XSS）
// - 检测自定义标签，仅对出现的标签按需懒加载对应重型库
// - 支持：<katex-inline> <katex-block> <three-scene> <mermaid-chart> <chart-2d>
import { useEffect, useRef, useState } from 'preact/hooks';
import { sanitizeHtml } from '../lib/sanitizeHtml.js';

// 标签 -> 渲染器（动态 import，实现代码分割）
const RENDERER_MAP = [
  { tag: 'katex-inline', lib: 'katex' },
  { tag: 'katex-block', lib: 'katex' },
  { tag: 'mermaid-chart', lib: 'mermaid' },
  { tag: 'chart-2d', lib: 'chart' },
  { tag: 'three-scene', lib: 'three' }
];

export function detectHeavyTags(content = '') {
  return RENDERER_MAP.filter(({ tag }) => content.includes(`<${tag}`)).map(({ tag }) => tag);
}

export function PostRenderer({ content = '' }) {
  const ref = useRef(null);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 写入 DOM 前先做白名单清洗，避免存储型 XSS（保留自定义渲染标签）
    el.innerHTML = sanitizeHtml(content);

    const used = new Set(detectHeavyTags(content));
    if (used.size === 0) { setStatus('done'); return; }

    let cancelled = false;
    setStatus('loading');

    (async () => {
      try {
        // 仅加载用到的渲染器，未出现的库不会被打包/加载
        if (used.has('katex-inline') || used.has('katex-block')) {
          const { renderKatex } = await import('../renderers/katex.js');
          if (cancelled) return;
          await renderKatex(el);
        }
        if (used.has('mermaid-chart')) {
          const { renderMermaid } = await import('../renderers/mermaid.js');
          if (cancelled) return;
          await renderMermaid(el);
        }
        if (used.has('chart-2d')) {
          const { renderCharts } = await import('../renderers/chart.js');
          if (cancelled) return;
          await renderCharts(el);
        }
        if (used.has('three-scene')) {
          const { renderThreeScenes } = await import('../renderers/three.js');
          if (cancelled) return;
          await renderThreeScenes(el);
        }
        if (!cancelled) setStatus('done');
      } catch (e) {
        if (!cancelled) setStatus(`error: ${e.message}`);
      }
    })();

    return () => { cancelled = true; };
  }, [content]);

  return (
    <div class="post-content-wrap">
      {status === 'loading' && <div class="muted" style="font-size:12px">正在加载可视化组件…</div>}
      {typeof status === 'string' && status.startsWith('error') && (
        <div class="muted" style="color:var(--danger);font-size:12px">{status}</div>
      )}
      <div ref={ref} class="post-content" />
    </div>
  );
}
