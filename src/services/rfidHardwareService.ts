import type {
  ConnectionMethod,
  HardwareDeviceSummary,
  ReadPayloadTextResult,
  ReadTagIdResult,
  WritePayloadRequest,
  WritePayloadResult,
} from '../types/RfidProgramming';

const buildSimulatedDevice = (
  connectionMethod: ConnectionMethod,
  deviceId: string,
): HardwareDeviceSummary => {
  if (connectionMethod === 'serial_port') {
    return {
      id: deviceId,
      name: 'Simulador COM RFID',
      connectionMethod,
      status: 'connected',
      serialPortPath: deviceId,
      description: 'Fallback local para desarrollo sin lector fisico.',
      isSimulated: true,
    };
  }

  return {
    id: deviceId,
    name: 'Simulador Android USB/NFC',
    connectionMethod,
    status: 'connected',
    deviceId,
    description: 'Fallback local para desarrollo sin dispositivo Android.',
    isSimulated: true,
  };
};

const getHardwareBridge = () => window.conmedRfidHardware;

export async function listHardwareDevices(
  connectionMethod: ConnectionMethod,
): Promise<HardwareDeviceSummary[]> {
  const bridge = getHardwareBridge();

  if (bridge) {
    return bridge.listDevices(connectionMethod);
  }

  return [
    buildSimulatedDevice(
      connectionMethod,
      connectionMethod === 'serial_port' ? 'SIM-COM-1' : 'SIM-ANDROID-1',
    ),
  ];
}

export async function connectHardwareDevice(
  connectionMethod: ConnectionMethod,
  deviceId: string,
): Promise<HardwareDeviceSummary> {
  const bridge = getHardwareBridge();

  if (bridge) {
    return bridge.connectDevice({ connectionMethod, deviceId });
  }

  return buildSimulatedDevice(connectionMethod, deviceId);
}

export async function readHardwareTagId(
  connectionMethod: ConnectionMethod,
  deviceId: string,
): Promise<ReadTagIdResult> {
  const bridge = getHardwareBridge();

  if (bridge) {
    return bridge.readTagId({ connectionMethod, deviceId });
  }

  const tagSuffix = Date.now().toString(16).toUpperCase().slice(-8).padStart(8, '0');

  return {
    tagId: `SIMTAG${tagSuffix}`,
    device: buildSimulatedDevice(connectionMethod, deviceId),
    simulated: true,
  };
}

export async function readHardwarePayloadText(
  connectionMethod: ConnectionMethod,
  deviceId: string,
): Promise<ReadPayloadTextResult> {
  const bridge = getHardwareBridge();

  if (bridge?.readPayloadText) {
    return bridge.readPayloadText({ connectionMethod, deviceId });
  }

  const payloadSuffix = Date.now().toString(16).toUpperCase().slice(-8).padStart(8, '0');

  return {
    payloadText: `SIM-RFID-PAYLOAD-${payloadSuffix}`,
    tagId: `SIMTAG${payloadSuffix}`,
    device: buildSimulatedDevice(connectionMethod, deviceId),
    simulated: true,
  };
}

export async function writeHardwarePayload(
  request: WritePayloadRequest,
): Promise<WritePayloadResult> {
  const bridge = getHardwareBridge();

  if (bridge) {
    return bridge.writePayload(request);
  }

  return {
    success: true,
    message: 'Escritura simulada completada.',
    simulated: true,
    device: buildSimulatedDevice(request.connectionMethod, request.deviceId),
  };
}
