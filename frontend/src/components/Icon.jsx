// 现代线性图标集（stroke 风格，24x24 网格，颜色继承 currentColor）
// 用法：<Icon name="blog" size={20} />
// 全部为内联 SVG，无外部请求；重型图标库不参与打包。

const PATHS = {
  // —— 资源模块 ——
  blog: (
    <>
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H14l6 6v10.5A1.5 1.5 0 0 1 18.5 21h-13A1.5 1.5 0 0 1 4 19.5Z" />
      <path d="M14 3v6h6" />
      <path d="M8.5 13h7M8.5 17h4.5" />
    </>
  ),
  video: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="3" />
      <path d="M10.5 9.6v4.8l4.2-2.4z" />
    </>
  ),
  github: (
    <>
      <path d="M9 19.5c-4 1.2-4-2.1-5.5-2.6m11 5.1v-3.4a3 3 0 0 0-.9-2.4c2.8-.3 5.4-1.4 5.4-6a4.7 4.7 0 0 0-1.3-3.3 4.4 4.4 0 0 0-.1-3.3s-1.4-.4-4.5 1.7a11 11 0 0 0-5.6 0C4.4 3.2 3 3.6 3 3.6a4.4 4.4 0 0 0-.1 3.3A4.7 4.7 0 0 0 1.6 10c0 4.6 2.6 5.7 5.4 6a3 3 0 0 0-.9 2.3v3.4" />
    </>
  ),
  movie: (
    <>
      <rect x="2.5" y="4" width="19" height="16" rx="3" />
      <path d="M7.5 4v16M16.5 4v16M2.5 9.5h5M2.5 14.5h5M16.5 9.5h5M16.5 14.5h5" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V6.6l10-2v11" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="15.6" r="2.5" />
    </>
  ),
  rss: (
    <>
      <path d="M4.5 11a8.5 8.5 0 0 1 8.5 8.5" />
      <path d="M4.5 5.5A14 14 0 0 1 18.5 19.5" />
      <circle cx="5.6" cy="18.4" r="1.6" />
    </>
  ),

  // —— 平台能力 ——
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m15.8 15.8 4.2 4.2" />
    </>
  ),
  graph: (
    <>
      <circle cx="6" cy="6.5" r="2.6" />
      <circle cx="18" cy="9" r="2.6" />
      <circle cx="11" cy="18" r="2.6" />
      <path d="M8.3 7.7 15.6 8.5M7.4 8.9l2.6 6.5M16.6 11.3 12.8 15.8" />
    </>
  ),
  star: (
    <>
      <path d="M12 3.6l2.6 5.5 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.9l5.9-.8z" />
    </>
  ),
  bell: (
    <>
      <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5s1.5-1.5 1.5-5.5Z" />
      <path d="M10.2 18.5a2 2 0 0 0 3.6 0" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.6-1.4-1.8-1.4-3 0-.9.7-1.6 1.7-1.6h1.4a4.9 4.9 0 0 0 4.9-4.9c0-3.4-3.6-5.8-8.4-5.8Z" />
      <circle cx="8" cy="10" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="7.6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.9" cy="10" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  backup: (
    <>
      <ellipse cx="12" cy="6.2" rx="7.5" ry="2.9" />
      <path d="M4.5 6.2v11.6c0 1.6 3.4 2.9 7.5 2.9s7.5-1.3 7.5-2.9V6.2" />
      <path d="M4.5 12c0 1.6 3.4 2.9 7.5 2.9s7.5-1.3 7.5-2.9" />
    </>
  ),

  // —— 通用 UI ——
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
    </>
  ),
  moon: (
    <>
      <path d="M20.5 14.3A8.6 8.6 0 0 1 9.7 3.5a8.6 8.6 0 1 0 10.8 10.8Z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.4 14.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3H9.3a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  crown: (
    <>
      <path d="M3 7.5l3.4 3.2L12 4l5.6 6.7L21 7.5l-1.7 10.2a1.4 1.4 0 0 1-1.4 1.2H6.1a1.4 1.4 0 0 1-1.4-1.2Z" />
    </>
  ),
  logout: (
    <>
      <path d="M15 4.5h3.5A1.5 1.5 0 0 1 20 6v12a1.5 1.5 0 0 1-1.5 1.5H15" />
      <path d="M11 8l-4 4 4 4M7 12h9" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M4.5 12h15M13.5 6l6 6-6 6" />
    </>
  ),
  linkBroken: (
    <>
      <path d="M9.5 14.5 6.8 17.2a3.6 3.6 0 0 1-5.1-5.1l2.7-2.7" />
      <path d="M14.5 9.5l2.7-2.7a3.6 3.6 0 0 1 5.1 5.1l-2.7 2.7" />
      <path d="M3.5 3.5l17 17" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3.5l1.7 4.6 4.6 1.7-4.6 1.7L12 16.1l-1.7-4.6L5.7 9.8l4.6-1.7z" />
      <path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3.5 3.5 8 12 12.5 20.5 8Z" />
      <path d="m3.5 12.8 8.5 4.5 8.5-4.5M3.5 16.9l8.5 4.5 8.5-4.5" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  play: (
    <>
      <path d="M7.5 4.8v14.4L20 12z" />
    </>
  ),
  dot: (
    <>
      <circle cx="12" cy="12" r="4.6" fill="currentColor" stroke="none" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5a13 13 0 0 1 0 17 13 13 0 0 1 0-17Z" />
    </>
  ),
  arrowLeft: (
    <>
      <path d="M19.5 12h-15M10.5 6l-6 6 6 6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.2V12l3.4 2.1" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 11.4V5.5A2 2 0 0 1 5.5 3.5h5.9a2 2 0 0 1 1.4.6l7.1 7.1a2 2 0 0 1 0 2.8l-5.9 5.9a2 2 0 0 1-2.8 0L4.1 12.8a2 2 0 0 1-.6-1.4Z" />
      <circle cx="8.2" cy="8.2" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  external: (
    <>
      <path d="M14 4.5h5.5V10" />
      <path d="M19.5 4.5 12 12" />
      <path d="M18 14.5v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6h4" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12M18 6L6 18" />
    </>
  )
};

export function Icon({ name, size = 20, class: className, strokeWidth = 1.7, ...rest }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      class={`icon${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={strokeWidth}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {path}
    </svg>
  );
}

export const ICON_NAMES = Object.keys(PATHS);
