-- ============================================================================
-- Prueba de la FASE 2a (menores y perfiles) — segura de correr en producción.
--
-- Simula requests como anon / authenticated con auth.uid() fijado, crea un
-- inscripto de Influos y una familia del Día del Padre descartables, y AL
-- FINAL TIRA UN ERROR A PROPÓSITO para deshacer todo. El resultado viene en el
-- texto del error.
--
-- Los casos marcados [cierre] solo pasan después de
-- auditoria_2026-09_fase2a_cierre.sql.
-- ============================================================================
DO $prueba$
DECLARE
  hosts_staff text[] := ARRAY['ANFITRION','CO_ANFITRION','SUPER_ADMIN','ADMIN_GROUPS','ENCARGADO_GRUPOS','PASTOR'];
  staff_perfiles text[] := ARRAY['SUPER_ADMIN','ADMIN_GROUPS','ENCARGADO_GRUPOS','PASTOR','REPORTES','ADMIN_PUNTO','ENCARGADO_PUNTO'];
  v_viewer uuid; v_host uuid; v_reportes uuid; v_influos uuid; v_eventos uuid; v_objetivo uuid;
  v_obj_email text; v_obj_phone text;
  f_id uuid;
  n int; t text; b boolean;
  r record;
  res text[] := '{}'; ok int := 0; tot int := 0;
