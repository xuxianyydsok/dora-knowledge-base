// 流动网络（FlowNetwork）：图谱页下方的高级可视化画布。
//
// 用途：把「全部文章」/「星标仓库」这类扁平列表，画成一张有呼吸感的流动网络——
// 参考站长给的参考图（密集连线 + 沿线的光点流动），而不是柱状图 / 条形图那种低级图。
//
// 设计取舍：
//   1) 节点按「分组」（分类 / 语言 / 应用分类）聚成色簇，簇心用黄金角螺旋摊开，
//      簇内再螺旋排布——不用力导向，省掉每帧迭代，上千节点也不卡。
//   2) 连线是**结构性**的：簇内相邻成链 + 少量跨簇桥接，光点沿这些线流动。
//      不追求「真实关系」，要的是密集流动的观感（与 StarMap 的取舍一致）。
//   3) 权重（仓库 star 数）用**节点半径 + 辉光强度**表达，这是「可视化」而不是画柱子。
//   4) 只用 Canvas 2D + rAF，不引第三方图形库；页面切到后台自动停帧。
//   5) 尊重 prefers-reduced-motion：静态画一帧，不跑动画。
import { useEffect, useRef, useState } from 'preact/hooks';

const GOLD = Math.PI * (3 - Math.sqrt(5));   // 黄金角，螺旋分布用
const MAX_NODES = 460;                        // 节点上限：再多就采样，保证流畅
const FLOW_EDGE_RATIO = 0.34;                 // 多少比例的边带流动光点

// 节点配色：高饱和彩虹色板，浅色 / 素雅主题下都够跳（与主题主色区分开）
export const FLOW_COLORS = [
  '#2f6bff', '#00b894', '#ff7a1a', '#e8397a', '#8b5cf6', '#0fb9b1',
  '#f2b705', '#ef476f', '#3a86ff', '#06d6a0', '#c77dff', '#ff6b35',
  '#118ab2', '#e0a800', '#7c4dff', '#00a8e8'
];

