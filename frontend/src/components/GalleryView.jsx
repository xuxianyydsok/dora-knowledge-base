// 画廊网格视图：渲染卡片网格
import { Card } from './Card.jsx';

export function GalleryView({ items = [], renderCard }) {
  if (!items.length) return <div class="center-box">暂无数据</div>;
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
