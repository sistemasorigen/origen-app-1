
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserRole, AppConfig, User } from '../../types';
import { db } from '../../services/dbService';

import GlobalPlayer from './ReproductorGlobal';
import DrawerMenu, { HamburgerButton } from './MenuDeslizable';
import { useAudio } from '../../contexts/AudioContext';
import { Sun, Moon } from 'lucide-react';
import { NotificationBell, NotificationDrawer } from '../notifications/InterfazNotificaciones';
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
    useAttendanceReminder();
    const location = useLocation();
    const navigate = useNavigate();
    const { currentSong } = useAudio();
    const { shouldShowBanner, requestPermission, dismissBanner } = usePushNotifications();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
    const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);

    // Páginas con hero "soft" a pantalla completa —
    // la navbar arranca transparente sobre la imagen
    // y recupera su fondo blanco recién al hacer
    // scroll, igual que en el Dashboard.
    const isDashboard = location.pathname === '/' || location.pathname === '/gcx' || location.pathname === '/ninez';
    // `/ninez` entra acá junto con isDashboard, no por separado: el -mt-16 que
    // monta el hero bajo la navbar sólo tiene sentido si el contenido va a
    // sangre. Con el padding del contenedor angosto el hero quedaría con
    // márgenes laterales y 32px de blanco arriba, y el logo invertido a blanco
    // caería sobre ese blanco. Ninez.tsx ya limita su propio contenido con un
    // max-w-4xl interno, así que no necesita el de acá.
    const isFullWidthPage = location.pathname === '/' || location.pathname === '/store' || location.pathname === '/gcx' || location.pathname === '/ninez' || location.pathname === '/punto-de-informacion' || location.pathname === '/alabanza' || location.pathname === '/prode' || location.pathname.startsWith('/coordinators');

    // En el dashboard la navbar arranca sin fondo, montada sobre el hero.
    // Al scrollear recupera el fondo: si no, quedaría flotando transparente
    // sobre las tarjetas y se perdería el menú (única navegación en mobile).
    const [isScrolled, setIsScrolled] = useState(false);
    useEffect(() => {
        if (!isDashboard) {
            setIsScrolled(false);
            return;
        }
        const onScroll = () => setIsScrolled(window.scrollY > 24);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [isDashboard]);

    const isNavbarTransparent = isDashboard && !isScrolled;

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
                <header className={`sticky top-0 z-30 flex-shrink-0 h-16 border-b transition-colors duration-300 ${isNavbarTransparent
                    ? 'bg-transparent border-transparent'
                    : 'bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md border-slate-200 dark:border-zinc-800'
                    }`}>
                    <div className="h-full px-4 sm:px-6 lg:px-8 relative flex items-center">

                        {/* Left: Hamburger (mobile only) */}
                        <div className="flex-1 flex items-center md:hidden print:hidden">
                            <HamburgerButton
                                onClick={() => setIsMenuOpen(true)}
                                onMedia={isNavbarTransparent}
                            />
                        </div>

                        {/* Portal for pages (desktop) */}
                        <div className="hidden md:flex flex-1 items-center print:hidden">
                            {!isDashboard && (
                                <div id="navbar-portal" className="flex items-center"></div>
                            )}
                        </div>

                        {/* Center: Logo (Absolutely centered) */}
                        {/* El logo es un PNG negro, así que el color se invierte por
                            filtro en vez de cambiar de archivo: montado sobre el hero
                            va en blanco, y al scrollear —cuando la navbar recupera su
                            fondo claro— vuelve a su negro original.

                            La transición usa `invert` ↔ `invert-0` en lugar de poner y
                            sacar la clase: entre `filter: invert(1)` y `filter: none`
                            los navegadores no interpolan de forma confiable y el cambio
                            saltaría. Con los dos extremos declarados el filtro recorre
                            los valores intermedios y el logo se desatura hasta el negro.

                            El drop-shadow sólo acompaña al estado blanco: sobre una foto
                            clara —la madera del banner, por ejemplo— un logo blanco sin
                            halo desaparece. Va después del invert en la cadena de
                            filtros de Tailwind, así que la sombra se proyecta desde la
                            silueta ya blanca y su color no se invierte. */}
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                            <Link to="/" className="flex items-center pointer-events-auto">
                                <img
                                    src="/origen-logo.png"
                                    alt="Logo"
                                    style={{ transition: 'filter 600ms ease-out, transform 200ms ease-out' }}
                                    className={`h-9 sm:h-11 w-auto object-contain hover:scale-105 dark:invert ${isNavbarTransparent
                                        ? 'invert drop-shadow-[0_1px_6px_rgba(0,0,0,0.45)]'
                                        : 'invert-0'
                                        }`}
                                />
                            </Link>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex-1 flex items-center justify-end gap-2 sm:gap-4 print:hidden">
                            {onToggleTheme && (
                                <button
                                    onClick={onToggleTheme}
                                    aria-label="Cambiar tema"
                                    style={{ transition: 'color 600ms ease-out, filter 600ms ease-out' }}
                                    className={`md:hidden p-2 rounded-full ${isNavbarTransparent
                                        ? 'text-white drop-shadow-[0_1px_5px_rgba(0,0,0,0.5)]'
                                        : 'text-slate-500 drop-shadow-none hover:text-black hover:bg-slate-100 dark:hover:bg-zinc-800'
                                        }`}
                                >
                                    <Sun className="h-5 w-5 dark:hidden" />
                                    <Moon className="h-5 w-5 hidden dark:block" />
                                </button>
                            )}
                            {currentUser && (
                                <NotificationBell
                                    onToggleDrawer={() => setIsNotifDrawerOpen(true)}
                                    onMedia={isNavbarTransparent}
                                />
                            )}
                            <div className="flex items-center">
                                {!currentUser && (
                                    <div className="hidden md:flex items-center gap-2">
                                        <button
                                            onClick={() => navigate('/auth')}
                                            className="text-xs font-bold text-slate-500 hover:text-black transition-colors uppercase tracking-wider px-2"
                                        >
                                            Ingresar
                                        </button>
                                        <button
                                            onClick={() => navigate('/auth')}
                                            className="px-5 py-2 rounded-full bg-black dark:bg-white text-white dark:text-black text-xs font-bold uppercase tracking-wider hover:opacity-80 transition-all shadow-md"
                                        >
                                            Registrarse
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                {/* En el dashboard el contenido sube 64px (el alto de la navbar)
                    para que el hero arranque en el borde de la página y la barra
                    quede montada encima. La navbar sigue en flujo y sticky, así
                    que no se pierde el acceso al menú al scrollear. */}
                <main
                    id="main-content"
                    className={`flex-1 w-full mx-auto animate-fadeIn relative z-10 ${isDashboard ? '-mt-16' : ''} ${!isFullWidthPage ? 'max-w-7xl px-4 sm:px-6 lg:px-8 py-8' : ''} ${currentSong ? 'pb-32' : 'pb-8'}`}
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
