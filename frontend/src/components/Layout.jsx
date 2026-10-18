// 全局基础布局：单行顶栏（品牌 · 一级导航 · 搜索/主题/通知 · 头像菜单） + 主内容区
//
// 设计取舍：顶栏只平铺**内容模块**入口；账号相关（设置/备份/用户管理/源状态/退出）收进头像菜单。
// 2026-10-11（第一轮）：去掉「更多」下拉——它当时只剩「碎念」一项；碎念升为一级导航。
// 2026-10-11（第二轮，本文件）：一级导航已到 9 项，「图谱」从单入口改成**「更多」下拉**，
//   内含「博客图谱」/「开源项目图谱」两个子项（原先的站长控制台仍在 /graph，只是不再出现在顶栏）。
//   用户已确认：日后功能再多，就把放不下的项继续收进这个「更多」下拉。
import { useEffect, useRef, useState } from 'preact/hooks';
import { useRouter } from 'preact-router';
import { ThemeToggle } from './ThemeToggle.jsx';
import { NotificationBell } from './NotificationBell.jsx';
import { Logo } from './Logo.jsx';
import { Icon } from './Icon.jsx';
import { useAuth } from '../lib/auth.jsx';

const PRIMARY = [
  ['/news', 'NewsNow'], ['/github', 'GitHub'],
  ['/posts', '博客'],
  ['/music', '音乐'], ['/movies', '影视'],
  ['/books', '图书'],
  ['/gallery', '图展'], ['/timeline', '时间轴'], ['/moments', '碎念'],
  ['/graph/blog', '图谱'], ['/favorites', '收藏'],
  // 「数学」2026-10-13 新增，2026-10-14 从「整页跳转」改成**本站路由**：
  // 内容仍是 public/math/ 下的静态讲义子站（考研数学一：微积分 / 线性代数 /
  // 概率统计，27 章、可交互图），但改由 /math 路由以 iframe 内嵌渲染 ——
  // 点击后内容直接出现在导航下方，不再离开主站。详见 routes/MathFrame.jsx。
  ['/math', '数学'],
  // 「更新 / 共创」2026-10-13 曾收进「更多」下拉，同日用户改主意：
  // 「还是不要添加那个更多的那个按钮，还是把更新和共创放出来，在那个导航栏上」。
  // 所以恢复成一级导航项（导航栏本来就支持横向滚动，窄屏不会挤坏）。
  ['/changelog', '更新'], ['/coop', '共创']
];

// 需要「整页跳转」而不是 SPA 内部路由的入口（配合 link() 里的 data-native）。
// 2026-10-14 起已无成员：特效图鉴挑选页不再放进站点，改在本地单独跑
// （见 ~/projects/html-lab/motion-gallery/）。机制保留备用。
const NATIVE_LINKS = new Set();

// 「图谱」是一级导航（指向 /graph/blog）；两种图谱在页面内用标签切换（博客图谱 / 开源项目图谱）。
// 旧入口 /graph 是站长个人控制台（AI 解读进度等私有数据），仍可直接访问，但不出现在顶栏。

// 分类 / 标签已从导航移除（2026-10-11）：博客页已自带分类与标签视图，独立入口冗余。
// 路由本身保留（/categories、/tags 仍可直接访问），只是不再出现在菜单里。

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
    <a
      class="menu-item"
      href={href}
      role="menuitem"
      // 与顶栏 link() 同一套逃生阀：静态子站要整页跳转，
      // 否则会被 preact-router 当成 SPA 路由吞掉。
      {...(NATIVE_LINKS.has(href) ? { 'data-native': '' } : {})}
    >
      {icon && <Icon name={icon} size={16} />}
      <span>{children}</span>
    </a>
  );
}

