// 首页「此刻」Bento 小组件区（2026-10-11 新增，同日第二轮重构）
// ------------------------------------------------------------------
// 参考站长给的《blog-home-v2》模板里那一整块可交互的小组件（bento grid）。
//
// 2026-10-11 本轮按用户要求做的改动：
//   · 删掉「距离下一个整点」倒计时方框（用户明确要去掉）
//   · 删掉「每月文章数」折线，并把右侧的「一句话」一起合并、
//     拓宽成一整条「摘抄」带 —— 专门放较长的一段段文字（美文摘抄 / 哲理性段落），
//     不再是单句。
//   · 「拨动时间的天空」换成 112 模板的「A4 磁场铁屑」，铁屑拼出 DoraStudio 字样
//     （组件 components/BrandFilings.jsx），不再打满整块方框。
//   · 书架与写作日历对调位置；书架换成 components/BookShelf.jsx ——
//     模拟真实书架的隔板与投影，书是**正面立着**的，能看到封面渲染图，不再是书脊。
//
// 保留：写作日历（近 26 周热力）、书架。
//
// 设计取舍：
//   · 全部零依赖（纯 SVG / canvas + CSS 动画 + 少量 JS），不引任何图表库。
//   · 每块的动画都只在「进入视口」时启动一次（IntersectionObserver），
//     不常驻 rAF，页面滚过去之后不烧 CPU。
//   · 颜色一律走主题变量，三套主题（纯净 / 素雅 / 天青）自动跟随。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { BrandFilings } from './BrandFilings.jsx';
import { BookShelf } from './BookShelf.jsx';
import { FocusMarquee } from './MotionFx.jsx';
import { charGradients } from '../lib/brandGradient.js';
import { Icon } from './Icon.jsx';


// 品牌字标「Dora Studio」（2026-10-12 用户要求）：
// 原先这串青→紫→粉的渐变字是首页首屏那个巨型标题上的，用户要求把首屏标题改回
// 「把散落的知识 / 收进一张星图」，而把渐变字标挪到这张铁屑卡片的左上角。
// 逐字切片渐变的原因见 lib/brandGradient.js 顶部注释（transform 会自成合成层，
// 父元素的 background-clip:text 裁不到）。
const BRAND_LINES = ['Dora Studio'];

function BrandGradient() {
  const grads = useMemo(() => charGradients(BRAND_LINES), []);
  return (
    <p class="now-brand-t">
      {[...BRAND_LINES[0]].map((ch, i) => (
        <span key={i} class="now-brand-ch" style={{ '--ld-grad': grads[i] }}>{ch}</span>
      ))}
    </p>
  );
}


// 进入视口时给元素加 .in（只触发一次），热力格子 / 折线的入场动画靠它启动
function useInView(threshold = 0.18) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver !== 'function') { el.classList.add('in'); return undefined; }
    const io = new IntersectionObserver((es) => {
      if (es[0].isIntersecting) { el.classList.add('in'); io.disconnect(); }
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return ref;
}

// ---------------- ③ 写作热力日历 ----------------
function HeatCalendar({ dates = [] }) {
  const boxRef = useInView(0.15);
  const cells = useMemo(() => {
    // 以「今天」为终点，往前铺 26 周 × 7 天
    const byDay = new Map();
    for (const d of dates) {
      const k = String(d).slice(0, 10);
      if (k) byDay.set(k, (byDay.get(k) || 0) + 1);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - 26 * 7 + 1);
    // 对齐到周一，保证每一列是一周
    const dow = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - dow);

    const out = [];
    for (let i = 0; i < 26 * 7; i += 1) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const n = byDay.get(key) || 0;
      out.push({ key, n, future: d > today });
    }
    return out;
  }, [dates]);

  // 五档：0 空 / 1 / 2 / 3 / 4+
  const lv = (n) => (n === 0 ? '' : n === 1 ? ' l1' : n === 2 ? ' l2' : n <= 4 ? ' l3' : ' l4');
  const total = cells.reduce((a, c) => a + c.n, 0);
  const activeDays = cells.filter((c) => c.n > 0).length;

  return (
    <div class="now-box now-heat" ref={boxRef}>
      <p class="now-box-t">写作日历</p>
      <div class="now-hm" role="img" aria-label={`近 26 周共有 ${total} 条记录，分布在 ${activeDays} 天`}>
        {cells.map((c, i) => (
          <i
            key={c.key}
            class={`now-hc${lv(c.n)}${c.future ? ' fu' : ''}`}
            style={{ '--k': `${(i % 7) * 60 + Math.floor(i / 7) * 8}ms` }}
            title={`${c.key}：${c.n} 条`}
          />
        ))}
      </div>
      <p class="now-box-s">近 26 周共 <b class="now-num">{total}</b> 条记录，分布在 <b class="now-num">{activeDays}</b> 天</p>
    </div>
  );
}

