// 影视编辑页：新建 / 编辑
import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';

export function MovieEdit({ id }) {
  const isNew = !id || id === 'new';
  const [form, setForm] = useState({
    title: '', media_type: 'movie', original_title: '', director: '', cast_list: '',
    genres: '', release_date: '', runtime: '', rating: '', overview: '',
    poster_url: '', backdrop_url: '', url: '', source: 'manual', notes: ''
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const m = await api.getMovie(id);
        const t = m.title_info || {};
        setForm({
          title: m.title || '', media_type: t.media_type || 'movie',
          original_title: t.original_title || '', director: t.director || '',
          cast_list: t.cast_list || '', genres: t.genres || '',
          release_date: t.release_date || '', runtime: t.runtime ?? '',
          rating: t.rating ?? '', overview: t.overview || '',
          poster_url: t.poster_url || m.cover_path || '', backdrop_url: t.backdrop_url || '',
          url: m.url || '', source: t.source || m.source || 'manual', notes: t.notes || m.summary || ''
        });
      } catch (e) { setError(e.message); }
    })();
  }, [id]);

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  async function save(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const payload = {
        title: form.title,
        media_type: form.media_type,
        original_title: form.original_title || null,
        director: form.director || null,
        cast_list: form.cast_list || null,
        genres: form.genres || null,
        release_date: form.release_date || null,
        runtime: form.runtime === '' ? null : Number(form.runtime),
        rating: form.rating === '' ? null : Number(form.rating),
        overview: form.overview || null,
        poster_url: form.poster_url || null,
        backdrop_url: form.backdrop_url || null,
        url: form.url || null,
        source: form.source || 'manual',
        notes: form.notes || null
      };
      const saved = isNew ? await api.createMovie(payload) : await api.updateMovie(id, payload);
      route(`/movies/${saved.id}`);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <section class="stack">
      <div class="toolbar">
        <h2 style="margin:0">{isNew ? '添加影视' : '编辑影视'}</h2>
      </div>
      {error && <p style="color:var(--danger)">{error}</p>}

      <form class="stack" onSubmit={save}>
        <div class="row" style="gap:12px;flex-wrap:wrap">
          <label style="flex:2;min-width:220px">名称 *<input value={form.title} onInput={(e) => set('title', e.currentTarget.value)} required /></label>
          <label style="width:140px">类型
            <select value={form.media_type} onChange={(e) => set('media_type', e.currentTarget.value)}>
              <option value="movie">电影</option>
              <option value="tv">剧集</option>
            </select>
          </label>
        </div>
        <div class="row" style="gap:12px;flex-wrap:wrap">
          <label style="flex:1;min-width:200px">原名<input value={form.original_title} onInput={(e) => set('original_title', e.currentTarget.value)} /></label>
          <label style="flex:1;min-width:200px">类型/流派<input value={form.genres} onInput={(e) => set('genres', e.currentTarget.value)} placeholder="剧情, 科幻" /></label>
        </div>
        <div class="row" style="gap:12px;flex-wrap:wrap">
          <label style="flex:1;min-width:200px">导演<input value={form.director} onInput={(e) => set('director', e.currentTarget.value)} /></label>
          <label style="flex:2;min-width:240px">主演<input value={form.cast_list} onInput={(e) => set('cast_list', e.currentTarget.value)} placeholder="逗号分隔" /></label>
        </div>
        <div class="row" style="gap:12px;flex-wrap:wrap">
          <label style="width:170px">上映日期<input type="date" value={form.release_date} onInput={(e) => set('release_date', e.currentTarget.value)} /></label>
          <label style="width:140px">时长(分钟)<input type="number" value={form.runtime} onInput={(e) => set('runtime', e.currentTarget.value)} /></label>
          <label style="width:140px">评分(0-10)<input type="number" step="0.1" value={form.rating} onInput={(e) => set('rating', e.currentTarget.value)} /></label>
        </div>
        <label>海报链接<input value={form.poster_url} onInput={(e) => set('poster_url', e.currentTarget.value)} placeholder="https://..." /></label>
        <label>背景图链接<input value={form.backdrop_url} onInput={(e) => set('backdrop_url', e.currentTarget.value)} placeholder="https://..." /></label>
        <label>播放地址<input value={form.url} onInput={(e) => set('url', e.currentTarget.value)} placeholder="https://...（视频外链，前端直接播放）" /></label>
        <label>简介<textarea rows={4} value={form.overview} onInput={(e) => set('overview', e.currentTarget.value)} /></label>
        <label>备注<textarea rows={3} value={form.notes} onInput={(e) => set('notes', e.currentTarget.value)} /></label>

        <div class="row">
          <button class="primary" type="submit" disabled={busy}>{busy ? '保存中…' : '保存'}</button>
          <button type="button" onClick={() => history.back()}>取消</button>
        </div>
      </form>
    </section>
  );
}
