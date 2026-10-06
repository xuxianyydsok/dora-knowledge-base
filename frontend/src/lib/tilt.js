// 卡片 3D 倾斜交互：指针移动时轻微透视旋转 + 高光跟随
// 轻量实现（直接写 style，不引入依赖）；触摸设备与 reduced-motion 下自动跳过。

const MAX_TILT = 6;      // 最大旋转角度（度）

export function attachTilt(el, { max = MAX_TILT } = {}) {
  if (!el) return () => {};
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  if (reduced || coarse) return () => {};

  let frame = 0;
  let target = { rx: 0, ry: 0 };

  const apply = () => {
    frame = 0;
    el.style.transform =
      `perspective(900px) rotateX(${target.rx}deg) rotateY(${target.ry}deg) translateY(-6px) scale(1.012)`;
  };

  const onMove = (e) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;    // 0..1
    const py = (e.clientY - r.top) / r.height;    // 0..1
    target = {
      rx: (0.5 - py) * max * 2,
      ry: (px - 0.5) * max * 2
    };
    if (!frame) frame = requestAnimationFrame(apply);
  };

  const reset = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    el.style.transform = '';
  };

  el.addEventListener('pointermove', onMove, { passive: true });
  el.addEventListener('pointerleave', reset);
  el.addEventListener('pointercancel', reset);

  return () => {
    if (frame) cancelAnimationFrame(frame);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerleave', reset);
    el.removeEventListener('pointercancel', reset);
    el.style.transform = '';
  };
}
