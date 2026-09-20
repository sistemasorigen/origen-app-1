import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Settings2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { hasRole } from '../../services/authUtils';
import { UserRole, SeasonSettings, DEFAULT_SEASON_SETTINGS } from '../../types';
import { db } from '../../services/dbService';
import { useBloqueoDeFondo } from '../../hooks/useBloqueoDeFondo';

/**
 * Armazón del Panel GCX (design-claude/Admin GCX - Panel).
 *
 * Una sola cabecera blanca para las siete secciones: título, temporada
 * abierta, pestañas de las tres que se miran todos los días y un desplegable
 * para las cuatro de ajustes. En mobile la cabecera se achica y las secciones
 * salen de una hoja que sube desde abajo.
 *
 * Las pantallas que cuelgan de una sección (crear, editar, inscriptos,
 * detalle, bajas) usan el mismo armazón sin pestañas, con la vuelta atrás.
 */

// ── Toast ─────────────────────────────
interface ToastContextValue {
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useAdminGCXToast = (): ToastContextValue => {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error('useAdminGCXToast debe usarse dentro de AdminGCXLayout');
    }
    return ctx;
};

// ── Conteos de las pestañas ───────────
// Los números de las pestañas salen de los datos que cada sección ya trae:
// no se pide nada de más. Viven fuera del componente para que sigan estando
// al cambiar de sección; una pestaña cuyo número todavía no se cargó no
// muestra globo, en vez de mostrar un cero que sería mentira.
const conteosSesion: Record<string, number> = {};

interface ConteosContextValue {
    registrarConteo: (seccion: string, total: number) => void;
}

const ConteosContext = createContext<ConteosContextValue>({ registrarConteo: () => { } });

export const usePanelGCXConteos = (): ConteosContextValue => useContext(ConteosContext);

// ── Secciones ─────────────────────────
type ZonaSeccion = 'principal' | 'personas' | 'ajustes';

interface SeccionPanel {
    id: string;
    label: string;
    path: string;
    zona: ZonaSeccion;
    roles: UserRole[];
}

const ROLES_GRUPOS = [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS, UserRole.ENCARGADO_GRUPOS];
const ROLES_ADMIN = [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS];

export const SECCIONES_PANEL: SeccionPanel[] = [
    { id: 'grupos', label: 'Grupos', path: '/admingcx/gestion-de-grupos', zona: 'principal', roles: ROLES_GRUPOS },
    { id: 'anfitriones', label: 'Anfitriones', path: '/admingcx/gestion-de-anfitriones', zona: 'personas', roles: ROLES_GRUPOS },
    { id: 'coordinadores', label: 'Coordinadores', path: '/admingcx/gestion-de-coordinadores', zona: 'personas', roles: ROLES_ADMIN },
    { id: 'temporadas', label: 'Temporadas', path: '/admingcx/temporadas', zona: 'ajustes', roles: ROLES_ADMIN },
    { id: 'categorias', label: 'Categorías', path: '/admingcx/categorias', zona: 'ajustes', roles: ROLES_ADMIN },
    { id: 'etiquetas', label: 'Etiquetas', path: '/admingcx/etiquetas', zona: 'ajustes', roles: ROLES_ADMIN },
    { id: 'publica', label: 'Página pública', path: '/admingcx/configuracion', zona: 'ajustes', roles: ROLES_ADMIN },
];

const SUBTITULOS: Record<string, string> = {
    grupos: 'Todos los grupos de la temporada, con su anfitrión y sus cupos.',
    anfitriones: 'Quiénes lideran un grupo y quién se postuló para hacerlo.',
    coordinadores: 'Quiénes supervisan a los anfitriones de cada zona.',
    temporadas: 'Fechas de las tres temporadas y cuál está abierta.',
    categorias: 'Las categorías que se eligen al crear un grupo.',
    etiquetas: 'Las etiquetas temáticas que describen a un grupo.',
    publica: 'El carrusel que se ve arriba del catálogo de grupos.',
};

const NOMBRE_TEMPORADA: Record<string, string> = { S1: 'Temporada 1', S2: 'Temporada 2', S3: 'Temporada 3' };

interface AdminGCXLayoutProps {
    title: string;
    children: React.ReactNode;
    backTo?: string;
    backLabel?: string;
    /** Texto bajo el título. Si no viene, lo pone la sección. */
    subtitle?: string;
    /**
     * Pestañas de una pantalla que cuelga de una sección —la ficha de un
     * grupo y sus dos hermanas—. Van adentro de la banda blanca, como en el
     * diseño, y por eso las pone el armazón y no el cuerpo.
     */
    tabs?: React.ReactNode;
    /**
     * Sin cabecera: la pantalla trae la suya. La usan los formularios de
     * grupo, que son los mismos que el panel de anfitrion y ya tienen
     * encabezado propio con la vuelta atras y el boton de guardar.
     * El armazon se sigue montando por el toast y el fondo.
     */
    soloContenido?: boolean;
}

