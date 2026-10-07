// 标签管理页：CRUD + 自定义颜色 + 批量管理 + 双视图
import { useEffect, useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { Card } from '../components/Card.jsx';
import { TagChip } from '../components/TagChip.jsx';
import { GalleryView } from '../components/GalleryView.jsx';
import { TimelineView } from '../components/TimelineView.jsx';
import { ViewSwitch } from '../components/ViewSwitch.jsx';
import { useViewMode } from '../lib/viewMode.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { LoadingState } from '../components/StateView.jsx';

export function Tags() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b6ef5');
  const [bulk, setBulk] = useState('');
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const { viewMode } = useViewMode();

  async function load() {
    setLoading(true);
    try { setItems(await api.listTags()); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.createTag({ name, color });
      setName('');
      await load();
    } catch (err) { setError(err.message); }
  }

  // 批量创建：每行 "名称,颜色" 或 "名称"
  async function batchCreate(e) {
    e.preventDefault();
    const lines = bulk.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const items = lines.map((line) => {
      const [n, c] = line.split(',').map((s) => s.trim());
      return c ? { name: n, color: c } : { name: n };
    });
    try {
      await api.batchCreateTags(items);
      setBulk('');
      await load();
    } catch (err) { setError(err.message); }
  }

  async function batchDelete() {
    if (!selected.length) return;
    if (!confirm(`确定删除选中的 ${selected.length} 个标签？`)) return;
    try {
      await api.batchDeleteTags(selected);
      setSelected([]);
      await load();
    } catch (err) { setError(err.message); }
  }

  async function remove(id) {
    if (!confirm('确定删除该标签？')) return;
    try { await api.deleteTag(id); await load(); }
    catch (err) { setError(err.message); }
  }

  function toggle(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const renderCard = (t) => (
    <Card
      key={t.id}
      title={<span class="row"><input type="checkbox" style="width:auto" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} /><span>{t.name}</span></span>}
      meta={<TagChip name={t.color} color={t.color} />}
      footer={<button class="danger" onClick={(e) => { e.stopPropagation(); remove(t.id); }}>删除</button>}
    />
  );

  return (
    <section>
      <PageHeader
        kicker="Taxonomy"
        title="标签"
        sub="跨模块复用标签，支持自定义颜色与批量管理。"
      >
        <ViewSwitch />
      </PageHeader>

      <form class="toolbar" onSubmit={create}>
        <input placeholder="标签名称" value={name} onInput={(e) => setName(e.currentTarget.value)} style="max-width:200px" />
        <input type="color" value={color} onInput={(e) => setColor(e.currentTarget.value)} style="width:56px;padding:2px" title="标签颜色" />
        <button class="primary" type="submit">新增标签</button>
      </form>

      <form class="stack" onSubmit={batchCreate} style="margin-bottom:16px">
        <textarea
          rows={3}
          placeholder={'批量创建，每行一个：名称,颜色（颜色可选）\n例如：\n前端,#ff8800\n后端,#0088ff\n数据库'}
          value={bulk}
          onInput={(e) => setBulk(e.currentTarget.value)}
        />
        <div class="row">
          <button type="submit">批量创建</button>
          <button type="button" class="danger" onClick={batchDelete} disabled={!selected.length}>
            批量删除选中 ({selected.length})
          </button>
        </div>
      </form>

      {error && <div class="notice danger">{error}</div>}
      {loading ? <LoadingState shape="list" /> :
        viewMode === 'gallery'
          ? <GalleryView items={items} renderCard={renderCard} />
          : <TimelineView items={items} renderCard={renderCard} />}
    </section>
  );
}
