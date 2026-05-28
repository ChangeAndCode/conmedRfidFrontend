import type { ProgrammingRecordCaptureReference } from './ProgrammingRecord';

export interface CreateManualReadPayload {
  serviceOrderId: string;
  partNumber: string;
  lot?: string;
  manufactureDate?: string;
  rfidProgram?: string;
  filterLabel?: string;
  rawReference?: string;
  notes?: string;
}

export interface ManualReadResponseData {
  _id: string;
  serviceOrderId: string;
  partNumber: string;
  lot?: string;
  manufactureDate?: string;
  rfidProgram?: string;
  filterLabel?: string;
  rawReference?: string;
  notes?: string;
  status?: string;
}

export interface CreateManualReadResponse {
  message: string;
  data?: ManualReadResponseData;
  programmingRecord?: ProgrammingRecordCaptureReference;
}
