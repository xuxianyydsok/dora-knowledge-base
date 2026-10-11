// 全局鉴权上下文：维护 Supabase 会话与用户角色
import { createContext } from 'preact';
import { useContext, useEffect, useState, useCallback } from 'preact/hooks';
import { supabase } from './supabase.js';
import { API_BASE_URL } from './config.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // 登录后从后端拉取真实角色（user_profiles.role），而非依赖 user_metadata
  const loadProfile = useCallback(async (token) => {
    if (!token) { setProfile(null); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/api/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(res.ok ? (await res.json()).data : null);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    // 启动提速（2026-10-11）：本地 getSession 一回来就解除 loading，让首屏立刻可渲染；
    // 角色资料 /api/me 改为后台补拉，不再阻塞首屏（否则每次整页刷新都要等一次网络往返，
    // 后端冷启动时尤其明显）。isAdmin 会在 profile 回来后自动就位。
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      loadProfile(data.session?.access_token);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      await loadProfile(s?.access_token);
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);

  const signIn = useCallback(async (email, password) => {
    if (!supabase) throw new Error('Supabase 未配置');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }, []);

  const signUp = useCallback(async (email, password) => {
    if (!supabase) throw new Error('Supabase 未配置');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const user = session?.user ?? null;
  const value = {
    session,
    user,
    profile,
    loading,
    isAuthenticated: !!user,
    isAdmin: profile?.role === 'admin',
    signIn,
    signUp,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return ctx;
}
