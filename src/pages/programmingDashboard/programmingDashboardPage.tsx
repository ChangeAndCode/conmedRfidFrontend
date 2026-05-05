import '../../css/programmingDashboard.css';
import '../../index.css';
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';

type Mode = 'Manual' | 'Scan' | 'DoubleScan' | null;
type ReadingMode = 'manual' | 'single_scan' | 'double_scan';
type FeedbackMessage = { type: 'success' | 'error'; text: string };
type DoubleScanStep = 'waiting_first' | 'waiting_second' | 'submitting' | 'success' | 'error';

type PartConfig = {
  _id: string;
  partNumber: string;
  readingMode: ReadingMode;
  description?: string;
  rfidProgram?: string;
  expectedGtin?: string;
  filterLabel?: string;
  expectedLotLength?: number;
  lotTrimRight?: number;
  isActive: boolean;
  notes?: string;
};

type PartConfigResponse = {
  count: number;
  data: PartConfig[];
};

type DoubleScanReadResponse = {
  _id: string;
  partNumber: string;
  rfidProgram: string;
  gtin: string;
  lot: string;
  manufactureDate: string;
  filterLabel?: string;
  rulesApplied?: string[];
};

type DoubleScanCreateResponse = {
  message: string;
  data?: DoubleScanReadResponse;
};

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const DEFAULT_CREATED_BY = 'frontend-local';

