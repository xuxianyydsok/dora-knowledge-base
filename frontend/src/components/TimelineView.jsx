// 时间流视图：按时间倒序展示，左侧时间轴
import { Card } from './Card.jsx';

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function TimelineView({ items = [], renderCard }) {
  if (!items.length) return <div class="center-box">暂无数据</div>;
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
