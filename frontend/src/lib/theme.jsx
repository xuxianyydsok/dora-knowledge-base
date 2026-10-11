// 全局主题上下文：纯净 light / 素雅 sepia / 天青 celadon + 用户自定义配色（持久化到后端 + localStorage）
//
// 2026-10-09：暗色主题已移除（用户要求），素雅配色参考 GithubStarsManager（MIT）；旧的 'dark' 记录自动当作 light。
// 2026-10-11：① 新增第三套主题「天青」（celadon，青绿主色）；② 显示名统一不带「主题」二字
//   （「白天」→「纯净」、「天青绿」→「天青」），三个模式的显示名集中在 MODES 里，别在别处硬编码。
// 自定义配色通过 CSS 变量覆盖实现
import { createContext } from 'preact';
import { useContext, useEffect, useState, useCallback } from 'preact/hooks';
import { api } from './api.js';
import { supabase } from './supabase.js';

const ThemeContext = createContext(null);
const MODE_KEY = 'kb-theme';
const COLORS_KEY = 'kb-theme-colors';

// 三套主题的唯一事实来源：key 用于 data-theme / 后端存储，label 用于界面显示。
// ⚠ 用户要求显示名**不要带「主题」二字**：纯净 / 素雅 / 天青。
export const MODES = [
  { key: 'light', label: '纯净', icon: 'sun' },
  { key: 'sepia', label: '素雅', icon: 'leaf' },
  { key: 'celadon', label: '天青', icon: 'droplet' }
];
export const MODE_KEYS = MODES.map((m) => m.key);
export const modeLabel = (key) => MODES.find((m) => m.key === key)?.label || MODES[0].label;
export const isMode = (key) => MODE_KEYS.includes(key);

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
  },
  celadon: {
    bg: '#eef6f5', bg_elevated: '#ffffff', bg_subtle: '#e2efed',
    text: '#0f1f1e', text_muted: '#55716e', border: '#cfe3e0',
    primary: '#0f9b8e', primary_contrast: '#ffffff', danger: '#d0453f'
  }
};

function emptyColors() {
  return { light: {}, sepia: {}, celadon: {} };
}

function readLocalColors() {
  try { return { ...emptyColors(), ...(JSON.parse(localStorage.getItem(COLORS_KEY)) || {}) }; }
  catch { return emptyColors(); }
}

function applyColors(colors) {
  const root = document.documentElement;
  // 先清除旧的覆盖变量（三套主题都要清，否则切换后会残留上一套的自定义色）
  for (const variant of MODE_KEYS) {
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
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(MODE_KEY);
    return isMode(saved) ? saved : 'light';   // 旧的 'dark' / 未知值一律回到「纯净」
  });
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
        const { mode, light, sepia, celadon } = pref.theme;
        if (isMode(mode)) setTheme(mode);
        if (light || sepia || celadon) {
          setColors({ light: light || {}, sepia: sepia || {}, celadon: celadon || {} });
        }
      } catch { /* 忽略未登录/网络错误 */ }
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { if (s) load(); });
    return () => { active = false; sub?.subscription?.unsubscribe(); };
  }, []);

  // 三套主题循环切换（纯净 → 素雅 → 天青 → 纯净）
  const toggleTheme = useCallback(() => setTheme((t) => {
    const i = MODE_KEYS.indexOf(t);
    return MODE_KEYS[(i < 0 ? 0 : i + 1) % MODE_KEYS.length];
  }), []);

  // 设置单个配色（当前主题）
  const setColor = useCallback((key, value) => {
    setColors((c) => ({ ...c, [theme]: { ...(c[theme] || {}), [key]: value } }));
  }, [theme]);

  // 保存到后端
  const saveColors = useCallback(async () => {
    const payload = {
      mode: theme,
      light: colors.light || {},
      sepia: colors.sepia || {},
      celadon: colors.celadon || {}
    };
    const saved = await api.updatePreferences(payload);
    return saved;
  }, [theme, colors]);

  // 重置为默认
  const resetColors = useCallback(async () => {
    setColors(emptyColors());
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
