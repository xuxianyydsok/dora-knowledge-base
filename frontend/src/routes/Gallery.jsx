// 图展（/gallery）：一个「策展感」的展厅，分两个区 —— 静态图片 + 动态壁纸。
//
// 设计取舍：
// 1) 静态图片用「整齐等高行」（justified rows，lib/justified.js）：每一行图片等高、
//    整行铺满容器宽度，行与行之间留统一间隙 —— 这是 2026-10-12 的改动。
//    原来用纯 CSS columns 做错落 masonry，各列高度不齐、底部留大空档，
//    宽高比差异一大（1080~2560 宽混着放）看着就「不协调」，所以换成这个算法。
// 2) 点击图片进灯箱：Esc 关闭、方向键切换、锁滚动、焦点回到触发元素。
// 3) 管理员才显示「策展」抽屉（从最近素材加入展览、改元数据、公开/私人、移出展览）；
//    访客只看到公开展览，看不到任何管理入口。
// 4) 样式集中在 styles/gallery-timeline.css（.gl-*），不动 global.css。
// 5) 2026-10-12 用户要求：图片不再一股脑全铺出来，**默认只显示 4 行**，
//    点「查看更多」才展开全部；动态壁纸（视频）同理，与静态图片分成两个区。
//    R2 里两者前缀也分开（assets/ 与 wallpapers/），互不牵连。
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { api, uploadAsset, uploadWallpaper } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { justifyRows } from '../lib/justified.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { LoadingState, ErrorState } from '../components/StateView.jsx';
import { Icon } from '../components/Icon.jsx';
import { toastError, toastSuccess } from '../lib/toast.jsx';
import '../styles/gallery-timeline.css';

function fmtDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 视频时长 → 1:23 / 12:05。解析不出（WebM 或 moov 在文件尾部）就不显示。
function fmtDuration(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return '';
  const total = Math.round(s);
  const m = Math.floor(total / 60);
  const r = total % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function fmtSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// 折叠行数（2026-10-12 用户要求「不要一股脑全展示」）。
// 为什么是 4 行：桌面 3 列 → 12 张，平板 2 列 → 8 张，手机 1 列 → 4 张。
// 首屏一屏半左右，既有「展厅」的丰盛感，又不会让页面长到要滚很久；
// 剩下的交给「查看更多」，展开后按钮变成「收起」。
const COLLAPSE_ROWS = 4;

// 整齐排版的行参数（图展静态图片区）。
// 目标行高按容器宽度分档：窄屏（手机）一行只有一两张，行高太大会让单张图占掉整屏。
const ROW_GAP = 12;          // 行内水平间隙，也是行与行之间的垂直间隙
function rowHeights(containerWidth) {
  if (containerWidth && containerWidth < 640) return { target: 190, max: 300 };
  if (containerWidth && containerWidth < 1024) return { target: 220, max: 340 };
  return { target: 260, max: 420 };
}

// 量容器可用宽度（ResizeObserver 自适应）。首帧量不到时返回 0，
// 调用方用兜底宽度先排一版，量到真实宽度后再重排。
//
// 为什么用**回调 ref** 而不是 useRef + useEffect：图片区在数据到达前根本不渲染，
// 普通 ref 的 useEffect 只会在首帧跑一次（那时 ref.current 还是 null），
// 等容器真正挂上去时不会重跑 —— 宽度就永远停在 0，排版只能用兜底宽度。
function useMeasuredWidth() {
  const [width, setWidth] = useState(0);
  const roRef = useRef(null);
  const ref = useCallback((el) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) return;
    const measure = () => {
      const next = Math.round(el.clientWidth || 0);
      setWidth((prev) => (prev === next ? prev : next));
    };
    measure();
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      roRef.current = ro;
    } else {
      window.addEventListener('resize', measure);
    }
  }, []);
  useEffect(() => () => { roRef.current?.disconnect(); }, []);
  return [ref, width];
}

// 当前列数（与 CSS 断点保持一致：>1024 三列 / >640 两列 / 否则一列）
function useColumns() {
  const read = () => {
    if (typeof window === 'undefined') return 3;
    if (window.matchMedia('(max-width: 640px)').matches) return 1;
    if (window.matchMedia('(max-width: 1024px)').matches) return 2;
    return 3;
  };
  const [cols, setCols] = useState(read);
  useEffect(() => {
    const queries = [window.matchMedia('(max-width: 640px)'), window.matchMedia('(max-width: 1024px)')];
    const onChange = () => setCols(read());
    for (const q of queries) q.addEventListener('change', onChange);
    return () => { for (const q of queries) q.removeEventListener('change', onChange); };
  }, []);
  return cols;
}

