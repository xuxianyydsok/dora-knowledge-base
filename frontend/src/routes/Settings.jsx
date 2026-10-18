// 设置与安全中心（/settings）
//
// 定位：分区清楚的「偏好 + 安全 + 数据」中心，但**不做复杂后台**——
// 不新建导航、不加权限体系、不加路由；管理员快捷入口只是链接到已有页面。
//
// 分区：
//   1. 账号   只读展示邮箱/角色/套餐/用户 ID；可改显示名与用户名（PATCH /api/me）。
//   2. 外观   原样保留 ThemeCustomizer。
//   3. 安全   修改密码走 Supabase 官方重置邮件（前端绝不接收/发送明文密码）；退出登录加二次确认。
//   4. 数据   备份入口链接到 /backup；导出备份可直接调 api.exportBackup()。
//   5. 管理员 仅 isAdmin 渲染，链接到用户管理与源状态。
//
// 安全约定：本页**绝不显示** token / JWT / access_token / refresh_token / 数据库地址 / 密钥。
// 访客本页不可达（app.jsx 用 <ProtectedRoute path="/settings"> 保证）。
import { useEffect, useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { supabase } from '../lib/supabase.js';
import { useTheme, MODES, modeLabel } from '../lib/theme.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { ThemeCustomizer } from '../components/ThemeCustomizer.jsx';
import { Icon } from '../components/Icon.jsx';
import { toastError, toastSuccess } from '../lib/toast.jsx';
import '../styles/now-settings.css';

const ROLE_LABEL = { admin: '管理员', user: '普通用户' };

export function Settings() {
  // 注意：theme / toggleTheme 来自 useTheme()，不是 useAuth()——
  // 曾误从 useAuth() 解构，导致按钮文案恒错、点击 toggleTheme() 抛 TypeError 整页崩溃。
  const { theme, toggleTheme } = useTheme();
  // 顶栏按钮文案：显示「点一下会切到哪套主题」（三套循环）
  const nextModeKey = MODES[(MODES.findIndex((m) => m.key === theme) + 1) % MODES.length]?.key || 'light';
  const { profile, isAdmin, signOut } = useAuth();
  const [me, setMe] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  // 账号信息以 GET /api/me 为准（AuthProvider 的 profile 只是角色快照）
  useEffect(() => {
    let alive = true;
    api.getMe()
      .then((res) => {
        if (!alive || !res) return;
        setMe(res);
        setDisplayName(res.display_name || '');
        setUsername(res.username || '');
      })
      .catch((err) => toastError(err.message));
    return () => { alive = false; };
  }, []);

  async function saveAccount(e) {
    e.preventDefault();
    setBusy(true);
    try {
      // username 为空时不提交该字段：后端要求 3..60，空串会平白 422（邮箱注册的账号可能没有用户名）
      const payload = { display_name: displayName || null };
      const trimmedUsername = username.trim();
      if (trimmedUsername) payload.username = trimmedUsername;
      const res = await api.updateMe(payload);
      setMe(res);
      setDisplayName(res?.display_name || '');
      setUsername(res?.username || '');
      toastSuccess('账号信息已保存');
    } catch (err) { toastError(err.message); }
    finally { setBusy(false); }
  }

  async function sendResetEmail() {
    const email = me?.email || profile?.email;
    if (!supabase) { toastError('Supabase 未配置，无法发送重置邮件'); return; }
    if (!email) { toastError('没有可用邮箱'); return; }
    setResetBusy(true);
    try {
      // 走 Supabase 官方流程：前端只触发「发信」，绝不接触明文密码
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/login'
      });
      if (error) throw error;
      toastSuccess('重置链接已发送，请查收邮箱');
    } catch (err) { toastError(err.message || '发送失败'); }
    finally { setResetBusy(false); }
  }

  async function doExport() {
    setExportBusy(true);
    try {
      const data = await api.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `knowledge-base-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toastSuccess('备份已开始下载');
    } catch (err) { toastError(err.message); }
    finally { setExportBusy(false); }
  }

  async function doSignOut() {
    if (!confirm('确定要退出登录吗？')) return;
    try {
      await signOut();
      toastSuccess('已退出登录');
    } catch (err) { toastError(err.message); }
  }

  const email = me?.email || profile?.email || '';
  const role = me?.role || profile?.role;
  const plan = me?.plan || profile?.plan;
  const userId = me?.id || profile?.id;

  return (
    <section class="set-page">
      <PageHeader kicker="Preferences" title="设置与安全" sub="账号、外观、安全与数据。">
        <button type="button" onClick={toggleTheme}>
          切换到{modeLabel(nextModeKey)}
        </button>
      </PageHeader>

      {/* 1. 账号 */}
      <section class="set-card">
        <header class="set-card-head">
          <h2><Icon name="settings" size={17} /> 账号</h2>
          <p class="muted">邮箱与角色由系统管理，不可在此修改。</p>
        </header>

        <dl class="set-readonly">
          <div><dt>邮箱</dt><dd>{email || '—'}</dd></div>
          <div><dt>角色</dt><dd>{ROLE_LABEL[role] || role || '—'}</dd></div>
          <div><dt>套餐</dt><dd>{plan || '—'}</dd></div>
          <div><dt>用户 ID</dt><dd class="set-mono">{userId || '—'}</dd></div>
        </dl>

        <form class="set-form" onSubmit={saveAccount}>
          <label class="set-field">
            <span>显示名</span>
            <input
              value={displayName}
              maxLength={80}
              placeholder="展示用的名字"
              onInput={(e) => setDisplayName(e.currentTarget.value)}
            />
          </label>
          <label class="set-field">
            <span>用户名（3–60，字母数字 _ . -）</span>
            <input
              value={username}
              maxLength={60}
              placeholder="username"
              onInput={(e) => setUsername(e.currentTarget.value)}
            />
          </label>
          <div class="set-actions">
            <button class="primary" type="submit" disabled={busy}>{busy ? '保存中…' : '保存账号信息'}</button>
          </div>
        </form>
      </section>

      {/* 2. 外观 */}
      <section class="set-card">
        <header class="set-card-head">
          <h2><Icon name="palette" size={17} /> 外观</h2>
          <p class="muted">主题配色保存在云端，登录后跨设备同步。</p>
        </header>
        <ThemeCustomizer />
      </section>

      {/* 3. 安全 */}
      <section class="set-card">
        <header class="set-card-head">
          <h2><Icon name="crown" size={17} /> 安全</h2>
        </header>

        <div class="set-row">
          <div class="set-row-text">
            <strong>修改密码</strong>
            <span class="muted">会向你的邮箱发送重置链接，点开后自行设置新密码。</span>
          </div>
          <button type="button" onClick={sendResetEmail} disabled={resetBusy}>
            {resetBusy ? '发送中…' : '发送重置邮件'}
          </button>
        </div>

        <div class="set-row">
          <div class="set-row-text">
            <strong>退出登录</strong>
            <span class="muted">退出后需重新登录才能管理内容。</span>
          </div>
          <button type="button" class="danger" onClick={doSignOut}>退出登录</button>
        </div>

        <div class="set-notice">
          <Icon name="info" size={15} />
          <ul>
            <li>公开访客只能浏览已发布的公开内容。</li>
            <li>上传 / 删除图片、修改博客等需要站长登录。</li>
            <li>密码重置走官方邮件，本站不会接收或保存明文密码。</li>
          </ul>
        </div>
      </section>

      {/* 4. 数据 */}
      <section class="set-card">
        <header class="set-card-head">
          <h2><Icon name="backup" size={17} /> 数据</h2>
          <p class="muted">备份与恢复在专门页面完成，这里只提供快捷入口。</p>
        </header>
        <div class="set-row">
          <div class="set-row-text">
            <strong>备份与恢复</strong>
            <span class="muted">导入 / 导出全部内容（JSON）。</span>
          </div>
          <a class="btn" href="/backup"><Icon name="arrowRight" size={15} /> 前往备份页</a>
        </div>
        <div class="set-row">
          <div class="set-row-text">
            <strong>导出备份</strong>
            <span class="muted">立即下载一份当前数据的 JSON 备份。</span>
          </div>
          <button type="button" onClick={doExport} disabled={exportBusy}>
            {exportBusy ? '导出中…' : '导出备份'}
          </button>
        </div>
      </section>

      {/* 5. 管理员快捷入口 */}
      {isAdmin && (
        <section class="set-card">
          <header class="set-card-head">
            <h2><Icon name="crown" size={17} /> 管理员快捷入口</h2>
            <p class="muted">普通访客看不到这些入口。</p>
          </header>
          <div class="set-links">
            <a class="set-link" href="/admin/users"><Icon name="crown" size={16} /> 用户管理</a>
            <a class="set-link" href="/admin/hero-subtitle"><Icon name="pencil" size={16} /> 首页摘要</a>
            <a class="set-link" href="/sources"><Icon name="wave" size={16} /> 源状态</a>
          </div>
        </section>
      )}
    </section>
  );
}