const AdminGCXLayout: React.FC<AdminGCXLayoutProps> = ({ title, children, backTo = '/gcx', backLabel = 'Volver a GCX', subtitle, tabs: pestanas, soloContenido = false }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    const [notification, setNotification] = useState<{
        show: boolean;
        message: string;
        type: 'success' | 'error' | 'info';
    }>({ show: false, message: '', type: 'success' });

    const [ajustesAbierto, setAjustesAbierto] = useState(false);
    const [hojaAbierta, setHojaAbierta] = useState(false);
    useBloqueoDeFondo(hojaAbierta);
    const [conteos, setConteos] = useState<Record<string, number>>(() => ({ ...conteosSesion }));
    const ajustesRef = useRef<HTMLDivElement>(null);

    const showToast = useCallback((
        message: string,
        type: 'success' | 'error' | 'info' = 'success'
    ) => {
        setNotification({ show: true, message, type });
        setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 3000);
    }, []);

    const registrarConteo = useCallback((seccion: string, total: number) => {
        if (conteosSesion[seccion] === total) return;
        conteosSesion[seccion] = total;
        setConteos({ ...conteosSesion });
    }, []);

    // El desplegable de ajustes se cierra al hacer clic afuera o con Escape.
    useEffect(() => {
        if (!ajustesAbierto) return;
        const fuera = (e: MouseEvent) => {
            if (ajustesRef.current && !ajustesRef.current.contains(e.target as Node)) setAjustesAbierto(false);
        };
        const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAjustesAbierto(false); };
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', tecla);
        return () => {
            document.removeEventListener('mousedown', fuera);
            document.removeEventListener('keydown', tecla);
        };
    }, [ajustesAbierto]);

    useEffect(() => { setHojaAbierta(false); setAjustesAbierto(false); }, [location.pathname]);

    const visibles = SECCIONES_PANEL.filter(s => user && hasRole(user, s.roles));
    const actual = SECCIONES_PANEL.find(s => location.pathname === s.path);
    const enPanel = location.pathname.startsWith('/admingcx');
    const esSubpantalla = enPanel && !actual;

    // La temporada abierta sale de la configuración ya guardada en el
    // dispositivo: es el mismo dato que edita la sección Temporadas y no
    // cuesta una consulta más.
    const temporadas: SeasonSettings = db.getAppConfig()?.groupsConfig?.seasonSettings ?? DEFAULT_SEASON_SETTINGS;
    const abierta = (['S1', 'S2', 'S3'] as const).find(k => temporadas.seasons[k]?.isOpen);
    const nombreTemporada = abierta ? NOMBRE_TEMPORADA[abierta] : 'Sin temporada';
    const etiquetaTemporada = abierta ? `${nombreTemporada} abierta` : 'Sin temporada abierta';

    const subtituloSeccion = subtitle ?? (actual ? SUBTITULOS[actual.id] : '');
    const posicion = actual ? `${visibles.findIndex(s => s.id === actual.id) + 1} de ${visibles.length}` : '';

    const globo = (activa: boolean) =>
        `h-[21px] px-2 rounded-full text-[11.5px] font-semibold flex items-center ${activa ? 'bg-[#0a0a0a] text-white' : 'bg-[#f0efec] text-black/[.62]'}`;

    const filaHoja = (activa: boolean) =>
        `w-full h-[52px] rounded-2xl flex items-center gap-2.5 px-[18px] mb-[7px] text-[15px] font-semibold ${activa ? 'bg-[#0a0a0a] text-white' : 'bg-[#f7f7f5] text-[#0a0a0a]'}`;

    const irA = (path: string) => { setHojaAbierta(false); setAjustesAbierto(false); navigate(path); };

    const tabs = visibles.filter(s => s.zona !== 'ajustes');
    const ajustes = visibles.filter(s => s.zona === 'ajustes');

    return (
        <ToastContext.Provider value={{ showToast }}>
            <ConteosContext.Provider value={{ registrarConteo }}>
                <div id="gcx-panel" className="min-h-screen bg-[#f6f6f4]">

                    {/* Cabecera */}
                    {!soloContenido && <header className="bg-white border-b border-[#ecebe8]">
                        <div className="mx-auto max-w-[1360px] px-4 pt-4 md:px-[26px] md:pt-[18px]">

                            {/* Con pestañas la cabecera se achica: la vuelta atrás y
                                el nombre del grupo comparten renglón, porque abajo
                                vienen las tres pestañas y el nombre grande ya lo
                                repite la ficha. */}
                            {pestanas && (
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => navigate(backTo)}
                                        className="flex h-[34px] flex-none items-center gap-[7px] rounded-full bg-[#f2f2f0] pl-2.5 pr-[13px] text-[12.5px] font-semibold text-black/[.64] transition-colors hover:text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                    >
                                        <ArrowLeft className="h-[15px] w-[15px]" />
                                        {backLabel}
                                    </button>
                                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#0a0a0a]">
                                        {title}
                                    </span>
                                </div>
                            )}

                            <div className={`items-start gap-4 md:gap-5 ${pestanas ? 'hidden' : 'flex'}`}>
                                <div className="min-w-0 flex-1">
                                    {esSubpantalla && (
                                        <button
                                            onClick={() => navigate(backTo)}
                                            className="mb-2.5 inline-flex h-8 items-center gap-1.5 rounded-full bg-[#f2f2f0] px-3 text-[12.5px] font-semibold text-black/[.62] transition-colors hover:text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                        >
                                            <ArrowLeft className="h-3.5 w-3.5" />
                                            {backLabel}
                                        </button>
                                    )}
                                    {!esSubpantalla && enPanel && (
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-black/[.58] md:hidden">
                                            Panel GCX
                                        </p>
                                    )}
                                    <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.018em] text-[#0a0a0a] md:mt-0 md:text-[21px]">
                                        {actual ? actual.label : title}
                                    </h1>
                                    {subtituloSeccion && (
                                        <p className="mt-[5px] hidden text-[12.5px] font-medium text-black/[.62] md:block">
                                            {subtituloSeccion}
                                        </p>
                                    )}
                                </div>

                                {enPanel && (
                                    <div className="hidden h-[34px] flex-none items-center gap-[7px] rounded-full bg-[#f2f2f0] px-[13px] text-[12.5px] font-semibold text-black/[.62] md:flex">
                                        <span className={`h-1.5 w-1.5 rounded-full ${abierta ? 'bg-[#16a34a]' : 'bg-[#b45309]'}`} />
                                        {etiquetaTemporada}
                                    </div>
                                )}
                            </div>

                            {/* Pestañas — escritorio */}
                            {actual && (
                                <div className="mt-4 hidden items-center gap-2.5 md:flex">
                                    <div className="flex min-w-0 flex-1 gap-1">
                                        {tabs.map(s => {
                                            const activa = s.id === actual.id;
                                            return (
                                                <button
                                                    key={s.id}
                                                    onClick={() => irA(s.path)}
                                                    className={`flex h-[42px] items-center gap-[9px] rounded-t-[14px] px-[18px] text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] ${activa
                                                        ? 'border-b-[3px] border-[#0a0a0a] bg-[#f6f6f4] text-[#0a0a0a]'
                                                        : 'border-b-[3px] border-transparent text-black/[.6] hover:text-[#0a0a0a]'}`}
                                                >
                                                    {s.label}
                                                    {conteos[s.id] !== undefined && (
                                                        <span className={globo(activa)}>{conteos[s.id]}</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {ajustes.length > 0 && (
                                        <div className="relative flex-none" ref={ajustesRef}>
                                            <button
                                                onClick={() => setAjustesAbierto(v => !v)}
                                                aria-expanded={ajustesAbierto}
                                                className={`mb-[3px] flex h-[42px] items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${ajustesAbierto ? 'bg-[#0a0a0a] text-white' : 'bg-[#f2f2f0] text-black/[.64]'}`}
                                            >
                                                <Settings2 className="h-[15px] w-[15px]" />
                                                Ajustes del sistema
                                                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${ajustesAbierto ? 'rotate-180' : ''}`} />
                                            </button>

                                            {ajustesAbierto && (
                                                <div className="absolute right-0 top-[46px] z-30 w-[290px] rounded-[20px] bg-white p-2 shadow-[0_10px_34px_rgba(0,0,0,.16)]">
                                                    <p className="mx-3 mb-1.5 mt-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-black/[.58]">
                                                        Se tocan pocas veces al año
                                                    </p>
                                                    {ajustes.map(s => (
                                                        <button
                                                            key={s.id}
                                                            onClick={() => irA(s.path)}
                                                            className="flex h-[46px] w-full items-center gap-2.5 rounded-[14px] px-3 text-[14px] font-semibold text-[#0a0a0a] transition-colors hover:bg-[#f7f7f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                                                        >
                                                            <span className="flex-1 text-left">{s.label}</span>
                                                            {s.id === 'temporadas' ? (
                                                                <span className="text-[11.5px] font-semibold text-black/[.58]">{nombreTemporada}</span>
                                                            ) : conteos[s.id] !== undefined ? (
                                                                <span className="text-[11.5px] font-semibold text-black/[.58]">{conteos[s.id]}</span>
                                                            ) : null}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                            {pestanas && (
                                <div className="-mx-4 mb-3.5 mt-3 flex gap-1 overflow-x-auto px-4 pb-0.5 md:mx-0 md:mb-0 md:px-0 md:pb-3.5">
                                    {pestanas}
                                </div>
                            )}
                            <div className="hidden h-[3px] md:block" />

                            {/* Selector de sección — mobile */}
                            {actual && (
                                <button
                                    onClick={() => setHojaAbierta(true)}
                                    className="mb-[18px] mt-3.5 flex h-12 w-full items-center gap-2.5 rounded-full bg-[#f2f2f0] pl-[18px] pr-2 md:hidden"
                                >
                                    <span className="flex-1 text-left text-[14.5px] font-semibold text-[#0a0a0a]">{actual.label}</span>
                                    <span className="text-[12px] font-semibold text-black/[.58]">{posicion}</span>
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
                                        <ChevronDown className="h-[15px] w-[15px] text-[#0a0a0a]" />
                                    </span>
                                </button>
                            )}
                            {!actual && <div className="h-4 md:hidden" />}
                        </div>
                    </header>}

                    {/* Cuerpo de la sección */}
                    <div className={soloContenido ? '' : 'mx-auto max-w-[1360px] px-4 pb-7 pt-4 md:px-[26px] md:pb-[30px] md:pt-5'}>
                        {children}
                    </div>

                    {/* Hoja de secciones — mobile */}
                    {hojaAbierta && (
                        <div className="fixed inset-0 z-[60] md:hidden">
                            <div className="absolute inset-0 bg-[rgba(10,10,10,.4)]" onClick={() => setHojaAbierta(false)} />
                            <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-auto rounded-t-[28px] bg-white px-4 pb-6 pt-6">
                                {(['principal', 'personas', 'ajustes'] as const).map(zona => {
                                    const deLaZona = visibles.filter(s => s.zona === zona);
                                    if (deLaZona.length === 0) return null;
                                    const titulo = { principal: 'Todos los días', personas: 'Personas', ajustes: 'Ajustes del sistema' }[zona];
                                    return (
                                        <div key={zona}>
                                            <p className="mx-1.5 mb-2.5 mt-[18px] text-[11px] font-semibold uppercase tracking-[0.07em] text-black/[.58] first:mt-0">
                                                {titulo}
                                            </p>
                                            {deLaZona.map(s => {
                                                const activa = actual?.id === s.id;
                                                return (
                                                    <button key={s.id} onClick={() => irA(s.path)} className={filaHoja(activa)}>
                                                        <span className="flex-1 text-left">{s.label}</span>
                                                        {s.id === 'temporadas' ? (
                                                            <span className={`text-[12.5px] font-semibold ${activa ? 'text-white/70' : 'text-black/[.6]'}`}>
                                                                {nombreTemporada}
                                                            </span>
                                                        ) : conteos[s.id] !== undefined ? (
                                                            <span className={`flex h-[22px] items-center rounded-full px-[9px] text-[11.5px] font-semibold ${activa ? 'bg-white/20 text-white' : 'bg-[#eceae6] text-black/[.62]'}`}>
                                                                {conteos[s.id]}
                                                            </span>
                                                        ) : null}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Aviso */}
                    {notification.show && (
                        <div
                            role="status"
                            className={`fixed bottom-4 left-1/2 z-[70] -translate-x-1/2 rounded-full px-5 py-3 text-[13.5px] font-semibold shadow-[0_10px_34px_rgba(0,0,0,.22)] md:left-auto md:right-6 md:translate-x-0 ${notification.type === 'error'
                                ? 'bg-[#fdecea] text-[#a32218]'
                                : notification.type === 'info'
                                    ? 'bg-white text-[#0a0a0a]'
                                    : 'bg-[#0a0a0a] text-white'}`}
                        >
                            {notification.message}
                        </div>
                    )}
                </div>
            </ConteosContext.Provider>
        </ToastContext.Provider>
    );
};

export default AdminGCXLayout;
