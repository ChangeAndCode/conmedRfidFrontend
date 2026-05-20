import { useState, type FormEvent } from 'react';
import type { UpdateVerificationReportStatusPayload, VerificationReport } from '../types/VerificationReport';

type VerificationReportStatusAction = 'print_interrupted' | 'printed' | 'reprinted';

type VerificationReportStatusModalProps = {
  report: VerificationReport;
  action: VerificationReportStatusAction;
  onClose: () => void;
  onSubmit: (payload: UpdateVerificationReportStatusPayload) => Promise<void>;
};

const getActionCopy = (action: VerificationReportStatusAction) => {
  switch (action) {
    case 'print_interrupted':
      return {
        title: 'Marcar impresion interrumpida',
        description:
          'Registra que el intento de impresion no termino correctamente. Puedes guardar notas opcionales.',
        submitLabel: 'Guardar interrupcion',
        submittingLabel: 'Guardando...',
        placeholder: 'Ejemplo: papel atascado, impresora sin tinta, corte de energia.',
      };
    case 'printed':
      return {
        title: 'Marcar como impreso',
        description:
          'Confirma que el reporte ya se imprimio correctamente. Puedes dejar notas del evento.',
        submitLabel: 'Marcar impreso',
        submittingLabel: 'Actualizando...',
        placeholder: 'Ejemplo: impresion completa en estacion 2.',
      };
    case 'reprinted':
      return {
        title: 'Reimprimir reporte',
        description:
          'La reimpresion solo esta disponible para admin. Puedes documentar el motivo en notas.',
        submitLabel: 'Reimprimir',
        submittingLabel: 'Reimprimiendo...',
        placeholder: 'Ejemplo: copia solicitada por auditoria.',
      };
    default:
      return {
        title: 'Actualizar reporte',
        description: 'Actualiza el estado del reporte.',
        submitLabel: 'Guardar',
        submittingLabel: 'Guardando...',
        placeholder: 'Notas opcionales',
      };
  }
};

function VerificationReportStatusModal({
  report,
  action,
  onClose,
  onSubmit,
}: VerificationReportStatusModalProps) {
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const actionCopy = getActionCopy(action);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onSubmit({
        notes: notes.trim() || undefined,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'No se pudo actualizar el reporte de verificacion.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className='adminModalOverlay' onClick={isSubmitting ? undefined : onClose}>
      <div className='adminModalCard adminCatalogModalCard' onClick={(event) => event.stopPropagation()}>
        <div className='adminModalHeader'>
          <div className='adminModalTitleBlock'>
            <h2>{actionCopy.title}</h2>
            <p>{`${report.serviceOrderFolio} actualmente esta en estado ${report.status}. ${actionCopy.description}`}</p>
          </div>
          <button
            className='adminPrimaryButton adminSecondaryButton'
            type='button'
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cerrar
          </button>
        </div>

        <form className='adminForm' onSubmit={handleSubmit}>
          <label className='adminField'>
            <span>Notas</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={actionCopy.placeholder}
              disabled={isSubmitting}
              rows={4}
            />
          </label>

          {errorMessage && <div className='adminMessage error'>{errorMessage}</div>}

          <div className='adminModalFooter'>
            <button
              className='adminPrimaryButton adminSecondaryButton'
              type='button'
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button className='adminPrimaryButton' type='submit' disabled={isSubmitting}>
              {isSubmitting ? actionCopy.submittingLabel : actionCopy.submitLabel}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default VerificationReportStatusModal;
