// 影视海报卡：用于「精选推荐 / 最新入库 / 搜索结果」的候选片单展示。
// 与已收藏的 Card 不同，这里展示的是采集源候选（尚未落库），
// 因此信息以「海报 + 片名 + 年份/类型 + 评分 + 线路与源数量」为主，视觉上更接近影视站。
//
// 2026-10-07 体验重构：
//   · 海报左下角新增「N 线路 / N 源」读数 —— 检索层会把 8~12 个采集源的线路合并到
//     同一条目上（实测「奥本海默」11 源合并出 19 条线路），这个数字是「这部片好不好播」
//     最直接的判据，不该藏在详情页里；
//   · 无直链的条目给明确的「无直链」标识并整卡降饱和，避免点进去才发现播不了；
//   · 海报加载失败时回落到首字占位（此前会留一个破图占位）。
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './Icon.jsx';
import { attachTilt } from '../lib/tilt.js';

const ANIME_RE = /(动漫|动画|番剧|国漫|日漫)/;

// 类型标记：扫码时能一眼分出电影 / 剧集 / 动漫
function kindOf(item) {
  const typeName = String(item.type_name || '');
  if (ANIME_RE.test(typeName)) return { icon: 'sparkles', label: '动漫' };
  if (item.media_type === 'tv') return { icon: 'tv', label: '剧集' };
  return { icon: 'film', label: '电影' };
}

// collectLabel：右上角那个按钮的文字。默认「加入影视库」——
// 2026-10-12 用户反馈「右上角显示的不是加入影视库而是添加收藏」：之前这里是**纯 + 图标**
// （只有悬停才显形、语义靠 title 提示），看起来就像「加个收藏」。现在改成带文字的胶囊按钮，
// 一眼就能看出它做的是「加入影视库」。
// 访客模式下点击不会入库而是直接播放（见 Movies.jsx 的 addFrom），因此传入「播放」。
export function VodPoster({ item, hot, onOpen, onCollect, busy, pending, collectLabel = '加入影视库' }) {
  const ref = useRef(null);
  const [broken, setBroken] = useState(false);
  useEffect(() => attachTilt(ref.current), []);

  const year = item.release_date ? String(item.release_date).slice(0, 4) : '';
  const eps = Number(item.episode_count) || 0;
  // 角标优先级：采集源备注（如「已完结」「更新至第12集」）> 集数
  const badge = item.remarks || (eps > 1 ? `${eps}集` : '');
  const altCount = (item.alt_sources || []).length;
  const routeCount = (item.routes || []).length;
  const playable = !!item.playable_url;
  const showPoster = item.poster_url && !broken;
  const kind = kindOf(item);

  return (
    <article
      ref={ref}
      class={`vod-card${playable ? '' : ' no-play'}${pending ? ' is-pending' : ''}`}
      onClick={onOpen}
      role="button"
      tabindex={0}
      aria-busy={pending ? 'true' : undefined}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
      title={playable ? `${item.title} · 可直接播放` : `${item.title} · 该源返回的线路暂无直链地址`}
    >
      {/* 点击后到详情页出内容之间有一段真实等待（建库 / 回源取线路）。
          2026-10-12 用户要求：这段等待必须有加载动画，且**不设固定时长** ——
          点下去就显示，内容一到位立刻消失（快的时候 CSS 的 180ms 淡入延迟会把它藏住，
          不会闪一下）。遮罩盖住整张卡，点卡片或点右上角按钮都走这里。 */}
      {pending && (
        <span class="vod-loading" role="status" aria-label="正在载入">
          <span class="spinner" aria-hidden="true" />
        </span>
      )}
      <div class="vod-poster">
        {badge && <span class={`vod-badge${hot ? ' hot' : ''}`}>{badge}</span>}
        {playable && <span class="vod-play-hint"><Icon name="play" size={16} /></span>}
        {showPoster
          ? (
            <img
              src={item.poster_url}
              alt={item.title}
              loading="lazy"
              referrerpolicy="no-referrer"
              onError={() => setBroken(true)}
            />
          )
          : <span class="vod-initial">{(item.title || '影').charAt(0)}</span>}

        {/* 线路 / 源 读数：跨源合并后「能换几条线路试」比评分更实用 */}
        <div class="vod-stat">
          {routeCount > 1 && (
            <span class="vod-stat-item" title={`可切换 ${routeCount} 条播放线路`}>
              <Icon name="layers" size={11} />{routeCount} 线路
            </span>
          )}
          {altCount > 0 && (
            <span class="vod-stat-item" title={`${altCount + 1} 个采集源命中同一部片`}>
              <Icon name="globe" size={11} />{altCount + 1} 源
            </span>
          )}
          {!playable && (
            <span class="vod-stat-item danger" title="该采集源返回的线路里没有可直链播放的地址">
              <Icon name="linkBroken" size={11} />无直链
            </span>
          )}
        </div>
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
          <span class="tag-src tag-type"><Icon name={kind.icon} size={10} />{kind.label}</span>
        </div>
      </div>

      <button
        class="vod-collect"
        title={pending ? '正在加入…' : collectLabel}
        aria-label={collectLabel}
        disabled={busy}
        onClick={(e) => { e.stopPropagation(); onCollect(); }}
      >
        {pending
          ? <span class="spinner" aria-hidden="true" />
          : <><Icon name="plus" size={13} /><span>{collectLabel}</span></>}
      </button>
    </article>
  );
}
