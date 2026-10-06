import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// 分包策略说明：
// - 重型可视化库（KaTeX/Three.js/Mermaid/Chart.js）仅通过 renderers/*.js 中的
//   动态 import() 引入，Rollup 会自动为其生成独立 chunk，不会进入首屏。
// - 这里不设置激进的 manualChunks，避免把动态引入的库合并进首屏 vendor 包。
export default defineConfig({
  plugins: [preact()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500
  },
  server: {
    port: 5173
  }
});
