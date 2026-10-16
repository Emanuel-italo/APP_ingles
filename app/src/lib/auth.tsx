import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setAuthToken, type Level, type User } from './api';
import { storage } from './storage';

const TOKEN_KEY = 'fala.token';

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; level: Level }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await storage.get(TOKEN_KEY);
      if (token) {
        setAuthToken(token);
        try {
          setUser((await api.me()).user);
        } catch {
          setAuthToken(null);
          await storage.remove(TOKEN_KEY);
        }
      }
      setLoading(false);
    })();
  }, []);

  const startSession = async ({ token, user }: { token: string; user: User }) => {
    setAuthToken(token);
    await storage.set(TOKEN_KEY, token);
    setUser(user);
  };

  const login = useCallback(async (email: string, password: string) => {
    await startSession(await api.login({ email, password }));
  }, []);

  const register = useCallback(async (data: { name: string; email: string; password: string; level: Level }) => {
    await startSession(await api.register(data));
  }, []);

  const logout = useCallback(async () => {
    setAuthToken(null);
    await storage.remove(TOKEN_KEY);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    setUser((await api.me()).user);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, setUser, refresh }),
    [user, loading, login, register, logout, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
