// RSS 条目浏览页：按订阅源筛选、未读过滤、标记已读、画廊/时间流双视图
import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { Card } from '../components/Card.jsx';
import { GalleryView } from '../components/GalleryView.jsx';
import { TimelineView } from '../components/TimelineView.jsx';
import { ViewSwitch } from '../components/ViewSwitch.jsx';
import { useViewMode } from '../lib/viewMode.jsx';

// preact-router 不解析 query string，这里直接从 location.search 读取 feed_id
function readFeedIdFromUrl() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('feed_id') || '';
}

export function RssArticles() {
  const [feeds, setFeeds] = useState([]);
  const [items, setItems] = useState([]);
  const [feedId, setFeedId] = useState(readFeedIdFromUrl);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const { viewMode } = useViewMode();

  async function loadFeeds() {
    try { setFeeds(await api.listFeeds()); }
    catch (e) { setError(e.message); }
  }

  async function loadArticles() {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      if (feedId) params.set('feed_id', feedId);
      if (unreadOnly) params.set('unread', 'true');
      params.set('limit', '100');
      setItems(await api.listRssArticles(`?${params.toString()}`));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadFeeds(); }, []);
  useEffect(() => { loadArticles(); }, [feedId, unreadOnly]);

  async function toggleRead(article) {
    try {
      await api.markRssArticle(article.id, !article.is_read);
      await loadArticles();
      await loadFeeds();
    } catch (e) { setError(e.message); }
  }

  async function markAllRead() {
    try {
      await api.markAllRssRead(feedId || undefined);
      await loadArticles();
      await loadFeeds();
    } catch (e) { setError(e.message); }
  }

  function open(article) {
    if (article.link) window.open(article.link, '_blank', 'noreferrer');
  }

  const renderCard = (a) => (
    <Card
      key={a.id}
      title={a.title}
      description={a.summary}
      coverUrl={a.cover_path}
      onClick={() => open(a)}
      meta={
        <span class="row" style="gap:8px;flex-wrap:wrap">
          {!a.is_read && <span class="tag-chip">未读</span>}
          {a.feed_title && <span class="muted" style="font-size:12px">📰 {a.feed_title}</span>}
          {a.author && <span class="muted" style="font-size:12px">{a.author}</span>}
          {a.published_at && (
            <span class="muted" style="font-size:12px">{new Date(a.published_at).toLocaleDateString('zh-CN')}</span>
          )}
        </span>
      }
      footer={
        <span class="row">
          {a.link && <button class="primary" onClick={(e) => { e.stopPropagation(); open(a); }}>阅读原文</button>}
          <button onClick={(e) => { e.stopPropagation(); toggleRead(a); }}>{a.is_read ? '标为未读' : '标为已读'}</button>
        </span>
      }
    />
  );

  return (
    <section>
      <div class="toolbar">
        <h2 style="margin:0">RSS 条目</h2>
        <select
          value={feedId}
          onChange={(e) => setFeedId(e.currentTarget.value)}
          style="width:auto;max-width:280px"
        >
          <option value="">全部订阅源</option>
          {feeds.map((f) => (
            <option key={f.id} value={f.id}>{f.title || f.feed_url}{f.unread_count ? ` (${f.unread_count})` : ''}</option>
          ))}
        </select>
        <label class="row" style="gap:6px;font-size:13px">
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.currentTarget.checked)} />
          仅未读
        </label>
        <span class="spacer" />
        <button onClick={markAllRead}>全部已读</button>
        <button onClick={() => route('/rss')}>管理订阅源</button>
        <ViewSwitch />
      </div>

      {error && <p style="color:var(--danger)">{error}</p>}

      {loading ? <div class="center-box">加载中…</div> :
        viewMode === 'gallery'
          ? <GalleryView items={items} renderCard={renderCard} />
          : <TimelineView items={items} renderCard={renderCard} />}
    </section>
  );
}
