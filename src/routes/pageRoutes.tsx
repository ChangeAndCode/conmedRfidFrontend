import {Routes, Route} from 'react-router-dom';
import HomePage from '../pages/homePage';
import LoginPage from '../pages/loginPage';

export default function AppRoutes(){
    return(
        <Routes>
            <Route path='/' element={<HomePage/>}/>
            <Route path='/login' element={<LoginPage/>}/>
        </Routes>
    )
}