// 图片比例占位：宽高都拿到时按比例撑高，避免加载后版面跳动
function ratioStyle(image) {
  const w = Number(image?.width);
  const h = Number(image?.height);
  if (w > 0 && h > 0) return `aspect-ratio:${w} / ${h}`;
  return 'aspect-ratio:4 / 3';
}

// ---------------- 灯箱 ----------------
function Lightbox({ items, index, onClose, onIndex }) {
  const boxRef = useRef(null);
  const item = items[index];
  // 用 ref 保存最新的 index / 回调：这样「锁滚动 + 键盘」的副作用只在挂载时执行一次，
  // 不会因为每次切图重跑副作用而反复抢焦点。
  const stateRef = useRef({ index, onClose, onIndex });
  stateRef.current = { index, onClose, onIndex };

  useEffect(() => {
    const trigger = document.activeElement;   // 关闭后把焦点还给触发的那张图
    // 关键：不要 focus 关闭按钮。按钮在 fixed 遮罩里，focus() 会触发浏览器
    // scrollIntoView，把整页滚到底部（「点图先滑到最低再显示」的根因之一）。
    // 改为 focus 灯箱容器（本身不产生滚动），键盘 Esc / 方向键仍然可用。
    boxRef.current?.focus({ preventScroll: true });
    const prevOverflow = document.body.style.overflow;
    const prevScrollY = window.scrollY;
    // global.css 有 `html { scroll-behavior: smooth }`，会让关闭时的 scrollTo 变成
    // 一段缓慢的滚动动画（用户看到的「还在滑动」）。这里临时切回 auto，保证瞬时归位。
    const prevScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      const { index: i, onClose: close, onIndex: go } = stateRef.current;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') go(i - 1);
      else if (e.key === 'ArrowRight') go(i + 1);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      window.scrollTo(0, prevScrollY);        // 关闭后瞬时回到原位置，不再被滚走
      document.documentElement.style.scrollBehavior = prevScrollBehavior;
      if (trigger && typeof trigger.focus === 'function') trigger.focus({ preventScroll: true });
    };
  }, []);

  // 预加载前后相邻图片：翻页时直接从缓存出图，避免「点了下一页要等它加载」的延迟。
  // 只预取紧邻的 ±2 张，不做全量预取，避免浪费带宽。
  useEffect(() => {
    const neighbors = [index - 2, index - 1, index + 1, index + 2];
    for (const i of neighbors) {
      const target = items[(i + items.length) % items.length];
      if (!target?.image?.url) continue;
      const img = new Image();
      img.decoding = 'async';
      img.src = target.image.url;
    }
  }, [index, items]);

  if (!item) return null;
  // 关键：用 portal 挂到 document.body。灯箱是 position:fixed，而祖先 .gl-page 因为
  // global.css 的 `.app-main > * { animation: fade-up … both }` 残留了 transform，
  // 会让 fixed 相对整页而非视口定位（表现为点图后画面先滚到底再显示）。
  // 挂到 body 后 fixed 恢复相对视口，配合上面的 preventScroll，点图即可原地弹出。
  return createPortal((
    <div ref={boxRef} tabIndex={-1} class="gl-lightbox" role="dialog" aria-modal="true" aria-label={item.title || '图片查看'} onClick={onClose}>
      <div class="gl-lightbox-inner" onClick={(e) => e.stopPropagation()}>
        <button type="button" class="gl-lb-close" onClick={onClose} aria-label="关闭">
          <Icon name="close" size={20} />
        </button>
        {items.length > 1 && (
          <button type="button" class="gl-lb-nav prev" onClick={() => onIndex(index - 1)} aria-label="上一张">
            <Icon name="chevronLeft" size={22} />
          </button>
        )}
        <img class="gl-lb-img" src={item.image.url} alt={item.image.alt || item.title || ''} />
        {items.length > 1 && (
          <button type="button" class="gl-lb-nav next" onClick={() => onIndex(index + 1)} aria-label="下一张">
            <Icon name="chevronRight" size={22} />
          </button>
        )}
        <div class="gl-lb-caption">
          <strong>{item.title || '未命名'}</strong>
          {item.description && <p>{item.description}</p>}
          <div class="gl-lb-meta">
            {item.captured_at && <span>{fmtDate(item.captured_at)}</span>}
            <span>{index + 1} / {items.length}</span>
          </div>
        </div>
      </div>
    </div>
  ), document.body);
}

