-- ════════════════════════════════════════════════════════════════════════════
-- Que los datos del perfil lleguen a donde ya se habían copiado
-- ════════════════════════════════════════════════════════════════════════════
--
-- EL PROBLEMA
--
-- Cuando alguien se inscribe a un GCX, el formulario autocompleta su nombre,
-- email y teléfono desde su cuenta — y los GUARDA como copia en la fila de la
-- inscripción. Lo mismo pasa con el nombre del anfitrión y del co-anfitrión,
-- que quedan escritos en la fila del grupo además del id.
--
-- Esas copias no se actualizan nunca. Si después la persona corrige su
-- teléfono en /perfil, el anfitrión sigue viendo el viejo en su lista de
-- miembros, y la tarjeta del grupo sigue mostrando el nombre anterior. El dato
-- bueno está en `users` y nadie lo mira.
--
-- POR QUÉ UNA RPC Y NO UN UPDATE DESDE LA APP
--
-- La policy de UPDATE de group_registrations (ver
-- fix_group_registrations_rls_and_counts.sql) deja que una persona toque su
-- propia inscripción SÓLO si la fila no queda en APPROVED. Es correcto —evita
-- que alguien se apruebe solo— pero significa que un miembro ya aprobado no
-- puede corregir su propio teléfono desde el cliente. Justamente el caso más
-- común: los que ya están adentro.
--
-- Por eso va SECURITY DEFINER, y por eso toca únicamente los campos de
-- contacto: `status` no se nombra en ningún UPDATE de este archivo.
--
-- QUÉ SE SINCRONIZA Y QUÉ NO
--
--   SÍ · group_registrations (como titular y como pareja)
--   SÍ · groups (nombre del anfitrión y del co-anfitrión)
--        ⚠ Desde el 2026-10-05 esto ya lo hace un trigger sobre users, para
--        cualquier cambio de nombre y no sólo al guardar el perfil: ver
--        sql/sincronizar_nombre_anfitriones.sql. Los pasos 3 y 4 de la RPC
--        quedan redundantes (no hacen daño) y el emparejado opcional de groups
--        del final ya se corrió.
--
--   NO · baptisms, presentations, dianino_tickets, movements
--        Son actas: dicen qué pasó y con qué nombre se hizo ese día.
--        Reescribirlas sería falsificar un registro, no corregir un dato.
--
--   NO · nocturna_inscripciones
--        El adulto responsable firmó una autorización de un menor. El nombre
--        que firmó es parte de lo firmado.
--
-- EL COSTO, QUE CONVIENE SABER
--
-- A partir de acá el perfil manda. Si alguien corrigió su apellido a mano en
-- el formulario de inscripción —por ejemplo porque el corte automático de
-- "nombre y apellido" lo separó mal— esa corrección se pierde la próxima vez
-- que guarde su perfil. La contra es la de hoy: dos verdades distintas para la
-- misma persona y nadie sabe cuál mirar.
--
-- ════════════════════════════════════════════════════════════════════════════


-- ── Antes de correr: dos cosas que conviene mirar ───────────────────────────
--
-- 1 · El tipo de partner_data. Abajo se lo trata como jsonb. Si en esta base
--     quedó como `json` a secas, el `||` de la línea del UPDATE hay que
--     cambiarlo por un cast explícito.
--
--       SELECT column_name, data_type
--         FROM information_schema.columns
--        WHERE table_name = 'group_registrations'
--          AND column_name IN ('partner_data', 'partner_user_id');
--
-- 2 · Los triggers de auditoría. group_registrations tiene uno (ver
--     audit_logs.sql): cada sincronización va a dejar su fila en el registro
--     de cambios. Es ruido esperable, no un error — pero si alguien mira esa
--     tabla conviene que sepa de dónde salen.


