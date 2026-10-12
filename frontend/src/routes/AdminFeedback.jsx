// 共创反馈管理（/admin/feedback，仅站长）
//
// 这是「共创」页的收件箱：列出访客与登录用户提交的每一条反馈，站长可以改处理状态、
// 写备注、删除。匿名条目对外只显示「匿名读者」，后端也从不返回 user_id，所以这里
// 看不到提交者是谁（这正是匿名提交的意义）。
//
// 设计取舍（形式参考 routes/AdminUsers.jsx）：
// 1) 页头读数条给「总数 / 待处理 / 已处理」三个关键数；下面一条状态筛选的 .seg。
// 2) 每条一张卡片：分类角标 + 匿名/实名 + 正文 + 提交时间 + 来源页面 + 联系方式（有才显示）；
//    底部是状态切换（待处理 / 已读 / 已处理）、站长备注输入与删除按钮。
// 3) 非站长进来只看到一句「仅站长可见」的空态，不泄露任何数据。
import { useEffect, useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { LoadingState, ErrorState, EmptyState } from '../components/StateView.jsx';
import { Icon } from '../components/Icon.jsx';
import { toastError, toastSuccess } from '../lib/toast.jsx';
import '../styles/coop.css';

// 分类 / 状态的中文名，与后端 feedback.js 的 CATEGORY_LABELS / STATUS_LABELS 保持一致
const CATEGORY_LABELS = { bug: '缺陷', improve: '值得改进', feature: '想要的新功能', other: '其它' };
const STATUSES = [
  { key: 'new', label: '待处理' },
  { key: 'read', label: '已读' },
  { key: 'done', label: '已处理' }
];
const STATUS_LABELS = { new: '待处理', read: '已读', done: '已处理' };

const FILTERS = [{ key: '', label: '全部' }, ...STATUSES];

function fullTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16).replace('T', ' ');
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 单条反馈卡片：可改状态、写备注、删除
function FeedbackCard({ item, busy, onStatus, onNote, onDelete }) {
  const [note, setNote] = useState(item.admin_note || '');
  const [editingNote, setEditingNote] = useState(false);

  const dirty = note !== (item.admin_note || '');

  return (
    <article class={`coop-adm-card${item.status === 'done' ? ' is-done' : ''}`}>
      <header class="coop-adm-head">
        <span class={`coop-adm-cat cat-${item.category}`}>{CATEGORY_LABELS[item.category] || item.category}</span>
        <span class="coop-adm-name">
          {item.is_anonymous ? '匿名读者' : (item.display_name || '实名读者')}
        </span>
        {item.is_anonymous && <span class="coop-adm-tag">匿名</span>}
        <span class="spacer" />
        <span class={`coop-adm-status st-${item.status}`}>{STATUS_LABELS[item.status] || item.status}</span>
      </header>

      <p class="coop-adm-text">{item.content}</p>

      <div class="coop-adm-meta">
        <span><Icon name="clock" size={12} /> {fullTime(item.created_at)}</span>
        {item.page_url && <span><Icon name="link" size={12} /> 来自 {item.page_url}</span>}
        {item.contact && <span><Icon name="bell" size={12} /> 联系方式：{item.contact}</span>}
      </div>

      <div class="coop-adm-ops">
        <div class="seg coop-adm-seg">
          {STATUSES.map((s) => (
            <button
              key={s.key}
              type="button"
              class={item.status === s.key ? 'on' : ''}
              disabled={busy}
              onClick={() => onStatus(item, s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span class="spacer" />
        <button type="button" onClick={() => setEditingNote((v) => !v)} disabled={busy}>
          <Icon name="pencil" size={13} /> 备注
        </button>
        <button type="button" class="danger" onClick={() => onDelete(item)} disabled={busy}>
          <Icon name="trash" size={13} /> 删除
        </button>
      </div>

      {editingNote && (
        <div class="coop-adm-note">
          <textarea
            rows={2}
            maxLength={2000}
            placeholder="写给自己看的处理备注（如：已修好 / 排期 / 暂不做及原因）"
            value={note}
            onInput={(e) => setNote(e.currentTarget.value)}
          />
          <div class="coop-adm-note-ops">
            <span class="muted" style="font-size:11px">{note.length} / 2000</span>
            <span class="spacer" />
            <button type="button" disabled={busy || !dirty} onClick={() => onNote(item, note)}>保存备注</button>
          </div>
        </div>
      )}

      {!editingNote && item.admin_note && (
        <p class="coop-adm-note-view"><Icon name="pencil" size={12} /> {item.admin_note}</p>
      )}
    </article>
  );
}

export function AdminFeedback() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const params = status ? `?status=${status}` : '';
      const res = await api.listFeedback(params);
      setItems(res?.items || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (isAdmin) load(); }, [isAdmin, status]);

  async function changeStatus(item, next) {
    if (next === item.status) return;
    setBusyId(item.id);
    try {
      const updated = await api.updateFeedback(item.id, { status: next });
      // 若当前有状态筛选、且新状态不再匹配，就把这条移出列表
      setItems((list) => (status && updated.status !== status
        ? list.filter((x) => x.id !== item.id)
        : list.map((x) => (x.id === item.id ? updated : x))));
    } catch (e) { toastError(e.message); }
    finally { setBusyId(null); }
  }

  async function saveNote(item, note) {
    setBusyId(item.id);
    try {
      const updated = await api.updateFeedback(item.id, { admin_note: note });
      setItems((list) => list.map((x) => (x.id === item.id ? updated : x)));
      toastSuccess('备注已保存');
    } catch (e) { toastError(e.message); }
    finally { setBusyId(null); }
  }

  async function remove(item) {
    if (!confirm('确定删除这条反馈？删除后无法恢复。')) return;
    setBusyId(item.id);
    try {
      await api.deleteFeedback(item.id);
      setItems((list) => list.filter((x) => x.id !== item.id));
      toastSuccess('已删除');
    } catch (e) { toastError(e.message); }
    finally { setBusyId(null); }
  }

  if (!isAdmin) {
    return <EmptyState icon="crown" title="仅站长可见" hint="这个页面只有站长登录后才能打开。" />;
  }

  // 统计：基于当前已加载的列表（状态筛选为「全部」时即全量口径）
  const total = items.length;
  const pending = items.filter((x) => x.status === 'new').length;
  const done = items.filter((x) => x.status === 'done').length;

  return (
    <section class="coop-adm">
      <PageHeader
        kicker="Admin"
        title="共创反馈"
        sub="大家在「共创」页留下的意见、缺陷与功能需求都收在这里。"
        stats={[
          { label: '总数', value: total },
          { label: '待处理', value: pending },
          { label: '已处理', value: done }
        ]}
        tabs={FILTERS.map((f) => ({ key: f.key, label: f.label }))}
        activeTab={status}
        onTab={setStatus}
      >
        <button onClick={load} disabled={loading}><Icon name="refresh" size={14} /> 刷新</button>
      </PageHeader>

      {error && <div class="notice danger">{error}</div>}

      {loading ? (
        <LoadingState shape="list" />
      ) : error && !items.length ? (
        <ErrorState title="反馈加载失败" message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="heart"
          title={status ? '这个状态下还没有反馈' : '还没有收到反馈'}
          hint={status ? '切回「全部」看看其它条目。' : '等大家在「共创」页留言后，这里就会出现。'}
        />
      ) : (
        <div class="coop-adm-list">
          {items.map((item) => (
            <FeedbackCard
              key={item.id}
              item={item}
              busy={busyId === item.id}
              onStatus={changeStatus}
              onNote={saveNote}
              onDelete={remove}
            />
          ))}
        </div>
      )}
    </section>
  );
}
