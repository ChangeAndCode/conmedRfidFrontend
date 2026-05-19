import type { User } from "../types/Auth";
import { buildAuthHeaders } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const getAuthHeaders = () =>
  buildAuthHeaders({
    'Content-Type': 'application/json',
});

export const getUsers = async (): Promise<User[]> => {
  const response = await fetch(`${API_BASE_URL}/api/users`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Error al obtener usuarios");
  }

  return data.users;
};

export const updateUserStatus = async (
  userId: string,
  isActive: boolean
): Promise<User> => {
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}/status`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ isActive }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Error al actualizar usuario");
  }

  return data.user;
};

export const deleteUser = async (userId: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Error al eliminar usuario");
  }
};