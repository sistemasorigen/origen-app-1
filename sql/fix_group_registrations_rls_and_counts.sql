-- ════════════════════════════════════════════════════════════════════════
-- group_registrations: cerrar el DELETE/UPDATE abierto + arreglar contadores
-- 2026-09-08
--
-- A. SEGURIDAD. Las policies de DELETE y UPDATE tenían `qual: true` para
--    `authenticated`: cualquier usuario con cuenta podía borrar o modificar
--    CUALQUIER inscripción vía PostgREST, salteando todos los chequeos de
--    las RPC blindadas en la auditoría.
--
-- B. INTEGRIDAD. El trigger trg_update_members_count recalcula members_count
--    como COUNT(*) WHERE status='APPROVED' — es la fuente de verdad. Pero
--    manage_group_registration_v3 ADEMÁS hacía un +1/-1 manual DESPUÉS, así
--    que contaba doble. 52 de 82 grupos tenían el número mal.
-- ════════════════════════════════════════════════════════════════════════


-- ── 1. Policies de DELETE ───────────────────────────────────────────────
DROP POLICY IF EXISTS "group_registrations_auth_delete" ON public.group_registrations;
DROP POLICY IF EXISTS "Allow auth delete registrations" ON public.group_registrations;

CREATE POLICY "group_registrations_delete_authorized" ON public.group_registrations
FOR DELETE TO authenticated
USING (
    -- El propio usuario puede borrar su inscripción
    user_id = auth.uid()
    OR
    -- Anfitrión o co-anfitrión del grupo
    EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = group_registrations.group_id
          AND (g.host_id = auth.uid() OR g.co_host_id = auth.uid())
    )
    OR
    -- Staff de grupos
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND (
            u.role::text = ANY (ARRAY['SUPER_ADMIN','PASTOR','ADMIN_GROUPS','ENCARGADO_GRUPOS'])
            -- users.roles es text[] (udt_name = _text), NO user_role[].
            -- Castear a user_role[] hace fallar el CREATE POLICY entero.
            OR u.roles && ARRAY['SUPER_ADMIN','PASTOR','ADMIN_GROUPS','ENCARGADO_GRUPOS']::text[]
          )
    )
);


-- ── 2. Policies de UPDATE ───────────────────────────────────────────────
DROP POLICY IF EXISTS "group_registrations_auth_update" ON public.group_registrations;
DROP POLICY IF EXISTS "Allow auth update registrations" ON public.group_registrations;

-- USING dice QUÉ FILAS se pueden tocar; WITH CHECK dice CÓMO PUEDEN QUEDAR.
-- La distinción es clave acá: un usuario común necesita poder actualizar su
-- propia inscripción (registerMemberToGroup la pasa de REJECTED a PENDING
-- cuando alguien se re-postula), pero NO puede terminar en APPROVED — eso
-- sería auto-aprobarse el ingreso a un grupo.
CREATE POLICY "group_registrations_update_authorized" ON public.group_registrations
FOR UPDATE TO authenticated
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = group_registrations.group_id
          AND (g.host_id = auth.uid() OR g.co_host_id = auth.uid())
    )
    OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND (
            u.role::text = ANY (ARRAY['SUPER_ADMIN','PASTOR','ADMIN_GROUPS','ENCARGADO_GRUPOS'])
            OR u.roles && ARRAY['SUPER_ADMIN','PASTOR','ADMIN_GROUPS','ENCARGADO_GRUPOS']::text[]
          )
    )
)
WITH CHECK (
    -- Anfitrión, co-anfitrión y staff: sin restricción sobre el resultado.
    EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = group_registrations.group_id
          AND (g.host_id = auth.uid() OR g.co_host_id = auth.uid())
    )
    OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND (
            u.role::text = ANY (ARRAY['SUPER_ADMIN','PASTOR','ADMIN_GROUPS','ENCARGADO_GRUPOS'])
            OR u.roles && ARRAY['SUPER_ADMIN','PASTOR','ADMIN_GROUPS','ENCARGADO_GRUPOS']::text[]
          )
    )
    -- El propio usuario sí, pero la fila no puede quedar aprobada.
    OR (user_id = auth.uid() AND upper(COALESCE(status,'')) <> 'APPROVED')
);


