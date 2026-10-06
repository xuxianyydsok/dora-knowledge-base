// 统一的页面头：kicker + 大标题 + 副标题 + 右侧操作区
// 用法：<PageHeader kicker="Video Library" title="学习视频" sub="…">{右侧操作}</PageHeader>
// 目的：所有列表/工具页共用同一套标题层级（此前各页各写各的，有的是玻璃面板包标题，
// 有的只有一行 h2，层级与间距都不一致）。
export function PageHeader({ kicker, title, sub, children }) {
  return (
    <header class="page-head">
      <div class="page-head-text">
        {kicker && <span class="page-kicker">{kicker}</span>}
        <h1>{title}</h1>
        {sub && <p class="page-sub muted">{sub}</p>}
      </div>
      {children && <div class="page-head-actions">{children}</div>}
    </header>
  );
}
