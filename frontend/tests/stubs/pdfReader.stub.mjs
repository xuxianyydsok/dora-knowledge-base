// pdfReader 的测试桩：readerSwipe.probe.mjs 只测 BookReader 里的 resolveSwipe 纯函数，
// 不需要真的加载 pdf.js（真模块用 Vite 的 `?url` 后缀取 worker 地址，esbuild 解析不了）。
// 这里提供同名导出，保证 BookReader 能被打包、纯函数能被取到。
export const PDF_ZOOM_STEPS = [0.5, 0.65, 0.8, 1, 1.25, 1.5, 1.8, 2.2, 2.6, 3];
export function stepZoom(current, dir) {
  const list = PDF_ZOOM_STEPS;
  const i = list.findIndex((v) => Math.abs(v - current) < 0.001);
  if (i < 0) {
    return dir > 0
      ? (list.find((v) => v > current + 0.001) ?? list[list.length - 1])
      : ([...list].reverse().find((v) => v < current - 0.001) ?? list[0]);
  }
  return list[Math.min(list.length - 1, Math.max(0, i + dir))];
}
export function fitZoom() { return 1; }
export function pagePercent() { return 0; }
export function percentPage() { return 1; }
export function canvasSize(vp) { return { cssWidth: vp.width, cssHeight: vp.height, pixelWidth: vp.width, pixelHeight: vp.height, transform: null }; }
export function loadPdfjs() { return Promise.resolve({}); }
export function openPdf() { return Promise.resolve({ doc: null, pageCount: 0, destroy() {} }); }
export function getBaseViewport() { return Promise.resolve({ width: 595, height: 842 }); }
export function renderPageToCanvas() { return Promise.resolve({ cancel() {} }); }
export function loadOutline() { return Promise.resolve([]); }
export function loadPdfPage() { return 1; }
export function savePdfPage() {}
export const PDF_CMAP_URL = '';
export const PDF_FONT_URL = '';
export const PDF_WASM_URL = '';
