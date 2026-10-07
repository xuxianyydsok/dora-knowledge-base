// 统一状态层：加载 / 空 / 错误 / 加载更多
//
// 为什么单独抽出来：此前加载态是纯文本「加载中…」、空态是各页自己拼的 div、
// 错误是一行内联红字 —— 三态样式互不相同，是整站显得粗糙的主要来源之一。
// 这里给出**与最终内容同形**的骨架屏（poster / album / card / row），
// 加载完成时版面不会「跳一下」；空态与错误态则共用同一套卡片骨架视觉。
import { Icon } from './Icon.jsx';

// 状态三件套对外只暴露一个入口：加载 / 空 / 错误都从 StateView 取，
// 免得各页记不清该从哪个文件 import。
export { EmptyState } from './EmptyState.jsx';

const SHAPES = {
  poster: { grid: 'poster', item: 'sk-poster', count: 12 },
  album: { grid: 'album', item: 'sk-square', count: 12, lines: ['sk-w70', 'sk-w40'] },
  card: { grid: 'card', item: 'sk-cover', count: 8, lines: ['sk-w90', 'sk-w70', 'sk-w35'] },
  list: { grid: 'list', item: 'sk-row', count: 8 },
  text: { grid: 'text', item: 'sk-line lg', count: 6, lines: [] }
};

/**
 * 骨架屏。shape 决定骨架形状：
 *   poster → 2:3 竖版海报（影视网格）
 *   album  → 1:1 方形 + 两行文字（音乐专辑）
 *   card   → 16:9 封面 + 三行文字（通用资源卡）
 *   list   → 62px 行（搜索结果 / 文章列表）
 */
export function LoadingState({ shape = 'card', count, label = '正在加载' }) {
  const s = SHAPES[shape] || SHAPES.card;
  const n = count ?? s.count;
  return (
    <div class={`sk-grid ${s.grid}`} role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} class="sk-item">
          <div class={`sk ${s.item}`} />
          {s.lines && s.lines.length > 0 && (
            <div class="sk-stack">
              {s.lines.map((w, j) => <div key={j} class={`sk-line ${w}`} />)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** 错误态：可选的重试按钮。用于接口失败，与「空结果」区分开。 */
export function ErrorState({ title = '没能取到数据', message, onRetry, retryLabel = '重试' }) {
  return (
    <div class="empty-state tone-danger">
      <Icon name="alert" size={24} />
      <p>{title}</p>
      {message && <span>{message}</span>}
      {onRetry && (
        <button type="button" class="empty-action" onClick={onRetry}>
          <Icon name="refresh" size={14} /> {retryLabel}
        </button>
      )}
    </div>
  );
}

/** 行内的滚动加载提示 */
export function LoadingMore({ label = '正在加载更多…' }) {
  return (
    <div class="loading-more" role="status">
      <span class="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}
