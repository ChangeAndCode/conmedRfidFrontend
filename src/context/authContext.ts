import { createContext } from 'react';
import type { AuthSession, User } from '../types/Auth';

export type AuthContextValue = {
  session: AuthSession | null;
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSupervisor: boolean;
  canAccessBackoffice: boolean;
  setAuthSession: (session: AuthSession) => void;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
