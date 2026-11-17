import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User } from '../types';
import { DEMO_TOKEN, DEMO_SESSION_KEY, restoreDemoSession, startDemoSession, endDemoSession, reloadAtLoginRoute } from '../demo/session';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  updateUser: (updates: Partial<User>) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isDemo: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Frontend-only showcase: the only identity is the local demo session stored
 * in this browser. There is no server token, refresh or remote account.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => restoreDemoSession()?.token ?? null);
  const [user, setUser] = useState<User | null>(() => restoreDemoSession()?.user ?? null);

  const login = useCallback((newToken: string, newUser: User) => {
    if (newToken !== DEMO_TOKEN || newUser.role !== 'ROLE_DEMO') {
      throw new Error('Only the local demo account is available in this build.');
    }
    startDemoSession();
    setToken(null);
    setUser(null);
    reloadAtLoginRoute('/dashboard');
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((currentUser) => (currentUser ? { ...currentUser, ...updates } : currentUser));
  }, []);

  const logout = useCallback(() => {
    endDemoSession();
    setToken(null);
    setUser(null);
    reloadAtLoginRoute('/login');
  }, []);

  const isAuthenticated = !!token && !!user;
  const isDemo = token === DEMO_TOKEN && user?.role === 'ROLE_DEMO';

  useEffect(() => {
    // Signing in or out in another tab switches this tab too.
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key === DEMO_SESSION_KEY) {
        setToken(null);
        setUser(null);
        window.location.reload();
      }
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => logout();
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, token, login, updateUser, logout, isAuthenticated, isDemo }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
