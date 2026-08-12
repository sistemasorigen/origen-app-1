
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Layout from './components/layout/Estructura';
import ErrorBoundary from './components/ui/LimiteError';
import Dashboard from './pages/home/Home';
import InfoPoint from './pages/primarias/PuntoInformacion';
import PaginaNuevoBautismo from './pages/punto-informacion/PaginaNuevoBautismo';
import PaginaNuevoPrestamo from './pages/punto-informacion/PaginaNuevoPrestamo';
import PaginaNuevaPresentacion from './pages/punto-informacion/PaginaNuevaPresentacion';
import PaginaNuevoMovimiento from './pages/punto-informacion/PaginaNuevoMovimiento';
import PaginaNuevoEvento from './pages/punto-informacion/PaginaNuevoEvento';
import PaginaNuevoAnuncio from './pages/punto-informacion/PaginaNuevoAnuncio';
import Groups from './pages/groups/Grupos';
import Admin from './pages/admin/Administrador';
import AuthScreen from './pages/auth/PantallaAutenticacion';
import Store from './pages/primarias/Tienda';
import Alabanza from './pages/primarias/Alabanza';
import Pastores from './pages/audiencia/Pastores';
import HostDashboard from './pages/groups/PanelAnfitrion';
import DetalleGrupoAnfitrion from './pages/groups/DetalleGrupoAnfitrion';
import PaginaAsistenciaGrupo from './pages/groups/PaginaAsistenciaGrupo';
import PaginaBajaGrupo from './pages/groups/PaginaBajaGrupo';
import PaginaSolicitudesGrupo from './pages/groups/PaginaSolicitudesGrupo';
import PaginaTransferirGrupo from './pages/groups/PaginaTransferirGrupo';
import PaginaCrearGrupo from './pages/groups/PaginaCrearGrupo';
import PaginaEditarGrupo from './pages/groups/PaginaEditarGrupo';
import PaginaReabrirGrupo from './pages/groups/PaginaReabrirGrupo';
import PaginaInscribirParticipante from './pages/groups/PaginaInscribirParticipante';
import UpdatePassword from './pages/auth/ActualizarContrasena';
import VerifyEmail from './pages/auth/VerificarEmail';
import Bienvenida from './pages/bienvenida/Bienvenida';
import InfluosPage from './pages/influos/InfluosPagina';
import InfluosAcceso from './pages/influos/InfluosAcceso';
import Formulario from './pages/bienvenida/Formulario';
import TutorialsPage from './pages/user/PaginaTutoriales';
import Coordinators from './pages/coordinadores/Coordinadores';
import PastoralCareForm from './pages/audiencia/AudienciaServiciosFormulario';
import Notifications from './pages/user/Notificaciones';
import PastoralCareDashboard from './pages/audiencia/AudienciaServiciosPrincipal';
import ProfilePage from './pages/user/PaginaPerfil';
import Prode from './pages/prode/Prode';
import AdminProde from './pages/prode/AdminProde';
import ProdeRanking from './pages/prode/ProdeRanking';
import ProdeResultados from './pages/prode/ProdeResultados';
import Eventos from './pages/eventos/Eventos';
import Ninez from './pages/ninez/Ninez';
import ConfiguracionNinez from './pages/ninez/admin/ConfiguracionNinez';
import PanelEventos from './pages/eventos/PanelEventos';
import InscripcionDPadre from './pages/eventos/dpadre/InscripcionDPadre';
import RankingDPadre from './pages/eventos/dpadre/RankingDPadre';
import InscripcionDiaNino from './pages/eventos/dianino/InscripcionDiaNino';
import InscripcionInfluosDia from './pages/eventos/influos/InscripcionInfluosDia';
import BuscarInfluosDia from './pages/eventos/influos/BuscarInfluosDia';
import AdminInfluosDia from './pages/eventos/influos/AdminInfluosDia';
import AdminEventosGeneral from './pages/eventos/general/AdminEventosGeneral';
import CrearEventoGeneral from './pages/eventos/general/CrearEventoGeneral';
import NuevaInfluosDia from './pages/eventos/influos/NuevaInfluosDia';
import BuscarDiaNino from './pages/eventos/dianino/BuscarDiaNino';
import AdminDiaNino from './pages/eventos/dianino/AdminDiaNino';
import DetalleDiaNino from './pages/eventos/dianino/DetalleDiaNino';
import NuevaDiaNino from './pages/eventos/dianino/NuevaDiaNino';
import EscanerDiaNino from './pages/eventos/dianino/EscanerDiaNino';
import AcreditarEscaneoDiaNino from './pages/eventos/dianino/AcreditarEscaneoDiaNino';
import Puntuacion from './pages/eventos/dpadre/Puntuacion';
import AdminDPadre from './pages/eventos/dpadre/AdminDPadre';
import DetalleFamilia from './pages/eventos/dpadre/DetalleFamilia';
import CalendarioGCX from './pages/gcx/CalendarioGCX';
import GestionDeGrupos from './pages/admingcx/GestionDeGrupos';
import DetalleGrupoAdmin from './pages/admingcx/DetalleGrupoAdmin';
import BajasGrupos from './pages/admingcx/BajasGrupos';
import InscriptosGrupo from './pages/admingcx/InscriptosGrupo';
import AgregarMiembroGrupo from './pages/admingcx/AgregarMiembroGrupo';
import CrearGrupoAdmin from './pages/admingcx/CrearGrupoAdmin';
import EditarGrupoAdmin from './pages/admingcx/EditarGrupoAdmin';
import GestionDeAnfitriones from './pages/admingcx/GestionDeAnfitriones';
import GestionDeCoordinadores from './pages/admingcx/GestionDeCoordinadores';
import Categorias from './pages/admingcx/Categorias';
import Etiquetas from './pages/admingcx/Etiquetas';
import Configuracion from './pages/admingcx/Configuracion';
import Temporadas from './pages/admingcx/Temporadas';
import AdminTrivia from './pages/trivia/AdminTrivia';
import CrearJuego from './pages/trivia/CrearJuego';
import TriviaLanding from './pages/trivia/TriviaLanding';
import TriviaUnirse from './pages/trivia/TriviaUnirse';
import TriviaJugador from './pages/trivia/TriviaJugador';
import TriviaProyector from './pages/trivia/TriviaProyector';
import TriviaControl from './pages/trivia/TriviaControl';
import TriviaHistorial from './pages/trivia/TriviaHistorial';
import TriviaPlanilla  from './pages/trivia/TriviaPlanilla';
import SystemLoginModal from './components/modals/ModalLoginSistema';
import CompleteProfileModal from './components/modals/ModalCompletarPerfil';
import { User, UserRole, AppConfig } from './types';
import { db } from './services/dbService';
import { supabaseService } from './services/supabaseService';
import { hasRole } from './services/authUtils';
import { AudioProvider } from './contexts/AudioContext';
import { useVersionCheck } from './hooks/useVersionCheck';
import ModalActualizacion from './components/ui/ModalActualizacion';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ToastProvider } from './pages/punto-informacion/context/ContextoToast';
import { RefreshCw, AlertCircle } from 'lucide-react';

