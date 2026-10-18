// 首页大图轮换（Hero）：全幅宽、电影感的开场画面。
//
// 2026-10-13 起：轮播内容**可以由站长在后台配置**（`hero_slides` 表 + `/api/hero/slides`）。
//   · 站长在图展里挑素材（图片或视频）加入首页轮播，不用改代码重新部署；
//   · 没配置时**回退到下面 HERO_SLIDES 里内置的 18 张图**，保证首页永远不为空；
//   · 视频：静音循环播放；站长可关掉静音（但浏览器会拦截带声音的自动播放，
//     此时视频不会自动播，需要用户点一下 —— 这是浏览器策略，不是 bug）。
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
import { api } from '../lib/api.js';

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
  // 轮播内容：优先用站长配置（接口返回），失败或为空则回退内置图片。
  // 用 useState + useEffect 而不是顶层 await：接口挂了首页也必须能正常显示。
  const [slides, setSlides] = useState(HERO_SLIDES);
  // 轮播图下方的摘要文案：站长可在 /admin/hero-subtitle 修改。
  // 接口失败 / 未配置时用内置文案，首页不会出现空白。
  const [subtitle, setSubtitle] = useState('博客 · GitHub 收藏 · 图展 · 音乐 · 影视 —— 一个可以慢慢逛的个人知识库。');

  useEffect(() => {
    let alive = true;
    api.listHeroSlides()
      .then((res) => {
        if (!alive) return;
        const items = (res?.items || []).filter((s) => s.media_url);
        if (items.length) {
          setSlides(items.map((s) => ({
            src: s.media_url,
            label: s.label || '',
            type: s.media_type,          // 'image' | 'video'
            muted: s.muted !== false,
            id: s.id
          })));
        }
      })
      .catch(() => { /* 接口失败：保持内置图片 */ });
    api.getSiteSettings()
      .then((res) => {
        if (!alive) return;
        const text = res?.hero_subtitle?.text;
        if (typeof text === 'string' && text.trim()) setSubtitle(text.trim());
      })
      .catch(() => { /* 接口失败：保持内置摘要 */ });
    return () => { alive = false; };
  }, []);

  const n = slides.length || 1;
  const [cur, setCur] = useState(0);
  const [paused, setPaused] = useState(false);
  // 用户手动改过静音状态的项（按 id 记）：true = 用户要声音，false = 用户要静音。
  // 没记录的项按站长在后台设的默认值（`muted` 字段）。视频默认静音 ——
  // 浏览器只允许「静音视频」自动播放，带声音的自动播放一律会被拦。
  const [unmuted, setUnmuted] = useState({});
  // 视频元素的真实 DOM 引用（按 slide key 记）。Preact 对 `muted` 属性的更新
  // 不够可靠，静音状态一律走 ref 直接写 DOM，见下面的同步 effect。
  const videoRefs = useRef({});
  const reduce = usePrefersReducedMotion();
  const timer = useRef(null);

  const go = (i) => setCur(((i % n) + n) % n);

  // 某一项当前是否静音：用户手动改过就以用户为准，否则用站长设的默认值。
  const isMuted = (s) => {
    if (!s || s.type !== 'video') return true;
    if (s.id && s.id in unmuted) return !unmuted[s.id];
    return s.muted !== false;
  };

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
  const slide = slides[cur] || {};
  const curIsVideo = slide.type === 'video';
  const curMuted = isMuted(slide);

  // 视频的静音与播放状态一律直接写 DOM：
  //   1) Preact 对 `muted` 这个属性（不是 attribute）的更新不可靠，
  //      只改 props 有时不会作用到正在播放的 <video> 上；
  //   2) 切张时元素在「±1 窗口」里可能只是从「下一张」变成「当前张」（key 不变、
  //      不重建），此时光改 `autoPlay` 属性**不会**让浏览器开始播放 ——
  //      必须显式 play()。这是实测踩到的坑。
  // 带声音的自动播放会被浏览器拦，play() 的 rejection 直接吞掉（用户手动点喇叭
  // 时不算自动播放，允许出声）；被拦也只是不出声，不该抛到界面上。
  useEffect(() => {
    const curKey = slide.id || slide.src;
    for (const [key, el] of Object.entries(videoRefs.current)) {
      if (!el) continue;
      const s = slides.find((x) => (x.id || x.src) === key);
      if (!s) continue;
      el.muted = isMuted(s);
      if (key === curKey) {
        if (el.paused) el.play?.().catch(() => {});
      } else if (!el.paused) {
        el.pause?.();
      }
    }
  }, [unmuted, cur, slides]);

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
          const s = slides[i];
          if (!s) return null;
          // 视频：静音 + 循环 + 自动播放（浏览器只放行静音自动播放）。
          // 站长在后台设了「不静音」时，浏览器会拦住自动播放，此时视频停在第
          // 一帧、由用户点下方喇叭按钮手动开声（这是浏览器策略，不是 bug）。
          if (s.type === 'video') {
            const key = s.id || s.src;
            return (
              <video
                key={key}
                ref={(el) => {
                  if (el) videoRefs.current[key] = el;
                  else delete videoRefs.current[key];
                }}
                class={`ld-hero-img ld-hero-video${i === cur ? ' on' : ''}`}
                src={s.src}
                muted={isMuted(s)}
                loop
                playsInline
                autoPlay={i === cur}
                preload={i === cur ? 'auto' : 'none'}
                poster=""
              />
            );
          }
          // 图片：内置图有 -sm 变体（窄屏省带宽）；后台配置的图直接用原图
          const isBuiltin = String(s.src).startsWith('/hero/');
          return (
            <img
              key={s.id || s.src}
              class={`ld-hero-img${i === cur ? ' on' : ''}`}
              src={s.src}
              {...(isBuiltin ? {
                srcSet: `${s.src.replace('.webp', '-sm.webp')} 1280w, ${s.src} 2560w`,
                sizes: '100vw'
              } : {})}
              alt=""
              decoding="async"
              fetchpriority={i === cur ? 'high' : 'low'}
            />
          );
        })}
        <div class="ld-hero-scrim" />
      </div>

      <div class="ld-hero-body">
        <p class="ld-hero-sub">{subtitle}</p>
        <div class="ld-hero-actions">
          <a class="ld-hero-btn" href="/news">开始浏览</a>
          <a class="ld-hero-btn ghost" href="/graph/blog">打开图谱</a>
        </div>
      </div>

      <div class="ld-hero-bar">
        <span class="ld-hero-caption">{slide.label}</span>
        {/* 视频的静音开关：只在当前是视频时出现。图片没有声音，不该有按钮。 */}
        {curIsVideo && (
          <button
            type="button"
            class={`ld-hero-sound${curMuted ? '' : ' on'}`}
            aria-label={curMuted ? '打开声音' : '静音'}
            title={curMuted ? '打开声音' : '静音'}
            onClick={() => {
              const key = slide.id;
              if (!key) return;
              setUnmuted((m) => ({ ...m, [key]: isMuted(slide) }));
            }}
          >
            <Icon name={curMuted ? 'volumeOff' : 'volume'} size={17} />
          </button>
        )}
        <div class="ld-hero-dots" role="tablist" aria-label="选择图片">
          {slides.map((s, i) => (
            <button
              key={s.id || s.src}
              type="button"
              role="tab"
              aria-selected={i === cur ? 'true' : 'false'}
              aria-label={`第 ${i + 1} 张：${s.label || ''}`}
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
