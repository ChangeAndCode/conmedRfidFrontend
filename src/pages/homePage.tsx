import { useState } from 'react';
import LoginModal from '../components/loginModal';
import {useNavigate} from 'react-router-dom';
import '../css/homePage.css';
import LogoConmed from "../assets/conmedImages/conmed_logo_2.png";
import RegisterModal from '../components/registerModal';

function homePage() {
  const [activeModal, setActiveModal] = useState<"login" | "register" | null>(null);

  const navigate = useNavigate();

  return (
    <>
      <section className='square'>
        <div className='titleBlock'>
          <div>
            <h1>Estación de RFID</h1>
            <img src={LogoConmed} alt='conmedLogo'/>
          </div>
          <p>
            Estación diseñada para procesos dedicados de ConMed
          </p>
        </div>
        <div className='homePage'>
          <div className='homeSelector'>
            <button className='buttonHomeSelector' onClick={()=> navigate('/programmingDashboard')}>
            <h2>Programación</h2>
            </button>
            <button className='buttonHomeSelector' onClick={()=> navigate('/verificationDashboard')}>
              <h2>Verificación</h2>
            </button>
          </div>
        </div>
        <div className='loginRegisterSelection'>
          <button onClick={()=> setActiveModal("login")} className='buttonSelector'>Iniciar Sesión</button>
          <button onClick={()=>setActiveModal("register")} className='buttonSelector'>Registrar Usuario</button>
        </div>
      </section>
      {/* Modals */}
      {
        activeModal === "login" &&(
          <LoginModal 
            onClose={()=> setActiveModal(null)}
            onOpenRegister={()=> setActiveModal("register")}
            onSuccess={(user)=>{
              console.log("Usuario: ", user);
              setActiveModal(null);
              navigate('/administratorDashboard');
            }}
          />
        )
      }
      {activeModal === "register" &&(
        <RegisterModal 
        onClose={()=> setActiveModal(null)}
        onSuccess={(user)=>{
          console.log("Usuario: ", user);
          setActiveModal("login");
          }}
        />
        )
      }
    </>
  )
}

export default homePage;