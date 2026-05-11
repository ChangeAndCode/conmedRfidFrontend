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
  const isManualOrder = values.readingMode === 'manual';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const folio = values.folio.trim();
    const readingMode = values.readingMode;
    const partNumber = values.partNumber.trim().toUpperCase();
    const gtin = values.gtin.trim();
    const rfidProgram = values.rfidProgram.trim().toUpperCase();
    const notes = values.notes.trim();
    const resolutionNotes = values.resolutionNotes.trim();
    const parsedQuantity = Number.parseInt(values.quantity.trim(), 10);

    if (!folio || !values.quantity.trim()) {
      setErrorMessage('Completa folio y cantidad.');
      return;
    }

    if (readingMode === 'manual') {
      if (!partNumber) {
        setErrorMessage('Completa el numero de parte para la orden manual.');
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

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onSubmit({
        folio,
        readingMode,
        partNumber: readingMode === 'manual' ? partNumber : undefined,
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
          <button className='buttonSelector' type='button' onClick={onClose} disabled={isSubmitting}>
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
                onChange={(event) =>
                  setValues((currentValues) => ({
                    ...currentValues,
                    folio: event.target.value,
                  }))
                }
                disabled={isSubmitting}
                required
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
                    partNumber: nextReadingMode === 'manual' ? currentValues.partNumber : '',
                    gtin: nextReadingMode === 'double_scan' ? currentValues.gtin : '',
                    rfidProgram: nextReadingMode === 'double_scan' ? currentValues.rfidProgram : '',
                  }));
                }}
                disabled={isSubmitting}
              >
                <option value='manual'>Manual</option>
                <option value='double_scan'>Doble codigo</option>
              </select>
            </label>

            {isManualOrder ? (
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
                min='1'
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

          {errorMessage && <div className='adminMessage error'>{errorMessage}</div>}

          <div className='adminModalFooter'>
            <button className='buttonSelector' type='button' onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button className='buttonSelector' type='submit' disabled={isSubmitting}>
              {isSubmitting ? 'Resolviendo...' : 'Resolver solicitud'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default ServiceOrderChangeRequestResolveModal;
