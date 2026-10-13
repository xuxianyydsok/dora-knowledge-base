// PDF 站内阅读器（基于 pdf.js）
//
// 为什么用 pdf.js 而不是浏览器自带的 PDF 阅读器：
//   之前 PDF 直接塞进 <iframe>，等于把整本书交给浏览器的内置阅读器 ——
//   工具栏样式、配色、翻页方式全由浏览器决定，各家表现还不一致，
//   手机端（尤其 iOS Safari / 微信）经常直接变成「下载」而不是打开。
//   用户要求「像微信读书那样的在线阅读器」，唯一可行做法是自己渲染：
//   用 Mozilla 的 pdf.js（MIT，就是 Firefox 内置的那个）把页面画到 canvas 上，
//   排版 / 翻页 / 背景 / 进度全部由本站掌控。
//
// 设计取舍：
//   1. **不整本下载**：getDocument 传 URL，pdf.js 自己按 Range 分段拉取
//      （后端 /api/books/:id/file 已支持 Range → 206）。几百 MB 的 PDF
//      也能秒开第一页，而不是等整本下完。
//   2. **只渲染可见页**：页数可能上千，全部渲染会爆内存。这里维护一个
//      连续的渲染窗口（当前页 ± 1），滑走的页把 canvas 释放掉。
//   3. **高分屏**：canvas 按 devicePixelRatio 放大再缩放显示，避免文字发虚。
//   4. **中文 PDF**：必须给 cMapUrl（Adobe CMap）与 standardFontDataUrl，
//      否则 GBK / Big5 编码的旧书会整页空白或乱码。这两份资源随构建发布。
//   5. **不引第三方 UI**：只用 pdf.js 的 core + 自绘 canvas，不要它的 viewer
//      （viewer 是整站应用，塞进来会和本站路由/样式打架）。

// worker 用 Vite 的 ?url 导入：构建时把 worker 文件原样产出并给出最终地址。
// 这样 workerSrc 在开发 / 预览 / 生产三种环境下都正确，不依赖手写路径。
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// 资源路径：随构建产物发布（见 vite.config.js 的 copyPdfAssets 插件）。
// 用 import.meta.env.BASE_URL 拼接，站点部署在子路径时也不会 404。
const BASE = (import.meta.env && import.meta.env.BASE_URL) || '/';
const ASSET_BASE = `${BASE.replace(/\/$/, '')}/pdfjs/`;
export const PDF_CMAP_URL = `${ASSET_BASE}cmaps/`;
export const PDF_FONT_URL = `${ASSET_BASE}standard_fonts/`;
export const PDF_WASM_URL = `${ASSET_BASE}wasm/`;

let pdfjsPromise = null;

// 懒加载 pdf.js 主包（约 450KB）：只有真的打开 PDF 时才下载，不拖累首屏。
export function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/build/pdf.min.mjs').then((mod) => {
      const lib = mod.default || mod;
      // worker 必须显式指定：不指定的话 pdf.js 会在主线程解析，
      // 大文件直接把界面卡死。
      lib.GlobalWorkerOptions.workerSrc = workerUrl;
      return lib;
    });
  }
  return pdfjsPromise;
}

// ---------------- 缩放档位 ----------------
// 与 EPUB 阅读器的 READER_SIZES 同一思路：给有限档位而不是连续滑块，
// 免得读者在 87% / 93% 这种无意义的值之间来回调。
export const PDF_ZOOM_STEPS = [0.5, 0.65, 0.8, 1, 1.25, 1.5, 1.8, 2.2, 2.6, 3];

/** 找最接近的缩放档位（用于「+ / −」按钮）。 */
export function stepZoom(current, dir) {
  const list = PDF_ZOOM_STEPS;
  const i = list.findIndex((v) => Math.abs(v - current) < 0.001);
  if (i < 0) {
    // 当前值不在档位上（例如「适宽」算出来的）：找相邻的那个
    return dir > 0
      ? (list.find((v) => v > current + 0.001) ?? list[list.length - 1])
      : ([...list].reverse().find((v) => v < current - 0.001) ?? list[0]);
  }
  const next = Math.min(list.length - 1, Math.max(0, i + dir));
  return list[next];
}

// ---------------- 适宽 / 适页 计算 ----------------
/**
 * 按「容器宽 / 高」算出「适宽」「适页」对应的缩放比。
 * pdf.js 的 base viewport 是 scale=1 时的尺寸，所以缩放比 = 目标像素 / base 尺寸。
 * 留出 padding，避免页面贴边（贴边时阴影和翻页边界都看不见）。
 */
export function fitZoom(baseViewport, box, mode, padding = 24) {
  if (!baseViewport || !box || !box.width || !box.height) return 1;
  const availW = Math.max(80, box.width - padding * 2);
  const availH = Math.max(80, box.height - padding * 2);
  const byW = availW / baseViewport.width;
  const byH = availH / baseViewport.height;
  const z = mode === 'page' ? Math.min(byW, byH) : byW;
  // 夹到合理区间，避免极端窗口尺寸算出 0.05 或 12 这种值
  return Math.min(3, Math.max(0.25, Number(z.toFixed(3))));
}

// ---------------- 页码 ↔ 进度 ----------------
/** 当前页 → 进度百分比（第 1 页显示 0%，最后一页显示 100%）。 */
export function pagePercent(page, total) {
  if (!total || total <= 1) return 0;
  const p = Math.min(Math.max(1, page), total);
  return Math.round(((p - 1) / (total - 1)) * 100);
}

