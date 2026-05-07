import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LoginModal from '../components/loginModal';
import ProgrammingDashboardParticleBackground from '../components/programmingDashboardParticleBackground';
import RegisterModal from '../components/registerModal';
import { useAuth } from '../context/AuthContext';
import LogoConmed from '../assets/conmedImages/conmed_logo_2.png';
import '../css/homePage.css';
import type { AuthSession } from '../types/Auth';

type RedirectState = {
  from?: {
    pathname?: string;
  };
};

function HomePage() {
  const [activeModal, setActiveModal] = useState<'login' | 'register' | null>(null);
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
      <main className='homePageScene'>
        <ProgrammingDashboardParticleBackground />
        <div className='homePageBackdropGlow homePageBackdropGlowPrimary' aria-hidden='true' />
        <div className='homePageBackdropGlow homePageBackdropGlowSecondary' aria-hidden='true' />

        <section className='square homePageShell'>
          <div className='homePageCard'>
            <div className='titleBlock'>
              <div>
                <h1>{'Estaci\u00f3n de RFID'}</h1>
                <img src={LogoConmed} alt='conmedLogo' />
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
                <button onClick={() => openLoginModal()} className='buttonSelector'>
                  {'Iniciar Sesi\u00f3n'}
                </button>
                <button onClick={() => setActiveModal('register')} className='buttonSelector'>
                  Registrar Usuario
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      {activeModal === 'login' && (
        <LoginModal
          onClose={closeLoginModal}
          onOpenRegister={() => setActiveModal('register')}
          onSuccess={handleLoginSuccess}
          initialEmail={loginPrefillEmail}
          feedbackMessage={loginFeedbackMessage}
        />
      )}

      {activeModal === 'register' && (
        <RegisterModal
          onClose={() => setActiveModal(null)}
          onSuccess={(nextUser) => {
            openLoginModal({
              email: nextUser.email,
              message: 'Usuario registrado correctamente. Ahora inicia sesion.',
            });
          }}
        />
      )}
    </>
  );
}

export default HomePage;
