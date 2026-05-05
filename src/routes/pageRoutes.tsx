import { Route, Routes } from 'react-router-dom';
import AdministratorDashboard from '../pages/administratorDashboard/administrationDashboardPage';
import HomePage from '../pages/homePage';
import ProgrammingDashboard from '../pages/programmingDashboard/programmingDashboardPage';
import VerificationDashboard from '../pages/verificationDashboard/validationDashboardPage';
import ProtectedRoute from './ProtectedRoute';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path='/' element={<HomePage />} />
      <Route path='/programmingDashboard' element={<ProgrammingDashboard />} />
      <Route path='/verificationDashboard' element={<VerificationDashboard />} />
      <Route element={<ProtectedRoute />}>
        <Route path='/administratorDashboard' element={<AdministratorDashboard />} />
      </Route>
    </Routes>
  );
}
