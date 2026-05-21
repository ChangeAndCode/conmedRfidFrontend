import type { ReadingMode } from './PartConfig';

export type ServiceOrderStatus = 'open' | 'blocked' | 'closed';
export type ServiceOrderChangeRequestType = 'missing_product' | 'extra_product';
export type ServiceOrderChangeRequestStatus = 'pending' | 'resolved';
export type ServiceOrderReadingMode = Extract<ReadingMode, 'manual' | 'single_scan' | 'double_scan'>;

export interface ServiceOrder {
  _id: string;
  folio: string;
  readingMode: ServiceOrderReadingMode;
  partNumber?: string;
  gtin?: string;
  rfidProgram?: string;
  quantity: number;
  programmedCount?: number;
  verifiedCount?: number;
  remainingToProgram?: number;
  remainingToVerify?: number;
  status: ServiceOrderStatus;
  notes?: string;
  createdByUserId?: string;
  createdByUsername?: string;
  updatedByUserId?: string;
  updatedByUsername?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServiceOrderMutationPayload {
  folio?: string;
  readingMode: ServiceOrderReadingMode;
  partNumber?: string;
  gtin?: string;
  rfidProgram?: string;
  quantity: number;
  status?: ServiceOrderStatus;
  notes?: string;
}

export interface ServiceOrderMutationResponse {
  message: string;
  data: ServiceOrder;
}

export interface ServiceOrderChangeRequest {
  _id: string;
  serviceOrderId: string;
  serviceOrderFolio: string;
  requestType: ServiceOrderChangeRequestType;
  status: ServiceOrderChangeRequestStatus;
  resolutionNotes?: string;
  resolvedAt?: string;
  resolvedByUserId?: string;
  resolvedByUsername?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateServiceOrderChangeRequestPayload {
  requestType: ServiceOrderChangeRequestType;
  reason?: string;
}

export interface ResolveServiceOrderChangeRequestPayload {
  folio?: string;
  readingMode?: ServiceOrderReadingMode;
  partNumber?: string;
  gtin?: string;
  quantity?: number;
  rfidProgram?: string;
  notes?: string;
  resolutionNotes?: string;
  status?: Extract<ServiceOrderStatus, 'open' | 'closed'>;
}

export interface ResolveServiceOrderChangeRequestResponse {
  message: string;
  data: {
    serviceOrder: ServiceOrder;
    changeRequest: ServiceOrderChangeRequest;
  };
}

export interface ServiceOrderPartConfigOption {
  id: string;
  partNumber: string;
  description?: string;
  readingMode?: ReadingMode;
  rfidProgram?: string;
  filterLabel?: string;
  expectedLotLength?: number;
}
