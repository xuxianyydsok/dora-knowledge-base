// 统一页面头（v2）：kicker + 大标题 + 副标题 + 读数条 + 右侧操作 + 主标签栏
//
// v1 只有「标题 + 右侧按钮」，结果各页在页头下方各写各的切换器
// （.seg / .view-switch / 自造 button 行），间距与视觉层级都对不齐。
// v2 把「栏目切换」与「读数」一并收进来，所有列表页因此共享同一套骨架。
//
// 用法：
//   <PageHeader kicker="Movie Library" title="影视库" sub="…"
//     stats={[{ label: '命中来源', value: 8 }]}
//     tabs={[{ key: 'hot', label: '精选推荐', count: 24 }]}
//     activeTab={mode} onTab={switchMode}>
//     <button class="primary">手动添加</button>
//   </PageHeader>
export function PageHeader({
  kicker, title, sub,
  stats, tabs, activeTab, onTab,
  children, actions, wide
}) {
  const extra = actions || children;
  const hasTabs = Array.isArray(tabs) && tabs.length > 0;

  return (
    <header class={`page-head${hasTabs ? ' has-tabs' : ''}${wide ? ' wide' : ''}`}>
      <div class="page-head-main">
        <div class="page-head-text">
          {kicker && <span class="page-kicker">{kicker}</span>}
          <h1>{title}</h1>
          {sub && <p class="page-sub muted">{sub}</p>}
        </div>

        {Array.isArray(stats) && stats.length > 0 && (
          <div class="stat-strip">
            {stats.map((s) => (
              <div key={s.label} class="stat">
                <b>{s.value}</b>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {extra && <div class="page-head-actions">{extra}</div>}
      </div>

      {hasTabs && (
        <nav class="page-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={activeTab === t.key ? 'true' : 'false'}
              class={`page-tab${activeTab === t.key ? ' on' : ''}`}
              onClick={() => onTab && onTab(t.key)}
            >
              {t.label}
              {t.count != null && <span class="tab-count">{t.count}</span>}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}
