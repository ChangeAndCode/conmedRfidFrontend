import { API_BASE_URL } from '../config/api';
import type {
  Responsible,
  ResponsibleMutationPayload,
  ResponsiblesListResponse,
} from "../types/Responsible";
import { buildAuthHeaders } from "./authService";

const getAuthHeaders = () =>
  buildAuthHeaders({
    "Content-Type": "application/json",
  });

export const getResponsibles = async (): Promise<Responsible[]> => {
  const response = await fetch(`${API_BASE_URL}/api/responsibles`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  const data: ResponsiblesListResponse = await response.json();

  if (!response.ok) {
    throw new Error("Error al obtener responsables");
  }

  return data.data;
};

export const createResponsible = async (
  payload: ResponsibleMutationPayload
): Promise<Responsible> => {
  const response = await fetch(`${API_BASE_URL}/api/responsibles`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Error al crear responsable");
  }

  return data.data;
};

export const updateResponsible = async (
  id: string,
  payload: ResponsibleMutationPayload
): Promise<Responsible> => {
  const response = await fetch(
    `${API_BASE_URL}/api/responsibles/${id}`,
    {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Error al actualizar responsable");
  }

  return data.data;
};

export const toggleResponsibleStatus = async (
  id: string
): Promise<Responsible> => {
  const response = await fetch(
    `${API_BASE_URL}/api/responsibles/${id}/toggle-status`,
    {
      method: "PATCH",
      headers: getAuthHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Error al actualizar estatus");
  }

  return data.data;
};

export const deleteResponsible = async (
  id: string
): Promise<void> => {
  const response = await fetch(
    `${API_BASE_URL}/api/responsibles/${id}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Error al eliminar responsable");
  }
};
