import type {
  PrintInterruption,
  PrintInterruptionMutationPayload,
  PrintInterruptionMutationResponse,
} from '../types/PrintInterruption';
import { buildAuthHeaders } from './authService';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export async function listPrintInterruptions(): Promise<PrintInterruption[]> {
  const response = await fetch(`${API_URL}/api/print-interruptions`, {
    headers: buildAuthHeaders(),
  });

  const result = (await response.json().catch(() => null)) as
    | { count?: number; data?: PrintInterruption[]; message?: string }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudieron cargar las interrupciones de impresion.');
  }

  return result?.data ?? [];
}

export async function listPublicPrintInterruptions(): Promise<PrintInterruption[]> {
  const response = await fetch(`${API_URL}/api/public/print-interruptions`);

  const result = (await response.json().catch(() => null)) as
    | { count?: number; data?: PrintInterruption[]; message?: string }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudieron cargar las interrupciones de impresion.');
  }

  return result?.data ?? [];
}

export async function createPrintInterruption(
  payload: PrintInterruptionMutationPayload,
): Promise<PrintInterruptionMutationResponse> {
  const response = await fetch(`${API_URL}/api/print-interruptions`, {
    method: 'POST',
    headers: buildAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as
    | { data?: PrintInterruption; message?: string }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo crear la interrupcion de impresion.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye la interrupcion creada.');
  }

  return {
    message: result.message ?? 'Interrupcion de impresion creada.',
    data: result.data,
  };
}

export async function deletePrintInterruption(
  id: string,
): Promise<PrintInterruptionMutationResponse> {
  const response = await fetch(`${API_URL}/api/print-interruptions/${id}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(),
  });

  const result = (await response.json().catch(() => null)) as
    | { data?: PrintInterruption; message?: string }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo eliminar la interrupcion de impresion.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye la interrupcion eliminada.');
  }

  return {
    message: result.message ?? 'Interrupcion de impresion eliminada.',
    data: result.data,
  };
}
