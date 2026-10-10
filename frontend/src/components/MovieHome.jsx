// 影视库首页（方案 C，2026-10-09）：参照腾讯视频 / 爱奇艺的频道式布局
//   频道（精选 / 电视剧 / 电影 / 动漫 / 综艺）→ 首屏大图轮播 → 一行一个分类的海报墙
// 数据来自豆瓣公开片单（后端 /api/movies/douban），海报经后端中转（/api/img/douban），
// 海报墙用 540×810，首屏用 1080×1620，保证清晰。点海报 = 按片名去采集源搜索播放。
import { useEffect, useRef, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { API_BASE_URL } from '../lib/config.js';
import { Icon } from './Icon.jsx';

export const CHANNELS = {
  featured: {
    label: '精选',
    hero: ['tv', '热门'],
    rows: [
      ['热播剧', 'tv', '热门'], ['热门电影', 'movie', '热门'], ['国产剧', 'tv', '国产剧'],
      ['美剧', 'tv', '美剧'], ['韩剧', 'tv', '韩剧'], ['日剧', 'tv', '日剧'],
      ['动漫', 'tv', '日本动画'], ['综艺', 'tv', '综艺'], ['豆瓣高分电影', 'movie', '豆瓣高分']
    ]
  },
  tv: {
    label: '电视剧',
    hero: ['tv', '国产剧'],
    rows: [
      ['热播剧', 'tv', '热门'], ['国产剧', 'tv', '国产剧'], ['美剧', 'tv', '美剧'], ['英剧', 'tv', '英剧'],
      ['韩剧', 'tv', '韩剧'], ['日剧', 'tv', '日剧'], ['港剧', 'tv', '港剧'], ['纪录片', 'tv', '纪录片']
    ]
  },
  movie: {
    label: '电影',
    hero: ['movie', '热门'],
    rows: [
      ['热门电影', 'movie', '热门'], ['最新上映', 'movie', '最新'], ['豆瓣高分', 'movie', '豆瓣高分'],
      ['华语', 'movie', '华语'], ['欧美', 'movie', '欧美'], ['韩国', 'movie', '韩国'], ['日本', 'movie', '日本'],
      ['动作', 'movie', '动作'], ['喜剧', 'movie', '喜剧'], ['科幻', 'movie', '科幻'], ['悬疑', 'movie', '悬疑'],
      ['冷门佳片', 'movie', '冷门佳片']
    ]
  },
  anime: {
    label: '动漫',
    hero: ['tv', '日本动画'],
    rows: [['热门番剧', 'tv', '日本动画'], ['动画电影', 'movie', '动画']]
  },
  variety: {
    label: '综艺',
    hero: ['tv', '综艺'],
    rows: [['热门综艺', 'tv', '综艺'], ['纪录片', 'tv', '纪录片']]
  }
};

// 同一片单在频道间切换时复用，避免重复请求
const listCache = new Map();
function loadList(type, tag, limit) {
  const key = `${type}|${tag}|${limit}`;
  if (!listCache.has(key)) {
    // 首次加载偶发网络失败（冷启动 / 刚部署），自动重试一次
    const once = () => api.listDouban(type, tag, limit).then((d) => d?.items || []);
    listCache.set(key, once().catch(() => new Promise((r) => setTimeout(r, 800)).then(once)).catch((e) => {
      listCache.delete(key);
      throw e;
    }));
  }
  return listCache.get(key);
}

const img = (path) => (path ? `${API_BASE_URL}${path}` : '');

export function MovieHome({ channel, onPick, library }) {
  const cfg = CHANNELS[channel] || CHANNELS.featured;
  return (
    <div class="mh">
      <Hero key={channel} type={cfg.hero[0]} tag={cfg.hero[1]} onPick={onPick} />
      {channel === 'featured' && library?.length > 0 && <LibraryRow items={library} />}
      {cfg.rows.map(([title, type, tag]) => (
        <PosterRow key={`${channel}-${type}-${tag}`} title={title} type={type} tag={tag} onPick={onPick} />
      ))}
    </div>
  );
}

// —— 首屏大图轮播：虚化高清海报做背景 + 清晰海报 + 片名信息 ——
function Hero({ type, tag, onPick }) {
  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;
    loadList(type, tag, 24).then((list) => { if (alive) { setItems(list.slice(0, 6)); setIdx(0); } }).catch(() => {});
    return () => { alive = false; };
  }, [type, tag]);

  useEffect(() => {
    if (items.length < 2) return undefined;
    timer.current = setInterval(() => setIdx((i) => (i + 1) % items.length), 6000);
    return () => clearInterval(timer.current);
  }, [items]);

  if (!items.length) return <div class="mh-hero sk" />;
  const cur = items[idx];

  return (
    <section class="mh-hero">
      {items.map((it, i) => (
        <div key={it.id} class={`mh-hero-bg${i === idx ? ' on' : ''}`} style={{ backgroundImage: `url(${img(it.poster_hd)})` }} />
      ))}
      <div class="mh-hero-shade" />
      <div class="mh-hero-body">
        <div class="mh-hero-text">
          <span class="mh-hero-kicker">{tag === '热门' ? (type === 'tv' ? '热播剧' : '热门电影') : tag} · 今日推荐</span>
          <h2>{cur.title}</h2>
          <div class="mh-hero-meta">
            {cur.rating ? <span class="mh-rate"><Icon name="star" size={14} /> {cur.rating.toFixed(1)}</span> : <span class="mh-rate muted">暂无评分</span>}
            {cur.episodes && <span>{cur.episodes}</span>}
            <span>{type === 'tv' ? '剧集' : '电影'}</span>
            {cur.is_new && <span class="mh-new">新上线</span>}
          </div>
          <div class="mh-hero-actions">
            <button class="primary" onClick={() => onPick(cur)}><Icon name="play" size={15} /> 搜索播放</button>
            <a class="btn" href={cur.douban_url} target="_blank" rel="noreferrer">豆瓣详情</a>
          </div>
        </div>
        <img class="mh-hero-poster" src={img(cur.poster_hd)} alt={cur.title} />
      </div>
      <div class="mh-hero-thumbs">
        {items.map((it, i) => (
          <button
            key={it.id}
            type="button"
            class={`mh-thumb${i === idx ? ' on' : ''}`}
            onClick={() => { clearInterval(timer.current); setIdx(i); }}
            title={it.title}
          >
            <img src={img(it.poster)} alt={it.title} loading="lazy" />
          </button>
        ))}
      </div>
    </section>
  );
}

