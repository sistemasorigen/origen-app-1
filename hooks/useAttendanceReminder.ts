import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { UserRole } from '../types';

const HOST_ROLES: string[] = [UserRole.ANFITRION, UserRole.CO_ANFITRION];
const CHECK_INTERVAL = 15 * 60 * 1000; // check every 15 minutes

/**
 * Checks if the authenticated host has groups that met today without
 * attendance being recorded, and inserts an in-app notification if so.
 * Uses the `check_attendance_reminders` PostgreSQL RPC (SECURITY DEFINER).
 */
export function useAttendanceReminder() {
    const { user } = useAuth();
    const lastChecked = useRef<number>(0);

    const isHost =
        user !== null &&
        (user.roles ?? []).some((r) => HOST_ROLES.includes(r));

    useEffect(() => {
        if (!isHost) return;

        const runCheck = async () => {
            const now = Date.now();
            // Throttle: don't check more than once per interval
            if (now - lastChecked.current < CHECK_INTERVAL) return;
            lastChecked.current = now;

            const { data, error } = await supabase.rpc('check_attendance_reminders');
            if (error) {
                console.warn('[useAttendanceReminder] RPC error:', error);
                return;
            }
            if ((data as number) > 0) {
                console.log(`[useAttendanceReminder] ${data} attendance reminder(s) inserted.`);
            }
        };

        // Run on mount
        runCheck();

        // Run when tab becomes visible again (user switches back to the app)
        const handleVisible = () => {
            if (document.visibilityState === 'visible') runCheck();
        };
        document.addEventListener('visibilitychange', handleVisible);

        // Also run on a timer in case the app stays open
        const timer = setInterval(runCheck, CHECK_INTERVAL);

        return () => {
            document.removeEventListener('visibilitychange', handleVisible);
            clearInterval(timer);
        };
    }, [isHost]);
}
