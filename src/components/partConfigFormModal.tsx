import { useState, type FormEvent } from 'react';
import type { PartConfig, PartConfigMutationPayload, ReadingMode } from '../types/PartConfig';

type PartConfigFormValues = {
  partNumber: string;
  description: string;
  readingMode: ReadingMode;
  rfidProgram: string;
  expectedGtin: string;
  filterLabel: string;
  expectedLotLength: string;
  isActive: boolean;
  notes: string;
};

type PartConfigFormModalProps = {
  title: string;
  submitLabel: string;
  submittingLabel: string;
  onClose: () => void;
  onSubmit: (payload: PartConfigMutationPayload) => Promise<void>;
  initialData?: Partial<PartConfig>;
  copySourcePartNumber?: string;
};

const EXPECTED_GTIN_LENGTH = 14;

const sanitizeExpectedGtinInput = (value: string) =>
  value.replace(/\D/g, '').slice(0, EXPECTED_GTIN_LENGTH);

const isExpectedGtinValid = (value: string) =>
  new RegExp(`^\\d{${EXPECTED_GTIN_LENGTH}}$`).test(value);

const INITIAL_VALUES: PartConfigFormValues = {
  partNumber: '',
  description: '',
  readingMode: 'manual',
  rfidProgram: '',
  expectedGtin: '',
  filterLabel: '',
  expectedLotLength: '',
  isActive: true,
  notes: '',
};

const buildFormValues = (initialData?: Partial<PartConfig>): PartConfigFormValues => ({
  partNumber: initialData?.partNumber ?? '',
  description: initialData?.description ?? '',
  readingMode: initialData?.readingMode ?? 'manual',
  rfidProgram: initialData?.rfidProgram ?? '',
  expectedGtin: initialData?.expectedGtin ?? '',
  filterLabel: initialData?.filterLabel ?? '',
  expectedLotLength:
    initialData?.expectedLotLength === undefined ? '' : String(initialData.expectedLotLength),
  isActive: initialData?.isActive ?? true,
  notes: initialData?.notes ?? '',
});

