-- ============================================================================
-- Prueba de admin_update_group_v2 — segura de correr en producción.
--
-- Crea tres grupos descartables, llama la función haciéndose pasar por un
-- anfitrión, un co-anfitrión, un usuario ajeno, un admin y "sin sesión", y
-- compara lo que quedó guardado con lo esperado.
--
-- AL FINAL TIRA UN ERROR A PROPÓSITO. Ese error hace que Postgres deshaga
-- todo lo que hizo la prueba: los grupos descartables, las entradas de
-- audit_logs, las notificaciones y los webhooks encolados (pg_net sólo envía
-- lo que se confirma). El resultado viene en el texto del error.
--
-- Sirve antes y después del arreglo: antes, los casos del anfitrión fallan
-- con 'Unauthorized: admin role required'.
-- ============================================================================
DO $prueba$
DECLARE
  admins  text[] := ARRAY['SUPER_ADMIN','PASTOR','ADMIN_GROUPS','ENCARGADO_GRUPOS'];
  v_host uuid; v_cohost uuid; v_extrano uuid; v_admin uuid; v_admin_enum uuid;
  g_ok text; g_pend text; g_rech text;
  r   public.groups%ROWTYPE;
  res text[] := '{}';
  ok  int := 0;
  tot int := 0;
BEGIN
  -- ── actores reales ───────────────────────────────────────────────────────
  SELECT id INTO v_host FROM users
   WHERE (role::text = 'ANFITRION' OR 'ANFITRION' = ANY(COALESCE(roles,'{}')))
     AND NOT (role::text = ANY(admins) OR COALESCE(roles,'{}') && admins)
   LIMIT 1;
  SELECT id INTO v_cohost FROM users
   WHERE id <> v_host AND NOT (role::text = ANY(admins) OR COALESCE(roles,'{}') && admins)
   LIMIT 1;
  SELECT id INTO v_extrano FROM users
   WHERE id NOT IN (v_host, v_cohost) AND NOT (role::text = ANY(admins) OR COALESCE(roles,'{}') && admins)
   LIMIT 1;
  SELECT id INTO v_admin FROM users
   WHERE role::text = 'ADMIN_GROUPS' OR 'ADMIN_GROUPS' = ANY(COALESCE(roles,'{}'))
   LIMIT 1;
  SELECT id INTO v_admin_enum FROM users
   WHERE (role::text = ANY(admins) OR COALESCE(roles,'{}') && admins)
     AND COALESCE(roles,'{}') && ARRAY['PRODE','ADMIN_CUIDADO_PASTORAL']
   LIMIT 1;

  IF v_host IS NULL OR v_cohost IS NULL OR v_extrano IS NULL OR v_admin IS NULL THEN
    RAISE EXCEPTION 'No se encontraron los usuarios necesarios para la prueba';
  END IF;

  -- ── grupos descartables ─────────────────────────────────────────────────
  INSERT INTO groups (name, leader_name, status, host_id, co_host_id, members_count)
    VALUES ('__PRUEBA_APROBADO__',  'Prueba', 'approved', v_host, v_cohost, 5) RETURNING id INTO g_ok;
  INSERT INTO groups (name, leader_name, status, host_id, members_count)
    VALUES ('__PRUEBA_PENDIENTE__', 'Prueba', 'pending',  v_host, 0) RETURNING id INTO g_pend;
  INSERT INTO groups (name, leader_name, status, host_id, admin_note, members_count)
    VALUES ('__PRUEBA_RECHAZADO__', 'Prueba', 'rejected', v_host, 'nota del admin', 0) RETURNING id INTO g_rech;

  -- ── 1. anfitrión edita su grupo APROBADO ────────────────────────────────
  tot := tot + 1;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_host::text, true);
    SELECT * INTO r FROM groups WHERE id = g_ok;
    PERFORM admin_update_group_v2(g_ok, to_jsonb(r) || jsonb_build_object(
      'name', '__EDITADO__', 'description', 'nueva descripcion',
      'image_url', 'https://x/portada.jpg', 'is_online', true));
    SELECT * INTO r FROM groups WHERE id = g_ok;
    IF r.name = '__EDITADO__' AND r.status = 'approved' AND r.image_url = 'https://x/portada.jpg' AND r.is_online THEN
      ok := ok + 1;
      res := res || ' 1 OK    anfitrión edita su grupo APROBADO: guarda nombre, portada y online; sigue aprobado'::text;
    ELSE
      res := res || format(' 1 FALLA anfitrión edita APROBADO: name=%s status=%s image=%s online=%s',
                           r.name, r.status, r.image_url, r.is_online);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    res := res || (' 1 FALLA anfitrión edita APROBADO -> ' || SQLERRM);
  END;

  -- ── 2. anfitrión intenta aprobarse su grupo pendiente ───────────────────
  tot := tot + 1;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_host::text, true);
    SELECT * INTO r FROM groups WHERE id = g_pend;
    PERFORM admin_update_group_v2(g_pend, to_jsonb(r) || jsonb_build_object('status', 'approved'));
    SELECT * INTO r FROM groups WHERE id = g_pend;
    IF r.status = 'pending' THEN
      ok := ok + 1;
      res := res || ' 2 OK    anfitrión NO puede aprobarse su grupo: sigue pendiente'::text;
    ELSE
      res := res || format(' 2 FALLA anfitrión logró status=%s', r.status);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    res := res || (' 2 FALLA anfitrión intenta aprobarse -> ' || SQLERRM);
  END;

  -- ── 3. anfitrión intenta reasignar el grupo, inflar miembros o poner nota
  tot := tot + 1;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_host::text, true);
    SELECT * INTO r FROM groups WHERE id = g_ok;
    PERFORM admin_update_group_v2(g_ok, to_jsonb(r) || jsonb_build_object(
      'host_id', v_extrano, 'members_count', 999, 'admin_note', 'autoaprobado'));
    SELECT * INTO r FROM groups WHERE id = g_ok;
    IF r.host_id = v_host AND r.members_count = 5 AND r.admin_note IS NULL THEN
      ok := ok + 1;
      res := res || ' 3 OK    anfitrión NO puede cambiar host_id, members_count ni admin_note'::text;
    ELSE
      res := res || format(' 3 FALLA host_id_cambio=%s members=%s nota=%s',
                           r.host_id IS DISTINCT FROM v_host, r.members_count, r.admin_note);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    res := res || (' 3 FALLA campos protegidos -> ' || SQLERRM);
  END;

  -- ── 4. anfitrión re-envía un grupo rechazado ────────────────────────────
  tot := tot + 1;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_host::text, true);
    SELECT * INTO r FROM groups WHERE id = g_rech;
    PERFORM admin_update_group_v2(g_rech, to_jsonb(r) || jsonb_build_object('status', 'pending', 'name', '__REENVIADO__'));
    SELECT * INTO r FROM groups WHERE id = g_rech;
    IF r.status = 'pending' AND r.name = '__REENVIADO__' THEN
      ok := ok + 1;
      res := res || ' 4 OK    anfitrión re-envía un grupo RECHAZADO: pasa a pendiente'::text;
    ELSE
      res := res || format(' 4 FALLA re-envío: status=%s name=%s', r.status, r.name);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    res := res || (' 4 FALLA re-envío de rechazado -> ' || SQLERRM);
  END;

  -- ── 5. co-anfitrión edita, pero no puede cambiar el co-anfitrión ────────
  tot := tot + 1;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_cohost::text, true);
    SELECT * INTO r FROM groups WHERE id = g_ok;
    PERFORM admin_update_group_v2(g_ok, to_jsonb(r) || jsonb_build_object('name', '__POR_COANFITRION__', 'co_host_id', v_extrano));
    SELECT * INTO r FROM groups WHERE id = g_ok;
    IF r.name = '__POR_COANFITRION__' AND r.co_host_id = v_cohost THEN
      ok := ok + 1;
      res := res || ' 5 OK    co-anfitrión edita; NO puede cambiar el co_host_id'::text;
    ELSE
      res := res || format(' 5 FALLA co-anfitrión: name=%s co_host_cambio=%s',
                           r.name, r.co_host_id IS DISTINCT FROM v_cohost);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    res := res || (' 5 FALLA co-anfitrión -> ' || SQLERRM);
  END;

  -- ── 6. un usuario ajeno al grupo ────────────────────────────────────────
  tot := tot + 1;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_extrano::text, true);
    SELECT * INTO r FROM groups WHERE id = g_ok;
    PERFORM admin_update_group_v2(g_ok, to_jsonb(r) || jsonb_build_object('name', '__AJENO__'));
    res := res || ' 6 FALLA un usuario AJENO pudo editar el grupo'::text;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Unauthorized%' THEN
      ok := ok + 1;
      res := res || ' 6 OK    usuario ajeno al grupo: rechazado'::text;
    ELSE
      res := res || (' 6 FALLA ajeno, error inesperado -> ' || SQLERRM);
    END IF;
  END;

  -- ── 7. sin sesión ───────────────────────────────────────────────────────
  tot := tot + 1;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT * INTO r FROM groups WHERE id = g_ok;
    PERFORM admin_update_group_v2(g_ok, to_jsonb(r) || jsonb_build_object('name', '__ANONIMO__'));
    res := res || ' 7 FALLA se pudo editar SIN SESIÓN'::text;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Unauthorized%' THEN
      ok := ok + 1;
      res := res || ' 7 OK    sin sesión: rechazado'::text;
    ELSE
      res := res || (' 7 FALLA sin sesión, error inesperado -> ' || SQLERRM);
    END IF;
  END;

  -- ── 8. el admin conserva todos sus poderes ──────────────────────────────
  tot := tot + 1;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
    SELECT * INTO r FROM groups WHERE id = g_pend;
    PERFORM admin_update_group_v2(g_pend, to_jsonb(r) || jsonb_build_object(
      'status', 'approved', 'members_count', 7, 'admin_note', 'ok admin'));
    SELECT * INTO r FROM groups WHERE id = g_pend;
    IF r.status = 'approved' AND r.members_count = 7 AND r.admin_note = 'ok admin' THEN
      ok := ok + 1;
      res := res || ' 8 OK    admin aprueba y cambia members_count y admin_note'::text;
    ELSE
      res := res || format(' 8 FALLA admin: status=%s members=%s nota=%s', r.status, r.members_count, r.admin_note);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    res := res || (' 8 FALLA admin -> ' || SQLERRM);
  END;

  -- ── 9. admin con un rol que no existe en el enum ────────────────────────
  IF v_admin_enum IS NULL THEN
    res := res || ' 9 --    no hay admins con PRODE o ADMIN_CUIDADO_PASTORAL: caso no aplicable'::text;
  ELSE
    tot := tot + 1;
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', v_admin_enum::text, true);
      SELECT * INTO r FROM groups WHERE id = g_ok;
      PERFORM admin_update_group_v2(g_ok, to_jsonb(r) || jsonb_build_object('name', '__ADMIN_ENUM__'));
      SELECT * INTO r FROM groups WHERE id = g_ok;
      IF r.name = '__ADMIN_ENUM__' THEN
        ok := ok + 1;
        res := res || ' 9 OK    admin con PRODE/ADMIN_CUIDADO_PASTORAL puede editar'::text;
      ELSE
        res := res || format(' 9 FALLA admin fuera del enum: name=%s', r.name);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      res := res || (' 9 FALLA admin con rol fuera del enum -> ' || SQLERRM);
    END;
  END IF;

  RAISE EXCEPTION E'\n\n==== RESULTADO: % de % OK ====\n%\n\n(Este ERROR es a propósito: deshace todo lo que hizo la prueba. No queda ningún dato de prueba.)',
    ok, tot, array_to_string(res, E'\n');
END
$prueba$;
