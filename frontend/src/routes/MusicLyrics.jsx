// 歌词页（沉浸式 · 双栏）
// 设计取向：左侧黑胶专辑图（播放时缓慢自转 + 光晕），右侧逐句歌词。
// 歌词分三档：未唱（低对比灰）/ 已唱（越早唱过越淡，形成渐隐带）/ 当前行
// （渐变文字 + 流动光带）。随播放自动居中滚动，点击任意行跳转播放位置。
// 样式集中在 ../styles/lyrics.css（不改 global.css）。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { Icon } from '../components/Icon.jsx';
import { FavoriteButton } from '../components/FavoriteButton.jsx';
import { usePlayer } from '../lib/player.jsx';

import { LoadingState, ErrorState } from '../components/StateView.jsx';
import '../styles/lyrics.css';

// 已唱行的「渐隐带」：越早唱过的越淡（40% 最淡，86% 最清晰），
// 越靠近当前行越亮 —— 视线自然被引到当前行。
// 整段都明显高于「未唱行」的 22%，保证「已唱 / 未唱」一眼可辨。
// 注意：color-mix 的百分比必须带单位，所以这里直接返回 "40%" 这种字符串。
const PASS_MIN = 40;
const PASS_MAX = 86;
function passOpacity(i, activeIndex) {
  if (activeIndex <= 0) return `${PASS_MAX}%`;
  const dist = (activeIndex - i) / activeIndex; // 0 = 紧邻当前行，1 = 最早唱过
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

  if (error) return <ErrorState title="歌词加载失败" message={error} />;
  if (!music) return <LoadingState shape="list" count={4} />;

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

          {/* 进度条：点击任意位置跳转 */}
          <div class="lp-seek">
            <span class="lp-time">{fmt(position)}</span>
            <input
              type="range" min={0} max={total || 0} step={1} value={position}
              onInput={(e) => seek(Number(e.currentTarget.value))}
              style={`--pct:${pct}%`}
              aria-label="播放进度"
            />
            <span class="lp-time">{fmt(total)}</span>
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

        {/* 右：歌词 */}
        <div class="lyric-main">
          {lyricsError && <p class="muted">{lyricsError}</p>}
          {!lyricsError && !lyrics && <p class="muted">歌词加载中…</p>}
          {lyrics?.instrumental && <p class="muted">该曲目为纯音乐，暂无歌词。</p>}

          {hasSynced && (
            <div class="lyrics-scroll tall" ref={boxRef} onWheel={onUserScroll} onTouchMove={onUserScroll}>
              <div class="lyr-spacer" aria-hidden="true" />
              {lines.map((l, i) => {
                const passed = i < activeIndex;
                return (
                  <p
                    key={`${l.time}-${i}`}
                    ref={(el) => { lineRefs.current[i] = el; }}
                    class={`lyric-line${i === activeIndex ? ' active' : ''}${passed ? ' passed' : ''}`}
                    style={passed ? `--pass:${passOpacity(i, activeIndex)}` : undefined}
                    onClick={() => seek(l.time)}
                    title="点击跳转到这句"
                  >
                    <span class="lyr-text">{l.text || '♪'}</span>
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
