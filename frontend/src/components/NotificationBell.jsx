// 通知中心面板：顶栏铃铛 + 未读徽标 + 下拉面板
import { useEffect, useRef, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { Icon } from './Icon.jsx';
import { BellPulse } from './MotionFx.jsx';

const TYPE_META = {
  link_broken: { label: '链接失效', icon: 'linkBroken' },
  system: { label: '系统', icon: 'settings' },
  feedback: { label: '共创反馈', icon: 'heart' }
};

// 每种通知「点一下去哪儿」：目前只有共创反馈有站内目标页。
// 用 preact-router 的 route() 做客户端跳转（不整页刷新），跳前关掉面板。
const TYPE_TARGET = {
  feedback: '/admin/feedback'
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  const [ring, setRing] = useState(false);
  const boxRef = useRef(null);
  const prevUnread = useRef(0);

  async function refresh() {
    try {
      const [list, count] = await Promise.all([
        api.listNotifications('?limit=20'),
        api.countUnread()
      ]);
      setItems(list);
      setUnread(count.unread);
      // 未读数增加时摇一下铃铛（首次加载不摇，避免一进站就动个不停）。
      if (prevUnread.current && count.unread > prevUnread.current) {
        setRing(true);
        setTimeout(() => setRing(false), 950);
      }
      prevUnread.current = count.unread;
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

  // 点通知条目 → 跳到对应页面（目前仅共创反馈；其它类型不跳）
  function openTarget(n) {
    const target = TYPE_TARGET[n.type];
    if (!target) return;
    setOpen(false);
    route(target);
  }

  return (
    <div ref={boxRef} style="position:relative">
      <button onClick={() => { setOpen((v) => !v); if (!open) refresh(); }} title="通知中心" aria-label="通知中心">
        <BellPulse count={unread > 0 ? unread : 0} shaking={ring}>
          <Icon name="bell" size={18} />
        </BellPulse>
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
              {TYPE_TARGET[n.type] ? (
                <button
                  type="button"
                  class="notif-jump"
                  onClick={() => openTarget(n)}
                  style="font-size:13px;font-weight:600;text-align:left;background:none;border:none;padding:0;color:inherit;cursor:pointer"
                >{n.title}</button>
              ) : (
                <div style="font-size:13px;font-weight:600">{n.title}</div>
              )}
              {n.body && <div class="muted" style="font-size:12px">{n.body}</div>}
              <div class="row" style="gap:6px">
                {TYPE_TARGET[n.type]
                  ? <button type="button" style="font-size:12px;padding:2px 8px" onClick={() => openTarget(n)}>前往处理</button>
                  : (n.link && <a href={n.link} target="_blank" rel="noreferrer" style="font-size:12px">查看</a>)}
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
