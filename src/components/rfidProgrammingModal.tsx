import { useCallback, useState } from 'react';
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
  | 'awaiting_serial_write'
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
        : 'Acerca la etiqueta al lector para leer el tagId.';
    case 'building_payload':
      return 'Construyendo payload RFID con el backend...';
    case 'awaiting_manual_write':
      return 'Payload generado. Escribelo manualmente en NFC Tools y luego confirma la programacion.';
    case 'awaiting_serial_write':
      return 'Payload generado. Vuelve a pasar la etiqueta para escribirlo por COM.';
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
        : 'Listo para leer el tagId por COM.';
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

  const isAndroidManualAssisted = session.connectionMethod === 'android_usb_nfc';

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

  const writePayloadAndCompleteProgramming = useCallback(async (
    tagIdToUse: string,
    payloadDataToUse: BuildRfidPayloadData,
  ) => {
    setStage('writing_tag');
    const nextWriteResult = await writeHardwarePayload({
      connectionMethod: session.connectionMethod,
      deviceId: session.device.id,
      tagId: tagIdToUse,
      payloadHex: payloadDataToUse.payloadHex,
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
      buildCompletionPayload(session, tagIdToUse, payloadDataToUse),
    );

    setStage('success');
    setInfoMessage(completionResult.message);
    await onCompleted(completionResult);
  }, [onCompleted, session]);

  const handleSerialTagRead = useCallback(async () => {
    setErrorMessage(null);
    setInfoMessage('Acerca la etiqueta RFID al lector para leer el tagId.');
    setTagId('');
    setPayloadData(null);
    setWriteResult(null);
    setCopiedPayload(false);

    try {
      setStage('reading_tag');
      const readResult = await readHardwareTagId(
        session.connectionMethod,
        session.device.id,
      );

      setTagId(readResult.tagId);

      const payloadResult = await buildPayloadForTagId(readResult.tagId);
      setStage('awaiting_serial_write');
      setInfoMessage(
        `${payloadResult.message} Vuelve a pasar la etiqueta RFID para escribir el payload.`,
      );
    } catch (error) {
      setStage('error');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo leer el tagId de la etiqueta por COM.',
      );
    }
  }, [buildPayloadForTagId, session.connectionMethod, session.device.id]);

  const handleBuildPayload = async () => {
    const trimmedTagId = tagId.trim();

    if (!trimmedTagId) {
      setErrorMessage('Primero captura o lee el tagId de la etiqueta RFID.');
      return;
    }

    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const payloadResult = await buildPayloadForTagId(trimmedTagId);
      setStage('awaiting_manual_write');
      setInfoMessage(
        `${payloadResult.message} Copialo en NFC Tools > Escribir > Texto y luego confirma aqui.`,
      );
    } catch (error) {
      setStage('error');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo completar la programacion RFID.',
      );
    }
  };

  const handleSerialWriteProgramming = async () => {
    const trimmedTagId = tagId.trim();

    if (!trimmedTagId) {
      setErrorMessage('Primero lee el tagId de la etiqueta RFID.');
      return;
    }

    if (!payloadData) {
      setErrorMessage('Primero genera el payload RFID para continuar.');
      return;
    }

    setErrorMessage(null);
    setInfoMessage('Vuelve a pasar la etiqueta RFID al lector para escribir el payload.');

    try {
      await writePayloadAndCompleteProgramming(trimmedTagId, payloadData);
    } catch (error) {
      setStage('error');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo escribir el payload RFID por COM.',
      );
    }
  };

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
            <p>Modo COM en dos pasos.</p>
            <p>1. Lee la etiqueta RFID para capturar el tagId.</p>
            <p>2. El sistema generara el payload RFID con el backend.</p>
            <p>3. Vuelve a pasar la misma etiqueta para escribir el payload.</p>
            {tagId && <p>{`tagId detectado: ${tagId}`}</p>}
            {payloadData && <p>Payload listo para escritura por COM.</p>}
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
            <>
              <button
                className='adminPrimaryButton adminSecondaryButton'
                type='button'
                onClick={() => void handleSerialTagRead()}
                disabled={isBusy}
              >
                {stage === 'reading_tag'
                  ? 'Leyendo tagId...'
                  : stage === 'building_payload'
                    ? 'Generando payload...'
                    : payloadData
                      ? 'Leer otro tagId'
                      : 'Leer tagId'}
              </button>
              <button
                className='adminPrimaryButton'
                type='button'
                onClick={() => void handleSerialWriteProgramming()}
                disabled={isBusy || !payloadData}
              >
                {stage === 'writing_tag' || stage === 'completing'
                  ? 'Escribiendo...'
                  : 'Escribir payload'}
              </button>
            </>
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
