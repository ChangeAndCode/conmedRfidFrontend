import type {
  RfidProgram,
  RfidProgramMutationPayload,
  RfidProgramMutationResponse,
} from '../types/RfidProgram';
import { buildAuthHeaders } from './authService';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export async function listRfidPrograms(): Promise<RfidProgram[]> {
  const response = await fetch(`${API_URL}/api/rfid-programs`, {
    headers: buildAuthHeaders(),
  });
  const result = (await response.json().catch(() => null)) as
    | { count?: number; data?: RfidProgram[]; message?: string }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo cargar la lista de RFID Program.');
  }

  return result?.data ?? [];
}

export async function createRfidProgram(
  payload: RfidProgramMutationPayload,
): Promise<RfidProgramMutationResponse> {
  const response = await fetch(`${API_URL}/api/rfid-programs`, {
    method: 'POST',
    headers: buildAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as
    | { message?: string; data?: RfidProgram }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo crear el RFID program.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye el RFID program creado.');
  }

  return {
    message: result.message ?? 'RFID program creado',
    data: result.data,
  };
}

export async function updateRfidProgram(
  id: string,
  payload: Partial<RfidProgramMutationPayload>,
): Promise<RfidProgramMutationResponse> {
  const response = await fetch(`${API_URL}/api/rfid-programs/${id}`, {
    method: 'PATCH',
    headers: buildAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as
    | { message?: string; data?: RfidProgram }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo actualizar el RFID program.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye el RFID program actualizado.');
  }

  return {
    message: result.message ?? 'RFID program actualizado',
    data: result.data,
  };
}

export async function activateRfidProgram(id: string): Promise<RfidProgramMutationResponse> {
  return updateRfidProgram(id, { isActive: true });
}

export async function deactivateRfidProgram(id: string): Promise<RfidProgramMutationResponse> {
  const response = await fetch(`${API_URL}/api/rfid-programs/${id}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(),
  });

  const result = (await response.json().catch(() => null)) as
    | { message?: string; data?: RfidProgram }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo desactivar el RFID program.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye el RFID program desactivado.');
  }

  return {
    message: result.message ?? 'RFID program desactivado',
    data: result.data,
  };
}
