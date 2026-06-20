
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Layout from './components/layout/Estructura';
import ErrorBoundary from './components/ui/LimiteError';
import Dashboard from './pages/home/Home';
import InfoPoint from './pages/primarias/PuntoInformacion';
import Groups from './pages/groups/Grupos';
import Admin from './pages/admin/Administrador';
import AuthScreen from './pages/auth/PantallaAutenticacion';
import Store from './pages/primarias/Tienda';
import Alabanza from './pages/primarias/Alabanza';
import Pastores from './pages/audiencia/Pastores';
import HostDashboard from './pages/groups/PanelAnfitrion';
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
import PanelEventos from './pages/eventos/PanelEventos';
import InscripcionDPadre from './pages/eventos/dpadre/InscripcionDPadre';
import RankingDPadre from './pages/eventos/dpadre/RankingDPadre';
import Puntuacion from './pages/eventos/dpadre/Puntuacion';
import AdminDPadre from './pages/eventos/dpadre/AdminDPadre';
import DetalleFamilia from './pages/eventos/dpadre/DetalleFamilia';
import CalendarioGCX from './pages/gcx/CalendarioGCX';
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

    // Redirigir post-login con Google usando el destino guardado en sessionStorage
    useEffect(() => {
        if (!user) return;
        const destino = sessionStorage.getItem('post_login_redirect');
        if (destino) {
            sessionStorage.removeItem('post_login_redirect');
            // Solo redirigir si estamos en una ruta "neutra"
            // (auth, raíz) para no interrumpir navegación normal
            if (location.pathname === '/auth' || location.pathname === '/') {
                navigate(destino);
            }
        }
    }, [user]);

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
                                <Route path="/gcx/calendario" element={
                                    user ? <CalendarioGCX currentUser={user} /> : <Navigate to="/" />
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
                                <Route path="/eventos" element={
                                    user ? <Eventos currentUser={user} /> : <Navigate to="/" />
                                } />
                                <Route path="/panel-eventos" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
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
    return (
        <ErrorBoundary>
            <AudioProvider>
                <AuthProvider>
                    <NotificationProvider>
                        <ToastProvider>
                            <HashRouter>
                                <AppContent />
                            </HashRouter>
                        </ToastProvider>
                    </NotificationProvider>
                </AuthProvider>
            </AudioProvider>
        </ErrorBoundary>
    );
};

export default App;
