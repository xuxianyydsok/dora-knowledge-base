// 首页聚合图谱（HomeAtlas）：把「内容模块」与「能力条目」收进一张热力矩阵。
//
// 背景：首页上方已经有一张手写 SVG 同心环径向图（见 Home.jsx 的 <Radial />）。
// 原来这里的第二张图又画了三层同心环，用户反馈「和上面那张图相似度太高、没有区分度」，
// 要求换成「GitHub 贡献热力图那种感觉的、带悬浮特效的、高级一点的图」。
//
// 映射口径（真实可算，不做估算）：
//   · 行 = 内容模块：props.modules（事实来源是 Layout.jsx 的一级导航）
//   · 列 = 能力条目：props.themes 展平后的 items（时间轴 / 碎念 / 图谱 / 收藏 / 检索 / 备份）
//   · 格子读数 = 该模块的公开条目数 × 该能力对它的覆盖权重（四舍五入）
//   · 覆盖权重来自下面的 ABILITY_WEIGHTS 静态表，表达「这个能力用不用这个模块的内容」：
//     1 = 全量取用，0.x = 部分取用，缺省 0.3。它是站点能力的设计事实，不是对内容量的估算。
//   · 格子色相 = 该模块的 tone，明度 = 覆盖权重；行头数值 = 该模块真实的公开条目数。
//   · 右侧流量带长度 = 该模块条目数 / 全部模块最大值，光点流速与条目数成正比。
//
// 交互：悬停或 Tab 聚焦任一格子 → 高亮整行整列、放大该格，底部信息条给出模块 × 能力 × 读数。
// 动效：逐格错峰入场（延迟按 i+j 斜向铺开，形成一次从左上扫过的点亮）、流量带上的流动光点；
//       全部走 CSS，无常驻 rAF。prefers-reduced-motion 下关掉全部动画。
import { Fragment } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';

// 模块缺省色板（与 StatCharts / FlowSankey 同源）；模块自带 tone 时优先用它
const TONES = ['#a8815c', '#7d8ea0', '#c07f6a', '#b3a08a', '#6f7f8f', '#5f8f7a'];

// 能力条目 → 内容模块 的覆盖权重（0~1）。缺省 0.3，表示「该能力会轻度引用这个模块的内容」。
// 例如：博客同时被时间轴 / 图谱 / 检索 / 备份全量取用，而影视只被收藏 / 检索取用。
const ABILITY_WEIGHTS = {
  posts: { 时间轴: 1, 碎念: 0.5, 图谱: 1, 收藏: 0.4, 检索: 1, 备份: 1 },
  github: { 时间轴: 0.5, 碎念: 0.4, 图谱: 1, 收藏: 1, 检索: 1, 备份: 0.6 },
  gallery: { 时间轴: 1, 碎念: 0.6, 图谱: 0.2, 收藏: 1, 检索: 1, 备份: 0.5 },
  music: { 时间轴: 0.7, 碎念: 0.5, 图谱: 0.15, 收藏: 1, 检索: 1, 备份: 0.4 },
  movies: { 时间轴: 0.7, 碎念: 0.5, 图谱: 0.15, 收藏: 1, 检索: 1, 备份: 0.4 },
  books: { 时间轴: 0.5, 碎念: 0.4, 图谱: 0.15, 收藏: 1, 检索: 1, 备份: 0.4 }
};
const DEFAULT_WEIGHT = 0.3;

// 色阶图例的五档（0~1）
const LEGEND_STEPS = [0.15, 0.35, 0.55, 0.78, 1];

function fmt(n) {
  if (n == null) return '—';
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(v);
}

