// 管理员用户管理面板（仅管理员可见）
// 展示全部用户、账号启用/禁用、角色切换、资源统计
import { useEffect, useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Icon } from '../components/Icon.jsx';
import { PageHeader } from '../components/PageHeader.jsx';

export function AdminUsers() {
  const { user, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const params = roleFilter ? `?role=${roleFilter}` : '';
      setUsers(await api.adminListUsers(params));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (isAdmin) load(); }, [isAdmin, roleFilter]);

  async function toggleDisabled(u) {
    setBusyId(u.id); setError(''); setStatus('');
    try {
      const updated = await api.adminUpdateUser(u.id, { is_disabled: !u.is_disabled });
      setStatus(`已${updated.is_disabled ? '禁用' : '启用'}账号 ${u.email || u.display_name || u.id}。`);
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusyId(null); }
  }

  async function changeRole(u, role) {
    setBusyId(u.id); setError(''); setStatus('');
    try {
      await api.adminUpdateUser(u.id, { role });
      setStatus(`已将 ${u.email || u.id} 角色改为 ${role}。`);
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusyId(null); }
  }

  if (!isAdmin) {
    return <div class="center-box">需要管理员权限。</div>;
  }

  const shown = users.filter((u) => {
    if (!keyword.trim()) return true;
    const k = keyword.trim().toLowerCase();
    return (u.email || '').toLowerCase().includes(k)
      || (u.username || '').toLowerCase().includes(k)
      || (u.display_name || '').toLowerCase().includes(k);
  });

  return (
    <section>
      <PageHeader
        kicker="Admin"
        title="用户管理"
        sub={`共 ${users.length} 个用户，可启用/禁用账号或调整角色。`}
      >
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.currentTarget.value)} style="width:auto">
          <option value="">全部角色</option>
          <option value="user">普通用户</option>
          <option value="admin">管理员</option>
        </select>
        <input
          placeholder="搜索邮箱 / 用户名"
          value={keyword}
          onInput={(e) => setKeyword(e.currentTarget.value)}
          style="max-width:240px"
        />
        <button onClick={load}>刷新</button>
      </PageHeader>

      {error && <p style="color:var(--danger)">{error}</p>}
      {status && <p style="color:var(--primary)">{status}</p>}

      {loading ? <div class="center-box">加载中…</div> : shown.length === 0 ? (
        <div class="center-box">没有匹配的用户。</div>
      ) : (
        <div class="stack">
          {shown.map((u) => {
            const self = u.id === user?.id;
            return (
              <div class="card" key={u.id} style="padding:14px">
                <div class="row" style="gap:10px;flex-wrap:wrap">
                  <strong>{u.display_name || u.username || '(未命名)'}</strong>
                  {u.role === 'admin' && <span class="tag-chip chip-icon"><Icon name="crown" size={12} />管理员</span>}
                  {u.is_disabled && <span class="tag-chip" style="color:var(--danger)">已禁用</span>}
                  {self && <span class="tag-chip">当前账号</span>}
                  <span class="spacer" />
                  <span class="muted" style="font-size:12px">
                    注册于 {new Date(u.created_at).toLocaleDateString('zh-CN')}
                  </span>
                </div>
                <div class="muted" style="font-size:12px;word-break:break-all">
                  {u.email || '(邮箱未知)'} · 资源 {u.stats?.resources ?? 0} · 博客 {u.stats?.posts ?? 0} · 套餐 {u.plan}
                </div>
                <div class="row" style="gap:8px;flex-wrap:wrap">
                  <button
                    onClick={() => toggleDisabled(u)}
                    disabled={busyId === u.id || self}
                    title={self ? '不能禁用自己' : ''}
                  >
                    {u.is_disabled ? '启用账号' : '禁用账号'}
                  </button>
                  <button
                    onClick={() => changeRole(u, u.role === 'admin' ? 'user' : 'admin')}
                    disabled={busyId === u.id || self}
                    title={self ? '不能修改自己的角色' : ''}
                  >
                    {u.role === 'admin' ? '降为普通用户' : '设为管理员'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
