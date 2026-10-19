// 歌词页（沉浸式 · 双栏）
// 设计取向：左侧黑胶专辑图（播放时缓慢自转 + 光晕），右侧逐句歌词。
// 歌词分三档：未唱（清晰但低饱和）/ 已唱（主题色）/ 当前行（逐字填充）。
// 当前行的填充宽度由播放时间与下一句时间差实时计算，跟随歌手节奏推进。
// 随播放自动居中滚动，点击任意行跳转播放位置。
// 样式集中在 ../styles/lyrics.css（不改 global.css）。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { Icon } from '../components/Icon.jsx';
import { FavoriteButton } from '../components/FavoriteButton.jsx';
import { usePlayer } from '../lib/player.jsx';

import { ErrorState } from '../components/StateView.jsx';
import '../styles/lyrics.css';

// 已唱行不再「越早越淡」：颜色本身就是完成态，过淡会让用户分不清
// “唱过”与“没唱”。只保留很轻微的层次，最近唱过的略亮。
const PASS_MIN = 82;
const PASS_MAX = 100;
function passOpacity(i, activeIndex) {
  if (activeIndex <= 0) return `${PASS_MAX}%`;
  const dist = (activeIndex - i) / activeIndex;
  const pct = Math.max(PASS_MIN, PASS_MAX - dist * (PASS_MAX - PASS_MIN));
  return `${pct.toFixed(1)}%`;
}
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
  const programmaticScrollUntilRef = useRef(0);
  const userScrollTimerRef = useRef(null);
  const {
    music: current, position, duration, playing, toggle, seek, playOne,
    hasPrev, hasNext, prev, next
  } = usePlayer();

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

  // 当前句的填充比例：从本句开始时间推进到下一句开始时间。
  // 没有下一句时用当前句时长与 4 秒的较小值，避免最后一句突然全亮。
  const activeFill = useMemo(() => {
    if (activeIndex < 0 || !playing) return 0;
    const line = lines[activeIndex];
    const next = lines[activeIndex + 1];
    const end = next ? next.time : line.time + Math.min(4, Math.max(1.5, (duration || 0) - line.time));
    const span = Math.max(0.4, end - line.time);
    return Math.max(0, Math.min(1, (position - line.time) / span));
  }, [activeIndex, lines, position, duration, playing]);

  // 当前行居中滚动
  useEffect(() => {
    if (!autoScroll || activeIndex < 0) return;
    const el = lineRefs.current[activeIndex];
    const box = boxRef.current;
    if (!el || !box) return;
    const top = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
    if (typeof box.scrollTo === 'function') {
      programmaticScrollUntilRef.current = Date.now() + 650;
      try {
        box.scrollTo({ top, behavior: 'smooth' });
      } catch {
        box.scrollTop = top;
      }
    } else {
      box.scrollTop = top;
    }
  }, [activeIndex, autoScroll]);

  function onUserScroll() {
    // 自动居中本身也会触发 scroll；只有用户手势才应暂停跟随。
    if (Date.now() < programmaticScrollUntilRef.current) return;
    if (!autoScroll) return;
    setAutoScroll(false);
    clearTimeout(userScrollTimerRef.current);
    userScrollTimerRef.current = setTimeout(() => setAutoScroll(true), 5000);
  }

  useEffect(() => () => clearTimeout(userScrollTimerRef.current), []);

  if (error) return <ErrorState title="歌词加载失败" message={error} />;
  if (!music) {
    return (
      <section class="lyric-page lyric-loading">
        <div class="np-veil" />
        <div class="lyric-loading-card" role="status" aria-live="polite">
          <span class="lyric-loading-disc" aria-hidden="true"><i /></span>
          <div>
            <strong>正在打开歌词页</strong>
            <span>读取歌曲与同步歌词…</span>
          </div>
          <span class="lyric-loading-bars" aria-hidden="true"><i /><i /><i /><i /></span>
        </div>
      </section>
    );
  }

  const t = music.track || {};
  const cover = t.artwork_url || music.cover_path;
  const plain = lyrics?.plain ? String(lyrics.plain).split('\n') : [];
  const hasSynced = lines.length > 0;
  // 播放进度：进度条 + 两侧时间。duration 优先用播放器实测值（第三方元信息常缺时长）
  const total = duration || t.duration || 0;
  const pct = total > 0 ? Math.min(100, (position / total) * 100) : 0;
  function fmt(sec) {
    if (!Number.isFinite(sec) || sec <= 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  return (
    <section class="lyric-page">
      {cover && <div class="lyric-backdrop" style={`background-image:url(${cover})`} />}
      <div class="np-veil" />

      <div class="np-bar">
        <button class="np-icon" onClick={() => (history.length > 1 ? history.back() : route(`/music/${music.id}`))} title="返回">
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
        {/* 左：会转的黑胶封面 + 完整播放控制（用户要求：点击头像进来后这里要有收藏等按钮） */}
        <aside class="lyric-side">
          {/* 黑胶：转盘 + 中心封面。playing 时转动，暂停即停（保留角度，不闪回） */}
          <div class="lyr-art">
            <div class={`vinyl lp${playing ? ' spinning' : ''}`}>
              <div class="vinyl-disc">
                <span class="vinyl-grooves" />
                <div class="vinyl-cover">
                  {cover
                    ? <img src={cover} alt={music.title} referrerpolicy="no-referrer" />
                    : <span class="np-art-empty"><Icon name="music" size={32} /></span>}
                </div>
                <span class="vinyl-hole" />
              </div>
            </div>
            {/* 光晕放在唱片之后：用相邻兄弟选择器跟随 .spinning，无需 :has() */}
            <span class="lyr-glow" aria-hidden="true" />
          </div>
          <div class="lyric-side-text">
            <strong>{music.title}</strong>
            <span>{t.artist}{t.album ? ` · ${t.album}` : ''}</span>
          </div>

          {/* 自定义进度条：圆角轨道 + 主色填充 + 柔和滑块 */}
          <div class="lp-progress">
            <div class="lp-progress-head">
              <span>{fmt(position)}</span>
              <span>{fmt(total)}</span>
            </div>
            <label class="lp-seek">
              <input
                type="range" min={0} max={total || 0} step={1} value={position}
                onInput={(e) => seek(Number(e.currentTarget.value))}
                style={`--pct:${pct}%`}
                aria-label="播放进度"
              />
            </label>
          </div>

          {/* 控制：上一首 / 播放暂停 / 下一首 */}
          <div class="lp-controls">
            <button class="np-icon" onClick={prev} disabled={!hasPrev} title="上一首">
              <Icon name="skipBack" size={18} />
            </button>
            <button class="np-play sm" onClick={toggle} title={playing ? '暂停' : '播放'}>
              <Icon name={playing ? 'pause' : 'play'} size={20} />
            </button>
            <button class="np-icon" onClick={next} disabled={!hasNext} title="下一首">
              <Icon name="skipForward" size={18} />
            </button>
          </div>

          {/* 收藏 + 详情 + 编辑：与详情页操作区一致 */}
          <div class="lp-actions">
            <FavoriteButton resourceId={music.id} />
            <button type="button" class="lp-btn" onClick={() => route(`/music/${music.id}`)}>
              <Icon name="info" size={14} /> 歌曲详情
            </button>
            <button type="button" class="lp-btn" onClick={() => route(`/music/${music.id}/edit`)}>
              <Icon name="settings" size={14} /> 编辑
            </button>
          </div>
        </aside>

        {/* 右：磨砂歌词面板 */}
        <div class="lyric-main">
          <header class="lyric-panel-head">
            <div>
              <span class="lyric-kicker">Lyrics</span>
              <h2>{hasSynced ? '正在同步' : '歌词'}</h2>
            </div>
            <span class={`lyric-sync-dot${playing && hasSynced ? ' on' : ''}`} title={playing ? '播放中' : '已暂停'}>
              <i />{playing && hasSynced ? '跟随中' : '已暂停'}
            </span>
          </header>

          {lyricsError && <p class="lyric-notice danger">{lyricsError}</p>}
          {!lyricsError && !lyrics && (
            <div class="lyric-inline-loading" role="status" aria-live="polite">
              <span class="lyric-inline-bars" aria-hidden="true"><i /><i /><i /><i /></span>
              <span>正在匹配同步歌词…</span>
            </div>
          )}
          {lyrics?.instrumental && <p class="lyric-notice">该曲目为纯音乐，暂无歌词。</p>}

          {hasSynced && (
            <div class="lyrics-scroll tall" ref={boxRef} onWheel={onUserScroll} onTouchMove={onUserScroll} onScroll={onUserScroll}>
              <div class="lyr-spacer" aria-hidden="true" />
              {lines.map((l, i) => {
                const passed = i < activeIndex;
                const active = i === activeIndex;
                return (
                  <p
                    key={`${l.time}-${i}`}
                    ref={(el) => { lineRefs.current[i] = el; }}
                    class={`lyric-line${active ? ' active' : ''}${passed ? ' passed' : ''}`}
                    style={passed ? `--pass:${passOpacity(i, activeIndex)}` : undefined}
                    onClick={() => seek(l.time)}
                    title="点击跳转到这句"
                  >
                    <span class="lyr-text lyr-base">{l.text || '♪'}</span>
                    {active && (
                      <span
                        class="lyr-text lyr-fill"
                        style={`--fill:${(activeFill * 100).toFixed(2)}%`}
                        aria-hidden="true"
                      >{l.text || '♪'}</span>
                    )}
                  </p>
                );
              })}
              <div class="lyr-spacer" aria-hidden="true" />
            </div>
          )}

          {!hasSynced && plain.length > 0 && (
            <div class="lyrics-scroll tall">
              {plain.map((line, i) => (
                <p key={i} class="lyric-line static"><span class="lyr-text">{line || '♪'}</span></p>
              ))}
            </div>
          )}

          {lyrics && !hasSynced && plain.length === 0 && !lyrics.instrumental && (
            <p class="lyric-notice">未找到歌词内容。</p>
          )}

          {lyrics && (
            <footer class="lyric-panel-foot">
              <span>来源 {lyrics.source || '未知'}</span>
              <span>{hasSynced ? '时间轴同步' : '静态歌词'}</span>
            </footer>
          )}
        </div>
      </div>
    </section>
  );
}
