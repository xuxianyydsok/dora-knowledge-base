// 全局搜索页：跨类型检索博客与资源
import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { Card } from '../components/Card.jsx';
import { Icon } from '../components/Icon.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { EmptyState } from '../components/StateView.jsx';

const TYPE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'post', label: '博客' },
  { value: 'resource', label: '资源' }
];
const RESOURCE_TYPES = [
  { value: '', label: '全部资源' },
  { value: 'video', label: '视频' },
  { value: 'github', label: 'GitHub' },
  { value: 'music', label: '音乐' },
  { value: 'movie', label: '影视' },
  { value: 'rss_article', label: 'RSS' }
];

export function Search({ q: initialQ }) {
  const [q, setQ] = useState(initialQ || '');
  const [type, setType] = useState('all');
  const [resourceType, setResourceType] = useState('');
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function run(keyword = q) {
    if (!keyword.trim()) return;
    setLoading(true); setError('');
    try {
      const params = `&type=${type}${resourceType ? `&resource_type=${resourceType}` : ''}`;
      const data = await api.search(keyword, params);
      setItems(data.items);
      setMeta({ count: data.count, query: data.query });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (initialQ) run(initialQ); }, []);

  function open(item) {
    if (item.kind === 'post') route(`/posts/${item.id}`);
    else if (item.type === 'video') route('/videos');
    else if (item.type === 'music') route(`/music/${item.id}`);
    else if (item.type === 'movie') route(`/movies/${item.id}`);
    else if (item.type === 'github') route('/github');
    else if (item.url) window.open(item.url, '_blank');
  }

  return (
    <section>
      <PageHeader
        kicker="Search"
        title="全局搜索"
        sub="跨博客与全部资源类型统一检索，可按类型过滤。"
      />

      <form class="toolbar" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <input
          placeholder="搜索博客标题/正文、资源标题/摘要…"
          value={q}
          onInput={(e) => setQ(e.currentTarget.value)}
          style="max-width:420px"
        />
        <select value={type} onChange={(e) => setType(e.currentTarget.value)} style="width:auto">
          {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {type !== 'post' && (
          <select value={resourceType} onChange={(e) => setResourceType(e.currentTarget.value)} style="width:auto">
            {RESOURCE_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
        <button class="primary" type="submit" disabled={loading}>{loading ? '搜索中…' : '搜索'}</button>
      </form>

      {error && <div class="notice danger">{error}</div>}
      {meta && <p class="muted">关键词「{meta.query}」共 {meta.count} 条结果</p>}

      <div class="gallery-grid">
        {items.map((item) => (
          <Card
            key={`${item.kind}-${item.id}`}
            title={item.title}
            description={item.excerpt || item.summary}
            onClick={() => open(item)}
            meta={
              <span class="row" style="gap:8px">
                <span class="tag-chip chip-icon">
                  <Icon name={item.kind === 'post' ? 'blog' : 'layers'} size={12} />
                  {item.kind === 'post' ? '博客' : (item.type || '资源')}
                </span>
                {item.status && <span class="muted">{item.status === 'published' ? '已发布' : '草稿'}</span>}
              </span>
            }
          />
        ))}
      </div>
      {!loading && meta && items.length === 0 && <EmptyState icon="search" title="未找到匹配结果" hint="换个关键词，或减少筛选条件。" />}
    </section>
  );
}
