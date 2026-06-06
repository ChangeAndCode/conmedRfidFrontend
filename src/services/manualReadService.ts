import { API_BASE_URL as API_URL } from '../config/api';
import type {
  CreateManualReadPayload,
  CreateManualReadResponse,
} from '../types/ManualRead';

export async function createManualRead(
  payload: CreateManualReadPayload,
): Promise<CreateManualReadResponse> {
  const response = await fetch(`${API_URL}/api/manual-reads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as CreateManualReadResponse | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo registrar la lectura manual.');
  }

  if (!result?.programmingRecord?.id) {
    throw new Error(
      'La respuesta del backend no incluye el programming record de la lectura manual.',
    );
  }

  return result;
}
