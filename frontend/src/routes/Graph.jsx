// 资源关联图谱页面
import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { GraphView } from '../components/GraphView.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { LoadingState, EmptyState } from '../components/StateView.jsx';

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
      <PageHeader
        kicker="Knowledge Graph"
        title="资源关联图谱"
        sub="博客、资源与标签之间的关联关系，节点可拖动、可点击。"
      >
        {data?.stats && (
          <span class="muted">
            博客 {data.stats.posts} · 资源 {data.stats.resources} · 标签 {data.stats.tags} · 关系 {data.stats.edges}
          </span>
        )}
        <button onClick={load}>刷新</button>
      </PageHeader>

      {error && <div class="notice danger">{error}</div>}
      {loading ? <LoadingState shape="card" count={4} />
        : data?.nodes?.length
          ? <GraphView data={data} onSelect={onSelect} />
          : <EmptyState icon="graph" title="暂无关联数据" hint="先添加一些资源与博客，图谱会自动把它们连起来。" />}
    </section>
  );
}
