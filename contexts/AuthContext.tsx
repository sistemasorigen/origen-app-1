import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { supabaseService } from '../services/supabaseService';
import { User, UserRole } from '../types';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    error: string | null;
    isRecoveryMode: boolean;  // True when user arrived with recovery tokens
    needsProfileCompletion: boolean; // True when user is missing phone/age/gender
    signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
    signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
    signOut: () => Promise<void>;
    signUp: (firstName: string, lastName: string, phone: string, email: string, pass: string, age: number, gender: string) => Promise<{ success: boolean; error?: string }>;
    resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
    updatePassword: (password: string) => Promise<{ success: boolean; error?: string }>;
    completeProfile: (data: { phone: string; age: number; gender: string; birthDate: string }) => Promise<boolean>;
    refreshSession: () => Promise<void>;
    retryAuth: () => void;
    clearRecoveryMode: () => void;  // Call this after password is updated
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper: Promise with timeout
const withTimeout = <T,>(promise: Promise<T>, ms: number, errorMessage = 'Timeout'): Promise<T> => {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), ms)
    );
    return Promise.race([promise, timeout]);
};

// Timeout constants (balanced for reliability)
const SESSION_TIMEOUT = 10000; // 10 seconds
const PROFILE_TIMEOUT = 10000; // 10 seconds

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    // Computed: Check if profile needs completion (OAuth users missing phone/age/gender/birthDate)
    const needsProfileCompletion = !!(user && (!user.phone || !user.age || !user.gender || !user.birthDate));

    // Detect recovery mode synchronously from URL hash BEFORE Supabase cleans it
    const [isRecoveryMode, setIsRecoveryMode] = useState(() => {
        const hash = window.location.hash;
        const hasRecovery = hash.includes('access_token') && hash.includes('type=recovery');
        if (hasRecovery) {
            console.log('AuthContext: Recovery mode detected from URL');
        }
        return hasRecovery;
    });

    const clearRecoveryMode = () => {
        console.log('AuthContext: Clearing recovery mode');
        setIsRecoveryMode(false);
    };

    // Initial Load & Auth State Listener - SIMPLIFIED VERSION
    useEffect(() => {
        let isMounted = true;
        let subscription: { unsubscribe: () => void } | null = null;
        let hasProcessedSession = false; // Prevent duplicate processing

        // SAFETY NET: Guarantee loading stops after max wait
        const safetyTimeout = setTimeout(() => {
            if (isMounted && loading) {
                console.warn('[Auth] Safety timeout triggered - forcing loading to stop');
                setLoading(false);
            }
        }, 12000); // 12 second absolute maximum

        const processSession = async (session: any, source: string) => {
            if (!session?.user) {
                console.log(`[Auth] No session from ${source}`);
                if (isMounted) setLoading(false);
                return;
            }

            console.log(`[Auth] Processing session from ${source}:`, session.user.email);

            // --- GOOGLE REGISTER FALLBACK PASSWORD ---
            // Automatically assign '123456' to NEW Google users so they can also use email/pass.
            try {
                const user = session.user;
                // Check if provider is Google
                const isGoogle = user.app_metadata.provider === 'google' ||
                    (user.app_metadata.providers && user.app_metadata.providers.includes('google'));

                if (isGoogle) {
                    const createdAt = new Date(user.created_at).getTime();
                    const now = new Date().getTime();
                    // Consider "New User" if created within the last 2 minutes
                    const isNewUser = (now - createdAt) < 2 * 60 * 1000;

                    // Check customized metadata flag to avoid double-setting
                    const hasFallbackSet = user.user_metadata?.has_fallback_password;

                    if (isNewUser && !hasFallbackSet) {
                        console.log('[Auth] ✨ New Google user detected. Injecting fallback password...');

                        // TODO: SECURITY WARNING - Using hardcoded password '123456'.
                        // This allows Google-signup users to use Email/Password login immediately.
                        // Ideally, require a password reset or setup flow.
                        await supabase.auth.updateUser({
                            password: '123456',
                            data: { has_fallback_password: true }
                        });
                        console.log('[Auth] Fallback password set successfully.');
                    }
                }
            } catch (err) {
                console.error('[Auth] Error setting fallback password:', err);
                // Non-blocking error
            }

            try {
                await loadUserProfile(session.user.id, session.user);
            } catch (err) {
                console.error('[Auth] Profile load failed:', err);
            } finally {
                if (isMounted) {
                    setLoading(false);
                    clearTimeout(safetyTimeout);
                }
            }
        };

        // Use ONLY the auth state listener - it's faster and more reliable
        const setupListener = () => {
            // Skip if in recovery mode
            if (isRecoveryMode) {
                console.log('[Auth] Skipping session init - in recovery mode');
                setLoading(false);
                clearTimeout(safetyTimeout);
                return;
            }

            try {
                const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
                    if (!isMounted) return;

                    console.log('[Auth] Event:', event, session?.user?.email);

                    if (event === 'INITIAL_SESSION') {
                        // This fires immediately with cached session - prioritize this
                        if (!hasProcessedSession) {
                            hasProcessedSession = true;
                            await processSession(session, 'INITIAL_SESSION');
                        }
                    } else if (event === 'SIGNED_IN' && session?.user) {
                        // Only process if INITIAL_SESSION hasn't already handled it
                        if (!hasProcessedSession) {
                            hasProcessedSession = true;
                            await processSession(session, 'SIGNED_IN');
                        }
                        // Clean up OAuth hash from URL
                        if (window.location.hash.includes('access_token')) {
                            window.history.replaceState(null, '', window.location.pathname + window.location.search || '/');
                        }
                    } else if (event === 'SIGNED_OUT') {
                        setUser(null);
                        setLoading(false);
                        clearTimeout(safetyTimeout);
                    }
                });
                subscription = data.subscription;
            } catch (err) {
                console.error('[Auth] Listener setup failed:', err);
                if (isMounted) setLoading(false);
            }
        };

        setupListener();

        return () => {
            isMounted = false;
            clearTimeout(safetyTimeout);
            subscription?.unsubscribe();
        };
    }, [retryCount]);

    // --- AUTO-LOGOUT ON INACTIVITY ---
    // 5 minutes in milliseconds
    const INACTIVITY_TIMEOUT = 5 * 60 * 1000;

    useEffect(() => {
        if (!user) return; // Only track if logged in

        let timeoutId: NodeJS.Timeout;

        const handleLogout = () => {
            console.log('[Auth] Auto-logout triggered due to inactivity');
            signOut();
        };

        const resetTimer = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(handleLogout, INACTIVITY_TIMEOUT);
        };

        // Events to track activity
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

        // Set initial timer
        resetTimer();

        // Add listeners
        events.forEach(event => {
            document.addEventListener(event, resetTimer);
        });

        // Cleanup
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            events.forEach(event => {
                document.removeEventListener(event, resetTimer);
            });
        };
    }, [user]); // Re-run when user changes (login/logout)

    // Cache to prevent repeated loading
    const loadedProfileRef = React.useRef<string | null>(null);
    const loadingInProgressRef = React.useRef<boolean>(false);

    const loadUserProfile = async (authUserId: string, sessionUser?: any) => {
        console.log('[Auth] loadUserProfile called for:', authUserId, 'Has sessionUser:', !!sessionUser);
        // Skip if already loaded for this user or loading in progress
        if (loadedProfileRef.current === authUserId) {
            console.log('[Auth] Profile already loaded for:', authUserId);
            setLoading(false);
            return;
        }
        if (loadingInProgressRef.current) {
            console.log('[Auth] Profile loading already in progress, waiting...');
            // Don't return - the caller's finally block will handle setLoading(false)
            // We just won't duplicate the request
            return;
        }

        loadingInProgressRef.current = true;

        try {
            // Fetch with timeout
            const result: any = await withTimeout(
                supabase
                    .from('users')
                    .select('*')
                    .eq('id', authUserId)
                    .single(),
                PROFILE_TIMEOUT,
                'Tiempo de espera agotado al cargar perfil'
            );

            const data = result?.data;
            const dbError = result?.error;

            if (data && !dbError) {
                // Fetch Auth Metadata for Phone - with timeout protection
                let phone = '';
                try {
                    // Use passed sessionUser if available, otherwise fetch
                    const userMetadata = sessionUser?.user_metadata || sessionUser?.phone
                        ? sessionUser
                        : (await withTimeout(supabase.auth.getUser(), 10000, 'Timeout fetching auth user'))?.data?.user;

                    phone = userMetadata?.user_metadata?.phone || userMetadata?.phone || '';
                } catch (authErr) {
                    console.warn("[Auth] Could not fetch auth user metadata:", authErr);
                }

                setUser({
                    id: data.id,
                    name: data.name,
                    email: data.email,
                    role: data.role as UserRole,
                    roles: data.roles as UserRole[],
                    isActive: data.is_active,
                    linkedGroupId: data.linked_group_id,
                    volunteerRoles: data.volunteer_roles || [],
                    phone: data.phone || phone,
                    age: data.age,
                    gender: data.gender,
                    birthDate: data.birth_date
                });
                setError(null);
                loadedProfileRef.current = authUserId; // Mark as loaded
                console.log('[Auth] Profile loaded successfully:', data.email, data.role);
            } else if (dbError) {
                // Profile doesn't exist, try to create it
                console.warn("[Auth] Profile not found, attempting to create:", dbError.message);
                await createFallbackProfile(authUserId, sessionUser);
            }
        } catch (e: any) {
            console.error("[Auth] Profile Load Error:", e.message);
            // On timeout/error, try to use cached auth info
            await createFallbackProfile(authUserId, sessionUser);
        } finally {
            loadingInProgressRef.current = false;
            setLoading(false);
        }
    };

    // Create fallback profile from auth data - with improved timeout handling
    const createFallbackProfile = async (authUserId: string, sessionUser?: any) => {
        try {
            // Get auth user first - this is fast and cached
            let authUser = sessionUser;

            if (!authUser) {
                try {
                    const authResult = await withTimeout(
                        supabase.auth.getUser(),
                        5000, // Reduced timeout - this should be fast
                        'Timeout fetching auth user for fallback'
                    );
                    authUser = authResult?.data?.user;
                } catch (authErr) {
                    console.warn("Could not fetch auth user:", authErr);
                }
            }

            if (!authUser) {
                console.error("No auth user available for fallback");
                setError('No se pudo verificar la sesión. Por favor, intenta de nuevo.');
                return;
            }

            // Set user immediately from auth data (don't wait for DB)
            const fallbackUser: User = {
                id: authUser.id,
                name: authUser.user_metadata?.name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Usuario',
                email: authUser.email || '',
                role: UserRole.VIEWER,
                roles: [UserRole.VIEWER],
                isActive: true,
                volunteerRoles: [],
                phone: authUser.user_metadata?.phone || authUser.phone || ''
            };
            setUser(fallbackUser);
            setError(null);
            console.log("Fallback user set from auth data:", fallbackUser.email);

            // Try to upsert profile in background (don't block)
            supabase
                .from('users')
                .upsert({
                    id: authUser.id,
                    email: authUser.email,
                    name: authUser.user_metadata?.name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Usuario',
                    // Role is handled by DB default or preserved if existing
                    is_active: true
                })
                .select()
                .single()
                .then(({ data: newUser, error: createError }) => {
                    if (!createError && newUser) {
                        // Update user with DB data (may have different role)
                        setUser({
                            id: newUser.id,
                            name: newUser.name,
                            email: newUser.email,
                            role: newUser.role as UserRole,
                            roles: newUser.roles as UserRole[],
                            isActive: newUser.is_active,
                            linkedGroupId: newUser.linked_group_id,
                            volunteerRoles: newUser.volunteer_roles || [],
                            phone: authUser?.user_metadata?.phone || authUser?.phone || '',
                            age: newUser.age,
                            gender: newUser.gender,
                            birthDate: newUser.birth_date
                        });
                        console.log("User profile synced from DB:", newUser.email, newUser.role);
                    } else {
                        console.warn("Background profile sync failed:", createError?.message);
                    }
                })
                .catch(err => {
                    console.warn("Background profile sync exception:", err);
                });

        } catch (e) {
            console.error("Fallback profile creation failed:", e);
            setError('No se pudo cargar el perfil. Por favor, intenta de nuevo.');
        }
    };

    const signIn = async (email: string, pass: string) => {
        try {
            const result = await withTimeout(
                supabaseService.signInUser(email, pass),
                15000,
                'Tiempo de espera agotado al iniciar sesión'
            );

            if (result.user) {
                setUser(result.user);
                setError(null);
                return { success: true };
            }
            return { success: false, error: result.error };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    };

    const signInWithGoogle = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    // This automatically detects if you are on localhost or test-origen.online
                    redirectTo: `${window.location.origin}/`
                }
            });
            if (error) {
                console.error("Google Login Error:", error.message);
                return { success: false, error: error.message };
            }
            return { success: true };
        } catch (e: any) {
            console.error("Google Login Exception:", e);
            return { success: false, error: e.message };
        }
    };

    const signOut = async () => {
        // Immediate State Clear
        setUser(null);
        setLoading(false);
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
            await loadUserProfile(user.id);
        }
    };

    // Retry function for error recovery
    const retryAuth = () => {
        setLoading(true);
        setError(null);
        setRetryCount(prev => prev + 1);
    };

    // Complete profile for OAuth users
    const completeProfile = async (data: { phone: string; age: number; gender: string; birthDate: string }): Promise<boolean> => {
        if (!user) return false;

        try {
            const success = await supabaseService.updateUserProfile(user.id, data);
            if (success) {
                // Update local user state with new data
                setUser({
                    ...user,
                    phone: data.phone,
                    age: data.age,
                    gender: data.gender,
                    birthDate: data.birthDate
                });
                return true;
            }
            return false;
        } catch (e) {
            console.error('Error completing profile:', e);
            return false;
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            error,
            isRecoveryMode,
            needsProfileCompletion,
            signIn,
            signInWithGoogle,
            signOut,
            signUp,
            resetPassword,
            updatePassword,
            completeProfile,
            refreshSession,
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
