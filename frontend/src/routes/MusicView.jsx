// 歌曲详情页
// 设计取向：参考 Apple Music 的专辑页 —— 封面模糊铺底、大封面 + 信息并列，
// 下方是操作区与「同专辑 / 同歌手」货架；播放交给全局播放器。
import { useEffect, useMemo, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { Icon } from '../components/Icon.jsx';
import { TagChip } from '../components/TagChip.jsx';
import { usePlayer } from '../lib/player.jsx';

import { LoadingState, ErrorState } from '../components/StateView.jsx';
function fmtDuration(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function MusicView({ id }) {
  const [music, setMusic] = useState(null);
  const [all, setAll] = useState([]);
  const [error, setError] = useState('');
  const { music: current, playing, toggle, playQueue } = usePlayer();

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getMusic(id);
        setMusic(data);
        // 取整库：既用于「同歌手/同专辑」货架，也在没有同源曲目时兜底显示库内其它歌曲
        const list = await api.listMusic();
        setAll(list || []);
      } catch (e) { setError(e.message); }
    })();
  }, [id]);

  const isCurrent = current?.id === music?.id;
  const siblings = useMemo(() => all.filter((m) => m.id !== id && (
    (m.track?.artist && m.track.artist === music?.track?.artist)
    || (m.track?.album && m.track.album === music?.track?.album)
  )).slice(0, 12), [all, id, music]);
  const others = useMemo(() => all.filter((m) => m.id !== id).slice(0, 12), [all, id]);

  if (error) return <ErrorState title="曲目加载失败" message={error} />;
  if (!music) return <LoadingState shape="album" count={4} />;

  const t = music.track || {};
  const md = music.metadata || {};
  const cover = t.artwork_url || music.cover_path;
  const isPreview = (t.quality || 'full') === 'preview';
  // 有同歌手/同专辑就放「接下来播放」，否则退回库内其它歌曲 —— 避免单曲详情页下半屏全空
  const nextUp = siblings.length ? siblings : others;
  const secondary = siblings.length ? '接下来播放' : '音乐库其它歌曲';

  // 音质来自 resources.metadata（bitrate/format 在收藏时写入），不在 music_tracks 里
  const lossless = md.format === 'flac' || (md.bitrate || 0) >= 900;
  const qualityText = isPreview
    ? '试听片段'
    : (lossless ? `无损${md.format === 'flac' ? ' · FLAC' : ''}${md.bitrate ? ` · ${md.bitrate}kbps` : ''}` : '完整音轨');

  // 只保留有数据的行：数据稀疏时「——」堆叠反而显空
  const infoRows = [
    ['歌手', t.artist || ''],
    ['专辑', t.album || ''],
    ['时长', t.duration ? fmtDuration(t.duration) : ''],
    ['发行年份', t.release_year || ''],
    ['流派', t.genre || ''],
    ['音质', qualityText],
    ['加入时间', music.created_at ? new Date(music.created_at).toLocaleDateString('zh-CN') : '']
  ].filter(([, v]) => v);

  return (
    <article class="song-page">
      <div class="song-bar">
        <button class="np-icon" onClick={() => route('/music')} title="返回音乐库">
          <Icon name="chevronLeft" size={18} />
        </button>
        <a class="crumb" href="/music">音乐库</a>
        <Icon name="chevronRight" size={13} class="crumb-sep" />
        <span class="crumb-current">{music.title}</span>
      </div>

      <section class="song-hero">
        {cover && <div class="song-backdrop" style={`background-image:url(${cover})`} />}
        <div class="song-veil" />
        <div class="song-body">
          <div class={`song-art${isCurrent && playing ? ' playing' : ''}`}>
            {cover
              ? <img src={cover} alt={music.title} />
              : <span class="np-art-empty"><Icon name="music" size={44} /></span>}
          </div>

          <div class="song-info">
            <span class="song-kicker">{t.album ? '专辑曲目' : '单曲'}</span>
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
              {music.url_stale && (
                <span class="muted" style="font-size:12px">
                  音源可能已过期，点播放会自动重新解析
                </span>
              )}
              <button
                class="primary"
                onClick={() => {
                  if (isCurrent) toggle();
                  else playQueue([music, ...nextUp], 0);
                }}
              >
                <Icon name={isCurrent && playing ? 'pause' : 'play'} size={16} />
                {isCurrent && playing ? '暂停' : '播放'}
              </button>
              <button onClick={() => route(`/music/${music.id}/lyrics`)}>
                <Icon name="lyrics" size={15} /> 同步歌词
              </button>
              <button onClick={() => route(`/music/${music.id}/edit`)}>
                <Icon name="settings" size={15} /> 编辑
              </button>
              {music.tags?.map((tag) => <TagChip key={tag.id} name={tag.name} color={tag.color} />)}
            </div>
          </div>
        </div>
      </section>

      <div class="song-cols">
        <section class="panel">
          <div class="panel-head"><h2>歌曲信息</h2></div>
          <dl class="info-list">
            {infoRows.map(([k, v]) => (
              <div key={k} class="info-row">
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {music.summary && <p class="info-note">{music.summary}</p>}
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>{secondary}</h2>
            {nextUp.length > 0 && <span class="muted">{nextUp.length} 首</span>}
          </div>
          {nextUp.length > 0 ? (
            <div class="track-list">
              {nextUp.map((m, i) => {
                const st = m.track || {};
                return (
                  <button key={m.id} type="button" class="track-row" onClick={() => playQueue([music, ...nextUp], i + 1)}>
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
          ) : (
            <div class="empty-state">
              <Icon name="music" size={22} />
              <p>音乐库还只有这一首</p>
              <span>去音乐库搜索并收藏几首，这里就会出现「接下来播放」。</span>
              <button class="primary" onClick={() => route('/music')}>去音乐库</button>
            </div>
          )}
        </section>
      </div>
    </article>
  );
}