export function Layout({ children }) {
  const { isAuthenticated, user, signOut, isAdmin } = useAuth();
  const [router] = useRouter();
  const path = router?.path || '/';

  // 图谱是一级入口，两个子路径（博客图谱 / 开源项目图谱）都算「图谱」这一项激活
  const isActive = (href) => (href === '/graph/blog' ? path.startsWith('/graph/') : path === href);
  const link = (href, label) => (
    <a
      href={href}
      // 逃生阀：preact-router 会全局拦截 <a> 点击并把同源路径当作 SPA 路由处理。
      // 需要"整页跳转"的入口（见 NATIVE_LINKS）在这里加 data-native 放行原生导航。
      // 2026-10-14 起 NATIVE_LINKS 为空集，机制保留备用。
      {...(NATIVE_LINKS.has(href) ? { 'data-native': '' } : {})}
      class={isActive(href) ? 'active' : ''}
      aria-current={isActive(href) ? 'page' : undefined}
    >{label}</a>
  );
  const initial = String(user?.email || 'D').trim().charAt(0).toUpperCase();

  // page-dark 只给站长控制台 /graph 用；公开星图（/graph/blog、/graph/repos）跟随站点主题色
  const shellClass = `app-shell${(router?.url || '').split('?')[0] === '/graph' ? ' page-dark' : ''}`;

  // 顶栏默认全透明，让全站网格背景从它背后铺过去（与内容区无缝衔接）；
  // 页面往下滚动后补一层玻璃底 + 模糊，保证导航文字压在内容上仍然清楚。
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 路由切换后回到顶部（2026-10-11）：之前从长页面（如图谱）点进新页面，
  // 会保留原滚动位置，看起来像「点了一下就滑到最底下」。这里在路径变化时复位。
  const routePath = (router?.url || '/').split('?')[0];
  useEffect(() => { window.scrollTo(0, 0); }, [routePath]);

  return (
    <div class={shellClass}>
      <header class={`app-header${scrolled ? ' is-scrolled' : ''}`}>
        <a href="/" class="brand" aria-label="Dora Studio 首页">
          <Logo size={30} />
          {/* 品牌名（2026-10-11 用户要求）：Dora 后面加 Studio，Studio 用弱化的小字排开 */}
          <span class="brand-name">Dora<em class="brand-studio">Studio</em></span>
        </a>

        {/* 窄屏（≤1080px）不再用三横线抽屉，一级导航直接横向滚动（2026-10-09，阈值 2026-10-10 由 920px 上调，见 docs/removed-features.md） */}
        <nav class="app-nav">
          {PRIMARY.map(([href, label]) => link(href, label))}
        </nav>

        <span class="spacer" />

        {(
          <a href="/search" class="icon-btn" title="全局搜索" aria-label="全局搜索">
            <Icon name="search" size={18} />
          </a>
        )}
        <ThemeToggle />
        {/* 登录入口（2026-10-11 用户要求）：
            齿轮「设置」按钮已移除；未登录时在主题按钮右侧放一枚**与主题按钮同款**的胶囊按钮
            （图标 + 「登录」两字），点击进 /login 完成站长登录 / 新用户注册。
            已登录后不再显示这枚按钮，账号相关入口统一收进右侧头像菜单。 */}
        {!isAuthenticated && (
          <a href="/login" class="login-link" title="站长登录 / 注册" aria-label="登录">
            <Icon name="login" size={16} />
            <span>登录</span>
          </a>
        )}
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
            {/* 视频库：仅站长可见（2026-10-13 用户要求「先留着，但只在我的管理员端呈现」）。
                暂未对访客开放，等确定要不要继续开发再决定是否放回一级导航。 */}
            {isAdmin && <MenuLink href="/videos" icon="video">视频库</MenuLink>}
            {isAdmin && <MenuLink href="/admin/feedback" icon="heart">共创反馈</MenuLink>}
            {isAdmin && <MenuLink href="/admin/excerpts" icon="sparkles">首页摘抄</MenuLink>}
            {isAdmin && <MenuLink href="/admin/hero-subtitle" icon="pencil">首页摘要</MenuLink>}
            {/* 源健康中心：仅管理员可见（原先挂在已删除的「更多」下拉里） */}
            {isAdmin && <MenuLink href="/sources" icon="wave">源状态</MenuLink>}
            <div class="menu-sep" />
            <button type="button" class="menu-item danger" onClick={signOut}>
              <Icon name="logout" size={16} />
              <span>退出登录</span>
            </button>
          </Dropdown>
        ) : null}
      </header>

      {/* key 随路径变化 → 路由切换时整块重挂，触发一次淡入上浮（见 global.css 的 .app-main > *）。
          query 不参与 key：同一页面换筛选条件不应该整页闪一下。 */}
      <main class="app-main" key={routePath}>{children}</main>
    </div>
  );
}
