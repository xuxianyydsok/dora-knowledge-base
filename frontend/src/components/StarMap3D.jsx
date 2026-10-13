// 3D 星图（StarMap3D）：博客图谱 / 开源项目图谱的「3D 模式」画布。
//
// 定位：与 2D 的 StarMap 并列，**不改动 2D 版**。用户可在画布右上角切「2D / 3D」，
// 桌面默认 3D、手机默认 2D（3D 在小屏 + 弱设备上体验差，见 GraphHub 的默认值）。
//
// 与 2D 的关系（重要）：
//   3D 版**复用 StarMap 的 buildScene 结果**（星区 / 星点 / 连线 / 邻居表），
//   只是把同一批数据放到三维空间里画。这样两边的分类配色、筛选联动、
//   悬停高亮语义完全一致，不会出现「2D 和 3D 看起来是两个东西」。
//
// 空间布局（怎么把 2D 的「星区圆盘」变成 3D 的「星云」）：
//   2D 里每个星区是一个扇区（角度 angle + 半径 r）。3D 里把**角度映射成绕 Y 轴的方位角**，
//   半径映射成到中心的水平距离，再给每个点一个**小范围的高度抖动（y）** ——
//   于是「一个扇区」就成了一片有厚度的立体星带，整体仍是一团围绕中心的星云，
//   和用户给的参考图（深色空间里一团有纵深的星云）是同一个观感。
//
// 性能取舍（数据规模：博客 344 点 / 707 边，开源更大）：
//   1. 节点用 **单个 THREE.Points** 绘制（一次 draw call），绝不给每个点建 Mesh；
//   2. 连线用 **单个 LineSegments**（所有边塞进一个 position 数组）；
//   3. 标签只给「枢纽 + 悬停点」建 sprite，且限制总数 —— 几百个 DOM/sprite 会拖垮帧率；
//   4. 设备像素比上限 2（4K 屏上按 2 渲染足够清晰，再高只是白烧 GPU）；
//   5. 页面不可见（切标签页）时暂停渲染循环，省电。

import { useEffect, useRef, useState } from 'preact/hooks';
// 纯布局计算在 lib/star3dLayout.js（点大小、俯仰角、三维坐标、自检都在那边，
// 那份是零依赖纯函数，能被 Node 直接 import 做离线单测）。
import { layout3D, CAMERA_TILT, validateLayout } from '../lib/star3dLayout.js';

// 自转速度（弧度/秒）。用户明确要求「缓慢自转」——0.055 约 114 秒转一圈，
// 有动感但不晃眼（实测 0.15 以上会让人盯久了发晕）。
// ⚠ 这个常量属于**渲染节奏**而不是布局数学，所以留在组件里、不进 lib/star3dLayout.js。
const ROTATE_SPEED = 0.055;

/**
 * 3D 星图画布。
 *
 * 交互（与 2D 对齐 + 3D 特有）：
 *   · 缓慢自转（用户明确要求）
 *   · 鼠标拖动旋转、滚轮缩放（3D 特有）
 *   · 悬停高亮该点的邻接连线 + 显示标题
 *   · 点击：枢纽 = 筛选，星点 = 进文章 / 去 GitHub（回调交宿主处理）
 */
