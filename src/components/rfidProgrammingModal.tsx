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

  useEffect(() => {
    setTagId('');
    setPayloadData(null);
    setWriteResult(null);
    setStage('idle');
    setErrorMessage(null);
    setInfoMessage(null);
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
    } catch (error) {
      setStage('error');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo leer el tagId desde el hardware.',
      );
    }
  };

  const handleProgramTag = async () => {
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
      setInfoMessage(payloadResult.message);

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
      const completionPayload = {
        connectionMethod: session.connectionMethod,
        tagId: trimmedTagId,
        payloadHex: payloadResult.data.payloadHex,
        authCode: payloadResult.data.authCode,
        deviceName: session.device.name,
        serialPortPath:
          session.connectionMethod === 'serial_port'
            ? session.device.serialPortPath ?? session.device.id
            : undefined,
        deviceId:
          session.connectionMethod === 'android_usb_nfc'
            ? session.device.deviceId ?? session.device.id
            : undefined,
      } as const;
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
            onChange={(event) => setTagId(event.target.value)}
            placeholder='Lee o captura el tagId'
            disabled={isBusy}
            autoComplete='off'
          />
        </label>

        <div className='modalActionRow'>
          <button
            className='adminPrimaryButton adminSecondaryButton'
            type='button'
            onClick={() => void handleReadTagId()}
            disabled={isBusy}
          >
            {stage === 'reading_tag' ? 'Leyendo...' : 'Leer tagId'}
          </button>
          <button
            className='adminPrimaryButton'
            type='button'
            onClick={() => void handleProgramTag()}
            disabled={isBusy || !tagId.trim()}
          >
            {isBusy ? 'Procesando...' : 'Programar etiqueta'}
          </button>
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
          Si cierras este modal antes de completar la programacion, el registro quedara capturado
          y podras reanudar despues desde esta misma estacion.
        </p>
      </div>
    </section>
  );
}

export default RfidProgrammingModal;
