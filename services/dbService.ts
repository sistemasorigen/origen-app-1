

import { User, UserRole, Log, SystemModule, AppConfig, SystemNotification, GroupCategory, GroupTag, Group, Product, LeaderApplication, FooterLinks, NotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES, Announcement } from '../types';
import { safeUUID } from './uuidUtils';

// Default Data - STRICTLY ADMINS ONLY. Volunteers must be created via Admin Panel.
const DEFAULT_USERS: User[] = [
    {
        id: '1',
        name: 'Super Admin',
        email: 'admin@origen.com',
        role: UserRole.SUPER_ADMIN,
        roles: [UserRole.SUPER_ADMIN, UserRole.ENCARGADO_BIENVENIDA],
        isActive: true
    },
    {
        id: '2',
        name: 'Pastor Juan',
        email: 'pastor@origen.com',
        role: UserRole.PASTOR,
        roles: [UserRole.PASTOR],
        isActive: true
    }
];

const DEFAULT_CONFIG: AppConfig = {
    appName: 'Origen',
    appSlogan: 'Iglesia',
    brandColor: '#000000',
    themeMode: 'light',
    banner: {
        titlePrefix: 'BIENVENIDOS A',
        titleHighlight: 'CASA',
        description: 'Somos una iglesia que ama a Dios y a las personas.',
        useCustomImage: false,
        gradientClass: 'bg-gradient-to-r from-blue-500 to-purple-500',
        slides: []
    },
    groupsConfig: {
        activeBlurLevel: 'md',
        banners: []
    },
    infoPointConfig: {
        banners: []
    },
    alabanzaConfig: {
        banners: [],
        applicationsEnabled: false
    },
    storeConfig: {
        banners: [],
        categories: ['Ropa', 'Libros', 'Accesorios'],
        tags: ['Nuevo', 'Oferta'],
        checkout: {
            titles: { billing: 'Facturación', summary: 'Resumen', payment: 'Pago' },
            paymentMethods: {
                transfer: { enabled: true, label: 'Transferencia', details: { bank: 'Bank', cbu: '000', alias: 'ALIAS' } },
                cash: { enabled: true, label: 'Efectivo', message: 'Pagar al retirar' },
                mercadopago: { enabled: false, label: 'MercadoPago', link: '' }
            }
        }
    },
    valuesSection: {
        image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?ixlib=rb-4.0.3&auto=format&fit=crop&w=1932&q=80',
        title: 'Nuestros Valores',
        description: 'Creemos en una iglesia relevante, abierta y centrada en Jesús.',
        values: [],
        buttonText: 'Conocer Más',
        buttonLink: '#'
    },
    verses: [],
    footerLinks: {
        instagram: '',
        facebook: '',
        youtube: '',
        spotify: ''
    }
};

