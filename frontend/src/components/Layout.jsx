// 全局基础布局：单行顶栏（品牌 · 一级导航 · 更多菜单 · 搜索/主题/通知 · 头像菜单） + 主内容区
//
// 设计取舍：顶栏只平铺**内容模块**入口；工具类入口（收藏/分类/标签）收进「更多」；图谱 2026-10-09 起常显在影视后面，
// 图片展/时间轴 2026-10-10 起也升为一级（用户要求不藏在「更多」里）；账号相关（设置/备份/用户管理/退出）收进头像菜单。
// 之前是 12 项平铺 + 邮箱/退出挤在同一行，窄一点就折成两行、层级混乱。
import { useEffect, useRef, useState } from 'preact/hooks';
import { useRouter } from 'preact-router';
import { ThemeToggle } from './ThemeToggle.jsx';
import { NotificationBell } from './NotificationBell.jsx';
import { Logo } from './Logo.jsx';
import { Icon } from './Icon.jsx';
import { useAuth } from '../lib/auth.jsx';

const PRIMARY = [
  ['/news', 'NewsNow'], ['/github', 'GitHub'], ['/posts', '博客'],
  ['/music', '音乐'], ['/movies', '影视'], ['/graph', '图谱'],
  ['/gallery', '图片展'], ['/timeline', '时间轴']
];

const TOOLS = [
  ['/favorites', '收藏', 'heart'],
  ['/categories', '分类', 'list'], ['/tags', '标签', 'tag']
];

// 通用下拉：点击展开；点击外部 / Esc / 选中任意项后关闭
function Dropdown({ trigger, triggerClass = 'menu-trigger', children, align = 'right', label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div class="menu" ref={ref}>
      <button
        type="button"
        class={`${triggerClass}${open ? ' open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>
      {open && (
        <div class={`menu-panel ${align}`} role="menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, icon, children }) {
  return (
    <a class="menu-item" href={href} role="menuitem">
      {icon && <Icon name={icon} size={16} />}
      <span>{children}</span>
    </a>
  );
}

export function Layout({ children }) {
  const { isAuthenticated, user, signOut, isAdmin } = useAuth();
  const [router] = useRouter();
  const path = router?.path || '/';

  const link = (href, label) => (
    <a
      href={href}
      class={path === href ? 'active' : ''}
      aria-current={path === href ? 'page' : undefined}
    >{label}</a>
  );
  const initial = String(user?.email || 'D').trim().charAt(0).toUpperCase();

  return (
    <div class={`app-shell${(router?.url || '').startsWith('/graph') ? ' page-dark' : ''}`}>
      <header class="app-header">
        <a href="/" class="brand" aria-label="Dora 首页">
          <Logo size={30} />
          <span>Dora</span>
        </a>

        {/* 窄屏（≤1080px）不再用三横线抽屉，一级导航直接横向滚动（2026-10-09，阈值 2026-10-10 由 920px 上调，见 docs/removed-features.md） */}
        <nav class="app-nav">
          {PRIMARY.map(([href, label]) => link(href, label))}
          {(
            <Dropdown
              label="更多"
              align="left"
              triggerClass="menu-trigger nav-more"
              trigger={<><span>更多</span><Icon name="chevronDown" size={14} /></>}
            >
              {TOOLS.map(([href, label, icon]) => (
                <MenuLink key={href} href={href} icon={icon}>{label}</MenuLink>
              ))}
              {/* 源健康中心：仅管理员可见（普通访客 / 用户看不到入口） */}
              {isAdmin && <MenuLink href="/sources" icon="wave">源状态</MenuLink>}
            </Dropdown>
          )}
        </nav>

        <span class="spacer" />

        {(
          <a href="/search" class="icon-btn" title="全局搜索" aria-label="全局搜索">
            <Icon name="search" size={18} />
          </a>
        )}
        <ThemeToggle />
        {isAuthenticated && <NotificationBell />}

        {isAuthenticated ? (
          <Dropdown
            label="账号"
            align="right"
            triggerClass="menu-trigger avatar-trigger"
            trigger={<span class={`avatar${isAdmin ? ' admin' : ''}`}>{initial}</span>}
          >
            <div class="menu-head">
              <span class={`avatar lg${isAdmin ? ' admin' : ''}`}>{initial}</span>
              <div class="menu-head-text">
                <strong>{isAdmin ? '管理员' : '用户'}</strong>
                <span>{user?.email}</span>
              </div>
            </div>
            <div class="menu-sep" />
            <MenuLink href="/settings" icon="settings">设置</MenuLink>
            <MenuLink href="/backup" icon="backup">备份</MenuLink>
            {isAdmin && <MenuLink href="/admin/users" icon="crown">用户管理</MenuLink>}
            <div class="menu-sep" />
            <button type="button" class="menu-item danger" onClick={signOut}>
              <Icon name="logout" size={16} />
              <span>退出登录</span>
            </button>
          </Dropdown>
        ) : null /* 访客模式：暂不展示登录入口，站长可直接访问 /login */}
      </header>

      <main class="app-main">{children}</main>
    </div>
  );
}
