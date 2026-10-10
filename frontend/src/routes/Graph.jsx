// 图谱页 =「知识库控制台」
// 顶部状态条 · 中间流动管线图（左：内容来源 → 中：总线 → 右：标签/应用分类，光点沿曲线流动）· 底部四块仪表盘
// 数据：GET /api/graph/console，页面打开时每 60 秒刷新；标签页隐藏时暂停动画。
// 旧的 D3 力导向关系图保留为「经典视图」。
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { GraphView } from '../components/GraphView.jsx';
import '../styles/graph-console.css';

const POLL = 60_000;
const PALETTE = ['#3ee6a8', '#ff5c8a', '#ffb547', '#4cc9ff', '#b48cff', '#ff8a3d', '#7cf06b', '#f5e663'];
const SRC_COLOR = { 's:movie': '#ff5c8a', 's:music': '#b48cff', 's:video': '#ffb547', 's:github': '#4cc9ff' };
const KIND = { post: ['博客', '#3ee6a8'], star: ['STAR', '#ffb547'], ai: ['AI', '#4cc9ff'], movie: ['影视', '#ff5c8a'], music: ['音乐', '#b48cff'], video: ['视频', '#ffb547'] };

// 稳定伪随机：同一条线每次刷新位置不变
function rnd(seed) { let x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); }

