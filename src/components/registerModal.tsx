import type {User} from '../types/Auth';
import '../css/loginModal.css';

type RegisterModalProps = {
  onClose: () => void;
  onSuccess: (user: User) => void;
};

function RegisterModal({onClose, onSuccess}: RegisterModalProps) {
  const user: User = {
    id: "1",
    username: "changeandcode",
    password: "cac",
    email: "contacto@changeandcode.com",
    role: "admin"
  };

  return (
    <section>
      <div className='modalOverLayer'>
        <div className='modalContent'>
          <div>
            <h1>Registro</h1>
          </div>
          <h2>Username</h2>
          <input placeholder="changeAndCode"></input>
          <h2>Password</h2>
          <input placeholder="contrasena01"></input>
          <h2>email</h2>
          <input placeholder="contacto@changeandcode.com"></input>
          <h2>role</h2>
          <input placeholder="admin"></input>
          <div className=''>
            <button className='buttonSelector' onClick={() => onSuccess(user)}>Registrar</button>
            <button className='buttonSelector' onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default RegisterModal;
