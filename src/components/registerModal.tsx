import { useState, type FormEvent } from 'react';
import '../css/loginModal.css';
import { registerUser } from '../services/authService';
import type { RegisterPayload, User, UserRole } from '../types/Auth';

type RegisterModalProps = {
  onClose: () => void;
  onSuccess: (user: User) => void;
};

type RegisterFormValues = RegisterPayload & {
  confirmPassword: string;
};

const INITIAL_FORM_VALUES: RegisterFormValues = {
  username: '',
  email: '',
  password: '',
  role: 'supervisor',
  confirmPassword: '',
};

function RegisterModal({ onClose, onSuccess }: RegisterModalProps) {
  const [formValues, setFormValues] = useState<RegisterFormValues>(INITIAL_FORM_VALUES);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const username = formValues.username.trim();
    const email = formValues.email.trim();
    const password = formValues.password.trim();
    const confirmPassword = formValues.confirmPassword.trim();
    const role = formValues.role as UserRole;

    if (!username || !email || !password || !confirmPassword) {
      setErrorMessage('Completa nombre de usuario, correo, contrasena y rol.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('La contrasena debe tener al menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('La confirmacion de contrasena no coincide.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const user = await registerUser({
        username,
        email,
        password,
        role,
      });

      onSuccess(user);
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
              <h1>Registro</h1>
            </div>

            <label className='modalField'>
              <span>Usuario</span>
              <input
                type='text'
                value={formValues.username}
                placeholder='usuario 123'
                autoComplete='username'
                onChange={(event) =>
                  setFormValues((currentValues) => ({
                    ...currentValues,
                    username: event.target.value,
                  }))
                }
                disabled={isSubmitting}
                required
              />
            </label>

            <label className='modalField'>
              <span>Correo electrónico</span>
              <input
                type='email'
                value={formValues.email}
                placeholder='contacto@empresa.com'
                autoComplete='email'
                onChange={(event) =>
                  setFormValues((currentValues) => ({
                    ...currentValues,
                    email: event.target.value,
                  }))
                }
                disabled={isSubmitting}
                required
              />
            </label>

            <label className='modalFieldUser'>
              <span>Rol</span>
              <select
                value={formValues.role}
                onChange={(event) =>
                  setFormValues((currentValues) => ({
                    ...currentValues,
                    role: event.target.value as UserRole,
                  }))
                }
                disabled={isSubmitting}
                required
              >
                <option value='supervisor'>Supervisor</option>
                <option value='admin'>Admin</option>
              </select>
            </label>

            <label className='modalField'>
              <span>Contraseña</span>
              <input
                type='password'
                value={formValues.password}
                placeholder='Crea una contraseña'
                autoComplete='new-password'
                minLength={8}
                onChange={(event) =>
                  setFormValues((currentValues) => ({
                    ...currentValues,
                    password: event.target.value,
                  }))
                }
                disabled={isSubmitting}
                required
              />
            </label>

            <label className='modalField'>
              <span>Confirmar contraseña</span>
              <input
                type='password'
                value={formValues.confirmPassword}
                placeholder='Confirma la nueva contraseña'
                autoComplete='new-password'
                minLength={8}
                onChange={(event) =>
                  setFormValues((currentValues) => ({
                    ...currentValues,
                    confirmPassword: event.target.value,
                  }))
                }
                disabled={isSubmitting}
                required
              />
            </label>

            {errorMessage && <p className='modalMessage error'>{errorMessage}</p>}

            <div className='adminToolbarActions'>
              <button className='adminPrimaryButton' type='submit' disabled={isSubmitting}>
                {isSubmitting ? 'Registrando...' : 'Registrar usuario'}
              </button>
              <button className='adminPrimaryButton' type='button' onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

export default RegisterModal;