function programmingDashboardPage() {
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

  const [doubleScanConfigs, setDoubleScanConfigs] = useState<PartConfig[]>([]);
  const [isLoadingDoubleScanConfigs, setIsLoadingDoubleScanConfigs] = useState(false);
  const [doubleScanConfigMessage, setDoubleScanConfigMessage] = useState<FeedbackMessage | null>(null);
  const [doubleScanPartNumber, setDoubleScanPartNumber] = useState('');
  const [firstBarcodeRaw, setFirstBarcodeRaw] = useState('');
  const [secondBarcodeRaw, setSecondBarcodeRaw] = useState('');
  const [doubleScanStep, setDoubleScanStep] = useState<DoubleScanStep>('waiting_first');
  const [doubleScanMessage, setDoubleScanMessage] = useState<FeedbackMessage | null>(null);
  const [doubleScanResult, setDoubleScanResult] = useState<DoubleScanReadResponse | null>(null);

  const doubleScanPartSelectRef = useRef<HTMLSelectElement>(null);
  const firstBarcodeInputRef = useRef<HTMLInputElement>(null);
  const secondBarcodeInputRef = useRef<HTMLInputElement>(null);

  const selectedManualConfig = manualPartConfigs.find((config) => config.partNumber === partNumber);
  const selectedDoubleScanConfig = doubleScanConfigs.find(
    (config) => config.partNumber === doubleScanPartNumber,
  );

  useEffect(() => {
    if (mode !== 'DoubleScan' || isLoadingDoubleScanConfigs) {
      return;
    }

    if (!doubleScanPartNumber) {
      doubleScanPartSelectRef.current?.focus();
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

    if (doubleScanStep === 'waiting_second') {
      secondBarcodeInputRef.current?.focus();
    }
  }, [doubleScanPartNumber, doubleScanStep, isLoadingDoubleScanConfigs, mode]);

  const fetchPartConfigs = async (
    readingMode: Extract<ReadingMode, 'manual' | 'double_scan'>,
  ): Promise<PartConfig[]> => {
    const response = await fetch(
      `${API_URL}/api/part-configs?readingMode=${readingMode}&isActive=true`,
    );
    const result = (await response.json().catch(() => null)) as PartConfigResponse | null;

    if (!response.ok) {
      throw new Error(
        readingMode === 'manual'
          ? 'No se pudo cargar el catálogo de lectura manual.'
          : 'No se pudo cargar el catálogo de doble lectura.',
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

  const clearDoubleScanFields = () => {
    setFirstBarcodeRaw('');
    setSecondBarcodeRaw('');
    setDoubleScanStep('waiting_first');
    setDoubleScanMessage(null);
    setDoubleScanResult(null);
  };

  const resetDoubleScanForm = () => {
    setDoubleScanPartNumber('');
    setDoubleScanConfigMessage(null);
    clearDoubleScanFields();
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
            : 'No se pudo cargar el catálogo de lectura manual.',
      });
      setManualPartConfigs([]);
    } finally {
      setIsLoadingManualConfigs(false);
    }
  };

  const loadDoubleScanConfigs = async () => {
    setIsLoadingDoubleScanConfigs(true);
    setDoubleScanConfigMessage(null);

    try {
      const configs = await fetchPartConfigs('double_scan');
      setDoubleScanConfigs(configs);
    } catch (error) {
      setDoubleScanConfigMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudo cargar el catálogo de doble lectura.',
      });
      setDoubleScanConfigs([]);
    } finally {
      setIsLoadingDoubleScanConfigs(false);
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
    resetDoubleScanForm();
    setMode('DoubleScan');
    void loadDoubleScanConfigs();
  };

  const closeDoubleScanModal = () => {
    if (doubleScanStep === 'submitting') {
      return;
    }

    resetDoubleScanForm();
    setMode(null);
  };

  const handleManualSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedLot = lot.trim();

    if (!partNumber || !trimmedLot || !manufactureDate) {
      setManualMessage({
        type: 'error',
        text: 'Completa número de parte, lote y fecha de manufactura.',
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
        createdBy: DEFAULT_CREATED_BY,
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

  const handleDoubleScanPartChange = (nextPartNumber: string) => {
    setDoubleScanPartNumber(nextPartNumber);
    clearDoubleScanFields();
  };

  const handleFirstBarcodeEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();

    if (!firstBarcodeRaw.trim()) {
      return;
    }

    setDoubleScanMessage(null);
    setDoubleScanResult(null);
    setDoubleScanStep('waiting_second');
  };

  const submitDoubleScan = async () => {
    const trimmedFirstBarcode = firstBarcodeRaw.trim();
    const trimmedSecondBarcode = secondBarcodeRaw.trim();

    if (!doubleScanPartNumber) {
      setDoubleScanMessage({
        type: 'error',
        text: 'Selecciona un número de parte antes de escanear.',
      });
      return;
    }

    if (!trimmedFirstBarcode || !trimmedSecondBarcode) {
      setDoubleScanMessage({
        type: 'error',
        text: 'Escanea ambos códigos antes de registrar la lectura.',
      });
      return;
    }

    setDoubleScanStep('submitting');
    setDoubleScanMessage(null);
    setDoubleScanResult(null);

    try {
      const response = await fetch(`${API_URL}/api/double-scan-reads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partNumber: doubleScanPartNumber,
          firstBarcodeRaw: trimmedFirstBarcode,
          secondBarcodeRaw: trimmedSecondBarcode,
          createdBy: DEFAULT_CREATED_BY,
        }),
      });

      const result = (await response.json().catch(() => null)) as DoubleScanCreateResponse | null;

      if (!response.ok) {
        throw new Error(result?.message ?? 'No se pudo registrar la lectura doble.');
      }

      setFirstBarcodeRaw('');
      setSecondBarcodeRaw('');
      setDoubleScanResult(result?.data ?? null);
      setDoubleScanMessage({
        type: 'success',
        text: result?.message ?? 'Lectura doble registrada.',
      });
      setDoubleScanStep('success');
    } catch (error) {
      setDoubleScanStep('error');
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

  return (
    <>
      <section className='square'>
        <div className='generalBlock'>
          <h1>ESTACIÓN DE PROGRAMACIÓN</h1>
          <div className='statusUser'>
            <h2>usuario: {DEFAULT_CREATED_BY}</h2>
            <h2>status: listo</h2>
            <h2>fecha/hora: pendiente</h2>
          </div>
          <div>
            <h2>Serial Port</h2>
            <select aria-label='SerialPort' value={port} onChange={(p) => setPort(p.target.value)}>
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
              Escaner Código
            </button>
            <button className='buttonSelector' onClick={openDoubleScanModal}>
              Doble Código
            </button>
          </div>
          <button className='buttonSelector'>Cerrar Sesión</button>
        </div>
      </section>

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
                <span>Número de Parte:</span>
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

              {isLoadingManualConfigs && <p className='manualHint'>Cargando números de parte...</p>}

              {manualConfigMessage && (
                <p className={`manualMessage ${manualConfigMessage.type}`}>{manualConfigMessage.text}</p>
              )}

              {!isLoadingManualConfigs && !manualConfigMessage && manualPartConfigs.length === 0 && (
                <p className='manualHint'>No hay números de parte manuales activos.</p>
              )}

              <label className='modalField'>
                <span>Número de Lote:</span>
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

              {manualMessage && (
                <p className={`manualMessage ${manualMessage.type}`}>{manualMessage.text}</p>
              )}

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
              <h2>Ingreso con Doble Código</h2>
              <button
                className='buttonSelector'
                onClick={closeDoubleScanModal}
                disabled={doubleScanStep === 'submitting'}
              >
                Cerrar
              </button>
            </div>

            <form className='modalForm' onSubmit={handleDoubleScanSubmit}>
              <label className='modalField'>
                <span>Número de Parte:</span>
                <select
                  ref={doubleScanPartSelectRef}
                  aria-label='doubleScanPartNumber'
                  value={doubleScanPartNumber}
                  onChange={(event) => handleDoubleScanPartChange(event.target.value)}
                  disabled={isLoadingDoubleScanConfigs || doubleScanStep === 'submitting'}
                  required
                >
                  <option value=''>Selecciona</option>
                  {doubleScanConfigs.map((config) => (
                    <option key={config._id} value={config.partNumber}>
                      {config.partNumber}
                    </option>
                  ))}
                </select>
              </label>

              {isLoadingDoubleScanConfigs && <p className='manualHint'>Cargando números de parte...</p>}

              {doubleScanConfigMessage && (
                <p className={`manualMessage ${doubleScanConfigMessage.type}`}>
                  {doubleScanConfigMessage.text}
                </p>
              )}

              {!isLoadingDoubleScanConfigs &&
                !doubleScanConfigMessage &&
                doubleScanConfigs.length === 0 && (
                  <p className='manualHint'>No hay números de parte de doble lectura activos.</p>
                )}

              {selectedDoubleScanConfig && (
                <div className='scanSummaryBlock'>
                  {selectedDoubleScanConfig.rfidProgram && (
                    <p>Programa RFID: {selectedDoubleScanConfig.rfidProgram}</p>
                  )}
                  {selectedDoubleScanConfig.expectedGtin && (
                    <p>GTIN esperado: {selectedDoubleScanConfig.expectedGtin}</p>
                  )}
                  {selectedDoubleScanConfig.filterLabel && (
                    <p>Filter label: {selectedDoubleScanConfig.filterLabel}</p>
                  )}
                  {selectedDoubleScanConfig.notes && <p>{selectedDoubleScanConfig.notes}</p>}
                </div>
              )}

              <label className='modalField'>
                <span>Primer código:</span>
                <input
                  ref={firstBarcodeInputRef}
                  type='text'
                  value={firstBarcodeRaw}
                  onChange={(event) => setFirstBarcodeRaw(event.target.value)}
                  onKeyDown={handleFirstBarcodeEnter}
                  placeholder='Escanea el primer código'
                  disabled={!doubleScanPartNumber || doubleScanStep === 'submitting'}
                  autoComplete='off'
                />
              </label>

              <label className='modalField'>
                <span>Segundo código:</span>
                <input
                  ref={secondBarcodeInputRef}
                  type='text'
                  value={secondBarcodeRaw}
                  onChange={(event) => setSecondBarcodeRaw(event.target.value)}
                  onKeyDown={(event) => void handleSecondBarcodeEnter(event)}
                  placeholder='Escanea el segundo código'
                  disabled={!doubleScanPartNumber || !firstBarcodeRaw.trim() || doubleScanStep === 'submitting'}
                  autoComplete='off'
                />
              </label>

              <p className='manualHint'>
                {doubleScanStep === 'waiting_second'
                  ? 'Primer código capturado. Escanea el segundo código.'
                  : 'Escanea el primer código y presiona Enter para avanzar.'}
              </p>

              {doubleScanMessage && (
                <p className={`manualMessage ${doubleScanMessage.type}`}>{doubleScanMessage.text}</p>
              )}

              {doubleScanResult && (
                <div className='scanSummaryBlock scanResultBlock'>
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
                  onClick={clearDoubleScanFields}
                  disabled={doubleScanStep === 'submitting'}
                >
                  Limpiar
                </button>
                <button
                  className='buttonSelector modalSubmitButton'
                  type='submit'
                  disabled={
                    doubleScanStep === 'submitting' ||
                    !doubleScanPartNumber ||
                    !firstBarcodeRaw.trim() ||
                    !secondBarcodeRaw.trim()
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
        <section>
          {/* aquí tu bloque de inputs escaneo */}
        </section>
      )}
    </>
  );
}

export default programmingDashboardPage;