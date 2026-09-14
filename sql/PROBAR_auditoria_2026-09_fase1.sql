-- ============================================================================
-- Prueba de la FASE 1 de la auditoría — segura de correr en producción.
--
-- Simula requests reales: cambia a los roles de base anon / authenticated
-- (como hace PostgREST) y fija auth.uid() con el claim del JWT. Así se prueban
-- a la vez las políticas RLS, los permisos de ejecución, el trigger de users
-- y la lógica de cada función.
--
-- Crea grupos, inscripciones y visitantes descartables. AL FINAL TIRA UN
-- ERROR A PROPÓSITO para que Postgres deshaga todo: datos de prueba, cambios
-- de roles, audit_logs, notificaciones y webhooks encolados. El resultado
-- viene en el texto del error.
--
-- Correr después de auditoria_2026-09_fase1_seguridad.sql. Antes de aplicarla
-- sirve para ver los agujeros: la mayoría de los casos falla.
-- ============================================================================
DO $prueba$
DECLARE
  priv text[] := ARRAY['SUPER_ADMIN','ADMIN_GROUPS','PASTOR','ENCARGADO_GRUPOS','ENCARGADO_BIENVENIDA',
                       'VOLUNTARIO_BIENVENIDA','COORDINATOR','ANFITRION','CO_ANFITRION','PRODE',
                       'ENCARGADO_EVENTOS','ADMIN_STORE','ADMIN_PUNTO','ENCARGADO_PUNTO','REPORTES',
                       'INFLUOS','ADMIN_CUIDADO_PASTORAL','EVENTOS','ENCARGADO_NINEZ','ACREDITACION'];
  -- actores
  v_viewer uuid; v_host_a uuid; v_cohost_a uuid; v_host_b uuid;
  v_admin_gcx uuid; v_super_array uuid; v_super uuid; v_coord uuid;
  v_enum uuid; v_bienv uuid;
  -- datos
  g_a text; g_b text; g_c text; g_d text;
  r_a1 text; r_a2 text; r_b text;
  w_ok uuid; w_avanzado uuid;
  -- auxiliares
  u public.users%ROWTYPE; u2 public.users%ROWTYPE;
  n int; t text; b boolean;
  res text[] := '{}'; ok int := 0; tot int := 0;
