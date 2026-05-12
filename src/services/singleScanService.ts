import type {
  CreateSingleScanPayload,
  CreateSingleScanResponse,
  ResolveSingleScanData,
  ResolveSingleScanResponse,
} from '../types/SingleScan';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export async function resolveSingleScan(rawScan: string): Promise<ResolveSingleScanData> {
  const response = await fetch(`${API_URL}/api/single-scan-reads/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rawScan }),
  });

  const result = (await response.json().catch(() => null)) as ResolveSingleScanResponse | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo resolver la lectura single scan.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye la resolucion del single scan.');
  }

  return result.data;
}

export async function createSingleScanRead(payload: CreateSingleScanPayload) {
  const response = await fetch(`${API_URL}/api/single-scan-reads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as CreateSingleScanResponse | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo registrar la lectura single scan.');
  }

  return result ?? { message: 'Lectura single scan registrada.' };
}
