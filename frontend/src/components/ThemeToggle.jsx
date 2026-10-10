// 主题切换按钮：白天 / 素雅（暗色主题 2026-10-09 已移除）
import { useTheme } from '../lib/theme.jsx';
import { Icon } from './Icon.jsx';

export function ThemeToggle() {
  const { isSepia, toggleTheme } = useTheme();
  const label = isSepia ? '当前：素雅，点击切换到白天' : '当前：白天，点击切换到素雅';
  return (
    <button class="theme-toggle" onClick={toggleTheme} title={label} aria-label={label}>
      <Icon name={isSepia ? 'leaf' : 'sun'} size={16} />
      <span>{isSepia ? '素雅' : '白天'}</span>
    </button>
  );
}
