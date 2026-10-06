// 学习视频库页面：抓取新增 + 列表（画廊/时间流）+ 播放 + 删除
import { useEffect, useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { Card } from '../components/Card.jsx';
import { GalleryView } from '../components/GalleryView.jsx';
import { TimelineView } from '../components/TimelineView.jsx';
import { ViewSwitch } from '../components/ViewSwitch.jsx';
import { VideoPlayer } from '../components/VideoPlayer.jsx';
import { Icon } from '../components/Icon.jsx';
import { useViewMode } from '../lib/viewMode.jsx';

export function Videos() {
  const [items, setItems] = useState([]);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(null);
  const { viewMode } = useViewMode();

  async function load() {
    setLoading(true);
    try { setItems(await api.listVideos()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true); setError('');
    try {
      await api.createVideo({ url });
      setUrl('');
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function play(item) {
    try { setPlaying(await api.getVideo(item.id)); }
    catch (e) { setError(e.message); }
  }

  async function remove(id) {
    if (!confirm('确定删除该视频收藏？')) return;
    try { await api.deleteVideo(id); await load(); }
    catch (e) { setError(e.message); }
  }

  const renderCard = (v) => (
    <Card
      key={v.id}
      title={v.title}
      description={v.summary}
      coverUrl={v.metadata?.cover_url}
      tags={v.tags}
      meta={
        <span class="muted meta-item">
          <Icon name={v.source === 'bilibili' ? 'video' : 'play'} size={13} />
          {v.source === 'bilibili' ? 'B站' : 'YouTube'}
        </span>
      }
      onClick={() => play(v)}
      footer={
        <span class="row">
          <button class="primary" onClick={(e) => { e.stopPropagation(); play(v); }}>播放</button>
          <a href={v.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><button>原站</button></a>
          <button class="danger" onClick={(e) => { e.stopPropagation(); remove(v.id); }}>删除</button>
        </span>
      }
    />
  );

  return (
    <section>
      <div class="toolbar">
        <h2 style="margin:0">学习视频</h2>
        <span class="spacer" />
        <ViewSwitch />
      </div>

      <form class="toolbar" onSubmit={add}>
        <input
          placeholder="粘贴 Bilibili / YouTube 视频链接"
          value={url}
          onInput={(e) => setUrl(e.currentTarget.value)}
          style="max-width:460px"
        />
        <button class="primary" type="submit" disabled={busy}>{busy ? '抓取中…' : '添加视频'}</button>
      </form>

      {error && <p style="color:var(--danger)">{error}</p>}

      {playing && (
        <div class="card" style="padding:16px;margin-bottom:20px">
          <div class="row" style="margin-bottom:8px">
            <strong>{playing.title}</strong>
            <span class="spacer" />
            <button onClick={() => setPlaying(null)}>收起</button>
          </div>
          <VideoPlayer video={playing} onClose={() => setPlaying(null)} />
        </div>
      )}

      {loading ? <div class="center-box">加载中…</div> :
        viewMode === 'gallery'
          ? <GalleryView items={items} renderCard={renderCard} />
          : <TimelineView items={items} renderCard={renderCard} />}
    </section>
  );
}
