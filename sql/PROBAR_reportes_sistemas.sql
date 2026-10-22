-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de sql/reportes_sistemas.sql
--
-- Todo corre adentro de UN bloque que termina con RAISE EXCEPTION a propósito:
-- así se deshace entero —el reporte de prueba, las notificaciones, el pedido
-- encolado en pg_net (que nunca llega a salir)— y el resultado viaja en el
-- mensaje del error: "RESULTADO ✅ …" o "FALLÓ: …".
--
-- Datos: texto "PRUEBA". No imprime nombres, emails ni teléfonos: sólo si
-- vinieron o no. Los usuarios se eligen solos (uno común y un SUPER_ADMIN).
-- Ojo: la secuencia de `numero` no se deshace; cada corrida gasta un número.
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    v_comun uuid;
    v_admin uuid;
    r jsonb;
    v_id uuid;
    v_lista jsonb;
    v_fila jsonb;
    v_cola_antes bigint;
    v_cola_despues bigint;
    v_estado text;
    v_nota text;
    v_url text;
    ok text := '';
BEGIN
    -- codigo_reporte
    IF public.codigo_reporte(42) <> 'REP-0042' THEN RAISE EXCEPTION 'FALLÓ: codigo_reporte(42) = %', public.codigo_reporte(42); END IF;
    IF public.codigo_reporte(12345) <> 'REP-12345' THEN RAISE EXCEPTION 'FALLÓ: codigo_reporte(12345)'; END IF;
    ok := ok || 'código · ';

    SELECT id INTO v_comun FROM public.users
     WHERE NOT ((role)::text = 'SUPER_ADMIN' OR COALESCE(roles, '{}') && ARRAY['SUPER_ADMIN']) LIMIT 1;
    SELECT id INTO v_admin FROM public.users
     WHERE (role)::text = 'SUPER_ADMIN' OR COALESCE(roles, '{}') && ARRAY['SUPER_ADMIN'] LIMIT 1;

    -- Un usuario común crea el reporte; el trigger encola el email sin romper el insert.
    SELECT count(*) INTO v_cola_antes FROM net.http_request_queue;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_comun, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.crear_reporte_problema('PRUEBA: no anda algo', 'Mi cuenta', NULL, 'v-prueba', 'PRUEBA');
    RESET ROLE;
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ: crear %', r; END IF;
    v_id := (r->>'id')::uuid;
    SELECT count(*) INTO v_cola_despues FROM net.http_request_queue;
    IF v_cola_despues <> v_cola_antes + 1 THEN RAISE EXCEPTION 'FALLÓ: el trigger no encoló el email (% → %)', v_cola_antes, v_cola_despues; END IF;
    ok := ok || 'crear + encolar · ';

    -- La notificación lleva al reporte.
    SELECT action_url INTO v_url FROM public.app_notifications
     WHERE type = 'REPORTE_PROBLEMA' AND action_url LIKE '%' || v_id::text LIMIT 1;
    IF v_url IS DISTINCT FROM '/panel-admin/reportes?id=' || v_id THEN RAISE EXCEPTION 'FALLÓ: notificación %', v_url; END IF;
    ok := ok || 'notificación · ';

    -- El común no gestiona ni ve la lista.
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_comun, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.gestionar_reporte(v_id, 'resuelto');
    v_lista := public.reportes_admin();
    RESET ROLE;
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ: un común gestionó %', r; END IF;
    IF jsonb_array_length(v_lista) <> 0 THEN RAISE EXCEPTION 'FALLÓ: un común vio la lista'; END IF;
    ok := ok || 'común bloqueado · ';

    -- anon: ni siquiera puede llamar.
    BEGIN
        SET LOCAL ROLE anon;
        PERFORM public.gestionar_reporte(v_id, 'resuelto');
        RESET ROLE;
        RAISE EXCEPTION 'FALLÓ: anon pudo llamar a gestionar_reporte';
    EXCEPTION WHEN insufficient_privilege THEN
        RESET ROLE;
    END;
    BEGIN
        SET LOCAL ROLE anon;
        PERFORM public.reportes_admin();
        RESET ROLE;
        RAISE EXCEPTION 'FALLÓ: anon pudo llamar a reportes_admin';
    EXCEPTION WHEN insufficient_privilege THEN
        RESET ROLE;
    END;
    ok := ok || 'anon bloqueado · ';

    -- SUPER_ADMIN: la lista trae quién lo mandó.
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_lista := public.reportes_admin();
    SELECT f INTO v_fila FROM jsonb_array_elements(v_lista) f WHERE f->>'id' = v_id::text;
    IF v_fila IS NULL THEN RAISE EXCEPTION 'FALLÓ: el admin no ve el reporte'; END IF;
    IF COALESCE(v_fila->>'nombre', '') = '' OR COALESCE(v_fila->>'email', '') = '' THEN RAISE EXCEPTION 'FALLÓ: la lista no trae nombre o email'; END IF;
    IF v_fila->>'codigo' NOT LIKE 'REP-%' THEN RAISE EXCEPTION 'FALLÓ: código en la lista'; END IF;
    ok := ok || 'lista con remitente · ';

    -- visto · resuelto · reabrir · nota
    r := public.gestionar_reporte(v_id, 'visto');
    SELECT estado INTO v_estado FROM public.reportes_problemas WHERE id = v_id;
    IF v_estado <> 'visto' OR NOT EXISTS (SELECT 1 FROM public.reportes_problemas WHERE id = v_id AND visto_por = v_admin AND visto_at IS NOT NULL) THEN RAISE EXCEPTION 'FALLÓ: visto'; END IF;

    r := public.gestionar_reporte(v_id, 'resuelto');
    SELECT estado INTO v_estado FROM public.reportes_problemas WHERE id = v_id;
    IF v_estado <> 'resuelto' OR NOT EXISTS (SELECT 1 FROM public.reportes_problemas WHERE id = v_id AND resuelto_por = v_admin) THEN RAISE EXCEPTION 'FALLÓ: resuelto'; END IF;

    -- 'visto' sobre un resuelto no lo toca.
    r := public.gestionar_reporte(v_id, 'visto');
    SELECT estado INTO v_estado FROM public.reportes_problemas WHERE id = v_id;
    IF v_estado <> 'resuelto' THEN RAISE EXCEPTION 'FALLÓ: visto pisó un resuelto'; END IF;

    r := public.gestionar_reporte(v_id, 'reabrir');
    SELECT estado INTO v_estado FROM public.reportes_problemas WHERE id = v_id;
    IF v_estado <> 'visto' OR NOT EXISTS (SELECT 1 FROM public.reportes_problemas WHERE id = v_id AND reabierto_por = v_admin AND resuelto_at IS NOT NULL) THEN RAISE EXCEPTION 'FALLÓ: reabrir'; END IF;

    r := public.gestionar_reporte(v_id, 'nota', '  PRUEBA nota interna  ');
    SELECT nota_interna INTO v_nota FROM public.reportes_problemas WHERE id = v_id;
    IF v_nota <> 'PRUEBA nota interna' OR NOT EXISTS (SELECT 1 FROM public.reportes_problemas WHERE id = v_id AND nota_editada_at IS NOT NULL) THEN RAISE EXCEPTION 'FALLÓ: nota'; END IF;

    r := public.gestionar_reporte(v_id, 'borrar');
    IF r->>'motivo' IS DISTINCT FROM 'accion_desconocida' THEN RAISE EXCEPTION 'FALLÓ: acción desconocida aceptada'; END IF;
    RESET ROLE;
    ok := ok || 'visto/resuelto/reabrir/nota';

    RAISE EXCEPTION 'RESULTADO ✅ %', ok;
END $$;
