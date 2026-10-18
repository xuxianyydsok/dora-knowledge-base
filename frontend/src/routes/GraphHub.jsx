// 图谱（/graph/blog · /graph/repos）：博客图谱 + 开源项目图谱。
//
// 定位：**给所有人看的公开星图**，和 /graph（站长个人控制台，聚合 AI 解读进度等私有数据）分开。
// 两者共用同一套 StarMap 画布：星区（分类 / 语言 / 应用分类）+ 星点 + 随机连线 + 光点流动。
// 顶栏把「图谱」作为一级入口（指向 /graph/blog），两种图谱在页面内用标签切换。
// 页面背景跟随站点主题色（浅色 / 素雅），不再是固定暗色（2026-10-11 用户要求）。
//
// 2026-10-11（本轮，用户要求）两处改版：
//   ① **右侧栏只留两栏** —— 去掉原来的「筛选结果 / 全部文章」面板，只保留
//      「搜索框 + 分类 + 标签」（开源图谱是「搜索 + 编程语言 + 应用分类」）。
//      用户原话：「我其实只要你写那个两栏就够了……就不需要那个全部文章的那一栏」。
//   ② **画布下方从「流动网络」换成「流向图 + 统计图」** —— 原来的 FlowNetwork 是又一张
//      随机流动图，与上方星图重复且读不出统计信息。现在第一张是 **FlowSankey 流向图**
//      （分类 → 标签，从左往右的交叉带子，带宽 = 数量，带子上有流动光），
//      后面跟两张统计图：占比点阵（一个方块 = 一份）与矩形树图（面积 ∝ 体量），
//      再加体量排行条。开源图谱同理（语言 → 应用分类）。
//      统计口径全部在 lib/graphStats.js（纯函数、有离线单测）。
//      ⚠ 2026-10-11 本轮用户点名单张删掉：旭日构成、交叉热力、河流面积、
//        雷达 / 进度环、气泡矩阵、和弦图、同心环段、轨道星座、山脊图等。
//   ③ 统计图**跟随筛选联动**：点右侧分类 / 标签，或搜索关键词，下方统计图会一起收窄到该子集。
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { StarMap, sectorColor, MAX_SECTORS, MAX_INNER } from '../components/StarMap.jsx';
import { StarMap3D } from '../components/StarMap3D.jsx';
import {
  StatBoard, StatCard, RankBars
} from '../components/StatCharts.jsx';
import { FlowSankey } from '../components/FlowSankey.jsx';
// 2026-10-11（本轮）：上一轮追加的 8 张图里，用户点名保留了「占比点阵」
// （WaffleGrid）和「矩形树图」（TreemapBoard），其余（和弦图 / 多维环形对比 /
// 同心环段 / 轨道星座 / 流带时间轴 / 山脊图）连同后面一批原有图表一起删掉。
// 见下面 ExtraCharts 的注释。
import { WaffleGrid } from '../components/charts/WaffleGrid.jsx';
import { TreemapBoard } from '../components/charts/TreemapBoard.jsx';
import { blogStats, repoStats } from '../lib/graphStats.js';
import { Icon } from '../components/Icon.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import '../styles/starmap.css';

const MODES = {
  blog: {
    key: 'blog', path: '/graph/blog', kicker: 'Blog Graph', title: '博客图谱',
    sub: '每个分类是一片星区，文章是其中的星点，光点沿连线流动 —— 悬停看标题，点击进入文章。',
    brand: 'dora-blog-graph'
  },
  repos: {
    key: 'repos', path: '/graph/repos', kicker: 'Open Source Graph', title: '开源项目图谱',
    sub: '每片星区是一种编程语言或 AI 应用分类，每个星点是一个 GitHub 收藏 —— 点击去 GitHub。',
    brand: 'dora-repo-graph'
  }
};

