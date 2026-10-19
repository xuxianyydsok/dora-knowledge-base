// 首页轮播摘要管理（/admin/hero-subtitle，仅站长）
//
// 用户要求（2026-10-19）：
//   「首页摘要那里……还没有支持新增、编辑、启用、停用，
//     还有你后面谈的这些功能……将已经保存了的在下面列举出来，并且可以管理」
//
// 存储：复用 site_settings。
//   hero_subtitle_items → 完整多条摘要（正文 / 启用 / 排序）
//   hero_subtitle       → 首页读取的当前启用文案（兼容旧格式）
//
// 首页始终只拿“第一条启用项”，管理页则拿完整列表。
import { useEffect, useState } from 'preact/hooks';
import { api, clearApiCache } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { EmptyState, LoadingState, ErrorState } from '../components/StateView.jsx';
import { Icon } from '../components/Icon.jsx';
import { toastError, toastSuccess } from '../lib/toast.jsx';
import '../styles/excerpts-admin.css';

const MAX_TEXT = 500;
const DEFAULT_TEXT = '博客 · GitHub 收藏 · 图展 · 音乐 · 影视 —— 一个可以慢慢逛的个人知识库。';

function fullTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16).replace('T', ' ');
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function SubtitleEditor({ initial, onSubmit, onCancel, busy, submitLabel = '添加摘要', error = '' }) {
  const [text, setText] = useState(initial?.text || '');
  const canSubmit = text.trim().length > 0 && !busy;

  function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(text.trim());
  }

  return (
    <form class="ex-editor" onSubmit={submit}>
      {error && <div class="notice danger" role="alert">{error}</div>}
      <textarea
        class="ex-editor-text"
        rows={initial ? 5 : 4}
        maxLength={MAX_TEXT}
        placeholder="写下首页轮播图下方要展示的摘要文案。"
        value={text}
        onInput={(e) => setText(e.currentTarget.value)}
      />
      <div class="ex-editor-foot">
        <span class="ex-counter">{text.length} / {MAX_TEXT}</span>
        <div class="ex-editor-actions">
          <button type="button" onClick={() => setText(DEFAULT_TEXT)} disabled={busy}>
            填入默认文案
          </button>
          <button type="button" onClick={onCancel} disabled={busy}>取消</button>
          <button class="primary" type="submit" disabled={!canSubmit}>
            {busy ? '保存中…' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

function SubtitleCard({ item, index, total, busy, onEdit, onToggle, onMove, onDelete }) {
  return (
    <article class={`ex-card${item.is_active ? '' : ' is-off'}`}>
      <header class="ex-card-head">
        <span class="ex-card-num">{String(index + 1).padStart(2, '0')}</span>
        <span class={`ex-state${item.is_active ? ' on' : ''}`}>
          {item.is_active ? '首页展示中' : '已停用'}
        </span>
        <span class="spacer" />
        <span class="ex-card-time">{fullTime(item.updated_at || item.created_at)}</span>
      </header>

      <blockquote class="ex-card-text">{item.text}</blockquote>

      <footer class="ex-card-ops">
        <button type="button" onClick={() => onMove(item, -1)} disabled={busy || index === 0} title="上移">
          <Icon name="chevronLeft" size={13} /> 上移
        </button>
        <button type="button" onClick={() => onMove(item, 1)} disabled={busy || index === total - 1} title="下移">
          下移 <Icon name="chevronRight" size={13} />
        </button>
        <span class="spacer" />
        <button type="button" onClick={() => onToggle(item)} disabled={busy}>
          <Icon name={item.is_active ? 'pause' : 'play'} size={13} />
          {item.is_active ? '停用' : '启用'}
        </button>
        <button type="button" onClick={() => onEdit(item)} disabled={busy}>
          <Icon name="pencil" size={13} /> 编辑
        </button>
        <button type="button" class="danger" onClick={() => onDelete(item)} disabled={busy}>
          <Icon name="trash" size={13} /> 删除
        </button>
      </footer>
    </article>
  );
}

export function AdminHeroSubtitle() {
  const { isAdmin, user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  function refreshHomeCache() {
    clearApiCache('/api/site-settings');
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.getHeroSubtitleItems();
      const list = Array.isArray(res?.items) ? res.items : [];
      setItems(list);
      return list;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  async function saveItems(next, successMessage) {
    setBusy(true);
    setSaveError('');
    try {
      await api.updateSiteSettings({
        hero_subtitle_items: next.map((item, i) => ({
          id: item.id,
          text: item.text,
          is_active: !!item.is_active,
          sort_order: i,
          created_at: item.created_at,
          updated_at: item.updated_at
        }))
      });
      refreshHomeCache();
      toastSuccess(successMessage);
      const list = await load();
      if (!Array.isArray(list) || list.length !== next.length) {
        setSaveError('保存接口已返回成功，但列表条数与预期不一致。请刷新后检查。');
      }
    } catch (e) {
      setSaveError(`保存失败：${e.message}`);
      toastError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function create(text) {
    const now = new Date().toISOString();
    const item = {
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      text,
      is_active: true,
      sort_order: items.length,
      created_at: now,
      updated_at: now
    };
    await saveItems([...items, item], '首页摘要已添加');
    setAdding(false);
  }

  async function update(text) {
    if (!editing) return;
    const now = new Date().toISOString();
    const next = items.map((item) => (
      item.id === editing.id ? { ...item, text, updated_at: now } : item
    ));
    await saveItems(next, '首页摘要已保存');
    setEditing(null);
  }

  async function toggle(item) {
    const now = new Date().toISOString();
    const next = items.map((x) => (
      x.id === item.id ? { ...x, is_active: !x.is_active, updated_at: now } : x
    ));
    await saveItems(next, item.is_active ? '已停用' : '已启用');
  }

  async function move(item, delta) {
    const from = items.findIndex((x) => x.id === item.id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= items.length) return;
    const next = [...items];
    [next[from], next[to]] = [next[to], next[from]];
    await saveItems(next, '顺序已保存');
  }

  async function remove(item) {
    if (!confirm('确定删除这条首页摘要？')) return;
    await saveItems(items.filter((x) => x.id !== item.id), '已删除');
  }

  if (!isAdmin) {
    return <EmptyState icon="crown" title="仅站长可见" hint="这个页面只有站长登录后才能打开。" />;
  }

  const activeCount = items.filter((x) => x.is_active).length;
  const current = items.find((x) => x.is_active) || null;

  return (
    <section class="ex-page">
      <PageHeader
        kicker="Admin"
        title="首页轮播摘要"
        sub="管理首页大图轮播下方的摘要文案。首页展示第一条启用项；可新增、编辑、启停、排序和删除。"
        stats={[
          { label: '全部', value: items.length },
          { label: '展示中', value: activeCount },
          { label: '已停用', value: items.length - activeCount }
        ]}
      >
        {!adding && !editing && (
          <button type="button" class="primary" onClick={() => { setAdding(true); setSaveError(''); }}>
            <Icon name="plus" size={15} /> 新增摘要
          </button>
        )}
        <button type="button" onClick={load} disabled={loading || busy}>
          <Icon name="refresh" size={14} /> 刷新
        </button>
      </PageHeader>

      <div class="ex-debug">
        <span>当前账号：<strong>{user?.email || '未知'}</strong></span>
        <span>已保存：<strong>{loading ? '读取中…' : `${items.length} 条`}</strong></span>
        <span>首页显示：<strong>{current ? '已启用' : '无启用项'}</strong></span>
      </div>

      {error && <div class="notice danger">{error}</div>}

      {adding && (
        <SubtitleEditor
          onSubmit={create}
          onCancel={() => setAdding(false)}
          busy={busy}
          error={saveError}
        />
      )}
      {editing && (
        <SubtitleEditor
          key={editing.id}
          initial={editing}
          onSubmit={update}
          onCancel={() => setEditing(null)}
          busy={busy}
          error={saveError}
          submitLabel="保存修改"
        />
      )}

      {loading ? (
        <LoadingState shape="list" />
      ) : error && !items.length ? (
        <ErrorState title="摘要加载失败" message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="pencil"
          title="还没有首页摘要"
          hint="点右上角「新增摘要」，写下第一条文案。"
        />
      ) : (
        <div class="ex-list">
          {items.map((item, i) => (
            <SubtitleCard
              key={item.id}
              item={item}
              index={i}
              total={items.length}
              busy={busy}
              onEdit={(x) => { setEditing(x); setSaveError(''); }}
              onToggle={toggle}
              onMove={move}
              onDelete={remove}
            />
          ))}
        </div>
      )}
    </section>
  );
}
