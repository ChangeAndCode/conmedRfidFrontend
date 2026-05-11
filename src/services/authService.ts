import type { AuthSession, LoginCredentials, RegisterPayload, User } from '../types/Auth';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const AUTH_STORAGE_KEY = 'conmed-rfid-auth-session';

export const buildAuthHeaders = (headers: Record<string, string> = {}) => {
  const token = loadAuthSession()?.token;

  if (!token) {
    return headers;
  }

  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
};

const getDefaultLoginErrorMessage = (status: number) => {
  switch (status) {
    case 400:
      return 'Verifica el correo y la contrasena capturados.';
    case 401:
      return 'Correo o contrasena incorrectos.';
    default:
      return 'No se pudo iniciar sesion.';
  }
};

const getDefaultRegisterErrorMessage = (status: number) => {
  switch (status) {
    case 400:
      return 'Verifica el nombre de usuario, correo y contrasena.';
    case 409:
      return 'El correo o el nombre de usuario ya existen.';
    default:
      return 'No se pudo registrar el usuario.';
  }
};

export async function login(credentials: LoginCredentials): Promise<AuthSession> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  const result = (await response.json().catch(() => null)) as
    | { message?: string; data?: AuthSession }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? getDefaultLoginErrorMessage(response.status));
  }

  if (!result?.data?.token || !result.data.user) {
    throw new Error('La respuesta del backend no incluye una sesion valida.');
  }

  return result.data;
}

export async function registerUser(payload: RegisterPayload): Promise<User> {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: buildAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as
    | { message?: string; data?: { user?: User } }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? getDefaultRegisterErrorMessage(response.status));
  }

  if (!result?.data?.user) {
    throw new Error('La respuesta del backend no incluye el usuario registrado.');
  }

  return result.data.user;
}

export function loadAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawSession = window.localStorage.getItem(AUTH_STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    const parsedSession = JSON.parse(rawSession) as AuthSession;

    if (!parsedSession?.token || !parsedSession?.user) {
      clearAuthSession();
      return null;
    }

    return parsedSession;
  } catch {
    clearAuthSession();
    return null;
  }
}

export function saveAuthSession(session: AuthSession) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}
