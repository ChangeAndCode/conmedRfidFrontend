import type {
  PartConfig,
  PartConfigMutationPayload,
  PartConfigMutationResponse,
} from '../types/PartConfig';
import { buildAuthHeaders } from './authService';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export async function listPartConfigs(): Promise<PartConfig[]> {
  const response = await fetch(`${API_URL}/api/part-configs`, {
    headers: buildAuthHeaders(),
  });
  const result = (await response.json().catch(() => null)) as
    | { count?: number; data?: PartConfig[]; message?: string }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo cargar la lista de numeros de parte.');
  }

  return result?.data ?? [];
}

export async function createPartConfig(
  payload: PartConfigMutationPayload,
): Promise<PartConfigMutationResponse> {
  const response = await fetch(`${API_URL}/api/part-configs`, {
    method: 'POST',
    headers: buildAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as
    | { message?: string; data?: PartConfig }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo crear la configuracion del numero de parte.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye la configuracion creada.');
  }

  return {
    message: result.message ?? 'Configuracion de numero de parte creada.',
    data: result.data,
  };
}

export async function updatePartConfig(
  id: string,
  payload: Partial<PartConfigMutationPayload>,
): Promise<PartConfigMutationResponse> {
  const response = await fetch(`${API_URL}/api/part-configs/${id}`, {
    method: 'PATCH',
    headers: buildAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as
    | { message?: string; data?: PartConfig }
    | null;

  if (!response.ok) {
    throw new Error(
      result?.message ?? 'No se pudo actualizar la configuracion del numero de parte.',
    );
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye la configuracion actualizada.');
  }

  return {
    message: result.message ?? 'Configuracion de numero de parte actualizada.',
    data: result.data,
  };
}

export async function activatePartConfig(id: string): Promise<PartConfigMutationResponse> {
  return updatePartConfig(id, { isActive: true });
}

export async function deactivatePartConfig(id: string): Promise<PartConfigMutationResponse> {
  const response = await fetch(`${API_URL}/api/part-configs/${id}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(),
  });

  const result = (await response.json().catch(() => null)) as
    | { message?: string; data?: PartConfig }
    | null;

  if (!response.ok) {
    throw new Error(
      result?.message ?? 'No se pudo desactivar la configuracion del numero de parte.',
    );
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye la configuracion desactivada.');
  }

  return {
    message: result.message ?? 'Configuracion de numero de parte desactivada.',
    data: result.data,
  };
}

export async function permanentlyDeletePartConfig(
  id: string,
): Promise<PartConfigMutationResponse> {
  const response = await fetch(`${API_URL}/api/part-configs/${id}/permanent`, {
    method: 'DELETE',
    headers: buildAuthHeaders(),
  });

  const result = (await response.json().catch(() => null)) as
    | { message?: string; data?: PartConfig }
    | null;

  if (!response.ok) {
    throw new Error(
      result?.message ?? 'No se pudo eliminar permanentemente el numero de parte.',
    );
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye la configuracion eliminada.');
  }

  return {
    message: result.message ?? 'Configuracion de numero de parte eliminada permanentemente.',
    data: result.data,
  };
}
