import type {User} from '../types/Auth';

type LoginModalProps ={
  onClose:()=> void;
  onSuccess: (user:User) => void;
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
    <section>
      <h1>Login</h1>
      <h2>Username</h2>
      <input placeholder="changeAndCode"></input>
      <h2>Password</h2>
      <input placeholder="contraseña01"></input>
      <h2>email</h2>
      <input placeholder="contacto@changeandcode.com"></input>
      <h2>role</h2>
      <input placeholder="admin"></input>
      <button onClick={()=>onSuccess(user)}>Iniciar Sesión</button>
      <button onClick={onClose}>Cerrar</button>
      <h2>Registro nuevo usuario</h2>
      <button>Registrar Usuario</button>
    </section>
  )
}

export default LoginModal
