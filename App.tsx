
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
import SystemLoginModal from './components/SystemLoginModal';
import CompleteProfileModal from './components/CompleteProfileModal';
import { User, UserRole, AppConfig } from './types';
import { db } from './services/dbService';
import { supabaseService } from './services/supabaseService';
import { hasRole } from './services/authUtils';
import { AudioProvider } from './contexts/AudioContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
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
    const { user, loading: authLoading, error: authError, signIn, retryAuth, isRecoveryMode, needsProfileCompletion, completeProfile } = useAuth();

    // App Config
    const [config, setConfig] = useState<AppConfig>(db.getAppConfig());
    const [configLoading, setConfigLoading] = useState(false);

    // Loading timeout state
    const [showLoadingTimeout, setShowLoadingTimeout] = useState(false);

    // Global Volunteer Login Modal State
    const [isVolunteerModalOpen, setIsVolunteerModalOpen] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();

    // Loading timeout effect
    useEffect(() => {
        if (authLoading) {
            setShowLoadingTimeout(false);
            const timer = setTimeout(() => {
                setShowLoadingTimeout(true);
            }, LOADING_TIMEOUT);
            return () => clearTimeout(timer);
        } else {
            setShowLoadingTimeout(false);
        }
    }, [authLoading]);

    // Load config with error handling
    useEffect(() => {
        const loadConfig = async () => {
            setConfigLoading(true);
            try {
                const remoteConfig = await supabaseService.getAppConfig();
                if (remoteConfig) {
                    setConfig(remoteConfig);
                    db.saveAppConfig(remoteConfig);
                }
            } catch (error) {
                console.warn('Failed to load remote config, using local:', error);
                // Config already set from db.getAppConfig() in initial state
            } finally {
                setConfigLoading(false);
            }
        };
        loadConfig();
    }, []);

    // Detect email verification mode synchronously (recovery mode now comes from AuthContext)
    const [isVerificationMode] = useState(() => {
        const hash = window.location.hash;
        const hasVerification = hash.includes('access_token') && hash.includes('type=signup');
        if (hasVerification) console.log('Email verification mode detected on init');
        return hasVerification;
    });

    // Redirect authenticated users away from /auth page (handles OAuth redirect)
    // But don't interfere with recovery or verification flows
    useEffect(() => {
        // Skip if in recovery or verification mode
        if (isRecoveryMode || isVerificationMode) {
            return;
        }

        // Normal OAuth flow - redirect authenticated users away from /auth
        if (user && !authLoading && location.pathname === '/auth') {
            navigate('/', { replace: true });
        }
    }, [user, authLoading, location.pathname, navigate, isRecoveryMode, isVerificationMode]);

    // Scroll to top
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [location.pathname]);

    const refreshConfig = async () => {
        try {
            const remoteConfig = await supabaseService.getAppConfig();
            if (remoteConfig) {
                setConfig(remoteConfig);
                db.saveAppConfig(remoteConfig);
            } else {
                setConfig(db.getAppConfig());
            }
        } catch (error) {
            console.warn('Config refresh failed:', error);
            setConfig(db.getAppConfig());
        }
    };

    const handleToggleTheme = () => {
        const newMode: 'light' | 'dark' = config.themeMode === 'dark' ? 'light' : 'dark';
        const newConfig: AppConfig = { ...config, themeMode: newMode };
        setConfig(newConfig);
        db.saveAppConfig(newConfig);
        // Fire and forget - don't block on remote save
        supabaseService.saveAppConfig(newConfig).catch(e => console.warn('Theme save failed:', e));
    };

    useEffect(() => {
        if (config.themeMode === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [config.themeMode]);

    // UUID Helper for environments where crypto.randomUUID is not available
    const generateUUID = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    // Authentication Handlers
    const handleLogin = async (email: string, pass: string): Promise<boolean> => {
        const result = await signIn(email, pass);
        if (result.success && user) {
            db.addLog({
                id: generateUUID(),
                userId: user.id,
                action: 'Inicio de Sesión',
                timestamp: new Date().toISOString(),
                details: `El usuario ${user.name} ha iniciado sesión.`
            });
            return true;
        }
        return false;
    };

    const handleAuthScreenLogin = (loggedInUser: User) => {
        db.addLog({
            id: generateUUID(),
            userId: loggedInUser.id,
            action: 'Inicio de Sesión',
            timestamp: new Date().toISOString(),
            details: `El usuario ${loggedInUser.name} ha iniciado sesión.`
        });
        navigate('/');
    };

    const handleGlobalVolunteerLogin = async (email: string, pass: string) => {
        const result = await signIn(email, pass);
        if (result.success) {
            setIsVolunteerModalOpen(false);
        }
        return result.success;
    };

    const { signOut } = useAuth();

    const onLogoutClick = async () => {
        if (user) {
            try {
                db.addLog({
                    id: generateUUID(),
                    userId: user.id || 'unknown',
                    action: 'Cierre de Sesión',
                    timestamp: new Date().toISOString(),
                    details: `El usuario ${user.name || 'Desconocido'} ha cerrado su sesión.`
                });
            } catch (e) {
                console.warn("Log failed:", e);
            }
        }

        await signOut();
        navigate('/auth', { replace: true });
    };

    const showVolunteerAccess = location.pathname === '/groups' || location.pathname === '/store' || location.pathname === '/info-point';

    const isSuperAdmin = (u: User | null) =>
        u ? hasRole(u, UserRole.SUPER_ADMIN) : false;

    // PRIORITY: Check for recovery/verification mode FIRST, before any other checks
    // This ensures we show the password update page even while auth is loading
    if (isRecoveryMode) {
        return <UpdatePassword />;
    }

    if (isVerificationMode) {
        return <VerifyEmail />;
    }

    // Show loading screen with timeout/error handling
    if (authLoading) {
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
    if (needsProfileCompletion && user) {
        return (
            <CompleteProfileModal
                userName={user.name || 'Usuario'}
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

            {/* PROTECTED ROUTES WRAPPED IN LAYOUT */}
            <Route path="*" element={
                !user ? <Navigate to="/auth" replace /> : (
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

                            <Route path="/host-dashboard" element={
                                (user && hasRole(user, [UserRole.ANFITRION, UserRole.ADMIN_GROUPS, UserRole.SUPER_ADMIN]))
                                    ? <HostDashboard currentUser={user} />
                                    : <Navigate to="/" />
                            } />

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
                    <HashRouter>
                        <AppContent />
                    </HashRouter>
                </AuthProvider>
            </AudioProvider>
        </ErrorBoundary>
    );
};

export default App;
