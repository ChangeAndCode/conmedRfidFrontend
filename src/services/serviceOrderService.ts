import { buildAuthHeaders } from './authService';
import type {
  CreateServiceOrderChangeRequestPayload,
  ResolveServiceOrderChangeRequestPayload,
  ServiceOrderReadingMode,
  ResolveServiceOrderChangeRequestResponse,
  ServiceOrder,
  ServiceOrderChangeRequest,
  ServiceOrderMutationPayload,
  ServiceOrderMutationResponse,
  ServiceOrderPartConfigOption,
  ServiceOrderStatus,
} from '../types/ServiceOrder';
import type { ReadingMode } from '../types/PartConfig';

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

export async function listServiceOrders(filters?: {
  folio?: string;
  readingMode?: ServiceOrderReadingMode;
  partNumber?: string;
  gtin?: string;
  status?: ServiceOrderStatus;
}): Promise<ServiceOrder[]> {
  const response = await fetch(
    `${API_URL}/api/service-orders${buildQueryString({
      folio: filters?.folio,
      readingMode: filters?.readingMode,
      partNumber: filters?.partNumber,
      gtin: filters?.gtin,
      status: filters?.status,
    })}`,
    {
      headers: buildAuthHeaders(),
    },
  );

  const result = (await response.json().catch(() => null)) as
    | { message?: string; data?: ServiceOrder[] }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo cargar la lista de ordenes de servicio.');
  }

  return result?.data ?? [];
}

export async function getServiceOrderById(id: string): Promise<ServiceOrder> {
  const response = await fetch(`${API_URL}/api/service-orders/${id}`, {
    headers: buildAuthHeaders(),
  });

  const result = (await response.json().catch(() => null)) as
    | { message?: string; data?: ServiceOrder }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo consultar la orden de servicio.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye la orden de servicio solicitada.');
  }

  return result.data;
}

export async function createServiceOrder(
  payload: ServiceOrderMutationPayload,
): Promise<ServiceOrderMutationResponse> {
  const response = await fetch(`${API_URL}/api/service-orders`, {
    method: 'POST',
    headers: buildAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as
    | { message?: string; data?: ServiceOrder }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo crear la orden de servicio.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye la orden creada.');
  }

  return {
    message: result.message ?? 'Orden de servicio creada.',
    data: result.data,
  };
}

export async function updateServiceOrder(
  id: string,
  payload: Partial<ServiceOrderMutationPayload>,
): Promise<ServiceOrderMutationResponse> {
  const response = await fetch(`${API_URL}/api/service-orders/${id}`, {
    method: 'PATCH',
    headers: buildAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as
    | { message?: string; data?: ServiceOrder }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo actualizar la orden de servicio.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye la orden actualizada.');
  }

  return {
    message: result.message ?? 'Orden de servicio actualizada.',
    data: result.data,
  };
}

export async function listOpenServiceOrdersByGtin(
  gtin: string,
  readingMode: Extract<ReadingMode, 'single_scan' | 'double_scan'> = 'double_scan',
): Promise<ServiceOrder[]> {
  const response = await fetch(
    `${API_URL}/api/service-orders/resolve-by-gtin${buildQueryString({ gtin, readingMode })}`,
  );

  const result = (await response.json().catch(() => null)) as
    | { message?: string; data?: ServiceOrder[] }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudieron resolver las ordenes de servicio.');
  }

  return result?.data ?? [];
}

export async function listOpenServiceOrdersByPartNumber(
  partNumber: string,
  readingMode: Extract<ReadingMode, 'manual' | 'single_scan'> = 'manual',
): Promise<ServiceOrder[]> {
  const response = await fetch(
    `${API_URL}/api/service-orders/resolve-by-part-number${buildQueryString({ partNumber, readingMode })}`,
  );

  const result = (await response.json().catch(() => null)) as
    | { message?: string; data?: ServiceOrder[] }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudieron resolver las ordenes de servicio.');
  }

  return result?.data ?? [];
}

export async function listOpenManualServiceOrders(partNumber?: string): Promise<ServiceOrder[]> {
  const response = await fetch(
    `${API_URL}/api/service-orders/resolve-manual-open${buildQueryString({ partNumber })}`,
  );

  const result = (await response.json().catch(() => null)) as
    | { message?: string; data?: ServiceOrder[] }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudieron listar las ordenes manuales abiertas.');
  }

  return result?.data ?? [];
}

export async function listServiceOrderPartConfigOptions(
  id: string,
  readingMode: Extract<ReadingMode, 'manual' | 'single_scan' | 'double_scan'>,
): Promise<ServiceOrderPartConfigOption[]> {
  const response = await fetch(
    `${API_URL}/api/service-orders/${id}/part-config-options${buildQueryString({
      readingMode,
    })}`,
  );

  const result = (await response.json().catch(() => null)) as
    | { message?: string; data?: ServiceOrderPartConfigOption[] }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudieron resolver los numeros de parte.');
  }

  return result?.data ?? [];
}

export async function createServiceOrderChangeRequest(
  serviceOrderId: string,
  payload: CreateServiceOrderChangeRequestPayload,
): Promise<{ message: string; data: ServiceOrderChangeRequest }> {
  const response = await fetch(`${API_URL}/api/service-orders/${serviceOrderId}/change-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as
    | { message?: string; data?: ServiceOrderChangeRequest }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo crear la solicitud de cambio.');
  }

  if (!result?.data) {
    throw new Error('La respuesta del backend no incluye la solicitud creada.');
  }

  return {
    message: result.message ?? 'Solicitud de cambio creada.',
    data: result.data,
  };
}

export async function listServiceOrderChangeRequests(filters?: {
  status?: 'pending' | 'resolved';
  serviceOrderId?: string;
}): Promise<ServiceOrderChangeRequest[]> {
  const response = await fetch(
    `${API_URL}/api/service-orders/change-requests${buildQueryString({
      status: filters?.status,
      serviceOrderId: filters?.serviceOrderId,
    })}`,
    {
      headers: buildAuthHeaders(),
    },
  );

  const result = (await response.json().catch(() => null)) as
    | { message?: string; data?: ServiceOrderChangeRequest[] }
    | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudieron listar las solicitudes de cambio.');
  }

  return result?.data ?? [];
}

export async function resolveServiceOrderChangeRequest(
  id: string,
  payload: ResolveServiceOrderChangeRequestPayload,
): Promise<ResolveServiceOrderChangeRequestResponse> {
  const response = await fetch(`${API_URL}/api/service-orders/change-requests/${id}/resolve`, {
    method: 'PATCH',
    headers: buildAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as ResolveServiceOrderChangeRequestResponse | null;

  if (!response.ok) {
    throw new Error(result?.message ?? 'No se pudo resolver la solicitud de cambio.');
  }

  if (!result?.data?.serviceOrder || !result?.data?.changeRequest) {
    throw new Error('La respuesta del backend no incluye la resolucion de la solicitud.');
  }

  return result;
}
