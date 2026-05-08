import { useState, type FormEvent } from 'react';
import type { Gtin } from '../types/Gtin';
import type { PartConfig, PartConfigMutationPayload, ReadingMode } from '../types/PartConfig';
import type { RfidProgram } from '../types/RfidProgram';

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
  gtins: Gtin[];
  rfidPrograms: RfidProgram[];
  isCatalogLoading?: boolean;
  initialData?: Partial<PartConfig>;
  copySourcePartNumber?: string;
};

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
  gtins,
  rfidPrograms,
  isCatalogLoading = false,
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
  const activeGtins = gtins.filter((gtin) => gtin.isActive);
  const activeRfidPrograms = rfidPrograms.filter((rfidProgram) => rfidProgram.isActive);
  const hasActiveExpectedGtin = activeGtins.some((gtin) => gtin.value === values.expectedGtin);
  const hasActiveRfidProgram = activeRfidPrograms.some(
    (rfidProgram) => rfidProgram.value === values.rfidProgram,
  );
  const showUnavailableExpectedGtin =
    values.expectedGtin.trim().length > 0 && !hasActiveExpectedGtin;
  const showUnavailableRfidProgram = values.rfidProgram.trim().length > 0 && !hasActiveRfidProgram;

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

    if (rawExpectedGtin && !activeGtins.some((gtin) => gtin.value === rawExpectedGtin)) {
      setErrorMessage('El GTIN seleccionado no existe o no esta activo.');
      return;
    }

    if (trimmedRfidProgram && !activeRfidPrograms.some((rfidProgram) => rfidProgram.value === trimmedRfidProgram)) {
      setErrorMessage('El RFID program seleccionado no existe o no esta activo.');
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

    if (isCatalogLoading) {
      setErrorMessage('Los catalogos aun se estan cargando. Intenta de nuevo en un momento.');
      return;
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
                ? 'Se reutilizaran los datos del registro original. Cambia el numero de parte y, si hace falta, selecciona otro GTIN o RFID Program.'
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
              <select
                value={values.rfidProgram}
                onChange={(event) =>
                  setValues((currentValues) => ({
                    ...currentValues,
                    rfidProgram: event.target.value,
                  }))
                }
                disabled={isSubmitting || isCatalogLoading}
              >
                <option value=''>Selecciona un RFID Program</option>
                {showUnavailableRfidProgram && (
                  <option value={values.rfidProgram}>
                    {`${values.rfidProgram} (inactivo o no disponible)`}
                  </option>
                )}
                {activeRfidPrograms.map((rfidProgram) => (
                  <option key={rfidProgram._id} value={rfidProgram.value}>
                    {rfidProgram.value}
                  </option>
                ))}
              </select>
            </label>

            <label className='adminField'>
              <span>Expected GTIN</span>
              <select
                value={values.expectedGtin}
                onChange={(event) =>
                  setValues((currentValues) => ({
                    ...currentValues,
                    expectedGtin: event.target.value,
                  }))
                }
                disabled={isSubmitting || isCatalogLoading}
              >
                <option value=''>Selecciona un GTIN</option>
                {showUnavailableExpectedGtin && (
                  <option value={values.expectedGtin}>
                    {`${values.expectedGtin} (inactivo o no disponible)`}
                  </option>
                )}
                {activeGtins.map((gtin) => (
                  <option key={gtin._id} value={gtin.value}>
                    {gtin.value}
                  </option>
                ))}
              </select>
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
              ? 'Los demas campos quedan bloqueados para clonar la configuracion actual y cambiar solo el numero de parte, el GTIN o el RFID Program.'
              : isDoubleScan
              ? 'En doble lectura son obligatorios RFID Program, Expected GTIN y Expected Lot Length. Ambos deben existir activos en catalogo.'
              : 'Para manual o single scan, los campos tecnicos son opcionales. Si capturas GTIN o RFID Program, deben existir activos en catalogo.'}
          </p>

          {(showUnavailableExpectedGtin || showUnavailableRfidProgram) && (
            <div className='adminMessage info'>
              El registro actual tiene valores de catalogo inactivos o no disponibles. Selecciona opciones activas antes de guardar.
            </div>
          )}

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
