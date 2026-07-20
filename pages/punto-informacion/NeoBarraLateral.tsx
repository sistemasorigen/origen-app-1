import React, { useState } from 'react';
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
    FileText,
    Megaphone,
    PanelLeftClose,
    PanelLeftOpen,
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
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Menu Configuration based on Role requirements:
    const allMenuItems = [
        { id: 'PANEL', label: 'Dashboard', icon: LayoutDashboard, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO, UserRole.ANFITRION] },
        { id: 'ANNOUNCEMENTS', label: 'Anuncios', icon: Megaphone, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO] },

        { id: 'INVENTORY', label: 'Inventario Total', icon: Package, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO] },

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
            <div
                className={`
                    fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 h-screen
                    transform transition-all duration-300 ease-in-out
                    md:translate-x-0 md:static md:inset-auto md:flex md:flex-col md:h-full
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                    ${isCollapsed ? 'w-16' : 'w-64'}
                `}
            >
                {/* Header */}
                <div className={`p-4 border-b border-slate-200 flex items-center bg-white ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                    {/* Title — hidden when collapsed */}
                    {!isCollapsed && (
                        <div>
                            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">
                                Panel
                            </h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Punto de Info</p>
                        </div>
                    )}

                    <div className={`flex items-center ${isCollapsed ? 'flex-col gap-2' : 'gap-2'}`}>
                        {/* Collapse Toggle Button — desktop only */}
                        <button
                            onClick={() => setIsCollapsed(prev => !prev)}
                            aria-label={isCollapsed ? 'Expandir menú de navegación' : 'Colapsar menú de navegación'}
                            aria-expanded={!isCollapsed}
                            title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
                            className="hidden md:flex items-center justify-center w-8 h-8 border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                        >
                            {isCollapsed
                                ? <PanelLeftOpen className="w-4 h-4" strokeWidth={2.5} />
                                : <PanelLeftClose className="w-4 h-4" strokeWidth={2.5} />
                            }
                        </button>

                        {/* Close Button — mobile only */}
                        <button
                            onClick={onClose}
                            aria-label="Cerrar menú de navegación"
                            className="md:hidden flex items-center justify-center w-8 h-8 border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Nav Items */}
                <nav id="neo-sidebar-menu" className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-1">
                    {visibleItems.map((item) => {
                        const isActive = currentView === item.id;
                        return (
                            <button
                                key={item.id}
                                id={`tour-infopoint-${item.id.toLowerCase()}-sidebar`}
                                onClick={() => {
                                    if (item.id === 'REPORTS') {
                                        navigate('/reportes');
                                    } else {
                                        setView(item.id as ViewState);
                                    }
                                    onClose(); // Auto close on mobile click
                                }}
                                aria-current={isActive ? 'page' : undefined}
                                aria-label={`${item.label}${isActive ? ' (actual)' : ''}`}
                                title={isCollapsed ? item.label : undefined}
                                className={`w-full flex items-center gap-3 text-sm font-bold uppercase tracking-tight rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2
                                    ${isCollapsed ? 'justify-center px-0 py-3' : 'px-4 py-3'}
                                    ${isActive
                                        ? 'bg-black text-white'
                                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                    }`}
                            >
                                <item.icon
                                    className={`flex-shrink-0 w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`}
                                    strokeWidth={2.5}
                                />
                                {/* Label — hidden when collapsed */}
                                {!isCollapsed && (
                                    <span className="truncate">{item.label}</span>
                                )}
                            </button>
                        );
                    })}
                </nav>
            </div>
        </>
    );
};

export default NeoSidebar;
