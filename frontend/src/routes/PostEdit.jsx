// 博客编辑页：新建/编辑文章
// 正文为原生 HTML；提供自定义标签插入按钮与实时预览（预览按需懒加载重型库）
import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
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
  const [form, setForm] = useState({ title: '', content: '', excerpt: '', status: 'draft', is_public: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const p = await api.getPost(id);
        setForm({
          title: p.title, content: p.content, excerpt: p.excerpt || '',
          status: p.status, is_public: !!p.is_public
        });
      } catch (e) { setError(e.message); }
    })();
  }, [id]);

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  function insert(snippet) {
    set('content', `${form.content}\n${snippet}`);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const payload = {
        title: form.title,
        content: form.content,
        excerpt: form.excerpt || null,
        status: form.status,
        is_public: form.is_public
      };
      const saved = isNew ? await api.createPost(payload) : await api.updatePost(id, payload);
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

      {error && <p style="color:var(--danger)">{error}</p>}

      <form class="stack" onSubmit={save}>
        <input placeholder="文章标题" value={form.title} onInput={(e) => set('title', e.currentTarget.value)} required />
        <input placeholder="摘要（可选）" value={form.excerpt} onInput={(e) => set('excerpt', e.currentTarget.value)} />

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
