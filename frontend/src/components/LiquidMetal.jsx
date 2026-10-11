// 全站指针特效层：液态金属珠（2026-10-11 新增，同日加入「画圈变大球」两档）
// ------------------------------------------------------------------
// 搬自站长给的模板《LUMEN · 光之工作室112》里的「A3 液态珠」：
// 7 颗半径递减的圆珠首尾相追，最前面那颗追指针；整层套一个 gooey
// SVG 滤镜（高斯模糊 + alpha 对比度拉伸），珠子靠近时会像水银一样
// 黏连成一坨，所以视觉上不是 7 个圆，而是一条会甩尾的液态金属。
//
// ── 两档形态（用户要求：悬停保持原样，只有按住画圈才变大球）──
//   · 悬停档：小珠子跟手，整层 0.55 透明度，静止 1.2s 渐隐到 0.25。
//   · 大球档：按住指针**持续画圈**拖动时触发。7 颗珠子整体放大约 2.4 倍、
//     透明度提到 0.85，并且不再首尾相追，而是全部向头珠聚拢、带一点缓慢
//     自转的偏心量 —— 这样它们会黏成一坨有起伏的金属球，而不是拉成一条线。
//     松手后延迟 0.6s 再退出（缩放系数是逐帧缓动的，所以退出时自带回弹感）。
//
// 判定「画圈」的口径（刻意做得简单可靠，不做圆拟合）：
//   按住左键时，把最近 2.6 秒的指针轨迹存进滑动窗口，对相邻两段位移求
//   atan2 夹角、处理 ±π 跨越后**带符号累加**，同时累加绝对值：
//     · |带符号累计转角| ≥ 2π × 1.2  —— 真的绕了一圈多（顺/逆时针都算）
//     · |带符号| / 绝对值 ≥ 0.72     —— 方向一致，排除左右来回乱甩
//     · 轨迹包围盒最长边 ≥ 50px      —— 排除原地画小圈
//     · 采样点 ≥ 6 个                —— 样本太少不做判断
//   三个条件同时满足才进大球档。只要有一项不满足就维持悬停档，不会误触发。
//
// 设计取舍（都是「为什么」）：
//   · 层级取 29：站点的导航栏 .app-header 是 z-index 30（--z-sticky），
//     珠子必须压在导航下面，否则会在顶栏上糊一层彩色；同时 29 又高于
//     页面正文（多数内容 z-index 0~5），保证它不会被卡片盖住。
//     整层 pointer-events:none，所以不管层级多少都不会抢走点击。
//   · 颜色用**站点品牌渐变**（青 → 紫 → 粉，与首页标题、铁屑卡片上的
//     Dora Studio 字标同一套），并按珠子在队里的位置切片 —— 头珠偏青、
//     尾珠偏粉，整条链子本身就是一条流动的渐变，聚成大球时是一颗多色球。
//     ⚠ 2026-10-12 用户反馈：之前是从主题变量 --primary 派生的单色渐变，
//       而三套主题的主色分别是蓝 / 墨 / 青，珠子看起来「一直是青色」，
//       所以改成固定的品牌渐变（与标题一致，三套主题下都成立）。
//   · 单个 rAF 命令式写 style.transform，不走 setState：每帧 7 次赋值
//     而已，比 Preact 重新渲染便宜一个数量级。
//   · 缩放走**每颗珠子自己的 transform: scale()**，不改 width/height：
//     改尺寸会触发布局重算，而 transform 只走合成层。但缩放后的珠子在
//     父级滤镜里实际变大，模糊半径就显得不够了（珠子之间会露接缝），
//     所以大球档同步切到 stdDeviation=18 的那份滤镜。
//   · 只在「真实指针 + 未关闭动态效果」时启用；触屏和 reduced-motion 下
//     组件直接返回 null，连 DOM 都不创建，不占内存也不掉帧。
import { useEffect, useRef, useState } from 'preact/hooks';
import { charGradients } from '../lib/brandGradient.js';

const STYLE_ID = 'liquid-metal-css';
const FILTER_ID = 'dora-lm-gf';
const FILTER_BIG_ID = 'dora-lm-gf-big';
const BEAD_COUNT = 7;
const BEAD_MAX = 56;      // 比模板的 70 小一圈：这是「背景装饰」不是主角
const BEAD_STEP = 7;
const IDLE_MS = 1200;     // 指针静止超过这个时长就自动变淡
const OPACITY_ON = 0.55;
const OPACITY_IDLE = 0.25;
const OPACITY_BIG = 0.85;

