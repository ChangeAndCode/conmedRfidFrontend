import { buildAuthHeaders } from './authService';
import type {
  BuildRfidPayloadData,
  BuildRfidPayloadResponse,
  CompleteProgrammingPayload,
  CompleteProgrammingResponse,
} from '../types/RfidProgramming';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export async function buildRfidPayload(
  programmingRecordId: string,
  tagId: string,
): Promise<{ message: string; data: BuildRfidPayloadData }> {
  const response = await fetch(
    `${API_URL}/api/programming-records/${programmingRecordId}/build-rfid-payload`,
    {
      method: 'POST',
      headers: buildAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ tagId }),
    },
  );

  const result = (await response.json().catch(() => null)) as BuildRfidPayloadResponse | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo construir el payload RFID.');
  }

  if (!result?.data?.payloadHex || !result.data.authCode) {
    throw new Error('La respuesta del backend no incluye un payload RFID valido.');
  }

  return {
    message: result.message ?? 'Payload RFID generado.',
    data: result.data,
  };
}

export async function completeProgramming(
  programmingRecordId: string,
  payload: CompleteProgrammingPayload,
): Promise<CompleteProgrammingResponse> {
  const response = await fetch(
    `${API_URL}/api/programming-records/${programmingRecordId}/complete-programming`,
    {
      method: 'POST',
      headers: buildAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(payload),
    },
  );

  const result = (await response.json().catch(() => null)) as CompleteProgrammingResponse | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo confirmar la programacion RFID.');
  }

  return result ?? { message: 'Programacion RFID confirmada.' };
}
