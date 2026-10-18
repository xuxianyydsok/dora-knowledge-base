// 真实数据图表（2026-10-18）
//
// 来源：图鉴 #170 多维雷达 / #172 3D 柱阵 / #176 流图 / #197 吞吐曲线。
// 与图鉴原版的核心差异：**数据是真的**。
//   原版每 2.4 秒用 Math.random() 生成一组新数据，纯粹是「看起来很忙」；
//   这里接收 contentStats.js 聚合出的真实统计，数据本身是静态的。
//
// 但用户要求「保留视觉流动」——所以保留轻微的时间驱动动效：
//   · 雷达图：三条线入场时从中心展开（一次性），之后保持静止；
//   · 3D 柱阵：柱子高度固定，只有一层很淡的呼吸光（不改变数据）；
//   · 流图：真实数据画出的形状固定，只让网格线缓慢平移；
//   · 曲线：真实数据点固定，只有末端一个呼吸光点。
// 这样「数据可读」与「画面不呆板」两者兼得，且不会误导读者以为数据在变。
import { useEffect, useRef } from 'preact/hooks';

const CHART_FONT = '"PingFang SC", "Microsoft YaHei", "DejaVu Sans", sans-serif';
const MONO_FONT = 'ui-monospace, Menlo, Consolas, monospace';
const SERIF_FONT = 'Georgia, "Songti SC", "DejaVu Serif", serif';

function cssVar(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch { return fallback; }
}

// 统一 canvas 初始化（高分屏 + 尺寸变化）
function setup(canvas) {
  const ctx = canvas.getContext('2d');
  const size = { w: 0, h: 0 };
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    size.w = r.width;
    size.h = r.height;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  return { ctx, size, cleanup: () => ro.disconnect() };
}

// 通用循环：页面隐藏 / 滚出视口暂停
//
// draw 用 ref 保存，effect 只在挂载时跑一次。图表数据会随博客分类 / 标签
// 筛选变化；如果 effect 依赖 draw，每次筛选都会重建 rAF / ResizeObserver。
// 这里让最新 draw 替换旧闭包，既避免重建，也避免一直画旧数据。
function useChartLoop(ref, draw) {
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const { ctx, size, cleanup } = setup(canvas);
    let raf = 0;
    let visible = true;
    let running = true;
    let start = 0;
    let lastFrame = 0;

    const frame = (ms) => {
      if (!running) return;
      if (!start) start = ms;
      // 数据是静态的，只有很轻的视觉流动；30fps 足够，且能显著减少
      // 博客页同时挂 4 个 canvas 时的 CPU / GPU 占用。
      if (visible && !document.hidden && ms - lastFrame >= 33) {
        lastFrame = ms;
        drawRef.current(ctx, size, (ms - start) / 1000);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '120px' });
    io.observe(canvas);
    return () => { running = false; cancelAnimationFrame(raf); io.disconnect(); cleanup(); };
  }, []);
}

