// 首页轮播摘要管理（/admin/hero-subtitle，仅站长）
//
// 用户要求（2026-10-19）：
//   「可以写那个前端的那个首页轮播图下面的那个摘要部分的那个内容……
//     点击之后然后可以对那个首页轮播图的那个摘要部分的内容进行编辑，
//     然后保存之后，就可以在那个首页进行展示。」
//
// 存储：复用 site_settings 的 `hero_subtitle` 键（value = { text }），
// 不新建表；首页通过 GET /api/site-settings 读取，接口失败时用内置文案兜底。
import { useEffect, useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { EmptyState, LoadingState, ErrorState } from '../components/StateView.jsx';
import { Icon } from '../components/Icon.jsx';
import { toastError, toastSuccess } from '../lib/toast.jsx';
import '../styles/excerpts-admin.css';

const MAX_TEXT = 500;
const DEFAULT_TEXT = '博客 · GitHub 收藏 · 图展 · 音乐 · 影视 —— 一个可以慢慢逛的个人知识库。';

export function AdminHeroSubtitle() {
  const { isAdmin } = useAuth();
  const [text, setText] = useState('');
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.getSiteSettings();
      const current = res?.hero_subtitle?.text || '';
      setText(current);
      setSaved(current);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.updateSiteSettings({ hero_subtitle: { text: text.trim() } });
      const next = res?.hero_subtitle?.text || '';
      setText(next);
      setSaved(next);
      toastSuccess('首页摘要已保存，刷新首页即可看到');
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!isAdmin) {
    return <EmptyState icon="crown" title="仅站长可见" hint="这个页面只有站长登录后才能打开。" />;
  }

  if (loading) return <LoadingState shape="text" count={4} />;
  if (error) return <ErrorState title="首页摘要加载失败" message={error} onRetry={load} />;

  const dirty = text.trim() !== saved.trim();
  return (
    <section class="ex-page">
      <PageHeader
        kicker="Admin"
        title="首页轮播摘要"
        sub="这段文字显示在首页大图轮播的下方。保存后首页会自动读取；接口失败时使用内置文案。"
      >
        <button type="button" onClick={load} disabled={busy}>
          <Icon name="refresh" size={14} /> 刷新
        </button>
      </PageHeader>

      <form class="ex-editor" onSubmit={save}>
        <label class="ex-editor-source" style="display:flex;flex-direction:column;gap:8px">
          <span class="muted">首页摘要文案</span>
          <textarea
            class="ex-editor-text"
            rows={6}
            maxLength={MAX_TEXT}
            placeholder={DEFAULT_TEXT}
            value={text}
            onInput={(e) => setText(e.currentTarget.value)}
          />
        </label>
        <div class="ex-editor-foot">
          <span class="ex-counter">{text.length} / {MAX_TEXT}</span>
          <div class="ex-editor-actions">
            <button type="button" onClick={() => setText(DEFAULT_TEXT)} disabled={busy}>
              填入默认文案
            </button>
            <button class="primary" type="submit" disabled={busy || !dirty}>
              {busy ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </form>

      <p class="muted" style="margin-top:12px">
        留空也可以保存：首页会回退到内置文案，不会出现空白。
      </p>
    </section>
  );
}
