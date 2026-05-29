import { useEffect, useState } from 'react';
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

const getStageLabel = (stage: ProgrammingStage) => {
  switch (stage) {
    case 'reading_tag':
      return 'Leyendo tagId desde el hardware...';
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
      return 'Listo para programar la etiqueta RFID.';
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

  useEffect(() => {
    setTagId('');
    setPayloadData(null);
    setWriteResult(null);
    setStage('idle');
    setErrorMessage(null);
    setInfoMessage(null);
    setCopiedPayload(false);
  }, [session.programmingRecordId]);

  const isBusy =
    stage === 'reading_tag' ||
    stage === 'building_payload' ||
    stage === 'writing_tag' ||
    stage === 'completing';

  const handleReadTagId = async () => {
    setStage('reading_tag');
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const result = await readHardwareTagId(
        session.connectionMethod,
        session.device.id,
      );
      setTagId(result.tagId);
      setStage('idle');
      setInfoMessage(
        result.simulated
          ? `TagId generado en modo simulado: ${result.tagId}.`
          : `TagId leido correctamente: ${result.tagId}.`,
      );
      setPayloadData(null);
      setWriteResult(null);
      setCopiedPayload(false);
    } catch (error) {
      setStage('error');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo leer el tagId desde el hardware.',
      );
    }
  };

  const handleBuildPayload = async () => {
    const trimmedTagId = tagId.trim();

    if (!trimmedTagId) {
      setErrorMessage('Primero captura o lee el tagId de la etiqueta RFID.');
      return;
    }

    setErrorMessage(null);
    setInfoMessage(null);

    try {
      setStage('building_payload');
      const payloadResult = await buildRfidPayload(
        session.programmingRecordId,
        trimmedTagId,
      );
      setPayloadData(payloadResult.data);
      setWriteResult(null);
      setCopiedPayload(false);

      if (isAndroidManualAssisted) {
        setStage('awaiting_manual_write');
        setInfoMessage(
          `${payloadResult.message} Copialo en NFC Tools > Escribir > Texto y luego confirma aqui.`,
        );
        return;
      }

      setStage('writing_tag');
      const nextWriteResult = await writeHardwarePayload({
        connectionMethod: session.connectionMethod,
        deviceId: session.device.id,
        tagId: trimmedTagId,
        payloadHex: payloadResult.data.payloadHex,
      });

      if (!nextWriteResult.success) {
        throw new Error(
          nextWriteResult.message ??
            'El hardware no confirmo la escritura de la etiqueta.',
        );
      }

      setWriteResult(nextWriteResult);

      setStage('completing');
      const completionPayload = buildCompletionPayload(
        session,
        trimmedTagId,
        payloadResult.data,
      );
      const completionResult = await completeProgramming(
        session.programmingRecordId,
        completionPayload,
      );

      setStage('success');
      setInfoMessage(completionResult.message);
      await onCompleted(completionResult);
    } catch (error) {
      setStage('error');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo completar la programacion RFID.',
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
            <p>{getStageLabel(stage)}</p>
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
            placeholder={
              isAndroidManualAssisted
                ? 'Captura el tagId desde NFC Tools o TagInfo'
                : 'Lee o captura el tagId'
            }
            disabled={isBusy}
            autoComplete='off'
          />
        </label>

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
          {!isAndroidManualAssisted && (
            <button
              className='adminPrimaryButton adminSecondaryButton'
              type='button'
              onClick={() => void handleReadTagId()}
              disabled={isBusy}
            >
              {stage === 'reading_tag' ? 'Leyendo...' : 'Leer tagId'}
            </button>
          )}
          <button
            className='adminPrimaryButton'
            type='button'
            onClick={() => void handleBuildPayload()}
            disabled={isBusy || !tagId.trim()}
          >
            {stage === 'building_payload'
              ? 'Generando...'
              : isAndroidManualAssisted
                ? 'Generar payload'
                : 'Programar etiqueta'}
          </button>
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
            {payloadData.legacyPartMapping && (
              <p>{`Legacy mapping: ${payloadData.legacyPartMapping}`}</p>
            )}
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
