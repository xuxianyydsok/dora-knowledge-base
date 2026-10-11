// 图书（/books）：电子书书架 + 站内阅读。
//
// 设计取舍（2026-10-11 第三轮上线，前两轮曾因单本过大整体下线）：
// 1) 书架是「封面墙」：2:3 竖版封面 + 书脊高光，悬停轻抬。封面来自后端上传时
//    自动提取（EPUB 解析 OPF / PDF 抽第一页 JPEG / MOBI 读 EXTH），**前端不碰正文**，
//    所以 100MB 的书在书架页也只有一张小图要下载。
// 2) 点击封面就地弹出阅读器（不跳路由、不滚动页面），**默认在线阅读**：
//    PDF   → <iframe> 内嵌浏览器自带阅读器（后端支持 Range，可翻页）；
//    EPUB  → 用 lib/epubReader.js 在浏览器里解压并渲染章节，带章节目录；
//    MOBI / AZW3 → 浏览器无法直接渲染，如实说明「暂不支持在线阅读」。
//    2026-10-11 用户要求：点击书先在线阅读，**不强制下载**；阅读器里另给一个「下载」
//    按钮，想存到本地的读者可以自己下（不给 MOBI/AZW3 以外的格式限制）。
// 3) 站长多一整套管理：拖拽上传（带进度）、改书名/作者/简介、公开/私人切换、删除。
//    普通访客与登录用户只看到公开书，看不到任何管理入口。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { api, uploadBook } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { LoadingState, ErrorState } from '../components/StateView.jsx';
import { Icon } from '../components/Icon.jsx';
import { toastError, toastSuccess } from '../lib/toast.jsx';
import '../styles/wenkai.css';
import '../styles/books.css';

// 支持的格式（与后端 bookType.js 白名单一致）
const FORMATS = [
  { key: '', label: '全部' },
  { key: 'epub', label: 'EPUB' },
  { key: 'pdf', label: 'PDF' },
  { key: 'mobi', label: 'MOBI' },
  { key: 'azw3', label: 'AZW3' }
];

// 可站内阅读的格式（其余只能下载）
const READABLE = new Set(['pdf', 'epub']);

const ACCEPT = '.epub,.pdf,.mobi,.azw3,application/epub+zip,application/pdf';

function fmtSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------------- 单本书的封面 ----------------
function BookCover({ book }) {
  const [broken, setBroken] = useState(false);
  const title = book.title || '未命名';
  if (book.cover_url && !broken) {
    return (
      <div class="bk-cover">
        <img
          src={book.cover_url}
          alt={`《${title}》封面`}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
        />
        <span class={`bk-fmt${READABLE.has(book.format) ? ' readable' : ''}`}>{book.format}</span>
        {!book.is_public && <span class="bk-private">私人</span>}
      </div>
    );
  }
  return (
    <div class="bk-cover">
      <div class="bk-cover-blank"><span>{title}</span></div>
      <span class={`bk-fmt${READABLE.has(book.format) ? ' readable' : ''}`}>{book.format}</span>
      {!book.is_public && <span class="bk-private">私人</span>}
    </div>
  );
}

