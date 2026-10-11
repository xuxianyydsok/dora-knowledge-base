// 首页「此刻」区里的模拟书架。
// ------------------------------------------------------------------
// 2026-10-11 第一版：三层隔板、书正面朝读者立着、有真封面就用真封面。
// 2026-10-12 第二版（本文件当前内容）按站长的三条反馈重做：
//   ① 「书架太窄了，宽度就相当于首页那个轮播图那样从左到右」→ 全幅 100vw 铺满视口；
//   ② 「一层大概放 6~10 本、一共三层，排布和 /books 图书页一样」→ 尺寸口径对齐
//      books.css 的 minmax(178px, 1fr) / gap 20px / 2:3 封面 / 圆角 4px 10px 10px 4px；
//   ③ 「背景仿真度要高一些」→ 木纹层板（有厚度、上沿高光、下沿落影）、带暗角的背板、
//      两侧立板、书压在板面上的接触阴影、整排轻微 3D 俯视透视。
//
// 设计取舍：
//   1) 零依赖：不引任何图表/动画库（仓库禁止 npm install），3D 与落影全用 CSS。
//   2) 不发多余请求：有 cover_url 才 <img>，否则用 lib/genCover.js 的生成式封面
//      （纯 SVG，确定性，同一个 id 永远同一张图）。
//   3) 不出滚动条：每层放几本由容器宽度**算出来**（不是写死的）；放不下的书用
//      「还有 N 本」提示收到右上角。站长明确反感滚动条。
//   4) 颜色全部从主题变量派生（--text / --bg / --bg-subtle / --bg-elevated / --primary），
//      不写死木色十六进制值，三套主题（纯净 / 素雅 / 天青）都能直接看。
//   5) 样式自注入（id="book-shelf-css"），不改任何 .css 文件，避免和别的改动打架。
//      注入的样式里**只有一组**是给组件外面的（文件末尾 .now-bento > .now-shelf
//      那段，用来放开父卡片对 100vw 全幅的裁切）；其余全部是 .bs- 自己的类名。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { genCover, pickCover } from '../lib/genCover.js';

// —— 版面常量（单位 px）——
const TIERS = 3;              // 三层隔板
const PLANK_H = 12;           // 每层隔板的厚度
const GAP = 20;               // 相邻两本书的间隙（和 /books 的 gap 一致）
const ROW_PAD = 2;            // 每排书左侧那一点点缩进，算版面时要一起扣掉
const BOOK_MIN = 110;         // 单本书最小宽度（再窄书名就挤了）
const BOOK_MAX = 178;         // 单本书最大宽度（对齐 /books 的 minmax(178px, 1fr)）
const BOOK_MAX_H = 210;       // 单本书最大高度：反过来限制书宽，别让整架高到要翻两屏
const BOOK_RATIO = 3 / 2;     // 高 / 宽，标准书籍封面 2:3
const PAD_TOP = 32;           // 顶部内边距（留出「还有 N 本」那一行）
const PAD_BOTTOM = 24;        // 底部内边距（底板的落地阴影）
const SHELF_AIR = 14;         // 书顶到上一块层板之间的空档，真实书架不会顶满
// 窄屏（<560px）单独放宽：手机上一行摆不下 6 本，硬保 110px 书宽会让
// 三层加起来冲到 880px，得翻两屏才看得完。允许书小一点、整架矮一点。
const NARROW_W = 560;
const BOOK_MIN_NARROW = 96;
const BOOK_MAX_H_NARROW = 190;
// 版面目标：一层 6~10 本（超宽屏最多 16 本），整架高度落在 520~720px 之间。
const BOOK_TARGET = 118;      // 理想书宽
const MAX_COLS = 16;          // 一层最多摆几本

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

