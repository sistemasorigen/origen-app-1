
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ViewState, UserRole, User as UserType } from '../../types';
import { Package, CalendarRange, ArrowLeftRight, Search, PlusCircle, Baby, User, Settings, Layers, Tag, FileText, Megaphone } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { hasRole } from '../../services/authUtils';

interface InfoPointMenuProps {
    onNavigate: (view: ViewState) => void;
    currentUser?: UserType | null;
}

interface MenuItem {
    id: string;
    label: string;
    icon: React.ElementType;
    color: string;
    externalRoute?: string;
    roles?: UserRole[];
}

const InfoPointMenu: React.FC<InfoPointMenuProps> = ({ onNavigate, currentUser: propUser }) => {
    const navigate = useNavigate();
    const { user: globalUser } = useAuth();

    const userToUse = propUser || globalUser;

    const allMenuItems: MenuItem[] = [
        { id: 'SUMMARY', label: 'Resumen', icon: Layers, color: 'bg-indigo-100' },
        { id: 'ANNOUNCEMENTS', label: 'Anuncios', icon: Megaphone, color: 'bg-yellow-100' },
        { id: 'INVENTORY', label: 'Inventario', icon: Package, color: 'bg-emerald-100' },
        { id: 'MOVEMENTS', label: 'Movimientos', icon: ArrowLeftRight, color: 'bg-blue-100' },
        { id: 'LOANS', label: 'Préstamos', icon: Tag, color: 'bg-orange-100' },
        { id: 'EVENTS', label: 'Eventos', icon: CalendarRange, color: 'bg-amber-100' },
        { id: 'NEW_PRODUCT', label: 'Nuevo Producto', icon: PlusCircle, color: 'bg-rose-100' },
        { id: 'SEARCH', label: 'Buscar', icon: Search, color: 'bg-slate-100' },
        { id: 'BAPTISMS', label: 'Bautismos', icon: User, color: 'bg-cyan-100' },
        { id: 'PRESENTATIONS', label: 'Presentaciones', icon: Baby, color: 'bg-purple-100' },
        {
            id: 'REPORTES',
            label: 'Reportes',
            icon: FileText,
            color: 'bg-teal-100',
            externalRoute: '/reportes',
            roles: [
                UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO,
                UserRole.REPORTES, UserRole.PASTOR, UserRole.ENCARGADO_GRUPOS, UserRole.ADMIN_GROUPS
            ]
        },
        {
            id: 'ADMIN_PANEL',
            label: 'Configuración',
            icon: Settings,
            color: 'bg-gray-200',
            roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO]
        },
    ];

    // Filter menu items based on user permissions
    const menuItems = allMenuItems.filter(item => {
        // Public items (no roles defined) are visible to everyone
        if (!item.roles || item.roles.length === 0) {
            return true;
        }

        // Restricted items require user to be logged in
        if (!userToUse) return false;

        // Explicitly check for SUPER_ADMIN as a safeguard
        if (userToUse.roles?.includes(UserRole.SUPER_ADMIN) || userToUse.role === UserRole.SUPER_ADMIN) {
            return true;
        }

        // Use standard role check
        return hasRole(userToUse, item.roles);
    });

    const handleItemClick = (item: MenuItem) => {
        if (item.externalRoute) {
            navigate(item.externalRoute);
        } else {
            onNavigate(item.id as ViewState);
        }
    };

    return (
        <div className="space-y-6 pt-4 pb-20 overflow-x-hidden">
            <div className="px-4">
                <h2 className="text-2xl font-black uppercase tracking-tighter mb-1">Menú Principal</h2>
                <p className="text-slate-500 text-sm font-medium">Selecciona una opción para gestionar</p>
            </div>

            <div className="grid grid-cols-2 gap-3 px-4 pr-5">
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        id={`tour-infopoint-${item.id.toLowerCase()}`}
                        onClick={() => handleItemClick(item)}
                        className="flex flex-col items-center justify-center p-5 bg-white border-2 border-black rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:scale-95 active:shadow-none transition-all"
                    >
                        <div className={`p-3 rounded-full ${item.color} border-2 border-black mb-3`}>
                            <item.icon className="w-6 h-6 text-black" />
                        </div>
                        <span className="font-bold text-xs uppercase tracking-wide text-black text-center">
                            {item.label}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default InfoPointMenu;

