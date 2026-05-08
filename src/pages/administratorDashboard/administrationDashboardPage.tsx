import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLogo from '../../assets/conmedImages/conmedLogo.png';
import AppSceneLayout from '../../components/appSceneLayout';
import ConfirmActionModal from '../../components/confirmActionModal';
import PartConfigFormModal from '../../components/partConfigFormModal';
import RegisterModal from '../../components/registerModal';
import '../../css/administratorDashboard.css';
import { useAuth } from '../../context/AuthContext';
import {
  activatePartConfig,
  createPartConfig,
  deactivatePartConfig,
  listPartConfigs,
  permanentlyDeletePartConfig,
  updatePartConfig,
} from '../../services/partConfigService';
import type { PartConfig, PartConfigMutationPayload } from '../../types/PartConfig';

type DashboardMessage = {
  type: 'info' | 'error' | 'success';
  text: string;
};

type PendingAdminAction =
  | { type: 'activate'; config: PartConfig }
  | { type: 'deactivate'; config: PartConfig }
  | { type: 'deletePermanent'; config: PartConfig };

type AdminSectionId =
  | 'dashboard'
  | 'partNumbers'
  | 'gtin'
  | 'rfidProgram'
  | 'serviceOrder'
  | 'users';

type AdminSectionDefinition = {
  id: AdminSectionId;
  label: string;
  description: string;
};

const ADMIN_SECTIONS: AdminSectionDefinition[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Resumen general del entorno administrativo.',
  },
  {
    id: 'partNumbers',
    label: 'Numeros de parte',
    description: 'Administra configuraciones activas e historicas del sistema.',
  },
  {
    id: 'gtin',
    label: 'GTIN',
    description: 'Espacio reservado para futuras herramientas de GTIN.',
  },
  {
    id: 'rfidProgram',
    label: 'RFID Program',
    description: 'Espacio reservado para futuras herramientas de programas RFID.',
  },
  {
    id: 'serviceOrder',
    label: 'Orden de servicio',
    description: 'Espacio reservado para futuras herramientas de ordenes de servicio.',
  },
  {
    id: 'users',
    label: 'Usuarios',
    description: 'Registro y administracion basica de usuarios.',
  },
];

const formatDate = (value?: string) => {
  if (!value) {
    return 'N/D';
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'N/D';
  }

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsedDate);
};

const formatReadingMode = (readingMode: PartConfig['readingMode']) => {
  switch (readingMode) {
    case 'manual':
      return 'Manual';
    case 'single_scan':
      return 'Escaneo simple';
    case 'double_scan':
      return 'Doble lectura';
    default:
      return readingMode;
  }
};

