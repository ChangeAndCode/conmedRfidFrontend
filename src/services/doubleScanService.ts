import { API_BASE_URL as API_URL } from '../config/api';
import type {
  CreateDoubleScanPayload,
  CreateDoubleScanResponse,
  ResolveFirstDoubleScanResponse,
} from '../types/DoubleScan';

export async function resolveFirstDoubleScan(firstBarcodeRaw: string) {
  const response = await fetch(`${API_URL}/api/double-scan-reads/resolve-first-scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ firstBarcodeRaw }),
  });

  const result = (await response.json().catch(() => null)) as ResolveFirstDoubleScanResponse | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo resolver el primer codigo.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye la resolucion del primer codigo.');
  }

  return result.data;
}

export async function createDoubleScanRead(payload: CreateDoubleScanPayload) {
  const response = await fetch(`${API_URL}/api/double-scan-reads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as CreateDoubleScanResponse | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo registrar la lectura doble.');
  }

  if (!result?.programmingRecord?.id) {
    throw new Error(
      'La respuesta del backend no incluye el programming record de la lectura doble.',
    );
  }

  return result;
}
