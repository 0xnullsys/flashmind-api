import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserData, getProfile, guestSession, logout as apiLogout, login as apiLogin, register as apiRegister } from './api';

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
    try {
      const data = await getProfile();
      setUser(data.user);
      setRole('user');
    } catch {
      setUser(null);
      setRole(null);
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
  };

  const register = async (data: { firstName: string; lastName: string; email: string; gender: string; password: string }) => {
    const result = await apiRegister(data);
    setUser(result.user);
    setRole('user');
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
    setRole(null);
  };

  const createGuest = async () => {
    const data = await guestSession();
    setRole('guest');
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