// ---------------- 编辑弹层（仅站长） ----------------
function EditDialog({ book, onClose, onSaved }) {
  const [draft, setDraft] = useState({
    title: book.title || '',
    author: book.author || '',
    description: book.description || '',
    is_public: !!book.is_public,
    sort_order: book.sort_order ?? 0
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.updateBook(book.id, {
        // 用空字符串而不是 null：后端 optionalString 把 null 当「不改」，
        // 传 null 就没法把书名清空。
        title: draft.title.trim(),
        author: draft.author.trim(),
        description: draft.description.trim(),
        is_public: !!draft.is_public,
        sort_order: Number(draft.sort_order) || 0
      });
      toastSuccess('已保存');
      onSaved();
    } catch (err) {
      toastError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return createPortal((
    <div class="bk-reader" role="dialog" aria-modal="true" aria-label="编辑图书信息" onClick={onClose}>
      <div class="bk-reader-bar" onClick={(e) => e.stopPropagation()}>
        <div class="bk-reader-title">
          <strong>编辑图书信息</strong>
          <span>{book.original_name || book.format}</span>
        </div>
        <div class="bk-reader-tools">
          <button type="button" onClick={onClose}>取消</button>
          <button type="button" class="primary" disabled={saving} onClick={save}>
            <Icon name="check" size={15} /><span>{saving ? '保存中…' : '保存'}</span>
          </button>
        </div>
      </div>
      <div class="bk-reader-body" onClick={(e) => e.stopPropagation()} style="overflow:auto;padding:24px">
        <div style="max-width:560px;margin:0 auto;display:flex;flex-direction:column;gap:16px">
          <label class="field">
            <span>书名</span>
            <input value={draft.title} onInput={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="书名" />
          </label>
          <label class="field">
            <span>作者</span>
            <input value={draft.author} onInput={(e) => setDraft((d) => ({ ...d, author: e.target.value }))} placeholder="作者" />
          </label>
          <label class="field">
            <span>简介</span>
            <textarea rows={5} value={draft.description} onInput={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="这本书讲了什么" />
          </label>
          <label class="field">
            <span>排序权重（越大越靠前）</span>
            <input type="number" value={draft.sort_order} onInput={(e) => setDraft((d) => ({ ...d, sort_order: e.target.value }))} />
          </label>
          <label class="mo-check" style="display:flex;align-items:center;gap:8px">
            <input type="checkbox" checked={draft.is_public} onChange={(e) => setDraft((d) => ({ ...d, is_public: e.target.checked }))} />
            <span>公开（访客可见可读）</span>
          </label>
        </div>
      </div>
    </div>
  ), document.body);
}

// ---------------- 阅读器 ----------------
// PDF：iframe 直嵌（浏览器自带阅读器 + 后端 Range 支持，可翻页 / 缩放 / 全屏）。
// EPUB：动态 import epubReader.js，解压 → 清洗 → srcDoc 渲染，带章节目录。
//       排版（字号 / 字体 / 背景 / 单双页）由宿主往 iframe 里注入一份 <style> 实时覆盖，
//       章节 HTML 只生成一次，所以调设置时阅读位置不会丢。
//       翻页：方向键 / 滚轮 / 触屏上下滑；章节内滚到尽头再继续滚才翻章，避免误翻。
// 其余格式：给出下载入口并说明原因。

// 阅读器设置（字号 / 字体 / 背景 / 单双页）全部持久化到 localStorage，键名 bk:reader:*。
const READER_FONTS = [
  { key: 'wenkai', label: '霞鹜文楷', stack: '"LXGW WenKai","Noto Serif SC","Songti SC",Georgia,serif' },
  { key: 'song', label: '宋体', stack: '"Noto Serif SC","Source Han Serif SC","Songti SC","SimSun",Georgia,serif' },
  { key: 'hei', label: '黑体', stack: '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",-apple-system,"Segoe UI",sans-serif' },
  { key: 'kai', label: '楷体', stack: '"Kaiti SC","KaiTi","STKaiti","LXGW WenKai",serif' },
  { key: 'fangsong', label: '仿宋', stack: '"FangSong","STFangsong","Songti SC",serif' },
  { key: 'newsreader', label: 'Newsreader', stack: '"Newsreader","Noto Serif SC",Georgia,"Songti SC",serif' }
];

const READER_BACKGROUNDS = [
  { key: 'paper', label: '纸白', bg: '#ffffff', fg: '#1c1e21', link: '#1a6fd4' },
  { key: 'sepia', label: '米黄', bg: '#f6ecd8', fg: '#3a2f22', link: '#8a5a1f' },
  { key: 'mint', label: '淡青', bg: '#e8f4f0', fg: '#1f3330', link: '#0f7a63' },
  { key: 'night', label: '夜间', bg: '#16181c', fg: '#c9ccd1', link: '#8ab4f8' }
];

const READER_SIZES = [15, 17, 19, 21, 23];
const READER_DEFAULTS = { size: 17, font: 'wenkai', bg: 'paper', spread: 'single' };

// 读持久化设置：坏值 / 越界值一律退回默认，避免把阅读器搞崩
function loadReaderPrefs() {
  const out = { ...READER_DEFAULTS };
  try {
    const size = Number(localStorage.getItem('bk:reader:size'));
    if (READER_SIZES.includes(size)) out.size = size;
    const font = localStorage.getItem('bk:reader:font');
    if (READER_FONTS.some((f) => f.key === font)) out.font = font;
    const bg = localStorage.getItem('bk:reader:bg');
    if (READER_BACKGROUNDS.some((b) => b.key === bg)) out.bg = bg;
    const spread = localStorage.getItem('bk:reader:spread');
    if (spread === 'single' || spread === 'double') out.spread = spread;
  } catch { /* 隐私模式下 localStorage 会抛错，用默认值即可 */ }
  return out;
}

function saveReaderPref(key, value) {
  try { localStorage.setItem(`bk:reader:${key}`, String(value)); } catch { /* 忽略 */ }
}

// 注入 iframe 的排版样式：改字号 / 字体 / 背景 / 单双页都只换这一份 <style>
function readerExtraCss(prefs, twoUp) {
  const font = READER_FONTS.find((f) => f.key === prefs.font) || READER_FONTS[0];
  const bg = READER_BACKGROUNDS.find((b) => b.key === prefs.bg) || READER_BACKGROUNDS[0];
  return ':root {'
    + `--epub-bg:${bg.bg}; --epub-fg:${bg.fg}; --epub-link:${bg.link};`
    + `--epub-font:${font.stack};`
    + `--epub-size:${prefs.size}px;`
    + `--epub-columns:${twoUp ? 2 : 1};`
    + '}';
}

function Reader({ book, onClose }) {
  const [loading, setLoading] = useState(book.format === 'epub');
  const [error, setError] = useState('');
  const [chapters, setChapters] = useState([]);
  const [index, setIndex] = useState(0);
  const [html, setHtml] = useState('');
  const [tocOpen, setTocOpen] = useState(false);
  const epubRef = useRef(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefs, setPrefs] = useState(loadReaderPrefs);
  const [percent, setPercent] = useState(0);
  const [dragIndex, setDragIndex] = useState(null);
  const bodyRef = useRef(null);
  const iframeRef = useRef(null);
  const settingsRef = useRef(null);
  const cleanupRef = useRef(null);

  const isEpub = book.format === 'epub';

  // 双页阅读：窄屏（<900px）强制回单页，否则手机上两栏会挤成一条
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 900);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const twoUp = prefs.spread === 'double' && !narrow;

  // 往 iframe 的 <head> 里维护唯一一份排版样式（改设置时替换，不追加，避免越堆越多）。
  // 样式排在最后，所以能覆盖 epubReader 的基础排版和书自带的 CSS。
  function applyReaderStyle() {
    const win = iframeRef.current?.contentWindow;
    if (!win || !win.document || !win.document.head) return;
    let style = win.document.head.querySelector('style[data-bk-reader]');
    if (!style) {
      style = win.document.createElement('style');
      style.setAttribute('data-bk-reader', '1');
      win.document.head.appendChild(style);
    }
    style.textContent = readerExtraCss(prefs, twoUp);
  }

  // Esc：先关设置浮层 / 目录，都没有时才关阅读器；打开期间锁页面滚动（避免背景跟着动）
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (settingsOpen) setSettingsOpen(false);
      else if (tocOpen) setTocOpen(false);
      else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [settingsOpen, tocOpen]);

  // 点空白处收起设置浮层
  useEffect(() => {
    if (!settingsOpen) return undefined;
    const onDown = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) setSettingsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [settingsOpen]);

  // 设置变化 → 只往 iframe 里换一份样式表，不重新解压章节（滚动位置保持不变）
  useEffect(() => {
    if (!isEpub || !html) return;
    applyReaderStyle();
  }, [prefs, twoUp, html, isEpub]);

  // EPUB：加载 + 释放
  useEffect(() => {
    if (book.format !== 'epub') return undefined;
    let alive = true;
    let reader = null;
    (async () => {
      try {
        const mod = await import('../lib/epubReader.js');
        // 走 api.fetchBookFile：带 Authorization，站长上传的私人书登录后也能读
        const buf = await api.fetchBookFile(book.id);
        reader = await mod.openEpub(buf);
        if (!alive) { reader.dispose(); return; }
        epubRef.current = reader;
        setChapters(reader.chapters || []);
        const first = await reader.loadChapter(0, { extraCss: readerExtraCss(prefs, twoUp) });
        if (!alive) return;
        setHtml(first.html);
        setIndex(0);
      } catch (err) {
        if (alive) setError(err.message || '电子书解析失败');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      try { reader?.dispose?.(); } catch { /* 释放失败不影响关闭 */ }
      epubRef.current = null;
    };
  }, [book.id]);

  async function goTo(i) {
    const reader = epubRef.current;
    if (!reader || busyRef.current) return;
    const n = reader.chapters.length;
    if (n === 0) return;
    const next = ((i % n) + n) % n;
    if (next === index) return;
    busyRef.current = true;
    setLoading(true);
    try {
      // 带 extraCss 重新生成章节：新文档的 :root 里已经写好当前排版，
      // 不会出现「刚换章时闪一下默认样式」。
      const res = await reader.loadChapter(next, { extraCss: readerExtraCss(prefs, twoUp) });
      setHtml(res.html);
      setIndex(next);
      setTocOpen(false);
      setPercent(0);
    } catch (err) {
      toastError(err.message || '章节加载失败');
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }

  // 当前章节内的阅读容器：单栏时是 iframe 自己的 document，
  // 分栏时正文在 iframe 内部滚动，同样取 iframe 文档。
  function chapterScroller() {
    const win = iframeRef.current?.contentWindow;
    if (win && win.document) return win.document.scrollingElement || win.document.documentElement;
    return null;
  }

  // 章节内滚动进度（0–100）。分栏模式下同一套公式即为「第几屏 / 共几屏」。
  // EPUB 的正文在 iframe 里滚动，所以取 iframe 的滚动容器；其余格式取外层容器。
  function onBodyScroll() {
    const el = (isEpub ? chapterScroller() : null) || bodyRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setPercent(max > 4 ? Math.round((el.scrollTop / max) * 100) : 100);
  }

  function setPref(patch) {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      Object.entries(patch).forEach(([k, v]) => saveReaderPref(k, v));
      return next;
    });
  }

  // 上一章 / 下一章：章节内先回到顶部，翻章后由 scrollTop 重置自然完成
  function turn(delta) {
    goTo(index + delta);
  }

  // 拖动进度条跳章（章节切换本身有 loading，这里防抖一点）
  function jumpChapter(value) {
    const i = Math.max(0, Math.min(total - 1, Number(value) - 1));
    if (i === index) return;
    goTo(i);
  }

  // ---- EPUB 翻页输入：方向键 / 滚轮 / 触屏上下滑 ----
  // 规则：章节内还没滚到底 → 交给浏览器正常滚动；已经滚到底再继续滚 → 翻章。
  function step(dir) {
    const el = chapterScroller();
    if (el && el.scrollHeight - el.clientHeight > 4) {
      // 一屏的 88%，比整屏少一点，读者能看到衔接处
      const by = Math.max(120, Math.round(el.clientHeight * 0.88));
      if (dir > 0) el.scrollTop = Math.min(el.scrollTop + by, el.scrollHeight);
      else el.scrollTop = Math.max(el.scrollTop - by, 0);
      onBodyScroll();
      return;
    }
    // 章节只有一屏（短章节）：直接翻章
    goTo(index + dir);
  }

  // 用一个 ref 包住 step / goTo，事件监听只挂一次也能拿到最新状态
  const navApi = useRef({});
  navApi.current = { step, onBodyScroll, goTo };
  const busyRef = useRef(false);

  // EPUB：把翻页输入挂到 iframe 内部（滚轮 / 触屏上下滑 / 方向键 / 空格 / PgUp·PgDn）。
  // iframe 里章节内的链接点击也在这里兜住：命中 data-epub-href 就翻到对应章节。
  function attachEpubInput() {
    const win = iframeRef.current?.contentWindow;
    if (!win || !win.document) return;
    applyReaderStyle(); // srcDoc 解析完成后立刻套上当前排版设置
    cleanupRef.current?.();
    const api_ = navApi.current;

    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) return; // 让 Ctrl+滚轮 缩放正常生效
      const el = win.document.scrollingElement || win.document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 4) { e.preventDefault(); api_.step(e.deltaY > 0 ? 1 : -1); return; }
      if (e.deltaY > 0 && el.scrollTop >= max - 2) { e.preventDefault(); api_.step(1); }
      else if (e.deltaY < 0 && el.scrollTop <= 2) { e.preventDefault(); api_.step(-1); }
    };

    // 触屏：单指上下滑 → 正常滚动；滑到尽头再继续滑 → 翻章。
    // 双指上下滑 → 直接翻页（用户要的「双指上下滑动」手势）。
    let touch = null;
    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        touch = { multi: true, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 };
        return;
      }
      if (e.touches.length === 1) touch = { multi: false, y: e.touches[0].clientY };
    };
    const onTouchMove = (e) => {
      if (!touch || !touch.multi) return;
      if (e.touches.length !== 2) return;
      const y = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const dy = touch.y - y;
      if (Math.abs(dy) > 42) {
        e.preventDefault();
        touch.y = y;
        api_.step(dy > 0 ? 1 : -1);
      }
    };
    const onTouchEnd = () => { touch = null; };

    const onKey = (e) => {
      const t = e.target;
      const tag = (t && t.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'ArrowDown') { e.preventDefault(); api_.step(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); api_.step(-1); }
      else if (e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); api_.step(1); }
      else if (e.key === 'PageUp') { e.preventDefault(); api_.step(-1); }
    };

    const onClick = (e) => {
      const a = e.target?.closest?.('a[data-epub-href]');
      if (!a) return;
      e.preventDefault();
      const href = a.getAttribute('data-epub-href');
      const reader = epubRef.current;
      if (!reader) return;
      const i = reader.chapters.findIndex((c) => c.href === href);
      if (i >= 0) api_.goTo(i);
    };

    win.addEventListener('wheel', onWheel, { passive: false });
    win.addEventListener('touchstart', onTouchStart, { passive: true });
    win.addEventListener('touchmove', onTouchMove, { passive: false });
    win.addEventListener('touchend', onTouchEnd, { passive: true });
    win.addEventListener('keydown', onKey);
    win.addEventListener('click', onClick);
    win.addEventListener('scroll', api_.onBodyScroll, { passive: true });
    // 挂载后先算一次（有些章节一屏就到底）
    api_.onBodyScroll();

    cleanupRef.current = () => {
      try {
        win.removeEventListener('wheel', onWheel);
        win.removeEventListener('touchstart', onTouchStart);
        win.removeEventListener('touchmove', onTouchMove);
        win.removeEventListener('touchend', onTouchEnd);
        win.removeEventListener('keydown', onKey);
        win.removeEventListener('click', onClick);
        win.removeEventListener('scroll', api_.onBodyScroll);
      } catch { /* iframe 已销毁 */ }
      cleanupRef.current = null;
    };
  }

  // 组件卸载时摘掉挂在 iframe 上的监听
  useEffect(() => () => { cleanupRef.current?.(); }, []);

  const total = chapters.length;
  const canTurn = total > 1;
  const progressPct = canTurn ? ((index + percent / 100) / total) * 100 : percent;
  const chLabel = (i) => chapters[i]?.title || `第 ${i + 1} 章`;

  return createPortal((
    <div class="bk-reader" role="dialog" aria-modal="true" aria-label={`阅读《${book.title}》`}>
      <div class="bk-reader-bar">
        <div class="bk-reader-title">
          <strong>{book.title || '未命名'}</strong>
          <span>
            {book.author ? `${book.author} · ` : ''}
            {book.format.toUpperCase()}{canTurn ? ` · 第 ${index + 1} / ${total} 章` : ''}
          </span>
        </div>
        <div class="bk-reader-tools">
          {canTurn && (
            <>
              <button type="button" onClick={() => turn(-1)} title="上一章">
                <Icon name="chevronLeft" size={15} /><span>上一章</span>
              </button>
              <button type="button" onClick={() => setTocOpen((v) => !v)} title="目录">
                <Icon name="list" size={15} /><span>目录</span>
              </button>
              <button type="button" onClick={() => turn(1)} title="下一章">
                <span>下一章</span><Icon name="chevronRight" size={15} />
              </button>
            </>
          )}
          {isEpub && (
            <div class="bk-set-wrap" ref={settingsRef}>
              <button
                type="button"
                class={settingsOpen ? 'on' : ''}
                onClick={() => setSettingsOpen((v) => !v)}
                title="阅读设置"
                aria-expanded={settingsOpen}
              >
                <Icon name="sliders" size={15} /><span>阅读设置</span>
              </button>
              {settingsOpen && (
                <div class="bk-set" role="dialog" aria-label="阅读设置">
                  <div class="bk-set-group">
                    <span class="bk-set-label">背景</span>
                    <div class="bk-set-swatches">
                      {READER_BACKGROUNDS.map((b) => (
                        <button
                          key={b.key}
                          type="button"
                          class={`bk-swatch${prefs.bg === b.key ? ' on' : ''}`}
                          style={`--sw:${b.bg}`}
                          title={b.label}
                          aria-label={b.label}
                          onClick={() => setPref({ bg: b.key })}
                        ><span /></button>
                      ))}
                    </div>
                  </div>

                  <div class="bk-set-group">
                    <span class="bk-set-label">字号 <em>{prefs.size}px</em></span>
                    <div class="bk-set-row">
                      <button
                        type="button"
                        class="bk-set-btn"
                        disabled={prefs.size <= READER_SIZES[0]}
                        onClick={() => setPref({ size: READER_SIZES[Math.max(0, READER_SIZES.indexOf(prefs.size) - 1)] })}
                        title="减小字号"
                      >A−</button>
                      <input
                        class="bk-set-range"
                        type="range"
                        min={READER_SIZES[0]}
                        max={READER_SIZES[READER_SIZES.length - 1]}
                        step={2}
                        value={prefs.size}
                        onInput={(e) => setPref({ size: Number(e.target.value) })}
                      />
                      <button
                        type="button"
                        class="bk-set-btn"
                        disabled={prefs.size >= READER_SIZES[READER_SIZES.length - 1]}
                        onClick={() => setPref({ size: READER_SIZES[Math.min(READER_SIZES.length - 1, READER_SIZES.indexOf(prefs.size) + 1)] })}
                        title="增大字号"
                      >A+</button>
                    </div>
                  </div>

                  <div class="bk-set-group">
                    <span class="bk-set-label">字体</span>
                    <div class="bk-set-chips">
                      {READER_FONTS.map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          class={`bk-set-chip${prefs.font === f.key ? ' on' : ''}`}
                          style={`font-family:${f.stack}`}
                          onClick={() => setPref({ font: f.key })}
                        >{f.label}</button>
                      ))}
                    </div>
                  </div>

                  <div class="bk-set-group">
                    <span class="bk-set-label">版式</span>
                    <div class="bk-set-chips">
                      <button
                        type="button"
                        class={`bk-set-chip${prefs.spread === 'single' ? ' on' : ''}`}
                        onClick={() => setPref({ spread: 'single' })}
                      >单页</button>
                      <button
                        type="button"
                        class={`bk-set-chip${prefs.spread === 'double' ? ' on' : ''}`}
                        disabled={narrow}
                        title={narrow ? '窗口太窄，双页阅读不可用' : '双页（两栏并排）'}
                        onClick={() => setPref({ spread: 'double' })}
                      >双页</button>
                    </div>
                    {narrow && <p class="bk-set-hint">窗口宽度不足 900px，已自动使用单页。</p>}
                  </div>

                  <p class="bk-set-tip">滚轮 / 上下滑动 / ↑↓ 翻页，章节读完自动续下一章。</p>
                </div>
              )}
            </div>
          )}
          {/* 下载是可选项：默认在线阅读，想存到本地的读者再点这里 */}
          <a
            class="bk-tool-link"
            href={api.bookDownloadUrl(book.id)}
            download={book.original_name || `${book.title || 'book'}.${book.format}`}
            title="下载到本地"
          >
            <Icon name="download" size={15} /><span>下载</span>
          </a>
          <button type="button" onClick={onClose} title="关闭">
            <Icon name="close" size={16} /><span>关闭</span>
          </button>
        </div>
      </div>

      <div class={`bk-reader-body${twoUp ? ' two-up' : ''}`} ref={bodyRef} onScroll={onBodyScroll}>
        {book.format === 'pdf' && (
          <iframe src={api.bookFileUrl(book.id)} title={`《${book.title}》`} />
        )}

        {book.format === 'epub' && (
          <>
            {loading && (
              <div class="bk-reader-state">
                <span class="spinner" aria-hidden="true" />
                <p>正在解压电子书…（首次打开需要几秒）</p>
              </div>
            )}
            {!loading && error && (
              <div class="bk-reader-state">
                <Icon name="alert" size={30} />
                <h3>这本书暂时读不了</h3>
                <p>{error}。也可以先下载到本地，用阅读器打开。</p>
                <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
                  <a class="btn primary" href={api.bookDownloadUrl(book.id)} download={book.original_name || undefined}>
                    <Icon name="download" size={16} /> 下载电子书
                  </a>
                  <button type="button" class="btn" onClick={onClose}>返回书架</button>
                </div>
              </div>
            )}
            {!loading && !error && (
              <iframe
                ref={iframeRef}
                title={`《${book.title}》正文`}
                sandbox="allow-same-origin"
                srcDoc={html}
                onLoad={attachEpubInput}
              />
            )}
          </>
        )}

        {!READABLE.has(book.format) && (
          <div class="bk-reader-state">
            <Icon name="book" size={30} />
            <h3>{book.format.toUpperCase()} 暂不支持在线阅读</h3>
            <p>
              浏览器不能直接渲染 {book.format.toUpperCase()} 格式。可以下载后用 Kindle、
              Calibre 或手机阅读 App 打开；也可以把 {book.format.toUpperCase()} 转成 EPUB / PDF 再传一本。
            </p>
            <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
              <a class="btn primary" href={api.bookDownloadUrl(book.id)} download={book.original_name || undefined}>
                <Icon name="download" size={16} /> 下载 {fmtSize(book.size)}
              </a>
              <button type="button" class="btn" onClick={onClose}>返回书架</button>
            </div>
          </div>
        )}

        {/* 底部阅读进度：显示「第几章 / 共几章」+ 章内位置，拖动可跳章 */}
        {isEpub && canTurn && !loading && !error && (
          <div class="bk-progressbar" role="group" aria-label="阅读进度">
            <button type="button" class="bk-progress-arrow" onClick={() => turn(-1)} disabled={!canTurn} title="上一章">
              <Icon name="chevronLeft" size={15} />
            </button>
            <div class="bk-progress-main">
              <div class="bk-progress-head">
                <span class="bk-progress-ch">{chLabel(index)}</span>
                <span class="bk-progress-num">{index + 1} / {total} 章 · {Math.round(progressPct)}%</span>
              </div>
              <input
                class="bk-progress-range"
                type="range"
                min={1}
                max={total}
                step={1}
                value={dragIndex ?? index + 1}
                title="拖动跳到指定章节"
                onInput={(e) => setDragIndex(Number(e.target.value))}
                onChange={(e) => { setDragIndex(null); jumpChapter(e.target.value); }}
                style={`--pct:${Math.max(0, Math.min(100, progressPct))}%`}
              />
            </div>
            <button type="button" class="bk-progress-arrow" onClick={() => turn(1)} disabled={!canTurn} title="下一章">
              <Icon name="chevronRight" size={15} />
            </button>
          </div>
        )}

        {tocOpen && total > 0 && (
          <aside class="bk-toc" role="navigation" aria-label="章节目录">
            <div class="bk-toc-head">
              <span>目录（{total} 章）</span>
              <button type="button" class="bk-toc-close" onClick={() => setTocOpen(false)} aria-label="关闭目录">
                <Icon name="close" size={16} />
              </button>
            </div>
            <div class="bk-toc-list">
              {chapters.map((c, i) => (
                <button
                  key={`${i}-${c.href}`}
                  type="button"
                  class={`bk-toc-item${i === index ? ' on' : ''}`}
                  onClick={() => goTo(i)}
                >{c.title || `第 ${i + 1} 章`}</button>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  ), document.body);
}

// ---------------- 页面 ----------------
export function Books() {
  const { isAdmin, isAuthenticated } = useAuth();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState('');
  const [reading, setReading] = useState(null);
  const [editing, setEditing] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadName, setUploadName] = useState('');
  const fileRef = useRef(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.listBooks('?limit=200');
      setBooks(res?.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter((b) => {
      if (format && b.format !== format) return false;
      if (!q) return true;
      return `${b.title || ''} ${b.author || ''} ${b.original_name || ''}`.toLowerCase().includes(q);
    });
  }, [books, query, format]);

  // 上传：逐个上传并刷新（一次选多本也支持）
  async function uploadFiles(fileList) {
    const list = Array.from(fileList || []).filter((f) => /\.(epub|pdf|mobi|azw3)$/i.test(f.name || ''));
    if (!list.length) {
      toastError('只支持 EPUB / PDF / MOBI / AZW3 文件');
      return;
    }
    setUploading(true);
    let done = 0;
    try {
      for (const file of list) {
        setUploadName(file.name);
        setProgress(0);
        await uploadBook(file, { onProgress: setProgress });
        done += 1;
      }
      toastSuccess(done > 1 ? `已上传 ${done} 本` : '已上传');
      await load();
    } catch (err) {
      toastError(err.message);
      if (done) await load();
    } finally {
      setUploading(false);
      setProgress(0);
      setUploadName('');
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function remove(book) {
    if (!confirm(`删除《${book.title || '未命名'}》？正文与封面都会从存储里删掉。`)) return;
    try {
      await api.deleteBook(book.id);
      toastSuccess('已删除');
      await load();
    } catch (err) {
      toastError(err.message);
    }
  }

  const stats = useMemo(() => {
    const byFormat = {};
    let total = 0;
    for (const b of books) {
      byFormat[b.format] = (byFormat[b.format] || 0) + 1;
      total += Number(b.size) || 0;
    }
    return { byFormat, total };
  }, [books]);

  return (
    <div class="bk-page">
      <PageHeader
        kicker="Book Shelf"
        title="图书"
        sub="电子书书架：EPUB 与 PDF 可站内直接阅读，MOBI / AZW3 支持下载。"
        stats={[
          { label: '在架', value: books.length },
          { label: 'EPUB', value: stats.byFormat.epub || 0 },
          { label: 'PDF', value: stats.byFormat.pdf || 0 },
          { label: '占用', value: fmtSize(stats.total) || '0' }
        ]}
      />

      <div class="bk-toolbar">
        <label class="bk-search">
          <Icon name="search" size={16} />
          <input
            type="search"
            value={query}
            placeholder="搜索书名 / 作者…"
            onInput={(e) => setQuery(e.target.value)}
          />
        </label>
        <div class="bk-chips">
          {FORMATS.map((f) => (
            <button
              key={f.key || 'all'}
              type="button"
              class={`bk-chip${format === f.key ? ' on' : ''}`}
              onClick={() => setFormat(f.key)}
            >{f.label}</button>
          ))}
        </div>
        <span class="bk-count">{shown.length} / {books.length}</span>
      </div>

      {/* 上传区：仅站长 */}
      {isAdmin && (
        <div
          class={`bk-drop${dragging ? ' dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files); }}
        >
          <Icon name="book" size={26} />
          <div class="bk-drop-text">
            <strong>上传电子书</strong>
            <span>把 EPUB / PDF / MOBI / AZW3 拖到这里，不限制单本大小（受平台请求体上限约 100MB 影响）；封面与书名会自动提取</span>
          </div>
          <div class="bk-drop-actions">
            <button type="button" class="primary" disabled={uploading} onClick={() => fileRef.current?.click()}>
              <Icon name="plus" size={16} />{uploading ? '上传中…' : '选择文件'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              multiple
              hidden
              onChange={(e) => uploadFiles(e.target.files)}
            />
          </div>
          {uploading && (
            <div class="bk-progress" style="flex-basis:100%">
              <div class="bk-progress-bar"><div class="bk-progress-fill" style={`width:${progress}%`} /></div>
              <span class="bk-progress-label">{uploadName} · {progress}%（大文件请耐心等待）</span>
            </div>
          )}
        </div>
      )}

      {loading && <LoadingState shape="poster" count={10} label="正在加载书架" />}
      {!loading && error && <ErrorState title="书架加载失败" message={error} onRetry={load} />}

      {!loading && !error && shown.length === 0 && (
        <EmptyState
          icon="book"
          title={books.length ? '没有匹配的书' : '书架还是空的'}
          hint={books.length
            ? '换个关键词或格式试试。'
            : (isAdmin ? '用上面的上传区传一本 EPUB 或 PDF 试试。' : '站长还没有公开任何图书。')}
        />
      )}

      {!loading && !error && shown.length > 0 && (
        <div class="bk-shelf">
          {shown.map((b) => (
            <div key={b.id} class="bk-card-wrap">
              {isAdmin && (
                <div class="bk-admin">
                  <button type="button" title="编辑信息" aria-label="编辑" onClick={() => setEditing(b)}>
                    <Icon name="pencil" size={14} />
                  </button>
                  <button type="button" class="danger" title="删除" aria-label="删除" onClick={() => remove(b)}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              )}
              <button
                type="button"
                class="bk-card"
                onClick={() => setReading(b)}
                title={`打开《${b.title || '未命名'}》`}
              >
                <BookCover book={b} />
                <p class="bk-title">{b.title || '未命名'}</p>
                {b.author && <p class="bk-author">{b.author}</p>}
                <div class="bk-meta">
                  <span>{fmtSize(b.size)}</span>
                  {b.created_at && <span>{fmtDate(b.created_at)}</span>}
                </div>
              </button>
            </div>
          ))}
        </div>
      )}

      {reading && <Reader book={reading} onClose={() => setReading(null)} />}
      {editing && (
        <EditDialog
          book={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
        />
      )}

      {/* 未登录且书架为空时的说明，避免访客以为是坏了 */}
      {!isAuthenticated && !loading && books.length > 0 && (
        <p class="bk-hint muted" style="margin-top:20px;font-size:12.5px;color:var(--text-muted)">
          提示：登录后可以把你喜欢的书收藏起来（收藏功能即将上线）。
        </p>
      )}
    </div>
  );
}
