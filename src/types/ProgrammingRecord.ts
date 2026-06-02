import type { ServiceOrder } from './ServiceOrder';
import type {
  VerificationReportAvailableActions,
  VerificationReportStatus,
} from './VerificationReport';

export type ProgrammingRecordMode = 'manual' | 'single_scan' | 'double_scan';

export type ProgrammingRecordSourceType =
  | 'manual_read'
  | 'single_scan_read'
  | 'double_scan_read';

export type ProgrammingRecordStatus = 'captured' | 'programmed' | 'verified';

export type ProgrammingRecordMatchStrategy =
  | 'manual_raw_reference'
  | 'single_scan_raw'
  | 'double_scan_raw'
  | 'gs1_fields';

export type ProgrammingRecordResolutionType =
  | 'no_match'
  | 'single_match'
  | 'multiple_matches';

export interface ProgrammingRecordCaptureReference {
  id: string;
  mode: ProgrammingRecordMode;
  status: ProgrammingRecordStatus;
}

export interface ProgrammingRawSourceData {
  rawReference?: string;
  rawScan?: string;
  firstBarcodeRaw?: string;
  secondBarcodeRaw?: string;
}

export interface ProgrammingVerificationData {
  rawReference?: string;
  rawScan?: string;
  firstBarcodeRaw?: string;
  secondBarcodeRaw?: string;
  rfidPayloadText?: string;
  tagId?: string;
}

export interface ProgrammingRecord {
  _id: string;
  mode: ProgrammingRecordMode;
  sourceType: ProgrammingRecordSourceType;
  sourceReadId: string;
  serviceOrderId?: string;
  serviceOrderFolio?: string;
  partConfigId?: string;
  partNumber: string;
  rfidProgram?: string;
  gtin?: string;
  lot?: string;
  manufactureDate?: string;
  filterLabel?: string;
  rawSourceData: ProgrammingRawSourceData;
  verificationData?: ProgrammingVerificationData;
  verificationMatchedBy?: ProgrammingRecordMatchStrategy;
  verificationNotes?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  notes?: string;
  createdBy?: string;
  status: ProgrammingRecordStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface ResolveProgrammingRecordPayload {
  mode: ProgrammingRecordMode;
  rawReference?: string;
  rawScan?: string;
  firstBarcodeRaw?: string;
  secondBarcodeRaw?: string;
}

export interface VerifyProgrammingRecordPayload {
  rawReference?: string;
  rawScan?: string;
  firstBarcodeRaw?: string;
  secondBarcodeRaw?: string;
  rfidPayloadText?: string;
  tagId?: string;
  verifiedBy?: string;
  verificationNotes?: string;
}

export interface ProgrammingRecordVerificationReportSummary {
  exists: boolean;
  canGenerate: boolean;
  reportId: string | null;
  status: VerificationReportStatus | null;
  availableActions: VerificationReportAvailableActions | null;
}

export interface ResolvedVerificationRfidPayload {
  rawText: string;
  partNumber?: string;
  rawPartNumber?: string;
  lot?: string;
  manufactureDate?: string;
  tagId?: string;
}

export interface ResolveVerificationProgrammingRecordPayload
  extends ResolveProgrammingRecordPayload {
  serviceOrderId: string;
  rfidPayloadText: string;
  tagId: string;
}

export interface ResolveVerificationProgrammingRecordResponse {
  message: string;
  data: {
    programmingRecord: ProgrammingRecord;
    serviceOrder?: ServiceOrder;
    rfidPayload: ResolvedVerificationRfidPayload;
    verificationReport?: ProgrammingRecordVerificationReportSummary;
  };
}

export interface ProgrammingRecordNormalizedInput extends ProgrammingRawSourceData {
  mode: ProgrammingRecordMode;
  gtin?: string;
  lot?: string;
  manufactureDate?: string;
}

export interface ResolveProgrammingRecordResult {
  resolutionType: ProgrammingRecordResolutionType;
  matchedBy?: ProgrammingRecordMatchStrategy;
  candidateCount: number;
  autoSelectedProgrammingRecordId: string | null;
  candidates: ProgrammingRecord[];
  normalizedInput: ProgrammingRecordNormalizedInput;
}

export interface ResolveProgrammingRecordResponse {
  message: string;
  data: ResolveProgrammingRecordResult;
}

export interface VerifyProgrammingRecordResponse {
  message: string;
  data: {
    programmingRecord: ProgrammingRecord;
    serviceOrder?: ServiceOrder;
    verificationReport?: ProgrammingRecordVerificationReportSummary;
  };
}

export interface ProgrammingRecordListFilters {
  mode?: ProgrammingRecordMode;
  sourceType?: ProgrammingRecordSourceType;
  sourceReadId?: string;
  serviceOrderId?: string;
  serviceOrderFolio?: string;
  partNumber?: string;
  gtin?: string;
  rfidProgram?: string;
  status?: ProgrammingRecordStatus;
}

export interface ProgrammingRecordListResponse {
  count: number;
  data: ProgrammingRecord[];
}
