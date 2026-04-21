import type {User} from '../types/Auth';

type RegisterModalProps={
    onClose:()=> void;
    onSuccess:(user:User)=> void;
}

function RegisterModal({onClose, onSuccess}: RegisterModalProps){
    const user:User={
    id: "1",
    username: "changeandcode",
    password: "cac",
    email: "contacto@changeandcode.com",
    role: "admin"
  };
  return(
    <>
      <section>
        <h1>Registro</h1>
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
      </section>
    </>
  )
}

export default RegisterModal;