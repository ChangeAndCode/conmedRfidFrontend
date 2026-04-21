import type {User} from '../types/Auth';
import '../css/loginModal.css';

type LoginModalProps ={
  onClose:()=> void;
  onSuccess: (user:User) => void;
  onOpenRegister: ()=> void;
};

function LoginModal({onClose, onSuccess}: LoginModalProps) {

  const user:User={
    id: "1",
    username: "changeandcode",
    password: "cac",
    email: "contacto@changeandcode.com",
    role: "admin"
  };

  return (
    <>
        <section>
      <div className='modalOverLayer'>
        <div className='modalContent'>
          <div>
            <h1>Login</h1>
          </div>
          <h2>Username</h2>
          <input placeholder="changeAndCode"></input>
          <h2>Password</h2>
          <input placeholder="contraseña01"></input>
          <h2>email</h2>
          <input placeholder="contacto@changeandcode.com"></input>
          <h2>role</h2>
          <input placeholder="admin"></input>
          <div className=''>
            <button className='buttonSelector' onClick={()=>onSuccess(user)}>Iniciar Sesión</button>
            <button className='buttonSelector' onClick={onClose}>Cerrar</button>
          </div>
          <div>
            <h2>Registro nuevo usuario</h2>
            
          </div>
        </div>
      </div>
    </section>
    {/* Modals */}
    
    </>
  )
}

export default LoginModal
