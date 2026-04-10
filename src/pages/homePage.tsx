import {Link} from 'react-router-dom'
function homePage() {
  
  return (
    <>
      <section className='square'>
        <div >
          <h1>Estación de RFID</h1>
          <Link to='/login'>
            <h2>Estación de programación</h2>
          </Link>
          <Link to='/login'>
            <h2>Estación de verificación</h2>
          </Link>
          <p>
            Estación diseñada para procesos dedicados de ConMed
          </p>
        </div>
      </section>
    </>
  )
}

export default homePage;