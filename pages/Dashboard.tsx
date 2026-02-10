import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, UserRole, SystemModule, AppConfig, FooterLinks } from '../types';
import SystemLoginModal from '../components/SystemLoginModal';
import { db } from '../services/dbService';
import { supabaseService } from '../services/supabaseService';
import { hasRole } from '../services/authUtils';
import {
    ArrowRight,
    Info,
    ShoppingCart,
    Users,
    Music,
    Settings,
    Construction,
    Lock,
    AlertTriangle,
    Instagram,
    Facebook,
    Youtube,
    Music as MusicIcon,
    HeartHandshake
} from 'lucide-react';
import HeroCarousel, { HeroSlideData } from '../components/HeroCarousel';

// Matter.js types (only used when physics is enabled)
type MatterEngine = any;
type MatterWorld = any;
type MatterRender = any;
type MatterBodies = any;
type MatterBody = any;
type MatterRunner = any;

interface DashboardProps {
    currentUser: User | null;
    onLoginRequest: (email: string, pass: string) => Promise<boolean>;
}

// Helper to generate UUID with fallback
const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// Neo-Brutalist Icon Component
const getModuleIcon = (id: string, defaultIcon: string, isConstruction?: boolean, isRestricted?: boolean) => {
    const iconClass = "w-8 h-8 md:w-10 md:h-10";

    if (isRestricted) return <Lock className={`${iconClass}`} />;
    if (isConstruction) return <Construction className={`${iconClass}`} />;

    switch (id) {
        case 'info-point': return <Info className={iconClass} />;
        case 'store': return <ShoppingCart className={iconClass} />;
        case 'groups': return <Users className={iconClass} />;
        case 'welcome-system': return <HeartHandshake className={iconClass} />;
        case 'alabanza': return <Music className={iconClass} />;
        case 'pastores': return <AlertTriangle className={iconClass} />;
        case 'admin': return <Settings className={iconClass} />;
        default: return <span className="text-3xl">{defaultIcon}</span>;
    }
};

// Animation Keyframes for Neo-Brutalist Effects
const animationStyles = `
    @keyframes slideUp {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes scaleIn {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
    }
    .animate-slideUp { animation: slideUp 0.5s ease-out forwards; }
    .animate-scaleIn { animation: scaleIn 0.4s ease-out forwards; }
    .stagger-1 { animation-delay: 0.05s; opacity: 0; }
    .stagger-2 { animation-delay: 0.1s; opacity: 0; }
    .stagger-3 { animation-delay: 0.15s; opacity: 0; }
    .stagger-4 { animation-delay: 0.2s; opacity: 0; }
    .stagger-5 { animation-delay: 0.25s; opacity: 0; }
    .stagger-6 { animation-delay: 0.3s; opacity: 0; }
`;

