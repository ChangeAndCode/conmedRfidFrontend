import '../../css/programmingDashboard.css';
import '../../index.css';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import AppSceneLayout from '../../components/appSceneLayout';
import { createDoubleScanRead, resolveFirstDoubleScan } from '../../services/doubleScanService';
import type {
  DoubleScanReadResponse,
  DoubleScanResolvedPartConfigOption,
} from '../../types/DoubleScan';
import type { PartConfig, PartConfigListResponse, ReadingMode } from '../../types/PartConfig';

type Mode = 'Manual' | 'Scan' | 'DoubleScan' | null;
type FeedbackMessage = { type: 'success' | 'error' | 'info'; text: string };
type DoubleScanStep =
  | 'waiting_first'
  | 'resolving_first'
  | 'selecting_part_config'
  | 'waiting_second'
  | 'submitting'
  | 'success'
  | 'error';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function ProgrammingDashboardPage() {
  const navigate = useNavigate();
  const [port, setPort] = useState('');
  const [mode, setMode] = useState<Mode>(null);

  const [manualPartConfigs, setManualPartConfigs] = useState<PartConfig[]>([]);
  const [isLoadingManualConfigs, setIsLoadingManualConfigs] = useState(false);
  const [manualConfigMessage, setManualConfigMessage] = useState<FeedbackMessage | null>(null);
  const [partNumber, setPartNumber] = useState('');
  const [lot, setLot] = useState('');
  const [manufactureDate, setManufactureDate] = useState('');
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [manualMessage, setManualMessage] = useState<FeedbackMessage | null>(null);

  const [firstBarcodeRaw, setFirstBarcodeRaw] = useState('');
  const [resolvedGtin, setResolvedGtin] = useState('');
  const [doubleScanOptions, setDoubleScanOptions] = useState<DoubleScanResolvedPartConfigOption[]>(
    [],
  );
  const [selectedPartConfigId, setSelectedPartConfigId] = useState('');
  const [secondBarcodeRaw, setSecondBarcodeRaw] = useState('');
  const [serviceOrder, setServiceOrder] = useState('');
  const [doubleScanNotes, setDoubleScanNotes] = useState('');
  const [doubleScanStep, setDoubleScanStep] = useState<DoubleScanStep>('waiting_first');
  const [doubleScanMessage, setDoubleScanMessage] = useState<FeedbackMessage | null>(null);
  const [doubleScanResult, setDoubleScanResult] = useState<DoubleScanReadResponse | null>(null);

  const firstBarcodeInputRef = useRef<HTMLInputElement>(null);
  const partConfigSelectRef = useRef<HTMLSelectElement>(null);
  const secondBarcodeInputRef = useRef<HTMLInputElement>(null);
  const successResetTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const selectedManualConfig = manualPartConfigs.find((config) => config.partNumber === partNumber);
  const selectedDoubleScanConfig = doubleScanOptions.find((option) => option.id === selectedPartConfigId);
  const hasMultipleDoubleScanOptions = doubleScanOptions.length > 1;

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

    if (doubleScanStep === 'selecting_part_config') {
      partConfigSelectRef.current?.focus();
      return;
    }

    if (doubleScanStep === 'waiting_second') {
      secondBarcodeInputRef.current?.focus();
    }
  }, [doubleScanStep, mode]);

  useEffect(() => {
    return () => {
      if (successResetTimeoutRef.current) {
        window.clearTimeout(successResetTimeoutRef.current);
      }
    };
  }, []);

  const fetchPartConfigs = async (
    readingMode: Extract<ReadingMode, 'manual' | 'double_scan'>,
  ): Promise<PartConfig[]> => {
    const response = await fetch(
      `${API_URL}/api/part-configs?readingMode=${readingMode}&isActive=true`,
    );
    const result = (await response.json().catch(() => null)) as PartConfigListResponse | null;

    if (!response.ok) {
      throw new Error(
        readingMode === 'manual'
          ? 'No se pudo cargar el catalogo de lectura manual.'
          : 'No se pudo cargar el catalogo de doble lectura.',
      );
    }

    return result?.data ?? [];
  };

  const resetManualForm = () => {
    setPartNumber('');
    setLot('');
    setManufactureDate('');
    setManualMessage(null);
  };

  const clearSuccessResetTimeout = () => {
    if (successResetTimeoutRef.current) {
      window.clearTimeout(successResetTimeoutRef.current);
      successResetTimeoutRef.current = null;
    }
  };

  const resetDoubleScanCycle = (nextMessage: FeedbackMessage | null = null) => {
    setFirstBarcodeRaw('');
    setResolvedGtin('');
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
    setServiceOrder('');
    setDoubleScanNotes('');
  };

  const loadManualPartConfigs = async () => {
    setIsLoadingManualConfigs(true);
    setManualConfigMessage(null);

    try {
      const configs = await fetchPartConfigs('manual');
      setManualPartConfigs(configs);
    } catch (error) {
      setManualConfigMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudo cargar el catalogo de lectura manual.',
      });
      setManualPartConfigs([]);
    } finally {
      setIsLoadingManualConfigs(false);
    }
  };

  const openManualModal = () => {
    resetManualForm();
    setMode('Manual');
    void loadManualPartConfigs();
  };

  const closeManualModal = () => {
    if (isSubmittingManual) {
      return;
    }

    resetManualForm();
    setMode(null);
  };

  const openDoubleScanModal = () => {
    resetDoubleScanFlow();
    setMode('DoubleScan');
  };

  const closeDoubleScanModal = () => {
    if (doubleScanStep === 'resolving_first' || doubleScanStep === 'submitting') {
      return;
    }

    resetDoubleScanFlow();
    setMode(null);
  };

  const handleManualSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedLot = lot.trim();

    if (!partNumber || !trimmedLot || !manufactureDate) {
      setManualMessage({
        type: 'error',
        text: 'Completa numero de parte, lote y fecha de manufactura.',
      });
      return;
    }

    setIsSubmittingManual(true);
    setManualMessage(null);

    try {
      const payload = {
        partNumber,
        lot: trimmedLot,
        manufactureDate,
        rfidProgram: selectedManualConfig?.rfidProgram,
        gtin: selectedManualConfig?.expectedGtin,
        filterLabel: selectedManualConfig?.filterLabel,
        rawReference: 'manual',
        notes: 'captura manual',
      };

      const response = await fetch(`${API_URL}/api/manual-reads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.message ?? 'Error al guardar la lectura manual.');
      }

      resetManualForm();
      setManualMessage({
        type: 'success',
        text: result?.message ?? 'Lectura manual registrada.',
      });
    } catch (error) {
      setManualMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo conectar con el backend.',
      });
    } finally {
      setIsSubmittingManual(false);
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
    setDoubleScanOptions([]);
    setSelectedPartConfigId('');
    setSecondBarcodeRaw('');

    try {
      const result = await resolveFirstDoubleScan(trimmedFirstBarcode);
      setFirstBarcodeRaw(result.firstBarcodeRaw);
      setResolvedGtin(result.gtin);
      setDoubleScanOptions(result.options);

      if (result.options.length === 0) {
        setDoubleScanStep('waiting_first');
        setDoubleScanMessage({
          type: 'error',
          text: 'No hay configuraciones activas para el GTIN detectado.',
        });
        return;
      }

      if (result.autoSelectedPartConfigId) {
        setSelectedPartConfigId(result.autoSelectedPartConfigId);
        setDoubleScanStep('waiting_second');
        setDoubleScanMessage({
          type: 'success',
          text: 'GTIN resuelto. Configuracion seleccionada automaticamente. Escanea el segundo codigo.',
        });
        return;
      }

      setDoubleScanStep('selecting_part_config');
      setDoubleScanMessage({
        type: 'info',
        text: 'Se encontraron varias configuraciones para el GTIN. Selecciona el numero de parte correcto.',
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
    const trimmedServiceOrder = serviceOrder.trim();
    const trimmedNotes = doubleScanNotes.trim();

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

    setDoubleScanStep('submitting');
    setDoubleScanMessage(null);
    setDoubleScanResult(null);

    try {
      const result = await createDoubleScanRead({
        partConfigId: selectedPartConfigId,
        firstBarcodeRaw: trimmedFirstBarcode,
        secondBarcodeRaw: trimmedSecondBarcode,
        serviceOrder: trimmedServiceOrder || undefined,
        notes: trimmedNotes || undefined,
      });

      clearSuccessResetTimeout();
      setDoubleScanResult(result.data ?? null);
      setDoubleScanStep('success');
      setDoubleScanMessage({
        type: 'success',
        text:
          result.message ??
          'Lectura doble registrada. El formulario se preparara automaticamente para la siguiente pieza.',
      });

      successResetTimeoutRef.current = window.setTimeout(() => {
        resetDoubleScanCycle({
          type: 'info',
          text: 'Listo para la siguiente lectura.',
        });
      }, 2200);
    } catch (error) {
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
    doubleScanStep === 'resolving_first' || doubleScanStep === 'submitting';

  return (
    <>
      <AppSceneLayout>
        <section className='square programmingDashboardShell'>
          <div className='generalBlock programmingDashboardCard'>
            <h1>ESTACION DE PROGRAMACION</h1>
            <div className='statusUser'>
              <h2>serial port: {port || 'sin seleccionar'}</h2>
              <h2>status: {port ? 'listo para escanear' : 'selecciona un serial port'}</h2>
              <h2>fecha/hora: pendiente</h2>
            </div>
            <div>
              <h2>Serial Port</h2>
              <select aria-label='SerialPort' value={port} onChange={(event) => setPort(event.target.value)}>
                <option value=''>Selecciona</option>
                <option value='port1'>COM 3</option>
                <option value='port2'>COM 5</option>
              </select>
            </div>
            <div className='buttonBox'>
              <button className='buttonSelector' onClick={openManualModal} disabled={!port}>
                Ingreso Manual
              </button>
              <button className='buttonSelector' onClick={() => setMode('Scan')} disabled={!port}>
                Escaner Codigo
              </button>
              <button className='buttonSelector' onClick={openDoubleScanModal} disabled={!port}>
                Doble Codigo
              </button>
            </div>
            <button className='buttonSelector' type='button' onClick={() => navigate('/', { replace: true })}>
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
              <button className='buttonSelector' onClick={closeManualModal} disabled={isSubmittingManual}>
                Cerrar
              </button>
            </div>

            <form className='modalForm' onSubmit={handleManualSubmit}>
              <label className='modalField'>
                <span>Numero de Parte:</span>
                <select
                  aria-label='partNumber'
                  value={partNumber}
                  onChange={(event) => setPartNumber(event.target.value)}
                  disabled={isLoadingManualConfigs || isSubmittingManual}
                  required
                >
                  <option value=''>Selecciona</option>
                  {manualPartConfigs.map((config) => (
                    <option key={config._id} value={config.partNumber}>
                      {config.partNumber}
                    </option>
                  ))}
                </select>
              </label>

              {isLoadingManualConfigs && <p className='manualHint'>Cargando numeros de parte...</p>}

              {manualConfigMessage && (
                <p className={`manualMessage ${manualConfigMessage.type}`}>{manualConfigMessage.text}</p>
              )}

              {!isLoadingManualConfigs && !manualConfigMessage && manualPartConfigs.length === 0 && (
                <p className='manualHint'>No hay numeros de parte manuales activos.</p>
              )}

              <label className='modalField'>
                <span>Numero de Lote:</span>
                <input
                  type='text'
                  value={lot}
                  onChange={(event) => setLot(event.target.value)}
                  placeholder='QWE123ASD12'
                  disabled={isSubmittingManual}
                  required
                />
              </label>

              <label className='modalField'>
                <span>Fecha de Manufactura:</span>
                <input
                  type='date'
                  value={manufactureDate}
                  onChange={(event) => setManufactureDate(event.target.value)}
                  disabled={isSubmittingManual}
                  required
                />
              </label>

              {selectedManualConfig && (
                <div className='scanSummaryBlock'>
                  {selectedManualConfig.rfidProgram && (
                    <p>Programa RFID: {selectedManualConfig.rfidProgram}</p>
                  )}
                  {selectedManualConfig.expectedGtin && (
                    <p>GTIN esperado: {selectedManualConfig.expectedGtin}</p>
                  )}
                  {selectedManualConfig.filterLabel && (
                    <p>Filter label: {selectedManualConfig.filterLabel}</p>
                  )}
                  {selectedManualConfig.notes && <p>{selectedManualConfig.notes}</p>}
                </div>
              )}

              {manualMessage && <p className={`manualMessage ${manualMessage.type}`}>{manualMessage.text}</p>}

              <button className='buttonSelector modalSubmitButton' type='submit' disabled={isSubmittingManual}>
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
                    doubleScanStep === 'selecting_part_config' ||
                    doubleScanStep === 'waiting_second' ||
                    doubleScanStep === 'submitting'
                  }
                  autoComplete='off'
                />
              </label>

              <div className='modalActionRow'>
                <button
                  className='buttonSelector'
                  type='button'
                  onClick={() => void handleResolveFirstBarcode()}
                  disabled={
                    isResolvingOrSubmitting ||
                    !firstBarcodeRaw.trim() ||
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

              {hasMultipleDoubleScanOptions && (
                <label className='modalField'>
                  <span>Numero de Parte:</span>
                  <select
                    ref={partConfigSelectRef}
                    aria-label='partConfigId'
                    value={selectedPartConfigId}
                    onChange={(event) => handlePartConfigSelection(event.target.value)}
                    disabled={isResolvingOrSubmitting}
                    required
                  >
                    <option value=''>Selecciona una opcion</option>
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
                <span>Service Order:</span>
                <input
                  type='text'
                  value={serviceOrder}
                  onChange={(event) => setServiceOrder(event.target.value)}
                  placeholder='SO-001'
                  disabled={isResolvingOrSubmitting}
                  autoComplete='off'
                />
              </label>

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
                  disabled={!selectedPartConfigId || isResolvingOrSubmitting}
                  autoComplete='off'
                />
              </label>

              <p className='manualHint'>
                {doubleScanStep === 'resolving_first'
                  ? 'Resolviendo el GTIN del primer codigo...'
                  : doubleScanStep === 'selecting_part_config'
                    ? 'Selecciona la configuracion correcta para continuar.'
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
                  className='buttonSelector'
                  type='button'
                  onClick={resetDoubleScanFlow}
                  disabled={isResolvingOrSubmitting}
                >
                  Limpiar
                </button>
                <button
                  className='buttonSelector modalSubmitButton'
                  type='submit'
                  disabled={isResolvingOrSubmitting || !selectedPartConfigId || !secondBarcodeRaw.trim()}
                >
                  {doubleScanStep === 'submitting' ? 'Guardando...' : 'Registrar lectura'}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {mode === 'Scan' && (
        <section>
          {/* pendiente: flujo de escaneo simple */}
        </section>
      )}
    </>
  );
}

export default ProgrammingDashboardPage;
