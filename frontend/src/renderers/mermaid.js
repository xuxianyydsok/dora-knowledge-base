// Mermaid 图表渲染：处理 <mermaid-chart>
import { loadLib } from './loader.js';

let initialized = false;

export async function renderMermaid(container) {
  const mermaid = await loadLib('mermaid');
  if (!initialized) {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });
    initialized = true;
  }

  const nodes = [...container.querySelectorAll('mermaid-chart')];
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    const code = el.textContent.trim();
    const id = `mermaid-${Date.now()}-${i}`;
    try {
      const { svg } = await mermaid.render(id, code);
      el.innerHTML = svg;
    } catch (e) {
      el.textContent = `图表渲染失败: ${e.message}`;
    }
  }
}
