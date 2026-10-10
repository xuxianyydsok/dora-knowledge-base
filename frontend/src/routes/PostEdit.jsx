// 博客编辑页：新建/编辑文章
// 正文为原生 HTML；提供自定义标签插入按钮与实时预览（预览按需懒加载重型库）
import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api, uploadAsset } from '../lib/api.js';
import { invalidateBlogData } from '../lib/blogData.js';
import { PostRenderer } from '../components/PostRenderer.jsx';

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
    <section class="stack">
      <div class="toolbar">
        <h2 style="margin:0">{isNew ? '新建文章' : '编辑文章'}</h2>
        <span class="spacer" />
        <button onClick={() => setShowPreview((v) => !v)}>{showPreview ? '隐藏预览' : '显示预览'}</button>
      </div>

      {error && <div class="notice danger">{error}</div>}

      <form class="stack" onSubmit={save}>
        <input placeholder="文章标题" value={form.title} onInput={(e) => set('title', e.currentTarget.value)} required />
        <input placeholder="摘要（可选）" value={form.excerpt} onInput={(e) => set('excerpt', e.currentTarget.value)} />

        <div class="card" style="padding:12px">
          <div class="row" style="justify-content:space-between">
            <strong style="font-size:14px">封面</strong>
            <span class="muted" style="font-size:12px">JPEG / PNG / WebP / AVIF，≤10MB</span>
          </div>

          <div class="row" style="align-items:flex-start;gap:12px;margin-top:10px">
            {form.cover_path
              ? <img src={form.cover_path} alt="封面预览" style="width:160px;height:90px;object-fit:cover;border-radius:8px" />
              : <div class="muted" style="width:160px;height:90px;display:flex;align-items:center;justify-content:center;border:1px dashed var(--border);border-radius:8px;font-size:12px">未设置封面</div>}

            <div class="stack" style="flex:1;gap:8px">
              <div
                class="muted"
                style={`padding:14px;border:1px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'};border-radius:8px;text-align:center;font-size:13px;cursor:pointer`}
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
                style="display:none"
                onChange={(e) => handleUpload(e.currentTarget.files?.[0])}
              />
              <div class="row" style="flex-wrap:wrap">
                <button type="button" disabled={!form.cover_path} onClick={copyCover}>复制图片链接</button>
                <button type="button" disabled={!form.cover_path} onClick={insertCoverImage}>插入到正文</button>
                {form.cover_path && <button type="button" onClick={() => set('cover_path', '')}>清除封面</button>}
              </div>
            </div>
          </div>

          {recent.length > 0 && (
            <div class="stack" style="margin-top:10px;gap:6px">
              <span class="muted" style="font-size:12px">最近素材（点击设为封面）</span>
              <div class="row" style="flex-wrap:wrap;gap:6px">
                {recent.map((a) => (
                  <img
                    key={a.id}
                    src={a.public_url}
                    alt={a.original_name || '素材'}
                    title={a.original_name || ''}
                    onClick={() => set('cover_path', a.public_url)}
                    style="width:72px;height:48px;object-fit:cover;border-radius:6px;cursor:pointer"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div class="row">
          <label class="row" style="gap:6px">
            <input type="checkbox" style="width:auto" checked={form.is_public} onChange={(e) => set('is_public', e.currentTarget.checked)} />
            公开
          </label>
          <select value={form.status} onChange={(e) => set('status', e.currentTarget.value)} style="width:auto">
            <option value="draft">草稿</option>
            <option value="published">发布</option>
          </select>
        </div>

        <div class="row" style="flex-wrap:wrap">
          <span class="muted" style="font-size:13px">插入标签：</span>
          {TAG_SNIPPETS.map((s) => (
            <button type="button" key={s.label} onClick={() => insert(s.snippet)}>{s.label}</button>
          ))}
        </div>

        <textarea
          rows={14}
          placeholder="在此编写原生 HTML 正文，可插入 katex-inline / katex-block / mermaid-chart / chart-2d / three-scene 标签"
          value={form.content}
          onInput={(e) => set('content', e.currentTarget.value)}
          style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px"
        />

        <div class="row">
          <button class="primary" type="submit" disabled={busy}>{busy ? '保存中…' : '保存'}</button>
          <button type="button" onClick={() => history.back()}>取消</button>
        </div>
      </form>

      {showPreview && (
        <div class="card" style="padding:16px">
          <div class="muted" style="margin-bottom:8px">预览</div>
          <PostRenderer content={form.content} />
        </div>
      )}
    </section>
  );
}
