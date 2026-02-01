
import React, { useMemo, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserRole, AppConfig, User, SystemNotification, NotificationPreferences } from '../types';
import { hasRole } from '../services/authUtils';
import { db } from '../services/dbService';
import { supabaseService } from '../services/supabaseService';
import GlobalPlayer from './GlobalPlayer';
import NotificationCenter from './NotificationCenter';
import { useAudio } from '../contexts/AudioContext';
import { Bell, X, Check, ArrowLeft, Moon, Sun } from 'lucide-react';

interface LayoutProps {
    children: React.ReactNode;
    userRole: UserRole | null;
    currentUser?: User | null;
    onLogout?: () => void;
    appConfig: AppConfig;
    onToggleTheme?: () => void;
    onVolunteerClick?: () => void;
}

const roleTranslations: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]: 'ADMINISTRADOR CENTRAL',
    [UserRole.ADMIN_PUNTO]: 'Encargado: Punto de Información',
    [UserRole.ADMIN_GROUPS]: 'Encargado: GCX',
    [UserRole.ADMIN_STORE]: 'ADMINISTRADOR: STORE',
    [UserRole.ADMIN_ALABANZA]: 'ADMINISTRADOR: ALABANZA',
    [UserRole.PASTOR]: 'PASTOR',
    [UserRole.ANFITRION]: 'ANFITRIÓN',
    [UserRole.CO_ANFITRION]: 'CO-ANFITRIÓN',
    [UserRole.VIEWER]: 'USUARIO COMÚN',
    // New granular roles
    [UserRole.VOLUNTEER]: 'VOLUNTARIO',
    [UserRole.VOLUNTARIO]: 'VOLUNTARIO',
    [UserRole.VOLUNTARIO_INFO]: 'VOLUNTARIO: PUNTO INFO',
    [UserRole.VOLUNTARIO_GRUPOS]: 'VOLUNTARIO: GRUPOS',
    [UserRole.ENCARGADO_PUNTO]: 'ENCARGADO: PUNTO',
    [UserRole.ENCARGADO_GRUPOS]: 'ENCARGADO: GRUPOS',
    [UserRole.ENCARGADO_STORE]: 'ENCARGADO: STORE',
    [UserRole.ENCARGADO_ALABANZA]: 'ENCARGADO: ALABANZA',
    [UserRole.USUARIO]: 'USUARIO',
    [UserRole.REPORTES]: 'REPORTES'
};

