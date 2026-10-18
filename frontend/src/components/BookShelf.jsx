// 首页「此刻」区里的模拟书架。
// ------------------------------------------------------------------
// 演进：
//   2026-10-11 第一版：三层隔板、书正面朝读者立着、有真封面就用真封面。
//   2026-10-12 第二版：改成 100vw 全幅铺满视口。
//   2026-10-12 第三版（本文件）：按站长的新反馈重做 ——
//     ① 「尺寸不要两边都抵到边缘，合理规划宽度」→ 收回 100vw 全幅，
//        改成与正文同宽（跟着「此刻」的 Bento 栅格走），两侧用渐隐遮罩收口，
//        书是「淡出」而不是硬切在边缘；
//     ② 「两行就行」→ 从三层改成**两行**；
//     ③ 「上面一行从左往右移动，下面一行从右往左移动，它们是移动着的」
//        → 两条**无缝滚动**的书带（marquee），方向相反、匀速循环；
//     ④ 「鼠标停在某一本上、点击可以在线阅读」→ 悬停即**暂停**整条带，
//        点真实图书**就地弹出阅读器**（与 /books 用的是同一个 BookReader）；
//        书架右上角另有「查看更多 →」跳到图书页。
//
// 设计取舍：
//   1) 零依赖：滚动是纯 CSS animation（GPU 合成，不跑 rAF，不烧 CPU）。
//   2) 不发多余请求：有 cover_url 才 <img>，否则用 lib/genCover.js 的生成式封面
//      （纯 SVG，确定性，同一个 id 永远同一张图）。
//   3) 无缝循环的做法：把这一行的书**复制一份**接在后面，整条轨道 translateX(-50%)
//      就是一个完美循环 —— 半条轨道的长度等于复制出来的那半条，接缝处的间距
//      与轨道内部一致（同一个 flex gap），所以看不出接缝。
//   4) 书够不够填满一行：真书轮流落到两行，不足的位置用生成式封面补位，
//      补位书链到 /books，点了不会没反应。
//   5) 颜色全部从主题变量派生（--text / --bg / --bg-subtle / --bg-elevated / --primary），
//      不写死木色十六进制值，三套主题（纯净 / 素雅 / 天青）都能直接看。
//   6) 样式自注入（id="book-shelf-css"），不改任何 .css 文件，避免和别的改动打架。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { genCover, pickCover } from '../lib/genCover.js';
import { Icon } from './Icon.jsx';

// —— 版面常量（单位 px）——
const ROWS = 2;               // 两行书（2026-10-12 用户要求：两行就行）
const PLANK_H = 12;           // 每层隔板的厚度
const GAP = 18;               // 相邻两本书的间隙
const BOOK_MIN = 96;          // 单本书最小宽度
const BOOK_MAX = 168;         // 单本书最大宽度
const BOOK_RATIO = 3 / 2;     // 高 / 宽，标准书籍封面 2:3
const BOOK_TARGET = 128;      // 理想书宽（一行大约排几本由它估）
const MAX_COLS = 18;          // 一行最多摆几本
const SHELF_AIR = 16;         // 书顶到上一块层板之间的空档，真实书架不会顶满
const ROW_MIN_ITEMS = 8;      // 一行至少要铺几本（真书少时用补位书凑，保证滚动不断带）
const SPEED = 42;             // 滚动线速度（px/秒），两行同速、方向相反

// 字符串 → 32 位整数种子（FNV-1a）。和 LandingParts.jsx 里的 Cover 保持一致，
// 这样同一本书在书架和文章列表里拿到的图案是同一种风格。
function hashSeed(str) {
  let h = 2166136261;
  const s = String(str == null ? '' : str);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100000;
}

