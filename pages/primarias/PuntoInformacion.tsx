


import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { AppProvider, useStore } from '../../store';
import { ViewState, User, UserRole } from '../../types';
import { hasRole, puedeEntrarAlPunto } from '../../services/authUtils';
import NeoSidebar from '../punto-informacion/NeoBarraLateral';
import { useToast } from '../punto-informacion/context/ContextoToast';

// Sub Views
import Inventory from '../punto-informacion/Inventario';
import NewProduct from '../punto-informacion/NuevoProducto';
import Movements from '../punto-informacion/Movimientos';
import Loans from '../punto-informacion/Prestamos';
import Baptisms from '../punto-informacion/Bautismos';
import ChildPresentations from '../punto-informacion/PresentacionNinos';
import Search from '../punto-informacion/Busqueda';
import AdminPanel from '../punto-informacion/PanelAdministrador';
import MobileHeader from '../punto-informacion/EncabezadoMovil';
import SinAcceso from '../../components/auth/SinAcceso';
import InfoPointMenu from '../punto-informacion/MenuPuntoInformacion';

interface InfoPointProps {
    currentUser: User | null;
}

/**
 * El Punto de Información: el panel y nada más.
 *
 * Tenía dos pantallas de entrada —un inicio con anuncios, eventos y agenda, y
 * el panel de trabajo— y las dos pedían sesión, así que ese inicio no era una
 * portada pública: era un rodeo para la misma gente que entra a cargar stock.
 * Ahora /punto-de-informacion ES el panel.
 */
