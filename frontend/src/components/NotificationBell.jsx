// 通知中心面板：顶栏铃铛 + 未读徽标 + 下拉面板
import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { Icon } from './Icon.jsx';

const TYPE_META = {
  rss_new: { label: 'RSS', icon: 'rss' },
  link_broken: { label: '链接失效', icon: 'linkBroken' },
  system: { label: '系统', icon: 'settings' }
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  const boxRef = useRef(null);

  async function refresh() {
    try {
      const [list, count] = await Promise.all([
        api.listNotifications('?limit=20'),
        api.countUnread()
      ]);
      setItems(list);
      setUnread(count.unread);
    } catch (e) { setError(e.message); }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 60000);   // 每分钟轮询未读数
    return () => clearInterval(timer);
  }, []);

  // 点击外部关闭
  useEffect(() => {
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function toggleRead(n) {
    try {
      await api.markNotification(n.id, !n.is_read);
      await refresh();
    } catch (e) { setError(e.message); }
  }

  async function markAll() {
    try { await api.markAllNotificationsRead(); await refresh(); }
    catch (e) { setError(e.message); }
  }

  async function remove(n) {
    try { await api.deleteNotification(n.id); await refresh(); }
    catch (e) { setError(e.message); }
  }

  async function checkLinks() {
    try { await api.checkLinks(10); await refresh(); }
    catch (e) { setError(e.message); }
  }

  return (
    <div ref={boxRef} style="position:relative">
      <button onClick={() => { setOpen((v) => !v); if (!open) refresh(); }} title="通知中心" aria-label="通知中心">
        <Icon name="bell" size={18} />
        {unread > 0 && <span class="badge-dot">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div class="card" style="position:absolute;right:0;top:110%;width:340px;max-height:420px;overflow:auto;z-index:50;padding:10px">
          <div class="row" style="margin-bottom:8px">
            <strong>通知</strong>
            <span class="spacer" />
            <button onClick={markAll} disabled={!unread}>全部已读</button>
            <button onClick={checkLinks} title="检测视频播放链接">检测链接</button>
          </div>
          {error && <div class="muted" style="color:var(--danger);font-size:12px">{error}</div>}
          {items.length === 0 && <div class="muted" style="font-size:13px;padding:8px">暂无通知</div>}
          {items.map((n) => (
            <div
              key={n.id}
              class="stack"
              style={`gap:4px;padding:8px;border-bottom:1px solid var(--border);opacity:${n.is_read ? 0.55 : 1}`}
            >
              <div class="row" style="gap:6px">
                <span class="tag-chip" style="font-size:11px;display:inline-flex;align-items:center;gap:4px">
                  <Icon name={(TYPE_META[n.type] || {}).icon || 'bell'} size={12} />
                  {(TYPE_META[n.type] || {}).label || n.type}
                </span>
                <span class="spacer" />
                <span class="muted" style="font-size:11px">{new Date(n.created_at).toLocaleString('zh-CN')}</span>
              </div>
              <div style="font-size:13px;font-weight:600">{n.title}</div>
              {n.body && <div class="muted" style="font-size:12px">{n.body}</div>}
              <div class="row" style="gap:6px">
                {n.link && <a href={n.link} target="_blank" rel="noreferrer" style="font-size:12px">查看</a>}
                <span class="spacer" />
                <button style="font-size:12px;padding:2px 8px" onClick={() => toggleRead(n)}>
                  {n.is_read ? '标为未读' : '标为已读'}
                </button>
                <button style="font-size:12px;padding:2px 8px" onClick={() => remove(n)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
