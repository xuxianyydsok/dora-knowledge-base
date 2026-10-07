// 轻提示容器：挂在应用根部，订阅 lib/toast.jsx 的队列
import { useEffect, useState } from 'preact/hooks';
import { Icon } from './Icon.jsx';
import { subscribeToasts, dismissToast } from '../lib/toast.jsx';

const ICON = { info: 'info', success: 'check', warn: 'alert', danger: 'alert' };

export function Toaster() {
  const [list, setList] = useState([]);

  useEffect(() => subscribeToasts(setList), []);

  if (!list.length) return null;

  return (
    <div class="toaster" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} class={`toast tone-${t.tone}`}>
          <span class="toast-icon"><Icon name={ICON[t.tone] || 'info'} size={16} /></span>
          <span class="toast-text">{t.message}</span>
          {t.action}
          <button
            type="button"
            class="toast-close"
            aria-label="关闭提示"
            onClick={() => dismissToast(t.id)}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