BEGIN
  -- ── actores ──────────────────────────────────────────────────────────────
  SELECT id INTO v_viewer FROM users
   WHERE role::text IN ('VIEWER','USUARIO')
     AND NOT (COALESCE(roles,'{}') && (hosts_staff || staff_perfiles || ARRAY['INFLUOS','EVENTOS','ENCARGADO_EVENTOS','COORDINATOR']))
   ORDER BY created_at LIMIT 1;
  SELECT id INTO v_host FROM users
   WHERE (role::text = 'ANFITRION' OR 'ANFITRION' = ANY(COALESCE(roles,'{}')))
     AND NOT (COALESCE(roles,'{}') && staff_perfiles) AND role::text <> ALL (staff_perfiles)
   ORDER BY created_at LIMIT 1;
  SELECT id INTO v_reportes FROM users
   WHERE (COALESCE(roles,'{}') && ARRAY['REPORTES','ADMIN_PUNTO','ENCARGADO_PUNTO','PASTOR'] OR role::text IN ('REPORTES','ADMIN_PUNTO','ENCARGADO_PUNTO','PASTOR'))
     AND NOT ('SUPER_ADMIN' = ANY(COALESCE(roles,'{}')) OR role::text = 'SUPER_ADMIN')
   LIMIT 1;
  SELECT id INTO v_influos FROM users WHERE role::text = 'INFLUOS' OR 'INFLUOS' = ANY(COALESCE(roles,'{}')) LIMIT 1;
  SELECT id INTO v_eventos FROM users
   WHERE role::text IN ('ENCARGADO_EVENTOS','EVENTOS') OR COALESCE(roles,'{}') && ARRAY['ENCARGADO_EVENTOS','EVENTOS'] LIMIT 1;
  SELECT id, email, phone INTO v_objetivo, v_obj_email, v_obj_phone FROM users
   WHERE email IS NOT NULL AND COALESCE(phone,'') <> '' AND id NOT IN (v_viewer, v_host) ORDER BY created_at LIMIT 1;

  IF v_viewer IS NULL OR v_host IS NULL OR v_objetivo IS NULL THEN
    RAISE EXCEPTION 'Faltan usuarios para armar la prueba';
  END IF;

  -- ── datos descartables ───────────────────────────────────────────────────
  INSERT INTO influos_attendees (first_name, last_name, tribe, is_first_time, phone, age)
    VALUES ('  __Álvaro  José', '__PÉREZ', 'Garra (naranja)', true, '1100000000', 14);
  INSERT INTO dpadre_familias (padre_nombre, padre_apellido, total_points)
    VALUES ('__Prueba', '__Padre', 0) RETURNING id INTO f_id;
  INSERT INTO dpadre_hijos (familia_id, nombre, apellido) VALUES (f_id, '__Hijo', '__Prueba');

  -- ═══════════════════════════════ INFLUOS ═════════════════════════════════
  -- 1. búsqueda pública de tribu, como anon
  tot := tot + 1;
  DECLARE exacta text; nombre text; parcial int; sin_tildes text;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'anon', true);
    EXECUTE 'SET LOCAL ROLE anon';
    SELECT tribe, first_name INTO exacta, nombre FROM buscar_tribu_influos('__álvaro josé', '__Pérez');
    SELECT tribe INTO sin_tildes FROM buscar_tribu_influos('__ALVARO   JOSE', '__perez ');
    SELECT count(*) INTO parcial FROM buscar_tribu_influos('__Álv', '__Pér');
    EXECUTE 'RESET ROLE';
    IF nombre = '  __Álvaro  José' AND exacta = 'Garra (naranja)' AND sin_tildes = 'Garra (naranja)' AND parcial = 0 THEN
      ok := ok + 1; res := res || ' 1 OK    Influos sin sesión: encuentra por nombre exacto (sin importar tildes, espacios ni mayúsculas) y NO por fragmentos'::text;
    ELSE
      res := res || format(' 1 FALLA Influos: encontrado=%s tribu=%s sin_tildes=%s parcial=%s', nombre, exacta, sin_tildes, parcial);
    END IF;
  EXCEPTION WHEN OTHERS THEN res := res || (' 1 FALLA Influos búsqueda -> ' || SQLERRM);
  END;
  EXECUTE 'RESET ROLE';

  -- 2. [cierre] la tabla de inscriptos solo la ve el staff de Influos
  tot := tot + 1;
  DECLARE ve_viewer int; ve_staff int;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_viewer::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO ve_viewer FROM influos_attendees;
    EXECUTE 'RESET ROLE';
    IF v_influos IS NOT NULL THEN
      PERFORM set_config('request.jwt.claim.sub', v_influos::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      SELECT count(*) INTO ve_staff FROM influos_attendees;
      EXECUTE 'RESET ROLE';
    END IF;
    IF ve_viewer = 0 AND (v_influos IS NULL OR ve_staff > 0) THEN
      ok := ok + 1; res := res || format(' 2 OK    influos_attendees: usuario común ve 0; staff de Influos ve %s', COALESCE(ve_staff::text, 'sin actor'));
    ELSE
      res := res || format(' 2 FALLA [cierre] influos_attendees: usuario común ve %s, staff ve %s', ve_viewer, ve_staff);
    END IF;
  EXCEPTION WHEN OTHERS THEN res := res || (' 2 FALLA influos tabla -> ' || SQLERRM);
  END;
  EXECUTE 'RESET ROLE';

  -- ═════════════════════════════ DÍA DEL PADRE ═════════════════════════════
  -- 3. anon: ranking e inscripción siguen; los hijos no se leen
  tot := tot + 1;
  DECLARE fam int; hijos_vis int; emb int; nueva uuid;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'anon', true);
    EXECUTE 'SET LOCAL ROLE anon';
    SELECT count(*) INTO fam FROM dpadre_familias;
    SELECT count(*) INTO hijos_vis FROM dpadre_hijos;
    INSERT INTO dpadre_familias (padre_nombre, padre_apellido, total_points) VALUES ('__PruebaAnon', '__Padre', 0) RETURNING id INTO nueva;
    INSERT INTO dpadre_hijos (familia_id, nombre, apellido) VALUES (nueva, '__HijoAnon', '__Prueba');
    EXECUTE 'RESET ROLE';
    IF fam > 0 AND hijos_vis = 0 AND nueva IS NOT NULL THEN
      ok := ok + 1; res := res || format(' 3 OK    Día del Padre sin sesión: ve %s familias, 0 hijos, y la inscripción (familia + hijo) sigue funcionando', fam);
    ELSE
      res := res || format(' 3 FALLA Día del Padre anon: familias=%s hijos=%s inscripción=%s', fam, hijos_vis, nueva IS NOT NULL);
    END IF;
  EXCEPTION WHEN OTHERS THEN res := res || (' 3 FALLA Día del Padre anon -> ' || SQLERRM);
  END;
  EXECUTE 'RESET ROLE';

  -- 4. staff de eventos sí ve los hijos; usuario común no
  tot := tot + 1;
  DECLARE ve_viewer int; ve_staff int;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_viewer::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO ve_viewer FROM dpadre_hijos;
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', COALESCE(v_eventos, (SELECT id FROM users WHERE 'SUPER_ADMIN' = ANY(COALESCE(roles,'{}')) LIMIT 1))::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO ve_staff FROM dpadre_hijos;
    EXECUTE 'RESET ROLE';
    IF ve_viewer = 0 AND ve_staff > 0 THEN
      ok := ok + 1; res := res || format(' 4 OK    dpadre_hijos: usuario común ve 0; staff de eventos ve %s', ve_staff);
    ELSE
      res := res || format(' 4 FALLA dpadre_hijos: común ve %s, staff ve %s', ve_viewer, ve_staff);
    END IF;
  EXCEPTION WHEN OTHERS THEN res := res || (' 4 FALLA dpadre_hijos staff -> ' || SQLERRM);
  END;
  EXECUTE 'RESET ROLE';

  -- ═══════════════════════════════ PERFILES ════════════════════════════════
  -- 5. [cierre] users: común y anfitrión ven solo su fila; Reportes ve todos
  tot := tot + 1;
  DECLARE ve_viewer int; ve_host int; ve_rep int;
  BEGIN
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_viewer::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO ve_viewer FROM users;
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', v_host::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO ve_host FROM users;
    EXECUTE 'RESET ROLE';
    IF v_reportes IS NOT NULL THEN
      PERFORM set_config('request.jwt.claim.sub', v_reportes::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      SELECT count(*) INTO ve_rep FROM users;
      EXECUTE 'RESET ROLE';
    END IF;
    IF ve_viewer = 1 AND ve_host = 1 AND (v_reportes IS NULL OR ve_rep > 100) THEN
      ok := ok + 1; res := res || format(' 5 OK    users: usuario común ve 1 (el suyo), anfitrión ve 1, staff de reportes ve %s', COALESCE(ve_rep::text, 'sin actor'));
    ELSE
      res := res || format(' 5 FALLA [cierre] users: común ve %s, anfitrión ve %s, reportes ve %s', ve_viewer, ve_host, ve_rep);
    END IF;
  EXCEPTION WHEN OTHERS THEN res := res || (' 5 FALLA users -> ' || SQLERRM);
  END;
  EXECUTE 'RESET ROLE';

  -- 6. buscar_personas: usuario común rechazado; anfitrión recibe teléfono
  tot := tot + 1;
  DECLARE rechazado boolean := false; filas int; con_tel int; corto int; comodin int;
  BEGIN
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_viewer::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN
      PERFORM * FROM buscar_personas('a', true, false, 20);
      PERFORM * FROM buscar_personas('ma', true, false, 20);
    EXCEPTION WHEN OTHERS THEN rechazado := SQLERRM LIKE 'No tenés permisos%';
    END;
    EXECUTE 'RESET ROLE';

    PERFORM set_config('request.jwt.claim.sub', v_host::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO corto FROM buscar_personas('a', true, false, 20);
    SELECT count(*), count(*) FILTER (WHERE phone IS NOT NULL) INTO filas, con_tel FROM buscar_personas('ar', true, false, 50);
    SELECT count(*) INTO comodin FROM buscar_personas('%%', true, false, 20);
    EXECUTE 'RESET ROLE';

    IF rechazado AND corto = 0 AND filas BETWEEN 1 AND 20 AND con_tel > 0 AND comodin = 0 THEN
      ok := ok + 1; res := res || format(' 6 OK    buscar_personas: común rechazado; anfitrión recibe %s resultados (tope 20) con teléfono; <2 letras y comodines no listan a nadie', filas);
    ELSE
      res := res || format(' 6 FALLA buscar_personas: común rechazado=%s | 1 letra=%s | resultados=%s con teléfono=%s | "%%%%"=%s', rechazado, corto, filas, con_tel, comodin);
    END IF;
  EXCEPTION WHEN OTHERS THEN res := res || (' 6 FALLA buscar_personas -> ' || SQLERRM);
  END;
  EXECUTE 'RESET ROLE';

  -- 7. buscar_usuario_por_email: común recibe nombre sin teléfono; anfitrión con teléfono
  tot := tot + 1;
  DECLARE nom_viewer text; tel_viewer text; tel_host text;
  BEGIN
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_viewer::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT name, phone INTO nom_viewer, tel_viewer FROM buscar_usuario_por_email(upper(v_obj_email) || ' ');
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', v_host::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT phone INTO tel_host FROM buscar_usuario_por_email(v_obj_email);
    EXECUTE 'RESET ROLE';
    IF nom_viewer IS NOT NULL AND tel_viewer IS NULL AND tel_host = v_obj_phone THEN
      ok := ok + 1; res := res || ' 7 OK    pareja por email: usuario común recibe solo el nombre; anfitrión también el teléfono'::text;
    ELSE
      res := res || format(' 7 FALLA email: común nombre=%s tel=%s | anfitrión tel_ok=%s', nom_viewer IS NOT NULL, tel_viewer IS NOT NULL, tel_host = v_obj_phone);
    END IF;
  EXCEPTION WHEN OTHERS THEN res := res || (' 7 FALLA buscar_usuario_por_email -> ' || SQLERRM);
  END;
  EXECUTE 'RESET ROLE';

  -- 8. search_potential_hosts: usuario común rechazado; anfitrión sí
  tot := tot + 1;
  DECLARE rechazado boolean := false; filas int;
  BEGIN
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_viewer::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN
      PERFORM * FROM search_potential_hosts('ar');
    EXCEPTION WHEN OTHERS THEN rechazado := SQLERRM LIKE 'No tenés permisos%';
    END;
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', v_host::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO filas FROM search_potential_hosts('ar');
    EXECUTE 'RESET ROLE';
    IF rechazado AND filas > 0 THEN
      ok := ok + 1; res := res || format(' 8 OK    search_potential_hosts: usuario común rechazado; anfitrión recibe %s', filas);
    ELSE
      res := res || format(' 8 FALLA search_potential_hosts: común rechazado=%s, anfitrión=%s', rechazado, filas);
    END IF;
  EXCEPTION WHEN OTHERS THEN res := res || (' 8 FALLA search_potential_hosts -> ' || SQLERRM);
  END;
  EXECUTE 'RESET ROLE';

  -- 9. nombres de quien ofrece una transferencia
  tot := tot + 1;
  BEGIN
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_viewer::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT name INTO t FROM nombres_de_usuarios(ARRAY[v_objetivo]);
    EXECUTE 'RESET ROLE';
    IF t IS NOT NULL THEN
      ok := ok + 1; res := res || ' 9 OK    nombres_de_usuarios devuelve el nombre de quien ofrece la transferencia'::text;
    ELSE
      res := res || ' 9 FALLA nombres_de_usuarios no devolvió el nombre'::text;
    END IF;
  EXCEPTION WHEN OTHERS THEN res := res || (' 9 FALLA nombres_de_usuarios -> ' || SQLERRM);
  END;
  EXECUTE 'RESET ROLE';

  -- 10. permisos de ejecución
  tot := tot + 1;
  IF has_function_privilege('anon', 'public.buscar_tribu_influos(text, text)', 'EXECUTE')
     AND NOT has_function_privilege('anon', 'public.buscar_personas(text, boolean, boolean, integer)', 'EXECUTE')
     AND NOT has_function_privilege('anon', 'public.buscar_usuario_por_email(text)', 'EXECUTE')
     AND NOT has_function_privilege('anon', 'public.nombres_de_usuarios(uuid[])', 'EXECUTE')
     AND NOT has_function_privilege('anon', 'public.search_potential_hosts(text)', 'EXECUTE') THEN
    ok := ok + 1; res := res || '10 OK    sin sesión solo se puede usar la búsqueda de tribu'::text;
  ELSE
    res := res || '10 FALLA permisos de ejecución para anon'::text;
  END IF;

  RAISE EXCEPTION E'\n\n==== RESULTADO FASE 2a: % de % OK ====\n%\n\n(Este ERROR es a propósito: deshace todo lo que hizo la prueba.)',
    ok, tot, array_to_string(res, E'\n');
END
$prueba$;
