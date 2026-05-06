import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmActionModal from '../../components/confirmActionModal';
import PartConfigFormModal from '../../components/partConfigFormModal';
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
  const [partConfigs, setPartConfigs] = useState<PartConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<DashboardMessage | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPartConfig, setEditingPartConfig] = useState<PartConfig | null>(null);
  const [copyingPartConfig, setCopyingPartConfig] = useState<PartConfig | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAdminAction | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

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

  return (
    <>
      <section className='square adminDashboard'>
        <div className='adminHeader'>
          <div className='adminHeaderCopy'>
            <h1>Administrador</h1>
            <p>Panel para administrar configuraciones de numeros de parte.</p>
          </div>

          <div className='adminSessionBox'>
            <h2>Usuario activo: {user?.username}</h2>
            <p>Correo: {user?.email}</p>
            <button
              className='buttonSelector'
              type='button'
              onClick={() => {
                logout();
                navigate('/', { replace: true });
              }}
            >
              {'Cerrar Sesi\u00f3n'}
            </button>
          </div>
        </div>

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

          {message && <div className={`adminMessage ${message.type}`}>{message.text}</div>}

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

      {isCreateModalOpen && (
        <PartConfigFormModal
          title='Crear numero de parte'
          submitLabel='Guardar configuracion'
          submittingLabel='Guardando...'
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreatePartConfig}
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
