import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { supabaseService } from '../services/supabaseService';
import { User, UserRole } from '../types';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    error: string | null;
    isRecoveryMode: boolean;  // True when user arrived with recovery tokens
    isInitialized: boolean;   // Optimized loading state (true = we know if user is logged in or not)
    isProfileSynced: boolean; // True when user profile is confirmed synced with DB
    needsProfileCompletion: boolean; // Computed inside context for simplicity
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
    // Core Auth State
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    // Flag for initial hydration: UI can show skeleton instead of generic loading
    const [isInitialized, setIsInitialized] = useState(false);

    // Flag to track if we have successfully synced with the DB
    const [isProfileSynced, setIsProfileSynced] = useState(false);

    // Computed: Needs onboarding? (Safe check using synced profile)
    const needsOnboarding = !!(user && isProfileSynced && (!user.phone || !user.age));

    // Detect recovery mode synchronously from URL hash BEFORE Supabase cleans it
    const [isRecoveryMode, setIsRecoveryMode] = useState(() => {
        const hash = window.location.hash;
        return hash.includes('access_token') && hash.includes('type=recovery');
    });

    const clearRecoveryMode = () => setIsRecoveryMode(false);

    // Main Auth Listener: The faster source of truth
    useEffect(() => {
        let mounted = true;

        // Function to load profile in parallel with session
        // Handles the "User in Auth but maybe not in DB" case gracefully
        const hydrateUser = async (sessionUser: any) => {
            if (!sessionUser) {
                if (mounted) {
                    setUser(null);
                    setIsProfileSynced(false);
                    setLoading(false);
                    setIsInitialized(true);
                }
                return;
            }

            // Start fetching profile immediately
            // Note: We don't await this to set the initial user state if we wanted to show *something* 
            // but for strict sync we wait. Parallelizing request for speed.

            try {
                // 1. Fetch Profile from DB
                const profilePromise = supabase
                    .from('users')
                    .select('*')
                    .eq('id', sessionUser.id)
                    .single();

                // 2. Fetch Auth Metadata (for phone fallback)
                // Often available in sessionUser, but good to ensure
                const authUserPromise = supabase.auth.getUser();

                const [profileResult, authResult] = await Promise.all([profilePromise, authUserPromise]);

                const profileData = profileResult.data;
                const authMetadata = authResult.data?.user || sessionUser;
                const phone = profileData?.phone || authMetadata?.user_metadata?.phone || authMetadata?.phone || '';

                if (profileData) {
                    // Optimized: User exists in DB
                    if (mounted) {
                        setUser({
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
                            birthDate: profileData.birth_date
                        });
                        setIsProfileSynced(true);
                    }
                } else {
                    // Smart Fallback: User in Auth but not in DB -> Create basic profile in memory
                    // This unblocks the UI without 404ing
                    console.warn('[Auth] Profile missing in DB, using fallback.');
                    if (mounted) {
                        setUser({
                            id: sessionUser.id,
                            name: sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0] || 'Usuario',
                            email: sessionUser.email,
                            role: UserRole.VIEWER,
                            roles: [UserRole.VIEWER],
                            isActive: true,
                            linkedGroupId: null,
                            volunteerRoles: [],
                            phone: phone,
                            age: 0,
                            gender: '',
                            birthDate: ''
                        });
                        // We set synced=true so app can load (and likely trigger onboarding)
                        setIsProfileSynced(true);
                    }
                    // Optional: Trigger background creation here if needed
                }
            } catch (err) {
                console.error('[Auth] Hydration error:', err);
                // Fallback to minimal user to prevent lock-out
                if (mounted && sessionUser) {
                    setUser({
                        id: sessionUser.id,
                        name: 'Usuario',
                        email: sessionUser.email,
                        role: UserRole.VIEWER,
                        roles: [UserRole.VIEWER],
                        isActive: true,
                        linkedGroupId: null,
                        volunteerRoles: [],
                        phone: '',
                        age: 0,
                        gender: '',
                        birthDate: ''
                    });
                    setIsProfileSynced(true);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                    setIsInitialized(true);
                }
            }
        };

        // Initialize listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log(`[Auth] State Change: ${event}`);

            if (event === 'INITIAL_SESSION') {
                // If no session, unlock immediately. If session, hydrate.
                if (!session) {
                    if (mounted) {
                        setLoading(false);
                        setIsInitialized(true);
                    }
                } else {
                    hydrateUser(session.user);
                }
            } else if (event === 'SIGNED_IN') {
                if (session?.user) {
                    setLoading(true); // Short loading while fetching profile
                    hydrateUser(session.user);
                }
            } else if (event === 'SIGNED_OUT') {
                if (mounted) {
                    setUser(null);
                    setIsProfileSynced(false);
                    setLoading(false);
                    setIsInitialized(true);
                }
            }
        });

        // Trigger an initial check just in case onAuthStateChange is lazy (it usually isn't)
        // This is the "fast check"
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session && mounted && !isInitialized) {
                // No session found on quick check -> unlock
                // But don't override if onAuthStateChange already fired
                setLoading(false);
                setIsInitialized(true);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

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
            isInitialized,
            isProfileSynced,
            needsProfileCompletion: needsOnboarding, // Mapped to internal const
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