// 权重 → 格子填充色。压在 12%~56% 之间：太低看不见，太高会让深色读数糊掉。
function cellFill(color, weight) {
  const pct = Math.round(12 + Math.min(1, Math.max(0, weight)) * 44);
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

/**
 * @param {Array}  props.modules   [{ key, short, name, latinShort, to, tone }]（顺序即行序）
 * @param {Object} props.counts    { [moduleKey]: number|null }，null = 接口失败 / 加载中
 * @param {Array}  props.themes    [{ label, latin, tone, items: string[] }]（能力主题分组）
 */
export function HomeAtlas({ modules = [], counts = null, themes = [] }) {
  const [hover, setHover] = useState(null);        // { r, c } | null
  const [phase, setPhase] = useState('');          // '' → enter → settled

  // 两段式：先挂 enter 让逐格动画跑起来，跑完切 settled 卸掉 animation，
  // 否则 animation-fill-mode: both 会一直压住 hover 的透明度变化。
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('enter'), 60);
    const t2 = setTimeout(() => setPhase('settled'), 1900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // 能力条目 = 三个主题分组展平；保留所属主题用于列头的英文小字
  const abilities = useMemo(
    () => themes.flatMap((t) => (t.items || []).map((name) => ({ name, theme: t }))),
    [themes]
  );

  const rows = useMemo(() => modules.map((m, i) => {
    const value = typeof counts?.[m.key] === 'number' ? counts[m.key] : null;
    const cells = abilities.map((a) => {
      const weight = ABILITY_WEIGHTS[m.key]?.[a.name] ?? DEFAULT_WEIGHT;
      return { weight, reading: value == null ? null : Math.round(value * weight) };
    });
    return { m, i, value, cells, color: m.tone || TONES[i % TONES.length] };
  }), [modules, counts, abilities]);

  const maxValue = Math.max(1, ...rows.map((r) => r.value ?? 0));
  const total = counts ? rows.reduce((s, r) => s + (r.value ?? 0), 0) : null;
  const loading = counts == null;

  const hotRow = hover ? rows[hover.r] : null;
  const hotCell = hotRow && hover ? hotRow.cells[hover.c] : null;

  if (!abilities.length) {
    return <p class="ha-empty">暂无可展示的能力条目。</p>;
  }

  return (
    <div class={`ha-wrap ${phase}`.trim()}>
      <div class="ha-head">
        <span class="ha-head-note">行 = 内容模块 · 列 = 能力条目 · 格内读数 = 公开条目量 × 覆盖权重</span>
        <span class="ha-legend" aria-hidden="true">
          <em>少</em>
          {LEGEND_STEPS.map((o) => (
            <i key={o} style={{ background: cellFill('var(--text)', o) }} />
          ))}
          <em>多</em>
        </span>
      </div>

      <div class="ha-board" onMouseLeave={() => setHover(null)}>
        {/* 主体：热力矩阵 */}
        <div
          class="ha-matrix"
          role="group"
          aria-label="站点构成热力矩阵：行是内容模块，列是能力条目"
          style={{ gridTemplateColumns: `minmax(74px, auto) repeat(${abilities.length}, minmax(0, 1fr))` }}
        >
          <div class="ha-corner">
            <span class="ha-corner-total">{fmt(total)}</span>
            <span class="ha-corner-label">{loading ? 'LOADING' : 'PUBLIC ITEMS'}</span>
          </div>

          {abilities.map((a, j) => (
            <div
              key={a.name}
              class={`ha-col${hover?.c === j ? ' hot' : ''}`}
              style={{ '--ha-d': `${j * 0.04}s` }}
            >
              <span class="ha-col-name">{a.name}</span>
              <span class="ha-col-latin">{a.theme.latin || ''}</span>
            </div>
          ))}

          {rows.map((r) => (
            <Fragment key={r.m.key}>
              <div
                class={`ha-rowhead${hover?.r === r.i ? ' hot' : ''}`}
                style={{ '--ha-tone': r.color, '--ha-d': `${r.i * 0.05}s` }}
              >
                <span class="ha-rowhead-name">{r.m.short}</span>
                <span class="ha-rowhead-value">{fmt(r.value)}</span>
              </div>

              {r.cells.map((c, j) => {
                const isHot = hover?.r === r.i && hover?.c === j;
                const sameRow = hover?.r === r.i && !isHot;
                const dim = hover != null && hover.r !== r.i;
                const name = abilities[j].name;
                return (
                  <div
                    key={name}
                    class={`ha-cell${isHot ? ' hot' : ''}${sameRow ? ' lit' : ''}${dim ? ' dim' : ''}`}
                    tabIndex={0}
                    role="img"
                    aria-label={`${r.m.name} × ${name}：${c.reading == null ? '加载中' : c.reading}`}
                    style={{
                      '--ha-tone': r.color,
                      '--ha-fill': cellFill(r.color, c.weight),
                      '--ha-w': c.weight,
                      '--ha-d': `${0.1 + (r.i + j) * 0.028}s`
                    }}
                    onMouseEnter={() => setHover({ r: r.i, c: j })}
                    onFocus={() => setHover({ r: r.i, c: j })}
                  >
                    <span class="ha-cell-value">{c.reading == null ? '·' : fmt(c.reading)}</span>
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>

        {/* 右侧：模块流量带（长度 ∝ 条目数，光点沿线流动） */}
        <aside class="ha-flow" aria-label="各内容模块的公开条目量">
          {rows.map((r) => {
            const frac = r.value == null ? 0 : Math.min(1, r.value / maxValue);
            return (
              <div
                key={r.m.key}
                class={`ha-flow-item${hover?.r === r.i ? ' hot' : ''}`}
                style={{
                  '--ha-tone': r.color,
                  '--ha-frac': frac ? Math.max(frac, 0.05) : 0,
                  '--ha-dur': `${(4.6 - 3 * frac).toFixed(2)}s`,
                  '--ha-sdelay': `${(r.i * 0.32).toFixed(2)}s`,
                  '--ha-d': `${r.i * 0.05}s`
                }}
                onMouseEnter={() => setHover({ r: r.i, c: hover?.c ?? 0 })}
              >
                <span class="ha-flow-name">{r.m.short}</span>
                <span class="ha-flow-track">
                  <span class="ha-flow-fill" />
                  <span class="ha-flow-spark" />
                </span>
                <span class="ha-flow-value">{fmt(r.value)}</span>
              </div>
            );
          })}
        </aside>
      </div>

      <div class="ha-tip">
        {hotRow && hotCell ? (
          <>
            <i style={{ background: hotRow.color }} />
            <strong>{hotRow.m.name}</strong>
            <span class="ha-tip-arrow">×</span>
            <strong>{abilities[hover.c].name}</strong>
            <b class="ha-tip-reading">{fmt(hotCell.reading)}</b>
            <span class="ha-tip-note">覆盖权重 {Math.round(hotCell.weight * 100)}%</span>
            <span class="ha-tip-note">该模块共 {fmt(hotRow.value)} 条</span>
          </>
        ) : (
          <span class="ha-tip-hint">
            悬停或 Tab 聚焦任一格子：色相代表模块，明度代表覆盖权重，行头是该模块真实的公开条目数。
          </span>
        )}
      </div>
    </div>
  );
}
