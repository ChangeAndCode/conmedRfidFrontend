import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppSceneLayout from '../../components/appSceneLayout';
import VerificationReportCreateModal from '../../components/verificationReportCreateModal';
import VerificationReportPrintModal from '../../components/verificationReportPrintModal';
import { useAuth } from '../../context/useAuth';
import '../../css/verificationDashboard.css';
import { listPrintInterruptions } from '../../services/printInterruptionService';
import {
  getServiceOrderById,
  listServiceOrders,
} from '../../services/serviceOrderService';
import {
  resolveProgrammingRecord,
  verifyProgrammingRecord,
} from '../../services/programmingRecordService';
import {
  createVerificationReport,
  markVerificationReportAsPrinted,
  markVerificationReportPrintInterrupted,
} from '../../services/verificationReportService';
import type {
  PrintInterruption,
} from '../../types/PrintInterruption';
import type {
  ProgrammingRecord,
  ProgrammingRecordMatchStrategy,
  ProgrammingRecordMode,
  ResolveProgrammingRecordPayload,
  ResolveProgrammingRecordResult,
  VerifyProgrammingRecordPayload,
  VerifyProgrammingRecordResponse,
} from '../../types/ProgrammingRecord';
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

const buildDefaultVerifier = (username?: string) => username?.trim() || 'estacion-verificacion';

const INITIAL_FORM_VALUES = (username?: string): VerificationFormState => ({
  rawReference: '',
  rawScan: '',
  firstBarcodeRaw: '',
  secondBarcodeRaw: '',
  verifiedBy: buildDefaultVerifier(username),
  verificationNotes: '',
});

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
      return 'Escaneo único';
    case 'double_scan':
      return 'Doble código';
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

