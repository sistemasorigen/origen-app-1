import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { supabaseService } from '../services/supabaseService';
import { User, UserRole, CoordinatorVariant } from '../types';

interface AuthContextType {
    user: User | null;
    isLoadingSession: boolean; // True only while checking if a session exists (Fast)
    isLoadingProfile: boolean; // True while fetching detailed profile from DB (Slow)
    error: string | null;
    isRecoveryMode: boolean;
    isProfileSynced: boolean;
    needsProfileCompletion: boolean;
    signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
    signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
    signOut: () => Promise<void>;
    signUp: (firstName: string, lastName: string, phone: string, email: string, pass: string, age: number, gender: string) => Promise<{ success: boolean; error?: string }>;
    resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
    updatePassword: (password: string) => Promise<{ success: boolean; error?: string }>;
    completeProfile: (data: { phone: string; age: number; gender: string; birthDate: string }) => Promise<boolean>;
    refreshSession: () => Promise<void>;
    updateAvatar: (url: string) => void;
    retryAuth: () => void;
    clearRecoveryMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

    // Flag to track if we have successfully synced with the DB
    const [isProfileSynced, setIsProfileSynced] = useState(false);

    // Computed: Needs onboarding?
    const needsOnboarding = !!(user && isProfileSynced && (!user.phone || !user.age));

    // Detect recovery mode synchronously
    const [isRecoveryMode, setIsRecoveryMode] = useState(() => {
        const hash = window.location.hash;
        return hash.includes('access_token') && hash.includes('type=recovery');
    });

    const clearRecoveryMode = () => setIsRecoveryMode(false);

    // Mounted ref for async safety
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
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

    // Helper to cache/retrieve user profile from LocalStorage
    // "Stale-While-Revalidate" pattern to prevent role flickering
    const STORAGE_KEY = 'origen_user_profile';
    const saveProfileToCache = (user: User) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
        } catch (e) { console.error('[Auth] Cache write error', e); }
    };
    const getProfileFromCache = (): User | null => {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) { return null; }
    };

    // Helper to create a partial user from session immediately
    const createPartialUser = (sessionUser: any): User => {
        // 1. Try to recover from Cache first (optimistic)
        const cached = getProfileFromCache();
        if (cached && cached.id === sessionUser.id) {
            console.log('[Auth] Using cached profile for immediate render.');
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

    // Hydrate User Function (Hoisted)
    const hydrateUser = async (sessionUser: any) => {
        console.log('[Auth] Hydrating user:', sessionUser?.email);
        if (!sessionUser) {
            console.log('[Auth] No session user, clearing state.');
            setUser(null);
            localStorage.removeItem(STORAGE_KEY); // Clear cache
            setIsProfileSynced(false);
            setIsLoadingSession(false);
            setIsLoadingProfile(false);
            return;
        }

        // CRITICAL: Unblock UI immediately with partial user (or cached user)
        // We SKIP the mounted check here to ensure we unblock even if strict mode is doing weird things
        console.log('[Auth] Setting partial user immediately.');
        setUser(prev => prev || createPartialUser(sessionUser));
        setIsLoadingSession(false); // <--- UNBLOCKS APP SHELL
        setIsLoadingProfile(true);  // Indicates background work

        try {
            // Function to fetch profile with retry
            const fetchProfile = async (retries = 3, delay = 500) => {
                for (let i = 0; i < retries; i++) {
                    const { data, error } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', sessionUser.id)
                        .maybeSingle();

                    if (!error && data) {
                        // console.log('[Auth] Profile fetched:', data);
                    }

                    if (data) return { data, error: null };

                    if (error) {
                        console.warn(`[Auth] Profile fetch attempt ${i + 1} failed:`, error.message);
                    }

                    // If no data and no error involved (just null), it means not found.
                    // We still retry a few times in case a DB trigger is creating the user.
                    if (i < retries - 1) await new Promise(r => setTimeout(r, delay));
                }
                return { data: null, error: 'Max retries reached' };
            };

            // 1. Fetch Profile from DB with retry logic
            const profilePromise = fetchProfile();

            // 2. Fetch Auth Metadata (for consistent phone fallback)
            const authUserPromise = supabase.auth.getUser();

            const [{ data: profileData }, authResult] = await Promise.all([profilePromise, authUserPromise]);
            const authMetadata = authResult.data?.user || sessionUser;
            const phone = profileData?.phone || authMetadata?.user_metadata?.phone || authMetadata?.phone || '';

            if (mounted.current) {
                if (profileData) {
                    console.log(`[Auth] Full profile found (Role: ${profileData.role}), updating user.`);
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
                        tutorial_progress: profileData.tutorial_progress || {},
                        avatarUrl: profileData.avatar_url || undefined,
                    };

                    // Update state and cache
                    setUser(fullUser);
                    saveProfileToCache(fullUser);

                    setIsProfileSynced(true);
                } else {
                    // Fallback Profile logic
                    console.warn('[Auth] Profile missing in DB, using fallback.');
                    // If we have a cached one that was good, maybe keep it? 
                    // No, invalid DB means we should degrade.
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
                    setIsProfileSynced(true);
                }
            }
        } catch (err) {
            console.error('[Auth] Profile hydration error:', err);
            // Keep partial user, maybe set error toast?
            // Don't block the user, they can just use basic features
            if (mounted.current) {
                setIsProfileSynced(true); // Technically "synced" with failure, prevents infinite loading
            }
        } finally {
            if (mounted.current) {
                setIsLoadingProfile(false);
            }
        }
    };

    // Main Auth Listener
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log(`[Auth] State Change: ${event}`);

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
                    setIsProfileSynced(false);
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
                    console.log('[Auth] Session found by getSession (backup check), hydrating...');
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
                console.log('[Auth] SignIn success, manually hydrating...');
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
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/`
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
        localStorage.removeItem(STORAGE_KEY); // Clear cache
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
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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

    const completeProfile = async (data: { phone: string; age: number; gender: string; birthDate: string }): Promise<boolean> => {
        if (!user) return false;

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
            isLoadingSession,
            isLoadingProfile,
            error,
            isRecoveryMode,
            isProfileSynced,
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