// ---------------- 2D / 3D 视图切换 ----------------
//
// 用户要求（2026-10-13）：「二弟的话还是保留，只是说要添加一个 3D 的按钮」
// 「根据你的建议来」—— 采纳的建议是：**两种都保留**，画布右上角一个切换按钮，
// 桌面默认 3D、手机默认 2D（3D 在小屏 + 弱设备上体验差）。
//
// 为什么默认按屏幕宽度分流而不是一律 3D：
//   3D 要多下 ~750KB 的 three 分包、且手机上帧率不稳；2D 版是手绘 canvas，
//   几百个点毫无压力。手机上直接给 2D，用户想看 3D 仍然可以自己点。
function useDefaultView() {
  const [view, setView] = useState(() => {
    if (typeof window === 'undefined') return '3d';
    // 窄屏或低内存设备默认 2D
    const narrow = window.innerWidth < 900;
    const lowMem = typeof navigator !== 'undefined'
      && Number(navigator.deviceMemory || 8) <= 4;
    return (narrow || lowMem) ? '2d' : '3d';
  });
  return [view, setView];
}

// 画布右上角的视图切换（2D / 3D）。放在画布容器内部，随容器定位。
function ViewSwitch({ view, onChange }) {
  return (
    <div class="sm-viewswitch" role="group" aria-label="视图模式">
      {/* 2026-10-15：加自定义气泡提示（取自图鉴 #41）。
          为什么不用原生 title：浏览器原生 tooltip 要悬停 1~2 秒才出现、样式不可控，
          而「2D / 3D 有什么区别」正是新手最容易困惑的地方，值得即时可见。
          两个按钮的 data-tip 由 CSS ::after 渲染；原生 title 保留作为无障碍兜底。 */}
      <button
        type="button"
        class={`sm-vs-btn mfx-tip-only${view === '2d' ? ' on' : ''}`}
        onClick={() => onChange('2d')}
        title="2D 星图（手绘，最省电）"
        data-tip="2D 星图 · 手绘，最省电"
      >2D</button>
      <button
        type="button"
        class={`sm-vs-btn mfx-tip-only${view === '3d' ? ' on' : ''}`}
        onClick={() => onChange('3d')}
        title="3D 星云（可拖动旋转、滚轮缩放）"
        data-tip="3D 星云 · 可拖动旋转、滚轮缩放"
      >3D</button>
    </div>
  );
}

// 画布本体：按 view 决定挂 2D 还是 3D。
// 两者接收**完全相同**的 data / mode / onPick，所以切换不会改变筛选状态。
function GraphCanvas({ view, data, mode, onPick, label }) {
  if (!data) return <div class="sm-loading"><span /><span /><span /><p>正在铺设星轨…</p></div>;
  return view === '3d'
    ? <StarMap3D data={data} mode={mode} onPick={onPick} label={label} autoRotate />
    : <StarMap data={data} mode={mode} onPick={onPick} label={label} />;
}

function fmtNum(n) { return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n || 0); }

// ---------------- 本轮新增的 8 张图 ----------------
// 用户要求「在现有的图之外再多画很多新图，动画特效尽可能多，后续哪些不需要再让他删」。
// 统计看板里保留的「扩展图」（2026-10-11 本轮删减后只剩两张）。
//
// 用户这一轮点名删掉的图：
//   和弦图、多维环形对比、同心环段、轨道星座、流带时间轴、山脊图
//   （以上是上一轮追加的 8 张里的 6 张）
//   + 分类/语言 × 标签/分类 的构成图与交叉热度图、每月发文/每月新增收藏、
//     内容构成雷达、内容健康度仪表、多维环形、同心环段
// 保留：占比点阵（WaffleGrid）、矩形树图（TreemapBoard）、体量排行（RankBars）。
//
// 所以这个组件现在只负责「占比点阵 + 矩形树图」，两者的数据都来自 sunburst
// 的「父 label + children」结构。
function sunburstToGroups(sunburst) {
  return (Array.isArray(sunburst) ? sunburst : []).map((g) => ({
    label: g.label,
    color: g.color,
    value: g.value,
    segments: (g.children || []).map((c) => ({ label: c.label, value: c.value, color: c.color })),
    children: (g.children || []).map((c) => ({ label: c.label, value: c.value, color: c.color }))
  }));
}

