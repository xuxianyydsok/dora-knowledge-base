// 歌曲详情页
// 设计取向：参考 Apple Music 的专辑页 —— 封面模糊铺底、大封面 + 信息并列，
// 下方是操作区与「同专辑 / 同歌手」货架；播放交给全局播放器。
import { useEffect, useMemo, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { Icon } from '../components/Icon.jsx';
import { TagChip } from '../components/TagChip.jsx';
import { usePlayer } from '../lib/player.jsx';

function fmtDuration(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function MusicView({ id }) {
  const [music, setMusic] = useState(null);
  const [siblings, setSiblings] = useState([]);
  const [error, setError] = useState('');
  const { music: current, playing, toggle, playOne, playQueue, index: curIndex, queue } = usePlayer();

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getMusic(id);
        setMusic(data);
        // 同歌手/同专辑的其它曲目，作为「接下来播放」货架
        const list = await api.listMusic();
        setSiblings(list.filter((m) => m.id !== id && (
          (m.track?.artist && m.track.artist === data.track?.artist)
          || (m.track?.album && m.track.album === data.track?.album)
        )).slice(0, 12));
      } catch (e) { setError(e.message); }
    })();
  }, [id]);

  const isCurrent = current?.id === music?.id;

  if (error) return <div class="center-box" style="color:var(--danger)">{error}</div>;
  if (!music) return <div class="center-box">加载中…</div>;

  const t = music.track || {};
  const cover = t.artwork_url || music.cover_path;
  const isPreview = (t.quality || 'full') === 'preview';

  return (
    <article class="song-page">
      <div class="song-bar">
        <button class="np-icon" onClick={() => route('/music')} title="返回音乐库">
          <Icon name="chevronLeft" size={18} />
        </button>
        <span class="muted">音乐库</span>
        <span class="spacer" />
        <button onClick={() => route(`/music/${music.id}/edit`)}>编辑</button>
      </div>

      <section class="song-hero">
        {cover && <div class="song-backdrop" style={`background-image:url(${cover})`} />}
        <div class="song-body">
          <div class={`song-art${isCurrent && playing ? ' playing' : ''}`}>
            {cover
              ? <img src={cover} alt={music.title} />
              : <span class="np-art-empty"><Icon name="music" size={44} /></span>}
          </div>

          <div class="song-info">
            <span class="song-kicker">单曲</span>
            <h1>{music.title}</h1>
            <p class="song-artist">{t.artist || '未知歌手'}</p>
            <div class="song-meta">
              {t.album && <span>{t.album}</span>}
              {t.release_year && <span>{t.release_year}</span>}
              {t.duration ? <span>{fmtDuration(t.duration)}</span> : null}
              <span class={`quality-tag${isPreview ? ' quality-preview' : ' quality-full'}`}>
                <Icon name={isPreview ? 'preview' : 'sparkles'} size={11} />
                {isPreview ? '试听片段' : '无损 / 完整音轨'}
              </span>
            </div>

            <div class="song-actions">
              <button
                class="primary"
                onClick={() => {
                  if (isCurrent) toggle();
                  else if (queue.length) playQueue([music, ...siblings], 0);
                  else playOne(music);
                }}
              >
                <Icon name={isCurrent && playing ? 'pause' : 'play'} size={16} />
                {isCurrent && playing ? '暂停' : '播放'}
              </button>
              <button onClick={() => route(`/music/${music.id}/lyrics`)}>
                <Icon name="lyrics" size={15} /> 同步歌词
              </button>
              {music.tags?.map((tag) => <TagChip key={tag.id} name={tag.name} color={tag.color} />)}
            </div>
          </div>
        </div>
      </section>

      {music.summary && (
        <section class="shelf">
          <div class="shelf-head"><h2>备注</h2></div>
          <p class="muted" style="white-space:pre-wrap">{music.summary}</p>
        </section>
      )}

      {siblings.length > 0 && (
        <section class="shelf">
          <div class="shelf-head">
            <h2>接下来播放</h2>
            <span class="count">{siblings.length} 首</span>
          </div>
          <div class="track-list">
            {siblings.map((m, i) => {
              const st = m.track || {};
              return (
                <button key={m.id} class="track-row" onClick={() => playQueue([music, ...siblings], i + 1)}>
                  <span class="track-index">{i + 1}</span>
                  <span class="track-cover">
                    {st.artwork_url ? <img src={st.artwork_url} alt="" loading="lazy" /> : <Icon name="music" size={15} />}
                  </span>
                  <span class="track-text">
                    <strong>{m.title}</strong>
                    <span>{st.artist || '未知歌手'}</span>
                  </span>
                  <span class="track-album">{st.album || ''}</span>
                  <span class="track-time">{fmtDuration(st.duration)}</span>
                  <Icon name="play" size={15} />
                </button>
              );
            })}
          </div>
        </section>
      )}
    </article>
  );
}
