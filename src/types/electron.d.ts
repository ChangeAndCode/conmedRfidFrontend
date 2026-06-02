import type {
  ConnectionMethod,
  HardwareDeviceSummary,
  ReadPayloadTextResult,
  ReadTagIdResult,
  WritePayloadRequest,
  WritePayloadResult,
} from './RfidProgramming';

type ConnectDeviceRequest = {
  connectionMethod: ConnectionMethod;
  deviceId: string;
};

interface ConmedRfidElectronApi {
  listDevices: (connectionMethod: ConnectionMethod) => Promise<HardwareDeviceSummary[]>;
  connectDevice: (request: ConnectDeviceRequest) => Promise<HardwareDeviceSummary>;
  readTagId: (request: ConnectDeviceRequest) => Promise<ReadTagIdResult>;
  readPayloadText?: (request: ConnectDeviceRequest) => Promise<ReadPayloadTextResult>;
  writePayload: (request: WritePayloadRequest) => Promise<WritePayloadResult>;
}

declare global {
  interface Window {
    conmedRfidHardware?: ConmedRfidElectronApi;
  }
}

export {};
