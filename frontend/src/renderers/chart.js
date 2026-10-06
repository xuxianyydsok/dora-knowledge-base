// Chart.js 渲染：处理 <chart-2d>，标签内为 JSON 配置
import { loadLib } from './loader.js';

export async function renderCharts(container) {
  const Chart = await loadLib('chart');
  const nodes = [...container.querySelectorAll('chart-2d')];

  nodes.forEach((el, i) => {
    let config;
    try {
      config = JSON.parse(el.textContent.trim());
    } catch (e) {
      el.textContent = `图表配置 JSON 解析失败: ${e.message}`;
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.height = 260;
    el.innerHTML = '';
    el.appendChild(canvas);
    try {
      new Chart(canvas, config);
    } catch (e) {
      el.textContent = `图表渲染失败: ${e.message}`;
    }
  });
}