// Loading timeout constant
const LOADING_TIMEOUT = 15000; // 15 seconds

// Loading Screen Component with timeout handling
const LoadingScreen: React.FC<{
    onRetry: () => void;
    error?: string | null;
    showTimeout: boolean;
}> = ({ onRetry, error, showTimeout }) => {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-black transition-colors">
            {!error && !showTimeout && (
                <>
                    <div className="w-10 h-10 border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Cargando...</p>
                </>
            )}

            {(showTimeout || error) && (
                <div className="text-center p-8 max-w-md">
                    <div className="w-16 h-16 mx-auto mb-6 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                        <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                    </div>

                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                        {error ? 'Error de Conexión' : 'Carga Lenta'}
                    </h2>

                    <p className="text-slate-500 dark:text-slate-400 mb-6">
                        {error || 'La carga está tardando más de lo esperado. Esto puede deberse a una conexión lenta o un problema temporal.'}
                    </p>

                    <button
                        onClick={onRetry}
                        className="flex items-center justify-center gap-2 mx-auto px-6 py-3 bg-black dark:bg-white text-white dark:text-black font-bold rounded-xl hover:opacity-90 transition-all"
                    >
                        <RefreshCw className="w-5 h-5" />
                        Reintentar
                    </button>
                </div>
            )}
        </div>
    );
};