// 宽度 → 版面。纯函数（无 DOM、无副作用），探针直接调用断言。
//   算法：先按理想书宽估本数，再用「最小书宽 / 最大书宽 / 最大书高」三道约束
//   加减本数，最后把书宽夹在 [86, 178]。宽度和高度是互相拉扯的：
//   本数少 → 书变宽 → 书变高 → 整架变高，所以两边都要收。
export function computeLayout(width) {
  const w = Math.max(0, Number(width) || 0);
  // 左右内边距跟着视口走：窄屏 18px，宽屏最多 44px（越宽留白越多，像真实书架两侧的立板）
  const padX = Math.max(18, Math.min(44, Math.round(w * 0.026)));
  // 连每排书左侧那 2px 缩进一起扣掉：不扣的话最右边那本会顶出去 2px，
  // 浏览器就会把 .bs-row 认成横向滚动容器（站长明确不要任何滚动条）。
  const innerW = Math.max(0, w - padX * 2 - ROW_PAD);
  const narrow = w < NARROW_W;
  const minBook = narrow ? BOOK_MIN_NARROW : BOOK_MIN;
  const maxBook = Math.min(BOOK_MAX, (narrow ? BOOK_MAX_H_NARROW : BOOK_MAX_H) / BOOK_RATIO);

  const fit = (n) => (innerW - (n - 1) * GAP) / n;
  let cols = Math.max(1, Math.min(MAX_COLS, Math.round(innerW / (BOOK_TARGET + GAP))));
  let bw = fit(cols);

  if (bw < minBook) {
    // 太窄了：少摆几本，让每本宽一点（书宽不足时优先保书宽，不再保本数）
    cols = Math.max(1, Math.floor((innerW + GAP) / (minBook + GAP)));
    bw = fit(cols);
  } else if (bw > maxBook) {
    // 太宽了（书会又宽又高）：多摆几本摊平，上限 MAX_COLS
    while (cols < MAX_COLS && bw > maxBook) {
      cols += 1;
      bw = fit(cols);
    }
  }

  // 取整时向下取：宁可右侧留十几像素的余量，也别让一排书顶出容器右边
  bw = Math.max(40, Math.min(maxBook, Math.floor(bw)));
  return {
    padX,
    cols,
    width: bw,
    height: Math.round(bw * BOOK_RATIO),
  };
}

// 竖排书名按可用高度截断。
// 之前用 CSS overflow:hidden 硬裁，浏览器会把书名元素当成「滚动容器」
// （scrollHeight 远大于 clientHeight），验收时看着就像书架上藏了滚动条。
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
// 复刻 LandingParts.jsx 里 <Cover> 的写法（同一个 genCover + pickCover 组合），
// 只是外面多套了一层竖排书名的容器 —— 真书封面上本来就印着书名。
function GeneratedCover({ seed, title, width, height }) {
  const key = String(seed);
  const inner = useMemo(() => genCover(pickCover(key), hashSeed(key)), [key]);
  const label = useMemo(
    () => fitVerticalTitle(title, width, height),
    [title, width, height]
  );
  // 色相偏移：生成式封面的底色全部从 --primary 派生，一架子书会变成同一种颜色、
  // 像复印出来的。按 seed 取一个固定的偏移量（0~360 的 12 档），让每本书的
  // 封面色各不相同 —— 真实书架本来就是五颜六色的。确定性：同一本书永远同一色。
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
// 有 cover_url 就用真封面；加载失败（onError）或压根没有封面时，退回生成式封面。
function ShelfBook({ book, width }) {
  const [broken, setBroken] = useState(false);
  const title = book?.title || '未命名';
  const showImg = !!book?.cover_url && !broken;
  const href = book?.id != null ? `/books/${book.id}` : '/books';

  return (
    <a
      class="bs-book"
      href={href}
      style={{ '--bs-w': `${width}px` }}
      title={title}
      aria-label={`《${title}》`}
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
        <GeneratedCover seed={book?.id ?? title} title={title} width={width} height={Math.round(width * BOOK_RATIO)} />
      )}
    </a>
  );
}