// ---------------- ⑤ 摘抄大卡片 ----------------
// 2026-10-18 用户要求：摘抄卡片与 Dora Studio 卡片**对调位置**，
// 摘抄改成像原来品牌卡那样的大卡片（要写很多内容），品牌卡缩到右列。
// 内容不再写死：由站长在 /admin/excerpts 维护，首页通过 /api/excerpts 读取。
// 接口失败或一条都没配置时，用下面这 3 段内置文案兜底，首页永远不会空。
const FALLBACK_EXCERPTS = [
  {
    text: '一个人真正的成长，往往不是突然懂得了什么大道理，而是某天清晨醒来，发现昨天让你辗转反侧的那件事，已经不再那么重要了。',
    from: '关于时间'
  },
  {
    text: '我们收藏一篇文章，收藏的其实是当时那个被击中的自己。所以重要的从来不是收藏夹有多满，而是你有没有在某个安静的夜里，真的把它读完。',
    from: '关于收藏'
  },
  {
    text: '把生活过成一条线的人是幸运的，但大多数人活成了一张网：这里的努力连着那里的放弃，此刻的犹豫牵着去年的决心。承认这张网，反而更容易往前走。',
    from: '关于选择'
  }
];

function Excerpts({ items = [] }) {
  // 统一结构：后台条目是 { content, source }，兜底是 { text, from }。
  const list = useMemo(
    () => (items.length ? items.map((x) => ({ text: x.content, from: x.source || '' })) : FALLBACK_EXCERPTS),
    [items]
  );
  const [i, setI] = useState(0);
  const [out, setOut] = useState(false);
  const [hold, setHold] = useState(false);
  const cur = list[i % list.length] || FALLBACK_EXCERPTS[0];
  const timerRef = useRef(null);
  const quoteRef = useRef(null);

  const next = () => {
    setOut(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setI((v) => (v + 1) % list.length);
      setOut(false);
    }, 420);
  };
  // 条目变化时回到第一条，避免删到末尾后下标越界。
  useEffect(() => { setI(0); }, [list.length]);
  // 卸载时清掉换段定时器，避免组件已离开页面还写状态。
  useEffect(() => () => clearTimeout(timerRef.current), []);
  // 每 18 秒自动翻一条（大卡片内容更长，需要更多阅读时间）；悬停时暂停
  useEffect(() => {
    if (hold || list.length < 2) return undefined;
    const id = setInterval(next, 18000);
    return () => clearInterval(id);
  }, [hold, i, list.length]);
  // 换段后回到顶部：长摘抄上一段滚到中间时，下一段不该从中途开始。
  useEffect(() => { if (quoteRef.current) quoteRef.current.scrollTop = 0; }, [i]);

  return (
    <div
      class="now-box now-excerpt"
      role="button"
      tabindex="0"
      data-cursor="换一段"
      onClick={(e) => {
        // 正文区允许滚动 / 选中文字；点正文不该误触「换一段」。
        if (e.target.closest?.('.now-ex-q')) return;
        next();
      }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); } }}
      onPointerEnter={() => setHold(true)}
      onPointerLeave={() => setHold(false)}
    >
      <div class="now-ex-head">
        <p class="now-box-t">摘抄 · 读一段</p>
        <span class="now-ex-count">{i + 1} / {list.length}</span>
      </div>
      <FocusMarquee text={`${cur.from || 'Dora Studio'} · 摘抄`} speed={22} height={74} class="now-ex-focus" />
      <blockquote ref={quoteRef} class={`now-ex-q${out ? ' out' : ''}`}>
        {cur.text}
      </blockquote>
      <div class="now-ex-foot">
        <span class="now-ex-from">{cur.from || '未注明出处'}</span>
        <div class="now-ex-nav">
          <div class="now-q-dots">
            {list.map((_, k) => <i key={k} class={k === i % list.length ? 'on' : ''} />)}
          </div>
          {list.length > 1 && (
            <button
              type="button"
              class="now-ex-next"
              onClick={(e) => { e.stopPropagation(); next(); }}
              aria-label="换一段摘抄"
            >
              换一段 <Icon name="arrowRight" size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- 组装 ----------------
// props.posts：公开文章列表（用于热力日历）；props.books：公开图书（用于书架）；
// props.excerpts：站长在后台维护的摘抄（首页只取启用项）
export function HomeNow({ posts = [], books = [], excerpts = [] }) {
  const dates = useMemo(() => posts.map((p) => p.published_at || p.created_at).filter(Boolean), [posts]);

  return (
    <div class="now-bento">
      {/* 右上：品牌铁屑。2026-10-18 用户要求与摘抄对调 —— 品牌内容较单调，
          缩到右列即可；摘抄需要大卡片承载更多文字。 */}
      <div class="now-box now-brand" data-cursor="拖动铁屑">
        <BrandGradient />
        <BrandFilings text="DoraStudio" height={240} ariaLabel="DoraStudio 铁屑字样" />
      </div>

      {/* 左列（跨两行）：摘抄大卡片 */}
      <Excerpts items={excerpts} />

      {/* 右列下：写作日历 */}
      <HeatCalendar dates={dates} />

      {/* 底部大格：真实书架（书正面立着、能看到封面） */}
      <BookShelf books={books} />
    </div>
  );
}