// 品牌渐变按珠子数量切片：7 颗珠子 → 7 段首尾相接的渐变。
// 用 charGradients 复用标题那套「按位置切片」的算法（它本来就是干这个的），
// 传 7 个占位字符只是为了拿到 7 段。
const BEAD_GRADIENTS = charGradients(['x'.repeat(BEAD_COUNT)]);

// ---- 画圈判定参数 ----
const TRACK_MS = 2600;    // 滑动窗口：只看最近 2.6 秒的轨迹
const TRACK_MAX = 90;     // 窗口内最多留这么多采样点（防止高频指针事件堆积）
const TRACK_MIN = 6;      // 少于这么多点不判断
const TURN_MIN = Math.PI * 2 * 1.2;  // 累计转角阈值：一圈多
const CONSISTENCY_MIN = 0.72;        // 方向一致性阈值
const SPAN_MIN = 50;                 // 轨迹包围盒最长边下限（px）
const BIG_EXIT_MS = 600;             // 松手后延迟退出大球档

// ---- 大球档形态参数 ----
const SCALE_BIG = 2.4;    // 整体放大倍数
const K_HEAD = 0.14;      // 悬停档：头珠跟指针的系数（慢一点才有甩尾）
const K_TAIL = 0.3;       // 悬停档：后面几颗跟得紧才连成一条
const K_HEAD_BIG = 0.3;   // 大球档：头珠跟得更紧
const K_TAIL_BIG = 0.22;  // 大球档：其余珠子聚向头珠
const CHURN_R = 3.6;      // 大球档：每颗珠子绕头珠的偏心半径（px/颗）

const CSS_TEXT = `
#liquid-metal-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  /* 低于 .app-header(30)，高于正文；详见文件头注释 */
  z-index: 29;
  opacity: ${OPACITY_ON};
  /* 透明度与缩放都在 rAF 里逐帧缓动，这里不能再挂 transition，
     否则每帧写进去的值会被 0.7s 的过渡拖成一条糊掉的尾巴 */
}
#liquid-metal-layer .lm-goo {
  position: absolute;
  inset: 0;
  filter: url(#${FILTER_ID});
}
#liquid-metal-layer .lm-bead {
  position: absolute;
  left: 0;
  top: 0;
  border-radius: 50%;
  /* --lm-grad 由 JSX 按珠子的队内位置传入（品牌渐变的一段）；兜底给整条渐变 */
  background: var(--lm-grad, linear-gradient(135deg, #3de6ff, #8b5cff, #ff5fd2));
  will-change: transform;
}
.lm-defs {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}
@media (prefers-reduced-motion: reduce) {
  #liquid-metal-layer { display: none !important; }
}
`;

function shouldEnable() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  return !reduce && fine;
}

// 判断这串轨迹像不像「在画圈」。返回是否够格进大球档。
// 抽成纯函数是为了能单独跑断言，逻辑本身不依赖任何 DOM 状态。
export function isCircling(track) {
  if (!Array.isArray(track) || track.length < TRACK_MIN) return false;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of track) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  if (Math.max(maxX - minX, maxY - minY) < SPAN_MIN) return false;

  let signed = 0;   // 带符号累计转角（顺/逆时针分别得到正/负）
  let absolute = 0; // 转角绝对值之和，用来判断方向是否一致
  for (let i = 2; i < track.length; i += 1) {
    const a = Math.atan2(track[i - 1].y - track[i - 2].y, track[i - 1].x - track[i - 2].x);
    const b = Math.atan2(track[i].y - track[i - 1].y, track[i].x - track[i - 1].x);
    let d = b - a;
    // 把夹角折回 (-π, π]，否则跨过 ±π 时会算出一整个 2π 的假跳变
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    signed += d;
    absolute += Math.abs(d);
  }
  if (absolute <= 0) return false;
  if (Math.abs(signed) < TURN_MIN) return false;
  return Math.abs(signed) / absolute >= CONSISTENCY_MIN;
}

