// BookReader —— 站内电子书阅读器（首页书架与 /books 页共用）
//
// 定位：默认在线阅读，不强制下载。
//   · EPUB：走 lib/epubReader.js，在浏览器里解压并渲染章节，带章节目录；
//   · PDF ：<iframe> 内嵌浏览器自带阅读器，后端支持 Range，可翻页 / 缩放 / 全屏；
//   · 下载只是可选按钮，想存到本地的读者可以自己下（api.bookDownloadUrl）。
//
// 排版（字号 / 字体 / 背景 / 单双页）持久化到 localStorage（键名 bk:reader:*）。
// 常量与工具函数一并 export，方便离线单测。
import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { api } from '../lib/api.js';
import { Icon } from './Icon.jsx';
import { toastError } from '../lib/toast.jsx';
// PDF 缩放档位（纯常量，不触发 pdf.js 加载；真正的 pdf.js 在打开 PDF 时才动态 import）
import { PDF_ZOOM_STEPS, stepZoom } from '../lib/pdfReader.js';
// 阅读器自己带样式与字体：谁挂载它都能正常显示，不依赖宿主页面碰巧 import 过。
// （首页书架复用时，首页并不会 import books.css / wenkai.css。）
import '../styles/books.css';
import '../styles/wenkai.css';

// ---------------- 阅读器 ----------------
// PDF：iframe 直嵌（浏览器自带阅读器 + 后端 Range 支持，可翻页 / 缩放 / 全屏）。
// EPUB：动态 import epubReader.js，解压 → 清洗 → srcDoc 渲染，带章节目录。
//       排版（字号 / 字体 / 背景 / 单双页）由宿主往 iframe 里注入一份 <style> 实时覆盖，
//       章节 HTML 只生成一次，所以调设置时阅读位置不会丢。
//       翻页：方向键 / 滚轮 / 触屏上下滑；章节内滚到尽头再继续滚才翻章，避免误翻。
// 其余格式：给出下载入口并说明原因。

// 阅读器设置（字号 / 字体 / 背景 / 单双页）全部持久化到 localStorage，键名 bk:reader:*。
export const READER_FONTS = [
  { key: 'wenkai', label: '霞鹜文楷', stack: '"LXGW WenKai","Noto Serif SC","Songti SC",Georgia,serif' },
  { key: 'song', label: '宋体', stack: '"Noto Serif SC","Source Han Serif SC","Songti SC","SimSun",Georgia,serif' },
  { key: 'hei', label: '黑体', stack: '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",-apple-system,"Segoe UI",sans-serif' },
  { key: 'kai', label: '楷体', stack: '"Kaiti SC","KaiTi","STKaiti","LXGW WenKai",serif' },
  { key: 'fangsong', label: '仿宋', stack: '"FangSong","STFangsong","Songti SC",serif' },
  { key: 'newsreader', label: 'Newsreader', stack: '"Newsreader","Noto Serif SC",Georgia,"Songti SC",serif' }
];

export const READER_BACKGROUNDS = [
  { key: 'paper', label: '纸白', bg: '#ffffff', fg: '#1c1e21', link: '#1a6fd4' },
  { key: 'sepia', label: '米黄', bg: '#f6ecd8', fg: '#3a2f22', link: '#8a5a1f' },
  { key: 'mint', label: '淡青', bg: '#e8f4f0', fg: '#1f3330', link: '#0f7a63' },
  { key: 'night', label: '夜间', bg: '#16181c', fg: '#c9ccd1', link: '#8ab4f8' }
];

export const READER_SIZES = [15, 17, 19, 21, 23];
export const READER_DEFAULTS = { size: 17, font: 'wenkai', bg: 'paper', spread: 'single' };

