import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ViewState, UserRole, User as UserType } from '../../types';
import {
    Package, CalendarRange, ArrowLeftRight, Baby, User, Settings,
    Layers, Tag, FileText, Megaphone, ChevronRight,
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
 * entran ocho de una, y abajo del nombre dice qué se hace ahí. El color del
 * círculo no es decoración: es lo que después se reconoce de un vistazo, y
 * por eso cada función tiene el suyo.
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

const InfoPointMenu: React.FC<InfoPointMenuProps> = ({ onNavigate, currentUser: propUser }) => {
    const navigate = useNavigate();
    const { user: globalUser } = useAuth();
    const usuario = propUser || globalUser;

    const todas: Funcion[] = [
        { id: 'SUMMARY', label: 'Resumen', descripcion: 'Cómo viene el día', icon: Layers, fondo: 'bg-indigo-50', tinta: 'text-indigo-600' },
        { id: 'MOVEMENTS', label: 'Movimientos', descripcion: 'Entradas, salidas y ajustes', icon: ArrowLeftRight, fondo: 'bg-sky-50', tinta: 'text-sky-600' },
        { id: 'INVENTORY', label: 'Inventario', descripcion: 'Qué hay de cada talle', icon: Package, fondo: 'bg-emerald-50', tinta: 'text-emerald-600' },
        { id: 'LOANS', label: 'Préstamos', descripcion: 'Qué salió y todavía no volvió', icon: Tag, fondo: 'bg-orange-50', tinta: 'text-orange-600' },
        { id: 'ANNOUNCEMENTS', label: 'Anuncios', descripcion: 'Lo que se muestra en la app', icon: Megaphone, fondo: 'bg-amber-50', tinta: 'text-amber-600' },
        { id: 'EVENTS', label: 'Eventos', descripcion: 'La agenda de lo que viene', icon: CalendarRange, fondo: 'bg-rose-50', tinta: 'text-rose-600' },
        { id: 'BAPTISMS', label: 'Bautismos', descripcion: 'Quién se anotó y quién ya se bautizó', icon: User, fondo: 'bg-cyan-50', tinta: 'text-cyan-600' },
        { id: 'PRESENTATIONS', label: 'Presentaciones', descripcion: 'Los chicos que se van a presentar', icon: Baby, fondo: 'bg-violet-50', tinta: 'text-violet-600' },
        {
            id: 'REPORTES',
            label: 'Reportes',
            descripcion: 'Los números del Punto',
            icon: FileText,
            fondo: 'bg-teal-50',
            tinta: 'text-teal-600',
            externalRoute: '/reportes',
            roles: [
                UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO,
                UserRole.REPORTES, UserRole.PASTOR, UserRole.ENCARGADO_GRUPOS, UserRole.ADMIN_GROUPS,
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

    const visibles = todas.filter(item => {
        if (!item.roles || item.roles.length === 0) return true;
        if (!usuario) return false;
        // SUPER_ADMIN entra a todo, por las dudas de que el rol venga sólo en roles[].
        if (usuario.roles?.includes(UserRole.SUPER_ADMIN) || usuario.role === UserRole.SUPER_ADMIN) return true;
        return hasRole(usuario, item.roles);
    });

    const abrir = (item: Funcion) => {
        if (item.externalRoute) navigate(item.externalRoute);
        else onNavigate(item.id as ViewState);
    };

    return (
        <div className="bg-slate-50 min-h-full pt-5 pb-24">
            <div className="px-4 mb-5">
                <h2 className="text-[26px] font-bold tracking-tight text-black leading-none">Punto de Información</h2>
                <p className="text-sm text-slate-500 mt-2">Elegí qué querés hacer.</p>
            </div>

            <div className="px-4">
                <ul className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden divide-y divide-slate-100">
                    {visibles.map(item => (
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
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default InfoPointMenu;
