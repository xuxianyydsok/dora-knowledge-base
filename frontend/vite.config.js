import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

// 把 pdf.js 的附加资源拷进构建产物（public/pdfjs/）。
//
// 为什么需要：pdf.js 渲染**中文 PDF** 时必须能取到 Adobe CMap（GBK / Big5 等
// 编码映射）与标准字体数据，否则旧版中文书会整页空白或乱码。
// 这三份资源不在 npm 包的默认入口里，得自己搬。
//
// 放在 public/ 而不是 import：这些是运行时按需请求的数据文件（169 个 bcmap
// + 16 个字体 + 2 个 wasm），走 import 会被 Rollup 逐个打包进 bundle，得不偿失。
// 拷进 public 后由 Pages 静态托管，pdf.js 只在遇到需要 cmap 的页时才去取。
function copyPdfAssets() {
  const src = resolve(ROOT, 'node_modules/pdfjs-dist');
  const dest = resolve(ROOT, 'public/pdfjs');
  const dirs = ['cmaps', 'standard_fonts', 'wasm'];
  for (const d of dirs) {
    const from = resolve(src, d);
    if (!existsSync(from)) continue;          // 换 pdf.js 版本时目录可能改名，跳过而不是构建失败
    const to = resolve(dest, d);
    mkdirSync(to, { recursive: true });
    cpSync(from, to, { recursive: true });
  }
}

// 把 pdf.js 资源拷进 public/pdfjs/（开发与构建都执行一次）
function pdfAssetsPlugin() {
  return {
    name: 'copy-pdfjs-assets',
    buildStart() { copyPdfAssets(); }
  };
}

// 分包策略说明：
// - 重型可视化库（KaTeX/Three.js/Mermaid/Chart.js）仅通过 renderers/*.js 中的
//   动态 import() 引入，Rollup 会自动为其生成独立 chunk，不会进入首屏。
// - 这里不设置激进的 manualChunks，避免把动态引入的库合并进首屏 vendor 包。
export default defineConfig({
  plugins: [preact(), pdfAssetsPlugin()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500
  },
  server: {
    port: 5173
  }
});