BEGIN
  -- ── actores reales ───────────────────────────────────────────────────────
  SELECT id INTO v_viewer FROM users WHERE role::text IN ('VIEWER','USUARIO') AND NOT (COALESCE(roles,'{}') && priv) ORDER BY created_at LIMIT 1;
  -- Anfitrión del grupo A: un ANFITRION real (rol singular), no admin. La
  -- versión vieja de manage_group_registration_v3 y bulk_remove_group_members
  -- autorizaba a cualquier ANFITRION/CO_ANFITRION sobre cualquier grupo; con
  -- un usuario común los casos 8 y 11 no distinguirían antes de después.
  SELECT id INTO v_host_a FROM users WHERE role::text = 'ANFITRION'
     AND NOT (COALESCE(roles,'{}') && ARRAY['SUPER_ADMIN','ADMIN_GROUPS','ENCARGADO_GRUPOS','PASTOR'])
     AND id <> v_viewer ORDER BY created_at LIMIT 1;
  SELECT id INTO v_cohost_a FROM users WHERE role::text IN ('VIEWER','USUARIO') AND NOT (COALESCE(roles,'{}') && priv) AND id NOT IN (v_viewer, v_host_a) ORDER BY created_at LIMIT 1;
  SELECT id INTO v_host_b FROM users WHERE role::text IN ('VIEWER','USUARIO') AND NOT (COALESCE(roles,'{}') && priv) AND id NOT IN (v_viewer, v_host_a, v_cohost_a) ORDER BY created_at LIMIT 1;
  SELECT id INTO v_admin_gcx FROM users WHERE (role::text = 'ADMIN_GROUPS' OR 'ADMIN_GROUPS' = ANY(COALESCE(roles,'{}'))) AND NOT ('SUPER_ADMIN' = ANY(COALESCE(roles,'{}')) OR role::text = 'SUPER_ADMIN') LIMIT 1;
  SELECT id INTO v_super_array FROM users WHERE 'SUPER_ADMIN' = ANY(COALESCE(roles,'{}')) AND role::text <> 'SUPER_ADMIN' LIMIT 1;
  SELECT id INTO v_super FROM users WHERE role::text = 'SUPER_ADMIN' OR 'SUPER_ADMIN' = ANY(COALESCE(roles,'{}')) LIMIT 1;
  SELECT id INTO v_coord FROM users WHERE role::text = 'COORDINATOR' AND NOT (COALESCE(roles,'{}') && ARRAY['SUPER_ADMIN','ADMIN_GROUPS','ANFITRION']) LIMIT 1;
  SELECT id INTO v_enum FROM users WHERE COALESCE(roles,'{}') && ARRAY['PRODE','ADMIN_CUIDADO_PASTORAL'] AND NOT (COALESCE(roles,'{}') && ARRAY['SUPER_ADMIN','ADMIN_GROUPS','ENCARGADO_GRUPOS']) LIMIT 1;
  SELECT id INTO v_bienv FROM users WHERE role::text = 'ENCARGADO_BIENVENIDA' OR 'ENCARGADO_BIENVENIDA' = ANY(COALESCE(roles,'{}')) LIMIT 1;

  IF v_viewer IS NULL OR v_host_a IS NULL OR v_cohost_a IS NULL OR v_host_b IS NULL OR v_admin_gcx IS NULL OR v_super IS NULL THEN
    RAISE EXCEPTION 'Faltan usuarios para armar la prueba';
  END IF;

  -- ── datos descartables (como postgres) ──────────────────────────────────
  INSERT INTO groups (name, leader_name, status, host_id, co_host_id) VALUES ('__PRUEBA_A__','Prueba','approved', v_host_a, v_cohost_a) RETURNING id INTO g_a;
  INSERT INTO groups (name, leader_name, status, host_id)             VALUES ('__PRUEBA_B__','Prueba','approved', v_host_b) RETURNING id INTO g_b;
  INSERT INTO groups (name, leader_name, status, host_id)             VALUES ('__PRUEBA_C__','Prueba','approved', COALESCE(v_enum, v_host_b)) RETURNING id INTO g_c;
  INSERT INTO groups (name, leader_name, status, host_id)             VALUES ('__PRUEBA_D__','Prueba','approved', v_host_b) RETURNING id INTO g_d;
  INSERT INTO group_registrations (group_id, first_name, last_name, status) VALUES (g_a, '__Prueba','A1','PENDING') RETURNING id INTO r_a1;
  INSERT INTO group_registrations (group_id, first_name, last_name, status) VALUES (g_a, '__Prueba','A2','PENDING') RETURNING id INTO r_a2;
  INSERT INTO group_registrations (group_id, first_name, last_name, status) VALUES (g_b, '__Prueba','B','PENDING')  RETURNING id INTO r_b;
  INSERT INTO welcome_visitors (first_name, last_name, phone, stage) VALUES ('__Prueba', '__Bienvenida', '+54 9 11 5555-0101', 'NEW') RETURNING id INTO w_ok;
  INSERT INTO welcome_visitors (first_name, last_name, phone, stage) VALUES ('__Prueba', '__Avanzado', '+54 9 11 5555-0202', 'SECOND_CONTACT') RETURNING id INTO w_avanzado;

  -- ═════════════════════════════ USERS ═════════════════════════════════════
  -- 1. usuario común intenta darse SUPER_ADMIN por PATCH directo
  tot := tot + 1;
  BEGIN
    SELECT * INTO u FROM users WHERE id = v_viewer;
    PERFORM set_config('request.jwt.claim.sub', v_viewer::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE users SET role = 'SUPER_ADMIN', roles = ARRAY['SUPER_ADMIN'], email = 'hack@prueba.x',
                     is_active = NOT COALESCE(is_active, true), phone = '__TEL_PRUEBA__'
    WHERE id = v_viewer;
    EXECUTE 'RESET ROLE';
    SELECT * INTO u2 FROM users WHERE id = v_viewer;
    IF u2.role = u.role AND u2.roles IS NOT DISTINCT FROM u.roles AND u2.email IS NOT DISTINCT FROM u.email
       AND u2.is_active IS NOT DISTINCT FROM u.is_active AND u2.phone = '__TEL_PRUEBA__' THEN
      ok := ok + 1; res := res || ' 1 OK    usuario común NO puede darse roles (role, roles, email, is_active intactos) y SÍ edita su teléfono'::text;
    ELSE
      res := res || format(' 1 FALLA escalada: role=%s roles=%s email_cambió=%s phone=%s', u2.role, u2.roles, u2.email IS DISTINCT FROM u.email, u2.phone);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    res := res || (' 1 FALLA usuario común -> ' || SQLERRM);
  END;
  EXECUTE 'RESET ROLE';

  -- 2. SUPER_ADMIN que lo es sólo por roles[] edita roles de otro usuario
  IF v_super_array IS NULL THEN
    res := res || ' 2 --    no hay SUPER_ADMIN sólo por roles[]: no aplicable'::text;
  ELSE
    tot := tot + 1;
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', v_super_array::text, true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      UPDATE users SET roles = array_append(COALESCE(roles,'{}'), 'VOLUNTARIO_INFO') WHERE id = v_viewer;
      GET DIAGNOSTICS n = ROW_COUNT;
      EXECUTE 'RESET ROLE';
      SELECT * INTO u2 FROM users WHERE id = v_viewer;
      IF n = 1 AND 'VOLUNTARIO_INFO' = ANY(u2.roles) THEN
        ok := ok + 1; res := res || ' 2 OK    SUPER_ADMIN por roles[] puede editar roles de otro usuario desde el panel'::text;
      ELSE
        res := res || format(' 2 FALLA SUPER_ADMIN por array: filas=%s roles=%s', n, u2.roles);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      res := res || (' 2 FALLA SUPER_ADMIN por array -> ' || SQLERRM);
    END;
    EXECUTE 'RESET ROLE';
  END IF;

  -- ═════════════════════════ ASIGNACIÓN DE ROLES ═══════════════════════════
  -- 3. admin de GCX intenta darse SUPER_ADMIN con admin_toggle_user_role
  tot := tot + 1;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_admin_gcx::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM admin_toggle_user_role(v_admin_gcx, 'SUPER_ADMIN', true);
    EXECUTE 'RESET ROLE';
    res := res || ' 3 FALLA un ADMIN_GROUPS pudo asignarse SUPER_ADMIN'::text;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Only SUPER_ADMIN%' THEN
      ok := ok + 1; res := res || ' 3 OK    ADMIN_GROUPS NO puede asignarse SUPER_ADMIN (admin_toggle_user_role)'::text;
    ELSE
      res := res || (' 3 FALLA error inesperado -> ' || SQLERRM);
    END IF;
  END;
  EXECUTE 'RESET ROLE';

  -- 4. admin de GCX hace anfitrión a un coordinador: no le pisa el rol singular
  IF v_coord IS NULL THEN
    res := res || ' 4 --    no hay coordinador sin otros roles de GCX: no aplicable'::text;
  ELSE
    tot := tot + 1;
    BEGIN
      SELECT * INTO u FROM users WHERE id = v_coord;
      PERFORM set_config('request.jwt.claim.sub', v_admin_gcx::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      PERFORM admin_toggle_user_role(v_coord, 'ANFITRION', true);
      EXECUTE 'RESET ROLE';
      SELECT * INTO u2 FROM users WHERE id = v_coord;
      IF 'ANFITRION' = ANY(u2.roles) AND u2.role = u.role THEN
        ok := ok + 1; res := res || format(' 4 OK    asignar ANFITRION agrega el rol y conserva el singular (%s)', u2.role);
      ELSE
        res := res || format(' 4 FALLA toggle: roles=%s role antes=%s después=%s', u2.roles, u.role, u2.role);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      res := res || (' 4 FALLA toggle ANFITRION -> ' || SQLERRM);
    END;
    EXECUTE 'RESET ROLE';
  END IF;

  -- 5. SUPER_ADMIN asigna COORDINATOR (antes: "No tenés permisos")
  tot := tot + 1;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', COALESCE(v_super_array, v_super)::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM admin_assign_role(v_host_b, 'COORDINATOR', NULL, ARRAY['MUJERES']);
    EXECUTE 'RESET ROLE';
    SELECT * INTO u2 FROM users WHERE id = v_host_b;
    IF 'COORDINATOR' = ANY(u2.roles) AND 'MUJERES' = ANY(u2.coordinator_variants) THEN
      ok := ok + 1; res := res || ' 5 OK    SUPER_ADMIN puede asignar COORDINATOR con su categoría'::text;
    ELSE
      res := res || format(' 5 FALLA assign COORDINATOR: roles=%s variantes=%s', u2.roles, u2.coordinator_variants);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    res := res || (' 5 FALLA SUPER_ADMIN asigna COORDINATOR -> ' || SQLERRM);
  END;
  EXECUTE 'RESET ROLE';

  -- 6. admin de GCX intenta asignar PASTOR
  tot := tot + 1;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_admin_gcx::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM admin_assign_role(v_viewer, 'PASTOR', NULL, NULL);
    EXECUTE 'RESET ROLE';
    res := res || ' 6 FALLA un ADMIN_GROUPS pudo asignar PASTOR'::text;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Solo SUPER_ADMIN%' OR SQLERRM LIKE '%fuera de tu alcance%' THEN
      ok := ok + 1; res := res || ' 6 OK    ADMIN_GROUPS NO puede asignar roles fuera de GCX (admin_assign_role)'::text;
    ELSE
      res := res || (' 6 FALLA error inesperado -> ' || SQLERRM);
    END IF;
  END;
  EXECUTE 'RESET ROLE';

  -- 7. admin de GCX intenta quitarle SUPER_ADMIN a un super admin
  tot := tot + 1;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_admin_gcx::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM admin_remove_role(v_super, 'SUPER_ADMIN');
    EXECUTE 'RESET ROLE';
    res := res || ' 7 FALLA un ADMIN_GROUPS pudo quitar SUPER_ADMIN'::text;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%fuera de tu alcance%' THEN
      ok := ok + 1; res := res || ' 7 OK    ADMIN_GROUPS NO puede quitar SUPER_ADMIN (admin_remove_role)'::text;
    ELSE
      res := res || (' 7 FALLA error inesperado -> ' || SQLERRM);
    END IF;
  END;
  EXECUTE 'RESET ROLE';

  -- ══════════════════════════ INSCRIPCIONES GCX ════════════════════════════
  -- 8. anfitrión del grupo A intenta aprobar una inscripción del grupo B
  tot := tot + 1;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_host_a::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM manage_group_registration_v3(r_b, 'APPROVED');
    EXECUTE 'RESET ROLE';
    res := res || ' 8 FALLA un anfitrión aprobó una inscripción de OTRO grupo'::text;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Access Denied%' THEN
      ok := ok + 1; res := res || ' 8 OK    anfitrión NO puede aprobar inscripciones de otro grupo'::text;
    ELSE
      res := res || (' 8 FALLA error inesperado -> ' || SQLERRM);
    END IF;
  END;
  EXECUTE 'RESET ROLE';

  -- 9. co-anfitrión aprueba una inscripción de SU grupo
  tot := tot + 1;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_cohost_a::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM manage_group_registration_v3(r_a1, 'APPROVED');
    EXECUTE 'RESET ROLE';
    SELECT status INTO t FROM group_registrations WHERE id = r_a1;
    IF t = 'APPROVED' THEN
      ok := ok + 1; res := res || ' 9 OK    co-anfitrión aprueba inscripciones de su grupo'::text;
    ELSE
      res := res || format(' 9 FALLA co-anfitrión: status=%s', t);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    res := res || (' 9 FALLA co-anfitrión aprueba -> ' || SQLERRM);
  END;
  EXECUTE 'RESET ROLE';

  -- 10. estado inválido
  tot := tot + 1;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_host_a::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM manage_group_registration_v3(r_a2, 'CUALQUIERA');
    EXECUTE 'RESET ROLE';
    res := res || '10 FALLA se aceptó un estado inválido'::text;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Invalid registration status%' THEN
      ok := ok + 1; res := res || '10 OK    estado de inscripción inválido: rechazado'::text;
    ELSE
      res := res || ('10 FALLA error inesperado -> ' || SQLERRM);
    END IF;
  END;
  EXECUTE 'RESET ROLE';

  -- 11. anfitrión de A intenta borrar en lote [A, B]
  tot := tot + 1;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_host_a::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM bulk_remove_group_members(ARRAY[r_a2, r_b]);
    EXECUTE 'RESET ROLE';
    res := res || '11 FALLA un anfitrión borró inscriptos de OTRO grupo en lote'::text;
  EXCEPTION WHEN OTHERS THEN
    SELECT count(*) INTO n FROM group_registrations WHERE id IN (r_a2, r_b);
    IF SQLERRM LIKE 'Access Denied%' AND n = 2 THEN
      ok := ok + 1; res := res || '11 OK    borrado en lote valida CADA inscripción; no borró nada'::text;
    ELSE
      res := res || format('11 FALLA lote: quedaron %s de 2 -> %s', n, SQLERRM);
    END IF;
  END;
  EXECUTE 'RESET ROLE';

  -- ═══════════════════════════ GRUPOS GCX ══════════════════════════════════
  -- 12. anfitrión con rol fuera del enum bloquea el cupo de su grupo
  IF v_enum IS NULL THEN
    res := res || '12 --    no hay usuarios con PRODE / ADMIN_CUIDADO_PASTORAL fuera de GCX: no aplicable'::text;
  ELSE
    tot := tot + 1;
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', v_enum::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      PERFORM toggle_group_capacity_lock(g_c, true);
      EXECUTE 'RESET ROLE';
      SELECT capacity_locked INTO b FROM groups WHERE id = g_c;
      IF b THEN
        ok := ok + 1; res := res || '12 OK    usuario con PRODE/ADMIN_CUIDADO_PASTORAL ya no hace explotar toggle_group_capacity_lock'::text;
      ELSE
        res := res || '12 FALLA capacity_locked no cambió'::text;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      res := res || ('12 FALLA toggle con rol fuera del enum -> ' || SQLERRM);
    END;
    EXECUTE 'RESET ROLE';
  END IF;

  -- 13. admin de GCX elimina un grupo (la app le muestra el botón)
  tot := tot + 1;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_admin_gcx::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM admin_delete_group(g_d);
    EXECUTE 'RESET ROLE';
    SELECT count(*) INTO n FROM groups WHERE id = g_d;
    IF n = 0 THEN
      ok := ok + 1; res := res || '13 OK    ADMIN_GROUPS puede eliminar grupos (alineado con /admingcx)'::text;
    ELSE
      res := res || '13 FALLA el grupo sigue existiendo'::text;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    res := res || ('13 FALLA admin_delete_group -> ' || SQLERRM);
  END;
  EXECUTE 'RESET ROLE';

  -- ═══════════════════════════ APP_CONFIG ══════════════════════════════════
  -- 14. anon lee pero no escribe; usuario común no escribe; admin GCX sí
  tot := tot + 1;
  DECLARE lee_anon int; esc_anon int; esc_viewer int; esc_admin int;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'anon', true);
    EXECUTE 'SET LOCAL ROLE anon';
    SELECT count(*) INTO lee_anon FROM app_config;
    UPDATE app_config SET config = config WHERE true;
    GET DIAGNOSTICS esc_anon = ROW_COUNT;
    EXECUTE 'RESET ROLE';

    PERFORM set_config('request.jwt.claim.sub', v_viewer::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE app_config SET config = config WHERE true;
    GET DIAGNOSTICS esc_viewer = ROW_COUNT;
    EXECUTE 'RESET ROLE';

    PERFORM set_config('request.jwt.claim.sub', v_admin_gcx::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE app_config SET config = config WHERE true;
    GET DIAGNOSTICS esc_admin = ROW_COUNT;
    EXECUTE 'RESET ROLE';

    IF lee_anon > 0 AND esc_anon = 0 AND esc_viewer = 0 AND esc_admin > 0 THEN
      ok := ok + 1; res := res || format('14 OK    app_config: anon lee %s filas y escribe 0; usuario común escribe 0; admin GCX escribe %s', lee_anon, esc_admin);
    ELSE
      res := res || format('14 FALLA app_config: anon lee=%s escribe=%s | común escribe=%s | admin escribe=%s', lee_anon, esc_anon, esc_viewer, esc_admin);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    res := res || ('14 FALLA app_config -> ' || SQLERRM);
  END;
  EXECUTE 'RESET ROLE';

  -- ═══════════════════════════ BIENVENIDA ══════════════════════════════════
  -- 15. formulario público vía completar_formulario_bienvenida, como anon
  tot := tot + 1;
  DECLARE r1 text; r2 text; r3 text; st public.visitor_stage;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'anon', true);
    EXECUTE 'SET LOCAL ROLE anon';
    r1 := completar_formulario_bienvenida('  __prueba ', '__BIENVENIDA', '5491155550101', 'a@b.c', 'bien', true, ARRAY['grupos'], 'x');
    r2 := completar_formulario_bienvenida('__Prueba', '__Bienvenida', '5491199999999', 'a@b.c', 'bien', true, NULL, NULL);
    r3 := completar_formulario_bienvenida('__Prueba', '__Avanzado', '1155550202', 'a@b.c', 'bien', true, NULL, NULL);
    EXECUTE 'RESET ROLE';
    SELECT stage INTO st FROM welcome_visitors WHERE id = w_ok;
    IF r1 = 'OK' AND st = 'FILLED_FORM' AND r2 = 'NO_ENCONTRADO' AND r3 = 'YA_PROCESADO' THEN
      ok := ok + 1; res := res || '15 OK    formulario público: encuentra ignorando espacios/mayúsculas, rechaza teléfono ajeno, no toca etapas avanzadas'::text;
    ELSE
      res := res || format('15 FALLA formulario: correcto=%s etapa=%s | tel ajeno=%s | avanzado=%s', r1, st, r2, r3);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    res := res || ('15 FALLA formulario público -> ' || SQLERRM);
  END;
  EXECUTE 'RESET ROLE';

  -- 16. staff: usuario común no ve visitantes; equipo de Bienvenida sí
  tot := tot + 1;
  DECLARE ve_viewer int; ve_bienv int; ve_anon int;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_viewer::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO ve_viewer FROM welcome_visitors;
    EXECUTE 'RESET ROLE';

    PERFORM set_config('request.jwt.claim.sub', v_bienv::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO ve_bienv FROM welcome_visitors;
    EXECUTE 'RESET ROLE';

    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'anon', true);
    EXECUTE 'SET LOCAL ROLE anon';
    SELECT count(*) INTO ve_anon FROM welcome_visitors;
    EXECUTE 'RESET ROLE';

    IF ve_viewer = 0 AND ve_bienv > 0 THEN
      ok := ok + 1; res := res || format('16 OK    welcome_visitors: usuario común ve 0, equipo de Bienvenida ve %s  [anon ve %s: tiene que dar 0 después del cierre]', ve_bienv, ve_anon);
    ELSE
      res := res || format('16 FALLA welcome_visitors: común ve %s, bienvenida ve %s, anon ve %s', ve_viewer, ve_bienv, ve_anon);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    res := res || ('16 FALLA welcome_visitors staff -> ' || SQLERRM);
  END;
  EXECUTE 'RESET ROLE';

  -- ═════════════════════════════ BAJAS ═════════════════════════════════════
  -- 17. un coordinador ve las solicitudes de baja
  IF v_coord IS NULL THEN
    res := res || '17 --    no hay coordinador para probar: no aplicable'::text;
  ELSE
    tot := tot + 1;
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', v_coord::text, true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      SELECT count(*) INTO n FROM group_dropout_requests;
      EXECUTE 'RESET ROLE';
      IF n > 0 THEN
        ok := ok + 1; res := res || format('17 OK    COORDINATOR ve las solicitudes de baja (%s)', n);
      ELSE
        res := res || '17 FALLA COORDINATOR sigue sin ver bajas'::text;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      res := res || ('17 FALLA bajas coordinador -> ' || SQLERRM);
    END;
    EXECUTE 'RESET ROLE';
  END IF;

  -- ═════════════════════════ NOTIFICACIONES ════════════════════════════════
  -- 18. un grupo nuevo pendiente avisa también al SUPER_ADMIN por roles[]
  IF v_super_array IS NULL THEN
    res := res || '18 --    no hay SUPER_ADMIN sólo por roles[]: no aplicable'::text;
  ELSE
    tot := tot + 1;
    BEGIN
      INSERT INTO groups (name, leader_name, status, host_id) VALUES ('__PRUEBA_NOTIF__', 'Prueba', 'pending', v_host_b);
      SELECT count(*) INTO n FROM notifications
      WHERE user_id = v_super_array AND metadata->>'group_name' = '__PRUEBA_NOTIF__';
      IF n = 1 THEN
        ok := ok + 1; res := res || '18 OK    "Nueva solicitud de grupo" llega también a los admins por roles[]'::text;
      ELSE
        res := res || format('18 FALLA notificación al admin por array: %s', n);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      res := res || ('18 FALLA notificación -> ' || SQLERRM);
    END;
  END IF;

  -- ═══════════════════════════ PERMISOS ════════════════════════════════════
  -- 19. funciones que no deben poder llamarse sin sesión
  tot := tot + 1;
  IF NOT has_function_privilege('anon', 'public.get_couple_registration_status(uuid, uuid, text)', 'EXECUTE')
     AND NOT has_function_privilege('authenticated', 'public.get_couple_registration_status(uuid, uuid, text)', 'EXECUTE')
     AND NOT has_function_privilege('anon', 'public.bulk_remove_group_members(text[])', 'EXECUTE')
     AND NOT has_function_privilege('anon', 'public.toggle_group_capacity_lock(text, boolean)', 'EXECUTE')
     AND NOT has_function_privilege('anon', 'public.toggle_group_visibility(text, boolean)', 'EXECUTE')
     AND has_function_privilege('anon', 'public.completar_formulario_bienvenida(text, text, text, text, text, boolean, text[], text)', 'EXECUTE')
     AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
                     WHERE s.nspname = 'public' AND p.proname = 'admin_assign_role' AND p.pronargs = 2) THEN
    ok := ok + 1; res := res || '19 OK    permisos de ejecución: anon no llama funciones de gestión; sobrecarga vieja de admin_assign_role eliminada'::text;
  ELSE
    res := res || '19 FALLA permisos de ejecución (ver has_function_privilege de cada función)'::text;
  END IF;

  RAISE EXCEPTION E'\n\n==== RESULTADO FASE 1: % de % OK ====\n%\n\n(Este ERROR es a propósito: deshace todo lo que hizo la prueba. No queda ningún dato de prueba ni cambio de roles.)',
    ok, tot, array_to_string(res, E'\n');
END
$prueba$;
