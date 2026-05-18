import { useState, type FormEvent } from 'react';
import type { RfidProgram, RfidProgramMutationPayload } from '../types/RfidProgram';

type RfidProgramFormModalProps = {
  title: string;
  submitLabel: string;
  submittingLabel: string;
  onClose: () => void;
  onSubmit: (payload: RfidProgramMutationPayload) => Promise<void>;
  initialData?: Partial<RfidProgram>;
};

const RFID_PROGRAM_MAX_LENGTH = 20;

const normalizeRfidProgramInput = (value: string) =>
  value.toUpperCase().slice(0, RFID_PROGRAM_MAX_LENGTH);

function RfidProgramFormModal({
  title,
  submitLabel,
  submittingLabel,
  onClose,
  onSubmit,
  initialData,
}: RfidProgramFormModalProps) {
  const [value, setValue] = useState(initialData?.value ?? '');
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedValue = value.trim().toUpperCase();

    if (!normalizedValue) {
      setErrorMessage('El Programa RFID es obligatorio.');
      return;
    }

    if (normalizedValue.length > RFID_PROGRAM_MAX_LENGTH) {
      setErrorMessage(`El Programa RFID no debe exceder ${RFID_PROGRAM_MAX_LENGTH} caracteres.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onSubmit({
        value: normalizedValue,
        isActive,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'No se pudo guardar el Programa RFID.',
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
            <h2>{title}</h2>
            <p>Administra el catalogo de Programas RFID disponibles para seleccionar en numeros de parte.</p>
          </div>
          <button className='adminPrimaryButton adminSecondaryButton' type='button' onClick={onClose} disabled={isSubmitting}>
            Cerrar
          </button>
        </div>

        <form className='adminForm' onSubmit={handleSubmit}>
          <div className='adminFormGrid'>
            <label className='adminField adminFieldFull'>
              <span>Programa RFID</span>
              <input
                type='text'
                maxLength={RFID_PROGRAM_MAX_LENGTH}
                value={value}
                onChange={(event) => setValue(normalizeRfidProgramInput(event.target.value))}
                placeholder='VL-25'
                disabled={isSubmitting}
                required
              />
            </label>
          </div>

          <label className='adminCheckboxRow'>
            <input
              type='checkbox'
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              disabled={isSubmitting}
            />
            <span>Activo</span>
          </label>

          <p className='adminFieldHint'>
            El Programa RFID se normaliza a mayusculas y no debe exceder {RFID_PROGRAM_MAX_LENGTH} caracteres.
          </p>

          {errorMessage && <div className='adminMessage error'>{errorMessage}</div>}

          <div className='adminModalFooter'>
            <button className='adminPrimaryButton adminSecondaryButton' type='button' onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button className='adminPrimaryButton' type='submit' disabled={isSubmitting}>
              {isSubmitting ? submittingLabel : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default RfidProgramFormModal;
