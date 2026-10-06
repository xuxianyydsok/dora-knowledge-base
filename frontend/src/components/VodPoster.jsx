// 影视海报卡：用于「精选推荐 / 最新入库 / 搜索结果」的候选片单展示。
// 与已收藏的 Card 不同，这里展示的是采集源候选（尚未落库），
// 因此信息以「海报 + 片名 + 年份/类型 + 评分 + 线路来源」为主，视觉上更接近影视站。
import { useEffect, useRef } from 'preact/hooks';
import { Icon } from './Icon.jsx';
import { attachTilt } from '../lib/tilt.js';

export function VodPoster({ item, hot, onOpen, onCollect, busy }) {
  const ref = useRef(null);
  useEffect(() => attachTilt(ref.current), []);

  const year = item.release_date ? String(item.release_date).slice(0, 4) : '';
  const eps = Number(item.episode_count) || 0;
  // 角标优先级：采集源备注（如「已完结」「更新至第12集」）> 集数
  const badge = item.remarks || (eps > 1 ? `${eps}集` : '');
  const sources = [item.source_name, ...(item.alt_sources || []).map(() => '')].filter(Boolean);
  const altCount = (item.alt_sources || []).length;

  return (
    <article ref={ref} class="vod-card" onClick={onOpen} role="button" tabindex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}>
      <div class="vod-poster">
        {badge && <span class={`vod-badge${hot ? ' hot' : ''}`}>{badge}</span>}
        {item.playable_url && <span class="vod-play-hint"><Icon name="play" size={16} /></span>}
        {item.poster_url
          ? <img src={item.poster_url} alt={item.title} loading="lazy" referrerpolicy="no-referrer" />
          : <span class="vod-initial">{(item.title || '影').charAt(0)}</span>}
      </div>

      <div class="vod-meta">
        <h3 title={item.title}>{item.title}</h3>
        <div class="vod-sub">
          {year && <span>{year}</span>}
          {year && item.type_name && <span class="sep">·</span>}
          {item.type_name && <span class="ellipsis">{item.type_name}</span>}
          {item.rating != null && <span class="vod-score">{item.rating}</span>}
        </div>
        <div class="vod-tags">
          <span class="tag-src">{item.source_name}</span>
          {altCount > 0 && <span class="tag-src">+{altCount}</span>}
        </div>
      </div>

      <button
        class="vod-collect"
        title="加入影视库"
        disabled={busy}
        onClick={(e) => { e.stopPropagation(); onCollect(); }}
      >
        <Icon name="plus" size={14} />
      </button>
    </article>
  );
}
