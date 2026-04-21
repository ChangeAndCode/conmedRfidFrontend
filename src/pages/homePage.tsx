import { useState } from 'react';
import LoginModal from '../components/loginModal';
import {useNavigate} from 'react-router-dom';
import '../css/homePage.css';
import LogoConmed from "../assets/conmedImages/conmed_logo_2.png"

function homePage() {
  const [showLogin, setShowLogin] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = ()=>{
    setShowLogin(true);
  }

  return (
    <>
      <section className='square'>
        <div className='homePage'>
          <div className='titleBlock'>
            <div>
              <h1>Estación de RFID</h1>
              <img src={LogoConmed} alt='conmedLogo'/>
            </div>
            <p>
              Estación diseñada para procesos dedicados de ConMed
            </p>
          </div>
          <div className='homeSelector'>
            <button className='buttonHomeSelector' onClick={()=> navigate('/programmingDashboard')}>
            <h2>Programación</h2>
            </button>
            <button className='buttonHomeSelector' onClick={()=> navigate('/verificationDashboard')}>
              <h2>Verificación</h2>
            </button>
          </div>
        </div>
        <div>
          <button onClick={handleSubmit}>Iniciar Sesión</button>
        </div>
      </section>
      {/* Modals */}
      {showLogin && 
          <LoginModal 
            onClose={()=> setShowLogin(false)}
            onSuccess={(user)=>{
              console.log("Usuario: ", user);
              navigate("/administratorDashboard")
              setShowLogin(false);
            }}
          />
        }
    </>
  )
}

export default homePage;