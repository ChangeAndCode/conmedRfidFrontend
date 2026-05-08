import type { Gtin, GtinMutationPayload, GtinMutationResponse } from '../types/Gtin';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export async function listGtins(): Promise<Gtin[]> {
  const response = await fetch(`${API_URL}/api/gtins`);
  const result = (await response.json().catch(() => null)) as
    | { count?: number; data?: Gtin[]; message?: string }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo cargar la lista de GTIN.');
  }

  return result?.data ?? [];
}

export async function createGtin(payload: GtinMutationPayload): Promise<GtinMutationResponse> {
  const response = await fetch(`${API_URL}/api/gtins`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as
    | { message?: string; data?: Gtin }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo crear el GTIN.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye el GTIN creado.');
  }

  return {
    message: result.message ?? 'GTIN creado',
    data: result.data,
  };
}

export async function updateGtin(
  id: string,
  payload: Partial<GtinMutationPayload>,
): Promise<GtinMutationResponse> {
  const response = await fetch(`${API_URL}/api/gtins/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as
    | { message?: string; data?: Gtin }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo actualizar el GTIN.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye el GTIN actualizado.');
  }

  return {
    message: result.message ?? 'GTIN actualizado',
    data: result.data,
  };
}

export async function activateGtin(id: string): Promise<GtinMutationResponse> {
  return updateGtin(id, { isActive: true });
}

export async function deactivateGtin(id: string): Promise<GtinMutationResponse> {
  const response = await fetch(`${API_URL}/api/gtins/${id}`, {
    method: 'DELETE',
  });

  const result = (await response.json().catch(() => null)) as
    | { message?: string; data?: Gtin }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo desactivar el GTIN.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye el GTIN desactivado.');
  }

  return {
    message: result.message ?? 'GTIN desactivado',
    data: result.data,
  };
}
