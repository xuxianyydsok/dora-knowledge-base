// 资源关联图谱：D3 力导向图（D3 懒加载，仅本组件动态引入）
import { useEffect, useRef, useState } from 'preact/hooks';

const NODE_COLORS = {
  post: '#5b8cff',
  tag: '#ff8800'
};
const RESOURCE_COLORS = {
  video: '#e5484d', github: '#8b5cf6', music: '#22c55e',
  movie: '#f59e0b'
};

function nodeColor(node) {
  if (node.type === 'resource') return RESOURCE_COLORS[node.resource_type] || '#9aa3af';
  return NODE_COLORS[node.type] || '#9aa3af';
}

export function GraphView({ data, onSelect }) {
  const ref = useRef(null);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    const el = ref.current;
    if (!el || !data) return;
    let cancelled = false;
    let simulation = null;

    setStatus('loading');
    (async () => {
      try {
        // D3 懒加载：不在首页/其他页面引入
        const d3 = await import('d3');
        if (cancelled) return;

        const width = el.clientWidth || 800;
        const height = 520;
        el.innerHTML = '';

        const nodes = data.nodes.map((n) => ({ ...n }));
        const links = data.edges.map((e) => ({ ...e }));

        const svg = d3.select(el).append('svg')
          .attr('width', width).attr('height', height)
          .attr('viewBox', [0, 0, width, height])
          .style('background', 'var(--bg-subtle)')
          .style('border-radius', 'var(--radius)');

        // 缩放/平移
        const g = svg.append('g');
        svg.call(d3.zoom().scaleExtent([0.3, 3]).on('zoom', (ev) => g.attr('transform', ev.transform)));

        simulation = d3.forceSimulation(nodes)
          .force('link', d3.forceLink(links).id((d) => d.id).distance(90))
          .force('charge', d3.forceManyBody().strength(-260))
          .force('center', d3.forceCenter(width / 2, height / 2))
          .force('collide', d3.forceCollide(28));

        const link = g.append('g')
          .selectAll('line').data(links).join('line')
          .attr('stroke', 'var(--border)')
          .attr('stroke-width', 1.4)
          .attr('stroke-dasharray', (d) => (d.type === 'post-tag' ? '4 3' : null));

        const node = g.append('g')
          .selectAll('circle').data(nodes).join('circle')
          .attr('r', (d) => (d.type === 'tag' ? 8 : 12))
          .attr('fill', (d) => (d.type === 'tag' && d.color ? d.color : nodeColor(d)))
          .attr('stroke', 'var(--bg-elevated)')
          .attr('stroke-width', 2)
          .style('cursor', 'pointer')
          .on('click', (_ev, d) => onSelect?.(d));

        node.append('title').text((d) => `${d.type}${d.resource_type ? ':' + d.resource_type : ''}\n${d.label}`);

        const label = g.append('g')
          .selectAll('text').data(nodes).join('text')
          .text((d) => (d.label?.length > 14 ? d.label.slice(0, 14) + '…' : d.label))
          .attr('font-size', 11)
          .attr('fill', 'var(--text-muted)')
          .attr('dx', 14)
          .attr('dy', 4)
          .style('pointer-events', 'none');

        node.call(d3.drag()
          .on('start', (ev, d) => { if (!ev.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
          .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
          .on('end', (ev, d) => { if (!ev.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));

        simulation.on('tick', () => {
          link.attr('x1', (d) => d.source.x).attr('y1', (d) => d.source.y)
            .attr('x2', (d) => d.target.x).attr('y2', (d) => d.target.y);
          node.attr('cx', (d) => d.x).attr('cy', (d) => d.y);
          label.attr('x', (d) => d.x).attr('y', (d) => d.y);
        });

        setStatus('done');
      } catch (e) {
        if (!cancelled) setStatus(`error: ${e.message}`);
      }
    })();

    return () => {
      cancelled = true;
      if (simulation) simulation.stop();
    };
  }, [data]);

  return (
    <div class="stack">
      <div class="row" style="gap:14px;flex-wrap:wrap">
        {['post', 'video', 'github', 'tag'].map((t) => (
          <span key={t} class="row" style="gap:5px">
            <span style={`width:10px;height:10px;border-radius:50%;display:inline-block;background:${
              t === 'tag' ? NODE_COLORS.tag : t === 'post' ? NODE_COLORS.post : RESOURCE_COLORS[t]
            }`} />
            <span class="muted" style="font-size:12px">{t}</span>
          </span>
        ))}
      </div>
      {status === 'loading' && <div class="muted" style="font-size:12px">正在加载图谱组件（D3）…</div>}
      {status.startsWith?.('error') && <div class="muted" style="color:var(--danger);font-size:12px">{status}</div>}
      <div ref={ref} style="width:100%;min-height:520px" />
    </div>
  );
}
