// 搜索历史条（音乐 / 影视搜索框下方共用）
//
// 用户要求（2026-10-11）：搜索过的词留成历史；每条右侧一个 × 单独删除；
// 另有一键清空。样式集中在 now-settings.css（.sh-*）。
import { useEffect, useState } from 'preact/hooks';
import { Icon } from './Icon.jsx';
import { readHistory, removeHistory, clearHistory } from '../lib/searchHistory.js';

// scope: 'music' | 'movies'；onPick 点击某个历史词时回调（一般 = 直接再搜一次）
// refreshKey：父组件每次搜索后改这个值，强制这里重读 localStorage
export function SearchHistory({ scope, onPick, refreshKey = 0, hidden = false }) {
  const [items, setItems] = useState([]);

  useEffect(() => { setItems(readHistory(scope)); }, [scope, refreshKey]);

  if (hidden || !items.length) return null;

  return (
    <div class="sh-bar" aria-label="搜索历史">
      <span class="sh-label"><Icon name="clock" size={13} />搜索历史</span>
      <div class="sh-list">
        {items.map((kw) => (
          <span key={kw} class="sh-chip">
            <button type="button" class="sh-word" onClick={() => onPick?.(kw)} title={`再搜「${kw}」`}>{kw}</button>
            <button
              type="button"
              class="sh-x"
              title={`删除「${kw}」`}
              aria-label={`删除搜索记录 ${kw}`}
              onClick={() => setItems(removeHistory(scope, kw))}
            >
              <Icon name="close" size={11} />
            </button>
          </span>
        ))}
      </div>
      <button
        type="button"
        class="sh-clear"
        onClick={() => { if (confirm('清空全部搜索历史？')) setItems(clearHistory(scope)); }}
      >
        一键清空
      </button>
    </div>
  );
}
