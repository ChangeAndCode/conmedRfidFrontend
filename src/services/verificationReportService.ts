import { API_BASE_URL as API_URL } from '../config/api';
import { buildAuthHeaders } from './authService';
import type {
  CreateVerificationReportPayload,
  UpdateVerificationReportStatusPayload,
  VerificationReport,
  VerificationReportMutationResponse,
  VerificationReportStatus,
} from '../types/VerificationReport';

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

const parseVerificationReportResponse = async (response: Response) => {
  return (await response.json().catch(() => null)) as
    | { message?: string; data?: VerificationReport; count?: number }
    | null;
};

export async function listVerificationReports(filters?: {
  status?: VerificationReportStatus;
  serviceOrderId?: string;
  serviceOrderFolio?: string;
}): Promise<VerificationReport[]> {
  const response = await fetch(
    `${API_URL}/api/verification-reports${buildQueryString({
      status: filters?.status,
      serviceOrderId: filters?.serviceOrderId,
      serviceOrderFolio: filters?.serviceOrderFolio,
    })}`,
    {
      headers: buildAuthHeaders(),
    },
  );

  const result = (await response.json().catch(() => null)) as
    | { message?: string; data?: VerificationReport[]; count?: number }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudieron listar los reportes de verificacion.');
  }

  return result?.data ?? [];
}

export async function getVerificationReportById(id: string): Promise<VerificationReport> {
  const response = await fetch(`${API_URL}/api/verification-reports/${id}`, {
    headers: buildAuthHeaders(),
  });

  const result = await parseVerificationReportResponse(response);

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo consultar el reporte de verificacion.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye el reporte solicitado.');
  }

  return result.data;
}

export async function createVerificationReport(
  payload: CreateVerificationReportPayload,
): Promise<VerificationReportMutationResponse> {
  const response = await fetch(`${API_URL}/api/verification-reports`, {
    method: 'POST',
    headers: buildAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  const result = await parseVerificationReportResponse(response);

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo generar el reporte de verificacion.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye el reporte generado.');
  }

  return {
    message: result.message ?? 'Reporte de verificacion generado.',
    data: result.data,
  };
}

export async function markVerificationReportPrintInterrupted(
  id: string,
  payload: UpdateVerificationReportStatusPayload = {},
): Promise<VerificationReportMutationResponse> {
  const response = await fetch(`${API_URL}/api/verification-reports/${id}/print-interrupted`, {
    method: 'POST',
    headers: buildAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  const result = await parseVerificationReportResponse(response);

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo actualizar el reporte de verificacion.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye el reporte actualizado.');
  }

  return {
    message: result.message ?? 'Reporte marcado con impresion interrumpida.',
    data: result.data,
  };
}

export async function markPublicVerificationReportPrintInterrupted(
  id: string,
  payload: UpdateVerificationReportStatusPayload = {},
): Promise<VerificationReportMutationResponse> {
  const response = await fetch(
    `${API_URL}/api/public/verification-reports/${id}/print-interrupted`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  const result = await parseVerificationReportResponse(response);

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo actualizar el reporte de verificacion.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye el reporte actualizado.');
  }

  return {
    message: result.message ?? 'Reporte marcado con impresion interrumpida.',
    data: result.data,
  };
}

export async function markVerificationReportAsPrinted(
  id: string,
  payload: UpdateVerificationReportStatusPayload = {},
): Promise<VerificationReportMutationResponse> {
  const response = await fetch(`${API_URL}/api/verification-reports/${id}/print-completed`, {
    method: 'POST',
    headers: buildAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  const result = await parseVerificationReportResponse(response);

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo actualizar el reporte de verificacion.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye el reporte actualizado.');
  }

  return {
    message: result.message ?? 'Reporte marcado como impreso.',
    data: result.data,
  };
}

export async function markPublicVerificationReportAsPrinted(
  id: string,
  payload: UpdateVerificationReportStatusPayload = {},
): Promise<VerificationReportMutationResponse> {
  const response = await fetch(
    `${API_URL}/api/public/verification-reports/${id}/print-completed`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  const result = await parseVerificationReportResponse(response);

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo actualizar el reporte de verificacion.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye el reporte actualizado.');
  }

  return {
    message: result.message ?? 'Reporte marcado como impreso.',
    data: result.data,
  };
}

export async function reprintVerificationReport(
  id: string,
  payload: UpdateVerificationReportStatusPayload = {},
): Promise<VerificationReportMutationResponse> {
  const response = await fetch(`${API_URL}/api/verification-reports/${id}/reprint`, {
    method: 'POST',
    headers: buildAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  const result = await parseVerificationReportResponse(response);

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo reimprimir el reporte de verificacion.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye el reporte reimpreso.');
  }

  return {
    message: result.message ?? 'Reporte reimpreso.',
    data: result.data,
  };
}
