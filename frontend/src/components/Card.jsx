// 全局通用卡片组件：所有资源板块复用同一套卡片
// props: title, description, coverUrl, meta(节点), tags(数组), onClick, footer
// 液态玻璃质感 + 悬停 3D 倾斜（由 lib/tilt.js 驱动，触摸/降级环境自动跳过）
import { useEffect, useRef } from 'preact/hooks';
import { TagChip } from './TagChip.jsx';
import { Icon } from './Icon.jsx';
import { attachTilt } from '../lib/tilt.js';

export function Card({ title, description, coverUrl, meta, tags = [], footer, onClick }) {
  const ref = useRef(null);

  useEffect(() => attachTilt(ref.current), []);

  return (
    <article ref={ref} class="card" onClick={onClick} role={onClick ? 'button' : undefined}>
      {coverUrl ? (
        <img class="card-cover" src={coverUrl} alt={title} loading="lazy" />
      ) : (
        <div class="card-cover-placeholder" aria-hidden="true"><Icon name="layers" size={30} /></div>
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
