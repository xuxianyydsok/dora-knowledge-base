// 公开时间轴（/timeline）：把「已发布公开博客 + 公开资源 + 公开展览」排成一条人生轨迹。
//
// 设计取舍：
// 1) 视觉是「档案线」而不是普通卡片列表：年份 sticky 标签 + 中轴 + 类型节点。
// 2) 后端已做公开过滤，前端只做类型筛选与展示；接口失败/为空都不白屏。
// 3) 分页用后端返回的 next_cursor（形如 <date>|<id> 的复合游标），避免跳条/重复。
// 4) 样式集中在 styles/gallery-timeline.css（.tl-*），不动 global.css。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { LoadingState, ErrorState, LoadingMore } from '../components/StateView.jsx';
import '../styles/gallery-timeline.css';

const TYPE_LABEL = { post: '博客', github: 'GitHub', music: '音乐', movie: '影视', gallery: '图片', book: '图书' };
// 2026-10-11 用户要求：去掉「全部」标签，各类型各看各的（默认落在博客）。
// 音乐 / 影视这两项展示的是**观看历史**（后端按 user_progress.updated_at 聚合），
// 相当于「我最近听过 / 看过什么」，而不是资源入库时间。
// 2026-10-11 追加：图书也进时间轴（按上架时间，点击回书架）。
const FILTERS = [
  { key: 'post', label: '博客' },
  { key: 'github', label: 'GitHub' },
  { key: 'gallery', label: '图片' },
  { key: 'book', label: '图书' },
  { key: 'music', label: '音乐' },
  { key: 'movie', label: '影视' }
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

const PAGE = 24;

// 时间轴卡片的「模糊揭幕」（2026-10-11 用户要求：把首页那套动效挪过来）。
// 为什么放在这里而不是复用首页的 useReveal：首页那套给的是「透明度 + 位移」，
// 用户这次点名要**模糊**那一档；而且首页的 CSS 只随 Home.jsx 加载，
// 时间轴单独打开时拿不到那份样式。所以这里自带一个只播一次的小观察器。
// ⚠ 用户明确要求「动效可以模糊，但一定要显示清楚」：模糊只在入场那 0.8s 内存在，
//   终态是 filter:none，而且靠 IntersectionObserver 触发、播完锁死 ——
//   不做「跟随滚动进度」的半透明中间态（快速滑过会卡在半模糊，正是他反感的）。
function useBlurReveal(deps = []) {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const rows = [...root.querySelectorAll('.tl-reveal')];
    if (!rows.length) return undefined;
    if (typeof IntersectionObserver !== 'function') {
      rows.forEach((r) => r.classList.add('on'));
      return undefined;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('on');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -6% 0px' });
    rows.forEach((r) => io.observe(r));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

export function Timeline() {
  const [filter, setFilter] = useState('post');
  // 每个标签各存一份「已加载条目 + 游标 + 是否还有更多 + 加载状态」。
  // 为什么按标签分开存：后端现在支持 ?type= 单类型分页，各标签互不干扰，
  // 切回来时也不用重新请求（切标签瞬时出内容，不再「切一次等一次」）。
  const [byType, setByType] = useState({});

  const cur = byType[filter] || { items: [], cursor: null, hasMore: false, loading: false, error: '', loaded: false };

  async function load(type, before = null) {
    setByType((prev) => {
      const old = prev[type] || { items: [], cursor: null, hasMore: false, error: '', loaded: false };
      return { ...prev, [type]: { ...old, loading: true, error: '' } };
    });
    try {
      const q = `?limit=${PAGE}&type=${type}${before ? `&before=${encodeURIComponent(before)}` : ''}`;
      const res = await api.listTimeline(q);
      const next = res?.items || [];
      setByType((prev) => {
        const old = prev[type] || { items: [], cursor: null, hasMore: false };
        const seen = new Set(old.items.map((i) => i.id));
        const merged = before ? [...old.items, ...next.filter((i) => !seen.has(i.id))] : next;
        return {
          ...prev,
          [type]: {
            items: merged,
            cursor: res?.next_cursor || null,
            hasMore: !!res?.next_cursor,
            loading: false, error: '', loaded: true
          }
        };
      });
    } catch (err) {
      setByType((prev) => {
        const old = prev[type] || { items: [], cursor: null, hasMore: false };
        return { ...prev, [type]: { ...old, loading: false, error: err.message, loaded: true } };
      });
    }
  }

  // 首次进入或切到还没加载过的标签时才请求；已加载过的直接复用（含「加载更多」的进度）
  useEffect(() => {
    const st = byType[filter];
    if (!st || !st.loaded) load(filter);
  }, [filter]);

  const shown = cur.items;
  const years = useMemo(() => groupByMonth(shown), [shown]);
  // 模糊揭幕的观察范围：每次换标签 / 加载更多后重新挂一次（新卡片也要能揭幕）
  const revealRef = useBlurReveal([filter, shown.length]);
  const firstLoad = cur.loading && !cur.items.length;

  if (firstLoad) return <LoadingState shape="list" count={8} />;
  if (cur.error && !cur.items.length) {
    return <ErrorState title="时间轴加载失败" message={cur.error} onRetry={() => load(filter)} />;
  }

  return (
    <section class="tl-page" ref={revealRef}>
      <PageHeader
        kicker="Timeline"
        title="时间轴"
        sub="博客、GitHub、图片、图书按发布时间排；音乐与影视是观看 / 收听历史。"
        stats={[{ label: '已载入', value: cur.items.length }]}
        tabs={FILTERS.map((f) => ({ key: f.key, label: f.label }))}
        activeTab={filter}
        onTab={setFilter}
      />

      {shown.length === 0 ? (
        <EmptyState
          icon="clock"
          title={`还没有${TYPE_LABEL[filter] || ''}内容`}
          hint={filter === 'music' || filter === 'movie'
            ? '在站内听歌 / 看片后，这里会留下观看记录。'
            : '公开的博客与资源会出现在这里。'}
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
                    {mo.items.map((it, i) => (
                      <li
                        key={it.id}
                        class={`tl-node tl-${it.type} tl-reveal`}
                        style={{ '--tl-d': `${Math.min(i, 8) * 0.06}s` }}
                      >
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
                          <span class="tl-body">
                            <strong>{it.title}</strong>
                            {it.summary && <span class="tl-sum">{it.summary}</span>}
                          </span>
                          {it.cover && <img class="tl-cover" src={it.cover} alt="" loading="lazy" />}
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

      {cur.error && cur.items.length > 0 && <p class="tl-more-error muted">{cur.error}</p>}
      {cur.loading && cur.items.length > 0 && <LoadingMore label="正在加载更早的内容…" />}
      {!cur.loading && cur.hasMore && (
        <div class="tl-more">
          <button type="button" onClick={() => load(filter, cur.cursor)}>加载更早的内容</button>
        </div>
      )}
      {!cur.hasMore && shown.length > 0 && <p class="tl-end muted">已经到头了</p>}
    </section>
  );
}