const MODULES: SystemModule[] = [
    {
        id: 'groups',
        title: 'Grupos de Conexión',
        subtitle: 'FUIMOS CREADOS PARA ESTAR EN COMUNIDAD',
        description: 'Un lugar para encontrar libertad, hacer comunidad y crecer en nuestra relación con Dios.',
        icon: 'users',
        route: '/groups',
        // General Access: Visible to ALL (Public + Authenticated)
        allowedRoles: [
            UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.ANFITRION, UserRole.VIEWER, UserRole.USUARIO,
            UserRole.VOLUNTARIO, UserRole.VOLUNTARIO_GRUPOS, UserRole.ENCARGADO_GRUPOS, UserRole.ENCARGADO_PUNTO
        ],
        publicAccess: true,
        useImage: true,
        imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?ixlib=rb-4.0.3&auto=format&fit=crop&w=1932&q=80',
        gradientFrom: 'amber-500',
        gradientTo: 'orange-600',
        iconColor: 'text-amber-500'
    },
    {
        id: 'info-point',
        title: 'Punto de Información',
        subtitle: 'Recursos & Gestión',
        description: 'Gestión de inventario, préstamos y eventos de la iglesia.',
        icon: 'info',
        route: '/info-point',
        allowedRoles: [
            UserRole.VOLUNTARIO_INFO,
            UserRole.ENCARGADO_PUNTO,
            UserRole.ENCARGADO_GRUPOS,
            UserRole.SUPER_ADMIN,
            UserRole.ADMIN_PUNTO
        ],
        publicAccess: false,
        useImage: false,
        gradientFrom: 'blue-500',
        gradientTo: 'indigo-600',
        iconColor: 'text-blue-500'
    },
    {
        id: 'pastores',
        title: 'Reportes',
        subtitle: 'Alertas del Sistema',
        description: 'Métricas y estadísticas para la toma de decisiones.',
        icon: 'bar-chart-3',
        route: '/pastores',
        allowedRoles: [
            UserRole.ENCARGADO_PUNTO,
            UserRole.ENCARGADO_GRUPOS,
            UserRole.REPORTES,
            UserRole.SUPER_ADMIN,
            UserRole.ADMIN_PUNTO,
            UserRole.ADMIN_GROUPS
        ],
        publicAccess: false,
        useImage: false,
        gradientFrom: 'slate-700',
        gradientTo: 'slate-900',
        iconColor: 'text-slate-700',
        status: 'active'
    },
    {
        id: 'coordinators',
        title: 'Coordinadores',
        subtitle: 'Panel de Gestión',
        description: 'Gestioná los grupos de tu categoría, revisá la asistencia y métricas.',
        icon: 'clipboard-list',
        route: '/coordinators',
        allowedRoles: [
            UserRole.COORDINATOR,
            UserRole.SUPER_ADMIN
        ],
        publicAccess: false,
        useImage: false,
        gradientFrom: 'teal-500',
        gradientTo: 'emerald-600',
        iconColor: 'text-teal-600',
        status: 'active'
    },
    {
        id: 'welcome-system',
        title: 'Bienvenida',
        subtitle: 'Nuevo Ingresante',
        description: 'Seguimiento y gestión de nuevas personas.',
        icon: 'heart-handshake',
        route: '/welcome',
        allowedRoles: [
            UserRole.SUPER_ADMIN,
            UserRole.ENCARGADO_BIENVENIDA,
            UserRole.VOLUNTARIO_BIENVENIDA
        ],
        publicAccess: false,
        useImage: false,
        gradientFrom: 'pink-500',
        gradientTo: 'rose-600',
        iconColor: 'text-pink-600',
        status: 'active'
    },
    {
        id: 'influos',
        title: 'Influos',
        subtitle: 'Evento de Jóvenes',
        description: 'Gestión de asistentes al evento Influos. Registro de menores con sus datos y primera visita.',
        icon: 'star',
        route: '/influos',
        allowedRoles: [
            UserRole.INFLUOS,
            UserRole.SUPER_ADMIN,
            UserRole.PASTOR
        ],
        publicAccess: false,
        useImage: false,
        gradientFrom: 'violet-500',
        gradientTo: 'purple-700',
        iconColor: 'text-violet-600',
        status: 'active'
    },
    {
        id: 'tutorials',
        title: 'Tutoriales',
        subtitle: 'Capacitación',
        description: 'Aprende a usar todas las herramientas de la plataforma paso a paso.',
        icon: 'book',
        route: '/tutorials',
        allowedRoles: [
            UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.ANFITRION, UserRole.VIEWER, UserRole.USUARIO,
            UserRole.VOLUNTARIO, UserRole.VOLUNTARIO_GRUPOS, UserRole.ENCARGADO_GRUPOS, UserRole.ENCARGADO_PUNTO,
            UserRole.COORDINATOR, UserRole.VOLUNTARIO_INFO, UserRole.ENCARGADO_BIENVENIDA, UserRole.VOLUNTARIO_BIENVENIDA,
            UserRole.REPORTES, UserRole.ADMIN_GROUPS, UserRole.ADMIN_PUNTO
        ],
        publicAccess: false,
        useImage: false,
        gradientFrom: 'cyan-500',
        gradientTo: 'blue-600',
        iconColor: 'text-cyan-600',
        status: 'active'
    },
    {
        id: 'pastoral',
        title: 'Audiencia Servicios',
        subtitle: '',
        description: 'Estadísticas de audiencia a los servicios y eventos especiales',
        icon: 'heart-handshake',
        route: '/pastoral-care',
        allowedRoles: [
            UserRole.SUPER_ADMIN,
            UserRole.PASTOR
        ],
        publicAccess: false,
        useImage: false,
        gradientFrom: 'violet-700',
        gradientTo: 'violet-900',
        iconColor: 'text-violet-900',
        status: 'active'
    },
    {
        id: 'admin',
        title: 'Sistemas',
        subtitle: 'Configuración Global',
        description: 'Gestiona usuarios, permisos y configuración general de la app.',
        icon: 'settings',
        route: '/admin',
        allowedRoles: [UserRole.SUPER_ADMIN],
        publicAccess: false,
        useImage: false,
        gradientFrom: 'slate-500',
        gradientTo: 'slate-700',
        iconColor: 'text-slate-500'
    }
];

class DBService {
    // --- USERS ---
    getUsers(): User[] {
        const stored = localStorage.getItem('users');
        if (!stored) {
            localStorage.setItem('users', JSON.stringify(DEFAULT_USERS));
            return DEFAULT_USERS;
        }
        return JSON.parse(stored);
    }

