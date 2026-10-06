// 时间流视图：按时间倒序展示，左侧时间轴
import { Card } from './Card.jsx';
import { EmptyState } from './EmptyState.jsx';

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function TimelineView({ items = [], renderCard, empty }) {
  if (!items.length) {
    return empty || <EmptyState title="还没有内容" hint="用页面上方的输入框添加第一条，或先看看其它模块。" />;
  }
  return (
    <div class="timeline">
      {items.map((item, idx) => (
        <div class="timeline-item" key={item.id || idx}>
          <div class="timeline-date">{formatDate(item.created_at)}</div>
          {renderCard ? (
            renderCard(item, idx)
          ) : (
            <Card title={item.title} description={item.description} tags={item.tags || []} />
          )}
        </div>
      ))}
    </div>
  );
}
