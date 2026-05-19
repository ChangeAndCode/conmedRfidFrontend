import { useState, type FormEvent } from 'react';
import type { Gtin } from '../types/Gtin';
import type { PartConfig } from '../types/PartConfig';
import type { RfidProgram } from '../types/RfidProgram';
import type {
  ServiceOrder,
  ServiceOrderMutationPayload,
  ServiceOrderReadingMode,
  ServiceOrderStatus,
} from '../types/ServiceOrder';

type ServiceOrderFormValues = {
  folio: string;
  readingMode: ServiceOrderReadingMode;
  partNumber: string;
  gtin: string;
  rfidProgram: string;
  quantity: string;
  status: Extract<ServiceOrderStatus, 'open' | 'closed'>;
  notes: string;
};

type ServiceOrderFormModalProps = {
  title: string;
  submitLabel: string;
  submittingLabel: string;
  onClose: () => void;
  onSubmit: (payload: ServiceOrderMutationPayload) => Promise<void>;
  initialData?: Partial<ServiceOrder>;
  allowStatusSelection?: boolean;
  partConfigs: PartConfig[];
  gtins: Gtin[];
  rfidPrograms: RfidProgram[];
  isCatalogLoading?: boolean;
};

const INITIAL_VALUES: ServiceOrderFormValues = {
  folio: '',
  readingMode: 'manual',
  partNumber: '',
  gtin: '',
  rfidProgram: '',
  quantity: '',
  status: 'open',
  notes: '',
};

const buildFormValues = (initialData?: Partial<ServiceOrder>): ServiceOrderFormValues => ({
  folio: initialData?.folio ?? '',
  readingMode: initialData?.readingMode ?? 'manual',
  partNumber: initialData?.partNumber ?? '',
  gtin: initialData?.gtin ?? '',
  rfidProgram: initialData?.rfidProgram ?? '',
  quantity: initialData?.quantity ? String(initialData.quantity) : '',
  status: initialData?.status === 'closed' ? 'closed' : 'open',
  notes: initialData?.notes ?? '',
});

const getFolioPrefixByReadingMode = (readingMode: ServiceOrderReadingMode) => {
  switch (readingMode) {
    case 'manual':
      return 'ML';
    case 'single_scan':
      return 'LS';
    case 'double_scan':
      return 'DL';
    default:
      return '';
  }
};

