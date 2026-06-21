import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserData, getProfile, getAuthStatus, guestSession, logout as apiLogout, login as apiLogin, register as apiRegister } from './api';

interface AuthState {
  user: UserData | null;
  role: 'user' | 'guest' | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { firstName: string; lastName: string; email: string; gender: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  createGuest: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [role, setRole] = useState<'user' | 'guest' | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSession = useCallback(async () => {
    // ponytail: source of truth is the server cookie, not localStorage
    // — /api/auth/status reads req.user / req.guest from middleware
    try {
      const status = await getAuthStatus();
      if (status.role === 'user') {
        const data = await getProfile();
        setUser(data.user);
        setRole('user');
        localStorage.setItem('fm_role', 'user');
      } else if (status.role === 'guest') {
        setUser(null);
        setRole('guest');
        localStorage.setItem('fm_role', 'guest');
      } else {
        setUser(null);
        setRole(null);
        localStorage.removeItem('fm_role');
      }
    } catch {
      setUser(null);
      setRole(null);
      localStorage.removeItem('fm_role');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = async (email: string, password: string) => {
    const data = await apiLogin({ email, password });
    setUser(data.user);
    setRole('user');
    localStorage.setItem('fm_role', 'user');
  };

  const register = async (data: { firstName: string; lastName: string; email: string; gender: string; password: string }) => {
    const result = await apiRegister(data);
    setUser(result.user);
    setRole('user');
    localStorage.setItem('fm_role', 'user');
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
    setRole(null);
    localStorage.removeItem('fm_role');
  };

  const createGuest = async () => {
    await guestSession();
    setRole('guest');
    setUser(null);
    localStorage.setItem('fm_role', 'guest');
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, login, register, logout, createGuest }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}