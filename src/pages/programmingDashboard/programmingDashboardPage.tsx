import '../../css/programmingDashboard.css';
import '../../index.css';
import { useState, type FormEvent } from 'react';

type Mode = "Manual" | "Scan" | null;

type ManualPart = {
  partNumber: string;
  rfidProgram: string;
};

type ManualMessage = {
  type: "success" | "error";
  text: string;
};

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const DEFAULT_CREATED_BY = 'frontend-local';

const MANUAL_PARTS: ManualPart[] = [
  { partNumber: 'EMVS353', rfidProgram: 'EMVS353' },
  { partNumber: 'QVC-MSF8D-1', rfidProgram: 'QUANTA-8' },
  { partNumber: 'A2A00231', rfidProgram: 'NUVO-8' },
  { partNumber: 'A74802', rfidProgram: 'A74802' },
  { partNumber: 'A84962', rfidProgram: 'A84962' },
];

function programmingDashboardPage() {
  const [port, setPort] = useState('');
  const [mode, setMode] = useState<Mode>(null);
  const [partNumber, setPartNumber] = useState('');
  const [lot, setLot] = useState('');
  const [manufactureDate, setManufactureDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualMessage, setManualMessage] = useState<ManualMessage | null>(null);

  const selectedPart = MANUAL_PARTS.find((part) => part.partNumber === partNumber);

  const resetManualForm = () => {
    setPartNumber('');
    setLot('');
    setManufactureDate('');
    setManualMessage(null);
  };

  const closeManualModal = () => {
    if (isSubmitting) {
      return;
    }

    resetManualForm();
    setMode(null);
  };

  const handleManualSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedLot = lot.trim();

    if (!partNumber || !trimmedLot || !manufactureDate) {
      setManualMessage({
        type: 'error',
        text: 'Completa número de parte, lote y fecha de manufactura.',
      });
      return;
    }

    setIsSubmitting(true);
    setManualMessage(null);

    try {
      const payload = {
        partNumber,
        lot: trimmedLot,
        manufactureDate,
        rfidProgram: selectedPart?.rfidProgram,
        rawReference: 'manual',
        createdBy: DEFAULT_CREATED_BY,
        notes: 'captura manual',
      };

      const response = await fetch(`${API_URL}/api/manual-reads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.message ?? 'Error al guardar la lectura manual.');
      }

      resetManualForm();
      setManualMessage({
        type: 'success',
        text: result?.message ?? 'Lectura manual registrada.',
      });
    } catch (error) {
      setManualMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo conectar con el backend.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <section className='square'>
        <div className='generalBlock'>
          <h1>ESTACIÓN DE PROGRAMACIÓN</h1>
          <div className='statusUser'>
            <h2>usuario: {DEFAULT_CREATED_BY}</h2>
            <h2>status: listo</h2>
            <h2>fecha/hora: pendiente</h2>
          </div>
          <div>
            <h2>Serial Port</h2>
            <select aria-label='SerialPort' value={port} onChange={(p) => setPort(p.target.value)}>
              <option value=''>Selecciona</option>
              <option value='port1'>COM 3</option>
              <option value='port2'>COM 5</option>
            </select>
          </div>
          <div className='buttonBox'>
            <button className='buttonSelector' onClick={() => setMode('Manual')} disabled={!port}>
              Ingreso Manual
            </button>
            <button className='buttonSelector' onClick={() => setMode('Scan')} disabled={!port}>
              Escaner Código
            </button>
          </div>
          <button className='buttonSelector'>Cerrar Sesión</button>
        </div>
      </section>

      {mode === 'Manual' && (
        <section className='modalOverlay'>
          <div className='square generalBlock modalSquare'>
            <div className='modalHeader'>
              <h2>Ingreso Manual</h2>
              <button className='buttonSelector' onClick={closeManualModal} disabled={isSubmitting}>
                Cerrar
              </button>
            </div>

            <form className='modalForm' onSubmit={handleManualSubmit}>
              <label className='modalField'>
                <span>Número de Parte:</span>
                <select
                  aria-label='partNumber'
                  value={partNumber}
                  onChange={(event) => setPartNumber(event.target.value)}
                  disabled={isSubmitting}
                  required
                >
                  <option value=''>Selecciona</option>
                  {MANUAL_PARTS.map((part) => (
                    <option key={part.partNumber} value={part.partNumber}>
                      {part.partNumber}
                    </option>
                  ))}
                </select>
              </label>

              <label className='modalField'>
                <span>Número de Lote:</span>
                <input
                  type='text'
                  value={lot}
                  onChange={(event) => setLot(event.target.value)}
                  placeholder='QWE123ASD12'
                  disabled={isSubmitting}
                  required
                />
              </label>

              <label className='modalField'>
                <span>Fecha de Manufactura:</span>
                <input
                  type='date'
                  value={manufactureDate}
                  onChange={(event) => setManufactureDate(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </label>

              {selectedPart && (
                <p className='manualHint'>Programa RFID a enviar: {selectedPart.rfidProgram}</p>
              )}

              {manualMessage && (
                <p className={`manualMessage ${manualMessage.type}`}>{manualMessage.text}</p>
              )}

              <button className='buttonSelector modalSubmitButton' type='submit' disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Ingresar valores'}
              </button>
            </form>
          </div>
        </section>
      )}

      {mode === 'Scan' && (
        <section>
          {/* aquí tu bloque de inputs escaneo */}
        </section>
      )}
    </>
  );
}

export default programmingDashboardPage;
