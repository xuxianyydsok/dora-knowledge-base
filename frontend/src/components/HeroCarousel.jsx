// 首页大图轮换（Hero）：全幅宽、电影感的开场画面。
//
// 设计取舍：
//   1) 图片是站长的精选壁纸（public/hero/*.webp，2560×1440 + 1280×720 两档），
//      统一裁成 16:9，桌面出大图、窄屏走 -sm 变体，避免手机下浪费带宽。
//   2) 只把「上一张 / 当前 / 下一张」三张挂进 DOM：切图时前一张还留在窗口里，
//      交叉淡出才看得到；其余 15 张完全不进 DOM，不白白占内存和流量。
//   3) 每张图缓慢推近（Ken Burns），配合 1.2s 交叉淡入，观感是「镜头在动」而不是「PPT 翻页」。
//   4) 尊重 prefers-reduced-motion：关掉推近与自动播放，只保留手动切换。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Icon } from './Icon.jsx';
import { charGradients, TITLE_GRADIENT } from '../lib/brandGradient.js';

// 站长本地「图片1」文件夹里的 50 张壁纸，挑出 18 张最有冲击力的做开场。
// label 用中文，是画面右下角的图注（用户不喜欢纯装饰的洋文标签）。
export const HERO_SLIDES = [
  { src: '/hero/hero-11.webp', label: '银灰色跑车' },
  { src: '/hero/hero-17.webp', label: '紫夜山谷' },
  { src: '/hero/hero-08.webp', label: '超空间' },
  { src: '/hero/hero-13.webp', label: '雷电将军' },
  { src: '/hero/hero-06.webp', label: '星穹轨道' },
  { src: '/hero/hero-18.webp', label: '窗影流光' },
  { src: '/hero/hero-04.webp', label: '流动几何' },
  { src: '/hero/hero-10.webp', label: '荒野公路' },
  { src: '/hero/hero-07.webp', label: '熔岩跑车' },
  { src: '/hero/hero-15.webp', label: '暗夜金属' },
  { src: '/hero/hero-12.webp', label: '深空秘境' },
  { src: '/hero/hero-02.webp', label: '概念跑车' },
  { src: '/hero/hero-16.webp', label: '几何三角' },
  { src: '/hero/hero-14.webp', label: '豪华轿车' },
  { src: '/hero/hero-03.webp', label: '凯迪拉克' },
  { src: '/hero/hero-09.webp', label: '紫罗兰夜' },
  { src: '/hero/hero-05.webp', label: '红色超跑' },
  { src: '/hero/hero-01.webp', label: '抽象绽放' }
];

const INTERVAL = 7000;   // 每张停留 7 秒
const WINDOW = 1;        // 当前索引前后各保留 1 张在 DOM 里

// 主标题两行（2026-10-12 用户要求改回上一版文案）：
// 站名 Dora / Studio 已经挪到首页「此刻」区的品牌铁屑卡片上（见 HomeNow.jsx），
// 这里回到之前那版「把散落的知识 / 收进一张星图」。
// 逐字错峰升起沿用《余白 · 博客首页》模板的写法（每字一个 span，translateY(112%)
// rotate(7deg) 起步，按 --d 错峰归位；hover 时单字上浮）。
// ⚠ 渐变为什么逐字切片、而不是在 h1 上用一次 background-clip:text：
//   每个字都要做 transform 动画（错峰升起），而 transform 会让这个字自成一层
//   合成层；父元素的 background-clip:text 裁不到别的合成层里的字形，整行会直接
//   变透明看不见。所以改成「按字在标题里的位置，算出它该分到的那一小段渐变」，
//   拼起来仍是一条连续的渐变，且与 transform 动画互不干扰。
const TITLE_LINES = ['把散落的知识', '收进一张星图'];

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

