
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ViewState, UserRole } from '../../types';
import { Package, CalendarRange, ArrowLeftRight, Search, PlusCircle, Baby, User, Settings, Layers, Tag, BarChart3 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { hasRole } from '../../services/authUtils';

interface InfoPointMenuProps {
    onNavigate: (view: ViewState) => void;
}


const InfoPointMenu: React.FC<InfoPointMenuProps> = ({ onNavigate }) => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    // Check if user can access Admin Panel (Configuration)
    const canViewConfig = currentUser && hasRole(currentUser, [
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN_PUNTO,
        UserRole.ENCARGADO_PUNTO
    ]);

    // Menu Config
    const allMenuItems = [
        { id: 'SUMMARY', label: 'Resumen', icon: Layers, color: 'bg-indigo-100' },
        { id: 'INVENTORY', label: 'Inventario', icon: Package, color: 'bg-emerald-100' },
        { id: 'MOVEMENTS', label: 'Movimientos', icon: ArrowLeftRight, color: 'bg-blue-100' },
        { id: 'LOANS', label: 'Préstamos', icon: Tag, color: 'bg-orange-100' },
        { id: 'EVENTS', label: 'Eventos', icon: CalendarRange, color: 'bg-amber-100' },
        { id: 'NEW_PRODUCT', label: 'Nuevo Producto', icon: PlusCircle, color: 'bg-rose-100' },
        { id: 'SEARCH', label: 'Buscar', icon: Search, color: 'bg-slate-100' },
        { id: 'BAPTISMS', label: 'Bautismos', icon: User, color: 'bg-cyan-100' },
        { id: 'PRESENTATIONS', label: 'Presentaciones', icon: Baby, color: 'bg-purple-100' },
        { id: 'REPORTES', label: 'Reportes', icon: BarChart3, color: 'bg-teal-100', externalRoute: '/pastores', requiresAdminAccess: true },
        { id: 'ADMIN_PANEL', label: 'Configuración', icon: Settings, color: 'bg-gray-200', requiresAdminAccess: true },
    ];

    // Filter menu items based on user permissions
    const menuItems = allMenuItems.filter(item => {
        // If item requires admin access, check permission
        if (item.requiresAdminAccess) {
            return canViewConfig;
        }
        // All other items are visible to everyone
        return true;
    });

    const handleItemClick = (item: typeof menuItems[0]) => {
        if (item.externalRoute) {
            navigate(item.externalRoute);
        } else {
            onNavigate(item.id as ViewState);
        }
    };

    return (
        <div className="space-y-6 pt-4 pb-20">
            <div className="px-4">
                <h2 className="text-2xl font-black uppercase tracking-tighter mb-1">Menú Principal</h2>
                <p className="text-slate-500 text-sm font-medium">Selecciona una opción para gestionar</p>
            </div>

            <div className="grid grid-cols-2 gap-4 px-4">
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => handleItemClick(item)}
                        className="flex flex-col items-center justify-center p-6 bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all active:scale-95"
                    >
                        <div className={`p-4 rounded-full ${item.color} border-2 border-black mb-3`}>
                            <item.icon className="w-6 h-6 text-black" />
                        </div>
                        <span className="font-bold text-sm uppercase tracking-wide text-black text-center">
                            {item.label}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default InfoPointMenu;

