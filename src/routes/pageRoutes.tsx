import {Routes, Route} from 'react-router-dom';
import HomePage from '../pages/homePage';
import ProgrammingDashboard from '../pages/programmingDashboard/programmingDashboardPage';
import VerificationDashboard from '../pages/verificationDashboard/validationDashboardPage';
import AdministratorDashboard from '../pages/administratorDashboard/administrationDashboardPage';

export default function AppRoutes(){
    return(
        <Routes>
            <Route path='/' element={<HomePage/>}/>
            <Route path='/programmingDashboard' element={<ProgrammingDashboard/>}/>
            <Route path='/verificationDashboard' element={<VerificationDashboard/>}/>
            <Route path='/administratorDashboard' element ={<AdministratorDashboard/>}/>
        </Routes>
    )
}