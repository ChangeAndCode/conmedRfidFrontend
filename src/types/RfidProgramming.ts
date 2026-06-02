import type {
  ProgrammingRecordCaptureReference,
  ProgrammingRecordMode,
  ProgrammingRecordStatus,
} from './ProgrammingRecord';

export type ConnectionMethod = 'serial_port' | 'android_usb_nfc';

export interface HardwareDeviceSummary {
  id: string;
  name: string;
  connectionMethod: ConnectionMethod;
  status?: 'available' | 'connected' | 'unauthorized' | 'offline';
  description?: string;
  serialPortPath?: string;
  deviceId?: string;
  isSimulated?: boolean;
}

export interface BuildRfidPayloadData {
  authCode: string;
  payloadHex: string;
  tagByteLength?: number;
  tagId: string;
  partNumber?: string;
  legacyPartMapping?: string | Record<string, unknown> | null;
}

export interface BuildRfidPayloadResponse {
  message: string;
  data?: BuildRfidPayloadData;
}

export interface CompleteProgrammingPayload {
  connectionMethod: ConnectionMethod;
  tagId: string;
  payloadHex: string;
  authCode: string;
  serialPortPath?: string;
  deviceId?: string;
  deviceName?: string;
}

export interface CompleteProgrammingResponse {
  message: string;
  data?: {
    programmingRecordId?: string;
    status?: ProgrammingRecordStatus;
    programmedAt?: string;
    tagId?: string;
  };
}

export interface ReadTagIdResult {
  tagId: string;
  device?: HardwareDeviceSummary;
  simulated?: boolean;
}

export interface ReadPayloadTextResult {
  payloadText: string;
  tagId?: string;
  device?: HardwareDeviceSummary;
  simulated?: boolean;
}

export interface WritePayloadRequest {
  connectionMethod: ConnectionMethod;
  deviceId: string;
  tagId: string;
  payloadHex: string;
}

export interface WritePayloadResult {
  success: boolean;
  message?: string;
  simulated?: boolean;
  device?: HardwareDeviceSummary;
}

export interface RfidProgrammingReadSummary {
  partNumber?: string;
  gtin?: string;
  lot?: string;
  manufactureDate?: string;
  rfidProgram?: string;
  filterLabel?: string;
  rawReference?: string;
  rawScan?: string;
  firstBarcodeRaw?: string;
  secondBarcodeRaw?: string;
}

export type RfidSessionSourceKind = 'manual' | 'single_scan' | 'double_scan';

export interface RfidProgrammingSession {
  programmingRecordId: string;
  programmingRecordMode: ProgrammingRecordMode;
  programmingRecordStatus: ProgrammingRecordStatus;
  sourceKind: RfidSessionSourceKind;
  serviceOrderId: string;
  serviceOrderFolio?: string;
  connectionMethod: ConnectionMethod;
  device: HardwareDeviceSummary;
  readSummary: RfidProgrammingReadSummary;
}

export type CreatedProgrammingRecordLike =
  | ProgrammingRecordCaptureReference
  | {
      id: string;
      mode: ProgrammingRecordMode;
      status: ProgrammingRecordStatus;
    };
