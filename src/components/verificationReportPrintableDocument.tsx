import type { VerificationReport } from '../types/VerificationReport';

type VerificationReportPrintableDocumentProps = {
  report: VerificationReport;
};

const formatDateTime = (value?: string | Date) => {
  if (!value) {
    return 'N/D';
  }

  const parsedDate = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'N/D';
  }

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsedDate);
};

function VerificationReportPrintableDocument({
  report,
}: VerificationReportPrintableDocumentProps) {
  return (
    <article className='verificationReportPrintDocument'>
      <header className='verificationReportPrintMetaHeader'>
        <span>{formatDateTime(new Date())}</span>
        <strong>ConMedRFID</strong>
      </header>

      <section className='verificationReportPrintTitleSection'>
        <h1>{`Reporte ${report.serviceOrderFolio}`}</h1>
      </section>

      <section className='verificationReportPrintSection'>
        <h2>Encabezados</h2>

        <div className='verificationReportPrintHeaderGrid'>
          <div className='verificationReportPrintField'>
            <span>Numero de parte</span>
            <strong>{report.partNumber}</strong>
          </div>
          <div className='verificationReportPrintField'>
            <span>Numero de lote</span>
            <strong>{report.lot}</strong>
          </div>
          <div className='verificationReportPrintField'>
            <span>Fecha de manufactura</span>
            <strong>{report.manufactureDate}</strong>
          </div>
        </div>
      </section>

      <section className='verificationReportPrintSection'>
        <h2>Filtros programados y verificados</h2>

        <div className='verificationReportPrintTableWrapper'>
          <table className='verificationReportPrintTable'>
            <thead>
              <tr>
                <th>Numero de RFID</th>
                <th>Fecha y hora de programacion</th>
                <th>Fecha y hora de verificacion</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className='verificationReportPrintEmptyCell'>
                    No hay filtros programados y verificados en este reporte.
                  </td>
                </tr>
              ) : (
                report.rows.map((row) => (
                  <tr key={row.programmingRecordId}>
                    <td>{row.programmingRecordId}</td>
                    <td>{formatDateTime(row.programmedAt)}</td>
                    <td>{formatDateTime(row.verifiedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className='verificationReportPrintSection verificationReportPrintSignatureSection'>
        <h2>Firma de quien libera</h2>

        <div className='verificationReportPrintSignatureGrid'>
          <div className='verificationReportPrintSignatureCard'>
            <div className='verificationReportPrintSignatureBox' aria-hidden='true' />
            <div className='verificationReportPrintSignatureMeta'>
              <strong>{report.manufacturingRepresentativeName}</strong>
              <span>Representante de manufactura</span>
            </div>
          </div>

          <div className='verificationReportPrintSignatureCard'>
            <div className='verificationReportPrintSignatureBox' aria-hidden='true' />
            <div className='verificationReportPrintSignatureMeta'>
              <strong>{report.qualityRepresentativeName}</strong>
              <span>Representante de calidad</span>
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}

export default VerificationReportPrintableDocument;
