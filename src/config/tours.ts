import { Step } from 'react-joyride';

export const tourStyles = {
    options: {
        arrowColor: '#fff',
        backgroundColor: '#fff',
        overlayColor: 'rgba(0, 0, 0, 0)', // TRANSPARENT OVERLAY (Highlighter Mode)
        primaryColor: '#000', // Black
        textColor: '#333',
        width: 400,
        zIndex: 10000,
    },
    tooltip: {
        borderRadius: '12px',
        border: '3px solid #000000',
        boxShadow: '6px 6px 0px 0px rgba(0,0,0,1)',
        padding: '20px',
        backgroundColor: '#ffffff',
    },
    tooltipContainer: {
        textAlign: 'left',
    },
    tooltipTitle: {
        fontWeight: 900,
        fontSize: '18px',
        textTransform: 'uppercase',
        color: '#000000',
        marginBottom: '10px',
        fontFamily: 'inherit', // Inherit system font (Proxima Nova)
    },
    tooltipContent: {
        fontWeight: 500,
        fontSize: '15px',
        color: '#333333',
        fontFamily: 'inherit',
    },
    buttonNext: {
        backgroundColor: '#000000',
        borderRadius: '8px',
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: 'bold',
        padding: '10px 20px',
        outline: 'none',
        border: 'none',
    },
    buttonBack: {
        color: '#000000',
        fontSize: '14px',
        fontWeight: 'bold',
        marginRight: '10px',
        outline: 'none',
        backgroundColor: 'transparent',
    },
    buttonSkip: {
        color: '#000000',
        fontSize: '14px',
        fontWeight: 'bold',
        outline: 'none',
        backgroundColor: 'transparent',
    },
    spotlight: {
        backgroundColor: 'rgba(250, 204, 21, 0.2)', // Yellow-400 with 20% opacity
        border: '4px solid #facc15', // Yellow-400 Solid
        borderRadius: '8px',
        boxShadow: '6px 6px 0px 0px rgba(0,0,0,1)', // Hard Black Shadow
    },
};

// 1. AuthScreen Tour
export const authSteps: Step[] = [
    {
        target: '#auth-form',
        content: 'Acá podés crear tu cuenta usando tu correo y contraseña. Si ya tenés una, simplemente iniciá sesión.',
        disableBeacon: true,
        placement: 'right',
    },
    {
        target: '#google-login-btn',
        content: '¿Preferís algo más rápido? Usá tu cuenta de Google para acceder en un solo clic.',
        placement: 'bottom',
    },
];

// 2. Dashboard Tour
export const dashboardSteps: Step[] = [
    {
        target: '#hamburger-menu-btn',
        content: 'Este es tu menú principal. Desde acá podés navegar rápidamente a cualquier parte de la aplicación.',
        placement: 'bottom-start',
    },
    {
        target: '#dashboard-hero',
        content: 'Bienvenido a tu panel principal. Acá vas a encontrar notificaciones importantes y accesos directos.',
        placement: 'bottom',
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
        content: 'Usá este buscador para encontrar grupos por nombre, barrio o líder.',
        placement: 'bottom',
    },
    {
        target: '#groups-filter-bar',
        content: 'Filtrá los resultados por categoría, día de reunión o tipo de grupo para encontrar el ideal para vos.',
        placement: 'bottom',
    },
    {
        target: '#leader-postulation-card',
        content: '¿Querés liderar tu propio grupo? Hacé clic acá para postularte como anfitrión.',
        placement: 'bottom',
    },
    {
        target: '#first-group-card', // We will need to add this class to the first card dynamically or ensure one exists
        content: 'Acá vas a ver la información clave del grupo: día, hora, ubicación y si es exclusivo para un género o parejas.',
        placement: 'top', // Force top placement to point AT the card below
    },
];

