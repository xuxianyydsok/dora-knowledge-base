// adminShortcuts.probe.mjs —— 管理员首页快捷入口与首页摘要编辑探针
//
// 覆盖：
//   1) 管理员多两个入口：首页摘要、首页轮播；
//   2) 普通用户 / 访客不出现这两个管理员入口；
//   3) 快捷入口面板与「最近添加」同高；
//   4) 首页摘要管理页调用 GET /api/site-settings 与 PATCH；
//   5) 首页轮播读取摘要，失败时保留内置文案；
//   6) 首页轮播快捷入口带 ?hero=1，图展页据此直接打开轮播抽屉。
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

let pass = 0;
const fails = [];
const ok = (name, cond, extra = '') => {
  if (cond) { pass += 1; console.log(`  ✅ ${name}`); }
  else { fails.push(`${name}${extra ? ` —— ${extra}` : ''}`); console.log(`  ❌ ${name}${extra ? ` —— ${extra}` : ''}`); }
};

console.log('\n管理员快捷入口探针\n' + '='.repeat(52));

const home = read('frontend/src/routes/Home.jsx');
ok('管理员入口包含「首页摘要」', home.includes("to: '/admin/hero-subtitle'"));
ok('管理员入口包含「首页轮播」', home.includes("to: '/gallery?hero=1'"));
ok('管理员入口只在 isAdmin 时拼接', /isAdmin\s*\?\s*\[\.\.\.ADMIN_SHORTCUTS/.test(home));
ok('快捷入口面板有等高类', home.includes('panel console-shortcuts'));

const css = read('frontend/src/styles/global.css');
ok('控制台两栏改为拉伸等高', /\.console-cols\s*\{[^}]*align-items:\s*stretch/.test(css));
ok('快捷入口面板高度 100%', /\.console-shortcuts\s*\{[^}]*height:\s*100%/.test(css));

const app = read('frontend/src/app.jsx');
ok('首页摘要路由仅管理员', /admin path="\/admin\/hero-subtitle"/.test(app));
ok('路由组件已导出', read('frontend/src/routes/routes.js').includes('AdminHeroSubtitle'));

const admin = read('frontend/src/routes/AdminHeroSubtitle.jsx');
ok('管理页读取 site-settings', admin.includes('api.getSiteSettings()'));
ok('管理页保存 hero_subtitle', admin.includes('api.updateSiteSettings({ hero_subtitle: { text:'));
ok('管理页最多 500 字', /MAX_TEXT\s*=\s*500/.test(admin));

const hero = read('frontend/src/components/HeroCarousel.jsx');
ok('首页轮播读取摘要接口', hero.includes('api.getSiteSettings()'));
ok('接口失败保留内置文案', hero.includes('保持内置摘要'));
ok('摘要渲染到 .ld-hero-sub', /<p class="ld-hero-sub">\{subtitle\}<\/p>/.test(hero));

const gallery = read('frontend/src/routes/Gallery.jsx');
ok('图展识别 ?hero=1', gallery.includes("get('hero') === '1'"));
ok('图展据此打开轮播抽屉', /setEditingHero\(true\)/.test(gallery));

const layout = read('frontend/src/components/Layout.jsx');
ok('头像菜单有首页摘要入口', layout.includes('href="/admin/hero-subtitle"'));

console.log('\n' + '='.repeat(52));
console.log(`结果：${pass} 过 / ${fails.length} 失败`);
if (fails.length) {
  console.log(fails.map((f) => `  - ${f}`).join('\n'));
  process.exitCode = 1;
}
