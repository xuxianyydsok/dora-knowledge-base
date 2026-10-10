// 全局主题上下文：白天 light / 素雅 sepia + 用户自定义配色（持久化到后端 + localStorage）
// 2026-10-09：暗色主题已移除（用户要求），素雅配色参考 GithubStarsManager（MIT）。旧的 'dark' 记录自动当作 light。
// 自定义配色通过 CSS 变量覆盖实现
import { createContext } from 'preact';
import { useContext, useEffect, useState, useCallback } from 'preact/hooks';
import { api } from './api.js';
import { supabase } from './supabase.js';

const ThemeContext = createContext(null);
const MODE_KEY = 'kb-theme';
const COLORS_KEY = 'kb-theme-colors';

// 可自定义的 CSS 变量（与后端白名单一致）
export const THEME_VARS = [
  { key: 'bg', label: '背景' },
  { key: 'bg_elevated', label: '卡片背景' },
  { key: 'bg_subtle', label: '次级背景' },
  { key: 'text', label: '正文' },
  { key: 'text_muted', label: '次要文字' },
  { key: 'border', label: '边框' },
  { key: 'primary', label: '主色' },
  { key: 'primary_contrast', label: '主色文字' },
  { key: 'danger', label: '危险色' }
];

// 默认配色（与 global.css 保持一致，用于「重置」预览）
export const DEFAULT_COLORS = {
  light: {
    bg: '#eef1f8', bg_elevated: '#ffffff', bg_subtle: '#e6eaf3',
    text: '#10131a', text_muted: '#5b6472', border: '#d9dfea',
    primary: '#4a6cf7', primary_contrast: '#ffffff', danger: '#e5484d'
  },
  sepia: {
    bg: '#f2f0eb', bg_elevated: '#fbfaf7', bg_subtle: '#e9e6df',
    text: '#2a2824', text_muted: '#77716a', border: '#e0dcd3',
    primary: '#3b3833', primary_contrast: '#ffffff', danger: '#c2524e'
  }
};

function readLocalColors() {
  try { return JSON.parse(localStorage.getItem(COLORS_KEY)) || { light: {}, sepia: {} }; }
  catch { return { light: {}, sepia: {} }; }
}

function applyColors(colors) {
  const root = document.documentElement;
  // 先清除旧的覆盖变量
  for (const variant of ['light', 'sepia']) {
    for (const { key } of THEME_VARS) root.style.removeProperty(`--${key}`);
  }
  // 仅对当前主题应用对应配色
  const mode = root.getAttribute('data-theme') || 'light';
  const active = colors?.[mode] || {};
  for (const [key, value] of Object.entries(active)) {
    if (value) root.style.setProperty(`--${key}`, value);
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => (localStorage.getItem(MODE_KEY) === 'sepia' ? 'sepia' : 'light'));
  const [colors, setColors] = useState(readLocalColors);

  // 应用主题模式
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(MODE_KEY, theme);
    applyColors(colors);
  }, [theme]);

  // 应用自定义配色
  useEffect(() => {
    localStorage.setItem(COLORS_KEY, JSON.stringify(colors));
    applyColors(colors);
  }, [colors]);

  // 登录后从后端加载偏好
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) return;
      try {
        const pref = await api.getPreferences();
        if (!active || !pref?.theme) return;
        const { mode, light, sepia } = pref.theme;
        if (mode) setTheme(mode === 'sepia' ? 'sepia' : 'light');
        if (light || sepia) setColors({ light: light || {}, sepia: sepia || {} });
      } catch { /* 忽略未登录/网络错误 */ }
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { if (s) load(); });
    return () => { active = false; sub?.subscription?.unsubscribe(); };
  }, []);

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'sepia' ? 'light' : 'sepia')), []);

  // 设置单个配色（当前主题）
  const setColor = useCallback((key, value) => {
    setColors((c) => ({ ...c, [theme]: { ...(c[theme] || {}), [key]: value } }));
  }, [theme]);

  // 保存到后端
  const saveColors = useCallback(async () => {
    const payload = {
      mode: theme,
      light: colors.light || {},
      sepia: colors.sepia || {}
    };
    const saved = await api.updatePreferences(payload);
    return saved;
  }, [theme, colors]);

  // 重置为默认
  const resetColors = useCallback(async () => {
    setColors({ light: {}, sepia: {} });
    try { await api.resetPreferences(); } catch { /* 忽略 */ }
  }, []);

  return (
    <ThemeContext.Provider value={{
      theme, setTheme, toggleTheme, isSepia: theme === 'sepia',
      colors, setColor, saveColors, resetColors, currentColors: colors[theme] || {}
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme 必须在 ThemeProvider 内使用');
  return ctx;
}