const InfoPointContent: React.FC<InfoPointProps> = ({ currentUser }) => {
    const { settings, isLoading, notification } = useStore();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const [currentView, setCurrentView] = useState<ViewState>('PANEL');

    // La función abierta vive en la URL (?view=INVENTORY), no sólo acá adentro.
    //
    // Es lo que hace que volver a la app devuelva a la misma pantalla. El
    // navegador del teléfono descarta la página cuando uno se va a otra app, y
    // al volver la carga de nuevo desde cero: con la función sólo en memoria,
    // esa recarga terminaba siempre en el menú del panel, estuviera donde
    // estuviera la persona.
    //
    // `replace` a propósito: moverse entre funciones no es historial. Si se
    // apilara, salir del panel con el botón de atrás del teléfono costaría un
    // toque por cada función que se miró.
    const irA = (vista: ViewState) => setSearchParams({ view: vista }, { replace: true });

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const toast = useToast();

    const [authorizedUser, setAuthorizedUser] = useState<User | null>(currentUser);

    useEffect(() => {
        if (currentUser) {
            setAuthorizedUser(currentUser);
        }
    }, [currentUser]);

    // La misma regla que preguntan las páginas sueltas de movimientos.
    const canEnterPanel = puedeEntrarAlPunto(authorizedUser);

    // Qué función está abierta, leído de la URL.
    //
    // Sin ?view= se escribe ?view=PANEL en lugar de mostrar otra cosa: así la
    // URL dice siempre dónde está parado uno, el menú lateral puede encender
    // el ítem correcto, y volver a la app después de que el teléfono descarte
    // la página devuelve al mismo lugar. `replace` porque moverse entre
    // funciones no es historial.
    useEffect(() => {
        const view = searchParams.get('view');
        if (!view) {
            setSearchParams({ view: 'PANEL' }, { replace: true });
            return;
        }
        setCurrentView(view as ViewState);
    }, [searchParams, setSearchParams]);

    const canAccessAdminPanel = !!authorizedUser && hasRole(authorizedUser, [
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN_PUNTO,
        UserRole.ENCARGADO_PUNTO
    ]);

    /**
     * El panel se cierra solo a los 5 minutos sin tocar nada.
     *
     * El Punto trabaja sobre un equipo compartido del stand. Antes esto
     * devolvía al inicio del Punto; como ese inicio ya no existe, sale a la
     * portada de la app, que es el equivalente: deja de haber un panel de
     * gestión abierto en una pantalla que mira cualquiera.
     */
    useEffect(() => {
        let logoutTimer: NodeJS.Timeout;
        const TIMEOUT_MS = 5 * 60 * 1000;

        const resetTimer = () => {
            clearTimeout(logoutTimer);
            logoutTimer = setTimeout(() => navigate('/'), TIMEOUT_MS);
        };

        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        const handleActivity = () => resetTimer();
        events.forEach(event => document.addEventListener(event, handleActivity, true));
        resetTimer();

        return () => {
            clearTimeout(logoutTimer);
            events.forEach(event => document.removeEventListener(event, handleActivity, true));
        };
    }, [navigate]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-2"></div>
                Cargando sistema...
            </div>
        );
    }

    // Toda la pantalla es el panel, así que el portero vale para toda la
    // pantalla. A quien no puede entrar se le avisa: sin sesión App.tsx ya lo
    // mandó al login con el destino anotado, y con sesión sin el rol esto le
    // dice que el link no es para él, en vez de devolverle una portada que se
    // lee como que está roto.
    if (!canEnterPanel) {
        return <SinAcceso />;
    }

    // --- VIEW MAPPING ---
    const getViewTitle = (view: ViewState): string => {
        switch (view) {
            case 'PANEL':
            case 'SUMMARY': return 'Punto de Información';
            case 'INVENTORY': return 'Inventario';
            case 'NEW_PRODUCT': return 'Nuevo Producto';
            case 'MOVEMENTS': return 'Movimientos';
            case 'LOANS': return 'Préstamos';
            case 'BAPTISMS': return 'Bautismos';
            case 'PRESENTATIONS': return 'Presentaciones';
            case 'SEARCH': return 'Buscar';
            case 'ADMIN_PANEL': return 'Configuración';
            default: return 'Punto de Info';
        }
    };

    const renderView = () => {
        switch (currentView) {
            // El menú de funciones es la puerta del panel. SUMMARY sigue
            // acá porque quedó en links viejos y en favoritos: abre el menú,
            // no el tablero que se retiró.
            case 'PANEL':
            case 'SUMMARY': return <InfoPointMenu onNavigate={irA} currentUser={authorizedUser} />;
            case 'SEARCH': return <Search />;
            case 'INVENTORY': return <Inventory />;
            case 'NEW_PRODUCT': return <NewProduct />;
            case 'MOVEMENTS': return <Movements />;
            case 'LOANS': return <Loans />;
            case 'BAPTISMS': return <Baptisms />;
            case 'PRESENTATIONS': return <ChildPresentations />;
            case 'ADMIN_PANEL': {
                if (!canAccessAdminPanel) {
                    toast.error('No tienes permisos para acceder a Configuración');
                    setTimeout(() => irA('PANEL'), 0);
                    return <InfoPointMenu onNavigate={irA} currentUser={authorizedUser} />;
                }
                return <AdminPanel />;
            }
            // Cualquier ?view= que no exista abre el menú, que es de donde
            // sale todo lo demás.
            default: return <InfoPointMenu onNavigate={irA} currentUser={authorizedUser} />;
        }
    };

    /** ¿Lo que se está mostrando es el menú de funciones? */
    const esElMenu = currentView === 'PANEL' || currentView === 'SUMMARY';

    return (
        <div className="flex flex-col md:flex-row h-screen md:h-[calc(100vh-64px)] bg-slate-50 overflow-hidden relative">

            {/* --- MOBILE LAYOUT --- */}
            <div className="md:hidden fixed inset-x-0 top-16 bottom-0 z-30 flex flex-col bg-slate-50 overflow-hidden">
                {/* Header solo en sub-vistas (back + título + dropdown).
                    En la raíz del panel (PANEL) no hay barra: el toggle
                    Web/Panel se eliminó. */}
                {!esElMenu && (
                    <header className="flex-none z-40 bg-white border-b border-slate-200 select-none overflow-hidden" style={{ touchAction: 'none' }}>
                        <MobileHeader
                            title={getViewTitle(currentView)}
                            isRoot={false}
                            onBack={() => irA('PANEL')}
                            currentView={currentView}
                            onNavigate={irA}
                            currentUser={authorizedUser}
                        />
                    </header>
                )}

                <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-slate-50">
                    {esElMenu ? (
                        renderView()
                    ) : (
                        <div className="pb-20 px-4 pt-4">
                            {renderView()}
                        </div>
                    )}
                </main>

                <NeoSidebar
                    currentView={currentView}
                    setView={irA}
                    settings={settings}
                    isOpen={isSidebarOpen}
                    onClose={() => setIsSidebarOpen(false)}
                    currentUser={authorizedUser}
                />
            </div>

            {/* --- DESKTOP LAYOUT --- */}
            <div className="hidden md:flex flex-col flex-1 h-full overflow-hidden relative">

                {/* La cabecera del panel en la compu: dónde estás y cómo
                    volver al menú. Antes eran dos flechas que iban a la
                    función anterior y a la siguiente, en un orden que sólo
                    conocía el código: para llegar a Préstamos había que pasar
                    por las otras seis. Ahora se elige en el menú, que es una
                    lista con los nombres a la vista.
                    En el menú no hay cabecera: esa pantalla trae su título. */}
                {!esElMenu && (
                    <header className="flex-none border-b border-slate-200 bg-white">
                        <div className="flex items-center gap-4 px-8 py-5">
                            <button
                                type="button"
                                onClick={() => irA('PANEL')}
                                className="shrink-0 inline-flex items-center gap-1.5 h-10 px-3 -ml-3 rounded-full text-sm font-semibold text-slate-500 hover:text-black hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Punto de Información
                            </button>
                            <h1 className="flex-1 text-2xl font-bold tracking-tight text-black text-center leading-none">
                                {getViewTitle(currentView)}
                            </h1>
                            {/* Espaciador: mantiene el título centrado. */}
                            <div className="shrink-0 w-[196px]" aria-hidden="true" />
                        </div>
                    </header>
                )}

                <main className={`flex-1 overflow-y-auto relative bg-slate-50 ${esElMenu ? '' : 'p-8'}`}>
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