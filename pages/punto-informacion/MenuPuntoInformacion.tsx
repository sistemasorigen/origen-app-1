import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ViewState, UserRole, User as UserType } from '../../types';
import {
    Package, CalendarRange, ArrowLeftRight, Baby, User, Settings,
    Tag, FileText, Megaphone, ChevronRight, ChevronDown, ClipboardCheck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { hasRole } from '../../services/authUtils';

/**
 * La puerta del Punto de Información.
 *
 * Era una grilla de doce tarjetas con un icono y una palabra en mayúscula:
 * entraban cuatro y media en la pantalla, y para saber qué había adentro de
 * cada una había que entrar. Quien lo abre muchas veces es alguien que
 * empieza hoy.
 *
 * Ahora es una lista, como el resto del módulo: cada función ocupa una línea,
 * y abajo del nombre dice qué se hace ahí. El color del círculo no es
 * decoración: es lo que después se reconoce de un vistazo, y por eso cada
 * función tiene el suyo.
 *
 * Y están separadas en dos. Arriba, lo que se hace parado atrás del mostrador
 * —mover stock, prestar, anotar a alguien—, que es a lo que se entra cada
 * domingo. Abajo, lo administrativo, que se toca de vez en cuando: va en un
 * desplegable cerrado, así las cinco de siempre entran juntas en la pantalla
 * sin que haya que buscarlas entre lo demás.
 */

interface InfoPointMenuProps {
    onNavigate: (view: ViewState) => void;
    currentUser?: UserType | null;
}

interface Funcion {
    id: string;
    label: string;
    descripcion: string;
    icon: React.ElementType;
    fondo: string;
    tinta: string;
    externalRoute?: string;
    roles?: UserRole[];
}

/** Lo del mostrador: entradas, salidas y a quién se anotó hoy. */
const GESTION: Funcion[] = [
    // Primero: es lo primero que se hace al llegar al stand.
    { id: 'REPORTAR', label: 'Reportar', descripcion: 'Contá el stock y avisá cuánto hay', icon: ClipboardCheck, fondo: 'bg-indigo-50', tinta: 'text-indigo-600', externalRoute: '/punto-de-informacion/reportar' },
    { id: 'MOVEMENTS', label: 'Movimientos', descripcion: 'Entradas, salidas y ajustes', icon: ArrowLeftRight, fondo: 'bg-sky-50', tinta: 'text-sky-600' },
    { id: 'INVENTORY', label: 'Inventario', descripcion: 'Qué hay de cada talle', icon: Package, fondo: 'bg-emerald-50', tinta: 'text-emerald-600' },
    { id: 'LOANS', label: 'Préstamos', descripcion: 'Qué salió y todavía no volvió', icon: Tag, fondo: 'bg-orange-50', tinta: 'text-orange-600' },
    { id: 'BAPTISMS', label: 'Bautismos', descripcion: 'Quién se anotó y quién ya se bautizó', icon: User, fondo: 'bg-cyan-50', tinta: 'text-cyan-600' },
    { id: 'PRESENTATIONS', label: 'Presentaciones', descripcion: 'Los chicos que se van a presentar', icon: Baby, fondo: 'bg-violet-50', tinta: 'text-violet-600' },
];

/** Lo que se carga una vez y queda: la agenda, los avisos, los números. */
const ADMINISTRACION: Funcion[] = [
    { id: 'ANNOUNCEMENTS', label: 'Anuncios', descripcion: 'Lo que se muestra en la app', icon: Megaphone, fondo: 'bg-amber-50', tinta: 'text-amber-600' },
    { id: 'EVENTS', label: 'Eventos', descripcion: 'La agenda de lo que viene', icon: CalendarRange, fondo: 'bg-rose-50', tinta: 'text-rose-600' },
    {
        id: 'REPORTES',
        label: 'Reportes',
        descripcion: 'Los números del Punto',
        icon: FileText,
        fondo: 'bg-teal-50',
        tinta: 'text-teal-600',
        externalRoute: '/reportes/puntoinfo',
        // Los mismos cinco que deja entrar la ruta en App.tsx.
        roles: [
            UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.ADMIN_PUNTO,
            UserRole.ENCARGADO_PUNTO, UserRole.REPORTES,
        ],
    },
    {
        id: 'ADMIN_PANEL',
        label: 'Configuración',
        descripcion: 'Ajustes del Punto',
        icon: Settings,
        fondo: 'bg-slate-100',
        tinta: 'text-slate-600',
        roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO],
    },
];

/** "Anuncios, Eventos y Reportes": lo que hay adentro, antes de abrir. */
const enumerar = (items: Funcion[]) =>
    items.map(i => i.label).join(', ').replace(/, ([^,]+)$/, ' y $1');

