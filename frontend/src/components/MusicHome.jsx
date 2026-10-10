// 音乐首页（Apple Music 风格，2026-10-09）
//   现在就听（大封面主视觉）→ 排行榜卡片 → 选中榜单的曲目列表 → 新歌速递横滑
// 榜单来自网易云官方榜（后端 /api/music/charts），封面经 /api/img/music 取 600/1000 像素高清图。
// 榜单曲目直接播放、不入库（访客同样可听）；登录后可点「+」收藏进音乐库。
import { useEffect, useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { hdCover } from '../lib/cover.js';
import { Icon } from './Icon.jsx';

const CHARTS = [
  { key: 'hot', name: '热歌榜', tint: 'linear-gradient(135deg,#ff375f,#ff9f0a)' },
  { key: 'new', name: '新歌榜', tint: 'linear-gradient(135deg,#0a84ff,#5e5ce6)' },
  { key: 'soar', name: '飙升榜', tint: 'linear-gradient(135deg,#30d158,#0fb5ae)' },
  { key: 'original', name: '原创榜', tint: 'linear-gradient(135deg,#bf5af2,#ff2d55)' }
];

const chartCache = new Map();
function loadChart(key) {
  if (!chartCache.has(key)) {
    const once = () => api.listMusicChart(key, 50).then((d) => d?.tracks || []);
    chartCache.set(key, once().catch(() => new Promise((r) => setTimeout(r, 800)).then(once)).catch((e) => {
      chartCache.delete(key);
      throw e;
    }));
  }
  return chartCache.get(key);
}

export function MusicHome({ onPlayList, onCollect, canCollect, currentTitle }) {
  const [charts, setCharts] = useState({});
  const [active, setActive] = useState('hot');
  const [error, setError] = useState('');

  useEffect(() => {
    CHARTS.forEach((c) => {
      loadChart(c.key)
        .then((list) => setCharts((prev) => ({ ...prev, [c.key]: list })))
        .catch((e) => setError(e.message));
    });
  }, []);

  const hot = charts.hot || [];
  const featured = hot[0];
  const activeList = charts[active] || null;
  const fresh = charts.new || [];

  return (
    <div class="am">
      {/* —— 现在就听 —— */}
      {featured ? (
        <section class="am-hero">
          <div class="am-hero-bg" style={{ backgroundImage: `url(${hdCover(featured.artwork_url, 600)})` }} />
          <img class="am-hero-cover" src={hdCover(featured.artwork_url, 1000)} alt={featured.title} />
          <div class="am-hero-text">
            <span class="am-kicker">现在就听 · 热歌榜 No.1</span>
            <h2>{featured.title}</h2>
            <p>{featured.artist}</p>
            <div class="am-hero-actions">
              <button class="primary" onClick={() => onPlayList(hot, 0)}><Icon name="play" size={15} /> 播放</button>
              <button onClick={() => onPlayList([...hot].sort(() => Math.random() - 0.5), 0)}><Icon name="shuffle" size={15} /> 随机播放热歌榜</button>
            </div>
          </div>
        </section>
      ) : error ? null : <div class="am-hero sk" />}

      {error && !featured && <p class="muted">榜单暂时加载不了：{error}</p>}

      {/* —— 排行榜 —— */}
      <section class="am-sec">
        <h3 class="am-sec-title">排行榜</h3>
        <div class="am-charts">
          {CHARTS.map((c) => {
            const list = charts[c.key] || [];
            return (
              <button key={c.key} type="button" class={`am-chart${active === c.key ? ' on' : ''}`}
                style={{ backgroundImage: c.tint }} onClick={() => setActive(c.key)}>
                <div class="am-chart-head">
                  <b>{c.name}</b>
                  <span class="am-chart-play" onClick={(e) => { e.stopPropagation(); if (list.length) onPlayList(list, 0); }}>
                    <Icon name="play" size={14} />
                  </span>
                </div>
                <ol>
                  {(list.length ? list.slice(0, 3) : [{}, {}, {}]).map((t, i) => (
                    <li key={i}>
                      {t.artwork_url ? <img src={hdCover(t.artwork_url, 300)} alt="" loading="lazy" /> : <i />}
                      <span>{t.title ? `${t.title} - ${t.artist}` : '　'}</span>
                    </li>
                  ))}
                </ol>
              </button>
            );
          })}
        </div>
      </section>

      {/* —— 选中榜单的曲目列表 —— */}
      <section class="am-sec">
        <div class="am-sec-head">
          <h3 class="am-sec-title">{CHARTS.find((c) => c.key === active)?.name}</h3>
          <span class="muted">{activeList ? `${activeList.length} 首` : ''}</span>
          <span class="spacer" />
          {activeList?.length > 0 && <button onClick={() => onPlayList(activeList, 0)}><Icon name="play" size={13} /> 全部播放</button>}
        </div>
        <div class="am-tracks">
          {(activeList || Array.from({ length: 10 }, () => null)).slice(0, 50).map((t, i) => (
            t ? (
              <div key={`${t.external_id}-${i}`} class={`am-track${currentTitle === t.title ? ' on' : ''}`} role="button" tabindex={0}
                onClick={() => onPlayList(activeList, i)} onKeyDown={(e) => { if (e.key === 'Enter') onPlayList(activeList, i); }}>
                <span class={`am-rank${i < 3 ? ' top' : ''}`}>{i + 1}</span>
                <span class="am-track-art">
                  <img src={hdCover(t.artwork_url, 300)} alt="" loading="lazy" />
                  <span class="am-track-play"><Icon name="play" size={14} /></span>
                </span>
                <span class="am-track-main">
                  <span class="am-track-title">{t.title}</span>
                  <span class="am-track-artist">{t.artist}</span>
                </span>
                {canCollect && (
                  <button type="button" class="am-track-add" title="加入音乐库"
                    onClick={(e) => { e.stopPropagation(); onCollect(t); }}>
                    <Icon name="plus" size={15} />
                  </button>
                )}
              </div>
            ) : <div key={i} class="am-track sk-row"><span class="sk" /></div>
          ))}
        </div>
      </section>

      {/* —— 新歌速递 —— */}
      {fresh.length > 0 && (
        <section class="am-sec">
          <div class="am-sec-head">
            <h3 class="am-sec-title">新歌速递</h3>
          </div>
          <div class="am-shelf">
            {fresh.slice(0, 20).map((t, i) => (
              <article key={`${t.external_id}-${i}`} class="am-tile" role="button" tabindex={0}
                onClick={() => onPlayList(fresh, i)} onKeyDown={(e) => { if (e.key === 'Enter') onPlayList(fresh, i); }}>
                <div class="am-tile-art">
                  <img src={hdCover(t.artwork_url, 600)} alt={t.title} loading="lazy" />
                  <span class="am-tile-play"><Icon name="play" size={18} /></span>
                </div>
                <b>{t.title}</b>
                <span>{t.artist}</span>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
