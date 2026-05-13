import '../css/programmingRecordsQuickReference.css';
import type { ProgrammingRecord } from '../types/ProgrammingRecord';

type ProgrammingRecordsQuickReferenceProps = {
  programmedRecords: ProgrammingRecord[];
  verifiedRecords: ProgrammingRecord[];
  isLoading?: boolean;
  title?: string;
  description?: string;
};

const formatDateTime = (value?: string) => {
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

const formatModeLabel = (mode: ProgrammingRecord['mode']) => {
  switch (mode) {
    case 'manual':
      return 'Manual';
    case 'single_scan':
      return 'Single Scan';
    case 'double_scan':
      return 'Doble codigo';
    default:
      return mode;
  }
};

const getTimestamp = (value?: string) => {
  if (!value) {
    return 0;
  }

  const parsedDate = new Date(value).getTime();
  return Number.isNaN(parsedDate) ? 0 : parsedDate;
};

const getProgrammedSummary = (record: ProgrammingRecord) => {
  const leftValue =
    record.gtin?.trim() ||
    record.rawSourceData.rawReference?.trim() ||
    record.rfidProgram?.trim() ||
    'Sin referencia';
  const rightValue = record.lot?.trim() || record.manufactureDate?.trim() || 'Sin detalle';

  return `${leftValue} | ${rightValue}`;
};

function ProgrammingRecordsQuickReference({
  programmedRecords,
  verifiedRecords,
  isLoading = false,
  title = 'Referencia rapida',
  description = 'Consulta los programming records recientes con status `programmed` y `verified`.',
}: ProgrammingRecordsQuickReferenceProps) {
  const sortedProgrammedRecords = [...programmedRecords]
    .sort((left, right) => getTimestamp(right.createdAt) - getTimestamp(left.createdAt))
    .slice(0, 6);
  const sortedVerifiedRecords = [...verifiedRecords]
    .sort(
      (left, right) =>
        getTimestamp(right.verifiedAt ?? right.updatedAt) -
        getTimestamp(left.verifiedAt ?? left.updatedAt),
    )
    .slice(0, 6);

  return (
    <article className='programmingRecordsQuickReferenceCard'>
      <div className='programmingRecordsQuickReferenceHeader'>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      <div className='programmingRecordsQuickReferenceMetrics'>
        <div className='programmingRecordsQuickReferenceMetric'>
          <span>Programmed</span>
          <strong>{isLoading ? '...' : programmedRecords.length}</strong>
        </div>
        <div className='programmingRecordsQuickReferenceMetric'>
          <span>Verified</span>
          <strong>{isLoading ? '...' : verifiedRecords.length}</strong>
        </div>
      </div>

      <div className='programmingRecordsQuickReferenceColumns'>
        <div className='programmingRecordsQuickReferenceListCard'>
          <div className='programmingRecordsQuickReferenceMiniHeader'>
            <h4>Programmed</h4>
            <span>{isLoading ? 'Cargando...' : programmedRecords.length}</span>
          </div>

          <div className='programmingRecordsQuickReferenceList'>
            {sortedProgrammedRecords.length === 0 ? (
              <p className='programmingRecordsQuickReferenceEmptyState'>
                {isLoading
                  ? 'Cargando lista...'
                  : 'No hay programming records programmed por mostrar.'}
              </p>
            ) : (
              sortedProgrammedRecords.map((record) => (
                <div key={record._id} className='programmingRecordsQuickReferenceItem'>
                  <strong>{record.serviceOrderFolio || record.partNumber}</strong>
                  <span>{`${formatModeLabel(record.mode)} | ${record.partNumber}`}</span>
                  <small>{getProgrammedSummary(record)}</small>
                </div>
              ))
            )}
          </div>
        </div>

        <div className='programmingRecordsQuickReferenceListCard'>
          <div className='programmingRecordsQuickReferenceMiniHeader'>
            <h4>Verified</h4>
            <span>{isLoading ? 'Cargando...' : verifiedRecords.length}</span>
          </div>

          <div className='programmingRecordsQuickReferenceList'>
            {sortedVerifiedRecords.length === 0 ? (
              <p className='programmingRecordsQuickReferenceEmptyState'>
                {isLoading
                  ? 'Cargando lista...'
                  : 'No hay programming records verified por mostrar.'}
              </p>
            ) : (
              sortedVerifiedRecords.map((record) => (
                <div key={record._id} className='programmingRecordsQuickReferenceItem'>
                  <strong>{record.serviceOrderFolio || record.partNumber}</strong>
                  <span>{`${formatModeLabel(record.mode)} | ${record.partNumber}`}</span>
                  <small>{`${formatDateTime(record.verifiedAt)} | ${record.verifiedBy || 'Sin usuario'}`}</small>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default ProgrammingRecordsQuickReference;