function ServiceOrderFormModal({
  title,
  submitLabel,
  submittingLabel,
  onClose,
  onSubmit,
  initialData,
  allowStatusSelection = false,
  partConfigs,
  gtins,
  rfidPrograms,
  isCatalogLoading = false,
}: ServiceOrderFormModalProps) {
  const [values, setValues] = useState<ServiceOrderFormValues>(() =>
    initialData ? buildFormValues(initialData) : INITIAL_VALUES,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = Boolean(initialData?.folio);
  const isPartNumberBasedOrder =
    values.readingMode === 'manual' || values.readingMode === 'single_scan';
  const generatedFolioPrefix = getFolioPrefixByReadingMode(values.readingMode);
  const activePartNumberConfigs = partConfigs.filter(
    (partConfig) =>
      partConfig.isActive &&
      partConfig.readingMode === values.readingMode &&
      (values.readingMode !== 'single_scan' || Boolean(partConfig.expectedGtin?.trim())),
  );
  const activeGtins = gtins.filter((gtin) => gtin.isActive);
  const activeRfidPrograms = rfidPrograms.filter((rfidProgram) => rfidProgram.isActive);
  const showUnavailablePartNumber =
    values.partNumber.trim().length > 0 &&
    !activePartNumberConfigs.some((partConfig) => partConfig.partNumber === values.partNumber);
  const showUnavailableExpectedGtin =
    values.gtin.trim().length > 0 && !activeGtins.some((gtin) => gtin.value === values.gtin);
  const showUnavailableRfidProgram =
    values.rfidProgram.trim().length > 0 &&
    !activeRfidPrograms.some((rfidProgram) => rfidProgram.value === values.rfidProgram);
  const partNumberOrderLabel =
    values.readingMode === 'single_scan' ? 'single scan con Expected GTIN' : 'manual';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const readingMode = values.readingMode;
    const partNumber = values.partNumber.trim().toUpperCase();
    const gtin = values.gtin.trim();
    const rfidProgram = values.rfidProgram.trim().toUpperCase();
    const notes = values.notes.trim();
    const parsedQuantity = Number.parseInt(values.quantity.trim(), 10);

    if (!values.quantity.trim()) {
      setErrorMessage('Completa la cantidad.');
      return;
    }

    if (readingMode === 'manual' || readingMode === 'single_scan') {
      if (!partNumber) {
        setErrorMessage(
          `Selecciona un numero de parte ${readingMode === 'single_scan' ? 'single scan' : 'manual'}.`,
        );
        return;
      }

      if (
        !activePartNumberConfigs.some((partConfig) => partConfig.partNumber === partNumber)
      ) {
        setErrorMessage(
          `Selecciona un numero de parte ${readingMode === 'single_scan' ? 'single scan activo con Expected GTIN' : 'manual activo'}.`,
        );
        return;
      }
    } else {
      if (!gtin || !rfidProgram) {
        setErrorMessage('Completa GTIN y RFID Program para una orden de doble codigo.');
        return;
      }

      if (!activeGtins.some((catalogGtin) => catalogGtin.value === gtin)) {
        setErrorMessage('Selecciona un GTIN activo del catalogo.');
        return;
      }

      if (
        !activeRfidPrograms.some(
          (catalogRfidProgram) => catalogRfidProgram.value === rfidProgram,
        )
      ) {
        setErrorMessage('Selecciona un RFID Program activo del catalogo.');
        return;
      }
    }

    if (Number.isNaN(parsedQuantity) || parsedQuantity <= 0) {
      setErrorMessage('La cantidad debe ser un entero positivo.');
      return;
    }

    if (isCatalogLoading) {
      setErrorMessage('Los catalogos aun se estan cargando. Intenta de nuevo en un momento.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onSubmit({
        readingMode,
        partNumber: readingMode === 'manual' || readingMode === 'single_scan' ? partNumber : undefined,
        gtin: readingMode === 'double_scan' ? gtin : undefined,
        rfidProgram: readingMode === 'double_scan' ? rfidProgram : undefined,
        quantity: parsedQuantity,
        status: values.status,
        notes: notes || undefined,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'No se pudo guardar la orden de servicio.',
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
              Define si la orden es manual, single scan o de doble codigo. Manual y single scan usan
              numero de parte; doble codigo usa GTIN y RFID Program.
            </p>
          </div>
          <button className='adminPrimaryButton adminSecondaryButton' type='button' onClick={onClose} disabled={isSubmitting}>
            Cerrar
          </button>
        </div>

        <form className='adminForm' onSubmit={handleSubmit}>
          <div className='adminFormGrid'>
            <label className='adminField'>
              <span>Tipo de orden</span>
              <select
                value={values.readingMode}
                onChange={(event) => {
                  const nextReadingMode = event.target.value as ServiceOrderReadingMode;
                  setValues((currentValues) => ({
                    ...currentValues,
                    readingMode: nextReadingMode,
                    partNumber:
                      nextReadingMode === 'manual' || nextReadingMode === 'single_scan'
                        ? currentValues.partNumber
                        : '',
                    gtin: nextReadingMode === 'double_scan' ? currentValues.gtin : '',
                    rfidProgram: nextReadingMode === 'double_scan' ? currentValues.rfidProgram : '',
                  }));
                }}
                disabled={isSubmitting}
              >
                <option value='manual'>Manual</option>
                <option value='single_scan'>Lectura simple</option>
                <option value='double_scan'>Doble escaneo</option>
              </select>
            </label>

            {isEditMode ? (
              <label className='adminField'>
                <span>Folio</span>
                <input type='text' value={values.folio} disabled readOnly />
              </label>
            ) : (
              <div className='adminField adminFieldFull'>
                <span>Folio</span>
                <div className='adminMessage info'>
                  {`El folio se generara automaticamente al guardar con prefijo ${generatedFolioPrefix} y formato ${generatedFolioPrefix}YYYYMMDDHHMMSS.`}
                </div>
              </div>
            )}

            {isPartNumberBasedOrder ? (
              <label className='adminField'>
                <span>Numero de parte</span>
                <select
                  value={values.partNumber}
                  onChange={(event) =>
                    setValues((currentValues) => ({
                      ...currentValues,
                      partNumber: event.target.value,
                    }))
                  }
                  disabled={isSubmitting || isCatalogLoading}
                  required
                  >
                  <option value=''>Selecciona un numero de parte</option>
                  {showUnavailablePartNumber && (
                    <option value={values.partNumber}>
                      {`${values.partNumber} (inactivo o no disponible)`}
                    </option>
                  )}
                  {activePartNumberConfigs.map((partConfig) => (
                    <option key={partConfig._id} value={partConfig.partNumber}>
                      {partConfig.partNumber}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className='adminField'>
                  <span>GTIN</span>
                  <select
                    value={values.gtin}
                    onChange={(event) =>
                      setValues((currentValues) => ({
                        ...currentValues,
                        gtin: event.target.value,
                      }))
                    }
                    disabled={isSubmitting || isCatalogLoading}
                    required
                  >
                    <option value=''>Selecciona un GTIN</option>
                    {showUnavailableExpectedGtin && (
                      <option value={values.gtin}>
                        {`${values.gtin} (inactivo o no disponible)`}
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
                    required
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
              </>
            )}

            <label className='adminField'>
              <span>Cantidad</span>
              <input
                type='number'
                min='1'
                step='1'
                value={values.quantity}
                onChange={(event) =>
                  setValues((currentValues) => ({
                    ...currentValues,
                    quantity: event.target.value,
                  }))
                }
                placeholder='100'
                disabled={isSubmitting}
                required
              />
            </label>

            {allowStatusSelection && (
              <label className='adminField'>
                <span>Estado</span>
                <select
                  value={values.status}
                  onChange={(event) =>
                    setValues((currentValues) => ({
                      ...currentValues,
                      status: event.target.value as Extract<ServiceOrderStatus, 'open' | 'closed'>,
                    }))
                  }
                  disabled={isSubmitting}
                >
                  <option value='open'>Abierto</option>
                  <option value='closed'>Cerrado</option>
                </select>
              </label>
            )}

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
                disabled={isSubmitting}
                rows={4}
              />
            </label>
          </div>

          <p className='adminFieldHint'>
            Las ordenes manuales se amarran a un numero de parte. Las de single scan requieren un
            numero de parte con Expected GTIN. Las de doble codigo se amarran a GTIN y RFID Program.
            El lote ya no forma parte de la orden.
          </p>

          {(showUnavailablePartNumber || showUnavailableExpectedGtin || showUnavailableRfidProgram) && (
            <div className='adminMessage info'>
              El registro actual tiene valores de catalogo inactivos o no disponibles. Selecciona
              opciones activas antes de guardar.
            </div>
          )}

          {!isCatalogLoading && isPartNumberBasedOrder && activePartNumberConfigs.length === 0 && (
            <div className='adminMessage info'>
              {`No hay numeros de parte ${partNumberOrderLabel} disponibles para crear esta orden.`}
            </div>
          )}

          {!isCatalogLoading &&
            !isPartNumberBasedOrder &&
            (activeGtins.length === 0 || activeRfidPrograms.length === 0) && (
              <div className='adminMessage info'>
                No hay catalogos suficientes para crear una orden de doble codigo.
              </div>
            )}

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

export default ServiceOrderFormModal;
