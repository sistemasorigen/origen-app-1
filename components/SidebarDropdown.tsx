import React, { useState, useRef, useEffect } from 'react';
import { Menu, ChevronDown, LayoutDashboard, Package, ArrowLeftRight, PlusCircle, Droplets, Baby, Shirt, CalendarDays, Search, Settings, FileText, Megaphone } from 'lucide-react';
import { ViewState, UserRole, User } from '../types';
import { hasRole } from '../services/authUtils';

interface SidebarDropdownProps {
    currentView: ViewState;
    onNavigate: (view: ViewState) => void;
    currentUser?: User | null;
}

/**
 * SidebarDropdown - Neo-brutalist dropdown menu for mobile navigation
 * Shows all available menu items based on user role
 * Replaces the broken mobile sidebar drawer with a compact dropdown
 */
const SidebarDropdown: React.FC<SidebarDropdownProps> = ({ currentView, onNavigate, currentUser }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Menu items - same as NeoSidebar
    const allMenuItems = [
        { id: 'PANEL', label: 'Dashboard', icon: LayoutDashboard, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO, UserRole.ANFITRION] },
        { id: 'ANNOUNCEMENTS', label: 'Anuncios', icon: Megaphone, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO] },
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

    // Find current item for display
    const currentItem = visibleItems.find(item => item.id === currentView);
    const CurrentIcon = currentItem?.icon || Menu;

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsOpen(true);
            }
            return;
        }

        switch (e.key) {
            case 'Escape':
                setIsOpen(false);
                buttonRef.current?.focus();
                break;
            case 'ArrowDown':
            case 'ArrowUp': {
                e.preventDefault();
                const currentIndex = visibleItems.findIndex(item => item.id === currentView);
                const nextIndex =
                    e.key === 'ArrowDown'
                        ? (currentIndex + 1) % visibleItems.length
                        : (currentIndex - 1 + visibleItems.length) % visibleItems.length;
                handleSelectItem(visibleItems[nextIndex].id);
                break;
            }
            default:
                break;
        }
    };

    const handleSelectItem = (itemId: string) => {
        onNavigate(itemId as ViewState);
        setIsOpen(false);
        buttonRef.current?.focus();
    };

    return (
        <div className="relative inline-block">
            {/* Trigger Button - Menu Icon */}
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                onKeyDown={handleKeyDown}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                aria-label="Menú de navegación"
                className="p-2 border-2 border-black bg-white text-black transition-all hover:-translate-y-1 hover:shadow-md active:translate-y-[2px] active:shadow-none focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
                <Menu className="w-5 h-5" />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div
                    ref={dropdownRef}
                    role="menu"
                    className="absolute top-full right-0 mt-1 w-64 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 overflow-hidden"
                >
                    {visibleItems.map((item) => {
                        const ItemIcon = item.icon;
                        const isSelected = currentView === item.id;

                        return (
                            <button
                                key={item.id}
                                onClick={() => handleSelectItem(item.id)}
                                onKeyDown={handleKeyDown}
                                role="menuitem"
                                aria-current={isSelected ? 'page' : undefined}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-bold uppercase transition-all border-b border-slate-200 last:border-b-0 ${
                                    isSelected
                                        ? 'bg-black text-white'
                                        : 'bg-white text-black hover:bg-slate-100'
                                }`}
                            >
                                <ItemIcon className="w-5 h-5 flex-shrink-0" strokeWidth={2.5} />
                                <span className="flex-1">{item.label}</span>
                                {isSelected && (
                                    <span className="text-lg leading-none">✓</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SidebarDropdown;
