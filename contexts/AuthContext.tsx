import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { supabaseService, probarConexionBase } from '../services/supabaseService';
import { User, UserRole, CoordinatorVariant } from '../types';

/**
 * Qué sabemos del perfil del usuario.
 *
 * Antes esto era un booleano, `isProfileSynced`, y ahí estaba el problema:
 * "no hay perfil" y "no pudimos averiguarlo" caían en el mismo valor. Con la
 * base caída el sistema afirmaba que a todos les faltaban datos y les abría
 * el modal de completar perfil.
 */
export type EstadoPerfil =
    /** Todavía cargando. */
    | 'pendiente'
    /** La consulta anduvo y trajo el perfil. */
    | 'ok'
    /** La consulta anduvo y confirmó que no hay fila: usuario nuevo de verdad. */
    | 'sin-perfil'
    /** No se pudo averiguar. NUNCA habilita el onboarding. */
    | 'error-db';

interface AuthContextType {
    user: User | null;
    isLoadingSession: boolean; // True only while checking if a session exists (Fast)
    isLoadingProfile: boolean; // True while fetching detailed profile from DB (Slow)
    error: string | null;
    isRecoveryMode: boolean;
    isProfileSynced: boolean;
    estadoPerfil: EstadoPerfil;
    needsProfileCompletion: boolean;
    signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
    signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
    signOut: () => Promise<void>;
    signUp: (firstName: string, lastName: string, phone: string, email: string, pass: string, age: number, gender: string) => Promise<{ success: boolean; error?: string }>;
    resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
    updatePassword: (password: string) => Promise<{ success: boolean; error?: string }>;
    completeProfile: (data: { phone: string; age: number; gender: string; birthDate: string }) => Promise<ResultadoGuardadoPerfil>;
    refreshSession: () => Promise<void>;
    updateAvatar: (url: string) => void;
    retryAuth: () => void;
    clearRecoveryMode: () => void;
}

/**
 * Resultado de guardar el perfil. Se distingue el fallo por conexión para que
 * el modal pueda decir que el problema es del sistema y no de lo que cargó la
 * persona — y sobre todo para que deje de reintentar contra una base caída.
 */
export interface ResultadoGuardadoPerfil {
    ok: boolean;
    conexion?: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Esperas del reintento en segundo plano, en milisegundos. */
const ESPERAS_REINTENTO = [3000, 6000, 12000, 24000, 30000];

// Helper: Promise with timeout
const withTimeout = <T,>(promise: Promise<T>, ms: number, errorMessage = 'Timeout'): Promise<T> => {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), ms)
    );
    return Promise.race([promise, timeout]);
};