// ---------------- 动态壁纸灯箱 ----------------
// 与图片灯箱同一套「原地弹出」策略（portal + preventScroll + 临时关掉平滑滚动），
// 区别只是内容换成 <video>：自动播放、循环、静音，给一个手动取消静音的按钮。
function WallpaperLightbox({ items, index, onClose, onIndex }) {
  const boxRef = useRef(null);
  const item = items[index];
  const stateRef = useRef({ index, onClose, onIndex });
  stateRef.current = { index, onClose, onIndex };
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const trigger = document.activeElement;
    boxRef.current?.focus({ preventScroll: true });
    const prevOverflow = document.body.style.overflow;
    const prevScrollY = window.scrollY;
    const prevScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      const { index: i, onClose: close, onIndex: go } = stateRef.current;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') go(i - 1);
      else if (e.key === 'ArrowRight') go(i + 1);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      window.scrollTo(0, prevScrollY);
      document.documentElement.style.scrollBehavior = prevScrollBehavior;
      if (trigger && typeof trigger.focus === 'function') trigger.focus({ preventScroll: true });
    };
  }, []);

  // 切视频时把静音状态重置回静音：自动播放策略下带声音的视频会被浏览器拦下
  useEffect(() => { setMuted(true); }, [index]);

  if (!item) return null;
  const ratio = item.width > 0 && item.height > 0 ? `${item.width} / ${item.height}` : '16 / 9';

  return createPortal((
    <div ref={boxRef} tabIndex={-1} class="gl-lightbox" role="dialog" aria-modal="true" aria-label={item.title || '动态壁纸'} onClick={onClose}>
      <div class="gl-lightbox-inner" onClick={(e) => e.stopPropagation()}>
        <button type="button" class="gl-lb-close" onClick={onClose} aria-label="关闭">
          <Icon name="close" size={20} />
        </button>
        {items.length > 1 && (
          <button type="button" class="gl-lb-nav prev" onClick={() => onIndex(index - 1)} aria-label="上一个">
            <Icon name="chevronLeft" size={22} />
          </button>
        )}
        <video
          class="gl-lb-video"
          style={`aspect-ratio:${ratio}`}
          src={api.wallpaperFileUrl(item.id)}
          autoPlay
          loop
          playsInline
          muted={muted}
          controls
          preload="metadata"
        />
        {items.length > 1 && (
          <button type="button" class="gl-lb-nav next" onClick={() => onIndex(index + 1)} aria-label="下一个">
            <Icon name="chevronRight" size={22} />
          </button>
        )}
        <div class="gl-lb-caption">
          <strong>{item.title || '未命名'}</strong>
          {item.description && <p>{item.description}</p>}
          <div class="gl-lb-meta">
            <button
              type="button"
              class="gl-lb-sound"
              onClick={() => setMuted((m) => !m)}
            >
              <Icon name={muted ? 'volume' : 'wave'} size={14} /> {muted ? '取消静音' : '静音'}
            </button>
            {item.width > 0 && <span>{item.width}×{item.height}</span>}
            {fmtDuration(item.duration) && <span>{fmtDuration(item.duration)}</span>}
            {fmtSize(item.size) && <span>{fmtSize(item.size)}</span>}
            <span>{index + 1} / {items.length}</span>
          </div>
        </div>
      </div>
    </div>
  ), document.body);
}

// ---------------- 动态壁纸卡片 ----------------
// 静音循环自动播放，让「展厅」一进来就是活的；加载失败（浏览器不认这个编码）显示占位。
function WallpaperCard({ item, index, onOpen }) {
  const [failed, setFailed] = useState(false);
  const ratio = item.width > 0 && item.height > 0 ? `${item.width} / ${item.height}` : '16 / 9';

  return (
    <figure class="gl-item gl-wall-item" style={`--gl-i:${index}`}>
      <button type="button" class="gl-figure gl-wall-figure" onClick={onOpen} aria-label={item.title || '播放动态壁纸'}>
        {failed ? (
          <div class="gl-wall-fallback" style={`aspect-ratio:${ratio}`}>
            <Icon name="video" size={26} />
            <span>此视频当前浏览器无法播放</span>
          </div>
        ) : (
          <video
            class="gl-wall-video"
            style={`aspect-ratio:${ratio}`}
            src={api.wallpaperFileUrl(item.id)}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            onError={() => setFailed(true)}
          />
        )}
        <span class="gl-wall-play" aria-hidden="true"><Icon name="play" size={18} /></span>
        {fmtDuration(item.duration) && <span class="gl-wall-time">{fmtDuration(item.duration)}</span>}
      </button>
      {(item.title || item.description) && (
        <figcaption class="gl-cap">
          {item.title && <strong>{item.title}</strong>}
          {item.description && <span>{item.description}</span>}
        </figcaption>
      )}
    </figure>
  );
}

