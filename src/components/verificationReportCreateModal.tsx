import { useState, type FormEvent } from 'react';
import '../css/administratorDashboard.css';
import type { ServiceOrder } from '../types/ServiceOrder';
import type { CreateVerificationReportPayload } from '../types/VerificationReport';

type VerificationReportCreateModalProps = {
  serviceOrder: ServiceOrder;
  onClose: () => void;
  onSubmit: (payload: CreateVerificationReportPayload) => Promise<void>;
};

const formatServiceOrderReadingMode = (readingMode: ServiceOrder['readingMode']) => {
  switch (readingMode) {
    case 'manual':
      return 'Manual';
    case 'single_scan':
      return 'Single Scan';
    case 'double_scan':
      return 'Doble codigo';
    default:
      return readingMode;
  }
};

const formatServiceOrderPrimaryReference = (serviceOrder: ServiceOrder) => {
  if (serviceOrder.readingMode === 'manual' || serviceOrder.readingMode === 'single_scan') {
    return serviceOrder.partNumber?.trim() || 'Sin numero de parte';
  }

  return serviceOrder.gtin?.trim() || 'Sin GTIN';
};

const getServiceOrderProgrammedCount = (serviceOrder: ServiceOrder) =>
  serviceOrder.programmedCount ?? 0;

const getServiceOrderVerifiedCount = (serviceOrder: ServiceOrder) =>
  serviceOrder.verifiedCount ?? 0;

const getServiceOrderRemainingToVerify = (serviceOrder: ServiceOrder) =>
  Math.max(
    serviceOrder.remainingToVerify ??
      (serviceOrder.quantity - getServiceOrderVerifiedCount(serviceOrder)),
    0,
  );

function VerificationReportCreateModal({
  serviceOrder,
  onClose,
  onSubmit,
}: VerificationReportCreateModalProps) {
  const [manufacturingRepresentativeName, setManufacturingRepresentativeName] = useState('');
  const [qualityRepresentativeName, setQualityRepresentativeName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextManufacturingRepresentativeName = manufacturingRepresentativeName.trim();
    const nextQualityRepresentativeName = qualityRepresentativeName.trim();

    if (!nextManufacturingRepresentativeName) {
      setErrorMessage('Captura el nombre del responsable de manufactura.');
      return;
    }

    if (!nextQualityRepresentativeName) {
      setErrorMessage('Captura el nombre del responsable de calidad.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onSubmit({
        serviceOrderId: serviceOrder._id,
        manufacturingRepresentativeName: nextManufacturingRepresentativeName,
        qualityRepresentativeName: nextQualityRepresentativeName,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'No se pudo generar el reporte de verificacion.',
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
            <h2>{`Generar reporte para ${serviceOrder.folio}`}</h2>
            <p>
              El backend congelara encabezado, filas verificadas y nombres de manufactura/calidad
              en un solo reporte por orden.
            </p>
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
          <div className='adminInfoGrid adminInfoGridCompact'>
            <div className='adminInfoItem'>
              <span>Folio</span>
              <strong>{serviceOrder.folio}</strong>
            </div>
            <div className='adminInfoItem'>
              <span>Tipo</span>
              <strong>{formatServiceOrderReadingMode(serviceOrder.readingMode)}</strong>
            </div>
            <div className='adminInfoItem'>
              <span>Referencia</span>
              <strong>{formatServiceOrderPrimaryReference(serviceOrder)}</strong>
            </div>
            <div className='adminInfoItem'>
              <span>Cantidad</span>
              <strong>{serviceOrder.quantity}</strong>
            </div>
            <div className='adminInfoItem'>
              <span>Programados</span>
              <strong>{getServiceOrderProgrammedCount(serviceOrder)}</strong>
            </div>
            <div className='adminInfoItem'>
              <span>Verificados</span>
              <strong>{getServiceOrderVerifiedCount(serviceOrder)}</strong>
            </div>
          </div>

          <div className='adminMessage info'>
            {`La orden debe estar cerrada, con todas sus verificaciones completas y con 0 pendientes por verificar. Pendientes actuales: ${getServiceOrderRemainingToVerify(serviceOrder)}.`}
          </div>

          <div className='adminFormGrid'>
            <label className='adminField'>
              <span>Responsable de manufactura</span>
              <input
                type='text'
                value={manufacturingRepresentativeName}
                onChange={(event) => setManufacturingRepresentativeName(event.target.value)}
                placeholder='Nombre completo'
                disabled={isSubmitting}
                required
              />
            </label>

            <label className='adminField'>
              <span>Responsable de calidad</span>
              <input
                type='text'
                value={qualityRepresentativeName}
                onChange={(event) => setQualityRepresentativeName(event.target.value)}
                placeholder='Nombre completo'
                disabled={isSubmitting}
                required
              />
            </label>
          </div>

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
              {isSubmitting ? 'Generando...' : 'Generar reporte'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default VerificationReportCreateModal;