// 量容器宽度（全幅之后就是视口宽度），ResizeObserver 自适应。
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
  // 首帧还没量到宽度时给 1200 兜底，避免闪一下 1 列的版面。
  const layout = useMemo(() => computeLayout(width || 1200), [width]);

  // 真实图书（公开接口拿到的）
  const real = useMemo(() => (Array.isArray(books) ? books.filter(Boolean) : []), [books]);

  // 每层摆几本 = 版面算出来的列数（1440px 宽时是 10 本，正好落在站长要的 6~10 本）。
  const perTier = Math.max(1, layout.cols);
  const capacity = perTier * TIERS;
  const shownReal = real.slice(0, capacity);
  // 「还有 N 本」只统计**真实**图书里没摆下的部分，补位书不算。
  const rest = Math.max(0, real.length - shownReal.length);

  // 三层分栏。真实图书**轮流**落到三层（第 i 本 → 第 i%3 层），而不是先铺满第一层：
  // 这样只有两三本真书时，三层也各有一本，不会出现「上面两层有书、最下面一层空着」。
  // 每层剩余的位置用生成式封面补位 —— 书架是一块**装饰性版面**，站长要的是
  // 「仿真度高的真实书架」，而真实书架照片里总是摆满书的，空板反而像没做完。
  // 补位书同样链到 /books，点了不会没反应；标题统一是「藏书 N」，便于和真书区分。
  const tiers = useMemo(() => {
    const out = Array.from({ length: TIERS }, () => []);
    shownReal.forEach((b, i) => out[i % TIERS].push(b));
    let n = 1;
    for (const row of out) {
      while (row.length < perTier) {
        row.push({ id: `ph-${n}`, title: `藏书 ${n}`, placeholder: true });
        n += 1;
      }
    }
    return out;
  }, [shownReal, perTier]);

  return (
    <div class="bs-wrap" ref={wrapRef} role="group" aria-label={ariaLabel}>
      <div
        class="bs-case"
        style={{
          '--bs-pad': `${layout.padX}px`,
          // 每一格的高度 = 书高 + 顶上一点空档，真实书架不会把书顶到层板上
          '--bs-h': `${layout.height + SHELF_AIR}px`,
        }}
      >
        {/* 背板 + 两侧立板：纯装饰，不参与交互 */}
        <span class="bs-back" aria-hidden="true" />
        <span class="bs-side bs-side-l" aria-hidden="true" />
        <span class="bs-side bs-side-r" aria-hidden="true" />

        {/* 书 + 层板这一叠整体做一个很轻的 3D 俯视透视；木纹背板保持平面全幅，
            这样倾斜不会在视口左右边缘露出缝隙。 */}
        <div class="bs-deck">
          {tiers.map((row, t) => (
            <div class="bs-tier" key={`tier-${t}`}>
              <div class="bs-row">
                {row.map((b, i) => (
                  <ShelfBook key={b?.id ?? `${t}-${i}`} book={b} width={layout.width} />
                ))}
              </div>
              <span class="bs-plank" aria-hidden="true" />
            </div>
          ))}
        </div>

        {rest > 0 && <a class="bs-more" href="/books">还有 {rest} 本 →</a>}
      </div>
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
/* ---------- 全幅外壳 ----------
   书架根节点就是 .now-bento 的网格项，所以这里必须自己占满整行
   （1 / -1），否则会掉进 12 列网格里的第一列 —— 卡片只有 1/12 宽，
   这就是上一版「书架太窄」的直接原因。
   冲出 .app-main 的 max-width(1280) 与左右内边距，横向铺满整个视口。
   手法和 home-landing.css 的 .ld-hero 完全一致；多出来的那点滚动条宽度由
   .app-shell 的 overflow-x: clip 收掉。
   flex: 0 0 auto 是必须的：父级 .now-box 是 flex 列容器，默认 flex-shrink:1
   会把 100vw 又压回卡片宽度，全幅就失效了。 */
.bs-wrap {
  grid-column: 1 / -1;
  position: relative;
  box-sizing: border-box;
  width: 100vw;
  max-width: 100vw;
  flex: 0 0 auto;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);
  padding: 0;
  overflow: visible;
  perspective: 2400px;
  perspective-origin: 50% 42%;
}

/* ---------- 书架本体（木纹背板，平面全幅）---------- */
.bs-case {
  position: relative;
  box-sizing: border-box;
  padding: ${PAD_TOP}px var(--bs-pad, 36px) ${PAD_BOTTOM}px;
  background:
    radial-gradient(130% 96% at 50% -6%, rgba(255, 255, 255, 0.16), transparent 46%),
    radial-gradient(126% 128% at 50% 46%, transparent 44%, rgba(0, 0, 0, 0.30) 100%),
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
    inset 0 22px 40px -26px rgba(255, 255, 255, 0.55),
    0 34px 64px -34px rgba(0, 0, 0, 0.42);
}

/* 背板高光层：只负责顶部提亮，不挡书 */
.bs-back {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(120% 90% at 50% 12%, rgba(255, 255, 255, 0.10), transparent 52%);
}

/* 两侧立板：贴在视口左右边缘，让「全幅」看起来像书架本身很长而不是被切了 */
.bs-side {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 16px;
  z-index: 1;
  pointer-events: none;
  background:
    repeating-linear-gradient(180deg,
      color-mix(in srgb, var(--text) 7%, transparent) 0 1px,
      transparent 1px 9px),
    linear-gradient(90deg,
      color-mix(in srgb, var(--text) 30%, var(--bg-subtle)),
      color-mix(in srgb, var(--text) 16%, var(--bg-subtle)));
  box-shadow: 0 0 26px -6px rgba(0, 0, 0, 0.34);
}
.bs-side-l { left: 0; }
.bs-side-r { right: 0; transform: scaleX(-1); }

/* 书 + 层板这一叠：很轻的俯视透视（只用小角度，俯视不会让同一层里的
   「书底边 / 层板上沿」错位，看起来就是一张真实书架的照片） */
