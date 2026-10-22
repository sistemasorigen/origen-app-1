-- Pruebas de sql/reportes_limite_diario.sql. Un solo bloque que termina con
-- RAISE EXCEPTION: se deshace entero (reportes, notificaciones y los emails
-- encolados, que nunca salen) y el resultado viaja en el mensaje.
-- Ojo: cada corrida gasta números de la secuencia.
DO $$
DECLARE
    v_uid uuid;
    v_otro uuid;
    r jsonb;
    ok text := '';
BEGIN
    SELECT id INTO v_uid FROM public.users
     WHERE NOT ((role)::text = 'SUPER_ADMIN' OR COALESCE(roles, '{}') && ARRAY['SUPER_ADMIN'])
       AND NOT EXISTS (SELECT 1 FROM public.reportes_problemas p WHERE p.user_id = users.id)
     LIMIT 1;
    SELECT id INTO v_otro FROM public.users
     WHERE id <> v_uid
       AND NOT EXISTS (SELECT 1 FROM public.reportes_problemas p WHERE p.user_id = users.id)
     LIMIT 1;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    r := public.crear_reporte_problema('PRUEBA uno', 'Mi cuenta');
    IF (r->>'ok')::boolean IS NOT TRUE OR (r->>'restantes')::int <> 2 THEN RAISE EXCEPTION 'FALLÓ: el 1.º %', r; END IF;
    r := public.crear_reporte_problema('PRUEBA dos', 'Mi cuenta');
    IF (r->>'ok')::boolean IS NOT TRUE OR (r->>'restantes')::int <> 1 THEN RAISE EXCEPTION 'FALLÓ: el 2.º %', r; END IF;
    r := public.crear_reporte_problema('PRUEBA tres', 'Mi cuenta');
    IF (r->>'ok')::boolean IS NOT TRUE OR (r->>'restantes')::int <> 0 THEN RAISE EXCEPTION 'FALLÓ: el 3.º %', r; END IF;
    ok := ok || 'tres pasan · ';

    r := public.crear_reporte_problema('PRUEBA cuatro', 'Mi cuenta');
    IF r->>'motivo' IS DISTINCT FROM 'limite_diario' OR (r->>'limite')::int <> 3 THEN RAISE EXCEPTION 'FALLÓ: el 4.º pasó %', r; END IF;
    -- Contar como el servidor: con el rol de la persona, la RLS no le deja ver la tabla.
    RESET ROLE;
    IF (SELECT count(*) FROM public.reportes_problemas WHERE user_id = v_uid) <> 3 THEN RAISE EXCEPTION 'FALLÓ: el 4.º se insertó igual'; END IF;
    SET LOCAL ROLE authenticated;
    ok := ok || 'el 4.º no · ';

    -- Los de ayer no cuentan.
    RESET ROLE;
    UPDATE public.reportes_problemas SET created_at = created_at - interval '1 day' WHERE user_id = v_uid;
    SET LOCAL ROLE authenticated;
    r := public.crear_reporte_problema('PRUEBA al día siguiente', 'Mi cuenta');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ: lo de ayer contó %', r; END IF;
    ok := ok || 'lo de ayer no cuenta · ';

    -- El tope es por persona.
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_otro, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.crear_reporte_problema('PRUEBA otra persona', 'Mi cuenta');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ: otra persona bloqueada %', r; END IF;
    RESET ROLE;
    ok := ok || 'es por persona';

    RAISE EXCEPTION 'RESULTADO ✅ %', ok;
END $$;
