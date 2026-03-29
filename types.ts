

export enum UserRole {
    SUPER_ADMIN = 'SUPER_ADMIN',
    ADMIN_PUNTO = 'ADMIN_PUNTO',
    ADMIN_GROUPS = 'ADMIN_GROUPS',
    ADMIN_STORE = 'ADMIN_STORE',
    ADMIN_ALABANZA = 'ADMIN_ALABANZA',
    PASTOR = 'PASTOR',
    ANFITRION = 'ANFITRION',
    CO_ANFITRION = 'CO_ANFITRION',
    VOLUNTEER = 'VOLUNTEER',
    VIEWER = 'VIEWER',

    // --- NEW GRANULAR ROLES ---
    USUARIO = 'USUARIO', // Basic User
    VOLUNTARIO = 'VOLUNTARIO', // Generic Volunteer
    VOLUNTARIO_GRUPOS = 'VOLUNTARIO_GRUPOS',
    VOLUNTARIO_INFO = 'VOLUNTARIO_INFO',
    ENCARGADO_PUNTO = 'ENCARGADO_PUNTO',
    ENCARGADO_GRUPOS = 'ENCARGADO_GRUPOS',
    ENCARGADO_STORE = 'ENCARGADO_STORE',
    ENCARGADO_ALABANZA = 'ENCARGADO_ALABANZA',
    REPORTES = 'REPORTES',
    ENCARGADO_BIENVENIDA = 'ENCARGADO_BIENVENIDA',
    VOLUNTARIO_BIENVENIDA = 'VOLUNTARIO_BIENVENIDA',
    ADMIN_CUIDADO_PASTORAL = 'ADMIN_CUIDADO_PASTORAL', // NEW ROLE for Pastoral Care
    COORDINATOR = 'COORDINATOR'
}

export enum CoordinatorVariant {
    FINANZAS = 'FINANZAS',
    PAREJAS = 'PAREJAS',
    CENTRO_TRANSFORMACION = 'CENTRO_TRANSFORMACION',
    TERCERA_EDAD = 'TERCERA_EDAD',
    BIBLIA = 'BIBLIA',
    INUSUAL = 'INUSUAL',
    PRE_ADOLESCENTES = 'PRE_ADOLESCENTES',
    ADOLESCENTES = 'ADOLESCENTES',
    FAMILIA = 'FAMILIA',
    RELACIONAL = 'RELACIONAL',
    VOLUNTARIOS = 'VOLUNTARIOS',
    NINEZ = 'NINEZ',
    JOVENES_26_35 = 'JOVENES_26_35',
    MUJERES = 'MUJERES',
    ORIGEN_SOCIAL = 'ORIGEN_SOCIAL',
    HOMBRES = 'HOMBRES',
    JOVENES_18_25 = 'JOVENES_18_25'
}

export const COORDINATOR_VARIANT_TO_CATEGORY: Record<CoordinatorVariant, string> = {
    [CoordinatorVariant.FINANZAS]: 'Finanzas',
    [CoordinatorVariant.PAREJAS]: 'Parejas',
    [CoordinatorVariant.CENTRO_TRANSFORMACION]: 'Centro de transformación',
    [CoordinatorVariant.TERCERA_EDAD]: 'Tercera edad',
    [CoordinatorVariant.BIBLIA]: 'Biblia',
    [CoordinatorVariant.INUSUAL]: 'Inusual',
    [CoordinatorVariant.PRE_ADOLESCENTES]: 'Pre - Adolescentes',
    [CoordinatorVariant.ADOLESCENTES]: 'Adolescentes',
    [CoordinatorVariant.FAMILIA]: 'Familia',
    [CoordinatorVariant.RELACIONAL]: 'Relacional',
    [CoordinatorVariant.VOLUNTARIOS]: 'Voluntarios',
    [CoordinatorVariant.NINEZ]: 'Niñez',
    [CoordinatorVariant.JOVENES_26_35]: 'Jovenes 26 a 35 años',
    [CoordinatorVariant.MUJERES]: 'Mujeres',
    [CoordinatorVariant.ORIGEN_SOCIAL]: 'Origen Social',
    [CoordinatorVariant.HOMBRES]: 'Hombres',
    [CoordinatorVariant.JOVENES_18_25]: 'Jovenes 18 a 25 años'
}

