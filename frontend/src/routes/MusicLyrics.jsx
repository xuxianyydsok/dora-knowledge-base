// 歌词页（沉浸式）
// 设计取向：参考 Apple Music / QQ 音乐的歌词视图 —— 封面铺底、逐句高亮、
// 当前行放大并带光晕，随播放自动居中滚动，点击任意行可跳转播放位置。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { Icon } from '../components/Icon.jsx';
import { usePlayer } from '../lib/player.jsx';

// 解析 LRC：支持 [mm:ss.xx] 与 [mm:ss:xx]，一行多时间戳
function parseLrc(raw) {
  if (!raw) return [];
  const lines = [];
  for (const line of String(raw).split('\n')) {
    const stamps = [...line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (!stamps.length) continue;
    const text = line.replace(/\[[^\]]*\]/g, '').trim();
    for (const s of stamps) {
      const min = Number(s[1]);
      const sec = Number(s[2]);
      const frac = s[3] ? Number(`0.${s[3].padEnd(3, '0')}`) : 0;
      lines.push({ time: min * 60 + sec + frac, text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

export function MusicLyrics({ id }) {
  const [music, setMusic] = useState(null);
  const [lyrics, setLyrics] = useState(null);
  const [error, setError] = useState('');
  const [lyricsError, setLyricsError] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const lineRefs = useRef([]);
  const boxRef = useRef(null);
  const { music: current, position, playing, toggle, seek, playOne } = usePlayer();

  useEffect(() => {
    (async () => {
      try { setMusic(await api.getMusic(id)); }
      catch (e) { setError(e.message); }
    })();
  }, [id]);

  // 进入本页若该曲目不在播放器里，自动接管播放
  useEffect(() => {
    if (music && current?.id !== music.id) playOne(music);
  }, [music?.id]);

  useEffect(() => {
    if (!music) return;
    const t = music.track || {};
    if (!music.title || !t.artist) { setLyricsError('该歌曲缺少歌手信息，无法匹配歌词'); return; }
    (async () => {
      try {
        setLyrics(await api.getMusicLyrics({
          title: music.title, artist: t.artist,
          album: t.album || null, duration: t.duration || null
        }));
      } catch (e) { setLyricsError(e.message); }
    })();
  }, [music?.id]);

  const lines = useMemo(() => parseLrc(lyrics?.synced), [lyrics]);

  const activeIndex = useMemo(() => {
    if (!lines.length) return -1;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= position + 0.25) idx = i;
      else break;
    }
    return idx;
  }, [lines, position]);

  // 当前行居中滚动
  useEffect(() => {
    if (!autoScroll || activeIndex < 0) return;
    const el = lineRefs.current[activeIndex];
    const box = boxRef.current;
    if (!el || !box) return;
    box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' });
  }, [activeIndex, autoScroll]);

  function onUserScroll() {
    if (!autoScroll) return;
    setAutoScroll(false);
    clearTimeout(onUserScroll.timer);
    onUserScroll.timer = setTimeout(() => setAutoScroll(true), 5000);
  }

  if (error) return <div class="center-box" style="color:var(--danger)">{error}</div>;
  if (!music) return <div class="center-box">加载中…</div>;

  const t = music.track || {};
  const cover = t.artwork_url || music.cover_path;
  const plain = lyrics?.plain ? String(lyrics.plain).split('\n') : [];
  const hasSynced = lines.length > 0;

  return (
    <section class="lyric-page">
      {cover && <div class="lyric-backdrop" style={`background-image:url(${cover})`} />}
      <div class="np-veil" />

      <div class="np-bar">
        <button class="np-icon" onClick={() => route(`/music/${music.id}`)} title="返回详情">
          <Icon name="chevronLeft" size={18} />
        </button>
        <div class="np-bar-title">
          <span>{music.title}</span>
          <strong>{t.artist || ''}</strong>
        </div>
        <span class="spacer" />
        {hasSynced && (
          <button class={`np-icon${autoScroll ? ' active' : ''}`} onClick={() => setAutoScroll((v) => !v)}
            title={autoScroll ? '自动跟随中' : '已暂停跟随'}>
            <Icon name="wave" size={17} />
          </button>
        )}
      </div>

      <div class="lyric-stage">
        {/* 左：封面 + 控制 */}
        <aside class="lyric-side">
          <div class={`song-art sm${playing ? ' playing' : ''}`}>
            {cover
              ? <img src={cover} alt={music.title} />
              : <span class="np-art-empty"><Icon name="music" size={32} /></span>}
          </div>
          <div class="lyric-side-text">
            <strong>{music.title}</strong>
            <span>{t.artist}{t.album ? ` · ${t.album}` : ''}</span>
          </div>
          <button class="np-play sm" onClick={toggle} title={playing ? '暂停' : '播放'}>
            <Icon name={playing ? 'pause' : 'play'} size={20} />
          </button>
        </aside>

        {/* 右：歌词 */}
        <div class="lyric-main">
          {lyricsError && <p class="muted">{lyricsError}</p>}
          {!lyricsError && !lyrics && <p class="muted">歌词加载中…</p>}
          {lyrics?.instrumental && <p class="muted">该曲目为纯音乐，暂无歌词。</p>}

          {hasSynced && (
            <div class="lyrics-scroll tall" ref={boxRef} onWheel={onUserScroll} onTouchMove={onUserScroll}>
              {lines.map((l, i) => (
                <p
                  key={`${l.time}-${i}`}
                  ref={(el) => { lineRefs.current[i] = el; }}
                  class={`lyric-line${i === activeIndex ? ' active' : ''}${i < activeIndex ? ' passed' : ''}`}
                  onClick={() => seek(l.time)}
                >
                  {l.text || '♪'}
                </p>
              ))}
            </div>
          )}

          {!hasSynced && plain.length > 0 && (
            <div class="lyrics-scroll tall">
              {plain.map((line, i) => <p key={i} class="lyric-line static">{line || '♪'}</p>)}
            </div>
          )}

          {lyrics && !hasSynced && plain.length === 0 && !lyrics.instrumental && (
            <p class="muted">未找到歌词内容。</p>
          )}

          {lyrics && (
            <p class="lyric-source">
              歌词来源：{lyrics.source}
              {hasSynced ? ' · 含时间轴，随播放同步高亮' : ' · 无时间轴，静态展示'}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
