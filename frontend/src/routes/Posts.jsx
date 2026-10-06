// 博客列表页：展示文章（画廊/时间流），进入编辑或阅读
import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { Card } from '../components/Card.jsx';
import { GalleryView } from '../components/GalleryView.jsx';
import { TimelineView } from '../components/TimelineView.jsx';
import { ViewSwitch } from '../components/ViewSwitch.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { Icon } from '../components/Icon.jsx';
import { useViewMode } from '../lib/viewMode.jsx';

export function Posts() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const { viewMode } = useViewMode();

  async function load() {
    setLoading(true);
    try { setItems(await api.listPosts()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function remove(id) {
    if (!confirm('确定删除该文章？')) return;
    try { await api.deletePost(id); await load(); }
    catch (e) { setError(e.message); }
  }

  const renderCard = (p) => (
    <Card
      key={p.id}
      title={p.title}
      description={p.excerpt}
      coverUrl={p.cover_path}
      meta={
        <span class="row" style="gap:10px">
          <span class="muted meta-item">
            <Icon name="dot" size={13} class={p.status === 'published' ? 'dot-live' : 'dot-draft'} />
            {p.status === 'published' ? '已发布' : '草稿'}
          </span>
          {p.is_public && <span class="muted meta-item"><Icon name="globe" size={13} /> 公开</span>}
        </span>
      }
      onClick={() => route(`/posts/${p.id}`)}
      footer={
        <span class="row">
          <button class="primary" onClick={(e) => { e.stopPropagation(); route(`/posts/${p.id}`); }}>阅读</button>
          <button onClick={(e) => { e.stopPropagation(); route(`/posts/${p.id}/edit`); }}>编辑</button>
          <button class="danger" onClick={(e) => { e.stopPropagation(); remove(p.id); }}>删除</button>
        </span>
      }
    />
  );

  return (
    <section>
      <PageHeader
        kicker="Blog"
        title="博客"
        sub="原生 HTML 正文，支持 KaTeX / Three.js / Mermaid / Chart.js 自定义标签，重型库按需加载。"
      >
        <button class="primary" onClick={() => route('/posts/new')}><Icon name="plus" size={15} /> 新建文章</button>
        <ViewSwitch />
      </PageHeader>

      {error && <p style="color:var(--danger)">{error}</p>}

      {loading ? <div class="center-box">加载中…</div> :
        viewMode === 'gallery'
          ? <GalleryView items={items} renderCard={renderCard} empty={<EmptyState icon="blog" title="还没有文章" hint="点右上角「新建文章」写下第一篇。" />} />
          : <TimelineView items={items} renderCard={renderCard} empty={<EmptyState icon="blog" title="还没有文章" hint="点右上角「新建文章」写下第一篇。" />} />}
    </section>
  );
}
