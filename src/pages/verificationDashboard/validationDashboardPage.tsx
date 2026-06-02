import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppSceneLayout from '../../components/appSceneLayout';
import VerificationReportCreateModal from '../../components/verificationReportCreateModal';
import VerificationReportPrintModal from '../../components/verificationReportPrintModal';
import { useAuth } from '../../context/useAuth';
import '../../css/verificationDashboard.css';
import { listPrintInterruptions } from '../../services/printInterruptionService';
import {
  resolveVerificationProgrammingRecord,
  verifyProgrammingRecord,
} from '../../services/programmingRecordService';
import {
  connectHardwareDevice,
  listHardwareDevices,
  readHardwarePayloadText,
} from '../../services/rfidHardwareService';
import {
  getServiceOrderById,
  listServiceOrders,
} from '../../services/serviceOrderService';
import {
  createVerificationReport,
  markVerificationReportAsPrinted,
  markVerificationReportPrintInterrupted,
} from '../../services/verificationReportService';
import type { PrintInterruption } from '../../types/PrintInterruption';
import type {
  ProgrammingRecord,
  ProgrammingRecordMode,
  ResolveProgrammingRecordPayload,
  ResolveVerificationProgrammingRecordPayload,
  ResolvedVerificationRfidPayload,
  VerifyProgrammingRecordPayload,
  VerifyProgrammingRecordResponse,
} from '../../types/ProgrammingRecord';
import type {
  ConnectionMethod,
  HardwareDeviceSummary,
} from '../../types/RfidProgramming';
import type { ServiceOrder } from '../../types/ServiceOrder';
import type {
  CreateVerificationReportPayload,
  VerificationReport,
} from '../../types/VerificationReport';

type FeedbackMessage = {
  type: 'success' | 'error' | 'info';
  text: string;
};

type VerificationFormState = {
  rawReference: string;
  rawScan: string;
  firstBarcodeRaw: string;
  secondBarcodeRaw: string;
  verifiedBy: string;
  verificationNotes: string;
};

const DEFAULT_CONNECTION_METHOD: ConnectionMethod = 'serial_port';
const VERIFICATION_LIMIT_REACHED_MESSAGE =
  'La orden de servicio seleccionada ya alcanzo la cantidad objetivo de verificacion.';

const buildDefaultVerifier = (username?: string) =>
  username?.trim() || 'estacion-verificacion';

const INITIAL_FORM_VALUES = (username?: string): VerificationFormState => ({
  rawReference: '',
  rawScan: '',
  firstBarcodeRaw: '',
  secondBarcodeRaw: '',
  verifiedBy: buildDefaultVerifier(username),
  verificationNotes: '',
});

const getConnectionMethodLabel = (connectionMethod: ConnectionMethod) =>
  connectionMethod === 'serial_port' ? 'Lector por COM' : 'Android USB/NFC';

const getHardwareDeviceStatusLabel = (
  deviceStatus?: HardwareDeviceSummary['status'],
) => {
  switch (deviceStatus) {
    case 'unauthorized':
      return 'sin autorizar';
    case 'offline':
      return 'offline';
    case 'connected':
      return 'conectado';
    default:
      return null;
  }
};

const formatDateTime = (value?: string) => {
  if (!value) {
    return 'N/D';
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'N/D';
  }

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsedDate);
};

const formatModeLabel = (mode: ProgrammingRecordMode) => {
  switch (mode) {
    case 'manual':
      return 'Manual';
    case 'single_scan':
      return 'Escaner codigo';
    case 'double_scan':
      return 'Doble codigo';
    default:
      return mode;
  }
};

const formatStatusLabel = (status: ProgrammingRecord['status']) => {
  switch (status) {
    case 'captured':
      return 'Capturado';
    case 'programmed':
      return 'Programado';
    case 'verified':
      return 'Verificado';
    default:
      return status;
  }
};

const formatGs1ManufactureDate = (value?: string) => {
  if (!value) {
    return 'N/D';
  }

  if (!/^\d{6}$/.test(value)) {
    return value;
  }

  const month = value.slice(2, 4);
  const day = value.slice(4, 6);

  if (month === '00' || day === '00') {
    return value;
  }

  const year = Number.parseInt(value.slice(0, 2), 10);
  const fullYear = year >= 70 ? 1900 + year : 2000 + year;
  return `${fullYear}-${month}-${day}`;
};

const formatServiceOrderStatus = (status: ServiceOrder['status']) => {
  switch (status) {
    case 'open':
      return 'Abierto';
    case 'blocked':
      return 'Bloqueado';
    case 'closed':
      return 'Cerrado';
    default:
      return status;
  }
};

const getServiceOrderProgrammedCount = (serviceOrder?: ServiceOrder | null) =>
  serviceOrder?.programmedCount ?? 0;

const getServiceOrderVerifiedCount = (serviceOrder?: ServiceOrder | null) =>
  serviceOrder?.verifiedCount ?? 0;

const getServiceOrderRemainingToProgram = (serviceOrder?: ServiceOrder | null) =>
  Math.max(
    serviceOrder?.remainingToProgram ??
      ((serviceOrder?.quantity ?? 0) - getServiceOrderProgrammedCount(serviceOrder)),
    0,
  );

const getServiceOrderRemainingToVerify = (serviceOrder?: ServiceOrder | null) =>
  Math.max(
    serviceOrder?.remainingToVerify ??
      ((serviceOrder?.quantity ?? 0) - getServiceOrderVerifiedCount(serviceOrder)),
    0,
  );

const isServiceOrderVerificationLimitReached = (
  serviceOrder?: ServiceOrder | null,
) => getServiceOrderRemainingToVerify(serviceOrder) <= 0;

const filterServiceOrdersWithVerificationCapacity = (
  serviceOrders: ServiceOrder[],
) => serviceOrders.filter(
  (serviceOrder) => !isServiceOrderVerificationLimitReached(serviceOrder),
);

const isServiceOrderReadyForVerificationReport = (
  serviceOrder?: ServiceOrder | null,
) =>
  serviceOrder?.status === 'closed' &&
  getServiceOrderRemainingToVerify(serviceOrder) === 0;

const isAuthorizationError = (error: unknown) =>
  error instanceof Error &&
  error.message.toLowerCase().includes('bearer');

const shouldOpenVerificationReportModal = (
  serviceOrder?: ServiceOrder | null,
  verificationReport?: VerifyProgrammingRecordResponse['data']['verificationReport'],
) =>
  Boolean(
    serviceOrder &&
      isServiceOrderReadyForVerificationReport(serviceOrder) &&
      verificationReport?.canGenerate &&
      !verificationReport.exists,
  );

