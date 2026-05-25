import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  UpdateVerificationReportStatusPayload,
  VerificationReport,
} from '../types/VerificationReport';
import VerificationReportPrintableDocument from './verificationReportPrintableDocument';
import '../css/verificationReportPrint.css';

type VerificationReportPrintMode = 'print' | 'reprint';

type VerificationReportPrintModalProps = {
  report: VerificationReport;
  mode: VerificationReportPrintMode;
  autoStart?: boolean;
  onClose: () => void;
  onMarkPrinted: (payload: UpdateVerificationReportStatusPayload) => Promise<void>;
  onMarkPrintInterrupted?: (
    payload: UpdateVerificationReportStatusPayload,
  ) => Promise<void>;
  onMarkReprinted?: (
    payload: UpdateVerificationReportStatusPayload,
  ) => Promise<void>;
};

const waitForNextPaint = async () => {
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
};

const getScreenCopy = (mode: VerificationReportPrintMode) => {
  if (mode === 'reprint') {
    return {
      title: 'Reimpresion web estandar',
      description:
        '',
      actionLabel: 'Reimprimir / Guardar PDF',
      pendingTitle: 'Confirma el resultado de la reimpresion',
      successLabel: 'Si, se reimprimio',
    };
  }

  return {
    title: 'Impresion web estandar',
    description:
      '',
    actionLabel: 'Imprimir / Guardar PDF',
    pendingTitle: 'Confirma el resultado de la impresion',
    successLabel: 'Si, se imprimio',
  };
};

function VerificationReportPrintModal({
  report,
  mode,
  autoStart = true,
  onClose,
  onMarkPrinted,
  onMarkPrintInterrupted,
  onMarkReprinted,
}: VerificationReportPrintModalProps) {
  const [notes, setNotes] = useState('');
  const [hasAttemptedPrint, setHasAttemptedPrint] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const autoStartRef = useRef(false);
  const printAttemptInProgressRef = useRef(false);
  const screenCopy = getScreenCopy(mode);

  useEffect(() => {
    const handleAfterPrint = () => {
      if (!printAttemptInProgressRef.current) {
        return;
      }

      printAttemptInProgressRef.current = false;
      document.body.classList.remove('printingVerificationReport');
      setHasAttemptedPrint(true);
    };

    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      printAttemptInProgressRef.current = false;
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('printingVerificationReport');
    };
  }, []);

  const handleOpenPrintDialog = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    setErrorMessage(null);
    setHasAttemptedPrint(false);
    printAttemptInProgressRef.current = true;

    document.body.classList.add('printingVerificationReport');

    await waitForNextPaint();
    window.print();
  }, [isSubmitting]);

  useEffect(() => {
    if (!autoStart || autoStartRef.current) {
      return;
    }

    autoStartRef.current = true;
    void handleOpenPrintDialog();
  }, [autoStart, handleOpenPrintDialog]);

  const handleConfirmPrinted = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (mode === 'reprint') {
        if (!onMarkReprinted) {
          throw new Error('La reimpresion no esta disponible para este reporte.');
        }

        await onMarkReprinted({
          notes: notes.trim() || undefined,
        });
      } else {
        await onMarkPrinted({
          notes: notes.trim() || undefined,
        });
      }

      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar el estado del reporte.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmInterrupted = async () => {
    if (!onMarkPrintInterrupted) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onMarkPrintInterrupted({
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo marcar la impresion como interrumpida.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <section className='verificationReportPrintRoot adminModalOverlay'>
      <div className='verificationReportPrintSurface'>
        <div className='verificationReportPrintChrome'>
          <header className='verificationReportPrintToolbar'>
            <div className='verificationReportPrintToolbarCopy'>
              <h2>{screenCopy.title}</h2>
              <p>{screenCopy.description}</p>
            </div>

            <div className='verificationReportPrintToolbarActions'>
              <button
                className='adminPrimaryButton adminSecondaryButton'
                type='button'
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cerrar
              </button>
              <button
                className='adminPrimaryButton'
                type='button'
                onClick={() => void handleOpenPrintDialog()}
                disabled={isSubmitting}
              >
                {screenCopy.actionLabel}
              </button>
            </div>
          </header>

          {hasAttemptedPrint && (
            <section className='verificationReportPrintOutcomeCard'>
              <div className='verificationReportPrintOutcomeCopy'>
                <h3>{screenCopy.pendingTitle}</h3>
                <p>
                  El frontend no puede saber si el usuario imprimio, guardo PDF o cancelo desde el
                  dialogo nativo. Confirma el resultado para actualizar el estado del reporte.
                </p>
              </div>

              <label className='adminField verificationReportPrintOutcomeField'>
                <span>Notas</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder='Notas opcionales del intento de impresion'
                  disabled={isSubmitting}
                  rows={3}
                />
              </label>

              {errorMessage && <div className='adminMessage error'>{errorMessage}</div>}

              <div className='verificationReportPrintOutcomeActions'>
                <button
                  className='adminPrimaryButton adminSecondaryButton'
                  type='button'
                  onClick={() => void handleOpenPrintDialog()}
                  disabled={isSubmitting}
                >
                  Volver a abrir dialogo
                </button>
                {mode === 'print' && onMarkPrintInterrupted && (
                  <button
                    className='adminPrimaryButton adminSecondaryButton'
                    type='button'
                    onClick={() => void handleConfirmInterrupted()}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Guardando...' : 'No, fallo'}
                  </button>
                )}
                <button
                  className='adminPrimaryButton adminSecondaryButton'
                  type='button'
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Sin cambios
                </button>
                <button
                  className='adminPrimaryButton'
                  type='button'
                  onClick={() => void handleConfirmPrinted()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Actualizando...' : screenCopy.successLabel}
                </button>
              </div>
            </section>
          )}
        </div>

        <VerificationReportPrintableDocument report={report} />
      </div>
    </section>,
    document.body,
  );
}

export default VerificationReportPrintModal;
