// 碎念（/moments）：朋友圈式的短动态流。
//
// 产品定位：站长**显式发布**的短动态（一段正文 + 可选配图），按发布时间倒序。
// 这不是行为追踪：页面绝不自动暴露播放历史、阅读记录等私人行为；只有站长手动发布、
// 且显式勾选「公开」的碎念才会出现在访客眼前（后端默认 is_public=false）。
//
// 设计取舍：
// 1) 单列时间流（朋友圈形态）：头像 + 昵称 + 时间 + 正文 + 九宫格配图，
//    比原先的「六类状态卡」更像日常随手记，也更适合手机阅读。
// 2) 管理员才显示发布框与每条右侧的「编辑 / 删除」；访客/普通用户看不到任何管理入口。
// 3) 配图复用已有素材上传（POST /api/assets），九宫格最多 9 张；点图进灯箱原地放大。
// 4) 样式集中在 styles/now-settings.css（.mo-*），不动 global.css。
import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { api, uploadAsset, uploadFile } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { LoadingState, ErrorState } from '../components/StateView.jsx';
import { Icon } from '../components/Icon.jsx';
import { toastError, toastSuccess } from '../lib/toast.jsx';
import '../styles/now-settings.css';

const MAX_IMAGES = 9;
const MAX_FILES = 5;
const MAX_CONTENT = 2000;

// 附件大小格式化（列表里展示「1.2 MB」这种人类可读值）
function fmtSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// 附件图标：按类型给个能一眼分辨的记号（PDF / Word / Excel / PPT / 文本）
function fileBadge(mime, name) {
  const m = String(mime || '').toLowerCase();
  const ext = String(name || '').split('.').pop().toLowerCase();
  if (m.includes('pdf') || ext === 'pdf') return 'PDF';
  if (m.includes('word') || ext === 'doc' || ext === 'docx') return 'DOC';
  if (m.includes('sheet') || m.includes('excel') || ext === 'xls' || ext === 'xlsx') return 'XLS';
  if (m.includes('presentation') || m.includes('powerpoint') || ext === 'ppt' || ext === 'pptx') return 'PPT';
  if (ext === 'csv') return 'CSV';
  if (ext === 'md') return 'MD';
  return 'TXT';
}

// 相对时间：朋友圈最常见的「刚刚 / 5 分钟前 / 昨天 / 3 天前 / 2026-10-01」
function relTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day === 1) return '昨天';
  if (day < 7) return `${day} 天前`;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function fullTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 九宫格列数：1 张走单图大图，2–4 张两列，5 张以上三列（朋友圈惯例）
function gridClass(n) {
  if (n === 1) return 'mo-grid one';
  if (n <= 4) return 'mo-grid two';
  return 'mo-grid three';
}

// 一张配图按原始比例撑高，避免加载后版面跳动
function ratioStyle(img) {
  const w = Number(img?.width);
  const h = Number(img?.height);
  if (w > 0 && h > 0) return `aspect-ratio:${w} / ${h}`;
  return 'aspect-ratio:4 / 3';
}

// ---------------- 灯箱（点图放大） ----------------
// 与图片展同一套做法：portal 挂到 body（避免祖先 transform 让 fixed 相对整页定位），
// 聚焦容器而非按钮（focus 按钮会触发 scrollIntoView 把页面滚走）。
function Lightbox({ images, index, onClose, onIndex }) {
  const boxRef = useRef(null);
  const img = images[index];
  const stateRef = useRef({ index, onClose, onIndex });
  stateRef.current = { index, onClose, onIndex };

  useEffect(() => {
    const trigger = document.activeElement;
    boxRef.current?.focus({ preventScroll: true });
    const prevOverflow = document.body.style.overflow;
    const prevScrollY = window.scrollY;
    const prevBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      const { index: i, onClose: close, onIndex: go } = stateRef.current;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') go(i - 1);
      else if (e.key === 'ArrowRight') go(i + 1);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      window.scrollTo(0, prevScrollY);
      document.documentElement.style.scrollBehavior = prevBehavior;
      if (trigger && typeof trigger.focus === 'function') trigger.focus({ preventScroll: true });
    };
  }, []);

  if (!img) return null;
  return createPortal((
    <div ref={boxRef} tabIndex={-1} class="mo-lightbox" role="dialog" aria-modal="true" aria-label="查看图片" onClick={onClose}>
      <div class="mo-lb-inner" onClick={(e) => e.stopPropagation()}>
        <button type="button" class="mo-lb-close" onClick={onClose} aria-label="关闭">
          <Icon name="close" size={20} />
        </button>
        {images.length > 1 && (
          <button type="button" class="mo-lb-nav prev" onClick={() => onIndex(index - 1)} aria-label="上一张">
            <Icon name="chevronLeft" size={22} />
          </button>
        )}
        <img class="mo-lb-img" src={img.url} alt="" />
        {images.length > 1 && (
          <button type="button" class="mo-lb-nav next" onClick={() => onIndex(index + 1)} aria-label="下一张">
            <Icon name="chevronRight" size={22} />
          </button>
        )}
        {images.length > 1 && <span class="mo-lb-count">{index + 1} / {images.length}</span>}
      </div>
    </div>
  ), document.body);
}

