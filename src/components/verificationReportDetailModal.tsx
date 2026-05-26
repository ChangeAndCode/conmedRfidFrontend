import type { VerificationReport } from '../types/VerificationReport';

type VerificationReportDetailModalProps = {
  report: VerificationReport;
  canReprint: boolean;
  onClose: () => void;
  onOpenPrint: (report: VerificationReport) => void;
  onOpenReprint: (report: VerificationReport) => void;
  onMarkPrintInterrupted: (report: VerificationReport) => void;
};

const formatDate = (value?: string) => {
  if (!value) {
    return 'N/D';
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'N/D';
  }

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsedDate);
};

function VerificationReportDetailModal({
  report,
  canReprint,
  onClose,
  onOpenPrint,
  onOpenReprint,
  onMarkPrintInterrupted,
}: VerificationReportDetailModalProps) {
  const canMarkPrinted = report.availableActions?.canMarkPrinted ?? false;
  const canMarkPrintInterrupted = report.availableActions?.canMarkPrintInterrupted ?? false;
  const canReprintReport = canReprint && (report.availableActions?.canReprint ?? false);

  return (
    <section className='adminModalOverlay' onClick={onClose}>
      <div className='adminModalCard adminVerificationReportDetailCard' onClick={(event) => event.stopPropagation()}>
        <div className='adminModalHeader'>
          <div className='adminModalTitleBlock'>
            <h2>{`Reporte ${report.serviceOrderFolio}`}</h2>
            <p>
            Snapshot congelado de la orden verificada, con filas, encabezado y eventos de
            impresion.
          </p>
          </div>
          <div className='adminToolbarActions'>
            {canMarkPrinted && (
              <button
                className='adminPrimaryButton'
                type='button'
                onClick={() => onOpenPrint(report)}
              >
                Imprimir / Guardar PDF
              </button>
            )}
            {canMarkPrintInterrupted && (
              <button
                className='adminPrimaryButton adminSecondaryButton'
                type='button'
                onClick={() => onMarkPrintInterrupted(report)}
              >
                Marcar interrumpida
              </button>
            )}
            {canReprintReport && (
              <button
                className='adminPrimaryButton'
                type='button'
                onClick={() => onOpenReprint(report)}
              >
                Reimprimir
              </button>
            )}
            <button className='adminPrimaryButton adminSecondaryButton' type='button' onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>

        <div className='adminReportDetailGrid'>
          <div className='adminInfoItem'>
            <span>Estado</span>
            <strong>{report.status}</strong>
          </div>
          <div className='adminInfoItem'>
            <span>Tipo de orden</span>
            <strong>{report.serviceOrderReadingMode}</strong>
          </div>
          <div className='adminInfoItem'>
            <span>Cantidad</span>
            <strong>{report.quantity}</strong>
          </div>
          <div className='adminInfoItem'>
            <span>Numero de parte</span>
            <strong>{report.partNumber}</strong>
          </div>
          <div className='adminInfoItem'>
            <span>Lote</span>
            <strong>{report.lot}</strong>
          </div>
          <div className='adminInfoItem'>
            <span>Fecha de manufactura</span>
            <strong>{report.manufactureDate}</strong>
          </div>
          <div className='adminInfoItem'>
            <span>Manufactura</span>
            <strong>{report.manufacturingRepresentativeName}</strong>
          </div>
          <div className='adminInfoItem'>
            <span>Calidad</span>
            <strong>{report.qualityRepresentativeName}</strong>
          </div>
          <div className='adminInfoItem'>
            <span>Generado por</span>
            <strong>{report.generatedByUsername?.trim() || 'N/D'}</strong>
          </div>
        </div>

        <div className='adminInfoGrid adminInfoGridCompact'>
          <div className='adminInfoItem'>
            <span>Creado</span>
            <strong>{formatDate(report.createdAt)}</strong>
          </div>
          <div className='adminInfoItem'>
            <span>Ultima impresion</span>
            <strong>{formatDate(report.lastPrintedAt)}</strong>
          </div>
          <div className='adminInfoItem'>
            <span>Ultima interrupcion</span>
            <strong>{formatDate(report.lastPrintInterruptedAt)}</strong>
          </div>
          <div className='adminInfoItem'>
            <span>Ultima reimpresion</span>
            <strong>{formatDate(report.lastReprintedAt)}</strong>
          </div>
        </div>

        <div className='adminTableCard adminReportDetailTableCard'>
          <div className='adminTableHeader'>
            <h3>Filas congeladas</h3>
            <p className='adminTableMeta'>{`${report.rows.length} registros verificados`}</p>
          </div>

          <div className='adminTableWrapper'>
            <table className='adminTable'>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Programming record</th>
                  <th>Programado</th>
                  <th>Verificado</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, index) => (
                  <tr key={row.programmingRecordId}>
                    <td>{index + 1}</td>
                    <td>{row.programmingRecordId}</td>
                    <td>{formatDate(row.programmedAt)}</td>
                    <td>{formatDate(row.verifiedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className='adminTableCard adminReportDetailTableCard'>
          <div className='adminTableHeader'>
            <h3>Historial</h3>
            <p className='adminTableMeta'>{`${report.history.length} eventos registrados`}</p>
          </div>

          <div className='adminTableWrapper'>
            <table className='adminTable'>
              <thead>
                <tr>
                  <th>Evento</th>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Interrupcion</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {report.history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className='adminTableEmpty'>
                      No hay historial disponible.
                    </td>
                  </tr>
                ) : (
                  report.history.map((event, index) => (
                    <tr key={`${event.type}-${event.occurredAt}-${index}`}>
                      <td>{event.type}</td>
                      <td>{formatDate(event.occurredAt)}</td>
                      <td>{event.performedByUsername?.trim() || 'N/D'}</td>
                      <td>{event.interruptionTitle?.trim() || 'N/D'}</td>
                      <td>{event.notes?.trim() || 'Sin notas'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

export default VerificationReportDetailModal;
