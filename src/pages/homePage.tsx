import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppSceneLayout from '../components/appSceneLayout';
import LoginModal from '../components/loginModal';
import { useAuth } from '../context/AuthContext';
import '../css/homePage.css';
import type { AuthSession } from '../types/Auth';

type RedirectState = {
  from?: {
    pathname?: string;
  };
};

function HomePage() {
  const [activeModal, setActiveModal] = useState<'login' | null>(null);
  const [loginPrefillEmail, setLoginPrefillEmail] = useState('');
  const [loginFeedbackMessage, setLoginFeedbackMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, logout, setAuthSession, user } = useAuth();

  const redirectPath =
    (location.state as RedirectState | null)?.from?.pathname ?? '/administratorDashboard';

  const handleLoginSuccess = (session: AuthSession) => {
    setLoginPrefillEmail('');
    setLoginFeedbackMessage(null);
    setAuthSession(session);
    setActiveModal(null);
    navigate(redirectPath, { replace: true });
  };

  const openLoginModal = (options?: { email?: string; message?: string | null }) => {
    setLoginPrefillEmail(options?.email ?? '');
    setLoginFeedbackMessage(options?.message ?? null);
    setActiveModal('login');
  };

  const closeLoginModal = () => {
    setLoginPrefillEmail('');
    setLoginFeedbackMessage(null);
    setActiveModal(null);
  };

  return (
    <>
      <AppSceneLayout>
        <section className='square homePageShell'>
          <div className='homePageCard'>
            <div className='titleBlock'>
              <div>
                <h1>{'Estaci\u00f3n de RFID'}</h1>
              </div>
              <p>{'Estaci\u00f3n dise\u00f1ada para procesos dedicados de ConMed'}</p>
            </div>

            <div className='homePage'>
              <div className='homeSelector'>
                <button className='buttonHomeSelector' onClick={() => navigate('/programmingDashboard')}>
                  <h2>{'Programaci\u00f3n'}</h2>
                </button>
                <button className='buttonHomeSelector buttonHomeSelectorVerification' onClick={() => navigate('/verificationDashboard')}>
                  <h2>{'Verificaci\u00f3n'}</h2>
                </button>
              </div>
            </div>

            {isAdmin ? (
              <div className='loginRegisterSelection'>
                <button onClick={() => navigate('/administratorDashboard')} className='buttonSelector'>
                  Panel Administrador
                </button>
                <button
                  onClick={() => {
                    logout();
                    closeLoginModal();
                  }}
                  className='buttonSelector'
                >
                  {'Cerrar Sesi\u00f3n'}
                </button>
                <p className='sessionStatus'>{`Sesi\u00f3n activa: ${user?.username ?? ''}`}</p>
              </div>
            ) : (
              <div className='loginRegisterSelection'>
                <button onClick={() => openLoginModal()} className='buttonSelector homeTextOnlyButton'>
                  {'Iniciar Sesi\u00f3n'}
                </button>
              </div>
            )}
          </div>
        </section>
      </AppSceneLayout>

      {activeModal === 'login' && (
        <LoginModal
          onClose={closeLoginModal}
          onSuccess={handleLoginSuccess}
          initialEmail={loginPrefillEmail}
          feedbackMessage={loginFeedbackMessage}
        />
      )}
    </>
  );
}

export default HomePage;