// ---------------- 配图选择（上传 + 从已有素材挑） ----------------
function ImagePicker({ value, onChange, disabled }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [recent, setRecent] = useState([]);
  const [picking, setPicking] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    api.listAssets('?limit=24').then((res) => setRecent(res?.items || [])).catch(() => {});
  }, []);

  const full = value.length >= MAX_IMAGES;

  async function handleFiles(files) {
    const list = Array.from(files || []).filter((f) => f.type.startsWith('image/'));
    if (!list.length) return;
    setUploading(true);
    try {
      const next = [...value];
      for (const file of list) {
        if (next.length >= MAX_IMAGES) break;
        setProgress(0);
        const asset = await uploadAsset(file, { onProgress: setProgress });
        if (!next.includes(asset.id)) next.push(asset.id);
        setRecent((r) => [asset, ...r.filter((a) => a.id !== asset.id)].slice(0, 24));
      }
      onChange(next);
    } catch (e) { toastError(e.message); }
    finally { setUploading(false); setProgress(0); }
  }

  function toggle(id) {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else if (!full) onChange([...value, id]);
  }

  return (
    <div class="mo-picker">
      <div class="mo-picker-bar">
        <button type="button" class="mo-pick-btn" disabled={disabled || uploading || full} onClick={() => fileRef.current?.click()}>
          <Icon name="plus" size={14} /> {uploading ? `上传中 ${progress}%` : '上传图片'}
        </button>
        <button type="button" class="mo-pick-btn" disabled={disabled} onClick={() => setPicking((v) => !v)}>
          <Icon name="grid" size={14} /> {picking ? '收起素材' : '从素材选'}
        </button>
        <span class="mo-picker-count">{value.length} / {MAX_IMAGES}</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => { handleFiles(e.currentTarget.files); e.currentTarget.value = ''; }}
        />
      </div>

      {value.length > 0 && (
        <div class="mo-chosen">
          {value.map((id, i) => (
            <div key={id} class="mo-chosen-item">
              <img src={api.assetUrl(id)} alt="" />
              <button type="button" class="mo-chosen-del" onClick={() => toggle(id)} aria-label="移除">
                <Icon name="close" size={12} />
              </button>
              <span class="mo-chosen-idx">{i + 1}</span>
            </div>
          ))}
        </div>
      )}

      {picking && (
        <div class="mo-assets">
          {recent.length === 0 ? (
            <p class="mo-assets-empty">还没有上传过素材。</p>
          ) : recent.map((a) => (
            <button
              key={a.id}
              type="button"
              class={`mo-asset${value.includes(a.id) ? ' on' : ''}`}
              disabled={!value.includes(a.id) && full}
              onClick={() => toggle(a.id)}
              title={a.original_name || ''}
            >
              <img src={a.public_url || api.assetUrl(a.id)} alt="" loading="lazy" />
              {value.includes(a.id) && <span class="mo-asset-check"><Icon name="check" size={14} /></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- 发布 / 编辑框 ----------------
// ---------------- 附件选择（上传 PDF / Word 等，或从已上传里挑） ----------------
function FilePicker({ value, onChange, disabled }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [recent, setRecent] = useState([]);
  const [picking, setPicking] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    api.listFiles('?limit=24').then((res) => setRecent(res?.items || [])).catch(() => {});
  }, []);

  const full = value.length >= MAX_FILES;

  async function handleFiles(files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    setUploading(true);
    try {
      const next = [...value];
      for (const file of list) {
        if (next.length >= MAX_FILES) break;
        setProgress(0);
        const item = await uploadFile(file, { onProgress: setProgress });
        if (!next.includes(item.id)) next.push(item.id);
        setRecent((r) => [item, ...r.filter((a) => a.id !== item.id)].slice(0, 24));
      }
      onChange(next);
    } catch (e) { toastError(e.message); }
    finally { setUploading(false); setProgress(0); }
  }

  function toggle(id) {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else if (!full) onChange([...value, id]);
  }

  return (
    <div class="mo-picker">
      <div class="mo-picker-bar">
        <button type="button" class="mo-pick-btn" disabled={disabled || uploading || full} onClick={() => fileRef.current?.click()}>
          <Icon name="plus" size={14} /> {uploading ? `上传中 ${progress}%` : '上传附件'}
        </button>
        <button type="button" class="mo-pick-btn" disabled={disabled} onClick={() => setPicking((v) => !v)}>
          <Icon name="grid" size={14} /> {picking ? '收起附件库' : '从附件库选'}
        </button>
        <span class="mo-picker-count">{value.length} / {MAX_FILES}</span>
        <span class="mo-picker-hint">支持 PDF / Word / Excel / PPT / 文本</span>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md"
          onChange={(e) => { handleFiles(e.currentTarget.files); e.currentTarget.value = ''; }}
        />
      </div>

      {value.length > 0 && (
        <div class="mo-chosen mo-chosen-files">
          {value.map((id) => {
            const meta = recent.find((a) => a.id === id);
            return (
              <div key={id} class="mo-chosen-file">
                <span class="mo-file-badge">{fileBadge(meta?.mime_type, meta?.original_name)}</span>
                <span class="mo-file-name" title={meta?.original_name || ''}>{meta?.original_name || '已选附件'}</span>
                <button type="button" class="mo-chosen-del inline" onClick={() => toggle(id)} aria-label="移除">
                  <Icon name="close" size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {picking && (
        <div class="mo-assets mo-file-assets">
          {recent.length === 0 ? (
            <p class="mo-assets-empty">还没有上传过附件。</p>
          ) : recent.map((a) => (
            <button
              key={a.id}
              type="button"
              class={`mo-file-pick${value.includes(a.id) ? ' on' : ''}`}
              disabled={!value.includes(a.id) && full}
              onClick={() => toggle(a.id)}
              title={a.original_name || ''}
            >
              <span class="mo-file-badge">{fileBadge(a.mime_type, a.original_name)}</span>
              <span class="mo-file-pick-name">{a.original_name || '附件'}</span>
              {value.includes(a.id) && <Icon name="check" size={13} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const EMPTY_DRAFT = { content: '', is_public: true, asset_ids: [], file_ids: [] };

function MomentComposer({ initial, onSubmit, onCancel, busy, submitLabel = '发布' }) {
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT, ...(initial || {}) });
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const canSubmit = draft.content.trim().length > 0 && !busy;

  function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      content: draft.content.trim(),
      is_public: !!draft.is_public,
      asset_ids: draft.asset_ids,
      file_ids: draft.file_ids
    });
  }

  return (
    <form class="mo-composer" onSubmit={submit}>
      <textarea
        class="mo-composer-text"
        rows={3}
        maxLength={MAX_CONTENT}
        placeholder="说点什么…"
        value={draft.content}
        onInput={(e) => set({ content: e.currentTarget.value })}
      />
      <ImagePicker value={draft.asset_ids} onChange={(ids) => set({ asset_ids: ids })} disabled={busy} />
      <FilePicker value={draft.file_ids} onChange={(ids) => set({ file_ids: ids })} disabled={busy} />
      <div class="mo-composer-foot">
        <label class="mo-check">
          <input type="checkbox" checked={!!draft.is_public} onChange={(e) => set({ is_public: e.currentTarget.checked })} />
          <span>公开（勾选后访客可见，取消则只有自己能看到）</span>
        </label>
        <div class="mo-composer-actions">
          <span class="mo-counter">{draft.content.length} / {MAX_CONTENT}</span>
          <button type="button" onClick={onCancel} disabled={busy}>取消</button>
          <button class="primary" type="submit" disabled={!canSubmit}>{busy ? '处理中…' : submitLabel}</button>
        </div>
      </div>
    </form>
  );
}

// ---------------- 单条碎念 ----------------
function MomentItem({ item, isAdmin, avatarUrl, initial, name, onEdit, onDelete, onZoom }) {
  return (
    <article class={`mo-item${item.is_public ? '' : ' mo-private'}`}>
      {avatarUrl
        ? <img class="mo-avatar" src={avatarUrl} alt="" />
        : <span class="mo-avatar mo-avatar-letter" aria-hidden="true">{initial}</span>}
      <div class="mo-body">
        <header class="mo-head">
          <strong class="mo-name">{name}</strong>
          {!item.is_public && <span class="mo-flag">仅自己可见</span>}
        </header>
        <p class="mo-text">{item.content}</p>
        {item.images.length > 0 && (
          <div class={gridClass(item.images.length)}>
            {item.images.map((img, i) => (
              <button
                key={`${img.url}-${i}`}
                type="button"
                class="mo-pic"
                style={item.images.length === 1 ? ratioStyle(img) : undefined}
                onClick={() => onZoom(item.images, i)}
              >
                <img src={img.url} alt="" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        )}
        {item.files?.length > 0 && (
          <div class="mo-files">
            {item.files.map((f) => (
              <a
                key={f.id}
                class="mo-file"
                href={f.url}
                target="_blank"
                rel="noreferrer"
                title={`${f.name}${fmtSize(f.size) ? ` · ${fmtSize(f.size)}` : ''}`}
              >
                <span class="mo-file-badge">{fileBadge(f.mime_type, f.name)}</span>
                <span class="mo-file-name">{f.name}</span>
                {f.size ? <span class="mo-file-size">{fmtSize(f.size)}</span> : null}
                <Icon name="download" size={13} />
              </a>
            ))}
          </div>
        )}
        <footer class="mo-foot">
          <time title={fullTime(item.created_at)}>{relTime(item.created_at)}</time>
          {isAdmin && (
            <div class="mo-ops">
              <button type="button" class="mo-op" onClick={() => onEdit(item)} title="编辑">
                <Icon name="pencil" size={13} /> 编辑
              </button>
              <button type="button" class="mo-op danger" onClick={() => onDelete(item)} title="删除">
                <Icon name="trash" size={13} /> 删除
              </button>
            </div>
          )}
        </footer>
      </div>
    </article>
  );
}

export function Moments() {
  const { isAdmin, profile: profileFromAuth } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(null);   // { images, index }

  async function load() {
    setError('');
    try {
      const res = await api.listMoments('?limit=100');
      setItems(res?.items || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  // 昵称与头像来自 user_profiles（useAuth().profile），不是 Supabase 会话里的 user
  // （session.user 只有邮箱等 auth 字段，没有 display_name / avatar_path）。
  const profile = profileFromAuth;
  const avatarUrl = profile?.avatar_path || '';
  const name = profile?.display_name || profile?.username || '站长';
  const initial = String(name).trim().charAt(0).toUpperCase() || 'D';

  async function create(body) {
    setBusy(true);
    try {
      await api.createMoment(body);
      toastSuccess('已发布');
      setAdding(false);
      await load();
    } catch (err) { toastError(err.message); }
    finally { setBusy(false); }
  }

  async function update(body) {
    setBusy(true);
    try {
      await api.updateMoment(editing.id, body);
      toastSuccess('已保存');
      setEditing(null);
      await load();
    } catch (err) { toastError(err.message); }
    finally { setBusy(false); }
  }

  async function remove(item) {
    if (!confirm('确定删除这条碎念？')) return;
    try {
      await api.deleteMoment(item.id);
      toastSuccess('已删除');
      await load();
    } catch (err) { toastError(err.message); }
  }

  if (loading && !items.length) return <LoadingState shape="list" />;
  if (error && !items.length) return <ErrorState title="碎念加载失败" message={error} onRetry={load} />;

  return (
    <section class="mo-page">
      <PageHeader
        kicker="Moments"
        title="碎念"
        sub="随手记下的零碎片段。这里只有站长主动发布的内容，不是行为追踪。"
        stats={[{ label: '碎念', value: items.length }]}
      >
        {isAdmin && !adding && !editing && (
          <button type="button" class="primary" onClick={() => setAdding(true)}>
            <Icon name="plus" size={16} /> 写碎念
          </button>
        )}
      </PageHeader>

      {isAdmin && adding && (
        <MomentComposer onSubmit={create} onCancel={() => setAdding(false)} busy={busy} />
      )}
      {isAdmin && editing && (
        <MomentComposer
          key={editing.id}
          initial={{
            content: editing.content || '',
            is_public: !!editing.is_public,
            // 回填已有配图 / 附件，编辑时不会因为「没带 id」而被清空
            asset_ids: (editing.images || []).map((i) => i.id).filter(Boolean),
            file_ids: (editing.files || []).map((f) => f.id).filter(Boolean)
          }}
          onSubmit={update}
          onCancel={() => setEditing(null)}
          busy={busy}
          submitLabel="保存"
        />
      )}

      {items.length === 0 ? (
        <EmptyState
          icon="sparkles"
          title="还没有碎念"
          hint={isAdmin ? '点右上角「写碎念」，记下第一条。' : '站长还没有公开任何碎念。'}
        />
      ) : (
        <div class="mo-stream">
          {items.map((item) => (
            <MomentItem
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              avatarUrl={avatarUrl}
              initial={initial}
              name={name}
              onEdit={setEditing}
              onDelete={remove}
              onZoom={(images, index) => setZoom({ images, index })}
            />
          ))}
        </div>
      )}

      {zoom && (
        <Lightbox
          images={zoom.images}
          index={zoom.index}
          onClose={() => setZoom(null)}
          onIndex={(i) => setZoom((z) => ({ ...z, index: (i + z.images.length) % z.images.length }))}
        />
      )}
    </section>
  );
}