-- ── Auxiliar: cortar "Nombre Apellido" igual que lo corta el formulario ─────
-- components/GCX/ModalUnirseGrupo.tsx hace name.split(' ') y toma la primera
-- palabra como nombre y el resto como apellido. Se repite ese criterio acá a
-- propósito: si los dos lados cortaran distinto, sincronizar movería los datos
-- en vez de dejarlos quietos.
CREATE OR REPLACE FUNCTION public.partir_nombre(p_completo TEXT)
RETURNS TABLE (nombre TEXT, apellido TEXT)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v TEXT := btrim(COALESCE(p_completo, ''));
    v_corte INTEGER;
BEGIN
    v_corte := position(' ' IN v);
    IF v_corte = 0 THEN
        RETURN QUERY SELECT v, ''::TEXT;
    ELSE
        RETURN QUERY SELECT substr(v, 1, v_corte - 1), btrim(substr(v, v_corte + 1));
    END IF;
END;
$$;


-- ── La RPC: "llevá mis datos a donde estaban copiados" ─────────────────────
CREATE OR REPLACE FUNCTION public.sincronizar_mis_datos()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid       UUID := auth.uid();
    v_nombre_completo TEXT;
    v_email     TEXT;
    v_telefono  TEXT;
    v_nombre    TEXT;
    v_apellido  TEXT;
    n_titular   INTEGER := 0;
    n_pareja    INTEGER := 0;
    n_anfitrion INTEGER := 0;
    n_cohost    INTEGER := 0;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Sin sesión.');
    END IF;

    SELECT btrim(COALESCE(u.name, '')), btrim(COALESCE(u.email, '')), btrim(COALESCE(u.phone, ''))
      INTO v_nombre_completo, v_email, v_telefono
      FROM public.users u
     WHERE u.id = v_uid;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No encontramos tu perfil.');
    END IF;

    SELECT p.nombre, p.apellido INTO v_nombre, v_apellido
      FROM public.partir_nombre(v_nombre_completo) p;

    -- Un perfil sin nombre no sincroniza nada: dejar vacío lo que hoy tiene
    -- dato es peor que tener el dato viejo.
    IF v_nombre = '' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Tu perfil no tiene nombre cargado.');
    END IF;

    -- 1 · Mis inscripciones como titular.
    --     COALESCE(NULLIF(...)) en email y teléfono: si el perfil los tiene
    --     vacíos se conserva lo que ya estaba. Un campo en blanco no es una
    --     corrección, es una ausencia.
    UPDATE public.group_registrations r
       SET first_name = v_nombre,
           last_name  = v_apellido,
           email      = COALESCE(NULLIF(v_email, ''), r.email),
           phone      = COALESCE(NULLIF(v_telefono, ''), r.phone)
     WHERE r.user_id = v_uid
       AND (r.first_name IS DISTINCT FROM v_nombre
         OR r.last_name  IS DISTINCT FROM v_apellido
         OR (v_email    <> '' AND r.email IS DISTINCT FROM v_email)
         OR (v_telefono <> '' AND r.phone IS DISTINCT FROM v_telefono));
    GET DIAGNOSTICS n_titular = ROW_COUNT;

    -- 2 · Las inscripciones donde soy la pareja de otro.
    --     Se mezcla sobre el jsonb que ya está (||) para no borrar claves que
    --     esta función no conoce.
    UPDATE public.group_registrations r
       SET partner_data = COALESCE(r.partner_data::jsonb, '{}'::jsonb) || jsonb_build_object(
               'firstName', v_nombre,
               'lastName',  v_apellido,
               'email',     COALESCE(NULLIF(v_email, ''),    r.partner_data->>'email'),
               'phone',     COALESCE(NULLIF(v_telefono, ''), r.partner_data->>'phone')
           )
     WHERE r.partner_user_id = v_uid;
    GET DIAGNOSTICS n_pareja = ROW_COUNT;

    -- 3 · Los grupos que anfitriono. El nombre vive duplicado al lado del id
    --     (ver co-anfitrion-guardado-dos-veces): la UI lee el nombre.
    UPDATE public.groups g
       SET leader_name    = v_nombre,
           leader_surname = v_apellido
     WHERE g.host_id = v_uid
       AND (g.leader_name IS DISTINCT FROM v_nombre OR g.leader_surname IS DISTINCT FROM v_apellido);
    GET DIAGNOSTICS n_anfitrion = ROW_COUNT;

    -- 4 · Los grupos donde soy co-anfitrión.
    UPDATE public.groups g
       SET co_host_first_name = v_nombre,
           co_host_last_name  = v_apellido
     WHERE g.co_host_id = v_uid
       AND (g.co_host_first_name IS DISTINCT FROM v_nombre OR g.co_host_last_name IS DISTINCT FROM v_apellido);
    GET DIAGNOSTICS n_cohost = ROW_COUNT;

    RETURN jsonb_build_object(
        'ok', true,
        'inscripciones', n_titular,
        'como_pareja', n_pareja,
        'grupos_anfitrion', n_anfitrion,
        'grupos_cohost', n_cohost
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sincronizar_mis_datos() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sincronizar_mis_datos() FROM anon;
GRANT  EXECUTE ON FUNCTION public.sincronizar_mis_datos() TO authenticated;

COMMENT ON FUNCTION public.sincronizar_mis_datos() IS
    'Lleva nombre, email y teléfono del perfil a las copias de group_registrations y groups. No toca status. La llama /perfil al guardar.';


-- ════════════════════════════════════════════════════════════════════════════
-- OPCIONAL — emparejar de una vez lo que ya está desfasado
-- ════════════════════════════════════════════════════════════════════════════
--
-- La RPC de arriba arregla los datos de cada persona recién cuando esa persona
-- vuelve a guardar su perfil. Esto los empareja a todos ahora.
--
-- LEER ANTES DE CORRER: pisa cualquier dato que alguien haya escrito a mano en
-- un formulario de inscripción y que no coincida con su perfil. Es una sola
-- dirección y no se puede deshacer sin un backup.
--
-- Primero mirar CUÁNTAS filas cambiarían, con el SELECT de abajo. Si el número
-- sorprende, no correr el UPDATE y avisar.
/*

-- ¿Cuánto hay desfasado hoy?
SELECT count(*) AS inscripciones_desfasadas
  FROM public.group_registrations r
  JOIN public.users u ON u.id = r.user_id
  JOIN LATERAL public.partir_nombre(u.name) p ON true
 WHERE r.first_name IS DISTINCT FROM p.nombre
    OR r.last_name  IS DISTINCT FROM p.apellido
    OR (btrim(COALESCE(u.email,'')) <> '' AND r.email IS DISTINCT FROM btrim(u.email))
    OR (btrim(COALESCE(u.phone,'')) <> '' AND r.phone IS DISTINCT FROM btrim(u.phone));

-- Y una muestra, para ver con ojos qué se estaría cambiando.
SELECT r.id, r.first_name || ' ' || r.last_name AS en_la_inscripcion, u.name AS en_el_perfil,
       r.phone AS tel_inscripcion, u.phone AS tel_perfil
  FROM public.group_registrations r
  JOIN public.users u ON u.id = r.user_id
  JOIN LATERAL public.partir_nombre(u.name) p ON true
 WHERE r.first_name IS DISTINCT FROM p.nombre OR r.last_name IS DISTINCT FROM p.apellido
 LIMIT 30;


-- El emparejado, cuando ya se miró lo de arriba:
UPDATE public.group_registrations r
   SET first_name = p.nombre,
       last_name  = p.apellido,
       email      = COALESCE(NULLIF(btrim(u.email), ''), r.email),
       phone      = COALESCE(NULLIF(btrim(u.phone), ''), r.phone)
  FROM public.users u,
       LATERAL public.partir_nombre(u.name) p
 WHERE u.id = r.user_id
   AND p.nombre <> '';

UPDATE public.groups g
   SET leader_name = p.nombre, leader_surname = p.apellido
  FROM public.users u, LATERAL public.partir_nombre(u.name) p
 WHERE u.id = g.host_id AND p.nombre <> '';

UPDATE public.groups g
   SET co_host_first_name = p.nombre, co_host_last_name = p.apellido
  FROM public.users u, LATERAL public.partir_nombre(u.name) p
 WHERE u.id = g.co_host_id AND p.nombre <> '';

*/