function ExtraCharts({ stats, mode }) {
  const groups = useMemo(() => sunburstToGroups(stats.sunburst), [stats.sunburst]);
  const colWord = mode === 'repos' ? '应用分类' : '标签';
  const unit = mode === 'repos' ? '个仓库' : '篇文章';

  return (
    <StatBoard ariaLabel="扩展统计图">
      <StatCard
        title="占比点阵"
        sub={`每个方块 = 一份，颜色代表它属于哪个${colWord}；对角线错峰弹出，悬停看具体数值。`}
        wide
      >
        <WaffleGrid
          groups={groups.map((g) => ({ label: g.label, total: g.value, segments: g.segments }))}
          height={340}
          ariaLabel="占比点阵图"
        />
      </StatCard>

      <StatCard
        title="矩形树图"
        sub={`矩形面积 ∝ ${unit}数；比扇区更容易比较谁更大，小块也点得到。`}
        wide
      >
        <TreemapBoard groups={groups} height={400} ariaLabel="矩形树图" />
      </StatCard>
    </StatBoard>
  );
}

function Stat({ label, value, accent }) {
  return <span class="sm-stat"><i>{label}</i><b style={accent ? `color:${accent}` : undefined}>{fmtNum(value)}</b></span>;
}

// ---------------- 侧栏 chip 自适应 ----------------
// 用户要求（2026-10-11）：右侧「分类 / 标签 / 编程语言 / 应用分类」四类 chip
// **必须全部平铺展示**，不许出现内部滚动条，也不许把面板顶出画布高度。
// 做法：面板高度由 CSS 撑满画布（flex:1），这里再按「内容是否溢出」缩小
// --sm-chip-scale（1 → 0.82 → …，下限 0.62）。因为要在同一行里同时量多个面板，
// 用「行容器」上的一个变量统一控制，保证几块比例一致。
//
// 注意：必须在**当前 scale 下**测量，然后按比例乘出来（newScale = scale × 可用/需要）。
// 若直接令 scale = 可用/需要，缩到位之后需要的高度也跟着变小、算出的比值回到 1，
// 就会在「1 ↔ 缩到位」之间来回跳（实测过的坑）。
function useFitScale(containerRef, deps) {
  const [scale, setScale] = useState(1);
  const rafRef = useRef(0);
  const passRef = useRef(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      const boxes = el.querySelectorAll('[data-fit]');
      if (!boxes.length) return;
      const current = Number(getComputedStyle(el).getPropertyValue('--sm-chip-scale')) || 1;
      let ratio = 1;
      for (const box of boxes) {
        const inner = box.querySelector('[data-fit-inner]');
        if (!inner) continue;
        // 比的是「chips 区实际拿到的高度」与「chips 内容真实需要的高度」，
        // 而不是整个面板高度 —— 面板里还有一行标题，混进去会算小。
        const avail = inner.clientHeight;
        const need = inner.scrollHeight;
        if (!avail || !need) continue;
        if (need > avail) ratio = Math.min(ratio, (avail - 2) / need);
        // 反向：留了太多空（窗口变大 / 数据变少）时允许长回去，最多回到 1
        else if (current < 1 && need > 0) ratio = Math.max(ratio, Math.min(1 / current, (avail - 2) / need));
      }
      const next = Math.min(1, Math.max(0.62, current * ratio));
      if (Math.abs(next - current) < 0.015 || passRef.current >= 4) {
        passRef.current = 0;
        return;
      }
      passRef.current += 1;
      setScale(next);
      // 字号变化会改变换行位置，量一次不一定收敛；下一帧再量一次（最多 4 次）
      rafRef.current = requestAnimationFrame(measure);
    };

    const schedule = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    };

    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    for (const box of el.querySelectorAll('[data-fit]')) ro.observe(box);
    // 字体加载完会改变行高，量一次更稳
    if (document.fonts?.ready) document.fonts.ready.then(schedule).catch(() => {});

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, deps);

  return scale;
}

