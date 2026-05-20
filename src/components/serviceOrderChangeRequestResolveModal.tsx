import { useState, type FormEvent } from 'react';
import type {
  ResolveServiceOrderChangeRequestPayload,
  ServiceOrder,
  ServiceOrderChangeRequest,
  ServiceOrderReadingMode,
} from '../types/ServiceOrder';

type ResolveFormValues = {
  folio: string;
  readingMode: ServiceOrderReadingMode;
  partNumber: string;
  gtin: string;
  rfidProgram: string;
  quantity: string;
  status: 'open' | 'closed';
  notes: string;
  resolutionNotes: string;
};

type ServiceOrderChangeRequestResolveModalProps = {
  serviceOrder: ServiceOrder;
  changeRequest: ServiceOrderChangeRequest;
  onClose: () => void;
  onSubmit: (payload: ResolveServiceOrderChangeRequestPayload) => Promise<void>;
};

const GTIN_LENGTH = 14;

const sanitizeGtinInput = (value: string) => value.replace(/\D/g, '').slice(0, GTIN_LENGTH);

const getRequestTypeLabel = (requestType: ServiceOrderChangeRequest['requestType']) => {
  switch (requestType) {
    case 'missing_product':
      return 'Falta producto';
    case 'extra_product':
      return 'Sobra producto';
    default:
      return requestType;
  }
};

const getServiceOrderProgrammedCount = (serviceOrder: ServiceOrder) =>
  serviceOrder.programmedCount ?? 0;

const getServiceOrderVerifiedCount = (serviceOrder: ServiceOrder) =>
  serviceOrder.verifiedCount ?? 0;

const getServiceOrderRemainingToProgram = (serviceOrder: ServiceOrder) =>
  Math.max(
    serviceOrder.remainingToProgram ??
      (serviceOrder.quantity - getServiceOrderProgrammedCount(serviceOrder)),
    0,
  );

const getServiceOrderRemainingToVerify = (serviceOrder: ServiceOrder) =>
  Math.max(
    serviceOrder.remainingToVerify ??
      (serviceOrder.quantity - getServiceOrderVerifiedCount(serviceOrder)),
    0,
  );

