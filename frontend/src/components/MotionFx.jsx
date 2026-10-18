// 动效组件（2026-10-15）
//
// 来源：E:\documents\网站开发\ 下十份动效图鉴里用户挑中的组件，逐个改写成
// Preact 组件（图鉴是自包含 HTML，内联 <style>/<script> 会被本站 CSP
// `script-src 'self'` 拦掉，所以必须改写而不是粘贴）。
//
// 本文件是**第一批「全局小点缀」**（图鉴编号 → 组件）：
//   30 填充箭头按钮   → ArrowButton
//   31 弹性开关       → Switch
//   37 三款加载器     → Loader（variant: dots | ring | bars）
//   39 条纹流动进度条 → ProgressBar
//   41 弹出气泡提示   → Tip
//   43 搜索框展开     → ExpandingSearch
//   15 慢速大字跑马灯 → Marquee
//   62 轮播指示点     → DotsNav
//
// 样式在 styles/motion.css，全部走站点主题变量（三套主题自动适配）。
import { useEffect, useRef, useState } from 'preact/hooks';

// 30 填充 + 箭头穿梭按钮：悬停时底色自下而上填满，箭头「穿出去再进来」。
export function ArrowButton({ children, onClick, type = 'button', ...rest }) {
  return (
    <button type={type} class="mfx-arrow-btn" onClick={onClick} {...rest}>
      <span>{children}</span>
      <i class="mfx-arrow-btn-icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M2 8h12M9 3l5 5-5 5" />
        </svg>
      </i>
    </button>
  );
}

// 31 弹性开关：按住时滑块拉长（纯 CSS 实现，这里只负责受控状态）。
// 用 <label> + 隐藏 checkbox，键盘也能操作（保留原生语义，不用 div 冒充）。
export function Switch({ checked, onChange, label, ...rest }) {
  return (
    <label class="mfx-switch" title={label} aria-label={label}>
      <input type="checkbox" checked={!!checked} onChange={onChange} {...rest} />
      <s />
    </label>
  );
}

// 37 三款加载器。variant 决定形态：
//   dots 三点跳动（适合「正在加载列表」）
//   ring 圆环旋转（适合「正在请求」）
//   bars 柱状起伏（适合「正在播放 / 处理中」）
export function Loader({ variant = 'dots' }) {
  if (variant === 'ring') return <span class="mfx-ring" role="status" aria-label="加载中" />;
  if (variant === 'bars') {
    return <span class="mfx-bars" role="status" aria-label="加载中"><i /><i /><i /><i /></span>;
  }
  return <span class="mfx-dots" role="status" aria-label="加载中"><i /><i /><i /></span>;
}

// 39 条纹流动进度条。value 是 0~100；不传则展示「不确定进度」（自动来回）。
export function ProgressBar({ value, label }) {
  const v = typeof value === 'number' ? Math.max(0, Math.min(100, value)) : null;
  return (
    <div class="mfx-progress">
      <div
        class="mfx-progress-track"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        {...(v === null ? {} : { 'aria-valuenow': Math.round(v) })}
        aria-label={label || '进度'}
      >
        <div class="mfx-progress-bar" style={{ width: `${v === null ? 100 : v}%` }} />
      </div>
      {label && (
        <p>
          <span>{label}</span>
          <span>{v === null ? '' : `${Math.round(v)}%`}</span>
        </p>
      )}
    </div>
  );
}

// 41 弹出气泡提示：悬停（或键盘聚焦）时从上方弹出一个带箭头的气泡。
// 用 CSS ::after + attr(data-tip) 实现，不占 DOM 节点，也不需要 JS。
// 触屏设备没有 hover —— 那里退化成普通文字（加 tabindex 让键盘可达）。
export function Tip({ text, children }) {
  return <span class="mfx-tip" data-tip={text} tabindex={0}>{children}</span>;
}

// 43 搜索框展开：收起时是个圆形按钮，悬停 / 聚焦后展开成输入框。
// onSearch 在回车时调用（值非空才触发）。
export function ExpandingSearch({ placeholder = '搜索…', onSearch, value: initial = '' }) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef(null);

  const submit = () => {
    const q = value.trim();
    if (q && onSearch) onSearch(q);
  };

  return (
    <div
      class="mfx-search"
      onClick={() => inputRef.current && inputRef.current.focus()}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onInput={(e) => setValue(e.currentTarget.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
      />
    </div>
  );
}

// 15 慢速大字跑马灯（页脚 / 分隔用）。
// 内容重复两遍是**必需的**：动画从 0 位移到 -50%，正好走完一遍，
// 视觉上无缝衔接；只放一遍会在末尾露出空白。
export function Marquee({ text, duration = 60, font, color }) {
  const style = { '--mfx-t': `${duration}s` };
  if (font) style.font = font;
  if (color) style.color = color;
  return (
    <div class="mfx-marquee" style={style} aria-hidden="true">
      <div>
        <span>{text}</span>
        <span>{text}</span>
      </div>
    </div>
  );
}

// 62 轮播指示点（当前点拉长 + 倒计时进度）。
// count 是点的个数，index 是当前项，interval 是每张停留毫秒数
// （与进度条动画时长一致，切换时靠 key 变化重启动画）。
export function DotsNav({ count, index, interval = 3000, onSelect }) {
  return (
    <div class="mfx-dots-nav" role="tablist" aria-label="切换">
      {Array.from({ length: count }, (_, i) => (
        <i
          key={i}
          role="tab"
          aria-selected={i === index ? 'true' : 'false'}
          class={i === index ? 'on' : ''}
          style={{ '--mfx-t': `${interval}ms` }}
          onClick={() => onSelect && onSelect(i)}
        />
      ))}
    </div>
  );
}
