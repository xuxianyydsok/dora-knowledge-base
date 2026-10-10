// 公开时间轴（/timeline）：把「已发布公开博客 + 公开资源 + 公开展览」排成一条人生轨迹。
//
// 设计取舍：
// 1) 视觉是「档案线」而不是普通卡片列表：年份 sticky 标签 + 中轴 + 类型节点。
// 2) 后端已做公开过滤，前端只做类型筛选与展示；接口失败/为空都不白屏。
// 3) 分页用后端返回的 next_cursor（形如 <date>|<id> 的复合游标），避免跳条/重复。
// 4) 样式集中在 styles/gallery-timeline.css（.tl-*），不动 global.css。
import { useEffect, useMemo, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { LoadingState, ErrorState, LoadingMore } from '../components/StateView.jsx';
import '../styles/gallery-timeline.css';

const TYPE_LABEL = { post: '博客', github: 'GitHub', music: '音乐', movie: '影视', gallery: '图片' };
const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'post', label: '博客' },
  { key: 'github', label: 'GitHub' },
  { key: 'music', label: '音乐' },
  { key: 'movie', label: '影视' },
  { key: 'gallery', label: '图片' }
];

function fmtDay(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 按「年 → 月」分组，组内保持后端给的倒序
function groupByMonth(items) {
  const years = [];
  for (const it of items) {
    const d = new Date(it.date);
    if (Number.isNaN(d.getTime())) continue;
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    let yr = years.find((x) => x.y === y);
    if (!yr) { yr = { y, months: [], count: 0 }; years.push(yr); }
    let mo = yr.months.find((x) => x.m === m);
    if (!mo) { mo = { m, items: [] }; yr.months.push(mo); }
    mo.items.push(it);
    yr.count += 1;
  }
  return years;
}

export function Timeline() {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  async function loadFirst() {
    setLoading(true); setError('');
    try {
      const res = await api.listTimeline('?limit=20');
      setItems(res?.items || []);
      setCursor(res?.next_cursor || null);
      setHasMore(!!res?.next_cursor);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadFirst(); }, []);

  async function loadMore() {
    if (loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const res = await api.listTimeline(`?limit=20&before=${encodeURIComponent(cursor)}`);
      const next = res?.items || [];
      // 后端已保证游标严格小于，这里再按 id 去重，双保险
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...next.filter((i) => !seen.has(i.id))];
      });
      setCursor(res?.next_cursor || null);
      setHasMore(!!res?.next_cursor);
    } catch (err) { setError(err.message); }
    finally { setLoadingMore(false); }
  }

  const shown = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => i.type === filter)),
    [items, filter]
  );
  const years = useMemo(() => groupByMonth(shown), [shown]);

  if (loading && !items.length) return <LoadingState shape="list" count={8} />;
  if (error && !items.length) return <ErrorState title="时间轴加载失败" message={error} onRetry={loadFirst} />;

  return (
    <section class="tl-page">
      <PageHeader
        kicker="Timeline"
        title="时间轴"
        sub="把博客、GitHub、音乐、影视与图片，按时间排成一条线。"
        stats={[{ label: '已载入', value: items.length }]}
        tabs={FILTERS.map((f) => ({ key: f.key, label: f.label }))}
        activeTab={filter}
        onTab={setFilter}
      />

      {shown.length === 0 ? (
        <EmptyState
          icon="clock"
          title={filter === 'all' ? '这条线还是空的' : `还没有${TYPE_LABEL[filter] || ''}内容`}
          hint="公开的博客与资源会出现在这里。"
        />
      ) : (
        <div class="tl-track">
          {years.map((yr) => (
            <section key={yr.y} class="tl-year">
              <h2 class="tl-year-label">{yr.y}<small>{yr.count}</small></h2>
              {yr.months.map((mo) => (
                <div key={mo.m} class="tl-month">
                  <h3 class="tl-month-label">{mo.m} 月</h3>
                  <ul class="tl-list">
                    {mo.items.map((it) => (
                      <li key={it.id} class={`tl-node tl-${it.type}`}>
                        <span class="tl-dot" aria-hidden="true" />
                        <a
                          class="tl-card"
                          href={it.url || '#'}
                          onClick={(e) => {
                            // 站内链接走 SPA 路由，避免整页刷新；外部链接（如 GitHub）保持默认行为
                            if (it.url && it.url.startsWith('/')) { e.preventDefault(); route(it.url); }
                          }}
                        >
                          <time class="tl-time">{fmtDay(it.date)}</time>
                          <span class="tl-badge">{TYPE_LABEL[it.type] || it.type}</span>
                          {it.cover && <img class="tl-cover" src={it.cover} alt="" loading="lazy" />}
                          <span class="tl-body">
                            <strong>{it.title}</strong>
                            {it.summary && <span class="tl-sum">{it.summary}</span>}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      {error && items.length > 0 && <p class="tl-more-error muted">{error}</p>}
      {loadingMore && <LoadingMore label="正在加载更早的内容…" />}
      {!loadingMore && hasMore && filter === 'all' && (
        <div class="tl-more">
          <button type="button" onClick={loadMore}>加载更早的内容</button>
        </div>
      )}
      {!hasMore && shown.length > 0 && <p class="tl-end muted">已经到头了</p>}
    </section>
  );
}
