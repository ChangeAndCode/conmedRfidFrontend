import { buildAuthHeaders } from './authService';
import type {
  ProgrammingRecord,
  ProgrammingRecordListFilters,
  ResolveProgrammingRecordPayload,
  ResolveProgrammingRecordResponse,
  VerifyProgrammingRecordPayload,
  VerifyProgrammingRecordResponse,
} from '../types/ProgrammingRecord';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const buildQueryString = (params: Record<string, string | undefined>) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (!value) {
      return;
    }

    searchParams.set(key, value);
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export async function listProgrammingRecords(
  filters?: ProgrammingRecordListFilters,
): Promise<ProgrammingRecord[]> {
  const response = await fetch(
    `${API_URL}/api/programming-records${buildQueryString({
      mode: filters?.mode,
      sourceType: filters?.sourceType,
      sourceReadId: filters?.sourceReadId,
      serviceOrderId: filters?.serviceOrderId,
      serviceOrderFolio: filters?.serviceOrderFolio,
      partNumber: filters?.partNumber,
      gtin: filters?.gtin,
      rfidProgram: filters?.rfidProgram,
      status: filters?.status,
    })}`,
    {
      headers: buildAuthHeaders(),
    },
  );

  const result = (await response.json().catch(() => null)) as
    | { count?: number; data?: ProgrammingRecord[]; message?: string }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudieron listar los programming records.');
  }

  return result?.data ?? [];
}

export async function getProgrammingRecordById(id: string): Promise<ProgrammingRecord> {
  const response = await fetch(`${API_URL}/api/programming-records/${id}`, {
    headers: buildAuthHeaders(),
  });

  const result = (await response.json().catch(() => null)) as
    | { data?: ProgrammingRecord; message?: string }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo consultar el programming record.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye el programming record solicitado.');
  }

  return result.data;
}

export async function resolveProgrammingRecord(
  payload: ResolveProgrammingRecordPayload,
): Promise<ResolveProgrammingRecordResponse> {
  const response = await fetch(`${API_URL}/api/programming-records/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as ResolveProgrammingRecordResponse | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo resolver la programacion.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye la resolucion de programacion.');
  }

  return result;
}

export async function verifyProgrammingRecord(
  id: string,
  payload: VerifyProgrammingRecordPayload,
): Promise<VerifyProgrammingRecordResponse> {
  const response = await fetch(`${API_URL}/api/programming-records/${id}/verify`, {
    method: 'POST',
    headers: buildAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as VerifyProgrammingRecordResponse | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo verificar la programacion.');
  }

  if (!result?.data?.programmingRecord) {
    throw new Error('La respuesta del backend no incluye el programming record verificado.');
  }

  return result;
}
