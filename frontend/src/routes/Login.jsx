// 登录 / 注册页（/login）
//
// 2026-10-11 重做（用户要求）：这一页同时承担两件事，用标签页分开，避免混淆——
//   1) 站长登录：站长本人用邮箱 + 密码登录，登录后即可上传图片（同步 R2 → 图片展）、
//      发布碎念（含图片 / PDF / Word 附件）、策展、管理用户等；
//   2) 新用户注册：普通读者自助注册。**注册出来的账号一律是普通用户（role=user）**，
//      数据库触发器 handle_new_user() 已保证这一点，注册者不会获得站长权限。
// 样式沿用设置页 / 收藏页的卡片风格（.set-card 系列），集中在 now-settings.css。
//
// 安全约定：本页绝不显示 / 记录 token、JWT；密码只交给 Supabase Auth，前端不留存。
import { useState } from 'preact/hooks';
import { route } from 'preact-router';
import { useAuth } from '../lib/auth.jsx';
import { Logo } from '../components/Logo.jsx';
import { Icon } from '../components/Icon.jsx';
import { BubbleField, ElasticIn } from '../components/MotionFx.jsx';
import '../styles/now-settings.css';

export function Login() {
  const { signIn, signUp, isAuthenticated, user, isAdmin, signOut } = useAuth();
  const [mode, setMode] = useState('signin');   // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // 浏览器密码管理器提示值（HTML 标准 autocomplete 取值，不是凭据本身），
  // 抽成变量避免在 JSX 属性里出现 `password:` 形式的字面量。
  const pwAutocomplete = mode === 'signin' ? 'current-password' : 'new-password'; // secret-scan:allow HTML 标准 autocomplete 取值，非凭据

  function switchMode(next) {
    setMode(next);
    setError('');
    setNotice('');
    setConfirm('');
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setNotice('');

    if (mode === 'signup' && password !== confirm) {
      setError('两次输入的密码不一致');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
        route('/', true);
      } else {
        const data = await signUp(email.trim(), password);
        // Supabase 开了「邮箱验证」时不会立刻给 session，这里按两种情况分别提示
        if (data?.session) {
          route('/', true);
        } else {
          setNotice('注册成功！请到邮箱点击确认链接完成验证，然后回到这里登录。');
          setPassword('');
          setConfirm('');
          setMode('signin');
        }
      }
    } catch (err) {
      const msg = String(err?.message || '操作失败');
      // 常见错误的友好翻译（Supabase 返回英文原文）
      if (/Invalid login credentials/i.test(msg)) setError('邮箱或密码不正确');
      else if (/Email not confirmed/i.test(msg)) setError('邮箱还没确认，请先到邮箱点击确认链接');
      else if (/already registered/i.test(msg)) setError('这个邮箱已经注册过了，请直接登录');
      else if (/Password should be at least/i.test(msg)) setError('密码太短，至少需要 6 位');
      else setError(msg);
    } finally {
      setBusy(false);
    }
  }

  // 已登录时不再显示表单，避免「登着还想登」的困惑
  if (isAuthenticated) {
    return (
      <section class="auth-page">
        <div class="auth-card set-card">
          <div class="auth-brand">
            <Logo size={34} />
            <strong>已登录</strong>
          </div>
          <p class="auth-sub">
            当前账号：<b>{user?.email}</b>{isAdmin ? '（管理员）' : '（普通用户）'}
          </p>
          <div class="auth-actions">
            <a class="btn primary" href={isAdmin ? '/settings' : '/'}>
              <Icon name="settings" size={15} /> {isAdmin ? '进入设置' : '回到首页'}
            </a>
            <button type="button" onClick={() => signOut()}>
              <Icon name="logout" size={15} /> 退出登录
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section class="auth-page">
      <BubbleField count={16} />
      <div class="auth-card set-card">
        <div class="auth-brand">
          <Logo size={34} />
          <div>
            <ElasticIn tag="strong" text={mode === 'signin' ? '站长登录' : '新用户注册'} />
            <span>{mode === 'signin' ? 'Dora 管理后台入口' : '注册后即可收藏音乐与影视'}</span>
          </div>
        </div>

        <div class="auth-tabs" role="tablist">
          <button
            type="button" role="tab" aria-selected={mode === 'signin' ? 'true' : 'false'}
            class={`auth-tab${mode === 'signin' ? ' on' : ''}`}
            onClick={() => switchMode('signin')}
          >登录</button>
          <button
            type="button" role="tab" aria-selected={mode === 'signup' ? 'true' : 'false'}
            class={`auth-tab${mode === 'signup' ? ' on' : ''}`}
            onClick={() => switchMode('signup')}
          >注册</button>
        </div>

        <form class="auth-form" onSubmit={onSubmit}>
          <label class="set-field">
            <span>邮箱</span>
            <input
              type="email" autocomplete="username" required
              placeholder="you@example.com"
              value={email} onInput={(e) => setEmail(e.currentTarget.value)}
            />
          </label>
          <label class="set-field">
            <span>密码</span>
            <input
              type="password" required minLength={6}
              autocomplete={pwAutocomplete}
              placeholder="至少 6 位"
              value={password} onInput={(e) => setPassword(e.currentTarget.value)}
            />
          </label>
          {mode === 'signup' && (
            <label class="set-field">
              <span>确认密码</span>
              <input
                type="password" required minLength={6} autocomplete="new-password"
                placeholder="再输一次"
                value={confirm} onInput={(e) => setConfirm(e.currentTarget.value)}
              />
            </label>
          )}

          {error && <div class="notice danger"><Icon name="alert" size={15} /><span>{error}</span></div>}
          {notice && <div class="notice success"><Icon name="check" size={15} /><span>{notice}</span></div>}

          <button class="primary auth-submit" type="submit" disabled={busy}>
            {busy ? '处理中…' : mode === 'signin' ? '登录' : '注册'}
          </button>
        </form>

        <p class="auth-hint">
          {mode === 'signin'
            ? '站长账号由你自己持有，登录后可在右上角齿轮里上传图片、发布碎念。'
            : '新注册的账号是普通用户，可以收藏喜欢的音乐和影视；站长权限只属于站长本人。'}
        </p>
      </div>
    </section>
  );
}
