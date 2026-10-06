// 学习视频库页面：抓取新增 + 列表（画廊/时间流）+ 播放 + 删除
import { useEffect, useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { Card } from '../components/Card.jsx';
import { GalleryView } from '../components/GalleryView.jsx';
import { TimelineView } from '../components/TimelineView.jsx';
import { ViewSwitch } from '../components/ViewSwitch.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
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
      <PageHeader
        kicker="Video Library"
        title="学习视频"
        sub="粘贴 B站 / YouTube 链接自动抓取元信息，播放进度自动记忆。"
      >
        <ViewSwitch />
      </PageHeader>

      <form class="inline-form" onSubmit={add}>
        <span class="inline-form-icon"><Icon name="link" size={16} /></span>
        <input
          placeholder="粘贴 Bilibili / YouTube 视频链接"
          value={url}
          onInput={(e) => setUrl(e.currentTarget.value)}
        />
        <button class="primary" type="submit" disabled={busy}>{busy ? '抓取中…' : '添加视频'}</button>
      </form>

      {error && <p style="color:var(--danger)">{error}</p>}

      {/* 播放中：只保留播放器，列表整体隐藏，避免播放器下方重复出现同一张卡片 */}
      {playing ? (
        <VideoPlayer video={playing} onClose={() => setPlaying(null)} />
      ) : (
        <>
          {loading ? <div class="center-box">加载中…</div> :
            viewMode === 'gallery'
              ? <GalleryView items={items} renderCard={renderCard} empty={<EmptyState icon="video" title="还没有收藏视频" hint="把 B站 / YouTube 链接粘到上方的输入框就能自动抓取。" />} />
              : <TimelineView items={items} renderCard={renderCard} empty={<EmptyState icon="video" title="还没有收藏视频" hint="把 B站 / YouTube 链接粘到上方的输入框就能自动抓取。" />} />}
        </>
      )}
    </section>
  );
}
