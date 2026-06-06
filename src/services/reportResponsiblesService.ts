import { API_BASE_URL as API_URL } from '../config/api';
import type {
  ReportResponsibles,
  ReportResponsiblesMutationPayload,
  ReportResponsiblesMutationResponse,
} from '../types/ReportResponsibles';
import { buildAuthHeaders } from './authService';

export async function getReportResponsibles(): Promise<ReportResponsibles> {
  const response = await fetch(`${API_URL}/api/report-responsibles`, {
    headers: buildAuthHeaders(),
  });

  const result = (await response.json().catch(() => null)) as
    | { data?: ReportResponsibles; message?: string }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo cargar la configuracion de responsables.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye la configuracion de responsables.');
  }

  return result.data;
}

export async function updateReportResponsibles(
  payload: ReportResponsiblesMutationPayload,
): Promise<ReportResponsiblesMutationResponse> {
  const response = await fetch(`${API_URL}/api/report-responsibles`, {
    method: 'PUT',
    headers: buildAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as
    | { data?: ReportResponsibles; message?: string }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudieron actualizar los responsables.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye los responsables actualizados.');
  }

  return {
    message: result.message ?? 'Responsables de reporte actualizados.',
    data: result.data,
  };
}