export function coordinatorVariantToCategory(variant: CoordinatorVariant | undefined): string | undefined {
    if (!variant) return undefined;
    return COORDINATOR_VARIANT_TO_CATEGORY[variant];
}

export enum ImageAspectRatio {
    SQUARE_1_1 = "1:1",
    PORTRAIT_3_4 = "3:4",
    LANDSCAPE_16_9 = "16:9"
}

// Add global declaration for aistudio to prevent TS errors.
declare global {
    interface AIStudio {
        hasSelectedApiKey: () => Promise<boolean>;
        openSelectKey: () => Promise<void>;
    }

    interface Window {
        aistudio?: AIStudio;
    }
}

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole; // Legacy single role - kept for backward compatibility
    roles: UserRole[]; // NEW: Array of roles for multi-role support
    isActive: boolean;
    linkedGroupId?: string; // ID of the group this leader manages OR system ID ('PUNTO', 'STORE', 'GROUPS')
    volunteerRoles?: string[]; // Array of system IDs ('PUNTO', 'STORE', 'GROUPS') for additional access
    isSystemVolunteer?: boolean; // Legacy flag
    phone?: string; // Phone number from Auth Metadata
    age?: number; // From public.users (calculated from birthDate)
    gender?: string; // From public.users
    birthDate?: string; // Exact date of birth (YYYY-MM-DD format)
    assignedCategory?: string; // Category ID for COORDINATOR role filtering
    coordinatorVariant?: CoordinatorVariant; // Specific department for coordinators
    tutorial_progress?: Record<string, boolean>; // Tracks onboarding tour progress
}

// --- LEADER APPLICATION TYPES ---
export interface LeaderApplication {
    id: string; // UUID
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    completedLeaderCourse: boolean; // ¿Realizaste el curso de Líder?
    completedHicisteCrecer: boolean; // ¿Hiciste crecer?
    completedVolunteerTraining: boolean; // ¿Hiciste entrenamiento de voluntarios?
    attendsOrigen: boolean; // ¿Asistís a Origen?
    applicantId?: string; // ID del usuario autenticado (si lo hay)
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: string;
}

// --- ALABANZA SYSTEM TYPES ---

export interface AlabanzaCategory {
    id: string;
    name: string;
    color?: string; // Hex or tailwind class
}

export interface AlabanzaArtist {
    id: string;
    name: string;
    imageUrl?: string;
}

export interface Song {
    id: string;
    title: string;
    artist: string;
    coverUrl: string;
    category: string; // Now dynamic string, previously limited union type
    audioFile: string; // Base64 encoded audio
    youtubeLink?: string; // New: YouTube URL
    youtubeId?: string; // New: Extracted ID for embedding
    addedAt: string;
}

export interface PlaybackRecord {
    id: string;
    songId: string;
    songTitle: string;
    artist: string;
    category: string;
    timestamp: string; // ISO String
}