export function StarMap3D({ data, mode = 'blog', onPick, label, autoRotate = true }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const [hover, setHover] = useState(null);     // { label, x, y }
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  const stateRef = useRef(null);

  useEffect(() => {
    let alive = true;
    let cleanup = null;
    (async () => {
      try {
        const THREE = await import('three');
        const { buildScene } = await import('./StarMap.jsx');
        if (!alive) return;
        const wrapEl = wrap.current;
        const canvasEl = canvas.current;
        if (!wrapEl || !canvasEl) return;

        // ⚠ 命名要分清：buildScene 返回的是**普通数据对象**（星区 / 星点 / 连线），
        // 不是 three 的 Scene。这里叫 graph，three 的场景单独叫 threeScene。
        const graph = buildScene(data, mode);
        const geo = layout3D(graph, 10);
        // 布局自检：坐标出现 NaN / 数组长度不匹配这类问题会让画面**静默全黑**，
        // 在开发时直接抛出来，比事后靠截图排查省事得多。
        if (import.meta.env?.DEV) {
          const errs = validateLayout(geo, graph);
          if (errs.length) console.error('[StarMap3D] 布局自检未通过:', errs);
        }

        const renderer = new THREE.WebGLRenderer({
          canvas: canvasEl, antialias: true, alpha: true, powerPreference: 'high-performance'
        });
        renderer.setClearAlpha(0);

        const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
        const camDist = 24;
        const target = new THREE.Vector3(0, 0, 0);

        // 用 Group 承载所有物体：自转就是转这个 group，相机保持不动（拖拽时再改相机）
        const root = new THREE.Group();
        const threeScene = new THREE.Scene();

        // ---- 节点：单个 Points ----
        const ptGeo = new THREE.BufferGeometry();
        ptGeo.setAttribute('position', new THREE.BufferAttribute(geo.positions, 3));
        ptGeo.setAttribute('color', new THREE.BufferAttribute(geo.colors, 3));
        ptGeo.setAttribute('size', new THREE.BufferAttribute(geo.sizes, 1));

        // 自定义着色器：让每个点有自己的大小 + 圆形柔边（默认 PointsMaterial 是方块，
        // 且不支持逐点大小）。这是 3D 星云「像星星」的关键。
        const ptMat = new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          vertexShader: `
            attribute float size;
            attribute vec3 color;      /* ⚠ 必须显式声明：ShaderMaterial 不像
                                          PointsMaterial 那样自动注入 color attribute，
                                          漏了它 vColor 会拿到未定义值、整片星点渲染成黑色
                                          （实测表现：画布只有深空底，一颗星都看不见）。 */
            varying vec3 vColor;
            void main() {
              vColor = color;
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              // 透视缩放：远处的点变小。clamp 下限避免近处点糊满屏、上限避免远处消失。
              gl_PointSize = clamp(size * (260.0 / -mv.z), 1.0, 22.0);
              gl_Position = projectionMatrix * mv;
            }`,
          fragmentShader: `
            varying vec3 vColor;
            void main() {
              // 圆形柔边：中心亮、边缘透明
              vec2 d = gl_PointCoord - vec2(0.5);
              float r = length(d);
              if (r > 0.5) discard;
              float a = smoothstep(0.5, 0.05, r);
              gl_FragColor = vec4(vColor, a);
            }`,
          // vertexColors 对 ShaderMaterial 无效（那是内置材质的开关），
          // 颜色完全由上面的 attribute + varying 传递，这里不再设置。
        });
        const points = new THREE.Points(ptGeo, ptMat);
        root.add(points);

        // ---- 连线：单个 LineSegments ----
        const lnGeo = new THREE.BufferGeometry();
        lnGeo.setAttribute('position', new THREE.BufferAttribute(geo.linkPositions, 3));
        lnGeo.setAttribute('color', new THREE.BufferAttribute(geo.linkColors, 3));
        const lnMat = new THREE.LineBasicMaterial({
          vertexColors: true, transparent: true, opacity: 0.34, depthWrite: false
        });
        const lines = new THREE.LineSegments(lnGeo, lnMat);
        root.add(lines);

        threeScene.add(root);

        // ---- 尺寸 ----
        const resize = () => {
          const w = Math.max(1, wrapEl.clientWidth);
          const h = Math.max(1, wrapEl.clientHeight);
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          renderer.setPixelRatio(dpr);
          renderer.setSize(w, h, false);
          cam.aspect = w / h;
          cam.updateProjectionMatrix();
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(wrapEl);

        // ---- 交互：拖动旋转 / 滚轮缩放 / 悬停 ----
        let yaw = 0;             // 绕 Y 轴
        let pitch = CAMERA_TILT; // 俯仰
        let dist = camDist;
        let dragging = false;
        let lastX = 0; let lastY = 0;
        let idle = 0;            // 用户操作后暂停自转的秒数

        const updateCam = () => {
          const cy = Math.cos(pitch);
          cam.position.set(
            Math.sin(yaw) * cy * dist,
            Math.sin(pitch) * dist,
            Math.cos(yaw) * cy * dist
          );
          cam.lookAt(target);
        };

        const onDown = (e) => {
          dragging = true; idle = 2.5;
          lastX = e.clientX; lastY = e.clientY;
          canvasEl.setPointerCapture?.(e.pointerId);
        };
        const onMove = (e) => {
          if (!dragging) return;
          const dx = e.clientX - lastX;
          const dy = e.clientY - lastY;
          lastX = e.clientX; lastY = e.clientY;
          yaw -= dx * 0.006;
          pitch = Math.max(-1.2, Math.min(1.2, pitch + dy * 0.005));
          idle = 2.5;
        };
        const onUp = () => { dragging = false; };
        const onWheel = (e) => {
          e.preventDefault();
          dist = Math.max(9, Math.min(60, dist + e.deltaY * 0.02));
          idle = 2.5;
        };

        canvasEl.addEventListener('pointerdown', onDown);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        canvasEl.addEventListener('wheel', onWheel, { passive: false });

        // ---- 悬停拾取：把鼠标射线投到屏幕空间里找最近的点 ----
        // 不用 Raycaster 对 Points（three 的 Points 拾取需要设置 threshold，且对上千点慢），
        // 直接遍历投影到屏幕坐标比距离 —— 344 个点每帧算一次完全够快，
        // 而且阈值可以按点的实际大小给，手感更准。
        const v = new THREE.Vector3();
        const pickAt = (clientX, clientY) => {
          const rect = canvasEl.getBoundingClientRect();
          const mx = clientX - rect.left;
          const my = clientY - rect.top;
          // ⚠ 未命中必须返回 -1，不能返回 null：调用处用的是 `i < 0` 判断，
          //   而 null < 0 是 false，会一路走到 geo.points[null] → undefined.label
          //   直接抛异常（实测表现：悬停没提示气泡，控制台报
          //   "Cannot read properties of undefined (reading 'label')"）。
          //
          // ⚠ 还有两个矩阵坑（同日实测踩到，症状是「悬停完全没反应」）：
          //   ① root.matrixWorld 只在 render 时才更新；拾取发生在两次 render 之间时
          //      它还是单位矩阵 → 所有点的投影坐标都错。必须显式 updateMatrixWorld()。
          //   ② cam 同理，投影前也要 updateMatrixWorld()。
          root.updateMatrixWorld();
          cam.updateMatrixWorld();
          let best = -1; let bestD = 18 * 18;   // 18px 命中半径
          for (let i = 0; i < geo.points.length; i++) {
            v.set(geo.positions[i * 3], geo.positions[i * 3 + 1], geo.positions[i * 3 + 2]);
            v.applyMatrix4(root.matrixWorld).project(cam);
            if (v.z < -1 || v.z > 1) continue;
            const sx = (v.x * 0.5 + 0.5) * rect.width;
            const sy = (-v.y * 0.5 + 0.5) * rect.height;
            const d = (sx - mx) ** 2 + (sy - my) ** 2;
            if (d < bestD) { bestD = d; best = i; }
          }
          return best;
        };

        let hoverIdx = -1;
        const onHover = (e) => {
          if (dragging) return;
          const i = pickAt(e.clientX, e.clientY);
          if (i === hoverIdx) return;
          hoverIdx = i;
          if (i < 0) { setHover(null); canvasEl.style.cursor = 'grab'; return; }
          const node = geo.points[i];
          canvasEl.style.cursor = 'pointer';
          setHover({
            label: node.label,
            kind: node.kind,
            x: e.clientX, y: e.clientY
          });
        };
        const onLeave = () => { hoverIdx = -1; setHover(null); };
        canvasEl.addEventListener('pointermove', onHover);
        canvasEl.addEventListener('pointerleave', onLeave);

        const onClick = (e) => {
          const i = pickAt(e.clientX, e.clientY);
          if (i < 0) return;
          const node = geo.points[i];
          if (node) onPick?.(node);
        };
        canvasEl.addEventListener('click', onClick);

        // ---- 渲染循环 ----
        let raf = 0;
        let prev = performance.now();
        let paused = false;
        const onVis = () => { paused = document.hidden; };
        document.addEventListener('visibilitychange', onVis);

        const frame = (now) => {
          raf = requestAnimationFrame(frame);
          const dt = Math.min(0.05, (now - prev) / 1000);
          prev = now;
          if (paused) return;
          if (idle > 0) idle -= dt;
          // 用户没在操作时缓慢自转（用户明确要求「缓慢自转」）
          if (autoRotate && idle <= 0 && !dragging) yaw += ROTATE_SPEED * dt;
          updateCam();
          root.rotation.y = 0;   // 自转交给相机（保持灯光/拾取逻辑简单）
          renderer.render(threeScene, cam);
        };
        raf = requestAnimationFrame(frame);

        stateRef.current = { renderer, threeScene, cam, root, geo };
        setLoading(false);

        cleanup = () => {
          cancelAnimationFrame(raf);
          document.removeEventListener('visibilitychange', onVis);
          ro.disconnect();
          canvasEl.removeEventListener('pointerdown', onDown);
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          canvasEl.removeEventListener('wheel', onWheel);
          canvasEl.removeEventListener('pointermove', onHover);
          canvasEl.removeEventListener('pointerleave', onLeave);
          canvasEl.removeEventListener('click', onClick);
          ptGeo.dispose(); ptMat.dispose();
          lnGeo.dispose(); lnMat.dispose();
          renderer.dispose();
          stateRef.current = null;
        };
      } catch (err) {
        if (alive) { setFailed(err?.message || '3D 渲染初始化失败'); setLoading(false); }
      }
    })();
    return () => { alive = false; try { cleanup?.(); } catch { /* 已销毁 */ } };
  }, [data, mode]);

  return (
    <div class="sm3d-wrap" ref={wrap}>
      <canvas class="sm3d-canvas" ref={canvas} aria-label={label || '3D 星图'} />
      {loading && !failed && (
        <div class="sm3d-state"><span class="spinner" aria-hidden="true" /><p>正在铺开三维星云…</p></div>
      )}
      {failed && (
        <div class="sm3d-state">
          <p>3D 视图暂时不可用（{failed}）</p>
          <p class="sm3d-hint">可以切回 2D 视图继续浏览。</p>
        </div>
      )}
      {hover && (
        <div class="sm3d-tip" style={`left:${hover.x}px;top:${hover.y}px`}>
          {hover.kind === 'hub' ? '◈ ' : ''}{hover.label}
        </div>
      )}
      <div class="sm3d-help">拖动旋转 · 滚轮缩放 · 点击进入</div>
    </div>
  );
}