// ---------------- 管理抽屉 ----------------
function CuratorDrawer({ items, wallpapers, onClose, onReload }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});
  // 直接上传（2026-10-11 用户要求）：站长在策展抽屉里就能把本地图片传到 R2 并直接参展，
  // 不用再去博客编辑页上传一遍。上传成功即加入展览且默认公开。
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef(null);
  // 动态壁纸上传（2026-10-12 新增）：与图片上传完全分开的一组状态，
  // 因为两者目标接口、进度节奏、失败提示都不一样。
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const videoRef = useRef(null);
  const [wpDrafts, setWpDrafts] = useState({});
  // 批量公开进行中标记：'' | 'wp'（动态壁纸）| 'pic'（图片）
  const [bulkBusy, setBulkBusy] = useState('');

  useEffect(() => {
    let alive = true;
    api.listAssets('?limit=60')
      .then((res) => { if (alive) setAssets(res?.items || []); })
      .catch((err) => toastError(err.message))
      .finally(() => { if (alive) setLoading(false); });
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { alive = false; document.removeEventListener('keydown', onKey); };
  }, []);

  const reloadAssets = async () => {
    try {
      const res = await api.listAssets('?limit=60');
      setAssets(res?.items || []);
    } catch { /* 忽略刷新失败，不影响已上传的展览项 */ }
  };

  // 上传本地图片 → 落 R2 → 直接加入展览（默认公开）
  async function uploadFiles(files) {
    const list = Array.from(files || []).filter((f) => f.type.startsWith('image/'));
    if (!list.length) return;
    setUploading(true);
    let ok = 0;
    try {
      for (const file of list) {
        setProgress(0);
        const asset = await uploadAsset(file, { onProgress: setProgress });
        // 标题用去掉扩展名的文件名，站长之后可在下方逐条改
        const title = String(file.name || '').replace(/\.[^.]+$/, '').slice(0, 200);
        await api.createGalleryItem({ asset_id: asset.id, title: title || null, is_public: true });
        ok += 1;
      }
      toastSuccess(ok > 1 ? `已上传并展出 ${ok} 张` : '已上传并展出');
      await reloadAssets();
      await onReload();
    } catch (err) {
      toastError(err.message);
      if (ok) { await reloadAssets(); await onReload(); }   // 部分成功也要把已成功的显示出来
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  // 上传本地视频 → 落 R2（wallpapers/ 前缀）→ 默认私人，站长在下方显式公开才对外可见。
  // 视频比图片大也更敏感，因此不跟图片一样「上传即公开」，避免误公开。
  async function uploadVideos(files) {
    const list = Array.from(files || []).filter((f) =>
      f.type.startsWith('video/') || /\.(mp4|webm)$/i.test(f.name || ''));
    if (!list.length) {
      toastError('只支持 MP4 / WebM 视频');
      return;
    }
    setVideoUploading(true);
    let ok = 0;
    try {
      for (const file of list) {
        setVideoProgress(0);
        await uploadWallpaper(file, { onProgress: setVideoProgress });
        ok += 1;
      }
      toastSuccess(ok > 1 ? `已上传 ${ok} 个动态壁纸（默认私人，记得公开）` : '已上传动态壁纸（默认私人，记得公开）');
      await onReload();
    } catch (err) {
      toastError(err.message);
      if (ok) await onReload();   // 部分成功也要把已成功的显示出来
    } finally {
      setVideoUploading(false);
      setVideoProgress(0);
    }
  }

  const existing = useMemo(() => new Set(items.map((i) => i.image?.url)), [items]);

  async function add(asset) {
    try {
      await api.createGalleryItem({ asset_id: asset.id });
      toastSuccess('已加入展览（默认私人，可单独设为公开）');
      await onReload();
    } catch (err) { toastError(err.message); }
  }

  function baseDraft(item) {
    return {
      title: item.title || '',
      description: item.description || '',
      captured_at: item.captured_at ? String(item.captured_at).slice(0, 10) : '',
      sort_order: item.sort_order ?? 0,
      is_public: !!item.is_public
    };
  }
  const draftOf = (item) => ({ ...baseDraft(item), ...(drafts[item.id] || {}) });
  const setDraft = (item, patch) => setDrafts((d) => ({ ...d, [item.id]: { ...draftOf(item), ...patch } }));

  async function save(item) {
    const d = draftOf(item);
    try {
      await api.updateGalleryItem(item.id, {
        title: d.title || null,
        description: d.description || null,
        captured_at: d.captured_at || null,
        sort_order: Number(d.sort_order) || 0,
        is_public: !!d.is_public
      });
      toastSuccess('已保存');
      await onReload();
    } catch (err) { toastError(err.message); }
  }

  async function remove(item) {
    if (!confirm('只从展览移除，不会删除原图。确定？')) return;
    try {
      await api.deleteGalleryItem(item.id);
      toastSuccess('已移出展览');
      await onReload();
    } catch (err) { toastError(err.message); }
  }

  // ---- 动态壁纸的草稿 / 保存 / 删除（与图片各自独立，避免 id 撞车） ----
  function wpDraftOf(item) {
    return {
      title: item.title || '',
      description: item.description || '',
      sort_order: item.sort_order ?? 0,
      is_public: !!item.is_public,
      ...(wpDrafts[item.id] || {})
    };
  }
  const setWpDraft = (item, patch) =>
    setWpDrafts((d) => ({ ...d, [item.id]: { ...wpDraftOf(item), ...patch } }));

  async function saveWallpaper(item) {
    const d = wpDraftOf(item);
    try {
      await api.updateWallpaper(item.id, {
        title: d.title || null,
        description: d.description || null,
        sort_order: Number(d.sort_order) || 0,
        is_public: !!d.is_public
      });
      toastSuccess('已保存');
      await onReload();
    } catch (err) { toastError(err.message); }
  }

  async function removeWallpaper(item) {
    if (!confirm('会同时删除 R2 上的视频文件，确定？')) return;
    try {
      await api.deleteWallpaper(item.id);
      toastSuccess('已删除动态壁纸');
      await onReload();
    } catch (err) { toastError(err.message); }
  }

  // ---- 批量公开（2026-10-12 用户要求）----
  // 「不要我一个一个去点」：把当前列表里**还没公开**的条目一次性打开公开。
  // 逐个 PATCH（接口只支持单条），串行执行 + 计数；失败不中断，最后统一报结果。
  async function publishAll(kind) {
    const list = kind === 'wallpaper' ? wallpapers : items;
    const pending = list.filter((it) => !it.is_public);
    if (!pending.length) { toastSuccess('都已经公开了'); return; }
    if (!confirm(`把 ${pending.length} 个还没公开的${kind === 'wallpaper' ? '动态壁纸' : '图片'}全部设为公开？`)) return;
    if (kind === 'wallpaper') setBulkBusy('wp'); else setBulkBusy('pic');
    let ok = 0;
    let failed = 0;
    try {
      for (const it of pending) {
        try {
          if (kind === 'wallpaper') await api.updateWallpaper(it.id, { is_public: true });
          else await api.updateGalleryItem(it.id, { is_public: true });
          ok += 1;
        } catch { failed += 1; }
      }
      if (failed) toastError(`已公开 ${ok} 个，${failed} 个失败，可重试`);
      else toastSuccess(`已公开 ${ok} 个`);
      await onReload();
    } finally {
      setBulkBusy('');
    }
  }

  return createPortal((
    <div class="gl-drawer-mask" onClick={onClose}>
      <aside class="gl-drawer" role="dialog" aria-modal="true" aria-label="策展" onClick={(e) => e.stopPropagation()}>
        <header class="gl-drawer-head">
          <strong>策展</strong>
          <button type="button" class="gl-lb-close" onClick={onClose} aria-label="关闭"><Icon name="close" size={18} /></button>
        </header>

        <section class="gl-drawer-sec">
          <h4>上传新图片</h4>
          <div class="gl-upload">
            <button
              type="button"
              class="primary"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="plus" size={15} /> {uploading ? `上传中 ${progress}%` : '选择图片上传'}
            </button>
            <span class="muted">上传后自动同步到 R2，并直接加入展览（默认公开）。</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => { uploadFiles(e.currentTarget.files); e.currentTarget.value = ''; }}
            />
          </div>
        </section>

        <section class="gl-drawer-sec">
          <h4>从已有素材加入展览</h4>
          {loading ? <span class="muted">正在载入素材…</span> : assets.length === 0 ? (
            <span class="muted">还没有素材，用上面的按钮上传第一张。</span>
          ) : (
            <div class="gl-asset-grid">
              {assets.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  class="gl-asset"
                  disabled={existing.has(a.public_url)}
                  title={existing.has(a.public_url) ? '已在展览中' : (a.original_name || '加入展览')}
                  onClick={() => add(a)}
                >
                  <img src={a.public_url} alt={a.original_name || '素材'} loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section class="gl-drawer-sec">
          <h4>上传动态壁纸（MP4 / WebM）</h4>
          <div class="gl-upload">
            <button
              type="button"
              class="primary"
              disabled={videoUploading}
              onClick={() => videoRef.current?.click()}
            >
              <Icon name="video" size={15} /> {videoUploading ? `上传中 ${videoProgress}%` : '选择视频上传'}
            </button>
            <span class="muted">
              视频存到 R2 的 wallpapers/ 前缀，与静态图片分开；单个上限 100MB。
              上传后默认私人，在下方打开「公开」才会出现在动态壁纸区。
            </span>
            <input
              ref={videoRef}
              type="file"
              accept="video/mp4,video/webm,.mp4,.webm"
              multiple
              hidden
              onChange={(e) => { uploadVideos(e.currentTarget.files); e.currentTarget.value = ''; }}
            />
          </div>
        </section>

        <section class="gl-drawer-sec">
          <h4>
            动态壁纸（{wallpapers.length}）
            {wallpapers.some((w) => !w.is_public) && (
              <button
                type="button"
                class="gl-bulk"
                disabled={bulkBusy === 'wp'}
                onClick={() => publishAll('wallpaper')}
                title="把还没公开的动态壁纸一次性设为公开"
              >
                {bulkBusy === 'wp' ? '公开中…' : `一键公开全部（${wallpapers.filter((w) => !w.is_public).length}）`}
              </button>
            )}
          </h4>
          {wallpapers.length === 0 && <span class="muted">还没有动态壁纸。</span>}
          {wallpapers.map((item) => {
            const d = wpDraftOf(item);
            return (
              <div key={item.id} class="gl-edit">
                <video class="gl-edit-thumb" src={api.wallpaperFileUrl(item.id)} muted loop playsInline preload="metadata" />
                <div class="gl-edit-fields">
                  <input placeholder="标题" value={d.title} onInput={(e) => setWpDraft(item, { title: e.currentTarget.value })} />
                  <textarea placeholder="说明" value={d.description} onInput={(e) => setWpDraft(item, { description: e.currentTarget.value })} />
                  <div class="gl-edit-row">
                    <input type="number" value={d.sort_order} title="排序（越大越靠前）" onInput={(e) => setWpDraft(item, { sort_order: e.currentTarget.value })} />
                    <label class="gl-switch">
                      <input type="checkbox" checked={d.is_public} onChange={(e) => setWpDraft(item, { is_public: e.currentTarget.checked })} />
                      公开
                    </label>
                  </div>
                  <div class="gl-edit-row">
                    <button type="button" class="primary" onClick={() => saveWallpaper(item)}>保存</button>
                    <button type="button" onClick={() => removeWallpaper(item)}>删除</button>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section class="gl-drawer-sec">
          <h4>
            已加入（{items.length}）
            {items.some((i) => !i.is_public) && (
              <button
                type="button"
                class="gl-bulk"
                disabled={bulkBusy === 'pic'}
                onClick={() => publishAll('picture')}
                title="把还没公开的图片一次性设为公开"
              >
                {bulkBusy === 'pic' ? '公开中…' : `一键公开全部（${items.filter((i) => !i.is_public).length}）`}
              </button>
            )}
          </h4>
          {items.length === 0 && <span class="muted">展览还是空的。</span>}
          {items.map((item) => {
            const d = draftOf(item);
            return (
              <div key={item.id} class="gl-edit">
                <img src={item.image.url} alt="" class="gl-edit-thumb" />
                <div class="gl-edit-fields">
                  <input placeholder="标题" value={d.title} onInput={(e) => setDraft(item, { title: e.currentTarget.value })} />
                  <textarea placeholder="说明" value={d.description} onInput={(e) => setDraft(item, { description: e.currentTarget.value })} />
                  <div class="gl-edit-row">
                    <input type="date" value={d.captured_at} onInput={(e) => setDraft(item, { captured_at: e.currentTarget.value })} />
                    <input type="number" value={d.sort_order} title="排序（越大越靠前）" onInput={(e) => setDraft(item, { sort_order: e.currentTarget.value })} />
                    <label class="gl-switch">
                      <input type="checkbox" checked={d.is_public} onChange={(e) => setDraft(item, { is_public: e.currentTarget.checked })} />
                      公开
                    </label>
                  </div>
                  <div class="gl-edit-row">
                    <button type="button" class="primary" onClick={() => save(item)}>保存</button>
                    <button type="button" onClick={() => remove(item)}>移出展览</button>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      </aside>
    </div>
  ), document.body);
}

export function Gallery() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [wallpapers, setWallpapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openIndex, setOpenIndex] = useState(null);      // 图片灯箱，null = 关闭
  const [openWall, setOpenWall] = useState(null);        // 动态壁纸灯箱，null = 关闭
  const [curating, setCurating] = useState(false);
  const [expandPics, setExpandPics] = useState(false);   // 图片区是否展开全部
  const [expandWalls, setExpandWalls] = useState(false); // 动态壁纸区是否展开全部
  const [masonryRef, masonryWidth] = useMeasuredWidth();   // 静态图片区容器宽度
  const cols = useColumns();

  const limit = cols * COLLAPSE_ROWS;

  async function load() {
    setError('');
    try {
      // 两个区各自拉取；其中一个失败不应该让整页变成错误页，
      // 因此用 allSettled，再把失败的那一半当作空列表（页面里另有空态文案）。
      const [pics, walls] = await Promise.allSettled([
        api.listGallery('?limit=200'),
        api.listWallpapers('?limit=200')
      ]);
      if (pics.status === 'fulfilled') setItems(pics.value?.items || []);
      if (walls.status === 'fulfilled') setWallpapers(walls.value?.items || []);
      if (pics.status === 'rejected' && walls.status === 'rejected') {
        throw pics.reason || walls.reason;
      }
      // 只有一边失败时用一条轻提示说明，不把整页变成错误页。
      // 壁纸区失败最常见的原因是线上还没跑 wallpapers 表迁移，提示里说清楚，
      // 免得站长以为「上传了但没生效」。
      const problems = [];
      if (pics.status === 'rejected') problems.push(`图片加载失败：${pics.reason?.message || '未知错误'}`);
      if (walls.status === 'rejected') problems.push(`动态壁纸加载失败：${walls.reason?.message || '未知错误'}`);
      if (problems.length) setError(problems.join('；'));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const nothing = !items.length && !wallpapers.length;
  if (loading && nothing) return <LoadingState shape="card" count={8} />;
  if (error && nothing) return <ErrorState title="图展加载失败" message={error} onRetry={load} />;

  const publicCount = items.filter((i) => i.is_public).length;
  const shownWalls = expandWalls ? wallpapers : wallpapers.slice(0, limit);

  // 静态图片：把所有图片排成「等高整行」，再按行折叠。
  // 容器还没量到宽度时用 1200 兜底先排一版（避免首帧空白），量到后立刻重排。
  // 每一项把原 item 摊平带上 w / h，justifyRows 会回填实际渲染的 width / height。
  const allPicRows = useMemo(() => {
    const containerWidth = masonryWidth || 1200;
    const { target, max } = rowHeights(masonryWidth);
    return justifyRows(
      items.map((it, i) => ({
        ...it,
        __i: i,             // 灯箱用的原始下标（展开 / 收起都指向 items 里的同一张）
        w: Number(it.image?.width) || 4,
        h: Number(it.image?.height) || 3
      })),
      {
        containerWidth,
        gap: ROW_GAP,
        targetRowHeight: target,
        maxRowHeight: max
      }
    );
  }, [items, masonryWidth]);

  // 折叠按**整行**切，而不是按张数切：整齐排版下一行是等高的，
  // 按张数切会在行中间断开，底部留出一行「半截」的图片（就是用户说的「不协调」）。
  const picRows = expandPics ? allPicRows : allPicRows.slice(0, COLLAPSE_ROWS);
  const shownPicCount = picRows.reduce((n, row) => n + row.items.length, 0);

  return (
    <section class="gl-page">
      <PageHeader
        kicker="Gallery"
        title="图展"
        sub="静态图片与动态壁纸。点击任意一张原地放大查看。"
        stats={[
          { label: '图片', value: items.length },
          { label: '动态壁纸', value: wallpapers.length },
          { label: '公开图片', value: publicCount }
        ]}
      >
        {isAdmin && (
          <button type="button" class="primary" onClick={() => setCurating(true)}>
            <Icon name="grid" size={16} /> 策展
          </button>
        )}
      </PageHeader>

      {error && !nothing && <p class="gl-partial-error">{error}</p>}

      {/* ---- 静态图片区 ---- */}
      <section class="gl-section">
        <header class="gl-sec-head">
          <h2>静态图片</h2>
          <span class="gl-sec-count">{items.length} 张</span>
        </header>
        {items.length === 0 ? (
          <EmptyState
            icon="grid"
            title="还没有图片"
            hint={isAdmin ? '点右上角「策展」，从已上传的素材里挑几张加入图展。' : '站长还没有公开任何图片。'}
          />
        ) : (
          <>
            <div class="gl-rows" ref={masonryRef} style={`--gl-gap:${ROW_GAP}px`}>
              {picRows.map((row, ri) => (
                <div class="gl-row" key={`row-${ri}`} style={`--gl-row-h:${row.height}px`}>
                  {row.items.map((item, ci) => (
                    <figure
                      key={item.id}
                      class="gl-item"
                      style={`--gl-i:${ri * 3 + ci}; --gl-w:${item.width}px`}
                    >
                      <button type="button" class="gl-figure" data-tilt="3" onClick={() => setOpenIndex(item.__i)}>
                        <img
                          src={item.image.url}
                          alt={item.image.alt || item.title || ''}
                          loading="lazy"
                          decoding="async"
                          style={ratioStyle(item.image)}
                        />
                      </button>
                      {(item.title || item.captured_at || item.description) && (
                        <figcaption class="gl-cap">
                          {item.title && <strong>{item.title}</strong>}
                          {item.description && <span>{item.description}</span>}
                          {item.captured_at && <time>{fmtDate(item.captured_at)}</time>}
                        </figcaption>
                      )}
                    </figure>
                  ))}
                </div>
              ))}
            </div>
            {(expandPics || items.length > shownPicCount) && (
              <div class="gl-more">
                <button type="button" class="gl-more-btn" onClick={() => setExpandPics((v) => !v)}>
                  {expandPics ? '收起' : `查看更多（还有 ${items.length - shownPicCount} 张）`}
                  <Icon name={expandPics ? 'chevronDown' : 'chevronRight'} size={15} />
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* ---- 动态壁纸区 ---- */}
      <section class="gl-section">
        <header class="gl-sec-head">
          <h2>动态壁纸</h2>
          <span class="gl-sec-count">{wallpapers.length} 个</span>
        </header>
        {wallpapers.length === 0 ? (
          <EmptyState
            icon="video"
            title="还没有动态壁纸"
            hint={isAdmin ? '点右上角「策展」，在「上传动态壁纸」里选 MP4 / WebM 视频。' : '站长还没有公开任何动态壁纸。'}
          />
        ) : (
          <>
            <div class="gl-masonry gl-wall-grid">
              {shownWalls.map((item, idx) => (
                <WallpaperCard key={item.id} item={item} index={idx} onOpen={() => setOpenWall(idx)} />
              ))}
            </div>
            {wallpapers.length > limit && (
              <div class="gl-more">
                <button type="button" class="gl-more-btn" onClick={() => setExpandWalls((v) => !v)}>
                  {expandWalls ? '收起' : `查看更多（还有 ${wallpapers.length - limit} 个）`}
                  <Icon name={expandWalls ? 'chevronDown' : 'chevronRight'} size={15} />
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {openIndex !== null && items.length > 0 && (
        <Lightbox
          items={items}
          index={Math.min(Math.max(openIndex, 0), items.length - 1)}
          onClose={() => setOpenIndex(null)}
          onIndex={(i) => setOpenIndex((i + items.length) % items.length)}
        />
      )}
      {openWall !== null && wallpapers.length > 0 && (
        <WallpaperLightbox
          items={wallpapers}
          index={Math.min(Math.max(openWall, 0), wallpapers.length - 1)}
          onClose={() => setOpenWall(null)}
          onIndex={(i) => setOpenWall((i + wallpapers.length) % wallpapers.length)}
        />
      )}
      {curating && isAdmin && (
        <CuratorDrawer
          items={items}
          wallpapers={wallpapers}
          onClose={() => setCurating(false)}
          onReload={load}
        />
      )}
    </section>
  );
}
