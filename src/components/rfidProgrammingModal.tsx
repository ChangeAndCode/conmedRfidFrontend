import { useCallback, useEffect, useRef, useState } from 'react';
import {
  readHardwareTagId,
  writeHardwarePayload,
} from '../services/rfidHardwareService';
import {
  buildRfidPayload,
  completeProgramming,
} from '../services/rfidProgrammingService';
import type {
  BuildRfidPayloadData,
  CompleteProgrammingResponse,
  RfidProgrammingSession,
  WritePayloadResult,
} from '../types/RfidProgramming';

type RfidProgrammingModalProps = {
  session: RfidProgrammingSession;
  onClose: () => void;
  onCompleted: (result: CompleteProgrammingResponse) => Promise<void> | void;
};

type ProgrammingStage =
  | 'idle'
  | 'reading_tag'
  | 'building_payload'
  | 'awaiting_manual_write'
  | 'writing_tag'
  | 'completing'
  | 'success'
  | 'error';

const getConnectionMethodLabel = (
  connectionMethod: RfidProgrammingSession['connectionMethod'],
) =>
  connectionMethod === 'serial_port'
    ? 'Lector por COM'
    : 'Android USB/NFC';

const getStageLabel = (
  stage: ProgrammingStage,
  isAndroidManualAssisted: boolean,
) => {
  switch (stage) {
    case 'reading_tag':
      return isAndroidManualAssisted
        ? 'Leyendo tagId desde el hardware...'
        : 'Acerca la etiqueta al lector para leer automaticamente el tagId.';
    case 'building_payload':
      return 'Construyendo payload RFID con el backend...';
    case 'awaiting_manual_write':
      return 'Payload generado. Escribelo manualmente en NFC Tools y luego confirma la programacion.';
    case 'writing_tag':
      return 'Escribiendo payload en la etiqueta...';
    case 'completing':
      return 'Confirmando programacion en backend...';
    case 'success':
      return 'Etiqueta programada correctamente.';
    case 'error':
      return 'La programacion se detuvo por un error.';
    default:
      return isAndroidManualAssisted
        ? 'Listo para programar la etiqueta RFID.'
        : 'Listo para iniciar la programacion automatica por COM.';
  }
};

