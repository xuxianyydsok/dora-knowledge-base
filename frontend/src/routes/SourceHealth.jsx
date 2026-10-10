// 源健康中心（管理员页，/sources）
//
// 定位：把「影视采集源 + 音乐音源」的瞬时可用性摊开，正面回答
// 「为什么某部片搜不到 / 某首歌放不出来」。
//
// 设计取舍：
// 1) 只做观测，不做后台：没有定时任务、不改配置，只有「刷新」按钮。
// 2) 顶栏常显一句硬提醒：健康是瞬时观测，不保证永久可用。
// 3) 复用现有 .card / .stat / .chip / .health-* 样式，仅补少量响应式规则。
// 4) 访客 / 普通用户打开只读缓存（后端 allowProbe=false），管理员可 ?refresh=1 强制刷新。
import { useEffect, useMemo, useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { LoadingState, ErrorState } from '../components/StateView.jsx';
import { Icon } from '../components/Icon.jsx';
import { toastError, toastSuccess } from '../lib/toast.jsx';
import { useAuth } from '../lib/auth.jsx';

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'movie', label: '影视' },
  { key: 'music', label: '音乐' }
];

const STATUS_LABEL = { ok: '可用', degraded: '降级', down: '不可用' };

// 能力标签：只展示「可验证」的能力，不编造无损 / 高音质
function capabilityTags(s) {
  const c = s.capabilities || {};
  const tags = [];
  if (c.search) tags.push('搜索');
  if (c.detail) tags.push('详情');
  if (c.play) tags.push('播放');
  if (c.lyrics) tags.push('歌词');
  if (c.trial_only) tags.push('试听');
  return tags;
}

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function SummaryCard({ title, data }) {
  return (
    <div class="sh-summary-card">
      <h3>{title}</h3>
      <div class="health-summary">
        <div class="stat"><b>{data.total}</b><span>总数</span></div>
        <div class="stat"><b>{data.ok}</b><span>可用</span></div>
        <div class="stat"><b>{data.degraded}</b><span>降级</span></div>
        <div class="stat"><b>{data.down}</b><span>不可用</span></div>
      </div>
    </div>
  );
}

export function SourceHealth() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  async function load(refresh = false) {
    // 防御：非管理员即使误传 refresh=true 也不强制刷新（后端会忽略 refresh=1 只返回缓存），
    // 退化为普通只读加载，且不弹任何 success toast —— 避免假报「已重新探测」。
    const wantRefresh = !!refresh && isAdmin;
    if (wantRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const res = await api.getSourceHealth(wantRefresh ? '?refresh=1' : '');
      setData(res);
      if (wantRefresh) toastSuccess('已重新探测全部源');
    } catch (e) {
      setError(e.message);
      if (wantRefresh) toastError(`刷新失败：${e.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(false); }, []);

  const sources = data?.sources || [];
  const shown = useMemo(
    () => (filter === 'all' ? sources : sources.filter((s) => s.kind === filter)),
    [sources, filter]
  );
  const summary = data?.summary;

  return (
    <section class="stack sh-page">
      <PageHeader
        kicker="Source Health"
        title="源健康中心"
        sub="影视采集源与音乐音源的瞬时可用性观测。失败/降级的源会被搜索自动跳过或降序，尽量不影响你搜到结果。"
        actions={isAdmin ? (
          <button
            type="button"
            class="primary"
            disabled={refreshing || loading}
            onClick={() => load(true)}
            title="强制重新探测全部源"
          >
            <Icon name="refresh" size={15} /> {refreshing ? '刷新中…' : '刷新'}
          </button>
        ) : null}
      />

      <div class="notice warn">
        <Icon name="info" size={16} />
        <span>健康是<strong>瞬时观测</strong>，不保证永久可用。上游免费源会随时波动或限频，本页只反映最近一次探测结果。</span>
      </div>

      {data?.stale && (
        <div class="notice warn">
          <Icon name="alert" size={16} />
          <span>
            缓存已过期（上次探测 {fmtTime(data.stale_at)}），<strong>过期数据不会用于源过滤</strong>，
            搜索会按「无数据」全量尝试。请由管理员点「刷新」重新探测。
          </span>
        </div>
      )}

      {!isAdmin && (
        <div class="notice">
          <Icon name="info" size={16} />
          <span>你当前是访客视图：只读已有缓存，不会触发上游探测。缓存过期或为空时，请由管理员在本页点「刷新」。</span>
        </div>
      )}

      {loading ? (
        <LoadingState shape="list" count={8} />
      ) : error ? (
        <ErrorState title="源健康获取失败" message={error} onRetry={() => load(false)} />
      ) : sources.length === 0 ? (
        <EmptyState
          icon="linkBroken"
          title="暂无健康数据"
          hint={isAdmin ? '点上方「刷新」发起一次全量探测。' : '请稍后由管理员刷新；这不影响正常搜索。'}
        />
      ) : (
        <>
          <div class="sh-summary">
            <SummaryCard title="全部源" data={summary} />
            <SummaryCard title="影视" data={summary.movie} />
            <SummaryCard title="音乐" data={summary.music} />
          </div>

          <div class="toolbar">
            <div class="seg">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  class={filter === f.key ? 'on' : ''}
                  onClick={() => setFilter(f.key)}
                >{f.label}</button>
              ))}
            </div>
            <span class="spacer" />
            <span class="muted sh-meta">
              检测于 {fmtTime(data.generated_at)} · {data.cached ? '缓存' : '实时'} · TTL {Math.round((data.ttl_ms || 0) / 1000)}s
            </span>
          </div>

          <ul class="health-list sh-list">
            {shown.map((s) => (
              <li key={s.key} class={s.status}>
                <span class={`health-dot ${s.status}`} />
                <span class="health-name">{s.name}</span>
                <span class={`sh-kind ${s.kind}`}>{s.kind === 'music' ? '音乐' : '影视'}</span>
                <span class={`sh-status ${s.status}`}>{STATUS_LABEL[s.status] || s.status}</span>
                <span class="health-meta">{s.latency_ms} ms</span>
                <span class="sh-tags">
                  {capabilityTags(s).map((t) => <span key={t} class="sh-tag">{t}</span>)}
                </span>
                <span class="sh-time muted">{fmtTime(s.checked_at)}</span>
                {s.error && <span class="health-err" title={s.error}>{s.error}</span>}
                {!s.error && s.notes && <span class="sh-note muted" title={s.notes}>{s.notes}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
