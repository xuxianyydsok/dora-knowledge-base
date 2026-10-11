// 流向图（FlowSankey）：从左往右的多列「能量流」图。
//
// 用途：把「分类 → 标签」「语言 → 应用分类」这类**多维归属关系**画成一张从左往右流动的
// 交叉带状图 —— 带子越宽代表数量越多，颜色由起点色渐变到终点色，带子上还有沿路径流动的光点。
// 参考用户给的意象：
//   「分类好，然后从左往右一直有那种流动性的、交叉的数以万计的线一直穿插而过」。
//
// 设计取舍：
//   1) 用 **SVG** 而不是 Canvas：带状图需要渐变 + 悬停高亮 + 逐条交互，SVG 天然支持；
//      条数在几十到一百多之间（上游已做 topN 截断），SVG 性能完全够。
//   2) 带宽 ∝ 数值；节点高度 ∝ 该节点出入边的较大值，节点之间按比例留缝，
//      整列看起来像一条被切开的量筒，视觉上就能读出占比。
//   3) 「流动感」= **真实光点**：每条带子按带宽挂几颗 <circle>，每帧用
//      path.getPointAtLength() 把它们放到带子中轴（spine）上滚动，透明度用 sin(u·π) 做
//      「两端淡、中间亮」。全部光点共用**一个** requestAnimationFrame；
//      不用 CSS 虚线 dashoffset —— 那只有一条线在动，表达不出「很多光在穿插」。
//   4) 省电：IntersectionObserver 让图滚出视口时**停掉 rAF**；
//      prefers-reduced-motion 时干脆不启动 rAF，光点静止在中点。
//   5) 交互：悬停节点 → 只亮它的出入边；悬停带子 → 只亮这一条；其余变暗。
//      数值用跟随鼠标的浮动 tooltip（SVG <title> 要悬停一秒才弹，太钝）。
//   6) 不做力导向、不做物理模拟 —— 布局是确定的，同一份数据每次画出来都一样。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

// 与 StatCharts 同源的色板（避免同一个分类在两个图里颜色不一致）
const FALLBACK_COLORS = [
  '#2f6bff', '#00b894', '#ff7a1a', '#e8397a', '#8b5cf6', '#0fb9b1',
  '#f2b705', '#ef476f', '#3a86ff', '#06d6a0', '#c77dff', '#ff6b35'
];

// 光点总量上限。每条带子按带宽挂点，但整张图必须封顶：
// 不封顶的话数据一多，每帧的 getPointAtLength 调用量会顶到几十万次，低端机直接掉帧。
const MAX_POINTS = 1600;

const SVG_NS = 'http://www.w3.org/2000/svg';

function colorOf(node, i) {
  return node.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length];
}

function fmtNum(n) {
  const v = Number(n) || 0;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(Math.round(v));
}

// 三次贝塞尔：起点 (x0,y0) → 终点 (x1,y1)，控制点水平外推，形成「S 形带子」
function ribbonPath(x0, y0, x1, y1) {
  const dx = Math.max(28, (x1 - x0) * 0.42);
  return `M ${x0} ${y0} C ${x0 + dx} ${y0}, ${x1 - dx} ${y1}, ${x1} ${y1}`;
}

// 把「有厚度」的边画成闭合路径：上沿正走、下沿倒走
function bandPath(x0, yTop0, x1, yTop1, thickness) {
  const dx = Math.max(28, (x1 - x0) * 0.42);
  return [
    `M ${x0} ${yTop0}`,
    `C ${x0 + dx} ${yTop0}, ${x1 - dx} ${yTop1}, ${x1} ${yTop1}`,
    `L ${x1} ${yTop1 + thickness}`,
    `C ${x1 - dx} ${yTop1 + thickness}, ${x0 + dx} ${yTop0 + thickness}, ${x0} ${yTop0 + thickness}`,
    'Z'
  ].join(' ');
}

/**
 * 流向图。
 *
 * @param {Object}   props
 * @param {Array}    props.columns  列定义：[{ title, nodes: [{ id, label, value, color }] }, ...]（2~3 列）
 * @param {Array}    props.links    连线：[{ source, target, value }]（id 全局唯一）
 * @param {number}   props.height   画布高度（px）
 * @param {string}   props.ariaLabel
 * @param {Function} props.valueFormat  自定义数值格式化
 * @param {number}   props.minLinkValue 低于该值的连线直接丢弃（避免一堆看不见的细线）
 */