// 容器宽度 → 版面。纯函数（无 DOM、无副作用），探针可以直接调用断言。
export function computeLayout(containerWidth) {
  const w = Math.max(0, Number(containerWidth) || 0);
  // 左右内边距跟着宽度走：窄屏 12px，宽屏最多 28px
  const padX = Math.max(12, Math.min(28, Math.round(w * 0.02)));
  const innerW = Math.max(0, w - padX * 2);

  let cols = Math.max(2, Math.min(MAX_COLS, Math.round(innerW / (BOOK_TARGET + GAP))));
  const fit = (n) => (innerW - (n - 1) * GAP) / n;
  let bw = fit(cols);

  if (bw < BOOK_MIN) {
    // 太窄：少摆几本，让每本宽一点
    cols = Math.max(2, Math.floor((innerW + GAP) / (BOOK_MIN + GAP)));
    bw = fit(cols);
  } else if (bw > BOOK_MAX) {
    // 太宽：多摆几本摊平
    while (cols < MAX_COLS && bw > BOOK_MAX) {
      cols += 1;
      bw = fit(cols);
    }
  }

  // 取整时向下取：宁可右侧留一点余量，也别让书顶出容器
  bw = Math.max(72, Math.min(BOOK_MAX, Math.floor(bw)));
  return {
    padX,
    cols,
    width: bw,
    height: Math.round(bw * BOOK_RATIO),
    rowH: Math.round(bw * BOOK_RATIO) + SHELF_AIR
  };
}

// 竖排书名按可用高度截断。
// 用 CSS overflow:hidden 硬裁会让元素变成「滚动容器」，看着像书架上藏了滚动条；
// 改成先在 JS 里按字号算好能放几个字，超出的用省略号收尾，内容就永远放得下。
function fitVerticalTitle(title, width, height) {
  const text = String(title || '');
  const fs = Math.max(10, Math.min(15, Math.round(width * 0.105)));
  const avail = Math.max(20, height * 0.78);
  const advance = fs * 1.17;                    // 字宽 + 0.16em 字距
  const maxChars = Math.max(2, Math.floor(avail / advance));
  const shown = text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
  return { text: shown, fs };
}

// 生成式封面：纯 SVG，不发图片请求。
function GeneratedCover({ seed, title, width, height }) {
  const key = String(seed);
  const inner = useMemo(() => genCover(pickCover(key), hashSeed(key)), [key]);
  const label = useMemo(() => fitVerticalTitle(title, width, height), [title, width, height]);
  // 色相偏移：生成式封面的底色全部从 --primary 派生，一架子书会变成同一种颜色、
  // 像复印出来的。按 seed 取一个固定的偏移量（0~330 的 12 档），让每本书的封面色
  // 各不相同 —— 真实书架本来就是五颜六色的。确定性：同一本书永远同一色。
  const hue = (hashSeed(key) % 12) * 30;
  return (
    <span class="bs-gen" aria-hidden="true" style={{ '--bs-hue': `${hue}deg` }}>
      <svg
        class="bs-gen-svg"
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
        dangerouslySetInnerHTML={{ __html: inner }}
      />
      <span class="bs-gen-t" style={{ '--bs-fs': `${label.fs}px` }}>{label.text}</span>
    </span>
  );
}

// 单本书：正面朝读者立着。
// 真书 → 点一下就地弹出阅读器；补位书 → 跳到图书页。
function ShelfBook({ book, width, height, onOpen }) {
  const [broken, setBroken] = useState(false);
  const title = book?.title || '未命名';
  const isPlaceholder = !!book?.placeholder;
  const showImg = !!book?.cover_url && !broken;

  return (
    <button
      type="button"
      class={`bs-book${isPlaceholder ? ' is-ph' : ''}`}
      style={{ '--bs-w': `${width}px`, '--bs-hh': `${height}px` }}
      title={isPlaceholder ? title : `阅读《${title}》`}
      aria-label={isPlaceholder ? title : `在线阅读《${title}》`}
      onClick={() => (isPlaceholder ? route('/books') : onOpen(book))}
    >
      {showImg ? (
        <img
          class="bs-img"
          src={book.cover_url}
          alt={`《${title}》封面`}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
        />
      ) : (
        <GeneratedCover seed={book?.id ?? title} title={title} width={width} height={height} />
      )}
    </button>
  );
}

