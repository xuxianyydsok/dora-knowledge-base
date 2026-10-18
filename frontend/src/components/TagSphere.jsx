// 3D 标签球（2026-10-18，来自图鉴 #114）
//
// 与图鉴原版的差异：**用真实标签**。原版写死了 22 个演示词
// （音乐/电影/RSS/…），这里接收站内真实标签列表。
//
// 实现要点（都是图鉴里验证过的，照搬）：
//   · 用 Fibonacci 球面均匀撒点（黄金角 2.399963），避免标签在极点堆积；
//   · 每帧绕 X / Y 轴做一次旋转矩阵，再按 z 计算缩放、透明度、层级；
//   · 鼠标移动改变旋转速度（不是位置），松手后回到匀速自转 ——
//     这样「移动鼠标控制转向」不会变成「鼠标一动球就停」。
//   · 用 requestAnimationFrame，页面不可见时暂停（省电，与站点其它动画一致）。
import { useEffect, useRef } from 'preact/hooks';

const GOLDEN = 2.399963;   // 黄金角（弧度），让点在球面上分布均匀

export function TagSphere({ items = [], size = 280 }) {
  const boxRef = useRef(null);
  const stateRef = useRef(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || !items.length) return undefined;

    // 每次 items 变化都重建：标签数量变了，球面点位也要重算
    box.textContent = '';
    const n = items.length;
    const points = [];
    const nodes = [];

    items.forEach((item, i) => {
      const label = typeof item === 'string' ? item : item.name;
      const y = 1 - (2 * (i + 0.5)) / n;          // y 从 1 均匀降到 -1
      const r = Math.sqrt(Math.max(0, 1 - y * y)); // 对应纬度上的圆半径
      const t = i * GOLDEN;
      const span = document.createElement('span');
      span.textContent = label;
      box.appendChild(span);
      nodes.push(span);
      points.push([Math.cos(t) * r, y, Math.sin(t) * r]);
    });

    // 旋转速度：默认匀速自转；鼠标移动时临时改速度（不是改角度）
    const state = { ax: 0.004, ay: 0.006, raf: 0, running: true };
    stateRef.current = state;

    const onMove = (e) => {
      const rect = box.getBoundingClientRect();
      state.ay = ((e.clientX - rect.left) / rect.width - 0.5) * 0.04;
      state.ax = -((e.clientY - rect.top) / rect.height - 0.5) * 0.04;
    };
    const onLeave = () => { state.ax = 0.004; state.ay = 0.006; };
    box.addEventListener('pointermove', onMove);
    box.addEventListener('pointerleave', onLeave);

    const frame = () => {
      if (!state.running) return;
      const cx = Math.cos(state.ax), sx = Math.sin(state.ax);
      const cy = Math.cos(state.ay), sy = Math.sin(state.ay);

      for (let i = 0; i < points.length; i++) {
        let [x, y, z] = points[i];
        // 绕 X 轴转，再绕 Y 轴转
        const y1 = y * cx - z * sx;
        const z1 = y * sx + z * cx;
        const x2 = x * cy + z1 * sy;
        const z2 = -x * sy + z1 * cy;
        points[i] = [x2, y1, z2];

        const depth = (z2 + 1) / 2;              // 0 = 最远，1 = 最近
        const el = nodes[i];
        const scale = 0.6 + depth * 0.7;
        el.style.transform = `translate(-50%,-50%) translate(${x2 * (size * 0.41)}px,${y1 * (size * 0.41)}px) scale(${scale})`;
        el.style.opacity = String(0.2 + 0.8 * depth);
        // 只在前景/背景之间切换「强调色 / 弱化色」，不用彩虹色 ——
        // 站内主色是单一色系，彩虹会显得杂乱（图鉴原版是演示用）。
        el.style.color = depth > 0.55 ? 'var(--primary)' : 'var(--text-muted)';
        el.style.zIndex = String(Math.round(depth * 10));
      }
      state.raf = requestAnimationFrame(frame);
    };
    state.raf = requestAnimationFrame(frame);

    // 页面切到后台时暂停（不然后台也在跑 rAF，耗电）
    const onVis = () => {
      state.running = !document.hidden;
      if (state.running) state.raf = requestAnimationFrame(frame);
      else cancelAnimationFrame(state.raf);
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      state.running = false;
      cancelAnimationFrame(state.raf);
      box.removeEventListener('pointermove', onMove);
      box.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [items, size]);

  if (!items.length) return null;

  return (
    <div
      ref={boxRef}
      class="tsph"
      style={{ width: `${size}px`, height: `${size}px` }}
      role="img"
      aria-label={`标签球，共 ${items.length} 个标签`}
    />
  );
}