// 侧栏：搜索框 + 若干分组面板。分组面板等分剩余高度，内部 chip 全部平铺。
function GraphSide({ placeholder, query, onQuery, groups, pick, onPick, colorOf }) {
  const boxRef = useRef(null);
  const scale = useFitScale(boxRef, [groups, pick], groups.length);
  return (
    <aside class="sm-side" ref={boxRef} style={`--sm-chip-scale:${scale}`}>
      <label class="sm-search sm-search-panel">
        <Icon name="search" size={14} />
        <input type="search" placeholder={placeholder} value={query} onInput={(e) => onQuery(e.currentTarget.value)} />
      </label>
      {groups.map((g) => (
        <div class="sm-panel" key={g.label} data-fit>
          <header><span>{g.label}</span><i>{g.list.length}</i></header>
          <div class="sm-chips" data-fit-inner>
            {g.empty && <p class="sm-mute">{g.empty}</p>}
            {g.list.map((h) => (
              <button key={h.id} type="button"
                class={`sm-chip${pick === h.id ? ' on' : ''}`}
                onClick={() => onPick(pick === h.id ? null : h.id)}>
                <i class="sm-swatch" style={`background:${colorOf(h)};color:${colorOf(h)}`} />{h.label}<b>{h.count}</b>
              </button>
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
}

// ---------------- 博客图谱 ----------------
function BlogGraph() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [pick, setPick] = useState(null);      // 选中的枢纽 id
  const [q, setQ] = useState('');
  const [view, setView] = useDefaultView();    // 2d | 3d

  useEffect(() => {
    let alive = true;
    api.getBlogGraph().then((d) => { if (alive) setData(d); }).catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, []);

  const posts = useMemo(() => (data?.nodes || []).filter((n) => n.kind === 'leaf'), [data]);
  const linkByPost = useMemo(() => {
    const m = new Map();
    (data?.links || []).forEach((l) => {
      const post = l.source.startsWith('p:') ? l.source : (l.target.startsWith('p:') ? l.target : null);
      const other = post === l.source ? l.target : l.source;
      if (!post) return;
      if (!m.has(post)) m.set(post, []);
      m.get(post).push(other);
    });
    return m;
  }, [data]);

  const filtered = useMemo(() => {
    let l = posts;
    if (pick) l = l.filter((p) => p.parent === pick || (linkByPost.get(p.id) || []).includes(pick));
    const kw = q.trim().toLowerCase();
    if (kw) l = l.filter((p) => String(p.label || '').toLowerCase().includes(kw));
    return l;
  }, [posts, pick, q, linkByPost]);

  const hubs = (data?.nodes || []).filter((n) => n.kind === 'hub');
  // 侧栏按「分类」「标签」分两组（与画布外圈 / 内圈一致）；色点也按同样色序取色
  // 只列出画布上真正画出来的星区（超过上限的归入画布上的「其他」），保证侧栏色点与画布一一对应
  const cats = useMemo(() => hubs.filter((h) => h.group === '分类').sort((a, b) => b.count - a.count).slice(0, MAX_SECTORS), [data]);
  const tags = useMemo(() => hubs.filter((h) => h.group === '标签').sort((a, b) => b.count - a.count).slice(0, MAX_INNER), [data]);
  const s = data?.stats;
  const hubColorOf = (h) => sectorColor((h.group === '标签' ? tags : cats).indexOf(h), h.group === '标签');

  // 统计图数据：只喂「当前筛选后的文章」，所以点分类 / 标签或搜关键词时，下方统计图会一起收窄。
  // 做法是把原始 data 裁剪成只含这些文章的 nodes / links 子集，再交给纯函数算。
  const statData = useMemo(() => {
    if (!data) return null;
    const keep = new Set(filtered.map((p) => p.id));
    return {
      nodes: (data.nodes || []).filter((n) => n.kind === 'hub' || keep.has(n.id)),
      links: (data.links || []).filter((l) => keep.has(l.source) || keep.has(l.target))
    };
  }, [data, filtered]);
  const stats = useMemo(() => (statData ? blogStats(statData) : null), [statData]);

  const onPickNode = (n) => {
    if (n.kind === 'hub') { setPick(pick === n.id ? null : n.id); return; }
    const id = n.id.slice(2);
    route(`/posts/${id}`);
  };

  const pickLabel = hubs.find((h) => h.id === pick)?.label;

  return (
    <>
      <div class="sm-hud">
        <span class="sm-brand"><i class="sm-dot" />{MODES.blog.brand}</span>
        {s && <>
          <Stat label="ARTICLES" value={s.posts} accent="#ffb547" />
          <Stat label="CATEGORIES" value={s.categories} accent="#3ee6a8" />
          <Stat label="TAGS" value={s.tags} accent="#4cc9ff" />
          <Stat label="LINKS" value={s.links} />
        </>}
        <span class="sm-spacer" />
        {pickLabel && <button type="button" class="sm-chip" onClick={() => setPick(null)}>筛选中：{pickLabel} ✕</button>}
      </div>

      {error && <div class="sm-err">{error}</div>}

      <div class="sm-body">
        <div class="sm-canvas-box">
          <GraphCanvas view={view} data={data} mode="blog" onPick={onPickNode} label="博客图谱" />
          {data && <ViewSwitch view={view} onChange={setView} />}
        </div>

        {/* 搜索框 + 分类 / 标签两栏（2026-10-11 用户要求：只有这两栏，且与左侧画布等高、
            分类与标签全部平铺不留内部滚动条） */}
        <GraphSide
          placeholder="搜索文章标题…"
          query={q}
          onQuery={setQ}
          pick={pick}
          onPick={setPick}
          colorOf={hubColorOf}
          groups={[{ label: '分类', list: cats }, { label: '标签', list: tags }]}
        />
      </div>

      {/* 统计可视化：画布正下方，横跨两栏（2026-10-11 用户要求）。
          不再是「又一张流动图」，而是多维度组合统计：层级 → 交叉 → 时间 → 体量 → 健康度。 */}
      <section class="sm-viz">
        <div class="sm-viz-head">
          <div>
            <h2 class="sm-viz-title">{pickLabel ? `「${pickLabel}」的统计` : '内容统计'}</h2>
            <p class="sm-viz-sub">
              共 <strong>{filtered.length}</strong> 篇文章 · 下方图表按
              <b>分类 × 标签 流向</b>、<b>占比结构</b>、<b>体量排行</b>统计；
              点右侧分类 / 标签或搜索，统计范围会一起收窄。
            </p>
          </div>
        </div>
        {stats && filtered.length > 0 ? (
          <>
          <StatBoard ariaLabel="博客内容统计">
            {/* 第一张就是「分类 → 标签」的流向图：分类明确、从左往右流动的交叉带子。
                这是用户点名要的主图，其余统计图作为它的下钻。 */}
            <StatCard
              title="分类 → 标签 流向"
              sub="左边是分类、右边是标签，带子越宽说明同时属于该分类且带该标签的文章越多；带子上有流动光。"
              wide
            >
              <FlowSankey
                columns={stats.flow.columns}
                links={stats.flow.links}
                height={Math.max(360, stats.flow.columns[0].nodes.length * 26 + 60)}
                ariaLabel="分类到标签的流向图"
              />
            </StatCard>

            {/* 2026-10-11 本轮删除（用户点名）：分类×标签构成、分类×标签交叉热度、
                每月发文。它们的信息已被上面的流向图和下面的体量排行覆盖。 */}
            <StatCard title="分类体量" sub={`共 ${stats.totals.categories} 个分类`}>
              <RankBars items={stats.catRank} ariaLabel="分类排行" />
            </StatCard>

            <StatCard title="标签体量" sub={`共 ${stats.totals.tags} 个标签`}>
              <RankBars items={stats.tagRank} ariaLabel="标签排行" />
            </StatCard>
            {/* 同时删掉：内容构成雷达、内容健康度仪表。 */}
          </StatBoard>
          {/* 本轮新增的 8 张图：原有图表一行未改，这里只是追加 */}
          <ExtraCharts stats={stats} mode="blog" />
          </>
        ) : (
          <EmptyState
            icon="graph"
            title={filtered.length ? '暂时没有可统计的数据' : '这个筛选下没有文章'}
            hint={pickLabel ? '换一个分类或标签，或清掉搜索关键词。' : '公开的文章会出现在这里。'}
          />
        )}
      </section>
    </>
  );
}

// ---------------- 开源项目图谱 ----------------
function RepoGraph() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [pick, setPick] = useState(null);
  const [q, setQ] = useState('');
  const [view, setView] = useDefaultView();    // 2d | 3d

  useEffect(() => {
    let alive = true;
    api.getRepoGraph().then((d) => { if (alive) setData(d); }).catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, []);

  const repos = useMemo(() => (data?.nodes || []).filter((n) => n.kind === 'leaf'), [data]);
  const linkByRepo = useMemo(() => {
    const m = new Map();
    (data?.links || []).forEach((l) => {
      const repo = l.source.startsWith('r:') ? l.source : (l.target.startsWith('r:') ? l.target : null);
      const other = repo === l.source ? l.target : l.source;
      if (!repo) return;
      if (!m.has(repo)) m.set(repo, []);
      m.get(repo).push(other);
    });
    return m;
  }, [data]);

  const filtered = useMemo(() => {
    let l = repos;
    if (pick) l = l.filter((r) => r.parent === pick || (linkByRepo.get(r.id) || []).includes(pick));
    const kw = q.trim().toLowerCase();
    if (kw) l = l.filter((r) => [r.label, r.owner, r.one, r.lang, r.cat].join(' ').toLowerCase().includes(kw));
    return [...l].sort((a, b) => (b.stars || 0) - (a.stars || 0));
  }, [repos, pick, q, linkByRepo]);


  const hubs = (data?.nodes || []).filter((n) => n.kind === 'hub');
  const langs = hubs.filter((h) => h.group === '编程语言').sort((a, b) => b.count - a.count).slice(0, MAX_SECTORS);
  const cats = hubs.filter((h) => h.group === '应用分类').sort((a, b) => b.count - a.count).slice(0, MAX_INNER);
  const s = data?.stats;
  // 与画布星区同色：语言走外圈色序，应用分类走内圈色序
  const hubColorOf = (h) => {
    const list = (h.group === '编程语言' ? langs : cats);
    return sectorColor(list.indexOf(h), h.group === '应用分类');
  };

  // 统计图数据：只喂「当前筛选后的仓库」，与博客图谱同一套做法（裁剪 nodes 子集再交给纯函数）。
  const statData = useMemo(() => {
    if (!data) return null;
    const keep = new Set(filtered.map((r) => r.id));
    return {
      nodes: (data.nodes || []).filter((n) => n.kind === 'hub' || keep.has(n.id)),
      links: []
    };
  }, [data, filtered]);
  const stats = useMemo(() => (statData ? repoStats(statData) : null), [statData]);

  const onPickNode = (n) => {
    if (n.kind === 'hub') { setPick(pick === n.id ? null : n.id); return; }
    if (n.url) window.open(n.url, '_blank', 'noopener');
  };

  const pickLabel = hubs.find((h) => h.id === pick)?.label;

  return (
    <>
      <div class="sm-hud">
        <span class="sm-brand"><i class="sm-dot" />{MODES.repos.brand}</span>
        {s && <>
          <Stat label="REPOS" value={s.repos} accent="#ffb547" />
          <Stat label="LANGUAGES" value={s.languages} accent="#4cc9ff" />
          <Stat label="CATEGORIES" value={s.categories} accent="#b48cff" />
          <Stat label="LINKS" value={s.links} />
        </>}
        <span class="sm-spacer" />
        {pickLabel && <button type="button" class="sm-chip" onClick={() => setPick(null)}>筛选中：{pickLabel} ✕</button>}
      </div>

      {error && <div class="sm-err">{error}</div>}

      <div class="sm-body">
        <div class="sm-canvas-box">
          <GraphCanvas view={view} data={data} mode="repos" onPick={onPickNode} label="开源项目图谱" />
          {data && <ViewSwitch view={view} onChange={setView} />}
        </div>

        {/* 搜索框 + 编程语言 / AI 应用分类两栏（与左侧画布等高，内容全部平铺不滚动） */}
        <GraphSide
          placeholder="搜索仓库名 / 关键词…"
          query={q}
          onQuery={setQ}
          pick={pick}
          onPick={setPick}
          colorOf={hubColorOf}
          groups={[
            { label: '编程语言', list: langs },
            { label: 'AI 应用分类', list: cats, empty: cats.length === 0 ? 'AI 解读中…' : '' }
          ]}
        />
      </div>

      {/* 统计可视化：画布正下方，横跨两栏（2026-10-11 用户要求）。
          用户已多次删减，现在只剩：流向图 + 占比点阵 + 矩形树图 + 语言/分类体量排行。 */}
      <section class="sm-viz">
        <div class="sm-viz-head">
          <div>
            <h2 class="sm-viz-title">{pickLabel ? `「${pickLabel}」的统计` : '收藏统计'}</h2>
            <p class="sm-viz-sub">
              共 <strong>{filtered.length}</strong> 个仓库 · 按 <b>编程语言</b>、
              <b>应用分类</b>、<b>体量排行</b>统计；
              点右侧语言 / 分类或搜索，统计范围会一起收窄。
            </p>
          </div>
        </div>
        {stats && filtered.length > 0 ? (
          <>
          <StatBoard ariaLabel="开源项目统计">
            {/* 主图：编程语言 → 应用分类 的流向图（与博客图谱同一套视觉语言） */}
            <StatCard
              title="语言 → 应用分类 流向"
              sub="左边是编程语言、右边是应用分类，带子越宽说明该语言下属于该分类的仓库越多；带子上有流动光。"
              wide
            >
              <FlowSankey
                columns={stats.flow.columns}
                links={stats.flow.links}
                height={Math.max(360, stats.flow.columns[0].nodes.length * 26 + 60)}
                ariaLabel="编程语言到应用分类的流向图"
              />
            </StatCard>

            {/* 2026-10-11 用户点名删除：语言×应用分类构成、语言×应用分类交叉热度、
                语言×star 分布、每月新增收藏、收藏健康度仪表。 */}
            <StatCard title="语言体量" sub={`共 ${stats.totals.languages} 种语言`}>
              <RankBars items={stats.langRank} ariaLabel="编程语言排行" />
            </StatCard>

            <StatCard title="应用分类体量" sub={`共 ${stats.totals.categories} 个分类`}>
              <RankBars items={stats.catRank} ariaLabel="应用分类排行" />
            </StatCard>
          </StatBoard>
          {/* 本轮新增的 8 张图：原有图表一行未改，这里只是追加 */}
          <ExtraCharts stats={stats} mode="repos" />
          </>
        ) : (
          <EmptyState
            icon="github"
            title={filtered.length ? '暂时没有可统计的数据' : '这个筛选下没有仓库'}
            hint={pickLabel ? '换一个语言或分类，或清掉搜索关键词。' : '同步 GitHub Star 后，这里会出现统计。'}
          />
        )}
      </section>
    </>
  );
}

// ---------------- 页面 ----------------
export function GraphHub({ mode: modeProp = 'blog' }) {
  const [mode, setMode] = useState(MODES[modeProp] ? modeProp : 'blog');
  useEffect(() => { if (MODES[modeProp]) setMode(modeProp); }, [modeProp]);
  const M = MODES[mode];

  const switchTo = (k) => {
    if (k === mode) return;
    setMode(k);
    route(MODES[k].path, true);
  };

  return (
    <section class="sm">
      <div class="sm-head">
        <div class="sm-head-text">
          <span class="sm-kicker">{M.kicker}</span>
          <h1>{M.title}</h1>
          <p>{M.sub}</p>
        </div>
        <nav class="sm-tabs" role="tablist">
          {Object.values(MODES).map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={mode === x.key ? 'true' : 'false'}
              class={`sm-tab${mode === x.key ? ' on' : ''}`} onClick={() => switchTo(x.key)}>{x.title}</button>
          ))}
        </nav>
      </div>

      {mode === 'blog' ? <BlogGraph /> : <RepoGraph />}
    </section>
  );
}

export function GraphHubEmpty() {
  return <EmptyState icon="graph" title="图谱不存在" hint="试试「博客图谱」或「开源项目图谱」。" />;
}
