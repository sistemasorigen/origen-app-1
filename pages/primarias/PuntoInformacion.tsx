


import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AppProvider, useStore } from '../../store';
import { ViewState, User, UserRole } from '../../types';
import { hasRole } from '../../services/authUtils';
import NeoSidebar from '../punto-informacion/NeoBarraLateral';
import SystemLoginModal from '../../components/modals/ModalLoginSistema';
import { db } from '../../services/dbService';
import { useToast } from '../punto-informacion/context/ContextoToast';

// Sub Views
import PublicHome from '../punto-informacion/InicioPublico';
import Dashboard from '../punto-informacion/PanelPrincipal';
import Inventory from '../punto-informacion/Inventario';
import NewProduct from '../punto-informacion/NuevoProducto';
import Movements from '../punto-informacion/Movimientos';
import Events from '../punto-informacion/Eventos';
import Loans from '../punto-informacion/Prestamos';
import Baptisms from '../punto-informacion/Bautismos';
import ChildPresentations from '../punto-informacion/PresentacionNinos';
import Search from '../punto-informacion/Busqueda';
import AdminPanel from '../punto-informacion/PanelAdministrador';
import MobileHeader from '../punto-informacion/EncabezadoMovil';
import InfoPointMenu from '../punto-informacion/MenuPuntoInformacion';
import Announcements from '../punto-informacion/Anuncios';

interface InfoPointProps {
    currentUser: User | null;
}

// Orden y roles de las funciones del panel para la navegación por flechas
// (solo desktop). MISMO ORDEN que el menú lateral (MenuDeslizable): Dashboard
// primero y el resto alfabético. "Reportes" se excluye a propósito: navega
// fuera del panel (/reportes), no es una vista interna por la que "desplazarse".
const DESKTOP_NAV: { id: ViewState; label: string; roles: UserRole[] }[] = [
    // Usa SUMMARY (no PANEL) para que la URL ?view=SUMMARY coincida con el ítem
    // "Dashboard" del menú lateral y quede marcado. Ambos renderizan el Dashboard.
    { id: 'SUMMARY', label: 'Dashboard', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO, UserRole.ANFITRION] },
    { id: 'ANNOUNCEMENTS', label: 'Anuncios', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO] },
    { id: 'BAPTISMS', label: 'Bautismos', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO, UserRole.ANFITRION] },

    { id: 'ADMIN_PANEL', label: 'Configuración', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO] },
    { id: 'EVENTS', label: 'Eventos', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO] },
    { id: 'INVENTORY', label: 'Inventario Total', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO] },
    { id: 'MOVEMENTS', label: 'Registrar Movimiento', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO, UserRole.ANFITRION] },

    { id: 'PRESENTATIONS', label: 'Presentación', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO, UserRole.ANFITRION] },
    { id: 'LOANS', label: 'Préstamos', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO, UserRole.ANFITRION] },
];

