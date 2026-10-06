// 暗色/浅色主题自定义配色面板
import { useState } from 'preact/hooks';
import { useTheme, THEME_VARS, DEFAULT_COLORS } from '../lib/theme.jsx';

export function ThemeCustomizer() {
  const { theme, colors, setColor, saveColors, resetColors, currentColors } = useTheme();
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function save() {
    setStatus(''); setError('');
    try { await saveColors(); setStatus('已保存到云端'); }
    catch (e) { setError(e.message); }
  }

  async function reset() {
    setStatus(''); setError('');
    try { await resetColors(); setStatus('已重置为默认配色'); }
    catch (e) { setError(e.message); }
  }

  function applyDefaults() {
    const d = DEFAULT_COLORS[theme];
    for (const { key } of THEME_VARS) setColor(key, d[key]);
  }

  return (
    <div class="stack">
      <p class="muted" style="font-size:13px">
        当前编辑：<strong>{theme === 'dark' ? '暗色' : '浅色'}</strong>主题配色（切换主题可分别配置）
      </p>

      <div class="gallery-grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
        {THEME_VARS.map(({ key, label }) => (
          <label key={key} class="row" style="gap:8px;justify-content:space-between">
            <span style="font-size:13px">{label}</span>
            <input
              type="color"
              value={currentColors[key] || DEFAULT_COLORS[theme][key]}
              onInput={(e) => setColor(key, e.currentTarget.value)}
              style="width:56px;padding:2px"
            />
          </label>
        ))}
      </div>

      <div class="row">
        <button class="primary" onClick={save}>保存配色</button>
        <button onClick={applyDefaults}>填入默认值</button>
        <button class="danger" onClick={reset}>重置为默认</button>
        <span class="spacer" />
        {status && <span class="muted">{status}</span>}
        {error && <span style="color:var(--danger)">{error}</span>}
      </div>
    </div>
  );
}
