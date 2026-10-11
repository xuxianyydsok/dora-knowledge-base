// 界面一致性探针（本地构建产物 + 真实无头 Chrome，零依赖）：
//   1) 「图标 + 文字」按钮是否被挤成两行（图标掉到第二行 → 按钮比同类高一截）；
//   2) 同一操作区里并排的按钮是否等高；
//   3) 搜索框（.toolbar-field / .inline-form）里的按钮不能高过框本身；
//   4) 图谱侧栏：分类 / 标签 / 语言 / 应用分类必须全部平铺，无内部滚动条，且与画布等高。
//
// 用法：先起本地静态服务 `node tests/spa-server.mjs dist 5173`，再跑本文件。
import { withPage } from './cdp.mjs';

const BASE = process.env.UI_BASE || 'http://127.0.0.1:5173';
let pass = 0; let fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ✓ ${m}`); } else { fail++; console.log(`  ✗ ${m}`); } };

// 浏览器里跑的一段量测：把所有按钮的尺寸 / display / 是否含图标 一次取回
const MEASURE = `(() => {
  const rect = (el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
  const info = (el) => {
    const cs = getComputedStyle(el);
    const svg = el.querySelector('svg.icon');
    const kids = [...el.children].filter((c) => c.tagName !== 'BR');
    return {
      text: (el.textContent || '').trim().slice(0, 10),
      cls: String(el.className || '').slice(0, 40),
      ...rect(el),
      display: cs.display,
      hasIcon: !!svg,
      childCount: kids.length,
      // 图标与文字是否落在不同行：图标底边明显高于按钮内容底边
      iconBottom: svg ? Math.round(svg.getBoundingClientRect().bottom) : null,
      contentBottom: el.getBoundingClientRect().bottom
    };
  };
  const all = (s) => [...document.querySelectorAll(s)];

  const groups = [
    '.detail-actions', '.np-actions', '.song-actions', '.mh-hero-actions',
    '.am-hero-actions', '.console-actions', '.set-actions', '.row', '.toolbar'
  ];
  const rows = [];
  for (const sel of groups) {
    for (const g of all(sel)) {
      const btns = [...g.children].filter((c) => c.tagName === 'BUTTON' || (c.tagName === 'A' && c.classList.contains('btn')));
      if (btns.length >= 2) rows.push({ sel, items: btns.map(info) });
    }
  }

  return {
    buttons: all('button').map(info),
    rows,
    fields: all('.toolbar-field, .inline-form, .music-search, .cs-search').map((f) => {
      const b = f.querySelector('button:not(.field-clear)');
      return { cls: String(f.className).slice(0, 30), field: rect(f), btn: b ? rect(b) : null };
    }),
    sidePanels: all('.sm-panel').map((p) => {
      const chips = p.querySelector('.sm-chips');
      return {
        label: (p.querySelector('header span')?.textContent || '').trim(),
        panel: rect(p),
        chipsClientH: chips ? chips.clientHeight : 0,
        chipsScrollH: chips ? chips.scrollHeight : 0,
        chipCount: chips ? chips.querySelectorAll('.sm-chip').length : 0
      };
    }),
    canvas: (() => { const c = document.querySelector('.sm-canvas-box'); return c ? rect(c) : null; })(),
    side: (() => { const s = document.querySelector('.sm-side'); return s ? rect(s) : null; })()
  };
})()`;

async function goto(ev, path, waitMs = 12000) {
  await ev(`(async () => { history.pushState({}, '', '${path}'); window.dispatchEvent(new PopStateEvent('popstate')); return 1; })()`);
  await ev(`new Promise(r => setTimeout(r, ${waitMs}))`);
}

async function main() {
  const pages = ['/movies', '/music', '/books', '/favorites', '/moments', '/settings', '/timeline'];

  console.log('=== 1/3 · 按钮是否被挤成两行（图标掉行） ===');
  await withPage(`${BASE}/movies`, async (ev) => {
    for (const p of pages) {
      await goto(ev, p, 6000);
      const m = await ev(MEASURE);
      // 判定：含图标的按钮里，图标底边明显低于按钮内容底边 → 图标/文字分行
      const wrapped = m.buttons.filter((b) => b.hasIcon && b.iconBottom !== null
        && b.iconBottom >= b.contentBottom - 1 && b.h > 46);
      ok(wrapped.length === 0, `${p} 无「图标掉到第二行」的按钮${wrapped.length ? '：' + wrapped.map((b) => `${b.text}(${b.w}×${b.h})`).join(' / ') : ''}`);
      console.log(`    ${p} 共 ${m.buttons.length} 个按钮，最高 ${m.buttons.length ? Math.max(...m.buttons.map((b) => b.h)) : 0}px`);
    }
  });

  console.log('=== 2/3 · 搜索框里的按钮不得高过框 ===');
  await withPage(`${BASE}/movies`, async (ev) => {
    for (const p of ['/movies', '/music', '/search']) {
      await goto(ev, p, 7000);
      const m = await ev(MEASURE);
      const bad = m.fields.filter((f) => f.btn && f.btn.h > f.field.h);
      ok(bad.length === 0, `${p} 搜索框按钮未超出（检查 ${m.fields.length} 个框，超出 ${bad.length} 个）`);
      for (const f of m.fields) {
        if (f.btn) console.log(`    ${p} ${f.cls}: 框 ${f.field.h}px / 按钮 ${f.btn.h}px`);
      }
    }
  });

  console.log('=== 3/3 · 图谱侧栏：全部平铺 + 与画布等高 ===');
  await withPage(`${BASE}/graph/blog`, async (ev) => {
    for (const p of ['/graph/blog', '/graph/repos']) {
      await goto(ev, p, 15000);
      const m = await ev(MEASURE);
      ok(m.sidePanels.length >= 2, `${p} 侧栏有 ${m.sidePanels.length} 个面板`);
      for (const s of m.sidePanels) {
        ok(s.chipsScrollH <= s.chipsClientH + 2,
          `${p} 「${s.label}」无内部滚动条（${s.chipCount} 个 chip，内容 ${s.chipsScrollH}px / 可见 ${s.chipsClientH}px）`);
      }
      if (m.canvas && m.side) {
        const diff = Math.abs(m.canvas.h - m.side.h);
        ok(diff <= 2, `${p} 侧栏与画布等高（${m.canvas.h}px vs ${m.side.h}px，差 ${diff}px）`);
      }
    }
  });

  console.log(`\n结果：${pass} 过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('探针异常:', e.message); process.exit(2); });