// 量容器宽度，ResizeObserver 自适应。
function useShelfWidth(ref) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const measure = () => {
      const next = Math.round(el.clientWidth || 0);
      setWidth((prev) => (prev === next ? prev : next));
    };

    measure();
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [ref]);

  return width;
}

export function BookShelf({ books = [], ariaLabel = '书架' }) {
  const wrapRef = useRef(null);
  const width = useShelfWidth(wrapRef);
  // 首帧还没量到宽度时给 1200 兜底，避免闪一下极窄的版面。
  const layout = useMemo(() => computeLayout(width || 1200), [width]);

  const real = useMemo(() => (Array.isArray(books) ? books.filter(Boolean) : []), [books]);

  // 两行分栏。真实图书**轮流**落到两行（第 i 本 → 第 i%2 行），而不是先铺满第一行：
  // 这样只有两三本真书时两行也各有一本，不会出现「上面有书、下面空着」。
  // 每行不足的位置用生成式封面补位 —— 书架是一块**装饰性版面**，站长要的是
  // 「仿真度高的真实书架」，而真实书架照片里总是摆满书的，空板反而像没做完。
  const rows = useMemo(() => {
    const per = Math.max(ROW_MIN_ITEMS, layout.cols);
    const out = Array.from({ length: ROWS }, () => []);
    real.forEach((b, i) => out[i % ROWS].push(b));
    let n = 1;
    for (const row of out) {
      while (row.length < per) {
        row.push({ id: `ph-${n}`, title: `藏书 ${n}`, placeholder: true });
        n += 1;
      }
    }
    return out;
  }, [real, layout.cols]);

  // 一条轨道的时长 = 半条轨道的长度 / 线速度，这样两行视觉速度一致（方向相反）。
  const dur = useMemo(() => {
    const halfLen = rows[0].length * (layout.width + GAP);
    return `${Math.max(26, Math.round(halfLen / SPEED))}s`;
  }, [rows, layout.width]);

  return (
    <div class="bs-wrap" ref={wrapRef} role="group" aria-label={ariaLabel}>
      <div
        class="bs-case"
        style={{
          '--bs-pad': `${layout.padX}px`,
          '--bs-h': `${layout.rowH}px`,
          '--bs-dur': dur
        }}
      >
        {/* 背板：纯装饰，不参与交互 */}
        <span class="bs-back" aria-hidden="true" />

        <div class="bs-head">
          <span class="bs-title">书架</span>
          <span class="bs-count">{real.length > 0 ? `${real.length} 本` : '待上架'}</span>
          <span class="bs-spacer" />
          <a class="bs-more" href="/books">
            查看更多<Icon name="arrowRight" size={13} />
          </a>
        </div>

        {/* 两行书带：上面一行向右、下面一行向左，鼠标停上去即暂停 */}
        <div class="bs-deck">
          {rows.map((row, r) => (
            <div class="bs-tier" key={`tier-${r}`}>
              <div class={`bs-marquee${r === 1 ? ' rev' : ''}`}>
                {/* 轨道 = 这一行复制两份，translateX(-50%) 就是无缝循环 */}
                <div class="bs-track">
                  {[...row, ...row].map((b, i) => (
                    <ShelfBook
                      key={`${r}-${i}-${b?.id ?? i}`}
                      book={b}
                      width={layout.width}
                      height={layout.height}
                      onOpen={(book) => route(`/books/${book.id}`)}
                    />
                  ))}
                </div>
              </div>
              <span class="bs-plank" aria-hidden="true" />
            </div>
          ))}
        </div>
      </div>

      {/* 就地阅读：与 /books 用的是同一个阅读器组件（portal 到 body） */}
    </div>
  );
}

