// readerSwipe.probe.mjs —— 图书阅读器触屏滑动 → 翻章方向的单元探针
//
// 用户要求（2026-10-12）：
//   · 向下滑 / 向右滑 → 下一页；向上滑 / 向左滑 → 上一页；
//   · 「滑到底之后再滑没反应」要修掉（到底继续滑必须翻章）；
//   · 章节只有一屏（短章）时，上下滑直接翻章。
//
// 这几个方向判定全在纯函数 resolveSwipe 里，这里用 Node 直接跑表驱动断言。

import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { writeFileSync, unlinkSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '../src');

const built = await build({
  stdin: {
    contents: `export { resolveSwipe } from './components/BookReader.jsx';`,
    loader: 'js', resolveDir: SRC, sourcefile: 'swipe-entry.js'
  },
  bundle: true, write: false, format: 'esm', target: 'es2020',
  jsx: 'automatic', jsxImportSource: 'preact',
  loader: { '.css': 'empty', '.js': 'jsx', '.jsx': 'jsx' },
  // BookReader 现在会 import pdfReader.js，后者用 Vite 的 `?url` 后缀拿 worker 地址。
  // esbuild 不认识这个后缀，会把 `...pdf.worker.min.mjs?url` 当真模块解析并报
  // 「No matching export for import "default"」。探针只测 resolveSwipe 这个纯函数，
  // 所以把整个 pdfReader 换成一个空壳（下面用 alias 指向桩文件）。
  // BookReader 现在会 import pdfReader.js，后者用 Vite 的 `?url` 后缀拿 worker 地址，
  // esbuild 解析不了那个后缀。用一个插件在解析阶段把它换成桩文件 ——
  // 比 alias 可靠（esbuild 的 alias 不接受路径形式的键）。
  plugins: [{
    name: 'stub-pdf-reader',
    setup(b) {
      b.onResolve({ filter: /pdfReader\.js$/ }, () => ({
        path: resolve(HERE, 'stubs/pdfReader.stub.mjs')
      }));
    }
  }],
  define: {
    'import.meta.env.VITE_API_BASE_URL': '"http://127.0.0.1:9"',
    'import.meta.env.VITE_SUPABASE_URL': '""',
    'import.meta.env.VITE_SUPABASE_ANON_KEY': '""'
  },
  logLevel: 'silent'
});
const out = resolve(tmpdir(), `swipe-probe-${process.pid}.mjs`);
writeFileSync(out, built.outputFiles[0].text, 'utf8');
const mod = await import(`${pathToFileURL(out).href}?t=${Date.now()}`);
try { unlinkSync(out); } catch { /* 忽略 */ }
const { resolveSwipe } = mod;

let pass = 0; const fails = [];
function eq(name, actual, expected) {
  if (actual === expected) { pass += 1; return; }
  fails.push(`${name}：期望 ${expected}，实际 ${actual}`);
}

// ---- 横向：永远翻章（正文是纵向排版，横滑不冲突）----
eq('向右滑（dx>0）→ 下一章', resolveSwipe({ dx: 60, dy: 3 }), 1);
eq('向左滑（dx<0）→ 上一章', resolveSwipe({ dx: -60, dy: 3 }), -1);
eq('向右滑（手指右移 120px）→ 下一章', resolveSwipe({ dx: 120, dy: -20 }), 1);
eq('向左滑（手指左移 120px）→ 上一章', resolveSwipe({ dx: -120, dy: 20 }), -1);

// ---- 纵向：取决于起点是否已在尽头 ----
eq('往下读（dy<0）且已在底部 → 下一章', resolveSwipe({ dx: 0, dy: -60, atBottom: true }), 1);
eq('往下读（dy<0）但没到底 → 不翻章（正常滚动）', resolveSwipe({ dx: 0, dy: -60, atBottom: false }), 0);
eq('往回读（dy>0）且已在顶部 → 上一章', resolveSwipe({ dx: 0, dy: 60, atTop: true }), -1);
eq('往回读（dy>0）但没到顶 → 不翻章', resolveSwipe({ dx: 0, dy: 60, atTop: false }), 0);

// ---- 短章（一屏到底）：上下滑都直接翻章 ----
eq('短章往下读 → 下一章', resolveSwipe({ dx: 0, dy: -80, atBottom: true, atTop: true }), 1);
eq('短章往回读 → 上一章', resolveSwipe({ dx: 0, dy: 80, atBottom: true, atTop: true }), -1);

// ---- 阈值：小于 42px 一律不触发 ----
eq('位移 20px 不翻章', resolveSwipe({ dx: 20, dy: 0 }), 0);
eq('位移 41px 不翻章', resolveSwipe({ dx: 41, dy: 0 }), 0);
eq('位移 42px 触发', resolveSwipe({ dx: 42, dy: 0 }), 1);
eq('纵向 41px（在底部）不翻章', resolveSwipe({ dx: 0, dy: -41, atBottom: true }), 0);

// ---- 斜向：以主方向为准 ----
eq('斜向右下（横为主）→ 下一章', resolveSwipe({ dx: 80, dy: -30, atBottom: false }), 1);
eq('斜向左上（纵为主、在底部）→ 下一章', resolveSwipe({ dx: -20, dy: -80, atBottom: true }), 1);
eq('斜向左上（纵为主、没到底）→ 不翻章', resolveSwipe({ dx: -20, dy: -80, atBottom: false }), 0);

// ---- 非法输入不应崩 ----
eq('无参数 → 0', resolveSwipe(), 0);
eq('NaN → 0', resolveSwipe({ dx: NaN, dy: NaN }), 0);

console.log(`\n图书滑动翻章探针：${pass} 过 / ${fails.length} 失败`);
if (fails.length) { fails.forEach((f) => console.log(`  ❌ ${f}`)); process.exitCode = 1; }
else console.log('  ✅ 全部通过');
