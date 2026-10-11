// 收藏按钮（音乐 / 影视详情页共用）
//
// 用户定位（2026-10-11 明确）：收藏 = 读者把喜欢的**音乐 / 影视**存起来，方便以后回看。
// 所以收藏页以音乐 + 影视为主要对象，按钮就放在这两个详情页的操作区。
//
// 逻辑：挂载时拉一次本人收藏列表判断当前状态；点击即「加 / 删」。
// 未登录时不渲染（收藏属个人数据，后端 /api/favorites 对访客 403）。
import { useEffect, useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Icon } from './Icon.jsx';
import { toastError, toastSuccess } from '../lib/toast.jsx';

export function FavoriteButton({ resourceId, label = '收藏' }) {
  const { isAuthenticated } = useAuth();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !resourceId) return;
    let alive = true;
    api.listFavorites()
      .then((list) => {
        if (!alive) return;
        setOn((list || []).some((f) => f.resource_id === resourceId));
      })
      .catch(() => { /* 拉不到就按未收藏处理，点击时仍会尝试 */ })
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [isAuthenticated, resourceId]);

  if (!isAuthenticated || !resourceId) return null;

  async function toggle() {
    setBusy(true);
    try {
      if (on) {
        await api.deleteFavoriteByTarget(`resource_id=${encodeURIComponent(resourceId)}`);
        setOn(false);
        toastSuccess('已取消收藏');
      } else {
        await api.createFavorite({ resource_id: resourceId });
        setOn(true);
        toastSuccess('已加入收藏');
      }
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      class={`fav-btn${on ? ' on' : ''}`}
      onClick={toggle}
      disabled={busy || !ready}
      aria-pressed={on}
      title={on ? '取消收藏' : label}
    >
      <Icon name="heart" size={15} />
      {on ? '已收藏' : label}
    </button>
  );
}
