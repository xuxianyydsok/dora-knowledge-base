// 资源关联图谱页面
import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { GraphView } from '../components/GraphView.jsx';

export function Graph() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setData(await api.getGraph()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function onSelect(node) {
    if (node.type === 'post') route(`/posts/${node.id}`);
    else if (node.type === 'resource' && node.resource_type === 'movie') route(`/movies/${node.id}`);
    else if (node.type === 'resource' && node.resource_type === 'music') route(`/music/${node.id}`);
    else if (node.type === 'resource' && node.url) window.open(node.url, '_blank');
  }

  return (
    <section>
      <div class="toolbar">
        <h2 style="margin:0">资源关联图谱</h2>
        {data?.stats && (
          <span class="muted">
            博客 {data.stats.posts} · 资源 {data.stats.resources} · 标签 {data.stats.tags} · 关系 {data.stats.edges}
          </span>
        )}
        <span class="spacer" />
        <button onClick={load}>刷新</button>
      </div>

      {error && <p style="color:var(--danger)">{error}</p>}
      {loading ? <div class="center-box">加载中…</div>
        : data?.nodes?.length
          ? <GraphView data={data} onSelect={onSelect} />
          : <div class="center-box">暂无关联数据，先添加一些资源与博客吧。</div>}
    </section>
  );
}