const Dashboard: React.FC<DashboardProps> = ({ currentUser, onLoginRequest }) => {
    const navigate = useNavigate();
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedSystem, setSelectedSystem] = useState<{ name: string, id: string, route: string } | null>(null);
    const [systems, setSystems] = useState<SystemModule[]>([]);
    const [config, setConfig] = useState<AppConfig>(db.getAppConfig());
    const [footerLinks, setFooterLinks] = useState<FooterLinks>({ instagram: '', facebook: '', youtube: '', spotify: '' });
    const [isLoaded, setIsLoaded] = useState(false);

    // ═══════════════════════════════════════════════════════════════════════════
    // PHYSICS ENGINE - SAFETY-FIRST, LAZY-LOAD ARCHITECTURE
    // ═══════════════════════════════════════════════════════════════════════════

    // State: Physics only enabled after auth + idle delay
    const [isPhysicsEnabled, setIsPhysicsEnabled] = useState(false);
    const [physicsError, setPhysicsError] = useState(false);

    // Refs: Avoid useState in physics loop (prevents re-renders that block network requests)
    const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const engineRef = useRef<MatterEngine | null>(null);
    const worldRef = useRef<MatterWorld | null>(null);
    const renderRef = useRef<MatterRender | null>(null);
    const runnerRef = useRef<MatterRunner | null>(null);
    const bodiesRef = useRef<Map<string, MatterBody>>(new Map());
    const containerRef = useRef<HTMLDivElement>(null);
    const physicsInitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fpsMonitorRef = useRef<number[]>([]);
    const lastFrameTimeRef = useRef<number>(Date.now());

    // Store card ref by system ID
    const setCardRef = useCallback((systemId: string, el: HTMLDivElement | null) => {
        if (el) {
            cardRefs.current.set(systemId, el);
        } else {
            cardRefs.current.delete(systemId);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            const loadedModules = db.getModules();

            // --- STRICT VISIBILITY FILTER ---
            // Only render cards that the user has explicit access to.
            const visibleModules = loadedModules.filter(m => {
                // 1. Module is Public -> Always Visible
                if (m.publicAccess) return true;

                // 2. Not Public -> Must be logged in
                if (!currentUser) return false;

                // 3. Super Admin -> See All
                if (hasRole(currentUser, UserRole.SUPER_ADMIN)) return true;

                // 4. Check Allowed Roles overlap
                // If user has ANY of the allowed roles for this module
                const userRoles = currentUser.roles || [currentUser.role]; // Fallback if roles array is missing
                const hasAccess = userRoles.some(r => m.allowedRoles.includes(r));

                return hasAccess;
            });

            // Sort modules: Ensure Admin is last
            const sortedModules = [
                ...visibleModules.filter(m => m.id !== 'admin'),
                ...visibleModules.filter(m => m.id === 'admin')
            ];

            setSystems(sortedModules);

            // Load Config
            const remoteConfig = await supabaseService.getAppConfig();
            const activeConfig = remoteConfig || db.getAppConfig();

            setConfig(activeConfig);
            setFooterLinks(activeConfig.footerLinks || { instagram: '', facebook: '', youtube: '', spotify: '' });
        };

        init();
        // Only set loaded on first mount/init
        if (!isLoaded) {
            setTimeout(() => setIsLoaded(true), 100);
        }
    }, [currentUser]); // FIX: Re-run when user changes (e.g. upgrades to Admin)

    // ═══════════════════════════════════════════════════════════════════════════
    // LAZY INITIALIZATION: Only enable physics AFTER user is confirmed + 3s idle
    // ═══════════════════════════════════════════════════════════════════════════
    // EMERGENCY FIX: Physics disabled to prevent dashboard crashes and timeouts
    useEffect(() => {
        // PHYSICS DISABLED - Early return to prevent any initialization
        return;

        // CRITICAL: Do NOT initialize physics until authenticated
        if (!currentUser) {
            setIsPhysicsEnabled(false);
            return;
        }

        // "Safe Start" Pattern: Wait 3 seconds after auth to ensure the app is idle
        physicsInitTimeoutRef.current = setTimeout(() => {
            console.log('[Physics] User authenticated and idle. Enabling physics...');
            setIsPhysicsEnabled(true);
        }, 3000);

        return () => {
            if (physicsInitTimeoutRef.current) {
                clearTimeout(physicsInitTimeoutRef.current);
            }
        };
    }, [currentUser]);

    // ═══════════════════════════════════════════════════════════════════════════
    // PHYSICS ENGINE INITIALIZATION (Only when isPhysicsEnabled is true)
    // ═══════════════════════════════════════════════════════════════════════════
    // EMERGENCY FIX: Physics engine completely disabled
    useEffect(() => {
        // PHYSICS DISABLED - Early return to prevent any Matter.js loading
        return;

        if (!isPhysicsEnabled || physicsError) return;

        let isMounted = true;

        const initPhysics = async () => {
            try {
                // Dynamic import of Matter.js (lazy load)
                const Matter = await import('matter-js');

                if (!isMounted) return;

                const { Engine, Render, World, Bodies, Body, Events, Runner } = Matter;

                // Create engine (off-screen, no visual rendering needed)
                const engine = Engine.create({
                    gravity: { x: 0, y: 0.5, scale: 0.001 }
                });

                engineRef.current = engine;
                worldRef.current = engine.world;

                // Create invisible render (we won't actually use the canvas for display)
                const render = Render.create({
                    element: document.body,
                    engine: engine,
                    options: {
                        width: 1,
                        height: 1,
                        wireframes: false,
                        background: 'transparent',
                    }
                });

                // Hide the Matter.js canvas (we use DOM transforms instead)
                if (render.canvas) {
                    render.canvas.style.display = 'none';
                }

                renderRef.current = render;

                // Create physics bodies for each card
                const containerBounds = containerRef.current?.getBoundingClientRect();
                if (!containerBounds) return;

                // Create ground and walls
                const ground = Bodies.rectangle(
                    containerBounds.width / 2,
                    containerBounds.height + 50,
                    containerBounds.width * 2,
                    100,
                    { isStatic: true }
                );

                const leftWall = Bodies.rectangle(
                    -50,
                    containerBounds.height / 2,
                    100,
                    containerBounds.height * 2,
                    { isStatic: true }
                );

                const rightWall = Bodies.rectangle(
                    containerBounds.width + 50,
                    containerBounds.height / 2,
                    100,
                    containerBounds.height * 2,
                    { isStatic: true }
                );

                World.add(engine.world, [ground, leftWall, rightWall]);

                // Create bodies for each card
                cardRefs.current.forEach((cardEl, systemId) => {
                    const rect = cardEl.getBoundingClientRect();
                    const containerRect = containerRef.current?.getBoundingClientRect();
                    if (!containerRect) return;

                    const x = rect.left - containerRect.left + rect.width / 2;
                    const y = rect.top - containerRect.top + rect.height / 2;

                    const body = Bodies.rectangle(x, y, rect.width, rect.height, {
                        restitution: 0.3,
                        friction: 0.1,
                        frictionAir: 0.02,
                        density: 0.001,
                        label: systemId
                    });

                    bodiesRef.current.set(systemId, body);
                    World.add(engine.world, body);
                });

                // Create runner
                const runner = Runner.create();
                runnerRef.current = runner;
                Runner.run(runner, engine);

                // FPS monitoring for fallback
                fpsMonitorRef.current = [];
                lastFrameTimeRef.current = Date.now();

                // OPTIMIZED LOOP: Use refs to sync DOM directly (NO useState)
                Events.on(engine, 'afterUpdate', () => {
                    if (!isMounted) return;

                    // FPS monitoring
                    const now = Date.now();
                    const delta = now - lastFrameTimeRef.current;
                    lastFrameTimeRef.current = now;

                    const fps = delta > 0 ? 1000 / delta : 60;
                    fpsMonitorRef.current.push(fps);

                    // Keep only last 30 frames
                    if (fpsMonitorRef.current.length > 30) {
                        fpsMonitorRef.current.shift();
                    }

                    // Calculate average FPS
                    const avgFps = fpsMonitorRef.current.reduce((a, b) => a + b, 0) / fpsMonitorRef.current.length;

                    // If FPS drops below 30, fail silently and revert to static
                    if (fpsMonitorRef.current.length >= 30 && avgFps < 30) {
                        console.warn('[Physics] FPS too low, reverting to static layout');
                        cleanupPhysics();
                        setPhysicsError(true);
                        return;
                    }

                    // Apply transforms directly via refs (bypasses React render cycle)
                    bodiesRef.current.forEach((body, systemId) => {
                        const cardEl = cardRefs.current.get(systemId);
                        if (cardEl) {
                            const rect = cardEl.getBoundingClientRect();
                            const containerRect = containerRef.current?.getBoundingClientRect();
                            if (!containerRect) return;

                            const initialX = rect.left - containerRect.left + rect.width / 2;
                            const initialY = rect.top - containerRect.top + rect.height / 2;

                            const dx = body.position.x - initialX;
                            const dy = body.position.y - initialY;
                            const angle = body.angle;

                            // Direct DOM manipulation (no React re-render)
                            cardEl.style.transform = `translate(${dx}px, ${dy}px) rotate(${angle}rad)`;
                        }
                    });
                });

                console.log('[Physics] Engine initialized successfully');

            } catch (error) {
                console.error('[Physics] Failed to initialize:', error);
                setPhysicsError(true);
            }
        };

        // Cleanup function
        const cleanupPhysics = () => {
            try {
                if (runnerRef.current) {
                    const Matter = (window as any).Matter;
                    if (Matter?.Runner?.stop) {
                        Matter.Runner.stop(runnerRef.current);
                    }
                    runnerRef.current = null;
                }

                if (renderRef.current) {
                    const Matter = (window as any).Matter;
                    if (Matter?.Render?.stop) {
                        Matter.Render.stop(renderRef.current);
                    }
                    if (renderRef.current.canvas) {
                        renderRef.current.canvas.remove();
                    }
                    renderRef.current = null;
                }

                if (worldRef.current && engineRef.current) {
                    const Matter = (window as any).Matter;
                    if (Matter?.World?.clear) {
                        Matter.World.clear(worldRef.current, false);
                    }
                    if (Matter?.Engine?.clear) {
                        Matter.Engine.clear(engineRef.current);
                    }
                }

                engineRef.current = null;
                worldRef.current = null;
                bodiesRef.current.clear();

                // Reset transforms on all cards
                cardRefs.current.forEach((cardEl) => {
                    cardEl.style.transform = '';
                });

                console.log('[Physics] Cleanup complete');
            } catch (error) {
                console.error('[Physics] Cleanup error:', error);
            }
        };

        initPhysics();

        return () => {
            isMounted = false;
            cleanupPhysics();
        };
    }, [isPhysicsEnabled, physicsError, systems]);

    const handleSystemClick = (system: SystemModule) => {
        if (system.status === 'construction' && system.id !== 'alabanza') {
            return;
        }

        // Check for restrictions
        // 1. PUBLIC ACCESS - Always Allow
        if (system.publicAccess) {
            navigate(system.route);
            return;
        }

        // 2. RESTRICTED ACCESS - Check Roles
        const isAdmin = currentUser && hasRole(currentUser, [UserRole.SUPER_ADMIN]);
        const hasAccess = isAdmin || (currentUser && hasRole(currentUser, system.allowedRoles));

        if (!hasAccess && currentUser) {
            // Remove strict return to allow modal to open
            // return; 
        }

        if (system.publicAccess) {
            navigate(system.route);
            return;
        }

        const isSuperAdmin = currentUser ? hasRole(currentUser, UserRole.SUPER_ADMIN) : false;
        const hasRoleAccess = currentUser && (isSuperAdmin || hasRole(currentUser, system.allowedRoles));

        if (hasRoleAccess) {
            db.addLog({
                id: generateUUID(),
                userId: currentUser!.id,
                action: `Acceso a Módulo`,
                timestamp: new Date().toISOString(),
                details: `El usuario ${currentUser!.name} ingresó al sistema: ${system.title}.`
            });
            navigate(system.route);
        } else {
            setSelectedSystem({
                name: system.title,
                id: system.id,
                route: system.route
            });
            setModalOpen(true);
        }
    };

    const handleModalLogin = async (email: string, pass: string) => {
        const success = await onLoginRequest(email, pass);
        if (success && selectedSystem) {
            setModalOpen(false);
            navigate(selectedSystem.route);
            return true;
        }
        return false;
    };

    return (
        <>
            <style>{animationStyles}</style>

            <div className="w-full min-h-screen bg-white dark:bg-black text-black dark:text-white font-sans flex flex-col relative selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">

                {/* Modal for System Login */}
                <SystemLoginModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    systemName={selectedSystem?.name || 'Sistema'}
                    onLogin={handleModalLogin}
                />

                {/* === HERO SECTION - DYNAMIC CAROUSEL === */}
                {/* === HERO SECTION - DYNAMIC CAROUSEL === */}
                <div className={`${isLoaded ? 'animate-fadeIn' : 'opacity-0'} relative border-y-4 border-black mb-12 md:mb-16`}>
                    <HeroCarousel
                        slides={(config.banner?.slides && config.banner.slides.length > 0)
                            ? config.banner.slides.map(s => ({
                                id: s.id,
                                imageUrl: s.imageUrl,
                                titlePrefix: s.title || s.titlePrefix,
                                titleHighlight: s.titleHighlight,
                                description: s.subtitle || s.description
                            }))
                            : [
                                {
                                    id: 'default-hero',
                                    imageUrl: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?q=80&w=2073&auto=format&fit=crop',
                                    titlePrefix: 'PLATAFORMA',
                                    titleHighlight: 'ORIGEN',
                                    description: 'Áreas de Servicio'
                                }
                            ]
                        }
                        theme="default"
                        heightClass="h-[42vh] md:h-[53vh]"
                        autoPlayInterval={5000}
                    />
                </div>



                {/* === SYSTEMS GRID - NEO-BRUTALIST CARDS === */}
                <section id="systems-grid" className="relative z-10 pb-16 px-4 sm:px-6 lg:px-8 max-w-[95%] mx-auto w-full flex-1">



                    {/* Grid Cards - Neo-Brutalist Layout */}
                    <div
                        ref={containerRef}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative"
                    >
                        {systems.map((system, idx) => {
                            const isRestricted = !system.publicAccess &&
                                currentUser &&
                                !hasRole(currentUser, UserRole.SUPER_ADMIN) &&
                                !hasRole(currentUser, system.allowedRoles);

                            const isConstruction = system.status === 'construction';
                            const isFeatured = system.id === 'groups';
                            const isAdmin = system.id === 'admin';

                            return (
                                <div
                                    key={system.id}
                                    ref={(el) => setCardRef(system.id, el)}
                                    onClick={() => handleSystemClick(system)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSystemClick(system); } }}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Acceder a ${system.title}: ${system.description}`}
                                    className={`
                                        group relative cursor-pointer overflow-hidden
                                        border-[3px] p-6 sm:p-8
                                        transition-all duration-200
                                        hover:-translate-y-[2px] hover:-translate-x-[2px]
                                        active:translate-y-0 active:translate-x-0
                                        focus:ring-2 focus:ring-offset-2 focus:outline-none
                                        min-h-[300px] flex flex-col justify-between
                                        ${isConstruction ? 'opacity-60' : ''}
                                        ${isLoaded ? 'animate-scaleIn' : 'opacity-0'}
                                        ${isFeatured
                                            ? 'md:col-span-2 bg-[#FFF9E5] dark:bg-yellow-900/30 border-black dark:border-yellow-300/50 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.15)] dark:hover:shadow-[10px_10px_0px_0px_rgba(255,255,255,0.2)] focus:ring-black dark:focus:ring-yellow-300'
                                            : isAdmin
                                                ? 'bg-white dark:bg-black border-blue-900 dark:border-blue-400 shadow-[8px_8px_0px_0px_rgba(30,58,138,1)] hover:shadow-[10px_10px_0px_0px_rgba(30,58,138,1)] dark:shadow-[8px_8px_0px_0px_rgba(96,165,250,0.3)] dark:hover:shadow-[10px_10px_0px_0px_rgba(96,165,250,0.4)] focus:ring-blue-900 dark:focus:ring-blue-400'
                                                : 'bg-white dark:bg-black border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)] dark:hover:shadow-[10px_10px_0px_0px_rgba(255,255,255,0.3)] focus:ring-black dark:focus:ring-white'
                                        }
                                    `}
                                    style={{ animationDelay: `${0.05 + idx * 0.05}s`, opacity: isLoaded ? undefined : 0 }}
                                >
                                    {/* Admin diagonal stripe pattern */}
                                    {isAdmin && (
                                        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #1e3a8a 0, #1e3a8a 1px, transparent 0, transparent 10px)' }} />
                                    )}

                                    {/* Featured card decorative circle */}
                                    {isFeatured && (
                                        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-[#ffeebb] dark:bg-yellow-700/20 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500 pointer-events-none" />
                                    )}

                                    {/* Content */}
                                    <div className="relative z-10 h-full flex flex-col">

                                        {/* Top Row */}
                                        <div className="flex items-start justify-between mb-6">
                                            {/* Icon Box */}
                                            <div className={`
                                                flex items-center justify-center border-[3px] bg-white
                                                ${isFeatured
                                                    ? 'w-14 h-14 sm:w-16 sm:h-16 border-black dark:border-yellow-300 text-black dark:text-yellow-300'
                                                    : isAdmin
                                                        ? 'w-12 h-12 sm:w-14 sm:h-14 border-blue-900 dark:border-blue-400 text-blue-900 dark:text-blue-400 dark:bg-black'
                                                        : 'w-12 h-12 sm:w-14 sm:h-14 border-black dark:border-white text-black dark:text-white dark:bg-black'
                                                }
                                            `}>
                                                {getModuleIcon(
                                                    system.id,
                                                    system.icon,
                                                    isConstruction,
                                                    isRestricted || false
                                                )}
                                            </div>

                                            {/* Status Badge / Lock / Admin Badge */}
                                            {isConstruction && (
                                                <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 border-2 border-amber-400 dark:border-amber-600">
                                                    Próximamente
                                                </span>
                                            )}

                                            {isAdmin && !isConstruction && (
                                                <div className="bg-blue-900 dark:bg-blue-500 text-white text-[10px] font-bold px-2 py-1 uppercase">
                                                    Admin
                                                </div>
                                            )}

                                            {!system.publicAccess && !isConstruction && !isAdmin && (
                                                <Lock className="w-5 h-5 text-gray-300 dark:text-neutral-600" />
                                            )}
                                        </div>

                                        {/* Subtitle */}
                                        <p className={`text-xs font-mono font-bold tracking-widest uppercase mb-2
                                            ${isFeatured
                                                ? 'text-gray-600 dark:text-yellow-200/80'
                                                : isAdmin
                                                    ? 'text-blue-800 dark:text-blue-300'
                                                    : 'text-gray-500 dark:text-neutral-500'
                                            }
                                        `}>
                                            {system.subtitle}
                                        </p>

                                        {/* Title */}
                                        <h3 className={`font-black uppercase leading-none mb-3
                                            ${isFeatured
                                                ? 'text-3xl sm:text-4xl tracking-tighter text-black dark:text-white'
                                                : isAdmin
                                                    ? 'text-2xl sm:text-3xl tracking-tight text-blue-900 dark:text-blue-300'
                                                    : 'text-2xl sm:text-3xl tracking-tight text-black dark:text-white'
                                            }
                                        `}>
                                            {system.title}
                                        </h3>

                                        {/* Description */}
                                        <p className={`font-medium leading-relaxed flex-1
                                            ${isFeatured
                                                ? 'text-black dark:text-neutral-200 text-sm sm:text-base max-w-lg mb-8'
                                                : 'text-gray-600 dark:text-neutral-400 text-sm mb-8'
                                            }
                                        `}>
                                            {system.description}
                                        </p>

                                        {/* Action Footer */}
                                        <div className={`pt-6 border-t-[3px]
                                            ${isFeatured
                                                ? 'border-black dark:border-yellow-300/50'
                                                : isAdmin
                                                    ? 'border-blue-900 dark:border-blue-400'
                                                    : 'border-black dark:border-white'
                                            }
                                        `}>
                                            {isConstruction ? (
                                                <span className="flex items-center gap-2 text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                                                    <Construction className="w-4 h-4" />
                                                    En Desarrollo
                                                </span>
                                            ) : (
                                                <button
                                                    className={`inline-flex items-center gap-2 font-bold text-xs uppercase
                                                        ${isFeatured
                                                            ? 'px-8 py-3 bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 transition-colors'
                                                            : isAdmin
                                                                ? 'px-6 py-2.5 bg-blue-900 text-white hover:bg-blue-800 dark:bg-blue-500 dark:hover:bg-blue-400 transition-colors w-max'
                                                                : 'px-6 py-2.5 bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 transition-colors w-max'
                                                        }
                                                    `}
                                                >
                                                    ACCEDER
                                                    <ArrowRight className={`${isFeatured ? 'w-4 h-4' : 'w-3 h-3'} group-hover:translate-x-1 transition-transform`} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>


                {/* === FOOTER - NEO-BRUTALIST === */}
                <footer className={`relative z-10 bg-neutral-50 dark:bg-neutral-950 border-t-2 sm:border-t-4 border-black dark:border-white py-8 sm:py-12 md:py-16 px-4 md:px-6 mt-auto ${isLoaded ? 'animate-slideUp stagger-4' : 'opacity-0'}`}>
                    <div className="max-w-7xl mx-auto flex flex-col items-center text-center md:text-left md:flex-row md:items-center md:justify-between gap-8 md:gap-12">

                        {/* Left - Text */}
                        <div>
                            <h2 className="text-2xl sm:text-3xl md:text-5xl font-black uppercase tracking-tighter mb-2 md:mb-4">
                                ¿Querés conocernos?
                            </h2>
                            <p className="text-neutral-500 dark:text-neutral-400 text-sm md:text-base font-bold uppercase tracking-wider">
                                Seguinos en nuestras redes y sé parte de la comunidad.
                            </p>
                        </div>

                        {/* Right - Social Icons - NEO-BRUTALIST BUTTONS */}
                        <div className="flex flex-wrap justify-center gap-3 md:gap-4">
                            {footerLinks.instagram && (
                                <button
                                    onClick={() => window.open(footerLinks.instagram, '_blank')}
                                    className="w-14 h-14 bg-white dark:bg-black border-3 border-black dark:border-white flex items-center justify-center hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-all duration-200 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.3)] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[5px_5px_0px_0px_rgba(255,255,255,0.4)] hover:-translate-y-1 hover:-rotate-3 active:translate-y-0 active:shadow-none"
                                    style={{ borderWidth: '3px' }}
                                    title="Instagram"
                                >
                                    <Instagram className="w-6 h-6" />
                                </button>
                            )}
                            {footerLinks.facebook && (
                                <button
                                    onClick={() => window.open(footerLinks.facebook, '_blank')}
                                    className="w-14 h-14 bg-white dark:bg-black border-3 border-black dark:border-white flex items-center justify-center hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-all duration-200 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.3)] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[5px_5px_0px_0px_rgba(255,255,255,0.4)] hover:-translate-y-1 hover:rotate-3 active:translate-y-0 active:shadow-none"
                                    style={{ borderWidth: '3px' }}
                                    title="Facebook"
                                >
                                    <Facebook className="w-6 h-6" />
                                </button>
                            )}
                            {footerLinks.youtube && (
                                <button
                                    onClick={() => window.open(footerLinks.youtube, '_blank')}
                                    className="w-14 h-14 bg-white dark:bg-black border-3 border-black dark:border-white flex items-center justify-center hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-all duration-200 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.3)] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[5px_5px_0px_0px_rgba(255,255,255,0.4)] hover:-translate-y-1 hover:-rotate-3 active:translate-y-0 active:shadow-none"
                                    style={{ borderWidth: '3px' }}
                                    title="YouTube"
                                >
                                    <Youtube className="w-6 h-6" />
                                </button>
                            )}
                            {footerLinks.spotify && (
                                <button
                                    onClick={() => window.open(footerLinks.spotify, '_blank')}
                                    className="w-14 h-14 bg-white dark:bg-black border-3 border-black dark:border-white flex items-center justify-center hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-all duration-200 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.3)] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[5px_5px_0px_0px_rgba(255,255,255,0.4)] hover:-translate-y-1 hover:rotate-3 active:translate-y-0 active:shadow-none"
                                    style={{ borderWidth: '3px' }}
                                    title="Spotify"
                                >
                                    <MusicIcon className="w-6 h-6" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Copyright */}
                    <div className="max-w-7xl mx-auto mt-8 sm:mt-12 pt-6 sm:pt-8 border-t-2 border-black dark:border-white text-center">
                        <p className="text-sm font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
                            © {new Date().getFullYear()} Sistema Origen — Todos los derechos reservados
                        </p>
                    </div>
                </footer>
            </div>
        </>
    );
};

export default Dashboard;