    saveUser(user: User, password?: string) {
        const users = this.getUsers();
        const index = users.findIndex(u => u.id === user.id);

        if (index >= 0) {
            users[index] = user;
        } else {
            users.push(user);
        }
        localStorage.setItem('users', JSON.stringify(users));

        if (password) {
            // NOTE: Passwords are NOT stored in localStorage.
            // Real authentication is handled exclusively by Supabase Auth.
        }
    }

    deleteUser(id: string) {
        const users = this.getUsers().filter(u => u.id !== id);
        localStorage.setItem('users', JSON.stringify(users));
    }

    verifyCredentials(_email: string, _pass: string): User | null {
        // SECURITY: Passwords are NOT verified locally.
        // All authentication must go through Supabase Auth (supabaseService.signInUser).
        // This mock method is intentionally disabled to prevent credential exposure.
        console.warn('[dbService] verifyCredentials() is disabled. Use Supabase Auth instead.');
        return null;
    }

    // --- APP CONFIG ---
    getAppConfig(): AppConfig {
        const stored = localStorage.getItem('app_config');
        return stored ? JSON.parse(stored) : DEFAULT_CONFIG;
    }

    saveAppConfig(config: AppConfig) {
        localStorage.setItem('app_config', JSON.stringify(config));
    }

    getFooterLinks(): FooterLinks {
        const config = this.getAppConfig();
        return config.footerLinks || { instagram: '', facebook: '', youtube: '', spotify: '' };
    }

    saveFooterLinks(links: FooterLinks): AppConfig {
        const config = this.getAppConfig();
        config.footerLinks = links;
        this.saveAppConfig(config);
        return config; // Return the full updated config
    }

    // --- MODULES ---
    getModules(): SystemModule[] {
        return MODULES;
    }

    // --- LOGS ---
    getLogs(): Log[] {
        return JSON.parse(localStorage.getItem('system_logs') || '[]');
    }

    addLog(log: Log) {
        const logs = this.getLogs();
        logs.unshift(log);
        localStorage.setItem('system_logs', JSON.stringify(logs.slice(0, 100))); // Limit 100
    }

    // --- NOTIFICATIONS ---
    getNotifications(): SystemNotification[] {
        return JSON.parse(localStorage.getItem('notifications') || '[]');
    }

    getProjectNotifications(): SystemNotification[] {
        const all = this.getNotifications();
        // Filter specifically for generic system messages intended for global display
        return all.filter(n => n.type === 'SYSTEM');
    }

    markProjectNotificationsAsRead(): void {
        const all = this.getNotifications();
        const updated = all.map(n => {
            if (n.type === 'SYSTEM') {
                return { ...n, read: true };
            }
            return n;
        });
        localStorage.setItem('notifications', JSON.stringify(updated));
    }

    // Mark single notification as read
    markNotificationAsRead(id: string): void {
        const all = this.getNotifications();
        const updated = all.map(n => n.id === id ? { ...n, read: true } : n);
        localStorage.setItem('notifications', JSON.stringify(updated));
    }

    // Mark ALL notifications as read
    markAllNotificationsAsRead(): void {
        const all = this.getNotifications();
        const updated = all.map(n => ({ ...n, read: true }));
        localStorage.setItem('notifications', JSON.stringify(updated));
    }