-- ── 3. Sacar el doble conteo de v3 ──────────────────────────────────────
-- Base: pg_get_functiondef de la versión viva. Se quita SOLO el bloque de
-- +1/-1 sobre members_count. El chequeo de autorización (IS NOT DISTINCT
-- FROM, de la auditoría) y el bloque de DERIVACIÓN quedan intactos.
CREATE OR REPLACE FUNCTION public.manage_group_registration_v3(p_registration_id text, p_status text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_group_id TEXT;
    v_host_id UUID;
    v_current_role TEXT;
    v_current_status TEXT;
    v_members_count INTEGER;
    v_is_authorized BOOLEAN;
BEGIN
    SELECT group_id, status INTO v_group_id, v_current_status
    FROM group_registrations
    WHERE id = p_registration_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registration not found';
    END IF;

    SELECT host_id, members_count INTO v_host_id, v_members_count
    FROM groups
    WHERE id = v_group_id;

    SELECT role::text INTO v_current_role
    FROM public.users
    WHERE id = auth.uid();

    v_is_authorized := (v_host_id IS NOT DISTINCT FROM auth.uid() AND auth.uid() IS NOT NULL)
        OR COALESCE(v_current_role, '') = ANY(ARRAY['SUPER_ADMIN', 'ADMIN_GROUPS', 'ENCARGADO_GRUPOS', 'PASTOR', 'ANFITRION', 'CO_ANFITRION', 'VOLUNTARIO_GRUPOS']);

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Access Denied: You do not have permissions to manage this registration. Role: %', v_current_role;
    END IF;

    UPDATE group_registrations
    SET status = p_status
    WHERE id = p_registration_id;

    -- El contador NO se toca acá: el trigger
    -- trg_update_members_count ya recalcula members_count
    -- como COUNT(*) WHERE status='APPROVED' después de
    -- cada cambio. Sumar o restar acá contaba doble —
    -- causa de que 52 de 82 grupos tuvieran el número mal.

    -- ── DERIVACIÓN ──
    -- Si esta inscripción vino marcada como derivación y se
    -- acaba de aprobar, se borra la del grupo de origen.
    -- Va acá adentro a propósito: aprobar el ingreso al
    -- grupo nuevo y salir del viejo tienen que ser una sola
    -- operación.
    IF p_status = 'APPROVED' AND v_current_status != 'APPROVED' THEN
        DECLARE
            v_transfer_from TEXT;
            v_user_id UUID;
        BEGIN
            SELECT transfer_from_group_id, user_id
            INTO v_transfer_from, v_user_id
            FROM group_registrations
            WHERE id = p_registration_id;

            IF v_transfer_from IS NOT NULL AND v_user_id IS NOT NULL THEN
                -- Si el grupo de origen ya no existe, esto afecta 0 filas y
                -- no pasa nada: la derivación se completa igual.
                DELETE FROM group_registrations
                WHERE group_id = v_transfer_from
                  AND user_id = v_user_id
                  AND id <> p_registration_id
                  AND upper(status) = 'APPROVED';
            END IF;
        END;
    END IF;

    RETURN TRUE;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.manage_group_registration_v3(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manage_group_registration_v3(text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.manage_group_registration_v3(text, text) TO authenticated;


-- ── 4. Resincronizar los contadores ─────────────────────────────────────
UPDATE public.groups g
SET members_count = COALESCE(sub.real, 0)
FROM (
    SELECT gr.group_id, count(*) AS real
    FROM public.group_registrations gr
    WHERE upper(gr.status) = 'APPROVED'
    GROUP BY gr.group_id
) sub
WHERE g.id = sub.group_id
  AND g.members_count IS DISTINCT FROM sub.real;

-- Grupos sin ninguna inscripción aprobada
UPDATE public.groups g
SET members_count = 0
WHERE NOT EXISTS (
    SELECT 1 FROM public.group_registrations gr
    WHERE gr.group_id = g.id AND upper(gr.status) = 'APPROVED'
) AND g.members_count IS DISTINCT FROM 0;


-- ════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ════════════════════════════════════════════════════════════════════════

-- Desincronizados finales: debe dar 0
SELECT count(*) AS desincronizados FROM public.groups g
WHERE g.members_count IS DISTINCT FROM (
    SELECT count(*) FROM public.group_registrations gr
    WHERE gr.group_id = g.id AND upper(gr.status) = 'APPROVED'
);
