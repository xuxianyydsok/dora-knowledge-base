// 视图切换：画廊网格 / 时间流
import { useViewMode } from '../lib/viewMode.jsx';

export function ViewSwitch() {
  const { viewMode, setViewMode } = useViewMode();
  return (
    <div class="view-switch" role="group" aria-label="视图切换">
      <button class={viewMode === 'gallery' ? 'active' : ''} onClick={() => setViewMode('gallery')}>
        画廊
      </button>
      <button class={viewMode === 'timeline' ? 'active' : ''} onClick={() => setViewMode('timeline')}>
        时间流
      </button>
    </div>
  );
}