export function HeroCarousel() {
  const n = HERO_SLIDES.length;
  // 渐变按字切片只算一次（两行共 10 个字），不随轮播重算
  const gradients = useMemo(() => charGradients(TITLE_LINES, TITLE_GRADIENT), []);
  const [cur, setCur] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = usePrefersReducedMotion();
  const timer = useRef(null);
  const widgetRef = useRef(null);

  // 悬浮小组件的实时时钟（每秒走一格，只有指针在动，代价极低）
  useEffect(() => {
    const el = widgetRef.current;
    if (!el) return undefined;
    const hh = el.querySelector('.ld-clk-hh');
    const mh = el.querySelector('.ld-clk-mh');
    const sh = el.querySelector('.ld-clk-sh');
    const label = el.querySelector('.ld-hw-time');
    if (!hh || !mh || !sh || !label) return undefined;
    let raf = 0;
    const tick = () => {
      const d = new Date();
      const s = d.getSeconds();
      const m = d.getMinutes() + s / 60;
      const h = (d.getHours() % 12) + m / 60;
      // 12 小时制：每格 30°，以 (60,60) 为轴
      hh.setAttribute('transform', `rotate(${h * 30} 60 60)`);
      mh.setAttribute('transform', `rotate(${m * 6} 60 60)`);
      sh.setAttribute('transform', `rotate(${s * 6} 60 60)`);
      label.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      raf = setTimeout(tick, 1000);
    };
    tick();
    return () => clearTimeout(raf);
  }, []);

  const go = (i) => setCur(((i % n) + n) % n);

  // 逐字入场：进场 0.35s 后开始，每字 60ms 错峰（第二行整体晚 0.3s，和模板一致）。
  // 只跑一次；reduced-motion 时用 CSS 直接给终态（见 home-landing.css）。
  const [titled, setTitled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTitled(true), 350);
    return () => clearTimeout(t);
  }, []);

  // 自动播放：鼠标悬停 / 键盘聚焦 / 页面切到后台时暂停。
  useEffect(() => {
    if (reduce || paused) return undefined;
    const onVis = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    timer.current = setInterval(() => setCur((c) => (c + 1) % n), INTERVAL);
    return () => {
      clearInterval(timer.current);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [reduce, paused, n]);

  // 只在「当前 ± 1」这个窗口里挂图片，其余不进 DOM
  const mounted = [];
  for (let d = -WINDOW; d <= WINDOW; d++) mounted.push(((cur + d) % n + n) % n);
  const slide = HERO_SLIDES[cur];

  return (
    <section
      class="ld-hero"
      aria-roledescription="carousel"
      aria-label="首页精选大图"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusIn={() => setPaused(true)}
      onFocusOut={() => setPaused(false)}
    >
      <div class="ld-hero-media" aria-hidden="true">
        {mounted.map((i) => {
          const s = HERO_SLIDES[i];
          return (
            <img
              key={s.src}
              class={`ld-hero-img${i === cur ? ' on' : ''}`}
              src={s.src}
              srcSet={`${s.src.replace('.webp', '-sm.webp')} 1280w, ${s.src} 2560w`}
              sizes="100vw"
              alt=""
              decoding="async"
              fetchpriority={i === cur ? 'high' : 'low'}
            />
          );
        })}
        <div class="ld-hero-scrim" />
      </div>

      <div class="ld-hero-body">
        <p class="ld-hero-kicker">个人知识库</p>
        <h1 class={`ld-hero-title${titled ? ' is-in' : ''}`}>
          {TITLE_LINES.map((line, li) => (
            <span class="ld-hero-line" key={line}>
              {[...line].map((ch, ci) => {
                // 该字在整条渐变里的位置（0-based，跨两行连续）
                const idx = li === 0 ? ci : TITLE_LINES[0].length + ci;
                return (
                  <span
                    class="ld-hero-ch"
                    style={{ '--d': `${li * 0.3 + ci * 0.06}s`, '--ld-grad': gradients[idx] }}
                    key={`${li}-${ci}`}
                  >{ch}</span>
                );
              })}
            </span>
          ))}
          <span class="ld-hero-hl" aria-hidden="true" />
        </h1>
        <p class="ld-hero-sub">
          博客 · GitHub 收藏 · 图展 · 音乐 · 影视 —— 一个可以慢慢逛的个人知识库。
        </p>
        <div class="ld-hero-actions">
          <a class="ld-hero-btn" href="/news">开始浏览</a>
          <a class="ld-hero-btn ghost" href="/graph/blog">打开图谱</a>
        </div>
      </div>

      {/* 悬浮小组件（2026-10-11 新增，参考站长给的 blog-home-v2 模板）：
          实时时钟 + 一枚可点的印章。窄屏（≤1040px）自动隐藏，避免压住主文案。 */}
      <div class="ld-hero-widgets" ref={widgetRef} aria-hidden="true">
        <div class="ld-hw ld-hw-clock" style="--d:12;--rot:-3deg">
          <svg class="ld-clk" viewBox="0 0 120 120">
            <circle class="ld-clk-face" cx="60" cy="60" r="57" />
            <line class="ld-clk-hh" x1="60" y1="60" x2="60" y2="34" />
            <line class="ld-clk-mh" x1="60" y1="60" x2="60" y2="20" />
            <line class="ld-clk-sh" x1="60" y1="68" x2="60" y2="14" />
            <circle class="ld-clk-pin" cx="60" cy="60" r="3.2" />
          </svg>
          <p class="ld-hw-cap"><b class="ld-hw-time">--:--</b> 此刻</p>
        </div>
        <div class="ld-hw ld-hw-seal" style="--d:34;--rot:-8deg">
          <svg viewBox="0 0 80 80">
            <rect x="4" y="4" width="72" height="72" rx="7" fill="var(--seal)" />
            <rect x="9" y="9" width="62" height="62" rx="4" fill="none" stroke="#f5e9df" stroke-width="1.6" opacity=".7" />
            <g fill="#f5e9df" font-family="'Newsreader', serif" font-weight="700" font-size="27" text-anchor="middle">
              <text x="53" y="38">朵</text><text x="53" y="66">记</text>
              <text x="26" y="38">慢</text><text x="26" y="66">写</text>
            </g>
          </svg>
        </div>
      </div>

      <div class="ld-hero-bar">
        <span class="ld-hero-caption">{slide.label}</span>
        <div class="ld-hero-dots" role="tablist" aria-label="选择图片">
          {HERO_SLIDES.map((s, i) => (
            <button
              key={s.src}
              type="button"
              role="tab"
              aria-selected={i === cur ? 'true' : 'false'}
              aria-label={`第 ${i + 1} 张：${s.label}`}
              class={`ld-hero-dot${i === cur ? ' on' : ''}`}
              style={{ '--ld-interval': `${INTERVAL}ms` }}
              onClick={() => go(i)}
            >
              <span class="ld-hero-dot-fill" />
            </button>
          ))}
        </div>
        <div class="ld-hero-nav">
          <button type="button" class="ld-hero-arrow" aria-label="上一张" onClick={() => go(cur - 1)}>
            <Icon name="chevronLeft" size={18} />
          </button>
          <span class="ld-hero-count">{String(cur + 1).padStart(2, '0')} / {n}</span>
          <button type="button" class="ld-hero-arrow" aria-label="下一张" onClick={() => go(cur + 1)}>
            <Icon name="chevronRight" size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