export interface AlabanzaApplication {
    id: string;
    timestamp: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    questionnaire: {
        attendsChurch: boolean;
        didCrecer: boolean;
        didTraining: boolean;
    };
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

export interface AlabanzaConfig {
    banners: BannerSlide[];
    applicationsEnabled: boolean; // Controls the visibility of the "Postulación" button
}

// --- INFO POINT SYSTEM TYPES ---

export enum ProductType {
    REMERA = 'Remeras',
    BUZO = 'Buzos'
}

export const INFO_POINT_SIZES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export interface InfoPointProduct {
    code: string; // Internal ID (Type-Size combo)
    name: string; // Auto-generated display name
    type: ProductType;
    size: string;
    price: number;
    stock: number;
    minStock: number;
}

export enum MovementType {
    IN = 'Entrada',
    OUT = 'Salida',
    ADJUST = 'Ajuste'
}

export interface Movement {
    id: string;
    productCode: string; // Links to Type-Size
    productName: string;
    type: MovementType;
    quantity: number;
    date: string; // ISO String
    paymentMethod?: 'Efectivo' | 'Mercado Pago'; // Payment method for OUT movements
    // Notes removed as per request
}

export enum PendingStatus {
    PENDING = 'Pendiente',
    COMPLETED = 'Realizado',
    CANCELLED = 'Cancelado'
}

export interface Baptism {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    registrationDate: string; // Fecha que se anotó
    completionDate?: string; // Fecha en que se realizó
    isPending: number; // 1 pending, 0 completed/cancelled
    status: PendingStatus;
}

export interface ChildPresentation {
    id: string;
    childName: string;
    childSurname: string;
    motherName: string;
    motherSurname: string;
    fatherName: string;
    fatherSurname: string;
    email: string;
    phone: string;
    scheduledDate: string;
    completionDate?: string;
    isPending: number;
    status: PendingStatus;
}

export interface Loan {
    id: string;
    lenderName: string;
    lenderSurname: string;
    itemType: ProductType;
    itemSize: string;
    loanDate: string;
    returnDate?: string; // Fecha y hora devolución
    status: 'ACTIVE' | 'RETURNED';
}

// --- CALENDAR TYPES ---

export enum EventType {
    CULTO = 'Culto',
    AYUNO = 'Ayuno',
    RETIRO = 'Retiro',
    CONFERENCIA = 'Conferencia',
    ORACION = 'Reunión de Oración',
    ESTUDIO = 'Estudio Bíblico',
    SERVICIO = 'Servicio Comunitario',
    SOCIAL = 'Evento Social',
    OTRO = 'Otro'
}

export interface AppEvent {
    id: string;
    name: string;
    description?: string; // New Description field
    date: string;
    link?: string; // New Link field
    qrCodeUrl: string;
    createdAt: string;
    startTime?: string;
    endTime?: string;
    type?: EventType;
    color?: string;
}

export interface Announcement {
    id: string;
    title: string;
    description: string;
    startDate: string; // ISO Date (YYYY-MM-DD)
    endDate: string;   // ISO Date (YYYY-MM-DD)
    createdAt: string; // ISO Timestamp
    isActive?: boolean; // Manual override
    isPermanent?: boolean; // NEW: Permanent mode
    link?: string; // Links for announcements
    qrCodeUrl?: string; // Generated qr code url
}

export interface AppSettings {
    id?: string;
    appName: string;
    appSubtitle: string;
    primaryColor: string;
    inventoryAlertThreshold: number;
}

export type ViewState =
    | 'PANEL'
    | 'NEW_PRODUCT'
    | 'MOVEMENTS'
    | 'INVENTORY'
    | 'BAPTISMS'
    | 'PRESENTATIONS'
    | 'LOANS'
    | 'EVENTS'
    | 'SEARCH'
    | 'SUMMARY'
    | 'WELCOME'
    | 'REPORTES'
    | 'ADMIN_PANEL'
    | 'ANNOUNCEMENTS';


// --- END INFO POINT TYPES ---

// Maintain existing types for compatibility with Outer App
export interface Product {
    id: string;
    name: string;
    sku: string;
    category: string;
    stock: number;
    status: 'En Stock' | 'Stock Bajo' | 'Sin Stock';
    description?: string;
}

// --- STORE SYSTEM INTERFACES (UPDATED) ---

export type ClothingSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'Único';

export interface ProductSizeInfo {
    active: boolean;
    stock: number;
}

export interface StoreBanner {
    id: string;
    subtitle: string; // e.g. "Nueva Colección"
    titlePrefix: string; // e.g. "ESTILO QUE"
    titleHighlight: string; // e.g. "INSPIRA."
    description: string;
    buttonText: string;
    imageUrl?: string;
    gradientClass: string; // e.g. "bg-gradient-to-r from-..."
    linkEventId?: string; // Optional: filter by event when clicked
}

export interface StoreCheckoutConfig {
    titles: {
        billing: string;
        summary: string;
        payment: string;
    };
    paymentMethods: {
        transfer: {
            enabled: boolean;
            label: string;
            details: { bank: string; cbu: string; alias: string };
        };
        cash: {
            enabled: boolean;
            label: string;
            message: string;
            // No details needed for cash, maybe instructions
        };
        mercadopago: {
            enabled: boolean;
            label: string;
            link: string;
        }
    }
}

export interface StoreConfig {
    qrCodeUrl?: string;
    transferDetails?: string; // Legacy
    banners?: StoreBanner[];
    checkout?: StoreCheckoutConfig; // New Config Object
    bannerTransitionDelay?: number;
    categories?: string[]; // Admin manageable categories
    tags?: string[]; // Admin manageable tags
}

export interface StoreEvent {
    id: string;
    name: string; // e.g., "Verano 2024", "Navidad"
    description?: string;
    startDate: string;
    endDate?: string;
    active: boolean;
    color: string; // Tailwind class or hex
}

export interface StoreProduct {
    id: string;
    sku: string;
    name: string;
    price: number;
    category: string;
    image: string; // Emoji or URL
    description: string;
    // Inventory Management
    sizes: Record<ClothingSize, ProductSizeInfo>; // Map size to status & stock
    totalStock: number; // Computed total
    // Classification
    eventIds: string[]; // Belongs to which events/seasons
    tags?: string[];
    // Details
    material?: string;
    color?: string;
}

export interface StoreCartItem extends StoreProduct {
    quantity: number;
    selectedSize: ClothingSize;
}

export interface PaymentDetails {
    method: 'credit_card' | 'debit_card' | 'transfer' | 'mercadopago' | 'cash';
    cardHolder?: string;
    cardNumber?: string; // Last 4 digits for storage usually, but full for mock
    expiry?: string;
    cvv?: string;
    transferRef?: string; // Upload or code
    address?: string; // For cash/delivery
}

export interface StoreCustomer {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    zip: string;
}

export interface StoreOrder {
    id: string;
    date: string;
    status: 'Procesando' | 'Pagado' | 'Enviado' | 'Entregado' | 'Cancelado';
    items: StoreCartItem[];
    total: number;
    customer: StoreCustomer;
    payment: PaymentDetails;
}
// -------------------------------

export interface GroupRegistration {
    id: string;
    firstName: string;
    lastName: string;
    dni?: string; // Optional now
    phone: string;
    email: string;
    timestamp: string;
    groupId?: string;
    userId?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt?: string; // Added for CoordinatorDashboard
    // Couples registration: partner data stored in same row
    partnerData?: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
    };
    // Partner's user ID if they have an account in the system
    partnerUserId?: string;
}

