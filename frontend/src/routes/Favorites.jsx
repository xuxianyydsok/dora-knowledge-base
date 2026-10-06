// 跨类型收藏夹管理页
import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { Card } from '../components/Card.jsx';
import { GalleryView } from '../components/GalleryView.jsx';
import { TimelineView } from '../components/TimelineView.jsx';
import { ViewSwitch } from '../components/ViewSwitch.jsx';
import { Icon } from '../components/Icon.jsx';
import { useViewMode } from '../lib/viewMode.jsx';

export function Favorites() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const { viewMode } = useViewMode();

  async function load() {
    setLoading(true);
    try { setItems(await api.listFavorites()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function remove(fav) {
    if (!confirm('移除该收藏？')) return;
    try { await api.deleteFavorite(fav.id); await load(); }
    catch (e) { setError(e.message); }
  }

  function open(fav) {
    const t = fav.target || {};
    if (t.kind === 'post') route(`/posts/${t.id}`);
    else if (t.type === 'movie') route(`/movies/${t.id}`);
    else if (t.type === 'music') route(`/music/${t.id}`);
    else if (t.url) window.open(t.url, '_blank');
  }

  const shown = items.filter((f) => filter === 'all' || f.target?.kind === filter);

  const renderCard = (fav) => {
    const t = fav.target || {};
    return (
      <Card
        key={fav.id}
        title={t.title || '(已删除)'}
        description={t.summary || t.excerpt}
        onClick={() => open(fav)}
        meta={
          <span class="tag-chip chip-icon">
            <Icon name={t.kind === 'post' ? 'blog' : 'layers'} size={12} />
            {t.kind === 'post' ? '博客' : (t.type || '资源')}
          </span>
        }
        footer={
          <span class="row">
            <button class="primary" onClick={(e) => { e.stopPropagation(); open(fav); }}>
              {t.kind === 'post' ? '阅读' : '打开'}
            </button>
            <button class="danger" onClick={(e) => { e.stopPropagation(); remove(fav); }}>移除</button>
          </span>
        }
      />
    );
  };

  return (
    <section>
      <div class="toolbar">
        <h2 style="margin:0">收藏夹</h2>
        <span class="spacer" />
        <select value={filter} onChange={(e) => setFilter(e.currentTarget.value)} style="width:auto">
          <option value="all">全部</option>
          <option value="resource">资源</option>
          <option value="post">博客</option>
        </select>
        <ViewSwitch />
      </div>

      {error && <p style="color:var(--danger)">{error}</p>}
      {loading ? <div class="center-box">加载中…</div> :
        viewMode === 'gallery'
          ? <GalleryView items={shown} renderCard={renderCard} />
          : <TimelineView items={shown} renderCard={renderCard} />}
    </section>
  );
}
