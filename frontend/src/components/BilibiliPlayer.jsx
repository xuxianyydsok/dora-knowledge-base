// B 站曲目播放器（嵌 B 站官方播放器）
//
// 用户要求（2026-10-13）：
//   「我在上传那个音乐的时候，就是可以上传那个一个哔哩哔哩的一个链接」
//   「我需要的就是那个视频窗口，就比如说有些音乐它是以 MV 的形式呈现出来的，
//    那个就不光是听音乐，那个直接看那个视频」
//
// 为什么是 iframe 而不是 <audio>（实测结论，别再走回头路）：
//   · B 站的取流接口（x/player/playurl）**不给浏览器跨域** → 前端拿不到音频地址；
//   · 后端代取则受**机房 IP** 限流（实测 Worker 里请求直接超时，而同一链接在本机秒回）；
//   · 官方嵌入播放器由**用户浏览器直连 B 站**，不受机房 IP 影响 ——
//     真实浏览器实测：画面正常加载、能播、进度条走动。
//   代价是「没有播放进度回调」（iframe 是跨域的，读不到内部状态），
//   所以底部播放条的进度条对 B 站曲目不显示 —— 这是已知限制，不是 bug。
//
// 用户还要求「前端要区分一下是来自哔哩哔哩的」：曲目卡片与播放页都带 B站 徽章。
import { useEffect, useRef, useState } from 'preact/hooks';
import { bilibiliEmbedUrl, bilibiliPageUrl } from '../lib/bilibili.js';
import { Icon } from './Icon.jsx';
// 自带样式：谁挂载它都能正常显示，不依赖宿主页面碰巧 import 过 global.css
import '../styles/global.css';

/**
 * B 站曲目播放页（整页形态，与 MovieView 那种「就地播放」一致）。
 *
 * @param {object} music 曲目（需含 track.bvid）
 * @param {function} onClose 关闭
 */
export function BilibiliPlayer({ music, onClose }) {
  const track = music?.track || {};
  const bvid = track.bvid || '';
  const [autoPlay, setAutoPlay] = useState(false);
  const [danmaku, setDanmaku] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const iframeRef = useRef(null);

  // Esc 关闭（与其它弹层一致）
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 切曲目时重置加载态
  useEffect(() => { setLoaded(false); }, [bvid]);

  const embed = bilibiliEmbedUrl(bvid, { autoplay: autoPlay, danmaku });
  const pageUrl = bilibiliPageUrl(bvid);

  if (!embed) {
    return (
      <div class="bv-wrap">
        <div class="bv-bar">
          <button type="button" onClick={onClose}><Icon name="arrowLeft" size={15} /> 返回</button>
        </div>
        <div class="bv-stage">
          <p class="bv-hint">这个曲目没有有效的 B 站视频号，无法嵌入播放。</p>
        </div>
      </div>
    );
  }

  return (
    <div class="bv-wrap" role="dialog" aria-modal="true" aria-label={`播放《${music?.title || ''}》`}>
      <div class="bv-bar">
        <button type="button" onClick={onClose} title="关闭">
          <Icon name="arrowLeft" size={15} /><span>返回</span>
        </button>
        <span class="bv-title" title={music?.title}>{music?.title || '未命名'}</span>
        <span class="bv-badge" title="这个曲目来自哔哩哔哩">
          <Icon name="video" size={12} /> B站
        </span>
        <span class="bv-spacer" />
        {/* 弹幕与自动播放都是 B 站播放器自身也有的开关，这里放一份是因为
            用户从「音乐」入口进来时，不一定知道播放器右下角能点开。 */}
        <button
          type="button"
          class={danmaku ? 'on' : ''}
          onClick={() => setDanmaku((v) => !v)}
          title="显示 / 隐藏弹幕"
        >弹幕</button>
        <button
          type="button"
          class={autoPlay ? 'on' : ''}
          onClick={() => setAutoPlay((v) => !v)}
          title="打开时是否自动播放"
        >自动播放</button>
        {pageUrl && (
          <a class="bv-link" href={pageUrl} target="_blank" rel="noreferrer" title="去 B 站看原片">
            原片 <Icon name="external" size={13} />
          </a>
        )}
      </div>

      <div class="bv-stage">
        {!loaded && <div class="bv-loading"><span class="spinner" aria-hidden="true" /><p>正在载入 B 站播放器…</p></div>}
        <iframe
          ref={iframeRef}
          class="bv-frame"
          src={embed}
          title={`《${music?.title || ''}》B 站视频`}
          onLoad={() => setLoaded(true)}
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          frameborder="0"
          scrolling="no"
        />
      </div>

      <div class="bv-meta">
        <span>{track.artist ? `${track.artist} · ` : ''}来自哔哩哔哩</span>
        <span class="bv-hint">进度条由 B 站播放器自己控制；音乐页的底部播放条对 B 站曲目不显示进度（跨域读不到）。</span>
      </div>
    </div>
  );
}

/** 曲目卡片上的 B站 徽章（用户要求「前端要区分一下是来自哔哩哔哩的」）。 */
export function BilibiliBadge({ title = '来自哔哩哔哩' }) {
  return (
    <span class="bv-badge-sm" title={title}>
      <Icon name="video" size={11} /> B站
    </span>
  );
}
