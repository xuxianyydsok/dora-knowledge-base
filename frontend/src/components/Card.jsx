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

  // 可点击卡片要能用键盘操作（Enter / Space），否则键盘用户无法打开
  function handleKeyDown(event) {
    if (!onClick || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onClick(event);
  }

  return (
    <article
      ref={ref}
      class="card"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
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