// 4. Host Panel Tour
export const hostSteps: Step[] = [
    {
        target: '#host-dashboard-header',
        content: 'Bienvenido a tu Panel de Anfitrión. Acá vas a poder gestionar todos tus Grupos de Conexión.',
        disableBeacon: true,
        placement: 'bottom',
    },
    {
        target: '#btn-create-group',
        content: 'Desde acá podés crear un nuevo grupo. Vas a poder definir fecha, hora y ubicación.',
        placement: 'bottom',
    },
    {
        target: '#host-group-card-0',
        content: 'Acá vas a ver tus grupos activos. Cada tarjeta muestra la información clave como miembros, horarios y estado.',
        placement: 'top',
    },
    {
        target: '#btn-host-actions-0', // Ahora es el botón "Ver Grupo" — lleva a la página de detalle con todas las herramientas de gestión.
        content: 'Tocá acá para ver el detalle de tu grupo: asistencia, solicitudes, integrantes y más.',
        placement: 'left',
    },
];

// 5. Create Group Modal Tour
export const createGroupSteps: Step[] = [
    {
        target: '#tour-group-name',
        content: 'Asigná un nombre único y representativo para tu Grupo de Conexión.',
        disableBeacon: true,
        placement: 'bottom',
        spotlightPadding: 10,
        disableScrollParentFix: true,
        disableScrolling: true,
        floaterProps: { disableAnimation: true, preventFlip: true } as any
    },
    {
        target: '#tour-group-category',
        content: 'Seleccioná la categoría que mejor describa el enfoque de tu grupo (ej. Jóvenes, Matrimonios, etc.).',
        placement: 'bottom',
        spotlightPadding: 10,
        disableScrollParentFix: true,
        disableScrolling: true,
        floaterProps: { disableAnimation: true, preventFlip: true } as any
    },
    {
        target: '#tour-group-location',
        content: 'Indicá el barrio o la ubicación aproximada donde se van a reunir.',
        placement: 'bottom',
        spotlightPadding: 10,
        disableScrollParentFix: true,
        disableScrolling: true,
        floaterProps: { disableAnimation: true, preventFlip: true } as any
    },
    {
        target: '#tour-group-schedule',
        content: 'Definí el día y la hora de reunión habitual.',
        placement: 'top', // Switch to top to avoid covering lower elements
        spotlightPadding: 10,
        disableScrollParentFix: true,
        disableScrolling: true,
        floaterProps: { disableAnimation: true, preventFlip: true } as any
    },
    {
        target: '#tour-group-duration',
        content: 'Podés elegir entre seguir las temporadas oficiales de la iglesia o definir fechas manualmente.',
        placement: 'top',
        spotlightPadding: 10,
        disableScrollParentFix: true,
        disableScrolling: true,
        floaterProps: { disableAnimation: true, preventFlip: true } as any
    },
    {
        target: '#tour-group-image',
        content: 'Subí una foto de portada o utilizá nuestra IA para generar una imagen única basada en tu descripción.',
        placement: 'top',
        spotlightPadding: 10,
        disableScrollParentFix: true,
        disableScrolling: true,
        floaterProps: { disableAnimation: true, preventFlip: true } as any
    },
];

// 6. Welcome / Reception Tour
export const welcomeSteps: Step[] = [
    {
        target: '#btn-new-visitor',
        content: 'Registrá acá a cada persona que llega por primera vez. Es vital para el seguimiento.',
    },
    {
        target: '#visitor-stages-menu',
        content: 'Navegá entre las diferentes etapas de integración, desde nuevos visitantes hasta voluntarios.',
    },
    {
        target: '#visitors-grid',
        content: 'Acá van a aparecer las tarjetas de las personas en la etapa seleccionada. Vas a poder ver sus datos y moverlos de etapa.',
        placement: 'top',
    },
];

export const TOUR_IDS = {
    AUTH: 'auth',
    DASHBOARD: 'dashboard',
    GROUPS: 'groups',
    HOST: 'host',
    CREATE_GROUP: 'createGroup',
    WELCOME: 'welcome',
};

export const tours = {
    auth: authSteps,
    dashboard: dashboardSteps,
    groups: groupsSteps,
    host: hostSteps,
    createGroup: createGroupSteps,
    welcome: welcomeSteps,
};