    // Get user notification preferences
    getNotificationPreferences(): NotificationPreferences {
        const saved = localStorage.getItem('notification_preferences');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Validation: Ensure categories exist
                if (parsed && parsed.categories) {
                    return parsed;
                }
            } catch {
                return DEFAULT_NOTIFICATION_PREFERENCES;
            }
        }
        return DEFAULT_NOTIFICATION_PREFERENCES;
    }

    // Save user notification preferences
    saveNotificationPreferences(prefs: NotificationPreferences): void {
        localStorage.setItem('notification_preferences', JSON.stringify(prefs));
    }

    sendGroupInquiry(groupId: string, data: any) {
        const notif: SystemNotification = {
            id: safeUUID(),
            title: 'Nueva Solicitud de Grupo',
            message: `${data.firstName} ${data.lastName} quiere unirse.`,
            details: `Tel: ${data.phone}. Nota: ${data.note}`,
            timestamp: new Date().toISOString(),
            read: false,
            targetRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS, UserRole.ANFITRION],
            type: 'INQUIRY',
            metadata: { groupId, ...data }
        };
        const list = this.getNotifications();
        list.unshift(notif);
        localStorage.setItem('notifications', JSON.stringify(list));
    }

    resolveGroupInquiry(id: string, approved: boolean): { success: boolean, message: string } {
        const list = this.getNotifications();
        const index = list.findIndex(n => n.id === id);
        if (index === -1) return { success: false, message: 'Notificación no encontrada' };

        list[index].read = true;
        localStorage.setItem('notifications', JSON.stringify(list));

        // Here we would typically add the member to the group if approved
        // This is handled by Supabase in the real flow now, but locally we just mark read.
        return { success: true, message: approved ? 'Solicitud aprobada' : 'Solicitud rechazada' };
    }

    // --- LEADER APPLICATIONS (MOCKED LOCAL) ---
    getLeaderApplications(): LeaderApplication[] {
        return JSON.parse(localStorage.getItem('leader_applications') || '[]');
    }

    saveLeaderApplication(data: Partial<LeaderApplication>) {
        const apps = this.getLeaderApplications();
        const newApp: LeaderApplication = {
            id: safeUUID(),
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || '',
            phone: data.phone || '',
            completedLeaderCourse: !!data.completedLeaderCourse,
            completedHicisteCrecer: !!data.completedHicisteCrecer,
            completedVolunteerTraining: !!data.completedVolunteerTraining,
            attendsOrigen: !!data.attendsOrigen,
            applicantId: data.applicantId || '',
            status: 'PENDING',
            createdAt: new Date().toISOString()
        };
        apps.unshift(newApp);
        localStorage.setItem('leader_applications', JSON.stringify(apps));
    }

    updateApplicationStatus(id: string, newStatus: 'APPROVED' | 'REJECTED', applicantUserId?: string) {
        const apps = this.getLeaderApplications();
        const index = apps.findIndex(a => a.id === id);
        if (index === -1) return;

        apps[index].status = newStatus;
        localStorage.setItem('leader_applications', JSON.stringify(apps));

        // Create System Notification
        const notif: SystemNotification = {
            id: safeUUID(),
            title: `Postulación a Anfitrión: ${newStatus === 'APPROVED' ? 'Aprobada' : 'Rechazada'}`,
            message: newStatus === 'APPROVED'
                ? `Felicidades, ${apps[index].firstName}. Tu postulación ha sido aprobada. Un administrador te contactará para los siguientes pasos.`
                : `Hola ${apps[index].firstName}, tu postulación ha sido revisada. Por el momento no ha sido aprobada.`,
            timestamp: new Date().toISOString(),
            read: false,
            targetRoles: [UserRole.VIEWER, UserRole.ANFITRION], // Generic target, in real app we target ID
            type: 'SYSTEM'
        };

        // Hack: Store notification
        const notifications = this.getNotifications();
        notifications.unshift(notif);
        localStorage.setItem('notifications', JSON.stringify(notifications));
    }

    // --- GROUPS HELPERS (Local Persisted) ---

    getCategories(): GroupCategory[] {
        const stored = localStorage.getItem('group_categories');
        if (stored) return JSON.parse(stored);

        // Default Categories
        const defaults = [
            { id: 'Jóvenes', name: 'Jóvenes', color: '#3b82f6' }, // blue-500
            { id: 'Matrimonios', name: 'Matrimonios', color: '#ec4899' }, // pink-500
            { id: 'General', name: 'General', color: '#22c55e' }, // green-500
            { id: 'Hombres', name: 'Hombres', color: '#64748b' }, // slate-500
            { id: 'Mujeres', name: 'Mujeres', color: '#a855f7' } // purple-500
        ];
        localStorage.setItem('group_categories', JSON.stringify(defaults));
        return defaults;
    }

    saveCategories(categories: GroupCategory[]) {
        localStorage.setItem('group_categories', JSON.stringify(categories));
    }

    getTags(): GroupTag[] {
        const stored = localStorage.getItem('group_tags');
        if (stored) return JSON.parse(stored);

        // Default Tags
        const defaults = [
            { id: 'presencial', name: 'Presencial' },
            { id: 'online', name: 'Online' },
            { id: 'mixto', name: 'Híbrido' }
        ];
        localStorage.setItem('group_tags', JSON.stringify(defaults));
        return defaults;
    }

    saveTags(tags: GroupTag[]) {
        localStorage.setItem('group_tags', JSON.stringify(tags));
    }

    getGroups(): Group[] {
        return JSON.parse(localStorage.getItem('groups_local') || '[]');
    }

    getProducts(): Product[] {
        return [];
    }

    // --- ANNOUNCEMENTS ---
    getAnnouncements(): Announcement[] {
        return JSON.parse(localStorage.getItem('infopoint_announcements') || '[]');
    }

    saveAnnouncement(announcement: Announcement): void {
        const list = this.getAnnouncements();
        const index = list.findIndex(a => a.id === announcement.id);
        if (index >= 0) {
            list[index] = announcement;
        } else {
            list.unshift(announcement);
        }
        localStorage.setItem('infopoint_announcements', JSON.stringify(list));
    }

    deleteAnnouncement(id: string): void {
        const list = this.getAnnouncements().filter(a => a.id !== id);
        localStorage.setItem('infopoint_announcements', JSON.stringify(list));
    }
}

export const db = new DBService();