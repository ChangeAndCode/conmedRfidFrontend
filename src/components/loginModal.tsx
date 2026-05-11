import { useState, type FormEvent } from 'react';
import '../css/loginModal.css';
import { login } from '../services/authService';
import type { AuthSession, LoginCredentials } from '../types/Auth';

type LoginModalProps = {
  onClose: () => void;
  onSuccess: (session: AuthSession) => void;
  initialEmail?: string;
  feedbackMessage?: string | null;
};

function LoginModal({
  onClose,
  onSuccess,
  initialEmail = '',
  feedbackMessage = null,
}: LoginModalProps) {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: initialEmail,
    password: '',
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedEmail = credentials.email.trim();
    const trimmedPassword = credentials.password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setErrorMessage('Captura correo y contrasena para iniciar sesion.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const session = await login({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (session.user.isActive === false) {
        throw new Error('El usuario existe, pero esta inactivo.');
      }

      if (session.user.role !== 'admin' && session.user.role !== 'supervisor') {
        throw new Error('El usuario no tiene permisos para entrar al panel de control.');
      }

      onSuccess(session);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'No se pudo conectar con el backend.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section>
      <div className='modalOverLayer' onClick={isSubmitting ? undefined : onClose}>
        <div className='modalContent' onClick={(event) => event.stopPropagation()}>
          <form onSubmit={handleSubmit} className='modalFormContent'>
            <div>
              <h1>Login</h1>
            </div>

            <label className='modalField'>
              <span>Email</span>
              <input
                type='email'
                value={credentials.email}
                placeholder='contacto@empresa.com'
                autoComplete='email'
                onChange={(event) =>
                  setCredentials((currentCredentials) => ({
                    ...currentCredentials,
                    email: event.target.value,
                  }))
                }
                disabled={isSubmitting}
                required
              />
            </label>

            <label className='modalField'>
              <span>Password</span>
              <input
                type='password'
                value={credentials.password}
                placeholder='12345678'
                autoComplete='current-password'
                onChange={(event) =>
                  setCredentials((currentCredentials) => ({
                    ...currentCredentials,
                    password: event.target.value,
                  }))
                }
                disabled={isSubmitting}
                required
              />
            </label>

            {!errorMessage && feedbackMessage && (
              <p className='modalMessage success'>{feedbackMessage}</p>
            )}

            {errorMessage && <p className='modalMessage error'>{errorMessage}</p>}

            <div>
              <button className='buttonSelector' type='submit' disabled={isSubmitting}>
                {isSubmitting ? 'Validando...' : 'Iniciar Sesion'}
              </button>
              <button className='buttonSelector' type='button' onClick={onClose} disabled={isSubmitting}>
                Cerrar
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

export default LoginModal;
