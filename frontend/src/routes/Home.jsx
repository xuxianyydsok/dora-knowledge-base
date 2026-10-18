// 首页：未登录展示「编辑式图谱」（Atlas）落地页；已登录展示控制台概览。
//
// 落地页内容与现状对齐：主模块以 components/Layout.jsx 的 PRIMARY 为事实来源；
// 「学习视频库」已于 2026-10-09 下线（见 docs/removed-features.md），不再出现。
// 新样式一律 ld- 前缀、只写在 styles/home-landing.css，避免与 global.css 冲突。
import { useEffect, useMemo, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { useBlogData } from '../lib/blogData.js';
import { Icon } from '../components/Icon.jsx';
import { LoadingState } from '../components/StateView.jsx';
import { HeroCarousel } from '../components/HeroCarousel.jsx';
import { PixelFlip } from '../components/PixelFlip.jsx';
import { HomeFlow } from '../components/HomeFlow.jsx';
import { HomeNow } from '../components/HomeNow.jsx';
// 动效装饰（2026-10-18，用户从图鉴里挑选）：
//   LiquidBlob  = #127 液态变形球（纯 CSS）
//   Harmonograph= #194 谐波绘图（canvas）
//   BreathingRings = #198 呼吸三环（canvas）
import { LiquidBlob } from '../components/MotionFx.jsx';
import { Harmonograph, BreathingRings } from '../components/CanvasFx.jsx';
import {
  AboutBlock, IntroBlock, Marquee, ProgressRing, Seal, SplitLines, TitleBand, useReveal
} from '../components/LandingParts.jsx';
import '../styles/home-landing.css';

// ---------------------------------------------------------------
// 站长公开收藏（音乐 / 影视共用一份请求）
// 音乐与影视的计数都来自同一个接口，模块表里两条各调一次会白白多发一次请求，
// 这里做一层「60 秒内只发一次」的缓存（带 TTL，站长新收藏的内容一分钟后会自己刷新）。
// ---------------------------------------------------------------
const ADMIN_FAV_TTL = 60000;
let adminFavCache = null;   // { at, promise }
function loadAdminFavorites() {
  const now = Date.now();
  if (!adminFavCache || now - adminFavCache.at > ADMIN_FAV_TTL) {
    const promise = api.listAdminFavorites().catch((err) => {
      adminFavCache = null;   // 失败不缓存，下次刷新还能重试
      throw err;
    });
    adminFavCache = { at: now, promise };
  }
  return adminFavCache.promise;
}

// ---------------------------------------------------------------
// 落地页内容事实：5 个主模块（= 一级导航里的资源模块）+ 6 项能力
// tone 只用于径向图的环/点、索引行与像素翻牌方块。
// 2026-10-12 用户要求：**不允许棕色、灰色这类偏暗色系**，改成多彩鲜艳的一组色，
// 保证在浅色主题下也足够醒目（原先那套低饱和棕灰色在浅底上显得发灰、发闷）。
// ---------------------------------------------------------------
const MODULES = [
  {
    key: 'posts', num: '01', name: '博客', short: '博客', latin: 'BLOG', latinShort: 'BLOG',
    desc: '长文与笔记', to: '/posts', tone: '#ff6b6b',
    load: () => api.listPosts(), count: (v) => (Array.isArray(v) ? v.length : null)
  },
  {
    key: 'github', num: '02', name: 'GitHub 收藏', short: 'GitHub', latin: 'REPOSITORIES', latinShort: 'REPO',
    desc: 'Star 同步与 AI 解读', to: '/github', tone: '#4dabf7',
    load: () => api.listGithub(), count: (v) => (Array.isArray(v) ? v.length : null)
  },
  {
    key: 'gallery', num: '03', name: '图展', short: '图展', latin: 'GALLERY', latinShort: 'GALLERY',
    desc: '策展式图片展览', to: '/gallery', tone: '#ffa94d',
    load: () => api.listGallery('?limit=200'), count: (v) => (Array.isArray(v?.items) ? v.items.length : null)
  },
  {
    key: 'music', num: '04', name: '音乐', short: '音乐', latin: 'MUSIC', latinShort: 'MUSIC',
    desc: '收藏与同步歌词', to: '/music', tone: '#9775fa',
    // ⚠ 访客看到的「音乐」= 站长公开收藏（/api/favorites/public）。
    // 直接调 listMusic() 时后端会叠加 is_public=true，站长的曲库多数不是公开标记，
    // 访客拿到的永远是空数组 —— 这正是「音乐 / 影视计数一直是 0」的原因。
    load: loadAdminFavorites,
    count: (v) => (Array.isArray(v) ? v.filter((f) => f?.target?.type === 'music').length : null)
  },
  {
    key: 'movies', num: '05', name: '影视', short: '影视', latin: 'FILMS', latinShort: 'FILMS',
    desc: '片单与在线播放', to: '/movies', tone: '#22d3ee',
    // 同上：访客口径的影视数 = 站长公开收藏里的 movie 条目
    load: loadAdminFavorites,
    count: (v) => (Array.isArray(v) ? v.filter((f) => f?.target?.type === 'movie').length : null)
  },
  {
    key: 'books', num: '06', name: '图书', short: '图书', latin: 'BOOKS', latinShort: 'BOOKS',
    desc: '电子书在线阅读', to: '/books', tone: '#51cf66',
    load: () => api.listBooks('?limit=200'), count: (v) => (Array.isArray(v?.items) ? v.items.length : null)
  }
];

const CAPABILITIES = [
  { num: '01', name: '时间轴', latin: 'TIMELINE', desc: '按时间聚合公开内容', to: '/timeline' },
  { num: '02', name: '碎念', latin: 'MOMENTS', desc: '朋友圈式的短动态', to: '/moments' },
  { num: '03', name: '图谱', latin: 'GRAPH', desc: '博客图谱 + 开源项目图谱', to: '/graph/blog' },
  { num: '04', name: '收藏', latin: 'FAVORITES', desc: '跨类型收藏夹', to: '/favorites' },
  { num: '05', name: '检索', latin: 'SEARCH', desc: '全部内容全文检索', to: '/search' },
  { num: '06', name: '备份', latin: 'BACKUP', desc: 'JSON 导出与导入', to: '/backup' }
];

// 底部第 02 块面板：把 6 项能力归成 3 组（对应参考图右下角的同心圆）
const CAP_GROUPS = [
  { label: '记录', latin: 'CAPTURE', tone: '#ff6b6b', items: ['时间轴', '碎念'] },
  { label: '组织', latin: 'ORGANIZE', tone: '#4dabf7', items: ['图谱', '收藏'] },
  { label: '取用', latin: 'RETRIEVE', tone: '#51cf66', items: ['检索', '备份'] }
];

// ---------------------------------------------------------------
// 径向图谱几何：viewBox 760×760，圆心 (380,380)
// 2026-10-12：viewBox 从 680 放大到 760。用户要求环外标签的数字「醒目一些」，
// 字号从 9px 提到 11.5px 后，右侧最长的标签（如「1,341 · GALLERY」）会顶到
// 原来的 680 边界外被 SVG 裁掉 —— 半径全部保持不变，只把画布四周各留出 40px。
// ---------------------------------------------------------------
const VB = 760;
const CX = VB / 2;
const CY = VB / 2;
const RAD = Math.PI / 180;
const RING_R0 = 78;                  // 最内环半径
const RING_GAP = 28;                 // 环间距
const SECTOR = 360 / MODULES.length; // 每个模块对应的标注角度
const TICK_R = RING_R0 + RING_GAP * (MODULES.length - 1) + 22; // 外侧刻度圈
const LABEL_R = 252;                 // 环外标签半径
const MAX_DOTS = 60;                 // 每环最多撒点数量

const ringR = (i) => RING_R0 + RING_GAP * i;
const polar = (r, deg) => [CX + r * Math.cos(deg * RAD), CY + r * Math.sin(deg * RAD)];
const n2 = (v) => Number(v.toFixed(2));
const line = (r0, a0, r1, a1) => {
  const [x0, y0] = polar(r0, a0);
  const [x1, y1] = polar(r1, a1);
  return `M ${n2(x0)} ${n2(y0)} L ${n2(x1)} ${n2(y1)}`;
};

// 每环内部的刻度感（沿环内侧的小刻度）
const RING_TICKS = MODULES.map((_, i) => {
  const r = ringR(i);
  const segs = [];
  for (let a = 0; a < 360; a += 6) segs.push(line(r - 5.5, a, r - 1.5, a));
  return segs.join(' ');
});

// 最外侧的编辑刻度尺：每 3° 一根细刻度，每 30° 一根长刻度
const SCALE_MINOR = [];
const SCALE_MAJOR = [];
for (let a = 0; a < 360; a += 3) {
  const long = a % 30 === 0;
  (long ? SCALE_MAJOR : SCALE_MINOR).push(line(TICK_R - (long ? 13 : 5), a, TICK_R, a));
}
const SCALE_MINOR_D = SCALE_MINOR.join(' ');
const SCALE_MAJOR_D = SCALE_MAJOR.join(' ');

const fmt = (v) => (v == null ? '—' : v.toLocaleString('en-US'));

// 径向图谱：同心环 = 模块，环上的点 = 条目，环外标注模块名
function Radial({ counts, active, onHover }) {
  const countOf = (key) => (counts && counts[key] !== undefined ? counts[key] : null);

  // 点按「条目数」撒，每环最多 60 个；数据没回来时先不撒点
  const dots = useMemo(() => {
    const out = [];
    MODULES.forEach((m, i) => {
      const v = countOf(m.key);
      if (!v) return;
      const n = Math.min(v, MAX_DOTS);
      const r = ringR(i);
      for (let k = 0; k < n; k++) {
        const deg = (360 / n) * k - 90 + (((k * 53) % 7) - 3) * 1.4;
        const rr = r + ((((k * 29) % 7) - 3) * 0.5);
        const [x, y] = polar(rr, deg);
        out.push({
          key: `${m.key}-${k}`, ring: i, tone: m.tone, x: n2(x), y: n2(y),
          delay: `${(0.12 + i * 0.14 + k * 0.008).toFixed(3)}s`
        });
      }
    });
    return out;
    // counts 变了才重新撒点
  }, [counts]);

  return (
    <div class="ld-canvas" data-active={active == null ? undefined : String(active)}>
      {/* 纯装饰图形：数据已通过左侧索引与右侧清单以文本形式给出，这里对读屏器隐藏 */}
      <svg class="ld-svg" viewBox={`0 0 ${VB} ${VB}`} aria-hidden="true">
        {/* 外侧编辑刻度尺（静止） */}
        <path class="ld-scale-minor" d={SCALE_MINOR_D} />
        <path class="ld-scale-major" d={SCALE_MAJOR_D} />

        {/* 同心环 + 环上撒点：整体极缓慢旋转（120s 一圈） */}
        <g class="ld-rotor">
          {MODULES.map((m, i) => {
            const r = ringR(i);
            return (
              <g
                key={m.key}
                class="ld-ring"
                data-ring={i}
                style={{ '--ld-delay': `${(0.12 + i * 0.14).toFixed(2)}s`, '--ld-tone': m.tone }}
              >
                <circle class="ld-ring-band" cx={CX} cy={CY} r={r} />
                <circle class="ld-ring-hair" cx={CX} cy={CY} r={r} />
                <path class="ld-ring-ticks" d={RING_TICKS[i]} />
              </g>
            );
          })}

          <g class="ld-orbit">
            {dots.map((d) => (
              <circle
                key={d.key}
                class="ld-dot"
                data-ring={d.ring}
                cx={d.x}
                cy={d.y}
                r="2.3"
                style={{ fill: d.tone, '--ld-delay': d.delay }}
              />
            ))}
          </g>
        </g>

        {/* 圆心 */}
        <g class="ld-core">
          <circle class="ld-core-ring" cx={CX} cy={CY} r="60" />
          <text class="ld-core-title" x={CX} y={CY - 2} text-anchor="middle">DORA</text>
          <text class="ld-core-sub" x={CX} y={CY + 17} text-anchor="middle">Studio</text>
          <text class="ld-core-meta" x={CX} y={CY + 33} text-anchor="middle">PERSONAL ATLAS</text>
        </g>

        {/* 环外模块名 + 引出线（静止，不随环旋转） */}
        {MODULES.map((m, i) => {
          // 6 个模块均分一圈，第一个落在正上方（-90°），顺时针排列
          const deg = -90 + SECTOR * i;
          const [lx, ly] = polar(LABEL_R, deg);
          const cos = Math.cos(deg * RAD);
          const anchor = cos > 0.2 ? 'start' : cos < -0.2 ? 'end' : 'middle';
          // 引出线从「本模块自己的环」拉到外侧标签，指向性更明确
          const [x0, y0] = polar(ringR(i) + 5, deg);
          const [x1, y1] = polar(TICK_R + 4, deg);
          return (
            <g
              key={m.key}
              class="ld-label"
              data-ring={i}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
            >
              <path class="ld-leader" d={`M ${n2(x0)} ${n2(y0)} L ${n2(x1)} ${n2(y1)}`} />
              <circle class="ld-leader-dot" cx={n2(x0)} cy={n2(y0)} r="2.4" style={{ fill: m.tone }} />
              <text class="ld-label-name" x={n2(lx)} y={n2(ly - 2)} text-anchor={anchor}>{m.short}</text>
              <text class="ld-label-meta" x={n2(lx)} y={n2(ly + 14)} text-anchor={anchor}>
                {fmt(countOf(m.key))} · {m.latinShort}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// 未登录落地页
function Landing() {
  const [counts, setCounts] = useState(null);
  const [active, setActive] = useState(null);
  // 公开图书（给「此刻」书架用）：失败就退回占位书脊，不影响页面
  const [books, setBooks] = useState([]);
  useEffect(() => {
    let alive = true;
    api.listBooks('?limit=40')
      .then((r) => { if (alive) setBooks(Array.isArray(r?.items) ? r.items : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  // 博客正文数据（文章 + 分类 + 标签）：走 blogData 的 60s 缓存，与 /posts 共用一份
  const { data: blog } = useBlogData(false);
  const posts = blog?.posts || [];
  const revealRef = useReveal([posts.length]);

  // 跑马灯文案：一级模块的中英对照（模板同款，用于「最近写的」下方那条大字带）
  const MARQUEE_ITEMS = MODULES.map((m) => ({ zh: m.short, en: m.latin }));

  // 数量在后台补：先渲染骨架（显示 —），任一个失败都不影响页面
  useEffect(() => {
    let alive = true;
    Promise.allSettled(MODULES.map((m) => m.load())).then((results) => {
      if (!alive) return;
      const next = {};
      results.forEach((res, i) => {
        const m = MODULES[i];
        next[m.key] = res.status === 'fulfilled' ? m.count(res.value) : null;
      });
      setCounts(next);
    });
    return () => { alive = false; };
  }, []);

  const countOf = (key) => (counts && counts[key] !== undefined ? counts[key] : null);
  const known = MODULES.map((m) => countOf(m.key)).filter((v) => typeof v === 'number' && v > 0);
  const total = counts ? known.reduce((a, b) => a + b, 0) : null;
  // 至少要有一个模块真的数出了条目，才认为数据可用；否则（加载中 / 接口全失败）
  // 都走骨架，不显示「站点是空的」。
  const hasAnyCount = counts != null && MODULES.some((m) => typeof countOf(m.key) === 'number');

  return (
    <div class="ld-page ld-editorial" ref={revealRef}>
      <HeroCarousel />

      {/* 巨型标题带（2026-10-12 用户要求）：从首屏大图上挪到它正下方、
          「写在前面」之前。文案把「知识」改成「碎片」；实时时钟也一并搬到这里
          （用户明确要求时钟不要删，只换位置）。呈现方式参照《blog-home-v2》首屏。 */}
      <TitleBand />

      {/* 01 · 最近写的：文章列表整块移除（2026-10-11 用户要求），
          但**保留标题与那条手绘横线**，下面换成一段站点简介。
          原因：首页不该堆文章清单（浏览入口交给 /posts 与 /timeline），
          但这一节是整个落地页的「开场白」，空着会突兀。 */}
      <section class="ld-sec ld-intro-sec">
        <div class="ld-sec-h" data-reveal>
          <SplitLines lines={['写在前面']} class="ld-sec-title" />
          <svg class="ld-rule" viewBox="0 0 1000 14" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 8C120 4 240 11 380 7S620 5 760 8 920 7 1000 7" />
          </svg>
        </div>
        <IntroBlock
          lines={[
            '这里收着我这些年散落的东西：写过的长文与笔记、收藏的开源项目、拍下的照片、读过的书，还有反复听过的歌与看过的影视。',
            '它们原本各自待在不同的 App 里，互不相识。现在被放进同一张图谱，彼此连起来 —— 顺着一条线，就能从一篇文章走到一个项目、一部作品。',
            '没有更新的焦虑，也不追热点。只是按自己的节奏慢慢攒，攒到某天回头看，发现它们已经长成了一张可以慢慢逛的星图。'
          ]}
        />
      </section>

      <Marquee items={MARQUEE_ITEMS} />

      {/* 02 · 此刻：可交互的 Bento 小组件区（品牌铁屑 / 写作日历 / 摘抄带 / 真实书架） */}
      <section class="ld-sec ld-now-sec">
        <div class="ld-sec-h" data-reveal>
          <h2>此刻</h2>
          <svg class="ld-rule" viewBox="0 0 1000 14" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 7C140 10 260 4 400 8S640 10 780 6 930 8 1000 7" />
          </svg>
        </div>
        <p class="ld-sec-sub">一些正在发生的小事。大多数都可以摸一摸、拖一拖、点一点。</p>
        <HomeNow posts={posts} books={books} />
      </section>

      {/* 03 · 站点构成：模块索引 + 径向星图 + 能力清单 + 聚合热力矩阵 */}
      <section class="ld-sec ld-atlas-sec">
        <div class="ld-sec-h" data-reveal>
          <h2>站点构成</h2>
          <svg class="ld-rule" viewBox="0 0 1000 14" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 7C140 10 260 4 400 8S640 10 780 6 930 8 1000 7" />
          </svg>
        </div>

      <div class="ld-meta">
        <p class="ld-meta-note">
          <strong>模块索引</strong>：一个环 = 一个模块，环上的点 = 条目（每环最多 60 个点）。
          数量来自公开只读接口，加载中显示 <em>—</em>，失败也不影响浏览。
          {total != null && total > 0
            ? <> 当前合计 <strong>{total.toLocaleString('en-US')}</strong> 条公开条目。</>
            : null}
        </p>
        <div class="ld-legend">
          {MODULES.map((m) => (
            <span key={m.key}>
              <i style={{ background: m.tone }} />
              {m.short}
            </span>
          ))}
        </div>
      </div>

      <div class="ld-grid">
        <nav class="ld-index" aria-label="模块索引">
          <div class="ld-index-head">内容模块</div>
          {MODULES.map((m, i) => (
            <a
              key={m.key}
              class="ld-index-row"
              href={m.to}
              style={{ '--ld-tone': m.tone }}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <span class="ld-index-num">{m.num}</span>
              <span class="ld-index-text">
                <strong class="ld-index-name">{m.name}</strong>
                <span class="ld-index-desc">{m.desc}</span>
              </span>
              <span class="ld-index-count">{fmt(countOf(m.key))}</span>
            </a>
          ))}
          <p class="ld-index-foot">另有 NewsNow 热榜（多源热榜聚合）入口。</p>
        </nav>

        <div class="ld-figure">
          <Radial counts={counts} active={active} onHover={setActive} />
          <p class="ld-figure-cap">
            {counts ? known.length : '—'} 个模块有公开条目 · 顺时针阅读
          </p>
        </div>

        <aside class="ld-tags" aria-label="能力清单">
          <div class="ld-tags-head">站点功能</div>
          <ul class="ld-tags-list">
            {CAPABILITIES.map((c) => (
              <li key={c.num}>
                <a class="ld-tag-row" href={c.to}>
                  <span class="ld-tag-num">{c.num}</span>
                  <span class="ld-tag-body">
                    <strong>{c.name}</strong>
                    <span>{c.desc}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <p class="ld-tags-note">
            右上角可切换三套配色：纯净 / 素雅 / 天青。登录后还能收到播放链接失效提醒。
          </p>
        </aside>
      </div>

      {/* 站点构成图谱（2026-10-11 用户要求：换成 112 模板的 A5 像素翻牌）。
          原先这里是三层同心环聚合图（HomeAtlas），已由像素翻牌取代。 */}
      <div class="ld-panels">
        <section class="ld-panel ld-panel-wide">
          <div class="ld-panel-head">
            <span class="ld-panel-title">站点构成图谱</span>
            <span class="ld-panel-sub">一个方块 = 一条公开条目，按模块占比铺满；指针扫过会由近及远翻牌</span>
          </div>
          {/* 2026-10-11 用户要求：把原来的三层聚合热力矩阵换成 112 模板的「A5 像素翻牌」。
              数据源不变（还是公开只读接口拿到的模块条目数），只换视觉与交互。 */}
          {/* ⚠ 计数未回来时不能直接喂给 PixelFlip —— 它会把「全是 null」
              理解成「真的没有数据」，显示空态文案，看起来像站点是空的。
              三种状态分开处理：加载中 → 骨架；全部失败 → 一句说明；
              有数 → 真图。后端冷启动有时要几十秒，这三种都必须看得懂。 */}
          {hasAnyCount ? (
            <PixelFlip
              groups={MODULES.map((m) => ({
                label: m.short,
                value: countOf(m.key),
                color: m.tone
              }))}
              height={340}
              ariaLabel="站点构成像素翻牌：一个方块代表一条公开条目"
            />
          ) : counts == null ? (
            <div class="ld-panel-skeleton" style={{ height: '340px' }} aria-hidden="true" />
          ) : (
            <p class="ld-panel-note">
              条目数暂时取不到（接口响应较慢），稍后刷新页面会重新加载。
            </p>
          )}
          <p class="ld-panel-note">
            方块按各模块的公开条目数占比分配，数值来自公开只读接口，未公开的记录不计入。
          </p>
        </section>
      </div>
      </section>

      {/* 03 · 关于：印章 + 逐字点亮的正文，背景垫一层流场画布做暗纹 */}
      <section class="ld-sec ld-about-sec">
        <div class="ld-about-flow" aria-hidden="true">
          <HomeFlow />
        </div>
        <div class="ld-sec-h" data-reveal>
          <h2>关于这个站点</h2>
          <svg class="ld-rule" viewBox="0 0 1000 14" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 7C140 10 260 4 400 8S640 10 780 6 930 8 1000 7" />
          </svg>
        </div>
        <AboutBlock
          text="这里是我整理思路的地方：博客放长文与笔记，GitHub 收开源项目并逐条做 AI 中文解读，图展、音乐、影视与图书各占一格。没有更新的焦虑，只有按自己的节奏慢慢攒下来的东西。"
          seal={<Seal ring="持续记录，自由阅读，慢慢生活，认真观察，" char="Dora" />}
        />
        <p class="ld-about-meta">
          已经收录 <b class="ld-num">{total == null ? '—' : total.toLocaleString('en-US')}</b> 条公开条目，
          分布在 <b class="ld-num">{MODULES.length}</b> 个模块里。
        </p>

        {/* 装饰区（2026-10-18）：三件纯视觉组件，不承载数据。
            为什么放在「关于」区块末尾：这里是全页唯一「可以慢下来看」的位置，
            而这三个组件都是持续动画，放在首屏会抢注意力。
            aria-hidden 让屏幕阅读器跳过 —— 它们只是装饰，没有信息量。 */}
        <div class="ld-fx-row" aria-hidden="true">
          <div class="ld-fx-cell"><LiquidBlob text="Dora" size={160} /></div>
          <div class="ld-fx-cell ld-fx-wide"><Harmonograph height={200} /></div>
          <div class="ld-fx-cell"><BreathingRings height={200} /></div>
        </div>
      </section>

      <section class="ld-cta">
        <div>
          <h2 class="ld-cta-title">从热榜与博客开始浏览</h2>
          <p class="ld-cta-note">访客可只读浏览全部公开内容；站长登录后可编辑、收藏与备份。</p>
        </div>
        <div class="ld-cta-actions">
          <a class="ld-btn" href="/news">开始浏览</a>
        </div>
      </section>

      <footer class="ld-foot">
        <div class="ld-foot-top">
          <p>把散落在各处的笔记、收藏与影像收进一张星图。慢慢看，不着急。</p>
          <nav class="ld-foot-links" aria-label="站点导航">
            <a href="/posts">博客</a>
            <a href="/graph/blog">图谱</a>
            <a href="/timeline">时间轴</a>
            <a href="/changelog">更新</a>
          </nav>
        </div>
        <div class="ld-wm-wrap" data-reveal aria-hidden="true">
          <span class="ld-wm">DoraStudio</span>
          <span class="ld-wm ld-wm-fill">DoraStudio</span>
        </div>
        <div class="ld-foot-bot">
          <span>© 2026 DoraStudio · 个人知识库</span>
          <span>访客可只读浏览全部公开内容</span>
        </div>
      </footer>

      <ProgressRing />
    </div>
  );
}

// 控制台用的模块元数据：磁贴 + 最近添加共用一份
const DASH_MODULES = [
  { key: 'posts', label: '博客', icon: 'blog', tone: 'indigo', to: '/posts', detail: (x) => `/posts/${x.id}`, load: () => api.listPosts() },
  { key: 'github', label: 'GitHub', icon: 'github', tone: 'slate', to: '/github', detail: () => '/github', load: () => api.listGithub() },
  { key: 'gallery', label: '图展', icon: 'grid', tone: 'amber', to: '/gallery', detail: () => '/gallery', load: () => api.listGallery('?limit=200').then((r) => r?.items || []) },
  { key: 'music', label: '音乐', icon: 'music', tone: 'teal', to: '/music', detail: (x) => `/music/${x.id}`, load: () => api.listMusic() },
  { key: 'movies', label: '影视', icon: 'movie', tone: 'violet', to: '/movies', detail: (x) => `/movies/${x.id}`, load: () => api.listMovies() },
  { key: 'books', label: '图书', icon: 'book', tone: 'rose', to: '/books', detail: () => '/books', load: () => api.listBooks('?limit=200').then((r) => r?.items || []) }
];

// 工具入口：控制台保留一键直达
const SHORTCUTS = [
  { to: '/search', icon: 'search', label: '全局搜索', desc: '跨全部资源检索' },
  { to: '/graph/blog', icon: 'graph', label: '博客图谱', desc: '看文章与标签的星图' },
  { to: '/favorites', icon: 'heart', label: '收藏夹', desc: '跨类型收藏' },
  { to: '/timeline', icon: 'clock', label: '时间轴', desc: '按时间回看内容' },
  { to: '/moments', icon: 'sparkles', label: '碎念', desc: '像朋友圈一样记录' },
  { to: '/backup', icon: 'backup', label: '备份', desc: '导出 / 导入 JSON' }
];

// 相对时间：控制台里「刚刚 / 3 小时前」比绝对时间更有信息量
function relTime(iso) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

function Dashboard() {
  const { isAdmin } = useAuth();
  const [counts, setCounts] = useState(null);
  const [recent, setRecent] = useState([]);

  // 一次并发拉取全部模块：同时得到「数量」和「最近添加」，避免两次请求
  useEffect(() => {
    let active = true;
    (async () => {
      const settled = await Promise.allSettled(DASH_MODULES.map((m) => m.load()));
      if (!active) return;
      const next = {};
      const items = [];
      settled.forEach((res, i) => {
        const mod = DASH_MODULES[i];
        const list = res.status === 'fulfilled' ? (res.value || []) : [];
        next[mod.key] = list.length;
        for (const row of list) {
          items.push({
            key: `${mod.key}-${row.id}`,
            title: row.title || '(无标题)',
            to: mod.detail(row),
            icon: mod.icon,
            tone: mod.tone,
            label: mod.label,
            at: row.created_at || row.updated_at || ''
          });
        }
      });
      setCounts(next);
      items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
      setRecent(items.slice(0, 6));
    })();
    return () => { active = false; };
  }, []);

  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : null;
  const today = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });

  return (
    <section class="console">
      <header class="console-head">
        <div class="console-greet">
          <span class="console-kicker">
            {today}
            {isAdmin && <em class="console-badge"><Icon name="crown" size={12} /> 管理员</em>}
          </span>
          <h1>欢迎回来</h1>
          <p class="muted">
            {total === null
              ? '正在汇总你的资源…'
              : <>已收录 <strong>{total}</strong> 条资源，分布在 {DASH_MODULES.length} 个模块。</>}
          </p>
        </div>
        <div class="console-actions">
          <button class="primary" onClick={() => route('/posts/new')}><Icon name="plus" size={16} /> 写博客</button>
          <button onClick={() => route('/music')}><Icon name="music" size={16} /> 找音乐</button>
          <button onClick={() => route('/movies')}><Icon name="movie" size={16} /> 找影视</button>
        </div>
      </header>

      <div class="dash-grid">
        {DASH_MODULES.map((m) => (
          <button key={m.key} class="dash-tile" onClick={() => route(m.to)}>
            <span class={`dash-icon tone-${m.tone}`}><Icon name={m.icon} size={20} /></span>
            <span class="dash-value">{counts ? counts[m.key] : '—'}</span>
            <span class="dash-label">{m.label}</span>
            <span class="dash-arrow"><Icon name="chevronRight" size={15} /></span>
          </button>
        ))}
      </div>

      <div class="console-cols">
        <section class="panel">
          <div class="panel-head">
            <h2>最近添加</h2>
            <a class="panel-more" href="/search">全部资源 <Icon name="chevronRight" size={13} /></a>
          </div>
          {recent.length === 0 ? (
            <div class="empty-state">
              <Icon name="sparkles" size={22} />
              <p>还没有任何资源</p>
              <span>从上面的快捷动作开始：写一篇博客，或收藏一首歌。</span>
            </div>
          ) : (
            <ul class="recent-list">
              {recent.map((r) => (
                <li key={r.key}>
                  <a class="recent-item" href={r.to}>
                    <span class={`recent-icon tone-${r.tone}`}><Icon name={r.icon} size={15} /></span>
                    <span class="recent-title">{r.title}</span>
                    <span class="recent-meta">{r.label} · {relTime(r.at)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>快捷入口</h2>
          </div>
          <div class="shortcut-grid">
            {SHORTCUTS.map((s) => (
              <a key={s.to} class="shortcut" href={s.to}>
                <span class="shortcut-icon"><Icon name={s.icon} size={17} /></span>
                <span class="shortcut-text">
                  <strong>{s.label}</strong>
                  <span>{s.desc}</span>
                </span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

export function Home() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingState shape="card" count={6} />;
  if (isAuthenticated) return <Dashboard />;
  return <Landing />;
}
