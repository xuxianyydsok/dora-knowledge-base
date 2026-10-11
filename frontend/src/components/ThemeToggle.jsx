// 主题切换按钮：纯净 / 素雅 / 天青 三套循环切换
//
// 2026-10-11：从「白天/素雅」两套改成三套；显示名一律不带「主题」二字（纯净 / 素雅 / 天青），
// 显示名集中在 lib/theme.jsx 的 MODES 里，这里只负责渲染与切换。
// 按钮右侧的「设置」入口（gear）由 Layout 负责，站长/管理员登录后可进 /settings。
import { useTheme, MODES, modeLabel } from '../lib/theme.jsx';
import { Icon } from './Icon.jsx';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const current = MODES.find((m) => m.key === theme) || MODES[0];
  const next = MODES[(MODES.indexOf(current) + 1) % MODES.length];
  const label = `当前：${modeLabel(theme)}，点击切换到${next.label}`;
  return (
    <button class="theme-toggle" onClick={toggleTheme} title={label} aria-label={label}>
      <Icon name={current.icon} size={16} />
      <span>{current.label}</span>
    </button>
  );
}
