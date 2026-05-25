import type { ServiceOrderReadingMode } from './ServiceOrder';

export type VerificationReportStatus =
  | 'generated'
  | 'print_interrupted'
  | 'printed'
  | 'reprinted';

export type VerificationReportHistoryEventType = VerificationReportStatus;

export interface VerificationReportAvailableActions {
  canMarkPrinted: boolean;
  canMarkPrintInterrupted: boolean;
  canReprint: boolean;
}

export interface VerificationReportRow {
  programmingRecordId: string;
  programmedAt: string;
  verifiedAt: string;
}

export interface VerificationReportHistoryEvent {
  type: VerificationReportHistoryEventType;
  occurredAt: string;
  performedByUserId?: string;
  performedByUsername?: string;
  notes?: string;
}

export interface VerificationReport {
  _id: string;
  serviceOrderId: string;
  serviceOrderFolio: string;
  serviceOrderReadingMode: ServiceOrderReadingMode;
  quantity: number;
  partNumber: string;
  lot: string;
  manufactureDate: string;
  manufacturingRepresentativeName: string;
  qualityRepresentativeName: string;
  rows: VerificationReportRow[];
  status: VerificationReportStatus;
  history: VerificationReportHistoryEvent[];
  availableActions?: VerificationReportAvailableActions | null;
  generatedByUserId?: string;
  generatedByUsername?: string;
  lastPrintedAt?: string;
  lastPrintInterruptedAt?: string;
  lastReprintedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateVerificationReportPayload {
  serviceOrderId: string;
  manufacturingRepresentativeName: string;
  qualityRepresentativeName: string;
}

export interface UpdateVerificationReportStatusPayload {
  notes?: string;
}

export interface VerificationReportMutationResponse {
  message: string;
  data: VerificationReport;
}
