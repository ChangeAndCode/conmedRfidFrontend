import '../../css/programmingDashboard.css';
import '../../index.css';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import AppSceneLayout from '../../components/appSceneLayout';
import { createDoubleScanRead, resolveFirstDoubleScan } from '../../services/doubleScanService';
import {
  listOpenServiceOrdersByGtin,
  listOpenManualServiceOrders,
  listServiceOrderPartConfigOptions,
} from '../../services/serviceOrderService';
import type { DoubleScanReadResponse } from '../../types/DoubleScan';
import type { ServiceOrder, ServiceOrderPartConfigOption } from '../../types/ServiceOrder';

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

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function ProgrammingDashboardPage() {
  const navigate = useNavigate();
  const [port, setPort] = useState('');
  const [mode, setMode] = useState<Mode>(null);

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
  const successResetTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const selectedManualConfig = manualPartOptions.find((option) => option.partNumber === partNumber);
  const selectedManualServiceOrder = manualServiceOrderOptions.find(
    (serviceOrder) => serviceOrder._id === selectedManualServiceOrderId,
  );
  const selectedServiceOrder = serviceOrderOptions.find((serviceOrder) => serviceOrder._id === selectedServiceOrderId);
  const selectedDoubleScanConfig = doubleScanOptions.find((option) => option.id === selectedPartConfigId);
  const hasMultipleServiceOrderOptions = serviceOrderOptions.length > 1;

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
    return () => {
      if (successResetTimeoutRef.current) {
        window.clearTimeout(successResetTimeoutRef.current);
      }
    };
  }, []);

  const resetManualForm = () => {
    setPartNumber('');
    setManualServiceOrderOptions([]);
    setManualPartOptions([]);
    setSelectedManualServiceOrderId('');
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

  const loadManualServiceOrders = async () => {
    setIsLoadingManualServiceOrders(true);
    setManualMessage(null);
    setManualServiceOrderOptions([]);
    setManualPartOptions([]);
    setSelectedManualServiceOrderId('');
    setPartNumber('');

    try {
      const serviceOrders = await listOpenManualServiceOrders();
      setManualServiceOrderOptions(serviceOrders);

      if (serviceOrders.length === 0) {
        setManualMessage({
          type: 'info',
          text: 'No hay ordenes de servicio manuales abiertas disponibles.',
        });
        return;
      }

      setManualMessage({
        type: 'info',
        text: 'Selecciona primero la orden de servicio manual.',
      });
    } catch (error) {
      setManualMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudieron cargar las ordenes de servicio manuales.',
      });
    } finally {
      setIsLoadingManualServiceOrders(false);
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

  const openManualModal = () => {
    resetManualForm();
    setMode('Manual');
    void loadManualServiceOrders();
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
    if (
      doubleScanStep === 'resolving_first' ||
      doubleScanStep === 'resolving_part_configs' ||
      doubleScanStep === 'submitting'
    ) {
      return;
    }

    resetDoubleScanFlow();
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

    setIsSubmittingManual(true);
    setManualMessage(null);

    try {
      const payload = {
        serviceOrderId: selectedManualServiceOrderId,
        partNumber,
        lot: trimmedLot || undefined,
        manufactureDate: trimmedManufactureDate || undefined,
        rfidProgram: selectedManualConfig?.rfidProgram,
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
    setServiceOrderOptions([]);
    setSelectedServiceOrderId('');
    setDoubleScanOptions([]);
    setSelectedPartConfigId('');
    setSecondBarcodeRaw('');

    try {
      const result = await resolveFirstDoubleScan(trimmedFirstBarcode);
      const matchingServiceOrders = await listOpenServiceOrdersByGtin(result.gtin);

      setFirstBarcodeRaw(result.firstBarcodeRaw);
      setResolvedGtin(result.gtin);
      setServiceOrderOptions(matchingServiceOrders);

      if (matchingServiceOrders.length === 0) {
        setDoubleScanStep('waiting_first');
        setDoubleScanMessage({
          type: 'error',
          text: 'No hay ordenes de servicio abiertas para el GTIN detectado.',
        });
        return;
      }

      if (matchingServiceOrders.length === 1) {
        const [singleServiceOrder] = matchingServiceOrders;
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
    doubleScanStep === 'resolving_first' ||
    doubleScanStep === 'resolving_part_configs' ||
    doubleScanStep === 'submitting';

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
                  disabled={!selectedManualServiceOrderId || isLoadingManualPartOptions || isSubmittingManual}
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
                  {selectedManualServiceOrder.partNumber && (
                    <p>Numero de parte solicitado: {selectedManualServiceOrder.partNumber}</p>
                  )}
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
                className='buttonSelector modalSubmitButton'
                type='submit'
                disabled={isSubmittingManual || !partNumber || !selectedManualServiceOrderId}
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
                  className='buttonSelector'
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
                    disabled={isResolvingOrSubmitting}
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
                  disabled={!selectedPartConfigId || isResolvingOrSubmitting}
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
                  disabled={
                    isResolvingOrSubmitting ||
                    !selectedServiceOrderId ||
                    !selectedPartConfigId ||
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
          {/* pendiente: flujo de escaneo simple */}
        </section>
      )}
    </>
  );
}

export default ProgrammingDashboardPage;
