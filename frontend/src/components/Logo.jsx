// 品牌 SVG 图标：液态玻璃质感的「知识晶体」
// 用于顶栏 brand、登录页与落地页；渐变 id 加后缀避免同页多实例冲突
// 通过 CSS 类（.brand-mark 等）触发旋转、发光与内部流光动效
let uid = 0;

export function Logo({ size = 30, id }) {
  const n = id || `kb-logo-${++uid}`;
  return (
    <svg
      class="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="Dora"
    >
      <defs>
        <linearGradient id={`${n}-g1`} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#8fb4ff" />
          <stop offset="0.5" stop-color="#4a6cf7" />
          <stop offset="1" stop-color="#7c4dff" />
        </linearGradient>
        {/* 流光渐变：悬停时沿对角扫过 */}
        <linearGradient id={`${n}-sheen`} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0" />
          <stop offset="0.42" stop-color="#ffffff" stop-opacity="0" />
          <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.85" />
          <stop offset="0.58" stop-color="#ffffff" stop-opacity="0" />
          <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
          <animate attributeName="x1" values="-40;64" dur="2.6s" repeatCount="indefinite" />
          <animate attributeName="x2" values="24;128" dur="2.6s" repeatCount="indefinite" />
        </linearGradient>
        <clipPath id={`${n}-clip`}>
          <path d="M32 3.6 57.2 17.8v28.4L32 60.4 6.8 46.2V17.8L32 3.6Z" />
        </clipPath>
        <linearGradient id={`${n}-g2`} x1="14" y1="10" x2="50" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.9" />
          <stop offset="0.55" stop-color="#ffffff" stop-opacity="0.18" />
          <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>
        <filter id={`${n}-blur`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
      </defs>

      {/* 悬停脉冲光环 */}
      <path
        class="brand-halo"
        d="M32 3.6 57.2 17.8v28.4L32 60.4 6.8 46.2V17.8L32 3.6Z"
        fill="none"
        stroke={`url(#${n}-g1)`}
        stroke-width="2"
      />

      {/* 外层玻璃立方体 */}
      <path
        d="M32 3.6 57.2 17.8v28.4L32 60.4 6.8 46.2V17.8L32 3.6Z"
        fill={`url(#${n}-g1)`}
        stroke={`url(#${n}-g2)`}
        stroke-width="1.4"
      />

      {/* 内部流光（裁剪在立方体内） */}
      <rect
        class="brand-sheen"
        x="0" y="0" width="64" height="64"
        fill={`url(#${n}-sheen)`}
        clip-path={`url(#${n}-clip)`}
        style="mix-blend-mode: screen"
      />

      {/* 内部高光面：制造玻璃厚度 */}
      <path
        d="M32 3.6 57.2 17.8 32 32 6.8 17.8 32 3.6Z"
        fill="#ffffff"
        fill-opacity="0.22"
      />
      <path
        d="M32 32v28.4L6.8 46.2V17.8L32 32Z"
        fill="#000000"
        fill-opacity="0.10"
      />

      {/* 中心书页/知识符号 */}
      <path
        d="M22.5 25.4h19v2.6h-19zM22.5 31.6h19v2.6h-19zM22.5 37.8h12.6v2.6H22.5z"
        fill="#ffffff"
        fill-opacity="0.92"
        rx="1"
      />

      {/* 棱边描线 */}
      <path
        d="M32 3.6v28.4m0 0 25.2-14.2M32 32 6.8 17.8"
        stroke="#ffffff"
        stroke-opacity="0.34"
        stroke-width="1.1"
        stroke-linecap="round"
      />

      {/* 柔和光晕 */}
      <ellipse cx="32" cy="56" rx="18" ry="4.4" fill={`url(#${n}-g1)`} filter={`url(#${n}-blur)`} opacity="0.5" />
    </svg>
  );
}
