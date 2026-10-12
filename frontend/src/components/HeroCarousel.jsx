// 首页大图轮换（Hero）：全幅宽、电影感的开场画面。
//
// 设计取舍：
//   1) 图片是站长的精选壁纸（public/hero/*.webp，2560×1440 + 1280×720 两档），
//      统一裁成 16:9，桌面出大图、窄屏走 -sm 变体，避免手机下浪费带宽。
//   2) 只把「上一张 / 当前 / 下一张」三张挂进 DOM：切图时前一张还留在窗口里，
//      交叉淡出才看得到；其余 15 张完全不进 DOM，不白白占内存和流量。
//   3) 每张图缓慢推近（Ken Burns），配合 1.2s 交叉淡入，观感是「镜头在动」而不是「PPT 翻页」。
//   4) 尊重 prefers-reduced-motion：关掉推近与自动播放，只保留手动切换。
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './Icon.jsx';

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

// 2026-10-12 本轮改动（用户要求）：
//   · 巨型标题「把散落的碎片 / 收进一张星图」**移出首屏**，改到首屏下方
//     （见 LandingParts.jsx 的 TitleBand）——首屏只留大图、图注与两个按钮；
//   · 删掉「个人知识库」那行 kicker；
//   · 删掉首屏右上角的时钟与印章两个悬浮小组件（时钟移进 TitleBand）。
// 这样首屏就是一张干净的大图，标题落在它正下方，视线顺序变成
// 「先看到画面 → 再读到那句话 → 再往下读写在前面」。

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
  const [cur, setCur] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = usePrefersReducedMotion();
  const timer = useRef(null);

  const go = (i) => setCur(((i % n) + n) % n);

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
        <p class="ld-hero-sub">
          博客 · GitHub 收藏 · 图展 · 音乐 · 影视 —— 一个可以慢慢逛的个人知识库。
        </p>
        <div class="ld-hero-actions">
          <a class="ld-hero-btn" href="/news">开始浏览</a>
          <a class="ld-hero-btn ghost" href="/graph/blog">打开图谱</a>
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
