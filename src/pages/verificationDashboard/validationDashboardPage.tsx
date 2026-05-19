import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppSceneLayout from '../../components/appSceneLayout';
import { useAuth } from '../../context/useAuth';
import '../../css/verificationDashboard.css';
import { getServiceOrderById } from '../../services/serviceOrderService';
import {
  resolveProgrammingRecord,
  verifyProgrammingRecord,
} from '../../services/programmingRecordService';
import type {
  ProgrammingRecord,
  ProgrammingRecordMatchStrategy,
  ProgrammingRecordMode,
  ResolveProgrammingRecordPayload,
  ResolveProgrammingRecordResult,
  VerifyProgrammingRecordPayload,
} from '../../types/ProgrammingRecord';
import type { ServiceOrder } from '../../types/ServiceOrder';

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
      return 'Single Scan';
    case 'double_scan':
      return 'Doble codigo';
    default:
      return mode;
  }
};

const formatStatusLabel = (status: ProgrammingRecord['status']) => {
  switch (status) {
    case 'captured':
      return 'Captured';
    case 'programmed':
      return 'Programmed';
    case 'verified':
      return 'Verified';
    default:
      return status;
  }
};

const formatMatchStrategy = (strategy?: ProgrammingRecordMatchStrategy) => {
  switch (strategy) {
    case 'manual_raw_reference':
      return 'Referencia manual exacta';
    case 'single_scan_raw':
      return 'Single scan exacto';
    case 'double_scan_raw':
      return 'Doble codigo exacto';
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
      return 'Open';
    case 'blocked':
      return 'Blocked';
    case 'closed':
      return 'Closed';
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

function ValidationDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
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

  const selectedProgrammingRecord =
    resolution?.candidates.find((candidate) => candidate._id === selectedProgrammingRecordId) ?? null;

  const loadRelatedServiceOrder = async (serviceOrderId: string) => {
    setIsLoadingRelatedServiceOrder(true);
    setRelatedServiceOrderError(null);

    try {
      const nextServiceOrder = await getServiceOrderById(serviceOrderId);
      setRelatedServiceOrder(nextServiceOrder);
    } catch (error) {
      setRelatedServiceOrder(null);
      setRelatedServiceOrderError(
        error instanceof Error
          ? error.message
          : 'No se pudo consultar el estado de la orden de servicio.',
      );
    } finally {
      setIsLoadingRelatedServiceOrder(false);
    }
  };

  const resetResolutionState = () => {
    setResolution(null);
    setSelectedProgrammingRecordId(null);
    setRelatedServiceOrder(null);
    setRelatedServiceOrderError(null);
  };

  const resetFormForMode = (nextMode: ProgrammingRecordMode) => {
    setMode(nextMode);
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
    const serviceOrderId = selectedProgrammingRecord?.serviceOrderId;

    if (!serviceOrderId) {
      setRelatedServiceOrder(null);
      setRelatedServiceOrderError(null);
      setIsLoadingRelatedServiceOrder(false);
      return;
    }

    void loadRelatedServiceOrder(serviceOrderId);
  }, [selectedProgrammingRecord?.serviceOrderId]);

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
      return 'Captura la referencia manual para resolver la programacion.';
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
        type: 'info',
        text: 'El programming record seleccionado ya esta verificado.',
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

      setResolution((currentResolution) => {
        if (!currentResolution) {
          return currentResolution;
        }

        return {
          ...currentResolution,
          candidates: currentResolution.candidates.map((candidate) =>
            candidate._id === result.data._id ? result.data : candidate,
          ),
        };
      });

      setSelectedProgrammingRecordId(result.data._id);

      if (result.data.serviceOrderId) {
        await loadRelatedServiceOrder(result.data.serviceOrderId);
      }

      setMessage({
        type: 'success',
        text: result.message,
      });
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

  return (
    <AppSceneLayout>
      <section className='square verificationDashboardShell'>
        <div className='verificationDashboardCard'>
          <header className='verificationHeroCard'>
            <div className='verificationHeroCopy'>
              <p className='verificationEyebrow'>Estacion de verificacion</p>
              <h1>Validacion de programming records</h1>
              <p>
                Resuelve la evidencia capturada, elige el candidato correcto si hay mas de uno y
                confirma la verificacion contra el backend.
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

          <div className='verificationMainGrid'>
            <article className='verificationPanelCard'>
              <div className='verificationPanelHeader'>
                <div>
                  <h2>Evidencia</h2>
                  <p>Elige el modo y captura exactamente la misma evidencia usada en programacion.</p>
                </div>
              </div>

              <div className='verificationModeSelector' role='tablist' aria-label='Modo de verificacion'>
                {(['manual', 'single_scan', 'double_scan'] as ProgrammingRecordMode[]).map((modeOption) => (
                  <button
                    key={modeOption}
                    className={`verificationModeButton ${mode === modeOption ? 'active' : ''}`}
                    type='button'
                    onClick={() => resetFormForMode(modeOption)}
                  >
                    {formatModeLabel(modeOption)}
                  </button>
                ))}
              </div>

              <div className='verificationFormGrid'>
                {mode === 'manual' && (
                  <label className='verificationField verificationFieldFull'>
                    <span>Raw reference</span>
                    <input
                      type='text'
                      value={formValues.rawReference}
                      onChange={(event) =>
                        setFormValues((currentValues) => ({
                          ...currentValues,
                          rawReference: event.target.value,
                        }))
                      }
                      placeholder='500322 A'
                      disabled={isResolving || isVerifying}
                    />
                  </label>
                )}

                {mode === 'single_scan' && (
                  <label className='verificationField verificationFieldFull'>
                    <span>Raw scan</span>
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
                      <span>First barcode raw</span>
                      <input
                        type='text'
                        value={formValues.firstBarcodeRaw}
                        onChange={(event) =>
                          setFormValues((currentValues) => ({
                            ...currentValues,
                            firstBarcodeRaw: event.target.value,
                          }))
                        }
                        placeholder='0100851136001566'
                        disabled={isResolving || isVerifying}
                      />
                    </label>

                    <label className='verificationField'>
                      <span>Second barcode raw</span>
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

                <label className='verificationField'>
                  <span>Verified by</span>
                  <input
                    type='text'
                    value={formValues.verifiedBy}
                    onChange={(event) =>
                      setFormValues((currentValues) => ({
                        ...currentValues,
                        verifiedBy: event.target.value,
                      }))
                    }
                    placeholder='estacion-verificacion'
                    disabled={isResolving || isVerifying}
                  />
                </label>

                <label className='verificationField verificationFieldFull'>
                  <span>Verification notes</span>
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
                  disabled={isResolving || isVerifying}
                >
                  {isResolving ? 'Resolviendo...' : 'Resolver programacion'}
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
                  <h2>Resolucion</h2>
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
                      <span>Resolution type</span>
                      <strong>{resolution.resolutionType}</strong>
                    </div>
                    <div className='verificationSummaryItem'>
                      <span>Matched by</span>
                      <strong>{formatMatchStrategy(resolution.matchedBy)}</strong>
                    </div>
                    <div className='verificationSummaryItem'>
                      <span>Candidates</span>
                      <strong>{resolution.candidateCount}</strong>
                    </div>
                  </div>

                  <div className='verificationNormalizedInputCard'>
                    <h3>Normalized input</h3>
                    <div className='verificationKeyValueGrid'>
                      <div>
                        <span>Mode</span>
                        <strong>{formatModeLabel(resolution.normalizedInput.mode)}</strong>
                      </div>
                      <div>
                        <span>GTIN</span>
                        <strong>{resolution.normalizedInput.gtin || 'N/D'}</strong>
                      </div>
                      <div>
                        <span>Lot</span>
                        <strong>{resolution.normalizedInput.lot || 'N/D'}</strong>
                      </div>
                      <div>
                        <span>Manufacture date</span>
                        <strong>{formatGs1ManufactureDate(resolution.normalizedInput.manufactureDate)}</strong>
                      </div>
                      {resolution.normalizedInput.rawReference && (
                        <div className='verificationKeyValueFull'>
                          <span>Raw reference</span>
                          <strong>{resolution.normalizedInput.rawReference}</strong>
                        </div>
                      )}
                      {resolution.normalizedInput.rawScan && (
                        <div className='verificationKeyValueFull'>
                          <span>Raw scan</span>
                          <strong>{resolution.normalizedInput.rawScan}</strong>
                        </div>
                      )}
                      {resolution.normalizedInput.firstBarcodeRaw && (
                        <div className='verificationKeyValueFull'>
                          <span>First barcode raw</span>
                          <strong>{resolution.normalizedInput.firstBarcodeRaw}</strong>
                        </div>
                      )}
                      {resolution.normalizedInput.secondBarcodeRaw && (
                        <div className='verificationKeyValueFull'>
                          <span>Second barcode raw</span>
                          <strong>{resolution.normalizedInput.secondBarcodeRaw}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className='verificationTableWrapper'>
                    <table className='verificationTable'>
                      <thead>
                        <tr>
                          <th>Seleccion</th>
                          <th>Folio</th>
                          <th>Modo</th>
                          <th>Parte</th>
                          <th>GTIN</th>
                          <th>Lote</th>
                          <th>Fecha</th>
                          <th>Status</th>
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
                  <h2>Confirmacion</h2>
                  <p>Se verifica contra el candidato seleccionado usando la misma evidencia enviada al resolver.</p>
                </div>
              </div>

              {!selectedProgrammingRecord ? (
                <p className='verificationEmptyState'>
                  Selecciona un candidato para revisar sus datos y confirmar la verificacion.
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
                        <span>Lot</span>
                        <strong>{selectedProgrammingRecord.lot || 'N/D'}</strong>
                      </div>
                      <div>
                        <span>Manufacture date</span>
                        <strong>{formatGs1ManufactureDate(selectedProgrammingRecord.manufactureDate)}</strong>
                      </div>
                      <div>
                        <span>RFID Program</span>
                        <strong>{selectedProgrammingRecord.rfidProgram || 'N/D'}</strong>
                      </div>
                      <div>
                        <span>Filter label</span>
                        <strong>{selectedProgrammingRecord.filterLabel || 'N/D'}</strong>
                      </div>
                      <div>
                        <span>Created at</span>
                        <strong>{formatDateTime(selectedProgrammingRecord.createdAt)}</strong>
                      </div>
                      <div className='verificationKeyValueFull'>
                        <span>Raw source data</span>
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
                          <span>Verification data</span>
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
                        <span>Verified by</span>
                        <strong>{selectedProgrammingRecord.verifiedBy || 'N/D'}</strong>
                      </div>
                      <div>
                        <span>Verified at</span>
                        <strong>{formatDateTime(selectedProgrammingRecord.verifiedAt)}</strong>
                      </div>
                    </div>
                  </div>

                  {(selectedProgrammingRecord.serviceOrderId || relatedServiceOrderError) && (
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
                            <span>Quantity</span>
                            <strong>{relatedServiceOrder.quantity}</strong>
                          </div>
                          <div>
                            <span>Programmed</span>
                            <strong>{getServiceOrderProgrammedCount(relatedServiceOrder)}</strong>
                          </div>
                          <div>
                            <span>Verified</span>
                            <strong>{getServiceOrderVerifiedCount(relatedServiceOrder)}</strong>
                          </div>
                          <div>
                            <span>Remaining to program</span>
                            <strong>{getServiceOrderRemainingToProgram(relatedServiceOrder)}</strong>
                          </div>
                          <div>
                            <span>Remaining to verify</span>
                            <strong>{getServiceOrderRemainingToVerify(relatedServiceOrder)}</strong>
                          </div>
                          <div>
                            <span>Updated at</span>
                            <strong>{formatDateTime(relatedServiceOrder.updatedAt)}</strong>
                          </div>
                        </div>
                      ) : (
                        <p className='verificationHint'>
                          {relatedServiceOrderError ?? 'No se pudo consultar la orden de servicio.'}
                        </p>
                      )}
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
                        selectedProgrammingRecord.status === 'verified'
                      }
                    >
                      {isVerifying ? 'Verificando...' : 'Confirmar verificacion'}
                    </button>
                  </div>

                  {selectedProgrammingRecord.status === 'verified' && (
                    <p className='verificationHint'>
                      Este programming record ya fue verificado. Si la evidencia no coincide, el backend respondera `409`.
                    </p>
                  )}
                </div>
              )}
            </article>
          </div>
        </div>
      </section>
    </AppSceneLayout>
  );
}

export default ValidationDashboardPage;
