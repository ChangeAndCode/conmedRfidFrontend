import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLogo from '../../assets/conmedImages/conmedLogo.png';
import AppSceneLayout from '../../components/appSceneLayout';
import ConfirmActionModal from '../../components/confirmActionModal';
import GtinFormModal from '../../components/gtinFormModal';
import PartConfigFormModal from '../../components/partConfigFormModal';
import ResponsibleFormModal from '../../components/responsibleFormModal';
import ProgrammingRecordsQuickReference from '../../components/programmingRecordsQuickReference';
import RegisterModal from '../../components/registerModal';
import RfidProgramFormModal from '../../components/rfidProgramFormModal';
import ServiceOrderChangeRequestResolveModal from '../../components/serviceOrderChangeRequestResolveModal';
import ServiceOrderFormModal from '../../components/serviceOrderFormModal';
import VerificationReportCreateModal from '../../components/verificationReportCreateModal';
import VerificationReportPrintModal from '../../components/verificationReportPrintModal';
import VerificationReportStatusModal from '../../components/verificationReportStatusModal';
import ServiceOrderReportModal from '../../components/serviceOrderReportModal';
import '../../css/administratorDashboard.css';
import { useAuth } from '../../context/useAuth';
import {
  activateGtin,
  createGtin,
  deactivateGtin,
  listGtins,
  updateGtin,
} from '../../services/gtinService';
import {
  activatePartConfig,
  createPartConfig,
  deactivatePartConfig,
  listPartConfigs,
  permanentlyDeletePartConfig,
  updatePartConfig,
} from '../../services/partConfigService';
import {
  createPrintInterruption,
  deletePrintInterruption,
  listPrintInterruptions,
} from '../../services/printInterruptionService';
import {
  activateRfidProgram,
  createRfidProgram,
  deactivateRfidProgram,
  listRfidPrograms,
  updateRfidProgram,
} from '../../services/rfidProgramService';
import {
  getReportResponsibles,
  updateReportResponsibles,
} from '../../services/reportResponsiblesService';
import {
  createServiceOrder,
  createServiceOrderChangeRequest,
  listServiceOrderChangeRequests,
  listServiceOrders,
  resolveServiceOrderChangeRequest,
  updateServiceOrder,
} from '../../services/serviceOrderService';
import {
  createVerificationReport,
  listVerificationReports,
  markVerificationReportAsPrinted,
  markVerificationReportPrintInterrupted,
  reprintVerificationReport,
} from '../../services/verificationReportService';
import { listProgrammingRecords as listProgrammingRecordsService } from '../../services/programmingRecordService';
import type { Gtin, GtinMutationPayload } from '../../types/Gtin';
import type { PartConfig, PartConfigMutationPayload } from '../../types/PartConfig';
import type { PrintInterruption } from '../../types/PrintInterruption';
import type { ProgrammingRecord } from '../../types/ProgrammingRecord';
import type {
  ReportResponsibles,
  ReportResponsiblesMutationPayload,
} from '../../types/ReportResponsibles';
import type { RfidProgram, RfidProgramMutationPayload } from '../../types/RfidProgram';
import type {
  ResolveServiceOrderChangeRequestPayload,
  ServiceOrder,
  ServiceOrderChangeRequest,
  ServiceOrderMutationPayload,
} from '../../types/ServiceOrder';
import type {
  CreateVerificationReportPayload,
  UpdateVerificationReportStatusPayload,
  VerificationReport,
  VerificationReportHistoryEvent,
  VerificationReportStatus,
} from '../../types/VerificationReport';
import {
  deleteUser,
  getUsers,
  updateUserStatus,
} from '../../services/userService';
import type { User } from '../../types/Auth';
import type { Responsible, ResponsibleArea } from "../../types/Responsible";
import {
  createResponsible,
  deleteResponsible,
  getResponsibles,
  toggleResponsibleStatus,
  updateResponsible,
} from "../../services/responsibleService";

type DashboardMessage = {
  type: 'info' | 'error' | 'success';
  text: string;
};

type PendingAdminAction =
  | { type: 'activate'; config: PartConfig }
  | { type: 'deactivate'; config: PartConfig }
  | { type: 'deletePermanent'; config: PartConfig };

type PendingGtinAction =
  | { type: 'activate'; gtin: Gtin }
  | { type: 'deactivate'; gtin: Gtin }
  | { type: 'delete'; gtin: Gtin };

type PendingRfidProgramAction =
  | { type: 'activate'; rfidProgram: RfidProgram }
  | { type: 'deactivate'; rfidProgram: RfidProgram }
  | { type: 'delete'; rfidProgram: RfidProgram };

type PendingUserAction =
  | { type: 'activate'; user: User }
  | { type: 'deactivate'; user: User }
  | { type: 'delete'; user: User };

type PendingResponsibleAction =
  | { type: 'activate'; responsible: Responsible }
  | { type: 'deactivate'; responsible: Responsible }
  | { type: 'delete'; responsible: Responsible };

type PendingVerificationReportAction = {
  report: VerificationReport;
};

type PendingPrintInterruptionAction = {
  interruption: PrintInterruption;
};

type VerificationReportPrintFlow = {
  mode: 'print' | 'reprint';
  report: VerificationReport;
  autoStart: boolean;
};

type AdminSectionId =
  | 'dashboard'
  | 'partNumbers'
  | 'gtin'
  | 'rfidProgram'
  | 'reportResponsibles'
  | 'printInterruptions'
  | 'serviceOrder'
  | 'verificationReports'
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
    description: 'Catálogo de GTIN disponibles para numeros de parte.',
  },
  {
    id: 'rfidProgram',
    label: 'RFID Program',
    description: 'Catálogo del Programa RFID disponibles para numeros de parte.',
  },
  {
    id: 'reportResponsibles',
    label: 'Responsables',
    description: 'Configura los representantes globales que se congelan al generar reportes.',
  },
  {
    id: 'printInterruptions',
    label: 'Interrupciones',
    description: 'Administra el catalogo de causas para impresion interrumpida.',
  },
  {
    id: 'verificationReports',
    label: 'Reportes',
    description: 'Consulta, genera y da seguimiento al ciclo de impresion de reportes.',
  },
  {
    id: 'users',
    label: 'Usuarios',
    description: 'Administra usuarios registrados, permisos de acceso y eliminación.',
  },
];

