import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute() {
  const { canAccessBackoffice } = useAuth();
  const location = useLocation();

  if (!canAccessBackoffice) {
    return <Navigate to='/' replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