// 读持久化设置：坏值 / 越界值一律退回默认，避免把阅读器搞崩
export function loadReaderPrefs() {
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

export function saveReaderPref(key, value) {
  try { localStorage.setItem(`bk:reader:${key}`, String(value)); } catch { /* 忽略 */ }
}

// 注入 iframe 的排版样式：改字号 / 字体 / 背景 / 单双页都只换这一份 <style>
export function readerExtraCss(prefs, twoUp) {
  const font = READER_FONTS.find((f) => f.key === prefs.font) || READER_FONTS[0];
  const bg = READER_BACKGROUNDS.find((b) => b.key === prefs.bg) || READER_BACKGROUNDS[0];
  return ':root {'
    + `--epub-bg:${bg.bg}; --epub-fg:${bg.fg}; --epub-link:${bg.link};`
    + `--epub-font:${font.stack};`
    + `--epub-size:${prefs.size}px;`
    + `--epub-columns:${twoUp ? 2 : 1};`
    + '}';
}

// ---------------- 触屏滑动 → 翻章方向 ----------------
//
// 用户要求（2026-10-12）：
//   · 向下滑（继续往下读）与向右滑 → **下一页**；
//   · 向上滑（往回读）与向左滑 → **上一页**；
//   · 「滑到底之后再滑没反应」必须修掉 —— 到底了继续往下滑就要翻章。
//
// 语义约定（容易搞混，写清楚）：
//   dx > 0 手指右移；dy < 0 手指上移（内容往上走 = 读者往下读）。
//   纵向不无条件翻章，因为纵向要留给正文滚动；只有「起点已经在尽头」时才翻章。
//   起点是否在尽头由手势开始时记下的 atBottom / atTop 决定，而不是抬手时才查 ——
//   否则「滑到底」的那一次会被判成没到底，白滚一下没反应。
//
// 返回 1 = 下一章，-1 = 上一章，0 = 不翻章（这一滑交给正常滚动）。
export function resolveSwipe({ dx = 0, dy = 0, atBottom = false, atTop = false, threshold = 42 } = {}) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < threshold && ay < threshold) return 0;
  // 横向优先：正文是纵向排版，横滑永远不会和滚动冲突，所以横滑一律翻章
  if (ax >= threshold && ax >= ay) return dx > 0 ? 1 : -1;
  if (ay >= threshold && ay > ax) {
    if (dy < 0) return atBottom ? 1 : 0;   // 往下读到底 → 下一章
    return atTop ? -1 : 0;                 // 往回读读到顶 → 上一章
  }
  return 0;
}