/** 进度百分比 → 页码（拖动进度条时用，clamp 到合法范围）。 */
export function percentPage(percent, total) {
  if (!total) return 1;
  const pct = Math.min(100, Math.max(0, Number(percent) || 0));
  return Math.min(total, Math.max(1, Math.round((pct / 100) * (total - 1)) + 1));
}

/**
 * 按 devicePixelRatio 算 canvas 的像素尺寸。
 * 高分屏上 canvas 必须放大后再用 CSS 缩回，否则文字边缘发虚（pdf.js 官方也这么做）。
 */
export function canvasSize(viewport, dpr = 1) {
  const ratio = Math.min(3, Math.max(1, Number(dpr) || 1));
  return {
    cssWidth: Math.round(viewport.width),
    cssHeight: Math.round(viewport.height),
    pixelWidth: Math.round(viewport.width * ratio),
    pixelHeight: Math.round(viewport.height * ratio),
    transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null
  };
}

// ---------------- 阅读进度持久化 ----------------
// 与 EPUB 共用同一套 bk:reader:* 键空间，但 PDF 记的是「第几页」。
// 用户上次读到哪，下次打开同一本书自动跳回去。
export function loadPdfPage(bookId) {
  try {
    const v = Number(localStorage.getItem(`bk:reader:pdfpage:${bookId}`));
    return Number.isFinite(v) && v >= 1 ? Math.floor(v) : 1;
  } catch { return 1; }
}

export function savePdfPage(bookId, page) {
  try { localStorage.setItem(`bk:reader:pdfpage:${bookId}`, String(page)); } catch { /* 忽略 */ }
}

// ---------------- 打开文档 ----------------
/**
 * 打开一个 PDF。
 * @param {string} url 可直接给 pdf.js 的地址（后端 /api/books/:id/file，已带令牌）
 * @returns {Promise<{ doc, destroy }>}
 */
export async function openPdf(url) {
  const lib = await loadPdfjs();
  const task = lib.getDocument({
    url,
    cMapUrl: PDF_CMAP_URL,
    cMapPacked: true,               // cmaps/ 下是 .bcmap 二进制包
    standardFontDataUrl: PDF_FONT_URL,
    wasmUrl: PDF_WASM_URL,
    // 关掉字体相关的额外请求：本站只读不打印，省带宽
    disableFontFace: false,
    isEvalSupported: false         // 安全：不让 pdf.js 走 eval 路径
  });
  const doc = await task.promise;
  return {
    doc,
    pageCount: doc.numPages,
    destroy: () => { try { doc.destroy(); } catch { /* 已销毁 */ } }
  };
}

/**
 * 取某页的 base viewport（scale=1），用于算「适宽 / 适页」。
 * 结果缓存：同一页反复算缩放时不必重复解析页面对象。
 */
export async function getBaseViewport(doc, pageNo, cache) {
  if (cache && cache.has(pageNo)) return cache.get(pageNo);
  const page = await doc.getPage(pageNo);
  const vp = page.getViewport({ scale: 1 });
  if (cache) cache.set(pageNo, vp);
  return vp;
}

/**
 * 渲染一页到 canvas。
 * @returns {Promise<{ cancel: () => void } | null>} 供上层取消（快速翻页时丢掉过期渲染）
 */
export async function renderPageToCanvas(doc, pageNo, canvas, zoom, dpr = 1) {
  const page = await doc.getPage(pageNo);
  const viewport = page.getViewport({ scale: zoom });
  const size = canvasSize(viewport, dpr);

  canvas.width = size.pixelWidth;
  canvas.height = size.pixelHeight;
  canvas.style.width = `${size.cssWidth}px`;
  canvas.style.height = `${size.cssHeight}px`;

  const ctx = canvas.getContext('2d', { alpha: false });
  // 背景铺白：PDF 页面本身透明的地方不铺会在夜间主题下透出黑底
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  const renderTask = page.render({
    canvasContext: ctx,
    viewport,
    transform: size.transform || undefined
  });
  await renderTask.promise;
  return { cancel: () => { try { renderTask.cancel(); } catch { /* 已完成 */ } } };
}

// ---------------- 大纲（PDF 自带书签） ----------------
/**
 * 取 PDF 自带的大纲，拍平成 { title, page, depth } 列表。
 * 大量 PDF 没有大纲（尤其扫描版），此时返回空数组，UI 自动隐藏「目录」按钮。
 * 解析「第几页」需要把 dest 解析成页码，这一步要读文档，因此限制条数避免卡顿。
 */
export async function loadOutline(doc, limit = 400) {
  let raw = null;
  try { raw = await doc.getOutline(); } catch { return []; }
  if (!Array.isArray(raw) || !raw.length) return [];

  const out = [];
  const walk = async (items, depth) => {
    for (const it of items) {
      if (out.length >= limit) return;
      let pageNo = null;
      try {
        let dest = it.dest;
        // dest 可能是字符串（命名目标），要先查表
        if (typeof dest === 'string') dest = await doc.getDestination(dest);
        if (Array.isArray(dest) && dest[0]) {
          const idx = await doc.getPageIndex(dest[0]);
          pageNo = idx + 1;
        }
      } catch { pageNo = null; }
      if (pageNo) out.push({ title: String(it.title || '').trim() || `第 ${pageNo} 页`, page: pageNo, depth });
      if (it.items && it.items.length) await walk(it.items, depth + 1);
      if (out.length >= limit) return;
    }
  };
  await walk(raw, 0);
  return out;
}
