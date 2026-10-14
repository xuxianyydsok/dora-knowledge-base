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
import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';

const MATH_SRC = '/math/index.html?embed=1';

export function MathFrame() {
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

  // 滚动交给 iframe 内部，进入本页时先把主站滚回顶部，
  // 否则从长页面（如图谱）切进来会带着旧滚动位置。
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <iframe
      class="math-frame"
      src={MATH_SRC}
      title="考研数学一 · 三科讲义"
    />
  );
}