export function FlowSankey({
  columns = [],
  links = [],
  height = 420,
  ariaLabel = '流向图',
  valueFormat = fmtNum,
  minLinkValue = 0
}) {
  const boxRef = useRef(null);
  const svgRef = useRef(null);
  const pointLayerRef = useRef(null);   // 光点容器：内容由 useEffect 命令式填充
  const tipRef = useRef(null);          // 跟随鼠标的 tooltip：位置用命令式写，避免每次 mousemove 都重渲染
  const pointsRef = useRef([]);         // 光点状态（DOM 引用 + 相位 / 速度）
  const hoverRef = useRef(null);        // 供 rAF 读取的当前高亮（不依赖 React state，省得重启循环）
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState(null);   // { node?: id } 或 { link?: index }

  // 容器宽度自适应：带子厚度是按像素算的，不能用 viewBox 非等比拉伸（会把带子压扁）
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0]?.contentRect?.width || 0);
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width || 0);
    return () => ro.disconnect();
  }, []);

  // ---------------------------------------------------------------
  // 布局计算（纯计算；数据 / 宽度变了才重算）
  // ---------------------------------------------------------------
  const layout = useMemo(() => {
    const cols = (columns || []).filter((c) => c && Array.isArray(c.nodes) && c.nodes.length);
    if (!cols.length || width <= 0) return null;

    const nodeById = new Map();
    cols.forEach((c, ci) => c.nodes.forEach((n, ni) => {
      nodeById.set(n.id, { ...n, col: ci, color: colorOf(n, ci * 7 + ni) });
    }));

    // 过滤：只保留两端都存在、且数值达标的连线
    const edges = [];
    (links || []).forEach((l) => {
      const s = nodeById.get(l.source);
      const t = nodeById.get(l.target);
      const v = Number(l.value) || 0;
      if (!s || !t || v <= 0 || v < minLinkValue) return;
      edges.push({ s, t, v });
    });

    const COL_WIDTH = 15;      // 节点竖条宽度
    const PAD_TOP = 22;        // 顶部给列标题留位置
    const PAD_BOTTOM = 14;
    const GAP = 14;            // 节点之间的最小间隙
    const COL_PAD = 10;        // 左右留白

    if (!edges.length) {
      // 没有连线也要把节点列画出来（只是没有带子），否则整块会空白
      return { colLayout: [], bands: [], width, height, COL_WIDTH };
    }

    // 节点体量：取「出边之和」与「入边之和」的较大值
    const outSum = new Map();
    const inSum = new Map();
    edges.forEach((e) => {
      outSum.set(e.s.id, (outSum.get(e.s.id) || 0) + e.v);
      inSum.set(e.t.id, (inSum.get(e.t.id) || 0) + e.v);
    });
    const sizeOf = (n) => Math.max(outSum.get(n.id) || 0, inSum.get(n.id) || 0, Number(n.value) || 0, 1);

    const usable = Math.max(60, height - PAD_TOP - PAD_BOTTOM);

    // 每列：按体量降序排列，按比例分配像素高度（带最小高度，保证标签可读）
    const colLayout = cols.map((c, ci) => {
      const nodes = c.nodes.map((n) => nodeById.get(n.id)).filter(Boolean).sort((a, b) => sizeOf(b) - sizeOf(a));
      const sizes = nodes.map(sizeOf);
      const sum = sizes.reduce((a, b) => a + b, 0) || 1;
      const avail = Math.max(30, usable - GAP * Math.max(0, nodes.length - 1));
      let heights = sizes.map((s) => Math.max(16, (s / sum) * avail));
      const total = heights.reduce((a, b) => a + b, 0);
      if (total > avail) heights = heights.map((h) => h * (avail / total));

      const out = [];
      let y = PAD_TOP;
      nodes.forEach((n, i) => {
        const h = Math.max(14, heights[i]);
        // outV / inV 顺带存下来：悬停节点时 tooltip 要显示「出多少 / 入多少」
        out.push({
          node: n, y, h, value: sizes[i],
          outV: outSum.get(n.id) || 0,
          inV: inSum.get(n.id) || 0
        });
        y += h + GAP;
      });
      return { ci, title: c.title, nodes: out, x: 0 };
    });

    // 列的水平位置。x 必须同时落到**每个节点盒子**上：画带子时取的是节点盒子，
    // 只写在列上会让 boxS.x 变成 undefined → 路径里出现 NaN → 带子整条画不出来。
    const usableW = Math.max(120, width - COL_PAD * 2);
    const step = colLayout.length > 1 ? (usableW - COL_WIDTH) / (colLayout.length - 1) : 0;
    colLayout.forEach((c, i) => {
      c.x = COL_PAD + step * i;
      c.nodes.forEach((n) => { n.x = c.x; });
    });

    const nodeBox = new Map();
    colLayout.forEach((c) => c.nodes.forEach((n) => nodeBox.set(n.node.id, n)));

    // 同一节点的边依次往下排（不能重叠）：游标记录「已分配到哪个 y」
    const outCursor = new Map();
    const inCursor = new Map();
    colLayout.forEach((c) => c.nodes.forEach((n) => {
      outCursor.set(n.node.id, 0);
      inCursor.set(n.node.id, 0);
    }));

    // 边厚度换算：把「边数值 / 节点体量」映射到「节点像素高度」
    const kOut = new Map();
    const kIn = new Map();
    colLayout.forEach((c) => c.nodes.forEach((n) => {
      const so = outSum.get(n.node.id) || 0;
      const si = inSum.get(n.node.id) || 0;
      kOut.set(n.node.id, so > 0 ? n.h / so : 0);
      kIn.set(n.node.id, si > 0 ? n.h / si : 0);
    }));

    // 按起点的 y 排序，让同一节点的出边从自身顶部依次排列
    const sorted = [...edges].sort((a, b) => {
      if (a.s.id !== b.s.id) return nodeBox.get(a.s.id).y - nodeBox.get(b.s.id).y;
      return nodeBox.get(a.t.id).y - nodeBox.get(b.t.id).y;
    });

    const bands = sorted.map((e, idx) => {
      const boxS = nodeBox.get(e.s.id);
      const boxT = nodeBox.get(e.t.id);
      const thS = Math.max(0.8, e.v * (kOut.get(e.s.id) || 0));
      const thT = Math.max(0.8, e.v * (kIn.get(e.t.id) || 0));
      const offS = outCursor.get(e.s.id) || 0;
      const offT = inCursor.get(e.t.id) || 0;
      outCursor.set(e.s.id, offS + thS);
      inCursor.set(e.t.id, offT + thT);

      const x0 = boxS.x + COL_WIDTH;
      const yTop0 = boxS.y + offS;
      const x1 = boxT.x;
      const yTop1 = boxT.y + offT;
      const th = Math.max(1, Math.min(thS, thT));
      return {
        key: `${e.s.id}->${e.t.id}`,
        idx,
        source: e.s,
        target: e.t,
        value: e.v,
        th,                                  // 实际像素厚度：光点数量与半径都由它决定
        color0: e.s.color,
        color1: e.t.color,
        d: bandPath(x0, yTop0, x1, yTop1, th),
        spine: ribbonPath(x0, yTop0 + th / 2, x1, yTop1 + th / 2)
      };
    });

    return { colLayout, bands, width, height, COL_WIDTH };
  }, [columns, links, width, height, minLinkValue]);

  // 把 hover 同步进 ref：rAF 循环每帧读它，这样悬停变化不必重启动画
  useEffect(() => { hoverRef.current = hover; }, [hover]);

  // -----------------------------------------------------------------
  // 光点：<circle> 用命令式建（几十~上千颗交给 Preact diff 不划算），
  // 位置 / 透明度由**单个** rAF 直接写属性，Preact 全程不参与。
  // -----------------------------------------------------------------
  useEffect(() => {
    const layer = pointLayerRef.current;
    const svg = svgRef.current;
    if (!layer || !svg || !layout || !layout.bands.length) return undefined;

    // 数据 / 宽度变了就重建全部光点（先清空上一轮）
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    pointsRef.current = [];

    // 通过 data-idx 找到每条带子的中轴路径（DOM 顺序不保证与布局顺序一致时更稳）
    const spineByIdx = new Map();
    svg.querySelectorAll('path.fs-band-spine').forEach((p) => {
      spineByIdx.set(Number(p.dataset.idx), p);
    });

    // 每条带子挂几颗点：∝ 带宽（越宽的带子光越多），再对全图总量封顶
    const counts = layout.bands.map((b) => Math.min(16, Math.max(2, Math.round(b.th / 3))));
    const total = counts.reduce((a, c) => a + c, 0) || 1;
    const scale = total > MAX_POINTS ? MAX_POINTS / total : 1;

    layout.bands.forEach((b, i) => {
      const path = spineByIdx.get(b.idx);
      const len = path ? path.getTotalLength() : 0;
      if (!path || !len) return;
      const n = Math.max(1, Math.round(counts[i] * scale));
      const r = Math.min(2.8, 1 + b.th / 18);   // 半径 ∝ 带宽，但封顶，避免粗带子上出现大球
      for (let k = 0; k < n; k += 1) {
        const dot = document.createElementNS(SVG_NS, 'circle');
        dot.setAttribute('class', 'fs-pt');
        dot.setAttribute('r', r.toFixed(2));
        dot.setAttribute('opacity', '0');
        layer.appendChild(dot);
        pointsRef.current.push({
          el: dot,
          path,
          len,
          band: b,
          phase: Math.random(),                  // 相位随机：否则所有光点会「齐步走」，像虚线在动
          speed: 0.05 + Math.random() * 0.06     // 速度随机：让流动有快有慢，更像真实流量
        });
      }
    });

    const place = (p, u) => {
      const pt = p.path.getPointAtLength(u * p.len);
      p.el.setAttribute('cx', pt.x.toFixed(2));
      p.el.setAttribute('cy', pt.y.toFixed(2));
    };

    // 用户要求「减少动态效果」时不启动 rAF：光点全部静止在中点（sin(0.5π)=1，最亮处）
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      pointsRef.current.forEach((p) => {
        place(p, 0.5);
        p.el.setAttribute('opacity', '0.5');
      });
      return undefined;
    }

    let raf = 0;
    let running = false;

    const draw = (time) => {
      const h = hoverRef.current;
      const t = time / 1000;
      for (const p of pointsRef.current) {
        // 悬停时被 dim 的带子直接把光点熄灭（比加 CSS 类更快，也不会和 rAF 抢属性）
        const dim = !h ? false
          : (h.link != null
            ? p.band.idx !== h.link
            : p.band.source.id !== h.node && p.band.target.id !== h.node);
        const u = (p.phase + t * p.speed) % 1;
        place(p, u);
        p.el.setAttribute('opacity', dim ? '0' : (Math.sin(u * Math.PI) * 0.95).toFixed(3));
      }
      raf = requestAnimationFrame(draw);
    };

    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(draw);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    // 图谱页下方那张图滚出视口后不该一直烧 CPU
    const io = new IntersectionObserver((entries) => {
      if (entries[0] && entries[0].isIntersecting) start();
      else stop();
    }, { rootMargin: '160px 0px' });
    io.observe(boxRef.current || svg);

    // IntersectionObserver 的回调要等下一帧才来；先同步判一次，避免首帧光点「闪一下才动」
    const rect = (boxRef.current || svg).getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) start();

    // 卸载 / 重建时：停帧 + 断开观察，避免 rAF 泄漏
    return () => {
      stop();
      io.disconnect();
      pointsRef.current = [];
    };
  }, [layout]);

  if (!layout) {
    return <div class="fs-box" ref={boxRef} style={{ height: `${height}px` }} aria-busy="true" />;
  }
  if (!layout.bands.length) {
    return (
      <div class="fs-box" ref={boxRef} style={{ height: `${height}px` }}>
        <p class="fs-empty">暂时没有可绘制的流向数据。</p>
      </div>
    );
  }

  const isDim = (b) => {
    if (!hover) return false;
    if (hover.link != null) return b.idx !== hover.link;
    if (hover.node) return b.source.id !== hover.node && b.target.id !== hover.node;
    return false;
  };
  const isHot = (b) => !!hover && ((hover.link != null && b.idx === hover.link)
    || (hover.node && (b.source.id === hover.node || b.target.id === hover.node)));

  // 数值 tooltip：用 getBoundingClientRect 把「视口坐标」换算成「容器内坐标」，
  // 这样容器随页面滚动、或窗口尺寸变化后，tooltip 也不会飘到别处。
  const showTip = (e, text) => {
    const el = tipRef.current;
    const box = boxRef.current;
    if (!el || !box) return;
    const rect = box.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.textContent = text;
    el.classList.add('on');
    const flipX = x > rect.width - 170;   // 贴右缘时向左翻转，否则会被 overflow:hidden 裁掉
    const flipY = y > rect.height - 40;   // 贴下缘时向上翻转
    el.style.transform = `translate(${flipX ? x - 14 : x + 14}px, ${flipY ? y - 12 : y + 16}px)`
      + (flipX ? ' translateX(-100%)' : '') + (flipY ? ' translateY(-100%)' : '');
  };
  const hideTip = () => {
    const el = tipRef.current;
    if (el) el.classList.remove('on');
  };
  // 离开整张图：清高亮 + 收 tooltip
  const clearHover = () => {
    setHover(null);
    hideTip();
  };

  const bandTip = (b) => `${b.source.label} → ${b.target.label} · ${valueFormat(b.value)}`;
  const nodeTip = (n) => {
    const o = n.outV || 0;
    const i = n.inV || 0;
    if (o > 0 && i > 0) return `${n.node.label} · 出 ${valueFormat(o)} · 入 ${valueFormat(i)}`;
    return `${n.node.label} · ${valueFormat(o || i || n.node.value)}`;
  };

  return (
    <div class="fs-box" ref={boxRef} style={{ height: `${height}px` }}>
      <svg
        class="fs-svg"
        ref={svgRef}
        width={layout.width}
        height={height}
        viewBox={`0 0 ${layout.width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        onPointerLeave={clearHover}
      >
        <defs>
          {layout.bands.map((b) => (
            <linearGradient key={`g-${b.key}`} id={`fsg-${b.idx}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color={b.color0} stop-opacity="0.62" />
              <stop offset="100%" stop-color={b.color1} stop-opacity="0.62" />
            </linearGradient>
          ))}
          {/* 共享的纵向高光：让带子看起来有厚度（上缘亮、中间透、下缘收），而不是一块纯色 */}
          <linearGradient id="fs-sheen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--text)', stopOpacity: 0.16 }} />
            <stop offset="42%" style={{ stopColor: 'var(--text)', stopOpacity: 0.02 }} />
            <stop offset="100%" style={{ stopColor: 'var(--text)', stopOpacity: 0.12 }} />
          </linearGradient>
        </defs>

        {/* 带子：渐变底 + 高光 + 内描边 + 中轴（中轴同时是光点的轨道） */}
        <g class="fs-bands">
          {layout.bands.map((b) => (
            <g
              key={b.key}
              class={`fs-band${isDim(b) ? ' dim' : ''}${isHot(b) ? ' hot' : ''}`}
              style={{ '--fs-i': b.idx }}
              onPointerEnter={() => setHover({ link: b.idx })}
              onPointerMove={(e) => showTip(e, bandTip(b))}
              onPointerLeave={clearHover}
            >
              <path class="fs-band-fill" d={b.d} fill={`url(#fsg-${b.idx})`} />
              <path class="fs-band-sheen" d={b.d} fill="url(#fs-sheen)" />
              <path class="fs-band-edge" d={b.d} fill="none" stroke={`url(#fsg-${b.idx})`} />
              <path class="fs-band-spine" data-idx={b.idx} d={b.spine} />
            </g>
          ))}
        </g>

        {/* 光点层：内容由上面的 useEffect 命令式填充，Preact 不参与 diff */}
        <g class="fs-points" ref={pointLayerRef} aria-hidden="true" />

        {/* 节点：竖条 + 名称 + 数值 */}
        <g class="fs-nodes">
          {layout.colLayout.map((c) => c.nodes.map((n) => {
            const hot = hover?.node === n.node.id
              || (hover?.link != null && (layout.bands[hover.link]?.source.id === n.node.id
                || layout.bands[hover.link]?.target.id === n.node.id));
            return (
              <g
                key={n.node.id}
                class={`fs-node${hot ? ' hot' : ''}`}
                style={{ color: n.node.color }}
                onPointerEnter={() => setHover({ node: n.node.id })}
                onPointerMove={(e) => showTip(e, nodeTip(n))}
                onPointerLeave={clearHover}
              >
                <rect
                  class="fs-node-bar"
                  x={c.x} y={n.y} width={layout.COL_WIDTH} height={n.h}
                  rx="4" fill={n.node.color}
                />
                <text
                  class="fs-node-label"
                  x={c.x + layout.COL_WIDTH + 7}
                  y={n.y + n.h / 2}
                  dominant-baseline="middle"
                >
                  {n.node.label}
                  <tspan class="fs-node-value" dx="6">{valueFormat(n.node.value)}</tspan>
                </text>
              </g>
            );
          }))}
        </g>

        {/* 列标题 */}
        <g class="fs-col-titles">
          {layout.colLayout.map((c) => (c.title ? (
            <text key={c.title} class="fs-col-title" x={c.x} y={12} dominant-baseline="middle">{c.title}</text>
          ) : null))}
        </g>
      </svg>

      {/* 浮动数值 tooltip：绝对定位在容器内，坐标由 showTip 每次移动时换算 */}
      <div class="fs-tip" ref={tipRef} aria-hidden="true" />
    </div>
  );
}

// 供外部构造数据时统一取色
export const SANKEY_COLORS = FALLBACK_COLORS;
