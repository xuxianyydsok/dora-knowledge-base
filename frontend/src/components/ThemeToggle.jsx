// 主题切换按钮：浅色 / 暗色
import { useTheme } from '../lib/theme.jsx';

export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  return (
    <button onClick={toggleTheme} title="切换主题" aria-label="切换主题">
      {isDark ? '🌙 暗色' : '☀️ 浅色'}
    </button>
  );
}