function useCountUp(value) {
  const [v, setV] = useState(value || 0);
  const from = useRef(value || 0);
  useEffect(() => {
    const start = from.current; const end = value || 0; const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / 900);
      setV(Math.round(start + (end - start) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = end;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return v;
}

function Stat({ label, value, accent }) {
  const v = useCountUp(value);
  return <span class="gc-stat"><i>{label}</i><b style={accent ? `color:${accent}` : ''}>{v.toLocaleString()}</b></span>;
}

function fmtTime(t) {
  const d = new Date(t); if (Number.isNaN(+d)) return '';
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

// ---------------- 流动管线图 ----------------
function FlowStage({ data, onPick, pulse }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const geo = useRef(null);          // 计算好的曲线
  const hover = useRef(null);
  const [hoverKey, setHoverKey] = useState(null);

  const colorOf = useMemo(() => {
    const m = new Map();
    data.left.forEach((n, i) => m.set(n.key, SRC_COLOR[n.key] || PALETTE[i % PALETTE.length]));
    return m;
  }, [data]);
  const maxL = Math.max(1, ...data.left.map((n) => n.count));
  const maxR = Math.max(1, ...data.right.map((n) => n.count));

  // 量出每张卡片位置 → 生成曲线（左卡右缘 → 总线 → 右卡左缘）
  const measure = () => {
    const w = wrap.current; const c = canvas.current;
    if (!w || !c) return;
    const box = w.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = box.width * dpr; c.height = box.height * dpr;
    c.style.width = `${box.width}px`; c.style.height = `${box.height}px`;
    const pos = {};
    w.querySelectorAll('[data-k]').forEach((el) => {
      const r = el.getBoundingClientRect();
      pos[el.dataset.k] = { l: r.left - box.left, r: r.right - box.left, t: r.top - box.top, h: r.height };
    });
    const bus = w.querySelector('.gc-bus').getBoundingClientRect();
    const bx = bus.left - box.left + bus.width / 2;
    const bt = bus.top - box.top; const bh = bus.height;
    const curves = [];
    data.flows.forEach(([a, b], i) => {
      const A = pos[a]; const B = pos[b];
      if (!A || !B) return;
      const y0 = A.t + 8 + rnd(i) * (A.h - 16);
      const ym = bt + 10 + rnd(i + 7.3) * (bh - 20);
      const y1 = B.t + 6 + rnd(i + 3.1) * (B.h - 12);
      const x0 = A.r; const x1 = B.l;
      curves.push({ a, b, color: colorOf.get(a) || '#888', pts: [
        [x0, y0], [x0 + (bx - x0) * 0.55, y0], [bx - (bx - x0) * 0.25, ym], [bx, ym],
        [bx + (x1 - bx) * 0.35, ym], [x1 - (x1 - bx) * 0.45, y1], [x1, y1]
      ] });
    });
    geo.current = { curves, dpr, w: box.width, h: box.height };
    drawStatic();
  };

  const at = (p, t) => {
    // 两段三次贝塞尔：t∈[0,.5) 第一段，[.5,1] 第二段
    const s = t < 0.5 ? 0 : 3; const u = t < 0.5 ? t * 2 : (t - 0.5) * 2; const v = 1 - u;
    const P0 = p[s], P1 = p[s + 1], P2 = p[s + 2], P3 = p[s + 3];
    return [v * v * v * P0[0] + 3 * v * v * u * P1[0] + 3 * v * u * u * P2[0] + u * u * u * P3[0],
      v * v * v * P0[1] + 3 * v * v * u * P1[1] + 3 * v * u * u * P2[1] + u * u * u * P3[1]];
  };

  // 静态线层画到离屏画布，动画帧只叠加光点
  const staticLayer = useRef(null);
  const drawStatic = () => {
    const g = geo.current; if (!g) return;
    const off = staticLayer.current || (staticLayer.current = document.createElement('canvas'));
    off.width = g.w * g.dpr; off.height = g.h * g.dpr;
    const ctx = off.getContext('2d');
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    ctx.clearRect(0, 0, g.w, g.h);
    const hk = hover.current;
    g.curves.forEach((c) => {
      const on = hk && (c.a === hk || c.b === hk);
      ctx.strokeStyle = hk ? (on ? c.color : 'rgba(255,255,255,0.025)') : 'rgba(230,220,210,0.10)';
      ctx.lineWidth = on ? 1.1 : 0.7;
      const p = c.pts;
      ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
      ctx.bezierCurveTo(p[1][0], p[1][1], p[2][0], p[2][1], p[3][0], p[3][1]);
      ctx.bezierCurveTo(p[4][0], p[4][1], p[5][0], p[5][1], p[6][0], p[6][1]);
      ctx.stroke();
    });
  };

  // 光点
  const particles = useRef([]);
  const spawn = (n, filter) => {
    const g = geo.current; if (!g || !g.curves.length) return;
    const pool = filter ? g.curves.filter(filter) : g.curves;
    if (!pool.length) return;
    for (let i = 0; i < n; i++) {
      const c = pool[Math.floor(Math.random() * pool.length)];
      particles.current.push({ c, t: 0, sp: 0.0025 + Math.random() * 0.004, big: !!filter });
    }
  };
  useEffect(() => { if (pulse) spawn(60, (c) => c.a === 's:github' || c.a.startsWith('c:')); }, [pulse]);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [data]);

  useEffect(() => {
    let raf; let last = 0;
    const frame = (ts) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      const g = geo.current; const c = canvas.current;
      if (!g || !c) return;
      const dt = Math.min(3, (ts - last) / 16.7 || 1); last = ts;
      const target = Math.min(260, 40 + g.curves.length / 3);
      const hk = hover.current;
      const live = particles.current.filter((p) => !p.big).length;
      if (live < target) spawn(Math.ceil((target - live) / 20), hk ? (x) => x.a === hk || x.b === hk : null);
      const ctx = c.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      if (staticLayer.current) ctx.drawImage(staticLayer.current, 0, 0);
      ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      particles.current = particles.current.filter((p) => {
        p.t += p.sp * dt;
        if (p.t >= 1) return false;
        if (hk && !(p.c.a === hk || p.c.b === hk) && !p.big) return false;
        const [x, y] = at(p.c.pts, p.t);
        const [tx, ty] = at(p.c.pts, Math.max(0, p.t - 0.02));
        const grd = ctx.createLinearGradient(tx, ty, x, y);
        grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, p.c.color);
        ctx.strokeStyle = grd; ctx.lineWidth = p.big ? 2.2 : 1.4;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = p.c.color;
        ctx.beginPath(); ctx.arc(x, y, p.big ? 2.2 : 1.3, 0, Math.PI * 2); ctx.fill();
        return true;
      });
      ctx.globalCompositeOperation = 'source-over';
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const enter = (k) => { hover.current = k; setHoverKey(k); particles.current = particles.current.filter((p) => p.big); drawStatic(); };
  const leave = () => { hover.current = null; setHoverKey(null); drawStatic(); };

  const card = (n, color, max) => (
    <button
      key={n.key}
      type="button"
      class={`gc-card${hoverKey === n.key ? ' on' : ''}${hoverKey && hoverKey !== n.key ? ' dim' : ''}`}
      data-k={n.key}
      style={`--c:${color}`}
      onMouseEnter={() => enter(n.key)} onMouseLeave={leave} onFocus={() => enter(n.key)} onBlur={leave}
      onClick={() => onPick(n)}
    >
      <span class="gc-card-h"><em>{n.label}</em><b>{n.count}</b></span>
      <span class="gc-meter"><span style={`width:${Math.max(4, (n.count / max) * 100)}%`} /></span>
      <span class="gc-card-f">{n.group} · {((n.count / max) * 100).toFixed(0)}%</span>
    </button>
  );

  const rightColor = (n, i) => (n.group === '应用分类' ? '#4cc9ff' : (n.color && n.color !== '#8f8f8f' ? n.color : PALETTE[(i + 2) % PALETTE.length]));

  return (
    <div class="gc-stage" ref={wrap}>
      <canvas ref={canvas} class="gc-canvas" />
      <div class="gc-col gc-left">
        {data.left.map((n) => card(n, colorOf.get(n.key), maxL))}
      </div>
      <div class="gc-bus"><span>BUS · {data.flows.length} flows</span></div>
      <div class="gc-right">
        {data.right.map((n, i) => card(n, rightColor(n, i), maxR))}
      </div>
    </div>
  );
}

// ---------------- 仪表盘 ----------------
function RunLog({ events, fresh }) {
  return (
    <div class="gc-panel">
      <header><span>RUN LOG</span><i>{events.length} events</i></header>
      <ol class="gc-log">
        {events.map((e) => {
          const [k, c] = KIND[e.kind] || [e.kind, '#aaa'];
          return (
            <li key={`${e.kind}${e.id}${e.t}`} class={fresh.has(`${e.kind}${e.id}`) ? 'new' : ''}>
              <time>{fmtTime(e.t)}</time><b style={`color:${c}`}>{k}</b><span>{e.text}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Dist({ data }) {
  const blog = data.left.filter((n) => n.group === '博客').sort((a, b) => b.count - a.count).slice(0, 7);
  const apps = data.right.filter((n) => n.group === '应用分类').slice(0, 7);
  const Bars = ({ list, color }) => {
    const max = Math.max(1, ...list.map((x) => x.count));
    return list.map((x) => (
      <div class="gc-bar" key={x.key}>
        <span>{x.label}</span>
        <i><em style={`width:${(x.count / max) * 100}%;background:${color}`} /></i>
        <b>{x.count}</b>
      </div>
    ));
  };
  return (
    <div class="gc-panel">
      <header><span>DISTRIBUTION</span><i>博客分类 / 应用分类</i></header>
      <div class="gc-dist">
        <div><Bars list={blog} color="#3ee6a8" /></div>
        <div>{apps.length ? <Bars list={apps} color="#4cc9ff" /> : <p class="gc-mute">AI 解读中…</p>}</div>
      </div>
    </div>
  );
}

function Heat({ heat }) {
  const days = [];
  const today = new Date(Date.now() + 8 * 36e5); today.setUTCHours(0, 0, 0, 0);
  const start = new Date(today); start.setUTCDate(start.getUTCDate() - 52 * 7 - today.getUTCDay());
  for (let d = new Date(start); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
    const k = d.toISOString().slice(0, 10); days.push([k, heat[k] || 0]);
  }
  const max = Math.max(1, ...days.map((d) => d[1]));
  const total = days.reduce((s, d) => s + d[1], 0);
  const lv = (n) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  return (
    <div class="gc-panel">
      <header><span>ACTIVITY · 365d</span><i>{total} 次新增</i></header>
      <div class="gc-heat">
        {days.map(([k, n]) => <span key={k} class={`l${lv(n)}`} title={`${k}：${n}`} />)}
      </div>
      <p class="gc-mute">文章发布 · GitHub Star · 影视/音乐收藏，按天统计（北京时间）</p>
    </div>
  );
}

function AiPanel({ s }) {
  const pct = s.github ? Math.round((s.ai_done / s.github) * 100) : 0;
  const done = useCountUp(s.ai_done);
  const eta = s.ai_pending ? Math.ceil(s.ai_pending / 2) : 0;
  return (
    <div class="gc-panel">
      <header><span>AI 解读</span><i>Workers AI · qwen3</i></header>
      <div class="gc-ai">
        <div class="gc-big">{done}<small>/ {s.github}</small></div>
        <div class="gc-prog"><span style={`width:${pct}%`} /></div>
        <dl>
          <div><dt>完成率</dt><dd>{pct}%</dd></div>
          <div><dt>待处理</dt><dd>{s.ai_pending}</dd></div>
          <div><dt>失败</dt><dd>{s.ai_failed}</dd></div>
          <div><dt>预计</dt><dd>{eta ? `${eta} 分钟` : '已完成'}</dd></div>
        </dl>
      </div>
    </div>
  );
}

// ---------------- 页面 ----------------
export function Graph() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('console');
  const [classic, setClassic] = useState(null);
  const [fresh, setFresh] = useState(new Set());
  const [pulse, setPulse] = useState(0);
  const [clock, setClock] = useState(new Date());
  const seen = useRef(null);

  async function load(retry = 1) {
    try {
      const d = await api.getGraphConsole().catch((e) => {
        if (retry > 0) return new Promise((r) => setTimeout(r, 1500)).then(() => api.getGraphConsole());
        throw e;
      });
      const keys = new Set(d.events.map((e) => `${e.kind}${e.id}`));
      if (seen.current) {
        const nu = new Set([...keys].filter((k) => !seen.current.has(k)));
        if (nu.size) { setFresh(nu); setPulse((p) => p + 1); }
      }
      seen.current = keys;
      setData(d); setError('');
    } catch (e) { setError(e.message); }
  }

  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, POLL);
    const c = setInterval(() => setClock(new Date()), 1000);
    return () => { clearInterval(t); clearInterval(c); };
  }, []);

  useEffect(() => {
    if (view === 'classic' && !classic) api.getGraph().then(setClassic).catch((e) => setError(e.message));
  }, [view]);

  function onPick(n) {
    const [kind, id] = n.key.split(':');
    if (kind === 'c') route(id === 'none' ? '/posts' : `/posts?cat=${encodeURIComponent(n.slug || id)}`);
    else if (kind === 't') route(`/posts?tag=${encodeURIComponent(n.slug || id)}`);
    else if (kind === 'a') route(`/github?cat=${encodeURIComponent(id)}`);
    else if (kind === 's') route({ movie: '/movies', music: '/music', video: '/videos', github: '/github' }[id] || '/');
  }

  function onSelect(node) {
    if (node.type === 'post') route(`/posts/${node.id}`);
    else if (node.type === 'resource' && node.resource_type === 'movie') route(`/movies/${node.id}`);
    else if (node.type === 'resource' && node.resource_type === 'music') route(`/music/${node.id}`);
    else if (node.type === 'resource' && node.url) window.open(node.url, '_blank');
  }

  const s = data?.stats;
  return (
    <section class="gc">
      <div class="gc-hud">
        <span class="gc-brand"><i class="gc-dot" />dora-graph</span>
        {s && <>
          <Stat label="NODES" value={s.nodes} />
          <Stat label="FLOWS" value={s.flows} />
          <Stat label="POSTS" value={s.posts} accent="#3ee6a8" />
          <Stat label="TAGS" value={s.tags} />
          <Stat label="影视" value={s.movies} accent="#ff5c8a" />
          <Stat label="音乐" value={s.music} accent="#b48cff" />
          <Stat label="GITHUB" value={s.github} accent="#4cc9ff" />
          <Stat label="AI" value={s.ai_done} accent="#f5e663" />
        </>}
        <span class="gc-clock">{clock.toLocaleTimeString('zh-CN', { hour12: false })}</span>
        <span class="gc-tabs">
          <button type="button" class={view === 'console' ? 'on' : ''} onClick={() => setView('console')}>控制台</button>
          <button type="button" class={view === 'classic' ? 'on' : ''} onClick={() => setView('classic')}>经典视图</button>
        </span>
      </div>

      {error && <div class="gc-err">{error} <button type="button" class="gc-retry" onClick={() => load()}>重试</button></div>}

      {view === 'classic' ? (
        <div class="gc-classic">{classic ? <GraphView data={classic} onSelect={onSelect} /> : <p class="gc-mute">加载中…</p>}</div>
      ) : !data ? (
        <div class="gc-loading"><span /><span /><span /><p>正在接入数据总线…</p></div>
      ) : (
        <>
          <div class="gc-title"><h1>{s.posts + s.movies + s.music + s.videos + s.github} ITEMS</h1><p>{data.left.length} 个来源 · {data.right.length} 个去向 · {s.flows} 条连线 · 悬停卡片查看流向，点击进入</p></div>
          <FlowStage data={data} onPick={onPick} pulse={pulse} />
          <div class="gc-panels">
            <RunLog events={data.events} fresh={fresh} />
            <Dist data={data} />
            <Heat heat={data.heat} />
            <AiPanel s={s} />
          </div>
        </>
      )}
    </section>
  );
}
