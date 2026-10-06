// 全局通用卡片组件：所有资源板块复用同一套卡片
// props: title, description, coverUrl, meta(节点), tags(数组), onClick, footer
import { TagChip } from './TagChip.jsx';

export function Card({ title, description, coverUrl, meta, tags = [], footer, onClick }) {
  return (
    <article class="card" onClick={onClick} role={onClick ? 'button' : undefined}>
      {coverUrl ? (
        <img class="card-cover" src={coverUrl} alt={title} loading="lazy" />
      ) : (
        <div class="card-cover-placeholder" aria-hidden="true">🖼️</div>
      )}
      <div class="card-body">
        <h3 class="card-title">{title}</h3>
        {description && <p class="card-desc">{description}</p>}
        {meta && <div class="card-meta">{meta}</div>}
        {tags.length > 0 && (
          <div class="card-meta">
            {tags.map((t) => (
              <TagChip key={t.id || t.name} name={t.name} color={t.color} />
            ))}
          </div>
        )}
        {footer && <div class="card-meta">{footer}</div>}
      </div>
    </article>
  );
}
