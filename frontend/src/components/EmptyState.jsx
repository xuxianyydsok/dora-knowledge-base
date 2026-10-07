// 统一空状态：图标 + 标题 + 提示 + 可选操作
// 列表页在数据为空时用它，替代此前各页零散的「暂无数据」纯文本。
// tone：留空为中性；'danger' 用于错误态（见 StateView.ErrorState）。
import { Icon } from './Icon.jsx';

export function EmptyState({ icon = 'layers', title, hint, action, tone = '' }) {
  return (
    <div class={`empty-state${tone ? ` tone-${tone}` : ''}`}>
      <Icon name={icon} size={24} />
      <p>{title}</p>
      {hint && <span>{hint}</span>}
      {action}
    </div>
  );
}