// ---------------------------------------------------------------
// 170 多维雷达：每个轴 = 一个分类，半径 ∝ 该分类的文章数
// ---------------------------------------------------------------
export function CategoryRadar({ items = [], height = 280 }) {
  const ref = useRef(null);
  const draw = (ctx, size, t) => {
    const { w, h } = size;
    if (!w || !h || !items.length) return;
    const n = items.length;
    const cx = w / 2;
    const cy = h / 2 + 6;
    const R = Math.min(w, h) * 0.33;
    const primary = cssVar('--primary', '#4a6cf7');
    const muted = cssVar('--text-muted', '#5b6472');
    const border = cssVar('--border', '#d9dfea');
    const labelBg = cssVar('--bg-elevated', '#fff');
    const text = cssVar('--text', '#10131a');

    // 最大值做归一化基准
    const max = Math.max(1, ...items.map((i) => i.value));
    // 入场动画：前 0.9 秒从中心展开（之后静止）
    const grow = Math.min(1, t / 0.9);
    const ease = 1 - Math.pow(1 - grow, 3);

    ctx.clearRect(0, 0, w, h);
    const pointAt = (i, k) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      return [cx + Math.cos(a) * R * k, cy + Math.sin(a) * R * k];
    };

    // 网格（5 圈）
    for (let ring = 1; ring <= 5; ring++) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const p = pointAt(i, ring / 5);
        if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
      }
      ctx.closePath();
      ctx.strokeStyle = border;
      ctx.globalAlpha = ring === 5 ? 0.55 : 0.28;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 轴线
    for (let i = 0; i < n; i++) {
      const p = pointAt(i, 1);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(p[0], p[1]);
      ctx.strokeStyle = border;
      ctx.globalAlpha = 0.35;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 数据面
    ctx.beginPath();
    items.forEach((it, i) => {
      const p = pointAt(i, (it.value / max) * ease);
      if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
    });
    ctx.closePath();
    ctx.fillStyle = primary;
    ctx.globalAlpha = 0.16;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = primary;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 顶点
    items.forEach((it, i) => {
      const p = pointAt(i, (it.value / max) * ease);
      ctx.beginPath();
      ctx.arc(p[0], p[1], 3.6, 0, Math.PI * 2);
      ctx.fillStyle = cssVar('--bg-elevated', '#fff');
      ctx.fill();
      ctx.strokeStyle = primary;
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // 轴标签 + 数值
    ctx.textAlign = 'center';
    items.forEach((it, i) => {
      const p = pointAt(i, 1.22);
      const label = it.name.length > 6 ? `${it.name.slice(0, 6)}…` : it.name;
      ctx.font = `11px ${CHART_FONT}`;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = labelBg;
      ctx.globalAlpha = 0.82;
      ctx.fillRect(p[0] - tw / 2 - 2, p[1] - 12, tw + 4, 28);
      ctx.globalAlpha = 1;
      ctx.fillStyle = muted;
      ctx.fillText(label, p[0], p[1] - 2);
      ctx.fillStyle = text;
      ctx.font = `700 13px ${MONO_FONT}`;
      ctx.fillText(String(it.value), p[0], p[1] + 14);
    });
  };

  useChartLoop(ref, draw);
  return <canvas ref={ref} class="mfx-canvas" style={{ height: `${height}px` }} role="img"
    aria-label={`分类雷达图：${items.map((i) => `${i.name} ${i.value} 篇`).join('，')}`} />;
}

// ---------------------------------------------------------------
// 172 3D 柱阵：等距投影的矩阵，柱高 = 分类×标签的文章数
// ---------------------------------------------------------------
export function MatrixBars({ cats = [], tags = [], matrix = [], height = 320 }) {
  const ref = useRef(null);
  const draw = (ctx, size, t) => {
    const { w, h } = size;
    if (!w || !h || !matrix.length || !matrix[0]?.length) return;
    const rows = matrix.length;
    const cols = matrix[0].length;
    const max = Math.max(1, ...matrix.flat());
    const primary = cssVar('--primary', '#4a6cf7');
    const border = cssVar('--border', '#d9dfea');
    const muted = cssVar('--text-muted', '#5b6472');

    // 等距投影参数
    const cell = Math.max(8, Math.min((w * 0.78) / (rows + cols), (h * 0.62) / (rows + cols)));
    const cx = w / 2;
    const cy = h * 0.42;
    const maxBar = cell * 6;
    const grow = Math.min(1, t / 1.0);
    const ease = 1 - Math.pow(1 - grow, 3);

    ctx.clearRect(0, 0, w, h);

    // 地面网格
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const px = cx + (i - j) * cell;
        const py = cy + (i + j) * cell * 0.5;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + cell, py + cell * 0.5);
        ctx.lineTo(px, py + cell);
        ctx.lineTo(px - cell, py + cell * 0.5);
        ctx.closePath();
        ctx.strokeStyle = border;
        ctx.globalAlpha = 0.25;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // 按深度排序（远的先画）
    for (let d = 0; d <= rows + cols - 2; d++) {
      for (let i = Math.max(0, d - cols + 1); i <= Math.min(d, rows - 1); i++) {
        const j = d - i;
        const v = matrix[i][j] || 0;
        if (!v) continue;
        const ratio = v / max;
        // 轻微呼吸：±3%，只影响视觉，不改变数据比例
        const breath = 1 + 0.03 * Math.sin(t * 1.2 + i * 0.4 + j * 0.3);
        const barH = (cell * 0.5 + ratio * maxBar) * ease * breath;

        const px = cx + (i - j) * cell;
        const py = cy + (i + j) * cell * 0.5;
        const topY = py - barH;

        // 三个面（顶 / 左 / 右），用主色不同明度
        // 注意：canvas 的 fillStyle **不认 color-mix()**，只能用具体颜色 + globalAlpha。
        // （这里用主色 + 不同 alpha 模拟明暗，与图鉴的三面着色思路一致。）
        const alpha = 0.35 + ratio * 0.5;
        ctx.fillStyle = primary;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(px, topY);
        ctx.lineTo(px + cell * 0.9, topY + cell * 0.45);
        ctx.lineTo(px + cell * 0.9, topY + cell * 0.45 + barH);
        ctx.lineTo(px, topY + barH);
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = alpha * 0.72;
        ctx.beginPath();
        ctx.moveTo(px, topY);
        ctx.lineTo(px - cell * 0.9, topY + cell * 0.45);
        ctx.lineTo(px - cell * 0.9, topY + cell * 0.45 + barH);
        ctx.lineTo(px, topY + barH);
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = alpha * 1.15;
        ctx.beginPath();
        ctx.moveTo(px, topY);
        ctx.lineTo(px + cell * 0.9, topY + cell * 0.45);
        ctx.lineTo(px, topY + cell * 0.9);
        ctx.lineTo(px - cell * 0.9, topY + cell * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // 轴名：分类沿左前边、标签沿右前边。没有它们，柱阵只有形状没有含义。
    // 矩阵只有两三个分类时，轴的中间项会和首尾重合；用去重后的下标
    // 同时限制最多 4 个标签，避免 7×7 时文字挤成一团。
    ctx.fillStyle = muted;
    ctx.font = `10px ${CHART_FONT}`;
    const pick = (n) => [...new Set([
      0, Math.floor((n - 1) / 3), Math.floor(((n - 1) * 2) / 3), n - 1
    ])];
    const short = (s) => (s.length > 5 ? `${s.slice(0, 5)}…` : s);
    ctx.textAlign = 'right';
    pick(rows).forEach((i) => {
      const px = cx - i * cell;
      const py = cy + i * cell * 0.5;
      ctx.fillText(short(cats[i] || ''), px - 7, py + cell * 0.5 + 3);
    });
    ctx.textAlign = 'left';
    pick(cols).forEach((j) => {
      const px = cx + j * cell;
      const py = cy + j * cell * 0.5;
      ctx.fillText(short(tags[j] || ''), px + 7, py + cell * 0.5 + 3);
    });
  };

  useChartLoop(ref, draw);
  // aria-label 在组件作用域里拼，不能用 draw 里的 rows/cols
  // （那是个真实踩过的坑：写在 draw 里会变成 ReferenceError，整页白屏）
  const rowCount = matrix.length;
  const colCount = matrix[0]?.length || 0;
  return <canvas ref={ref} class="mfx-canvas" style={{ height: `${height}px` }} role="img"
    aria-label={`分类×标签柱阵：${rowCount} 个分类 × ${colCount} 个标签`} />;
}

// ---------------------------------------------------------------
// 176 流图：每个分类一条带子，厚度 = 该月发文量
// ---------------------------------------------------------------
export function CategoryStream({ months = [], series = [], height = 300 }) {
  const ref = useRef(null);
  const draw = (ctx, size, t) => {
    const { w, h } = size;
    if (!w || !h || !series.length) return;
    const primary = cssVar('--primary', '#4a6cf7');
    const border = cssVar('--border', '#d9dfea');

    // 每条带子的颜色：主色按不同透明度（避免彩虹色与站点调性冲突）
    const alphas = [0.55, 0.45, 0.38, 0.32, 0.27, 0.23];

    const n = months.length;
    const left = 12;
    const right = 12;
    const top = 14;
    const bottom = 26;
    const cw = w - left - right;
    const ch = h - top - bottom;

    ctx.clearRect(0, 0, w, h);

    // 背景竖网格（缓慢左移，纯视觉）
    ctx.strokeStyle = border;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    const shift = (t * 12) % 48;
    for (let x = -shift; x < w + 48; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + ch);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 计算每个月的总厚度，用于堆叠
    const totals = months.map((_, i) => series.reduce((s, k) => s + (k.values[i] || 0), 0));
    const maxTotal = Math.max(1, ...totals);
    const scale = (ch * 0.86) / maxTotal;
    const midY = top + ch / 2;

    const xAt = (i) => left + (i / Math.max(1, n - 1)) * cw;

    // 从下往上堆叠：先算每条带子在每个月的上下边界
    const bounds = series.map(() => []);
    months.forEach((_, i) => {
      const total = totals[i] * scale;
      let y = midY + total / 2;   // 居中堆叠
      series.forEach((k, si) => {
        const thick = (k.values[i] || 0) * scale;
        bounds[si][i] = [y - thick, y];
        y -= thick;
      });
    });

    series.forEach((k, si) => {
      ctx.beginPath();
      // 上沿
      bounds[si].forEach((b, i) => {
        const x = xAt(i);
        if (i) ctx.lineTo(x, b[0]); else ctx.moveTo(x, b[0]);
      });
      // 下沿（反向）
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(xAt(i), bounds[si][i][1]);
      ctx.closePath();
      ctx.fillStyle = primary;
      ctx.globalAlpha = alphas[si % alphas.length];
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // 月份标签
    ctx.fillStyle = cssVar('--text-muted', '#5b6472');
    ctx.font = `10px ${MONO_FONT}`;
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.ceil(n / 6));
    months.forEach((m, i) => {
      if (i % step === 0) ctx.fillText(m, xAt(i), h - 8);
    });
  };

  useChartLoop(ref, draw);
  return <canvas ref={ref} class="mfx-canvas" style={{ height: `${height}px` }} role="img"
    aria-label={`按月流图：${series.map((s) => s.name).join('、')}`} />;
}

// ---------------------------------------------------------------
// 197 吞吐曲线：按天发文量的折线（真实数据）
// ---------------------------------------------------------------
export function DailyCurve({ days = [], height = 240, label = '每日发文量' }) {
  const ref = useRef(null);
  const draw = (ctx, size, t) => {
    const { w, h } = size;
    if (!w || !h || !days.length) return;
    const primary = cssVar('--primary', '#4a6cf7');
    const border = cssVar('--border', '#d9dfea');
    const muted = cssVar('--text-muted', '#5b6472');
    const text = cssVar('--text', '#10131a');

    const left = 34;
    const right = 16;
    const top = 16;
    const bottom = 26;
    const cw = w - left - right;
    const ch = h - top - bottom;
    const max = Math.max(1, ...days.map((d) => d.n));

    ctx.clearRect(0, 0, w, h);

    // 横向网格 + 刻度
    ctx.strokeStyle = border;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    for (let k = 0; k <= 4; k++) {
      const y = top + (ch * k) / 4;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + cw, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = muted;
    ctx.font = `10px ${MONO_FONT}`;
    ctx.textAlign = 'right';
    for (let k = 0; k <= 4; k++) {
      const v = Math.round((max * (4 - k)) / 4);
      ctx.fillText(String(v), left - 6, top + (ch * k) / 4 + 3);
    }

    const xAt = (i) => left + (i / Math.max(1, days.length - 1)) * cw;
    const yAt = (v) => top + ch * (1 - v / max);

    // 面积
    const grad = ctx.createLinearGradient(0, top, 0, top + ch);
    grad.addColorStop(0, primary);
    grad.addColorStop(1, 'transparent');
    ctx.beginPath();
    days.forEach((d, i) => (i ? ctx.lineTo(xAt(i), yAt(d.n)) : ctx.moveTo(xAt(i), yAt(d.n))));
    ctx.lineTo(xAt(days.length - 1), top + ch);
    ctx.lineTo(xAt(0), top + ch);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.18;
    ctx.fill();
    ctx.globalAlpha = 1;

    // 折线
    ctx.beginPath();
    days.forEach((d, i) => (i ? ctx.lineTo(xAt(i), yAt(d.n)) : ctx.moveTo(xAt(i), yAt(d.n))));
    ctx.strokeStyle = primary;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 末端呼吸光点（只这一个元素在动，不改变数据）
    const last = days[days.length - 1];
    const lx = xAt(days.length - 1);
    const ly = yAt(last.n);
    const pulse = 4 + 2.5 * (0.5 + 0.5 * Math.sin(t * 2.2));
    ctx.beginPath();
    ctx.arc(lx, ly, pulse, 0, Math.PI * 2);
    ctx.fillStyle = primary;
    ctx.globalAlpha = 0.22;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(lx, ly, 3, 0, Math.PI * 2);
    ctx.fillStyle = primary;
    ctx.fill();

    // 标题与合计
    ctx.textAlign = 'left';
    ctx.fillStyle = muted;
    ctx.font = '10px ui-monospace, Menlo, monospace';
    ctx.fillText(label.toUpperCase(), left, 12);
    ctx.fillStyle = text;
    ctx.font = `600 20px ${SERIF_FONT}`;
    ctx.fillText(String(days.reduce((s, d) => s + d.n, 0)), left, 36);
    ctx.fillStyle = muted;
    ctx.font = `10px ${CHART_FONT}`;
    ctx.fillText('篇', left + 24, 36);
  };

  useChartLoop(ref, draw);
  return <canvas ref={ref} class="mfx-canvas" style={{ height: `${height}px` }} role="img"
    aria-label={`${label}：最近 ${days.length} 天共 ${days.reduce((s, d) => s + d.n, 0)} 篇`} />;
}
