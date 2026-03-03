


import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppProvider, useStore } from '../store';
import { ViewState, User, UserRole } from '../types';
import { hasRole } from '../services/authUtils';
import NeoSidebar from './infopoint/NeoSidebar';
import SystemLoginModal from '../components/SystemLoginModal';
import { db } from '../services/dbService';
import { useToast } from './infopoint/context/ToastContext';

// Sub Views
import PublicHome from './infopoint/PublicHome';
import Dashboard from './infopoint/Dashboard';
import Inventory from './infopoint/Inventory';
import NewProduct from './infopoint/NewProduct';
import Movements from './infopoint/Movements';
import Events from './infopoint/Events';
import Loans from './infopoint/Loans';
import Baptisms from './infopoint/Baptisms';
import ChildPresentations from './infopoint/ChildPresentations';
import Search from './infopoint/Search';
import AdminPanel from './infopoint/AdminPanel';
import MobileHeader from './infopoint/MobileHeader';
import InfoPointMenu from './infopoint/InfoPointMenu';
import Announcements from './infopoint/Announcements';

interface InfoPointProps {
    currentUser: User | null;
}

// --- NEO-BRUTALIST SWITCH TOGGLE ---
interface ViewSwitchProps {
    viewMode: 'PUBLIC' | 'INTERNAL';
    canEnterPanel: boolean;
    onGoPublic: () => void;
    onGoInternal: () => void;
}

const ViewSwitch: React.FC<ViewSwitchProps> = ({ viewMode, canEnterPanel, onGoPublic, onGoInternal }) => {
    return (
        <div className="inline-flex border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden" role="group">
            <button
                onClick={onGoPublic}
                className={`px-4 py-2 text-[10px] md:text-xs font-black uppercase tracking-widest transition-all duration-200 border-r-2 border-black ${viewMode === 'PUBLIC'
                    ? 'bg-black text-white'
                    : 'bg-white text-black hover:bg-slate-100'
                    }`}
            >
                Público
            </button>
            <button
                onClick={onGoInternal}
                className={`px-4 py-2 text-[10px] md:text-xs font-black uppercase tracking-widest transition-all duration-200 ${viewMode === 'INTERNAL'
                    ? 'bg-black text-white'
                    : 'bg-white text-black hover:bg-slate-100'
                    }`}
            >
                {canEnterPanel ? 'Panel' : '🔒 Panel'}
            </button>
        </div>
    );
};

const InfoPointContent: React.FC<InfoPointProps> = ({ currentUser }) => {
    const { settings, isLoading, notification } = useStore();
    const [searchParams] = useSearchParams();
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

    // The switch shown in the internal panel header
    const switchEl = (
        <ViewSwitch
            viewMode={viewMode}
            canEnterPanel={canEnterPanel}
            onGoPublic={handleGoPublic}
            onGoInternal={handleGoInternal}
        />
    );

    return (
        <div className="flex flex-col md:flex-row h-screen md:h-[calc(100vh-64px)] bg-slate-50 md:bg-transparent overflow-hidden relative">

            {/* --- MOBILE LAYOUT --- */}
            <div className="md:hidden flex flex-col w-full h-[calc(100dvh-64px)] bg-white overflow-hidden">
                <header className="flex-none z-40 bg-white border-b-4 border-black sticky top-16">
                    {/* Header bar only when NOT at root for back button, otherwise title is in the subnav div */}
                    {currentView !== 'PANEL' && (
                        <MobileHeader
                            title={getViewTitle(currentView)}
                            isRoot={false}
                            onOpenSidebar={() => setIsSidebarOpen(true)}
                            onBack={() => setCurrentView('PANEL')}
                        />
                    )}

                    {/* SUBNAV design matching PublicHome screenshot */}
                    <div className="flex flex-col w-full">
                        {/* Title (Only shown at root or together with switch) */}
                        <div className="h-10 flex items-center justify-center border-b-4 border-black">
                            <h1 className="text-sm font-black tracking-widest uppercase text-black">
                                Punto de Información
                            </h1>
                        </div>
                        {/* Switch Buttons */}
                        <div className="flex w-full h-11">
                            <button
                                onClick={handleGoPublic}
                                className={`flex-1 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-all border-r-4 border-black ${(viewMode as string) === 'PUBLIC' ? 'bg-black text-white' : 'bg-white text-black'}`}
                            >
                                <span className={(viewMode as string) === 'PUBLIC' ? 'text-white' : 'text-blue-500'}>🌐</span> WEB
                            </button>
                            <button
                                onClick={handleGoInternal}
                                className={`flex-1 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-all ${(viewMode as string) === 'INTERNAL' ? 'bg-black text-white' : 'bg-white text-black'}`}
                            >
                                <span className={(viewMode as string) === 'INTERNAL' ? 'text-white' : 'text-slate-400'}>⚙️</span> PANEL
                            </button>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-white">
                    {currentView === 'PANEL' ? (
                        <InfoPointMenu onNavigate={setCurrentView} currentUser={authorizedUser} />
                    ) : (
                        <div className="pb-20 px-6 pt-6">
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
            <div className="hidden md:flex flex-1 h-full overflow-hidden relative">
                <NeoSidebar
                    currentView={currentView}
                    setView={setCurrentView}
                    settings={settings}
                    isOpen={isSidebarOpen}
                    onClose={() => setIsSidebarOpen(false)}
                    currentUser={authorizedUser}
                />

                <main className="flex-1 overflow-y-auto p-8 relative">
                    {/* Desktop: switch at top-right of content header */}
                    <div className="absolute top-6 right-8 z-20">
                        {switchEl}
                    </div>

                    {renderView()}

                    {/* Global Notification Toast */}
                    {notification.show && (
                        <div className={`fixed top-24 right-8 z-[100] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-slideIn ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
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