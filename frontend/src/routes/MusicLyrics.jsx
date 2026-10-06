// 音乐歌词页：黑胶唱片 + 逐句同步高亮歌词（随播放自动滚动）
// 歌词来源：LRCLIB（带 [mm:ss.xx] 时间轴的同步歌词），无时间轴时退化为静态歌词
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { AudioPlayer } from '../components/AudioPlayer.jsx';
import { Icon } from '../components/Icon.jsx';

// 解析 LRC 文本为 [{ time, text }]，忽略纯空白行但保留时间轴
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
  const [position, setPosition] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const lineRefs = useRef([]);
  const boxRef = useRef(null);

  useEffect(() => {
    (async () => {
      try { setMusic(await api.getMusic(id)); }
      catch (e) { setError(e.message); }
    })();
  }, [id]);

  // 拿到歌曲信息后再请求歌词（title + artist 是必需参数）
  useEffect(() => {
    if (!music) return;
    const t = music.track || {};
    if (!music.title || !t.artist) {
      setLyricsError('该歌曲缺少歌手信息，无法匹配歌词');
      return;
    }
    (async () => {
      try {
        setLyrics(await api.getMusicLyrics({
          title: music.title,
          artist: t.artist,
          album: t.album || null,
          duration: t.duration || null
        }));
      } catch (e) { setLyricsError(e.message); }
    })();
  }, [music?.id]);

  const lines = useMemo(() => parseLrc(lyrics?.synced), [lyrics]);

  // 当前行：最后一个时间轴已到达的行
  const activeIndex = useMemo(() => {
    if (!lines.length) return -1;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= position + 0.25) idx = i;
      else break;
    }
    return idx;
  }, [lines, position]);

  // 自动滚动到当前行（居中）
  useEffect(() => {
    if (!autoScroll || activeIndex < 0) return;
    const el = lineRefs.current[activeIndex];
    const box = boxRef.current;
    if (!el || !box) return;
    box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' });
  }, [activeIndex, autoScroll]);

  // 用户手动滚动时暂停自动跟随，5 秒后恢复
  function onUserScroll() {
    if (!autoScroll) return;
    setAutoScroll(false);
    clearTimeout(onUserScroll.timer);
    onUserScroll.timer = setTimeout(() => setAutoScroll(true), 5000);
  }

  if (error) return <div class="center-box" style="color:var(--danger)">{error}</div>;
  if (!music) return <div class="center-box">加载中…</div>;

  const t = music.track || {};
  const plain = lyrics?.plain ? String(lyrics.plain).split('\n') : [];

  return (
    <article class="stack">
      <div class="toolbar">
        <button onClick={() => route(`/music/${music.id}`)}><Icon name="arrowLeft" size={15} /> 返回详情</button>
        <span class="spacer" />
        <button onClick={() => route(`/music/${music.id}/edit`)}>编辑</button>
      </div>

      <div class="card" style="padding:18px">
        <AudioPlayer music={music} onProgress={setPosition} />
      </div>

      <section class="lyrics-panel">
        <div class="lyrics-head">
          <h3 style="margin:0">
            <Icon name="lyrics" size={17} /> 歌词
          </h3>
          {lines.length > 0 && (
            <button
              class={autoScroll ? 'primary' : ''}
              onClick={() => setAutoScroll((v) => !v)}
              title="是否随播放自动滚动"
            >
              {autoScroll ? '自动跟随中' : '已暂停跟随'}
            </button>
          )}
        </div>

        {lyricsError && <p class="muted">{lyricsError}</p>}
        {!lyricsError && !lyrics && <p class="muted">歌词加载中…</p>}
        {lyrics?.instrumental && <p class="muted">该曲目为纯音乐，暂无歌词。</p>}

        {/* 同步歌词：逐句高亮 + 自动滚动 */}
        {lines.length > 0 && (
          <div class="lyrics-scroll" ref={boxRef} onWheel={onUserScroll} onTouchMove={onUserScroll}>
            {lines.map((l, i) => (
              <p
                key={`${l.time}-${i}`}
                ref={(el) => { lineRefs.current[i] = el; }}
                class={`lyric-line${i === activeIndex ? ' active' : ''}${i < activeIndex ? ' passed' : ''}`}
                onClick={() => setPosition(l.time)}
              >
                {l.text || '♪'}
              </p>
            ))}
          </div>
        )}

        {/* 无时间轴时退化为静态歌词 */}
        {lines.length === 0 && plain.length > 0 && (
          <div class="lyrics-scroll">
            {plain.map((line, i) => <p key={i} class="lyric-line static">{line || '♪'}</p>)}
          </div>
        )}

        {lyrics && lines.length === 0 && plain.length === 0 && !lyrics.instrumental && (
          <p class="muted">未找到歌词内容。</p>
        )}

        {lyrics && (
          <p class="muted" style="font-size:12px;margin:8px 0 0">
            歌词来源：{lyrics.source}
            {lines.length > 0 ? '（含时间轴，随播放同步高亮）' : '（无时间轴，静态展示）'}
          </p>
        )}
      </section>

      {t.artist && (
        <section class="stack" style="gap:6px">
          <h3 style="margin:0">关于歌手</h3>
          <div class="row" style="gap:12px">
            {t.artist_avatar
              ? <img src={t.artist_avatar} alt={t.artist} class="artist-avatar" />
              : <span class="artist-avatar artist-avatar-empty"><Icon name="music" size={22} /></span>}
            <div class="stack" style="gap:2px">
              <strong>{t.artist}</strong>
              {t.album && <span class="muted" style="font-size:13px">专辑：{t.album}</span>}
              {t.release_year && <span class="muted" style="font-size:13px">发行年份：{t.release_year}</span>}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