export interface DropoutRequest {
    id: string;
    groupId: string;
    hostId: string;
    requestType: 'USER' | 'GROUP' | 'SELF_DROPOUT';
    targetUserId?: string;
    targetRegistrationId?: string;  // Registration ID for user dropouts
    reason: string;
    details?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: string;
    // Joined fields for display
    groupName?: string;
    hostName?: string;
    targetUserName?: string;
}

// New Interfaces for Filters
export interface GroupCategory {
    id: string;
    name: string;
    color: string; // Tailwind color class or hex
}

export interface GroupTag {
    id: string;
    name: string;
    color?: string; // e.g. 'bg-blue-100 text-blue-800'
}

export interface Group {
    id: string;
    name: string;
    status?: 'pending' | 'approved' | 'rejected' | 'finished'; // Approval workflow status
    leaderName: string;
    leaderSurname: string;
    leaderPhone?: string; // New field for Leader Phone
    meetingDay: string;
    meetingTime: string;
    startDate: string; // ISO Date string
    endDate?: string; // ISO Date string (optional)
    location: string;
    membersCount: number;
    maxCapacity: number;
    description?: string;
    imageUrl?: string;
    registrations: GroupRegistration[];
    // New fields for classification
    categoryId?: string;
    tags?: string[]; // Array of Tag IDs or Names
    host_id?: string; // ID of the Anfitrión who owns this group
    co_host_id?: string; // ID of the Co-Anfitrión (optional)

