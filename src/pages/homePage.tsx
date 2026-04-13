import { useState } from 'react';
import LoginModal from '../components/loginModal';
import {useNavigate, Link} from 'react-router-dom';
import '../css/homePage.css';

type Station = "programming" | "verification";

function homePage() {
  const [showLogin, setShowLogin] = useState(false);
  const [station, setStation] = useState<Station| null>(null);
  const navigate = useNavigate();

  const handleStationClick = (s: Station)=>{
    setStation(s);
    setShowLogin(true);
  }
  return (
    <>
      <section className='square'>
        <div >
          <h1>Estación de RFID</h1>
          <button onClick={()=> handleStationClick("programming")}>
            <h2>Estación de programación</h2>
          </button>
          <button onClick={()=> handleStationClick("verification")}>
            <h2>Estación de verificación</h2>
          </button>
          <p>
            Estación diseñada para procesos dedicados de ConMed
          </p>
        </div>
      </section>
      {/* Modals */}
      {showLogin && 
          <LoginModal 
            onClose={()=> setShowLogin(false)}
            onSuccess={(user)=>{
              console.log("Usuario: ", user);
              setShowLogin(false);

              if (station === "programming") navigate("/programmingDashboard");
              if (station === "verification") navigate("/verificationDashboard");
              if (!station) return;
            }}
          />
        }
    </>
  )
}

export default homePage;