// 稳定的伪随机：同一个种子每次结果一样，避免刷新后布局乱跳
function rnd(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function clamp01(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// 黄金角螺旋：把 n 个点均匀摊在半径为 radius 的圆盘里（向日葵排布）
function spiral(i, n, radius) {
  const r = radius * Math.sqrt((i + 0.5) / Math.max(n, 1));
  const a = i * GOLD;
  return [r * Math.cos(a), r * Math.sin(a)];
}

// 把 items 摊成「分组色簇 + 节点 + 连线」
function buildScene(items, maxNodes) {
  const list = (items || []).slice(0, maxNodes);
  if (!list.length) return { nodes: [], edges: [], groups: [] };

  // 分组：按 group 字段聚合，组内保持传入顺序（上游已排好序）
  const byGroup = new Map();
  list.forEach((it, i) => {
    const g = it.group || '其他';
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push({ ...it, _i: i });
  });
  const groups = [...byGroup.entries()].sort((a, b) => b[1].length - a[1].length);

  // 权重归一：半径用 sqrt 压缩，避免一个超大 star 仓库把其它点压成针尖
  const weights = list.map((it) => Number(it.weight) || 1);
  const maxW = Math.max(...weights, 1);

  const nodes = [];
  const edges = [];
  const G = groups.length;

  groups.forEach(([label, members], gi) => {
    const color = FLOW_COLORS[gi % FLOW_COLORS.length];
    // 簇心：按「组内节点数」加权铺在圆盘上，大组占更靠中间的位置
    const [gx, gy] = spiral(gi, G, 0.34);
    // 簇半径随组大小增长，但收着点，避免相邻簇糊在一起
    const gr = 0.055 + 0.052 * Math.sqrt(members.length);
    const startIdx = nodes.length;

    members.forEach((m, mi) => {
      const [dx, dy] = spiral(mi, members.length, gr);
      const w = (Number(m.weight) || 1) / maxW;
      nodes.push({
        id: m.id,
        label: m.label,
        group: label,
        color,
        href: m.href || '',
        meta: m.meta || '',
        // 归一化坐标（0..1），渲染时再乘画布尺寸；留边距并夹住，避免点跑出画布
        x: clamp01(0.5 + gx + dx, 0.035, 0.965),
        y: clamp01(0.5 + gy + dy, 0.045, 0.955),
        // 半径：权重决定大小（3.2 ~ 8.2 px），这是「星标数可视化」的主体
        r: 3.2 + Math.sqrt(w) * 5.0,
        glow: 0.25 + Math.sqrt(w) * 0.75
      });
    });

    // 簇内连线：相邻成链（i→i+1）+ 隔位相连（i→i+3），形成网状而不是一条线
    for (let k = 0; k < members.length; k++) {
      const a = startIdx + k;
      if (k + 1 < members.length) edges.push({ a, b: startIdx + k + 1 });
      if (k + 3 < members.length) edges.push({ a, b: startIdx + k + 3 });
    }
  });

  // 跨簇桥接（第二遍：此时各组起点已知，随机配对，稳定种子）
  const groupRanges = [];
  let cursor = 0;
  groups.forEach(([, members]) => {
    groupRanges.push([cursor, cursor + members.length - 1]);
    cursor += members.length;
  });
  for (let gi = 0; gi < groupRanges.length; gi++) {
    const [s0, e0] = groupRanges[gi];
    const [s1, e1] = groupRanges[(gi + 1) % groupRanges.length];
    if (s0 > e0 || s1 > e1) continue;
    const a = s0 + Math.floor(rnd(gi * 7.13) * (e0 - s0 + 1));
    const b = s1 + Math.floor(rnd(gi * 3.71 + 1) * (e1 - s1 + 1));
    if (a !== b) edges.push({ a, b, bridge: true });
  }

  // 给一部分边挂流动光点（相位错开，看起来像连续不断的流光）
  const flowCount = Math.round(edges.length * FLOW_EDGE_RATIO);
  const step = Math.max(1, Math.floor(edges.length / Math.max(flowCount, 1)));
  edges.forEach((e, i) => {
    if (i % step === 0) {
      e.flow = {
        t: rnd(i * 5.7) ,          // 初始相位
        speed: 0.055 + rnd(i * 2.3) * 0.075,
        hue: rnd(i * 9.1)
      };
    }
  });

  return { nodes, edges, groups: groups.map(([label, m], i) => ({ label, count: m.length, color: FLOW_COLORS[i % FLOW_COLORS.length] })) };
}

export function FlowNetwork({ items, height = 420, maxNodes = MAX_NODES, ariaLabel = '流动网络图', onPick }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef({ nodes: [], edges: [] });
  const [tip, setTip] = useState(null);      // 悬停提示：{x, y, node}
  const [ready, setReady] = useState(false);

  const reduce = usePrefersReducedMotion();

  // 布局：只在数据变化时重算（渲染循环只读，不重排）
  useEffect(() => {
    sceneRef.current = buildScene(items, maxNodes);
    setReady(sceneRef.current.nodes.length > 0);
  }, [items, maxNodes]);

  // 渲染循环
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let W = 0, H = 0, dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = wrap.clientWidth;
      H = wrap.clientHeight;
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const px = (n) => n.x * W;
    const py = (n) => n.y * H;

    const frame = (now) => {
      const { nodes, edges } = sceneRef.current;
      ctx.clearRect(0, 0, W, H);
      if (!nodes.length) { raf = requestAnimationFrame(frame); return; }

      // ① 底层连线：极淡的彩色线，构成「网」
      ctx.lineWidth = 1;
      for (const e of edges) {
        const a = nodes[e.a], b = nodes[e.b];
        if (!a || !b) continue;
        ctx.strokeStyle = e.bridge
          ? hexA(a.color, 0.22)
          : hexA(a.color, 0.13);
        ctx.beginPath();
        ctx.moveTo(px(a), py(a));
        ctx.lineTo(px(b), py(b));
        ctx.stroke();
      }

      // ② 流动光点：沿边滑动的亮点 + 一小段拖尾
      if (!reduce) {
        for (const e of edges) {
          if (!e.flow) continue;
          const a = nodes[e.a], b = nodes[e.b];
          if (!a || !b) continue;
          const f = e.flow;
          f.t += f.speed * 0.016;
          if (f.t > 1) f.t -= 1;
          const x0 = px(a), y0 = py(a), x1 = px(b), y1 = py(b);
          const t = f.t;
          const x = x0 + (x1 - x0) * t;
          const y = y0 + (y1 - y0) * t;
          // 拖尾：从 t-0.06 到 t 的一小段
          const tt = Math.max(0, t - 0.07);
          const tx = x0 + (x1 - x0) * tt;
          const ty = y0 + (y1 - y0) * tt;
          const grad = ctx.createLinearGradient(tx, ty, x, y);
          grad.addColorStop(0, hexA(a.color, 0));
          grad.addColorStop(1, hexA(a.color, 0.85));
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(x, y);
          ctx.stroke();
          // 头部亮点
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(x, y, 1.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // ③ 节点：辉光 + 实心点（半径 = 权重）
      for (const n of nodes) {
        const x = px(n), y = py(n);
        // 辉光（权重越大越亮）
        ctx.fillStyle = hexA(n.color, 0.16 * n.glow);
        ctx.beginPath();
        ctx.arc(x, y, n.r * 2.6, 0, Math.PI * 2);
        ctx.fill();
        // 实心
        ctx.fillStyle = n.color;
        ctx.beginPath();
        ctx.arc(x, y, n.r, 0, Math.PI * 2);
        ctx.fill();
        // 高光
        ctx.fillStyle = hexA('#ffffff', 0.55);
        ctx.beginPath();
        ctx.arc(x - n.r * 0.28, y - n.r * 0.28, Math.max(0.7, n.r * 0.34), 0, Math.PI * 2);
        ctx.fill();
      }

      void now;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [reduce]);

  // 悬停：找最近的节点（20px 内），显示提示
  function nearest(ev) {
    const wrap = wrapRef.current;
    const { nodes } = sceneRef.current;
    if (!wrap || !nodes.length) return null;
    const rect = wrap.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    let best = null, bestD = 22 * 22;
    for (const n of nodes) {
      const dx = n.x * rect.width - mx;
      const dy = n.y * rect.height - my;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = n; }
    }
    return best ? { x: mx, y: my, node: best } : null;
  }

  function onMove(ev) {
    const hit = nearest(ev);
    setTip(hit);
    const wrap = wrapRef.current;
    if (wrap) wrap.style.cursor = hit && onPick ? 'pointer' : 'default';
  }

  function onClick(ev) {
    const hit = nearest(ev);
    if (hit && onPick) onPick(hit.node);
  }

  return (
    <div
      class="fv-wrap"
      ref={wrapRef}
      style={{ height: `${height}px` }}
      onMouseMove={onMove}
      onMouseLeave={() => setTip(null)}
      onClick={onClick}
      role="img"
      aria-label={ariaLabel}
    >
      <canvas class="fv-canvas" ref={canvasRef} />
      {!ready && <p class="fv-empty">暂无可视化的条目</p>}
      {tip && (
        <div
          class="fv-tip"
          style={{ left: `${tip.x}px`, top: `${tip.y}px` }}
        >
          <i style={{ background: tip.node.color }} />
          <span>{tip.node.label}</span>
          {tip.node.meta && <em>{tip.node.meta}</em>}
        </div>
      )}
    </div>
  );
}

// #rrggbb + alpha → rgba()：Canvas 里不能直接用 color-mix，这里手动拼
function hexA(hex, alpha) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const num = parseInt(v, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return reduce;
}