export default BookShelf;

// ------------------------------------------------------------------
// 样式：自注入，固定 id，重复挂载（HMR）时不会插第二份。
// 类名统一 bs- 前缀，和首页其它 ld- / now- 前缀互不干扰。
// ------------------------------------------------------------------
const CSS_ID = 'book-shelf-css';

const CSS = `
/* ---------- 外壳：跟着正文宽度，不再全幅铺满 ----------
   2026-10-12 第三版：上一版是 100vw 全幅，站长反馈「两边都抵到边缘」。
   现在只占「此刻」Bento 栅格的一整行（grid-column 1 / -1），宽度即正文宽度，
   两侧再用渐隐遮罩收口，书是「淡出」而不是被硬切一刀。 */
.bs-wrap {
  grid-column: 1 / -1;
  position: relative;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
}

/* ---------- 书架本体（木纹背板）---------- */
.bs-case {
  position: relative;
  box-sizing: border-box;
  padding: 14px 0 18px;
  border-radius: 20px;
  overflow: hidden;
  background:
    radial-gradient(130% 96% at 50% -6%, rgba(255, 255, 255, 0.14), transparent 46%),
    radial-gradient(126% 128% at 50% 46%, transparent 44%, rgba(0, 0, 0, 0.26) 100%),
    repeating-linear-gradient(90deg,
      color-mix(in srgb, var(--text) 6%, transparent) 0 1px,
      transparent 1px 7px,
      color-mix(in srgb, var(--text) 3%, transparent) 7px 8px,
      transparent 8px 18px),
    linear-gradient(180deg,
      color-mix(in srgb, var(--text) 9%, var(--bg-subtle)),
      color-mix(in srgb, var(--text) 21%, var(--bg-subtle)));
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--text) 15%, transparent),
    inset 0 22px 40px -26px rgba(255, 255, 255, 0.5),
    0 30px 56px -34px rgba(0, 0, 0, 0.4);
}

/* 背板高光层：只负责顶部提亮，不挡书 */
.bs-back {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(120% 90% at 50% 12%, rgba(255, 255, 255, 0.10), transparent 52%);
}

/* ---------- 标题行 + 查看更多 ---------- */
.bs-head {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 var(--bs-pad, 22px) 12px;
}
.bs-title {
  font-family: var(--font-display, Georgia, 'Songti SC', serif);
  font-size: 15px;
  letter-spacing: 0.02em;
  color: var(--text);
}
.bs-count {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
}
.bs-spacer { flex: 1; }
.bs-more {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 12.5px;
  line-height: 1;
  color: var(--text-muted);
  text-decoration: none;
  background: color-mix(in srgb, var(--bg-elevated) 74%, transparent);
  border: 1px solid color-mix(in srgb, var(--text) 12%, transparent);
  /* 2026-10-15 取自图鉴 #30「填充 + 箭头穿梭」：
     悬停时底色自下而上填满，箭头穿出去再从左边进来。
     保留原有胶囊尺寸，只加动效（position/overflow 是为了让填充层被裁在圆角内）。 */
  position: relative;
  overflow: hidden;
  isolation: isolate;
  transition: color 0.3s var(--ease-out, ease), border-color 0.3s var(--ease-out, ease);
}
.bs-more::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  background: var(--primary);
  transform: translateY(101%);
  transition: transform 0.45s var(--ease-out, ease);
}
.bs-more:hover {
  color: var(--primary-contrast, #fff);
  border-color: var(--primary);
}
.bs-more:hover::before { transform: none; }
.bs-more:hover .icon { animation: bs-arrow-through 0.5s var(--ease-out, ease); }
@keyframes bs-arrow-through {
  0% { transform: none; }
  45% { transform: translateX(18px); }
  46% { transform: translateX(-18px); }
  100% { transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .bs-more::before { transition: none; }
  .bs-more:hover .icon { animation: none; }
}
/* 触屏设备把「查看更多」的命中区撑到 44px 高（2026-10-12 移动端适配，
   原来只有 25px，手指点不中；外观不变，靠透明上下内边距撑开）。 */
@media (hover:none) and (pointer:coarse) {
  .bs-more { padding: 16px; }
}

/* ---------- 书 + 层板这一叠：很轻的俯视透视 ---------- */
.bs-deck {
  position: relative;
  z-index: 2;
  transform: rotateX(1.2deg);
  transform-origin: 50% 50%;
  transform-style: preserve-3d;
}

.bs-tier {
  position: relative;
  display: flex;
  flex-direction: column;
  transform-style: preserve-3d;
}

/* ---------- 滚动书带（marquee）----------
   overflow:hidden 裁掉轨道两端；左右两侧用 mask 渐隐收口，
   书是「淡出」而不是被硬切一刀 —— 这也是站长说的「不要抵到边缘」的观感。
   鼠标停在这一行上 → 整条带暂停，方便看清书名并点进去。 */
.bs-marquee {
  position: relative;
  overflow: hidden;
  padding: 2px 0;
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 5%, #000 95%, transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0, #000 5%, #000 95%, transparent 100%);
}
.bs-track {
  display: flex;
  align-items: flex-end;
  gap: ${GAP}px;
  width: max-content;
  min-height: var(--bs-h, 200px);
  padding: 0 0 0 2px;
  will-change: transform;
  /* 上面一行：从左往右（轨道整体向右挪半条） */
  animation: bs-run-right var(--bs-dur, 60s) linear infinite;
}
.bs-marquee.rev .bs-track {
  /* 下面一行：从右往左 */
  animation-name: bs-run-left;
}
.bs-marquee:hover .bs-track { animation-play-state: paused; }

@keyframes bs-run-right {
  from { transform: translate3d(-50%, 0, 0); }
  to   { transform: translate3d(0, 0, 0); }
}
@keyframes bs-run-left {
  from { transform: translate3d(0, 0, 0); }
  to   { transform: translate3d(-50%, 0, 0); }
}

/* 层板：木纹 + 厚度 + 上沿高光 + 下沿落影 */
.bs-plank {
  position: relative;
  z-index: 1;
  display: block;
  height: ${PLANK_H}px;
  border-radius: 3px;
  background:
    repeating-linear-gradient(92deg,
      color-mix(in srgb, var(--text) 7%, transparent) 0 1px,
      transparent 1px 6px,
      color-mix(in srgb, var(--text) 4%, transparent) 6px 7px,
      transparent 7px 16px),
    linear-gradient(180deg,
      color-mix(in srgb, var(--text) 11%, var(--bg-elevated)) 0%,
      color-mix(in srgb, var(--text) 24%, var(--bg-subtle)) 42%,
      color-mix(in srgb, var(--text) 34%, var(--bg-subtle)) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.42),
    inset 0 -1px 0 rgba(0, 0, 0, 0.26),
    0 16px 24px -14px rgba(0, 0, 0, 0.55),
    0 3px 6px -3px rgba(0, 0, 0, 0.30);
}

/* ---------- 单本书 ---------- */
.bs-book {
  position: relative;
  z-index: 2;                    /* 压在层板之上，接触阴影才能落到板面上 */
  flex: 0 0 auto;
  width: var(--bs-w, 150px);
  height: var(--bs-hh, 210px);
  padding: 0;
  border: none;
  display: block;
  cursor: pointer;
  /* 圆角和 /books 图书页保持一致 */
  border-radius: 4px 10px 10px 4px;
  overflow: hidden;
  background: var(--bg-elevated);
  transform-style: preserve-3d;
  box-shadow:
    0 16px 22px -13px rgba(0, 0, 0, 0.55),
    0 5px 9px -5px rgba(0, 0, 0, 0.34),
    inset 0 0 0 1px rgba(0, 0, 0, 0.10);
  transition:
    transform 0.45s var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    box-shadow 0.45s var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}

/* 悬停：像被从书架上抽出来一点 —— 抬起 + 微微侧转，阴影拉长 */
.bs-book:hover,
.bs-book:focus-visible {
  transform: translateY(-12px) rotateY(3deg) scale(1.04);
  box-shadow:
    0 32px 44px -18px rgba(0, 0, 0, 0.56),
    0 8px 14px -6px rgba(0, 0, 0, 0.30);
  z-index: 5;
  outline: none;
}
.bs-book:focus-visible {
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--primary) 70%, transparent),
    0 32px 44px -18px rgba(0, 0, 0, 0.56);
}

/* 书脊：左侧一条深色渐变，让封面看起来像一本书而不是一张图 */
.bs-book::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 10px;
  z-index: 3;
  pointer-events: none;
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.40), rgba(0, 0, 0, 0.06) 65%, transparent);
}

/* 书页边缘：右侧一条细白线，模拟纸张侧面 */
.bs-book::after {
  content: '';
  position: absolute;
  inset: 0 0 0 auto;
  width: 3px;
  z-index: 3;
  pointer-events: none;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.5));
}

.bs-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ---------- 生成式封面（无真封面时的回退）---------- */
.bs-gen {
  position: absolute;
  inset: 0;
  display: block;
  --bs-hue: 0deg;
}
.bs-gen::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(135deg, rgba(0, 0, 0, 0.03) 0 2px, transparent 2px 7px),
    linear-gradient(150deg,
      color-mix(in srgb, var(--primary) 26%, var(--bg-elevated)),
      color-mix(in srgb, var(--primary) 7%, var(--bg-elevated)));
  filter: hue-rotate(var(--bs-hue));
}
.bs-gen::after {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 10px;
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.34), rgba(0, 0, 0, 0.05) 65%, transparent);
  pointer-events: none;
}
.bs-gen-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.1;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.85;
  filter: hue-rotate(var(--bs-hue));
  color: color-mix(in srgb, var(--primary) 60%, var(--text));
}
.bs-gen-svg .dot { fill: currentColor; stroke: none; }

/* 竖排书名：居中压在生成封面上。
   字号由 JS 按书宽算（--bs-fs），字数也由 JS 按书高截断，所以这里
   不写 font-size 的响应式，也不用 overflow:hidden 去裁（那会把元素变成滚动容器）。 */
.bs-gen-t {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  writing-mode: vertical-rl;
  font-family: var(--font-display, Georgia, 'Songti SC', serif);
  font-weight: 500;
  font-size: var(--bs-fs, 13px);
  line-height: 1.17;
  letter-spacing: 0.16em;
  color: var(--text);
  white-space: nowrap;
  text-shadow: 0 1px 0 color-mix(in srgb, var(--bg) 60%, transparent);
}

@media (max-width: 640px) {
  .bs-case { padding-top: 12px; padding-bottom: 14px; border-radius: 16px; }
  .bs-plank { height: 10px; }
  .bs-head { padding-bottom: 10px; }
}

/* 关掉动效时：不滚了，改成可横向拖动查看（隐藏滚动条，站长不要滚动条） */
@media (prefers-reduced-motion: reduce) {
  .bs-deck { transform: none; }
  .bs-marquee {
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .bs-marquee::-webkit-scrollbar { display: none; }
  .bs-track { animation: none; }
  .bs-book { transition: none; }
  .bs-book:hover,
  .bs-book:focus-visible { transform: none; }
}
`;

if (typeof document !== 'undefined' && !document.getElementById(CSS_ID)) {
  const tag = document.createElement('style');
  tag.id = CSS_ID;
  tag.textContent = CSS;
  document.head.appendChild(tag);
}
