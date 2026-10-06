// 设置页：主题自定义配色
import { ThemeCustomizer } from '../components/ThemeCustomizer.jsx';
import { useTheme } from '../lib/theme.jsx';

export function Settings() {
  const { theme, toggleTheme } = useTheme();
  return (
    <section class="stack">
      <div class="toolbar">
        <h2 style="margin:0">设置</h2>
        <span class="spacer" />
        <button onClick={toggleTheme}>切换到{theme === 'dark' ? '浅色' : '暗色'}主题</button>
      </div>

      <div class="card" style="padding:16px">
        <h3 style="margin-top:0">主题自定义配色</h3>
        <ThemeCustomizer />
      </div>
    </section>
  );
}
