// 音乐封面高清化：网易云（Meting pic 端点）走后端中转取 600/1000 像素版本；
// 其它来源（Audius 1000x1000、iTunes 等）原样返回。
import { API_BASE_URL } from './config.js';

export function hdCover(url, size = 600) {
  const s = String(url || '');
  if (!s) return '';
  const m = s.match(/[?&]server=netease&type=pic&id=(\d+)/);
  if (m) return `${API_BASE_URL}/api/img/music?id=${m[1]}&s=${size}`;
  if (/music\.126\.net/.test(s)) return s.replace(/param=\d+y\d+/, `param=${size}y${size}`);
  if (/mzstatic\.com/.test(s)) return s.replace(/\d+x\d+bb/, `${size}x${size}bb`);
  return s;
}

// 搜索 / 榜单候选 → 播放器可直接播放的曲目（不入库）
export function candidateToTrack(c, audioUrl) {
  return {
    id: null,
    title: c.title,
    cover_path: c.artwork_url || '',
    track: {
      artist: c.artist || '',
      album: c.album || '',
      artwork_url: hdCover(c.artwork_url, 600),
      audio_url: audioUrl || c.audio_url || null,
      audio_fallbacks: c.audio_fallbacks || [],
      preview_url: c.preview_url || null,
      duration: c.duration || 0,
      quality: c.quality
    },
    metadata: { platform: c.platform, external_id: c.external_id, gd_source: c.gd_source }
  };
}
