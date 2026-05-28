import '../../css/programmingDashboard.css';
import '../../css/administratorDashboard.css';
import '../../index.css';
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import AppSceneLayout from '../../components/appSceneLayout';
import RfidProgrammingModal from '../../components/rfidProgrammingModal';
import { createDoubleScanRead, resolveFirstDoubleScan } from '../../services/doubleScanService';
import { createManualRead } from '../../services/manualReadService';
import {
  connectHardwareDevice,
  listHardwareDevices,
} from '../../services/rfidHardwareService';
import { createSingleScanRead, resolveSingleScan } from '../../services/singleScanService';
import {
  listOpenServiceOrdersByGtin,
  listOpenManualServiceOrders,
  listServiceOrderPartConfigOptions,
  listServiceOrders,
} from '../../services/serviceOrderService';
import type { DoubleScanReadResponse } from '../../types/DoubleScan';
import type { ProgrammingRecordCaptureReference } from '../../types/ProgrammingRecord';
import type {
  ConnectionMethod,
  HardwareDeviceSummary,
  RfidProgrammingReadSummary,
  RfidProgrammingSession,
  CompleteProgrammingResponse,
} from '../../types/RfidProgramming';
import type { ServiceOrder, ServiceOrderPartConfigOption } from '../../types/ServiceOrder';
import type { SingleScanReadResponse } from '../../types/SingleScan';

type Mode = 'Manual' | 'Scan' | 'DoubleScan' | null;
type FeedbackMessage = { type: 'success' | 'error' | 'info'; text: string };
type DoubleScanStep =
  | 'waiting_first'
  | 'resolving_first'
  | 'selecting_service_order'
  | 'resolving_part_configs'
  | 'selecting_part_config'
  | 'waiting_second'
  | 'submitting'
  | 'success'
  | 'error';
type SingleScanStep =
  | 'waiting_scan'
  | 'resolving_scan'
  | 'selecting_service_order'
  | 'resolving_part_configs'
  | 'selecting_part_config'
  | 'ready_to_submit'
  | 'submitting'
  | 'success'
  | 'error';

const DEFAULT_CONNECTION_METHOD: ConnectionMethod = 'serial_port';
const PROGRAMMING_LIMIT_REACHED_MESSAGE =
  'La orden de servicio seleccionada ya alcanzo la cantidad objetivo de programacion.';

const getConnectionMethodLabel = (connectionMethod: ConnectionMethod) =>
  connectionMethod === 'serial_port' ? 'Lector por COM' : 'Android USB/NFC';

