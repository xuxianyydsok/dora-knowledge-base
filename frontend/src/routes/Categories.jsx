// 分类管理页：CRUD + 画廊/时间流双视图
import { useEffect, useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { Card } from '../components/Card.jsx';
import { GalleryView } from '../components/GalleryView.jsx';
import { TimelineView } from '../components/TimelineView.jsx';
import { ViewSwitch } from '../components/ViewSwitch.jsx';
import { useViewMode } from '../lib/viewMode.jsx';
import { PageHeader } from '../components/PageHeader.jsx';

export function Categories() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const { viewMode } = useViewMode();

  async function load() {
    setLoading(true);
    try {
      setItems(await api.listCategories());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.createCategory({ name, description: desc });
      setName(''); setDesc('');
      await load();
    } catch (err) { setError(err.message); }
  }

  async function remove(id) {
    if (!confirm('确定删除该分类？')) return;
    try { await api.deleteCategory(id); await load(); }
    catch (err) { setError(err.message); }
  }

  const renderCard = (c) => (
    <Card
      key={c.id}
      title={c.name}
      description={c.description}
      footer={<button class="danger" onClick={(e) => { e.stopPropagation(); remove(c.id); }}>删除</button>}
    />
  );

  return (
    <section>
      <PageHeader
        kicker="Taxonomy"
        title="分类"
        sub="为资源与博客建立一层目录结构，卡片可直接编辑。"
      >
        <ViewSwitch />
      </PageHeader>

      <form class="toolbar" onSubmit={create}>
        <input placeholder="分类名称" value={name} onInput={(e) => setName(e.currentTarget.value)} style="max-width:220px" />
        <input placeholder="描述（可选）" value={desc} onInput={(e) => setDesc(e.currentTarget.value)} style="max-width:280px" />
        <button class="primary" type="submit">新增分类</button>
      </form>

      {error && <p style="color:var(--danger)">{error}</p>}
      {loading ? <div class="center-box">加载中…</div> :
        viewMode === 'gallery'
          ? <GalleryView items={items} renderCard={renderCard} />
          : <TimelineView items={items} renderCard={renderCard} />}
    </section>
  );
}