export function LiquidMetal() {
  // 用惰性初值：不满足条件的设备连一次渲染都不做，直接返回 null。
  const [enabled] = useState(shouldEnable);
  const hostRef = useRef(null);
  const gooRef = useRef(null);
  const beadsRef = useRef([]);

  useEffect(() => {
    if (!enabled) return undefined;

    const host = hostRef.current;
    const goo = gooRef.current;
    const beads = beadsRef.current.filter(Boolean);
    if (!host || !goo || beads.length !== BEAD_COUNT) return undefined;

    // ---- 注入样式（幂等：HMR 或二次挂载时复用已存在的那个） ----
    let style = document.getElementById(STYLE_ID);
    let createdStyle = false;
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS_TEXT;
      document.head.appendChild(style);
      createdStyle = true;
    }

    // ---- 指针目标：层本身 pointer-events:none，所以只能挂在 window 上 ----
    const startX = window.innerWidth / 2;
    const startY = window.innerHeight / 2;
    const target = { x: startX, y: startY, on: false };
    const points = Array.from({ length: BEAD_COUNT }, () => ({ x: startX, y: startY }));
    let lastMove = performance.now();
    let isIdle = false;

    // 画圈判定用的滑动窗口：只在按住左键时收集
    let down = false;
    let big = false;
    let bigTimer = 0;
    let track = [];

    const setBig = (next) => {
      if (next === big) return;
      big = next;
      // 两份滤镜只差模糊半径：大球档珠子放大了 2.4 倍，半径不跟着放大就会露接缝。
      // 切滤镜而不是改 stdDeviation 属性值，是为了让浏览器一次性换掉整条滤镜链，
      // 避免中途出现「模糊已变、alpha 拉伸没跟上」的一帧脏画面。
      goo.style.filter = next ? `url(#${FILTER_BIG_ID})` : `url(#${FILTER_ID})`;
    };

    const clearBigTimer = () => {
      if (bigTimer) { clearTimeout(bigTimer); bigTimer = 0; }
    };

    const onMove = (e) => {
      target.x = e.clientX;
      target.y = e.clientY;
      target.on = true;
      lastMove = performance.now();
      if (!down) return;

      const now = performance.now();
      track.push({ x: e.clientX, y: e.clientY, t: now });
      // 按时间丢旧的：窗口固定 2.6s，这样慢速画圈也能攒够转角
      while (track.length && now - track[0].t > TRACK_MS) track.shift();
      if (track.length > TRACK_MAX) track.splice(0, track.length - TRACK_MAX);

      // 已经是大球档就不用再判定；否则一旦够格立刻进入
      if (!big && isCircling(track)) setBig(true);
    };
    const onLeave = () => { target.on = false; };

    const onDown = (e) => {
      // 只认鼠标左键：触摸设备本来就渲染不出这个组件，右键 / 中键不该触发
      if (e.pointerType && e.pointerType !== 'mouse') return;
      if (e.button !== 0) return;
      down = true;
      track = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
      clearBigTimer();
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      track = [];
      // 松手后延迟退出：立刻缩回去会很生硬，留 0.6s 让缩放缓动收尾
      clearBigTimer();
      bigTimer = window.setTimeout(() => { bigTimer = 0; setBig(false); }, BIG_EXIT_MS);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    // 系统级取消（比如拖到窗口外、被别的程序抢走指针）也要收尾，否则会卡在大球档
    window.addEventListener('pointercancel', onUp, { passive: true });
    // 指针移出窗口时要让珠子自己飘回绕圈，否则会卡在边缘不动
    document.documentElement.addEventListener('pointerleave', onLeave);
    document.addEventListener('mouseleave', onLeave);
    window.addEventListener('blur', onLeave);
    // 失焦 / 切走时不会收到 pointerup，得主动收尾，否则会一直卡在大球档
    window.addEventListener('blur', onUp);

    // ---- 主循环：每颗追前一颗，第 0 颗追指针；指针离开后自动绕圈 ----
    const t0 = performance.now();
    let raf = 0;
    let scale = 1;        // 逐帧缓动的缩放系数：进出大球档自带回弹
    let alpha = OPACITY_ON;
    let writtenAlpha = -1; // 上一帧真正写进 style 的值，用来跳过无意义的赋值

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const t = (now - t0) / 1000;
      const w = window.innerWidth;
      const h = window.innerHeight;

      // 静止渐隐只在状态翻转时算一次；大球档下不渐隐（手按着在动，没必要变淡）
      const idle = now - lastMove > IDLE_MS;
      if (idle !== isIdle) isIdle = idle;

      // 缩放与透明度都做缓动：目标值突变，但视觉上是「弹」过去的
      scale += ((big ? SCALE_BIG : 1) - scale) * 0.12;
      const alphaTarget = big ? OPACITY_BIG : (isIdle ? OPACITY_IDLE : OPACITY_ON);
      alpha += (alphaTarget - alpha) * 0.1;
      // 一帧写一次 opacity 很便宜（就一个固定层），但差得太小就不写，省一次样式重算
      if (Math.abs(alpha - writtenAlpha) > 0.004) {
        writtenAlpha = alpha;
        host.style.opacity = alpha.toFixed(3);
      }

      const head = points[0];
      for (let i = 0; i < BEAD_COUNT; i++) {
        const p = points[i];
        let tx;
        let ty;
        let k;
        if (i === 0) {
          tx = target.on ? target.x : w / 2 + Math.cos(t * 1.1) * w * 0.28;
          ty = target.on ? target.y : h * 0.4 + Math.sin(t * 1.7) * h * 0.18;
          k = big ? K_HEAD_BIG : K_HEAD;
        } else if (big) {
          // 大球档：不再首尾相追，全部聚向头珠；给每颗一点缓慢自转的偏心量，
          // 让整坨球有起伏而不是糊成一个正圆。
          const a = t * 1.5 + i * 1.05;
          const r = i * CHURN_R;
          tx = head.x + Math.cos(a) * r;
          ty = head.y + Math.sin(a) * r;
          k = K_TAIL_BIG;
        } else {
          tx = points[i - 1].x;
          ty = points[i - 1].y;
          k = K_TAIL;
        }
        p.x += (tx - p.x) * k;
        p.y += (ty - p.y) * k;
        // 先平移到目标点，再以珠子自身中心缩放（负 margin 已把中心挪到原点）
        beads[i].style.transform = `translate(${p.x}px,${p.y}px) scale(${scale.toFixed(4)})`;
      }
    };
    raf = requestAnimationFrame(loop);

    // 后台标签页停掉 rAF：虽然浏览器多半会自己节流，显式停掉更省电
    const onVisibility = () => {
      if (document.hidden) {
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
      } else if (!raf) {
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      clearBigTimer();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('blur', onLeave);
      window.removeEventListener('blur', onUp);
      document.removeEventListener('visibilitychange', onVisibility);
      if (createdStyle && style.parentNode) style.parentNode.removeChild(style);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      {/* gooey 滤镜定义：模糊后把 alpha 乘 22 再减 9，相邻珠子就会黏成一坨。
          两份只差模糊半径 —— 悬停档 9（珠子最大 56px），大球档 18（放大后最大约 134px）。 */}
      <svg class="lm-defs" aria-hidden="true" focusable="false">
        <defs>
          <filter id={FILTER_ID} color-interpolation-filters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="lmBlur" />
            <feColorMatrix
              in="lmBlur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"
            />
          </filter>
          <filter id={FILTER_BIG_ID} color-interpolation-filters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="lmBlurBig" />
            <feColorMatrix
              in="lmBlurBig"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"
            />
          </filter>
        </defs>
      </svg>
      <div id="liquid-metal-layer" ref={hostRef} aria-hidden="true">
        <div class="lm-goo" ref={gooRef}>
          {Array.from({ length: BEAD_COUNT }, (_, i) => {
            const size = BEAD_MAX - i * BEAD_STEP;
            return (
              <i
                key={i}
                class="lm-bead"
                ref={(el) => { beadsRef.current[i] = el; }}
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  // 品牌渐变的一段：头珠偏青、尾珠偏粉，整条链子是一条连续渐变
                  '--lm-grad': BEAD_GRADIENTS[i],
                  // 负 margin 让 translate(x,y) 落在珠子圆心而不是左上角；
                  // 圆心正好在元素局部坐标系原点，所以 scale() 也就绕圆心缩放
                  margin: `${-size / 2}px`
                }}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}

export default LiquidMetal;
