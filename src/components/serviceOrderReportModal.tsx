import type { ServiceOrder, ServiceOrderChangeRequest } from '../types/ServiceOrder';
import '../css/administratorDashboard.css';

type ServiceOrderReportModalProps = {
  serviceOrder: ServiceOrder;
  requestType: ServiceOrderChangeRequest['requestType'];
  notes: string;
  onRequestTypeChange: (
    requestType: ServiceOrderChangeRequest['requestType'],
  ) => void;
  onNotesChange: (notes: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export default function ServiceOrderReportModal({
  serviceOrder,
  requestType,
  notes,
  onRequestTypeChange,
  onNotesChange,
  onClose,
  onSubmit,
}: ServiceOrderReportModalProps) {
  return (
    <section className='adminModalOverlay'>
      <div className='adminModalCard adminServiceOrderReportModal'>
        <div className='adminModalHeader'>
          <div className='adminModalTitleBlock'>
            <h2>{`Reportar incidencia ${serviceOrder.folio}`}</h2>
            <p>Registra una solicitud de cambio para esta orden de servicio.</p>
          </div>

          <button
            className='adminPrimaryButton adminSecondaryButton'
            type='button'
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>

        <form
          className='adminForm'
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div className='adminFormGrid'>
            <label className='adminField'>
              <span>Motivo</span>
              <select
                value={requestType}
                onChange={(event) =>
                  onRequestTypeChange(
                    event.target.value as ServiceOrderChangeRequest['requestType'],
                  )
                }
              >
                <option value='missing_product'>Falta producto</option>
                <option value='extra_product'>Sobra producto</option>
              </select>
            </label>

            <label className='adminField adminFieldFull'>
              <span>Notas</span>
              <textarea
                value={notes}
                rows={5}
                placeholder='Describe el motivo de la solicitud...'
                onChange={(event) => onNotesChange(event.target.value)}
              />
            </label>
          </div>

          <p className='adminFieldHint'>
            Esta solicitud aparecerá en la sección de solicitudes de cambio pendientes.
          </p>

          <div className='adminModalFooter'>
            <button
              className='adminPrimaryButton adminSecondaryButton'
              type='button'
              onClick={onClose}
            >
              Cancelar
            </button>
            <button className='adminPrimaryButton' type='submit'>
              Reportar
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}