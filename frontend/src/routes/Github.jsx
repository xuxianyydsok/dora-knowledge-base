// GitHub 收藏库页面：抓取新增 + 列表（画廊/时间流）+ 刷新 star + 删除
import { useEffect, useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { Card } from '../components/Card.jsx';
import { GalleryView } from '../components/GalleryView.jsx';
import { TimelineView } from '../components/TimelineView.jsx';
import { ViewSwitch } from '../components/ViewSwitch.jsx';
import { useViewMode } from '../lib/viewMode.jsx';

export function Github() {
  const [items, setItems] = useState([]);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { viewMode } = useViewMode();

  async function load() {
    setLoading(true);
    try { setItems(await api.listGithub()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true); setError('');
    try {
      await api.createGithub({ url });
      setUrl('');
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function refresh(id) {
    try { await api.updateGithub(id, { refresh: true }); await load(); }
    catch (e) { setError(e.message); }
  }

  async function remove(id) {
    if (!confirm('确定删除该仓库收藏？')) return;
    try { await api.deleteGithub(id); await load(); }
    catch (e) { setError(e.message); }
  }

  const renderCard = (r) => (
    <Card
      key={r.id}
      title={r.title}
      description={r.summary}
      coverUrl={r.metadata?.avatar_url}
      tags={r.tags}
      meta={
        <span class="row" style="gap:12px">
          <span class="muted">⭐ {r.metadata?.stars ?? 0}</span>
          <span class="muted">🍴 {r.metadata?.forks ?? 0}</span>
          {r.metadata?.language && <span class="muted">🧩 {r.metadata.language}</span>}
        </span>
      }
      footer={
        <span class="row">
          <a href={r.url} target="_blank" rel="noreferrer"><button>打开仓库</button></a>
          <button onClick={(e) => { e.stopPropagation(); refresh(r.id); }}>刷新</button>
          <button class="danger" onClick={(e) => { e.stopPropagation(); remove(r.id); }}>删除</button>
        </span>
      }
    />
  );

  return (
    <section>
      <div class="toolbar">
        <h2 style="margin:0">GitHub 收藏</h2>
        <span class="spacer" />
        <ViewSwitch />
      </div>

      <form class="toolbar" onSubmit={add}>
        <input
          placeholder="粘贴 GitHub 仓库链接，如 https://github.com/owner/repo"
          value={url}
          onInput={(e) => setUrl(e.currentTarget.value)}
          style="max-width:460px"
        />
        <button class="primary" type="submit" disabled={busy}>{busy ? '抓取中…' : '添加仓库'}</button>
      </form>

      {error && <p style="color:var(--danger)">{error}</p>}

      {loading ? <div class="center-box">加载中…</div> :
        viewMode === 'gallery'
          ? <GalleryView items={items} renderCard={renderCard} />
          : <TimelineView items={items} renderCard={renderCard} />}
    </section>
  );
}
