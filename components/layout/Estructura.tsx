
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserRole, AppConfig, User } from '../../types';
import { db } from '../../services/dbService';

import GlobalPlayer from './ReproductorGlobal';
import DrawerMenu, { HamburgerButton } from './MenuDeslizable';
import { useAudio } from '../../contexts/AudioContext';
import { Sun, Moon } from 'lucide-react';
import { NotificationBell, NotificationDrawer } from '../notifications/InterfazNotificaciones';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useAttendanceReminder } from '../../hooks/useAttendanceReminder';
import PushPermissionBanner from '../notifications/BannerPermisoNotificaciones';
import { usePushNotifications } from '../../hooks/usePushNotifications';

interface LayoutProps {
    children: React.ReactNode;
    userRole: UserRole | null;
    currentUser?: User | null;
    onLogout?: () => void;
    appConfig: AppConfig;
    onToggleTheme?: () => void;
    onVolunteerClick?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, userRole, currentUser, onLogout, onToggleTheme }) => {
    useAutoRefresh();
    useAttendanceReminder();
    const location = useLocation();
    const { currentSong } = useAudio();
    const { shouldShowBanner, requestPermission, dismissBanner } = usePushNotifications();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
    const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);

    const isDashboard = location.pathname === '/';
    const isFullWidthPage = location.pathname === '/' || location.pathname === '/store' || location.pathname === '/gcx' || location.pathname === '/punto-de-informacion' || location.pathname === '/alabanza' || location.pathname.startsWith('/coordinators');

    const handleLogoutAction = () => {
        onLogout?.();
    };

    const renderModuleBackground = () => {
        const modules = db.getModules();
        const currentModule = modules.find(m => location.pathname.startsWith(m.route) && m.route !== '/');
        const bgConfig = currentModule?.background || { type: 'default', value: '', overlayOpacity: 0 };
        if (bgConfig.type === 'default') return null;
        const style: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: 'none' };
        if (bgConfig.type === 'image' && bgConfig.value) {
            style.backgroundImage = `url(${bgConfig.value})`;
            style.backgroundSize = 'cover';
            style.backgroundPosition = 'center';
            style.backgroundAttachment = 'fixed';
        } else if (bgConfig.type === 'color' && bgConfig.value) {
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
        <div className="min-h-screen flex font-sans text-slate-900 dark:text-white bg-slate-50 dark:bg-black transition-colors duration-300 relative">

            {/* Desktop Sidebar */}
            <DrawerMenu
                type="sidebar"
                isOpen={true} // Not used in sidebar mode
                onClose={() => { }}
                currentUser={currentUser || null}
                onLogout={handleLogoutAction}
                onToggleTheme={onToggleTheme}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />

            {/* Mobile Drawer */}
            <DrawerMenu
                type="drawer"
                isOpen={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                currentUser={currentUser || null}
                onLogout={handleLogoutAction}
                onToggleTheme={onToggleTheme}
            />

            {/* Main Content Area */}
            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>

                {renderModuleBackground()}

                {shouldShowBanner && (
                    <PushPermissionBanner
                        onAllow={requestPermission}
                        onDismiss={dismissBanner}
                    />
                )}

                {/* Navbar */}
                <header className="sticky top-0 z-30 flex-shrink-0 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 h-16">
                    <div className="h-full px-4 sm:px-6 lg:px-8 relative flex items-center">

                        {/* Left: Hamburger (mobile only) */}
                        <div className="flex-1 flex items-center md:hidden">
                            <HamburgerButton
                                onClick={() => setIsMenuOpen(true)}
                            />
                        </div>

                        {/* Portal for pages (desktop) */}
                        <div className="hidden md:flex flex-1 items-center">
                            {!isDashboard && (
                                <div id="navbar-portal" className="flex items-center"></div>
                            )}
                        </div>

                        {/* Center: Logo (Absolutely centered) */}
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                            <Link to="/" className="flex items-center pointer-events-auto">
                                <img
                                    src="/origen-logo.png"
                                    alt="Logo"
                                    className="h-9 sm:h-11 w-auto object-contain dark:invert transition-all hover:scale-105"
                                />
                            </Link>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex-1 flex items-center justify-end gap-2 sm:gap-4">
                            {onToggleTheme && (
                                <button
                                    onClick={onToggleTheme}
                                    className="md:hidden p-2 rounded-full text-slate-500 hover:text-black hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                                >
                                    <Sun className="h-5 w-5 dark:hidden" />
                                    <Moon className="h-5 w-5 hidden dark:block" />
                                </button>
                            )}
                            {currentUser && (
                                <NotificationBell onToggleDrawer={() => setIsNotifDrawerOpen(true)} />
                            )}
                            <div className="flex items-center">
                                {!currentUser && (
                                    <div className="hidden md:flex items-center gap-2">
                                        <button className="text-xs font-bold text-slate-500 hover:text-black transition-colors uppercase tracking-wider px-2">
                                            Ingresar
                                        </button>
                                        <button className="px-5 py-2 rounded-full bg-black dark:bg-white text-white dark:text-black text-xs font-bold uppercase tracking-wider hover:opacity-80 transition-all shadow-md">
                                            Registrarse
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main
                    id="main-content"
                    className={`flex-1 w-full mx-auto animate-fadeIn relative z-10 ${!isFullWidthPage ? 'max-w-7xl px-4 sm:px-6 lg:px-8 py-8' : ''} ${currentSong ? 'pb-32' : 'pb-8'}`}
                    role="main"
                >
                    {children}
                </main>

                <GlobalPlayer />
            </div>

            <NotificationDrawer
                isOpen={isNotifDrawerOpen}
                onClose={() => setIsNotifDrawerOpen(false)}
            />
        </div>
    );
};

export default Layout;