const formatGs1ManufactureDate = (value: string) => {
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

const hasServiceOrderProgrammingProgress = (serviceOrder?: ServiceOrder | null) =>
  typeof serviceOrder?.remainingToProgram === 'number' ||
  typeof serviceOrder?.programmedCount === 'number';

const isServiceOrderProgrammingLimitReached = (serviceOrder?: ServiceOrder | null) =>
  hasServiceOrderProgrammingProgress(serviceOrder) &&
  getServiceOrderRemainingToProgram(serviceOrder) <= 0;

const filterServiceOrdersWithProgrammingCapacity = (serviceOrders: ServiceOrder[]) =>
  serviceOrders.filter(
    (serviceOrder) => !isServiceOrderProgrammingLimitReached(serviceOrder),
  );

const markServiceOrderProgrammingLimitReached = (serviceOrder: ServiceOrder): ServiceOrder => ({
  ...serviceOrder,
  programmedCount: Math.max(
    getServiceOrderProgrammedCount(serviceOrder),
    serviceOrder.quantity,
  ),
  remainingToProgram: 0,
  remainingToVerify: Math.max(
    serviceOrder.quantity - getServiceOrderVerifiedCount(serviceOrder),
    0,
  ),
});

const markServiceOrderProgrammingLimitReachedInList = (
  serviceOrders: ServiceOrder[],
  serviceOrderId: string,
) =>
  serviceOrders.map((serviceOrder) =>
    serviceOrder._id === serviceOrderId
      ? markServiceOrderProgrammingLimitReached(serviceOrder)
      : serviceOrder,
  );

const isProgrammingLimitReachedError = (error: unknown) =>
  error instanceof Error &&
  error.message.toLowerCase().includes('cantidad objetivo de programacion');

function ProgrammingDashboardPage() {
  const navigate = useNavigate();
  const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod>(
    DEFAULT_CONNECTION_METHOD,
  );
  const [availableDevices, setAvailableDevices] = useState<HardwareDeviceSummary[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [connectedDevice, setConnectedDevice] = useState<HardwareDeviceSummary | null>(null);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [isConnectingDevice, setIsConnectingDevice] = useState(false);
  const [hardwareMessage, setHardwareMessage] = useState<FeedbackMessage | null>(null);
  const [pendingRfidSession, setPendingRfidSession] =
    useState<RfidProgrammingSession | null>(null);
  const [isRfidModalOpen, setIsRfidModalOpen] = useState(false);
  const [rfidProgrammingMessage, setRfidProgrammingMessage] =
    useState<FeedbackMessage | null>(null);
  const [mode, setMode] = useState<Mode>(null);

  const [isLoadingProgrammingOrders, setIsLoadingProgrammingOrders] = useState(false);
  const [programmingOrderOptions, setProgrammingOrderOptions] = useState<ServiceOrder[]>([]);
  const [selectedProgrammingServiceOrderId, setSelectedProgrammingServiceOrderId] = useState('');
  const [isProgrammingOrderLocked, setIsProgrammingOrderLocked] = useState(false);
  const [programmingOrderMessage, setProgrammingOrderMessage] = useState<FeedbackMessage | null>(null);

  const [isLoadingManualServiceOrders, setIsLoadingManualServiceOrders] = useState(false);
  const [isLoadingManualPartOptions, setIsLoadingManualPartOptions] = useState(false);
  const [partNumber, setPartNumber] = useState('');
  const [manualServiceOrderOptions, setManualServiceOrderOptions] = useState<ServiceOrder[]>([]);
  const [manualPartOptions, setManualPartOptions] = useState<ServiceOrderPartConfigOption[]>([]);
  const [selectedManualServiceOrderId, setSelectedManualServiceOrderId] = useState('');
  const [lot, setLot] = useState('');
  const [manufactureDate, setManufactureDate] = useState('');
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [manualMessage, setManualMessage] = useState<FeedbackMessage | null>(null);

  const [isLoadingSingleScanServiceOrders, setIsLoadingSingleScanServiceOrders] = useState(false);
  const [isLoadingSingleScanPartOptions, setIsLoadingSingleScanPartOptions] = useState(false);
  const [singleScanServiceOrderOptions, setSingleScanServiceOrderOptions] = useState<ServiceOrder[]>([]);
  const [singleScanPartOptions, setSingleScanPartOptions] = useState<ServiceOrderPartConfigOption[]>([]);
  const [selectedSingleScanServiceOrderId, setSelectedSingleScanServiceOrderId] = useState('');
  const [singleScanPartNumber, setSingleScanPartNumber] = useState('');
  const [singleScanRawValue, setSingleScanRawValue] = useState('');
  const [singleScanResolvedGtin, setSingleScanResolvedGtin] = useState('');
  const [singleScanResolvedLot, setSingleScanResolvedLot] = useState('');
  const [singleScanResolvedManufactureDate, setSingleScanResolvedManufactureDate] = useState('');
  const [isSubmittingSingleScan, setIsSubmittingSingleScan] = useState(false);
  const [singleScanStep, setSingleScanStep] = useState<SingleScanStep>('waiting_scan');
  const [singleScanMessage, setSingleScanMessage] = useState<FeedbackMessage | null>(null);
  const [singleScanResult, setSingleScanResult] = useState<SingleScanReadResponse | null>(null);

  const [firstBarcodeRaw, setFirstBarcodeRaw] = useState('');
  const [resolvedGtin, setResolvedGtin] = useState('');
  const [serviceOrderOptions, setServiceOrderOptions] = useState<ServiceOrder[]>([]);
  const [selectedServiceOrderId, setSelectedServiceOrderId] = useState('');
  const [doubleScanOptions, setDoubleScanOptions] = useState<ServiceOrderPartConfigOption[]>([]);
  const [selectedPartConfigId, setSelectedPartConfigId] = useState('');
  const [secondBarcodeRaw, setSecondBarcodeRaw] = useState('');
  const [doubleScanNotes, setDoubleScanNotes] = useState('');
  const [doubleScanStep, setDoubleScanStep] = useState<DoubleScanStep>('waiting_first');
  const [doubleScanMessage, setDoubleScanMessage] = useState<FeedbackMessage | null>(null);
  const [doubleScanResult, setDoubleScanResult] = useState<DoubleScanReadResponse | null>(null);

  const firstBarcodeInputRef = useRef<HTMLInputElement>(null);
  const serviceOrderSelectRef = useRef<HTMLSelectElement>(null);
  const partConfigSelectRef = useRef<HTMLSelectElement>(null);
  const secondBarcodeInputRef = useRef<HTMLInputElement>(null);
  const singleScanInputRef = useRef<HTMLInputElement>(null);
  const singleScanServiceOrderSelectRef = useRef<HTMLSelectElement>(null);
  const singleScanPartNumberSelectRef = useRef<HTMLSelectElement>(null);
  const successResetTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const singleScanResetTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const selectedManualConfig = manualPartOptions.find((option) => option.partNumber === partNumber);
  const selectedManualServiceOrder = manualServiceOrderOptions.find(
    (serviceOrder) => serviceOrder._id === selectedManualServiceOrderId,
  );
  const selectedSingleScanConfig = singleScanPartOptions.find(
    (option) => option.partNumber === singleScanPartNumber,
  );
  const selectedSingleScanServiceOrder = singleScanServiceOrderOptions.find(
    (serviceOrder) => serviceOrder._id === selectedSingleScanServiceOrderId,
  );
  const selectedServiceOrder = serviceOrderOptions.find((serviceOrder) => serviceOrder._id === selectedServiceOrderId);

  const selectedDoubleScanConfig = doubleScanOptions.find((option) => option.id === selectedPartConfigId);
  const selectedProgrammingServiceOrder = programmingOrderOptions.find(
    (serviceOrder) => serviceOrder._id === selectedProgrammingServiceOrderId,
  );
  const selectedAvailableDevice =
    availableDevices.find((device) => device.id === selectedDeviceId) ?? null;
  const hasSelectedProgrammingServiceOrder = Boolean(selectedProgrammingServiceOrderId);
  const hasPendingRfidSession = Boolean(pendingRfidSession);
  const hasMultipleServiceOrderOptions = serviceOrderOptions.length > 1;
  const hasMultipleSingleScanServiceOrderOptions = singleScanServiceOrderOptions.length > 1;
  const isHardwareReady = Boolean(connectedDevice);

  useEffect(() => {
    if (mode !== 'DoubleScan') {
      return;
    }

    if (
      doubleScanStep === 'waiting_first' ||
      doubleScanStep === 'success' ||
      doubleScanStep === 'error'
    ) {
      firstBarcodeInputRef.current?.focus();
      return;
    }

    if (doubleScanStep === 'selecting_service_order') {
      serviceOrderSelectRef.current?.focus();
      return;
    }

    if (doubleScanStep === 'selecting_part_config') {
      partConfigSelectRef.current?.focus();
      return;
    }

    if (doubleScanStep === 'waiting_second') {
      secondBarcodeInputRef.current?.focus();
    }
  }, [doubleScanStep, mode]);

  useEffect(() => {
    if (mode !== 'Scan') {
      return;
    }

    if (
      singleScanStep === 'waiting_scan' ||
      singleScanStep === 'success' ||
      singleScanStep === 'error'
    ) {
      singleScanInputRef.current?.focus();
      return;
    }

    if (singleScanStep === 'selecting_service_order') {
      singleScanServiceOrderSelectRef.current?.focus();
      return;
    }

    if (
      singleScanStep === 'selecting_part_config' ||
      singleScanStep === 'ready_to_submit'
    ) {
      singleScanPartNumberSelectRef.current?.focus();
    }
  }, [mode, singleScanStep]);

  useEffect(() => {
    return () => {
      if (successResetTimeoutRef.current) {
        window.clearTimeout(successResetTimeoutRef.current);
      }

      if (singleScanResetTimeoutRef.current) {
        window.clearTimeout(singleScanResetTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
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
            text: `No hay dispositivos disponibles para ${getConnectionMethodLabel(
              connectionMethod,
            )}.`,
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
  }, [connectionMethod]);

  const loadProgrammingServiceOrders = useCallback(async (
    preferredServiceOrderId = selectedProgrammingServiceOrderId,
  ) => {
    setIsLoadingProgrammingOrders(true);
    setProgrammingOrderMessage(null);

    try {
      const serviceOrders = await listServiceOrders({
        status: 'open',
      });

      const availableServiceOrders =
        filterServiceOrdersWithProgrammingCapacity(serviceOrders);

      setProgrammingOrderOptions(availableServiceOrders);

      if (
        preferredServiceOrderId &&
        !availableServiceOrders.some(
          (serviceOrder) =>
            serviceOrder._id === preferredServiceOrderId,
        )
      ) {
        setSelectedProgrammingServiceOrderId('');
        setIsProgrammingOrderLocked(false);

        setProgrammingOrderMessage({
          type: 'success',
          text: 'La orden seleccionada ya completo la cantidad objetivo de programacion. Puedes seleccionar otra orden.',
        });

        return;
      }

      if (availableServiceOrders.length === 0) {
        setProgrammingOrderMessage({
          type: 'info',
          text: 'No hay ordenes de servicio abiertas disponibles.',
        });
      }
    } catch (error) {
      setProgrammingOrderMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudieron cargar las ordenes.',
      });
    } finally {
      setIsLoadingProgrammingOrders(false);
    }
  }, [selectedProgrammingServiceOrderId]);

  const handleProgrammingServiceOrderSelection = (
    nextServiceOrderId: string,
  ) => {
    setSelectedProgrammingServiceOrderId(nextServiceOrderId);
    setProgrammingOrderMessage(null);

    if (!nextServiceOrderId) {
      setIsProgrammingOrderLocked(false);
      return;
    }

    setProgrammingOrderMessage({
      type: 'info',
      text: 'Orden seleccionada correctamente. No podra cambiarse al iniciar la programacion.',
    });
  };

  useEffect(() => {
    void loadProgrammingServiceOrders();
  }, [loadProgrammingServiceOrders]);

  const handleConnectionMethodChange = (nextMethod: ConnectionMethod) => {
    setConnectionMethod(nextMethod);
    setAvailableDevices([]);
    setSelectedDeviceId('');
    setConnectedDevice(null);
    setHardwareMessage(null);
    setRfidProgrammingMessage(null);
  };

  const handleRefreshDevices = async () => {
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
          text: `No se detectaron dispositivos para ${getConnectionMethodLabel(
            connectionMethod,
          )}.`,
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

  const resetManualForm = () => {
    setPartNumber('');
    setManualServiceOrderOptions([]);
    setManualPartOptions([]);
    setSelectedManualServiceOrderId('');
    setLot('');
    setManufactureDate('');
    setManualMessage(null);
  };

  const resetSingleScanForm = () => {
    setSingleScanServiceOrderOptions([]);
    setSingleScanPartOptions([]);
    setSelectedSingleScanServiceOrderId('');
    setSingleScanPartNumber('');
    setSingleScanRawValue('');
    setSingleScanResolvedGtin('');
    setSingleScanResolvedLot('');
    setSingleScanResolvedManufactureDate('');
    setSingleScanStep('waiting_scan');
    setSingleScanMessage(null);
    setSingleScanResult(null);
  };

  const clearSuccessResetTimeout = () => {
    if (successResetTimeoutRef.current) {
      window.clearTimeout(successResetTimeoutRef.current);
      successResetTimeoutRef.current = null;
    }
  };

  const clearSingleScanResetTimeout = () => {
    if (singleScanResetTimeoutRef.current) {
      window.clearTimeout(singleScanResetTimeoutRef.current);
      singleScanResetTimeoutRef.current = null;
    }
  };

  const resetDoubleScanCycle = (nextMessage: FeedbackMessage | null = null) => {
    setFirstBarcodeRaw('');
    setResolvedGtin('');
    setServiceOrderOptions([]);
    setSelectedServiceOrderId('');
    setDoubleScanOptions([]);
    setSelectedPartConfigId('');
    setSecondBarcodeRaw('');
    setDoubleScanStep('waiting_first');
    setDoubleScanMessage(nextMessage);
    setDoubleScanResult(null);
  };

  const resetDoubleScanFlow = () => {
    clearSuccessResetTimeout();
    resetDoubleScanCycle();
    setDoubleScanNotes('');
  };

  const beginRfidProgramming = (
    sourceKind: RfidProgrammingSession['sourceKind'],
    programmingRecord: ProgrammingRecordCaptureReference,
    serviceOrder: ServiceOrder | undefined | null,
    readSummary: RfidProgrammingReadSummary,
  ) => {
    if (!connectedDevice) {
      throw new Error('No hay un dispositivo RFID conectado para continuar.');
    }

    clearSuccessResetTimeout();
    clearSingleScanResetTimeout();
    setPendingRfidSession({
      programmingRecordId: programmingRecord.id,
      programmingRecordMode: programmingRecord.mode,
      programmingRecordStatus: programmingRecord.status,
      sourceKind,
      serviceOrderId: serviceOrder?._id ?? '',
      serviceOrderFolio: serviceOrder?.folio,
      connectionMethod,
      device: connectedDevice,
      readSummary,
    });
    setIsRfidModalOpen(true);
    setMode(null);
    setRfidProgrammingMessage({
      type: 'info',
      text: 'Lectura registrada. Continua con la programacion RFID.',
    });
  };

  const handleClosePendingRfidModal = () => {
    setIsRfidModalOpen(false);
    setRfidProgrammingMessage({
      type: 'info',
      text: 'Hay una programacion RFID pendiente. Reanudala antes de capturar otra pieza.',
    });
  };

  const handleRfidProgrammingCompleted = async (
    result: CompleteProgrammingResponse,
  ) => {
    const completedSession = pendingRfidSession;

    if (!completedSession) {
      return;
    }

    setPendingRfidSession(null);
    setIsRfidModalOpen(false);
    setRfidProgrammingMessage({
      type: 'success',
      text: result.message ?? 'Etiqueta RFID programada correctamente.',
    });

    if (completedSession.sourceKind === 'manual') {
      setLot('');
      setManufactureDate('');
      const didReloadManualServiceOrders = await loadManualServiceOrders();
      await loadProgrammingServiceOrders(completedSession.serviceOrderId);

      if (didReloadManualServiceOrders) {
        setManualMessage({
          type: 'success',
          text: result.message ?? 'Etiqueta RFID programada correctamente.',
        });
      }

      return;
    }

    if (completedSession.sourceKind === 'single_scan') {
      setSingleScanStep('success');
      setSingleScanMessage({
        type: 'success',
        text: result.message ?? 'Etiqueta RFID programada correctamente.',
      });
      await loadProgrammingServiceOrders(completedSession.serviceOrderId);

      singleScanResetTimeoutRef.current = window.setTimeout(() => {
        resetSingleScanForm();
        setSingleScanMessage({
          type: 'info',
          text: 'Listo para el siguiente escaneo.',
        });
      }, 2200);

      return;
    }

    setDoubleScanStep('success');
    setDoubleScanMessage({
      type: 'success',
      text: result.message ?? 'Etiqueta RFID programada correctamente.',
    });
    await loadProgrammingServiceOrders(completedSession.serviceOrderId);

    successResetTimeoutRef.current = window.setTimeout(() => {
      resetDoubleScanCycle({
        type: 'info',
        text: 'Listo para la siguiente lectura.',
      });
    }, 2200);
  };

  const loadManualServiceOrders = async () => {
    setIsLoadingManualServiceOrders(true);
    setManualMessage(null);
    setManualServiceOrderOptions([]);
    setManualPartOptions([]);
    setSelectedManualServiceOrderId('');
    setPartNumber('');

    try {
     const serviceOrders = await listOpenManualServiceOrders();

     const availableServiceOrders =
       filterServiceOrdersWithProgrammingCapacity(
         serviceOrders.filter(
           (serviceOrder) =>
             serviceOrder._id === selectedProgrammingServiceOrderId,
         ),
       );
      setManualServiceOrderOptions(availableServiceOrders);

      if (availableServiceOrders.length === 0) {
        setManualMessage({
          type: 'info',
          text:
            serviceOrders.length === 0
              ? 'No hay ordenes de servicio manuales abiertas disponibles.'
              : 'Las ordenes manuales encontradas ya alcanzaron la cantidad objetivo de programacion.',
        });
        return true;
      }

      setManualMessage({
        type: 'info',
        text: 'Selecciona primero la orden de servicio manual.',
      });
      return true;
    } catch (error) {
      setManualMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudieron cargar las ordenes de servicio manuales.',
      });
      return false;
    } finally {
      setIsLoadingManualServiceOrders(false);
    }
  };

  const resolveSingleScanRaw = async () => {
    const trimmedRawScan = singleScanRawValue.trim();

    if (!trimmedRawScan) {
      setSingleScanMessage({
        type: 'error',
        text: 'Captura o escanea el valor raw del single scan antes de continuar.',
      });
      return;
    }

    setIsLoadingSingleScanServiceOrders(true);
    setSingleScanStep('resolving_scan');
    setSingleScanMessage(null);
    setSingleScanServiceOrderOptions([]);
    setSingleScanPartOptions([]);
    setSelectedSingleScanServiceOrderId('');
    setSingleScanPartNumber('');
    setSingleScanResolvedGtin('');
    setSingleScanResolvedLot('');
    setSingleScanResolvedManufactureDate('');
    setSingleScanResult(null);

    try {
      const resolvedScan = await resolveSingleScan(trimmedRawScan);
      const serviceOrders = await listOpenServiceOrdersByGtin(
        resolvedScan.gtin,
        'single_scan',
      );
      const availableServiceOrders =
        filterServiceOrdersWithProgrammingCapacity(
        serviceOrders.filter(
          (serviceOrder) =>
          serviceOrder._id === selectedProgrammingServiceOrderId,
        ),
      );

      setSingleScanRawValue(resolvedScan.rawScan);
      setSingleScanResolvedGtin(resolvedScan.gtin);
      setSingleScanResolvedLot(resolvedScan.lot ?? '');
      setSingleScanResolvedManufactureDate(resolvedScan.manufactureDate ?? '');
      setSingleScanServiceOrderOptions(availableServiceOrders);

      if (availableServiceOrders.length === 0) {
        setSingleScanStep('waiting_scan');
        setSingleScanMessage({
          type: 'error',
          text:
            serviceOrders.length === 0
              ? 'No hay ordenes de servicio single scan abiertas para el GTIN detectado.'
              : 'Las ordenes single scan detectadas ya alcanzaron la cantidad objetivo de programacion.',
        });
        return;
      }

      if (availableServiceOrders.length === 1) {
        const [singleServiceOrder] = availableServiceOrders;
        setSelectedSingleScanServiceOrderId(singleServiceOrder._id);
        await loadSingleScanPartOptionsForServiceOrder(singleServiceOrder._id);
        return;
      }

      setSingleScanStep('selecting_service_order');
      setSingleScanMessage({
        type: 'info',
        text: 'Se encontraron varias ordenes single scan para el GTIN. Selecciona la correcta.',
      });
    } catch (error) {
      setSingleScanStep('waiting_scan');
      setSingleScanMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudo resolver el single scan.',
      });
    } finally {
      setIsLoadingSingleScanServiceOrders(false);
    }
  };

  const loadPartConfigOptionsForServiceOrder = async (serviceOrderId: string) => {
    setDoubleScanStep('resolving_part_configs');
    setDoubleScanMessage(null);
    setDoubleScanOptions([]);
    setSelectedPartConfigId('');
    setSecondBarcodeRaw('');
    setDoubleScanResult(null);

    try {
      const options = await listServiceOrderPartConfigOptions(serviceOrderId, 'double_scan');
      setDoubleScanOptions(options);

      if (options.length === 0) {
        setDoubleScanStep('selecting_service_order');
        setDoubleScanMessage({
          type: 'error',
          text: 'La orden seleccionada no tiene numeros de parte activos para doble codigo.',
        });
        return;
      }

      if (options.length === 1) {
        setSelectedPartConfigId(options[0].id);
        setDoubleScanStep('waiting_second');
        setDoubleScanMessage({
          type: 'success',
          text: 'Orden de servicio seleccionada. Numero de parte resuelto automaticamente. Escanea el segundo codigo.',
        });
        return;
      }

      setDoubleScanStep('selecting_part_config');
      setDoubleScanMessage({
        type: 'info',
        text: 'Selecciona el numero de parte correcto para la orden elegida.',
      });
    } catch (error) {
      setDoubleScanStep('selecting_service_order');
      setDoubleScanMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudieron resolver los numeros de parte para la orden seleccionada.',
      });
    }
  };

  const loadManualPartOptionsForServiceOrder = async (serviceOrderId: string) => {
    setIsLoadingManualPartOptions(true);
    setManualMessage(null);
    setManualPartOptions([]);
    setPartNumber('');

    try {
      const options = await listServiceOrderPartConfigOptions(serviceOrderId, 'manual');
      setManualPartOptions(options);

      if (options.length === 0) {
        setManualMessage({
          type: 'error',
          text: 'La orden de servicio seleccionada no tiene numero de parte manual activo.',
        });
        return;
      }

      setManualMessage({
        type: 'info',
        text: 'Selecciona el numero de parte solicitado por la orden de servicio.',
      });
    } catch (error) {
      setManualMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudo cargar el numero de parte de la orden manual.',
      });
    } finally {
      setIsLoadingManualPartOptions(false);
    }
  };

  const loadSingleScanPartOptionsForServiceOrder = async (serviceOrderId: string) => {
    setIsLoadingSingleScanPartOptions(true);
    setSingleScanStep('resolving_part_configs');
    setSingleScanMessage(null);
    setSingleScanPartOptions([]);
    setSingleScanPartNumber('');
    setSingleScanResult(null);

    try {
      const options = await listServiceOrderPartConfigOptions(serviceOrderId, 'single_scan');
      setSingleScanPartOptions(options);

      if (options.length === 0) {
        setSingleScanStep('selecting_service_order');
        setSingleScanMessage({
          type: 'error',
          text: 'La orden de servicio seleccionada no tiene numero de parte single scan activo.',
        });
        return;
      }

      if (options.length === 1) {
        setSingleScanPartNumber(options[0].partNumber);
        setSingleScanStep('ready_to_submit');
        setSingleScanMessage({
          type: 'success',
          text: 'Orden de servicio seleccionada. Numero de parte resuelto automaticamente. Registra la lectura para continuar.',
        });
        return;
      }

      setSingleScanStep('selecting_part_config');
      setSingleScanMessage({
        type: 'info',
        text: 'Selecciona el numero de parte solicitado por la orden single scan.',
      });
    } catch (error) {
      setSingleScanStep('selecting_service_order');
      setSingleScanMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudo cargar el numero de parte de la orden single scan.',
      });
    } finally {
      setIsLoadingSingleScanPartOptions(false);
    }
  };

  const openManualModal = () => {
    if (hasPendingRfidSession) {
      return;
    }

    resetManualForm();
    setIsProgrammingOrderLocked(true);
    setMode('Manual');
    void loadManualServiceOrders();
  };

  const closeManualModal = () => {
    if (isSubmittingManual || hasPendingRfidSession) {
      return;
    }

    resetManualForm();
    setMode(null);
  };

  const openDoubleScanModal = () => {
    if (hasPendingRfidSession) {
      return;
    }

    resetDoubleScanFlow();
    setIsProgrammingOrderLocked(true);
    setMode('DoubleScan');
  };

  const openSingleScanModal = () => {
    if (hasPendingRfidSession) {
      return;
    }

    clearSingleScanResetTimeout();
    resetSingleScanForm();
    setIsProgrammingOrderLocked(true);
    setMode('Scan');
  };

  const closeDoubleScanModal = () => {
    if (
      doubleScanStep === 'resolving_first' ||
      doubleScanStep === 'resolving_part_configs' ||
      doubleScanStep === 'submitting' ||
      hasPendingRfidSession
    ) {
      return;
    }

    resetDoubleScanFlow();
    setMode(null);
  };

  const closeSingleScanModal = () => {
    if (isSubmittingSingleScan || hasPendingRfidSession) {
      return;
    }

    clearSingleScanResetTimeout();
    resetSingleScanForm();
    setMode(null);
  };

  const handleManualSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedLot = lot.trim();
    const trimmedManufactureDate = manufactureDate.trim();

    if (!partNumber || !selectedManualServiceOrderId) {
      setManualMessage({
        type: 'error',
        text: 'Selecciona numero de parte y una orden de servicio manual valida.',
      });
      return;
    }

    if (isServiceOrderProgrammingLimitReached(selectedManualServiceOrder)) {
      setManualMessage({
        type: 'error',
        text: PROGRAMMING_LIMIT_REACHED_MESSAGE,
      });
      return;
    }

    setIsSubmittingManual(true);
    setManualMessage(null);

    try {
      const verificationReference = selectedManualServiceOrder?.folio?.trim() || undefined;
      const result = await createManualRead({
        serviceOrderId: selectedManualServiceOrderId,
        partNumber,
        lot: trimmedLot || undefined,
        manufactureDate: trimmedManufactureDate || undefined,
        rfidProgram: selectedManualConfig?.rfidProgram,
        filterLabel: selectedManualConfig?.filterLabel,
        rawReference: verificationReference,
        notes: 'captura manual',
      });
      const programmingRecord = result.programmingRecord;

      if (!programmingRecord) {
        throw new Error(
          'La respuesta del backend no incluye el programming record de la lectura manual.',
        );
      }

      beginRfidProgramming('manual', programmingRecord, selectedManualServiceOrder, {
        partNumber,
        lot: trimmedLot || undefined,
        manufactureDate: trimmedManufactureDate || undefined,
        rfidProgram: selectedManualConfig?.rfidProgram,
        filterLabel: selectedManualConfig?.filterLabel,
        rawReference: verificationReference,
      });
    } catch (error) {
      if (isProgrammingLimitReachedError(error) && selectedManualServiceOrderId) {
        setManualServiceOrderOptions((currentServiceOrders) =>
          markServiceOrderProgrammingLimitReachedInList(
            currentServiceOrders,
            selectedManualServiceOrderId,
          ),
        );
      }

      setManualMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo conectar con el backend.',
      });
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const handleSingleScanServiceOrderSelection = async (nextServiceOrderId: string) => {
    setSelectedSingleScanServiceOrderId(nextServiceOrderId);
    setSingleScanPartOptions([]);
    setSingleScanPartNumber('');
    setSingleScanMessage(null);
    setSingleScanResult(null);

    if (!nextServiceOrderId) {
      setSingleScanStep('selecting_service_order');
      setSingleScanMessage({
        type: 'info',
        text: 'Selecciona una orden de servicio single scan para continuar.',
      });
      return;
    }

    await loadSingleScanPartOptionsForServiceOrder(nextServiceOrderId);
  };

  const handleSingleScanPartNumberSelection = (nextPartNumber: string) => {
    setSingleScanPartNumber(nextPartNumber);

    if (!nextPartNumber) {
      setSingleScanStep('selecting_part_config');
      setSingleScanMessage({
        type: 'info',
        text: 'Selecciona un numero de parte antes de registrar la lectura.',
      });
      return;
    }

    setSingleScanStep('ready_to_submit');
    setSingleScanMessage({
      type: 'info',
      text: 'Numero de parte seleccionado. Registra la lectura para continuar.',
    });
  };

  const handleSingleScanRawEnter = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    await resolveSingleScanRaw();
  };

  const handleSingleScanSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedRawScan = singleScanRawValue.trim();

    if (!selectedSingleScanServiceOrderId || !singleScanPartNumber) {
      setSingleScanMessage({
        type: 'error',
        text: 'Selecciona numero de parte y una orden de servicio single scan valida.',
      });
      return;
    }

    if (!trimmedRawScan) {
      setSingleScanMessage({
        type: 'error',
        text: 'Captura o escanea el valor raw del single scan antes de continuar.',
      });
      return;
    }

    if (isServiceOrderProgrammingLimitReached(selectedSingleScanServiceOrder)) {
      setSingleScanMessage({
        type: 'error',
        text: PROGRAMMING_LIMIT_REACHED_MESSAGE,
      });
      return;
    }

    setIsSubmittingSingleScan(true);
    setSingleScanStep('submitting');
    setSingleScanMessage(null);
    setSingleScanResult(null);

    try {
      const result = await createSingleScanRead({
        serviceOrderId: selectedSingleScanServiceOrderId,
        partNumber: singleScanPartNumber,
        rawScan: trimmedRawScan,
        notes: 'captura single scan',
      });

      clearSingleScanResetTimeout();
      setSingleScanResult(result.data ?? null);
      setSingleScanStep('success');
      setSingleScanMessage({
        type: 'info',
        text: 'Lectura single scan registrada. Continua con la programacion RFID.',
      });
      const programmingRecord = result.programmingRecord;

      if (!programmingRecord) {
        throw new Error(
          'La respuesta del backend no incluye el programming record de la lectura single scan.',
        );
      }

      beginRfidProgramming(
        'single_scan',
        programmingRecord,
        selectedSingleScanServiceOrder,
        {
          partNumber: singleScanPartNumber,
          gtin: result.data?.gtin ?? singleScanResolvedGtin ?? undefined,
          lot: result.data?.lot ?? singleScanResolvedLot ?? undefined,
          manufactureDate:
            result.data?.manufactureDate ??
            singleScanResolvedManufactureDate ??
            undefined,
          rfidProgram:
            result.data?.rfidProgram ?? selectedSingleScanConfig?.rfidProgram,
          filterLabel:
            result.data?.filterLabel ?? selectedSingleScanConfig?.filterLabel,
          rawScan: trimmedRawScan,
        },
      );
    } catch (error) {
      if (isProgrammingLimitReachedError(error) && selectedSingleScanServiceOrderId) {
        setSingleScanServiceOrderOptions((currentServiceOrders) =>
          markServiceOrderProgrammingLimitReachedInList(
            currentServiceOrders,
            selectedSingleScanServiceOrderId,
          ),
        );
      }

      setSingleScanStep('ready_to_submit');
      setSingleScanMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo conectar con el backend.',
      });
    } finally {
      setIsSubmittingSingleScan(false);
    }
  };

  const handleResolveFirstBarcode = async () => {
    const trimmedFirstBarcode = firstBarcodeRaw.trim();

    if (!trimmedFirstBarcode) {
      setDoubleScanMessage({
        type: 'error',
        text: 'Escanea el primer codigo antes de continuar.',
      });
      return;
    }

    setDoubleScanStep('resolving_first');
    setDoubleScanMessage(null);
    setDoubleScanResult(null);
    setResolvedGtin('');
    setServiceOrderOptions([]);
    setSelectedServiceOrderId('');
    setDoubleScanOptions([]);
    setSelectedPartConfigId('');
    setSecondBarcodeRaw('');

    try {
      const result = await resolveFirstDoubleScan(trimmedFirstBarcode);
      const matchingServiceOrders = await listOpenServiceOrdersByGtin(result.gtin);
      const availableServiceOrders =
      filterServiceOrdersWithProgrammingCapacity(
        matchingServiceOrders.filter(
          (serviceOrder) =>
            serviceOrder._id === selectedProgrammingServiceOrderId,
        ),
      );

      setFirstBarcodeRaw(result.firstBarcodeRaw);
      setResolvedGtin(result.gtin);
      setServiceOrderOptions(availableServiceOrders);

      if (availableServiceOrders.length === 0) {
        setDoubleScanStep('waiting_first');
        setDoubleScanMessage({
          type: 'error',
          text:
            matchingServiceOrders.length === 0
              ? 'No hay ordenes de servicio abiertas para el GTIN detectado.'
              : 'Las ordenes detectadas ya alcanzaron la cantidad objetivo de programacion.',
        });
        return;
      }

      if (availableServiceOrders.length === 1) {
        const [singleServiceOrder] = availableServiceOrders;
        setSelectedServiceOrderId(singleServiceOrder._id);
        await loadPartConfigOptionsForServiceOrder(singleServiceOrder._id);
        return;
      }

      setDoubleScanStep('selecting_service_order');
      setDoubleScanMessage({
        type: 'info',
        text: 'Se encontraron varias ordenes para el GTIN. Selecciona primero la orden de servicio.',
      });
    } catch (error) {
      setDoubleScanStep('waiting_first');
      setDoubleScanMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo resolver el primer codigo.',
      });
    }
  };

  const handleFirstBarcodeEnter = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    await handleResolveFirstBarcode();
  };

  const handleManualServiceOrderSelection = (nextServiceOrderId: string) => {
    setSelectedManualServiceOrderId(nextServiceOrderId);
    setManualPartOptions([]);
    setPartNumber('');
    setManualMessage(null);

    if (!nextServiceOrderId) {
      setManualMessage({
        type: 'info',
        text: 'Selecciona una orden de servicio manual para continuar.',
      });
      return;
    }

    void loadManualPartOptionsForServiceOrder(nextServiceOrderId);
  };

  const handleServiceOrderSelection = async (nextServiceOrderId: string) => {
    setSelectedServiceOrderId(nextServiceOrderId);
    setDoubleScanOptions([]);
    setSelectedPartConfigId('');
    setSecondBarcodeRaw('');
    setDoubleScanResult(null);

    if (!nextServiceOrderId) {
      setDoubleScanStep('selecting_service_order');
      setDoubleScanMessage({
        type: 'info',
        text: 'Selecciona una orden de servicio antes de continuar.',
      });
      return;
    }

    await loadPartConfigOptionsForServiceOrder(nextServiceOrderId);
  };

  const handlePartConfigSelection = (nextPartConfigId: string) => {
    setSelectedPartConfigId(nextPartConfigId);

    if (!nextPartConfigId) {
      setDoubleScanStep('selecting_part_config');
      setDoubleScanMessage({
        type: 'info',
        text: 'Selecciona una configuracion antes de escanear el segundo codigo.',
      });
      return;
    }

    setDoubleScanStep('waiting_second');
    setDoubleScanMessage({
      type: 'info',
      text: 'Configuracion seleccionada. Escanea el segundo codigo.',
    });
  };

  const submitDoubleScan = async () => {
    const trimmedFirstBarcode = firstBarcodeRaw.trim();
    const trimmedSecondBarcode = secondBarcodeRaw.trim();
    const trimmedNotes = doubleScanNotes.trim();

    if (!selectedServiceOrderId) {
      setDoubleScanMessage({
        type: 'error',
        text: 'Selecciona una orden de servicio valida antes de registrar la lectura.',
      });
      return;
    }

    if (!selectedPartConfigId) {
      setDoubleScanMessage({
        type: 'error',
        text: 'Selecciona una configuracion valida antes de registrar la lectura.',
      });
      return;
    }

    if (!trimmedFirstBarcode || !trimmedSecondBarcode) {
      setDoubleScanMessage({
        type: 'error',
        text: 'Escanea ambos codigos antes de registrar la lectura.',
      });
      return;
    }

    if (isServiceOrderProgrammingLimitReached(selectedServiceOrder)) {
      setDoubleScanMessage({
        type: 'error',
        text: PROGRAMMING_LIMIT_REACHED_MESSAGE,
      });
      return;
    }

    setDoubleScanStep('submitting');
    setDoubleScanMessage(null);
    setDoubleScanResult(null);

    try {
      const result = await createDoubleScanRead({
        serviceOrderId: selectedServiceOrderId,
        partConfigId: selectedPartConfigId,
        firstBarcodeRaw: trimmedFirstBarcode,
        secondBarcodeRaw: trimmedSecondBarcode,
        notes: trimmedNotes || undefined,
      });

      clearSuccessResetTimeout();
      setDoubleScanResult(result.data ?? null);
      setDoubleScanStep('success');
      setDoubleScanMessage({
        type: 'info',
        text: 'Lectura doble registrada. Continua con la programacion RFID.',
      });
      const programmingRecord = result.programmingRecord;

      if (!programmingRecord) {
        throw new Error(
          'La respuesta del backend no incluye el programming record de la lectura doble.',
        );
      }

      beginRfidProgramming('double_scan', programmingRecord, selectedServiceOrder, {
        partNumber: result.data?.partNumber ?? selectedDoubleScanConfig?.partNumber,
        gtin: result.data?.gtin ?? resolvedGtin ?? undefined,
        lot: result.data?.lot,
        manufactureDate: result.data?.manufactureDate,
        rfidProgram:
          result.data?.rfidProgram ??
          selectedDoubleScanConfig?.rfidProgram ??
          selectedServiceOrder?.rfidProgram,
        filterLabel:
          result.data?.filterLabel ?? selectedDoubleScanConfig?.filterLabel,
        firstBarcodeRaw: trimmedFirstBarcode,
        secondBarcodeRaw: trimmedSecondBarcode,
      });
    } catch (error) {
      if (isProgrammingLimitReachedError(error) && selectedServiceOrderId) {
        setServiceOrderOptions((currentServiceOrders) =>
          markServiceOrderProgrammingLimitReachedInList(
            currentServiceOrders,
            selectedServiceOrderId,
          ),
        );
      }

      setDoubleScanStep('waiting_second');
      setDoubleScanMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo conectar con el backend.',
      });
    }
  };

  const handleDoubleScanSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitDoubleScan();
  };

  const handleSecondBarcodeEnter = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();

    if (!secondBarcodeRaw.trim()) {
      return;
    }

    await submitDoubleScan();
  };

  const isResolvingOrSubmitting =
    doubleScanStep === 'resolving_first' ||
    doubleScanStep === 'resolving_part_configs' ||
    doubleScanStep === 'submitting';
  const hardwareStatusText = isConnectingDevice
    ? 'conectando dispositivo'
    : isLoadingDevices
      ? 'cargando dispositivos'
      : connectedDevice
        ? connectedDevice.isSimulated
          ? 'conectado en modo simulado'
          : 'conectado y listo para programar'
        : 'sin conectar';
  const currentDateTimeLabel = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date());

  return (
    <>
      <AppSceneLayout>
        <section className='square programmingDashboardShell'>
          <div className='generalBlock programmingDashboardCard'>
            <h1>ESTACION DE PROGRAMACION</h1>
            <div className='statusUser'>
              <h2>{`metodo: ${getConnectionMethodLabel(connectionMethod)}`}</h2>
              <h2>{`dispositivo: ${connectedDevice?.name ?? selectedAvailableDevice?.name ?? 'sin seleccionar'}`}</h2>
              <h2>{`status: ${hardwareStatusText}`}</h2>
              <h2>{`fecha/hora: ${currentDateTimeLabel}`}</h2>
            </div>

            <div className='programmingConnectionGrid'>
              <label className='modalField'>
                <span>Metodo de conexion</span>
                <select
                  aria-label='connectionMethod'
                  value={connectionMethod}
                  onChange={(event) =>
                    handleConnectionMethodChange(event.target.value as ConnectionMethod)
                  }
                  disabled={isLoadingDevices || isConnectingDevice || hasPendingRfidSession}
                >
                  <option value='serial_port'>Lector por COM</option>
                  <option value='android_usb_nfc'>Android USB/NFC</option>
                </select>
              </label>

              <label className='modalField'>
                <span>Dispositivo</span>
                <select
                  aria-label='rfidDevice'
                  value={selectedDeviceId}
                  onChange={(event) => setSelectedDeviceId(event.target.value)}
                  disabled={isLoadingDevices || isConnectingDevice || hasPendingRfidSession}
                >
                  <option value=''>Selecciona</option>
                  {availableDevices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name}
                      {device.isSimulated ? ' | simulado' : ''}
                    </option>
                  ))}
                </select>
              </label>

              <div className='modalActionRow programmingConnectionActions'>
                <button
                  className='adminPrimaryButton adminSecondaryButton'
                  type='button'
                  onClick={() => void handleRefreshDevices()}
                  disabled={isLoadingDevices || isConnectingDevice || hasPendingRfidSession}
                >
                  {isLoadingDevices ? 'Buscando...' : 'Actualizar'}
                </button>
                <button
                  className='adminPrimaryButton'
                  type='button'
                  onClick={() => void handleConnectDevice()}
                  disabled={
                    isLoadingDevices ||
                    isConnectingDevice ||
                    !selectedDeviceId ||
                    hasPendingRfidSession
                  }
                >
                  {isConnectingDevice ? 'Conectando...' : 'Conectar'}
                </button>
              </div>
            </div>
            {hardwareMessage && (
              <p className={`manualMessage ${hardwareMessage.type}`}>
                {hardwareMessage.text}
              </p>
            )}

            {rfidProgrammingMessage && (
              <p className={`manualMessage ${rfidProgrammingMessage.type}`}>
                {rfidProgrammingMessage.text}
              </p>
            )}

            {pendingRfidSession && !isRfidModalOpen && (
              <div className='scanSummaryBlock'>
                <p>{`Programacion pendiente para ${pendingRfidSession.serviceOrderFolio ?? 'sin folio'}`}</p>
                <p>{`Programming record: ${pendingRfidSession.programmingRecordId}`}</p>
                <p>{`Dispositivo asignado: ${pendingRfidSession.device.name}`}</p>
                <div className='modalActionRow'>
                  <button
                    className='adminPrimaryButton'
                    type='button'
                    onClick={() => setIsRfidModalOpen(true)}
                  >
                    Reanudar programacion RFID
                  </button>
                </div>
              </div>
            )}

            <div>
              <h2>Orden de Servicio</h2>

              <select
                aria-label='programmingServiceOrderId'
                value={selectedProgrammingServiceOrderId}
                onChange={(event) =>
                  handleProgrammingServiceOrderSelection(
                    event.target.value,
                  )
                }
                disabled={
                  isLoadingProgrammingOrders ||
                  isProgrammingOrderLocked ||
                  hasPendingRfidSession
                }
              >
                <option value=''>Selecciona</option>

                {programmingOrderOptions.map((serviceOrder) => (
                  <option
                    key={serviceOrder._id}
                    value={serviceOrder._id}
                  >
                    {serviceOrder.folio}
                    {serviceOrder.rfidProgram
                      ? ` | ${serviceOrder.rfidProgram}`
                      : ''}
                    {serviceOrder.partNumber
                      ? ` | ${serviceOrder.partNumber}`
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedProgrammingServiceOrder && (
              <div className='scanSummaryBlock'>
                <p>
                  Orden seleccionada:
                  {' '}
                  {selectedProgrammingServiceOrder.folio}
                </p>

                <p>
                  Cantidad planeada:
                  {' '}
                  {selectedProgrammingServiceOrder.quantity}
                </p>

                <p>
                  Programados:
                  {' '}
                  {getServiceOrderProgrammedCount(
                    selectedProgrammingServiceOrder,
                  )}
                </p>

                <p>
                  Restan por programar:
                  {' '}
                  {getServiceOrderRemainingToProgram(
                    selectedProgrammingServiceOrder,
                  )}
                </p>
                {isProgrammingOrderLocked && (
                  <p>Orden bloqueada hasta completar la cantidad objetivo.</p>
                )}
              </div>
            )}

            {programmingOrderMessage && (
              <p className={`manualMessage ${programmingOrderMessage.type}`}>
                {programmingOrderMessage.text}
              </p>
            )}
            <div className='buttonBox'>
              <button
                className='adminPrimaryButton'
                onClick={openManualModal}
                disabled={
                  !isHardwareReady ||
                  !hasSelectedProgrammingServiceOrder ||
                  hasPendingRfidSession
                }
              >
                Ingreso Manual
              </button>
              <button
                className='adminPrimaryButton'
                onClick={openSingleScanModal}
                disabled={
                  !isHardwareReady ||
                  !hasSelectedProgrammingServiceOrder ||
                  hasPendingRfidSession
                }
              >
                Escaner Codigo
              </button>
              <button
                className='adminPrimaryButton'
                onClick={openDoubleScanModal}
                disabled={
                  !isHardwareReady ||
                  !hasSelectedProgrammingServiceOrder ||
                  hasPendingRfidSession
                }
              >
                Doble Codigo
              </button>
            </div>
            <button className='adminPrimaryButton adminSecondaryButton' type='button' onClick={() => navigate('/', { replace: true })}>
              Volver
            </button>
          </div>
        </section>
      </AppSceneLayout>

      {mode === 'Manual' && (
        <section className='modalOverlay'>
          <div className='square generalBlock modalSquare'>
            <div className='modalHeader'>
              <h2>Ingreso Manual</h2>
              <button className='modalCloseButton' onClick={closeManualModal} disabled={isSubmittingManual}>
                X
              </button>
            </div>

            <form className='modalForm' onSubmit={handleManualSubmit}>
              <label className='modalField'>
                <span>Orden de servicio:</span>
                <select
                  aria-label='manualServiceOrderId'
                  value={selectedManualServiceOrderId}
                  onChange={(event) => handleManualServiceOrderSelection(event.target.value)}
                  disabled={isLoadingManualServiceOrders || isSubmittingManual}
                  required
                >
                  <option value=''>Selecciona</option>
                  {manualServiceOrderOptions.map((serviceOrder) => (
                    <option key={serviceOrder._id} value={serviceOrder._id}>
                      {serviceOrder.folio}
                      {serviceOrder.rfidProgram ? ` | ${serviceOrder.rfidProgram}` : ''}
                      {serviceOrder.partNumber ? ` | ${serviceOrder.partNumber}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              {isLoadingManualServiceOrders && (
                <p className='manualHint'>Cargando ordenes de servicio manuales...</p>
              )}
              {!isLoadingManualServiceOrders && manualServiceOrderOptions.length === 0 && !manualMessage && (
                <p className='manualHint'>No hay ordenes manuales disponibles.</p>
              )}

              <label className='modalField'>
                <span>Numero de Parte:</span>
                <select
                  aria-label='partNumber'
                  value={partNumber}
                  onChange={(event) => setPartNumber(event.target.value)}
                  disabled={
                    !selectedManualServiceOrderId ||
                    isLoadingManualPartOptions ||
                    isSubmittingManual ||
                    isServiceOrderProgrammingLimitReached(selectedManualServiceOrder)
                  }
                  required
                >
                  <option value=''>Selecciona</option>
                  {manualPartOptions.map((option) => (
                    <option key={option.id} value={option.partNumber}>
                      {option.partNumber}
                    </option>
                  ))}
                </select>
              </label>

              {isLoadingManualPartOptions && (
                <p className='manualHint'>Cargando numero de parte solicitado por la orden...</p>
              )}

              {selectedManualServiceOrder && (
                <div className='scanSummaryBlock'>
                  <p>Orden seleccionada: {selectedManualServiceOrder.folio}</p>
                  <p>Cantidad planeada: {selectedManualServiceOrder.quantity}</p>
                  <p>{`Programados: ${getServiceOrderProgrammedCount(selectedManualServiceOrder)}`}</p>
                  <p>{`Verificados: ${getServiceOrderVerifiedCount(selectedManualServiceOrder)}`}</p>
                  <p>{`Restan por programar: ${getServiceOrderRemainingToProgram(selectedManualServiceOrder)}`}</p>
                  <p>{`Restan por verificar: ${getServiceOrderRemainingToVerify(selectedManualServiceOrder)}`}</p>
                  {isServiceOrderProgrammingLimitReached(selectedManualServiceOrder) && (
                    <p>{PROGRAMMING_LIMIT_REACHED_MESSAGE}</p>
                  )}
                  {selectedManualServiceOrder.partNumber && (
                    <p>Numero de parte solicitado: {selectedManualServiceOrder.partNumber}</p>
                  )}
                  <p>{`Referencia sugerida para verificacion: ${selectedManualServiceOrder.folio}`}</p>
                  {selectedManualServiceOrder.rfidProgram && (
                    <p>Programa RFID esperado: {selectedManualServiceOrder.rfidProgram}</p>
                  )}
                </div>
              )}

              <label className='modalField'>
                <span>Numero de Lote:</span>
                <input
                  type='text'
                  value={lot}
                  onChange={(event) => setLot(event.target.value)}
                  placeholder='Opcional'
                  disabled={isSubmittingManual}
                />
              </label>

              <label className='modalField'>
                <span>Fecha de Manufactura:</span>
                <input
                  type='date'
                  value={manufactureDate}
                  onChange={(event) => setManufactureDate(event.target.value)}
                  disabled={isSubmittingManual}
                />
              </label>

              {selectedManualConfig && (
                <div className='scanSummaryBlock'>
                  {selectedManualConfig.rfidProgram && (
                    <p>Programa RFID: {selectedManualConfig.rfidProgram}</p>
                  )}
                  {selectedManualConfig.filterLabel && (
                    <p>Filter label: {selectedManualConfig.filterLabel}</p>
                  )}
                </div>
              )}

              {manualMessage && <p className={`manualMessage ${manualMessage.type}`}>{manualMessage.text}</p>}

              <button
                className='adminPrimaryButton modalSubmitButton'
                type='submit'
                disabled={
                  isSubmittingManual ||
                  !partNumber ||
                  !selectedManualServiceOrderId ||
                  !selectedManualServiceOrder ||
                  isServiceOrderProgrammingLimitReached(selectedManualServiceOrder)
                }
              >
                {isSubmittingManual ? 'Guardando...' : 'Ingresar valores'}
              </button>
            </form>
          </div>
        </section>
      )}

      {mode === 'DoubleScan' && (
        <section className='modalOverlay'>
          <div className='square generalBlock modalSquare'>
            <div className='modalHeader'>
              <h2>Ingreso con Doble Codigo</h2>
              <button
                className='modalCloseButton'
                type='button'
                onClick={closeDoubleScanModal}
                disabled={isResolvingOrSubmitting}
                aria-label='Cerrar modal de doble codigo'
              >
                X
              </button>
            </div>

            <form className='modalForm' onSubmit={handleDoubleScanSubmit}>
              <label className='modalField'>
                <span>Primer codigo:</span>
                <input
                  ref={firstBarcodeInputRef}
                  type='text'
                  value={firstBarcodeRaw}
                  onChange={(event) => setFirstBarcodeRaw(event.target.value)}
                  onKeyDown={(event) => void handleFirstBarcodeEnter(event)}
                  placeholder='Escanea el primer codigo'
                  disabled={
                    doubleScanStep === 'resolving_first' ||
                    doubleScanStep === 'selecting_service_order' ||
                    doubleScanStep === 'resolving_part_configs' ||
                    doubleScanStep === 'selecting_part_config' ||
                    doubleScanStep === 'waiting_second' ||
                    doubleScanStep === 'submitting'
                  }
                  autoComplete='off'
                />
              </label>

              <div className='modalActionRow'>
                <button
                  className='adminPrimaryButton'
                  type='button'
                  onClick={() => void handleResolveFirstBarcode()}
                  disabled={
                    isResolvingOrSubmitting ||
                    !firstBarcodeRaw.trim() ||
                    doubleScanStep === 'selecting_service_order' ||
                    doubleScanStep === 'selecting_part_config' ||
                    doubleScanStep === 'waiting_second'
                  }
                >
                  {doubleScanStep === 'resolving_first' ? 'Resolviendo...' : 'Resolver primer codigo'}
                </button>
              </div>

              {resolvedGtin && (
                <div className='scanSummaryBlock'>
                  <p>GTIN detectado: {resolvedGtin}</p>
                  <p>Primer codigo: {firstBarcodeRaw}</p>
                </div>
              )}

              {serviceOrderOptions.length > 0 && (
                <label className='modalField'>
                  <span>Orden de servicio:</span>
                  <select
                    ref={serviceOrderSelectRef}
                    aria-label='serviceOrderId'
                    value={selectedServiceOrderId}
                    onChange={(event) => void handleServiceOrderSelection(event.target.value)}
                    disabled={isResolvingOrSubmitting}
                    required
                  >
                    <option value=''>Selecciona una orden</option>
                    {serviceOrderOptions.map((serviceOrderOption) => (
                      <option key={serviceOrderOption._id} value={serviceOrderOption._id}>
                        {serviceOrderOption.folio}
                        {serviceOrderOption.rfidProgram ? ` | ${serviceOrderOption.rfidProgram}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {selectedServiceOrder && (
                <div className='scanSummaryBlock'>
                  <p>Orden seleccionada: {selectedServiceOrder.folio}</p>
                  <p>GTIN esperado: {selectedServiceOrder.gtin}</p>
                  <p>Programa RFID esperado: {selectedServiceOrder.rfidProgram}</p>
                  <p>Cantidad planeada: {selectedServiceOrder.quantity}</p>
                  <p>{`Programados: ${getServiceOrderProgrammedCount(selectedServiceOrder)}`}</p>
                  <p>{`Verificados: ${getServiceOrderVerifiedCount(selectedServiceOrder)}`}</p>
                  <p>{`Restan por programar: ${getServiceOrderRemainingToProgram(selectedServiceOrder)}`}</p>
                  <p>{`Restan por verificar: ${getServiceOrderRemainingToVerify(selectedServiceOrder)}`}</p>
                  {isServiceOrderProgrammingLimitReached(selectedServiceOrder) && (
                    <p>{PROGRAMMING_LIMIT_REACHED_MESSAGE}</p>
                  )}
                </div>
              )}

              {selectedServiceOrderId && doubleScanOptions.length > 0 && (
                <label className='modalField'>
                  <span>Numero de Parte:</span>
                  <select
                    ref={partConfigSelectRef}
                    aria-label='partConfigId'
                    value={selectedPartConfigId}
                    onChange={(event) => handlePartConfigSelection(event.target.value)}
                    disabled={
                      isResolvingOrSubmitting ||
                      isServiceOrderProgrammingLimitReached(selectedServiceOrder)
                    }
                    required
                  >
                    <option value=''>Selecciona un numero de parte</option>
                    {doubleScanOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.partNumber}
                        {option.rfidProgram ? ` | ${option.rfidProgram}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {selectedDoubleScanConfig && (
                <div className='scanSummaryBlock'>
                  <p>Numero de parte: {selectedDoubleScanConfig.partNumber}</p>
                  {selectedDoubleScanConfig.description && <p>Descripcion: {selectedDoubleScanConfig.description}</p>}
                  {selectedDoubleScanConfig.rfidProgram && (
                    <p>Programa RFID: {selectedDoubleScanConfig.rfidProgram}</p>
                  )}
                  {selectedDoubleScanConfig.filterLabel && (
                    <p>Filter label: {selectedDoubleScanConfig.filterLabel}</p>
                  )}
                  {selectedDoubleScanConfig.expectedLotLength !== undefined && (
                    <p>Longitud esperada de lote: {selectedDoubleScanConfig.expectedLotLength}</p>
                  )}
                </div>
              )}

              <label className='modalField'>
                <span>Notas:</span>
                <textarea
                  value={doubleScanNotes}
                  onChange={(event) => setDoubleScanNotes(event.target.value)}
                  placeholder='Notas opcionales para esta corrida'
                  disabled={isResolvingOrSubmitting}
                  rows={3}
                />
              </label>

              <label className='modalField'>
                <span>Segundo codigo:</span>
                <input
                  ref={secondBarcodeInputRef}
                  type='text'
                  value={secondBarcodeRaw}
                  onChange={(event) => setSecondBarcodeRaw(event.target.value)}
                  onKeyDown={(event) => void handleSecondBarcodeEnter(event)}
                  placeholder='Escanea el segundo codigo'
                  disabled={
                    !selectedPartConfigId ||
                    isResolvingOrSubmitting ||
                    isServiceOrderProgrammingLimitReached(selectedServiceOrder)
                  }
                  autoComplete='off'
                />
              </label>

              <p className='manualHint'>
                {doubleScanStep === 'resolving_first'
                  ? 'Resolviendo el GTIN del primer codigo...'
                  : doubleScanStep === 'selecting_service_order'
                    ? hasMultipleServiceOrderOptions
                      ? 'Selecciona la orden de servicio correcta para continuar.'
                      : 'Orden de servicio detectada. Preparando opciones de numero de parte.'
                    : doubleScanStep === 'resolving_part_configs'
                      ? 'Cargando numeros de parte para la orden seleccionada...'
                    : doubleScanStep === 'selecting_part_config'
                      ? 'Selecciona el numero de parte correcto para continuar.'
                    : doubleScanStep === 'success'
                      ? 'Lectura registrada. Preparando la siguiente captura...'
                    : doubleScanStep === 'waiting_second'
                      ? 'Escanea el segundo codigo para completar la lectura.'
                      : 'Escanea el primer codigo y resuelvelo antes de continuar.'}
              </p>

              {doubleScanMessage && (
                <p className={`manualMessage ${doubleScanMessage.type}`}>{doubleScanMessage.text}</p>
              )}

              {doubleScanResult && (
                <div className='scanSummaryBlock scanResultBlock'>
                  <p>Numero de parte: {doubleScanResult.partNumber}</p>
                  <p>GTIN: {doubleScanResult.gtin}</p>
                  <p>Lote: {doubleScanResult.lot}</p>
                  <p>Fecha de manufactura: {doubleScanResult.manufactureDate}</p>
                  <p>Programa RFID: {doubleScanResult.rfidProgram}</p>
                  {doubleScanResult.filterLabel && <p>Filter label: {doubleScanResult.filterLabel}</p>}
                </div>
              )}

              <div className='modalActionRow'>
                <button
                  className='adminPrimaryButton adminSecondaryButton'
                  type='button'
                  onClick={resetDoubleScanFlow}
                  disabled={isResolvingOrSubmitting}
                >
                  Limpiar
                </button>
                <button
                  className='adminPrimaryButton modalSubmitButton'
                  type='submit'
                  disabled={
                    isResolvingOrSubmitting ||
                    !selectedServiceOrderId ||
                    !selectedServiceOrder ||
                    !selectedPartConfigId ||
                    !secondBarcodeRaw.trim() ||
                    isServiceOrderProgrammingLimitReached(selectedServiceOrder)
                  }
                >
                  {doubleScanStep === 'submitting' ? 'Guardando...' : 'Registrar lectura'}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {mode === 'Scan' && (
        <section className='modalOverlay'>
          <div className='square generalBlock modalSquare'>
            <div className='modalHeader'>
              <h2>Ingreso Single Scan</h2>
              <button
                className='modalCloseButton'
                onClick={closeSingleScanModal}
                disabled={
                  isSubmittingSingleScan ||
                  isLoadingSingleScanServiceOrders ||
                  isLoadingSingleScanPartOptions
                }
              >
                X
              </button>
            </div>

            <form className='modalForm' onSubmit={handleSingleScanSubmit}>
              <label className='modalField'>
                <span>Valor raw scan:</span>
                <input
                  ref={singleScanInputRef}
                  type='text'
                  value={singleScanRawValue}
                  onChange={(event) => setSingleScanRawValue(event.target.value)}
                  onKeyDown={(event) => void handleSingleScanRawEnter(event)}
                  placeholder='Escanea el codigo GS1'
                  disabled={
                    singleScanStep === 'resolving_scan' ||
                    singleScanStep === 'selecting_service_order' ||
                    singleScanStep === 'resolving_part_configs' ||
                    singleScanStep === 'selecting_part_config' ||
                    singleScanStep === 'ready_to_submit' ||
                    singleScanStep === 'submitting' ||
                    singleScanStep === 'success'
                  }
                  autoComplete='off'
                  required
                />
              </label>

              <div className='modalActionRow'>
                <button
                  className='adminPrimaryButton'
                  type='button'
                  onClick={() => void resolveSingleScanRaw()}
                  disabled={
                    isSubmittingSingleScan ||
                    isLoadingSingleScanServiceOrders ||
                    isLoadingSingleScanPartOptions ||
                    !singleScanRawValue.trim() ||
                    singleScanStep === 'selecting_service_order' ||
                    singleScanStep === 'selecting_part_config' ||
                    singleScanStep === 'ready_to_submit' ||
                    singleScanStep === 'submitting' ||
                    singleScanStep === 'success'
                  }
                >
                  {singleScanStep === 'resolving_scan' ? 'Resolviendo...' : 'Resolver escaneo'}
                </button>
              </div>

              {singleScanResolvedGtin && (
                <div className='scanSummaryBlock'>
                  <p>GTIN detectado: {singleScanResolvedGtin}</p>
                  <p>Raw scan: {singleScanRawValue}</p>
                  <p>Lote detectado: {singleScanResolvedLot || 'N/D'}</p>
                  <p>
                    Fecha de manufactura detectada:{' '}
                    {singleScanResolvedManufactureDate
                      ? formatGs1ManufactureDate(singleScanResolvedManufactureDate)
                      : 'N/D'}
                  </p>
                </div>
              )}

              <label className='modalField'>
                <span>Orden de servicio:</span>
                <select
                  ref={singleScanServiceOrderSelectRef}
                  aria-label='singleScanServiceOrderId'
                  value={selectedSingleScanServiceOrderId}
                  onChange={(event) => void handleSingleScanServiceOrderSelection(event.target.value)}
                  disabled={
                    singleScanServiceOrderOptions.length === 0 ||
                    isLoadingSingleScanServiceOrders ||
                    isLoadingSingleScanPartOptions ||
                    isSubmittingSingleScan
                  }
                  required
                >
                  <option value=''>Selecciona</option>
                  {singleScanServiceOrderOptions.map((serviceOrder) => (
                    <option key={serviceOrder._id} value={serviceOrder._id}>
                      {serviceOrder.folio}
                      {serviceOrder.rfidProgram ? ` | ${serviceOrder.rfidProgram}` : ''}
                      {serviceOrder.partNumber ? ` | ${serviceOrder.partNumber}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              {isLoadingSingleScanServiceOrders && (
                <p className='manualHint'>Buscando ordenes single scan abiertas para el GTIN...</p>
              )}
              {!isLoadingSingleScanServiceOrders &&
                singleScanResolvedGtin &&
                singleScanServiceOrderOptions.length === 0 &&
                !singleScanMessage && (
                  <p className='manualHint'>No hay ordenes single scan disponibles.</p>
                )}

              {selectedSingleScanServiceOrder && (
                <div className='scanSummaryBlock'>
                  <p>Orden seleccionada: {selectedSingleScanServiceOrder.folio}</p>
                  <p>Cantidad planeada: {selectedSingleScanServiceOrder.quantity}</p>
                  <p>{`Programados: ${getServiceOrderProgrammedCount(selectedSingleScanServiceOrder)}`}</p>
                  <p>{`Verificados: ${getServiceOrderVerifiedCount(selectedSingleScanServiceOrder)}`}</p>
                  <p>{`Restan por programar: ${getServiceOrderRemainingToProgram(selectedSingleScanServiceOrder)}`}</p>
                  <p>{`Restan por verificar: ${getServiceOrderRemainingToVerify(selectedSingleScanServiceOrder)}`}</p>
                  {isServiceOrderProgrammingLimitReached(selectedSingleScanServiceOrder) && (
                    <p>{PROGRAMMING_LIMIT_REACHED_MESSAGE}</p>
                  )}
                  {selectedSingleScanServiceOrder.partNumber && (
                    <p>Numero de parte solicitado: {selectedSingleScanServiceOrder.partNumber}</p>
                  )}
                  {selectedSingleScanServiceOrder.rfidProgram && (
                    <p>Programa RFID esperado: {selectedSingleScanServiceOrder.rfidProgram}</p>
                  )}
                </div>
              )}

              {selectedSingleScanServiceOrderId && singleScanPartOptions.length > 0 && (
                <label className='modalField'>
                  <span>Numero de Parte:</span>
                  <select
                    ref={singleScanPartNumberSelectRef}
                    aria-label='singleScanPartNumber'
                    value={singleScanPartNumber}
                    onChange={(event) => handleSingleScanPartNumberSelection(event.target.value)}
                    disabled={
                      isLoadingSingleScanPartOptions ||
                      isSubmittingSingleScan ||
                      isServiceOrderProgrammingLimitReached(selectedSingleScanServiceOrder)
                    }
                    required
                  >
                    <option value=''>Selecciona</option>
                    {singleScanPartOptions.map((option) => (
                      <option key={option.id} value={option.partNumber}>
                        {option.partNumber}
                        {option.rfidProgram ? ` | ${option.rfidProgram}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {isLoadingSingleScanPartOptions && (
                <p className='manualHint'>Cargando numero de parte solicitado por la orden single scan...</p>
              )}

              {selectedSingleScanConfig && (
                <div className='scanSummaryBlock'>
                  <p>Numero de parte: {selectedSingleScanConfig.partNumber}</p>
                  {selectedSingleScanConfig.rfidProgram && (
                    <p>Programa RFID: {selectedSingleScanConfig.rfidProgram}</p>
                  )}
                  {selectedSingleScanConfig.filterLabel && (
                    <p>Filter label: {selectedSingleScanConfig.filterLabel}</p>
                  )}
                  {selectedSingleScanConfig.expectedLotLength !== undefined && (
                    <p>Longitud esperada de lote: {selectedSingleScanConfig.expectedLotLength}</p>
                  )}
                </div>
              )}

              <p className='manualHint'>
                {singleScanStep === 'resolving_scan'
                  ? 'Resolviendo GTIN, lote y fecha desde el escaneo...'
                  : singleScanStep === 'selecting_service_order'
                    ? hasMultipleSingleScanServiceOrderOptions
                      ? 'Selecciona la orden de servicio correcta para continuar.'
                      : 'Orden de servicio detectada. Preparando numero de parte.'
                    : singleScanStep === 'resolving_part_configs'
                      ? 'Cargando numeros de parte para la orden seleccionada...'
                    : singleScanStep === 'selecting_part_config'
                      ? 'Selecciona el numero de parte correcto para continuar.'
                    : singleScanStep === 'ready_to_submit'
                      ? 'Todo listo. Registra la lectura para continuar.'
                    : singleScanStep === 'success'
                      ? 'Lectura registrada. Preparando la siguiente captura...'
                    : singleScanStep === 'submitting'
                      ? 'Registrando la lectura single scan...'
                      : 'Escanea primero el codigo GS1 para resolver GTIN y ordenes abiertas.'}
              </p>

              {singleScanResult && (
                <div className='scanSummaryBlock scanResultBlock'>
                  <p>Numero de parte: {singleScanResult.partNumber}</p>
                  {singleScanResult.gtin && <p>GTIN: {singleScanResult.gtin}</p>}
                  <p>Raw scan: {singleScanResult.rawScan}</p>
                  {singleScanResult.lot && <p>Lote: {singleScanResult.lot}</p>}
                  {singleScanResult.manufactureDate && (
                    <p>
                      Fecha de manufactura:{' '}
                      {formatGs1ManufactureDate(singleScanResult.manufactureDate)}
                    </p>
                  )}
                  {singleScanResult.rfidProgram && <p>Programa RFID: {singleScanResult.rfidProgram}</p>}
                </div>
              )}

              {singleScanMessage && (
                <p className={`manualMessage ${singleScanMessage.type}`}>{singleScanMessage.text}</p>
              )}

              <div className='modalActionRow'>
                <button
                  className='adminPrimaryButton adminSecondaryButton'
                  type='button'
                  onClick={() => {
                    clearSingleScanResetTimeout();
                    resetSingleScanForm();
                  }}
                  disabled={
                    isSubmittingSingleScan ||
                    isLoadingSingleScanServiceOrders ||
                    isLoadingSingleScanPartOptions
                  }
                >
                  Limpiar
                </button>
                <button
                  className='adminPrimaryButton modalSubmitButton'
                  type='submit'
                  disabled={
                    isSubmittingSingleScan ||
                    isLoadingSingleScanServiceOrders ||
                    isLoadingSingleScanPartOptions ||
                    !singleScanPartNumber ||
                    !selectedSingleScanServiceOrderId ||
                    !selectedSingleScanServiceOrder ||
                    !singleScanRawValue.trim() ||
                    singleScanStep === 'resolving_scan' ||
                    singleScanStep === 'selecting_service_order' ||
                    singleScanStep === 'resolving_part_configs' ||
                    singleScanStep === 'selecting_part_config' ||
                    singleScanStep === 'success' ||
                    isServiceOrderProgrammingLimitReached(selectedSingleScanServiceOrder)
                  }
                >
                  {singleScanStep === 'submitting' ? 'Guardando...' : 'Registrar lectura'}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {pendingRfidSession && isRfidModalOpen && (
        <RfidProgrammingModal
          session={pendingRfidSession}
          onClose={handleClosePendingRfidModal}
          onCompleted={handleRfidProgrammingCompleted}
        />
      )}
    </>
  );
}

export default ProgrammingDashboardPage;
