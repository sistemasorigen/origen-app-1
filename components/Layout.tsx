
import React, { useMemo, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserRole, AppConfig, User } from '../types';
import { hasRole } from '../services/authUtils';
import { db } from '../services/dbService';

import GlobalPlayer from './GlobalPlayer';
import DrawerMenu from './DrawerMenu';
import { useAudio } from '../contexts/AudioContext';
import { X, ArrowLeft, Moon, Sun, Menu } from 'lucide-react';

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
    [UserRole.REPORTES]: 'REPORTES',
    [UserRole.COORDINATOR]: 'COORDINADOR',
    [UserRole.ENCARGADO_BIENVENIDA]: 'ENCARGADO: BIENVENIDA',
    [UserRole.VOLUNTARIO_BIENVENIDA]: 'VOL. BIENVENIDA'
};

const Layout: React.FC<LayoutProps> = ({ children, userRole, currentUser, onLogout, appConfig, onToggleTheme, onVolunteerClick }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { currentSong } = useAudio();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // System Notifications State - REMOVED

    const isDashboard = location.pathname === '/';
    const isFullWidthPage = location.pathname === '/' || location.pathname === '/store' || location.pathname === '/groups' || location.pathname === '/info-point' || location.pathname === '/alabanza' || location.pathname.startsWith('/coordinators');

    // Notifications Fetcher - REMOVED

    const handleLogoutAction = () => {
        onLogout?.();
    };



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

            {/* Drawer Menu (Replaces FullScreenMenu) */}
            <DrawerMenu
                isOpen={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                currentUser={currentUser}
                onLogout={handleLogoutAction}
                isDarkMode={false}
                onToggleTheme={onToggleTheme}
            />

            {renderModuleBackground()}

            {/* Navbar - Transparent Visual Style */}
            <nav className="sticky top-0 z-50 w-full bg-transparent transition-colors duration-300">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">

                        {/* Left Section: Menu trigger and optional back/volunteer buttons */}
                        <div className="flex-1 flex items-center gap-2 sm:gap-4">
                            {/* Unified Menu Trigger */}
                            <button
                                id="hamburger-menu-btn"
                                onClick={() => setIsMenuOpen(true)}
                                className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-100 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all group"
                                aria-label="Abrir menú"
                            >
                                <Menu className="w-5 h-5 transition-transform group-hover:scale-110" />
                            </button>

                            {!isDashboard && (
                                <div id="navbar-portal" className="hidden md:flex items-center ml-2"></div>
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

                        {/* Center Section: Centered Logo */}
                        <div className="flex-1 flex items-center justify-center">
                            <Link to="/" className="flex items-center">
                                <img
                                    src="/origen-logo.png"
                                    alt="Logo"
                                    className="h-10 sm:h-14 w-auto object-contain dark:invert transition-all"
                                />
                            </Link>
                        </div>

                        {/* Right Section: Theme Toggle and Login Controls */}
                        <div className="flex-1 flex items-center gap-2 sm:gap-4 justify-end">
                            {/* Theme Toggle */}
                            {onToggleTheme && (
                                <button
                                    onClick={onToggleTheme}
                                    className="p-2 rounded-full text-slate-500 hover:text-black dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
                                    aria-label="Alternar tema"
                                >
                                    <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                                    <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 top-2" />
                                </button>
                            )}

                            {/* User Profile / Login */}
                            <div className="flex items-center gap-3">
                                {!currentUser && (
                                    <div className="hidden md:flex items-center gap-2">
                                        <button className="text-sm font-bold text-slate-500 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors uppercase tracking-wider">
                                            Ingresar
                                        </button>
                                        <button className="px-5 py-2 rounded-full bg-black text-white dark:bg-white dark:text-black text-sm font-bold uppercase tracking-wider hover:bg-slate-800 dark:hover:bg-zinc-200 transition-colors shadow-lg shadow-slate-200 dark:shadow-zinc-900/50">
                                            Registrarse
                                        </button>
                                    </div>
                                )}
                            </div>
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