function RfidProgrammingModal({
  session,
  onClose,
  onCompleted,
}: RfidProgrammingModalProps) {
  const [tagId, setTagId] = useState('');
  const [payloadData, setPayloadData] = useState<BuildRfidPayloadData | null>(null);
  const [writeResult, setWriteResult] = useState<WritePayloadResult | null>(null);
  const [stage, setStage] = useState<ProgrammingStage>('idle');
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const serialAutoStartedRef = useRef(false);

  const isAndroidManualAssisted = session.connectionMethod === 'android_usb_nfc';
  const isSerialAutomaticFlow = session.connectionMethod === 'serial_port';

  const isBusy =
    stage === 'reading_tag' ||
    stage === 'building_payload' ||
    stage === 'writing_tag' ||
    stage === 'completing';

  const buildPayloadForTagId = useCallback(async (tagIdToUse: string) => {
    setStage('building_payload');
    const payloadResult = await buildRfidPayload(
      session.programmingRecordId,
      tagIdToUse,
    );

    setPayloadData(payloadResult.data);
    setWriteResult(null);
    setCopiedPayload(false);

    return payloadResult;
  }, [session.programmingRecordId]);

  const runAutomaticProgramming = useCallback(async (tagIdToUse: string) => {
    const payloadResult = await buildPayloadForTagId(tagIdToUse);

    setStage('writing_tag');
    const nextWriteResult = await writeHardwarePayload({
      connectionMethod: session.connectionMethod,
      deviceId: session.device.id,
      tagId: tagIdToUse,
      payloadHex: payloadResult.data.payloadHex,
    });

    if (!nextWriteResult.success) {
      throw new Error(
        nextWriteResult.message ??
          'El hardware no confirmo la escritura de la etiqueta.',
      );
    }

    setWriteResult(nextWriteResult);
    setInfoMessage(nextWriteResult.message ?? 'Etiqueta escrita correctamente.');

    setStage('completing');
    const completionResult = await completeProgramming(
      session.programmingRecordId,
      buildCompletionPayload(session, tagIdToUse, payloadResult.data),
    );

    setStage('success');
    setInfoMessage(completionResult.message);
    await onCompleted(completionResult);
  }, [buildPayloadForTagId, onCompleted, session]);

  const handleAutomaticSerialProgramming = useCallback(async () => {
    setErrorMessage(null);
    setInfoMessage('Acerca la etiqueta RFID al lector para iniciar la programacion.');
    setWriteResult(null);

    try {
      setStage('reading_tag');
      const readResult = await readHardwareTagId(
        session.connectionMethod,
        session.device.id,
      );

      setTagId(readResult.tagId);

      await runAutomaticProgramming(readResult.tagId);
    } catch (error) {
      setStage('error');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo completar la programacion automatica por COM.',
      );
    }
  }, [runAutomaticProgramming, session.connectionMethod, session.device.id]);

  const handleBuildPayload = async () => {
    const trimmedTagId = tagId.trim();

    if (!trimmedTagId) {
      setErrorMessage('Primero captura o lee el tagId de la etiqueta RFID.');
      return;
    }

    setErrorMessage(null);
    setInfoMessage(null);

    try {
      if (isAndroidManualAssisted) {
        const payloadResult = await buildPayloadForTagId(trimmedTagId);
        setStage('awaiting_manual_write');
        setInfoMessage(
          `${payloadResult.message} Copialo en NFC Tools > Escribir > Texto y luego confirma aqui.`,
        );
        return;
      }

      await runAutomaticProgramming(trimmedTagId);
    } catch (error) {
      setStage('error');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo completar la programacion RFID.',
      );
    }
  };

  useEffect(() => {
    if (!isSerialAutomaticFlow || serialAutoStartedRef.current) {
      return;
    }

    serialAutoStartedRef.current = true;
    const timeoutId = window.setTimeout(() => {
      void handleAutomaticSerialProgramming();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [handleAutomaticSerialProgramming, isSerialAutomaticFlow, session.programmingRecordId]);

  const handleConfirmManualProgramming = async () => {
    const trimmedTagId = tagId.trim();

    if (!trimmedTagId) {
      setErrorMessage('Captura el tagId real de la etiqueta antes de confirmar.');
      return;
    }

    if (!payloadData) {
      setErrorMessage('Primero genera el payload RFID para continuar.');
      return;
    }

    setErrorMessage(null);
    setInfoMessage(null);

    try {
      setStage('completing');
      const completionResult = await completeProgramming(
        session.programmingRecordId,
        buildCompletionPayload(session, trimmedTagId, payloadData),
      );

      setStage('success');
      setInfoMessage(completionResult.message);
      await onCompleted(completionResult);
    } catch (error) {
      setStage('error');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo confirmar la programacion RFID.',
      );
    }
  };

  const handleCopyPayload = async () => {
    if (!payloadData?.payloadHex) {
      return;
    }

    try {
      await navigator.clipboard.writeText(payloadData.payloadHex);
      setCopiedPayload(true);
      setInfoMessage('Payload copiado. Pegalo como texto en NFC Tools.');
    } catch {
      setErrorMessage('No se pudo copiar el payload automaticamente. Copialo manualmente.');
    }
  };

  return (
    <section className='modalOverlay'>
      <div className='square generalBlock modalSquare rfidProgrammingModalSurface'>
        <div className='modalHeader'>
          <div className='rfidProgrammingHeaderCopy'>
            <h2>Programacion RFID</h2>
            <p>{getStageLabel(stage, isAndroidManualAssisted)}</p>
          </div>
          <button
            className='modalCloseButton'
            type='button'
            onClick={onClose}
            disabled={isBusy}
            aria-label='Cerrar modal de programacion RFID'
          >
            X
          </button>
        </div>

        <div className='scanSummaryBlock'>
          <p>{`Orden: ${session.serviceOrderFolio ?? 'Sin folio'}`}</p>
          <p>{`Modo: ${session.programmingRecordMode}`}</p>
          <p>{`Metodo: ${getConnectionMethodLabel(session.connectionMethod)}`}</p>
          <p>{`Dispositivo: ${session.device.name}`}</p>
          {session.device.description && <p>{session.device.description}</p>}
          {session.device.isSimulated && (
            <p>Modo de desarrollo activo: el hardware se esta simulando localmente.</p>
          )}
        </div>

        <div className='scanSummaryBlock'>
          <p>{`Programming record: ${session.programmingRecordId}`}</p>
          {session.readSummary.partNumber && (
            <p>{`Numero de parte: ${session.readSummary.partNumber}`}</p>
          )}
          {session.readSummary.gtin && <p>{`GTIN: ${session.readSummary.gtin}`}</p>}
          {session.readSummary.lot && <p>{`Lote: ${session.readSummary.lot}`}</p>}
          {session.readSummary.manufactureDate && (
            <p>{`Fecha de manufactura: ${session.readSummary.manufactureDate}`}</p>
          )}
          {session.readSummary.rfidProgram && (
            <p>{`Programa RFID: ${session.readSummary.rfidProgram}`}</p>
          )}
          {session.readSummary.filterLabel && (
            <p>{`Filter label: ${session.readSummary.filterLabel}`}</p>
          )}
        </div>

        {isAndroidManualAssisted ? (
          <label className='modalField'>
            <span>tagId</span>
            <input
              type='text'
              value={tagId}
              onChange={(event) => {
                setTagId(event.target.value);
                setPayloadData(null);
                setWriteResult(null);
                setCopiedPayload(false);

                if (stage === 'awaiting_manual_write') {
                  setStage('idle');
                }
              }}
              placeholder='Captura el tagId desde NFC Tools o TagInfo'
              disabled={isBusy}
              autoComplete='off'
            />
          </label>
        ) : (
          <div className='scanSummaryBlock scanResultBlock'>
            <p>Modo COM automatico.</p>
            <p>Acerca la etiqueta RFID al lector conectado.</p>
            <p>El sistema intentara leer el tagId, generar el payload y programar la etiqueta automaticamente.</p>
            {tagId && <p>{`tagId detectado: ${tagId}`}</p>}
          </div>
        )}

        {isAndroidManualAssisted && (
          <div className='scanSummaryBlock scanResultBlock'>
            <p>Modo Android manual asistido.</p>
            <p>1. Lee la etiqueta en NFC Tools o TagInfo y captura aqui el tagId.</p>
            <p>2. Genera el payload RFID.</p>
            <p>3. En NFC Tools usa Escribir {'>'} Texto y pega el payload exacto.</p>
            <p>4. Acerca la etiqueta al telefono y completa la escritura manualmente.</p>
            <p>5. Regresa aqui y confirma la programacion.</p>
          </div>
        )}

        <div className='modalActionRow'>
          {isAndroidManualAssisted ? (
            <button
              className='adminPrimaryButton'
              type='button'
              onClick={() => void handleBuildPayload()}
              disabled={isBusy || !tagId.trim()}
            >
              {stage === 'building_payload' ? 'Generando...' : 'Generar payload'}
            </button>
          ) : (
            <button
              className='adminPrimaryButton adminSecondaryButton'
              type='button'
              onClick={() => void handleAutomaticSerialProgramming()}
              disabled={isBusy}
            >
              {isBusy ? 'Procesando...' : 'Reintentar programacion automatica'}
            </button>
          )}
          {isAndroidManualAssisted && (
            <button
              className='adminPrimaryButton adminSecondaryButton'
              type='button'
              onClick={() => void handleConfirmManualProgramming()}
              disabled={isBusy || !payloadData}
            >
              {stage === 'completing' ? 'Confirmando...' : 'Confirmar programacion manual'}
            </button>
          )}
        </div>

        {payloadData && (
          <div className='scanSummaryBlock scanResultBlock'>
            <p>{`Auth code: ${payloadData.authCode}`}</p>
            <p>{`Payload hex: ${payloadData.payloadHex}`}</p>
            {payloadData.tagByteLength !== undefined && (
              <p>{`Bytes esperados: ${payloadData.tagByteLength}`}</p>
            )}
            {formatLegacyPartMapping(payloadData.legacyPartMapping).map((entry) => (
              <p key={entry.label}>{`${entry.label}: ${entry.value}`}</p>
            ))}
            {isAndroidManualAssisted && (
              <div className='modalActionRow rfidProgrammingActionRowCompact'>
                <button
                  className='adminPrimaryButton adminSecondaryButton'
                  type='button'
                  onClick={() => void handleCopyPayload()}
                  disabled={isBusy}
                >
                  {copiedPayload ? 'Payload copiado' : 'Copiar payload'}
                </button>
              </div>
            )}
          </div>
        )}

        {writeResult?.message && (
          <p className='manualHint'>{writeResult.message}</p>
        )}

        {infoMessage && (
          <p className='manualMessage info'>{infoMessage}</p>
        )}

        {errorMessage && (
          <p className='manualMessage error'>{errorMessage}</p>
        )}

        <p className='manualHint'>
          {isAndroidManualAssisted
            ? 'Si cierras este modal antes de confirmar la programacion manual, el registro quedara capturado y podras reanudar despues desde esta misma estacion.'
            : 'Si cierras este modal antes de completar la programacion, el registro quedara capturado y podras reanudar despues desde esta misma estacion.'}
        </p>
      </div>
    </section>
  );
}

const buildCompletionPayload = (
  session: RfidProgrammingSession,
  tagId: string,
  payloadData: BuildRfidPayloadData,
) => ({
  connectionMethod: session.connectionMethod,
  tagId,
  payloadHex: payloadData.payloadHex,
  authCode: payloadData.authCode,
  deviceName: session.device.name,
  serialPortPath:
    session.connectionMethod === 'serial_port'
      ? session.device.serialPortPath ?? session.device.id
      : undefined,
  deviceId:
    session.connectionMethod === 'android_usb_nfc'
      ? session.device.deviceId ?? session.device.id
      : undefined,
} as const);

export default RfidProgrammingModal;

const formatLegacyPartMapping = (
  legacyPartMapping: BuildRfidPayloadData['legacyPartMapping'],
) => {
  if (!legacyPartMapping) {
    return [];
  }

  if (typeof legacyPartMapping === 'string') {
    return [{ label: 'Legacy mapping', value: legacyPartMapping }];
  }

  return Object.entries(legacyPartMapping)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => ({
      label: humanizeLegacyMappingKey(key),
      value: String(value),
    }));
};

const humanizeLegacyMappingKey = (key: string) => {
  switch (key) {
    case 'backendPartNumber':
      return 'Backend part number';
    case 'legacyRfidPartNumber':
      return 'Legacy RFID part number';
    default:
      return key;
  }
};
