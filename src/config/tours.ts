import { Step } from 'react-joyride';

export const tourStyles = {
    options: {
        arrowColor: '#fff',
        backgroundColor: '#fff',
        overlayColor: 'rgba(0, 0, 0, 0.5)',
        primaryColor: '#6366f1', // Indigo 500
        textColor: '#333',
        width: 400,
        zIndex: 10000,
    },
    tooltip: {
        borderRadius: '12px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        padding: '20px',
    },
    buttonNext: {
        backgroundColor: '#4f46e5', // Indigo 600
        borderRadius: '8px',
        color: '#fff',
        fontSize: '14px',
        fontWeight: 600,
        padding: '10px 20px',
        outline: 'none',
    },
    buttonBack: {
        color: '#6b7280', // Gray 500
        fontSize: '14px',
        marginRight: '10px',
        outline: 'none',
    },
    buttonSkip: {
        color: '#9ca3af', // Gray 400
        fontSize: '14px',
        outline: 'none',
    },
};

// 1. AuthScreen Tour
export const authSteps: Step[] = [
    {
        target: '#auth-form',
        content: 'Aquí puedes crear tu cuenta usando tu correo y contraseña. Si ya tienes una, simplemente inicia sesión.',
        disableBeacon: true,
    },
    {
        target: '#google-login-btn',
        content: '¿Prefieres algo más rápido? Usa tu cuenta de Google para acceder en un solo clic.',
    },
];

// 2. Dashboard Tour
export const dashboardSteps: Step[] = [
    {
        target: '#hamburger-menu-btn',
        content: 'Este es tu menú principal. Desde aquí puedes navegar rápidamente a cualquier parte de la aplicación.',
    },
    {
        target: '#dashboard-hero',
        content: 'Bienvenido a tu panel principal. Aquí encontrarás notificaciones importantes y accesos directos.',
    },
    {
        target: '#systems-grid',
        content: 'Estos son los módulos del sistema. Cada tarjeta te lleva a una herramienta diferente: Grupos, Info Point, Reportes, etc.',
        placement: 'top',
    },
];

// 3. Groups Explorer Tour
export const groupsSteps: Step[] = [
    {
        target: '#groups-search-bar',
        content: 'Usa este buscador para encontrar grupos por nombre, barrio o líder.',
    },
    {
        target: '#groups-filter-bar',
        content: 'Filtra los resultados por categoría, día de reunión o tipo de grupo para encontrar el ideal para ti.',
    },
    {
        target: '#leader-postulation-card',
        content: '¿Quieres liderar tu propio grupo? Haz clic aquí para postularte como anfitrión.',
    },
    {
        target: '#first-group-card', // We will need to add this class to the first card dynamically or ensure one exists
        content: 'Aquí verás la información clave del grupo: día, hora, ubicación y si es exclusivo para un género o parejas.',
        placement: 'top', // Force top placement to point AT the card below
    },
];

// 4. Host Panel Tour
export const hostSteps: Step[] = [
    {
        target: '#host-dashboard-header',
        content: 'Bienvenido a tu Panel de Anfitrión. Aquí podrás gestionar todos tus Grupos de Conexión.',
        disableBeacon: true,
    },
    {
        target: '#btn-create-group',
        content: 'Desde aquí puedes crear un nuevo grupo. Podrás definir fecha, hora y ubicación.',
    },
    {
        target: '#host-group-card-0',
        content: 'Aquí verás tus grupos activos. Cada tarjeta muestra la información clave como miembros, horarios y estado.',
        placement: 'bottom',
    },
    {
        target: '#btn-host-actions-0', // Target the main action button (Settings/Mobile or Row/Desktop)
        content: 'Usa este botón para acceder a las herramientas de gestión de tu grupo.',
    },
    {
        target: '#btn-host-attendance-0',
        content: 'Fundamental: Aquí podrás tomar lista en cada reunión. Es vital para el seguimiento pastoral.',
    },
    {
        target: '#btn-host-applicants-0',
        content: 'Gestiona las solicitudes de personas que quieren unirse a tu grupo.',
    },
];