    // Advanced Fields
    coHostFirstName?: string;
    coHostLastName?: string;
    minAge?: number;
    maxAge?: number;
    targetGender?: 'Hombre' | 'Mujer' | 'Mixto';
    adminNote?: string; // Note from admin when approving/rejecting

    // UI/Display Helpers (Join results)
    hostName?: string;
    hostLastName?: string;
    categoryName?: string;
    meetingType?: string;
    maxMembers?: number; // Alias for maxCapacity if needed, or separate field
}

export interface InquiryMetadata {
    groupId: string;
    firstName: string;
    lastName: string;
    phone: string;
    note?: string;
}

// Notification types/categories
export type NotificationType = 'REGISTRATION' | 'SYSTEM' | 'INQUIRY' | 'GROUPS' | 'EVENTS' | 'ADMIN';

export interface SystemNotification {
    id: string;
    title: string;
    message: string; // Contains "Who" and "Which Group"
    details?: string; // Additional data like phone/email/notes
    timestamp: string;
    read: boolean;
    targetRoles: UserRole[]; // Who should see this
    type: NotificationType;
    metadata?: InquiryMetadata; // Structured data for actions
    category?: string; // Optional grouping label
}

// User notification preferences
export interface NotificationPreferences {
    categories: {
        SYSTEM: boolean;
        REGISTRATION: boolean;
        INQUIRY: boolean;
        GROUPS: boolean;
        EVENTS: boolean;
        ADMIN: boolean;
    };
    showUnreadOnly: boolean;
}

// Default notification preferences
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
    categories: {
        SYSTEM: true,
        REGISTRATION: true,
        INQUIRY: true,
        GROUPS: true,
        EVENTS: true,
        ADMIN: true,
    },
    showUnreadOnly: false,
};

export interface Log {
    id: string;
    userId: string;
    action: string;
    details: string;
    timestamp: string;
}

export interface AuditLog {
    id: string;
    table_name: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    record_id: string;
    old_data: any;
    new_data: any;
    changed_by: string;
    actor_name?: string; // Joined from users
    created_at: string;
}

export interface ModuleBackgroundConfig {
    type: 'default' | 'image' | 'color';
    value?: string; // Image URL (base64) or Color/Gradient CSS
    overlayOpacity: number; // 0.0 to 1.0
}

export interface SystemModule {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    icon: string;
    route: string;
    allowedRoles: UserRole[];
    publicAccess?: boolean; // New flag for modules that don't require login
    status?: 'active' | 'construction'; // New status field for Coming Soon states
    // Visual customization
    useImage: boolean;
    imageUrl?: string;
    gradientFrom: string;
    gradientTo: string;
    iconColor: string;
    background?: ModuleBackgroundConfig; // Per-module background
}

export interface BannerSlide {
    id: string;
    imageUrl: string;
    title?: string;           // New: Main headline
    subtitle?: string;        // New: Sub-headline
    titlePrefix?: string;     // Legacy
    titleHighlight?: string;  // Legacy
    description?: string;     // Legacy
    buttonText?: string;
    overlayColor?: string;
}

export interface BannerConfig {
    titlePrefix: string;
    titleHighlight: string;
    description: string;
    useCustomImage: boolean;
    imageUrl?: string; // Fallback/Single image
    slides?: BannerSlide[]; // New: Array of slides
    slideInterval?: number; // New: Time in ms
    gradientClass: string; // Tailwind gradient class if no image
}

export type BlurLevel = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface GroupsConfig {
    activeBlurLevel: BlurLevel;
    banners?: BannerSlide[]; // Ensures we have banners specifically for Groups module
}

export interface InfoPointConfig {
    banners?: BannerSlide[];
    heroCtaText?: string;  // CTA button text (only shows if both text and link are set)
    heroCtaLink?: string;  // CTA button link (opens in new tab)
}

