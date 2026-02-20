import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';

interface UseTutorialReturn {
    isActive: boolean;
    showInvitation: boolean;
    hasSeen: boolean;
    tourSessionId: number;
    startTutorial: () => void;
    completeTutorial: () => Promise<void>;
    dismissTutorial: () => Promise<void>; // "No volver a mostrar"
    declineTemporary: () => void; // "Ahora no"
    resetTutorial: () => Promise<void>;
}

export const useTutorial = (tourId: string): UseTutorialReturn => {
    const { user, isLoadingProfile, refreshSession } = useAuth();
    const [isActive, setIsActive] = useState(false);
    const [showInvitation, setShowInvitation] = useState(false);
    const [hasSeen, setHasSeen] = useState(true); // Default to true to prevent flash

    const [tourSessionId, setTourSessionId] = useState(0);

    // Check URL override for restarting tutorial
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get('restartTutorial') === 'true') {
            setIsActive(true);
            setHasSeen(false);
            setTourSessionId(Date.now());
            // Clean URL
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
        }
    }, []);

    // Check user progress on mount
    useEffect(() => {
        if (!user) return;

        // Wait for profile to be fully synced to avoid false positives with partial user data
        if (isLoadingProfile) return;

        const checkProgress = async () => {
            // Allow checking "tutorial_progress" from user metadata or column
            const progress = (user as any).tutorial_progress || {};
            const isCompleted = !!progress[tourId];

            setHasSeen(isCompleted);

            if (!isCompleted && !isActive) {
                // Determine if we should show the invitation
                const timer = setTimeout(() => {
                    setShowInvitation(true);
                }, 1000);
                return () => clearTimeout(timer);
            }
        };

        checkProgress();
    }, [user, tourId, isLoadingProfile]);

    const updateProgress = async (completed: boolean) => {
        if (!user) return;

        try {
            // Fetch current progress to merge
            const { data: userData, error: fetchError } = await supabase
                .from('users')
                .select('tutorial_progress')
                .eq('id', user.id)
                .single();

            if (fetchError) throw fetchError;

            const currentProgress = userData?.tutorial_progress || {};
            const newProgress = { ...currentProgress, [tourId]: completed };

            const { error: updateError } = await supabase
                .from('users')
                .update({ tutorial_progress: newProgress })
                .eq('id', user.id);

            if (updateError) throw updateError;

            // Update local state
            setHasSeen(completed);

            // CRITICAL: Refresh session to update global user state
            // This ensures subsequent navigations see the updated progress
            await refreshSession();

        } catch (error) {
            console.error('Error updating tutorial progress:', error);
        }
    };

    const startTutorial = useCallback(() => {
        setShowInvitation(false);
        setIsActive(true);
        setTourSessionId(Date.now());
    }, []);

    const completeTutorial = useCallback(async () => {
        setIsActive(false);
        await updateProgress(true);
    }, []);

    const dismissTutorial = useCallback(async () => {
        setShowInvitation(false);
        await updateProgress(true); // Mark as seen so we don't bother again
    }, []);

    const declineTemporary = useCallback(() => {
        setShowInvitation(false);
        // We don't update DB, so it will show again next session/refresh
    }, []);

    const resetTutorial = useCallback(async () => {
        if (!user) return;

        try {
            // Fetch current progress
            const { data: userData } = await supabase
                .from('users')
                .select('tutorial_progress')
                .eq('id', user.id)
                .single();

            const currentProgress = userData?.tutorial_progress || {};
            // Remove the key
            const { [tourId]: _, ...rest } = currentProgress;

            await supabase
                .from('users')
                .update({ tutorial_progress: rest })
                .eq('id', user.id);

            setHasSeen(false);
            setIsActive(true); // Auto-start
            setTourSessionId(Date.now());

            // Refresh session to reflect reset
            await refreshSession();
        } catch (error) {
            console.error('Error resetting tutorial:', error);
        }
    }, [user, tourId, refreshSession]);

    return {
        isActive,
        showInvitation,
        hasSeen,
        tourSessionId,
        startTutorial,
        completeTutorial,
        dismissTutorial,
        declineTemporary,
        resetTutorial
    };
};
