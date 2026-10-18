// 博客编辑页：新建/编辑文章
// 正文为原生 HTML；提供自定义标签插入按钮与实时预览（预览按需懒加载重型库）
import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api, uploadAsset } from '../lib/api.js';
import { invalidateBlogData } from '../lib/blogData.js';
import { PostRenderer } from '../components/PostRenderer.jsx';
import { FormField, FormRow, FormSection, FormShell } from '../components/FormShell.jsx';

const TAG_SNIPPETS = [
  { label: '行内公式', snippet: '<katex-inline>a^2+b^2=c^2</katex-inline>' },
  { label: '块级公式', snippet: '<katex-block>\\int_0^1 x^2 dx</katex-block>' },
  { label: 'Mermaid', snippet: '<mermaid-chart>graph TD;A-->B;</mermaid-chart>' },
  { label: '图表', snippet: '<chart-2d>{"type":"bar","data":{"labels":["A","B"],"datasets":[{"label":"示例","data":[3,5]}]}}</chart-2d>' },
  { label: '3D 场景', snippet: '<three-scene>{"objects":[{"type":"box","color":5847279}]}</three-scene>' }
];

export function PostEdit({ id }) {
  const isNew = !id || id === 'new';
  const [form, setForm] = useState({
    title: '', content: '', excerpt: '', cover_path: '', status: 'draft', is_public: false
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const p = await api.getPost(id);
        setForm({
          title: p.title, content: p.content, excerpt: p.excerpt || '',
          cover_path: p.cover_path || '',
          status: p.status, is_public: !!p.is_public
        });
      } catch (e) { setError(e.message); }
    })();
  }, [id]);

  // 最近素材：登录用户才有；失败静默（访客/未配置存储时不影响编辑）
  useEffect(() => {
    (async () => {
      try {
        const res = await api.listAssets('?limit=12');
        setRecent(res?.items || []);
      } catch { /* 忽略：无权限或未登录时不显示 */ }
    })();
  }, []);

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  function insert(snippet) {
    set('content', `${form.content}\n${snippet}`);
  }

  // 上传封面：成功后自动写入 cover_path
  async function handleUpload(file) {
    if (!file) return;
    setError(''); setUploading(true); setProgress(0);
    try {
      const asset = await uploadAsset(file, { onProgress: setProgress });
      set('cover_path', asset.public_url);
      setRecent((list) => [asset, ...list].slice(0, 12));
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleUpload(file);
  }

  function copyCover() {
    if (!form.cover_path) return;
    navigator.clipboard?.writeText(form.cover_path).catch(() => setError('复制失败，请手动复制'));
  }

  function insertCoverImage() {
    if (!form.cover_path) return;
    const alt = (form.title || '封面').replace(/"/g, '');
    insert(`<img src="${form.cover_path}" alt="${alt}">`);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const payload = {
        title: form.title,
        content: form.content,
        excerpt: form.excerpt || null,
        cover_path: form.cover_path || null,
        status: form.status,
        is_public: form.is_public
      };
      const saved = isNew ? await api.createPost(payload) : await api.updatePost(id, payload);
      invalidateBlogData();
      route(`/posts/${saved.id}`);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <FormShell
      kicker="Blog"
      title={isNew ? '新建文章' : '编辑文章'}
      sub="正文使用原生 HTML；保存后会回到文章阅读页。"
      error={error}
      busy={busy}
      onSubmit={save}
      actions={<button type="button" onClick={() => setShowPreview((v) => !v)}>{showPreview ? '隐藏预览' : '显示预览'}</button>}
    >
      <FormSection title="文章信息">
        <FormField label="标题" required>
          <input value={form.title} onInput={(e) => set('title', e.currentTarget.value)} required />
        </FormField>
        <FormField label="摘要" hint="可选，用于列表卡片与搜索。">
          <input value={form.excerpt} onInput={(e) => set('excerpt', e.currentTarget.value)} />
        </FormField>
        <FormRow>
          <FormField label="状态" className="form-field-sm">
            <select value={form.status} onChange={(e) => set('status', e.currentTarget.value)}>
              <option value="draft">草稿</option>
              <option value="published">发布</option>
            </select>
          </FormField>
          <FormField label="访客可见" className="form-field-check" inline>
            <input type="checkbox" checked={form.is_public} onChange={(e) => set('is_public', e.currentTarget.checked)} />
            <span>公开</span>
          </FormField>
        </FormRow>
      </FormSection>

      <FormSection title="封面" hint="JPEG / PNG / WebP / AVIF，≤10MB。">
        <div class="form-cover-row">
          {form.cover_path
            ? <img src={form.cover_path} alt="封面预览" class="form-cover-preview" />
            : <div class="form-cover-empty">未设置封面</div>}

          <div class="form-cover-actions">
            <div
              class={`form-drop${dragOver ? ' is-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => document.getElementById('cover-file-input')?.click()}
            >
              {uploading ? `上传中… ${progress}%` : '拖拽图片到此处，或点击选择文件'}
            </div>
            <input
              id="cover-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              class="sr-only"
              onChange={(e) => handleUpload(e.currentTarget.files?.[0])}
            />
            <div class="form-inline-actions">
              <button type="button" disabled={!form.cover_path} onClick={copyCover}>复制图片链接</button>
              <button type="button" disabled={!form.cover_path} onClick={insertCoverImage}>插入到正文</button>
              {form.cover_path && <button type="button" onClick={() => set('cover_path', '')}>清除封面</button>}
            </div>
          </div>
        </div>

        {recent.length > 0 && (
          <div class="form-assets">
            <span class="muted">最近素材（点击设为封面）</span>
            <div class="form-assets-grid">
              {recent.map((a) => (
                <button type="button" key={a.id} class="form-asset" title={a.original_name || ''} onClick={() => set('cover_path', a.public_url)}>
                  <img src={a.public_url} alt={a.original_name || '素材'} loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        )}
      </FormSection>

      <FormSection title="正文" hint="可插入公式、Mermaid、图表与 3D 场景标签。">
        <div class="form-inline-actions">
          <span class="muted">插入标签：</span>
          {TAG_SNIPPETS.map((s) => (
            <button type="button" key={s.label} onClick={() => insert(s.snippet)}>{s.label}</button>
          ))}
        </div>
        <textarea
          class="form-code"
          rows={16}
          placeholder="在此编写原生 HTML 正文…"
          value={form.content}
          onInput={(e) => set('content', e.currentTarget.value)}
        />
      </FormSection>

      {showPreview && (
        <FormSection title="预览">
          <div class="form-preview"><PostRenderer content={form.content} /></div>
        </FormSection>
      )}
    </FormShell>
  );
}