// 5. Create Group Modal Tour
export const createGroupSteps: Step[] = [
    {
        target: '#group-name-section',
        content: 'Asigna un nombre único y representativo para tu Grupo de Conexión.',
        disableBeacon: true,
        placement: 'bottom',
        spotlightPadding: 2,
    },
    {
        target: '#group-category-section',
        content: 'Selecciona la categoría que mejor describa el enfoque de tu grupo (ej. Jóvenes, Matrimonios, etc.).',
        placement: 'bottom',
        spotlightPadding: 2,
    },
    {
        target: '#group-location-section',
        content: 'Indica el barrio o la ubicación aproximada donde se reunirán.',
        placement: 'bottom',
        spotlightPadding: 2,
    },
    {
        target: '#group-schedule-section',
        content: 'Define el día y la hora de reunión habitual.',
        placement: 'top', // Switch to top to avoid covering lower elements
        spotlightPadding: 2,
    },
    {
        target: '#group-duration-toggle',
        content: 'Puedes elegir entre seguir las temporadas oficiales de la iglesia o definir fechas manualmente.',
        placement: 'top',
        spotlightPadding: 2,
    },
    {
        target: '#group-image-section',
        content: 'Sube una foto de portada o utiliza nuestra IA para generar una imagen única basada en tu descripción.',
        placement: 'top',
        spotlightPadding: 2,
    },
];

// 6. Welcome / Reception Tour
export const welcomeSteps: Step[] = [
    {
        target: '#btn-new-visitor',
        content: 'Registra aquí a cada persona que llega por primera vez. Es vital para el seguimiento.',
    },
    {
        target: '#visitor-stages-menu',
        content: 'Navega entre las diferentes etapas de integración, desde nuevos visitantes hasta voluntarios.',
    },
    {
        target: '#visitors-grid',
        content: 'Aquí aparecerán las tarjetas de las personas en la etapa seleccionada. Podrás ver sus datos y moverlos de etapa.',
        placement: 'top',
    },
];

// 7. Info Point Tour
export const infoPointSteps: Step[] = [
    {
        target: 'body',
        content: 'Bienvenido al Panel de Voluntarios. Esta es tu herramienta central para gestionar el área de Info Point.',
        placement: 'center',
    },
    {
        target: '#stats-grid, #mobile-menu-item-SUMMARY', // Visible on Desktop Dashboard OR Mobile Menu
        content: 'Aquí verás un resumen en tiempo real del stock crítico, eventos activos y sacramentos pendientes.',
        placement: 'bottom',
    },
    {
        target: '#sidebar-item-INVENTORY, #mobile-menu-item-INVENTORY',
        content: 'Inventario: Consulta y gestiona el stock de remeras, buzos y otros artículos.',
    },
    {
        target: '#sidebar-item-MOVEMENTS, #mobile-menu-item-MOVEMENTS',
        content: 'Movimientos: Registra cada entrada o salida de stock para mantener el inventario actualizado.',
    },
    {
        target: '#sidebar-item-LOANS, #mobile-menu-item-LOANS',
        content: 'Préstamos: Administra la ropa prestada a servidores y su devolución.',
    },
    {
        target: '#sidebar-item-SEARCH, #mobile-menu-item-SEARCH',
        content: 'Buscador: Localiza rápidamente cualquier producto por nombre, talle o tipo.',
    },
    {
        target: '#sidebar-item-EVENTS, #mobile-menu-item-EVENTS',
        content: 'Eventos: Consulta los próximos eventos y gestiona las necesidades del área.',
    },
    {
        target: '#sidebar-item-BAPTISMS, #mobile-menu-item-BAPTISMS',
        content: 'Sacramentos: Registra nuevos bautismos y presentaciones de niños.',
    },
    {
        target: '#reports-btn, #mobile-menu-item-REPORTES',
        content: 'Reportes: Accede a estadísticas detalladas para los líderes de área.',
    },
];

export const TOUR_IDS = {
    AUTH: 'auth',
    DASHBOARD: 'dashboard',
    GROUPS: 'groups',
    HOST: 'host',
    CREATE_GROUP: 'createGroup',
    WELCOME: 'welcome',
    INFOPOINT: 'infopoint',
};
export const tours = {
    auth: authSteps,
    dashboard: dashboardSteps,
    groups: groupsSteps,
    host: hostSteps,
    createGroup: createGroupSteps,
    welcome: welcomeSteps,
    infopoint: infoPointSteps
};
