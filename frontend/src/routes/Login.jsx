// 登录 / 注册页（Supabase Auth）
import { useState } from 'preact/hooks';
import { useAuth } from '../lib/auth.jsx';
import { route } from 'preact-router';

export function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        route('/');
      } else {
        await signUp(email, password);
        setError('注册成功，请查收邮件确认（如已开启邮箱验证）。');
      }
    } catch (err) {
      setError(err.message || '操作失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section class="stack" style="max-width:380px;margin:40px auto">
      <h1>{mode === 'signin' ? '登录' : '注册'}</h1>
      <form class="stack" onSubmit={onSubmit}>
        <label>
          邮箱
          <input type="email" value={email} onInput={(e) => setEmail(e.currentTarget.value)} required />
        </label>
        <label>
          密码
          <input type="password" value={password} onInput={(e) => setPassword(e.currentTarget.value)} required minLength={6} />
        </label>
        {error && <p class="muted" style="color:var(--danger)">{error}</p>}
        <button class="primary" type="submit" disabled={busy}>
          {busy ? '处理中…' : mode === 'signin' ? '登录' : '注册'}
        </button>
      </form>
      <button onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
        {mode === 'signin' ? '没有账号？去注册' : '已有账号？去登录'}
      </button>
    </section>
  );
}