const AppContent: React.FC = () => {
    // Authentication State from Context (including isRecoveryMode)
    // Optimized: uses isInitialized for fast hydration check
    const {
        user,
        isLoadingSession, // Only block if we don't know the session yet
        error: authError,
        signIn,
        signOut,
        retryAuth,
        isRecoveryMode,
        needsProfileCompletion,
        completeProfile
    } = useAuth();

    // Hooks
    const navigate = useNavigate();
    const location = useLocation();

    // App Config
    const [config, setConfig] = useState<AppConfig>(db.getAppConfig());
    const [configLoading, setConfigLoading] = useState(false);

    // State
    const [showLoadingTimeout, setShowLoadingTimeout] = useState(false);
    const [isVolunteerModalOpen, setIsVolunteerModalOpen] = useState(false);

    // Derived/Constant (could be from config)
    const showVolunteerAccess = true;

    // Scroll to top on route change
    useEffect(() => {
        const path = window.location.hash; // Handle HashRouter explicitly if needed, but scrollTo works generally
        window.scrollTo(0, 0);
    }, [location.pathname]); // location is derived from useLocation hook logic from react-router

    // Redirigir post-login con Google usando el destino guardado en sessionStorage.
    // IMPORTANTE: no consumir el destino guardado mientras needsProfileCompletion
    // sea true — si lo hiciéramos apenas `user` está listo, el modal de completar
    // perfil (que reemplaza TODO el árbol de rutas, ver más abajo en este archivo)
    // taparía la navegación real y el destino se perdería sin una segunda
    // oportunidad. Se espera a que el perfil esté 100% completo antes de leer y
    // borrar sessionStorage.
    useEffect(() => {
        if (!user || needsProfileCompletion) return;
        const destino = sessionStorage.getItem('post_login_redirect');
        if (!destino) return;

        // Solo se borra/consume el destino guardado si realmente vamos a
        // navegar — si no estamos en una ruta "neutra", se deja intacto en
        // sessionStorage para la próxima vez que este efecto corra.
        if (location.pathname === '/auth' || location.pathname === '/') {
            sessionStorage.removeItem('post_login_redirect');
            navigate(destino);
        }
    }, [user, needsProfileCompletion, location.pathname]);

    // Effects
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isLoadingSession) {
            timer = setTimeout(() => {
                setShowLoadingTimeout(true);
            }, LOADING_TIMEOUT);
        } else {
            setShowLoadingTimeout(false);
        }
        return () => clearTimeout(timer);
    }, [isLoadingSession]);

    // Handlers
    const handleAuthScreenLogin = () => {
        const from = location.state?.from;
        sessionStorage.removeItem('post_login_redirect');
        if (from && from.pathname) {
            navigate(`${from.pathname}${from.search || ''}${from.hash || ''}`);
        } else {
            navigate('/');
        }
    };

    const onLogoutClick = async () => {
        await signOut();
    };

    const handleLogin = () => {
        // sessionStorage sobrevive el redirect completo
        // del login con Google (location.state se pierde
        // en ese flujo porque el browser recarga la página)
        sessionStorage.setItem(
            'post_login_redirect',
            `${location.pathname}${location.search || ''}`
        );
        navigate('/auth', { state: { from: location } });
    };

    const handleGlobalVolunteerLogin = async (email: string, pass: string) => {
        const { success } = await signIn(email, pass);
        if (success) {
            setIsVolunteerModalOpen(false);
        }
        return success;
    };

    const isSuperAdmin = (u: User | null) => {
        if (!u) return false;
        return u.role === UserRole.SUPER_ADMIN || u.roles?.includes(UserRole.SUPER_ADMIN);
    };

    const refreshConfig = () => {
        setConfig(db.getAppConfig());
    };

    // Show loading screen ONLY if session is unknown
    // This allows the app to render much faster (Non-Blocking)
    if (isLoadingSession) {
        return (
            <LoadingScreen
                onRetry={retryAuth}
                error={authError}
                showTimeout={showLoadingTimeout}
            />
        );
    }

    // Show error state if auth failed but not loading
    if (authError && !user) {
        return (
            <LoadingScreen
                onRetry={retryAuth}
                error={authError}
                showTimeout={false}
            />
        );
    }

    // Show profile completion modal for OAuth users missing data
    // "Smart Session Hydration": Logic is deemed in AuthContext
    if (needsProfileCompletion && user) {
        return (
            <CompleteProfileModal
                userName={user?.name || 'Usuario'}
                onComplete={completeProfile}
            />
        );
    }

    return (
        <Routes>
            {/* ── RUTAS SIN LAYOUT ────────────────── */}
            <Route
                path="/auth"
                element={
                    !user
                        ? <AuthScreen onLoginSuccess={handleAuthScreenLogin} />
                        : <Navigate to={
                            (location.state as { from?: { pathname: string; search: string } })?.from
                                ? `${(location.state as any).from.pathname}${(location.state as any).from.search || ''}`
                                : '/'
                          } />
                }
            />
            <Route path="/update-password" element={<UpdatePassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/form" element={<Formulario />} />
            <Route path="/dia-del-nino" element={<InscripcionDiaNino />} />
            <Route path="/tribal-wars" element={<InscripcionInfluosDia />} />
            <Route path="/tribal-wars/buscar" element={<BuscarInfluosDia />} />
            <Route path="/dia-del-nino/buscar" element={<BuscarDiaNino />} />
            <Route path="/influos-acceso" element={<InfluosAcceso />} />
            <Route path="/id-dpadre" element={<InscripcionDPadre />} />
            <Route path="/eventos/ranking-diadelpadre" element={<RankingDPadre />} />
            {/* Kahoot Origen — rutas públicas de jugadores y proyector */}
            <Route path="/trivia" element={<TriviaLanding />} />
            <Route path="/trivia/unirse/:pin" element={<TriviaUnirse />} />
            <Route path="/trivia/jugar/:pin" element={<TriviaJugador />} />
            <Route path="/trivia/pantalla/:pin" element={<TriviaProyector />} />

            {/* ── RUTAS PÚBLICAS CON LAYOUT ────────── */}
            <Route path="/" element={
                <Layout
                    userRole={user?.role || null}
                    currentUser={user}
                    onLogout={onLogoutClick}
                    appConfig={config}
                    onVolunteerClick={
                        user && showVolunteerAccess
                            ? () => setIsVolunteerModalOpen(true)
                            : undefined
                    }
                >
                    <SystemLoginModal
                        isOpen={isVolunteerModalOpen}
                        onClose={() => setIsVolunteerModalOpen(false)}
                        systemName="Acceso Voluntarios"
                        onLogin={handleGlobalVolunteerLogin}
                    />
                    <Dashboard
                        currentUser={user}
                        onLoginRequest={handleLogin}
                    />
                </Layout>
            } />

            <Route path="/gcx" element={
                <Layout
                    userRole={user?.role || null}
                    currentUser={user}
                    onLogout={onLogoutClick}
                    appConfig={config}
                    onVolunteerClick={
                        user && showVolunteerAccess
                            ? () => setIsVolunteerModalOpen(true)
                            : undefined
                    }
                >
                    <Groups
                        currentUser={user}
                        onLoginRequest={handleLogin}
                    />
                </Layout>
            } />

            <Route path="/eventos" element={
                <Layout
                    userRole={user?.role || null}
                    currentUser={user}
                    onLogout={onLogoutClick}
                    appConfig={config}
                    onVolunteerClick={
                        user && showVolunteerAccess
                            ? () => setIsVolunteerModalOpen(true)
                            : undefined
                    }
                >
                    <Eventos />
                </Layout>
            } />

            {/* Niñez es un módulo interno: ocultarlo del menú no alcanzaba,
                porque /ninez seguía abierta a cualquiera que tuviera el link.
                Mismos roles que el ítem del menú y que /admin-ninez/*. */}
            <Route path="/ninez" element={
                (user && hasRole(user, [
                    UserRole.SUPER_ADMIN,
                    UserRole.PASTOR,
                    UserRole.ENCARGADO_NINEZ,
                ]))
                    ? <Layout
                        userRole={user?.role || null}
                        currentUser={user}
                        onLogout={onLogoutClick}
                        appConfig={config}
                        onVolunteerClick={
                            user && showVolunteerAccess
                                ? () => setIsVolunteerModalOpen(true)
                                : undefined
                        }
                    >
                        <Ninez currentUser={user} />
                    </Layout>
                    : <Navigate to="/" />
            } />

            {/* ── RUTAS PROTEGIDAS CON LAYOUT ──────── */}
            <Route path="*" element={
                !user
                    ? <Navigate
                        to="/auth"
                        state={{ from: location }}
                        replace
                      />
                    : (
                        <Layout
                            userRole={user?.role || null}
                            currentUser={user}
                            onLogout={onLogoutClick}
                            appConfig={config}
                            onVolunteerClick={
                                showVolunteerAccess
                                    ? () => setIsVolunteerModalOpen(true)
                                    : undefined
                            }
                        >
                            <SystemLoginModal
                                isOpen={isVolunteerModalOpen}
                                onClose={() => setIsVolunteerModalOpen(false)}
                                systemName="Acceso Voluntarios"
                                onLogin={handleGlobalVolunteerLogin}
                            />
                            <Routes>
                                <Route path="/punto-de-informacion" element={<InfoPoint currentUser={user} />} />
                                <Route path="/punto-de-informacion/bautismos/nuevo" element={<PaginaNuevoBautismo />} />
                                <Route path="/punto-de-informacion/prestamos/nuevo" element={<PaginaNuevoPrestamo />} />
                                <Route path="/punto-de-informacion/presentacion-ninos/nuevo" element={<PaginaNuevaPresentacion />} />
                                <Route path="/punto-de-informacion/movimientos/nuevo" element={<PaginaNuevoMovimiento />} />
                                <Route path="/punto-de-informacion/eventos/nuevo" element={<PaginaNuevoEvento />} />
                                <Route path="/punto-de-informacion/anuncios/nuevo" element={<PaginaNuevoAnuncio />} />
                                <Route path="/panel-admin" element={
                                    isSuperAdmin(user)
                                        ? <Admin currentUser={user} onConfigUpdate={refreshConfig} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/store" element={<Store currentUser={user} />} />
                                <Route path="/alabanza" element={<Alabanza currentUser={user} onLoginRequest={handleLogin} />} />
                                <Route path="/reportes" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_PUNTO,
                                        UserRole.ADMIN_PUNTO,
                                        UserRole.ENCARGADO_GRUPOS,
                                        UserRole.REPORTES,
                                        UserRole.ADMIN_GROUPS
                                    ]))
                                        ? <Pastores currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/bienvenida" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ENCARGADO_BIENVENIDA,
                                        UserRole.VOLUNTARIO_BIENVENIDA
                                    ]))
                                        ? <Bienvenida />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/influos" element={
                                    (user && hasRole(user, [
                                        UserRole.INFLUOS,
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR
                                    ]))
                                        ? <InfluosPage />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/mis-grupos" element={
                                    (user && hasRole(user, [
                                        UserRole.ANFITRION,
                                        UserRole.CO_ANFITRION,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.SUPER_ADMIN
                                    ]))
                                        ? <HostDashboard currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/mis-grupos/crear-grupo" element={
                                    (user && hasRole(user, [
                                        UserRole.ANFITRION,
                                        UserRole.CO_ANFITRION,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.SUPER_ADMIN
                                    ]))
                                        ? <PaginaCrearGrupo currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/mis-grupos/:groupId" element={
                                    (user && hasRole(user, [
                                        UserRole.ANFITRION,
                                        UserRole.CO_ANFITRION,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.SUPER_ADMIN
                                    ]))
                                        ? <DetalleGrupoAnfitrion currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/mis-grupos/:groupId/asistencia" element={
                                    (user && hasRole(user, [
                                        UserRole.ANFITRION,
                                        UserRole.CO_ANFITRION,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.SUPER_ADMIN
                                    ]))
                                        ? <PaginaAsistenciaGrupo currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/mis-grupos/:groupId/bajas" element={
                                    (user && hasRole(user, [
                                        UserRole.ANFITRION,
                                        UserRole.CO_ANFITRION,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.SUPER_ADMIN
                                    ]))
                                        ? <PaginaBajaGrupo currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/mis-grupos/:groupId/solicitudes" element={
                                    (user && hasRole(user, [
                                        UserRole.ANFITRION,
                                        UserRole.CO_ANFITRION,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.SUPER_ADMIN
                                    ]))
                                        ? <PaginaSolicitudesGrupo currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/mis-grupos/:groupId/transferir" element={
                                    (user && hasRole(user, [
                                        UserRole.ANFITRION,
                                        UserRole.CO_ANFITRION,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.SUPER_ADMIN
                                    ]))
                                        ? <PaginaTransferirGrupo currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/mis-grupos/:groupId/editar-grupo" element={
                                    (user && hasRole(user, [
                                        UserRole.ANFITRION,
                                        UserRole.CO_ANFITRION,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.SUPER_ADMIN
                                    ]))
                                        ? <PaginaEditarGrupo currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/mis-grupos/:groupId/reabrir-grupo" element={
                                    (user && hasRole(user, [
                                        UserRole.ANFITRION,
                                        UserRole.CO_ANFITRION,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.SUPER_ADMIN
                                    ]))
                                        ? <PaginaReabrirGrupo currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/mis-grupos/:groupId/inscribir" element={
                                    (user && hasRole(user, [
                                        UserRole.ANFITRION,
                                        UserRole.CO_ANFITRION,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.SUPER_ADMIN
                                    ]))
                                        ? <PaginaInscribirParticipante currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/gcx/calendario" element={
                                    user ? <CalendarioGCX currentUser={user} /> : <Navigate to="/" />
                                } />
                                <Route path="/admingcx/gestion-de-grupos" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.ENCARGADO_GRUPOS,
                                    ]))
                                        ? <GestionDeGrupos />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/admingcx/gestion-de-grupos/bajas" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.ENCARGADO_GRUPOS,
                                    ]))
                                        ? <BajasGrupos />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/admingcx/gestion-de-grupos/agregar-grupo" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.ENCARGADO_GRUPOS,
                                    ]))
                                        ? <AgregarMiembroGrupo />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/admingcx/gestion-de-grupos/crear-grupo" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.ENCARGADO_GRUPOS,
                                    ]))
                                        ? <CrearGrupoAdmin />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/admingcx/gestion-de-grupos/editar-grupo/:groupId" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.ENCARGADO_GRUPOS,
                                    ]))
                                        ? <EditarGrupoAdmin />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/admingcx/gestion-de-grupos/inscriptos/:groupId" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.ENCARGADO_GRUPOS,
                                    ]))
                                        ? <InscriptosGrupo />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/admingcx/gestion-de-grupos/detalles/:groupId" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.ENCARGADO_GRUPOS,
                                    ]))
                                        ? <DetalleGrupoAdmin />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/admingcx/gestion-de-anfitriones" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.ENCARGADO_GRUPOS,
                                    ]))
                                        ? <GestionDeAnfitriones />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/admingcx/gestion-de-coordinadores" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                    ]))
                                        ? <GestionDeCoordinadores />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/admingcx/categorias" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                    ]))
                                        ? <Categorias />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/admingcx/etiquetas" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                    ]))
                                        ? <Etiquetas />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/admingcx/configuracion" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                    ]))
                                        ? <Configuracion />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/admingcx/temporadas" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                    ]))
                                        ? <Temporadas />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/coordinators" element={
                                    (user && hasRole(user, [UserRole.COORDINATOR, UserRole.SUPER_ADMIN]))
                                        ? <Coordinators currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/tutoriales" element={<TutorialsPage />} />
                                <Route path="/audiencia-servicios" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ADMIN_CUIDADO_PASTORAL
                                    ]))
                                        ? <PastoralCareDashboard currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/audiencia-servicios/new" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ADMIN_CUIDADO_PASTORAL
                                    ]))
                                        ? <PastoralCareForm currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/prode" element={<Prode />} />
                                <Route path="/prode/ranking" element={<ProdeRanking />} />
                                <Route path="/prode/resultados" element={<ProdeResultados />} />
                                <Route path="/prode/administracion" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.PRODE
                                    ]))
                                        ? <AdminProde />
                                        : <Navigate to="/" />
                                } />

                                <Route path="/panel-eventos" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                        UserRole.PRODE,
                                    ]))
                                        ? <PanelEventos currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/eventos/admin/diadelpadre" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                    ]))
                                        ? <AdminDPadre currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/eventos/admin/diadelnino" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                        UserRole.ENCARGADO_NINEZ,
                                        UserRole.ACREDITACION,
                                    ]))
                                        ? <AdminDiaNino currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/eventos/admin/tribal-wars" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                        UserRole.INFLUOS,
                                    ]))
                                        ? <AdminInfluosDia currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                {/* Guard de SUPER_ADMIN + ENCARGADO_EVENTOS — sin PASTOR, decisión explícita */}
                                <Route path="/eventos/admin/general/crear-evento" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ENCARGADO_EVENTOS,
                                    ]))
                                        ? <CrearEventoGeneral />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/eventos/admin/general" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ENCARGADO_EVENTOS,
                                    ]))
                                        ? <AdminEventosGeneral currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/eventos/admin/tribal-wars/nueva" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                        UserRole.INFLUOS,
                                    ]))
                                        ? <NuevaInfluosDia />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/eventos/admin/diadelnino/nueva" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                        UserRole.ENCARGADO_NINEZ,
                                        UserRole.ACREDITACION,
                                    ]))
                                        ? <NuevaDiaNino />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/eventos/admin/diadelnino/escaner" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                        UserRole.ENCARGADO_NINEZ,
                                        UserRole.ACREDITACION,
                                    ]))
                                        ? <EscanerDiaNino />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/eventos/admin/diadelnino/escaner/:ticketId" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                        UserRole.ENCARGADO_NINEZ,
                                        UserRole.ACREDITACION,
                                    ]))
                                        ? <AcreditarEscaneoDiaNino />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/eventos/admin/diadelnino/:sessionId" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                        UserRole.ENCARGADO_NINEZ,
                                        UserRole.ACREDITACION,
                                    ]))
                                        ? <DetalleDiaNino />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/eventos/puntuacion" element={
                                    (user && hasRole(user, [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.EVENTOS, UserRole.ENCARGADO_EVENTOS]))
                                        ? <Puntuacion zona="trivia" currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/eventos/futboltenis" element={
                                    (user && hasRole(user, [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.EVENTOS, UserRole.ENCARGADO_EVENTOS]))
                                        ? <Puntuacion zona="futbol" currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/eventos/dpadre/:id" element={
                                    (user && hasRole(user, [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.EVENTOS, UserRole.ENCARGADO_EVENTOS]))
                                        ? <DetalleFamilia currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/admin-ninez/configuracion" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_NINEZ,
                                    ]))
                                        ? <ConfiguracionNinez />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/trivia/admin" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                    ]))
                                        ? <AdminTrivia currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/trivia/admin/nuevo" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                    ]))
                                        ? <CrearJuego currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/trivia/admin/:id" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                    ]))
                                        ? <TriviaControl currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/trivia/historial" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                    ]))
                                        ? <TriviaHistorial currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/trivia/historial/:id" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                    ]))
                                        ? <TriviaPlanilla currentUser={user} />
                                        : <Navigate to="/" />
                                } />
                                <Route path="/notificaciones" element={<Notifications />} />
                                <Route path="/perfil" element={<ProfilePage />} />
                                <Route path="*" element={<Navigate to="/" />} />
                            </Routes>
                        </Layout>
                    )
            } />
        </Routes>
    );
};

const App: React.FC = () => {
    const { updateAvailable, forceHardReset } = useVersionCheck();

    return (
        <ErrorBoundary>
            <AudioProvider>
                <AuthProvider>
                    <NotificationProvider>
                        <ToastProvider>
                            <HashRouter>
                                <AppContent />
                            </HashRouter>
                            {updateAvailable && <ModalActualizacion onConfirm={forceHardReset} />}
                        </ToastProvider>
                    </NotificationProvider>
                </AuthProvider>
            </AudioProvider>
        </ErrorBoundary>
    );
};

export default App;
