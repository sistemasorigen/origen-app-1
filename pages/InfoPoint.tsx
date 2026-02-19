

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { AppProvider, useStore } from '../store';
import { ViewState, User, UserRole } from '../types';
import { hasRole } from '../services/authUtils';
import NeoSidebar from './infopoint/NeoSidebar';
import SystemLoginModal from '../components/SystemLoginModal';
import { db } from '../services/dbService';
import { Menu } from 'lucide-react';
import { ToastProvider, useToast } from './infopoint/context/ToastContext';
import { useTutorial } from '../src/hooks/useTutorial';
import TutorialInvitation from '../components/TutorialInvitation';
import TutorialController from '../components/TutorialController';
import { tours } from '../src/config/tours';

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

interface InfoPointProps {
    currentUser: User | null;
}

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

            // If user is logged in, always switch to INTERNAL mode when a view is requested via URL
            // This allows direct access to Dashboard (PANEL) and Search (SEARCH) from the menu
            if (currentUser && viewMode === 'PUBLIC') {
                setViewMode('INTERNAL');
            }
        }
    }, [searchParams, currentUser]);
    const [loginModalOpen, setLoginModalOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const toast = useToast();

    // --- TUTORIAL INTEGRATION ---
    const {
        isActive,
        showInvitation,
        startTutorial,
        completeTutorial,
        declineTemporary,
        dismissTutorial
    } = useTutorial('infopoint');

    // Local state to track the user authorized for InfoPoint
    // This can be the global currentUser OR a locally logged in user (via modal)
    const [authorizedUser, setAuthorizedUser] = useState<User | null>(currentUser);

    // Sync with global user changes
    useEffect(() => {
        if (currentUser) {
            setAuthorizedUser(currentUser);
        }
    }, [currentUser]);

    // Determines if user has enough privilege to enter the internal panel
    // Admins and Encargados have full access, Volunteers need VOLUNTARIO_INFO role
    const canEnterPanel = !!authorizedUser && (
        hasRole(authorizedUser, [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO]) ||
        (hasRole(authorizedUser, UserRole.ANFITRION) && (
            authorizedUser.linkedGroupId === 'PUNTO' ||
            authorizedUser.volunteerRoles?.includes('PUNTO')
        ))
    );

    // Check if user can access Admin Panel (Configuration)
    const canAccessAdminPanel = !!authorizedUser && hasRole(authorizedUser, [
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN_PUNTO,
        UserRole.ENCARGADO_PUNTO
    ]);

    const handleEnterPanel = () => {
        // If user is already logged in with correct role, go to internal
        if (canEnterPanel) {
            setViewMode('INTERNAL');
        } else {
            // Otherwise show login
            setLoginModalOpen(true);
        }
    };

    const handleLoginSuccess = async (email: string, pass: string) => {
        // We use the global DB verifier here since this is a local modal
        const user = db.verifyCredentials(email, pass);
        if (user && (
            hasRole(user, [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO]) ||
            (hasRole(user, UserRole.ANFITRION) && (
                user.linkedGroupId === 'PUNTO' ||
                user.volunteerRoles?.includes('PUNTO')
            ))
        )) {
            // In a real app we'd update global state, but here we just grant access to the view
            setAuthorizedUser(user);
            setViewMode('INTERNAL');
            return true;
        }
        return false;
    };

    // Portal for Navbar Button (Desktop)
    const NavbarPortalButton = ({ onClick }: { onClick: () => void }) => {
        const [mounted, setMounted] = useState(false);
        const target = document.getElementById('navbar-portal');

        useEffect(() => {
            setMounted(true);
            return () => setMounted(false);
        }, []);

        if (!mounted || !target) return null;

        return createPortal(
            <button
                onClick={onClick}
                className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-300 hover:text-black dark:hover:text-white transition-all px-4 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5 group ml-2"
                title="Salir del Panel Voluntarios"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                Salir Vista Pública
            </button>,
            target
        );
    };

    // --- AUTO LOGOUT LOGIC (MOBILE 5 MIN) ---
    useEffect(() => {
        // Only active if in INTERNAL mode
        if (viewMode !== 'INTERNAL') return;

        let logoutTimer: NodeJS.Timeout;
        const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

        const resetTimer = () => {
            clearTimeout(logoutTimer);
            logoutTimer = setTimeout(() => {
                // Perform logout
                console.log('Auto-logout due to inactivity');
                setViewMode('PUBLIC');
                setCurrentView('PANEL'); // Reset to root view
                // Optionally reset authorized user if it was a local login, but keeping it for now might be better UX
            }, TIMEOUT_MS);
        };

        // Events to detect activity
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

        // Attach listeners
        const handleActivity = () => resetTimer();

        events.forEach(event => {
            document.addEventListener(event, handleActivity, true); // Capture phase to ensure we catch it
        });

        // Initialize timer
        resetTimer();

        // Cleanup
        return () => {
            clearTimeout(logoutTimer);
            events.forEach(event => {
                document.removeEventListener(event, handleActivity, true);
            });
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
                    onEnterPanel={handleEnterPanel}
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
            default: return 'Punto de Info';
        }
    };

    // INTERNAL VIEW (VOLUNTEER PANEL)
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
            case 'ADMIN_PANEL': {
                // Role-based protection: Only SUPER_ADMIN, ADMIN_PUNTO, and ENCARGADO_PUNTO can access
                if (!canAccessAdminPanel) {
                    // Redirect to dashboard and show error message
                    toast.error('No tienes permisos para acceder a Configuración');
                    setTimeout(() => setCurrentView('PANEL'), 0);
                    return <Dashboard />;
                }
                return <AdminPanel />;
            }
            default: return <Dashboard />;
        }
    };

    return (
        <div className="flex flex-col md:flex-row h-screen md:h-[calc(100vh-64px)] bg-slate-50 md:bg-transparent overflow-hidden relative">

            <TutorialInvitation
                isOpen={showInvitation}
                onStart={startTutorial}
                onClose={declineTemporary}
                onDismiss={dismissTutorial}
                title="Bienvenido al Panel de Voluntarios"
            />
            <TutorialController
                steps={tours.infopoint}
                run={isActive}
                onComplete={completeTutorial}
                onSkip={dismissTutorial}
            />

            {/* --- MOBILE LAYOUT (Stack Navigation) --- */}
            <div className="md:hidden flex flex-col w-full h-[100dvh] bg-white overflow-hidden">
                {/* 1. Mobile Header (Fixed Shell) */}
                <header className="flex-none z-50 bg-white border-b-4 border-black">
                    <MobileHeader
                        title={currentView === 'PANEL' ? 'PUNTO DE INFORMACIÓN' : getViewTitle(currentView)}
                        isRoot={currentView === 'PANEL'}
                        onOpenSidebar={() => setIsSidebarOpen(true)}
                        onBack={() => setCurrentView('PANEL')}
                    />
                </header>

                {/* 2. Content Stack (Scrollable) */}
                <main className="flex-1 overflow-y-auto overscroll-contain bg-white">
                    {currentView === 'PANEL' ? (
                        <InfoPointMenu onNavigate={setCurrentView} currentUser={authorizedUser} />
                    ) : (
                        <div className="pb-20 px-6 pt-6">
                            {renderView()}
                        </div>
                    )}
                </main>

                {/* Mobile Global Sidebar (Overlay) */}
                <NeoSidebar
                    currentView={currentView}
                    setView={setCurrentView}
                    settings={settings}
                    isOpen={isSidebarOpen}
                    onClose={() => setIsSidebarOpen(false)}
                    currentUser={authorizedUser}
                />
            </div>

            {/* --- DESKTOP LAYOUT (Classic Sidebar + Content) --- */}
            <div className="hidden md:flex flex-1 h-full overflow-hidden relative">
                {/* Portal Button to Navbar (Desktop) */}
                <NavbarPortalButton onClick={() => setViewMode('PUBLIC')} />

                <NeoSidebar
                    currentView={currentView}
                    setView={setCurrentView}
                    settings={settings}
                    isOpen={isSidebarOpen} // Always managed by state, but desktop sidebar is usually persistent/responsive
                    onClose={() => setIsSidebarOpen(false)}
                    currentUser={authorizedUser}
                />

                <main className="flex-1 overflow-y-auto p-8 relative">
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