const summarizeProgrammingSource = (
  programmingRecord: Pick<ProgrammingRecord, 'rawSourceData' | 'verificationData'>,
) => ({
  source:
    programmingRecord.rawSourceData.rawReference ||
    programmingRecord.rawSourceData.rawScan ||
    [
      programmingRecord.rawSourceData.firstBarcodeRaw,
      programmingRecord.rawSourceData.secondBarcodeRaw,
    ]
      .filter(Boolean)
      .join(' | ') ||
    'N/D',
  verification:
    programmingRecord.verificationData?.rawReference ||
    programmingRecord.verificationData?.rawScan ||
    [
      programmingRecord.verificationData?.firstBarcodeRaw,
      programmingRecord.verificationData?.secondBarcodeRaw,
    ]
      .filter(Boolean)
      .join(' | ') ||
    'N/D',
});

function ValidationDashboardPage() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [mode, setMode] = useState<ProgrammingRecordMode>('manual');
  const [formValues, setFormValues] = useState<VerificationFormState>(() =>
    INITIAL_FORM_VALUES(user?.username),
  );
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const [selectedProgrammingRecord, setSelectedProgrammingRecord] =
    useState<ProgrammingRecord | null>(null);
  const [decodedRfidPayload, setDecodedRfidPayload] =
    useState<ResolvedVerificationRfidPayload | null>(null);
  const [rfidPayloadText, setRfidPayloadText] = useState('');
  const [rfidTagId, setRfidTagId] = useState('');
  const [isReadingRfid, setIsReadingRfid] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [relatedServiceOrder, setRelatedServiceOrder] = useState<ServiceOrder | null>(null);
  const [isLoadingRelatedServiceOrder, setIsLoadingRelatedServiceOrder] = useState(false);
  const [relatedServiceOrderError, setRelatedServiceOrderError] = useState<string | null>(null);
  const [printInterruptions, setPrintInterruptions] = useState<PrintInterruption[]>([]);
  const [isLoadingPrintInterruptions, setIsLoadingPrintInterruptions] = useState(false);
  const [creatingVerificationReportFor, setCreatingVerificationReportFor] =
    useState<ServiceOrder | null>(null);
  const [activeVerificationReportPrintFlow, setActiveVerificationReportPrintFlow] =
    useState<VerificationReport | null>(null);
  const [isLoadingVerificationOrders, setIsLoadingVerificationOrders] = useState(false);
  const [verificationOrderOptions, setVerificationOrderOptions] = useState<ServiceOrder[]>([]);
  const [selectedVerificationServiceOrderId, setSelectedVerificationServiceOrderId] =
    useState('');
  const [isVerificationOrderLocked, setIsVerificationOrderLocked] = useState(false);
  const [verificationOrderMessage, setVerificationOrderMessage] =
    useState<FeedbackMessage | null>(null);
  const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod>(
    DEFAULT_CONNECTION_METHOD,
  );
  const [availableDevices, setAvailableDevices] = useState<HardwareDeviceSummary[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [connectedDevice, setConnectedDevice] = useState<HardwareDeviceSummary | null>(
    null,
  );
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [isConnectingDevice, setIsConnectingDevice] = useState(false);
  const [hardwareMessage, setHardwareMessage] = useState<FeedbackMessage | null>(null);

  const selectedVerificationServiceOrder = verificationOrderOptions.find(
    (serviceOrder) => serviceOrder._id === selectedVerificationServiceOrderId,
  );
  const selectedAvailableDevice =
    availableDevices.find((device) => device.id === selectedDeviceId) ?? null;
  const hasSelectedVerificationServiceOrder = Boolean(
    selectedVerificationServiceOrderId,
  );
  const isAndroidManualAssisted = connectionMethod === 'android_usb_nfc';
  const isHardwareReady = isAndroidManualAssisted || Boolean(connectedDevice);

  const currentDateTimeLabel = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date());

  const hardwareDeviceLabel = isAndroidManualAssisted
    ? 'telefono con NFC Tools'
    : connectedDevice?.name ?? selectedAvailableDevice?.name ?? 'sin seleccionar';

  const hardwareStatusText = isAndroidManualAssisted
    ? 'manual asistido'
    : connectedDevice?.status === 'connected'
      ? connectedDevice.isSimulated
        ? 'conectado (simulado)'
        : 'conectado'
      : getHardwareDeviceStatusLabel(selectedAvailableDevice?.status) ?? 'sin conectar';

  const verificationRuleCopy =
    mode === 'manual'
      ? 'En modo manual, el backend debe validar que el payload RFID corresponda al mismo numero de parte capturado.'
      : 'En modo con codigos, el backend debe validar que el payload RFID corresponda al mismo numero de parte, lote y fecha detectados.';

  const clearResolvedVerificationState = useCallback(() => {
    setSelectedProgrammingRecord(null);
    setDecodedRfidPayload(null);
    setRelatedServiceOrder(null);
    setRelatedServiceOrderError(null);
  }, []);

  const resetVerificationResolution = useCallback(() => {
    clearResolvedVerificationState();
    setRfidPayloadText('');
    setRfidTagId('');
  }, [clearResolvedVerificationState]);

  const loadVerificationServiceOrders = useCallback(
    async (preferredServiceOrderId = selectedVerificationServiceOrderId) => {
      setIsLoadingVerificationOrders(true);
      setVerificationOrderMessage(null);

      try {
        const serviceOrders = await listServiceOrders();
        const availableServiceOrders =
          filterServiceOrdersWithVerificationCapacity(serviceOrders);

        setVerificationOrderOptions(availableServiceOrders);

        if (
          preferredServiceOrderId &&
          !availableServiceOrders.some(
            (serviceOrder) => serviceOrder._id === preferredServiceOrderId,
          )
        ) {
          setSelectedVerificationServiceOrderId('');
          setIsVerificationOrderLocked(false);
          setVerificationOrderMessage({
            type: 'success',
            text: 'La orden seleccionada ya completo la cantidad objetivo de verificacion. Puedes seleccionar otra orden.',
          });
          return;
        }

        if (availableServiceOrders.length === 0) {
          setVerificationOrderMessage({
            type: 'info',
            text: 'No hay ordenes de servicio disponibles para verificacion.',
          });
        }
      } catch (error) {
        setVerificationOrderMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'No se pudieron cargar las ordenes de servicio para verificacion.',
        });
      } finally {
        setIsLoadingVerificationOrders(false);
      }
    },
    [selectedVerificationServiceOrderId],
  );

  const loadRelatedServiceOrder = useCallback(
    async (serviceOrderId: string): Promise<ServiceOrder | null> => {
      if (!token) {
        setRelatedServiceOrder(null);
        setRelatedServiceOrderError(null);
        setIsLoadingRelatedServiceOrder(false);
        return null;
      }

      setIsLoadingRelatedServiceOrder(true);
      setRelatedServiceOrderError(null);

      try {
        const nextServiceOrder = await getServiceOrderById(serviceOrderId);
        setRelatedServiceOrder(nextServiceOrder);
        return nextServiceOrder;
      } catch (error) {
        setRelatedServiceOrder(null);
        setRelatedServiceOrderError(
          isAuthorizationError(error)
            ? null
            : error instanceof Error
              ? error.message
              : 'No se pudo consultar el estado de la orden de servicio.',
        );
        return null;
      } finally {
        setIsLoadingRelatedServiceOrder(false);
      }
    },
    [token],
  );

  const loadPrintInterruptions = useCallback(async () => {
    if (!token) {
      setPrintInterruptions([]);
      setIsLoadingPrintInterruptions(false);
      return;
    }

    setIsLoadingPrintInterruptions(true);

    try {
      const nextPrintInterruptions = await listPrintInterruptions();
      setPrintInterruptions(nextPrintInterruptions);
    } catch (error) {
      setPrintInterruptions([]);
      setMessage((currentMessage) => currentMessage ?? {
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudieron cargar las interrupciones de impresion.',
      });
    } finally {
      setIsLoadingPrintInterruptions(false);
    }
  }, [token]);

  const maybeOpenVerificationReportModal = useCallback(
    (
      serviceOrder?: ServiceOrder | null,
      verificationReport?: VerifyProgrammingRecordResponse['data']['verificationReport'],
    ) => {
      if (
        !serviceOrder ||
        creatingVerificationReportFor?._id === serviceOrder._id ||
        !shouldOpenVerificationReportModal(serviceOrder, verificationReport)
      ) {
        return;
      }

      setCreatingVerificationReportFor(serviceOrder);
    },
    [creatingVerificationReportFor?._id],
  );

  const resetFormForMode = (nextMode: ProgrammingRecordMode) => {
    setMode(nextMode);
    setIsVerificationOrderLocked(true);
    setMessage(null);
    resetVerificationResolution();
    setFormValues((currentValues) => ({
      rawReference: '',
      rawScan: '',
      firstBarcodeRaw: '',
      secondBarcodeRaw: '',
      verifiedBy: currentValues.verifiedBy || buildDefaultVerifier(user?.username),
      verificationNotes: '',
    }));
  };

  useEffect(() => {
    setFormValues((currentValues) => {
      if (
        currentValues.verifiedBy.trim().length > 0 &&
        currentValues.verifiedBy !== 'estacion-verificacion'
      ) {
        return currentValues;
      }

      return {
        ...currentValues,
        verifiedBy: buildDefaultVerifier(user?.username),
      };
    });
  }, [user?.username]);

  useEffect(() => {
    void loadPrintInterruptions();
  }, [loadPrintInterruptions]);

  useEffect(() => {
    void loadVerificationServiceOrders('');
  }, [loadVerificationServiceOrders]);

  useEffect(() => {
    if (isAndroidManualAssisted) {
      setIsLoadingDevices(false);
      setAvailableDevices([]);
      setSelectedDeviceId('');
      setConnectedDevice(null);
      setHardwareMessage({
        type: 'info',
        text: 'Modo manual asistido: usa NFC Tools en el telefono para leer el tagId y el texto RFID, luego pegalos en esta pantalla.',
      });
      return;
    }

    let isCancelled = false;

    void (async () => {
      setIsLoadingDevices(true);
      setHardwareMessage(null);

      try {
        const nextDevices = await listHardwareDevices(connectionMethod);

        if (isCancelled) {
          return;
        }

        setAvailableDevices(nextDevices);
        setSelectedDeviceId((currentDeviceId) => {
          if (
            currentDeviceId &&
            nextDevices.some((device) => device.id === currentDeviceId)
          ) {
            return currentDeviceId;
          }

          return nextDevices[0]?.id ?? '';
        });

        if (nextDevices.length === 0) {
          setHardwareMessage({
            type: 'info',
            text: `No hay dispositivos disponibles para ${getConnectionMethodLabel(connectionMethod)}.`,
          });
          return;
        }

        if (nextDevices.some((device) => device.status === 'unauthorized')) {
          setHardwareMessage({
            type: 'error',
            text: 'ADB detecto un telefono Android, pero sigue sin autorizarse la depuracion USB.',
          });
        }
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setAvailableDevices([]);
        setSelectedDeviceId('');
        setHardwareMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'No se pudieron cargar los dispositivos RFID locales.',
        });
      } finally {
        if (!isCancelled) {
          setIsLoadingDevices(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [connectionMethod, isAndroidManualAssisted]);

  const handleVerificationServiceOrderSelection = (nextServiceOrderId: string) => {
    setSelectedVerificationServiceOrderId(nextServiceOrderId);
    setVerificationOrderMessage(null);
    setMessage(null);
    resetVerificationResolution();

    if (!nextServiceOrderId) {
      setIsVerificationOrderLocked(false);
      return;
    }

    setIsVerificationOrderLocked(true);
    setVerificationOrderMessage({
      type: 'info',
      text: 'Orden seleccionada correctamente. No podra cambiarse hasta completar la cantidad objetivo.',
    });
  };

  const handleConnectionMethodChange = (nextMethod: ConnectionMethod) => {
    setConnectionMethod(nextMethod);
    setAvailableDevices([]);
    setSelectedDeviceId('');
    setConnectedDevice(null);
    setHardwareMessage(null);
    resetVerificationResolution();
  };

  const handleRefreshDevices = async () => {
    if (isAndroidManualAssisted) {
      setHardwareMessage({
        type: 'info',
        text: 'En Android USB/NFC no se requiere conectar el telefono para esta prueba manual. Lee la etiqueta en NFC Tools y pega tagId y texto RFID.',
      });
      return;
    }

    setIsLoadingDevices(true);
    setHardwareMessage(null);

    try {
      const nextDevices = await listHardwareDevices(connectionMethod);
      setAvailableDevices(nextDevices);

      const preferredDeviceId =
        nextDevices.find((device) => device.id === selectedDeviceId)?.id ??
        nextDevices[0]?.id ??
        '';
      setSelectedDeviceId(preferredDeviceId);

      if (nextDevices.length === 0) {
        setConnectedDevice(null);
        setHardwareMessage({
          type: 'info',
          text: `No se detectaron dispositivos para ${getConnectionMethodLabel(connectionMethod)}.`,
        });
        return;
      }

      if (nextDevices.some((device) => device.status === 'unauthorized')) {
        setConnectedDevice(null);
        setHardwareMessage({
          type: 'error',
          text: 'ADB detecto un telefono Android, pero sigue sin autorizarse la depuracion USB.',
        });
        return;
      }

      setHardwareMessage({
        type: 'success',
        text: `${nextDevices.length} dispositivo(s) detectado(s).`,
      });
    } catch (error) {
      setAvailableDevices([]);
      setSelectedDeviceId('');
      setConnectedDevice(null);
      setHardwareMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudieron actualizar los dispositivos RFID.',
      });
    } finally {
      setIsLoadingDevices(false);
    }
  };

  const handleConnectDevice = async () => {
    if (isAndroidManualAssisted) {
      setHardwareMessage({
        type: 'info',
        text: 'En Android USB/NFC esta prueba es manual asistida. No necesitas conectar el telefono desde esta pantalla.',
      });
      return;
    }

    if (!selectedDeviceId) {
      setHardwareMessage({
        type: 'error',
        text: 'Selecciona primero un dispositivo para continuar.',
      });
      return;
    }

    setIsConnectingDevice(true);
    setHardwareMessage(null);

    try {
      const device = await connectHardwareDevice(connectionMethod, selectedDeviceId);
      setConnectedDevice(device);
      setHardwareMessage({
        type: 'success',
        text: device.isSimulated
          ? `Conectado en modo simulado con ${device.name}.`
          : `Conectado correctamente con ${device.name}.`,
      });
    } catch (error) {
      setConnectedDevice(null);
      setHardwareMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudo conectar el dispositivo RFID.',
      });
    } finally {
      setIsConnectingDevice(false);
    }
  };

  const buildResolvePayload = (): ResolveProgrammingRecordPayload => {
    if (mode === 'manual') {
      return {
        mode,
        rawReference: formValues.rawReference.trim(),
      };
    }

    if (mode === 'single_scan') {
      return {
        mode,
        rawScan: formValues.rawScan.trim(),
      };
    }

    return {
      mode,
      firstBarcodeRaw: formValues.firstBarcodeRaw.trim(),
      secondBarcodeRaw: formValues.secondBarcodeRaw.trim(),
    };
  };

  const buildVerifyPayload = (): VerifyProgrammingRecordPayload => {
    const basePayload: VerifyProgrammingRecordPayload = {
      rfidPayloadText: rfidPayloadText.trim() || undefined,
      tagId: rfidTagId.trim() || undefined,
      verifiedBy: formValues.verifiedBy.trim() || undefined,
      verificationNotes: formValues.verificationNotes.trim() || undefined,
    };

    if (mode === 'manual') {
      return {
        ...basePayload,
        rawReference: formValues.rawReference.trim(),
      };
    }

    if (mode === 'single_scan') {
      return {
        ...basePayload,
        rawScan: formValues.rawScan.trim(),
      };
    }

    return {
      ...basePayload,
      firstBarcodeRaw: formValues.firstBarcodeRaw.trim(),
      secondBarcodeRaw: formValues.secondBarcodeRaw.trim(),
    };
  };

  const validateCurrentEvidence = () => {
    if (mode === 'manual' && !formValues.rawReference.trim()) {
      return 'Captura el numero de parte o la referencia manual antes de leer la etiqueta RFID.';
    }

    if (mode === 'single_scan' && !formValues.rawScan.trim()) {
      return 'Captura el codigo GS1 antes de leer la etiqueta RFID.';
    }

    if (
      mode === 'double_scan' &&
      (!formValues.firstBarcodeRaw.trim() || !formValues.secondBarcodeRaw.trim())
    ) {
      return 'Captura ambos codigos antes de leer la etiqueta RFID.';
    }

    return null;
  };

  const resolveVerificationFromRfid = async (
    nextPayloadText: string,
    nextTagId: string,
  ) => {
    if (!selectedVerificationServiceOrderId) {
      setVerificationOrderMessage({
        type: 'error',
        text: 'Selecciona primero una orden de servicio para verificar.',
      });
      return;
    }

    if (isServiceOrderVerificationLimitReached(selectedVerificationServiceOrder)) {
      setVerificationOrderMessage({
        type: 'error',
        text: VERIFICATION_LIMIT_REACHED_MESSAGE,
      });
      return;
    }

    const validationError = validateCurrentEvidence();

    if (validationError) {
      setMessage({
        type: 'error',
        text: validationError,
      });
      return;
    }

    const normalizedPayloadText = nextPayloadText.trim();
    const normalizedTagId = nextTagId.trim();

    if (!normalizedPayloadText) {
      setMessage({
        type: 'error',
        text: 'Captura o lee primero el texto RFID de la etiqueta antes de continuar.',
      });
      return;
    }

    if (!normalizedTagId) {
      setMessage({
        type: 'error',
        text: 'Captura o lee primero el tagId de la etiqueta antes de continuar.',
      });
      return;
    }

    setIsVerificationOrderLocked(true);
    setIsReadingRfid(true);
    setMessage(null);
    clearResolvedVerificationState();
    setRfidPayloadText(normalizedPayloadText);
    setRfidTagId(normalizedTagId);

    try {
      const resolvePayload: ResolveVerificationProgrammingRecordPayload = {
        serviceOrderId: selectedVerificationServiceOrderId,
        rfidPayloadText: normalizedPayloadText,
        tagId: normalizedTagId,
        ...buildResolvePayload(),
      };

      const result = await resolveVerificationProgrammingRecord(resolvePayload);
      const resolvedProgrammingRecord = result.data.programmingRecord;

      if (
        resolvedProgrammingRecord.serviceOrderId &&
        resolvedProgrammingRecord.serviceOrderId !== selectedVerificationServiceOrderId
      ) {
        throw new Error(
          'La etiqueta RFID no corresponde a la orden de servicio seleccionada.',
        );
      }

      setDecodedRfidPayload(result.data.rfidPayload);
      setSelectedProgrammingRecord(resolvedProgrammingRecord);

      if (result.data.serviceOrder) {
        setRelatedServiceOrder(result.data.serviceOrder);
        setRelatedServiceOrderError(null);
      } else if (resolvedProgrammingRecord.serviceOrderId) {
        await loadRelatedServiceOrder(resolvedProgrammingRecord.serviceOrderId);
      }

      if (resolvedProgrammingRecord.status === 'verified') {
        setMessage({
          type: 'error',
          text: 'Esta etiqueta ya fue revisada.',
        });
        return;
      }

      setMessage({
        type: 'success',
        text: result.message,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudo resolver la etiqueta RFID para verificacion.',
      });
    } finally {
      setIsReadingRfid(false);
    }
  };

  const handleReadRfid = async () => {
    if (!connectedDevice) {
      setHardwareMessage({
        type: 'error',
        text: 'Conecta primero un dispositivo RFID antes de continuar.',
      });
      return;
    }

    try {
      const readResult = await readHardwarePayloadText(
        connectionMethod,
        connectedDevice.id,
      );

      const payloadText = readResult.payloadText.trim();
      const tagId = readResult.tagId?.trim() || '';

      if (!payloadText) {
        throw new Error(
          'El lector no devolvio contenido RFID legible para continuar con la verificacion.',
        );
      }

      if (!tagId) {
        throw new Error(
          'El lector RFID debe devolver tambien el tagId para validar que la etiqueta no se repita.',
        );
      }

      await resolveVerificationFromRfid(payloadText, tagId);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudo leer la etiqueta RFID para verificacion.',
      });
    }
  };

  const handleResolveManualRfid = async () => {
    await resolveVerificationFromRfid(rfidPayloadText, rfidTagId);
  };

  const handleVerify = async () => {
    if (!selectedVerificationServiceOrderId) {
      setVerificationOrderMessage({
        type: 'error',
        text: 'Selecciona primero una orden de servicio para verificar.',
      });
      return;
    }

    if (!selectedProgrammingRecord) {
      setMessage({
        type: 'error',
        text: 'Primero lee una etiqueta RFID valida para continuar.',
      });
      return;
    }

    if (!rfidPayloadText.trim()) {
      setMessage({
        type: 'error',
        text: 'No se encontro el contenido RFID leido para esta verificacion.',
      });
      return;
    }

    if (!rfidTagId.trim()) {
      setMessage({
        type: 'error',
        text: 'No se encontro el tagId leido para esta verificacion.',
      });
      return;
    }

    if (
      selectedProgrammingRecord.serviceOrderId &&
      selectedProgrammingRecord.serviceOrderId !== selectedVerificationServiceOrderId
    ) {
      setMessage({
        type: 'error',
        text: 'El registro resuelto no pertenece a la orden de servicio elegida.',
      });
      return;
    }

    if (selectedProgrammingRecord.status === 'verified') {
      setMessage({
        type: 'error',
        text: 'Esta etiqueta ya fue revisada.',
      });
      return;
    }

    const validationError = validateCurrentEvidence();

    if (validationError) {
      setMessage({
        type: 'error',
        text: validationError,
      });
      return;
    }

    setIsVerifying(true);
    setMessage(null);

    try {
      const result = await verifyProgrammingRecord(
        selectedProgrammingRecord._id,
        buildVerifyPayload(),
      );
      const verifiedProgrammingRecord = result.data.programmingRecord;
      const refreshedServiceOrder = result.data.serviceOrder ?? null;

      setSelectedProgrammingRecord(verifiedProgrammingRecord);

      if (refreshedServiceOrder) {
        setRelatedServiceOrder(refreshedServiceOrder);
        setRelatedServiceOrderError(null);
      } else if (verifiedProgrammingRecord.serviceOrderId) {
        await loadRelatedServiceOrder(verifiedProgrammingRecord.serviceOrderId);
      }

      setMessage({
        type: 'success',
        text: result.message,
      });

      await loadVerificationServiceOrders(
        refreshedServiceOrder?._id ??
          verifiedProgrammingRecord.serviceOrderId ??
          selectedVerificationServiceOrderId,
      );

      maybeOpenVerificationReportModal(
        refreshedServiceOrder,
        result.data.verificationReport,
      );
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudo verificar la programacion.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleReset = () => {
    setMessage(null);
    resetVerificationResolution();
    setFormValues((currentValues) => ({
      ...INITIAL_FORM_VALUES(user?.username),
      verifiedBy:
        currentValues.verifiedBy.trim() || buildDefaultVerifier(user?.username),
    }));
  };

  const handleCreateVerificationReport = async (
    payload: CreateVerificationReportPayload,
  ) => {
    const result = await createVerificationReport(payload);
    setCreatingVerificationReportFor(null);
    setActiveVerificationReportPrintFlow(result.data);
    setMessage({
      type: 'success',
      text: result.message,
    });
  };

  const selectedProgrammingSource = selectedProgrammingRecord
    ? summarizeProgrammingSource(selectedProgrammingRecord)
    : null;

  return (
    <AppSceneLayout>
      <section className='square verificationDashboardShell'>
        <div className='verificationDashboardCard'>
          <header className='verificationHeroCard'>
            <div className='verificationHeroCopy'>
              <p className='verificationEyebrow'>Estacion de verificacion</p>
              <h1>Validacion por RFID programado</h1>
              <p>
                Captura la evidencia base, lee la etiqueta RFID y confirma la
                verificacion solo cuando el payload corresponda a la pieza
                programada para la orden seleccionada.
              </p>
            </div>

            <div className='verificationHeroActions'>
              <button
                className='buttonSelector verificationActionButton'
                type='button'
                onClick={() => navigate('/', { replace: true })}
              >
                Volver
              </button>
            </div>
          </header>

          <article className='verificationPanelCard'>
            <div className='verificationPanelHeader'>
              <div>
                <h2>Conexion RFID</h2>
                <p>
                  {isAndroidManualAssisted
                    ? 'Usa tu telefono con NFC Tools para leer la etiqueta y pegar manualmente el tagId y el texto RFID.'
                    : 'Conecta el lector que se usara para leer el contenido RFID de la etiqueta ya programada.'}
                </p>
              </div>
            </div>

            <div className='verificationStatusCard'>
              <div className='verificationStatusStack'>
                <p>{`metodo: ${getConnectionMethodLabel(connectionMethod)}`}</p>
                <p>{`dispositivo: ${hardwareDeviceLabel}`}</p>
                <p>{`status: ${hardwareStatusText}`}</p>
                <p>{`fecha/hora: ${currentDateTimeLabel}`}</p>
              </div>

              <div className='verificationConnectionGrid'>
                <label className='verificationField'>
                  <span>Metodo de conexion</span>
                  <select
                    aria-label='verificationConnectionMethod'
                    value={connectionMethod}
                    onChange={(event) =>
                      handleConnectionMethodChange(
                        event.target.value as ConnectionMethod,
                      )
                    }
                    disabled={isLoadingDevices || isConnectingDevice || isReadingRfid || isVerifying}
                  >
                    <option value='serial_port'>Lector por COM</option>
                    <option value='android_usb_nfc'>Android USB/NFC</option>
                  </select>
                </label>

                {isAndroidManualAssisted ? (
                  <div className='verificationHint verificationConnectionHelper'>
                    En este modo no se conecta el telefono. Lee la etiqueta en
                    NFC Tools y pega el <strong>tagId</strong> y el{' '}
                    <strong>texto RFID</strong> en la captura manual de abajo.
                  </div>
                ) : (
                  <>
                    <label className='verificationField'>
                      <span>Dispositivo</span>
                      <select
                        aria-label='verificationDevice'
                        value={selectedDeviceId}
                        onChange={(event) => setSelectedDeviceId(event.target.value)}
                        disabled={
                          isLoadingDevices ||
                          isConnectingDevice ||
                          isReadingRfid ||
                          isVerifying
                        }
                      >
                        <option value=''>Selecciona</option>
                        {availableDevices.map((device) => (
                          <option key={device.id} value={device.id}>
                            {device.name}
                            {device.isSimulated ? ' | simulado' : ''}
                            {getHardwareDeviceStatusLabel(device.status)
                              ? ` | ${getHardwareDeviceStatusLabel(device.status)}`
                              : ''}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className='verificationActionRow verificationConnectionActions'>
                      <button
                        className='buttonSelector verificationActionButton'
                        type='button'
                        onClick={() => void handleRefreshDevices()}
                        disabled={
                          isLoadingDevices ||
                          isConnectingDevice ||
                          isReadingRfid ||
                          isVerifying
                        }
                      >
                        {isLoadingDevices ? 'Buscando...' : 'Actualizar'}
                      </button>
                      <button
                        className='buttonSelector verificationActionButton'
                        type='button'
                        onClick={() => void handleConnectDevice()}
                        disabled={
                          isLoadingDevices ||
                          isConnectingDevice ||
                          !selectedDeviceId ||
                          isReadingRfid ||
                          isVerifying
                        }
                      >
                        {isConnectingDevice ? 'Conectando...' : 'Conectar'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {hardwareMessage && (
              <div className={`verificationMessage ${hardwareMessage.type}`}>
                {hardwareMessage.text}
              </div>
            )}
          </article>

          <article className='verificationPanelCard'>
            <div className='verificationPanelHeader'>
              <div>
                <h2>Orden de servicio</h2>
                <p>
                  Selecciona la orden que se verificara. Debe mantenerse fija
                  hasta completar la cantidad objetivo.
                </p>
              </div>
            </div>

            <label className='verificationField verificationFieldFull'>
              <span>Orden de servicio</span>
              <select
                aria-label='verificationServiceOrderId'
                value={selectedVerificationServiceOrderId}
                onChange={(event) =>
                  handleVerificationServiceOrderSelection(event.target.value)
                }
                disabled={
                  isLoadingVerificationOrders ||
                  isVerificationOrderLocked ||
                  isReadingRfid ||
                  isVerifying
                }
              >
                <option value=''>Selecciona</option>
                {verificationOrderOptions.map((serviceOrder) => (
                  <option key={serviceOrder._id} value={serviceOrder._id}>
                    {serviceOrder.folio}
                    {serviceOrder.rfidProgram ? ` | ${serviceOrder.rfidProgram}` : ''}
                    {serviceOrder.partNumber ? ` | ${serviceOrder.partNumber}` : ''}
                  </option>
                ))}
              </select>
            </label>

            {selectedVerificationServiceOrder && (
              <div className='verificationSummaryGrid'>
                <div className='verificationSummaryItem'>
                  <span>Folio</span>
                  <strong>{selectedVerificationServiceOrder.folio}</strong>
                </div>
                <div className='verificationSummaryItem'>
                  <span>Cantidad</span>
                  <strong>{selectedVerificationServiceOrder.quantity}</strong>
                </div>
                <div className='verificationSummaryItem'>
                  <span>Programadas</span>
                  <strong>
                    {getServiceOrderProgrammedCount(selectedVerificationServiceOrder)}
                  </strong>
                </div>
                <div className='verificationSummaryItem'>
                  <span>Verificadas</span>
                  <strong>
                    {getServiceOrderVerifiedCount(selectedVerificationServiceOrder)}
                  </strong>
                </div>
                <div className='verificationSummaryItem'>
                  <span>Restan por programar</span>
                  <strong>
                    {getServiceOrderRemainingToProgram(selectedVerificationServiceOrder)}
                  </strong>
                </div>
                <div className='verificationSummaryItem'>
                  <span>Restan por verificar</span>
                  <strong>
                    {getServiceOrderRemainingToVerify(selectedVerificationServiceOrder)}
                  </strong>
                </div>
              </div>
            )}

            {isVerificationOrderLocked && (
              <p className='verificationHint'>
                Orden bloqueada hasta completar la cantidad objetivo.
              </p>
            )}

            {verificationOrderMessage && (
              <div className={`verificationMessage ${verificationOrderMessage.type}`}>
                {verificationOrderMessage.text}
              </div>
            )}
          </article>

          {message && <div className={`verificationMessage ${message.type}`}>{message.text}</div>}

          <div className='verificationMainGrid'>
            <article className='verificationPanelCard'>
              <div className='verificationPanelHeader'>
                <div>
                  <h2>Evidencia base</h2>
                  <p>
                    Captura la referencia manual o los codigos de la pieza antes
                    de leer la etiqueta RFID.
                  </p>
                </div>
              </div>

              <div
                className='verificationModeSelector'
                role='tablist'
                aria-label='Modo de verificacion'
              >
                {(['manual', 'single_scan', 'double_scan'] as ProgrammingRecordMode[]).map(
                  (modeOption) => (
                    <button
                      key={modeOption}
                      className={`verificationModeButton ${mode === modeOption ? 'active' : ''}`}
                      type='button'
                      onClick={() => {
                        if (!selectedVerificationServiceOrderId) {
                          setVerificationOrderMessage({
                            type: 'error',
                            text: 'Selecciona primero una orden de servicio para verificar.',
                          });
                          return;
                        }

                        resetFormForMode(modeOption);
                      }}
                      disabled={
                        !hasSelectedVerificationServiceOrder ||
                        isReadingRfid ||
                        isVerifying
                      }
                    >
                      {formatModeLabel(modeOption)}
                    </button>
                  ),
                )}
              </div>

              <div className='verificationFormGrid'>
                {mode === 'manual' && (
                  <label className='verificationField verificationFieldFull'>
                    <span>Numero de parte / referencia manual</span>
                    <input
                      type='text'
                      value={formValues.rawReference}
                      onChange={(event) =>
                        setFormValues((currentValues) => ({
                          ...currentValues,
                          rawReference: event.target.value,
                        }))
                      }
                      placeholder='C32-25-001 o referencia manual guardada'
                      disabled={isReadingRfid || isVerifying}
                    />
                  </label>
                )}

                {mode === 'single_scan' && (
                  <label className='verificationField verificationFieldFull'>
                    <span>Codigo GS1</span>
                    <textarea
                      value={formValues.rawScan}
                      onChange={(event) =>
                        setFormValues((currentValues) => ({
                          ...currentValues,
                          rawScan: event.target.value,
                        }))
                      }
                      placeholder='0120845854081720112209011020220'
                      disabled={isReadingRfid || isVerifying}
                      rows={3}
                    />
                  </label>
                )}

                {mode === 'double_scan' && (
                  <>
                    <label className='verificationField'>
                      <span>Primer codigo</span>
                      <input
                        type='text'
                        value={formValues.firstBarcodeRaw}
                        onChange={(event) =>
                          setFormValues((currentValues) => ({
                            ...currentValues,
                            firstBarcodeRaw: event.target.value,
                          }))
                        }
                        placeholder='(01)20845854081720'
                        disabled={isReadingRfid || isVerifying}
                      />
                    </label>

                    <label className='verificationField'>
                      <span>Segundo codigo</span>
                      <input
                        type='text'
                        value={formValues.secondBarcodeRaw}
                        onChange={(event) =>
                          setFormValues((currentValues) => ({
                            ...currentValues,
                            secondBarcodeRaw: event.target.value,
                          }))
                        }
                        placeholder='1124010110LOT123456'
                        disabled={isReadingRfid || isVerifying}
                      />
                    </label>
                  </>
                )}

                <label className='verificationField verificationFieldFull'>
                  <span>Notas de verificacion</span>
                  <textarea
                    value={formValues.verificationNotes}
                    onChange={(event) =>
                      setFormValues((currentValues) => ({
                        ...currentValues,
                        verificationNotes: event.target.value,
                      }))
                    }
                    placeholder='Notas opcionales para esta verificacion'
                    disabled={isReadingRfid || isVerifying}
                    rows={3}
                  />
                </label>
              </div>

              {isAndroidManualAssisted && (
                <div className='verificationManualRfidGrid'>
                  <label className='verificationField'>
                    <span>tagId leido en NFC Tools</span>
                    <input
                      type='text'
                      value={rfidTagId}
                      onChange={(event) => setRfidTagId(event.target.value)}
                      placeholder='E0:04:01:00:12:34:56:78'
                      disabled={isReadingRfid || isVerifying}
                    />
                  </label>

                  <label className='verificationField verificationFieldFull'>
                    <span>Texto RFID leido en NFC Tools</span>
                    <textarea
                      value={rfidPayloadText}
                      onChange={(event) => setRfidPayloadText(event.target.value)}
                      placeholder='Pega aqui el texto o payload leido desde la etiqueta RFID'
                      disabled={isReadingRfid || isVerifying}
                      rows={4}
                    />
                  </label>
                </div>
              )}

              <p className='verificationHint'>{verificationRuleCopy}</p>

              <div className='verificationActionRow'>
                <button
                  className='buttonSelector verificationActionButton'
                  type='button'
                  onClick={() =>
                    void (isAndroidManualAssisted
                      ? handleResolveManualRfid()
                      : handleReadRfid())
                  }
                  disabled={
                    isReadingRfid ||
                    isVerifying ||
                    !hasSelectedVerificationServiceOrder ||
                    !isHardwareReady
                  }
                >
                  {isReadingRfid
                    ? isAndroidManualAssisted
                      ? 'Validando RFID...'
                      : 'Leyendo RFID...'
                    : isAndroidManualAssisted
                      ? 'Validar datos RFID'
                      : 'Leer etiqueta RFID'}
                </button>
                <button
                  className='buttonSelector verificationActionButton'
                  type='button'
                  onClick={handleReset}
                  disabled={isReadingRfid || isVerifying}
                >
                  Limpiar
                </button>
              </div>
            </article>

            <article className='verificationPanelCard'>
              <div className='verificationPanelHeader'>
                <div>
                  <h2>Lectura RFID</h2>
                  <p>
                    El backend debe interpretar el payload RFID y validar que
                    corresponda a la misma pieza capturada para esta orden.
                  </p>
                </div>
              </div>

              {!rfidPayloadText ? (
                <p className='verificationEmptyState'>
                  {isAndroidManualAssisted
                    ? 'Pega el tagId y el texto RFID leidos en NFC Tools para ver el resultado de la validacion.'
                    : 'Lee una etiqueta RFID para ver su contenido y el resultado de la validacion.'}
                </p>
              ) : (
                <div className='verificationResolutionStack'>
                  <div className='verificationNormalizedInputCard'>
                    <h3>Payload RFID detectado</h3>
                    <div className='verificationKeyValueGrid'>
                      <div className='verificationKeyValueFull'>
                        <span>Texto RFID</span>
                        <strong>{rfidPayloadText}</strong>
                      </div>
                      <div>
                        <span>tagId</span>
                        <strong>{rfidTagId || 'N/D'}</strong>
                      </div>
                      <div>
                        <span>Numero de parte</span>
                        <strong>{decodedRfidPayload?.partNumber || 'N/D'}</strong>
                      </div>
                      {decodedRfidPayload?.rawPartNumber && (
                        <div>
                          <span>Parte leida RFID</span>
                          <strong>{decodedRfidPayload.rawPartNumber}</strong>
                        </div>
                      )}
                      <div>
                        <span>Lote</span>
                        <strong>{decodedRfidPayload?.lot || 'N/D'}</strong>
                      </div>
                      <div>
                        <span>Fecha de manufactura</span>
                        <strong>
                          {formatGs1ManufactureDate(
                            decodedRfidPayload?.manufactureDate,
                          )}
                        </strong>
                      </div>
                      {decodedRfidPayload?.tagId &&
                        decodedRfidPayload.tagId !== rfidTagId && (
                          <div>
                            <span>tagId decodificado</span>
                            <strong>{decodedRfidPayload.tagId}</strong>
                          </div>
                        )}
                    </div>
                  </div>

                  <p className='verificationHint'>
                    Si la etiqueta ya estaba verificada o si el payload no
                    coincide con la evidencia base, el backend debe rechazar la
                    operacion antes de habilitar la confirmacion final.
                  </p>
                </div>
              )}
            </article>
          </div>

          <div className='verificationBottomGrid'>
            <article className='verificationPanelCard'>
              <div className='verificationPanelHeader'>
                <div>
                  <h2>Confirmacion</h2>
                  <p>
                    Se confirma solo despues de que la lectura RFID y la
                    evidencia base apunten al mismo registro programado.
                  </p>
                </div>
              </div>

              {!selectedProgrammingRecord ? (
                <p className='verificationEmptyState'>
                  Lee una etiqueta RFID valida para revisar el registro resuelto
                  y confirmar la verificacion.
                </p>
              ) : (
                <div className='verificationResolutionStack'>
                  <div className='verificationSelectedRecordCard'>
                    <div className='verificationSelectedRecordHeader'>
                      <div>
                        <h3>{selectedProgrammingRecord.serviceOrderFolio || 'Sin folio'}</h3>
                        <p>{`${selectedProgrammingRecord.partNumber} | ${formatModeLabel(selectedProgrammingRecord.mode)}`}</p>
                      </div>
                      <span
                        className={`verificationStatusBadge ${selectedProgrammingRecord.status === 'verified' ? 'verified' : 'programmed'}`}
                      >
                        {formatStatusLabel(selectedProgrammingRecord.status)}
                      </span>
                    </div>

                    <div className='verificationKeyValueGrid'>
                      <div>
                        <span>GTIN</span>
                        <strong>{selectedProgrammingRecord.gtin || 'N/D'}</strong>
                      </div>
                      <div>
                        <span>Lote</span>
                        <strong>{selectedProgrammingRecord.lot || 'N/D'}</strong>
                      </div>
                      <div>
                        <span>Fecha de manufactura</span>
                        <strong>
                          {formatGs1ManufactureDate(selectedProgrammingRecord.manufactureDate)}
                        </strong>
                      </div>
                      <div>
                        <span>Programa RFID</span>
                        <strong>{selectedProgrammingRecord.rfidProgram || 'N/D'}</strong>
                      </div>
                      <div>
                        <span>Etiqueta de filtro</span>
                        <strong>{selectedProgrammingRecord.filterLabel || 'N/D'}</strong>
                      </div>
                      <div>
                        <span>Creado el</span>
                        <strong>{formatDateTime(selectedProgrammingRecord.createdAt)}</strong>
                      </div>
                      <div className='verificationKeyValueFull'>
                        <span>Datos de origen</span>
                        <strong>{selectedProgrammingSource?.source || 'N/D'}</strong>
                      </div>
                      <div className='verificationKeyValueFull'>
                        <span>Datos de verificacion</span>
                        <strong>{selectedProgrammingSource?.verification || 'N/D'}</strong>
                      </div>
                    </div>
                  </div>

                  <div className='verificationActionRow'>
                    <button
                      className='buttonSelector verificationActionButton'
                      type='button'
                      onClick={() => void handleVerify()}
                      disabled={
                        isReadingRfid ||
                        isVerifying ||
                        !hasSelectedVerificationServiceOrder ||
                        !rfidPayloadText.trim() ||
                        selectedProgrammingRecord.status === 'verified'
                      }
                    >
                      {isVerifying ? 'Verificando...' : 'Confirmar verificacion'}
                    </button>
                  </div>

                  {selectedProgrammingRecord.status === 'verified' && (
                    <p className='verificationMessage success'>
                      Esta etiqueta ya quedo verificada.
                    </p>
                  )}
                </div>
              )}
            </article>

            <article className='verificationPanelCard'>
              <div className='verificationPanelHeader'>
                <div>
                  <h2>Orden y avance</h2>
                  <p>
                    Revisa el estado actual de la orden mientras se van
                    descartando las piezas ya verificadas.
                  </p>
                </div>
              </div>

              {!selectedVerificationServiceOrder && !relatedServiceOrder ? (
                <p className='verificationEmptyState'>
                  Selecciona una orden de servicio para consultar su avance.
                </p>
              ) : isLoadingRelatedServiceOrder ? (
                <p className='verificationHint'>Consultando avance real de la orden...</p>
              ) : relatedServiceOrder ? (
                <div className='verificationResolutionStack'>
                  <div className='verificationSelectedRecordCard'>
                    <div className='verificationSelectedRecordHeader'>
                      <div>
                        <h3>Orden de servicio</h3>
                        <p>{relatedServiceOrder.folio || 'Sin folio'}</p>
                      </div>
                      <span
                        className={`verificationStatusBadge ${relatedServiceOrder.status === 'closed' ? 'verified' : 'programmed'}`}
                      >
                        {formatServiceOrderStatus(relatedServiceOrder.status)}
                      </span>
                    </div>

                    <div className='verificationKeyValueGrid'>
                      <div>
                        <span>Cantidad</span>
                        <strong>{relatedServiceOrder.quantity}</strong>
                      </div>
                      <div>
                        <span>Programadas</span>
                        <strong>{getServiceOrderProgrammedCount(relatedServiceOrder)}</strong>
                      </div>
                      <div>
                        <span>Verificadas</span>
                        <strong>{getServiceOrderVerifiedCount(relatedServiceOrder)}</strong>
                      </div>
                      <div>
                        <span>Restan por programar</span>
                        <strong>{getServiceOrderRemainingToProgram(relatedServiceOrder)}</strong>
                      </div>
                      <div>
                        <span>Restan por verificar</span>
                        <strong>{getServiceOrderRemainingToVerify(relatedServiceOrder)}</strong>
                      </div>
                      <div>
                        <span>Actualizado el</span>
                        <strong>{formatDateTime(relatedServiceOrder.updatedAt)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              ) : relatedServiceOrderError ? (
                <p className='verificationHint'>
                  {relatedServiceOrderError ?? 'No se pudo consultar la orden de servicio.'}
                </p>
              ) : selectedVerificationServiceOrder ? (
                <div className='verificationResolutionStack'>
                  <div className='verificationSelectedRecordCard'>
                    <div className='verificationSelectedRecordHeader'>
                      <div>
                        <h3>Orden de servicio</h3>
                        <p>{selectedVerificationServiceOrder.folio || 'Sin folio'}</p>
                      </div>
                      <span className='verificationStatusBadge programmed'>
                        {formatServiceOrderStatus(selectedVerificationServiceOrder.status)}
                      </span>
                    </div>

                    <div className='verificationKeyValueGrid'>
                      <div>
                        <span>Cantidad</span>
                        <strong>{selectedVerificationServiceOrder.quantity}</strong>
                      </div>
                      <div>
                        <span>Programadas</span>
                        <strong>
                          {getServiceOrderProgrammedCount(selectedVerificationServiceOrder)}
                        </strong>
                      </div>
                      <div>
                        <span>Verificadas</span>
                        <strong>
                          {getServiceOrderVerifiedCount(selectedVerificationServiceOrder)}
                        </strong>
                      </div>
                      <div>
                        <span>Restan por programar</span>
                        <strong>
                          {getServiceOrderRemainingToProgram(selectedVerificationServiceOrder)}
                        </strong>
                      </div>
                      <div>
                        <span>Restan por verificar</span>
                        <strong>
                          {getServiceOrderRemainingToVerify(selectedVerificationServiceOrder)}
                        </strong>
                      </div>
                      <div>
                        <span>Programa RFID esperado</span>
                        <strong>{selectedVerificationServiceOrder.rfidProgram || 'N/D'}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          </div>
        </div>
      </section>

      {creatingVerificationReportFor && (
        <VerificationReportCreateModal
          serviceOrder={creatingVerificationReportFor}
          onClose={() => setCreatingVerificationReportFor(null)}
          onSubmit={handleCreateVerificationReport}
        />
      )}

      {activeVerificationReportPrintFlow && (
        <VerificationReportPrintModal
          report={activeVerificationReportPrintFlow}
          mode='print'
          isLoadingPrintInterruptions={isLoadingPrintInterruptions}
          printInterruptions={printInterruptions}
          onClose={() => setActiveVerificationReportPrintFlow(null)}
          onMarkPrinted={async (payload) => {
            const result = await markVerificationReportAsPrinted(
              activeVerificationReportPrintFlow._id,
              payload,
            );
            setActiveVerificationReportPrintFlow(result.data);
            setMessage({
              type: 'success',
              text: result.message,
            });
          }}
          onMarkPrintInterrupted={async (payload) => {
            const result = await markVerificationReportPrintInterrupted(
              activeVerificationReportPrintFlow._id,
              payload,
            );
            setActiveVerificationReportPrintFlow(result.data);
            setMessage({
              type: 'success',
              text: result.message,
            });
          }}
        />
      )}
    </AppSceneLayout>
  );
}

export default ValidationDashboardPage;
