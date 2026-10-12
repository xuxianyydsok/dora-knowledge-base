// 图书（/books）：电子书书架 + 站内阅读。
//
// 设计取舍（2026-10-11 第三轮上线，前两轮曾因单本过大整体下线）：
// 1) 书架是「封面墙」：2:3 竖版封面 + 书脊高光，悬停轻抬。封面来自后端上传时
//    自动提取（EPUB 解析 OPF / PDF 抽第一页 JPEG），**前端不碰正文**，
//    所以 100MB 的书在书架页也只有一张小图要下载。
// 2) 点击封面就地弹出阅读器（不跳路由、不滚动页面），**默认在线阅读**：
//    PDF   → <iframe> 内嵌浏览器自带阅读器（后端支持 Range，可翻页）；
//    EPUB  → 用 lib/epubReader.js 在浏览器里解压并渲染章节，带章节目录；
//    本站只支持这两种格式（2026-10-12 用户决定）：MOBI / AZW3 连上传都不收，
//    前端不出现任何入口，因此阅读器不需要「暂不支持」的兜底分支。
//    2026-10-11 用户要求：点击书先在线阅读，**不强制下载**；阅读器里另给一个「下载」
//    按钮，想存到本地的读者可以自己下。
// 3) 站长多一整套管理：拖拽上传（带进度）、改书名/作者/简介、公开/私人切换、删除。
//    普通访客与登录用户只看到公开书，看不到任何管理入口。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { api, uploadBook } from '../lib/api.js';
import { BookReader } from '../components/BookReader.jsx';
import { useAuth } from '../lib/auth.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { LoadingState, ErrorState } from '../components/StateView.jsx';
import { Icon } from '../components/Icon.jsx';
import { toastError, toastSuccess } from '../lib/toast.jsx';
import '../styles/wenkai.css';
import '../styles/books.css';

// 支持的格式（与后端 bookType.js 白名单一致）：只保留可在站内阅读的两种
const FORMATS = [
  { key: '', label: '全部' },
  { key: 'epub', label: 'EPUB' },
  { key: 'pdf', label: 'PDF' }
];

// 可站内阅读的格式（现在等于全部支持的格式；保留集合是为了让卡片样式与
// 上传校验有一处统一来源，将来若要加回「只下载」的格式不必再改一遍）
const READABLE = new Set(['pdf', 'epub']);

const ACCEPT = '.epub,.pdf,application/epub+zip,application/pdf';

function fmtSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------------- 单本书的封面 ----------------
function BookCover({ book }) {
  const [broken, setBroken] = useState(false);
  const title = book.title || '未命名';
  if (book.cover_url && !broken) {
    return (
      <div class="bk-cover">
        <img
          src={book.cover_url}
          alt={`《${title}》封面`}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
        />
        <span class={`bk-fmt${READABLE.has(book.format) ? ' readable' : ''}`}>{book.format}</span>
        {!book.is_public && <span class="bk-private">私人</span>}
      </div>
    );
  }
  return (
    <div class="bk-cover">
      <div class="bk-cover-blank"><span>{title}</span></div>
      <span class={`bk-fmt${READABLE.has(book.format) ? ' readable' : ''}`}>{book.format}</span>
      {!book.is_public && <span class="bk-private">私人</span>}
    </div>
  );
}

