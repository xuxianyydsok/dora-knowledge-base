// 落地页的「编辑器式」零件（2026-10-11 改版）
// ------------------------------------------------------------------
// 参考站长给的《留白｜博客首页模板》，把首页下半部分换成同一套视觉语言：
//   纸色底 + 墨色字 + 发丝分隔线 + 衬线大标题 + 斜体拉丁数字 + 逐字点亮。
// 这里放的是可复用的零件，版面组装在 routes/Home.jsx 的 <Landing /> 里。
//
// 约定：类名统一 ld- 前缀；颜色一律走主题变量（--bg / --text / --primary），
//       不写死色值，这样三套主题（纯净 / 素雅 / 天青）都能直接生效。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { genCover, pickCover } from '../lib/genCover.js';

// 字符串 → 32 位整数种子（FNV-1a）。确定性：同一个 id 永远同一张封面。
function hashSeed(str) {
  let h = 2166136261;
  const s = String(str == null ? '' : str);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100000;
}

// 生成式封面：纯 SVG，不发任何图片请求。
// 用法 <Cover seed={post.id} />；同一个 seed 结果永远一致。
export function Cover({ seed = '', class: cls = '' }) {
  const key = String(seed);
  const inner = useMemo(() => genCover(pickCover(key), hashSeed(key)), [key]);
  return (
    <svg
      class={`ld-cv ${cls}`.trim()}
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

// 跑马灯：无限横向滚动的大字条。两组内容首尾相接，位移到 -50% 时无缝回到起点。
// 纯 CSS 动画，无常驻 rAF；prefers-reduced-motion 下由 CSS 关掉。
export function Marquee({ items = [] }) {
  if (!items.length) return null;
  const group = (suffix) => (
    <div class="ld-marq-group" key={`g-${suffix}`}>
      {items.map((it, i) => (
        <span class="ld-marq-item" key={`${suffix}-${it.zh}-${i}`}>
          <span class="ld-marq-zh">{it.zh}</span>
          <em class="ld-marq-en">{it.en}</em>
          <svg class="ld-marq-star" viewBox="0 0 40 40" aria-hidden="true">
            <path d="M20 2v36M2 20h36M7.3 7.3l25.4 25.4M32.7 7.3L7.3 32.7" />
          </svg>
        </span>
      ))}
    </div>
  );
  return (
    <div class="ld-marq" aria-hidden="true">
      <div class="ld-marq-track">
        {group('a')}
        {group('b')}
      </div>
    </div>
  );
}

// 逐字揭示标题：把每行拆成单字 span，靠 --i 做错峰上浮。
// 入场靠父级加 .in（见 home-landing.css 的 .ld-reveal）。
export function SplitLines({ lines = [], tag: Tag = 'h2', class: cls = '', start = 0 }) {
  let n = start;
  return (
    <Tag class={`ld-split ${cls}`.trim()}>
      {lines.map((line, li) => (
        <span class="ld-split-line" key={`l-${li}`}>
          {[...line].map((c, ci) => {
            const i = n;
            n += 1;
            return (
              <span class="ld-ch" style={{ '--i': i }} key={`c-${li}-${ci}`}>
                {c === ' ' ? '\u00A0' : c}
              </span>
            );
          })}
        </span>
      ))}
    </Tag>
  );
}

// 进场观察器：元素进入视口时加 .in（只触发一次）。
// 传 target 选择器可一次观察容器内的多个子元素。
export function useReveal(deps = []) {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const targets = [root, ...root.querySelectorAll('[data-reveal]')];
    if (typeof IntersectionObserver !== 'function') {
      targets.forEach((el) => el.classList.add('in'));
      return undefined;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -6% 0px' });
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

// 日期 → 2026.10.11（模板里的斜体拉丁数字就是这个格式）
export function dotDate(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (m) return `${m[1]}.${m[2]}.${m[3]}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (v) => String(v).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

// 归档列表：分类标签页 + 条目行 + 悬浮预览。
// 悬浮预览只在「有真实鼠标」的设备上启用（触屏不显示），与模板一致。
export function ArchiveList({ posts = [], cats = [] }) {
  const [cat, setCat] = useState('全部');
  const fine = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const catName = useMemo(() => {
    const map = new Map();
    for (const c of cats) map.set(c.id, c.name);
    return (id) => map.get(id) || '';
  }, [cats]);

  // 分类标签页：只保留真的有文章的分类，避免点进去是空列表
  const tabs = useMemo(() => {
    const used = new Set(posts.map((p) => p.category_id).filter(Boolean));
    return ['全部', ...cats.filter((c) => used.has(c.id)).map((c) => c.name)];
  }, [posts, cats]);

  const shown = useMemo(
    () => (cat === '全部' ? posts : posts.filter((p) => catName(p.category_id) === cat)),
    [posts, cat, catName]
  );

  const previewRef = useRef(null);
  const [hot, setHot] = useState(-1);

  // 预览跟手：只在列表内移动时更新位置，用 transform 而不是 left/top，避免重排
  useEffect(() => {
    if (!fine) return undefined;
    const list = previewRef.current?.parentElement;
    if (!list) return undefined;
    const onMove = (e) => {
      const box = previewRef.current;
      if (!box) return;
      const w = box.offsetWidth || 300;
      const h = box.offsetHeight || 225;
      let x = e.clientX + 34;
      if (x + w > window.innerWidth - 12) x = e.clientX - 34 - w;
      const y = Math.min(Math.max(12, e.clientY - h / 2), window.innerHeight - h - 12);
      box.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    list.addEventListener('pointermove', onMove, { passive: true });
    return () => list.removeEventListener('pointermove', onMove);
  }, [fine]);

  const featured = shown[0];
  const rest = shown.slice(1);

  return (
    <div class="ld-archive" data-reveal>
      <div class="ld-tabs" role="tablist" aria-label="文章分类">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={t === cat ? 'true' : 'false'}
            class={`ld-tab${t === cat ? ' on' : ''}`}
            onClick={() => { setCat(t); setHot(-1); }}
          >
            {t}
          </button>
        ))}
      </div>

      {!shown.length && (
        <p class="ld-empty">这个分类下暂时还没有公开的文章。</p>
      )}

      {featured && (
        <article class="ld-feat">
          <a class="ld-feat-cover" href={`/posts/${featured.slug || featured.id}`} aria-label={featured.title || '阅读文章'}>
            <Cover seed={featured.id || featured.slug} />
          </a>
          <div class="ld-feat-body">
            <div class="ld-feat-meta">
              {catName(featured.category_id) && <span class="ld-cat-tag">{catName(featured.category_id)}</span>}
              <time class="ld-num">{dotDate(featured.published_at || featured.created_at)}</time>
            </div>
            <h3 class="ld-feat-title">
              <a href={`/posts/${featured.slug || featured.id}`}>{featured.title || '无标题'}</a>
            </h3>
            {featured.excerpt && <p class="ld-feat-ex">{featured.excerpt}</p>}
            <a class="ld-more" href={`/posts/${featured.slug || featured.id}`}>
              <span class="ld-more-c">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </span>
              <span>阅读全文</span>
            </a>
          </div>
        </article>
      )}

      {rest.length > 0 && (
        <ul class="ld-list">
          {rest.map((p, i) => (
            <li key={p.id || i} data-reveal style={{ '--i': i }}>
              <a
                class="ld-row"
                href={`/posts/${p.slug || p.id}`}
                onPointerEnter={() => setHot(i)}
                onPointerLeave={() => setHot(-1)}
              >
                <span class="ld-num ld-r-date">{dotDate(p.published_at || p.created_at)}</span>
                <span class="ld-r-title">{p.title || '无标题'}</span>
                <span class="ld-r-cat">{catName(p.category_id) || '未分类'}</span>
                <span class="ld-r-go" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {fine && rest.length > 0 && (
        <div class={`ld-preview${hot >= 0 ? ' show' : ''}`} ref={previewRef} aria-hidden="true">
          {hot >= 0 && rest[hot] && <Cover seed={rest[hot].id || rest[hot].slug} />}
        </div>
      )}
    </div>
  );
}

// 印章：外圈环绕小字缓慢旋转 + 中心一个字标。参考模板的「关于」区。
// 中心字（2026-10-11 用户要求：由「朵」改为站名 Dora）：字数一变，70px 的定宽字号
// 就会溢出圆环（viewBox 只有 200 宽），所以按字数反推字号：1 字最大、4 字收到约 44px。
export function Seal({ ring = '', char = '知', class: cls = '' }) {
  const len = Math.max(1, [...String(char)].length);
  const charSize = len === 1 ? 70 : len === 2 ? 62 : len === 3 ? 52 : 44;
  return (
    <svg class={`ld-seal ${cls}`.trim()} viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <path id="ld-seal-circ" d="M100 100m-80 0a80 80 0 1 1 160 0a80 80 0 1 1-160 0" />
      </defs>
      <circle cx="100" cy="100" r="62" />
      <g class="ld-seal-ring">
        <text>
          <textPath href="#ld-seal-circ" textLength="498" lengthAdjust="spacing">{ring}</textPath>
        </text>
      </g>
      <text class="ld-seal-char" x="100" y="124" text-anchor="middle" style={{ fontSize: `${charSize}px` }}>{char}</text>
    </svg>
  );
}

// 开场白（2026-10-11 用户要求）：原来的「最近写的」文章列表整块下架，
// 标题与手绘横线保留，下面换成一段站点简介。
// 与 AboutBlock 的区别：这段在首屏之后不远，属于「导读」，所以用**逐行模糊揭幕**
// 而不是逐字点亮 —— 逐字点亮需要读者滚动配合，放在这里会显得拖沓。
export function IntroBlock({ lines = [] }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const rows = [...el.querySelectorAll('.ld-intro-line')];
    if (!rows.length) return undefined;

    // 用 IntersectionObserver 逐行触发，进入视口即揭幕，不跟滚动位置死绑：
    // 这样无论用户是快滑还是慢看，每一行都能完整看清（用户明确要求「一定要显示清楚」）。
    if (typeof IntersectionObserver !== 'function') {
      rows.forEach((r) => r.classList.add('on'));
      return undefined;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('on');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.35, rootMargin: '0px 0px -8% 0px' });
    rows.forEach((r) => io.observe(r));
    return () => io.disconnect();
  }, [lines.length]);

  return (
    <div class="ld-intro" ref={ref}>
      {lines.map((line, i) => (
        <p class="ld-intro-line" key={i} style={{ '--i': i }}>{line}</p>
      ))}
    </div>
  );
}

// 关于：正文逐字随滚动点亮（读到哪里亮到哪里）
export function AboutBlock({ text = '', seal = null }) {
  const bodyRef = useRef(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return undefined;
    const chars = [...el.querySelectorAll('.ld-a-ch')];
    if (!chars.length) return undefined;
    let lit = -1;
    let raf = 0;
    const paint = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh * 0.82 - r.top) / (r.height + vh * 0.12)));
      const next = Math.round(p * chars.length * 1.04);
      if (next === lit) return;
      lit = next;
      chars.forEach((c, i) => c.classList.toggle('on', i < next));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(paint); };
    paint();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [text]);

  return (
    <div class="ld-about">
      {seal && <div class="ld-about-seal">{seal}</div>}
      <p class="ld-about-text" ref={bodyRef}>
        {[...text].map((c, i) => (
          <span class="ld-a-ch" key={i}>{c}</span>
        ))}
      </p>
    </div>
  );
}

// 回到顶部进度环：右下角常驻，环的描边随阅读进度走。
export function ProgressRing() {
  const [p, setP] = useState(0);
  const [show, setShow] = useState(false);
  useEffect(() => {
    let raf = 0;
    const paint = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      const y = window.scrollY || doc.scrollTop || 0;
      setP(Math.min(1, Math.max(0, y / max)));
      setShow(y > 600);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(paint); };
    paint();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // 圆周长 2πr，r=24 → 150.8
  const CIRC = 150.8;
  return (
    <button
      type="button"
      class={`ld-totop${show ? ' show' : ''}`}
      aria-label="回到顶部"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <svg class="ld-totop-svg" viewBox="0 0 52 52" aria-hidden="true">
        <circle class="ld-totop-bg" cx="26" cy="26" r="24" />
        <circle class="ld-totop-pg" cx="26" cy="26" r="24" style={{ strokeDashoffset: CIRC * (1 - p) }} />
      </svg>
      <svg class="ld-totop-ar" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 19V5M6 11l6-6 6 6" />
      </svg>
    </button>
  );
}
