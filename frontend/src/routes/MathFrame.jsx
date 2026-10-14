// 数学讲义（考研数学一）—— 用 iframe 把 /math/ 静态子站内嵌进主站。
//
// 背景（2026-10-14，用户要求）：
//   /math/ 是挂在 public/math/ 下的**独立多页静态站**（微积分 / 线性代数 / 概率统计，
//   27 章、自带 KaTeX 与 Three.js 的渲染管线）。此前导航项靠 data-native 走整页跳转，
//   点一下就"离开"主站，观感像外挂页面。用户原话：「点开就在导航下面，而不是跳走」。
//
// 方案：新增本站路由 /math，用 iframe 铺满内容区加载 /math/index.html?embed=1。
//   为什么选 iframe 而不是把讲义改写成 Preact 路由：那要把 27 章 / 2.9MB 的资源
//   连同两套渲染管线整体移植，成本与回归风险都远高于收益；iframe 能拿到"不跳走"的
//   观感，同时完全不动讲义内部实现。
//
// ?embed=1 的作用（见 public/math/assets/js/embed.js + assets/css/embed.css）：
//   · 挂 .is-embed：收掉讲义自带的主题开关（主站已无深色，主题以主站为准）、
//     窄屏下目录改为常驻不折叠；
//   · 讲义站内互跳自动带 embed=1，避免跳出嵌入态后出现"主站顶栏 + 讲义顶栏"双条；
//   · 讲义顶栏左上角的 ☰ 已改造成「返回」：子讲义页回总览，总览页回主站。
//
// 与主站顶栏的关系：iframe 在 .app-main 内铺满，主站顶栏保持常驻（导航高亮仍然生效）。
import { useEffect, useRef } from 'preact/hooks';
import { route } from 'preact-router';

// 2026-10-14 路径修正：讲义子站目录由 public/math/ 移到 public/math-site/。
// 原因：public/math/ 这个**静态目录**会被 Cloudflare Pages 优先匹配，
// 把本站的 /math 路由整个吃掉 —— 点导航「数学」时浏览器直接加载讲义页本身
// （整页跳走），MathFrame 组件从未被渲染。改名为 math-site 后 /math 归 SPA 路由独占，
// 讲义仍可通过 /math-site/ 直接访问。
const MATH_SRC = '/math-site/index.html?embed=1';

// 主题联动（2026-10-14 用户要求：「数学页面能否适配网站的三个配色」）：
//   讲义有自己的变量名（--bg / --surface / --ink / --brand …），主站是另一套
//   （--bg / --bg-elevated / --text / --primary …），两套名字不同，所以内嵌时
//   讲义一直用自己写死的浅色，不跟主站换主题。
//
//   做法：把主站**当前生效的**变量值读出来，转成 --dora-* 写进 iframe 的
//   <html>（讲义侧的 embed.css 再把它的变量指到这些 --dora-*）。
//   用 getComputedStyle 读的是「已解析后的值」，所以用户自定义配色也一并生效。
//
//   同源 iframe 可以直接读写 contentDocument，无需 postMessage。
const THEME_VARS = [
  ['--dora-bg', '--bg'],
  ['--dora-surface', '--bg-elevated'],
  ['--dora-surface-2', '--bg-subtle'],
  ['--dora-ink', '--text'],
  ['--dora-ink-2', '--text-muted'],
  ['--dora-ink-3', '--text-muted'],
  ['--dora-line', '--border'],
  ['--dora-line-2', '--border'],
  ['--dora-brand', '--primary'],
  ['--dora-brand-soft', '--bg-subtle']
];

// 把主站主题变量写进 iframe。frame 未加载完 / 跨域时静默跳过。
function syncTheme(frame) {
  try {
    const doc = frame && frame.contentDocument;
    if (!doc || !doc.documentElement) return;
    const src = getComputedStyle(document.documentElement);
    const root = doc.documentElement;
    for (const [to, from] of THEME_VARS) {
      const v = src.getPropertyValue(from).trim();
      if (v) root.style.setProperty(to, v);
    }
    // 主题名也带过去：讲义里若有按主题写死的分支可复用
    root.setAttribute('data-dora-theme', document.documentElement.getAttribute('data-theme') || 'light');
  } catch { /* 跨域或未就绪：保持讲义默认配色 */ }
}

export function MathFrame() {
  const frameRef = useRef(null);

  // 讲义总览页顶栏的「返回主站」按钮通过 postMessage 请求离开（见 embed.js）。
  // 只接受同源消息，避免别的页面/iframe 乱发命令触发路由跳转。
  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.data && e.data.type === 'dora:leave-math') route('/');
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // 主题同步：进入时注入一次；此后监听主站 <html data-theme> 的变化
  // （用户点右上角主题切换时，MutationObserver 捕获并重新注入）。
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const apply = () => syncTheme(frame);
    frame.addEventListener('load', apply);
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });
    return () => {
      frame.removeEventListener('load', apply);
      mo.disconnect();
    };
  }, []);

  // 滚动交给 iframe 内部，进入本页时先把主站滚回顶部，
  // 否则从长页面（如图谱）切进来会带着旧滚动位置。
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <iframe
      ref={frameRef}
      class="math-frame"
      src={MATH_SRC}
      title="考研数学一 · 三科讲义"
    />
  );
}