const formatMatchStrategy = (strategy?: ProgrammingRecordMatchStrategy) => {
  switch (strategy) {
    case 'manual_raw_reference':
      return 'Folio / parte / referencia manual';
    case 'single_scan_raw':
      return 'Escaneo único exacto';
    case 'double_scan_raw':
      return 'Doble código exacto';
    case 'gs1_fields':
      return 'Campos GS1';
    default:
      return 'N/D';
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

const isServiceOrderVerificationLimitReached = (serviceOrder?: ServiceOrder | null) =>
  getServiceOrderRemainingToVerify(serviceOrder) <= 0;

const filterServiceOrdersWithVerificationCapacity = (serviceOrders: ServiceOrder[]) =>
  serviceOrders.filter((serviceOrder) => !isServiceOrderVerificationLimitReached(serviceOrder));

const isServiceOrderReadyForVerificationReport = (serviceOrder?: ServiceOrder | null) =>
  serviceOrder?.status === 'closed' && getServiceOrderRemainingToVerify(serviceOrder) === 0;

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

function ValidationDashboardPage() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [mode, setMode] = useState<ProgrammingRecordMode>('manual');
  const [formValues, setFormValues] = useState<VerificationFormState>(() =>
    INITIAL_FORM_VALUES(user?.username),
  );
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const [resolution, setResolution] = useState<ResolveProgrammingRecordResult | null>(null);
  const [selectedProgrammingRecordId, setSelectedProgrammingRecordId] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
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
  const [selectedVerificationServiceOrderId, setSelectedVerificationServiceOrderId] = useState('');
  const [isVerificationOrderLocked, setIsVerificationOrderLocked] = useState(false);
  const [verificationOrderMessage, setVerificationOrderMessage] = useState<FeedbackMessage | null>(null);

  const selectedProgrammingRecord =
    resolution?.candidates.find((candidate) => candidate._id === selectedProgrammingRecordId) ?? null;

  const selectedVerificationServiceOrder = verificationOrderOptions.find(
    (serviceOrder) => serviceOrder._id === selectedVerificationServiceOrderId,
  );
  const hasSelectedVerificationServiceOrder = Boolean(selectedVerificationServiceOrderId);

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

  const handleVerificationServiceOrderSelection = (nextServiceOrderId: string) => {
    setSelectedVerificationServiceOrderId(nextServiceOrderId);
    setVerificationOrderMessage(null);

    if (!nextServiceOrderId) {
      setIsVerificationOrderLocked(false);
      return;
    }

    setVerificationOrderMessage({
      type: 'info',
      text: 'Orden seleccionada correctamente. No podra cambiarse al iniciar la verificacion.',
    });
  };

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

  const maybeOpenVerificationReportModal = (
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
  };

  const resetResolutionState = () => {
    setResolution(null);
    setSelectedProgrammingRecordId(null);
    setRelatedServiceOrder(null);
    setRelatedServiceOrderError(null);
  };

  const resetFormForMode = (nextMode: ProgrammingRecordMode) => {
    setMode(nextMode);
    setIsVerificationOrderLocked(true);
    setMessage(null);
    resetResolutionState();
    setFormValues((currentValues) => ({
      rawReference: '',
      rawScan: '',
      firstBarcodeRaw: '',
      secondBarcodeRaw: '',
      verifiedBy: currentValues.verifiedBy || buildDefaultVerifier(user?.username),
      verificationNotes: currentValues.verificationNotes,
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
    const serviceOrderId = selectedProgrammingRecord?.serviceOrderId;

    if (!serviceOrderId) {
      setRelatedServiceOrder(null);
      setRelatedServiceOrderError(null);
      setIsLoadingRelatedServiceOrder(false);
      return;
    }

    void loadRelatedServiceOrder(serviceOrderId);
  }, [loadRelatedServiceOrder, selectedProgrammingRecord?.serviceOrderId]);

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
      return 'Captura el folio de la orden, el numero de parte o la referencia manual guardada.';
    }

    if (mode === 'single_scan' && !formValues.rawScan.trim()) {
      return 'Captura el raw scan para resolver la programacion.';
    }

    if (
      mode === 'double_scan' &&
      (!formValues.firstBarcodeRaw.trim() || !formValues.secondBarcodeRaw.trim())
    ) {
      return 'Captura ambos codigos para resolver la programacion.';
    }

    return null;
  };

  const handleResolve = async () => {
    if (!selectedVerificationServiceOrderId) {
      setVerificationOrderMessage({
        type: 'error',
        text: 'Selecciona primero una orden de servicio para verificar.',
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

    setIsResolving(true);
    setMessage(null);
    resetResolutionState();

    try {
      const result = await resolveProgrammingRecord(buildResolvePayload());
      setResolution(result.data);

      if (result.data.autoSelectedProgrammingRecordId) {
        setSelectedProgrammingRecordId(result.data.autoSelectedProgrammingRecordId);
      }

      setMessage({
        type:
          result.data.candidateCount === 0
            ? 'error'
            : result.data.candidateCount === 1
              ? 'success'
              : 'info',
        text: result.message,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo resolver la programacion.',
      });
    } finally {
      setIsResolving(false);
    }
  };

  const handleVerify = async () => {
    if (!selectedVerificationServiceOrderId) {
      setVerificationOrderMessage({
        type: 'error',
        text: 'Selecciona primero una orden de servicio para verificar.',
      });
      return;
    }

    if (
      selectedProgrammingRecord?.serviceOrderId &&
      selectedProgrammingRecord.serviceOrderId !== selectedVerificationServiceOrderId
    ) {
      setMessage({
        type: 'error',
        text: 'El registro seleccionado no pertenece a la orden de servicio elegida.',
      });
      return;
    }

    if (!selectedProgrammingRecord) {
      setMessage({
        type: 'error',
        text: 'Selecciona primero un programming record candidato.',
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

    if (selectedProgrammingRecord.status === 'verified') {
      setMessage({
        type: 'success',
        text: 'El codigo escaneado ya fue verificado.',
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

      setResolution((currentResolution) => {
        if (!currentResolution) {
          return currentResolution;
        }

        return {
          ...currentResolution,
          candidates: currentResolution.candidates.map((candidate) =>
            candidate._id === verifiedProgrammingRecord._id ? verifiedProgrammingRecord : candidate,
          ),
        };
      });

      setSelectedProgrammingRecordId(verifiedProgrammingRecord._id);

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
        refreshedServiceOrder?._id ?? verifiedProgrammingRecord.serviceOrderId ?? selectedVerificationServiceOrderId,
      );

      maybeOpenVerificationReportModal(
        refreshedServiceOrder,
        result.data.verificationReport,
      );
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo verificar la programacion.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleReset = () => {
    setMessage(null);
    resetResolutionState();
    setFormValues((currentValues) => ({
      ...INITIAL_FORM_VALUES(user?.username),
      verifiedBy: currentValues.verifiedBy.trim() || buildDefaultVerifier(user?.username),
    }));
  };

  const handleCreateVerificationReport = async (payload: CreateVerificationReportPayload) => {
    const result = await createVerificationReport(payload);
    setCreatingVerificationReportFor(null);
    setActiveVerificationReportPrintFlow(result.data);
    setMessage({
      type: 'success',
      text: result.message,
    });
  };

  return (
    <AppSceneLayout>
      <section className='square verificationDashboardShell'>
        <div className='verificationDashboardCard'>
          <header className='verificationHeroCard'>
            <div className='verificationHeroCopy'>
              <p className='verificationEyebrow'>Estación de verificacion</p>
              <h1>Validación de registros programados</h1>
              <p>
                Resuelve la evidencia capturada, elige el candidato correcto si hay más de uno y confirma la verificación contra el sistema.
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

          {message && <div className={`verificationMessage ${message.type}`}>{message.text}</div>}
          <article className='verificationPanelCard'>
            <div className='verificationPanelHeader'>
              <div>
                <h2>Orden de Servicio</h2>
                <p>Selecciona la orden que se verificara antes de resolver la evidencia.</p>
              </div>
            </div>

            <label className='verificationField verificationFieldFull'>
              <span>Orden de servicio</span>
              <select
                aria-label='verificationServiceOrderId'
                value={selectedVerificationServiceOrderId}
                onChange={(event) => handleVerificationServiceOrderSelection(event.target.value)}
                disabled={isLoadingVerificationOrders || isVerificationOrderLocked}
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
                  <span>Orden seleccionada</span>
                  <strong>{selectedVerificationServiceOrder.folio}</strong>
                </div>
                <div className='verificationSummaryItem'>
                  <span>Cantidad planeada</span>
                  <strong>{selectedVerificationServiceOrder.quantity}</strong>
                </div>
                <div className='verificationSummaryItem'>
                  <span>Verificadas</span>
                  <strong>{getServiceOrderVerifiedCount(selectedVerificationServiceOrder)}</strong>
                </div>
                <div className='verificationSummaryItem'>
                  <span>Restan por verificar</span>
                  <strong>{getServiceOrderRemainingToVerify(selectedVerificationServiceOrder)}</strong>
                </div>
              </div>
            )}

            {isVerificationOrderLocked && (
              <p className='verificationHint'>Orden bloqueada hasta completar la cantidad objetivo.</p>
            )}

            {verificationOrderMessage && (
              <div className={`verificationMessage ${verificationOrderMessage.type}`}>
                {verificationOrderMessage.text}
              </div>
            )}
          </article>

          <div className='verificationMainGrid'>
            <article className='verificationPanelCard'>
              <div className='verificationPanelHeader'>
                <div>
                  <h2>Evidencia</h2>
                  <p>Elige el modo y captura la evidencia con la que el sistema puede resolver el registro programado.</p>
                </div>
              </div>

              <div className='verificationModeSelector' role='tablist' aria-label='Modo de verificacion'>
                {(['manual', 'single_scan', 'double_scan'] as ProgrammingRecordMode[]).map((modeOption) => (
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
                    disabled={!hasSelectedVerificationServiceOrder || isResolving || isVerifying}
                  >
                    {formatModeLabel(modeOption)}
                  </button>
                ))}
              </div>

              <div className='verificationFormGrid'>
                {mode === 'manual' && (
                  <>
                    <label className='verificationField verificationFieldFull'>
                      <span>Referencia manual / folio</span>
                      <input
                        type='text'
                        value={formValues.rawReference}
                        onChange={(event) =>
                          setFormValues((currentValues) => ({
                            ...currentValues,
                            rawReference: event.target.value,
                          }))
                        }
                        placeholder='ML20260519140228 o A2A00231'
                        disabled={isResolving || isVerifying}
                      />
                    </label>

                    <div className='verificationHint verificationFieldFull'>
                      Usa el folio de la orden manual, el numero de parte o la referencia guardada
                      al programar. Para lecturas manuales nuevas, la referencia por defecto ya es
                      el folio de la orden.
                    </div>
                  </>
                )}

                {mode === 'single_scan' && (
                  <label className='verificationField verificationFieldFull'>
                    <span>Escaneo original</span>
                    <textarea
                      value={formValues.rawScan}
                      onChange={(event) =>
                        setFormValues((currentValues) => ({
                          ...currentValues,
                          rawScan: event.target.value,
                        }))
                      }
                      placeholder='0120845854081720112209011020220'
                      disabled={isResolving || isVerifying}
                      rows={3}
                    />
                  </label>
                )}

                {mode === 'double_scan' && (
                  <>
                    <label className='verificationField'>
                      <span>Segundo código original</span>
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
                        disabled={isResolving || isVerifying}
                      />
                    </label>
                  </>
                )}

                
                <label className='verificationField verificationFieldFull'>
                  <span>Notas de verificación</span>
                  <textarea
                    value={formValues.verificationNotes}
                    onChange={(event) =>
                      setFormValues((currentValues) => ({
                        ...currentValues,
                        verificationNotes: event.target.value,
                      }))
                    }
                    placeholder='Notas opcionales para la verificacion'
                    disabled={isResolving || isVerifying}
                    rows={3}
                  />
                </label>
              </div>

              <p className='verificationHint'>
                Se envia siempre `mode` en `resolve` para evitar matches cruzados por `gs1_fields`.
              </p>

              <div className='verificationActionRow'>
                <button
                  className='buttonSelector verificationActionButton'
                  type='button'
                  onClick={() => void handleResolve()}
                  disabled={isResolving || isVerifying || !hasSelectedVerificationServiceOrder}
                >
                  {isResolving ? 'Resolviendo...' : 'Resolver programación'}
                </button>
                <button
                  className='buttonSelector verificationActionButton'
                  type='button'
                  onClick={handleReset}
                  disabled={isResolving || isVerifying}
                >
                  Limpiar
                </button>
              </div>
            </article>
          </div>

          <div className='verificationBottomGrid'>
            <article className='verificationPanelCard'>
              <div className='verificationPanelHeader'>
                <div>
                  <h2>Resolución</h2>
                  <p>Revisa el match strategy, la entrada normalizada y el conjunto de candidatos.</p>
                </div>
              </div>

              {!resolution ? (
                <p className='verificationEmptyState'>
                  Resuelve una evidencia para ver candidatos y datos normalizados.
                </p>
              ) : (
                <div className='verificationResolutionStack'>
                  <div className='verificationSummaryGrid'>
                    <div className='verificationSummaryItem'>
                      <span>Tipo de resolución</span>
                      <strong>{resolution.resolutionType}</strong>
                    </div>
                    <div className='verificationSummaryItem'>
                      <span>Coincidencia por</span>
                      <strong>{formatMatchStrategy(resolution.matchedBy)}</strong>
                    </div>
                    <div className='verificationSummaryItem'>
                      <span>Candidatos</span>
                      <strong>{resolution.candidateCount}</strong>
                    </div>
                  </div>

                  <div className='verificationNormalizedInputCard'>
                    <h3>Entrada normalizada</h3>
                    <div className='verificationKeyValueGrid'>
                      <div>
                        <span>Modo</span>
                        <strong>{formatModeLabel(resolution.normalizedInput.mode)}</strong>
                      </div>
                      <div>
                        <span>GTIN</span>
                        <strong>{resolution.normalizedInput.gtin || 'N/D'}</strong>
                      </div>
                      <div>
                        <span>Lote</span>
                        <strong>{resolution.normalizedInput.lot || 'N/D'}</strong>
                      </div>
                      <div>
                        <span>Fecha de fabricación</span>
                        <strong>{formatGs1ManufactureDate(resolution.normalizedInput.manufactureDate)}</strong>
                      </div>
                      {resolution.normalizedInput.rawReference && (
                        <div className='verificationKeyValueFull'>
                          <span>Referencia manual</span>
                          <strong>{resolution.normalizedInput.rawReference}</strong>
                        </div>
                      )}
                      {resolution.normalizedInput.rawScan && (
                        <div className='verificationKeyValueFull'>
                          <span>Escaneo original</span>
                          <strong>{resolution.normalizedInput.rawScan}</strong>
                        </div>
                      )}
                      {resolution.normalizedInput.firstBarcodeRaw && (
                        <div className='verificationKeyValueFull'>
                          <span>Primer código original</span>
                          <strong>{resolution.normalizedInput.firstBarcodeRaw}</strong>
                        </div>
                      )}
                      {resolution.normalizedInput.secondBarcodeRaw && (
                        <div className='verificationKeyValueFull'>
                          <span>Segundo código original</span>
                          <strong>{resolution.normalizedInput.secondBarcodeRaw}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className='verificationTableWrapper'>
                    <table className='verificationTable'>
                      <thead>
                        <tr>
                          <th>Selección</th>
                          <th>Folio</th>
                          <th>Modo</th>
                          <th>Parte</th>
                          <th>GTIN</th>
                          <th>Lote</th>
                          <th>Fecha</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resolution.candidateCount === 0 ? (
                          <tr>
                            <td colSpan={8} className='verificationTableEmpty'>
                              No se encontraron candidatos con la evidencia capturada.
                            </td>
                          </tr>
                        ) : (
                          resolution.candidates.map((candidate) => (
                            <tr
                              key={candidate._id}
                              className={
                                selectedProgrammingRecordId === candidate._id
                                  ? 'verificationTableRowSelected'
                                  : ''
                              }
                            >
                              <td>
                                <button
                                  className='buttonSelector verificationTableSelectButton'
                                  type='button'
                                  onClick={() => setSelectedProgrammingRecordId(candidate._id)}
                                  disabled={isResolving || isVerifying}
                                >
                                  {selectedProgrammingRecordId === candidate._id ? 'Elegido' : 'Elegir'}
                                </button>
                              </td>
                              <td>{candidate.serviceOrderFolio || 'N/D'}</td>
                              <td>{formatModeLabel(candidate.mode)}</td>
                              <td>{candidate.partNumber}</td>
                              <td>{candidate.gtin || 'N/D'}</td>
                              <td>{candidate.lot || 'N/D'}</td>
                              <td>{formatGs1ManufactureDate(candidate.manufactureDate)}</td>
                              <td>
                                <span
                                  className={`verificationStatusBadge ${candidate.status === 'verified' ? 'verified' : 'programmed'}`}
                                >
                                  {formatStatusLabel(candidate.status)}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </article>

            <article className='verificationPanelCard'>
              <div className='verificationPanelHeader'>
                <div>
                  <h2>Confirmación</h2>
                  <p>Se verifica contra el candidato seleccionado usando la misma evidencia enviada al resolver.</p>
                </div>
              </div>

              {!selectedProgrammingRecord ? (
                <p className='verificationEmptyState'>
                  Selecciona un candidato para revisar sus datos y confirmar la verificación.
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
                        <span>Fecha de fabricación</span>
                        <strong>{formatGs1ManufactureDate(selectedProgrammingRecord.manufactureDate)}</strong>
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
                        <strong>
                          {selectedProgrammingRecord.rawSourceData.rawReference ||
                            selectedProgrammingRecord.rawSourceData.rawScan ||
                            [
                              selectedProgrammingRecord.rawSourceData.firstBarcodeRaw,
                              selectedProgrammingRecord.rawSourceData.secondBarcodeRaw,
                            ]
                              .filter(Boolean)
                              .join(' | ') ||
                            'N/D'}
                        </strong>
                      </div>
                      {selectedProgrammingRecord.verificationData && (
                        <div className='verificationKeyValueFull'>
                          <span>Información de verificación</span>
                          <strong>
                            {selectedProgrammingRecord.verificationData.rawReference ||
                              selectedProgrammingRecord.verificationData.rawScan ||
                              [
                                selectedProgrammingRecord.verificationData.firstBarcodeRaw,
                                selectedProgrammingRecord.verificationData.secondBarcodeRaw,
                              ]
                                .filter(Boolean)
                                .join(' | ') ||
                              'N/D'}
                          </strong>
                        </div>
                      )}
                      <div>
                        <span>Verified at</span>
                        <strong>{formatDateTime(selectedProgrammingRecord.verifiedAt)}</strong>
                      </div>
                    </div>
                  </div>

                  {selectedProgrammingRecord.serviceOrderId && (
                    <div className='verificationSelectedRecordCard'>
                      <div className='verificationSelectedRecordHeader'>
                        <div>
                          <h3>Orden de servicio</h3>
                          <p>{selectedProgrammingRecord.serviceOrderFolio || 'Sin folio'}</p>
                        </div>
                        {relatedServiceOrder && (
                          <span
                            className={`verificationStatusBadge ${
                              relatedServiceOrder.status === 'closed' ? 'verified' : 'programmed'
                            }`}
                          >
                            {formatServiceOrderStatus(relatedServiceOrder.status)}
                          </span>
                        )}
                      </div>

                      {isLoadingRelatedServiceOrder ? (
                        <p className='verificationHint'>Consultando avance real de la orden...</p>
                      ) : relatedServiceOrder ? (
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
                            <span>Restantes por programar</span>
                            <strong>{getServiceOrderRemainingToProgram(relatedServiceOrder)}</strong>
                          </div>
                          <div>
                            <span>Restantes por verificar</span>
                            <strong>{getServiceOrderRemainingToVerify(relatedServiceOrder)}</strong>
                          </div>
                          <div>
                            <span>Actualizado el</span>
                            <strong>{formatDateTime(relatedServiceOrder.updatedAt)}</strong>
                          </div>
                        </div>
                      ) : relatedServiceOrderError ? (
                        <p className='verificationHint'>
                          {relatedServiceOrderError ?? 'No se pudo consultar la orden de servicio.'}
                        </p>
                      ) : null}
                    </div>
                  )}

                  <div className='verificationActionRow'>
                    <button
                      className='buttonSelector verificationActionButton'
                      type='button'
                      onClick={() => void handleVerify()}
                      disabled={
                        isResolving ||
                        isVerifying ||
                        !hasSelectedVerificationServiceOrder ||
                        selectedProgrammingRecord.status === 'verified'
                      }
                    >
                      {isVerifying ? 'Verificando...' : 'Confirmar verificacion'}
                    </button>
                  </div>

                  {selectedProgrammingRecord.status === 'verified' && (
                    <p className='verificationMessage success'>
                      El codigo escaneado ya fue verificado.
                    </p>
                  )}
                </div>
              )}
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
