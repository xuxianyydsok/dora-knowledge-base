// 视频播放器：使用 iframe 嵌入 Bilibili/YouTube（后端不转发流媒体）
// 定期上报播放进度到后端
import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { Icon } from './Icon.jsx';

export function VideoPlayer({ video, onClose }) {
  const embedUrl = video?.metadata?.embed_url;
  const [progress, setProgress] = useState(video?.progress || null);
  const [saved, setSaved] = useState('');
  const startRef = useRef(Date.now());

  // 打开播放器时重置计时起点
  useEffect(() => {
    startRef.current = Date.now();
    setProgress(video?.progress || null);
  }, [video?.id]);

  async function save(completed = false) {
    if (!video?.id) return;
    // iframe 无法读取真实播放位置，这里以停留时长估算进度
    const elapsed = Math.round((Date.now() - startRef.current) / 1000);
    const base = progress?.position || 0;
    const duration = progress?.duration || video?.metadata?.duration || 0;
    const position = base + elapsed;
    try {
      const data = await api.saveVideoProgress(video.id, {
        position: duration ? Math.min(position, duration) : position,
        duration: duration || undefined,
        completed
      });
      setProgress(data);
      startRef.current = Date.now();
      setSaved('进度已保存');
      setTimeout(() => setSaved(''), 2000);
    } catch (e) {
      setSaved(`保存失败: ${e.message}`);
    }
  }

  if (!embedUrl) {
    return (
      <div class="stack">
        <p class="muted">该视频暂无可嵌入播放地址，请<a href={video?.url} target="_blank" rel="noreferrer">前往原站观看</a>。</p>
        <button onClick={onClose}>关闭</button>
      </div>
    );
  }

  return (
    <div class="watch">
      <div class="watch-bar">
        <button onClick={onClose}><Icon name="arrowLeft" size={15} /> 返回列表</button>
        <span class="spacer" />
        <span class="watch-title" title={video.title}>{video.title}</span>
        <span class="spacer" />
        {saved && <span class="muted" style="font-size:12px">{saved}</span>}
        <button onClick={() => save(false)}>保存进度</button>
        <button onClick={() => save(true)}>标记看完</button>
        {video?.url && (
          <a class="btn" href={video.url} target="_blank" rel="noreferrer">原站</a>
        )}
      </div>
      <div class="watch-stage">
        <iframe
          src={embedUrl}
          class="watch-frame"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          title={video.title}
        />
      </div>
      <div class="watch-meta">
        <span class="muted" style="font-size:12px">
          {video.source === 'bilibili' ? 'B站' : 'YouTube'}
          {video.metadata?.author ? ` · ${video.metadata.author}` : ''}
          {progress?.position != null ? ` · 已记录 ${Math.round(progress.position)}s` : ''}
          {progress?.progress ? ` · ${progress.progress}%` : ''}
        </span>
      </div>
    </div>
  );
}
