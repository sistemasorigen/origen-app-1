
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import InfoPoint from './pages/InfoPoint';
import Groups from './pages/Groups';
import Admin from './pages/Admin';
import AuthScreen from './pages/AuthScreen';
import Store from './pages/Store';
import Alabanza from './pages/Alabanza';
import Pastores from './pages/Pastores';
import HostDashboard from './pages/HostDashboard';
import UpdatePassword from './pages/UpdatePassword';
import VerifyEmail from './pages/VerifyEmail';
import Bienvenida from './pages/welcome/Bienvenida';
import InfluosPage from './pages/influos/InfluosPage';
import InfluosAcceso from './pages/influos/InfluosAcceso';
import Formulario from './pages/welcome/Formulario';
import TutorialsPage from './pages/TutorialsPage';
import Coordinators from './pages/coordinators/Coordinators';
import PastoralCareForm from './pages/pastoral/PastoralCareForm';
import Notifications from './pages/Notifications';
import PastoralCareDashboard from './pages/pastoral/PastoralCareDashboard';
import ProfilePage from './pages/ProfilePage';
import SystemLoginModal from './components/SystemLoginModal';
import CompleteProfileModal from './components/CompleteProfileModal';
import { User, UserRole, AppConfig } from './types';
import { db } from './services/dbService';
import { supabaseService } from './services/supabaseService';
import { hasRole } from './services/authUtils';
import { AudioProvider } from './contexts/AudioContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ToastProvider } from './pages/infopoint/context/ToastContext';
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
        navigate('/auth');
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
            {/* PUBLIC AUTH ROUTE */}
            <Route
                path="/auth"
                element={!user ? <AuthScreen onLoginSuccess={handleAuthScreenLogin} /> : <Navigate to="/" />}
            />

            <Route path="/update-password" element={<UpdatePassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/form" element={<Formulario />} />
            <Route path="/influos-acceso" element={<InfluosAcceso />} />

            {/* PROTECTED ROUTES WRAPPED IN LAYOUT */}
            <Route path="*" element={
                !user ? <Navigate to="/auth" state={{ from: location }} replace /> : (
                    <Layout
                        userRole={user?.role || null}
                        currentUser={user}
                        onLogout={onLogoutClick}
                        appConfig={config}
                        onVolunteerClick={showVolunteerAccess ? () => setIsVolunteerModalOpen(true) : undefined}
                    >
                        <SystemLoginModal
                            isOpen={isVolunteerModalOpen}
                            onClose={() => setIsVolunteerModalOpen(false)}
                            systemName="Acceso Voluntarios"
                            onLogin={handleGlobalVolunteerLogin}
                        />

                        <Routes>
                            <Route path="/" element={<Dashboard currentUser={user} onLoginRequest={handleLogin} />} />
                            <Route path="/info-point" element={<InfoPoint currentUser={user} />} />
                            <Route path="/groups" element={<Groups currentUser={user} onLoginRequest={handleLogin} />} />

                            <Route path="/admin" element={
                                isSuperAdmin(user)
                                    ? <Admin currentUser={user} onConfigUpdate={refreshConfig} />
                                    : <Navigate to="/" />
                            } />

                            <Route path="/store" element={<Store currentUser={user} />} />
                            <Route path="/alabanza" element={<Alabanza currentUser={user} onLoginRequest={handleLogin} />} />

                            <Route path="/pastores" element={
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

                            <Route path="/welcome" element={
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

                            <Route path="/host-dashboard" element={
                                (user && hasRole(user, [UserRole.ANFITRION, UserRole.CO_ANFITRION, UserRole.ADMIN_GROUPS, UserRole.SUPER_ADMIN]))
                                    ? <HostDashboard currentUser={user} />
                                    : <Navigate to="/" />
                            } />

                            <Route path="/coordinators" element={
                                (user && hasRole(user, [UserRole.COORDINATOR, UserRole.SUPER_ADMIN]))
                                    ? <Coordinators currentUser={user} />
                                    : <Navigate to="/" />
                            } />

                            <Route path="/tutorials" element={<TutorialsPage />} />

                            <Route path="/pastoral-care" element={
                                (user && hasRole(user, [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.ADMIN_CUIDADO_PASTORAL]))
                                    ? <PastoralCareDashboard currentUser={user} />
                                    : <Navigate to="/" />
                            } />

                            <Route path="/pastoral-care/new" element={
                                (user && hasRole(user, [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.ADMIN_CUIDADO_PASTORAL]))
                                    ? <PastoralCareForm currentUser={user} />
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
