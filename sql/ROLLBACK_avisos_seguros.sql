-- ════════════════════════════════════════════════════════════════════════════
-- Deshace sql/avisos_seguros.sql: vuelve a dejar la creación de avisos ABIERTA
-- como estaba (cualquiera con sesión le crea un aviso a cualquiera).
--
-- ¡OJO! Antes de correr esto, el frontend tiene que volver a insertar directo
-- en la tabla (createAppNotification en services/supabaseService.ts). Si no,
-- llamaría a crear_aviso, que este archivo borra, y los avisos de GCX dejarían
-- de crearse (sin romper los flujos, pero sin avisos).
--
-- Los 3 avisos del GCX de prueba que se borraron no vuelven.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- Permisos como estaban: anon y authenticated con todo; RLS decide.
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.app_notifications TO anon, authenticated;

CREATE POLICY "Authenticated users can insert notifications" ON public.app_notifications
    FOR INSERT TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.app_notifications;
CREATE POLICY "Users can update their own notifications" ON public.app_notifications
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

DROP FUNCTION IF EXISTS public.crear_aviso(uuid, text, text, text, text);

DROP INDEX IF EXISTS public.app_notifications_creado_por_idx;
ALTER TABLE public.app_notifications DROP COLUMN IF EXISTS creado_por;

COMMIT;