.bs-deck {
  position: relative;
  z-index: 2;
  transform: rotateX(1.4deg) rotateY(-0.9deg);
  transform-origin: 50% 50%;
  transform-style: preserve-3d;
}

/* 一层 = 一排书 + 下面一条隔板 */
.bs-tier {
  position: relative;
  display: flex;
  flex-direction: column;
  transform-style: preserve-3d;
}

.bs-row {
  display: flex;
  align-items: flex-end;         /* 书立在板面上：底边贴着层板上沿 */
  justify-content: flex-start;
  gap: ${GAP}px;
  min-height: var(--bs-h, 200px);
  padding-left: 2px;
  transform-style: preserve-3d;
}

/* 层板：木纹 + 厚度 + 上沿高光 + 下沿落影。
   三条渐变分别对应「受光的上表面 / 木料本色 / 背光的立面」，
   inset 高光是木料棱边被灯打亮的那一条，落影是这块板压在下层书上的环境遮蔽。 */
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
  aspect-ratio: 2 / 3;
  display: block;
  /* 圆角和 /books 图书页保持一致 */
  border-radius: 4px 10px 10px 4px;
  overflow: hidden;
  background: var(--bg-elevated);
  text-decoration: none;
  transform-style: preserve-3d;
  /* 落影：一层是书压在板面上的接触阴影，一层是环境遮蔽 */
  box-shadow:
    0 16px 22px -13px rgba(0, 0, 0, 0.55),
    0 5px 9px -5px rgba(0, 0, 0, 0.34),
    inset 0 0 0 1px rgba(0, 0, 0, 0.10);
  transition:
    transform 0.5s var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    box-shadow 0.5s var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}

/* 悬停：像被从书架上抽出来一点 —— 前移 + 抬起 + 微微侧转，阴影拉长 */
.bs-book:hover,
.bs-book:focus-visible {
  transform: translateZ(40px) translateY(-14px) rotateY(4deg) scale(1.03);
  box-shadow:
    0 34px 48px -18px rgba(0, 0, 0, 0.58),
    0 8px 14px -6px rgba(0, 0, 0, 0.30);
  z-index: 5;
  outline: none;
}
.bs-book:focus-visible {
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--primary) 70%, transparent),
    0 34px 48px -18px rgba(0, 0, 0, 0.58);
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
  /* --bs-hue 由 JSX 按书 id 传入（0~330°，12 档）。只作用在背景层与图案层，
     书名文字不跟着转，否则深色书名会被转成奇怪的颜色。 */
  --bs-hue: 0deg;
}
/* 背景单独一层：这样 hue-rotate 只影响封面色，不影响上面的书名 */
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
/* 书脊高光叠在最上层，和真封面走同一套观感 */
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
  /* 图案跟着背景一起转色，两者始终同色系 */
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

/* ---------- 放不下的书：右上角一句提示，不做滚动 ---------- */
.bs-more {
  position: absolute;
  right: var(--bs-pad, 36px);
  top: 8px;
  z-index: 3;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12.5px;
  color: var(--text-muted);
  text-decoration: none;
  background: color-mix(in srgb, var(--bg-elevated) 74%, transparent);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.35);
  transition: color 0.3s var(--ease-out, ease);
}
.bs-more:hover { color: var(--primary); }

/* ---------- 放开父卡片对全幅的裁切 ----------
   .now-box 默认 overflow: hidden + 不透明底 + 22px 圆角，会把 100vw 的书架
   裁回卡片宽度（1280px），全幅就白做了。这里只放开「书架所在的那一格」，
   其余 .now-box 卡片不受影响。选择器带 .now-bento 提高优先级，
   免得被后加载的 .now-shelf 规则盖掉。 */
.now-bento > .now-shelf,
.now-bento > .bs-wrap {
  padding: 0;
  overflow: visible;
  border-color: transparent;
  border-radius: 0;
  background: transparent;
}

@media (max-width: 640px) {
  .bs-case { padding-top: 28px; padding-bottom: 18px; }
  .bs-side { width: 12px; }
  .bs-plank { height: 10px; }
}

@media (prefers-reduced-motion: reduce) {
  .bs-deck { transform: none; }
  .bs-book,
  .bs-book:hover,
  .bs-book:focus-visible {
    transition: none;
    transform: none;
  }
}
`;

if (typeof document !== 'undefined' && !document.getElementById(CSS_ID)) {
  const tag = document.createElement('style');
  tag.id = CSS_ID;
  tag.textContent = CSS;
  document.head.appendChild(tag);
}
