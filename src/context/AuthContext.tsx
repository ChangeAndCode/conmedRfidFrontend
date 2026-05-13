import { useState, type ReactNode } from 'react';
import { AuthContext } from './authContext';
import { clearAuthSession, loadAuthSession, saveAuthSession } from '../services/authService';
import type { AuthSession } from '../types/Auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => loadAuthSession());

  const setAuthState = (nextSession: AuthSession) => {
    saveAuthSession(nextSession);
    setSession(nextSession);
  };

  const logout = () => {
    clearAuthSession();
    setSession(null);
  };

  const user = session?.user ?? null;
  const isAdmin = user?.role === 'admin' && user?.isActive !== false;
  const isSupervisor = user?.role === 'supervisor' && user?.isActive !== false;

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        token: session?.token ?? null,
        isAuthenticated: Boolean(session?.token && user?.isActive !== false),
        isAdmin,
        isSupervisor,
        canAccessBackoffice: isAdmin || isSupervisor,
        setAuthSession: setAuthState,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
