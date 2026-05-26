import { useState, type FormEvent } from 'react';
import type { Gtin, GtinMutationPayload } from '../types/Gtin';

type GtinFormModalProps = {
  title: string;
  submitLabel: string;
  submittingLabel: string;
  onClose: () => void;
  onSubmit: (payload: GtinMutationPayload) => Promise<void>;
  initialData?: Partial<Gtin>;
};

const GTIN_LENGTH = 14;

const sanitizeGtinInput = (value: string) => value.replace(/\D/g, '').slice(0, GTIN_LENGTH);

const isGtinValid = (value: string) => new RegExp(`^\\d{${GTIN_LENGTH}}$`).test(value);

function GtinFormModal({
  title,
  submitLabel,
  submittingLabel,
  onClose,
  onSubmit,
  initialData,
}: GtinFormModalProps) {
  const [value, setValue] = useState(initialData?.value ?? '');
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedValue = value.trim();

    if (!normalizedValue) {
      setErrorMessage('El GTIN es obligatorio.');
      return;
    }

    if (!isGtinValid(normalizedValue)) {
      setErrorMessage(`El GTIN debe contener exactamente ${GTIN_LENGTH} digitos numericos.`);
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
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo guardar el GTIN.');
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
            <p>Administra el catálogo de GTIN disponibles para seleccionar en numeros de parte.</p>
          </div>
        </div>

        <form className='adminForm' onSubmit={handleSubmit}>
          <div className='adminFormGrid'>
            <label className='adminField adminFieldFull'>
              <span>GTIN</span>
              <input
                type='text'
                inputMode='numeric'
                maxLength={GTIN_LENGTH}
                value={value}
                onChange={(event) => setValue(sanitizeGtinInput(event.target.value))}
                placeholder='00851136001566'
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

          <p className='adminFieldHint'>El GTIN debe contener exactamente 14 digitos numericos.</p>

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

export default GtinFormModal;
