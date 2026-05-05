import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function AdministrationDashboardPage() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  return (
    <>
      <section className='square'>
        <div>
          <h1>Administrador</h1>
          <h2>Usuario activo: {user?.username}</h2>
          <h3>Correo: {user?.email}</h3>
        </div>
        <div>
          <div>
            <h1>Lectura de RFID</h1>
          </div>
          <div>
            <h2>{'Lectura de doble c\u00f3digo'}</h2>
          </div>
          <div>
            <h2>{'Programaci\u00f3n manual'}</h2>
          </div>
          <button>Bot\u00f3n</button>
        </div>
        <button
          className='buttonSelector'
          type='button'
          onClick={() => {
            logout();
            navigate('/', { replace: true });
          }}
        >
          {'Cerrar Sesi\u00f3n'}
        </button>
      </section>
    </>
  );
}

export default AdministrationDashboardPage;
