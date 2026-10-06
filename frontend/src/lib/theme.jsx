// 全局主题上下文：light / dark + 用户自定义配色（持久化到后端 + localStorage）
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
  dark: {
    bg: '#0a0c12', bg_elevated: '#171b24', bg_subtle: '#1e232e',
    text: '#eef1f6', text_muted: '#9aa4b5', border: '#2a3140',
    primary: '#6f8dff', primary_contrast: '#0a0c12', danger: '#ff6b70'
  }
};

function readLocalColors() {
  try { return JSON.parse(localStorage.getItem(COLORS_KEY)) || { light: {}, dark: {} }; }
  catch { return { light: {}, dark: {} }; }
}

function applyColors(colors) {
  const root = document.documentElement;
  // 先清除旧的覆盖变量
  for (const variant of ['light', 'dark']) {
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
  const [theme, setTheme] = useState(() => localStorage.getItem(MODE_KEY) || 'light');
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
        const { mode, light, dark } = pref.theme;
        if (mode) setTheme(mode);
        if (light || dark) setColors({ light: light || {}, dark: dark || {} });
      } catch { /* 忽略未登录/网络错误 */ }
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { if (s) load(); });
    return () => { active = false; sub?.subscription?.unsubscribe(); };
  }, []);

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

  // 设置单个配色（当前主题）
  const setColor = useCallback((key, value) => {
    setColors((c) => ({ ...c, [theme]: { ...(c[theme] || {}), [key]: value } }));
  }, [theme]);

  // 保存到后端
  const saveColors = useCallback(async () => {
    const payload = {
      mode: theme,
      light: colors.light || {},
      dark: colors.dark || {}
    };
    const saved = await api.updatePreferences(payload);
    return saved;
  }, [theme, colors]);

  // 重置为默认
  const resetColors = useCallback(async () => {
    setColors({ light: {}, dark: {} });
    try { await api.resetPreferences(); } catch { /* 忽略 */ }
  }, []);

  return (
    <ThemeContext.Provider value={{
      theme, setTheme, toggleTheme, isDark: theme === 'dark',
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