function PartConfigFormModal({
  title,
  submitLabel,
  submittingLabel,
  onClose,
  onSubmit,
  initialData,
  copySourcePartNumber,
}: PartConfigFormModalProps) {
  const [values, setValues] = useState<PartConfigFormValues>(() =>
    initialData ? buildFormValues(initialData) : INITIAL_VALUES,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDoubleScan = values.readingMode === 'double_scan';
  const isCopyMode = Boolean(copySourcePartNumber);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedPartNumber = values.partNumber.trim();
    const trimmedDescription = values.description.trim();
    const trimmedRfidProgram = values.rfidProgram.trim();
    const rawExpectedGtin = values.expectedGtin.trim();
    const trimmedFilterLabel = values.filterLabel.trim();
    const trimmedNotes = values.notes.trim();
    const trimmedExpectedLotLength = values.expectedLotLength.trim();

    if (!trimmedPartNumber) {
      setErrorMessage('El numero de parte es obligatorio.');
      return;
    }

    if (copySourcePartNumber && trimmedPartNumber === copySourcePartNumber.trim()) {
      setErrorMessage('Cambia el numero de parte para guardar la copia.');
      return;
    }

    let parsedExpectedLotLength: number | undefined;

    if (trimmedExpectedLotLength) {
      parsedExpectedLotLength = Number.parseInt(trimmedExpectedLotLength, 10);

      if (Number.isNaN(parsedExpectedLotLength) || parsedExpectedLotLength <= 0) {
        setErrorMessage('La longitud esperada del lote debe ser un numero mayor a cero.');
        return;
      }
    }

    if (rawExpectedGtin && !isExpectedGtinValid(rawExpectedGtin)) {
      setErrorMessage(
        `Expected GTIN debe contener exactamente ${EXPECTED_GTIN_LENGTH} digitos numericos.`,
      );
      return;
    }

    if (isDoubleScan) {
      if (
        !trimmedRfidProgram ||
        !rawExpectedGtin ||
        parsedExpectedLotLength === undefined
      ) {
        setErrorMessage(
          'Para doble lectura son obligatorios RFID Program, Expected GTIN y Expected Lot Length.',
        );
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onSubmit({
        partNumber: trimmedPartNumber,
        description: trimmedDescription || undefined,
        readingMode: values.readingMode,
        rfidProgram: trimmedRfidProgram || undefined,
        expectedGtin: rawExpectedGtin || undefined,
        filterLabel: trimmedFilterLabel || undefined,
        expectedLotLength: parsedExpectedLotLength,
        isActive: values.isActive,
        notes: trimmedNotes || undefined,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'No se pudo guardar la configuracion.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className='adminModalOverlay' onClick={isSubmitting ? undefined : onClose}>
      <div className='adminModalCard' onClick={(event) => event.stopPropagation()}>
        <div className='adminModalHeader'>
          <div className='adminModalTitleBlock'>
            <h2>{title}</h2>
            <p>
              {isCopyMode
                ? 'Se reutilizaran los datos del registro original. Cambia el numero de parte y, si hace falta, corrige el Expected GTIN.'
                : 'Captura los datos del numero de parte que quieres administrar.'}
            </p>
          </div>
          <button className='buttonSelector' type='button' onClick={onClose} disabled={isSubmitting}>
            Cerrar
          </button>
        </div>

        <form className='adminForm' onSubmit={handleSubmit}>
          <div className='adminFormGrid'>
            <label className='adminField'>
              <span>Numero de parte</span>
              <input
                type='text'
                value={values.partNumber}
                onChange={(event) =>
                  setValues((currentValues) => ({
                    ...currentValues,
                    partNumber: event.target.value,
                  }))
                }
                placeholder='SEA3700'
                disabled={isSubmitting}
                required
              />
            </label>

            <label className='adminField'>
              <span>Reading mode</span>
              <select
                value={values.readingMode}
                onChange={(event) =>
                  setValues((currentValues) => ({
                    ...currentValues,
                    readingMode: event.target.value as ReadingMode,
                  }))
                }
                disabled={isSubmitting || isCopyMode}
              >
                <option value='manual'>Manual</option>
                <option value='single_scan'>Single Scan</option>
                <option value='double_scan'>Double Scan</option>
              </select>
            </label>

            <label className='adminField adminFieldFull'>
              <span>Descripcion</span>
              <input
                type='text'
                value={values.description}
                onChange={(event) =>
                  setValues((currentValues) => ({
                    ...currentValues,
                    description: event.target.value,
                  }))
                }
                placeholder='Descripcion opcional'
                disabled={isSubmitting || isCopyMode}
              />
            </label>

            <label className='adminField'>
              <span>RFID Program</span>
              <input
                type='text'
                value={values.rfidProgram}
                onChange={(event) =>
                  setValues((currentValues) => ({
                    ...currentValues,
                    rfidProgram: event.target.value,
                  }))
                }
                placeholder='VL-25'
                disabled={isSubmitting || isCopyMode}
              />
            </label>

            <label className='adminField'>
              <span>Expected GTIN</span>
              <input
                type='text'
                inputMode='numeric'
                maxLength={EXPECTED_GTIN_LENGTH}
                value={values.expectedGtin}
                onChange={(event) =>
                  setValues((currentValues) => ({
                    ...currentValues,
                    expectedGtin: sanitizeExpectedGtinInput(event.target.value),
                  }))
                }
                placeholder='10884524001425'
                disabled={isSubmitting}
              />
            </label>

            <label className='adminField'>
              <span>Filter label</span>
              <input
                type='text'
                value={values.filterLabel}
                onChange={(event) =>
                  setValues((currentValues) => ({
                    ...currentValues,
                    filterLabel: event.target.value,
                  }))
                }
                placeholder='P000027957'
                disabled={isSubmitting || isCopyMode}
              />
            </label>

            <label className='adminField'>
              <span>Expected lot length</span>
              <input
                type='number'
                min='1'
                value={values.expectedLotLength}
                onChange={(event) =>
                  setValues((currentValues) => ({
                    ...currentValues,
                    expectedLotLength: event.target.value,
                  }))
                }
                placeholder='9'
                disabled={isSubmitting || isCopyMode}
              />
            </label>

            <label className='adminField adminFieldFull'>
              <span>Notas</span>
              <textarea
                value={values.notes}
                onChange={(event) =>
                  setValues((currentValues) => ({
                    ...currentValues,
                    notes: event.target.value,
                  }))
                }
                placeholder='Notas opcionales'
                disabled={isSubmitting || isCopyMode}
                rows={4}
              />
            </label>
          </div>

          <label className='adminCheckboxRow'>
            <input
              type='checkbox'
              checked={values.isActive}
              onChange={(event) =>
                setValues((currentValues) => ({
                  ...currentValues,
                  isActive: event.target.checked,
                }))
              }
              disabled={isSubmitting || isCopyMode}
            />
            <span>Activo</span>
          </label>

          <p className='adminFieldHint'>
            {isCopyMode
              ? 'Los demas campos quedan bloqueados para clonar la configuracion actual y cambiar solo el numero de parte o el Expected GTIN.'
              : isDoubleScan
              ? 'En doble lectura son obligatorios RFID Program, Expected GTIN y Expected Lot Length.'
              : `Para manual o single scan, los campos tecnicos son opcionales. Si capturas Expected GTIN, debe tener ${EXPECTED_GTIN_LENGTH} digitos.`}
          </p>

          {errorMessage && <div className='adminMessage error'>{errorMessage}</div>}

          <div className='adminModalFooter'>
            <button className='buttonSelector' type='button' onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button className='buttonSelector' type='submit' disabled={isSubmitting}>
              {isSubmitting ? submittingLabel : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default PartConfigFormModal;
