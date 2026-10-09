// NewsNow 热榜页：按栏目展示各平台实时热榜（数据来自自部署的 NewsNow，经后端 /api/news 代理）
// 每个源一张玻璃卡片，独立加载、独立刷新；某个源失败不影响其他源
import { useEffect, useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Icon } from '../components/Icon.jsx';
import { LoadingState, ErrorState } from '../components/StateView.jsx';

const COLORS = {
  red: '#ef4444', orange: '#f97316', amber: '#f59e0b', yellow: '#eab308', green: '#22c55e',
  emerald: '#10b981', teal: '#14b8a6', blue: '#3b82f6', indigo: '#6366f1', slate: '#64748b', gray: '#6b7280'
};

function timeAgo(iso) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.round(diff / 60000);
  if (m < 1) return '刚刚更新';
  if (m < 60) return `${m} 分钟前更新`;
  return `${Math.round(m / 60)} 小时前更新`;
}

function SourceCard({ source }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true); setError('');
    try { setData(await api.getNews(source.id)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [source.id]);

  return (
    <article class="glass news-card" style={`--news-accent:${COLORS[source.color] || COLORS.gray}`}>
      <header class="news-card-head">
        <span class="news-dot" aria-hidden="true" />
        <div class="news-card-title">
          <b>{source.name}</b>
          {source.title && <span class="muted">{source.title}</span>}
        </div>
        <span class="spacer" />
        {data?.updated_at && !loading && <span class="muted news-time">{timeAgo(data.updated_at)}</span>}
        <button type="button" class="icon-btn" aria-label={`刷新${source.name}`} onClick={load} disabled={loading}>
          <Icon name="refresh" size={14} />
        </button>
      </header>
      <div class="news-list">
        {loading && <div class="news-skeleton">{Array.from({ length: 8 }).map((_, i) => <div key={i} class="sk-line" />)}</div>}
        {!loading && error && <p class="muted news-error">{error}</p>}
        {!loading && !error && data?.items?.length === 0 && <p class="muted news-error">暂无内容</p>}
        {!loading && !error && data?.items?.length > 0 && (
          <ol>
            {data.items.map((it, i) => (
              <li key={it.url + i}>
                <span class={`news-rank${i < 3 ? ' top' : ''}`}>{i + 1}</span>
                <a href={it.url} target="_blank" rel="noreferrer" title={it.title}>{it.title}</a>
                {it.info && <span class="muted news-info">{it.info}</span>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </article>
  );
}

export function News() {
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('hot');

  async function loadMeta() {
    setError('');
    try { setMeta(await api.listNewsSources()); }
    catch (e) { setError(e.message); }
  }

  useEffect(() => { loadMeta(); }, []);

  const sources = !meta ? [] : tab === 'hot'
    ? meta.featured.map((id) => meta.sources.find((s) => s.id === id)).filter(Boolean)
    : meta.sources.filter((s) => s.column === tab);

  const tabs = meta ? meta.columns.map((c) => ({
    key: c.key,
    label: c.label,
    count: c.key === 'hot' ? meta.featured.length : meta.sources.filter((s) => s.column === c.key).length
  })) : [];

  return (
    <section class="page-col">
      <PageHeader
        kicker="NewsNow"
        title="实时热榜"
        sub="微博、知乎、B站、Hacker News 等平台热点一屏看完，点标题直达原文。"
        stats={meta ? [{ label: '热榜源', value: meta.sources.length }] : undefined}
        tabs={tabs}
        activeTab={tab}
        onTab={setTab}
      />
      {error && <ErrorState message={error} onRetry={loadMeta} />}
      {!error && !meta && <LoadingState />}
      {meta && (
        <div class="news-grid">
          {sources.map((s) => <SourceCard key={s.id} source={s} />)}
        </div>
      )}
    </section>
  );
}
