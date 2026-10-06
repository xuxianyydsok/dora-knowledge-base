// 设置页：主题自定义配色
import { ThemeCustomizer } from '../components/ThemeCustomizer.jsx';
import { useTheme } from '../lib/theme.jsx';
import { PageHeader } from '../components/PageHeader.jsx';

export function Settings() {
  const { theme, toggleTheme } = useTheme();
  return (
    <section class="stack">
      <PageHeader kicker="Preferences" title="设置" sub="主题、配色与账号偏好。">
        <button onClick={toggleTheme}>切换到{theme === 'dark' ? '浅色' : '暗色'}主题</button>
      </PageHeader>

      <div class="card" style="padding:16px">
        <h3 style="margin-top:0">主题自定义配色</h3>
        <ThemeCustomizer />
      </div>
    </section>
  );
}