// Timeout constants
const SESSION_TIMEOUT = 10000;
const PROFILE_TIMEOUT = 10000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Core Auth State
    const [user, setUser] = useState<User | null>(null);

    // Split Loading State for "Non-Blocking Auth"
    const [isLoadingSession, setIsLoadingSession] = useState(true);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    // Qué sabemos del perfil. Reemplaza al booleano isProfileSynced.
    const [estadoPerfil, setEstadoPerfil] = useState<EstadoPerfil>('pendiente');

    // Se mantiene exportado como derivado: "terminamos de averiguar, con o sin
    // fila". Un error de base ya no cuenta como sincronizado.
    const isProfileSynced = estadoPerfil === 'ok' || estadoPerfil === 'sin-perfil';

    // Se abre el onboarding cuando SABEMOS en qué estado está el perfil —haya
    // fila o no— y le faltan datos. Con 'error-db' no sabemos nada, y afirmar
    // que faltan es exactamente lo que causó el incidente.
    //
    // OJO con restringir esto a 'sin-perfil': el caso más común del modal es
    // alguien que entró con Google, tiene fila creada por el trigger y no
    // tiene teléfono ni edad. Ese usuario cae en 'ok', no en 'sin-perfil'.
    // Pedir 'sin-perfil' deja a esa gente sin onboarding para siempre.
    const needsOnboarding = !!(user && isProfileSynced && (!user.phone || !user.age));

    // Detect recovery mode synchronously
    const [isRecoveryMode, setIsRecoveryMode] = useState(() => {
        const hash = window.location.hash;
        return hash.includes('access_token') && hash.includes('type=recovery');
    });

    const clearRecoveryMode = () => setIsRecoveryMode(false);

    // Mounted ref for async safety
    const mounted = useRef(true);

    // Reintento en segundo plano cuando la base no responde, para que la
    // persona no tenga que recargar para salir del estado degradado.
    const reintentoRef = useRef<number | null>(null);
    const intentoRef = useRef(0);

    // Generación de hidratación. Puede haber dos corriendo a la vez —un
    // reintento lento y un SIGNED_IN nuevo, por ejemplo— y sin esto la que
    // termina última pisa a la otra: una consulta vieja que falló podía
    // devolver la app al estado degradado después de que ya se había
    // recuperado.
    const generacionRef = useRef(0);

    const cancelarReintento = () => {
        if (reintentoRef.current !== null) {
            clearTimeout(reintentoRef.current);
            reintentoRef.current = null;
        }
    };

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            // Se corta acá: sin esto, el timer sigue vivo después de
            // desmontar y vuelve a pedir el perfil de una sesión que ya no
            // está.
            cancelarReintento();
        };
    }, []);

    // Safety: Force loading to stop after 5s if it gets stuck
    useEffect(() => {
        const safetyTimer = setTimeout(() => {
            if (isLoadingSession) {
                console.warn('[Auth] Safety timeout reached, forcing session load end.');
                setIsLoadingSession(false);
            }
        }, 5000);
        return () => clearTimeout(safetyTimer);
    }, [isLoadingSession]);

    // Helper to cache/retrieve user profile from sessionStorage
    // "Stale-While-Revalidate" pattern to prevent role flickering.
    // sessionStorage is tab-scoped, preventing cross-tab session sharing.
    const STORAGE_KEY = 'origen_user_profile';
    const saveProfileToCache = (user: User) => {
        try {
            const cached = {
                user,
                expiresAt: Date.now() + 60 * 60 * 1000, // Valid for 1 hour
            };
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
        } catch (e) { console.error('[Auth] Cache write error', e); }
    };

    const getProfileFromCache = (): User | null => {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const cached = JSON.parse(raw);
            if (cached.expiresAt && Date.now() > cached.expiresAt) {
                sessionStorage.removeItem(STORAGE_KEY);
                return null;
            }
            return cached.user ?? null;
        } catch (e) { return null; }
    };

    // Helper to create a partial user from session immediately.
    //
    // `usarCache` existe por una decisión explícita: con la base caída NO se
    // usa el caché. Mostrar el problema es mejor que mostrar datos viejos que
    // pueden estar mal — un rol que ya se revocó, por ejemplo.
    const createPartialUser = (sessionUser: any, usarCache = true): User => {
        // 1. Try to recover from Cache first (optimistic)
        const cached = usarCache ? getProfileFromCache() : null;
        if (cached && cached.id === sessionUser.id) {

            return cached;
        }

        // 2. Fallback to generic viewer if no cache
        const metadata = sessionUser.user_metadata || {};
        const phone = sessionUser.phone || metadata.phone || '';
        return {
            id: sessionUser.id,
            name: metadata.name || sessionUser.email?.split('@')[0] || 'Usuario',
            email: sessionUser.email,
            role: UserRole.VIEWER, // Default safe role until profile loads
            roles: [UserRole.VIEWER],
            isActive: true, // Optimistic
            phone: phone,
            tutorial_progress: (sessionUser as any).tutorial_progress || metadata.tutorial_progress || {}
        };
    };

    // Vuelve a intentar traer el perfil con espera creciente. Se corta solo
    // al lograrlo, al cerrar sesión y al desmontar.
    const programarReintento = (sessionUser: any) => {
        if (!mounted.current) return;
        const espera = ESPERAS_REINTENTO[Math.min(intentoRef.current, ESPERAS_REINTENTO.length - 1)];
        intentoRef.current += 1;
        cancelarReintento();
        reintentoRef.current = window.setTimeout(() => {
            reintentoRef.current = null;
            if (!mounted.current) return;
            hydrateUser(sessionUser);
        }, espera);
    };

    // Hydrate User Function (Hoisted)
    const hydrateUser = async (sessionUser: any) => {

        if (!sessionUser) {

            setUser(null);
            sessionStorage.removeItem(STORAGE_KEY); // Clear cache
            cancelarReintento();
            intentoRef.current = 0;
            setEstadoPerfil('pendiente');
            setIsLoadingSession(false);
            setIsLoadingProfile(false);
            return;
        }

        const generacion = ++generacionRef.current;
        const vigente = () => mounted.current && generacionRef.current === generacion;

        // CRITICAL: Unblock UI immediately with partial user (or cached user)
        // We SKIP the mounted check here to ensure we unblock even if strict mode is doing weird things

        setUser(prev => prev || createPartialUser(sessionUser));
        setIsLoadingSession(false); // <--- UNBLOCKS APP SHELL
        setIsLoadingProfile(true);  // Indicates background work

        try {
            // Trae el perfil, reintentando unas pocas veces.
            //
            // Lo importante es qué devuelve cuando no hay fila: si el último
            // intento no dio error, la consulta anduvo y la fila realmente no
            // existe (usuario nuevo). Si dio error, no sabemos nada.
            //
            // Antes devolvía 'Max retries reached' en los dos casos, así que
            // ni siquiera acá adentro se distinguían.
            const fetchProfile = async (retries = 3, delay = 500): Promise<{ data: any; error: any }> => {
                let ultimoError: any = null;

                for (let i = 0; i < retries; i++) {
                    const { data, error } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', sessionUser.id)
                        .maybeSingle();

                    if (data) return { data, error: null };

                    ultimoError = error ?? null;

                    if (error) {
                        console.warn(`[Auth] Profile fetch attempt ${i + 1} failed:`, error.message);
                    }

                    // Sin fila y sin error puede ser que el trigger todavía
                    // no la haya creado, así que se reintenta igual.
                    if (i < retries - 1) await new Promise(r => setTimeout(r, delay));
                }

                return { data: null, error: ultimoError };
            };

            // 1. Fetch Profile from DB with retry logic
            const profilePromise = fetchProfile();

            // 2. Fetch Auth Metadata (for consistent phone fallback)
            const authUserPromise = supabase.auth.getUser();

            // Se conserva el `error`: descartarlo acá era el bug original.
            const [resultadoPerfil, authResult] = await Promise.all([profilePromise, authUserPromise]);
            const profileData = resultadoPerfil.data;
            const errorPerfil = resultadoPerfil.error;
            const authMetadata = authResult.data?.user || sessionUser;
            const phone = profileData?.phone || authMetadata?.user_metadata?.phone || authMetadata?.phone || '';

            if (vigente()) {
                if (profileData) {

const fullUser: User = {
                        id: profileData.id,
                        name: profileData.name,
                        email: profileData.email,
                        role: profileData.role as UserRole,
                        roles: profileData.roles as UserRole[],
                        isActive: profileData.is_active,
                        linkedGroupId: profileData.linked_group_id,
                        volunteerRoles: profileData.volunteer_roles || [],
                        phone: phone,
                        age: profileData.age,
                        gender: profileData.gender,
                        birthDate: profileData.birth_date,
                        assignedCategory: profileData.assigned_category || undefined,
                        coordinatorVariant: profileData.coordinator_variant as CoordinatorVariant | undefined,
                        coordinatorVariants: (
                          profileData.coordinator_variants && profileData.coordinator_variants.length > 0
                            ? profileData.coordinator_variants
                            : (profileData.coordinator_variant ? [profileData.coordinator_variant] : [])
                        ) as CoordinatorVariant[],
                        tutorial_progress: profileData.tutorial_progress || {},
                        avatarUrl: profileData.avatar_url || undefined,
                    };

                    // Update state and cache
                    setUser(fullUser);
                    saveProfileToCache(fullUser);

                    // Se recuperó: se corta el reintento y se saca el cartel.
                    cancelarReintento();
                    intentoRef.current = 0;
                    setEstadoPerfil('ok');
                } else if (!errorPerfil) {
                    // La consulta anduvo y no hay fila: es un usuario nuevo
                    // de verdad. Este es el único caso que debe abrir el
                    // onboarding.
                    console.warn('[Auth] Sin fila de perfil en la base: usuario nuevo.');
                    const fallbackUser = {
                        ...createPartialUser(sessionUser),
                        phone: phone, // Ensure verified phone is kept
                        age: 0,
                        gender: '',
                        birthDate: ''
                    };
                    setUser(prev => {
                        // Merge explicitly
                        const merged = { ...prev!, ...fallbackUser };
                        return merged;
                    });
                    cancelarReintento();
                    intentoRef.current = 0;
                    setEstadoPerfil('sin-perfil');
                } else {
                    // No se pudo averiguar. No se afirma nada sobre el perfil:
                    // ni que está, ni que falta.
                    console.error('[Auth] No se pudo traer el perfil:', errorPerfil);
                    sessionStorage.removeItem(STORAGE_KEY);
                    setUser({ ...createPartialUser(sessionUser, false), phone });
                    setEstadoPerfil('error-db');
                    programarReintento(sessionUser);
                }
            }
        } catch (err) {
            console.error('[Auth] Profile hydration error:', err);
            // Se degrada sin habilitar el onboarding: una excepción acá no
            // dice nada sobre si la persona tiene perfil o no.
            if (vigente()) {
                sessionStorage.removeItem(STORAGE_KEY);
                setUser(prev => prev ? { ...createPartialUser(sessionUser, false) } : prev);
                setEstadoPerfil('error-db');
                programarReintento(sessionUser);
            }
        } finally {
            if (vigente()) {
                setIsLoadingProfile(false);
            }
        }
    };

    // Main Auth Listener
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {

            if (event === 'INITIAL_SESSION') {
                if (!session) {
                    if (mounted.current) {
                        setIsLoadingSession(false);
                        setIsLoadingProfile(false);
                    }
                } else {
                    hydrateUser(session.user);
                }
            } else if (event === 'SIGNED_IN') {
                if (session?.user) {
                    setIsLoadingSession(false); // Ensure unblocked
                    hydrateUser(session.user);
                }
            } else if (event === 'SIGNED_OUT') {
                if (mounted.current) {
                    setUser(null);
                    // Se corta el reintento: si no, sigue pidiendo el perfil
                    // de alguien que ya se fue.
                    cancelarReintento();
                    intentoRef.current = 0;
                    setEstadoPerfil('pendiente');
                    setIsLoadingSession(false);
                    setIsLoadingProfile(false);
                }
            }
        });

        // Backup safety check (very fast check)
        // Fix: If session exists but listener hasn't fired yet, we MUST hydrate manually.
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (mounted.current && isLoadingSession) {
                if (!session) {
                    setIsLoadingSession(false);
                } else {

                    hydrateUser(session.user);
                }
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []); // eslint-disable-next-line react-hooks/exhaustive-deps

    const signIn = async (email: string, pass: string) => {
        // setIsLoadingSession(true); // Block UI during login attempt (optional, but good UX)
        try {
            const result = await withTimeout(
                supabaseService.signInUser(email, pass),
                15000,
                'Tiempo de espera agotado al iniciar sesión'
            );

            if (result.user) {
                // EXPLICIT HYDRATION: Don't wait for listener

                await hydrateUser(result.user);

                setError(null);
                return { success: true };
            }
            // setIsLoadingSession(false); // Unblock if failed
            return { success: false, error: result.error };
        } catch (e: any) {
            // setIsLoadingSession(false);
            return { success: false, error: e.message };
        }
    };

    const signInWithGoogle = async () => {
        try {
            // Si hay un destino guardado (ej: volver al
            // modal de un grupo de conexión), Google debe
            // devolver ahí en vez de a la raíz.
            const destino = sessionStorage.getItem(
                'post_login_redirect'
            );
            const redirectUrl = destino
                ? `${window.location.origin}${destino}`
                : `${window.location.origin}/`;

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl
                }
            });
            if (error) {
                return { success: false, error: error.message };
            }
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    };

    const signOut = async () => {
        setUser(null);
        sessionStorage.removeItem(STORAGE_KEY); // Clear cache
        setIsLoadingSession(false);
        setIsLoadingProfile(false);
        setError(null);

        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error("SignOut Exception:", error);
        }
    };

    const signUp = async (firstName: string, lastName: string, phone: string, email: string, pass: string, age: number, gender: string) => {
        try {
            return await withTimeout(
                supabaseService.signUpUser(firstName, lastName, phone, email, pass, age, gender),
                15000,
                'Tiempo de espera agotado al registrarse'
            );
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    };

    const resetPassword = async (email: string) => {
        try {
            return await withTimeout(
                supabaseService.resetPasswordForEmail(email),
                10000,
                'Tiempo de espera agotado'
            );
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    };

    const updatePassword = async (password: string) => {
        try {
            return await withTimeout(
                supabaseService.updateUserPassword(password),
                10000,
                'Tiempo de espera agotado'
            );
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    };

    const refreshSession = async () => {
        if (user) {
            await hydrateUser({ ...user, id: user.id });
        }
    };

    const updateAvatar = (url: string) => {
        if (!user) return;
        const updated = { ...user, avatarUrl: url };
        setUser(updated);
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (e) { /* silenciar */ }
    };

    const retryAuth = () => {
        setIsLoadingSession(true);
        setError(null);
        setRetryCount(prev => prev + 1);
        // Force re-check
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) hydrateUser(session.user);
            else setIsLoadingSession(false);
        });
    };

    const completeProfile = async (
        data: { phone: string; age: number; gender: string; birthDate: string }
    ): Promise<ResultadoGuardadoPerfil> => {
        if (!user) return { ok: false };

        try {
            const success = await supabaseService.updateUserProfile(user.id, data);
            if (success) {
                setUser({
                    ...user,
                    phone: data.phone,
                    age: data.age,
                    gender: data.gender,
                    birthDate: data.birthDate
                });
                // Guardar el perfil confirma que la base responde y que ahora
                // sí hay fila.
                cancelarReintento();
                intentoRef.current = 0;
                setEstadoPerfil('ok');
                return { ok: true };
            }
            // Falló: recién acá se averigua si fue la base, para poder decirle
            // a la persona que el problema no son sus datos.
            const hayBase = await probarConexionBase();
            return { ok: false, conexion: !hayBase };
        } catch (e) {
            console.error('Error completing profile:', e);
            const hayBase = await probarConexionBase();
            return { ok: false, conexion: !hayBase };
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            isLoadingSession,
            isLoadingProfile,
            error,
            isRecoveryMode,
            isProfileSynced,
            estadoPerfil,
            needsProfileCompletion: needsOnboarding,
            signIn,
            signInWithGoogle,
            signOut,
            signUp,
            resetPassword,
            updatePassword,
            completeProfile,
            refreshSession,
            updateAvatar,
            retryAuth,
            clearRecoveryMode
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