function AdministrationDashboardPage() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [activeSection, setActiveSection] = useState<AdminSectionId>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [partConfigs, setPartConfigs] = useState<PartConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<DashboardMessage | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [editingPartConfig, setEditingPartConfig] = useState<PartConfig | null>(null);
  const [copyingPartConfig, setCopyingPartConfig] = useState<PartConfig | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAdminAction | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const activeSectionConfig =
    ADMIN_SECTIONS.find((section) => section.id === activeSection) ?? ADMIN_SECTIONS[0];
  const activePartConfigsCount = partConfigs.filter((config) => config.isActive).length;
  const inactivePartConfigsCount = partConfigs.length - activePartConfigsCount;

  const loadPartConfigs = async (options?: { clearMessage?: boolean }) => {
    setIsLoading(true);

    if (options?.clearMessage ?? true) {
      setMessage(null);
    }

    try {
      const configs = await listPartConfigs();
      setPartConfigs(configs);
      return true;
    } catch (error) {
      setPartConfigs([]);
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudo conectar con el backend para cargar numeros de parte.',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPartConfigs();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const handleSectionChange = (section: AdminSectionId) => {
    setActiveSection(section);
    setIsSidebarOpen(false);
  };

  const handleCreatePartConfig = async (payload: PartConfigMutationPayload) => {
    const result = await createPartConfig(payload);
    setIsCreateModalOpen(false);
    const didRefreshList = await loadPartConfigs({ clearMessage: false });

    if (didRefreshList) {
      setMessage({
        type: 'success',
        text: result.message,
      });
    }
  };

  const handleUpdatePartConfig = async (payload: PartConfigMutationPayload) => {
    if (!editingPartConfig) {
      throw new Error('No se encontro la configuracion que se quiere editar.');
    }

    const result = await updatePartConfig(editingPartConfig._id, payload);
    setEditingPartConfig(null);
    const didRefreshList = await loadPartConfigs({ clearMessage: false });

    if (didRefreshList) {
      setMessage({
        type: 'success',
        text: result.message,
      });
    }
  };

  const handleCopyPartConfig = async (payload: PartConfigMutationPayload) => {
    if (!copyingPartConfig) {
      throw new Error('No se encontro la configuracion que se quiere copiar.');
    }

    const result = await createPartConfig(payload);
    setCopyingPartConfig(null);
    const didRefreshList = await loadPartConfigs({ clearMessage: false });

    if (didRefreshList) {
      setMessage({
        type: 'success',
        text: result.message,
      });
    }
  };

  const handleConfirmPendingAction = async () => {
    if (!pendingAction) {
      return;
    }

    setIsSubmittingAction(true);

    try {
      let result;

      switch (pendingAction.type) {
        case 'activate':
          result = await activatePartConfig(pendingAction.config._id);
          break;
        case 'deactivate':
          result = await deactivatePartConfig(pendingAction.config._id);
          break;
        case 'deletePermanent':
          result = await permanentlyDeletePartConfig(pendingAction.config._id);
          break;
      }

      setPendingAction(null);
      const didRefreshList = await loadPartConfigs({ clearMessage: false });

      if (didRefreshList) {
        setMessage({
          type: 'success',
          text: result.message,
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudo completar la accion solicitada para el numero de parte.',
      });
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const renderPlaceholderSection = (title: string, description: string) => (
    <section className='adminSectionStack'>
      <article className='adminEmptyStateCard'>
        <div className='adminSectionCardHeader'>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <p className='adminEmptyStateCopy'>Sin contenido por ahora.</p>
      </article>
    </section>
  );

  const renderDashboardSection = () => (
    <section className='adminSectionStack'>
      <div className='adminMetricsGrid'>
        <article className='adminMetricCard adminMetricCardPrimary'>
          <span className='adminMetricLabel'>Total de configuraciones</span>
          <strong className='adminMetricValue'>
            {isLoading ? '...' : String(partConfigs.length)}
          </strong>
          <p>Registros disponibles en el backend para trabajar en el administrador.</p>
        </article>

        <article className='adminMetricCard'>
          <span className='adminMetricLabel'>Activos</span>
          <strong className='adminMetricValue'>
            {isLoading ? '...' : String(activePartConfigsCount)}
          </strong>
          <p>Configuraciones habilitadas para operar en el sistema.</p>
        </article>

        <article className='adminMetricCard'>
          <span className='adminMetricLabel'>Inactivos</span>
          <strong className='adminMetricValue'>
            {isLoading ? '...' : String(inactivePartConfigsCount)}
          </strong>
          <p>Configuraciones conservadas en historial o pendientes de reactivar.</p>
        </article>
      </div>

      <article className='adminInfoCard'>
        <div className='adminSectionCardHeader'>
          <h3>Sesion administrativa</h3>
          <p>Referencia rapida del usuario autenticado y del estado general del modulo.</p>
        </div>

        <div className='adminInfoGrid'>
          <div className='adminInfoItem'>
            <span>Usuario activo</span>
            <strong>{user?.username ?? 'N/D'}</strong>
          </div>
          <div className='adminInfoItem'>
            <span>Correo</span>
            <strong>{user?.email ?? 'N/D'}</strong>
          </div>
          <div className='adminInfoItem'>
            <span>Seccion recomendada</span>
            <strong>Numeros de parte</strong>
          </div>
        </div>
      </article>
    </section>
  );

  const renderPartNumbersSection = () => (
    <section className='adminSectionStack'>
      <div className='adminToolbar'>
        <div>
          <h2>Numeros de parte</h2>
          <p>Mostrando datos reales del backend.</p>
        </div>

        <div className='adminToolbarActions'>
          <button
            className='buttonSelector'
            type='button'
            onClick={() => {
              setMessage(null);
              setIsCreateModalOpen(true);
            }}
          >
            Crear nuevo
          </button>
          <button className='buttonSelector' type='button' onClick={() => void loadPartConfigs()}>
            Recargar
          </button>
        </div>
      </div>

      <div className='adminTableCard'>
        <div className='adminTableHeader'>
          <h3>Listado de configuraciones</h3>
          <p className='adminTableMeta'>
            {isLoading ? 'Cargando...' : `${partConfigs.length} registros encontrados`}
          </p>
        </div>

        <div className='adminTableWrapper'>
          <table className='adminTable'>
            <thead>
              <tr>
                <th>Numero de parte</th>
                <th>Modo</th>
                <th>Fecha de creacion</th>
                <th>Quien lo creo</th>
                <th>Estatus</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className='adminTableEmpty'>
                    Cargando numeros de parte...
                  </td>
                </tr>
              ) : partConfigs.length === 0 ? (
                <tr>
                  <td colSpan={6} className='adminTableEmpty'>
                    No hay configuraciones registradas por mostrar.
                  </td>
                </tr>
              ) : (
                partConfigs.map((config) => (
                  <tr key={config._id}>
                    <td>{config.partNumber}</td>
                    <td>{formatReadingMode(config.readingMode)}</td>
                    <td>{formatDate(config.createdAt)}</td>
                    <td>{config.createdBy?.trim() ? config.createdBy : 'N/D'}</td>
                    <td>
                      <span className={`adminBadge ${config.isActive ? 'active' : 'inactive'}`}>
                        {config.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className='adminActionRow'>
                        <button
                          className='adminActionButton'
                          type='button'
                          onClick={() => {
                            setMessage(null);
                            setEditingPartConfig(config);
                          }}
                        >
                          Editar
                        </button>
                        <button
                          className='adminActionButton'
                          type='button'
                          onClick={() => {
                            setMessage(null);
                            setCopyingPartConfig(config);
                          }}
                        >
                          Copiar
                        </button>
                        <button
                          className='adminActionButton'
                          type='button'
                          onClick={() => {
                            setMessage(null);
                            setPendingAction({
                              type: config.isActive ? 'deactivate' : 'activate',
                              config,
                            });
                          }}
                        >
                          {config.isActive ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          className='adminActionButton delete'
                          type='button'
                          onClick={() => {
                            setMessage(null);
                            setPendingAction({
                              type: 'deletePermanent',
                              config,
                            });
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );

  const renderUsersSection = () => (
    <section className='adminSectionStack'>
      <article className='adminInfoCard'>
        <div className='adminSectionCardHeader'>
          <h3>Usuarios</h3>
          <p>Desde aqui se mantiene el acceso administrativo del sistema.</p>
        </div>

        <div className='adminInfoGrid'>
          <div className='adminInfoItem'>
            <span>Usuario activo</span>
            <strong>{user?.username ?? 'N/D'}</strong>
          </div>
          <div className='adminInfoItem'>
            <span>Correo</span>
            <strong>{user?.email ?? 'N/D'}</strong>
          </div>
          <div className='adminInfoItem'>
            <span>Accion disponible</span>
            <strong>Registrar usuario</strong>
          </div>
        </div>

        <div className='adminToolbarActions'>
          <button
            className='buttonSelector'
            type='button'
            onClick={() => {
              setMessage(null);
              setIsRegisterModalOpen(true);
            }}
          >
            Registrar usuario
          </button>
        </div>
      </article>
    </section>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return renderDashboardSection();
      case 'partNumbers':
        return renderPartNumbersSection();
      case 'gtin':
        return renderPlaceholderSection(
          'GTIN',
          'Este espacio queda listo para agregar vistas o herramientas especificas de GTIN.',
        );
      case 'rfidProgram':
        return renderPlaceholderSection(
          'RFID Program',
          'Este espacio queda listo para agregar vistas o herramientas especificas de RFID Program.',
        );
      case 'serviceOrder':
        return renderPlaceholderSection(
          'Orden de servicio',
          'Este espacio queda listo para agregar vistas o herramientas especificas de ordenes de servicio.',
        );
      case 'users':
        return renderUsersSection();
      default:
        return null;
    }
  };

  return (
    <>
      <AppSceneLayout className='adminScene' showLogo={false}>
        <section className='adminDashboardShell'>
          <button
            className={`adminSidebarBackdrop ${isSidebarOpen ? 'open' : ''}`}
            type='button'
            aria-label='Cerrar menu lateral'
            onClick={() => setIsSidebarOpen(false)}
          />

          <aside className={`adminSidebar ${isSidebarOpen ? 'open' : ''}`}>
            <div className='adminSidebarHeader'>
              <img className='adminSidebarLogo' src={AdminLogo} alt='Conmed RFID' />
              <div className='adminSidebarBrandCopy'>
                <span>ConMed RFID</span>
                <strong>Administrador</strong>
              </div>
            </div>

            <div className='adminSidebarContent'>
              <p className='adminSidebarCaption'>Navegacion</p>
              <nav className='adminSidebarNav' aria-label='Secciones del administrador'>
                {ADMIN_SECTIONS.map((section) => (
                  <button
                    key={section.id}
                    className={`adminSidebarNavButton ${
                      activeSection === section.id ? 'active' : ''
                    }`}
                    type='button'
                    onClick={() => handleSectionChange(section.id)}
                  >
                    {section.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className='adminSidebarFooter'>
              <div className='adminSidebarUserMeta'>
                <span>{user?.username ?? 'Administrador'}</span>
                <small>{user?.email ?? 'Sin correo disponible'}</small>
              </div>

              <button className='buttonSelector adminSidebarLogoutButton' type='button' onClick={handleLogout}>
                Cerrar sesion
              </button>
            </div>
          </aside>

          <section className='adminMainPanel'>
            <header className='adminContentHeader'>
              <button
                className='adminSidebarToggle'
                type='button'
                aria-label='Abrir menu lateral'
                aria-expanded={isSidebarOpen}
                onClick={() => setIsSidebarOpen((currentValue) => !currentValue)}
              >
                Menu
              </button>

              <div className='adminContentHeaderCopy'>
                <p className='adminContentEyebrow'>Panel administrativo</p>
                <h1>{activeSectionConfig.label}</h1>
                <p>{activeSectionConfig.description}</p>
              </div>
            </header>

            {message && <div className={`adminMessage ${message.type}`}>{message.text}</div>}

            <div className='adminSectionViewport'>{renderSectionContent()}</div>
          </section>
        </section>
      </AppSceneLayout>

      {isCreateModalOpen && (
        <PartConfigFormModal
          title='Crear numero de parte'
          submitLabel='Guardar configuracion'
          submittingLabel='Guardando...'
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreatePartConfig}
        />
      )}

      {isRegisterModalOpen && (
        <RegisterModal
          onClose={() => setIsRegisterModalOpen(false)}
          onSuccess={(nextUser) => {
            setIsRegisterModalOpen(false);
            setMessage({
              type: 'success',
              text: `Usuario ${nextUser.username} registrado correctamente.`,
            });
          }}
        />
      )}

      {editingPartConfig && (
        <PartConfigFormModal
          title={`Editar ${editingPartConfig.partNumber}`}
          submitLabel='Guardar cambios'
          submittingLabel='Actualizando...'
          initialData={editingPartConfig}
          onClose={() => setEditingPartConfig(null)}
          onSubmit={handleUpdatePartConfig}
        />
      )}

      {copyingPartConfig && (
        <PartConfigFormModal
          title={`Copiar ${copyingPartConfig.partNumber}`}
          submitLabel='Guardar copia'
          submittingLabel='Guardando copia...'
          initialData={copyingPartConfig}
          copySourcePartNumber={copyingPartConfig.partNumber}
          onClose={() => setCopyingPartConfig(null)}
          onSubmit={handleCopyPartConfig}
        />
      )}

      {pendingAction && (
        <ConfirmActionModal
          title={
            pendingAction.type === 'deletePermanent'
              ? 'Confirmar eliminacion permanente'
              : pendingAction.type === 'deactivate'
                ? 'Confirmar desactivacion'
                : 'Confirmar activacion'
          }
          message={
            pendingAction.type === 'deletePermanent'
              ? `Se eliminara permanentemente el numero de parte ${pendingAction.config.partNumber}. Esta accion no se puede deshacer.`
              : pendingAction.type === 'deactivate'
                ? `Se desactivara el numero de parte ${pendingAction.config.partNumber}. Deseas continuar?`
                : `Se activara el numero de parte ${pendingAction.config.partNumber}. Deseas continuar?`
          }
          confirmLabel={
            pendingAction.type === 'deletePermanent'
              ? 'Eliminar'
              : pendingAction.type === 'deactivate'
                ? 'Desactivar'
                : 'Activar'
          }
          confirmVariant={pendingAction.type === 'deletePermanent' ? 'danger' : 'default'}
          isSubmitting={isSubmittingAction}
          onCancel={() => setPendingAction(null)}
          onConfirm={handleConfirmPendingAction}
        />
      )}
    </>
  );
}

export default AdministrationDashboardPage;
