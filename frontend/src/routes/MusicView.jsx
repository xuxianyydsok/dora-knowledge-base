// 音乐详情页：封面、元信息、播放器、标签、备注、歌词
import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { AudioPlayer } from '../components/AudioPlayer.jsx';
import { TagChip } from '../components/TagChip.jsx';
import { Icon } from '../components/Icon.jsx';

export function MusicView({ id }) {
  const [music, setMusic] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try { setMusic(await api.getMusic(id)); }
      catch (e) { setError(e.message); }
    })();
  }, [id]);

  if (error) return <div class="center-box" style="color:var(--danger)">{error}</div>;
  if (!music) return <div class="center-box">加载中…</div>;

  const t = music.track || {};
  const cover = t.artwork_url || music.cover_path;

  return (
    <article class="stack">
      <div class="toolbar">
        <button onClick={() => route('/music')}><Icon name="arrowLeft" size={15} /> 返回列表</button>
        <span class="spacer" />
        <button onClick={() => route(`/music/${music.id}/edit`)}>编辑</button>
      </div>

      <div class="row" style="gap:20px;align-items:flex-start;flex-wrap:wrap">
        {cover
          ? <img src={cover} alt={music.title} style="width:200px;height:200px;object-fit:cover;border-radius:var(--radius)" />
          : <div class="card-cover-placeholder" style="width:200px;height:200px;border-radius:var(--radius)"><Icon name="music" size={34} /></div>}
        <div class="stack" style="flex:1;min-width:260px">
          <h1 style="margin:0">{music.title}</h1>
          <div class="muted">
            {t.artist}{t.album ? ` · ${t.album}` : ''}{t.release_year ? ` · ${t.release_year}` : ''}
          </div>
          <div class="row" style="gap:10px;flex-wrap:wrap">
            {t.genre && <span class="tag-chip chip-icon"><Icon name="music" size={12} />{t.genre}</span>}
            {t.duration && <span class="tag-chip chip-icon"><Icon name="clock" size={12} />{Math.floor(t.duration / 60)}:{String(t.duration % 60).padStart(2, '0')}</span>}
            <span class={`quality-tag${(t.quality || 'full') === 'full' ? ' quality-full' : ' quality-preview'}`}>
              <Icon name={(t.quality || 'full') === 'full' ? 'sparkles' : 'preview'} size={12} />
              {(t.quality || 'full') === 'full' ? '完整音轨' : '试听片段'}
            </span>
            {music.tags?.map((tag) => <TagChip key={tag.id} name={tag.name} color={tag.color} />)}
          </div>
          <button class="primary" onClick={() => route(`/music/${music.id}/lyrics`)} style="width:fit-content">
            <Icon name="lyrics" size={15} /> 查看同步歌词
          </button>
        </div>
      </div>

      <div class="card" style="padding:16px">
        <AudioPlayer music={music} />
      </div>

      {music.summary && (
        <section class="stack">
          <h3 style="margin:0">备注</h3>
          <p class="muted" style="white-space:pre-wrap">{music.summary}</p>
        </section>
      )}

      {t.lyrics && (
        <section class="stack">
          <h3 style="margin:0">歌词</h3>
          <pre style="white-space:pre-wrap;font-family:inherit;color:var(--text-muted)">{t.lyrics}</pre>
        </section>
      )}
    </article>
  );
}