// ---------------- 编辑弹层（仅站长） ----------------
function EditDialog({ book, onClose, onSaved }) {
  const [draft, setDraft] = useState({
    title: book.title || '',
    author: book.author || '',
    description: book.description || '',
    is_public: !!book.is_public,
    sort_order: book.sort_order ?? 0
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.updateBook(book.id, {
        // 用空字符串而不是 null：后端 optionalString 把 null 当「不改」，
        // 传 null 就没法把书名清空。
        title: draft.title.trim(),
        author: draft.author.trim(),
        description: draft.description.trim(),
        is_public: !!draft.is_public,
        sort_order: Number(draft.sort_order) || 0
      });
      toastSuccess('已保存');
      onSaved();
    } catch (err) {
      toastError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return createPortal((
    <div class="bk-reader" role="dialog" aria-modal="true" aria-label="编辑图书信息" onClick={onClose}>
      <div class="bk-reader-bar" onClick={(e) => e.stopPropagation()}>
        <div class="bk-reader-title">
          <strong>编辑图书信息</strong>
          <span>{book.original_name || book.format}</span>
        </div>
        <div class="bk-reader-tools">
          <button type="button" onClick={onClose}>取消</button>
          <button type="button" class="primary" disabled={saving} onClick={save}>
            <Icon name="check" size={15} /><span>{saving ? '保存中…' : '保存'}</span>
          </button>
        </div>
      </div>
      <div class="bk-reader-body" onClick={(e) => e.stopPropagation()} style="overflow:auto;padding:24px">
        <div style="max-width:560px;margin:0 auto;display:flex;flex-direction:column;gap:16px">
          <label class="field">
            <span>书名</span>
            <input value={draft.title} onInput={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="书名" />
          </label>
          <label class="field">
            <span>作者</span>
            <input value={draft.author} onInput={(e) => setDraft((d) => ({ ...d, author: e.target.value }))} placeholder="作者" />
          </label>
          <label class="field">
            <span>简介</span>
            <textarea rows={5} value={draft.description} onInput={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="这本书讲了什么" />
          </label>
          <label class="field">
            <span>排序权重（越大越靠前）</span>
            <input type="number" value={draft.sort_order} onInput={(e) => setDraft((d) => ({ ...d, sort_order: e.target.value }))} />
          </label>
          <label class="mo-check" style="display:flex;align-items:center;gap:8px">
            <input type="checkbox" checked={draft.is_public} onChange={(e) => setDraft((d) => ({ ...d, is_public: e.target.checked }))} />
            <span>公开（访客可见可读）</span>
          </label>
        </div>
      </div>
    </div>
  ), document.body);
}

// ---------------- 页面 ----------------
export function Books() {
  const { isAdmin, isAuthenticated } = useAuth();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState('');
  const [reading, setReading] = useState(null);
  const [editing, setEditing] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadName, setUploadName] = useState('');
  const fileRef = useRef(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.listBooks('?limit=200');
      setBooks(res?.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter((b) => {
      if (format && b.format !== format) return false;
      if (!q) return true;
      return `${b.title || ''} ${b.author || ''} ${b.original_name || ''}`.toLowerCase().includes(q);
    });
  }, [books, query, format]);

  // 上传：逐个上传并刷新（一次选多本也支持）
  async function uploadFiles(fileList) {
    const list = Array.from(fileList || []).filter((f) => /\.(epub|pdf)$/i.test(f.name || ''));
    if (!list.length) {
      toastError('本站只支持 EPUB / PDF 电子书');
      return;
    }
    setUploading(true);
    let done = 0;
    try {
      for (const file of list) {
        setUploadName(file.name);
        setProgress(0);
        await uploadBook(file, { onProgress: setProgress });
        done += 1;
      }
      toastSuccess(done > 1 ? `已上传 ${done} 本` : '已上传');
      await load();
    } catch (err) {
      toastError(err.message);
      if (done) await load();
    } finally {
      setUploading(false);
      setProgress(0);
      setUploadName('');
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function remove(book) {
    if (!confirm(`删除《${book.title || '未命名'}》？正文与封面都会从存储里删掉。`)) return;
    try {
      await api.deleteBook(book.id);
      toastSuccess('已删除');
      await load();
    } catch (err) {
      toastError(err.message);
    }
  }

  const stats = useMemo(() => {
    const byFormat = {};
    let total = 0;
    for (const b of books) {
      byFormat[b.format] = (byFormat[b.format] || 0) + 1;
      total += Number(b.size) || 0;
    }
    return { byFormat, total };
  }, [books]);

  return (
    <div class="bk-page">
      <PageHeader
        kicker="Book Shelf"
        title="图书"
        sub="电子书书架：支持 EPUB 与 PDF，均可站内直接阅读。"
        stats={[
          { label: '在架', value: books.length },
          { label: 'EPUB', value: stats.byFormat.epub || 0 },
          { label: 'PDF', value: stats.byFormat.pdf || 0 },
          { label: '占用', value: fmtSize(stats.total) || '0' }
        ]}
      />

      <div class="bk-toolbar">
        <label class="bk-search">
          <Icon name="search" size={16} />
          <input
            type="search"
            value={query}
            placeholder="搜索书名 / 作者…"
            onInput={(e) => setQuery(e.target.value)}
          />
        </label>
        <div class="bk-chips">
          {FORMATS.map((f) => (
            <button
              key={f.key || 'all'}
              type="button"
              class={`bk-chip${format === f.key ? ' on' : ''}`}
              onClick={() => setFormat(f.key)}
            >{f.label}</button>
          ))}
        </div>
        <span class="bk-count">{shown.length} / {books.length}</span>
      </div>

      {/* 上传区：仅站长 */}
      {isAdmin && (
        <div
          class={`bk-drop${dragging ? ' dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files); }}
        >
          <Icon name="book" size={26} />
          <div class="bk-drop-text">
            <strong>上传电子书</strong>
            <span>把 EPUB / PDF 拖到这里，不限制单本大小（受平台请求体上限约 100MB 影响）；封面与书名会自动提取</span>
          </div>
          <div class="bk-drop-actions">
            <button type="button" class="primary" disabled={uploading} onClick={() => fileRef.current?.click()}>
              <Icon name="plus" size={16} />{uploading ? '上传中…' : '选择文件'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              multiple
              hidden
              onChange={(e) => uploadFiles(e.target.files)}
            />
          </div>
          {uploading && (
            <div class="bk-progress" style="flex-basis:100%">
              <div class="bk-progress-bar"><div class="bk-progress-fill" style={`width:${progress}%`} /></div>
              <span class="bk-progress-label">{uploadName} · {progress}%（大文件请耐心等待）</span>
            </div>
          )}
        </div>
      )}

      {loading && <LoadingState shape="poster" count={10} label="正在加载书架" />}
      {!loading && error && <ErrorState title="书架加载失败" message={error} onRetry={load} />}

      {!loading && !error && shown.length === 0 && (
        <EmptyState
          icon="book"
          title={books.length ? '没有匹配的书' : '书架还是空的'}
          hint={books.length
            ? '换个关键词或格式试试。'
            : (isAdmin ? '用上面的上传区传一本 EPUB 或 PDF 试试。' : '站长还没有公开任何图书。')}
        />
      )}

      {!loading && !error && shown.length > 0 && (
        <div class="bk-shelf">
          {shown.map((b) => (
            <div key={b.id} class="bk-card-wrap">
              {isAdmin && (
                <div class="bk-admin">
                  <button type="button" title="编辑信息" aria-label="编辑" onClick={() => setEditing(b)}>
                    <Icon name="pencil" size={14} />
                  </button>
                  <button type="button" class="danger" title="删除" aria-label="删除" onClick={() => remove(b)}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              )}
              <button
                type="button"
                class="bk-card"
                onClick={() => setReading(b)}
                title={`打开《${b.title || '未命名'}》`}
              >
                <BookCover book={b} />
                <p class="bk-title">{b.title || '未命名'}</p>
                {b.author && <p class="bk-author">{b.author}</p>}
                <div class="bk-meta">
                  <span>{fmtSize(b.size)}</span>
                  {b.created_at && <span>{fmtDate(b.created_at)}</span>}
                </div>
              </button>
            </div>
          ))}
        </div>
      )}

      {reading && <BookReader book={reading} onClose={() => setReading(null)} />}
      {editing && (
        <EditDialog
          book={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
        />
      )}

      {/* 未登录且书架为空时的说明，避免访客以为是坏了 */}
      {!isAuthenticated && !loading && books.length > 0 && (
        <p class="bk-hint muted" style="margin-top:20px;font-size:12.5px;color:var(--text-muted)">
          提示：登录后可以把你喜欢的书收藏起来（收藏功能即将上线）。
        </p>
      )}
    </div>
  );
}
