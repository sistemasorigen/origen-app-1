-- ════════════════════════════════════════════════════════════════════════════
-- Transferir también las inscripciones PENDIENTES
-- 2026-09-26
--
-- Hasta hoy sólo se podía derivar a un miembro aprobado. Desde el panel GCX
-- hace falta redirigir además a quien todavía está esperando respuesta: se
-- anotó en el grupo equivocado, o el grupo se llenó y hay que mandarlo a otro.
--
-- Son DOS funciones, y las dos hacen falta. Con sólo la primera, la
-- transferencia de una pendiente se crea pero el pedido viejo nunca se borra:
-- la persona queda con una solicitud fantasma en el grupo de origen.
--
-- Verificado contra la definición viva (pg_get_functiondef) antes de escribir
-- esto, no contra los archivos del repo: hay un ROLLBACK_*.sql con una versión
-- distinta que no es la que está corriendo.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1 · derivar_miembro: aceptar PENDING además de APPROVED ────────────────
-- Cambia UNA línea del cuerpo. El resto se reproduce igual que la versión viva
-- porque CREATE OR REPLACE reemplaza la función entera.
CREATE OR REPLACE FUNCTION public.derivar_miembro(
    p_registration_id TEXT,
    p_to_group_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reg RECORD;
    v_from_group_id TEXT;
    v_caller UUID;
    v_authorized BOOLEAN;
    v_existing_status TEXT;
    v_new_id TEXT;
BEGIN
    v_caller := auth.uid();

    IF v_caller IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Sesión requerida.');
    END IF;

    SELECT * INTO v_reg FROM group_registrations WHERE id = p_registration_id;
    IF NOT FOUND THEN
        -- Mismo mensaje que el de permiso denegado, a propósito: si fueran
        -- distintos, alguien podría sondear ids para saber qué existe.
        RETURN jsonb_build_object('ok', false, 'error', 'No tenés permiso para derivar miembros de este grupo.');
    END IF;

    v_from_group_id := v_reg.group_id;

    SELECT (
        EXISTS (
            SELECT 1 FROM groups g
            WHERE g.id = v_from_group_id
              AND (g.host_id = v_caller OR g.co_host_id = v_caller)
        )
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = v_caller
              AND (
                u.role::text = ANY (ARRAY['SUPER_ADMIN','PASTOR','ADMIN_GROUPS','ENCARGADO_GRUPOS'])
                OR u.roles && ARRAY['SUPER_ADMIN','PASTOR','ADMIN_GROUPS','ENCARGADO_GRUPOS']::text[]
              )
        )
    ) INTO v_authorized;

    IF NOT v_authorized THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No tenés permiso para derivar miembros de este grupo.');
    END IF;

    -- ── LO QUE CAMBIA ──────────────────────────────────────────────────────
    -- Antes: sólo APPROVED. Ahora también PENDING, que es alguien que pidió
    -- entrar y todavía espera: redirigir ese pedido es justamente lo que se
    -- quiere poder hacer. Las RECHAZADAS siguen afuera — mover un "no" a otro
    -- grupo no significa nada.
    IF upper(v_reg.status) NOT IN ('APPROVED', 'PENDING') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Sólo se puede transferir a un miembro o a alguien que esté esperando respuesta.');
    END IF;

    IF v_from_group_id = p_to_group_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'El grupo destino es el mismo que el de origen.');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM groups WHERE id = p_to_group_id) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'El grupo destino no existe.');
    END IF;

    SELECT upper(status) INTO v_existing_status
    FROM group_registrations
    WHERE group_id = p_to_group_id
      AND (
            (v_reg.user_id IS NOT NULL AND user_id = v_reg.user_id)
         OR (v_reg.email IS NOT NULL AND lower(trim(email)) = lower(trim(v_reg.email)))
      )
      AND upper(status) IN ('PENDING', 'APPROVED')
    LIMIT 1;

    IF v_existing_status IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'error',
            CASE WHEN v_existing_status = 'APPROVED'
                 THEN 'Esta persona ya es miembro del grupo destino.'
                 ELSE 'Esta persona ya tiene una solicitud pendiente en el grupo destino.'
            END);
    END IF;

    v_new_id := gen_random_uuid()::text;

    INSERT INTO group_registrations (
        id, group_id, user_id, first_name, last_name, email, phone, dni,
        status, transfer_from_group_id, partner_data, partner_user_id, timestamp
    ) VALUES (
        v_new_id, p_to_group_id, v_reg.user_id, v_reg.first_name, v_reg.last_name,
        v_reg.email, v_reg.phone, v_reg.dni,
        'PENDING', v_from_group_id, v_reg.partner_data, v_reg.partner_user_id, NOW()
    );

    RETURN jsonb_build_object('ok', true, 'registration_id', v_new_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.derivar_miembro(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.derivar_miembro(text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.derivar_miembro(text, text) TO authenticated;


-- ── 2 · manage_group_registration_v3: limpiar también el pedido pendiente ──
-- Cuando el destino aprueba, se borra la inscripción de origen. Hoy ese DELETE
-- exige `upper(status) = 'APPROVED'`, así que un pedido pendiente derivado
-- sobrevive y la persona queda con una solicitud fantasma esperando en un
-- grupo al que ya no va.
--
-- De paso se arregla algo que ya fallaba: el DELETE pedía `user_id IS NOT NULL`
-- y matcheaba sólo por user_id, así que las inscripciones cargadas a mano —que
-- no tienen cuenta— nunca se limpiaban. Ahora cae al email, igual que el
-- chequeo de duplicados de derivar_miembro.
CREATE OR REPLACE FUNCTION public.manage_group_registration_v3(p_registration_id text, p_status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_group_id TEXT;
    v_host_id UUID;
    v_co_host_id UUID;
    v_current_status TEXT;
    v_is_authorized BOOLEAN;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Access Denied: session required.';
    END IF;

    IF p_status IS NULL OR p_status NOT IN ('APPROVED', 'REJECTED', 'PENDING') THEN
        RAISE EXCEPTION 'Invalid registration status: %', p_status;
    END IF;

    SELECT group_id, status INTO v_group_id, v_current_status
    FROM group_registrations
    WHERE id = p_registration_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registration not found';
    END IF;

    SELECT host_id, co_host_id INTO v_host_id, v_co_host_id
    FROM groups
    WHERE id = v_group_id;

    v_is_authorized := COALESCE(auth.uid() = v_host_id, false)
                    OR COALESCE(auth.uid() = v_co_host_id, false)
                    OR public.tiene_rol(ARRAY['SUPER_ADMIN', 'ADMIN_GROUPS', 'ENCARGADO_GRUPOS', 'PASTOR']);

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Access Denied: You do not have permissions to manage this registration.';
    END IF;

    UPDATE group_registrations
    SET status = p_status
    WHERE id = p_registration_id;

    IF p_status = 'APPROVED' AND v_current_status != 'APPROVED' THEN
        DECLARE
            v_transfer_from TEXT;
            v_user_id UUID;
            v_email TEXT;
        BEGIN
            SELECT transfer_from_group_id, user_id, email
            INTO v_transfer_from, v_user_id, v_email
            FROM group_registrations
            WHERE id = p_registration_id;

            -- Si el grupo de origen ya no existe, esto afecta 0 filas y la
            -- derivación se completa igual.
            IF v_transfer_from IS NOT NULL THEN
                DELETE FROM group_registrations
                WHERE group_id = v_transfer_from
                  AND id <> p_registration_id
                  -- Aprobada (se iba del grupo) o pendiente (retira el pedido).
                  AND upper(status) IN ('APPROVED', 'PENDING')
                  AND (
                        (v_user_id IS NOT NULL AND user_id = v_user_id)
                     OR (v_user_id IS NULL AND v_email IS NOT NULL
                         AND lower(trim(email)) = lower(trim(v_email)))
                  );
            END IF;
        END;
    END IF;

    RETURN TRUE;
END;
$function$;


-- ── Verificación ────────────────────────────────────────────────────────────
-- Las dos tienen que dar true en authenticated y false en anon.
SELECT
  has_function_privilege('anon','public.derivar_miembro(text, text)','EXECUTE')          AS deriv_anon_false,
  has_function_privilege('authenticated','public.derivar_miembro(text, text)','EXECUTE') AS deriv_auth_true;

-- Y que el cuerpo nuevo quedó: ambas tienen que devolver una fila.
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'derivar_miembro'
  AND pg_get_functiondef(p.oid) LIKE '%NOT IN (''APPROVED'', ''PENDING'')%';

SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'manage_group_registration_v3'
  AND pg_get_functiondef(p.oid) LIKE '%IN (''APPROVED'', ''PENDING'')%';