export type DividerPreset = 'minimal' | 'gradient-dark' | 'gradient-brand' | 'glass';

export interface SystemsDividerConfig {
    useCustomImage: boolean;
    imageUrl?: string;
    preset: DividerPreset;
    title: string;
    subtitle: string;
}

// --- VALUES SECTION TYPES ---
export interface ValueItem {
    id: string;
    icon: string;
    title: string;
    description: string;
}

export interface ValuesSectionConfig {
    image: string;
    title: string;
    description: string;
    values: ValueItem[];
    buttonText: string;
    buttonLink: string;
}

export interface BiblicalVerse {
    text: string;
    ref: string;
}

// --- FOOTER LINKS ---
export interface FooterLinks {
    instagram: string;
    facebook: string;
    youtube: string;
    spotify: string;
}

export interface AppConfig {
    appName: string;
    appSlogan: string;
    brandColor: string;
    logoUrl?: string;
    themeMode: 'light' | 'dark';
    banner: BannerConfig; // New Banner Config
    groupsConfig: GroupsConfig; // New Groups Visual Config
    infoPointConfig?: InfoPointConfig; // New Info Point Config
    alabanzaConfig?: AlabanzaConfig; // New Alabanza Config
    storeConfig?: StoreConfig; // New Store Config
    systemsDividerConfig?: SystemsDividerConfig; // New Section Divider Config
    valuesSection?: ValuesSectionConfig; // New Values Section Config
    verses?: BiblicalVerse[]; // New: Array of verses
    footerLinks?: FooterLinks; // New Footer Links
}

// --- WELCOME SYSTEM TYPES ---

export type VisitorStage =
    | 'NEW'
    | 'FILLED_FORM'
    | 'SECOND_CONTACT'
    | 'THIRD_CONTACT'
    | 'INTERESTED_GROWTH'
    | 'DOING_GROWTH'
    | 'DOING_TRAINING'
    | 'VOLUNTEERS'
    | 'NO_RESPONSE';

export interface WelcomeVisitor {
    id: string;
    created_at: string;
    first_name: string;
    last_name: string;
    age?: number;
    phone?: string;
    stage: VisitorStage;

    // Detailed Form Fields
    is_first_time?: boolean;
    accepted_jesus?: string; // 'Si' | 'No, antes'
    referral_source?: string;
    experience_rating?: string;
    wants_growth?: string; // 'Si', 'No', 'Tal vez'
    interest_areas?: string[];
    prayer_request?: string;

    // New Fields from Public Form
    email?: string;
    experience_description?: string;
}

// --- PASTORAL CARE TYPES ---

export interface ServiceStatistic {
    id?: string;
    name?: string;           // Nombre (Opcional)
    service_date: string;    // Fecha del servicio (ISO Date, requerido)
    service_time?: 'AM' | 'PM'; // Horario del servicio

    // Categoría: Voluntarios
    conecta: number;
    store: number;
    host_prevencion: number;
    punto_info: number;
    produccion: number;
    equipo_ministracion: number;
    atmosfera: number;
    visuales: number;
    redes: number;
    sala_bienvenida: number;
    sonido: number;
    ea: number;
    streaming: number;
    camaras: number;
    fotos: number;
    profes_ninez: number;
    auditorio: number;

    // Categoría: Niñez
    ninos_3_6: number;
    ninos_7_10: number;
    ninos_hd: number;
    borders: number;

    // Categoría: Otros
    online: number;
    voluntarios_repetidos: number;
    aceptaron: number;
    asistieron_primera_vez: number;
    reconciliaron: number;
    podcast: number;
    oracion: number;

    // Categoría: Conferencias (Dynamic Sessions)
    conference_sessions?: { name: string; attendees: number; }[];

    // Nuevas columnas (2026-03-29)
    service_hour?: string;      // Hora y minutos del servicio (HH:MM)
    observations?: string;      // Observaciones libres
    category?: string;          // Categoría del servicio
    service_type?: string;      // Tipo de Servicio / Subcategoría
}