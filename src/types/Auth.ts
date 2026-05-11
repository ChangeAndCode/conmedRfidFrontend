export type UserRole = 'admin' | 'supervisor';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
  password?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface AuthSession {
  token: string;
  user: User;
}

export interface AuthApiResponse {
  message: string;
  data: AuthSession;
}

export interface RegisterApiResponse {
  message: string;
  data: {
    user: User;
  };
}
