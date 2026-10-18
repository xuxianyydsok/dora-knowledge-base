// 音乐编辑页：新建 / 编辑
import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { EmptyState } from '../components/StateView.jsx';
import { Icon } from '../components/Icon.jsx';
import { FormField, FormRow, FormSection, FormShell } from '../components/FormShell.jsx';

export function MusicEdit({ id }) {
  const isNew = !id || id === 'new';
  // 手动录入属于站长操作（2026-10-13 用户要求：「在用户端的话是不能看到那个音乐导入的」）。
  // 前端按钮已经只对站长渲染，这里再拦一道，避免普通用户直接敲 /music/new。
  const { isAdmin, loading: authLoading } = useAuth();
  const [form, setForm] = useState({
    title: '', artist: '', album: '', artwork_url: '', artist_avatar: '', audio_url: '',
    audio_fallbacks: '', preview_url: '', quality: 'full', duration: '', genre: '', release_year: '',
    notes: '', lyrics: ''
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
          artwork_url: t.artwork_url || m.cover_path || '', artist_avatar: t.artist_avatar || '',
          audio_url: t.audio_url || '',
          audio_fallbacks: Array.isArray(t.audio_fallbacks) ? t.audio_fallbacks.join('\n') : '',
          preview_url: t.preview_url || '', quality: t.quality || 'full', duration: t.duration ?? '',
          genre: t.genre || '', release_year: t.release_year ?? '',
          notes: t.notes || m.summary || '', lyrics: t.lyrics || ''
        });
      } catch (e) { setError(e.message); }
    })();
  }, [id]);

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  if (!authLoading && !isAdmin) {
    return (
      <EmptyState
        icon="crown"
        title="只有站长能录入音乐"
        hint="音乐录入是站点管理操作。想收藏歌曲的话，直接在音乐页搜索后点收藏即可。"
        action={<a class="btn primary" href="/music"><Icon name="music" size={15} />去音乐页</a>}
      />
    );
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const payload = {
        title: form.title,
        artist: form.artist || null,
        album: form.album || null,
        artwork_url: form.artwork_url || null,
        artist_avatar: form.artist_avatar || null,
        audio_url: form.audio_url || null,
        audio_fallbacks: form.audio_fallbacks
          ? String(form.audio_fallbacks).split('\n').map((s) => s.trim()).filter(Boolean)
          : null,
        preview_url: form.preview_url || null,
        quality: form.quality,
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
    <FormShell
      kicker="Music"
      title={isNew ? '添加音乐' : '编辑音乐'}
      sub="曲目信息、封面与播放地址。保存后会回到详情页。"
      error={error}
      busy={busy}
      onSubmit={save}
    >
      <FormSection title="基本信息">
        <FormField label="歌曲名称" required>
          <input value={form.title} onInput={(e) => set('title', e.currentTarget.value)} required />
        </FormField>
        <FormRow>
          <FormField label="歌手">
            <input value={form.artist} onInput={(e) => set('artist', e.currentTarget.value)} />
          </FormField>
          <FormField label="专辑">
            <input value={form.album} onInput={(e) => set('album', e.currentTarget.value)} />
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label="流派">
            <input value={form.genre} onInput={(e) => set('genre', e.currentTarget.value)} />
          </FormField>
          <FormField label="发行年份" className="form-field-sm">
            <input type="number" value={form.release_year} onInput={(e) => set('release_year', e.currentTarget.value)} />
          </FormField>
          <FormField label="时长（秒）" className="form-field-sm">
            <input type="number" value={form.duration} onInput={(e) => set('duration', e.currentTarget.value)} />
          </FormField>
          <FormField label="音质" className="form-field-sm">
            <select value={form.quality} onChange={(e) => set('quality', e.currentTarget.value)}>
              <option value="full">完整音轨</option>
              <option value="preview">试听片段</option>
            </select>
          </FormField>
        </FormRow>
      </FormSection>

      <FormSection title="封面与播放" hint="外链必须是可以直接访问的媒体地址。">
        <FormField label="封面链接">
          <input value={form.artwork_url} onInput={(e) => set('artwork_url', e.currentTarget.value)} placeholder="https://..." />
        </FormField>
        <FormField label="歌手头像">
          <input value={form.artist_avatar} onInput={(e) => set('artist_avatar', e.currentTarget.value)} placeholder="https://..." />
        </FormField>
        <FormField label="播放地址" hint="完整音轨优先；网页地址不会保存。">
          <input value={form.audio_url} onInput={(e) => set('audio_url', e.currentTarget.value)} placeholder="https://..." />
        </FormField>
        <FormField label="备用播放地址" hint="每行一个，主地址失败时依次尝试。">
          <textarea rows={3} value={form.audio_fallbacks} onInput={(e) => set('audio_fallbacks', e.currentTarget.value)} placeholder="https://..." />
        </FormField>
        <FormField label="试听片段">
          <input value={form.preview_url} onInput={(e) => set('preview_url', e.currentTarget.value)} placeholder="https://..." />
        </FormField>
      </FormSection>

      <FormSection title="补充信息">
        <FormField label="备注">
          <textarea rows={3} value={form.notes} onInput={(e) => set('notes', e.currentTarget.value)} />
        </FormField>
        <FormField label="歌词" hint="支持 LRC 时间轴格式；留空则自动匹配。">
          <textarea rows={6} value={form.lyrics} onInput={(e) => set('lyrics', e.currentTarget.value)} />
        </FormField>
      </FormSection>
    </FormShell>
  );
}
