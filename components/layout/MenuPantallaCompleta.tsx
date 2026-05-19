import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X, ArrowRight } from 'lucide-react';
import { User, UserRole } from '../../types';
import { hasRole } from '../../services/authUtils';

interface FullScreenMenuProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser?: User | null;
    onLogout?: () => void;
}

const FullScreenMenu: React.FC<FullScreenMenuProps> = ({ isOpen, onClose, currentUser, onLogout }) => {
    const location = useLocation();

    // Lock body scroll when menu is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const menuItems = [
        {
            label: 'INICIO',
            path: '/',
            visible: true
        },
        {
            label: 'MIS GRUPOS',
            path: '/mis-grupos',
            visible: !!currentUser && hasRole(currentUser, [UserRole.ANFITRION, UserRole.ADMIN_GROUPS, UserRole.SUPER_ADMIN])
        },
        {
            label: 'COORDINADORES',
            path: '/coordinators',
            visible: !!currentUser && hasRole(currentUser, [UserRole.COORDINATOR, UserRole.SUPER_ADMIN])
        },
        {
            label: 'GCX',
            path: '/gcx',
            visible: !!currentUser
        },
        {
            label: 'PUNTO DE INFORMACIÓN',
            path: '/punto-de-informacion',
            visible: !!currentUser
        },
        {
            label: 'REPORTES',
            path: '/reportes',
            visible: !!currentUser && hasRole(currentUser, [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.ENCARGADO_PUNTO, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_GRUPOS, UserRole.REPORTES, UserRole.ADMIN_GROUPS])
        },
        {
            label: 'BIENVENIDA',
            path: '/bienvenida',
            visible: !!currentUser && hasRole(currentUser, [UserRole.SUPER_ADMIN, UserRole.ENCARGADO_BIENVENIDA, UserRole.VOLUNTARIO_BIENVENIDA])
        },
        {
            label: 'SISTEMAS',
            path: '/panel-admin',
            visible: !!currentUser && hasRole(currentUser, [UserRole.SUPER_ADMIN])
        },
    ];

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-md animate-fadeIn transition-all duration-300">
            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-6 right-6 p-2 rounded-full bg-white text-black hover:bg-slate-200 transition-colors z-50"
                aria-label="Cerrar menú"
            >
                <X className="w-8 h-8" />
            </button>

            {/* Menu Links */}
            <nav className="flex flex-col items-center justify-center gap-6 w-full max-w-4xl px-4 overflow-y-auto max-h-[80vh] py-8">
                {menuItems.filter(item => item.visible).map((item, index) => {
                    const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            onClick={onClose}
                            className={`group flex items-center gap-4 text-3xl sm:text-5xl md:text-6xl font-black tracking-tighter uppercase transition-all duration-300 
                                ${isActive
                                    ? 'text-white'
                                    : 'text-zinc-500 hover:text-white'
                                }`}
                            style={{
                                animationDelay: `${index * 50}ms`,
                                animationFillMode: 'both'
                            }}
                        >
                            <span className="relative">
                                {item.label}
                                {isActive && (
                                    <span className="absolute -bottom-2 left-0 w-full h-1 sm:h-2 bg-white rounded-full"></span>
                                )}
                            </span>
                            <ArrowRight
                                className={`w-8 h-8 sm:w-12 sm:h-12 transition-transform duration-300 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 ${isActive ? 'opacity-100 translate-x-0' : ''}`}
                            />
                        </Link>
                    );
                })}

                {/* Logout Button in Menu */}
                {currentUser && onLogout && (
                    <button
                        onClick={() => {
                            onLogout();
                            onClose();
                        }}
                        className="group flex items-center gap-4 text-3xl sm:text-5xl md:text-6xl font-black tracking-tighter uppercase transition-all duration-300 text-red-500 hover:text-red-400 mt-4"
                        style={{
                            animationDelay: `${menuItems.length * 50}ms`,
                            animationFillMode: 'both'
                        }}
                    >
                        <span className="relative">CERRAR SESIÓN</span>
                        <ArrowRight
                            className="w-8 h-8 sm:w-12 sm:h-12 transition-transform duration-300 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0"
                        />
                    </button>
                )}
            </nav>

            {/* Decorative / Footer Info */}
            <div className="absolute bottom-8 text-zinc-600 text-xs sm:text-sm font-bold tracking-widest uppercase">
                Origen App • {new Date().getFullYear()}
            </div>
        </div>
    );
};

export default FullScreenMenu;
