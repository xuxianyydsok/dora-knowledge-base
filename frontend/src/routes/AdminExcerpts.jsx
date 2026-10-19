// 首页摘抄管理（/admin/excerpts，仅站长）
//
// 用户要求（2026-10-18）：
//   「摘抄那里的话需要在管理员那里管理一下，就是我可以输入文本，
//     就是我想把我想摘抄的内容在那个地方进行管理，然后在前端的页面进行展示」
//
// 设计：
//   1) 顶部一个大输入区，直接写正文 + 出处；正文允许长段落，按原样保留换行；
//   2) 下方列表按首页轮播顺序排列，可启用 / 停用、编辑、上移 / 下移、删除；
//   3) 所有写操作只对站长开放，非管理员只看到「仅站长可见」。
import { useEffect, useState } from 'preact/hooks';
import { api, clearApiCache } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { EmptyState, LoadingState, ErrorState } from '../components/StateView.jsx';
import { Icon } from '../components/Icon.jsx';
import { toastError, toastSuccess } from '../lib/toast.jsx';
import '../styles/excerpts-admin.css';

const MAX_CONTENT = 20000;
const MAX_SOURCE = 200;

const EMPTY_DRAFT = { content: '', source: '', is_active: true };

function fullTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16).replace('T', ' ');
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 新增 / 编辑共用同一张表单，避免两套字段行为不一致。
function ExcerptEditor({ initial, onSubmit, onCancel, busy, submitLabel = '添加到首页', error = '' }) {
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT, ...(initial || {}) });
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const canSubmit = draft.content.trim().length > 0 && !busy;

  function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      content: draft.content.trim(),
      source: draft.source.trim(),
      is_active: !!draft.is_active
    });
  }

  return (
    <form class="ex-editor" onSubmit={submit}>
      {error && <div class="notice danger" role="alert">{error}</div>}
      <textarea
        class="ex-editor-text"
        rows={initial ? 7 : 5}
        maxLength={MAX_CONTENT}
        placeholder="写下想放在首页的摘抄。可以很长，换行会原样保留。"
        value={draft.content}
        onInput={(e) => set({ content: e.currentTarget.value })}
      />
      <input
        class="ex-editor-source"
        maxLength={MAX_SOURCE}
        placeholder="出处 / 作者 / 书名（可选）"
        value={draft.source}
        onInput={(e) => set({ source: e.currentTarget.value })}
      />
      <div class="ex-editor-foot">
        <label class="ex-check">
          <input
            type="checkbox"
            checked={!!draft.is_active}
            onChange={(e) => set({ is_active: e.currentTarget.checked })}
          />
          <span>在首页展示</span>
        </label>
        <div class="ex-editor-actions">
          <span class="ex-counter">{draft.content.length} / {MAX_CONTENT}</span>
          <button type="button" onClick={onCancel} disabled={busy}>取消</button>
          <button class="primary" type="submit" disabled={!canSubmit}>
            {busy ? '保存中…' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

function ExcerptCard({ item, index, total, busy, onEdit, onToggle, onMove, onDelete }) {
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

      <blockquote class="ex-card-text">{item.content}</blockquote>
      <p class="ex-card-source">{item.source || '未注明出处'}</p>

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

export function AdminExcerpts() {
  const { isAdmin, user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [diagnose, setDiagnose] = useState(null);
  const [diagnoseBusy, setDiagnoseBusy] = useState(false);

  // 保存后清掉首页摘抄的读缓存：站长从后台回首页时能立刻看到新内容，
  // 不会先读到 60 秒内的旧列表（尤其是刚新增的第一条）。
  function refreshHomeExcerptCache() {
    clearApiCache('/api/excerpts');
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      // all=true 让站长看到已停用的条目；访客 / 普通用户永远只拿启用项。
      const res = await api.listExcerpts('?all=true&limit=200');
      const list = Array.isArray(res?.items) ? res.items : [];
      setItems(list);
      // 返回给保存流程做“写后读”核对：接口说成功、列表却读不到，必须明确报错。
      return list;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  async function runDiagnose() {
    setDiagnoseBusy(true);
    try {
      setDiagnose(await api.diagnoseExcerpts());
    } catch (e) {
      setDiagnose({ error: e.message });
    } finally {
      setDiagnoseBusy(false);
    }
  }

  async function create(body) {
    setBusy(true);
    setSaveError('');
    try {
      await api.createExcerpt(body);
      toastSuccess('已添加到首页摘抄');
      refreshHomeExcerptCache();
      setAdding(false);
      // 等首页读缓存清完再回读，避免刚写入就命中旧的空列表。
      await new Promise((resolve) => setTimeout(resolve, 350));
      // 只有写接口成功后才重新读列表；读失败不能伪装成“保存失败”。
      const list = await load();
      if (!Array.isArray(list) || !list.some((x) => x.content === body.content)) {
        setSaveError('保存接口已返回成功，但列表里没有读到这条内容。请刷新后再试，或检查数据库权限。');
      }
    } catch (e) {
      setSaveError(`保存失败：${e.message}`);
      toastError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function update(body) {
    setBusy(true);
    setSaveError('');
    try {
      await api.updateExcerpt(editing.id, body);
      toastSuccess('摘抄已保存');
      refreshHomeExcerptCache();
      const editedId = editing.id;
      setEditing(null);
      await new Promise((resolve) => setTimeout(resolve, 350));
      const list = await load();
      if (!Array.isArray(list) || !list.some((x) => x.id === editedId)) {
        setSaveError('保存接口已返回成功，但列表里没有读到这条内容。请刷新后再试，或检查数据库权限。');
      }
    } catch (e) {
      setSaveError(`保存失败：${e.message}`);
      toastError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(item) {
    setBusy(true);
    try {
      const updated = await api.updateExcerpt(item.id, { is_active: !item.is_active });
      setItems((list) => list.map((x) => (x.id === item.id ? updated : x)));
      refreshHomeExcerptCache();
      toastSuccess(updated.is_active ? '已启用，首页会展示' : '已停用，首页不再展示');
    } catch (e) {
      toastError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function move(item, delta) {
    const from = items.findIndex((x) => x.id === item.id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= items.length) return;
    const next = [...items];
    [next[from], next[to]] = [next[to], next[from]];
    setItems(next);
    setBusy(true);
    try {
      await api.reorderExcerpts(next.map((x) => x.id));
      refreshHomeExcerptCache();
      toastSuccess('顺序已保存');
    } catch (e) {
      toastError(e.message);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(item) {
    if (!confirm('确定删除这条摘抄？删除后无法恢复。')) return;
    setBusy(true);
    try {
      await api.deleteExcerpt(item.id);
      setItems((list) => list.filter((x) => x.id !== item.id));
      refreshHomeExcerptCache();
      toastSuccess('已删除');
    } catch (e) {
      toastError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!isAdmin) {
    return <EmptyState icon="crown" title="仅站长可见" hint="这个页面只有站长登录后才能打开。" />;
  }

  const active = items.filter((x) => x.is_active).length;

  return (
    <section class="ex-page">
      <PageHeader
        kicker="Admin"
        title="首页摘抄"
        sub="这里写下的内容会轮播在首页「此刻」区的大卡片里。长段落、换行都会原样保留。"
        stats={[
          { label: '全部', value: items.length },
          { label: '展示中', value: active },
          { label: '已停用', value: items.length - active }
        ]}
      >
        {!adding && !editing && (
          <button type="button" class="primary" onClick={() => setAdding(true)}>
            <Icon name="plus" size={15} /> 写一条摘抄
          </button>
        )}
        <button type="button" onClick={load} disabled={loading || busy}>
          <Icon name="refresh" size={14} /> 刷新
        </button>
        <button type="button" onClick={runDiagnose} disabled={diagnoseBusy}>
          <Icon name="search" size={14} /> {diagnoseBusy ? '检查中…' : '数据库核对'}
        </button>
      </PageHeader>

      <div class="ex-debug">
        <span>当前账号：<strong>{user?.email || '未知'}</strong></span>
        <span>后台读取：<strong>{loading ? '读取中…' : `${items.length} 条`}</strong></span>
        <span>启用中：<strong>{loading ? '—' : `${active} 条`}</strong></span>
      </div>

      {diagnose && (
        <div class="notice" style="margin-top:10px">
          {diagnose.error ? (
            <>数据库核对失败：{diagnose.error}</>
          ) : (
            <>
              数据库真实记录 <strong>{diagnose.total}</strong> 条，
              启用 <strong>{diagnose.active}</strong> 条；
              其中属于当前账号 <strong>{diagnose.rows.filter((r) => r.owner_is_viewer).length}</strong> 条。
              {diagnose.total === 0 && ' —— 说明记录没有写进数据库。'}
              {diagnose.total > 0 && diagnose.active === 0 && ' —— 说明记录都被停用了。'}
              {diagnose.active > 0 && diagnose.rows.filter((r) => r.owner_is_viewer && r.is_active).length === 0
                && ' —— 说明启用记录属于另一个账号，访客首页不会显示。'}
            </>
          )}
        </div>
      )}

      {error && <div class="notice danger">{error}</div>}

      {adding && (
        <ExcerptEditor
          onSubmit={create}
          onCancel={() => setAdding(false)}
          busy={busy}
          error={saveError}
        />
      )}
      {editing && (
        <ExcerptEditor
          key={editing.id}
          initial={{ content: editing.content, source: editing.source, is_active: editing.is_active }}
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
        <ErrorState title="摘抄加载失败" message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="sparkles"
          title="还没有摘抄"
          hint="点右上角「写一条摘抄」，写下第一段想放在首页的话。"
        />
      ) : (
        <div class="ex-list">
          {items.map((item, i) => (
            <ExcerptCard
              key={item.id}
              item={item}
              index={i}
              total={items.length}
              busy={busy}
              onEdit={setEditing}
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
