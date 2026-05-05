import { createContext, useContext, useState, type ReactNode } from 'react';
import { clearAuthSession, loadAuthSession, saveAuthSession } from '../services/authService';
import type { AuthSession, User } from '../types/Auth';

type AuthContextValue = {
  session: AuthSession | null;
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  setAuthSession: (session: AuthSession) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        token: session?.token ?? null,
        isAuthenticated: Boolean(session?.token && user?.isActive !== false),
        isAdmin: user?.role === 'admin' && user?.isActive !== false,
        setAuthSession: setAuthState,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider.');
  }

  return context;
}