const SUPERVISOR_SECTIONS: AdminSectionDefinition[] = [
  {
    id: 'serviceOrder',
    label: 'Orden de servicio',
    description: 'El supervisor crea, ajusta y desbloquea ordenes desde esta vista.',
  },
  {
    id: 'verificationReports',
    label: 'Reportes',
    description: 'Genera reportes cerrados y controla los estados de impresion.',
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

const formatServiceOrderStatus = (status: ServiceOrder['status']) => {
  switch (status) {
    case 'open':
      return 'Open';
    case 'blocked':
      return 'Blocked';
    case 'closed':
      return 'Closed';
    default:
      return status;
  }
};

const formatServiceOrderReadingMode = (readingMode: ServiceOrder['readingMode']) => {
  switch (readingMode) {
    case 'manual':
      return 'Manual';
    case 'single_scan':
      return 'Single Scan';
    case 'double_scan':
      return 'Doble codigo';
    default:
      return readingMode;
  }
};

const formatServiceOrderPrimaryReference = (serviceOrder: ServiceOrder) => {
  if (serviceOrder.readingMode === 'manual' || serviceOrder.readingMode === 'single_scan') {
    return serviceOrder.partNumber?.trim() || 'Sin numero de parte';
  }

  return serviceOrder.gtin?.trim() || 'Sin GTIN';
};

const getServiceOrderProgrammedCount = (serviceOrder: ServiceOrder) => serviceOrder.programmedCount ?? 0;

const getServiceOrderVerifiedCount = (serviceOrder: ServiceOrder) => serviceOrder.verifiedCount ?? 0;

const getServiceOrderRemainingToProgram = (serviceOrder: ServiceOrder) =>
  Math.max(
    serviceOrder.remainingToProgram ??
      serviceOrder.quantity - getServiceOrderProgrammedCount(serviceOrder),
    0,
  );

const getServiceOrderRemainingToVerify = (serviceOrder: ServiceOrder) =>
  Math.max(
    serviceOrder.remainingToVerify ??
      serviceOrder.quantity - getServiceOrderVerifiedCount(serviceOrder),
    0,
  );

const formatVerificationReportStatus = (status: VerificationReportStatus) => {
  switch (status) {
    case 'generated':
      return 'Pendiente';
    case 'print_interrupted':
      return 'interrumpido';
    case 'printed':
      return 'Impreso';
    case 'reprinted':
      return 'Reimpreso';
    default:
      return status;
  }
};

const getLatestVerificationReportEvent = (
  report: VerificationReport,
): VerificationReportHistoryEvent | null => {
  if (report.history.length === 0) {
    return null;
  }

  return report.history[report.history.length - 1] ?? null;
};

const formatChangeRequestType = (requestType: ServiceOrderChangeRequest['requestType']) => {
  switch (requestType) {
    case 'missing_product':
      return 'Falta producto';
    case 'extra_product':
      return 'Sobra producto';
    default:
      return requestType;
  }
};


function AdministrationDashboardPage() {
  const navigate = useNavigate();
  const { isAdmin, isSupervisor, logout, user } = useAuth();
  const [activeSection, setActiveSection] = useState<AdminSectionId>(
    isSupervisor ? 'serviceOrder' : 'dashboard',
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [partConfigs, setPartConfigs] = useState<PartConfig[]>([]);
  const [gtins, setGtins] = useState<Gtin[]>([]);
  const [rfidPrograms, setRfidPrograms] = useState<RfidProgram[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [isLoadingResponsibles, setIsLoadingResponsibles] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingGtins, setIsLoadingGtins] = useState(true);
  const [isLoadingRfidPrograms, setIsLoadingRfidPrograms] = useState(true);
  const [message, setMessage] = useState<DashboardMessage | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateGtinModalOpen, setIsCreateGtinModalOpen] = useState(false);
  const [isCreateRfidProgramModalOpen, setIsCreateRfidProgramModalOpen] = useState(false);
  const [isCreateResponsibleModalOpen, setIsCreateResponsibleModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [editingPartConfig, setEditingPartConfig] = useState<PartConfig | null>(null);
  const [editingGtin, setEditingGtin] = useState<Gtin | null>(null);
  const [editingRfidProgram, setEditingRfidProgram] = useState<RfidProgram | null>(null);
  const [editingResponsible, setEditingResponsible] = useState<Responsible | null>(null);
  const [copyingPartConfig, setCopyingPartConfig] = useState<PartConfig | null>(null);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [changeRequests, setChangeRequests] = useState<ServiceOrderChangeRequest[]>([]);
  const [programmedRecords, setProgrammedRecords] = useState<ProgrammingRecord[]>([]);
  const [verifiedRecords, setVerifiedRecords] = useState<ProgrammingRecord[]>([]);
  const [verificationReports, setVerificationReports] = useState<VerificationReport[]>([]);
  const [reportResponsibles, setReportResponsibles] = useState<ReportResponsibles | null>(null);
  const [reportResponsiblesForm, setReportResponsiblesForm] =
    useState<ReportResponsiblesMutationPayload>({
      manufacturingRepresentativeName: '',
      qualityRepresentativeName: '',
    });
  const [printInterruptions, setPrintInterruptions] = useState<PrintInterruption[]>([]);
  const [isLoadingServiceOrders, setIsLoadingServiceOrders] = useState(false);
  const [isLoadingChangeRequests, setIsLoadingChangeRequests] = useState(false);
  const [isLoadingProgrammingRecords, setIsLoadingProgrammingRecords] = useState(false);
  const [isLoadingVerificationReports, setIsLoadingVerificationReports] = useState(false);
  const [isLoadingReportResponsibles, setIsLoadingReportResponsibles] = useState(false);
  const [isLoadingPrintInterruptions, setIsLoadingPrintInterruptions] = useState(false);
  const [isCreateServiceOrderModalOpen, setIsCreateServiceOrderModalOpen] = useState(false);
  const [editingServiceOrder, setEditingServiceOrder] = useState<ServiceOrder | null>(null);
  const [reportingServiceOrder, setReportingServiceOrder] = useState<ServiceOrder | null>(null);
  const [reportRequestType, setReportRequestType] =
    useState<ServiceOrderChangeRequest['requestType']>('missing_product');
  const [reportNotes, setReportNotes] = useState('');
  const [resolvingChangeRequest, setResolvingChangeRequest] =
    useState<ServiceOrderChangeRequest | null>(null);
  const [creatingVerificationReportFor, setCreatingVerificationReportFor] =
    useState<ServiceOrder | null>(null);
  const [activeVerificationReportPrintFlow, setActiveVerificationReportPrintFlow] =
    useState<VerificationReportPrintFlow | null>(null);
  const [pendingVerificationReportAction, setPendingVerificationReportAction] =
    useState<PendingVerificationReportAction | null>(null);
  const [pendingPrintInterruptionAction, setPendingPrintInterruptionAction] =
    useState<PendingPrintInterruptionAction | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAdminAction | null>(null);
  const [pendingGtinAction, setPendingGtinAction] = useState<PendingGtinAction | null>(null);
  const [pendingRfidProgramAction, setPendingRfidProgramAction] =
    useState<PendingRfidProgramAction | null>(null);
  const [pendingUserAction, setPendingUserAction] = useState<PendingUserAction | null>(null);
  const [pendingResponsibleAction, setPendingResponsibleAction] =
    useState<PendingResponsibleAction | null>(null);
  const [newPrintInterruptionTitle, setNewPrintInterruptionTitle] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [isSubmittingGtinAction, setIsSubmittingGtinAction] = useState(false);
  const [isSubmittingRfidProgramAction, setIsSubmittingRfidProgramAction] = useState(false);
  const [isSubmittingUserAction, setIsSubmittingUserAction] = useState(false);
  const [isSubmittingResponsibleAction, setIsSubmittingResponsibleAction] =
  useState(false);
  const [isSubmittingReportResponsibles, setIsSubmittingReportResponsibles] = useState(false);
  const [isSubmittingPrintInterruptionCreate, setIsSubmittingPrintInterruptionCreate] =
    useState(false);
  const [isSubmittingPrintInterruptionDelete, setIsSubmittingPrintInterruptionDelete] =
    useState(false);
  const [partNumberModeFilter, setPartNumberModeFilter] = useState<
    PartConfig['readingMode'] | 'all'
  >('all');
  const visibleSections = isSupervisor ? SUPERVISOR_SECTIONS : ADMIN_SECTIONS;

  const activeSectionConfig =
    visibleSections.find((section) => section.id === activeSection) ?? visibleSections[0];

  const filteredPartConfigs = partConfigs.filter((config) =>
    partNumberModeFilter === 'all' ? true : config.readingMode === partNumberModeFilter,
  );
  const activePartConfigsCount = partConfigs.filter((config) => config.isActive).length;
  const inactivePartConfigsCount = partConfigs.length - activePartConfigsCount;
  const pendingChangeRequests = changeRequests.filter((request) => request.status === 'pending');
  const resolvedChangeRequests = changeRequests.filter((request) => request.status === 'resolved');
  const totalPlannedFilters = serviceOrders.reduce(
    (total, serviceOrder) => total + serviceOrder.quantity,
    0,
  );
  const totalProgrammedFilters = serviceOrders.reduce(
    (total, serviceOrder) => total + getServiceOrderProgrammedCount(serviceOrder),
    0,
  );
  const totalVerifiedFilters = serviceOrders.reduce(
    (total, serviceOrder) => total + getServiceOrderVerifiedCount(serviceOrder),
    0,
  );
  const totalRemainingToProgram = serviceOrders.reduce(
    (total, serviceOrder) => total + getServiceOrderRemainingToProgram(serviceOrder),
    0,
  );
  const totalRemainingToVerify = serviceOrders.reduce(
    (total, serviceOrder) => total + getServiceOrderRemainingToVerify(serviceOrder),
    0,
  );
  const verificationReportsPendingPrintCount = verificationReports.filter(
    (report) => report.status === 'generated' || report.status === 'print_interrupted',
  ).length;
  const verificationReportsCompletedCount = verificationReports.filter(
    (report) => report.status === 'printed' || report.status === 'reprinted',
  ).length;
  const reportEligibleServiceOrders = serviceOrders.filter(
    (serviceOrder) =>
      serviceOrder.status === 'closed' &&
      getServiceOrderVerifiedCount(serviceOrder) >= serviceOrder.quantity,
  );
  const reportEligibleOrdersWithoutReport = reportEligibleServiceOrders.filter(
    (serviceOrder) =>
      !verificationReports.some((report) => report.serviceOrderId === serviceOrder._id),
  );

  const syncVerificationReportState = (nextReport: VerificationReport) => {
    setVerificationReports((currentReports) => {
      const existingReport = currentReports.find((report) => report._id === nextReport._id);

      if (!existingReport) {
        return [nextReport, ...currentReports];
      }

      return currentReports.map((report) =>
        report._id === nextReport._id ? nextReport : report,
      );
    });
    setPendingVerificationReportAction((currentAction) =>
      currentAction?.report._id === nextReport._id
        ? { report: nextReport }
        : currentAction,
    );
    setActiveVerificationReportPrintFlow((currentFlow) =>
      currentFlow?.report._id === nextReport._id
        ? { ...currentFlow, report: nextReport }
        : currentFlow,
    );
  };

  const openVerificationReportPrintFlow = (
    report: VerificationReport,
    mode: VerificationReportPrintFlow['mode'],
    options?: { autoStart?: boolean; clearMessage?: boolean },
  ) => {
    if (options?.clearMessage ?? true) {
      setMessage(null);
    }

    setActiveVerificationReportPrintFlow({
      autoStart: options?.autoStart ?? true,
      mode,
      report,
    });
  };

  const loadPartConfigs = async (options?: { clearMessage?: boolean; suppressErrorMessage?: boolean }) => {
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
      if (!(options?.suppressErrorMessage ?? false)) {
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'No se pudo conectar con el backend para cargar numeros de parte.',
        });
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const loadGtins = async (options?: { clearMessage?: boolean; suppressErrorMessage?: boolean }) => {
    setIsLoadingGtins(true);

    if (options?.clearMessage ?? true) {
      setMessage(null);
    }

    try {
      const nextGtins = await listGtins();
      setGtins(nextGtins);
      return true;
    } catch (error) {
      setGtins([]);
      if (!(options?.suppressErrorMessage ?? false)) {
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'No se pudo conectar con el backend para cargar GTIN.',
        });
      }
      return false;
    } finally {
      setIsLoadingGtins(false);
    }
  };

  const loadRfidPrograms = async (options?: { clearMessage?: boolean; suppressErrorMessage?: boolean }) => {
    setIsLoadingRfidPrograms(true);

    if (options?.clearMessage ?? true) {
      setMessage(null);
    }

    try {
      const nextRfidPrograms = await listRfidPrograms();
      setRfidPrograms(nextRfidPrograms);
      return true;
    } catch (error) {
      setRfidPrograms([]);
      if (!(options?.suppressErrorMessage ?? false)) {
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'No se pudo conectar con el backend para cargar RFID Program.',
        });
      }
      return false;
    } finally {
      setIsLoadingRfidPrograms(false);
    }
  };

  const loadUsers = async (options?: { clearMessage?: boolean; suppressErrorMessage?: boolean }) => {
    setIsLoadingUsers(true);

    if (options?.clearMessage ?? true) {
      setMessage(null);
    }

    try {
      const nextUsers = await getUsers();
      setUsers(nextUsers);
      return true;
    } catch (error) {
      setUsers([]);
      if (!(options?.suppressErrorMessage ?? false)) {
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'No se pudo conectar con el backend para cargar usuarios.',
        });
      }
      return false;
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const loadResponsibles = async (options?: {
    clearMessage?: boolean;
    suppressErrorMessage?: boolean;
  }) => {
    setIsLoadingResponsibles(true);

    if (options?.clearMessage ?? true) {
      setMessage(null);
    }

    try {
      const nextResponsibles = await getResponsibles();
      setResponsibles(nextResponsibles);
      return true;
    } catch (error) {
      setResponsibles([]);

      if (!(options?.suppressErrorMessage ?? false)) {
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'No se pudo conectar con el backend para cargar responsables.',
        });
      }

      return false;
    } finally {
      setIsLoadingResponsibles(false);
    }
  };

  const loadServiceOrders = async (options?: { clearMessage?: boolean }) => {
    setIsLoadingServiceOrders(true);

    if (options?.clearMessage ?? true) {
      setMessage(null);
    }

    try {
      const nextServiceOrders = await listServiceOrders();
      setServiceOrders(nextServiceOrders);
      return true;
    } catch (error) {
      setServiceOrders([]);
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudo conectar con el backend para cargar ordenes de servicio.',
      });
      return false;
    } finally {
      setIsLoadingServiceOrders(false);
    }
  };

  const loadChangeRequests = async (options?: { clearMessage?: boolean }) => {
    setIsLoadingChangeRequests(true);

    if (options?.clearMessage ?? true) {
      setMessage(null);
    }

    try {
      const nextChangeRequests = await listServiceOrderChangeRequests();
      setChangeRequests(nextChangeRequests);
      return true;
    } catch (error) {
      setChangeRequests([]);
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudo conectar con el backend para cargar solicitudes de cambio.',
      });
      return false;
    } finally {
      setIsLoadingChangeRequests(false);
    }
  };

  const loadProgrammingRecords = async (options?: {
    clearMessage?: boolean;
    suppressErrorMessage?: boolean;
  }) => {
    setIsLoadingProgrammingRecords(true);

    if (options?.clearMessage ?? true) {
      setMessage(null);
    }

    try {
      const [nextProgrammedRecords, nextVerifiedRecords] = await Promise.all([
        listProgrammingRecordsService({ status: 'programmed' }),
        listProgrammingRecordsService({ status: 'verified' }),
      ]);

      setProgrammedRecords(nextProgrammedRecords);
      setVerifiedRecords(nextVerifiedRecords);
      return true;
    } catch (error) {
      setProgrammedRecords([]);
      setVerifiedRecords([]);
      if (!(options?.suppressErrorMessage ?? false)) {
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'No se pudieron cargar los programming records de referencia.',
        });
      }
      return false;
    } finally {
      setIsLoadingProgrammingRecords(false);
    }
  };

  const loadVerificationReports = async (options?: { clearMessage?: boolean }) => {
    setIsLoadingVerificationReports(true);

    if (options?.clearMessage ?? true) {
      setMessage(null);
    }

    try {
      const nextVerificationReports = await listVerificationReports();
      setVerificationReports(nextVerificationReports);
      return true;
    } catch (error) {
      setVerificationReports([]);
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudieron cargar los reportes de verificacion.',
      });
      return false;
    } finally {
      setIsLoadingVerificationReports(false);
    }
  };

  const loadReportResponsibles = async (options?: {
    clearMessage?: boolean;
    suppressErrorMessage?: boolean;
  }) => {
    setIsLoadingReportResponsibles(true);

    if (options?.clearMessage ?? true) {
      setMessage(null);
    }

    try {
      const nextReportResponsibles = await getReportResponsibles();
      setReportResponsibles(nextReportResponsibles);
      setReportResponsiblesForm({
        manufacturingRepresentativeName:
          nextReportResponsibles.manufacturingRepresentativeName,
        qualityRepresentativeName: nextReportResponsibles.qualityRepresentativeName,
      });
      return true;
    } catch (error) {
      setReportResponsibles(null);
      setReportResponsiblesForm({
        manufacturingRepresentativeName: '',
        qualityRepresentativeName: '',
      });
      if (!(options?.suppressErrorMessage ?? false)) {
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'No se pudo cargar la configuracion de responsables.',
        });
      }
      return false;
    } finally {
      setIsLoadingReportResponsibles(false);
    }
  };

  const loadPrintInterruptions = async (options?: {
    clearMessage?: boolean;
    suppressErrorMessage?: boolean;
  }) => {
    setIsLoadingPrintInterruptions(true);

    if (options?.clearMessage ?? true) {
      setMessage(null);
    }

    try {
      const nextPrintInterruptions = await listPrintInterruptions();
      setPrintInterruptions(nextPrintInterruptions);
      return true;
    } catch (error) {
      setPrintInterruptions([]);
      if (!(options?.suppressErrorMessage ?? false)) {
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'No se pudieron cargar las interrupciones de impresion.',
        });
      }
      return false;
    } finally {
      setIsLoadingPrintInterruptions(false);
    }
  };

  const applyVerificationReportMutation = async (
    report: VerificationReport,
    action: 'print_interrupted' | 'printed' | 'reprinted',
    payload: UpdateVerificationReportStatusPayload = {},
  ) => {
    let result;

    switch (action) {
      case 'print_interrupted':
        result = await markVerificationReportPrintInterrupted(report._id, payload);
        break;
      case 'printed':
        result = await markVerificationReportAsPrinted(report._id, payload);
        break;
      case 'reprinted':
        result = await reprintVerificationReport(report._id, payload);
        break;
      default:
        throw new Error('La accion seleccionada para el reporte no es valida.');
    }

    syncVerificationReportState(result.data);
    setMessage({
      type: 'success',
      text: result.message,
    });

    return result.data;
  };

  useEffect(() => {
    if (isSupervisor) {
      void loadPartConfigs({ clearMessage: false, suppressErrorMessage: true });
      void loadServiceOrders();
      void loadChangeRequests({ clearMessage: false });
      void loadGtins({ clearMessage: false, suppressErrorMessage: true });
      void loadRfidPrograms({ clearMessage: false, suppressErrorMessage: true });
      void loadPrintInterruptions({ clearMessage: false, suppressErrorMessage: true });
      void loadVerificationReports({ clearMessage: false });
      return;
    }

    if (isAdmin) {
      void loadPartConfigs();
      void loadGtins({ clearMessage: false });
      void loadRfidPrograms({ clearMessage: false });
      void loadProgrammingRecords({ clearMessage: false });
      void loadReportResponsibles({ clearMessage: false });
      void loadResponsibles({ clearMessage: false });
      void loadPrintInterruptions({ clearMessage: false });
      void loadVerificationReports({ clearMessage: false });
      void loadUsers({ clearMessage: false });
    }
  }, [isAdmin, isSupervisor]);

  useEffect(() => {
    if (visibleSections.some((section) => section.id === activeSection)) {
      return;
    }

    setActiveSection(visibleSections[0]?.id ?? 'dashboard');
  }, [activeSection, visibleSections]);

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

  const handleCreateGtin = async (payload: GtinMutationPayload) => {
    const result = await createGtin(payload);
    setIsCreateGtinModalOpen(false);
    const didRefreshList = await loadGtins({ clearMessage: false });

    if (didRefreshList) {
      setMessage({
        type: 'success',
        text: result.message,
      });
    }
  };

  const handleCreateRfidProgram = async (payload: RfidProgramMutationPayload) => {
    const result = await createRfidProgram(payload);
    setIsCreateRfidProgramModalOpen(false);
    const didRefreshList = await loadRfidPrograms({ clearMessage: false });

    if (didRefreshList) {
      setMessage({
        type: 'success',
        text: result.message,
      });
    }
  };

  const handleCreateResponsible = async (payload: {
    name: string;
    area: ResponsibleArea;
  }) => {
    await createResponsible(payload);
    setIsCreateResponsibleModalOpen(false);
    const didRefreshList = await loadResponsibles({ clearMessage: false });
  
    if (didRefreshList) {
      setMessage({
        type: 'success',
        text: 'Responsable creado correctamente.',
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

  const handleUpdateGtin = async (payload: GtinMutationPayload) => {
    if (!editingGtin) {
      throw new Error('No se encontro el GTIN que se quiere editar.');
    }

    const result = await updateGtin(editingGtin._id, payload);
    setEditingGtin(null);
    const didRefreshList = await loadGtins({ clearMessage: false });

    if (didRefreshList) {
      setMessage({
        type: 'success',
        text: result.message,
      });
    }
  };

  const handleUpdateRfidProgram = async (payload: RfidProgramMutationPayload) => {
    if (!editingRfidProgram) {
      throw new Error('No se encontro el RFID program que se quiere editar.');
    }

    const result = await updateRfidProgram(editingRfidProgram._id, payload);
    setEditingRfidProgram(null);
    const didRefreshList = await loadRfidPrograms({ clearMessage: false });

    if (didRefreshList) {
      setMessage({
        type: 'success',
        text: result.message,
      });
    }
  };

  const handleUpdateResponsible = async (payload: {
    name: string;
    area: ResponsibleArea;
  }) => {
    if (!editingResponsible) {
      throw new Error('No se encontro el responsable que se quiere editar.');
    }
  
    await updateResponsible(editingResponsible._id, payload);
    setEditingResponsible(null);
    const didRefreshList = await loadResponsibles({ clearMessage: false });
  
    if (didRefreshList) {
      setMessage({
        type: 'success',
        text: 'Responsable actualizado correctamente.',
      });
    }
  };

  const handleCreateServiceOrder = async (payload: ServiceOrderMutationPayload) => {
    const result = await createServiceOrder(payload);
    setIsCreateServiceOrderModalOpen(false);
    const didRefreshList = await loadServiceOrders({ clearMessage: false });

    if (didRefreshList) {
      setMessage({
        type: 'success',
        text: result.message,
      });
    }
  };

  const handleUpdateServiceOrder = async (payload: ServiceOrderMutationPayload) => {
    if (!editingServiceOrder) {
      throw new Error('No se encontro la orden de servicio que se quiere editar.');
    }

    const result = await updateServiceOrder(editingServiceOrder._id, payload);
    setEditingServiceOrder(null);
    const [didRefreshOrders, didRefreshRequests] = await Promise.all([
      loadServiceOrders({ clearMessage: false }),
      loadChangeRequests({ clearMessage: false }),
    ]);

    if (didRefreshOrders && didRefreshRequests) {
      setMessage({
        type: 'success',
        text: result.message,
      });
    }
  };

  const handleResolveChangeRequest = async (payload: ResolveServiceOrderChangeRequestPayload) => {
    if (!resolvingChangeRequest) {
      throw new Error('No se encontro la solicitud que se quiere resolver.');
    }

    const result = await resolveServiceOrderChangeRequest(resolvingChangeRequest._id, payload);
    setResolvingChangeRequest(null);
    const [didRefreshOrders, didRefreshRequests] = await Promise.all([
      loadServiceOrders({ clearMessage: false }),
      loadChangeRequests({ clearMessage: false }),
    ]);

    if (didRefreshOrders && didRefreshRequests) {
      setMessage({
        type: 'success',
        text: result.message,
      });
    }
  };

  const handleCreateVerificationReport = async (payload: CreateVerificationReportPayload) => {
    const result = await createVerificationReport(payload);
    setCreatingVerificationReportFor(null);
    syncVerificationReportState(result.data);
    setMessage({
      type: 'success',
      text: result.message,
    });
    openVerificationReportPrintFlow(result.data, 'print', { clearMessage: false });
  };

  const handleSaveReportResponsibles = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const manufacturingRepresentativeName =
      reportResponsiblesForm.manufacturingRepresentativeName.trim();
    const qualityRepresentativeName = reportResponsiblesForm.qualityRepresentativeName.trim();

    if (!manufacturingRepresentativeName || !qualityRepresentativeName) {
      setMessage({
        type: 'error',
        text: 'Captura ambos responsables antes de guardar.',
      });
      return;
    }

    setIsSubmittingReportResponsibles(true);
    setMessage(null);

    try {
      const result = await updateReportResponsibles({
        manufacturingRepresentativeName,
        qualityRepresentativeName,
      });

      setReportResponsibles(result.data);
      setReportResponsiblesForm({
        manufacturingRepresentativeName: result.data.manufacturingRepresentativeName,
        qualityRepresentativeName: result.data.qualityRepresentativeName,
      });
      setMessage({
        type: 'success',
        text: result.message,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudieron actualizar los responsables de reporte.',
      });
    } finally {
      setIsSubmittingReportResponsibles(false);
    }
  };

  const handleCreatePrintInterruption = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const title = newPrintInterruptionTitle.trim();

    if (!title) {
      setMessage({
        type: 'error',
        text: 'Captura un titulo para la interrupcion.',
      });
      return;
    }

    setIsSubmittingPrintInterruptionCreate(true);
    setMessage(null);

    try {
      const result = await createPrintInterruption({ title });
      setNewPrintInterruptionTitle('');
      const didRefreshList = await loadPrintInterruptions({ clearMessage: false });

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
            : 'No se pudo crear la interrupcion de impresion.',
      });
    } finally {
      setIsSubmittingPrintInterruptionCreate(false);
    }
  };

  const handleCreateChangeRequest = async () => {
    if (!reportingServiceOrder) {
      return;
    }

    const result = await createServiceOrderChangeRequest(reportingServiceOrder._id, {
      requestType: reportRequestType,
      reason: reportNotes.trim(),
    });

    setReportingServiceOrder(null);
    setReportRequestType('missing_product');
    setReportNotes('');

    const [didRefreshOrders, didRefreshRequests] = await Promise.all([
      loadServiceOrders({ clearMessage: false }),
      loadChangeRequests({ clearMessage: false }),
    ]);

    if (didRefreshOrders && didRefreshRequests) {
      setMessage({
        type: 'success',
        text: result.message,
      });
    }
  };

  const handleSubmitVerificationReportAction = async (
    payload: UpdateVerificationReportStatusPayload,
  ) => {
    if (!pendingVerificationReportAction) {
      throw new Error('No se encontro la accion de reporte que se quiere ejecutar.');
    }

    await applyVerificationReportMutation(
      pendingVerificationReportAction.report,
      'print_interrupted',
      payload,
    );
    setPendingVerificationReportAction(null);
  };

  const handleMarkServiceOrderAsResolved = (serviceOrder: ServiceOrder) => {
    const now = new Date().toISOString();

    const nextResolvedRequest = {
      _id: `resolved-${serviceOrder._id}-${Date.now()}`,
      serviceOrderId: serviceOrder._id,
      serviceOrderFolio: serviceOrder.folio,
      requestType: 'missing_product',
      status: 'resolved',
      createdAt: now,
      updatedAt: now,
      resolvedAt: now,
      resolvedByUsername: user?.username ?? 'Supervisor',
      resolutionNotes: 'Orden marcada como resuelta.',
    } as ServiceOrderChangeRequest;

    setChangeRequests((currentRequests) => [nextResolvedRequest, ...currentRequests]);

    setMessage({
      type: 'success',
      text: `La orden ${serviceOrder.folio} fue marcada como resuelta.`,
    });
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

  const handleConfirmPendingGtinAction = async () => {
    if (!pendingGtinAction) {
      return;
    }

    setIsSubmittingGtinAction(true);

    try {
      let result;

      switch (pendingGtinAction.type) {
        case 'activate':
          result = await activateGtin(pendingGtinAction.gtin._id);
          break;
        case 'deactivate':
          result = await updateGtin(pendingGtinAction.gtin._id, { isActive: false });
          break;
        case 'delete':
          result = await deactivateGtin(pendingGtinAction.gtin._id);
          break;
      }

      setPendingGtinAction(null);
      const didRefreshList = await loadGtins({ clearMessage: false });

      if (didRefreshList) {
        setMessage({
          type: 'success',
          text: result.message,
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo completar la accion solicitada para el GTIN.',
      });
    } finally {
      setIsSubmittingGtinAction(false);
    }
  };

  const handleConfirmPendingRfidProgramAction = async () => {
    if (!pendingRfidProgramAction) {
      return;
    }

    setIsSubmittingRfidProgramAction(true);

    try {
      let result;

      switch (pendingRfidProgramAction.type) {
        case 'activate':
          result = await activateRfidProgram(pendingRfidProgramAction.rfidProgram._id);
          break;
        case 'deactivate':
          result = await updateRfidProgram(pendingRfidProgramAction.rfidProgram._id, {
            isActive: false,
          });
          break;
        case 'delete':
          result = await deactivateRfidProgram(pendingRfidProgramAction.rfidProgram._id);
          break;
      }

      setPendingRfidProgramAction(null);
      const didRefreshList = await loadRfidPrograms({ clearMessage: false });

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
            : 'No se pudo completar la accion solicitada para el RFID program.',
      });
    } finally {
      setIsSubmittingRfidProgramAction(false);
    }
  };

  const handleConfirmPendingPrintInterruptionAction = async () => {
    if (!pendingPrintInterruptionAction) {
      return;
    }

    setIsSubmittingPrintInterruptionDelete(true);

    try {
      const result = await deletePrintInterruption(
        pendingPrintInterruptionAction.interruption._id,
      );
      setPendingPrintInterruptionAction(null);
      const didRefreshList = await loadPrintInterruptions({ clearMessage: false });

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
            : 'No se pudo eliminar la interrupcion de impresion.',
      });
    } finally {
      setIsSubmittingPrintInterruptionDelete(false);
    }
  };

  const handleConfirmPendingUserAction = async () => {
    if (!pendingUserAction) {
      return;
    }

    setIsSubmittingUserAction(true);

    try {
      switch (pendingUserAction.type) {
        case 'activate':
          await updateUserStatus(pendingUserAction.user.id, true);
          break;
        case 'deactivate':
          await updateUserStatus(pendingUserAction.user.id, false);
          break;
        case 'delete':
          await deleteUser(pendingUserAction.user.id);
          break;
      }

      setPendingUserAction(null);
      const didRefreshList = await loadUsers({ clearMessage: false });

      if (didRefreshList) {
        setMessage({
          type: 'success',
          text:
            pendingUserAction.type === 'delete'
              ? 'Usuario eliminado correctamente.'
              : pendingUserAction.type === 'deactivate'
                ? 'Usuario deshabilitado correctamente.'
                : 'Usuario habilitado correctamente.',
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudo completar la accion solicitada para el usuario.',
      });
    } finally {
      setIsSubmittingUserAction(false);
    }
  };

  const handleConfirmPendingResponsibleAction = async () => {
    if (!pendingResponsibleAction) {
      return;
    }

    setIsSubmittingResponsibleAction(true);

    try {
      const completedActionType = pendingResponsibleAction.type;

      switch (pendingResponsibleAction.type) {
        case 'activate':
        case 'deactivate':
          await toggleResponsibleStatus(pendingResponsibleAction.responsible._id);
          break;
        case 'delete':
          await deleteResponsible(pendingResponsibleAction.responsible._id);
          break;
      }

      setPendingResponsibleAction(null);
      const didRefreshList = await loadResponsibles({ clearMessage: false });

      if (didRefreshList) {
        setMessage({
          type: 'success',
          text:
            completedActionType === 'delete'
              ? 'Responsable eliminado correctamente.'
              : completedActionType === 'deactivate'
                ? 'Responsable deshabilitado correctamente.'
                : 'Responsable habilitado correctamente.',
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudo completar la accion solicitada para el responsable.',
      });
    } finally {
      setIsSubmittingResponsibleAction(false);
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

      <ProgrammingRecordsQuickReference
        programmedRecords={programmedRecords}
        verifiedRecords={verifiedRecords}
        isLoading={isLoadingProgrammingRecords}
      />
    </section>
  );

  const renderPartNumbersSection = () => (
    <section className='adminSectionStack'>
      <div className='adminToolbar adminStickyToolbar'>
        <div className='adminToolbarFilters'>
          <label className='adminFilterLabel' htmlFor='partNumberModeFilter'>
            Filtrar por modo
          </label>

          <select
            className='adminFilterSelect'
            id='partNumberModeFilter'
            value={partNumberModeFilter}
            onChange={(event) =>
              setPartNumberModeFilter(
                event.target.value as PartConfig['readingMode'] | 'all',
              )
            }
          >
            <option value='all'>Todos</option>
            <option value='manual'>Manual</option>
            <option value='single_scan'>Escaneo simple</option>
            <option value='double_scan'>Doble lectura</option>
          </select>
        </div>

        <div className='adminToolbarActions'>
          <button
            className='adminPrimaryButton'
            type='button'
            onClick={() => {
              setMessage(null);
              setIsCreateModalOpen(true);
            }}
          >
            Crear nuevo
          </button>
          <button className='adminPrimaryButton' type='button' onClick={() => void loadPartConfigs()}>
            Recargar
          </button>
        </div>
      </div>

      <div className='adminTableCard'>
        <div className='adminTableHeader'>
          <h3>Listado de configuraciones</h3>
          <p className='adminTableMeta'>
            {isLoading ? 'Cargando...' : `${filteredPartConfigs.length} registros encontrados`}
          </p>
        </div>

        <div className='adminTableWrapper adminPartNumbersTableWrapper'>
          <table className='adminTable adminPartNumbersTable'>
            <thead>
              <tr>
                <th>Numero de parte</th>
                <th>Modo</th>
                <th>Fecha de creacion</th>
                <th>Estatus</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className='adminTableEmpty'>
                    Cargando numeros de parte...
                  </td>
                </tr>
              ) : filteredPartConfigs.length === 0 ? (
                <tr>
                  <td colSpan={5} className='adminTableEmpty'>
                    No hay configuraciones registradas para el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                filteredPartConfigs.map((config) => (
                  <tr key={config._id}>
                    <td>{config.partNumber}</td>
                    <td>{formatReadingMode(config.readingMode)}</td>
                    <td>{formatDate(config.createdAt)}</td>
                    <td>
                      <span className={`adminBadge ${config.isActive ? 'active' : 'inactive'}`}>
                        {config.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className='adminActionRow adminIconActionRow'>
                        <button
                          className='adminActionButton adminIconActionButton'
                          type='button'
                          title='Editar'
                          onClick={() => {
                            setMessage(null);
                            setEditingPartConfig(config);
                          }}
                        >
                          ✎
                        </button>

                        <button
                          className='adminActionButton adminIconActionButton'
                          type='button'
                          title='Copiar'
                          onClick={() => {
                            setMessage(null);
                            setCopyingPartConfig(config);
                          }}
                        >
                          ⧉
                        </button>
                      
                        <button
                          className='adminActionButton adminIconActionButton'
                          type='button'
                          title={config.isActive ? 'Desactivar' : 'Activar'}
                          onClick={() => {
                            setMessage(null);
                            setPendingAction({
                              type: config.isActive ? 'deactivate' : 'activate',
                              config,
                            });
                          }}
                        >
                          {config.isActive ? '⏸' : '▶'}
                        </button>
                      
                        <button
                          className='adminActionButton adminIconActionButton delete'
                          type='button'
                          title='Eliminar'
                          onClick={() => {
                            setMessage(null);
                            setPendingAction({
                              type: 'deletePermanent',
                              config,
                            });
                          }}
                        >
                          ✕
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

  const renderGtinsSection = () => (
    <section className='adminSectionStack'>
      <div className='adminToolbar'>

        <div className='adminToolbarActions'>
          <button
            className='adminPrimaryButton'
            type='button'
            onClick={() => {
              setMessage(null);
              setIsCreateGtinModalOpen(true);
            }}
          >
            Crear nuevo
          </button>
          <button className='adminPrimaryButton' type='button' onClick={() => void loadGtins()}>
            Recargar
          </button>
        </div>
      </div>

      <div className='adminTableCard'>
        <div className='adminTableHeader'>
          <h3>Listado de GTIN</h3>
          <p className='adminTableMeta'>
            {isLoadingGtins ? 'Cargando...' : `${gtins.length} registros encontrados`}
          </p>
        </div>

        <div className='adminTableWrapper'>
          <table className='adminTable'>
            <thead>
              <tr>
                <th>GTIN</th>
                <th>Fecha de creacion</th>
                <th>Ultima actualizacion</th>
                <th>Estatus</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingGtins ? (
                <tr>
                  <td colSpan={5} className='adminTableEmpty'>
                    Cargando GTIN...
                  </td>
                </tr>
              ) : gtins.length === 0 ? (
                <tr>
                  <td colSpan={5} className='adminTableEmpty'>
                    No hay GTIN registrados por mostrar.
                  </td>
                </tr>
              ) : (
                gtins.map((gtin) => (
                  <tr key={gtin._id}>
                    <td>{gtin.value}</td>
                    <td>{formatDate(gtin.createdAt)}</td>
                    <td>{formatDate(gtin.updatedAt)}</td>
                    <td>
                      <span className={`adminBadge ${gtin.isActive ? 'active' : 'inactive'}`}>
                        {gtin.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className='adminActionRow adminIconActionRow'>
                        <button
                          className='adminActionButton adminIconActionButton'
                          type='button'
                          onClick={() => {
                            setMessage(null);
                            setEditingGtin(gtin);
                          }}
                        >
                          ✎
                        </button>
                        <button
                          className='adminActionButton adminIconActionButton'
                          type='button'
                          onClick={() => {
                            setMessage(null);
                            setPendingGtinAction({
                              type: gtin.isActive ? 'deactivate' : 'activate',
                              gtin,
                            });
                          }}
                        >
                          {gtin.isActive ? '⏸' : '▶'}
                        </button>
                        {gtin.isActive && (
                          <button
                            className='adminActionButton adminIconActionButton delete'
                            type='button'
                            onClick={() => {
                              setMessage(null);
                              setPendingGtinAction({
                                type: 'delete',
                                gtin,
                              });
                            }}
                          >
                            ✕
                          </button>
                        )}
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

  const renderRfidProgramsSection = () => (
    <section className='adminSectionStack'>
      <div className='adminToolbar'>

        <div className='adminToolbarActions'>
          <button
            className='adminPrimaryButton'
            type='button'
            onClick={() => {
              setMessage(null);
              setIsCreateRfidProgramModalOpen(true);
            }}
          >
            Crear nuevo
          </button>
          <button className='adminPrimaryButton' type='button' onClick={() => void loadRfidPrograms()}>
            Recargar
          </button>
        </div>
      </div>

      <div className='adminTableCard'>
        <div className='adminTableHeader'>
          <h3>Listado de RFID Program</h3>
          <p className='adminTableMeta'>
            {isLoadingRfidPrograms ? 'Cargando...' : `${rfidPrograms.length} registros encontrados`}
          </p>
        </div>

        <div className='adminTableWrapper'>
          <table className='adminTable'>
            <thead>
              <tr>
                <th>RFID Program</th>
                <th>Fecha de creacion</th>
                <th>Ultima actualizacion</th>
                <th>Estatus</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingRfidPrograms ? (
                <tr>
                  <td colSpan={5} className='adminTableEmpty'>
                    Cargando RFID Program...
                  </td>
                </tr>
              ) : rfidPrograms.length === 0 ? (
                <tr>
                  <td colSpan={5} className='adminTableEmpty'>
                    No hay RFID Program registrados por mostrar.
                  </td>
                </tr>
              ) : (
                rfidPrograms.map((rfidProgram) => (
                  <tr key={rfidProgram._id}>
                    <td>{rfidProgram.value}</td>
                    <td>{formatDate(rfidProgram.createdAt)}</td>
                    <td>{formatDate(rfidProgram.updatedAt)}</td>
                    <td>
                      <span
                        className={`adminBadge ${rfidProgram.isActive ? 'active' : 'inactive'}`}
                      >
                        {rfidProgram.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className='adminActionRow adminIconActionRow'>
                        <button
                          className='adminActionButton adminIconActionButton'
                          type='button'
                          onClick={() => {
                            setMessage(null);
                            setEditingRfidProgram(rfidProgram);
                          }}
                        >
                          ✎
                        </button>
                        <button
                          className='adminActionButton adminIconActionButton'
                          type='button'
                          onClick={() => {
                            setMessage(null);
                            setPendingRfidProgramAction({
                              type: rfidProgram.isActive ? 'deactivate' : 'activate',
                              rfidProgram,
                            });
                          }}
                        >
                          {rfidProgram.isActive ? '⏸' : '▶'}
                        </button>
                        {rfidProgram.isActive && (
                          <button
                            className='adminActionButton adminIconActionButton  delete'
                            type='button'
                            onClick={() => {
                              setMessage(null);
                              setPendingRfidProgramAction({
                                type: 'delete',
                                rfidProgram,
                              });
                            }}
                          >
                            ✕
                          </button>
                        )}
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

  const renderServiceOrdersSection = () => (
    <section className='adminSectionStack'>
      <div className='adminMetricsGrid'>
        <article className='adminMetricCard adminMetricCardPrimary'>
          <span className='adminMetricLabel'>Ordenes totales</span>
          <strong className='adminMetricValue'>
            {isLoadingServiceOrders ? '...' : String(serviceOrders.length)}
          </strong>
          <p>Ordenes visibles para el supervisor en el backend actual.</p>
        </article>

        <article className='adminMetricCard'>
          <span className='adminMetricLabel'>Programados</span>
          <strong className='adminMetricValue'>
            {isLoadingServiceOrders ? '...' : String(totalProgrammedFilters)}
          </strong>
          <p>{`Meta total: ${totalPlannedFilters}. Restan ${totalRemainingToProgram} por programar.`}</p>
        </article>

        <article className='adminMetricCard'>
          <span className='adminMetricLabel'>Verificados</span>
          <strong className='adminMetricValue'>
            {isLoadingServiceOrders ? '...' : String(totalVerifiedFilters)}
          </strong>
          <p>{`Pendientes por verificar: ${totalRemainingToVerify}. Solicitudes pendientes: ${pendingChangeRequests.length}.`}</p>
        </article>
      </div>

      <div className='adminToolbar'>

        <div className='adminToolbarActions'>
          <button
            className='adminPrimaryButton'
            type='button'
            onClick={() => {
              setMessage(null);
              setIsCreateServiceOrderModalOpen(true);
            }}
          >
            Crear orden
          </button>
          <button
            className='adminPrimaryButton'
            type='button'
            onClick={() => {
              void loadServiceOrders();
              void loadChangeRequests({ clearMessage: false });
            }}
          >
            Recargar
          </button>
        </div>
      </div>

      <div className='adminTableCard'>
        <div className='adminTableHeader'>
          <h3>Listado de ordenes</h3>
          <p className='adminTableMeta'>
            {isLoadingServiceOrders ? 'Cargando...' : `${serviceOrders.length} registros encontrados`}
          </p>
        </div>

        <div className='adminTableWrapper'>
          <table className='adminTable adminServiceOrdersTable'>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Tipo</th>
                <th>Referencia</th>
                <th>RFID Program</th>
                <th>Cantidad / avance</th>
                <th>Status</th>
                <th>Ultima actualizacion</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingServiceOrders ? (
                <tr>
                  <td colSpan={8} className='adminTableEmpty'>
                    Cargando ordenes de servicio...
                  </td>
                </tr>
              ) : serviceOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className='adminTableEmpty'>
                    No hay ordenes de servicio registradas.
                  </td>
                </tr>
              ) : (
                serviceOrders.map((serviceOrder) => (
                  <tr key={serviceOrder._id}>
                    <td>{serviceOrder.folio}</td>
                    <td>{formatServiceOrderReadingMode(serviceOrder.readingMode)}</td>
                    <td>{formatServiceOrderPrimaryReference(serviceOrder)}</td>
                    <td>{serviceOrder.rfidProgram?.trim() || 'N/D'}</td>
                    <td>
                      <div className='adminOrderProgressCell'>
                        <strong>{`Planeados: ${serviceOrder.quantity}`}</strong>
                        <span>{`Programados: ${getServiceOrderProgrammedCount(serviceOrder)}`}</span>
                        <span>{`Verificados: ${getServiceOrderVerifiedCount(serviceOrder)}`}</span>
                        <small>{`Restan ${getServiceOrderRemainingToProgram(serviceOrder)} por programar y ${getServiceOrderRemainingToVerify(serviceOrder)} por verificar.`}</small>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`adminBadge ${
                          serviceOrder.status === 'open' ? 'active' : 'inactive'
                        }`}
                      >
                        {formatServiceOrderStatus(serviceOrder.status)}
                      </span>
                    </td>
                    <td>{formatDate(serviceOrder.updatedAt ?? serviceOrder.createdAt)}</td>
                    <td>
                      <div className='adminActionRow adminIconActionRow'>
                        <button
                          className='adminActionButton adminIconActionButton'
                          type='button'
                          title='Editar orden'
                          onClick={() => {
                            setMessage(null);
                            setEditingServiceOrder(serviceOrder);
                          }}
                        >
                          ✎
                        </button>

                        <button
                          className='adminActionButton adminIconActionButton'
                          type='button'
                          title='Reportar incidencia'
                          onClick={() => {
                            setMessage(null);
                            setReportingServiceOrder(serviceOrder);
                            setReportRequestType('missing_product');
                            setReportNotes('');
                          }}
                        >
                          ⚠
                        </button>

                        <button
                          className='adminActionButton adminIconActionButton'
                          type='button'
                          title='Marcar como resuelto'
                          onClick={() => {
                            setMessage(null);
                            handleMarkServiceOrderAsResolved(serviceOrder);
                          }}
                        >
                          ✔
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

      <div className='adminTableCard'>
        <div className='adminTableHeader'>
          <h3>Solicitudes de cambio pendientes</h3>
          <p className='adminTableMeta'>
            {isLoadingChangeRequests ? 'Cargando...' : `${pendingChangeRequests.length} pendientes`}
          </p>
        </div>

        <div className='adminTableWrapper'>
          <table className='adminTable adminPendingRequestsTable'>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Motivo</th>
                <th>Notas</th>
                <th>Fecha</th>
                <th>Status</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingChangeRequests ? (
                <tr>
                  <td colSpan={6} className='adminTableEmpty'>
                    Cargando solicitudes...
                  </td>
                </tr>
              ) : pendingChangeRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className='adminTableEmpty'>
                    No hay solicitudes pendientes.
                  </td>
                </tr>
              ) : (
                pendingChangeRequests.map((changeRequest) => (
                  <tr key={changeRequest._id}>
                    <td>{changeRequest.serviceOrderFolio}</td>
                    <td>{formatChangeRequestType(changeRequest.requestType)}</td>
                    <td>{changeRequest.resolutionNotes?.trim() || 'Sin notas'}</td>
                    <td>{formatDate(changeRequest.createdAt)}</td>
                    <td>
                      <span className='adminBadge inactive'>Pending</span>
                    </td>
                    <td>
                      <div className='adminActionRow adminIconActionRow'>
                        <button
                          className='adminActionButton'
                          type='button'
                          onClick={() => {
                            setMessage(null);
                            setResolvingChangeRequest(changeRequest);
                          }}
                        >
                          ✔
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

      <div className='adminTableCard'>
        <div className='adminTableHeader'>
          <h3>Historial resuelto</h3>
          <p className='adminTableMeta'>
            {isLoadingChangeRequests ? 'Cargando...' : `${resolvedChangeRequests.length} resueltas`}
          </p>
        </div>

        <div className='adminTableWrapper'>
          <table className='adminTable'>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Motivo</th>
                <th>Resuelta por</th>
                <th>Fecha</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingChangeRequests ? (
                <tr>
                  <td colSpan={5} className='adminTableEmpty'>
                    Cargando historial...
                  </td>
                </tr>
              ) : resolvedChangeRequests.length === 0 ? (
                <tr>
                  <td colSpan={5} className='adminTableEmpty'>
                    No hay solicitudes resueltas por mostrar.
                  </td>
                </tr>
              ) : (
                resolvedChangeRequests.map((changeRequest) => (
                  <tr key={changeRequest._id}>
                    <td>{changeRequest.serviceOrderFolio}</td>
                    <td>{changeRequest._id.startsWith('resolved-') ? 'Completado' : formatChangeRequestType(changeRequest.requestType)}</td>
                    <td>{changeRequest.resolvedByUsername ?? 'N/D'}</td>
                    <td>{formatDate(changeRequest.resolvedAt ?? changeRequest.updatedAt)}</td>
                    <td>{changeRequest.resolutionNotes?.trim() || 'Sin notas'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );

  const renderVerificationReportsSection = () => (
    <section className='adminSectionStack'>
      <div className='adminMetricsGrid'>
        <article className='adminMetricCard adminMetricCardPrimary'>
          <span className='adminMetricLabel'>Reportes totales</span>
          <strong className='adminMetricValue'>
            {isLoadingVerificationReports ? '...' : String(verificationReports.length)}
          </strong>
          <p>Un solo reporte por orden de servicio cerrada y completamente verificada.</p>
        </article>

        <article className='adminMetricCard'>
          <span className='adminMetricLabel'>Pendientes de impresion</span>
          <strong className='adminMetricValue'>
            {isLoadingVerificationReports ? '...' : String(verificationReportsPendingPrintCount)}
          </strong>
          <p>Incluye estados generated y print_interrupted.</p>
        </article>

        <article className='adminMetricCard'>
          <span className='adminMetricLabel'>
            {isSupervisor ? 'Ordenes listas sin reporte' : 'Reportes cerrados'}
          </span>
          <strong className='adminMetricValue'>
            {isSupervisor
              ? isLoadingServiceOrders || isLoadingVerificationReports
                ? '...'
                : String(reportEligibleOrdersWithoutReport.length)
              : isLoadingVerificationReports
                ? '...'
                : String(verificationReportsCompletedCount)}
          </strong>
          <p>
            {isSupervisor
              ? 'Ordenes cerradas con verificacion completa y aun sin generar.'
              : 'Suma de reportes en estado imprimir o reimprimir.'}
          </p>
        </article>
      </div>

      <div className='adminToolbar adminToolbar-Info'>
        <div>
          <h2>Reportes de verificacion</h2>
          <p>
            {isSupervisor
              ? 'Genera reportes una vez cerrada la orden y administra el avance de impresion.'
              : 'Consulta reportes congelados y ejecuta reimpresiones autorizadas.'}
          </p>
        </div>

        <div className='adminToolbarActions'>
          <button
            className='adminPrimaryButton'
            type='button'
            onClick={() => {
              void loadVerificationReports();
              if (isSupervisor) {
                void loadServiceOrders({ clearMessage: false });
              }
            }}
          >
            Recargar
          </button>
        </div>
      </div>

      {isSupervisor && (
        <div className='adminTableCard'>
          <div className='adminTableHeader'>
            <h3>Ordenes cerradas listas para reporte</h3>
            <p className='adminTableMeta'>
              {isLoadingServiceOrders || isLoadingVerificationReports
                ? 'Cargando...'
                : `${reportEligibleServiceOrders.length} ordenes elegibles`}
            </p>
          </div>

          <div className='adminTableWrapper'>
            <table className='adminTable adminVerificationCandidatesTable'>
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Tipo</th>
                  <th>Referencia</th>
                  <th>Avance</th>
                  <th>Reporte</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingServiceOrders || isLoadingVerificationReports ? (
                  <tr>
                    <td colSpan={6} className='adminTableEmpty'>
                      Cargando ordenes elegibles...
                    </td>
                  </tr>
                ) : reportEligibleServiceOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className='adminTableEmpty'>
                      No hay ordenes cerradas con verificacion completa listas para reporte.
                    </td>
                  </tr>
                ) : (
                  reportEligibleServiceOrders.map((serviceOrder) => {
                    const existingReport =
                      verificationReports.find(
                        (report) => report.serviceOrderId === serviceOrder._id,
                      ) ?? null;

                    return (
                      <tr key={serviceOrder._id}>
                        <td>{serviceOrder.folio}</td>
                        <td>{formatServiceOrderReadingMode(serviceOrder.readingMode)}</td>
                        <td>{formatServiceOrderPrimaryReference(serviceOrder)}</td>
                        <td>
                          <div className='adminOrderProgressCell'>
                            <strong>{`Verificados: ${getServiceOrderVerifiedCount(serviceOrder)}/${serviceOrder.quantity}`}</strong>
                            <small>{`Pendientes por verificar: ${getServiceOrderRemainingToVerify(serviceOrder)}.`}</small>
                          </div>
                        </td>
                        <td>
                          {existingReport ? (
                            <span
                              className={`adminBadge ${
                                existingReport.status === 'printed' ||
                                existingReport.status === 'reprinted'
                                  ? 'active'
                                  : 'printPending'
                              }`}
                            >
                              {formatVerificationReportStatus(existingReport.status)}
                            </span>
                          ) : (
                            <span className='adminBadge inactive'>Sin reporte</span>
                          )}
                        </td>
                        <td>
                          <div className='adminActionRow'>
                            {existingReport ? (
                              <button
                                className='adminActionButton'
                                type='button'
                                onClick={() => {
                                  openVerificationReportPrintFlow(existingReport, 'print', {
                                    autoStart: false,
                                  });
                                }}
                              >
                                ✎
                              </button>
                            ) : (
                              <button
                                className='adminActionButton'
                                type='button'
                                onClick={() => {
                                  setMessage(null);
                                  setCreatingVerificationReportFor(serviceOrder);
                                }}
                              >
                                ✚
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className='adminTableCard'>
        <div className='adminTableHeader'>
          <h3>Listado de reportes</h3>
          <p className='adminTableMeta'>
            {isLoadingVerificationReports
              ? 'Cargando...'
              : `${verificationReports.length} reportes encontrados`}
          </p>
        </div>

        <div className='adminTableWrapper'>
          <table className='adminTable adminVerificationReportsTable'>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Tipo</th>
                <th>Encabezado congelado</th>
                <th>Representantes</th>
                <th>Status</th>
                <th>Ultimo evento</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingVerificationReports ? (
                <tr>
                  <td colSpan={7} className='adminTableEmpty'>
                    Cargando reportes de verificacion...
                  </td>
                </tr>
              ) : verificationReports.length === 0 ? (
                <tr>
                  <td colSpan={7} className='adminTableEmpty'>
                    No hay reportes generados por mostrar.
                  </td>
                </tr>
              ) : (
                verificationReports.map((report) => {
                  const latestEvent = getLatestVerificationReportEvent(report);
                  const isCompletedReport =
                    report.status === 'printed' || report.status === 'reprinted';
                  const canMarkPrinted = report.availableActions?.canMarkPrinted ?? false;
                  const canMarkPrintInterrupted =
                    report.availableActions?.canMarkPrintInterrupted ?? false;
                  const canReprintReport = isAdmin && (report.availableActions?.canReprint ?? false);

                  return (
                    <tr key={report._id}>
                      <td>{report.serviceOrderFolio}</td>
                      <td>{formatServiceOrderReadingMode(report.serviceOrderReadingMode)}</td>
                      <td>
                        <div className='adminVerificationReportSnapshot'>
                          <strong>{report.partNumber}</strong>
                          <span>{`Lote: ${report.lot}`}</span>
                          <small>{`Fecha de manufactura: ${report.manufactureDate}`}</small>
                        </div>
                      </td>
                      <td>
                        <div className='adminVerificationReportSnapshot'>
                          <span>{`Manufactura: ${report.manufacturingRepresentativeName}`}</span>
                          <span>{`Calidad: ${report.qualityRepresentativeName}`}</span>
                          <small>{`Filas congeladas: ${report.rows.length}/${report.quantity}`}</small>
                        </div>
                      </td>
                      <td>
                        <div className='adminVerificationReportStatusCell'>
                          <span className={`adminBadge ${isCompletedReport ? 'active' : 'printPending'}`}>
                            {formatVerificationReportStatus(report.status)}
                          </span>
                          <small>{formatDate(report.updatedAt ?? report.createdAt)}</small>
                        </div>
                      </td>
                      <td>
                        <div className='adminVerificationReportSnapshot'>
                          <strong>
                            {latestEvent
                              ? formatVerificationReportStatus(latestEvent.type)
                              : 'Sin eventos'}
                          </strong>
                          <span>{formatDate(latestEvent?.occurredAt)}</span>
                          <small>
                            {latestEvent?.interruptionTitle?.trim()
                              ? `${latestEvent.performedByUsername?.trim() || 'N/D'} | ${latestEvent.interruptionTitle}`
                              : latestEvent?.performedByUsername?.trim() || 'N/D'}
                          </small>
                        </div>
                      </td>
                      <td>
                        <div className='adminActionRow'>
                          <button
                            className='adminActionButton'
                            type='button'
                            onClick={() => {
                              openVerificationReportPrintFlow(report, 'print', {
                                autoStart: false,
                              });
                            }}
                          >
                            ✎
                          </button>

                          {canMarkPrinted && (
                            <button
                              className='adminActionButton'
                              type='button'
                              onClick={() => {
                                openVerificationReportPrintFlow(report, 'print', {
                                  autoStart: false,
                                });
                              }}
                            >
                              Imprimir
                            </button>
                          )}

                          {canMarkPrintInterrupted && (
                            <button
                              className='adminActionButton'
                              type='button'
                              onClick={() => {
                                setMessage(null);
                                setPendingVerificationReportAction({
                                  report,
                                });
                              }}
                            >
                              ‼
                            </button>
                          )}

                          {canReprintReport && (
                            <button
                              className='adminActionButton'
                              type='button'
                              onClick={() => {
                                openVerificationReportPrintFlow(report, 'reprint');
                              }}
                            >
                              ↻
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );

  const renderReportResponsiblesSection = () => (
    
    <section className='adminSectionStack'>
      <article className='adminInfoCard'>
        <div className='adminSectionCardHeader'>
          <h3>Responsables globales</h3>
          <p>
            Estos nombres se congelan automaticamente en cada reporte nuevo de verificacion.
          </p>
        </div>

        <div className='adminInfoGrid adminInfoGridCompact'>
          <div className='adminInfoItem'>
            <span>Estatus</span>
            <strong>
              {isLoadingReportResponsibles
                ? 'Cargando...'
                : reportResponsibles?.isConfigured
                  ? 'Configurado'
                  : 'Sin configurar'}
            </strong>
          </div>
          <div className='adminInfoItem'>
            <span>Manufactura actual</span>
            <strong>{reportResponsibles?.manufacturingRepresentativeName || 'N/D'}</strong>
          </div>
          <div className='adminInfoItem'>
            <span>Calidad actual</span>
            <strong>{reportResponsibles?.qualityRepresentativeName || 'N/D'}</strong>
          </div>
        </div>
      </article>

      <div className='adminTableCard'>
        <div className='adminTableHeader'>
          <h3>Configuracion</h3>
          <p className='adminTableMeta'>
            Define los nombres que backend usara por defecto al generar reportes.
          </p>
        </div>

        <form className='adminForm' onSubmit={(event) => void handleSaveReportResponsibles(event)}>
          <div className='adminFormGrid'>
            <label className='adminField'>
              <span>Responsable de manufactura</span>
              <select
                value={reportResponsiblesForm.manufacturingRepresentativeName}
                onChange={(event) =>
                  setReportResponsiblesForm((currentForm) => ({
                    ...currentForm,
                    manufacturingRepresentativeName: event.target.value,
                  }))
                }
                disabled={
                  isLoadingReportResponsibles ||
                  isSubmittingReportResponsibles ||
                  isLoadingResponsibles
                }
              >
                <option value=''>Selecciona un responsable</option>
                {responsibles
                  .filter((responsible) => responsible.area === 'manufactura' && responsible.isActive)
                  .map((responsible) => (
                    <option key={responsible._id} value={responsible.name}>
                      {responsible.name}
                    </option>
                  ))}
              </select>
            </label>

            <label className='adminField'>
              <span>Responsable de calidad</span>
              <select
                value={reportResponsiblesForm.qualityRepresentativeName}
                onChange={(event) =>
                  setReportResponsiblesForm((currentForm) => ({
                    ...currentForm,
                    qualityRepresentativeName: event.target.value,
                  }))
                }
                disabled={
                  isLoadingReportResponsibles ||
                  isSubmittingReportResponsibles ||
                  isLoadingResponsibles
                }
              >
                <option value=''>Selecciona un responsable</option>
                {responsibles
                  .filter((responsible) => responsible.area === 'calidad' && responsible.isActive)
                  .map((responsible) => (
                    <option key={responsible._id} value={responsible.name}>
                      {responsible.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <div className='adminModalFooter'>
            <button
              className='adminPrimaryButton adminSecondaryButton'
              type='button'
              onClick={() => void loadReportResponsibles()}
              disabled={isLoadingReportResponsibles || isSubmittingReportResponsibles}
            >
              Recargar
            </button>
            <button
              className='adminPrimaryButton'
              type='submit'
              disabled={isLoadingReportResponsibles || isSubmittingReportResponsibles}
            >
              {isSubmittingReportResponsibles ? 'Guardando...' : 'Guardar responsables'}
            </button>
          </div>
        </form>
      </div>

      <div className='adminTableCard'>
        <div className='adminTableHeader'>
          <h3>Listado de responsables</h3>
      
          <div className='adminToolbarActions'>
            <p className='adminTableMeta'>
              {isLoadingResponsibles
                ? 'Cargando...'
                : `${responsibles.length} responsables encontrados`}
            </p>
      
            <button
              className='adminPrimaryButton'
              type='button'
              onClick={() => {
                setMessage(null);
                setIsCreateResponsibleModalOpen(true);
              }}
            >
              Crear responsable
            </button>
          </div>
        </div>

        <div className='adminTableWrapper'>
          <table className='adminTable'>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Area</th>
                <th>Creacion</th>
                <th>Estatus</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingResponsibles ? (
                <tr>
                  <td colSpan={5} className='adminTableEmpty'>
                    Cargando responsables...
                  </td>
                </tr>
              ) : responsibles.length === 0 ? (
                <tr>
                  <td colSpan={5} className='adminTableEmpty'>
                    No hay responsables registrados.
                  </td>
                </tr>
              ) : (
                responsibles.map((responsible) => (
                  <tr key={responsible._id}>
                    <td>{responsible.name}</td>
                    <td>{responsible.area}</td>
                    <td>{formatDate(responsible.createdAt)}</td>
                    <td>
                      <span className={`adminBadge ${responsible.isActive ? 'active' : 'inactive'}`}>
                        {responsible.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className='adminActionRow adminIconActionRow'>
                        <button
                          className='adminActionButton adminIconActionButton'
                          type='button'
                          title='Editar'
                          onClick={() => {
                            setMessage(null);
                            setEditingResponsible(responsible);
                          }}
                        >
                          ✎
                        </button>
                        <button
                          className='adminActionButton adminIconActionButton'
                          type='button'
                          title={responsible.isActive ? 'Desactivar' : 'Activar'}
                          onClick={() => {
                            setMessage(null);
                            setPendingResponsibleAction({
                              type: responsible.isActive ? 'deactivate' : 'activate',
                              responsible,
                            });
                          }}
                        >
                          {responsible.isActive ? '⏸' : '▶'}
                        </button>
                        <button
                          className='adminActionButton adminIconActionButton delete'
                          type='button'
                          title='Eliminar'
                          onClick={() => {
                            setMessage(null);
                            setPendingResponsibleAction({
                              type: 'delete',
                              responsible,
                            });
                          }}
                        >
                          ✕
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

  const renderPrintInterruptionsSection = () => (
    <section className='adminSectionStack'>
      <article className='adminInfoCard'>
        <div className='adminSectionCardHeader'>
          <h3>Catalogo de interrupciones</h3>
          <p>
            Estas causas pueden seleccionarse al marcar una impresion como interrumpida.
          </p>
        </div>

        <div className='adminInfoGrid adminInfoGridCompact'>
          <div className='adminInfoItem'>
            <span>Total</span>
            <strong>{isLoadingPrintInterruptions ? '...' : String(printInterruptions.length)}</strong>
          </div>
        </div>
      </article>

      <div className='adminTableCard'>
        <div className='adminTableHeader'>
          <h3>Nueva interrupcion</h3>
          <p className='adminTableMeta'>
            Registra causas reutilizables para el flujo de impresion interrumpida.
          </p>
        </div>

        <form className='adminForm' onSubmit={(event) => void handleCreatePrintInterruption(event)}>
          <label className='adminField adminFieldFull'>
            <span>Titulo</span>
            <input
              type='text'
              value={newPrintInterruptionTitle}
              onChange={(event) => setNewPrintInterruptionTitle(event.target.value)}
              placeholder='Ejemplo: Impresora sin tinta'
              disabled={isSubmittingPrintInterruptionCreate}
            />
          </label>

          <div className='adminModalFooter'>
            <button
              className='adminPrimaryButton adminSecondaryButton'
              type='button'
              onClick={() => void loadPrintInterruptions()}
              disabled={isLoadingPrintInterruptions || isSubmittingPrintInterruptionCreate}
            >
              Recargar
            </button>
            <button
              className='adminPrimaryButton'
              type='submit'
              disabled={isSubmittingPrintInterruptionCreate}
            >
              {isSubmittingPrintInterruptionCreate ? 'Guardando...' : 'Agregar interrupcion'}
            </button>
          </div>
        </form>
      </div>

      <div className='adminTableCard'>
        <div className='adminTableHeader'>
          <h3>Listado de interrupciones</h3>
          <p className='adminTableMeta'>
            {isLoadingPrintInterruptions
              ? 'Cargando...'
              : `${printInterruptions.length} interrupciones registradas`}
          </p>
        </div>

        <div className='adminTableWrapper'>
          <table className='adminTable'>
            <thead>
              <tr>
                <th>Titulo</th>
                <th>Creacion</th>
                <th>Ultima actualizacion</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingPrintInterruptions ? (
                <tr>
                  <td colSpan={4} className='adminTableEmpty'>
                    Cargando interrupciones...
                  </td>
                </tr>
              ) : printInterruptions.length === 0 ? (
                <tr>
                  <td colSpan={4} className='adminTableEmpty'>
                    No hay interrupciones registradas.
                  </td>
                </tr>
              ) : (
                printInterruptions.map((printInterruption) => (
                  <tr key={printInterruption._id}>
                    <td>{printInterruption.title}</td>
                    <td>{formatDate(printInterruption.createdAt)}</td>
                    <td>{formatDate(printInterruption.updatedAt)}</td>
                    <td>
                      <div className='adminActionRow adminIconActionRow'>
                        <button
                          className='adminActionButton adminIconActionButton adminDeleteGlyphButton delete'
                          type='button'
                          title='Eliminar'
                          onClick={() => {
                            setMessage(null);
                            setPendingPrintInterruptionAction({
                              interruption: printInterruption,
                            });
                          }}
                        >
                          âœ•
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
            <span>Usuarios registrados</span>
            <strong>{isLoadingUsers ? '...' : String(users.length)}</strong>
          </div>
        </div>
      </article>

      <div className='adminToolbar'>

        <div className='adminToolbarActions'>
          <button
            className='adminPrimaryButton'
            type='button'
            onClick={() => {
              setMessage(null);
              setIsRegisterModalOpen(true);
            }}
          >
            Registrar usuario
          </button>
          <button className='adminPrimaryButton' type='button' onClick={() => void loadUsers()}>
            Recargar
          </button>
        </div>
      </div>

      <div className='adminTableCard'>
        <div className='adminTableHeader'>
          <h3>Listado de usuarios</h3>
          <p className='adminTableMeta'>
            {isLoadingUsers ? 'Cargando...' : `${users.length} usuarios encontrados`}
          </p>
        </div>

        <div className='adminTableWrapper'>
          <table className='adminTable adminUsersTable'>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Creacion</th>
                <th>Estatus</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingUsers ? (
                <tr>
                  <td colSpan={6} className='adminTableEmpty'>
                    Cargando usuarios...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className='adminTableEmpty'>
                    No hay usuarios registrados por mostrar.
                  </td>
                </tr>
              ) : (
                users.map((managedUser) => {
                  const isCurrentUser = managedUser.id === user?.id;

                  return (
                    <tr key={managedUser.id}>
                      <td>{managedUser.username}</td>
                      <td>{managedUser.email}</td>
                      <td>{managedUser.role}</td>
                      <td>{new Date(managedUser.createdAt ?? '').toLocaleDateString('es-MX')}</td>
                      <td>
                        <span className={`adminBadge ${managedUser.isActive ? 'active' : 'inactive'}`}>
                          {managedUser.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div className='adminActionRow adminIconActionRow adminUsersActionRow'>
                          <button
                            className='adminActionButton adminIconActionButton'
                            type='button'
                            title={managedUser.isActive ? 'Deshabilitar' : 'Habilitar'}
                            disabled={isCurrentUser}
                            onClick={() => {
                              setMessage(null);
                              setPendingUserAction({
                                type: managedUser.isActive ? 'deactivate' : 'activate',
                                user: managedUser,
                              });
                            }}
                          >
                            {managedUser.isActive ? '⏸' : '▶'}
                          </button>

                          <button
                            className='adminActionButton adminIconActionButton delete'
                            type='button'
                            title='Eliminar'
                            disabled={isCurrentUser}
                            onClick={() => {
                              setMessage(null);
                              setPendingUserAction({
                                type: 'delete',
                                user: managedUser,
                              });
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return renderDashboardSection();
      case 'partNumbers':
        return renderPartNumbersSection();
      case 'gtin':
        return renderGtinsSection();
      case 'rfidProgram':
        return renderRfidProgramsSection();
      case 'reportResponsibles':
        return renderReportResponsiblesSection();
      case 'printInterruptions':
        return renderPrintInterruptionsSection();
      case 'serviceOrder':
        return renderServiceOrdersSection();
      case 'verificationReports':
        return renderVerificationReportsSection();
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
                {visibleSections.map((section) => (
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
          gtins={gtins}
          rfidPrograms={rfidPrograms}
          isCatalogLoading={isLoadingGtins || isLoadingRfidPrograms}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreatePartConfig}
        />
      )}

      {isCreateGtinModalOpen && (
        <GtinFormModal
          title='Crear GTIN'
          submitLabel='Guardar GTIN'
          submittingLabel='Guardando...'
          onClose={() => setIsCreateGtinModalOpen(false)}
          onSubmit={handleCreateGtin}
        />
      )}

      {isCreateRfidProgramModalOpen && (
        <RfidProgramFormModal
          title='Crear RFID Program'
          submitLabel='Guardar RFID Program'
          submittingLabel='Guardando...'
          onClose={() => setIsCreateRfidProgramModalOpen(false)}
          onSubmit={handleCreateRfidProgram}
        />
      )}

      {isRegisterModalOpen && (
        <RegisterModal
          onClose={() => setIsRegisterModalOpen(false)}
          onSuccess={(nextUser) => {
            setIsRegisterModalOpen(false);
            void loadUsers({ clearMessage: false });
            setMessage({
              type: 'success',
              text: `Usuario ${nextUser.username} registrado correctamente.`,
            });
          }}
        />
      )}

      {isCreateServiceOrderModalOpen && (
        <ServiceOrderFormModal
          title='Crear orden de servicio'
          submitLabel='Guardar orden'
          submittingLabel='Guardando...'
          partConfigs={partConfigs}
          gtins={gtins}
          rfidPrograms={rfidPrograms}
          isCatalogLoading={isLoading || isLoadingGtins || isLoadingRfidPrograms}
          onClose={() => setIsCreateServiceOrderModalOpen(false)}
          onSubmit={handleCreateServiceOrder}
        />
      )}

      {editingPartConfig && (
        <PartConfigFormModal
          title={`Editar ${editingPartConfig.partNumber}`}
          submitLabel='Guardar cambios'
          submittingLabel='Actualizando...'
          gtins={gtins}
          rfidPrograms={rfidPrograms}
          isCatalogLoading={isLoadingGtins || isLoadingRfidPrograms}
          initialData={editingPartConfig}
          onClose={() => setEditingPartConfig(null)}
          onSubmit={handleUpdatePartConfig}
        />
      )}

      {editingGtin && (
        <GtinFormModal
          title={`Editar ${editingGtin.value}`}
          submitLabel='Guardar cambios'
          submittingLabel='Actualizando...'
          initialData={editingGtin}
          onClose={() => setEditingGtin(null)}
          onSubmit={handleUpdateGtin}
        />
      )}

      {editingRfidProgram && (
        <RfidProgramFormModal
          title={`Editar ${editingRfidProgram.value}`}
          submitLabel='Guardar cambios'
          submittingLabel='Actualizando...'
          initialData={editingRfidProgram}
          onClose={() => setEditingRfidProgram(null)}
          onSubmit={handleUpdateRfidProgram}
        />
      )}

      {editingResponsible && (
        <ResponsibleFormModal
          isOpen={Boolean(editingResponsible)}
          title='Editar responsable'
          initialName={editingResponsible.name}
          initialArea={editingResponsible.area}
          onClose={() => setEditingResponsible(null)}
          onSubmit={(payload) => void handleUpdateResponsible(payload)}
        />
      )}

      <ResponsibleFormModal
        isOpen={isCreateResponsibleModalOpen}
        title='Crear responsable'
        initialName=''
        initialArea='manufactura'
        onClose={() => setIsCreateResponsibleModalOpen(false)}
        onSubmit={(payload) => void handleCreateResponsible(payload)}
      />

      {editingServiceOrder && (
        <ServiceOrderFormModal
          title={`Editar ${editingServiceOrder.folio}`}
          submitLabel='Guardar cambios'
          submittingLabel='Actualizando...'
          partConfigs={partConfigs}
          gtins={gtins}
          rfidPrograms={rfidPrograms}
          isCatalogLoading={isLoading || isLoadingGtins || isLoadingRfidPrograms}
          initialData={editingServiceOrder}
          allowStatusSelection
          onClose={() => setEditingServiceOrder(null)}
          onSubmit={handleUpdateServiceOrder}
        />
      )}

      {creatingVerificationReportFor && (
        <VerificationReportCreateModal
          serviceOrder={creatingVerificationReportFor}
          onClose={() => setCreatingVerificationReportFor(null)}
          onSubmit={handleCreateVerificationReport}
        />
      )}

      {activeVerificationReportPrintFlow && (
        <VerificationReportPrintModal
          report={activeVerificationReportPrintFlow.report}
          mode={activeVerificationReportPrintFlow.mode}
          autoStart={activeVerificationReportPrintFlow.autoStart}
          isLoadingPrintInterruptions={isLoadingPrintInterruptions}
          printInterruptions={printInterruptions}
          onClose={() => setActiveVerificationReportPrintFlow(null)}
          onMarkPrinted={async (payload) => {
            await applyVerificationReportMutation(
              activeVerificationReportPrintFlow.report,
              'printed',
              payload,
            );
          }}
          onMarkPrintInterrupted={async (payload) => {
            await applyVerificationReportMutation(
              activeVerificationReportPrintFlow.report,
              'print_interrupted',
              payload,
            );
          }}
          onMarkReprinted={async (payload) => {
            await applyVerificationReportMutation(
              activeVerificationReportPrintFlow.report,
              'reprinted',
              payload,
            );
          }}
        />
      )}

      {copyingPartConfig && (
        <PartConfigFormModal
          title={`Copiar ${copyingPartConfig.partNumber}`}
          submitLabel='Guardar copia'
          submittingLabel='Guardando copia...'
          gtins={gtins}
          rfidPrograms={rfidPrograms}
          isCatalogLoading={isLoadingGtins || isLoadingRfidPrograms}
          initialData={copyingPartConfig}
          copySourcePartNumber={copyingPartConfig.partNumber}
          onClose={() => setCopyingPartConfig(null)}
          onSubmit={handleCopyPartConfig}
        />
      )}

      {reportingServiceOrder && (
        <ServiceOrderReportModal
          serviceOrder={reportingServiceOrder}
          requestType={reportRequestType}
          notes={reportNotes}
          onRequestTypeChange={setReportRequestType}
          onNotesChange={setReportNotes}
          onClose={() => {
            setReportingServiceOrder(null);
            setReportRequestType('missing_product');
            setReportNotes('');
          }}
          onSubmit={handleCreateChangeRequest}
        />
      )}

      {resolvingChangeRequest && (
        <ServiceOrderChangeRequestResolveModal
          serviceOrder={
            serviceOrders.find(
              (serviceOrder) => serviceOrder._id === resolvingChangeRequest.serviceOrderId,
            ) ?? {
              _id: resolvingChangeRequest.serviceOrderId,
              folio: resolvingChangeRequest.serviceOrderFolio,
              readingMode: 'manual',
              partNumber: '',
              gtin: '',
              rfidProgram: undefined,
              quantity: 1,
              status: 'blocked',
            }
          }
          changeRequest={resolvingChangeRequest}
          onClose={() => setResolvingChangeRequest(null)}
          onSubmit={handleResolveChangeRequest}
        />
      )}

      {pendingVerificationReportAction && (
        <VerificationReportStatusModal
          report={pendingVerificationReportAction.report}
          action='print_interrupted'
          isLoadingPrintInterruptions={isLoadingPrintInterruptions}
          printInterruptions={printInterruptions}
          onClose={() => setPendingVerificationReportAction(null)}
          onSubmit={handleSubmitVerificationReportAction}
        />
      )}

      {pendingPrintInterruptionAction && (
        <ConfirmActionModal
          title='Confirmar eliminacion de interrupcion'
          message={`Se eliminara la interrupcion "${pendingPrintInterruptionAction.interruption.title}". Deseas continuar?`}
          confirmLabel='Eliminar'
          confirmVariant='danger'
          isSubmitting={isSubmittingPrintInterruptionDelete}
          onCancel={() => setPendingPrintInterruptionAction(null)}
          onConfirm={handleConfirmPendingPrintInterruptionAction}
        />
      )}

      {pendingGtinAction && (
        <ConfirmActionModal
          title={
            pendingGtinAction.type === 'delete'
              ? 'Confirmar eliminacion de GTIN'
              : pendingGtinAction.type === 'deactivate'
                ? 'Confirmar desactivacion de GTIN'
                : 'Confirmar activacion de GTIN'
          }
          message={
            pendingGtinAction.type === 'delete'
              ? `Se eliminara el GTIN ${pendingGtinAction.gtin.value}. En el backend actual esta accion lo desactiva, no lo borra permanentemente. Deseas continuar?`
              : pendingGtinAction.type === 'deactivate'
                ? `Se desactivara el GTIN ${pendingGtinAction.gtin.value}. Deseas continuar?`
                : `Se activara el GTIN ${pendingGtinAction.gtin.value}. Deseas continuar?`
          }
          confirmLabel={
            pendingGtinAction.type === 'delete'
              ? 'Eliminar'
              : pendingGtinAction.type === 'deactivate'
                ? 'Desactivar'
                : 'Activar'
          }
          confirmVariant={pendingGtinAction.type === 'delete' ? 'danger' : 'default'}
          isSubmitting={isSubmittingGtinAction}
          onCancel={() => setPendingGtinAction(null)}
          onConfirm={handleConfirmPendingGtinAction}
        />
      )}

      {pendingRfidProgramAction && (
        <ConfirmActionModal
          title={
            pendingRfidProgramAction.type === 'delete'
              ? 'Confirmar eliminacion de RFID Program'
              : pendingRfidProgramAction.type === 'deactivate'
                ? 'Confirmar desactivacion de RFID Program'
                : 'Confirmar activacion de RFID Program'
          }
          message={
            pendingRfidProgramAction.type === 'delete'
              ? `Se eliminara el RFID Program ${pendingRfidProgramAction.rfidProgram.value}. En el backend actual esta accion lo desactiva, no lo borra permanentemente. Deseas continuar?`
              : pendingRfidProgramAction.type === 'deactivate'
                ? `Se desactivara el RFID Program ${pendingRfidProgramAction.rfidProgram.value}. Deseas continuar?`
                : `Se activara el RFID Program ${pendingRfidProgramAction.rfidProgram.value}. Deseas continuar?`
          }
          confirmLabel={
            pendingRfidProgramAction.type === 'delete'
              ? 'Eliminar'
              : pendingRfidProgramAction.type === 'deactivate'
                ? 'Desactivar'
                : 'Activar'
          }
          confirmVariant={pendingRfidProgramAction.type === 'delete' ? 'danger' : 'default'}
          isSubmitting={isSubmittingRfidProgramAction}
          onCancel={() => setPendingRfidProgramAction(null)}
          onConfirm={handleConfirmPendingRfidProgramAction}
        />
      )}

      {pendingUserAction && (
        <ConfirmActionModal
          title={
            pendingUserAction.type === 'delete'
              ? 'Confirmar eliminacion de usuario'
              : pendingUserAction.type === 'deactivate'
                ? 'Confirmar deshabilitacion de usuario'
                : 'Confirmar habilitacion de usuario'
          }
          message={
            pendingUserAction.type === 'delete'
              ? `Se eliminara el usuario ${pendingUserAction.user.username}. Esta accion no se puede deshacer. Deseas continuar?`
              : pendingUserAction.type === 'deactivate'
                ? `Se deshabilitara el usuario ${pendingUserAction.user.username}. No podra iniciar sesion hasta ser habilitado de nuevo. Deseas continuar?`
                : `Se habilitara el usuario ${pendingUserAction.user.username}. Deseas continuar?`
          }
          confirmLabel={
            pendingUserAction.type === 'delete'
              ? 'Eliminar'
              : pendingUserAction.type === 'deactivate'
                ? 'Deshabilitar'
                : 'Habilitar'
          }
          confirmVariant={pendingUserAction.type === 'delete' ? 'danger' : 'default'}
          isSubmitting={isSubmittingUserAction}
          onCancel={() => setPendingUserAction(null)}
          onConfirm={handleConfirmPendingUserAction}
        />
      )}

      {pendingResponsibleAction && (
        <ConfirmActionModal
          title={
            pendingResponsibleAction.type === 'delete'
              ? 'Confirmar eliminacion de responsable'
              : pendingResponsibleAction.type === 'deactivate'
                ? 'Confirmar deshabilitacion de responsable'
                : 'Confirmar habilitacion de responsable'
          }
          message={
            pendingResponsibleAction.type === 'delete'
              ? `Se eliminara el responsable ${pendingResponsibleAction.responsible.name}. Esta accion no se puede deshacer. Deseas continuar?`
              : pendingResponsibleAction.type === 'deactivate'
                ? `Se deshabilitara el responsable ${pendingResponsibleAction.responsible.name}. No aparecera como opcion activa hasta ser habilitado de nuevo. Deseas continuar?`
                : `Se habilitara el responsable ${pendingResponsibleAction.responsible.name}. Deseas continuar?`
          }
          confirmLabel={
            pendingResponsibleAction.type === 'delete'
              ? 'Eliminar'
              : pendingResponsibleAction.type === 'deactivate'
                ? 'Deshabilitar'
                : 'Habilitar'
          }
          confirmVariant={pendingResponsibleAction.type === 'delete' ? 'danger' : 'default'}
          isSubmitting={isSubmittingResponsibleAction}
          onCancel={() => setPendingResponsibleAction(null)}
          onConfirm={handleConfirmPendingResponsibleAction}
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