export function BookReader({ book, onClose }) {
  // EPUB 要解压、PDF 要解析文档，两者打开时都需要 loading 态；
  // 其余格式（理论上不会进阅读器）不需要。
  const [loading, setLoading] = useState(book.format === 'epub' || book.format === 'pdf');
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
  const isPdf = book.format === 'pdf';

  // ---------------- PDF 状态（基于 pdf.js 自绘 canvas） ----------------
  // 与 EPUB 的区别：PDF 是固定版面，没有「章节」概念，翻的是**页**。
  // 因此进度条走页码（1..total），「字号 / 字体」这类对 PDF 无意义的设置
  // 换成「缩放 / 适宽 / 适页」（见下面的设置面板）。
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfTotal, setPdfTotal] = useState(0);
  const [pdfZoom, setPdfZoom] = useState(1);
  const [pdfFit, setPdfFit] = useState('width');   // width | page | custom
  const [pdfOutline, setPdfOutline] = useState([]);
  const [pdfPageInput, setPdfPageInput] = useState('');
  const [pdfDragPage, setPdfDragPage] = useState(null);
  const pdfDocRef = useRef(null);
  const pdfCanvasRef = useRef(null);
  const pdfBoxRef = useRef(null);
  const pdfRenderRef = useRef(null);
  const pdfBaseVpRef = useRef(new Map());
  // 实际用于渲染的缩放比。与 pdfZoom（用于显示百分比）分开：
  // 适宽 / 适页模式下由容器尺寸算出，避免写回 state 造成 effect 自触发。
  const pdfZoomRef = useRef(1);
  // 自定义缩放的「代次」：点 +/− 或拖滑块时 +1，用来触发重渲染，
  // 而适宽 / 适页的自动计算不会改它。
  const [pdfZoomTick, setPdfZoomTick] = useState(0);

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

  // PDF：打开文档（pdf.js 按 Range 流式拉取，不整本下载）
  useEffect(() => {
    if (book.format !== 'pdf') return undefined;
    let alive = true;
    (async () => {
      try {
        const mod = await import('../lib/pdfReader.js');
        // 走 bookFileUrl（带媒体令牌）：私人书在登录后也能读，
        // 且给 pdf.js 的是 URL 而不是字节 —— 它自己按 Range 分段取，
        // 几百 MB 的书也能秒开第一页。
        const opened = await mod.openPdf(api.bookFileUrl(book.id));
        if (!alive) { opened.destroy(); return; }
        pdfDocRef.current = opened;
        setPdfDoc(opened.doc);
        setPdfTotal(opened.pageCount);
        // 回到上次读到的页（没有记录就第 1 页）
        const saved = mod.loadPdfPage(book.id);
        setPdfPage(Math.min(opened.pageCount || 1, Math.max(1, saved)));
        // 大纲（PDF 自带书签）：没有就空数组，UI 自动隐藏目录按钮
        mod.loadOutline(opened.doc).then((list) => { if (alive) setPdfOutline(list); }).catch(() => {});
      } catch (err) {
        if (alive) setError(err?.message || 'PDF 打开失败');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      try { pdfDocRef.current?.destroy?.(); } catch { /* 已销毁 */ }
      pdfDocRef.current = null;
      pdfBaseVpRef.current = new Map();
    };
  }, [book.id]);

  // PDF：窗口尺寸变化 → 重算适宽 / 适页（旋转手机、拉窗口后页面会被裁掉）
  // 做法是递增 tick 让渲染 effect 重跑，由它按新容器尺寸算缩放。
  useEffect(() => {
    if (!isPdf || pdfFit === 'custom') return undefined;
    let timer = null;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        pdfZoomRef.current = 0;            // 清掉旧值，强制重算
        setPdfZoomTick((t) => t + 1);
      }, 180);
    };
    window.addEventListener('resize', onResize);
    return () => { clearTimeout(timer); window.removeEventListener('resize', onResize); };
  }, [isPdf, pdfFit]);

  // PDF：把当前页画到 canvas（取消上一次未完成的渲染，避免快速翻页时错位）
  //
  // ⚠ 这里**不能**在 effect 里 setPdfZoom 又把它列进依赖 —— 会自己触发自己
  //   （适宽算出的值写回 state → effect 重跑 → 再算一次…）。做法是：
  //   适宽 / 适页模式下算出的实际缩放存进 pdfZoomRef 供本次渲染用，
  //   只把「用于显示的百分比」同步进 state，且用阈值挡住无意义的更新。
  useEffect(() => {
    if (!isPdf || !pdfDoc) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const mod = await import('../lib/pdfReader.js');
        const canvas = pdfCanvasRef.current;
        if (!canvas) return;
        const base = await mod.getBaseViewport(pdfDoc, pdfPage, pdfBaseVpRef.current);
        const box = pdfBoxRef.current;
        // 自定义模式用滑块的值；适宽 / 适页由容器尺寸算。
        // 注意读的是 pdfZoom（state）而不是 ref：滑块拖到中间值时要立刻生效。
        let zoom = pdfFit === 'custom' ? pdfZoom : pdfZoomRef.current;
        if (pdfFit !== 'custom' && box) {
          zoom = mod.fitZoom(base, { width: box.clientWidth, height: box.clientHeight }, pdfFit);
          // 同步给「设置面板里的百分比」显示；阈值避免亚像素抖动引发重渲染
          if (Math.abs(zoom - pdfZoomRef.current) > 0.01) setPdfZoom(zoom);
        }
        pdfZoomRef.current = zoom;
        // 丢掉上一次还没画完的渲染
        pdfRenderRef.current?.cancel?.();
        const task = await mod.renderPageToCanvas(
          pdfDoc, pdfPage, canvas, zoom, window.devicePixelRatio || 1
        );
        if (cancelled) { task?.cancel?.(); return; }
        pdfRenderRef.current = task;
        mod.savePdfPage(book.id, pdfPage);
      } catch (err) {
        // 快速翻页导致的 cancel 不算错误
        if (!/cancel/i.test(String(err?.message || ''))) {
          toastError(err?.message || '这一页渲染失败');
        }
      }
    })();
    return () => { cancelled = true; };
    // pdfZoom 只在「自定义」模式下才影响渲染；适宽/适页时由容器尺寸决定，
    // 所以把它放进依赖会在每次自动计算后多渲染一次。用 pdfZoomRef 读取实际值。
  }, [isPdf, pdfDoc, pdfPage, pdfFit, pdfZoomTick, book.id]);

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

  // ---------------- PDF 翻页 / 缩放 ----------------
  // 翻页语义与 EPUB 对齐：左滑 / 向下滑 = 下一页，右滑 / 向上滑 = 上一页。
  // 区别是 PDF 每页高度自适应，不存在「页内滚动」，所以一次手势就是一次翻页。
  function pdfTurn(delta) {
    if (!pdfTotal) return;
    setPdfPage((p) => Math.min(pdfTotal, Math.max(1, p + delta)));
  }

  function pdfGoTo(page) {
    if (!pdfTotal) return;
    const n = Math.min(pdfTotal, Math.max(1, Number(page) || 1));
    setPdfPage(n);
    setTocOpen(false);
  }

  function pdfSetZoom(z, { custom = true } = {}) {
    pdfZoomRef.current = z;
    setPdfZoom(z);
    // 自定义缩放要立刻重画（适宽/适页由容器尺寸驱动，不走这条）
    setPdfZoomTick((t) => t + 1);
    if (custom) setPdfFit('custom');
  }

  function pdfFitTo(mode) {
    setPdfFit(mode);
    // 适宽 / 适页：清掉自定义值，让渲染 effect 按容器尺寸重算
    pdfZoomRef.current = mode === 'custom' ? pdfZoomRef.current : 0;
    setPdfZoomTick((t) => t + 1);
  }

  // PDF 的键盘 / 滚轮 / 触屏：挂在阅读区容器上（PDF 不经过 iframe）
  function onPdfWheel(e) {
    // 只在没有按 Ctrl（那是浏览器缩放）时把滚轮当翻页；
    // 触控板横向滑动同样翻页。
    if (e.ctrlKey) return;
    const dy = e.deltaY;
    const dx = e.deltaX;
    const d = Math.abs(dx) > Math.abs(dy) ? dx : dy;
    if (Math.abs(d) < 12) return;
    e.preventDefault();
    pdfTurn(d > 0 ? 1 : -1);
  }

  function onPdfKey(e) {
    if (settingsOpen || tocOpen) return;
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': case ' ':
        e.preventDefault(); pdfTurn(1); break;
      case 'ArrowLeft': case 'PageUp':
        e.preventDefault(); pdfTurn(-1); break;
      case 'Home':
        e.preventDefault(); pdfGoTo(1); break;
      case 'End':
        e.preventDefault(); pdfGoTo(pdfTotal); break;
      default: break;
    }
  }

  // PDF 触屏：与 EPUB 用同一个 resolveSwipe 语义（左/下滑=下一页，右/上滑=上一页）。
  // 不同点：PDF 一页就是满屏，没有「页内滚动」，所以任何方向滑过阈值都翻页。
  function makePdfTouchHandlers() {
    let start = null;
    const SWIPE = 42;
    const AXIS_MIN = 12;
    return {
      onTouchStart(e) {
        if (e.touches.length !== 1) { start = null; return; }
        const t = e.touches[0];
        start = { x: t.clientX, y: t.clientY, fired: false };
      },
      onTouchMove(e) {
        if (!start || e.touches.length !== 1) return;
        const t = e.touches[0];
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        if (Math.abs(dx) < AXIS_MIN && Math.abs(dy) < AXIS_MIN) return;
        const dir = resolveSwipe({ dx, dy, atBottom: true, atTop: true, threshold: SWIPE });
        if (dir === 0) return;
        e.preventDefault();
        pdfTurn(dir);
        start.fired = true;
        start.x = t.clientX;
        start.y = t.clientY;
      },
      onTouchEnd() { start = null; }
    };
  }
  const pdfTouch = useRef(null);
  if (!pdfTouch.current) pdfTouch.current = makePdfTouchHandlers();

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

    // 触屏手势（2026-10-12 用户要求，单指也要能翻页）：
    //   · 向右滑（手指右移）→ 下一章；向左滑（手指左移）→ 上一章；
    //     横滑永远翻章 —— 正文是纵向排版，横滑不会和滚动冲突。
    //   · 纵向仍然先是正文滚动：**往下读（手指上移）滚到底，再继续往下读** → 下一章；
    //     **往上读（手指下移）滚到顶，再继续往上读** → 上一章。
    //   · 章节只有一屏（短章）时没有滚动余地，此时纵向滑动直接翻章。
    //   · 双指上下滑 → 直接翻页（保留原来的手势）。
    // 为什么纵向不直接翻章：纵向是正文的阅读滚动，抢掉它读者就没法回看上文了，
    // 所以纵向只在「已经滚到尽头还继续滑」时才翻章。
    const SWIPE = 42;      // 触发翻章的最小位移（px），与 resolveSwipe 的默认阈值一致
    const AXIS_MIN = 12;   // 判定主方向的最小位移，避免手指轻抖就定轴
    let touch = null;
    const scroller = () => win.document.scrollingElement || win.document.documentElement;

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        touch = { multi: true, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 };
        return;
      }
      if (e.touches.length === 1) {
        const t = e.touches[0];
        const el = scroller();
        const max = el ? el.scrollHeight - el.clientHeight : 0;
        touch = {
          multi: false, x: t.clientX, y: t.clientY, axis: '', fired: false,
          // 手势**起点**就已经在尽头时，这一滑不应该再「白滚一下」才翻章
          atBottom: max <= 4 || (el ? el.scrollTop >= max - 2 : true),
          atTop: max <= 4 || (el ? el.scrollTop <= 2 : true)
        };
      } else {
        touch = null;
      }
    };
    const onTouchMove = (e) => {
      if (!touch) return;
      if (touch.multi) {
        if (e.touches.length !== 2) return;
        const y = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const dy = touch.y - y;
        if (Math.abs(dy) > SWIPE) {
          e.preventDefault();
          touch.y = y;
          api_.step(dy > 0 ? 1 : -1);
        }
        return;
      }
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - touch.x;
      const dy = t.clientY - touch.y;
      if (!touch.axis) {
        if (Math.abs(dx) < AXIS_MIN && Math.abs(dy) < AXIS_MIN) return;
        touch.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      if (touch.axis !== 'x' || touch.fired) return;
      const dir = resolveSwipe({ dx, dy, atBottom: touch.atBottom, atTop: touch.atTop, threshold: SWIPE });
      if (dir === 0) return;
      // 横向：右滑（dx>0）→ 下一章，左滑（dx<0）→ 上一章。
      // preventDefault 同时挡掉浏览器/系统的「边缘右滑返回」手势。
      e.preventDefault();
      api_.step(dir);
      touch.fired = true;
      touch.x = t.clientX;
      touch.y = t.clientY;
    };
    const onTouchEnd = (e) => {
      const t = e.changedTouches && e.changedTouches[0];
      if (touch && !touch.multi && !touch.fired && touch.axis === 'y' && t) {
        // 手指上移（dy<0）= 往下读；手指下移（dy>0）= 往上读。
        // 起点就在尽头（atBottom / atTop 在手势开始时记下）才翻章，
        // 否则这一滑先交给浏览器滚动，滑到底之后再滑才翻章。
        const dir = resolveSwipe({
          dx: 0, dy: t.clientY - touch.y,
          atBottom: touch.atBottom, atTop: touch.atTop, threshold: SWIPE
        });
        if (dir !== 0) api_.step(dir);
      }
      touch = null;
    };

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
  // PDF 进度：按「页」算（第 1 页 0%、最后一页 100%），与 lib/pdfReader.pagePercent 同一口径
  const pdfPercent = pdfTotal > 1
    ? Math.round(((Math.min(Math.max(1, pdfPage), pdfTotal) - 1) / (pdfTotal - 1)) * 100)
    : 0;

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
          {/* PDF 工具条：翻页 + 页码直达 + 缩放。与 EPUB 的「上一章/目录/下一章」
              并列，但语义换成「页」，因为 PDF 是固定版面、没有章节概念。 */}
          {isPdf && pdfTotal > 0 && (
            <>
              <button type="button" onClick={() => pdfTurn(-1)} disabled={pdfPage <= 1} title="上一页">
                <Icon name="chevronLeft" size={15} /><span>上一页</span>
              </button>
              <div class="bk-page-jump">
                <input
                  class="bk-page-input"
                  type="text"
                  inputMode="numeric"
                  value={pdfPageInput === '' ? pdfPage : pdfPageInput}
                  title="输入页码后回车跳转"
                  aria-label="跳到指定页"
                  onFocus={() => setPdfPageInput('')}
                  onInput={(e) => setPdfPageInput(e.currentTarget.value.replace(/[^\d]/g, ''))}
                  onBlur={() => setPdfPageInput('')}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    pdfGoTo(e.currentTarget.value);
                    setPdfPageInput('');
                    e.currentTarget.blur();
                  }}
                />
                <span class="bk-page-total">/ {pdfTotal}</span>
              </div>
              {pdfOutline.length > 0 && (
                <button type="button" onClick={() => setTocOpen((v) => !v)} title="书签目录">
                  <Icon name="list" size={15} /><span>目录</span>
                </button>
              )}
              <button type="button" onClick={() => pdfTurn(1)} disabled={pdfPage >= pdfTotal} title="下一页">
                <span>下一页</span><Icon name="chevronRight" size={15} />
              </button>
            </>
          )}
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

                  <p class="bk-set-tip">滚轮 / ↑↓ 翻页；触屏：左滑下一章、右滑上一章，纵向滑到尽头继续滑也会翻章。</p>
                </div>
              )}
            </div>
          )}

          {/* PDF 的阅读设置：背景 / 缩放 / 适宽 / 适页。
              没有「字号 / 字体」—— PDF 是固定版面，字体是画进页面的，
              改不了；对 PDF 真正有用的是缩放，所以换成这组控件。 */}
          {isPdf && (
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
                    <span class="bk-set-label">缩放 <em>{Math.round(pdfZoom * 100)}%</em></span>
                    <div class="bk-set-row">
                      <button
                        type="button"
                        class="bk-set-btn"
                        disabled={pdfZoom <= PDF_ZOOM_STEPS[0]}
                        onClick={() => pdfSetZoom(stepZoom(pdfZoom, -1))}
                        title="缩小"
                      >A−</button>
                      <input
                        class="bk-set-range"
                        type="range"
                        min={PDF_ZOOM_STEPS[0]}
                        max={PDF_ZOOM_STEPS[PDF_ZOOM_STEPS.length - 1]}
                        step={0.05}
                        value={pdfZoom}
                        onInput={(e) => pdfSetZoom(Number(e.target.value))}
                      />
                      <button
                        type="button"
                        class="bk-set-btn"
                        disabled={pdfZoom >= PDF_ZOOM_STEPS[PDF_ZOOM_STEPS.length - 1]}
                        onClick={() => pdfSetZoom(stepZoom(pdfZoom, 1))}
                        title="放大"
                      >A+</button>
                    </div>
                  </div>

                  <div class="bk-set-group">
                    <span class="bk-set-label">显示方式</span>
                    <div class="bk-set-chips">
                      <button
                        type="button"
                        class={`bk-set-chip${pdfFit === 'width' ? ' on' : ''}`}
                        onClick={() => pdfFitTo('width')}
                      >适宽</button>
                      <button
                        type="button"
                        class={`bk-set-chip${pdfFit === 'page' ? ' on' : ''}`}
                        onClick={() => pdfFitTo('page')}
                      >适页</button>
                      <button
                        type="button"
                        class={`bk-set-chip${pdfFit === 'custom' ? ' on' : ''}`}
                        onClick={() => setPdfFit('custom')}
                        title="用上面的缩放滑块自己调"
                      >自定义</button>
                    </div>
                    <p class="bk-set-hint">PDF 是固定版面，字号和字体改不了 —— 用缩放看大小。</p>
                  </div>

                  <p class="bk-set-tip">滚轮 / ↑↓ / 左右方向键翻页；触屏左滑下一页、右滑上一页；点页码可直接跳转。</p>
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

      <div
        class={`bk-reader-body${twoUp ? ' two-up' : ''}${isPdf ? ' is-pdf' : ''}`}
        ref={bodyRef}
        onScroll={onBodyScroll}
        style={isPdf ? `--bk-pdf-bg:${(READER_BACKGROUNDS.find((b) => b.key === prefs.bg) || READER_BACKGROUNDS[0]).bg}` : undefined}
      >
        {/* PDF：pdf.js 自绘 canvas（见 lib/pdfReader.js）。
            不再用 <iframe> 交给浏览器内置阅读器 —— 那样工具栏 / 配色 / 翻页
            全由浏览器决定，手机端还常常直接变成下载。 */}
        {isPdf && (
          <div
            class="bk-pdf-box"
            ref={pdfBoxRef}
            tabIndex={0}
            onWheel={onPdfWheel}
            onKeyDown={onPdfKey}
            onTouchStart={pdfTouch.current.onTouchStart}
            onTouchMove={pdfTouch.current.onTouchMove}
            onTouchEnd={pdfTouch.current.onTouchEnd}
          >
            {loading && (
              <div class="bk-reader-state">
                <span class="spinner" aria-hidden="true" />
                <p>正在打开 PDF…</p>
              </div>
            )}
            {!loading && error && (
              <div class="bk-reader-state">
                <Icon name="alert" size={30} />
                <h3>这本书暂时读不了</h3>
                <p>{error}。也可以先下载到本地，用阅读器打开。</p>
                <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
                  <a class="btn primary" href={api.bookDownloadUrl(book.id)} download={book.original_name || undefined}>
                    <Icon name="download" size={16} /> 下载 PDF
                  </a>
                  <button type="button" class="btn" onClick={onClose}>返回书架</button>
                </div>
              </div>
            )}
            {!error && (
              <canvas
                ref={pdfCanvasRef}
                class="bk-pdf-canvas"
                aria-label={`《${book.title}》第 ${pdfPage} 页`}
              />
            )}
          </div>
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

        {/* PDF 底部进度：显示「第几页 / 共几页」+ 百分比，拖动可跳页。
            与 EPUB 那条共用同一套外观（.bk-progressbar），只是把「章」换成「页」。 */}
        {isPdf && pdfTotal > 0 && !loading && !error && (
          <div class="bk-progressbar" role="group" aria-label="阅读进度">
            <button
              type="button"
              class="bk-progress-arrow"
              onClick={() => pdfTurn(-1)}
              disabled={pdfPage <= 1}
              title="上一页"
            >
              <Icon name="chevronLeft" size={15} />
            </button>
            <div class="bk-progress-main">
              <div class="bk-progress-head">
                <span class="bk-progress-ch">{book.title || '未命名'}</span>
                <span class="bk-progress-num">
                  第 {pdfPage} / {pdfTotal} 页 · {pdfPercent}%
                </span>
              </div>
              <input
                class="bk-progress-range"
                type="range"
                min={1}
                max={pdfTotal}
                step={1}
                value={pdfDragPage ?? pdfPage}
                title="拖动跳到指定页"
                onInput={(e) => setPdfDragPage(Number(e.target.value))}
                onChange={(e) => { setPdfDragPage(null); pdfGoTo(e.target.value); }}
                style={`--pct:${pdfPercent}%`}
              />
            </div>
            <button
              type="button"
              class="bk-progress-arrow"
              onClick={() => pdfTurn(1)}
              disabled={pdfPage >= pdfTotal}
              title="下一页"
            >
              <Icon name="chevronRight" size={15} />
            </button>
          </div>
        )}

        {/* PDF 书签目录：用 PDF 自带的大纲（很多扫描版没有，此时目录按钮不显示）。
            缩进按层级给（depth * 12px），与 EPUB 的扁平章节目录区分开。 */}
        {tocOpen && isPdf && pdfOutline.length > 0 && (
          <aside class="bk-toc" role="navigation" aria-label="书签目录">
            <div class="bk-toc-head">
              <span>书签（{pdfOutline.length} 条）</span>
              <button type="button" class="bk-toc-close" onClick={() => setTocOpen(false)} aria-label="关闭目录">
                <Icon name="close" size={16} />
              </button>
            </div>
            <div class="bk-toc-list">
              {pdfOutline.map((o, i) => (
                <button
                  key={`${i}-${o.page}-${o.title}`}
                  type="button"
                  class={`bk-toc-item${o.page === pdfPage ? ' on' : ''}`}
                  style={`padding-left:${12 + (o.depth || 0) * 12}px`}
                  onClick={() => pdfGoTo(o.page)}
                >{o.title}</button>
              ))}
            </div>
          </aside>
        )}

        {tocOpen && !isPdf && total > 0 && (
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
