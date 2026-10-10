// 博客移动端底部毛玻璃工具栏（≤768px 显示，cosolar 风格，2026-10-09）
import { createPortal } from 'preact/compat';
import { route } from 'preact-router';
import { Icon } from './Icon.jsx';

const ITEMS = [
  { key: 'home', label: '首页', icon: 'blog', to: '/posts' },
  { key: 'categories', label: '分类', icon: 'layers', to: '/posts/categories' },
  { key: 'tags', label: '标签', icon: 'tag', to: '/posts/tags' },
  { key: 'archive', label: '归档', icon: 'calendar', to: '/posts/archive' },
  { key: 'search', label: '搜索', icon: 'search', to: '/posts?focus=search' }
];

export function BlogDock({ active }) {
  return createPortal(
    <nav class="cs-dock" aria-label="博客导航">
      {ITEMS.map((it) => (
        <button key={it.key} class={active === it.key ? 'on' : ''} onClick={() => route(it.to)}>
          <Icon name={it.icon} size={18} />
          <span>{it.label}</span>
        </button>
      ))}
    </nav>,
    document.body
  );
}

// 桌面端顶部的「分类 / 标签 / 归档」入口
export function BlogLinks({ active }) {
  return (
    <span class="cs-links">
      {ITEMS.slice(1, 4).map((it) => (
        <a key={it.key} href={it.to} class={active === it.key ? 'on' : ''}
          onClick={(e) => { e.preventDefault(); route(it.to); }}>
          <Icon name={it.icon} size={14} /> {it.label}
        </a>
      ))}
    </span>
  );
}