const InfoPointContent: React.FC<InfoPointProps> = ({ currentUser }) => {
    const { settings, isLoading, notification } = useStore();
    const [searchParams, setSearchParams] = useSearchParams();
    const [viewMode, setViewMode] = useState<'PUBLIC' | 'INTERNAL'>('PUBLIC');
    const [currentView, setCurrentView] = useState<ViewState>('PANEL');

    // Deep linking
    useEffect(() => {
        const view = searchParams.get('view');
        if (view) {
            setCurrentView(view as ViewState);
            if (currentUser && viewMode === 'PUBLIC') {
                setViewMode('INTERNAL');
            }
        } else {
            // Sin ?view= (ej: "Inicio" del menú) — volver al HOME público
            // de Punto de Información, no dejar el panel interno congelado.
            // PANEL es el Dashboard, así que resetear la vista Y el modo.
            setViewMode('PUBLIC');
            setCurrentView('PANEL');
        }
    }, [searchParams, currentUser]);

    const [loginModalOpen, setLoginModalOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const toast = useToast();

    const [authorizedUser, setAuthorizedUser] = useState<User | null>(currentUser);

    useEffect(() => {
        if (currentUser) {
            setAuthorizedUser(currentUser);
        }
    }, [currentUser]);

    const canEnterPanel = !!authorizedUser && (
        hasRole(authorizedUser, [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO]) ||
        (hasRole(authorizedUser, UserRole.ANFITRION) && (
            authorizedUser.linkedGroupId === 'PUNTO' ||
            authorizedUser.volunteerRoles?.includes('PUNTO')
        ))
    );

    const canAccessAdminPanel = !!authorizedUser && hasRole(authorizedUser, [
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN_PUNTO,
        UserRole.ENCARGADO_PUNTO
    ]);

    const handleGoInternal = () => {
        if (canEnterPanel) {
            setViewMode('INTERNAL');
        } else {
            setLoginModalOpen(true);
        }
    };

    const handleGoPublic = () => {
        setViewMode('PUBLIC');
    };

    const handleLoginSuccess = async (email: string, pass: string) => {
        const user = db.verifyCredentials(email, pass);
        if (user && (
            hasRole(user, [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO]) ||
            (hasRole(user, UserRole.ANFITRION) && (
                user.linkedGroupId === 'PUNTO' ||
                user.volunteerRoles?.includes('PUNTO')
            ))
        )) {
            setAuthorizedUser(user);
            setViewMode('INTERNAL');
            return true;
        }
        return false;
    };

    // --- AUTO LOGOUT LOGIC (MOBILE 5 MIN) ---
    useEffect(() => {
        if (viewMode !== 'INTERNAL') return;

        let logoutTimer: NodeJS.Timeout;
        const TIMEOUT_MS = 5 * 60 * 1000;

        const resetTimer = () => {
            clearTimeout(logoutTimer);
            logoutTimer = setTimeout(() => {
                setViewMode('PUBLIC');
                setCurrentView('PANEL');
            }, TIMEOUT_MS);
        };

        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        const handleActivity = () => resetTimer();
        events.forEach(event => document.addEventListener(event, handleActivity, true));
        resetTimer();

        return () => {
            clearTimeout(logoutTimer);
            events.forEach(event => document.removeEventListener(event, handleActivity, true));
        };
    }, [viewMode]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-2"></div>
                Cargando sistema...
            </div>
        );
    }

    if (viewMode === 'PUBLIC') {
        return (
            <>
                <PublicHome
                    viewMode={viewMode}
                    onGoInternal={handleGoInternal}
                    onGoPublic={handleGoPublic}
                    canAccessPanel={canEnterPanel}
                />
                <SystemLoginModal
                    isOpen={loginModalOpen}
                    onClose={() => setLoginModalOpen(false)}
                    systemName="Panel Voluntarios"
                    onLogin={handleLoginSuccess}
                />
            </>
        );
    }

    // --- VIEW MAPPING ---
    const getViewTitle = (view: ViewState): string => {
        switch (view) {
            case 'PANEL': return 'Punto de Info';
            case 'SUMMARY': return 'Resumen';
            case 'INVENTORY': return 'Inventario';
            case 'NEW_PRODUCT': return 'Nuevo Producto';
            case 'MOVEMENTS': return 'Movimientos';
            case 'EVENTS': return 'Eventos';
            case 'LOANS': return 'Préstamos';
            case 'BAPTISMS': return 'Bautismos';
            case 'PRESENTATIONS': return 'Presentaciones';
            case 'SEARCH': return 'Buscar';
            case 'ADMIN_PANEL': return 'Configuración';
            case 'ANNOUNCEMENTS': return 'Anuncios';
            default: return 'Punto de Info';
        }
    };

    const renderView = () => {
        switch (currentView) {
            case 'PANEL': return <Dashboard />;
            case 'SUMMARY': return <Dashboard />;
            case 'SEARCH': return <Search />;
            case 'INVENTORY': return <Inventory />;
            case 'NEW_PRODUCT': return <NewProduct />;
            case 'MOVEMENTS': return <Movements />;
            case 'EVENTS': return <Events />;
            case 'LOANS': return <Loans />;
            case 'BAPTISMS': return <Baptisms />;
            case 'PRESENTATIONS': return <ChildPresentations />;
            case 'ANNOUNCEMENTS': return <Announcements />;
            case 'ADMIN_PANEL': {
                if (!canAccessAdminPanel) {
                    toast.error('No tienes permisos para acceder a Configuración');
                    setTimeout(() => setCurrentView('PANEL'), 0);
                    return <Dashboard />;
                }
                return <AdminPanel />;
            }
            default: return <Dashboard />;
        }
    };

    // --- NAVEGACIÓN POR FLECHAS (solo desktop) ---
    // Funciones visibles según el rol, en el orden definido.
    const visibleNav = DESKTOP_NAV.filter(item => !!authorizedUser && hasRole(authorizedUser, item.roles));
    // PANEL y SUMMARY renderizan el mismo Dashboard; al entrar al panel la vista
    // arranca en PANEL, así que lo tratamos como SUMMARY para ubicar el índice.
    const normalizedView = currentView === 'PANEL' ? 'SUMMARY' : currentView;
    const navIndex = visibleNav.findIndex(item => item.id === normalizedView);
    // Título centrado: usa el label del menú; si la vista no está en la lista
    // cae al título genérico.
    const currentNavLabel = navIndex >= 0 ? visibleNav[navIndex].label : getViewTitle(currentView);
    // Se desplaza de forma circular actualizando la URL (?view=XXX). El efecto de
    // deep-linking sincroniza currentView, y el menú lateral marca el ítem activo
    // por coincidencia exacta de URL. Se usa replace para no llenar el historial.
    const goToNav = (dir: -1 | 1) => {
        if (visibleNav.length === 0) return;
        const base = navIndex >= 0 ? navIndex : 0;
        const next = (base + dir + visibleNav.length) % visibleNav.length;
        setSearchParams({ view: visibleNav[next].id }, { replace: true });
    };

    return (
        <div className="flex flex-col md:flex-row h-screen md:h-[calc(100vh-64px)] bg-slate-50 overflow-hidden relative">

            {/* --- MOBILE LAYOUT --- */}
            <div className="md:hidden fixed inset-x-0 top-16 bottom-0 z-30 flex flex-col bg-slate-50 overflow-hidden">
                {/* Header solo en sub-vistas (back + título + dropdown).
                    En la raíz del panel (PANEL) no hay barra: el toggle
                    Web/Panel se eliminó. */}
                {currentView !== 'PANEL' && (
                    <header className="flex-none z-40 bg-white border-b border-slate-200 select-none overflow-hidden" style={{ touchAction: 'none' }}>
                        <MobileHeader
                            title={getViewTitle(currentView)}
                            isRoot={false}
                            onBack={() => setCurrentView('PANEL')}
                            currentView={currentView}
                            onNavigate={setCurrentView}
                            currentUser={authorizedUser}
                        />
                    </header>
                )}

                <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-slate-50">
                    {currentView === 'PANEL' ? (
                        <InfoPointMenu onNavigate={setCurrentView} currentUser={authorizedUser} />
                    ) : (
                        <div className="pb-20 px-4 pt-4">
                            {renderView()}
                        </div>
                    )}
                </main>

                <NeoSidebar
                    currentView={currentView}
                    setView={setCurrentView}
                    settings={settings}
                    isOpen={isSidebarOpen}
                    onClose={() => setIsSidebarOpen(false)}
                    currentUser={authorizedUser}
                />
            </div>

            {/* --- DESKTOP LAYOUT --- */}
            <div className="hidden md:flex flex-col flex-1 h-full overflow-hidden relative">

                {/* Cabecera de navegación: nombre de la vista centrado con
                    flechas a los costados para desplazarse entre funciones.
                    Reemplaza al menú lateral (exclusivo de desktop). */}
                <header className="flex-none border-b border-slate-200 bg-white">
                    <div className="flex items-center justify-center gap-6 px-8 py-5">
                        <button
                            onClick={() => goToNav(-1)}
                            aria-label="Función anterior"
                            className="flex items-center justify-center w-11 h-11 border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900 rounded-lg shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                        >
                            <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
                        </button>

                        <div className="flex flex-col items-center min-w-[16rem]">
                            <h1 className="text-2xl lg:text-3xl font-black uppercase tracking-tight text-slate-900 text-center leading-none">
                                {currentNavLabel}
                            </h1>
                        </div>

                        <button
                            onClick={() => goToNav(1)}
                            aria-label="Función siguiente"
                            className="flex items-center justify-center w-11 h-11 border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900 rounded-lg shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                        >
                            <ChevronRight className="w-6 h-6" strokeWidth={2.5} />
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8 relative bg-slate-50">
                    {renderView()}

                    {/* Global Notification Toast */}
                    {notification.show && (
                        <div className={`fixed top-24 right-8 z-[100] px-6 py-4 rounded-lg shadow-xl flex items-center gap-3 animate-slideIn ${notification.type === 'success' ? 'bg-[#118f46] text-white' : 'bg-red-600 text-white'}`}>
                            <div className="p-1 bg-white/20 rounded-full">
                                {notification.type === 'success' ? (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                ) : (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                                )}
                            </div>
                            <span className="font-bold text-sm">{notification.message}</span>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

// Wrapper to provide the Store Context specifically for InfoPoint
const InfoPoint: React.FC<InfoPointProps> = (props) => {
    return (
        <AppProvider currentUser={props.currentUser}>
            <InfoPointContent {...props} />
        </AppProvider>
    );
};

export default InfoPoint;