// 图片展览（/gallery）：一个「策展感」的图片展厅，而不是普通卡片网格。
//
// 设计取舍：
// 1) 用纯 CSS columns 做错落 masonry（无第三方依赖），手机单列 / 平板双列。
// 2) 点击图片进灯箱：Esc 关闭、方向键切换、锁滚动、焦点回到触发元素。
// 3) 管理员才显示「策展」抽屉（从最近素材加入展览、改元数据、公开/私人、移出展览）；
//    访客只看到公开展览，看不到任何管理入口。
// 4) 样式集中在 styles/gallery-timeline.css（.gl-*），不动 global.css。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { api, uploadAsset } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
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

// ---------------- 管理抽屉 ----------------
function CuratorDrawer({ items, onClose, onReload }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});
  // 直接上传（2026-10-11 用户要求）：站长在策展抽屉里就能把本地图片传到 R2 并直接参展，
  // 不用再去博客编辑页上传一遍。上传成功即加入展览且默认公开。
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef(null);

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
          <h4>已加入（{items.length}）</h4>
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openIndex, setOpenIndex] = useState(null);   // null = 灯箱关闭
  const [curating, setCurating] = useState(false);

  async function load() {
    setError('');
    try {
      const res = await api.listGallery('?limit=200');
      setItems(res?.items || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  if (loading && !items.length) return <LoadingState shape="card" count={8} />;
  if (error && !items.length) return <ErrorState title="展览加载失败" message={error} onRetry={load} />;

  const publicCount = items.filter((i) => i.is_public).length;

  return (
    <section class="gl-page">
      <PageHeader
        kicker="Gallery"
        title="图片展览"
        sub="一些值得留下的画面。点击任意一张放大查看。"
        stats={[
          { label: '展出', value: items.length },
          { label: '公开', value: publicCount }
        ]}
      >
        {isAdmin && (
          <button type="button" class="primary" onClick={() => setCurating(true)}>
            <Icon name="grid" size={16} /> 策展
          </button>
        )}
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          icon="grid"
          title="展厅还空着"
          hint={isAdmin ? '点右上角「策展」，从已上传的素材里挑几张加入展览。' : '站长还没有公开任何图片。'}
        />
      ) : (
        <div class="gl-masonry">
          {items.map((item, idx) => (
            <figure key={item.id} class="gl-item" style={`--gl-i:${idx}`}>
              <button type="button" class="gl-figure" data-tilt="3" onClick={() => setOpenIndex(idx)}>
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
      )}

      {openIndex !== null && items.length > 0 && (
        <Lightbox
          items={items}
          index={Math.min(Math.max(openIndex, 0), items.length - 1)}
          onClose={() => setOpenIndex(null)}
          onIndex={(i) => setOpenIndex((i + items.length) % items.length)}
        />
      )}
      {curating && isAdmin && (
        <CuratorDrawer items={items} onClose={() => setCurating(false)} onReload={load} />
      )}
    </section>
  );
}
