// 音乐编辑页：新建 / 编辑
import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';

export function MusicEdit({ id }) {
  const isNew = !id || id === 'new';
  const [form, setForm] = useState({
    title: '', artist: '', album: '', artwork_url: '', audio_url: '',
    preview_url: '', duration: '', genre: '', release_year: '', notes: '', lyrics: ''
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const m = await api.getMusic(id);
        const t = m.track || {};
        setForm({
          title: m.title || '', artist: t.artist || '', album: t.album || '',
          artwork_url: t.artwork_url || m.cover_path || '', audio_url: t.audio_url || '',
          preview_url: t.preview_url || '', duration: t.duration ?? '',
          genre: t.genre || '', release_year: t.release_year ?? '',
          notes: t.notes || m.summary || '', lyrics: t.lyrics || ''
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
        artist: form.artist || null,
        album: form.album || null,
        artwork_url: form.artwork_url || null,
        audio_url: form.audio_url || null,
        preview_url: form.preview_url || null,
        duration: form.duration === '' ? null : Number(form.duration),
        genre: form.genre || null,
        release_year: form.release_year === '' ? null : Number(form.release_year),
        notes: form.notes || null,
        lyrics: form.lyrics || null
      };
      const saved = isNew ? await api.createMusic(payload) : await api.updateMusic(id, payload);
      route(`/music/${saved.id}`);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <section class="stack">
      <div class="toolbar">
        <h2 style="margin:0">{isNew ? '添加音乐' : '编辑音乐'}</h2>
      </div>
      {error && <p style="color:var(--danger)">{error}</p>}

      <form class="stack" onSubmit={save}>
        <label>歌曲名称 *<input value={form.title} onInput={(e) => set('title', e.currentTarget.value)} required /></label>
        <div class="row" style="gap:12px;flex-wrap:wrap">
          <label style="flex:1;min-width:200px">歌手<input value={form.artist} onInput={(e) => set('artist', e.currentTarget.value)} /></label>
          <label style="flex:1;min-width:200px">专辑<input value={form.album} onInput={(e) => set('album', e.currentTarget.value)} /></label>
        </div>
        <div class="row" style="gap:12px;flex-wrap:wrap">
          <label style="flex:1;min-width:160px">流派<input value={form.genre} onInput={(e) => set('genre', e.currentTarget.value)} /></label>
          <label style="width:140px">发行年份<input type="number" value={form.release_year} onInput={(e) => set('release_year', e.currentTarget.value)} /></label>
          <label style="width:140px">时长(秒)<input type="number" value={form.duration} onInput={(e) => set('duration', e.currentTarget.value)} /></label>
        </div>
        <label>封面链接<input value={form.artwork_url} onInput={(e) => set('artwork_url', e.currentTarget.value)} placeholder="https://..." /></label>
        <label>播放地址<input value={form.audio_url} onInput={(e) => set('audio_url', e.currentTarget.value)} placeholder="https://...（音频外链）" /></label>
        <label>试听片段<input value={form.preview_url} onInput={(e) => set('preview_url', e.currentTarget.value)} placeholder="https://..." /></label>
        <label>备注<textarea rows={3} value={form.notes} onInput={(e) => set('notes', e.currentTarget.value)} /></label>
        <label>歌词<textarea rows={6} value={form.lyrics} onInput={(e) => set('lyrics', e.currentTarget.value)} /></label>

        <div class="row">
          <button class="primary" type="submit" disabled={busy}>{busy ? '保存中…' : '保存'}</button>
          <button type="button" onClick={() => history.back()}>取消</button>
        </div>
      </form>
    </section>
  );
}