const Layout: React.FC<LayoutProps> = ({ children, userRole, currentUser, onLogout, appConfig, onToggleTheme, onVolunteerClick }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { currentSong } = useAudio();

    // System Notifications State
    const [projectNotifications, setProjectNotifications] = useState<SystemNotification[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(db.getNotificationPreferences());

    const isDashboard = location.pathname === '/';
    const isFullWidthPage = location.pathname === '/' || location.pathname === '/store' || location.pathname === '/groups' || location.pathname === '/info-point' || location.pathname === '/alabanza';

    // Fetch notifications from Supabase when user is logged in
    useEffect(() => {
        const fetchNotifications = async () => {
            if (currentUser?.id) {
                try {
                    const notifs = await supabaseService.getNotifications(currentUser.id);
                    setProjectNotifications(notifs);
                } catch (error) {
                    console.error('Error fetching notifications:', error);
                    // Fallback to localStorage
                    setProjectNotifications(db.getNotifications());
                }
            }
        };

        if (userRole && currentUser) {
            fetchNotifications();
            // Refresh every 30 seconds
            const interval = setInterval(fetchNotifications, 30000);
            return () => clearInterval(interval);
        }
    }, [userRole, currentUser, location.pathname]);

    const handleLogoutAction = () => {
        onLogout?.();
    };

    const handleToggleNotifications = () => {
        setShowNotifications(!showNotifications);
    };

    // Handler for marking a single notification as read
    const handleMarkAsRead = async (id: string) => {
        await supabaseService.markNotificationAsRead(id);
        setProjectNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    // Handler for marking all notifications as read
    const handleMarkAllAsRead = async () => {
        if (currentUser?.id) {
            await supabaseService.markAllNotificationsAsRead(currentUser.id);
        }
        setProjectNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    // Handler for preferences change
    const handlePreferencesChange = (prefs: NotificationPreferences) => {
        db.saveNotificationPreferences(prefs);
        setNotificationPrefs(prefs);
    };

    const unreadCount = projectNotifications.filter(n => !n.read && notificationPrefs.categories[n.type]).length;

    const roleLabel = useMemo(() => {
        if (!userRole) return '';

        // Check for specific roles in the user's roles array first
        if (currentUser?.roles && currentUser.roles.length > 0) {
            // Priority order: show the most specific role
            if (currentUser.roles.includes(UserRole.SUPER_ADMIN)) return roleTranslations[UserRole.SUPER_ADMIN];
            if (currentUser.roles.includes(UserRole.PASTOR)) return roleTranslations[UserRole.PASTOR];
            if (currentUser.roles.includes(UserRole.ADMIN_GROUPS)) return roleTranslations[UserRole.ADMIN_GROUPS];
            if (currentUser.roles.includes(UserRole.ADMIN_GROUPS)) return roleTranslations[UserRole.ADMIN_GROUPS];
            if (currentUser.roles.includes(UserRole.ADMIN_PUNTO)) return roleTranslations[UserRole.ADMIN_PUNTO];
            if (currentUser.roles.includes(UserRole.ENCARGADO_PUNTO)) return roleTranslations[UserRole.ENCARGADO_PUNTO];
            if (currentUser.roles.includes(UserRole.ENCARGADO_GRUPOS)) return roleTranslations[UserRole.ENCARGADO_GRUPOS];
            if (currentUser.roles.includes(UserRole.VOLUNTARIO_INFO)) return roleTranslations[UserRole.VOLUNTARIO_INFO];
            if (currentUser.roles.includes(UserRole.VOLUNTARIO_GRUPOS)) return roleTranslations[UserRole.VOLUNTARIO_GRUPOS];
            if (currentUser.roles.includes(UserRole.VOLUNTEER)) return roleTranslations[UserRole.VOLUNTEER];
            if (currentUser.roles.includes(UserRole.VOLUNTARIO)) return roleTranslations[UserRole.VOLUNTARIO];
            if (currentUser.roles.includes(UserRole.ANFITRION)) return roleTranslations[UserRole.ANFITRION];
        }

        // Legacy fallback for old ANFITRION + linkedGroupId system
        if (userRole === UserRole.ANFITRION && currentUser) {
            if (currentUser.volunteerRoles?.includes('STORE') || currentUser.linkedGroupId === 'STORE') return 'VOLUNTARIO (STORE)';
            if (currentUser.volunteerRoles?.includes('PUNTO') || currentUser.linkedGroupId === 'PUNTO') return 'VOLUNTARIO (PUNTO)';
            if (currentUser.volunteerRoles?.includes('GROUPS') || currentUser.linkedGroupId === 'GROUPS') return 'VOLUNTARIO (GRUPOS)';
            return 'ANFITRIÓN';
        }

        return roleTranslations[userRole] || userRole;
    }, [userRole, currentUser]);

    // --- MODULE BACKGROUND RENDERER ---
    const renderModuleBackground = () => {
        const modules = db.getModules();
        const currentModule = modules.find(m => location.pathname.startsWith(m.route) && m.route !== '/');
        const bgConfig = currentModule?.background || { type: 'default', value: '', overlayOpacity: 0 };

        if (bgConfig.type === 'default') return null;

        const style: React.CSSProperties = {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 0,
            pointerEvents: 'none',
        };

        if (bgConfig.type === 'image' && bgConfig.value) {
            style.backgroundImage = `url(${bgConfig.value})`;
            style.backgroundSize = 'cover';
            style.backgroundPosition = 'center';
            style.backgroundAttachment = 'fixed';
        }
        else if (bgConfig.type === 'color' && bgConfig.value) {
            if (bgConfig.value.startsWith('bg-') || bgConfig.value.startsWith('from-')) {
                return (
                    <div className={`fixed inset-0 z-0 pointer-events-none ${bgConfig.value}`}>
                        {bgConfig.overlayOpacity > 0 && (
                            <div className="absolute inset-0 bg-black transition-opacity duration-300" style={{ opacity: bgConfig.overlayOpacity }}></div>
                        )}
                    </div>
                );
            } else {
                style.background = bgConfig.value;
            }
        }

        return (
            <div style={style}>
                {bgConfig.overlayOpacity > 0 && (
                    <div className="absolute inset-0 bg-black transition-opacity duration-300" style={{ opacity: bgConfig.overlayOpacity }}></div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen flex flex-col font-sans text-slate-900 dark:text-white bg-slate-50 dark:bg-black transition-colors duration-300 relative">

            {renderModuleBackground()}

            {/* Navbar - Origen Light Style */}
            <nav className="sticky top-0 z-50 w-full bg-white/95 dark:bg-black/95 backdrop-blur-xl border-b border-slate-300 dark:border-zinc-800 transition-colors duration-300">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">

                        {/* Left Section: Logo */}
                        <div className="flex items-center gap-4 flex-shrink-0">
                            <Link to="/" className="flex items-center flex-shrink-0">
                                <img
                                    src="/origen-logo.png"
                                    alt="Logo"
                                    className="h-12 sm:h-14 w-auto object-contain dark:invert"
                                />
                            </Link>

                            {!isDashboard && (
                                <div className="hidden md:flex items-center pl-6 border-l border-slate-200 h-8 my-auto animate-fadeIn">
                                    <Link to="/" className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-black transition-all px-4 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 group uppercase tracking-wider">
                                        <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                                        Volver
                                    </Link>
                                    <div id="navbar-portal" className="ml-2 flex items-center"></div>
                                </div>
                            )}

                            {!userRole && onVolunteerClick && (
                                <div className="hidden md:flex items-center pl-4 h-8 my-auto animate-fadeIn">
                                    <button
                                        onClick={onVolunteerClick}
                                        className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-600 hover:bg-black hover:text-white hover:border-black transition-all group uppercase tracking-wider"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                        <span>Voluntarios</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Right Section: Actions */}
                        <div className="flex items-center gap-3">
                            {/* Mobile Back Button */}
                            {!isDashboard && (
                                <Link to="/" className="md:hidden p-2.5 min-h-[44px] min-w-[44px] text-black bg-slate-100 hover:bg-slate-200 rounded-full transition-colors flex items-center justify-center border border-slate-200">
                                    <ArrowLeft className="w-5 h-5" />
                                </Link>
                            )}

                            {!userRole && onVolunteerClick && (
                                <button
                                    onClick={onVolunteerClick}
                                    className="md:hidden p-2.5 min-h-[44px] min-w-[44px] text-slate-600 bg-slate-100 rounded-full border border-slate-200 hover:bg-black hover:text-white transition-all"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                </button>
                            )}

                            {onToggleTheme && !userRole && (
                                <button
                                    onClick={onToggleTheme}
                                    className="p-2.5 min-h-[44px] min-w-[44px] rounded-full text-slate-600 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none border border-slate-300 dark:border-zinc-700 hover:border-slate-400 dark:hover:border-zinc-600"
                                    title={appConfig.themeMode === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
                                >
                                    {appConfig.themeMode === 'dark' ? (
                                        <Sun className="w-5 h-5" />
                                    ) : (
                                        <Moon className="w-5 h-5" />
                                    )}
                                </button>
                            )}

                            {userRole && (
                                <div className="flex items-center gap-2">
                                    {/* Theme Toggle - Right next to bell when logged in */}
                                    {onToggleTheme && (
                                        <button
                                            onClick={onToggleTheme}
                                            className="p-2.5 min-h-[44px] min-w-[44px] rounded-full text-slate-600 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none border border-slate-300 dark:border-zinc-700 hover:border-slate-400 dark:hover:border-zinc-600"
                                            title={appConfig.themeMode === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
                                        >
                                            {appConfig.themeMode === 'dark' ? (
                                                <Sun className="w-5 h-5" />
                                            ) : (
                                                <Moon className="w-5 h-5" />
                                            )}
                                        </button>
                                    )}

                                    {/* Notifications Bell (HIDDEN) */}
                                    {/* <div className="relative">
                                        <button
                                            onClick={handleToggleNotifications}
                                            className="p-2.5 min-h-[44px] min-w-[44px] rounded-full text-slate-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors relative border border-slate-300 dark:border-zinc-700 hover:border-slate-400 dark:hover:border-zinc-600"
                                            aria-label="Notificaciones"
                                        >
                                            <Bell className="w-5 h-5" />
                                            {unreadCount > 0 && (
                                                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-black animate-pulse">
                                                    {unreadCount > 99 ? '99+' : unreadCount}
                                                </span>
                                            )}
                                        </button>

                                        <NotificationCenter
                                            notifications={projectNotifications}
                                            isOpen={showNotifications}
                                            onClose={() => setShowNotifications(false)}
                                            onMarkAsRead={handleMarkAsRead}
                                            onMarkAllAsRead={handleMarkAllAsRead}
                                            preferences={notificationPrefs}
                                            onPreferencesChange={handlePreferencesChange}
                                            userRole={userRole}
                                        />
                                    </div> */}

                                    {/* Host Dashboard Link - For users with ANFITRION role */}
                                    {currentUser && hasRole(currentUser, UserRole.ANFITRION) && (
                                        <Link
                                            to="/host-dashboard"
                                            className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs font-bold text-black dark:text-white bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-800/50 px-2 sm:px-3 py-2 min-h-[44px] rounded-full transition-all border border-emerald-300 dark:border-emerald-700 uppercase tracking-wider"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                            </svg>
                                            <span className="hidden sm:inline">Mis Grupos</span>
                                            <span className="sm:hidden">MIS GRUPOS</span>
                                        </Link>
                                    )}

                                    {/* User Info */}
                                    <div className="hidden sm:flex flex-col items-end ml-1 mr-2">
                                        <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium uppercase tracking-widest">Bienvenido</span>
                                        <span className="text-xs font-bold text-black dark:text-white tracking-wider">{currentUser?.name || 'Usuario'}</span>
                                    </div>

                                    {/* Logout Button */}
                                    {onLogout && (
                                        <button
                                            onClick={handleLogoutAction}
                                            className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs font-bold text-black dark:text-white bg-slate-100 dark:bg-zinc-900 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black px-2 sm:px-4 py-2 min-h-[44px] rounded-full transition-all border border-slate-300 dark:border-zinc-700 hover:border-black dark:hover:border-white uppercase tracking-wider"
                                        >
                                            <span>Cerrar Sesión</span>
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content Area */}
            <main
                id="main-content"
                className={`flex-1 w-full mx-auto animate-fadeIn relative z-10 ${!isFullWidthPage ? 'max-w-7xl px-4 sm:px-6 lg:px-8 py-8' : ''} ${currentSong ? 'pb-32' : 'pb-8'}`}
                role="main"
            >
                {children}
            </main>

            {/* Global Player persistent across routes */}
            <GlobalPlayer />

        </div>
    );
};

export default Layout;
