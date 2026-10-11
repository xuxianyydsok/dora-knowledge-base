// 首页「此刻」Bento 小组件区（2026-10-11 新增，同日第二轮重构）
// ------------------------------------------------------------------
// 参考站长给的《blog-home-v2》模板里那一整块可交互的小组件（bento grid）。
//
// 2026-10-11 本轮按用户要求做的改动：
//   · 删掉「距离下一个整点」倒计时方框（用户明确要去掉）
//   · 删掉「每月文章数」折线，并把右侧的「一句话」一起合并、
//     拓宽成一整条「摘抄」带 —— 专门放较长的一段段文字（美文摘抄 / 哲理性段落），
//     不再是单句。文案由我先写，用户后续会给素材替换。
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
import { charGradients } from '../lib/brandGradient.js';


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

// ---------------- ⑤ 摘抄带（合并了原来的「一句话」与「每月文章数」）----------------
// 用户要求：去掉每月文章数，把右侧那块拓宽成一条，专门展示**较长**的文字，
// 不再是单句 —— 所以这里放的是整段摘抄（美文 / 哲理性段落），一次显示一整段。
// 文案由我先写，用户后续会给素材替换。
const EXCERPTS = [
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
  },
  {
    text: '认真记录的意义不在于回看，而在于记录的那一刻，你会下意识地把日子过得值得被记录。这是一种温柔的自我要求。',
    from: '关于记录'
  },
  {
    text: '知识只有被用起来才真正属于你。躺在收藏夹里的东西，就像书架上没拆封的书 —— 它们装饰了你的房间，却没有参与你的人生。',
    from: '关于阅读'
  }
];

function Excerpts() {
  const [i, setI] = useState(0);
  const [out, setOut] = useState(false);
  const [hold, setHold] = useState(false);
  const cur = EXCERPTS[i];

  const next = () => {
    setOut(true);
    setTimeout(() => { setI((v) => (v + 1) % EXCERPTS.length); setOut(false); }, 420);
  };
  // 每 12 秒自动翻一条（比单句慢，因为每段更长、需要更多阅读时间）；悬停时暂停
  useEffect(() => {
    if (hold) return undefined;
    const id = setInterval(next, 12000);
    return () => clearInterval(id);
  }, [hold, i]);

  return (
    <div
      class="now-box now-excerpt"
      role="button"
      tabindex="0"
      data-cursor="换一段"
      onClick={next}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); } }}
      onPointerEnter={() => setHold(true)}
      onPointerLeave={() => setHold(false)}
    >
      <p class="now-box-t">摘抄 · 读一段</p>
      <blockquote class={`now-ex-q${out ? ' out' : ''}`}>
        {cur.text}
      </blockquote>
      <div class="now-ex-foot">
        <span class="now-ex-from">{cur.from}</span>
        <div class="now-q-dots">
          {EXCERPTS.map((_, k) => <i key={k} class={k === i ? 'on' : ''} />)}
        </div>
      </div>
    </div>
  );
}

// ---------------- 组装 ----------------
// props.posts：公开文章列表（用于热力日历）；props.books：公开图书（用于书架）
export function HomeNow({ posts = [], books = [] }) {
  const dates = useMemo(() => posts.map((p) => p.published_at || p.created_at).filter(Boolean), [posts]);

  return (
    <div class="now-bento">
      {/* 左侧大格：品牌铁屑（112 模板的 A4 磁场铁屑，拼出 DoraStudio）。
          2026-10-12 用户要求：左上角那行小字换成首页首屏那串**渐变色的**
          「Dora Studio」（铁屑本身继续拼 DoraStudio 字样），并把铁屑整体
          往下挪一点，给渐变字标腾出位置（仍在同一张卡片内）。 */}
      <div class="now-box now-brand" data-cursor="拖动铁屑">
        <BrandGradient />
        <BrandFilings text="DoraStudio" height={340} ariaLabel="DoraStudio 铁屑字样" />
      </div>

      {/* 右列上：写作日历 */}
      <HeatCalendar dates={dates} />

      {/* 右列下：摘抄带（原来这里是「距离下一个整点」） */}
      <Excerpts />

      {/* 底部大格：真实书架（书正面立着、能看到封面） */}
      <BookShelf books={books} />
    </div>
  );
}
