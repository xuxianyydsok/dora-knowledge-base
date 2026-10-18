// 发文热力图（2026-10-18，来自图鉴 #102「紫蓝热力图」）
//
// 与图鉴原版的关键差异：**用真实数据**。
//   原版是伪随机数（`rnd()` 生成 53 周 × 7 天的假数据），只能当装饰；
//   用户明确要求「用真数据」，所以这里接收站内真实文章列表，
//   按 published_at 统计每天发了几篇，再映射成 5 档颜色。
//
// 为什么自己算而不是让后端返回聚合：
//   博客页已经拿到了全部文章（useBlogData），再发一个聚合请求要多一次往返
//   —— 而 Worker→Supabase 的单次往返实测要几秒到几十秒（见 docs/progress.md 2.40）。
//   本地聚合是 O(n)，315 篇不到 1ms，没有理由再走网络。
import { useMemo } from 'preact/hooks';

const DAY = 24 * 60 * 60 * 1000;

// 把日期归一到当天 00:00（本地时区），作为按天分桶的 key
function dayKey(d) {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`;
}

// 统计过去 53 周（GitHub 风格：一列 = 一周，一行 = 周一~周日）
function buildWeeks(posts) {
  const counts = new Map();
  for (const p of posts || []) {
    const k = dayKey(p.published_at || p.created_at);
    if (k) counts.set(k, (counts.get(k) || 0) + 1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // 起点对齐到「53 周前的周日」，这样每一列都是一整周
  const start = new Date(today.getTime() - 52 * 7 * DAY);
  start.setDate(start.getDate() - start.getDay());

  const weeks = [];
  let total = 0;
  let activeDays = 0;
  let bestRun = 0;
  let run = 0;

  for (let w = 0; w < 53; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start.getTime() + (w * 7 + d) * DAY);
      if (dt > today) { col.push(null); continue; }   // 未来的格子留空
      const n = counts.get(dayKey(dt)) || 0;
      if (n) { total += n; activeDays++; run++; if (run > bestRun) bestRun = run; }
      else run = 0;
      col.push({ date: dt, n });
    }
    weeks.push(col);
  }
  return { weeks, total, activeDays, bestRun };
}

// 发文篇数 → 颜色档位（0~4）。阈值按「个人博客」的实际密度定：
// 一天 1 篇就算浅色，5 篇以上算最深 —— 和 315 篇的量级匹配。
function levelOf(n) {
  if (!n) return 0;
  if (n === 1) return 1;
  if (n === 2) return 2;
  if (n <= 4) return 3;
  return 4;
}

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const WEEKDAYS = ['一', '三', '五'];   // 只标三行，避免拥挤

export function PostHeatmap({ posts = [], title = '发文热力图' }) {
  const { weeks, total, activeDays, bestRun } = useMemo(() => buildWeeks(posts), [posts]);

  // 月份标签：某一列的第一天进入新月份时，在该列上方标一次
  const monthMarks = useMemo(() => {
    const out = [];
    let lastMonth = -1;
    weeks.forEach((col, w) => {
      const first = col.find(Boolean);
      if (!first) return;
      const m = first.date.getMonth();
      if (m !== lastMonth) {
        lastMonth = m;
        out.push({ w, label: MONTH_LABELS[m] });
      }
    });
    // 最后一个月刚开头时不标，避免标签贴边
    return out.filter((x) => x.w < weeks.length - 2);
  }, [weeks]);

  return (
    <div class="phm">
      <div class="phm-head">
        <strong>{title}</strong>
        <span class="phm-sum">
          过去一年 {total} 篇 · {activeDays} 天有记录 · 最长连续 {bestRun} 天
        </span>
      </div>

      <div class="phm-scroll">
        <div class="phm-inner">
          <div class="phm-months" aria-hidden="true">
            {monthMarks.map((m) => (
              <span key={`${m.w}-${m.label}`} style={{ left: `${m.w * 16}px` }}>{m.label}</span>
            ))}
          </div>
          <div class="phm-weekdays" aria-hidden="true">
            {WEEKDAYS.map((d, i) => <span key={d} style={{ top: `${i * 29}px` }}>{d}</span>)}
          </div>
          <div class="phm-grid" role="img" aria-label={`${title}：过去一年共 ${total} 篇`}>
            {weeks.map((col, w) => col.map((cell, d) => (
              cell
                ? (
                  <i
                    key={`${w}-${d}`}
                    data-l={levelOf(cell.n)}
                    title={`${cell.date.getFullYear()}年${cell.date.getMonth() + 1}月${cell.date.getDate()}日 · ${cell.n ? `${cell.n} 篇` : '没有发文'}`}
                    style={{ '--d': `${w * 12 + d * 6}ms` }}
                  />
                )
                : <i key={`${w}-${d}`} class="is-future" />
            )))}
          </div>
        </div>
      </div>

      <div class="phm-legend">
        <span>少</span>
        {[0, 1, 2, 3, 4].map((l) => <i key={l} data-l={l} />)}
        <span>多</span>
      </div>
    </div>
  );
}