function ServiceOrderChangeRequestResolveModal({
  serviceOrder,
  changeRequest,
  onClose,
  onSubmit,
}: ServiceOrderChangeRequestResolveModalProps) {
  const [values, setValues] = useState<ResolveFormValues>({
    folio: serviceOrder.folio,
    readingMode: serviceOrder.readingMode,
    partNumber: serviceOrder.partNumber ?? '',
    gtin: serviceOrder.gtin ?? '',
    rfidProgram: serviceOrder.rfidProgram ?? '',
    quantity: String(serviceOrder.quantity),
    status: 'open',
    notes: serviceOrder.notes ?? '',
    resolutionNotes: '',
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isPartNumberBasedOrder =
    values.readingMode === 'manual' || values.readingMode === 'single_scan';
  const programmedCount = getServiceOrderProgrammedCount(serviceOrder);
  const verifiedCount = getServiceOrderVerifiedCount(serviceOrder);
  const minimumQuantityAllowed = Math.max(programmedCount, verifiedCount, 1);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const readingMode = values.readingMode;
    const partNumber = values.partNumber.trim().toUpperCase();
    const gtin = values.gtin.trim();
    const rfidProgram = values.rfidProgram.trim().toUpperCase();
    const notes = values.notes.trim();
    const resolutionNotes = values.resolutionNotes.trim();
    const parsedQuantity = Number.parseInt(values.quantity.trim(), 10);

    if (!values.quantity.trim()) {
      setErrorMessage('Completa la cantidad.');
      return;
    }

    if (readingMode === 'manual' || readingMode === 'single_scan') {
      if (!partNumber) {
        setErrorMessage(
          `Completa el numero de parte para la orden ${readingMode === 'single_scan' ? 'single scan' : 'manual'}.`,
        );
        return;
      }
    } else {
      if (!gtin || !rfidProgram) {
        setErrorMessage('Completa GTIN y RFID Program para la orden de doble codigo.');
        return;
      }

      if (gtin.length !== GTIN_LENGTH) {
        setErrorMessage(`El GTIN debe contener exactamente ${GTIN_LENGTH} digitos.`);
        return;
      }
    }

    if (Number.isNaN(parsedQuantity) || parsedQuantity <= 0) {
      setErrorMessage('La cantidad debe ser un entero positivo.');
      return;
    }

    if (parsedQuantity < minimumQuantityAllowed) {
      setErrorMessage(
        `La cantidad no puede ser menor que ${minimumQuantityAllowed} porque la orden ya acumula ${programmedCount} programados y ${verifiedCount} verificados.`,
      );
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
        notes: notes || undefined,
        resolutionNotes: resolutionNotes || undefined,
        status: values.status,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'No se pudo resolver la solicitud de cambio.',
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
            <h2>{`Resolver ${changeRequest.serviceOrderFolio}`}</h2>
            <p>{`Motivo: ${getRequestTypeLabel(changeRequest.requestType)}.`}</p>
          </div>
          <button className='adminPrimaryButton adminSecondaryButton' type='button' onClick={onClose} disabled={isSubmitting}>
            Cerrar
          </button>
        </div>

        <form className='adminForm' onSubmit={handleSubmit}>
          <div className='adminFormGrid'>
            <label className='adminField'>
              <span>Folio</span>
              <input
                type='text'
                value={values.folio}
                disabled
                readOnly
              />
            </label>

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
                <option value='single_scan'>Single Scan</option>
                <option value='double_scan'>Doble codigo</option>
              </select>
            </label>

            {isPartNumberBasedOrder ? (
              <label className='adminField'>
                <span>Numero de parte</span>
                <input
                  type='text'
                  value={values.partNumber}
                  onChange={(event) =>
                    setValues((currentValues) => ({
                      ...currentValues,
                      partNumber: event.target.value.toUpperCase(),
                    }))
                  }
                  disabled={isSubmitting}
                  required
                />
              </label>
            ) : (
              <>
                <label className='adminField'>
                  <span>GTIN</span>
                  <input
                    type='text'
                    inputMode='numeric'
                    maxLength={GTIN_LENGTH}
                    value={values.gtin}
                    onChange={(event) =>
                      setValues((currentValues) => ({
                        ...currentValues,
                        gtin: sanitizeGtinInput(event.target.value),
                      }))
                    }
                    disabled={isSubmitting}
                    required
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
                        rfidProgram: event.target.value.toUpperCase(),
                      }))
                    }
                    disabled={isSubmitting}
                    required
                  />
                </label>
              </>
            )}

            <label className='adminField'>
              <span>Cantidad</span>
              <input
                type='number'
                min={String(minimumQuantityAllowed)}
                step='1'
                value={values.quantity}
                onChange={(event) =>
                  setValues((currentValues) => ({
                    ...currentValues,
                    quantity: event.target.value,
                  }))
                }
                disabled={isSubmitting}
                required
              />
            </label>

            <label className='adminField'>
              <span>Status final</span>
              <select
                value={values.status}
                onChange={(event) =>
                  setValues((currentValues) => ({
                    ...currentValues,
                    status: event.target.value as 'open' | 'closed',
                  }))
                }
                disabled={isSubmitting}
              >
                <option value='open'>Open</option>
                <option value='closed'>Closed</option>
              </select>
            </label>

            <label className='adminField adminFieldFull'>
              <span>Notas de la orden</span>
              <textarea
                value={values.notes}
                onChange={(event) =>
                  setValues((currentValues) => ({
                    ...currentValues,
                    notes: event.target.value,
                  }))
                }
                disabled={isSubmitting}
                rows={3}
              />
            </label>

            <label className='adminField adminFieldFull'>
              <span>Notas de resolucion</span>
              <textarea
                value={values.resolutionNotes}
                onChange={(event) =>
                  setValues((currentValues) => ({
                    ...currentValues,
                    resolutionNotes: event.target.value,
                  }))
                }
                placeholder='Explica el ajuste realizado'
                disabled={isSubmitting}
                rows={3}
              />
            </label>
          </div>

          <div className='adminMessage info'>
            {`Avance actual: ${programmedCount} programados, ${verifiedCount} verificados, ${getServiceOrderRemainingToProgram(serviceOrder)} pendientes por programar y ${getServiceOrderRemainingToVerify(serviceOrder)} pendientes por verificar. La cantidad no puede bajar de ${minimumQuantityAllowed}.`}
          </div>

          {errorMessage && <div className='adminMessage error'>{errorMessage}</div>}

          <div className='adminModalFooter'>
            <button className='adminPrimaryButton adminSecondaryButton' type='button' onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button className='adminPrimaryButton' type='submit' disabled={isSubmitting}>
              {isSubmitting ? 'Resolviendo...' : 'Resolver solicitud'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default ServiceOrderChangeRequestResolveModal;