// —— 一行一个分类：横向滚动，可展开成整面海报墙 ——
function PosterRow({ title, type, tag, onPick }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const track = useRef(null);

  useEffect(() => {
    let alive = true;
    setItems(null); setError('');
    loadList(type, tag, expanded ? 50 : 24)
      .then((list) => { if (alive) setItems(list); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [type, tag, expanded]);

  const scroll = (dir) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.85, behavior: 'smooth' });

  return (
    <section class="mh-row">
      <header class="mh-row-head">
        <h3>{title}</h3>
        {items && <span class="muted">{items.length} 部</span>}
        <span class="spacer" />
        {!expanded && (
          <>
            <button type="button" class="icon-btn" aria-label="向左" onClick={() => scroll(-1)}><Icon name="chevronLeft" size={16} /></button>
            <button type="button" class="icon-btn" aria-label="向右" onClick={() => scroll(1)}><Icon name="chevronRight" size={16} /></button>
          </>
        )}
        <button type="button" class="mh-more" onClick={() => setExpanded((v) => !v)}>{expanded ? '收起' : '查看更多'}</button>
      </header>
      {error ? (
        <p class="muted mh-row-error">{error}</p>
      ) : (
        <div ref={track} class={expanded ? 'mh-wall' : 'mh-track'}>
          {(items || Array.from({ length: 8 }, (_, i) => ({ id: `sk${i}`, sk: true }))).map((it) => (
            it.sk ? <div key={it.id} class="mh-card sk-card"><div class="mh-poster sk" /></div>
              : <PosterCard key={it.id} item={it} onPick={onPick} />
          ))}
        </div>
      )}
    </section>
  );
}

function PosterCard({ item, onPick }) {
  const [loaded, setLoaded] = useState(false);
  const badge = item.episodes || (item.is_new ? '新上线' : '');
  return (
    <article class="mh-card" role="button" tabindex={0} title={item.title}
      onClick={() => onPick(item)} onKeyDown={(e) => { if (e.key === 'Enter') onPick(item); }}>
      <div class={`mh-poster${loaded ? ' loaded' : ''}`}>
        {item.poster && (
          <img
            src={img(item.poster)}
            srcset={`${img(item.poster)} 540w, ${img(item.poster_hd)} 1080w`}
            sizes="(max-width: 640px) 40vw, 200px"
            alt={item.title}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
          />
        )}
        {badge && <span class="mh-badge">{badge}</span>}
        {item.rating ? <span class="mh-score">{item.rating.toFixed(1)}</span> : null}
        <span class="mh-play"><Icon name="play" size={20} /></span>
      </div>
      <div class="mh-card-title">{item.title}</div>
    </article>
  );
}

// —— 我的片库：站长已收藏的影视，点击进详情 ——
function LibraryRow({ items }) {
  return (
    <section class="mh-row">
      <header class="mh-row-head">
        <h3>我的片库</h3>
        <span class="muted">{items.length} 部</span>
      </header>
      <div class="mh-track">
        {dedupeByTitle(items).slice(0, 30).map((m) => (
          <article key={m.id} class="mh-card" role="button" tabindex={0} title={m.title}
            onClick={() => route(`/movies/${m.id}`)} onKeyDown={(e) => { if (e.key === 'Enter') route(`/movies/${m.id}`); }}>
            <div class="mh-poster loaded">
              {(m.title_info?.poster_url || m.cover_path) && (
                <img src={m.title_info?.poster_url || m.cover_path} alt={m.title} loading="lazy" referrerpolicy="no-referrer" />
              )}
              {m.title_info?.rating ? <span class="mh-score">{Number(m.title_info.rating).toFixed(1)}</span> : null}
              <span class="mh-play"><Icon name="play" size={20} /></span>
            </div>
            <div class="mh-card-title">{m.title}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

// 片库里同名条目（多次入库）只显示一张
function dedupeByTitle(list) {
  const seen = new Set();
  return list.filter((m) => {
    const k = String(m.title || '').replace(/\s+/g, '');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
