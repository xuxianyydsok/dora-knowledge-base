// 3D 星图的纯布局计算（零依赖，可被 Node 直接 import 做离线单测）。
//
// 为什么单独拆一个文件：这一段是纯数学（把二维星区坐标映射到三维空间），
// 出错时表现为「画面全黑」「点全挤在中心」这类只能靠截图才发现的问题。
// 拆出来之后可以用表驱动断言把关键性质钉死（点数、坐标有限、尺度范围、
// 连线索引合法），不用每次起浏览器。
// 渲染相关的部分（three 场景、着色器、交互）留在 components/StarMap3D.jsx。

// 点大小（世界单位）。与 2D 版保持同一套视觉比例，切换时不会有「突然变大变小」的感觉。
export const LEAF_SIZE = 0.9;
export const HUB_SIZE = 2.6;

// 相机俯仰角（弧度）：约 28 度。纯俯视会像 2D，纯平视看不出星区分布。
export const CAMERA_TILT = 0.49;

// 稳定伪随机：同一个种子每次结果一样，保证刷新页面不会「换一团星云」。
function rnd(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// #rgb / #rrggbb 转 [r,g,b]，各分量 0~1（three 的顶点色要求）。
export function hexToRgb01(hex) {
  const h = String(hex || '#888888').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (!Number.isFinite(n)) return [0.55, 0.6, 0.68];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * 把 StarMap.buildScene 的结果摊成三维坐标。
 *
 * 空间布局思路（怎么把 2D 的星区圆盘变成 3D 的星云）：
 *   2D 里每个星区是一个扇区（角度 angle + 相对半径 r）。
 *   3D 里把角度映射成绕 Y 轴的方位角、半径映射成到中心的水平距离，
 *   再给每个点一个小范围的高度抖动，于是「一个扇区」变成一片有厚度的立体星带，
 *   整体仍是一团围绕中心的星云（与参考图里那种深空星云是同一个观感）。
 *
 * 注意：半径刻意从 0.35 起步而不是 0 —— 中心留空。
 *   星点若铺满中心，星云会糊成一坨发光团，看不出星区边界。
 *
 * @param {object} scene buildScene 的返回值（all / links 等）
 * @param {number} spread 整体尺度（世界单位）
 */
export function layout3D(scene, spread = 10) {
  const all = scene?.all || [];
  const n = all.length;
  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  const sizes = new Float32Array(n);

  all.forEach((node, i) => {
    const angle = Number.isFinite(node.angle) ? node.angle : 0;
    const r01 = Number.isFinite(node.r) ? node.r : 0.8;
    const radius = spread * (0.35 + r01 * 0.65);

    const isHub = node.kind === 'hub';
    // 高度：枢纽在赤道面上（星区的核）；星点按星区序号整体抬升一点，
    // 再叠一点抖动 —— 这样每个板块在纵向也错开，立体感更强，
    // 且同一星区的点仍聚成一片（不是散在球壳上）。
    const si = Number.isFinite(node.si) ? node.si : 0;
    const band = isHub ? 0 : (rnd(i * 3.7 + 1.3) - 0.5) * spread * 0.46;
    const sectorLift = isHub ? 0 : ((si % 5) - 2) * spread * 0.075;

    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = band + sectorLift;
    positions[i * 3 + 2] = Math.sin(angle) * radius;

    const [r, g, b] = hexToRgb01(node.color);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
    sizes[i] = isHub ? HUB_SIZE : LEAF_SIZE;
  });

  // 连线：所有边拼进一个数组，交给单个 LineSegments（一次 draw call）。
  // 颜色压到 0.55 倍：3D 里线条会互相遮挡，全亮度会糊成一片。
  const links = scene?.links || [];
  const linkPositions = new Float32Array(links.length * 6);
  const linkColors = new Float32Array(links.length * 6);
  links.forEach((l, k) => {
    const a = l.ia; const b = l.ib;
    if (!(a >= 0 && a < n) || !(b >= 0 && b < n)) return;
    linkPositions[k * 6] = positions[a * 3];
    linkPositions[k * 6 + 1] = positions[a * 3 + 1];
    linkPositions[k * 6 + 2] = positions[a * 3 + 2];
    linkPositions[k * 6 + 3] = positions[b * 3];
    linkPositions[k * 6 + 4] = positions[b * 3 + 1];
    linkPositions[k * 6 + 5] = positions[b * 3 + 2];
    const [r, g, b2] = hexToRgb01(l.color);
    for (const off of [0, 3]) {
      linkColors[k * 6 + off] = r * 0.55;
      linkColors[k * 6 + 1 + off] = g * 0.55;
      linkColors[k * 6 + 2 + off] = b2 * 0.55;
    }
  });

  return { positions, colors, sizes, linkPositions, linkColors, points: all };
}

/**
 * 校验布局结果的关键性质。返回错误数组（空 = 通过）。
 * 这些断言对应「曾经真的出过问题」的几种情况：
 *   - 数组长度与节点数不匹配，渲染时索引越界
 *   - 坐标出现 NaN / Infinity，整片点消失（WebGL 直接丢弃该顶点）
 *   - 连线索引越界，线画到原点，画面出现奇怪的放射状线条
 */
export function validateLayout(geo, scene) {
  const n = scene?.all?.length || 0;
  const errs = [];
  if (!geo) return ['geo 为空'];
  if (geo.positions.length !== n * 3) errs.push(`position 长度应为 ${n * 3}，实际 ${geo.positions.length}`);
  if (geo.colors.length !== n * 3) errs.push('color 长度与节点数不一致');
  if (geo.sizes.length !== n) errs.push('size 长度与节点数不一致');
  for (let i = 0; i < geo.positions.length; i++) {
    if (!Number.isFinite(geo.positions[i])) { errs.push(`position[${i}] 不是有限数`); break; }
  }
  for (let i = 0; i < geo.colors.length; i++) {
    const c = geo.colors[i];
    if (!Number.isFinite(c) || c < 0 || c > 1) { errs.push(`color[${i}] 应在 0~1，实际 ${c}`); break; }
  }
  const linkCount = scene?.links?.length || 0;
  if (geo.linkPositions.length !== linkCount * 6) {
    errs.push(`linkPositions 长度应为 ${linkCount * 6}，实际 ${geo.linkPositions.length}`);
  }
  for (let i = 0; i < geo.linkPositions.length; i++) {
    if (!Number.isFinite(geo.linkPositions[i])) { errs.push(`linkPositions[${i}] 不是有限数`); break; }
  }
  return errs;
}

/**
 * 计算世界坐标的包围盒与最大水平半径。
 * 用途：验证「星云是否落在相机视野内」—— 相机距离与 spread 不匹配时，
 * 画面要么只剩中心一点、要么整体飞出视野（实测踩过）。
 */
export function bounds3D(geo) {
  const n = geo?.points?.length || 0;
  if (!n) return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0, maxRadiusXZ: 0 };
  let minX = Infinity; let maxX = -Infinity;
  let minY = Infinity; let maxY = -Infinity;
  let minZ = Infinity; let maxZ = -Infinity;
  let maxRadiusXZ = 0;
  for (let i = 0; i < n; i++) {
    const x = geo.positions[i * 3];
    const y = geo.positions[i * 3 + 1];
    const z = geo.positions[i * 3 + 2];
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    maxRadiusXZ = Math.max(maxRadiusXZ, Math.hypot(x, z));
  }
  return { minX, maxX, minY, maxY, minZ, maxZ, maxRadiusXZ };
}
