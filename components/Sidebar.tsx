import React from 'react';
import { ViewState, AppSettings, UserRole, User } from '../types';
import { hasRole } from '../services/authUtils';
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
  Moon,
  Sun,
  X
} from 'lucide-react';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  settings: AppSettings;
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User | null;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, settings, isOpen, onClose, currentUser }) => {
  const [isDark, setIsDark] = React.useState(document.documentElement.classList.contains('dark'));

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  };

  // Menu Configuration based on Role requirements:
  // Volunteers (VOLUNTARIO_INFO) see: Dashboard, Search, Movements, Loans, Baptisms, Presentations.
  // Encargados/Admins see everything.
  const allMenuItems = [
    { id: 'PANEL', label: 'Dashboard', icon: LayoutDashboard, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO, UserRole.ANFITRION] },
    { id: 'SEARCH', label: 'Búsqueda de Stock', icon: Search, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO, UserRole.ANFITRION] },
    { id: 'INVENTORY', label: 'Inventario Total', icon: Package, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO] },
    { id: 'NEW_PRODUCT', label: 'Nuevo Producto', icon: PlusCircle, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO] },
    { id: 'MOVEMENTS', label: 'Registrar Movimiento', icon: ArrowLeftRight, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO, UserRole.ANFITRION] },
    { id: 'LOANS', label: 'Préstamos', icon: Shirt, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO, UserRole.ANFITRION] },
    { id: 'BAPTISMS', label: 'Bautismos', icon: Droplets, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO, UserRole.ANFITRION] },
    { id: 'PRESENTATIONS', label: 'Presentación de niños', icon: Baby, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO, UserRole.ANFITRION] },
    { id: 'EVENTS', label: 'Eventos', icon: CalendarDays, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO] },
    { id: 'ADMIN_PANEL', label: 'Configuración', icon: Settings, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO] },
  ];

  // Filter items based on role
  const visibleItems = allMenuItems.filter(item => {
    if (!currentUser) return false;
    // Check if user has ANY of the required roles
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
        fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 
        transform transition-transform duration-300 ease-in-out
        md:translate-x-0 md:static md:inset-auto md:flex md:flex-col md:h-full
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">
              Panel
            </h1>
            <p className="text-xs text-slate-500 mt-1">Punto de Información</p>
          </div>

          {/* Close Button Mobile */}
          <button
            onClick={onClose}
            className="md:hidden p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setView(item.id as ViewState);
                onClose(); // Auto close on mobile click
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${currentView === item.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>


      </div>
    </>
  );
};

export default Sidebar;