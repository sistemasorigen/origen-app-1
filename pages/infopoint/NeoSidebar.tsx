import React from 'react';
import { useNavigate } from 'react-router-dom';

import { ViewState, AppSettings, UserRole, User } from '../../types';
import { hasRole } from '../../services/authUtils';
import {
    LayoutDashboard,
    Package,
    ArrowLeftRight,
    PlusCircle,
    Droplets,
    Baby,
    Shirt,
    CalendarDays,
    Search,
    Settings,
    X,
    FileText
} from 'lucide-react';


interface NeoSidebarProps {
    currentView: ViewState;
    setView: (view: ViewState) => void;
    settings: AppSettings;
    isOpen: boolean;
    onClose: () => void;
    currentUser?: User | null;
}

const NeoSidebar: React.FC<NeoSidebarProps> = ({ currentView, setView, settings, isOpen, onClose, currentUser }) => {
    const navigate = useNavigate();

    // Menu Configuration based on Role requirements:

    const allMenuItems = [
        { id: 'PANEL', label: 'Dashboard', icon: LayoutDashboard, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO, UserRole.ANFITRION] },
        { id: 'SEARCH', label: 'Búsqueda de Stock', icon: Search, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO, UserRole.ANFITRION] },
        { id: 'INVENTORY', label: 'Inventario Total', icon: Package, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO] },
        { id: 'NEW_PRODUCT', label: 'Nuevo Producto', icon: PlusCircle, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO] },
        { id: 'MOVEMENTS', label: 'Registrar Movimiento', icon: ArrowLeftRight, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO, UserRole.ANFITRION] },
        { id: 'LOANS', label: 'Préstamos', icon: Shirt, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO, UserRole.ANFITRION] },
        { id: 'BAPTISMS', label: 'Bautismos', icon: Droplets, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO, UserRole.ANFITRION] },
        { id: 'PRESENTATIONS', label: 'Presentación', icon: Baby, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO, UserRole.ANFITRION] },
        { id: 'EVENTS', label: 'Eventos', icon: CalendarDays, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO] },
        { id: 'ADMIN_PANEL', label: 'Configuración', icon: Settings, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO] },
        { id: 'REPORTS', label: 'Reportes', icon: FileText, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO] },


    ];


    // Filter items based on role
    const visibleItems = allMenuItems.filter(item => {
        if (!currentUser) return false;
        return hasRole(currentUser, item.roles);
    });

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar Container */}
            <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r-4 border-black h-screen
        transform transition-transform duration-300 ease-in-out
        md:translate-x-0 md:static md:inset-auto md:flex md:flex-col md:h-full
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
                <div className="p-6 border-b-4 border-black flex justify-between items-center bg-white">
                    <div>
                        <h1 className="text-2xl font-black text-black uppercase tracking-tighter">
                            Panel
                        </h1>
                        <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mt-1">Punto de Info</p>
                    </div>

                    {/* Close Button Mobile */}
                    <button
                        onClick={onClose}
                        className="md:hidden p-1 text-black hover:bg-black hover:text-white border-2 border-transparent hover:border-black transition-all"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <nav id="neo-sidebar-menu" className="flex-1 overflow-y-auto p-0 space-y-0">
                    {visibleItems.map((item) => (
                        <button
                            key={item.id}
                            id={`tour-infopoint-${item.id.toLowerCase()}-sidebar`}
                            onClick={() => {
                                if (item.id === 'REPORTS') {
                                    navigate('/pastores');
                                } else {
                                    setView(item.id as ViewState);
                                }
                                onClose(); // Auto close on mobile click
                            }}
                            className={`w-full flex items-center gap-3 px-6 py-4 text-sm font-bold uppercase tracking-tight transition-all border-b border-neutral-200
                ${currentView === item.id
                                    ? 'bg-black text-white font-black tracking-widest border-y-2 border-black -my-px relative z-10'
                                    : 'text-black bg-white hover:bg-neutral-100'
                                }`}
                        >
                            <item.icon className={`w-5 h-5 ${currentView === item.id ? 'text-white' : 'text-black'}`} strokeWidth={2.5} />
                            {item.label}
                        </button>
                    ))}
                </nav>
            </div>
        </>
    );
};

export default NeoSidebar;
