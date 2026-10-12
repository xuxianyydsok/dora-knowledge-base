// 页面加载进度条（2026-10-12 用户要求）
//
// 需求原话：「点击那个页面的时候它不是有一定的延迟吗，然后这个延迟的时间的话做一个
//   加载动画；一旦加载出来马上那个加载动画就消失了；这个加载动画没有时间限制，
//   点击了就显示加载动画，马上加载出来那种就不用显示加载动画。」
//
// 拆成三条规则：
//   1) 出现加载态后**先等 120ms** 才显示进度条 —— 「马上加载出来」的页面就完全不显示，
//      不会闪一下。低于 120ms 的等待人本来就感知不到，显示了反而像故障。
//   2) 一旦显示就**没有固定时长**：慢多久就转多久（这正是用户要的「没有时间限制」）。
//   3) 加载态一消失**立刻**收尾淡出。
//
// 判据为什么是「DOM 里有没有骨架屏」而不是路由状态：
//   用户感受到的延迟主要来自**数据**（接口 1.5~6s），而不是分包下载。
//   各页面的加载态已经统一走 StateView（`.sk-grid` / `.center-box`），
//   直接观察这些节点就能精确覆盖「用户眼前到底有没有东西」，
//   既不依赖 Router 上下文（本组件挂在 Router 之外），也不受各页自定义逻辑影响。
import { useEffect, useState } from 'preact/hooks';
import '../styles/route-progress.css';

// 「还没加载出来」的判据：骨架屏 / 居中加载块 / 行内加载提示。
const LOADING_SEL = '.app-main .sk-grid, .app-main .center-box, .app-main .loading-more';

// 出现加载态后等多久才显示进度条（低于这个时长不显示，避免闪一下）。
const SHOW_DELAY_MS = 120;
// 收尾：补到 100% 后淡出的时长，必须与 route-progress.css 里的 opacity transition 对齐。
const FADE_OUT_MS = 220;

export function RouteProgress() {
  const [visible, setVisible] = useState(false);
  const [pct, setPct] = useState(0);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    let raf = 0;
    let showTimer = 0;
    let hideTimer = 0;
    let disposed = false;
    let shown = false;     // 进度条是否真的显示出来了（没显示过就不需要收尾）
    let progress = 0;
    let watching = false;  // 当前是否处于「等加载完成」的观察状态

    const stillLoading = () => !!document.querySelector(LOADING_SEL);

    const stopWatching = () => {
      watching = false;
      window.clearTimeout(showTimer);
      window.cancelAnimationFrame(raf);
    };

    // 收尾：补到 100% 再淡出。只在「确实显示过」时才做，
    // 否则秒开的页面会凭空闪一条满格进度条。
    const finish = () => {
      stopWatching();
      if (!shown) { setVisible(false); return; }
      setFinishing(true);
      setPct(100);
      hideTimer = window.setTimeout(() => {
        if (disposed) return;
        setVisible(false);
        setFinishing(false);
        setPct(0);
        shown = false;
      }, FADE_OUT_MS);
    };

    const tick = () => {
      if (disposed) return;
      if (!stillLoading()) { finish(); return; }
      // 还在加载：继续往前爬，越接近 92% 越慢，形成「在等」的观感而不假装快满了。
      if (shown) {
        progress = Math.min(92, progress + (92 - progress) * 0.055 + 0.35);
        setPct(progress);
      }
      raf = window.requestAnimationFrame(tick);
    };

    // 进入加载态：先等 120ms，还没好才真的显示
    const startWatching = () => {
      if (watching) return;
      watching = true;
      showTimer = window.setTimeout(() => {
        if (disposed || !watching) return;
        if (!stillLoading()) { watching = false; return; }   // 已经加载完了，整条都不出现
        shown = true;
        setVisible(true);
        setPct(6);
        progress = 6;
        raf = window.requestAnimationFrame(tick);
      }, SHOW_DELAY_MS);
    };

    // 观察整棵树：路由切换会整块重挂 .app-main（Layout 上 key={routePath}），
    // 各页面拿到数据后又会把骨架屏换成真实内容，两者都会产生 mutation。
    const observer = new MutationObserver(() => {
      if (stillLoading()) startWatching();
      else if (watching || shown) finish();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 首次挂载时可能已经在加载中（比如直接打开某个懒加载页面）
    if (stillLoading()) startWatching();

    return () => {
      disposed = true;
      observer.disconnect();
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
      window.cancelAnimationFrame(raf);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      class={`route-progress${finishing ? ' is-done' : ''}`}
      role="progressbar"
      aria-label="页面载入中"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span class="route-progress-bar" style={`width:${pct}%`} />
    </div>
  );
}
