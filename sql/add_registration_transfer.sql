-- ════════════════════════════════════════════════════════════════════════
-- Derivación de miembros entre grupos — columna + baja atómica en v3
-- 2026-09-08
--
-- El anfitrión de un grupo puede DERIVAR a un miembro hacia otro grupo.
-- Se crea una inscripción PENDING en el destino con transfer_from_group_id
-- apuntando al grupo de origen. La baja del origen NO la hace el frontend:
-- la ejecuta manage_group_registration_v3 al aprobarse, en la misma
-- transacción que el alta. Si se hiciera desde el navegador, un corte de
-- conexión entre las dos operaciones dejaría a la persona inscripta en los
-- dos grupos, contada dos veces, sin que nadie se entere.
--
-- Decisiones (ver el prompt 7/9):
--   · La baja de origen es un DELETE, no un status nuevo: es lo que ya hace
--     el resto del sistema (BandejaBajasAdmin y la baja directa del
--     anfitrión borran). Un status 'TRANSFERRED' obligaría a revisar cada
--     consulta que filtra por status en toda la app.
--   · Se modifica v3, no se crea una v4: ya conviven 4 versiones de
--     manage_group_registration y v3 es la única que usa el frontend.
--   · Si el grupo de origen ya no existe, el DELETE afecta 0 filas y no
--     falla: que el grupo viejo haya desaparecido no debe impedir que la
--     persona entre al nuevo.
-- ════════════════════════════════════════════════════════════════════════


-- ── 1. Columna nueva ────────────────────────────────────────────────────
-- TEXT porque groups.id es TEXT (verificado en information_schema).
ALTER TABLE public.group_registrations
ADD COLUMN IF NOT EXISTS transfer_from_group_id TEXT DEFAULT NULL;

COMMENT ON COLUMN public.group_registrations.transfer_from_group_id IS
'Si tiene valor, esta inscripción es una DERIVACIÓN desde ese grupo (la hizo el anfitrión de origen). Al aprobarse, manage_group_registration_v3 borra la inscripción del grupo de origen dentro de la misma transacción. NULL = inscripción normal.';

-- Sin esto la columna existe en Postgres pero PostgREST no la expone, y el
-- frontend no puede leerla ni escribirla hasta que el cache se renueve solo.
NOTIFY pgrst, 'reload schema';


-- ── 2. v3 con la baja atómica ───────────────────────────────────────────
-- Base: pg_get_functiondef de la versión que está viva hoy. Lo único que se
-- agrega es el bloque DERIVACIÓN al final. El chequeo de autorización queda
-- IDÉNTICO: fue corregido en una auditoría (usaba v_host_id != auth.uid()
-- sin manejar NULL, lo que dejaba aprobar sin sesión) y no se toca.
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

    IF p_status = 'APPROVED' AND v_current_status != 'APPROVED' THEN
        UPDATE groups
        SET members_count = COALESCE(members_count, 0) + 1
        WHERE id = v_group_id;
    ELSIF p_status != 'APPROVED' AND v_current_status = 'APPROVED' THEN
        UPDATE groups
        SET members_count = GREATEST(0, COALESCE(members_count, 0) - 1)
        WHERE id = v_group_id;
    END IF;

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

                -- El contador del grupo de origen NO se ajusta acá a mano.
                -- El trigger trg_update_members_count (AFTER DELETE) ya lo
                -- recalcula como COUNT(*) WHERE status='APPROVED', que es la
                -- fuente de verdad. Restar además a mano dejaba el contador
                -- uno por debajo del real — verificado en las pruebas.
            END IF;
        END;
    END IF;

    RETURN TRUE;
END;
$function$;


-- ── 3. Permisos ─────────────────────────────────────────────────────────
-- CREATE OR REPLACE restablece el GRANT a PUBLIC, y Supabase además otorga
-- EXECUTE a anon por separado. Hay que revocar de los dos.
REVOKE EXECUTE ON FUNCTION public.manage_group_registration_v3(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manage_group_registration_v3(text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.manage_group_registration_v3(text, text) TO authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN — correr después
-- ════════════════════════════════════════════════════════════════════════

-- A) Permisos
SELECT
  has_function_privilege('anon','public.manage_group_registration_v3(text, text)','EXECUTE') AS anon_debe_ser_false,
  has_function_privilege('authenticated','public.manage_group_registration_v3(text, text)','EXECUTE') AS auth_debe_ser_true;
-- Esperado: false | true

-- B) La columna existe y PostgREST la ve
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='group_registrations'
  AND column_name='transfer_from_group_id';
-- Esperado: transfer_from_group_id | text | NULL

-- C) El chequeo de seguridad quedó igual (debe devolver true)
SELECT pg_get_functiondef(p.oid) LIKE '%v_host_id IS NOT DISTINCT FROM auth.uid() AND auth.uid() IS NOT NULL%' AS chequeo_intacto
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='manage_group_registration_v3';
-- Esperado: true

-- Las pruebas funcionales 1 a 5 (seguridad, inscripción normal, derivación
-- aprobada, derivación rechazada, grupo de origen inexistente) van en
-- BEGIN ... ROLLBACK. Ver el reporte de la sesión para el detalle y los
-- resultados obtenidos.
