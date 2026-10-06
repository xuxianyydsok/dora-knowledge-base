// 沉浸式「正在播放」页
// 设计取向：参考 Apple Music 的全屏 Now Playing —— 封面模糊铺底、大封面、
// 极简控制区、可展开歌词，让画面随音乐呼吸。
import { useEffect, useMemo, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { usePlayer } from '../lib/player.jsx';
import { Icon } from '../components/Icon.jsx';

function fmt(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function MusicPlayer() {
  const {
    music, track, playing, position, duration, volume,
    hasPrev, hasNext, toggle, next, prev, seek, setVolume, stop, playOne
  } = usePlayer();
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [shelf, setShelf] = useState([]);

  // 直接打开 /play 而没有播放上下文时，拉取音乐库作为「挑一首」的入口
  useEffect(() => {
    if (music) return undefined;
    let active = true;
    api.listMusic().then((list) => { if (active) setShelf((list || []).slice(0, 6)); }).catch(() => {});
    return () => { active = false; };
  }, [music]);

  const cover = track.artwork_url || music?.cover_path || '';
  const pct = duration > 0 ? (position / duration) * 100 : 0;
  const quality = (track.quality || 'full') === 'full' ? '无损 / 完整音轨' : '试听片段';

  // 键盘快捷键：空格播放暂停、左右切歌
  useEffect(() => {
    function onKey(e) {
      if (e.target?.tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      if (e.code === 'ArrowRight') next();
      if (e.code === 'ArrowLeft') prev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, next, prev]);

  if (!music) {
    return (
      <section class="now-playing empty">
        <div class="np-bar">
          <button class="np-icon" onClick={() => route('/music')} title="返回音乐库">
            <Icon name="chevronLeft" size={18} />
          </button>
          <div class="np-bar-title">
            <span>正在播放</span>
            <strong>空闲</strong>
          </div>
          <span class="spacer" />
          <button class="np-icon" onClick={() => route('/music')} title="关闭">
            <Icon name="close" size={17} />
          </button>
        </div>

        <div class="np-empty">
          <span class="np-empty-icon"><Icon name="music" size={26} /></span>
          <h2>还没有正在播放的歌曲</h2>
          <p class="muted">
            {shelf.length ? '从下面挑一首开始，或去音乐库搜索你喜欢的歌。' : '去音乐库搜索并收藏几首歌，这里就能直接续播。'}
          </p>
          <button class="primary" onClick={() => route('/music')}>
            <Icon name="search" size={15} /> 去音乐库
          </button>

          {shelf.length > 0 && (
            <div class="np-shelf">
              {shelf.map((m) => {
                const st = m.track || {};
                const c = st.artwork_url || m.cover_path;
                return (
                  <button key={m.id} type="button" class="np-shelf-card" onClick={() => playOne(m)}>
                    <span class="np-shelf-art">
                      {c ? <img src={c} alt="" loading="lazy" /> : <Icon name="music" size={18} />}
                    </span>
                    <span class="np-shelf-text">
                      <strong>{m.title}</strong>
                      <span>{st.artist || '未知歌手'}</span>
                    </span>
                    <Icon name="play" size={15} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section class={`now-playing${lyricsOpen ? ' lyrics-open' : ''}`}>
      {/* 封面模糊铺底：让整个页面染上专辑色调 */}
      {cover && <div class="np-backdrop" style={`background-image:url(${cover})`} />}
      <div class="np-veil" />

      <div class="np-bar">
        <button class="np-icon" onClick={() => route('/music')} title="返回音乐库">
          <Icon name="chevronLeft" size={18} />
        </button>
        <div class="np-bar-title">
          <span>正在播放</span>
          <strong>{track.album || '未知专辑'}</strong>
        </div>
        <span class="spacer" />
        <button class="np-icon" onClick={() => route(`/music/${music.id}/lyrics`)} title="歌词">
          <Icon name="lyrics" size={17} />
        </button>
        <button class="np-icon" onClick={stop} title="关闭">
          <Icon name="close" size={17} />
        </button>
      </div>

      <div class="np-stage">
        {/* 大封面 */}
        <div class="np-art">
          {cover
            ? <img src={cover} alt={music.title} />
            : <span class="np-art-empty"><Icon name="music" size={52} /></span>}
          <span class={`np-art-glow${playing ? ' on' : ''}`} aria-hidden="true" />
        </div>

        {/* 信息与控制 */}
        <div class="np-info">
          <div class="np-head">
            <h1>{music.title}</h1>
            <p>{track.artist || '未知歌手'}{track.release_year ? ` · ${track.release_year}` : ''}</p>
            <span class={`quality-tag${(track.quality || 'full') === 'full' ? ' quality-full' : ' quality-preview'}`}>
              <Icon name={(track.quality || 'full') === 'full' ? 'sparkles' : 'preview'} size={12} />
              {quality}
            </span>
          </div>

          {/* 进度 */}
          <div class="np-progress">
            <input
              class="np-seek"
              type="range" min={0} max={duration || 0} step={1} value={position}
              onInput={(e) => seek(Number(e.currentTarget.value))}
              style={`--pct:${pct}%`}
              aria-label="播放进度"
            />
            <div class="np-times">
              <span>{fmt(position)}</span>
              <span>-{fmt(Math.max(0, duration - position))}</span>
            </div>
          </div>

          {/* 控制区 */}
          <div class="np-controls">
            <button class="np-icon" title="随机播放（暂未开放）" disabled><Icon name="shuffle" size={18} /></button>
            <button class="np-icon lg" onClick={prev} disabled={!hasPrev} title="上一首">
              <Icon name="skipBack" size={22} />
            </button>
            <button class="np-play" onClick={toggle} title={playing ? '暂停' : '播放'}>
              <Icon name={playing ? 'pause' : 'play'} size={26} />
            </button>
            <button class="np-icon lg" onClick={next} disabled={!hasNext} title="下一首">
              <Icon name="skipForward" size={22} />
            </button>
            <button class="np-icon" title="单曲循环（暂未开放）" disabled><Icon name="repeat" size={18} /></button>
          </div>

          {/* 音量 */}
          <div class="np-volume">
            <Icon name="volume" size={15} />
            <input
              type="range" min={0} max={1} step={0.05} value={volume}
              onInput={(e) => setVolume(Number(e.currentTarget.value))}
              aria-label="音量"
            />
          </div>

          <div class="np-actions">
            <button onClick={() => route(`/music/${music.id}`)}><Icon name="layers" size={15} /> 专辑详情</button>
            <button onClick={() => route(`/music/${music.id}/lyrics`)}><Icon name="lyrics" size={15} /> 同步歌词</button>
          </div>
        </div>
      </div>
    </section>
  );
}
