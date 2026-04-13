import '../../css/programmingDashboard.css';
import '../../index.css';
import { useState } from 'react';

type Mode = "Manual" | "Scan" | null;

function programmingDashboardPage() {
  const [port, setPort] = useState("");
  const [mode, setMode] = useState<Mode>(null);
  const [option, setOption] = useState("");
  
  return (
    <>
      <section className='square'>
        <div className='generalBlock'>
          <h1>ESTACIÓN DE PROGRAMACIÓN</h1>
          <div className='statusUser'>
            <h2>usuario: </h2>
            <h2>status: </h2>
            <h2>fecha/hora: </h2>
          </div>
          <div>
            <h2>Serial Port</h2>
            <select aria-label='SerialPort' value={port} onChange={(p)=> setPort(p.target.value)}>
              <option value=''>Selecciona</option>
              <option value='port1'>COM 3</option>
              <option value='port2'>COM 5</option>
            </select>
          </div>
          <div className='buttonBox'>
            <button className='buttonSelector' onClick={()=>setMode("Manual")} disabled={!port}>Ingreso Manual</button>
            <button className='buttonSelector' onClick={()=>setMode("Scan")} disabled={!port}>Escaner Código</button>
          </div>
          <button className='buttonSelector'>Cerrar Sesión</button>
        </div>
      </section>

      {/* //Modals */}
      {mode === "Manual" &&(
        <section className='generalBlock'>
          <div>
            <h2>Ingreso Manual</h2>
            <button onClick={()=> setMode(null)}>close</button>
          </div>
          
          <h3>Selecciona:</h3>
          <div>
            <h3>Número de Parte:</h3>
            <select aria-label='partNumber' value={option} onChange={(e)=> setOption(e.target.value)}>
              <option value=''>Selecciona</option>
              <option value='op1'>partNumber 1</option>
              <option value='op2'>partNumber 2</option>
            </select>
            <h3>Número de Lote:</h3>
            <input
              type='string'
              placeholder='QWE123ASD12'
            />
            <h3>Fecha de Manufactura</h3>
            <input 
              type='datetime-local'
              placeholder='2026-05-12'
            />
            <button>Ingresar valores</button>
          </div>
        </section>
      )}

      {mode === "Scan" &&(
        <section>
          {/* aquí tu bloque de inputs escaneo */}
        </section>
      )}
    </>
  )
}

export default programmingDashboardPage;