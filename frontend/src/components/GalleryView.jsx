// 画廊网格视图：渲染卡片网格
import { Card } from './Card.jsx';
import { EmptyState } from './EmptyState.jsx';

export function GalleryView({ items = [], renderCard, empty }) {
  if (!items.length) {
    return empty || <EmptyState title="还没有内容" hint="用页面上方的输入框添加第一条，或先看看其它模块。" />;
  }
  return (
    <div class="gallery-grid">
      {items.map((item, idx) =>
        renderCard ? (
          renderCard(item, idx)
        ) : (
          <Card key={item.id} title={item.title} description={item.description} tags={item.tags || []} />
        )
      )}
    </div>
  );
}