const InfoPointMenu: React.FC<InfoPointMenuProps> = ({ onNavigate, currentUser: propUser }) => {
    const navigate = useNavigate();
    const { user: globalUser } = useAuth();
    const usuario = propUser || globalUser;
    const sinMovimiento = useReducedMotion();
    // Cerrado al entrar: lo administrativo no es a lo que se viene.
    const [abierto, setAbierto] = useState(false);
    const cajon = useRef<HTMLElement>(null);

    // El desplegable vive abajo de todo: lo que despliega nace fuera de la
    // pantalla. Cuando termina de abrirse, se acerca lo justo para que las
    // cuatro se vean sin que haya que buscarlas.
    const acercar = () => {
        if (!abierto) return;
        cajon.current?.scrollIntoView({
            block: 'nearest',
            behavior: sinMovimiento ? 'auto' : 'smooth',
        });
    };

    const puedeVer = (item: Funcion) => {
        if (!item.roles || item.roles.length === 0) return true;
        if (!usuario) return false;
        // SUPER_ADMIN entra a todo, por las dudas de que el rol venga sólo en roles[].
        if (usuario.roles?.includes(UserRole.SUPER_ADMIN) || usuario.role === UserRole.SUPER_ADMIN) return true;
        return hasRole(usuario, item.roles);
    };

    const gestion = GESTION.filter(puedeVer);
    const administracion = ADMINISTRACION.filter(puedeVer);

    const abrir = (item: Funcion) => {
        if (item.externalRoute) navigate(item.externalRoute);
        else onNavigate(item.id as ViewState);
    };

    const fila = (item: Funcion) => (
        <li key={item.id}>
            <button
                id={`tour-infopoint-${item.id.toLowerCase()}`}
                onClick={() => abrir(item)}
                className="w-full px-4 py-3.5 flex items-center gap-3.5 text-left hover:bg-slate-50 active:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-inset"
            >
                <span className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center ${item.fondo} ${item.tinta}`}>
                    <item.icon className="w-5 h-5" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-[15px] text-black leading-tight">{item.label}</span>
                    <span className="block text-[13px] text-slate-400 truncate mt-0.5">{item.descripcion}</span>
                </span>
                <ChevronRight className="shrink-0 w-4 h-4 text-slate-300" aria-hidden="true" />
            </button>
        </li>
    );

    return (
        <div className="bg-slate-50 min-h-full pt-5 pb-24">
            <div className="px-4 mb-5">
                <h2 className="text-[26px] font-bold tracking-tight text-black leading-none">Punto de Información</h2>
                <p className="text-sm text-slate-500 mt-2">Elegí qué querés hacer.</p>
            </div>

            <div className="px-4 space-y-5">
                <section aria-labelledby="punto-gestion">
                    <h3 id="punto-gestion" className="px-1 mb-2 text-[13px] font-semibold text-slate-500">
                        Gestión
                    </h3>
                    <ul className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden divide-y divide-slate-100">
                        {gestion.map(fila)}
                    </ul>
                </section>

                {administracion.length > 0 && (
                    <section ref={cajon} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        {/* La barra es una fila más —nombre, qué hay adentro y
                            una flecha—, sólo que en vez de llevar a una
                            función abre las que guarda. */}
                        <h3>
                            <button
                                type="button"
                                onClick={() => setAbierto(a => !a)}
                                aria-expanded={abierto}
                                aria-controls="punto-administracion"
                                className="w-full px-4 py-3.5 flex items-center gap-3.5 text-left hover:bg-slate-50 active:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-inset"
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block font-semibold text-[15px] text-black leading-tight">Administración</span>
                                    <span className="block text-[13px] text-slate-400 truncate mt-0.5">
                                        {abierto ? 'Lo que se carga de vez en cuando' : enumerar(administracion)}
                                    </span>
                                </span>
                                <ChevronDown
                                    className={`shrink-0 w-4 h-4 text-slate-400 transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
                                    aria-hidden="true"
                                />
                            </button>
                        </h3>

                        <AnimatePresence initial={false}>
                            {abierto && (
                                <motion.ul
                                    id="punto-administracion"
                                    initial={sinMovimiento ? false : { height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={sinMovimiento ? { opacity: 0 } : { height: 0, opacity: 0 }}
                                    transition={{ duration: sinMovimiento ? 0 : 0.2, ease: 'easeOut' }}
                                    onAnimationComplete={acercar}
                                    className="border-t border-slate-100 divide-y divide-slate-100 overflow-hidden"
                                >
                                    {administracion.map(fila)}
                                </motion.ul>
                            )}
                        </AnimatePresence>
                    </section>
                )}
            </div>
        </div>
    );
};

export default InfoPointMenu;
