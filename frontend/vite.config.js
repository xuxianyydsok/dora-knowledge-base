import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Preact 单页应用构建配置
export default defineConfig({
  plugins: [preact()],
  build: {
    outDir: 'dist',
    // 路由级代码分割由动态 import 自动处理，这里显式拆分第三方依赖
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  },
  server: {
    port: 5173
  }
});
