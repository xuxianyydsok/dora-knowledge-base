// 全局视图模式上下文：gallery（画廊网格）/ timeline（时间流）
import { createContext } from 'preact';
import { useContext, useEffect, useState, useCallback } from 'preact/hooks';

const ViewModeContext = createContext(null);
const STORAGE_KEY = 'kb-view-mode';

export function ViewModeProvider({ children }) {
  const [viewMode, setViewModeState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || 'gallery'
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, viewMode);
  }, [viewMode]);

  const setViewMode = useCallback((mode) => {
    if (mode === 'gallery' || mode === 'timeline') setViewModeState(mode);
  }, []);

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error('useViewMode 必须在 ViewModeProvider 内使用');
  return ctx;
}
