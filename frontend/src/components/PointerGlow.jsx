// 鼠标跟随聚光层：全屏固定，跟随指针位置更新 CSS 变量 --mx/--my
// 由 global.css 的 .pointer-glow 消费，形成「光随手动」的液态玻璃氛围。
// 触摸设备与 prefers-reduced-motion 下自动禁用。
import { useEffect, useRef } from 'preact/hooks';

export function PointerGlow() {
  const ref = useRef(null);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    if (reduced || coarse) return;

    const el = ref.current;
    if (!el) return;

    let frame = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight * 0.3;

    const paint = () => {
      frame = 0;
      el.style.setProperty('--mx', `${x}px`);
      el.style.setProperty('--my', `${y}px`);
    };

    const onMove = (e) => {
      x = e.clientX;
      y = e.clientY;
      // 用 rAF 节流，避免高频 setProperty 造成重排
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onEnter = () => document.body.classList.add('has-pointer');
    const onLeave = () => document.body.classList.remove('has-pointer');

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerenter', onEnter);
    document.addEventListener('pointerleave', onLeave);
    onEnter();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerenter', onEnter);
      document.removeEventListener('pointerleave', onLeave);
      document.body.classList.remove('has-pointer');
    };
  }, []);

  return <div ref={ref} class="pointer-glow" aria-hidden="true" />;
}
