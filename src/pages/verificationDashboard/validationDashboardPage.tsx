import AppSceneLayout from '../../components/appSceneLayout';
import '../../css/verificationDashboard.css';

function ValidationDashboardPage() {
  return (
    <AppSceneLayout>
      <section className='square verificationDashboardShell'>
        <div className='verificationDashboardCard'>
          <h1>{'ESTACI\u00d3N DE VERIFICACI\u00d3N'}</h1>
          <p>Espacio reservado para el flujo de validacion y revision de lecturas RFID.</p>
        </div>
      </section>
    </AppSceneLayout>
  );
}

export default ValidationDashboardPage;
