import type { ServiceOrder } from './ServiceOrder';

export interface CreateSingleScanPayload {
  serviceOrderId: string;
  partNumber: string;
  rawScan: string;
  notes?: string;
}

export interface ResolveSingleScanData {
  rawScan: string;
  gtin: string;
  lot?: string;
  manufactureDate?: string;
  matchingServiceOrders?: ServiceOrder[];
  serviceOrderCount?: number;
}

export interface ResolveSingleScanResponse {
  message: string;
  data: ResolveSingleScanData;
}

export interface SingleScanReadResponse {
  _id: string;
  serviceOrderId: string;
  serviceOrder?: string;
  partNumber: string;
  rawScan: string;
  rfidProgram?: string;
  gtin?: string;
  lot?: string;
  manufactureDate?: string;
  filterLabel?: string;
  notes?: string;
}

export interface CreateSingleScanResponse {
  message: string;
  data?: SingleScanReadResponse;
}
